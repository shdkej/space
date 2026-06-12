import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("control_center_activity")
      .select("id,node_id,entity,kind,action,summary,created_at")
      .order("created_at", { ascending: false })
      .limit(40);
    if (error) throw error;
    return NextResponse.json({ activity: data || [] });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
