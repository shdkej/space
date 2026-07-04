export const SNAPSHOT_TABLE = "system_snapshots";
export const ACTION_TABLE = "system_actions";
export const ACTION_COLS = "id,created_at,requested_by,kind,target,status,result,executed_at";
export const ACTION_KINDS = ["cron_enable", "cron_disable", "collector_run_now"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function normalizeAction(input) {
  const kind = String(input.kind || "").trim();
  if (!ACTION_KINDS.includes(kind)) {
    return { error: `kind 값은 ${ACTION_KINDS.join(", ")} 중 하나여야 합니다.` };
  }
  const target = input.target == null ? null : String(input.target).trim();
  if ((kind === "cron_enable" || kind === "cron_disable") && !UUID_RE.test(target || "")) {
    return { error: "cron 액션의 target은 크론 UUID여야 합니다." };
  }
  return { data: { kind, target, requested_by: "cms" } };
}
