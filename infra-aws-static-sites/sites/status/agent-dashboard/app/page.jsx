'use client';

import * as React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDownLeft, ArrowUpRight, Bot, CheckCircle2, Clock3, Database, GitBranch, Layers3, RefreshCw, Search, Sparkles, Wrench, XCircle, Zap } from 'lucide-react';
import { cn } from '../lib/utils';

const roles = [
  { id: 'planner', name: '기획', english: 'Planner', icon: Search, tone: 'violet', focus: '시장·문서 신호' },
  { id: 'developer', name: '개발', english: 'Developer', icon: Wrench, tone: 'cyan', focus: '소스·테스트 상태' },
  { id: 'marketing', name: '마케팅', english: 'Marketing', icon: Zap, tone: 'amber', focus: '반응·전환 신호' },
  { id: 'design', name: '디자인', english: 'Design', icon: Sparkles, tone: 'rose', focus: '화면·타이포그래피' },
  { id: 'operator', name: '운영', english: 'Operator', icon: GitBranch, tone: 'emerald', focus: '실행·배포·복구' },
];

const fallback = {
  generatedAt: null,
  agents: [],
  crons: [],
  outputs: [],
  system: { layers: [] },
};

const stateLabel = { ok: '정상', warn: '확인 필요', bad: '중단', none: '대기' };
const fmtAge = (iso) => {
  if (!iso) return '수집 대기';
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return '방금 전';
  if (mins < 60) return `${mins}분 전`;
  if (mins < 1440) return `${Math.round(mins / 60)}시간 전`;
  return `${Math.round(mins / 1440)}일 전`;
};

function cnx(...values) { return cn(values); }

function StateDot({ state = 'none' }) {
  return <span className={cnx('state-dot', `state-${state}`)} aria-label={stateLabel[state] || stateLabel.none} />;
}

