// OpenClaw 미디어 업로드 Worker
//
// 흐름(책처럼 읽히게):
//   POST /         -> 토큰 검증 -> 이미지/짧은 mp4 추출 -> R2 저장 -> 공개 URL 반환
//   GET  /list     -> R2 목록 반환 (?limit=, ?cursor= 페이지네이션)
//   GET  /random   -> R2 중 1장 무작위 선택 -> 공개 URL로 302 리다이렉트
//   DELETE /object -> 토큰 검증 -> key를 deleted/ 아래로 이동(소프트 삭제)
//
// 바인딩(Terraform에서 주입):
//   BUCKET           R2 버킷
//   IMAGES           Cloudflare Images 바인딩 (인프라가 변환 처리 — Worker CPU/wasm 부담 없음)
//   UPLOAD_TOKEN     업로드 인증용 Bearer 토큰
//   DELETE_TOKEN     삭제/휴지통 이동 인증용 Bearer 토큰
//   PUBLIC_BASE_URL  조회용 공개 베이스 URL (예: https://img.shdkej.com)
//   MAX_WIDTH        리사이즈 최대 가로 픽셀
//   OUTPUT_FORMAT    저장 포맷 (예: image/webp)
//   MAX_VIDEO_BYTES  mp4 최대 바이트 수 (기본 25MB)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/browser-upload") {
      return browserUpload(request, env);
    }
    if (url.pathname === "/browser-reclassify") {
      return browserReclassify(request, env);
    }

    // 조회 엔드포인트(공개): 저장된 이미지 목록 / 랜덤 1장
    if (request.method === "GET" && url.pathname === "/list") {
      return listImages(request, env);
    }
    if (request.method === "GET" && url.pathname === "/random") {
      return randomImage(request, env);
    }

    if (request.method === "DELETE" && url.pathname === "/object") {
      if (!isDeleteAuthorized(request, env)) {
        return json({ error: "unauthorized" }, 401);
      }
      return softDeleteImage(request, env);
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (!isAuthorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }

    const source = await extractMedia(request, env);
    if (!source) {
      return json({ error: "no_image" }, 400);
    }

    const kind = uploadKind(url, request);
    const media = source.mediaType === "video"
      ? await passthroughVideo(source, env)
      : await resizeImage(source.stream, env);
    if (!media) {
      return json({ error: "media_too_large" }, 413);
    }
    const key = buildObjectKey(source.filename, media.extension, kind, source.mediaType);
    await storeToR2(env, key, media);

    return json({ url: `${env.PUBLIC_BASE_URL}/${key}`, key }, 201);
  },
};

function isAuthorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  return header === `Bearer ${env.UPLOAD_TOKEN}`;
}

