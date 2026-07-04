"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  Image,
  Layers,
  Link2,
  Moon,
  Pencil,
  Plus,
  RefreshCw,
  Rows3,
  Square,
  Sun,
  Trash2
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import {
  STATUS_META,
  STATUS_ORDER,
  KIND_META,
  CHILD_KIND
} from "@/lib/status-meta";

const KIND_ICON = { surface: Layers, section: Rows3, card: Square, link: Link2 };

function buildTree(nodes) {
  const byParent = new Map();
  for (const n of nodes) {
    const key = n.parent_id || "root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }
  const attach = (key) =>
    (byParent.get(key) || []).map((n) => ({ ...n, children: attach(n.id) }));
  return attach("root");
}

function StatusDot({ status }) {
  const meta = STATUS_META[status] || STATUS_META.none;
  return <span className={cn("inline-block h-2 w-2 rounded-full", meta.dot)} aria-hidden />;
}

function fmt(ts) {
  if (!ts) return "";
  return new Date(ts).toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

const emptyDraft = { kind: "surface", parent_id: null, title: "", subtitle: "", url: "", status: "none", visible: true };

export default function Page() {
  const [nodes, setNodes] = useState([]);
  const [items, setItems] = useState([]);
  const [activity, setActivity] = useState([]);
  const [originalImages, setOriginalImages] = useState([]);
  const [originalCursor, setOriginalCursor] = useState(null);
  const [imagesLoading, setImagesLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [dark, setDark] = useState(false);

  const [editor, setEditor] = useState({ open: false, mode: "create", id: null, draft: emptyDraft });

  const [itemForm, setItemForm] = useState({
    surface: "family-wedding",
    field_key: "notice",
    value: "",
    status: "draft"
  });
  const [itemEditId, setItemEditId] = useState(null);

  const toast = useCallback((text, tone = "info") => {
    setMessage({ text, tone });
    setTimeout(() => setMessage(null), 2600);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [n, i, a] = await Promise.all([
        fetch("/api/nodes", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/items", { cache: "no-store" }).then((r) => r.json()),
        fetch("/api/activity", { cache: "no-store" }).then((r) => r.json())
      ]);
      setNodes(n.nodes || []);
      setItems(i.items || []);
      setActivity(a.activity || []);
    } catch (error) {
      toast(error.message || "데이터를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const loadOriginalImages = useCallback(async ({ append = false, cursor = null } = {}) => {
    setImagesLoading(true);
    try {
      const params = new URLSearchParams({ kind: "original", limit: "60" });
      if (cursor) params.set("cursor", cursor);
      const res = await fetch(`/api/images?${params.toString()}`, { cache: "no-store" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "이미지를 불러오지 못했습니다.");
      setOriginalImages((current) => (append ? [...current, ...(payload.images || [])] : payload.images || []));
      setOriginalCursor(payload.cursor || null);
    } catch (error) {
      toast(error.message || "이미지를 불러오지 못했습니다.", "error");
    } finally {
      setImagesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadOriginalImages();
  }, [loadOriginalImages]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const tree = useMemo(() => buildTree(nodes), [nodes]);

  const stats = useMemo(() => {
    const acc = { surface: 0, section: 0, card: 0, link: 0, visible: 0, hidden: 0, down: 0 };
    for (const n of nodes) {
      acc[n.kind] = (acc[n.kind] || 0) + 1;
      n.visible ? (acc.visible += 1) : (acc.hidden += 1);
      if (n.status === "down" || n.status === "degraded") acc.down += 1;
    }
    return acc;
  }, [nodes]);

  function openCreate(kind, parentId = null) {
    setEditor({
      open: true,
      mode: "create",
      id: null,
      draft: { ...emptyDraft, kind, parent_id: parentId }
    });
  }

  function openEdit(node) {
    setEditor({
      open: true,
      mode: "edit",
      id: node.id,
      draft: {
        kind: node.kind,
        parent_id: node.parent_id,
        title: node.title || "",
        subtitle: node.subtitle || "",
        url: node.url || "",
        status: node.status || "none",
        visible: node.visible
      }
    });
  }

  function setDraft(patch) {
    setEditor((e) => ({ ...e, draft: { ...e.draft, ...patch } }));
  }

  async function saveNode() {
    const { mode, id, draft } = editor;
    if (!draft.title.trim()) return toast("title을 입력하세요.", "error");
    setBusy(true);
    try {
      const target = mode === "edit" ? `/api/nodes/${id}` : "/api/nodes";
      const res = await fetch(target, {
        method: mode === "edit" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "저장 실패");
      toast(mode === "edit" ? "수정했습니다." : "추가했습니다.");
      setEditor((e) => ({ ...e, open: false }));
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function patchNode(id, body, okText) {
    setBusy(true);
    try {
      const res = await fetch(`/api/nodes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "업데이트 실패");
      if (okText) toast(okText);
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function deleteNode(node) {
    const childCount = nodes.filter((n) => n.parent_id === node.id).length;
    const warn = childCount
      ? `"${node.title}" 및 하위 ${childCount}개 항목을 삭제할까요?`
      : `"${node.title}"을(를) 삭제할까요?`;
    if (!window.confirm(warn)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/nodes/${node.id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "삭제 실패");
      toast("삭제했습니다.");
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function move(node, dir) {
    const siblings = nodes
      .filter((n) => (n.parent_id || null) === (node.parent_id || null))
      .sort((a, b) => a.sort_order - b.sort_order || (a.created_at < b.created_at ? -1 : 1));
    const idx = siblings.findIndex((n) => n.id === node.id);
    const swapWith = siblings[idx + dir];
    if (!swapWith) return;
    setBusy(true);
    try {
      await Promise.all([
        fetch(`/api/nodes/${node.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: swapWith.sort_order })
        }),
        fetch(`/api/nodes/${swapWith.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sort_order: node.sort_order })
        })
      ]);
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  // ---- legacy registry (control_center_items) ----
  async function saveItem(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const target = itemEditId ? `/api/items/${itemEditId}` : "/api/items";
      const res = await fetch(target, {
        method: itemEditId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemForm)
      });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "저장 실패");
      toast(itemEditId ? "record 수정" : "record 생성");
      setItemEditId(null);
      setItemForm({ surface: "family-wedding", field_key: "notice", value: "", status: "draft" });
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(id) {
    if (!window.confirm("이 record를 삭제할까요?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/items/${id}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) throw new Error(payload.error || "삭제 실패");
      toast("record 삭제");
      if (itemEditId === id) setItemEditId(null);
      await loadAll();
    } catch (error) {
      toast(error.message, "error");
    } finally {
      setBusy(false);
    }
  }

  async function copyImageUrl(url) {
    try {
      await navigator.clipboard.writeText(url);
      toast("이미지 URL을 복사했습니다.");
    } catch {
      toast("복사하지 못했습니다. 이미지를 새 탭에서 열어 URL을 복사하세요.", "error");
    }
  }

  return (
    <div className="min-h-screen">
      <Header
        stats={stats}
        dark={dark}
        onToggleDark={() => setDark((d) => !d)}
        onRefresh={loadAll}
        onNewSurface={() => openCreate("surface", null)}
        busy={busy || loading}
      />

      <main className="container max-w-[1320px] pb-20 pt-6">
        <Tabs defaultValue="composition">
          <TabsList>
            <TabsTrigger value="composition">
              <Layers className="h-3.5 w-3.5" /> Status 구성
            </TabsTrigger>
            <TabsTrigger value="registry">
              <Square className="h-3.5 w-3.5" /> Surface Registry
            </TabsTrigger>
            <TabsTrigger value="images">
              <Image className="h-3.5 w-3.5" /> Original Images
            </TabsTrigger>
            <TabsTrigger value="activity">
              <Activity className="h-3.5 w-3.5" /> Activity
            </TabsTrigger>
          </TabsList>

          <TabsContent value="composition">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <Composition
                tree={tree}
                loading={loading}
                onAddChild={openCreate}
                onEdit={openEdit}
                onDelete={deleteNode}
                onToggle={(n) => patchNode(n.id, { visible: !n.visible }, n.visible ? "숨김 처리" : "노출")}
                onMove={move}
              />
              <Preview tree={tree} activity={activity} />
            </div>
          </TabsContent>

          <TabsContent value="registry">
            <Registry
              items={items}
              form={itemForm}
              setForm={setItemForm}
              editId={itemEditId}
              onSubmit={saveItem}
              onEdit={(it) => {
                setItemEditId(it.id);
                setItemForm({ surface: it.surface, field_key: it.field_key, value: it.value, status: it.status });
              }}
              onCancel={() => {
                setItemEditId(null);
                setItemForm({ surface: "family-wedding", field_key: "notice", value: "", status: "draft" });
              }}
              onDelete={removeItem}
              busy={busy}
            />
          </TabsContent>

          <TabsContent value="images">
            <OriginalImages
              images={originalImages}
              cursor={originalCursor}
              loading={imagesLoading}
              onRefresh={() => loadOriginalImages()}
              onLoadMore={() => loadOriginalImages({ append: true, cursor: originalCursor })}
              onCopy={copyImageUrl}
            />
          </TabsContent>

          <TabsContent value="activity">
            <ActivityFeed activity={activity} />
          </TabsContent>
        </Tabs>
      </main>

      <NodeEditor
        editor={editor}
        onOpenChange={(open) => setEditor((e) => ({ ...e, open }))}
        setDraft={setDraft}
        onSave={saveNode}
        busy={busy}
      />

      {message ? (
        <div
          className={cn(
            "fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-md border px-4 py-2 text-sm shadow-lg",
            message.tone === "error"
              ? "border-destructive/30 bg-destructive text-destructive-foreground"
              : "border-border bg-card text-foreground"
          )}
          role="status"
        >
          {message.text}
        </div>
      ) : null}
    </div>
  );
}

function OriginalImages({ images, cursor, loading, onRefresh, onLoadMore, onCopy }) {
  const totalSize = images.reduce((sum, image) => sum + (image.size || 0), 0);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle>Original Images</CardTitle>
            <CardDescription>업로드된 원본 이미지를 모아 보고, 카드뉴스나 시안 작업에 쓸 URL을 복사합니다.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> 새로고침
          </Button>
        </CardHeader>
        <CardContent>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <div className="rounded-md border bg-background px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">{images.length}</div>
              <div className="text-[11px] text-muted-foreground">불러온 원본</div>
            </div>
            <div className="rounded-md border bg-background px-3 py-2">
              <div className="text-lg font-semibold tabular-nums">{formatBytes(totalSize)}</div>
              <div className="text-[11px] text-muted-foreground">현재 표시 용량</div>
            </div>
            <div className="rounded-md border bg-background px-3 py-2">
              <div className="text-lg font-semibold">{cursor ? "더 있음" : "끝"}</div>
              <div className="text-[11px] text-muted-foreground">페이지 상태</div>
            </div>
          </div>

          {images.length === 0 ? (
            <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
              {loading ? "원본 이미지를 불러오는 중입니다." : "표시할 원본 이미지가 없습니다."}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {images.map((image) => (
                <article key={image.key} className="overflow-hidden rounded-md border bg-card">
                  <a href={image.url} target="_blank" rel="noreferrer" className="block bg-muted">
                    <img
                      src={image.url}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover transition-opacity hover:opacity-90"
                    />
                  </a>
                  <div className="space-y-2 p-3">
                    <div className="min-h-[2.5rem] break-all text-xs font-medium leading-snug">{image.key}</div>
                    <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(image.uploaded)}</span>
                      <span>{formatBytes(image.size)}</span>
                    </div>
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="h-8 flex-1" onClick={() => onCopy(image.url)}>
                        <Copy className="h-3.5 w-3.5" /> URL
                      </Button>
                      <Button asChild variant="outline" size="sm" className="h-8 flex-1">
                        <a href={image.url} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> 열기
                        </a>
                      </Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          {cursor ? (
            <div className="mt-4 flex justify-center">
              <Button variant="outline" onClick={onLoadMore} disabled={loading}>
                {loading ? "불러오는 중" : "더 보기"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function formatBytes(size) {
  if (!Number.isFinite(size) || size <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "2-digit",
    month: "2-digit",
    day: "2-digit"
  });
}

function Header({ stats, dark, onToggleDark, onRefresh, onNewSurface, busy }) {
  const pills = [
    { label: "Surface", value: stats.surface },
    { label: "Card", value: stats.card },
    { label: "노출", value: stats.visible },
    { label: "이슈", value: stats.down }
  ];
  return (
    <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
      <div className="container max-w-[1320px] py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Control Center
              </p>
              <h1 className="text-base font-semibold leading-tight">Status 구성 · 운영 CMS</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 sm:flex">
              {pills.map((p) => (
                <div
                  key={p.label}
                  className="rounded-md border bg-card px-2.5 py-1 text-center leading-none"
                >
                  <div className="text-sm font-semibold tabular-nums">{p.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {p.label}
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="icon" onClick={onToggleDark} aria-label="테마 전환">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="icon" onClick={onRefresh} disabled={busy} aria-label="새로고침">
              <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} />
            </Button>
            <Button size="sm" onClick={onNewSurface}>
              <Plus className="h-4 w-4" /> Surface
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}

function NodeRow({ node, depth, onAddChild, onEdit, onDelete, onToggle, onMove }) {
  const Icon = KIND_ICON[node.kind] || Square;
  const childKind = CHILD_KIND[node.kind];
  const meta = STATUS_META[node.status] || STATUS_META.none;
  return (
    <div>
      <div
        className={cn(
          "group flex items-start gap-2 rounded-md border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-accent/50",
          !node.visible && "opacity-55"
        )}
        style={{ marginLeft: depth * 16 }}
      >
        <div className="mt-0.5 flex items-center gap-1.5">
          <StatusDot status={node.status} />
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="break-words text-sm font-medium">{node.title}</span>
            <Badge variant="muted" className="text-[10px]">
              {KIND_META[node.kind]?.label || node.kind}
            </Badge>
            {node.status !== "none" ? (
              <span className={cn("text-[11px] font-medium", meta.text)}>{meta.label}</span>
            ) : null}
          </div>
          {node.subtitle ? (
            <p className="mt-0.5 break-words text-xs text-muted-foreground">{node.subtitle}</p>
          ) : null}
          {node.url ? (
            <a
              href={node.url}
              target="_blank"
              rel="noreferrer"
              className="mt-0.5 inline-flex items-center gap-1 break-all text-xs text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3 shrink-0" />
              {node.url}
            </a>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(node, -1)} aria-label="위로">
            <ChevronUp className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onMove(node, 1)} aria-label="아래로">
            <ChevronDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => onToggle(node)}
            aria-label="노출 전환"
          >
            {node.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
          </Button>
          {childKind ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onAddChild(childKind, node.id)}
              aria-label={`${childKind} 추가`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(node)} aria-label="편집">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(node)}
            aria-label="삭제"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {node.children?.length ? (
        <div className="border-l border-dashed border-border/60" style={{ marginLeft: depth * 16 + 9 }}>
          {node.children.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
              onToggle={onToggle}
              onMove={onMove}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Composition({ tree, loading, onAddChild, onEdit, onDelete, onToggle, onMove }) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Status 구성</CardTitle>
          <CardDescription>surface → section → card → link 계층을 구성합니다.</CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="rounded-md border border-dashed py-12 text-center text-sm text-muted-foreground">
            불러오는 중…
          </div>
        ) : tree.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-md border border-dashed py-12 text-center">
            <p className="text-sm text-muted-foreground">아직 구성된 surface가 없습니다.</p>
            <Button size="sm" onClick={() => onAddChild("surface", null)}>
              <Plus className="h-4 w-4" /> 첫 Surface 추가
            </Button>
          </div>
        ) : (
          <div className="space-y-1">
            {tree.map((node) => (
              <NodeRow
                key={node.id}
                node={node}
                depth={0}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
                onToggle={onToggle}
                onMove={onMove}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PreviewNode({ node }) {
  if (!node.visible) return null;
  const visibleChildren = (node.children || []).filter((c) => c.visible);
  const meta = STATUS_META[node.status] || STATUS_META.none;

  if (node.kind === "surface") {
    return (
      <div className="rounded-lg border bg-background p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <StatusDot status={node.status} />
            <span className="text-sm font-semibold">{node.title}</span>
          </div>
          {node.status !== "none" ? (
            <span className={cn("text-[11px] font-medium", meta.text)}>{meta.label}</span>
          ) : null}
        </div>
        {node.subtitle ? <p className="mt-1 text-xs text-muted-foreground">{node.subtitle}</p> : null}
        {visibleChildren.length ? (
          <div className="mt-3 space-y-3">
            {visibleChildren.map((c) => (
              <PreviewNode key={c.id} node={c} />
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  if (node.kind === "section") {
    return (
      <div>
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {node.title}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleChildren.map((c) => (
            <PreviewNode key={c.id} node={c} />
          ))}
        </div>
      </div>
    );
  }

  if (node.kind === "card") {
    const inner = (
      <div className="flex h-full flex-col rounded-md border bg-card p-2.5">
        <div className="flex items-center gap-1.5">
          <StatusDot status={node.status} />
          <span className="text-xs font-medium">{node.title}</span>
        </div>
        {node.subtitle ? (
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{node.subtitle}</p>
        ) : null}
        {visibleChildren.length ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {visibleChildren.map((c) => (
              <PreviewNode key={c.id} node={c} />
            ))}
          </div>
        ) : null}
      </div>
    );
    return node.url ? (
      <a href={node.url} target="_blank" rel="noreferrer" className="block transition-opacity hover:opacity-80">
        {inner}
      </a>
    ) : (
      inner
    );
  }

  // link
  return (
    <span className="inline-flex items-center gap-1 rounded-full border bg-secondary px-2 py-0.5 text-[11px] text-secondary-foreground">
      <StatusDot status={node.status} />
      {node.url ? (
        <a href={node.url} target="_blank" rel="noreferrer" className="hover:underline">
          {node.title}
        </a>
      ) : (
        node.title
      )}
    </span>
  );
}

function Preview({ tree, activity }) {
  const visible = tree.filter((n) => n.visible);
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Preview</CardTitle>
          <CardDescription>노출(visible) 항목만 Status 페이지 형태로 미리 봅니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {visible.length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              노출할 surface가 없습니다.
            </div>
          ) : (
            <div className="space-y-3">
              {visible.map((n) => (
                <PreviewNode key={n.id} node={n} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> 최근 변경
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {activity.slice(0, 5).map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-xs">
              <Badge variant="muted" className="shrink-0 text-[10px]">
                {a.action}
              </Badge>
              <span className="min-w-0 flex-1 break-words">{a.summary}</span>
              <span className="shrink-0 text-muted-foreground">{fmt(a.created_at)}</span>
            </div>
          ))}
          {activity.length === 0 ? (
            <p className="text-xs text-muted-foreground">변경 이력이 없습니다.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function NodeEditor({ editor, onOpenChange, setDraft, onSave, busy }) {
  const { draft, mode } = editor;
  const childOf = draft.parent_id ? "하위 항목" : "최상위";
  const showUrl = draft.kind === "card" || draft.kind === "link";
  return (
    <Sheet open={editor.open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>
            {mode === "edit" ? "항목 편집" : "새 항목"} · {KIND_META[draft.kind]?.label || draft.kind}
          </SheetTitle>
          <SheetDescription>
            {KIND_META[draft.kind]?.hint} · {childOf}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ed-title">제목</Label>
            <Input
              id="ed-title"
              value={draft.title}
              onChange={(e) => setDraft({ title: e.target.value })}
              placeholder="표시 이름"
              maxLength={160}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ed-subtitle">설명 / Copy</Label>
            <Textarea
              id="ed-subtitle"
              value={draft.subtitle}
              onChange={(e) => setDraft({ subtitle: e.target.value })}
              placeholder="부가 설명, 운영 메모"
              maxLength={2000}
            />
          </div>

          {showUrl ? (
            <div className="space-y-1.5">
              <Label htmlFor="ed-url">URL</Label>
              <Input
                id="ed-url"
                value={draft.url}
                onChange={(e) => setDraft({ url: e.target.value })}
                placeholder="https://…"
                maxLength={1000}
              />
            </div>
          ) : null}

          <div className="space-y-1.5">
            <Label>상태(Status)</Label>
            <Select value={draft.status} onValueChange={(v) => setDraft({ status: v })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_META[s].label} ({s})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label className="text-foreground">노출(Visible)</Label>
              <p className="text-xs text-muted-foreground">끄면 Preview/공개 구성에서 숨겨집니다.</p>
            </div>
            <Switch checked={draft.visible} onCheckedChange={(v) => setDraft({ visible: v })} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            취소
          </Button>
          <Button onClick={onSave} disabled={busy}>
            {mode === "edit" ? "수정 저장" : "추가"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Registry({ items, form, setForm, editId, onSubmit, onEdit, onCancel, onDelete, busy }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <CardHeader>
          <CardTitle>{editId ? "Record 편집" : "Record 추가"}</CardTitle>
          <CardDescription>표면별 텍스트 값(control_center_items) 원장입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="r-surface">Surface</Label>
                <Input
                  id="r-surface"
                  value={form.surface}
                  onChange={(e) => setForm({ ...form, surface: e.target.value })}
                  maxLength={80}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="r-field">Field</Label>
                <Input
                  id="r-field"
                  value={form.field_key}
                  onChange={(e) => setForm({ ...form, field_key: e.target.value })}
                  maxLength={80}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {["draft", "ready", "published"].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-value">Value</Label>
              <Textarea
                id="r-value"
                className="min-h-[120px]"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: e.target.value })}
                maxLength={2000}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" disabled={busy}>
                {editId ? "수정" : "생성"}
              </Button>
              {editId ? (
                <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
                  취소
                </Button>
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Records · {items.length}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 ? (
            <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
              record가 없습니다.
            </div>
          ) : (
            items.map((it) => (
              <div key={it.id} className="rounded-md border p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-medium">
                      {it.surface} / {it.field_key}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {it.status} · {fmt(it.updated_at)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(it)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive"
                      onClick={() => onDelete(it.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed">{it.value}</p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ActivityFeed({ activity }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Log</CardTitle>
        <CardDescription>구성/record 변경 감사 로그 (최근 40건)</CardDescription>
      </CardHeader>
      <CardContent>
        {activity.length === 0 ? (
          <div className="rounded-md border border-dashed py-10 text-center text-sm text-muted-foreground">
            변경 이력이 없습니다.
          </div>
        ) : (
          <div className="divide-y">
            {activity.map((a) => (
              <div key={a.id} className="flex items-start gap-3 py-2.5">
                <Badge variant="muted" className="mt-0.5 shrink-0 text-[10px]">
                  {a.entity}·{a.action}
                </Badge>
                <span className="min-w-0 flex-1 break-words text-sm">{a.summary}</span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmt(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