function GlassTip({ children, content }) {
  return <Tooltip.Root><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tooltip" sideOffset={8}>{content}<Tooltip.Arrow className="tooltip-arrow" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}

function AgentCard({ role, agent, selected, onSelect }) {
  const Icon = role.icon;
  const state = agent?.state || 'none';
  return <motion.button layout whileHover={{ y: -5, rotateX: 2, rotateY: -1 }} whileTap={{ scale: 0.985 }} className={cnx('agent-card', `tone-${role.tone}`, selected && 'selected')} onClick={() => onSelect(role.id)} aria-pressed={selected}>
    <div className="card-orbit" />
    <div className="agent-card-top"><span className="agent-icon"><Icon size={17} /></span><span className="agent-role">{role.english}</span><StateDot state={state} /></div>
    <div className="agent-card-title"><strong>{role.name}</strong><span>{role.focus}</span></div>
    <div className="agent-card-bottom"><span>{agent?.crons ?? 0}개 감시</span><span>{fmtAge(agent?.lastActivityAt)}</span></div>
  </motion.button>;
}

function FlowLine({ from, to, label }) {
  return <motion.div className="flow-line" initial={{ opacity: 0, scaleX: .4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ duration: .55 }}><span className="flow-dot" /><span className="flow-label">{label}</span><ArrowUpRight size={14} /></motion.div>;
}

function App() {
  const [data, setData] = React.useState(fallback);
  const [selected, setSelected] = React.useState('planner');
  const [loading, setLoading] = React.useState(true);
  const [lastRefresh, setLastRefresh] = React.useState(null);

  const load = React.useCallback(async () => {
    try {
      const response = await fetch('../agents-live.json', { cache: 'no-store' });
      if (response.ok) setData(await response.json());
    } catch { /* Keep the last safe snapshot visible. */ }
    setLoading(false);
    setLastRefresh(new Date().toISOString());
  }, []);

  React.useEffect(() => { load(); const timer = window.setInterval(load, 60_000); return () => window.clearInterval(timer); }, [load]);

  const agents = data.agents || [];
  const roleAgents = roles.map((role) => (
    (data.roleWatchers || []).find((agent) => agent.id === role.id)
    || agents.find((agent) => (agent.id || '').toLowerCase() === role.id)
    || null
  ));
  const selectedRole = roles.find((role) => role.id === selected) || roles[0];
  const selectedAgent = roleAgents.find((agent) => agent?.id === selectedRole.id);
  const latestOutputs = (data.outputs || []).filter((item) => item.state !== 'none').slice(0, 4);
  const healthy = roleAgents.filter((item) => item?.state === 'ok').length;
  const recent = data.generatedAt ? fmtAge(data.generatedAt) : '연결 대기';

  return <Tooltip.Provider delayDuration={180}><main className="agent-room">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="room-header">
      <div className="brand-lockup"><span className="brand-mark"><Bot size={19} /></span><div><span className="overline">SPACE / AGENT ROOM</span><h1>에이전트 상황실</h1></div></div>
      <div className="header-status"><span className="live-pill"><i /> LIVE</span><span>피드 {recent}</span><GlassTip content="60초마다 agents-live.json을 다시 읽습니다"><button className="refresh" onClick={load} aria-label="피드 새로고침"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button></GlassTip></div>
    </header>

    <section className="command-deck">
      <div className="deck-heading"><div><span className="overline">ORCHESTRATOR / MAIN</span><h2>지금 에이전트들이<br /><em>무엇을 움직이고 있나.</em></h2></div><div className="deck-score"><span>ONLINE</span><strong>{healthy || '—'}<small> / {roles.length}</small></strong><span>에이전트 연결</span></div></div>
      <div className="deck-grid"><div className="pulse-visual"><div className="pulse-ring ring-a" /><div className="pulse-ring ring-b" /><div className="core"><Activity size={21} /><span>MAIN</span></div><span className="pulse-caption">작업을 묶고<br />다음 행동을 고릅니다</span></div><div className="deck-copy"><p>각 역할은 자기 신호를 읽고, 필요한 일만 Infinity Backlog에 건넵니다. 아래 카드를 누르면 최근 관찰과 다음 전달 방향을 볼 수 있습니다.</p><div className="deck-meta"><span><Database size={14} /> live feed</span><span><Clock3 size={14} /> {fmtAge(lastRefresh || data.generatedAt)}</span></div></div></div>
    </section>

    <section className="agents-section"><div className="section-line"><div><span className="overline">ROLE NETWORK / 05</span><h2>역할별 작업면</h2></div><span className="section-note">카드를 선택하면 흐름이 열립니다</span></div><div className="agent-grid">{roles.map((role, index) => <AgentCard key={role.id} role={role} agent={roleAgents[index]} selected={selected === role.id} onSelect={setSelected} />)}</div></section>

    <AnimatePresence mode="wait"><motion.section key={selectedRole.id} className="detail-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>
      <div className="detail-panel observation"><div className="panel-heading"><div><span className="overline">RECENT OBSERVATION</span><h3>{selectedRole.name} 에이전트의 최근 관찰</h3></div><StateDot state={selectedAgent?.state || 'none'} /></div><div className="observation-main"><div className={cnx('large-icon', `tone-${selectedRole.tone}`)}>{React.createElement(selectedRole.icon, { size: 24 })}</div><div><strong>{selectedAgent?.detail || selectedRole.focus}</strong><p>{selectedAgent ? `${selectedAgent.crons || 0}개 와처가 ${fmtAge(selectedAgent.lastActivityAt)} 신호를 확인했습니다.` : '라이브 피드에 이 역할의 상세 결과가 아직 도착하지 않았습니다.'}</p></div></div><div className="evidence-row"><span>현재 판정</span><b>{stateLabel[selectedAgent?.state] || '수집 대기'}</b><span>최근 확인</span><b>{fmtAge(selectedAgent?.lastActivityAt || data.generatedAt)}</b></div></div>
      <div className="detail-panel delivery"><div className="panel-heading"><div><span className="overline">HANDOFF / NEXT</span><h3>다음으로 전달하는 방향</h3></div><ArrowDownLeft size={18} /></div><div className="handoff"><div className="handoff-node node-active"><StateDot state="ok" /><span>{selectedRole.name}</span></div><FlowLine from={selectedRole.id} to="main" label="근거 있는 후보" /><div className="handoff-node"><StateDot state="ok" /><span>MAIN / Genie</span></div></div><p className="handoff-note">구체적인 변화가 있을 때만 후보를 만들고, 메인이 중복을 묶어 다음 태스크로 승격합니다.</p></div>
    </motion.section></AnimatePresence>

    <section className="results-section"><div className="section-line"><div><span className="overline">OUTPUT / TRACE</span><h2>최근 만들어진 결과</h2></div><span className="section-note">{latestOutputs.length ? `${latestOutputs.length}개 표시 중` : '새 결과를 기다리는 중'}</span></div><div className="result-list">{latestOutputs.length ? latestOutputs.map((item, index) => <div className="result-row" key={`${item.name || 'output'}-${index}`}><span className="result-index">0{index + 1}</span><CheckCircle2 size={16} /><div><strong>{item.name || '운영 결과'}</strong><span>{item.detail || item.reason || '결과 상세를 수집 중입니다.'}</span></div><span className="result-age">{fmtAge(item.updatedAt || item.lastActivityAt)}</span></div>) : <div className="empty-row"><Sparkles size={16} /> 와처가 다음 유의미한 신호를 기다리고 있습니다.</div>}</div></section>
    <footer><span>Agent room · 읽기 전용 라이브 뷰</span><span>source: agents-live.json</span></footer>
  </main></Tooltip.Provider>;
}

export default App;
