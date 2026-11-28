import { KnowledgeMap } from "./KnowledgeMap.jsx";
import { ArtifactTimeline } from "./ArtifactTimeline.jsx";
import { useWorkflowHistory, workflowChart, workflowLayer } from "./workflowHistory.js";
import { fetchPublicCommitTimes, systemLayers } from "./systemLayers.js";
import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Archive, Bot, CalendarRange, Camera, Clapperboard, FlaskConical, GalleryVerticalEnd, Globe2, Images, Landmark, ListTree, Luggage, Rocket, ShieldCheck, SlidersHorizontal, Sprout } from "lucide-react";
import { Activity, ArrowUpRight, Building2, Check, ChevronDown, ChevronRight, CircleAlert, Clock3, ExternalLink, Layers3, RefreshCw, Server, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import "./styles.css";

const tabs = [
  { id: "system", label: "System", icon: Server },
  { id: "surfaces", label: "Surfaces", icon: Layers3 },
  { id: "agents", label: "Agents", icon: Activity },
  { id: "office", label: "사무실", icon: Building2 },
  { id: "output", label: "Loop", icon: RefreshCw },
  { id: "knowledge", label: "KL 맵", icon: ListTree },
];
const viewFromHash = () => {
  const value = window.location.hash.slice(1);
  return tabs.some(tab => tab.id === value) ? value : "home";
};
const stateText = { ok: "정상", warn: "확인 필요", bad: "중단", none: "데이터 없음" };
const stateClass = (state) => state === "ok" || state === "warn" || state === "bad" ? state : "none";
const ago = (iso) => {
  if (!iso) return "확인 대기";
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  if (mins < 1440) return `${Math.round(mins / 60)}시간 전`;
  return `${Math.round(mins / 1440)}일 전`;
};
const humanAge = (hours) => {
  if (!Number.isFinite(hours)) return "확인 시각 없음";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}분 전`;
  if (hours < 24) return `${Math.round(hours)}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
};
const priorityMessage = ({ data, live, checks, layers }) => {
  const brokenLayer = layers.find((layer) => layer.state === "bad");
  if (brokenLayer) return `${brokenLayer.name} 레이어를 먼저 확인하세요 · ${brokenLayer.detail || brokenLayer.reason || "운영 신호가 끊겼습니다."}`;
  const warningLayer = layers.find((layer) => layer.state === "warn");
  if (warningLayer) return `${warningLayer.name} 레이어에 확인할 신호가 있습니다 · ${warningLayer.detail || warningLayer.reason || "상세 화면에서 근거를 확인하세요."}`;
  const failedCheck = checks.find((item) => item.state !== "ok");
  if (failedCheck) return `${failedCheck.name} 접점이 응답하지 않습니다 · ${failedCheck.detail || "Surfaces에서 연결 상태를 확인하세요."}`;
  const feedAge = live?.generatedAt ? (Date.now() - new Date(live.generatedAt).getTime()) / 3600000 : Infinity;
  if (feedAge > 2) return `라이브 운영 피드가 ${humanAge(feedAge)} 갱신되지 않았습니다 · 수집기를 확인하세요.`;
  const nextCron = [...(live?.crons || [])].filter((cron) => cron.next_run_at_ms).sort((a, b) => a.next_run_at_ms - b.next_run_at_ms)[0];
  if (nextCron) return `주의할 장애는 없습니다 · 다음 확인은 ${nextCron.name || "운영 주기"}입니다.`;
  if (data?.overall?.state === "ok") return "주의할 장애는 없습니다 · 모든 공개 접점이 정상 응답 중입니다.";
  return data?.overall?.label || "현재 운영 신호를 확인하는 중입니다.";
};

function StatusDot({ state }) { return <span className={clsx("status-dot", stateClass(state))} aria-label={stateText[state] || stateText.none} />; }

function Metric({ label, value, tone = "normal" }) {
  return <div className={clsx("metric", tone)}><span>{label}</span><strong>{value}</strong></div>;
}

