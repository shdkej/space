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
    const { pathname } = new URL(request.url);

    // 조회 엔드포인트(공개): 저장된 이미지 목록 / 랜덤 1장
    if (request.method === "GET" && pathname === "/list") {
      return listImages(request, env);
    }
    if (request.method === "GET" && pathname === "/random") {
      return randomImage(env);
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

    const resized = await resizeImage(source.stream, env);
    const key = buildObjectKey(source.filename, resized.extension);
    await storeToR2(env, key, resized);

    return json({ url: `${env.PUBLIC_BASE_URL}/${key}`, key }, 201);
  },
};

// 저장된 이미지 목록 반환. ?limit= 으로 개수 제한(기본/최대는 env로 조절).
async function listImages(request, env) {
  const url = new URL(request.url);
  const defaultLimit = parseInt(env.LIST_DEFAULT_LIMIT || "50", 10);
  const maxLimit = parseInt(env.LIST_MAX_LIMIT || "200", 10);

  const requested = parseInt(url.searchParams.get("limit") || String(defaultLimit), 10);
  const limit = clamp(Number.isNaN(requested) ? defaultLimit : requested, 1, maxLimit);

  const listed = await env.BUCKET.list({ limit, cursor: url.searchParams.get("cursor") || undefined });

  const images = listed.objects.map((obj) => ({
    key: obj.key,
    url: `${env.PUBLIC_BASE_URL}/${obj.key}`,
    size: obj.size,
    uploaded: obj.uploaded,
  }));

  return json({
    images,
    count: images.length,
    limit,
    cursor: listed.truncated ? listed.cursor : null,
  });
}

// 저장된 이미지 중 1장을 무작위로 골라 공개 URL로 리다이렉트.
async function randomImage(env) {
  const sample = parseInt(env.RANDOM_SAMPLE_SIZE || "1000", 10);
  const listed = await env.BUCKET.list({ limit: sample });

  if (!listed.objects.length) {
    return json({ error: "no_images" }, 404);
  }

  const pick = listed.objects[Math.floor(Math.random() * listed.objects.length)];
  return Response.redirect(`${env.PUBLIC_BASE_URL}/${pick.key}`, 302);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

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

function buildObjectKey(filename, extension) {
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${pad(now.getUTCMonth() + 1)}/${pad(now.getUTCDate())}`;
  const id = crypto.randomUUID();
  return `${datePath}/${id}.${extension}`;
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
