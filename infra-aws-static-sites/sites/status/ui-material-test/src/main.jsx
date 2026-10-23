import * as React from "react";
import { createRoot } from "react-dom/client";
import * as Tabs from "@radix-ui/react-tabs";
import * as Tooltip from "@radix-ui/react-tooltip";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Circle,
  FileText,
  Gauge,
  Hash,
  Play,
  Plus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { clsx } from "clsx";
import "./styles.css";

const steps = [
  { label: "시작", meta: "Agent Input", time: "0.1s", icon: Play, state: "active", depth: 0 },
  { label: "에이전트 루프", meta: "New 에이전트 루프", time: "↻", icon: Plus, state: "active", depth: 1 },
  { label: "생각", icon: Hash, state: "idle", depth: 2 },
  { label: "실행 - slipbox_query", icon: ArrowRight, state: "idle", depth: 2 },
  { label: "실행 - slipbox_query", icon: ArrowRight, state: "idle", depth: 2 },
  { label: "슬립 탐색", meta: "New 슬립 탐색", time: "5.2s", icon: Check, state: "done", depth: 1 },
  { label: "슬립 탐색", meta: "New 슬립 탐색", time: "6.0s", icon: Check, state: "done", depth: 1 },
  { label: "슬립 탐색", meta: "New 슬립 탐색", time: "9.9s", icon: Check, state: "done", depth: 1 },
  { label: "관찰", icon: Circle, state: "idle", depth: 0 },
];

function Hint({ label, children }) {
  return (
    <Tooltip.Root>
      <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content className="tooltip" sideOffset={6}>{label}<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

function CloseButton({ label }) {
  return <Hint label={label}><button className="icon-button" aria-label={label}><X size={16} /></button></Hint>;
}

function PanelHeader({ icon: Icon, title, tone = "muted", action }) {
  return <header className="panel-head"><div className={clsx("panel-title", `tone-${tone}`)}><span className="icon-box"><Icon size={15} /></span>{title}</div>{action}</header>;
}

function Trace() {
  return <section className="panel glass trace-panel">
    <PanelHeader icon={Gauge} tone="violet" title="디버거" action={<CloseButton label="디버거 닫기" />} />
    <div className="trace-list" role="list" aria-label="에이전트 실행 단계">
      {steps.map(({ label, meta, time, icon: Icon, state, depth }, index) => <div className={clsx("trace-step", `depth-${depth}`, state)} role="listitem" key={`${label}-${index}`}>
        <span className="step-marker"><Icon size={12} /></span>
        <span className="step-copy">{label}{meta && <small>{meta}</small>}</span>
        <span className="step-time">{time}</span>
      </div>)}
    </div>
    <div className="trace-footer"><Sparkles size={14} /> 단계 상태는 Radix가 아니라 React 상태와 CSS 토큰이 담당합니다.</div>
  </section>;
}

function ResultPanel() {
  return <section className="panel glass result-panel">
    <PanelHeader icon={FileText} tone="cyan" title="결과 문서" action={<span className="live-chip">live</span>} />
    <Tabs.Root className="result-tabs" defaultValue="result">
      <Tabs.List className="tabs-list" aria-label="결과 보기">
        <Tabs.Trigger className="tab-trigger" value="result">결과</Tabs.Trigger>
        <Tabs.Trigger className="tab-trigger" value="structure">구조</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content className="tab-content" value="result">
        <h2>슬립박스 내용 추론 테스트</h2>
        <p>React 컴포넌트와 CSS 재질 토큰을 분리해, 결과가 필요한 부분만 밀도를 높입니다.</p>
        <div className="data-table">{[["슬립박스 이름", "DEMO_MES"], ["저장 형식", "테이블별 슬립"], ["내용 수준", "DDL 스키마 + 조회 가이드"], ["언어", "한국어 비즈니스명"]].map(([key, value]) => <div className="data-row" key={key}><strong>{key}</strong><span>{value}</span></div>)}</div>
        <div className="answer">이 회사에서 필요한 핵심 인사이트를 먼저 확인해볼게요. 결과는 이 표면에 이어서 쌓입니다.</div>
        <button className="action-button">다음 단계 보기 <ArrowRight size={14} /></button>
      </Tabs.Content>
      <Tabs.Content className="tab-content structure-copy" value="structure"><p><b>Surface</b>는 CSS 토큰, <b>Trace</b>는 React 배열, <b>Tabs</b>는 Radix primitive로 분리되어 있습니다.</p></Tabs.Content>
    </Tabs.Root>
  </section>;
}

function App() {
  return <Tooltip.Provider delayDuration={250}><main className="page">
    <div className="eyebrow">React material study / status</div>
    <h1>투명도와 단계 UI를 라이브러리로 보기</h1>
    <p className="intro">React가 컴포넌트 상태를 관리하고, Radix가 탭·툴팁의 접근 가능한 동작을 제공하며, Lucide가 아이콘을 그립니다. 글래스 재질과 단계선은 CSS 토큰으로 조정합니다.</p>
    <div className="legend"><span>React 18</span><span>Radix Tabs + Tooltip</span><span>Lucide React</span><span>custom CSS tokens</span></div>
    <div className="demo">
      <aside className="panel glass rail-panel"><PanelHeader icon={Search} title="설비 고장 및 분석" action={<CloseButton label="분석 패널 닫기" />} /><div className="prompt">지금 당장 경영진이 가장 주목해야 할 항목을 확인하고, 고장 상태와 우선순위를 정리합니다.</div><p className="rail-note">생각 중…<br />관련 테이블과 상태값을 먼저 읽고 있어요.</p><div className="input">에이전트가 자동으로 테스트를 진행하고 있습니다…</div></aside>
      <Trace />
      <ResultPanel />
    </div>
    <pre className="code"><b>components</b> = React + Radix Tabs/Tooltip + lucide-react
<b>surface</b>     = rgba() + backdrop-filter + inset highlight
<b>trace</b>       = React state array + CSS pseudo-element + depth classes</pre>
  </main></Tooltip.Provider>;
}

createRoot(document.getElementById("root")).render(<App />);
