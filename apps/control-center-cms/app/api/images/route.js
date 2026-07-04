import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const IMAGE_BASE_URL = process.env.IMAGE_CMS_BASE_URL || "https://upload.shdkej.com";

export async function GET(request) {
  try {
    const incoming = new URL(request.url);
    const target = new URL("/list", IMAGE_BASE_URL);
    target.searchParams.set("kind", incoming.searchParams.get("kind") || "original");
    target.searchParams.set("limit", incoming.searchParams.get("limit") || "60");

    const cursor = incoming.searchParams.get("cursor");
    if (cursor) target.searchParams.set("cursor", cursor);

    const response = await fetch(target, { cache: "no-store" });
    const payload = await response.json();

    return NextResponse.json(payload, { status: response.status });
  } catch (error) {
    return NextResponse.json({ error: error.message || "image_list_failed" }, { status: 500 });
  }
}
