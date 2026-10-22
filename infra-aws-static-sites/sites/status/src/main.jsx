import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import { ArrowLeft, CheckCircle2, CircleAlert, CircleX, Clock3, ExternalLink, Activity } from "lucide-react";
import "./styles.css";

const stateLabel = (state) => state === "ok" ? "정상" : state === "warn" ? "확인 필요" : "중단";
const StateIcon = ({ state }) => state === "ok" ? <CheckCircle2 /> : state === "warn" ? <CircleAlert /> : <CircleX />;
const age = (iso) => iso ? Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)) : null;
const relative = (minutes) => minutes == null ? "확인 대기" : minutes < 1 ? "방금 전" : minutes < 60 ? `${minutes}분 전` : `${Math.round(minutes / 60)}시간 전`;

function BorderBeam() { return <span className="border-beam" aria-hidden="true" />; }
function ShineBorder({ children, className = "" }) { return <div className={`shine-border ${className}`}>{children}</div>; }
function MagicCard({ children, onClick, className = "" }) {
  const [spot, setSpot] = useState({ x: 50, y: 50 });
  return <button className={`magic-card ${className}`} onClick={onClick} onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); setSpot({ x: ((e.clientX-r.left)/r.width)*100, y: ((e.clientY-r.top)/r.height)*100 }); }} style={{ "--spot-x": `${spot.x}%`, "--spot-y": `${spot.y}%` }}>{children}<BorderBeam /></button>;
}
function NumberTicker({ value }) { return <span className="number-ticker">{value}</span>; }
function Badge({ state, children }) { return <span className={`badge badge-${state}`}>{children}</span>; }

