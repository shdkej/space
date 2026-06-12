export const NODE_TABLE = "control_center_nodes";
export const NODE_COLS =
  "id,parent_id,kind,title,subtitle,url,status,sort_order,visible,created_at,updated_at";

export const NODE_KINDS = ["surface", "section", "card", "link"];
export const NODE_STATUSES = [
  "none",
  "operational",
  "degraded",
  "down",
  "maintenance",
  "planned"
];

const KIND_SET = new Set(NODE_KINDS);
const STATUS_SET = new Set(NODE_STATUSES);

export function normalizeNode(input, { partial = false } = {}) {
  const data = {};
  const has = (k) => k in input;

  if (!partial || has("kind")) {
    const kind = String(input.kind || "").trim();
    if (!KIND_SET.has(kind)) return { error: "kind 값은 surface, section, card, link 중 하나여야 합니다." };
    data.kind = kind;
  }
  if (!partial || has("title")) {
    const title = String(input.title || "").trim();
    if (!title || title.length > 160) return { error: "title 값이 비어 있거나 너무 깁니다." };
    data.title = title;
  }
  if (has("subtitle")) {
    const v = input.subtitle == null ? null : String(input.subtitle).trim();
    if (v && v.length > 2000) return { error: "subtitle 값이 너무 깁니다." };
    data.subtitle = v || null;
  }
  if (has("url")) {
    const v = input.url == null ? null : String(input.url).trim();
    if (v && v.length > 1000) return { error: "url 값이 너무 깁니다." };
    data.url = v || null;
  }
  if (has("parent_id")) {
    data.parent_id = input.parent_id ? String(input.parent_id) : null;
  }
  if (!partial || has("status")) {
    const status = String(input.status || "none").trim();
    if (!STATUS_SET.has(status)) return { error: "status 값이 유효하지 않습니다." };
    data.status = status;
  }
  if (has("sort_order")) {
    const n = Number(input.sort_order);
    if (!Number.isFinite(n)) return { error: "sort_order 값이 숫자가 아닙니다." };
    data.sort_order = Math.trunc(n);
  }
  if (has("visible")) {
    data.visible = Boolean(input.visible);
  }
  return { data };
}