async function browserUpload(request, env) {
  const origin = request.headers.get("origin") || "";
  const cors = origin ? browserCors(origin) : {};
  if (origin && !cors) return json({ error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  const email = (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
  const ownerEmail = (env.ARCHIVE_OWNER_EMAIL || "").trim().toLowerCase();
  if (!ownerEmail || !email || email !== ownerEmail) {
    return json({ error: "owner_login_required" }, 403, cors);
  }
  if (request.method === "GET") {
    return new Response("<!doctype html><meta charset=\"utf-8\"><title>인증 완료</title><p>본인 확인이 끝났습니다. 이 탭을 닫고 이미지 보관함에서 업로드해 주세요.</p>", {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...cors },
    });
  }
  if (request.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405, cors);
  }

  const form = await request.formData();
  const file = form.get("file");
  if (!file || typeof file === "string" || !file.type?.startsWith("image/")) {
    return json({ error: "image_required" }, 400, cors);
  }
  const maxBytes = Math.min(Number.parseInt(env.MAX_IMAGE_BYTES || "20971520", 10) || 0, 25 * 1024 * 1024);
  if (file.size <= 0 || file.size > maxBytes) {
    return json({ error: "image_size_invalid", maxBytes }, 413, cors);
  }

  const media = await resizeImage(file.stream(), env);
  if (!media) return json({ error: "media_too_large" }, 413, cors);
  const key = buildObjectKey(file.name || "upload", media.extension, "original", "image");
  await storeToR2(env, key, media);
  const result = { key, url: `${env.PUBLIC_BASE_URL}/${key}`, classification: null };

  try {
    result.classification = await classifyArchiveImage(env, key);
  } catch (error) {
    console.error("archive_classification_failed", error instanceof Error ? error.message : "unknown");
    result.classificationError = "uploaded_but_classification_failed";
  }
  return json(result, 201, cors);
}

async function browserReclassify(request, env) {
  const origin = request.headers.get("origin") || "";
  const cors = origin ? browserCors(origin) : {};
  if (origin && !cors) return json({ error: "origin_not_allowed" }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  const email = (request.headers.get("cf-access-authenticated-user-email") || "").trim().toLowerCase();
  const ownerEmail = (env.ARCHIVE_OWNER_EMAIL || "").trim().toLowerCase();
  if (!ownerEmail || !email || email !== ownerEmail) return json({ error: "owner_login_required" }, 403, cors);
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, cors);

  const body = await request.json();
  const key = typeof body.image_key === "string" ? body.image_key.trim() : "";
  if (!key.startsWith("original/") || key.includes("..") || key.length > 500) {
    return json({ error: "image_key_invalid" }, 400, cors);
  }
  try {
    const classification = await classifyArchiveImage(env, key);
    return json({ key, classification }, 200, cors);
  } catch (error) {
    console.error("archive_reclassification_failed", error instanceof Error ? error.message : "unknown");
    return json({ error: "classification_failed" }, 502, cors);
  }
}

async function classifyArchiveImage(env, key) {
  if (!env.ARCHIVE_API_URL || !env.ARCHIVE_PROXY_TOKEN) {
    throw new Error("classification_not_configured");
  }
  const response = await fetch(env.ARCHIVE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Archive-Proxy-Token": env.ARCHIVE_PROXY_TOKEN,
    },
    body: JSON.stringify({ image_key: key }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || "classification_failed");
  return payload.topic;
}

function browserCors(origin) {
  if (origin !== "https://images.aws.shdkej.com") return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function isDeleteAuthorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  return Boolean(env.DELETE_TOKEN) && header === `Bearer ${env.DELETE_TOKEN}`;
}

// 이미지는 multipart/form-data(file/image 필드) 또는 raw body를 허용한다.
// mp4는 content-length를 먼저 검사할 수 있는 raw body만 허용한다.
async function extractMedia(request, env) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") || form.get("image");
    if (!file || typeof file === "string") return null;
    return sourceFromFile(file, env);
  }

  const mediaType = mediaTypeForContentType(contentType);
  if (!mediaType) return null;
  if (mediaType === "video" && !isAllowedVideoSize(request, env)) {
    return null;
  }
  return { stream: request.body, filename: "upload", contentType, mediaType };
}

function sourceFromFile(file, env) {
  const contentType = file.type || "";
  const mediaType = mediaTypeForContentType(contentType);
  if (!mediaType) return null;
  if (mediaType === "video") return null;
  return {
    stream: file.stream(),
    filename: file.name || "upload",
    contentType,
    mediaType,
  };
}

function mediaTypeForContentType(contentType) {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.toLowerCase().split(";", 1)[0].trim() === "video/mp4") return "video";
  return "";
}

function isAllowedVideoSize(request, env) {
  const rawLength = request.headers.get("content-length");
  if (!rawLength) return false;
  const length = parseInt(rawLength, 10);
  return Number.isFinite(length) && length <= maxVideoBytes(env);
}

function maxVideoBytes(env) {
  const value = parseInt(env.MAX_VIDEO_BYTES || String(25 * 1024 * 1024), 10);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(value, 100 * 1024 * 1024);
}

async function resizeImage(stream, env) {
  const maxWidth = parseInt(env.MAX_WIDTH || "1600", 10);
  const format = env.OUTPUT_FORMAT || "image/webp";
  const quality = parseInt(env.OUTPUT_QUALITY || "80", 10);

  const result = await env.IMAGES.input(stream)
    .transform({ width: maxWidth, fit: "scale-down" })
    .output({ format, quality });

  return {
    body: result.image(),
    contentType: format,
    extension: extensionFor(format),
  };
}

async function storeToR2(env, key, resized) {
  await env.BUCKET.put(key, resized.body, {
    httpMetadata: { contentType: resized.contentType },
  });
}

