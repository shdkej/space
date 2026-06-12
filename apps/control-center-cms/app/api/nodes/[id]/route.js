import { NextResponse } from "next/server";
import { getServiceClient, logActivity } from "@/lib/supabase";
import { NODE_TABLE, NODE_COLS, normalizeNode } from "@/lib/nodes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function PATCH(request, context) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const payload = normalizeNode(body, { partial: true });
    if (payload.error) return NextResponse.json({ error: payload.error }, { status: 400 });
    payload.data.updated_at = new Date().toISOString();

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(NODE_TABLE)
      .update(payload.data)
      .eq("id", id)
      .select(NODE_COLS)
      .single();
    if (error) throw error;

    const action = "visible" in body && Object.keys(payload.data).length <= 2
      ? "visibility"
      : "sort_order" in body && Object.keys(payload.data).length <= 2
      ? "reorder"
      : "update";
    const summary =
      action === "visibility"
        ? `${data.kind} ${data.visible ? "노출" : "숨김"} — ${data.title}`
        : action === "reorder"
        ? `${data.kind} 순서 변경 — ${data.title}`
        : `${data.kind} 수정 — ${data.title}`;

    await logActivity(supabase, { node_id: data.id, kind: data.kind, action, summary });
    return NextResponse.json({ node: data });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(_request, context) {
  try {
    const { id } = await context.params;
    const supabase = getServiceClient();

    const { data: existing } = await supabase
      .from(NODE_TABLE)
      .select("kind,title")
      .eq("id", id)
      .single();

    const { error } = await supabase.from(NODE_TABLE).delete().eq("id", id);
    if (error) throw error;

    await logActivity(supabase, {
      node_id: null,
      kind: existing?.kind || null,
      action: "delete",
      summary: `${existing?.kind || "node"} 삭제 — ${existing?.title || id}`
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
