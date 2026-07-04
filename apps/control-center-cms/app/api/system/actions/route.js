import { NextResponse } from "next/server";
import { getServiceClient, logActivity } from "@/lib/supabase";
import { ACTION_TABLE, ACTION_COLS, normalizeAction } from "@/lib/system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(ACTION_TABLE)
      .select(ACTION_COLS)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return NextResponse.json({ actions: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = normalizeAction(await request.json());
    if (payload.error) return NextResponse.json({ error: payload.error }, { status: 400 });

    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(ACTION_TABLE)
      .insert(payload.data)
      .select(ACTION_COLS)
      .single();
    if (error) throw error;

    await logActivity(supabase, {
      entity: "system_action",
      kind: data.kind,
      action: "create",
      summary: `시스템 액션 요청 — ${data.kind}${data.target ? ` (${data.target.slice(0, 8)})` : ""}`
    });
    return NextResponse.json({ action: data }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
