import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";
import * as Tooltip from "@radix-ui/react-tooltip";
import { GlassCard } from "@zakisheriff/liquid-glass";
import "@zakisheriff/liquid-glass/styles.css";
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

const grafanaBase = "https://grafana.oracle.shdkej.com/d";
const monitoringCatalog = [
  {
    layer: "비즈니스 · 사업 성과", uid: "layer-business", metrics: [
      ["북극성 지표", "입력 필요 · 앱별 핵심 가치와 이벤트 정의"],
      ["순매출", "입력 필요 · 결제/회계 원천, 통화, 기간"],
      ["매출 성장률", "입력 필요 · 기간별 순매출 데이터"],
      ["유료 고객 수", "입력 필요 · 결제 완료 이벤트/API"],
      ["유료 전환율", "입력 필요 · 적격 사용자 분모와 결제 완료 정의"],
      ["고객당 매출 (ARPPU)", "입력 필요 · 순매출과 유료 고객 데이터"],
      ["환불률", "입력 필요 · 결제·환불 원천"],
      ["고객 획득 비용 (CAC)", "입력 필요 · 광고비와 채널별 유료 전환 연결"],
    ],
  },
  {
    layer: "고객 · 마케팅", uid: "layer-customer", metrics: [
      ["신규 사용자 수", "부분 연결 · GA4 blog 확인, afzma 시계열 확인 필요", "warn"],
      ["세션 수", "연결 확인 · GA4 blog·afzma", "ok"],
      ["채널별 유입", "연결 확인 · GA4 blog·afzma", "ok"],
      ["캠페인 전환율", "조건부 · 전환 이벤트와 GA4 key event 정의 필요", "warn"],
      ["핵심 퍼널 이탈률", "부분 연결 · virtue 판정 시도→저장, 시작자 없으면 N/A", "warn"],
      ["7일 재방문율", "연결됨 · PostHog virtue", "ok"],
      ["CTA 클릭률 (CTR)", "입력 필요 · CTA 노출·클릭 이벤트", "none"],
      ["고객 문의 수", "입력 필요 · 지원 메일 범위와 스레드/메시지 집계 기준", "none"],
    ],
  },
  {
    layer: "제품 · 사용 품질", uid: "layer-product", metrics: [
      ["화면 로딩 p95", "입력 필요 · CloudWatch RUM 시계열 없음", "none"],
      ["화면 로딩 p99", "입력 필요 · CloudWatch RUM 시계열 없음", "none"],
      ["프론트엔드 예외", "연결됨 · PostHog virtue, blog·afzma는 N/A", "warn"],
      ["Core Web Vitals", "부분 연결 · virtue LCP·INP 있음, CLS 시계열 없음", "warn"],
      ["로그인 성공률", "입력 필요 · 로그인 시도·성공 이벤트", "none"],
      ["결제 성공률", "입력 필요 · 결제 시도·성공·실패 이벤트", "none"],
      ["제품 세션 수", "연결됨 · PostHog virtue", "ok"],
      ["핵심 작업 완료율", "부분 연결 · virtue 퍼널만 구성, 앱별 핵심 이벤트 정의 필요", "warn"],
    ],
  },
  {
    layer: "시스템 · 인프라", uid: "layer-system", metrics: [
      ["CPU 사용률", "연결됨 · node-exporter", "ok"],
      ["메모리 사용률", "연결됨 · node-exporter", "ok"],
      ["디스크 사용률", "연결됨 · node-exporter", "ok"],
      ["네트워크 트래픽", "연결됨 · node-exporter", "ok"],
      ["네트워크 지연", "입력 필요 · black-box probe 또는 CloudWatch 지표", "none"],
      ["노드 헬스체크", "연결됨 · Prometheus 대상 상태", "ok"],
      ["자동 확장 여유", "입력 필요 · 대상 HPA/ASG 및 최대 용량", "none"],
      ["AWS 처리량·오류", "부분 연결 · YACE는 scrape 중, 유효 Lambda/DynamoDB 값 확인 필요", "warn"],
    ],
  },
].flatMap((group) => group.metrics.map(([name, detail, state = "none"], index) => ({
  name,
  detail,
  state,
  readiness: state === "ok" ? "연결됨" : state === "warn" ? (detail.startsWith("조건부") ? "조건부" : "부분 연결") : "입력 필요",
  layer: index === 0 ? group.layer : null,
  groupStart: index === 0,
  url: `${grafanaBase}/${group.uid}`,
})));


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
    <Dialog.Close asChild><button className="dialog-close" aria-label="닫기"><X size={20} /></button></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function DetailRow({ row, index, onOpen }) {
  const content = <><StatusDot state={row.state} /><span>{row.layer && <small className="row-group">{row.layer}</small>}<strong>{row.name}</strong><small>{row.detail}</small></span><span className="row-state">{row.readiness || stateText[row.state] || "확인 대기"}</span>{row.url ? <ExternalLink size={16} /> : <ChevronRight size={16} />}</>;
  if (row.url) return <a className={clsx("detail-row", row.groupStart && "group-start")} href={row.url} target="_blank" rel="noreferrer" key={`${row.name}-${index}`}>{content}</a>;
  return <button className={clsx("detail-row", row.groupStart && "group-start")} key={`${row.name}-${index}`} onClick={() => onOpen(row)}>{content}</button>;
}

