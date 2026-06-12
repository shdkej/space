import { createClient } from "@supabase/supabase-js";

export function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase server credentials are not configured");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

export async function logActivity(supabase, { node_id = null, entity = "node", kind = null, action, summary }) {
  try {
    await supabase
      .from("control_center_activity")
      .insert({ node_id, entity, kind, action, summary });
  } catch {
    // Activity logging is best-effort; never block the primary mutation.
  }
}
