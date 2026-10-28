"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleDot, Clock3, RefreshCw, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const POLL_MS = 20_000;
const STAGES = [
  { key: "area", label: "영역", hint: "무엇을 보고 있나" },
  { key: "collect", label: "수집", hint: "역할별 관찰" },
  { key: "record", label: "기록", hint: "실행 로그" },
  { key: "analyze", label: "분석", hint: "MAIN 정리" },
  { key: "execute", label: "실행", hint: "다음 액션" }
];

const ROLE_COLORS = {
  planner: "border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20",
  developer: "border-sky-300/70 bg-sky-50/70 dark:bg-sky-950/20",
  marketing: "border-rose-300/70 bg-rose-50/70 dark:bg-rose-950/20",
  design: "border-violet-300/70 bg-violet-50/70 dark:bg-violet-950/20",
  operator: "border-emerald-300/70 bg-emerald-50/70 dark:bg-emerald-950/20"
};

function timeLabel(value) {
  if (!value) return "기록 없음";
  return new Date(value).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function FlowCard({ title, eyebrow, children, active, tone = "" }) {
  return (
    <article className={cn("flow-card", active && "is-active", tone)}>
      <div className="flow-card__eyebrow">{eyebrow}</div>
      <h3>{title}</h3>
      {children}
    </article>
  );
}

function Stage({ stage, children, active }) {
  return (
    <section className={cn("flow-stage", active && "is-active")}>
      <header className="flow-stage__header">
        <span className="flow-stage__index">{String(STAGES.indexOf(stage) + 1).padStart(2, "0")}</span>
        <div>
          <h2>{stage.label}</h2>
          <p>{stage.hint}</p>
        </div>
      </header>
      <div className="flow-stage__body">{children}</div>
    </section>
  );
}

function Empty({ children }) {
  return <p className="flow-empty">{children}</p>;
}

export default function FlowPanel() {
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/system/snapshot", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "스냅샷을 불러오지 못했습니다.");
      setSnapshot(data.snapshot || null);
      setError("");
    } catch (cause) {
      setError(cause.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const payload = snapshot?.payload || {};
  const roles = payload.roleWatchers || [];
  const latest = useMemo(() => {
    return roles
      .flatMap((role) => (role.executionLogs || []).map((log) => ({ ...log, role })))
      .sort((a, b) => new Date(b.completedAt || b.startedAt || 0) - new Date(a.completedAt || a.startedAt || 0))[0];
  }, [roles]);
  const activeRole = latest?.role?.id;
  const completedStages = latest ? 4 : 1;
  const activePath = activeRole ? `${latest.role.name} → MAIN → 다음 액션` : "관찰 대기 중";
  const intents = payload.intents || {};
  const activeIntents = intents.items?.active || [];
  const waitingIntents = intents.items?.waiting || [];
  const nextActions = [...activeIntents, ...waitingIntents].slice(0, 3);

  if (loading && !snapshot) return <p className="py-12 text-center text-sm text-muted-foreground">Flow를 불러오는 중…</p>;
  if (!snapshot) return <p className="py-12 text-center text-sm text-muted-foreground">{error || "아직 수집된 Flow 스냅샷이 없습니다."}</p>;

  return (
    <div className="flow-shell">
      <div className="flow-intro">
        <div>
          <p className="flow-kicker"><Sparkles className="h-3.5 w-3.5" /> LIVE AGENT FLOW</p>
          <h1>역할이 움직이는 길을 한눈에 봅니다.</h1>
          <p className="flow-description">영역을 관찰하고, 근거를 기록하고, MAIN이 다음 행동으로 정리하는 흐름입니다.</p>
        </div>
        <div className="flow-intro__meta">
          <Badge variant="outline" className="gap-1.5"><CircleDot className="h-3 w-3 text-[hsl(var(--ok))]" /> {activePath}</Badge>
          <span><Clock3 className="inline h-3 w-3" /> {timeLabel(snapshot.created_at)} 기준 · 20초마다 확인</span>
          <Button variant="ghost" size="sm" className="h-7 self-end px-2" onClick={load} aria-label="Flow 새로고침"><RefreshCw className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      <div className="flow-progress" aria-label={`배선 ${completedStages}/${STAGES.length}`}>
        <span>배선 {completedStages}/{STAGES.length}</span>
        <div className="flow-progress__rail"><span style={{ width: `${(completedStages / STAGES.length) * 100}%` }} /></div>
        <span className="text-muted-foreground">최근 관찰: {latest ? `${latest.role.name} · ${timeLabel(latest.completedAt)}` : "없음"}</span>
      </div>

      <div className="flow-board">
        <Stage stage={STAGES[0]} active={!latest}>
          <FlowCard title="SAM 운영 영역" eyebrow="현재 감시 범위" active={!latest}>
            <ul className="flow-list"><li>프로젝트·문서</li><li>저장소·테스트</li><li>반응·디자인 신호</li><li>Infinity 실행 상태</li></ul>
          </FlowCard>
        </Stage>
        <div className="flow-connector" aria-hidden="true"><ArrowRight /></div>
        <Stage stage={STAGES[1]} active={Boolean(activeRole)}>
          {roles.length ? roles.map((role) => (
            <FlowCard key={role.id} title={role.name} eyebrow={role.state === "ok" ? `최근 확인 ${timeLabel(role.lastActivityAt)}` : "아직 기록 없음"} active={role.id === activeRole} tone={ROLE_COLORS[role.id]}>
              <p>{role.activity?.summary || role.detail}</p>
              <div className="flow-card__footer"><span>{role.evidenceCount || 0}개 근거</span>{role.id === activeRole && <Badge variant="secondary">현재 경로</Badge>}</div>
            </FlowCard>
          )) : <Empty>역할 watcher 기록을 기다리는 중입니다.</Empty>}
        </Stage>
        <div className="flow-connector" aria-hidden="true"><ArrowRight /></div>
        <Stage stage={STAGES[2]} active={Boolean(latest)}>
          {latest ? <FlowCard title={`${latest.role.name} watcher`} eyebrow={`실행 ${timeLabel(latest.startedAt)} — ${timeLabel(latest.completedAt)}`} active>
            <div className="flow-steps">{(latest.steps || []).map((step) => <div key={step.name}><CheckCircle2 className="h-3.5 w-3.5" /> {step.name}</div>)}</div>
            <p className="flow-muted">{latest.summary}</p>
          </FlowCard> : <Empty>최근 실행 로그가 없습니다.</Empty>}
        </Stage>
        <div className="flow-connector" aria-hidden="true"><ArrowRight /></div>
        <Stage stage={STAGES[3]} active={Boolean(payload.mainSynthesis)}>
          <FlowCard title="MAIN synthesis" eyebrow="관찰 → 근거 → 중복 제거" active={Boolean(payload.mainSynthesis)}>
            <p>{payload.mainSynthesis?.summary || "역할별 관찰을 모으는 중입니다."}</p>
            <div className="flow-card__footer"><span>{payload.mainSynthesis?.contributors?.length || 0}개 역할 연결</span></div>
          </FlowCard>
        </Stage>
        <div className="flow-connector" aria-hidden="true"><ArrowRight /></div>
        <Stage stage={STAGES[4]} active={nextActions.length > 0}>
          {nextActions.length ? nextActions.map((item) => <FlowCard key={item.id} title={item.title || item.id} eyebrow={activeIntents.includes(item) ? "실행 중" : "판단 대기"} active={activeIntents.includes(item)}><p>{item.next_action || "다음 액션이 기록되지 않았습니다."}</p></FlowCard>) : <Empty>넘겨받은 다음 액션이 없습니다.</Empty>}
        </Stage>
      </div>
      {error && <p className="mt-3 text-xs text-[hsl(var(--warn))]">새 상태를 확인하지 못했습니다: {error}</p>}
    </div>
  );
}