const surfaceIcons = new Map([
  ["Agent Adapt", [Bot, "iris"]],
  ["Instagram Maker", [Camera, "coral"]],
  ["Status", [Activity, "lemon"]],
  ["Travel Ops", [Luggage, "sea"]],
  ["Night Ledger / Safety Map", [ShieldCheck, "sea"]],
  ["Safety Map Experiment 03", [FlaskConical, "iris"]],
  ["Schengen Calculator", [CalendarRange, "sea"]],
  ["Card News Library", [GalleryVerticalEnd, "lemon"]],
  ["Image Archive", [Images, "coral"]],
  ["Infinity", [ListTree, "iris"]],
  ["Virtue", [Sprout, "sea"]],
  ["Launch Timeline", [Rocket, "coral"]],
  ["Control Center CMS", [SlidersHorizontal, "iris"]],
  ["Reel Room", [Clapperboard, "coral"]],
  ["Minimal Collector", [Archive, "lemon"]],
  ["모두의정책", [Landmark, "sea"]],
]);

function SurfaceCard({ item, onOpen }) {
  const [Icon, tone] = surfaceIcons.get(item.name) || [Globe2, "neutral"];
  const tileClass = `surface-tile tone-${tone}`;
  const content = <>
    <span className="surface-tile-top">
      <span className="surface-glyph" aria-hidden="true"><Icon size={20} strokeWidth={1.8} /></span>
      <small><span aria-hidden="true"><StatusDot state={item.state} /></span>{stateText[item.state] || "확인 대기"}</small>
    </span>
    <strong>{item.name}</strong>
  </>;
  return item.url
    ? <a className={tileClass} title={item.detail} href={item.url} target="_blank" rel="noreferrer">{content}</a>
    : <button className={tileClass} title={item.detail} onClick={() => onOpen(item)}>{content}</button>;
}