async function passthroughVideo(source, env) {
  const body = await new Response(source.stream).arrayBuffer();
  if (body.byteLength > maxVideoBytes(env)) return null;
  return {
    body,
    contentType: "video/mp4",
    extension: "mp4",
  };
}

async function listImages(request, env) {
  const url = new URL(request.url);
  const limit = clamp(parseInt(url.searchParams.get("limit") || "100", 10), 1, 1000);
  const prefix = listingPrefix(url, "");
  const cursor = url.searchParams.get("cursor") || undefined;
  const listed = await env.BUCKET.list({ prefix, cursor, limit });
  const images = listed.objects
    .filter((object) => isMediaKey(object.key))
    .map((object) => ({
      key: object.key,
      url: `${env.PUBLIC_BASE_URL}/${object.key}`,
      size: object.size,
      uploaded: object.uploaded,
    }));
  return json({
    images,
    count: images.length,
    limit,
    cursor: listed.truncated ? listed.cursor : null,
    prefix,
  }, 200);
}

async function randomImage(request, env) {
  const url = new URL(request.url);
  const prefix = listingPrefix(url, "original/");
  const limit = clamp(parseInt(url.searchParams.get("limit") || "1000", 10), 1, 1000);
  const listed = await env.BUCKET.list({ prefix, limit });
  const candidates = listed.objects.filter((object) => isImageKey(object.key));
  if (!candidates.length) {
    return json({ error: "no_images" }, 404);
  }
  const index = cryptoRandomInt(candidates.length);
  const picked = candidates[index];
  return Response.redirect(`${env.PUBLIC_BASE_URL}/${picked.key}`, 302);
}

async function softDeleteImage(request, env) {
  const url = new URL(request.url);
  const key = url.searchParams.get("key") || "";
  const normalized = normalizeDeletableKey(key);
  if (!normalized) {
    return json({ error: "invalid_key" }, 400);
  }

  const object = await env.BUCKET.get(normalized);
  if (!object) {
    return json({ error: "not_found" }, 404);
  }

  const deletedKey = `deleted/${normalized}`;
  await env.BUCKET.put(deletedKey, object.body, {
    httpMetadata: object.httpMetadata,
    customMetadata: {
      ...(object.customMetadata || {}),
      deletedFrom: normalized,
      deletedAt: new Date().toISOString(),
    },
  });
  await env.BUCKET.delete(normalized);

  return json({
    ok: true,
    key: normalized,
    deletedKey,
    deletedUrl: `${env.PUBLIC_BASE_URL}/${deletedKey}`,
  }, 200);
}

function isImageKey(key) {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(key);
}

function isMediaKey(key) {
  return /\.(avif|gif|jpe?g|mp4|png|webp)$/i.test(key);
}

function normalizeDeletableKey(key) {
  const decoded = decodeURIComponent(key).replace(/^\/+/, "");
  if (!decoded.startsWith("original/")) return "";
  if (decoded.includes("..") || decoded.includes("//")) return "";
  if (!isMediaKey(decoded)) return "";
  return decoded;
}

function cryptoRandomInt(max) {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return array[0] % max;
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function uploadKind(url, request) {
  const raw = (
    url.searchParams.get("kind") ||
    url.searchParams.get("type") ||
    request.headers.get("x-image-kind") ||
    ""
  ).toLowerCase();
  return raw === "original" ? "original" : "derived";
}

function listingPrefix(url, fallback) {
  const prefix = url.searchParams.get("prefix");
  if (prefix !== null) return prefix;

  const rawKind = (url.searchParams.get("kind") || url.searchParams.get("type") || "").toLowerCase();
  if (rawKind === "original") return "original/";
  if (rawKind === "derived") return "derived/";

  return fallback;
}

function buildObjectKey(filename, extension, kind, mediaType = "image") {
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}`;
  const id = crypto.randomUUID();
  if (mediaType === "video") {
    return `${kind}/videos/${datePath}/${id}.${extension}`;
  }
  return `${kind}/${datePath}/${id}.${extension}`;
}

function extensionFor(format) {
  const map = {
    "image/webp": "webp",
    "image/avif": "avif",
    "image/jpeg": "jpg",
    "image/png": "png",
  };
  return map[format] || "bin";
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function json(body, status, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...extraHeaders },
  });
}
