export const STATUS_META = {
  none: { label: "미지정", dot: "bg-muted-foreground/40", text: "text-muted-foreground" },
  operational: { label: "정상", dot: "bg-[hsl(var(--ok))]", text: "text-[hsl(var(--ok))]" },
  degraded: { label: "저하", dot: "bg-[hsl(var(--warn))]", text: "text-[hsl(var(--warn))]" },
  down: { label: "중단", dot: "bg-[hsl(var(--down))]", text: "text-[hsl(var(--down))]" },
  maintenance: { label: "점검", dot: "bg-[hsl(var(--warn))]", text: "text-[hsl(var(--warn))]" },
  planned: { label: "예정", dot: "bg-primary/60", text: "text-primary" }
};

export const STATUS_ORDER = ["none", "operational", "degraded", "down", "maintenance", "planned"];

export const KIND_META = {
  surface: { label: "Surface", hint: "최상위 운영 표면" },
  section: { label: "Section", hint: "표면 내 묶음" },
  card: { label: "Card", hint: "상태 카드" },
  link: { label: "Link", hint: "바로가기" }
};

export const KIND_ORDER = ["surface", "section", "card", "link"];

export const CHILD_KIND = { surface: "section", section: "card", card: "link", link: null };
