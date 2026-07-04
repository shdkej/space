import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_BASE_URL = process.env.IMAGE_CMS_BASE_URL || "https://upload.shdkej.com";

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