function App() {
  const [data, setData] = React.useState(null); const [live, setLive] = React.useState(null); const [view, setView] = React.useState("home"); const [selected, setSelected] = React.useState(null); const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(async () => { setLoading(true); const [a, b] = await Promise.allSettled([fetch("./status.json", { cache: "no-store" }).then((r) => r.json()), fetch("./agents-live.json", { cache: "no-store" }).then((r) => r.json())]); setData(a.status === "fulfilled" ? a.value : null); setLive(b.status === "fulfilled" ? b.value : null); setLoading(false); }, []);
  React.useEffect(() => { load(); const interval = window.setInterval(load, 60 * 1000); return () => window.clearInterval(interval); }, [load]);
  const checks = data?.checks || []; const overall = data?.overall || { state: "warn", score: "--", label: "상태를 불러오는 중입니다." }; const liveAge = ago(live?.generatedAt || data?.generatedAt); const currentMessage = loading && !live ? "운영 신호를 불러오는 중입니다." : priorityMessage({ data, live, checks });
  const layers = live?.system?.layers?.length ? live.system.layers.map((x, i) => [`L${i + 1}`, x.name || x.key || "운영 레이어", x.detail || x.reason || "라이브 상태 확인", x.state || "warn"]) : fallbackLayers;
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
  const monitoringRows = monitoringCatalog;
  const loopLabel = crons.length ? `${crons.length}개 주기` : cronCollectionFailed ? "확인 필요" : live ? "0개 주기" : "수집 대기";
  const loopNote = crons.length ? `${outputs.filter((x) => x.state === "ok").length || 0}개 결과 최신` : cronCollectionFailed ? "크론 목록 수집 오류" : live ? "등록된 크론 없음" : "라이브 피드 확인 대기";
  const loopEmptyMessage = cronCollectionFailed ? "크론 목록을 가져오지 못했습니다. 수집기 상태를 확인하고 있습니다." : live ? "등록된 크론이 없습니다." : "크론 정보를 불러오는 중입니다.";
  const detailCountLabel = view === "output" ? (crons.length ? `${crons.length}개 크론` : cronCollectionFailed ? "목록 확인 필요" : live ? "등록된 크론 없음" : "수집 대기") : null;
  const cards = [{ id: "system", label: "System", value: overall.state === "ok" ? "조용히 유지" : "확인 필요", note: `${checks.length}개 접점 · ${liveAge}`, icon: Server }, { id: "agents", label: "Agents", value: `${agents.length || "--"} agents`, note: roleWatchers.length ? "역할별 관찰 연결" : "현재 실행 인계", icon: Activity }, { id: "output", label: "Loop", value: loopLabel, note: loopNote, icon: RefreshCw }];
  const flowRoleCount = roleWatchers.length;
  const flowActiveCount = roleWatchers.filter((watcher) => watcher.state === "ok" || watcher.state === "operational").length;
  const flowSummary = {
    name: "실행 흐름 요약",
    state: flowRoleCount > 0 && flowActiveCount === flowRoleCount ? "ok" : flowRoleCount > 0 ? "warn" : "none",
    detail: flowRoleCount ? `${flowActiveCount}/${flowRoleCount}개 역할 관찰 중 · 개별 실행 내용은 공개하지 않습니다.` : "역할별 실행 요약을 기다리고 있습니다."
  };
  const detailRows = view === "surfaces" ? checks : view === "agents" ? agents.map((x) => ({ name: x.name || x.id, state: x.state || "ok", detail: x.detail || `${x.crons || x.executionLogs?.length || 0}개 실행 기록` })) : view === "output" ? crons.map((x) => ({ name: x.name || x.id, state: x.status === "operational" ? "ok" : "warn", detail: x.schedule || "실행 주기 확인 대기", cron: x })) : view === "monitoring" ? monitoringRows : [...layers.map(([key, name, detail, state]) => ({ name: `${key} ${name}`, state, detail })), flowSummary];
  const navigate = (next) => { setView(next); window.scrollTo(0, 0); document.querySelector(".screen-area")?.scrollTo(0, 0); };
  return <Tooltip.Provider delayDuration={250}><div className={clsx("app-shell", view === "home" && "home-mode")}>
    <header className="topbar"><a className="brand" href="/">space<span>/</span>status</a><div className="topbar-actions"><span className="freshness"><Clock3 size={14} /> {loading ? "불러오는 중" : `갱신 ${liveAge}`}</span><Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" onClick={load} aria-label="상태 새로고침"><RefreshCw size={17} /></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip">상태 새로고침</Tooltip.Content></Tooltip.Portal></Tooltip.Root></div></header>
    <main className="screen-area">{view === "home" ? <><section className="hero home-hero"><GlassCard className="hero-glass" intensity={8} thickness={2} tint="rgba(255, 249, 199, .14)" padding="0" radius="30px"><div className="hero-copy"><span className="eyebrow">지금 봐야 할 것</span><h1>중요한 상태만,<br /><em>다음 행동까지.</em></h1><p aria-live="polite">{currentMessage}</p></div><div className="hero-score"><span>overall</span><strong>{overall.score}</strong><small><StatusDot state={overall.state} /> {stateText[overall.state] || "확인 대기"}</small></div></GlassCard></section>
      <section className="metric-strip">{cards.map(({ id, label, value, note, icon: Icon }) => <GlassCard className="metric-glass" key={id} intensity={7} thickness={1.6} tint="rgba(255, 249, 199, .1)" padding="0" radius="20px"><button className="metric-card" onClick={() => navigate(id)}><Icon size={17} /><span>{label}</span><strong>{value}</strong><small>{note}</small></button></GlassCard>)}</section>
    </> : <section className="detail-section detail-screen"><div className="detail-heading"><div><span className="eyebrow">{tabs.find((tab) => tab.id === view)?.label || "상세"}</span><h2>{view === "system" ? "운영 흐름" : `${tabs.find((tab) => tab.id === view)?.label || "상세"} 상태`}</h2></div><div className="detail-heading-actions">{view === "output" ? <span>{detailCountLabel}</span> : <span>{detailRows.length}개 항목</span>}{view === "agents" && <a className="detail-action" href="/agents/">에이전트 페이지 열기 <ArrowUpRight size={14} /></a>}</div></div>{view === "monitoring" && <p className="monitoring-note">4개 레이어의 지표 32개입니다. N/A는 미연결·미정의 상태이며, 항목을 누르면 Grafana 상세 화면으로 이동합니다.</p>}<div className="detail-list">{view === "output" && !detailRows.length ? <p className="empty-state" role="status">{loopEmptyMessage}</p> : detailRows.map((row, i) => <DetailRow row={row} index={i} onOpen={setSelected} />)}</div></section>} </main><footer><span>Space status</span><span>데이터는 읽기 전용으로 표시됩니다.</span></footer><nav className="bottom-nav" aria-label="주요 메뉴"><button className={clsx("bottom-nav-item", view === "home" && "active")} onClick={() => navigate("home")}><Sparkles size={16} /><span>Home</span></button>{tabs.map(({ id, label, icon: Icon }) => <button className={clsx("bottom-nav-item", view === id && "active")} key={id} onClick={() => navigate(id)}><Icon size={16} /><span>{label}</span></button>)}</nav><DetailDialog item={selected} onClose={() => setSelected(null)} /></div></Tooltip.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);
