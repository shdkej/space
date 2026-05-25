// OpenClaw 이미지 업로드 Worker
//
// 흐름(책처럼 읽히게):
//   POST 요청 -> 토큰 검증 -> 이미지 추출 -> 리사이즈 -> R2 저장 -> 공개 URL 반환
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

  const result = await env.IMAGES.input(stream)
    .transform({ width: maxWidth, fit: "scale-down" })
    .output({ format });

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
