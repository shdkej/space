import { NextResponse } from "next/server";
import { getServiceClient } from "@/lib/supabase";
import { SNAPSHOT_TABLE } from "@/lib/system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from(SNAPSHOT_TABLE)
      .select("id,created_at,collector_version,payload")
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    return NextResponse.json({ snapshot: data?.[0] || null });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
