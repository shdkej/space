"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { STATUS_META } from "@/lib/status-meta";

const STATUS_RANK = { none: 0, planned: 0, operational: 0, maintenance: 1, degraded: 2, down: 3 };
const LAYER_KEYS = ["direction_fit", "next_action_exists", "choice_accuracy", "artifact_matches_request"];
const LAYER_KEY_LABELS = {
  direction_fit: "방향",
  next_action_exists: "다음 액션",
  choice_accuracy: "선택",
  artifact_matches_request: "요청 부합"
};
const HEARTBEAT_STALE_MS = 30 * 60 * 1000;
const EFFECT_ROWS = [
  { key: "e1", label: "L1 조정 반영율" },
  { key: "e2", label: "L2 실패 재발율" },
  { key: "e3", label: "L3 채택안 생존율" },
  { key: "e4", label: "L4 산출물 참조율" }
];

function fmtRate(m) {
  if (!m || !m.den) return "미기록";
  return `${Math.round((m.num / m.den) * 100)}% (${m.num}/${m.den})`;
}

function worst(statuses) {
  if (!statuses.length) return "none";
  return statuses.reduce((acc, s) =>
    (STATUS_RANK[s] ?? 0) >= (STATUS_RANK[acc] ?? 0) ? s : acc
  );
}

function Dot({ status }) {
  const meta = STATUS_META[status] || STATUS_META.none;
  return <span className={cn("inline-block h-2 w-2 rounded-full shrink-0", meta.dot)} aria-hidden />;
}

function fmtMs(ms) {
  if (!ms) return "-";
  return new Date(ms).toLocaleString("ko-KR", {
    month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Seoul"
  });
}

