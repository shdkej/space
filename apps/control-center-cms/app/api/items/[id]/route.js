import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const TABLE = "control_center_items";
const allowedStatuses = new Set(["draft", "ready", "published"]);

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

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
    if (payload.error) {
      return NextResponse.json({ error: payload.error }, { status: 400 });
    }

    const supabase = getClient();
    const { data, error } = await supabase
      .from(TABLE)
      .update(payload.data)
      .eq("id", id)
      .select("id,surface,field_key,value,status,created_at,updated_at")
      .single();

    if (error) throw error;
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  try {
    const { id } = await context.params;
    const supabase = getClient();
    const { error } = await supabase.from(TABLE).delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
