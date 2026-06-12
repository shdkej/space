import { NextResponse } from "next/server";
import { getServiceClient, logActivity } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE = "control_center_items";
const COLS = "id,surface,field_key,value,status,created_at,updated_at";
const allowedStatuses = new Set(["draft", "ready", "published"]);

function normalizePatch(input) {
  const data = {};
  if ("surface" in input) data.surface = String(input.surface || "").trim();
  if ("field_key" in input) data.field_key = String(input.field_key || "").trim();
  if ("value" in input) data.value = String(input.value || "").trim();
  if ("status" in input) data.status = String(input.status || "").trim();

  if ("surface" in data && (!data.surface || data.surface.length > 80)) {
    return { error: "surface 값이 비어 있거나 너무 깁니다." };
  }
  if ("field_key" in data && (!data.field_key || data.field_key.length > 80)) {
    return { error: "field_key 값이 비어 있거나 너무 깁니다." };
  }
  if ("value" in data && (!data.value || data.value.length > 2000)) {
    return { error: "value 값이 비어 있거나 너무 깁니다." };
  }
  if ("status" in data && !allowedStatuses.has(data.status)) {
    return { error: "status 값은 draft, ready, published 중 하나여야 합니다." };
  }

  data.updated_at = new Date().toISOString();
  return { data };
}

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const payload = normalizePatch(await request.json());
    if (payload.error) return NextResponse.json({ error: payload.error }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload.data)
      .eq("id", id)
      .select(COLS)
      .single();
    if (error) throw error;

    await logActivity(supabase, {
      entity: "item",
      action: "update",
      summary: `record 수정 — ${data.surface}/${data.field_key} (${data.status})`
    });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  try {
    const { id } = await context.params;
    const supabase = getServiceClient();
    const { data: existing } = await supabase
      .from(TABLE)
      .select("surface,field_key")
      .eq("id", id)
      .single();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;

    await logActivity(supabase, {
      entity: "item",
      action: "delete",
      summary: `record 삭제 — ${existing?.surface || "?"}/${existing?.field_key || id}`
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
