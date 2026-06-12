import { NextResponse } from "next/server";
import { getServiceClient, logActivity } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE = "control_center_items";
const COLS = "id,surface,field_key,value,status,created_at,updated_at";
const allowedStatuses = new Set(["draft", "ready", "published"]);

function normalizePayload(input) {
  const surface = String(input.surface || "family-wedding").trim();
  const fieldKey = String(input.field_key || "notice").trim();
  const value = String(input.value || "").trim();
  const status = String(input.status || "draft").trim();

  if (!surface || surface.length > 80) return { error: "surface 값이 비어 있거나 너무 깁니다." };
  if (!fieldKey || fieldKey.length > 80) return { error: "field_key 값이 비어 있거나 너무 깁니다." };
  if (!value || value.length > 2000) return { error: "value 값이 비어 있거나 너무 깁니다." };
  if (!allowedStatuses.has(status)) {
    return { error: "status 값은 draft, ready, published 중 하나여야 합니다." };
  }
  return { data: { surface, field_key: fieldKey, value, status } };
}

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(TABLE)
      .select(COLS)
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return NextResponse.json({ items: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = normalizePayload(await request.json());
    if (payload.error) return NextResponse.json({ error: payload.error }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase.from(TABLE).insert(payload.data).select(COLS).single();
    if (error) throw error;

    await logActivity(supabase, {
      entity: "item",
      action: "create",
      summary: `record 생성 — ${data.surface}/${data.field_key} (${data.status})`
    });
    return NextResponse.json({ item: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