function fmtAge(hours) {
  if (hours == null) return "없음";
  if (hours < 1) return "1시간 이내";
  if (hours < 48) return `${Math.round(hours)}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
}

function LayerHeader({ title, status }) {
  return (
    <div className="mt-8 mb-3 flex items-center gap-2">
      <Dot status={status} />
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
    </div>
  );
}

function cronRowStatuses(payload) {
  return (payload?.crons || []).map((c) => c.status);
}

function freshnessStatuses(payload) {
  return (payload?.freshness || []).map((f) => f.status);
}

function daysSince(iso) {
  if (!iso) return null;
  // 아침 리캡과 동일하게 달력일 차이로 센다 (KST)
  const now = new Date(Date.now() + 9 * 3600000);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const then = new Date(`${iso}T00:00:00Z`).getTime();
  const d = Math.round((today - then) / 86400000);
  return Number.isNaN(d) ? null : d;
}

function traceLine(it) {
  const parts = [];
  if (it.approval_date) parts.push(`승인 ${it.approval_date.slice(5)}`);
  if (it.last_progress) parts.push(`진행 ${it.last_progress.slice(5)}`);
  return parts.join(" → ");
}

function IntentCard({ it, done }) {
  return (
    <div className="rounded-md border px-2.5 py-2">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">{it.id}</Badge>
        {done && <Dot status={it.notified ? "operational" : "maintenance"} />}
      </div>
      <p className="mt-1 text-xs leading-snug">{it.title || it.summary}</p>
      {!done && traceLine(it) && (
        <p className="mt-1 text-[11px] text-muted-foreground">{traceLine(it)}</p>
      )}
      {done && <p className="mt-1 text-[11px] text-muted-foreground">{it.date?.slice(5)}{it.notified ? " · 통보됨" : " · 미통보"}</p>}
    </div>
  );
}

function PipelineBoard({ intents }) {
  const items = intents?.items || {};
  const waiting = items.waiting || [];
  const yourTurn = waiting.filter((it) => (it.waiting_on || "").toLowerCase() === "user");
  const otherWaiting = waiting.filter((it) => (it.waiting_on || "").toLowerCase() !== "user");
  const completed = (intents?.completed || []).slice(0, 6);
  const columns = [
    { key: "inbox", label: "접수", list: items.inbox || [] },
    { key: "active", label: "실행중", list: items.active || [] },
    { key: "waiting", label: "대기 (외부·에이전트)", list: otherWaiting },
    { key: "done", label: "완료 (7일)", list: completed, done: true }
  ];
  return (
    <div className="space-y-3">
      {yourTurn.length > 0 && (
        <div className="rounded-md border border-[hsl(var(--warn))] bg-[hsl(var(--warn))]/10 px-4 py-3">
          <p className="text-sm font-medium">🙋 내 공 — 내 손을 기다리는 요청 {yourTurn.length}건</p>
          <div className="mt-2 space-y-2">
            {yourTurn.map((it) => {
              const days = daysSince(it.approval_date);
              return (
                <div key={it.id} className="text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono text-[10px]">{it.id}</Badge>
                    <span>{it.title}</span>
                    {days >= 2 && <span className="text-xs text-[hsl(var(--down))]">{days}일째</span>}
                  </div>
                  {it.next_action && (
                    <p className="mt-0.5 pl-1 text-xs text-muted-foreground">첫 액션: {it.next_action}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-4">
        {columns.map((col) => (
          <div key={col.key} className="rounded-md border bg-muted/30 p-2">
            <p className="px-1 pb-2 text-xs font-medium text-muted-foreground">
              {col.label} · {col.list.length}
            </p>
            <div className="space-y-2">
              {col.list.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground/60">비어 있음</p>
              ) : (
                col.list.map((it) => <IntentCard key={it.id} it={it} done={col.done} />)
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function layerCheckStatus(payload) {
  const rows = payload?.layer_checks || [];
  if (!rows.length) return "none";
  const latest = rows[rows.length - 1];
  const ageDays = (Date.now() - new Date(latest.date).getTime()) / 86400000;
  if (!latest.date || Number.isNaN(ageDays) || ageDays > 2) return "down";
  if (LAYER_KEYS.every((k) => latest[k] == null)) return "none"; // 판정 보류 라인 (블록 답 없음)
  const fails = LAYER_KEYS.filter((k) => latest[k] !== true).length;
  if (fails >= 2) return "down";
  if (fails === 1) return "degraded";
  return "operational";
}

export default function SystemPanel() {
  const [snapshot, setSnapshot] = useState(null);
  const [actions, setActions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [snapRes, actRes] = await Promise.all([
        fetch("/api/system/snapshot"),
        fetch("/api/system/actions")
      ]);
      const snap = await snapRes.json();
      const act = await actRes.json();
      if (!snapRes.ok) throw new Error(snap.error || `snapshot HTTP ${snapRes.status}`);
      if (!actRes.ok) throw new Error(act.error || `actions HTTP ${actRes.status}`);
      setSnapshot(snap.snapshot || null);
      setActions(act.actions || []);
      setMessage(null);
    } catch (error) {
      setMessage(`불러오기 실패: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const requestAction = useCallback(
    async (kind, target = null) => {
      const label = kind === "cron_enable" ? "크론 켜기" : kind === "cron_disable" ? "크론 끄기" : "수집기 실행";
      if (!window.confirm(`${label} 요청을 큐에 넣습니다. 반영은 최대 10분 걸립니다.`)) return;
      setBusy(true);
      try {
        const res = await fetch("/api/system/actions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, target })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "요청 실패");
        setMessage(null);
        await load();
      } catch (error) {
        setMessage(`액션 실패: ${error.message}`);
      } finally {
        setBusy(false);
      }
    },
    [load]
  );

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !snapshot) {
    return <p className="py-12 text-center text-sm text-muted-foreground">시스템 상태를 불러오는 중…</p>;
  }
  if (!snapshot) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        {message || "스냅샷이 없습니다. 수집기가 아직 push하지 않았습니다."}
      </p>
    );
  }

  const payload = snapshot.payload || {};
  const snapshotAge = Date.now() - new Date(snapshot.created_at).getTime();
  const heartbeatDead = snapshotAge > HEARTBEAT_STALE_MS;
  const pdcaStatus = payload.pdca?.status || "none";
  const backlogStatuses = (payload.backlogs || []).map((b) => b.status);
  const l1Status = worst([layerCheckStatus(payload)]);
  const l2Status = worst([...cronRowStatuses(payload), ...backlogStatuses]);
  const l4Status = worst(freshnessStatuses(payload));

  return (
    <div className="space-y-2">
      {heartbeatDead ? (
        <div className="rounded-md border border-[hsl(var(--down))] bg-[hsl(var(--down))]/10 px-4 py-3 text-sm">
          수집기 죽음 — 마지막 스냅샷이 {fmtAge(snapshotAge / 3600000)}입니다. 이 화면의 모든 값은 그 시점 기준입니다.
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          스냅샷 {fmtMs(new Date(snapshot.created_at).getTime())} · 수집기 v{snapshot.collector_version}
          {(payload.errors || []).length > 0 && ` · 섹션 오류 ${payload.errors.length}건`}
          <Button variant="ghost" size="sm" className="ml-2 h-6 px-2" onClick={load}>
            <RefreshCw className="h-3 w-3" />
          </Button>
          <Button variant="outline" size="sm" className="ml-1 h-6 px-2 text-xs" disabled={busy}
                  onClick={() => requestAction("collector_run_now")}>
            수집기 지금 실행
          </Button>
        </p>
      )}

      <LayerHeader
        title="요청 파이프라인 — 발화 → 승인(L2) → 실행(L3) → 산출(L4) → 통보"
        status={
          (payload.intents?.items?.waiting || []).some((it) => (it.waiting_on || "").toLowerCase() === "user")
            ? "degraded"
            : "operational"
        }
      />
      <PipelineBoard intents={payload.intents} />

      <LayerHeader title="L1 삶 — PDCA 4지표" status={l1Status} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">4지표 히트맵 (최근 7일)</CardTitle>
            <CardDescription>방향 → 다음 액션 → 선택 → 요청 부합</CardDescription>
          </CardHeader>
          <CardContent>
            {(payload.layer_checks || []).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                기록 시작 전 — 오늘 밤 4레이어 점검 크론부터 layer-check.jsonl에 쌓입니다.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr>
                      <th className="pr-3 text-left font-normal text-muted-foreground">지표</th>
                      {payload.layer_checks.map((row) => (
                        <th key={row.date} className="px-1 font-normal text-muted-foreground">
                          {String(row.date).slice(5)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {LAYER_KEYS.map((key) => (
                      <tr key={key}>
                        <td className="pr-3 py-1 text-muted-foreground">{LAYER_KEY_LABELS[key]}</td>
                        {payload.layer_checks.map((row) => (
                          <td key={row.date + key} className="px-1 py-1 text-center">
                            <Dot status={row[key] === true ? "operational" : row[key] === false ? "down" : "none"} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Dot status={payload.effectiveness?.ledger_status || "none"} /> 지연 게이트 (효과)
            </CardTitle>
            <CardDescription>히트맵이 &quot;오늘 지켰나&quot;라면, 여기는 &quot;그 판단이 살아남았나&quot;</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!payload.effectiveness || payload.effectiveness.ledger_status === "none" ? (
              <p className="text-sm text-muted-foreground">
                기록 시작 전 — 밤 점검이 effectiveness.jsonl에 쌓기 시작하면 표시됩니다.
              </p>
            ) : (
              <>
                {EFFECT_ROWS.map((r) => (
                  <div key={r.key} className="flex justify-between">
                    <span>{r.label} ({payload.effectiveness[r.key]?.window_days ?? "-"}일)</span>
                    <span className="font-mono">{fmtRate(payload.effectiveness[r.key])}</span>
                  </div>
                ))}
                <div className="flex justify-between text-muted-foreground">
                  <span>판정 대기 결정</span>
                  <span className="font-mono">{payload.effectiveness.decisions_pending ?? 0}건</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">일일 리뷰</CardTitle>
            <CardDescription>{payload.review?.latest || "리뷰 없음"}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{payload.review?.headline || "헤드라인을 찾지 못했습니다."}</p>
          </CardContent>
        </Card>
      </div>

      <LayerHeader title="L2 업/시스템 — 크론 · 백로그 · 인프라" status={l2Status} />
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">크론 {payload.crons?.length ?? 0}개</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {payload.crons == null ? (
            <p className="text-sm text-muted-foreground">크론 수집 실패 — 섹션 오류를 확인하세요.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-2 font-normal">상태</th>
                  <th className="py-1 pr-2 font-normal">이름</th>
                  <th className="py-1 pr-2 font-normal">스케줄</th>
                  <th className="py-1 pr-2 font-normal">마지막</th>
                  <th className="py-1 pr-2 font-normal">다음</th>
                  <th className="py-1 pr-2 font-normal">연속실패</th>
                  <th className="py-1 font-normal">조작</th>
                </tr>
              </thead>
              <tbody>
                {payload.crons.map((c) => (
                  <tr key={c.id} className="border-t border-border/60">
                    <td className="py-1.5 pr-2"><Dot status={c.status} /></td>
                    <td className="py-1.5 pr-2 max-w-56 truncate" title={c.name}>{c.name}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap font-mono">{c.schedule} {c.tz}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{fmtMs(c.last_run_at_ms)}</td>
                    <td className="py-1.5 pr-2 whitespace-nowrap">{fmtMs(c.next_run_at_ms)}</td>
                    <td className="py-1.5 pr-2">{c.consecutive_errors || 0}</td>
                    <td className="py-1.5">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-xs"
                        disabled={busy}
                        onClick={() => requestAction(c.enabled ? "cron_disable" : "cron_enable", c.id)}
                      >
                        {c.enabled ? "끄기" : "켜기"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">백로그</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(payload.backlogs || []).map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2"><Dot status={b.status} /> {b.name}</span>
                <span className="font-mono">{b.count} / 경고 {b.warn_at}</span>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">인프라</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(payload.links || []).map((l) => (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
                 className="flex items-center gap-2 text-sm text-primary hover:underline">
                <ExternalLink className="h-3 w-3" /> {l.name}
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <LayerHeader title="L3 워크플로우 — Infinity · PDCA 루프" status={worst([pdcaStatus])} />
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Infinity 인텐트</CardTitle>
            <CardDescription>
              Inbox {payload.intents?.counts?.inbox ?? "-"} · Active {payload.intents?.counts?.active ?? "-"} ·
              Waiting {payload.intents?.counts?.waiting ?? "-"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {["active", "waiting", "inbox"].flatMap((section) =>
              (payload.intents?.items?.[section] || []).filter((it) => it.gate).map((it) => (
                <p key={it.id} className="text-xs text-[hsl(var(--warn))]">
                  <span className="font-mono">{it.id}</span> gate: {it.gate}
                </p>
              ))
            )}
            <p className="text-sm text-muted-foreground">항목 상세는 상단 요청 파이프라인 보드에서 봅니다.</p>
            {!payload.intents && <p className="text-sm text-muted-foreground">인텐트 수집 실패</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Dot status={pdcaStatus} /> 검증 → 개선 루프
            </CardTitle>
            <CardDescription>Check가 쌓이는데 Act가 멈춰 있으면 루프가 닫히지 않는 것</CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Check — 미해결 감시 항목</span>
              <span className="font-mono">{payload.pdca?.check?.unresolved_items ?? "-"}건</span>
            </div>
            <div className="flex justify-between">
              <span>Check — 품질 게이트 실패 (7일)</span>
              <span className="font-mono">{payload.pdca?.check?.failures_7d ?? "-"}건</span>
            </div>
            <div className="flex justify-between">
              <span>Act — 운영 규칙</span>
              <span className="font-mono">{payload.pdca?.act?.lessons_count ?? "-"}개</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Act 마지막 갱신</span>
              <span>{payload.pdca?.act?.updated ? payload.pdca.act.updated.slice(0, 10) : "-"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <LayerHeader title="L4 아티팩트 — 산출물 신선도" status={l4Status} />
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(payload.freshness || []).map((f) => (
              <div key={f.name} className="flex items-center justify-between rounded-md border border-border/60 px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><Dot status={f.status} /> {f.name}</span>
                <span className="text-xs text-muted-foreground">{fmtAge(f.age_hours)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <LayerHeader title="액션 히스토리" status="none" />
      <Card>
        <CardContent className="pt-6 space-y-2">
          {actions.length === 0 && <p className="text-sm text-muted-foreground">액션 이력이 없습니다.</p>}
          {actions.map((a) => (
            <div key={a.id} className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-[10px]">{a.kind}</Badge>
                {a.target ? <span className="font-mono">{a.target.slice(0, 8)}</span> : null}
                <span className="text-muted-foreground">{a.result || ""}</span>
              </span>
              <span className={cn(
                a.status === "done" && "text-[hsl(var(--ok))]",
                a.status === "failed" && "text-[hsl(var(--down))]",
                (a.status === "pending" || a.status === "running") && "text-[hsl(var(--warn))]"
              )}>
                {a.status}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      {message && <p className="text-sm text-[hsl(var(--down))]">{message}</p>}
    </div>
  );
}
