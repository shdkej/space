import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_BASE_URL = process.env.IMAGE_CMS_BASE_URL || "https://upload.shdkej.com";
const IMAGE_ADMIN_TOKEN = process.env.IMAGE_ADMIN_TOKEN || "";

export async function GET(request) {
  try {
    const incoming = new URL(request.url);
    const target = new URL("/list", IMAGE_BASE_URL);
    const rawLimit = Number.parseInt(incoming.searchParams.get("limit") || "60", 10);
    const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(rawLimit, 100)) : 60;

    target.searchParams.set("kind", "original");
    target.searchParams.set("limit", String(limit));

    const cursor = incoming.searchParams.get("cursor");
    if (cursor) target.searchParams.set("cursor", cursor);

    const response = await fetch(target, { cache: "no-store" });
    const payload = await response.json();

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error.message || "image_list_failed" }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    if (!IMAGE_ADMIN_TOKEN) {
      return NextResponse.json({ error: "image_admin_token_missing" }, { status: 503 });
    }

    const incoming = new URL(request.url);
    const key = normalizeOriginalKey(incoming.searchParams.get("key") || "");
    if (!key) {
      return NextResponse.json({ error: "invalid_key" }, { status: 400 });
    }

    const target = new URL("/object", IMAGE_BASE_URL);
    target.searchParams.set("key", key);

    const response = await fetch(target, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${IMAGE_ADMIN_TOKEN}` },
      cache: "no-store",
    });
    const payload = await response.json();

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error.message || "image_delete_failed" }, { status: 500 });
  }
}

function normalizeOriginalKey(key) {
  const decoded = decodeURIComponent(key).replace(/^\/+/, "");
  if (!decoded.startsWith("original/")) return "";
  if (decoded.includes("..") || decoded.includes("//")) return "";
  if (!/\.(avif|gif|jpe?g|png|webp)$/i.test(decoded)) return "";
  return decoded;
}
