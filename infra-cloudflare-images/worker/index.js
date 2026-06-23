// OpenClaw 이미지 업로드 Worker
//
// 흐름(책처럼 읽히게):
//   POST /         -> 토큰 검증 -> 이미지 추출 -> 리사이즈 -> R2 저장 -> 공개 URL 반환
//   GET  /list     -> R2 목록 반환 (?limit=, ?cursor= 페이지네이션)
//   GET  /random   -> R2 중 1장 무작위 선택 -> 공개 URL로 302 리다이렉트
//
// 바인딩(Terraform에서 주입):
//   BUCKET           R2 버킷
//   IMAGES           Cloudflare Images 바인딩 (인프라가 변환 처리 — Worker CPU/wasm 부담 없음)
//   UPLOAD_TOKEN     업로드 인증용 Bearer 토큰
//   PUBLIC_BASE_URL  조회용 공개 베이스 URL (예: https://img.shdkej.com)
//   MAX_WIDTH        리사이즈 최대 가로 픽셀
//   OUTPUT_FORMAT    저장 포맷 (예: image/webp)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 조회 엔드포인트(공개): 저장된 이미지 목록 / 랜덤 1장
    if (request.method === "GET" && url.pathname === "/list") {
      return listImages(request, env);
    }
    if (request.method === "GET" && url.pathname === "/random") {
      return randomImage(request, env);
    }

    if (request.method !== "POST") {
      return json({ error: "method_not_allowed" }, 405);
    }

    if (!isAuthorized(request, env)) {
      return json({ error: "unauthorized" }, 401);
    }

    const source = await extractImage(request);
    if (!source) {
      return json({ error: "no_image" }, 400);
    }

    const kind = uploadKind(url, request);
    const resized = await resizeImage(source.stream, env);
    const key = buildObjectKey(source.filename, resized.extension, kind);
    await storeToR2(env, key, resized);

    return json({ url: `${env.PUBLIC_BASE_URL}/${key}`, key }, 201);
  },
};

function isAuthorized(request, env) {
  const header = request.headers.get("Authorization") || "";
  return header === `Bearer ${env.UPLOAD_TOKEN}`;
}

// multipart/form-data(file 필드) 또는 raw body 둘 다 허용
async function extractImage(request) {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file") || form.get("image");
    if (!file || typeof file === "string") return null;
    return { stream: file.stream(), filename: file.name || "upload" };
  }

  if (!contentType.startsWith("image/")) return null;
  return { stream: request.body, filename: "upload" };
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

async function listImages(request, env) {
  const url = new URL(request.url);
  const limit = clamp(parseInt(url.searchParams.get("limit") || "100", 10), 1, 1000);
  const prefix = listingPrefix(url, "");
  const cursor = url.searchParams.get("cursor") || undefined;
  const listed = await env.BUCKET.list({ prefix, cursor, limit });
  const images = listed.objects
    .filter((object) => isImageKey(object.key))
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

function isImageKey(key) {
  return /\.(avif|gif|jpe?g|png|webp)$/i.test(key);
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

function buildObjectKey(filename, extension, kind) {
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}`;
  const id = crypto.randomUUID();
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

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}
