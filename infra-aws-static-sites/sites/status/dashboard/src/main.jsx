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
  return <Dialog.Root open={Boolean(item)} onOpenChange={(open) => !open && onClose()}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="dialog-content">
    <Dialog.Title className="dialog-title"><StatusDot state={item?.state} />{item?.name}</Dialog.Title><Dialog.Description className="dialog-description">현재 상태와 다음 확인 지점</Dialog.Description>
    <div className="dialog-state"><span>상태</span><strong>{stateText[item?.state] || "확인 대기"}</strong></div><p>{item?.detail || "추가 근거가 아직 수집되지 않았습니다."}</p>
    <Dialog.Close asChild><button className="dialog-close" aria-label="닫기"><X size={18} /></button></Dialog.Close>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}

function App() {
  const [data, setData] = React.useState(null); const [live, setLive] = React.useState(null); const [activeTab, setActiveTab] = React.useState("system"); const [selected, setSelected] = React.useState(null); const [loading, setLoading] = React.useState(true);
  const load = React.useCallback(async () => { setLoading(true); const [a, b] = await Promise.allSettled([fetch("./status.json", { cache: "no-store" }).then((r) => r.json()), fetch("./agents-live.json", { cache: "no-store" }).then((r) => r.json())]); setData(a.status === "fulfilled" ? a.value : null); setLive(b.status === "fulfilled" ? b.value : null); setLoading(false); }, []);
  React.useEffect(() => { load(); }, [load]);
  const checks = data?.checks || []; const overall = data?.overall || { state: "warn", score: "--", label: "상태를 불러오는 중입니다." }; const liveAge = ago(live?.generatedAt || data?.generatedAt);
  const layers = live?.system?.layers?.length ? live.system.layers.map((x, i) => [`L${i + 1}`, x.name || x.key || "운영 레이어", x.detail || x.reason || "라이브 상태 확인", x.state || "warn"]) : fallbackLayers;
  const agents = live?.agents || []; const crons = live?.crons || []; const outputs = live?.outputs || [];
  const cards = [{ id: "system", label: "System", value: overall.state === "ok" ? "조용히 유지" : "확인 필요", note: `${checks.length}개 접점 · ${liveAge}`, icon: Server }, { id: "agents", label: "Agents", value: `${agents.length || "--"} agents`, note: "현재 실행 인계", icon: Activity }, { id: "output", label: "Loop", value: `${crons.length || "--"}개 주기`, note: `${outputs.filter((x) => x.state === "ok").length || 0}개 결과 최신`, icon: RefreshCw }];
  const detailRows = activeTab === "surfaces" ? checks : activeTab === "agents" ? agents.map((x) => ({ name: x.name || x.id, state: x.state || "ok", detail: `${x.crons || 0}개 크론` })) : activeTab === "output" ? crons.map((x) => ({ name: x.name || x.id, state: x.status === "operational" ? "ok" : "warn", detail: x.schedule || "실행 주기 확인 대기" })) : layers.map(([key, name, detail, state]) => ({ name: `${key} ${name}`, state, detail }));
  return <Tooltip.Provider delayDuration={250}><div className="app-shell">
    <header className="topbar"><a className="brand" href="/">space<span>/</span>status</a><div className="topbar-actions"><span className="freshness"><Clock3 size={14} /> {loading ? "불러오는 중" : `갱신 ${liveAge}`}</span><Tooltip.Root><Tooltip.Trigger asChild><button className="icon-button" onClick={load} aria-label="상태 새로고침"><RefreshCw size={17} /></button></Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip">상태 새로고침</Tooltip.Content></Tooltip.Portal></Tooltip.Root></div></header>
    <main><section className="hero"><div className="hero-copy"><span className="eyebrow">Space status / 운영 화면</span><h1>중요한 상태만,<br /><em>다음 행동까지.</em></h1><p>{overall.label}</p></div><div className="hero-score"><span>overall</span><strong>{overall.score}</strong><small><StatusDot state={overall.state} /> {stateText[overall.state] || "확인 대기"}</small></div></section>
      <section className="metric-strip">{cards.map(({ id, label, value, note, icon: Icon }) => <button className={clsx("metric-card", activeTab === id && "selected")} key={id} onClick={() => setActiveTab(id)}><Icon size={17} /><span>{label}</span><strong>{value}</strong><small>{note}</small></button>)}</section>
      <LayerRail layers={layers} onOpen={setSelected} />
      <section className="surfaces-section"><div className="section-heading"><div><span className="eyebrow">접점</span><h2>운영 중인 표면</h2></div><a href="https://status.aws.shdkej.com" target="_blank" rel="noreferrer">라이브 열기 <ExternalLink size={14} /></a></div><div className="surface-grid">{checks.slice(0, 9).map((item) => <SurfaceCard item={item} key={item.name} onOpen={setSelected} />)}</div></section>
      <section className="detail-section"><Tabs.Root value={activeTab} onValueChange={setActiveTab}><Tabs.List className="tabs-list" aria-label="상세 상태"><span className="tabs-label">상세 보기</span>{tabs.map(({ id, label, icon: Icon }) => <Tabs.Trigger className="tab-trigger" value={id} key={id}><Icon size={15} />{label}</Tabs.Trigger>)}</Tabs.List>{tabs.map(({ id, label }) => <Tabs.Content className="detail-content" value={id} key={id}><div className="detail-heading"><div><span className="eyebrow">{label}</span><h2>{id === "system" ? "운영 흐름" : `${label} 상태`}</h2></div><span>{detailRows.length}개 항목</span></div><div className="detail-list">{detailRows.map((row, i) => <button className="detail-row" key={`${row.name}-${i}`} onClick={() => setSelected(row)}><StatusDot state={row.state} /><span><strong>{row.name}</strong><small>{row.detail}</small></span><span className="row-state">{stateText[row.state] || "확인 대기"}</span><ChevronRight size={16} /></button>)}</div></Tabs.Content>)}</Tabs.Root></section>
    </main><footer><span>Space status</span><span>데이터는 읽기 전용으로 표시됩니다.</span></footer></div><DetailDialog item={selected} onClose={() => setSelected(null)} /></Tooltip.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);