function App() {
  const [data, setData] = useState(null);
  const [live, setLive] = useState(null);
  const [tab, setTab] = useState("system");
  const [detail, setDetail] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("./status.json", { cache: "no-store" }).then((r) => r.json()),
      fetch("./agents-live.json", { cache: "no-store" }).then((r) => r.ok ? r.json() : null).catch(() => null),
    ]).then(([snapshot, feed]) => { setData(snapshot); setLive(feed); });
  }, []);

  const model = useMemo(() => {
    if (!data) return null;
    const checks = data.checks || [];
    const agents = live?.agents?.length ? live.agents : data.agents || [];
    const outputs = live?.outputs || [];
    const state = data.overall?.state || "warn";
    const attention = checks.filter((item) => item.state !== "ok");
    const liveAge = age(live?.generatedAt);
    return {
      state, checks, agents, outputs, attention, liveAge,
      hero: attention.length ? ["주의 필요", "먼저 볼 신호"] : ["조용히 정상", "다음 주기 대기"],
      label: attention.length ? `${attention.length}개 서비스 접점을 먼저 확인해야 합니다.` : `${checks.length}개 서비스 접점과 ${agents.length}개 에이전트가 신호를 보내고 있습니다.`,
      cards: [
        { id: "system", label: "Now", value: attention.length ? "주의 필요" : "조용히 유지", title: attention[0]?.name || "현재 할 일 없음", status: attention.length ? `${attention.length}개 신호 먼저 확인` : "다음 주기만 기다립니다", state: attention.length ? "warn" : "ok" },
        { id: "agents", label: "Agents", value: `${agents.length} agents`, title: `${agents.filter((a) => a.state === "ok").length}/${agents.length} agents operational`, status: `라이브 ${relative(liveAge)}`, state: "ok" },
        { id: "output", label: "Loop", value: outputs.length ? `${outputs.filter((o) => o.state === "ok").length}/${outputs.length}` : "확인 대기", title: "outputs fresh", status: `피드 ${relative(liveAge)}`, state: liveAge != null && liveAge <= 30 ? "ok" : "warn" },
      ],
    };
  }, [data, live]);

  if (!model) return <main className="loading-shell"><div className="loading-card"><Activity className="spin" /> 상태 피드를 불러오는 중입니다.</div></main>;

  const panels = {
    system: { title: "System Health", subtitle: model.label, rows: [{ name: "Overall state", state: model.state, detail: data.overall?.label, meta: stateLabel(model.state) }, { name: "Status snapshot", state: "ok", detail: `status.json · ${relative(age(data.generatedAt))}`, meta: "fresh" }] },
    surfaces: { title: "Live Surfaces", subtitle: "서비스 접점은 상태 판정의 보조 근거입니다.", rows: model.checks.map((item) => ({ ...item, detail: item.detail || item.url, meta: item.latencyMs ? `${item.latencyMs}ms` : stateLabel(item.state) })) },
    agents: { title: "Agents", subtitle: "예약 루프와 수동 호출형 에이전트를 구분해 봅니다.", rows: model.agents.map((item) => ({ ...item, meta: stateLabel(item.state) })) },
    output: { title: "Loop", subtitle: "산출물 신선도와 다음 실행 주기를 확인합니다.", rows: model.outputs.length ? model.outputs.map((item) => ({ name: item.name, state: item.state, detail: item.ageHours != null ? `${Math.round(item.ageHours)}시간 전` : "실행 주기 확인", meta: stateLabel(item.state) })) : [{ name: "Live feed silent", state: "warn", detail: "라이브 피드가 없거나 오래됐습니다.", meta: "stale" }] },
    monitoring: { title: "Monitoring", subtitle: "운영 레이어의 현재 신호를 확인합니다.", rows: [{ name: "Snapshot freshness", state: "ok", detail: relative(age(data.generatedAt)), meta: "status" }, { name: "Agent feed", state: model.liveAge != null && model.liveAge <= 30 ? "ok" : "warn", detail: relative(model.liveAge), meta: "feed" }] },
  };
  const panel = panels[tab];
  const openDetail = (id) => { setTab(id); setDetail(true); };
  return <main className={`app-shell ${detail ? "is-detail" : ""}`} data-state={model.state}>
    <section className="overview" aria-label="Status overview">
      <header className="hero-copy">
        <div className="hero-kicker">SPACE STATUS / LIVE OPERATIONS</div>
        <h1><span>{model.hero[0]}</span><strong>{model.hero[1]}</strong></h1>
        <p>{model.label}</p>
        <div className="hero-meta"><span><b>State</b> / {stateLabel(model.state)}</span><span><b>Signals</b> / {model.checks.length}</span><span><b>Freshness</b> / {relative(age(data.generatedAt))}</span></div>
      </header>
      <section className="overview-grid" aria-label="Status cards">{model.cards.map((card) => <MagicCard key={card.id} onClick={() => openDetail(card.id)}><div className="card-top"><span className={`status-dot ${card.state}`}><StateIcon state={card.state} /></span><span className="card-label">{card.label}</span></div><div className="card-mid"><span className="card-value"><NumberTicker value={card.value} /></span><span className="card-title">{card.title}</span></div><div className="card-bottom"><Badge state={card.state}>{card.status}</Badge></div></MagicCard>)}</section>
    </section>
    <section className="detail-view" aria-label="Status detail">
      <div className="detail-head"><button className="icon-button" onClick={() => setDetail(false)} aria-label="첫 화면으로 돌아가기"><ArrowLeft /></button><div><h2>{panel.title}</h2><p>{panel.subtitle}</p></div><Badge state={model.state}>{stateLabel(model.state)}</Badge></div>
      <Tabs.Root value={tab} onValueChange={setTab} className="tabs-root"><Tabs.List className="tabs-list" aria-label="Status sections">{Object.entries(panels).map(([id, item]) => <Tabs.Trigger key={id} value={id} className="tab-trigger">{item.title}</Tabs.Trigger>)}</Tabs.List></Tabs.Root>
      <div className="detail-scroll"><ShineBorder className="detail-panel"><div className="summary-strip"><div><small>Rows</small><b>{panel.rows.length}</b></div><div><small>State</small><b>{stateLabel(model.state)}</b></div><div><small>Updated</small><b>{relative(age(data.generatedAt))}</b></div></div><div className="list-stack">{panel.rows.map((row, index) => <div className="magic-list-item" key={`${row.name}-${index}`}><span className={`status-dot ${row.state}`}><StateIcon state={row.state} /></span><div><strong>{row.name}</strong><p>{row.detail}</p></div><Badge state={row.state}>{row.meta}</Badge>{row.url && <a href={row.url} target="_blank" rel="noreferrer" aria-label={`${row.name} 열기`}><ExternalLink /></a>}</div>)}</div></ShineBorder></div>
    </section>
    <nav className="floating-nav" aria-label="Status navigation"><button onClick={() => setDetail(false)} className={!detail ? "is-current" : ""}>Overview</button>{Object.entries(panels).map(([id, item]) => <button key={id} onClick={() => openDetail(id)} className={detail && tab === id ? "is-current" : ""}>{item.title}</button>)}</nav>
  </main>;
}

createRoot(document.getElementById("root")).render(<App />);