function DetailDialog({ item, onClose }) {
  const cron = item?.cron;
  const formatRun = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "실행 기록 없음";
  return <Dialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={clsx("dialog-content", cron && "cron-dialog")}>
    <div className={cron ? "cron-dialog-scroll" : undefined}>
    <Dialog.Title className="dialog-title"><StatusDot state={item?.state} />{item?.name}</Dialog.Title><Dialog.Description className="dialog-description">{cron ? "크론 설정 · 읽기 전용" : "현재 상태와 다음 확인 지점"}</Dialog.Description>
    {cron ? <div className="cron-detail">
      <div className="dialog-state"><span>상태</span><strong>{cron.enabled ? (stateText[item.state] || "확인 대기") : "비활성"}</strong></div>
      <div className="cron-meta"><div><span>실행 주기</span><strong>{cron.schedule || "확인 대기"} · {cron.tz || "UTC"}</strong></div><div><span>담당 에이전트</span><strong>{cron.agent_id || "main"}</strong></div><div><span>다음 실행</span><strong>{formatRun(cron.next_run_at_ms)}</strong></div><div><span>최근 실행</span><strong>{formatRun(cron.last_run_at_ms)} · {cron.last_status || "unknown"}</strong></div></div>
      <p className="cron-description">{cron.description || "설명이 등록되지 않았습니다."}</p>
      <div className="cron-block"><span>프롬프트 / 지시문</span><pre>{cron.checkPlan?.prompt || "이 크론은 프롬프트 대신 명령어를 실행합니다."}</pre></div>
      <div className="cron-block"><span>실행 명령</span><pre>{cron.checkPlan?.command || "명령어 원문 없음 · 에이전트 실행 방식"}</pre></div>
      <div className="cron-footnote">작업 디렉터리: {cron.checkPlan?.cwd || "지정되지 않음"}{cron.checkPlan?.timeoutSeconds ? ` · 제한 ${cron.checkPlan.timeoutSeconds}초` : ""}</div>
    </div> : <><div className="dialog-state"><span>상태</span><strong>{stateText[item?.state] || "확인 대기"}</strong></div><p>{item?.detail || "추가 근거가 아직 수집되지 않았습니다."}</p></>}
    </div>
    <Dialog.Close asChild><button className="dialog-close" aria-label="닫기"><X size={20} /></button></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function DetailRow({ row, index, onOpen }) {
  const content = <><StatusDot state={row.state} /><span><strong>{row.name}</strong><small>{row.detail}</small></span><span className="row-state">{stateText[row.state] || "확인 대기"}</span>{row.url ? <ExternalLink size={16} /> : <ChevronRight size={16} />}</>;
  if (row.url) return <a className="detail-row" href={row.url} target="_blank" rel="noreferrer" key={`${row.name}-${index}`}>{content}</a>;
  return <button className="detail-row" key={`${row.name}-${index}`} onClick={() => onOpen(row)}>{content}</button>;
}

const timeRanges = [
  { id: "day", label: "일간", hours: 24 },
  { id: "week", label: "주간", hours: 24 * 7 },
  { id: "month", label: "월간", hours: 24 * 30 },
];
const stateLabel = (value) => value >= 1.5 ? "정상" : value >= 0.5 ? "주의" : "중단";
const chartDate = (epoch) => new Date(epoch * 1000).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
const displayValue = (value, unit, kind) => kind === "state" ? stateLabel(value) : `${Number(value).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} ${unit || ""}`.trim();

function HistoryChart({ metric, row, range, label = metric?.label }) {
  const selectedRange = timeRanges.find((item) => item.id === range) || timeRanges[0];
  const now = Date.now() / 1000;
  const cutoff = now - selectedRange.hours * 3600;
  const sharedPosthog = ["customer.sessions", "customer.retention", "product.sessions", "product.frontend_errors", "product.web_vitals"].includes(row?.metricId);
  const sourceSeries = (metric?.series || []).filter((series) => !row?.seriesName || series.name === row.seriesName);
  const series = metric?.calendar ? sourceSeries : sourceSeries.map((entry) => ({ ...entry, points: (entry.points || []).filter(([time]) => time >= cutoff && time <= now) })).filter((entry) => entry.points.length);
  const points = series.flatMap((entry) => entry.points).filter((point) => point[1] !== null && Number.isFinite(Number(point[1])));
  if (!points.length) {
    const hasAnyPoint = (metric?.series || []).some((entry) => (entry.points || []).length);
    const headline = hasAnyPoint ? "선택한 기간에 표시할 측정값이 없습니다." : metric?.source === "Prometheus" ? "Prometheus에서 현재 시계열을 받지 못했습니다." : row?.detail?.startsWith("입력 필요") ? "이 지표의 데이터 원천을 연결해야 그래프가 시작됩니다." : "수집기가 첫 시계열을 발행하면 그래프가 나타납니다.";
    if (metric?.calendar) return <div className="history-empty">{label}
      <small>{metric.failed ? "집계 조회 실패" : `${selectedRange.label} 집계값이 없습니다.`}</small></div>;
    return <div className="history-empty">{headline}<small>{metric?.source === "Prometheus" ? "Prometheus 쿼리 결과가 비어 있습니다. exporter·이벤트 설정을 확인하세요." : row?.detail || "수집기가 10분마다 상태를 기록합니다."}</small></div>;
  }
  const width = 680, height = 174, left = 42, right = 12, top = 12, bottom = 28;
  const values = points.map((point) => Number(point[1]));
  let min = metric?.kind === "state" ? 0 : Math.min(...values), max = metric?.kind === "state" ? 2 : Math.max(...values);
  if (min === max) { const padding = Math.abs(min) * 0.08 || 1; min -= padding; max += padding; }
  const bucketEnds = metric?.calendar ? series.flatMap(entry => entry.points.map(([time]) => time)) : [];
  const minTime = metric?.calendar ? Math.min(...bucketEnds) : cutoff;
  const maxTime = metric?.calendar ? Math.max(...bucketEnds) : now;
  const x = (time) => left + (maxTime === minTime ? 0.5 : (time - minTime) / (maxTime - minTime)) * (width - left - right);
  const axisDate = time => metric?.calendar ? new Date(time * 1000).toISOString().slice(0, 10) : chartDate(time);
  const y = (value) => top + ((max - Number(value)) / (max - min)) * (height - top - bottom);
  const palette = ["#9a7b18", "#318277", "#b85c44", "#6670a8", "#8e659c", "#486f97"];
  const pathFor = (values) => {
    let previousEnd = null, path = "";
    for (const [time, value, bucket] of values) {
      if (value === null || !Number.isFinite(Number(value))) { previousEnd = null; continue; }
      const px = x(time).toFixed(1), py = y(value).toFixed(1);
      if (metric?.calendar && previousEnd !== null && bucket.start > previousEnd + 86400) previousEnd = null;
      if (previousEnd === null) path += `M${px},${py}`;
      else if (metric?.kind === "state" || metric?.snapshot) path += `H${px}V${py}`;
      else path += `L${px},${py}`;
      previousEnd = time;
    }
    return path;
  };
  const lastPoint = (entry) => metric?.calendar ? entry.points.at(-1) : [...entry.points].reverse().find((point) => point[1] !== null);
  return <div className="history-chart-wrap">
    {label && <strong className="history-chart-label">{label}</strong>}
    <svg className="history-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${label ? label + " · " : ""}${selectedRange.label} 시계열 그래프`}>
      {(metric?.kind === "state" ? [0, 1, 2] : [0, 1, 2, 3]).map((step, index, steps) => {
        const value = metric?.kind === "state" ? step : max - ((max - min) * step / (steps.length - 1));
        return <g key={step}><line x1={left} x2={width - right} y1={y(value)} y2={y(value)} className="history-gridline" /><text x={left - 8} y={y(value) + 4} textAnchor="end" className="history-axis-label">{metric?.kind === "state" ? stateLabel(value) : value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}</text></g>;
      })}
      {series.map((entry, index) => <g key={entry.name} stroke={palette[index % palette.length]}>
        <path d={pathFor(entry.points)} fill="none" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {metric?.calendar && entry.points.filter(([, value]) => value !== null).map(([time, value, bucket]) =>
          <circle key={time} cx={x(time)} cy={y(value)} r="3.4" fill={palette[index % palette.length]}>
            <title>{[entry.name, displayValue(value, metric.unit), bucket.period, `조회 ${chartDate(bucket.observed)}`].filter(Boolean).join(" · ")}</title>
          </circle>)}
      </g>)}
      <text x={x(minTime)} y={height - 6} textAnchor={minTime === maxTime ? "middle" : "start"} className="history-axis-label">{axisDate(minTime)}</text>
      {maxTime !== minTime && <text x={width - right} y={height - 6} textAnchor="end" className="history-axis-label">{metric?.calendar ? axisDate(maxTime) : "지금"}</text>}
    </svg>
    <div className="history-legend">{series.map((entry, index) => {
      const latest = lastPoint(entry);
      const bucket = metric?.calendar ? latest?.[2] : null;
      const hasEventCount = Number.isInteger(bucket?.events) && metric.metricKey === "sessions";
      const value = hasEventCount && bucket.events > 0 && latest[1] === 0
        ? "세션 ID 없음"
        : latest && latest[1] !== null ? displayValue(latest[1], metric?.unit, metric?.kind) : "—";
      return <span key={entry.name}><i style={{ background: palette[index % palette.length] }} />{sharedPosthog && entry.name === "virtue" ? "PostHog 공용 프로젝트 전체" : entry.name}<strong>{value}</strong>
        {hasEventCount && <small>수신 이벤트 {bucket.events.toLocaleString("ko-KR")}건{Number.isInteger(bucket.eventsWithSessionId) && ` · 세션 ID 포함 ${bucket.eventsWithSessionId.toLocaleString("ko-KR")}건`}</small>}
        {metric?.calendar && !metric.snapshot && <small>{[bucket && `마지막 ${selectedRange.label} 집계 · ${bucket.period}`, latest && `조회 ${chartDate(latest[2].observed)}`, entry.failed && "최근 조회 실패"].filter(Boolean).join(" · ")}</small>}</span>;
    })}</div>
    <small className="history-footnote">{metric?.kind === "state" ? "상태 변화 · 정상 / 주의 / 중단" : `단위: ${metric?.unit || "원천값"}`} · {metric?.snapshot ? "한국 시간(KST) 기간 말 줄 수 · 진행 중인 기간은 현재값" : metric?.calendar ? { day: "하루 집계", week: "월요일부터 일요일까지의 주간 집계", month: "달력 월별 집계" }[selectedRange.id] : "최근 값 기준으로 표시합니다"}</small>
  </div>;
}

function HistoryItem({ row, metric, range, children, showChart = true }) {
  return <details className="history-item">
    <summary className="history-item-summary"><StatusDot state={row.state} /><span className="history-item-copy"><strong>{row.name}</strong><small>{row.detail || "실시간 상태 변화"}</small></span><span className="row-state">{row.readiness || stateText[row.state] || "확인 대기"}</span><ChevronDown className="history-item-chevron" size={16} aria-hidden="true" /></summary>
    <div className="history-item-body">{children}{showChart && <HistoryChart metric={metric} row={row} range={range} />}{row.url && <a className="history-grafana-link" href={row.url} target="_blank" rel="noreferrer">Grafana에서 원본 보기 <ExternalLink size={14} /></a>}</div>
  </details>;
}

function agentHistoryRows(agents) {
  const occurrences = new Map();
  return agents.map(agent => {
    const name = agent.name || agent.id;
    let key = `agent:id:${agent.id}`;
    if (!agent.id) {
      const occurrence = (occurrences.get(name) || 0) + 1;
      occurrences.set(name, occurrence);
      key = `agent:name:${occurrence}:${name}`;
    }
    return {
      key,
      name,
      state: agent.state || "ok",
      detail: agent.detail || `${agent.crons || agent.executionLogs?.length || 0}개 실행 기록`,
      metricId: "agents.status",
      seriesName: name,
    };
  });
}

function App() {
  const [data, setData] = React.useState(null); const [live, setLive] = React.useState(null); const [history, setHistory] = React.useState(null); const [range, setRange] = React.useState("day"); const [view, setView] = React.useState(viewFromHash); const [selected, setSelected] = React.useState(null); const [loading, setLoading] = React.useState(true);
  const [workCounts, setWorkCounts] = React.useState(null);
  const [mapRefresh, refreshMap] = React.useReducer(value => value + 1, 0);
  const officeFrame = React.useRef(null);
  React.useEffect(() => {
    const sync = () => { setView(viewFromHash()); setSelected(null); };
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const load = React.useCallback(async () => {
    setLoading(true);
    const readFeed = async name => {
      try {
        const response = await fetch("./" + name, { cache: "no-store" });
        return response.ok ? await response.json() : null;
      } catch {
        return null;
      }
    };
    const [status, agents, metrics, counts] = await Promise.all(
      ["status.json", "agents-live.json", "metrics-history.json", "work-counts.json"].map(readFeed)
    );
    setData(status);
    setLive(agents);
    setHistory(metrics);
    setWorkCounts(counts);
    setLoading(false);
  }, []);
  React.useEffect(() => { load(); const interval = window.setInterval(load, 60 * 1000); return () => window.clearInterval(interval); }, [load]);
  const [publicCommits, setPublicCommits] = React.useState({});
  const lastCommitCheck = React.useRef(0);
  React.useEffect(() => {
    if (view !== "system") return;
    const refresh = async () => {
      const now = Date.now();
      if (document.hidden || now - lastCommitCheck.current < 10 * 60 * 1000) return;
      lastCommitCheck.current = now;
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 10000);
      try {
        setPublicCommits(await fetchPublicCommitTimes(controller.signal));
      } finally {
        window.clearTimeout(timeout);
      }
    };
    refresh();
    const timer = window.setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [view]);
  const workflowFeed = useWorkflowHistory(view === "system");
  const layers = systemLayers(live, publicCommits, workflowLayer(workflowFeed), workCounts);
  const checks = data?.checks || []; const overall = data?.overall || { state: "warn", score: "--", label: "상태를 불러오는 중입니다." }; const liveAge = ago(live?.generatedAt || data?.generatedAt); const currentMessage = loading && !live ? "운영 신호를 불러오는 중입니다." : priorityMessage({ data, live, checks, layers });
  const roleWatchers = live?.roleWatchers || [];
  const liveAgents = live?.agents || [];
  const staticAgents = data?.agents || [];
  // The collector can publish role watcher activity even when the OpenClaw
  // cron CLI is temporarily unavailable. Use it for the Agents roster only;
  // Loop remains the cron schedule view.
  const agents = liveAgents.length ? liveAgents : roleWatchers.length ? roleWatchers.map((watcher) => ({
    id: watcher.id,
    name: watcher.name || watcher.id,
    state: watcher.state || "none",
    crons: watcher.executionLogs?.length || 0,
    lastActivityAt: watcher.lastActivityAt,
    detail: watcher.detail,
    activity: watcher.activity,
    executionLogs: watcher.executionLogs || [],
  })) : staticAgents;
  const crons = live?.crons || [];
  const cronAudit = live?.audit?.sections?.find((section) => section.name === "crons");
  const cronCollectionFailed = cronAudit?.state === "error";
  const outputs = live?.outputs || [];
  const loopLabel = crons.length ? `${crons.length}개 주기` : cronCollectionFailed ? "확인 필요" : live ? "0개 주기" : "수집 대기";
  const loopNote = crons.length ? `${outputs.filter((x) => x.state === "ok").length || 0}개 결과 최신` : cronCollectionFailed ? "크론 목록 수집 오류" : live ? "등록된 크론 없음" : "라이브 피드 확인 대기";
  const loopEmptyMessage = cronCollectionFailed ? "크론 목록을 가져오지 못했습니다. 수집기 상태를 확인하고 있습니다." : live ? "등록된 크론이 없습니다." : "크론 정보를 불러오는 중입니다.";
  const detailCountLabel = view === "output" ? (crons.length ? `${crons.length}개 크론` : cronCollectionFailed ? "목록 확인 필요" : live ? "등록된 크론 없음" : "수집 대기") : null;
  const cards = [{ id: "system", label: "System", value: overall.state === "ok" ? "조용히 유지" : "확인 필요", note: `${checks.length}개 접점 · ${liveAge}`, icon: Server }, { id: "agents", label: "Agents", value: `${agents.length || "--"} agents`, note: roleWatchers.length ? "역할별 관찰 연결" : "현재 실행 인계", icon: Activity }, { id: "output", label: "Loop", value: loopLabel, note: loopNote, icon: RefreshCw }];
  const detailRows = view === "surfaces" ? checks : view === "agents" ? agentHistoryRows(agents) : view === "output" ? crons.map((x) => ({ name: x.name || x.id, state: x.status === "operational" ? "ok" : "warn", detail: x.schedule || "실행 주기 확인 대기", cron: x })) : layers;
  const hasHistoryView = ["system", "agents"].includes(view);
  const chartMetric = (row) => history?.metrics?.[row.metricId] || null;
  const navigate = (next) => { window.location.hash = next === "home" ? "" : next; setView(next); setSelected(null); window.scrollTo(0, 0); document.querySelector(".screen-area")?.scrollTo(0, 0); };
  return <Tooltip.Provider delayDuration={250}><div className={clsx("app-shell", view === "home" && "home-mode", view === "office" && "office-mode")}>
    <header className="topbar"><a className="brand" href="/">space<span>/</span>status</a><div className="topbar-actions"><span className="freshness"><Clock3 size={14} /> {loading ? "불러오는 중" : `갱신 ${liveAge}`}</span><Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" onClick={() => { load(); if (view === "knowledge") refreshMap(); if (view === "office") officeFrame.current?.contentWindow?.location.reload(); }} aria-label="상태 새로고침"><RefreshCw size={17} /></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip">상태 새로고침</Tooltip.Content></Tooltip.Portal></Tooltip.Root></div></header>
    <main className="screen-area">{view === "knowledge" ? <KnowledgeMap refresh={mapRefresh} /> : view === "office" ? <iframe ref={officeFrame} className="office-frame" src="/office/?embedded=1" title="사무실 · 네 층의 사람과 오늘의 일" /> : view === "home" ? <><section className="hero home-hero"><div className="hero-copy"><span className="eyebrow">지금 봐야 할 것</span><h1>중요한 상태만,<br /><em>다음 행동까지.</em></h1><p aria-live="polite">{currentMessage}</p></div><div className="hero-score"><span>overall</span><strong>{overall.score}</strong><small><StatusDot state={overall.state} /> {stateText[overall.state] || "확인 대기"}</small></div></section>
      <section className="metric-strip">{cards.map(({ id, label, value, note, icon: Icon }) => <button className="metric-card" key={id} onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</section>
    </> : <section className="detail-section detail-screen"><div className="detail-heading"><div><span className="eyebrow">{tabs.find((tab) => tab.id === view)?.label || "상세"}</span><h2>{view === "system" ? "운영 흐름" : `${tabs.find((tab) => tab.id === view)?.label || "상세"} 상태`}</h2></div><div className="detail-heading-actions">{view === "output" ? <span>{detailCountLabel}</span> : <span>{detailRows.length}개 항목</span>}</div></div>{hasHistoryView && <div className="history-toolbar"><span>{history?.generatedAt ? `${view === "system" ? "L1 상태" : "시계열"} 갱신 ${ago(history.generatedAt)} · 10분 간격` : "시계열 수집 준비 중 · 10분 간격"}</span><div className="history-range" role="group" aria-label={view === "system" ? "L1·L3 그래프 기간" : "그래프 기간"}>{timeRanges.map((item) => <button key={item.id} className={range === item.id ? "active" : ""} aria-pressed={range === item.id} onClick={() => setRange(item.id)}><strong>{item.label}</strong>{view !== "system" && <small>{item.hours === 24 ? "24시간" : `${item.hours / 24}일`}</small>}</button>)}</div></div>}
      <div className={clsx("detail-list", view === "surfaces" && "surface-tiles", hasHistoryView && "history-list")}>{view === "output" && !detailRows.length ? <p className="empty-state" role="status">{loopEmptyMessage}</p> : view === "surfaces" ? detailRows.map(item => <SurfaceCard key={item.url || item.name} item={item} onOpen={setSelected} />) : hasHistoryView ? detailRows.map(row => {
        if (row.workflow) {
          return <HistoryItem key={row.name} row={row} range={range} showChart={false}>
            <HistoryChart metric={workflowChart(workflowFeed, range)} range={range} />
            {workflowFeed.failed && workflowFeed.data && <small>마지막 성공 조회 기준 · 최근 조회 실패</small>}
          </HistoryItem>;
        }
        return <HistoryItem key={row.key || row.metricId || row.name} row={row} metric={chartMetric(row)} range={range} showChart={Boolean(row.metricId)}>
          {row.artifacts && <ArtifactTimeline entries={row.artifacts} />}
          {row.observations && <ul className="layer-observations">{row.observations.map(line => <li key={line}>{line}</li>)}</ul>}
        </HistoryItem>;
      }) : detailRows.map((row, i) => <DetailRow row={row} index={i} onOpen={setSelected} key={`${row.name}-${i}`} />)}</div></section>} </main><footer><span>Space status</span><span>데이터는 읽기 전용으로 표시됩니다.</span></footer><nav className="bottom-nav" aria-label="주요 메뉴"><button className={clsx("bottom-nav-item", view === "home" && "active")} aria-current={view === "home" ? "page" : undefined} onClick={() => navigate("home")}><Sparkles size={16} /><span>Home</span></button>{tabs.map(({ id, label, icon: Icon }) => <button className={clsx("bottom-nav-item", view === id && "active")} aria-current={view === id ? "page" : undefined} key={id} onClick={() => navigate(id)}><Icon size={16} /><span>{label}</span></button>)}</nav><DetailDialog item={selected} onClose={() => setSelected(null)} /></div></Tooltip.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);
