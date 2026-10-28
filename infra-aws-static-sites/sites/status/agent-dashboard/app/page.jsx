'use client';

import * as React from 'react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, ArrowDownLeft, ArrowUpRight, Bot, Clock3, Database, GitBranch, RefreshCw, Search, Sparkles, Wrench, Zap } from 'lucide-react';
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
    <div className="agent-card-bottom"><span>{agent?.evidenceCount ?? 0}개 근거</span><span>{fmtAge(agent?.lastActivityAt)}</span></div>
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
  const synthesis = data.mainSynthesis || { summary: '각 역할의 관찰과 근거를 모아 다음 작업 후보로 정리합니다.', method: '역할별 관찰 → 근거 확인 → 다음 액션 후보', contributors: [] };
  const healthy = roleAgents.filter((item) => item?.state === 'ok').length;
  const recent = data.generatedAt ? fmtAge(data.generatedAt) : '연결 대기';

  return <Tooltip.Provider delayDuration={180}><main className="agent-room">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="room-header">
      <a className="brand-lockup room-home-link" href="/"><span className="brand-mark"><Bot size={19} /></span><div><span className="overline">SPACE / AGENT ROOM</span><h1>에이전트 상황실</h1></div></a>
      <div className="header-status"><span className="live-pill"><i /> LIVE</span><span>피드 {recent}</span><GlassTip content="60초마다 agents-live.json을 다시 읽습니다"><button className="refresh" onClick={load} aria-label="피드 새로고침"><RefreshCw size={15} className={loading ? 'spin' : ''} /></button></GlassTip></div>
    </header>

    <section className="command-deck">
      <div className="deck-heading"><div><span className="overline">ORCHESTRATOR / MAIN</span><h2>지금 에이전트들이<br /><em>무엇을 움직이고 있나.</em></h2></div><div className="deck-score"><span>ONLINE</span><strong>{healthy || '—'}<small> / {roles.length}</small></strong><span>에이전트 연결</span></div></div>
      <div className="deck-grid"><div className="pulse-visual"><div className="pulse-ring ring-a" /><div className="pulse-ring ring-b" /><div className="core"><Activity size={21} /><span>MAIN</span></div><span className="pulse-caption">관찰을 모아<br />다음 행동을 고릅니다</span></div><div className="deck-copy"><p>{synthesis.summary}</p><div className="synthesis-steps">{synthesis.method}</div><div className="deck-meta"><span><Database size={14} /> {synthesis.contributors?.length || 0}개 역할 취합</span><span><Clock3 size={14} /> {fmtAge(lastRefresh || data.generatedAt)}</span></div></div></div>
    </section>

    <section className="agents-section"><div className="section-line"><div><span className="overline">ROLE NETWORK / 05</span><h2>역할별 작업면</h2></div><span className="section-note">카드를 선택하면 흐름이 열립니다</span></div><div className="agent-grid">{roles.map((role, index) => <AgentCard key={role.id} role={role} agent={roleAgents[index]} selected={selected === role.id} onSelect={setSelected} />)}</div></section>

    <AnimatePresence mode="wait"><motion.section key={selectedRole.id} className="detail-grid" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: .25 }}>
      <div className="detail-panel observation"><div className="panel-heading"><div><span className="overline">RECENT WORK</span><h3>{selectedRole.name} 에이전트가 한 일</h3></div><StateDot state={selectedAgent?.state || 'none'} /></div><div className="observation-main"><div className={cnx('large-icon', `tone-${selectedRole.tone}`)}>{React.createElement(selectedRole.icon, { size: 24 })}</div><div><strong>{selectedAgent?.activity?.summary || selectedAgent?.detail || selectedRole.focus}</strong><p>{selectedAgent ? `${fmtAge(selectedAgent.lastActivityAt)}에 실제 근거를 확인했습니다.` : '라이브 피드에 이 역할의 활동이 아직 도착하지 않았습니다.'}</p></div></div><div className="evidence-block"><span className="evidence-label">확인한 근거</span>{selectedAgent?.activity?.checked?.length ? <div className="evidence-chips">{selectedAgent.activity.checked.map((item) => <span key={item}>{item}</span>)}</div> : <p>확인한 근거가 아직 없습니다.</p>}</div><div className="evidence-row"><span>현재 판정</span><b>{stateLabel[selectedAgent?.state] || '수집 대기'}</b><span>최근 확인</span><b>{fmtAge(selectedAgent?.lastActivityAt || data.generatedAt)}</b></div></div>
      <div className="detail-panel delivery"><div className="panel-heading"><div><span className="overline">NEXT HANDOFF</span><h3>다음으로 넘기는 일</h3></div><ArrowDownLeft size={18} /></div><div className="handoff"><div className="handoff-node node-active"><StateDot state="ok" /><span>{selectedRole.name}</span></div><FlowLine from={selectedRole.id} to="main" label="활동 요약" /><div className="handoff-node"><StateDot state="ok" /><span>MAIN / Genie</span></div></div><p className="handoff-note">{selectedAgent?.activity?.next || '새 활동이 확인되면 다음 전달 방향을 정리합니다.'}</p></div>
    </motion.section></AnimatePresence>

    <footer><a href="/">← Space status 홈</a><span>읽기 전용 라이브 뷰 · source: agents-live.json</span></footer>
  </main></Tooltip.Provider>;
}

export default App;
