import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { Activity, ArrowUpRight, Check, ChevronRight, CircleAlert, Clock3, ExternalLink, Gauge, Layers3, RefreshCw, Server, Sparkles, X } from "lucide-react";
import { clsx } from "clsx";
import "./styles.css";

const tabs = [
  { id: "system", label: "System", icon: Server },
  { id: "surfaces", label: "Surfaces", icon: Layers3 },
  { id: "agents", label: "Agents", icon: Activity },
  { id: "output", label: "Loop", icon: RefreshCw },
  { id: "monitoring", label: "Monitoring", icon: Gauge },
];
const fallbackLayers = [
  ["L1", "비즈니스", "수용 가능량과 방향", "warn"],
  ["L2", "제품", "사용 흐름과 핵심 지표", "warn"],
  ["L3", "콘텐츠", "기획·개발·마케팅 흐름", "warn"],
  ["L4", "시스템", "저장소와 배포 상태", "ok"],
  ["L5", "리소스", "노드와 실행 환경", "ok"],
];

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
const metricValue = (series, period) => {
  const item = (series || []).find((entry) => entry?.metric?.period === period) || series?.[0];
  return item?.value?.[1] ?? "—";
};
const monitoringState = (value, fallback = "none") => value || fallback;
const ageHours = (item) => Number.isFinite(item?.ageHours) ? item.ageHours : Infinity;
const humanAge = (hours) => {
  if (!Number.isFinite(hours)) return "확인 시각 없음";
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}분 전`;
  if (hours < 24) return `${Math.round(hours)}시간 전`;
  return `${Math.round(hours / 24)}일 전`;
};
const priorityMessage = ({ data, live, checks }) => {
  const layers = live?.system?.layers || [];
  const brokenLayer = layers.find((layer) => layer.state === "bad");
  if (brokenLayer) return `${brokenLayer.name} 레이어를 먼저 확인하세요 · ${brokenLayer.detail || brokenLayer.reason || "운영 신호가 끊겼습니다."}`;
  const warningLayer = layers.find((layer) => layer.state === "warn");
  if (warningLayer) return `${warningLayer.name} 레이어에 확인할 신호가 있습니다 · ${warningLayer.detail || warningLayer.reason || "상세 화면에서 근거를 확인하세요."}`;
  const staleOutput = [...(live?.outputs || [])].sort((a, b) => ageHours(b) - ageHours(a)).find((item) => item.state === "bad");
  if (staleOutput) return `${staleOutput.name}이 ${humanAge(staleOutput.ageHours)} 멈춰 있습니다 · 다음 기록을 확인하세요.`;
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

function SurfaceCard({ item, onOpen }) {
  return <button className="surface-card" onClick={() => onOpen(item)}>
    <span className="surface-card-head"><StatusDot state={item.state} /><span>{item.name}</span><ArrowUpRight size={15} /></span>
    <strong>{item.state === "ok" ? "운영 중" : stateText[item.state] || "확인 대기"}</strong>
    <small>{item.detail || "상태 설명을 확인할 수 없습니다."}</small>
  </button>;
}

function LayerRail({ layers, onOpen }) {
  return <section className="focus-surface">
    <div className="section-heading"><div><span className="eyebrow">운영 흐름</span><h2>다섯 레이어가 지금 어디에 있나</h2></div><span className="section-note">상태를 누르면 근거를 봅니다</span></div>
    <div className="layer-rail">
      {layers.map(([key, name, detail, state], index) => <button className={clsx("layer-row", `depth-${index}`, state)} key={key} onClick={() => onOpen({ name: `${key} ${name}`, state, detail })}>
        <span className="layer-marker"><StatusDot state={state} /></span><span className="layer-key">{key}</span><span className="layer-copy"><strong>{name}</strong><small>{detail}</small></span><span className="layer-state">{stateText[state]}</span><ChevronRight size={16} />
      </button>)}
    </div>
  </section>;
}

function DetailDialog({ item, onClose }) {
  const cron = item?.cron;
  const formatRun = (value) => value ? new Date(value).toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" }) : "실행 기록 없음";
  return <Dialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className={clsx("dialog-content", cron && "cron-dialog")}>
    <Dialog.Title className="dialog-title"><StatusDot state={item?.state} />{item?.name}</Dialog.Title><Dialog.Description className="dialog-description">{cron ? "크론 설정 · 읽기 전용" : "현재 상태와 다음 확인 지점"}</Dialog.Description>
    {cron ? <div className="cron-detail">
      <div className="dialog-state"><span>상태</span><strong>{cron.enabled ? (stateText[item.state] || "확인 대기") : "비활성"}</strong></div>
      <div className="cron-meta"><div><span>실행 주기</span><strong>{cron.schedule || "확인 대기"} · {cron.tz || "UTC"}</strong></div><div><span>담당 에이전트</span><strong>{cron.agent_id || "main"}</strong></div><div><span>다음 실행</span><strong>{formatRun(cron.next_run_at_ms)}</strong></div><div><span>최근 실행</span><strong>{formatRun(cron.last_run_at_ms)} · {cron.last_status || "unknown"}</strong></div></div>
      <p className="cron-description">{cron.description || "설명이 등록되지 않았습니다."}</p>
      <div className="cron-block"><span>프롬프트 / 지시문</span><pre>{cron.checkPlan?.prompt || "이 크론은 프롬프트 대신 명령어를 실행합니다."}</pre></div>
      <div className="cron-block"><span>실행 명령</span><pre>{cron.checkPlan?.command || "명령어 원문 없음 · 에이전트 실행 방식"}</pre></div>
      <div className="cron-footnote">작업 디렉터리: {cron.checkPlan?.cwd || "지정되지 않음"}{cron.checkPlan?.timeoutSeconds ? ` · 제한 ${cron.checkPlan.timeoutSeconds}초` : ""}</div>
    </div> : <><div className="dialog-state"><span>상태</span><strong>{stateText[item?.state] || "확인 대기"}</strong></div><p>{item?.detail || "추가 근거가 아직 수집되지 않았습니다."}</p></>}
    <Dialog.Close asChild><button className="dialog-close" aria-label="닫기"><X size={18} /></button></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function DetailRow({ row, index, onOpen }) {
  const content = <><StatusDot state={row.state} /><span><strong>{row.name}</strong><small>{row.detail}</small></span><span className="row-state">{stateText[row.state] || "확인 대기"}</span>{row.url ? <ExternalLink size={16} /> : <ChevronRight size={16} />}</>;
  if (row.url) return <a className="detail-row" href={row.url} target="_blank" rel="noreferrer" key={`${row.name}-${index}`}>{content}</a>;
  return <button className="detail-row" key={`${row.name}-${index}`} onClick={() => onOpen(row)}>{content}</button>;
}

function App() {
  const [data, setData] = React.useState(null); const [live, setLive] = React.useState(null); const [view, setView] = React.useState("home"); const [selected, setSelected] = React.useState(null); const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(async () => { setLoading(true); const [a, b] = await Promise.allSettled([fetch("./status.json", { cache: "no-store" }).then((r) => r.json()), fetch("./agents-live.json", { cache: "no-store" }).then((r) => r.json())]); setData(a.status === "fulfilled" ? a.value : null); setLive(b.status === "fulfilled" ? b.value : null); setLoading(false); }, []);
  React.useEffect(() => { load(); const interval = window.setInterval(load, 60 * 1000); return () => window.clearInterval(interval); }, [load]);
  const checks = data?.checks || []; const overall = data?.overall || { state: "warn", score: "--", label: "상태를 불러오는 중입니다." }; const liveAge = ago(live?.generatedAt || data?.generatedAt); const currentMessage = loading && !live ? "운영 신호를 불러오는 중입니다." : priorityMessage({ data, live, checks });
  const layers = live?.system?.layers?.length ? live.system.layers.map((x, i) => [`L${i + 1}`, x.name || x.key || "운영 레이어", x.detail || x.reason || "라이브 상태 확인", x.state || "warn"]) : fallbackLayers;
  const agents = live?.agents || []; const crons = live?.crons || []; const outputs = live?.outputs || []; const monitoring = live?.monitoring || {};
  const monitoringRows = [
    { name: "서비스 접점", state: checks.length && checks.every((item) => item.state === "ok") ? "ok" : "warn", detail: `${checks.filter((item) => item.state === "ok").length}/${checks.length || 0}개 응답 정상 · 평균 지연 ${checks.length ? Math.round(checks.reduce((sum, item) => sum + (item.latencyMs || 0), 0) / checks.length) : "—"}ms` },
    { name: "PostHog 제품 지표", state: monitoringState(monitoring.posthog?.state), detail: `활성 사용자 1일 ${metricValue(monitoring.posthog?.metrics?.product_active_users, "1d")}명 · 7일 조회 ${metricValue(monitoring.posthog?.metrics?.product_page_views, "7d")}회 · 전환 ${metricValue(monitoring.posthog?.metrics?.product_conversion_rate)}%` },
    { name: "비즈니스 지표", state: monitoringState(monitoring.business?.state), detail: monitoring.business?.metrics && Object.values(monitoring.business.metrics).some((items) => items?.length) ? "DAU·가입·매출 수집 중" : "DAU·가입·매출 데이터 없음" },
    { name: "콘텐츠 지표", state: monitoringState(monitoring.content?.state), detail: monitoring.content?.availability === "missing" ? "연결된 콘텐츠 원천 없음" : "콘텐츠 원천 연결됨" },
    { name: "인프라 노드", state: monitoringState(monitoring.prometheus?.state), detail: `${(monitoring.prometheus?.nodes || []).filter((node) => node.status === "정상").length}/${(monitoring.prometheus?.nodes || []).length || 0}개 노드 정상` },
    { name: "GitHub 저장소", state: (monitoring.github || []).length && monitoring.github.every((repo) => repo.state === "ok") ? "ok" : "warn", detail: `${monitoring.github?.length || 0}개 저장소 · 최신 커밋 상태 확인` },
  ];
  const cards = [{ id: "system", label: "System", value: overall.state === "ok" ? "조용히 유지" : "확인 필요", note: `${checks.length}개 접점 · ${liveAge}`, icon: Server }, { id: "agents", label: "Agents", value: `${agents.length || "--"} agents`, note: "현재 실행 인계", icon: Activity }, { id: "output", label: "Loop", value: `${crons.length || "--"}개 주기`, note: `${outputs.filter((x) => x.state === "ok").length || 0}개 결과 최신`, icon: RefreshCw }];
  const detailRows = view === "surfaces" ? checks : view === "agents" ? agents.map((x) => ({ name: x.name || x.id, state: x.state || "ok", detail: `${x.crons || 0}개 크론` })) : view === "output" ? crons.map((x) => ({ name: x.name || x.id, state: x.status === "operational" ? "ok" : "warn", detail: x.schedule || "실행 주기 확인 대기", cron: x })) : view === "monitoring" ? monitoringRows : layers.map(([key, name, detail, state]) => ({ name: `${key} ${name}`, state, detail }));
  const navigate = (next) => { setView(next); window.scrollTo(0, 0); document.querySelector(".screen-area")?.scrollTo(0, 0); };
  return <Tooltip.Provider delayDuration={250}><div className={clsx("app-shell", view === "home" && "home-mode")}>
    <header className="topbar"><a className="brand" href="/">space<span>/</span>status</a><div className="topbar-actions"><span className="freshness"><Clock3 size={14} /> {loading ? "불러오는 중" : `갱신 ${liveAge}`}</span><Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" onClick={load} aria-label="상태 새로고침"><RefreshCw size={17} /></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip">상태 새로고침</Tooltip.Content></Tooltip.Portal></Tooltip.Root></div></header>
    <main className="screen-area">{view === "home" ? <><section className="hero home-hero"><div className="hero-copy"><span className="eyebrow">지금 봐야 할 것</span><h1>중요한 상태만,<br /><em>다음 행동까지.</em></h1><p aria-live="polite">{currentMessage}</p></div><div className="hero-score"><span>overall</span><strong>{overall.score}</strong><small><StatusDot state={overall.state} /> {stateText[overall.state] || "확인 대기"}</small></div></section>
      <section className="metric-strip">{cards.map(({ id, label, value, note, icon: Icon }) => <button className="metric-card" key={id} onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</section>
    </> : <section className="detail-section detail-screen"><div className="detail-heading"><div><span className="eyebrow">{tabs.find((tab) => tab.id === view)?.label || "상세"}</span><h2>{view === "system" ? "운영 흐름" : `${tabs.find((tab) => tab.id === view)?.label || "상세"} 상태`}</h2></div><div className="detail-heading-actions"><span>{detailRows.length}개 항목</span>{view === "agents" && <a className="detail-action" href="/agents/">에이전트 페이지 열기 <ArrowUpRight size={14} /></a>}</div></div><div className="detail-list">{detailRows.map((row, i) => <DetailRow row={row} index={i} onOpen={setSelected} />)}</div></section>} </main><footer><span>Space status</span><span>데이터는 읽기 전용으로 표시됩니다.</span></footer><nav className="bottom-nav" aria-label="주요 메뉴"><button className={clsx("bottom-nav-item", view === "home" && "active")} onClick={() => navigate("home")}><Sparkles size={16} /><span>Home</span></button>{tabs.map(({ id, label, icon: Icon }) => <button className={clsx("bottom-nav-item", view === id && "active")} key={id} onClick={() => navigate(id)}><Icon size={16} /><span>{label}</span></button>)}</nav><DetailDialog item={selected} onClose={() => setSelected(null)} /></div></Tooltip.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);
