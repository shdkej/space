import { NextResponse } from "next/server";
import { getServiceClient, logActivity } from "@/lib/supabase";
import { NODE_TABLE, NODE_COLS, normalizeNode } from "@/lib/nodes";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(NODE_TABLE)
      .select(NODE_COLS)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw error;
    return NextResponse.json({ nodes: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = normalizeNode(await request.json());
    if (payload.error) return NextResponse.json({ error: payload.error }, { status: 400 });

    const supabase = getServiceClient();

    if (payload.data.sort_order == null) {
      const { data: siblings } = await supabase
        .from(NODE_TABLE)
        .select("sort_order")
        .eq("parent_id", payload.data.parent_id ?? null)
        .order("sort_order", { ascending: false })
        .limit(1);
      payload.data.sort_order = siblings?.[0] ? siblings[0].sort_order + 1 : 0;
    }

    const { data, error } = await supabase
      .from(NODE_TABLE)
      .insert(payload.data)
      .select(NODE_COLS)
      .single();
    if (error) throw error;

    await logActivity(supabase, {
      node_id: data.id,
      kind: data.kind,
      action: "create",
      summary: `${data.kind} 생성 — ${data.title}`
    });
    return NextResponse.json({ node: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
