import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUpRight, Check, ChevronRight, CircleHelp, Coffee, GitBranch, Layers, RefreshCw } from 'lucide-react';
import { FLOORS, BUILDING, STAGES, characterAsset, officeActors, actorEvent, normalizeSnapshot, mergeSnapshot, freshness, advanceSnapshot, sessionVisual, waitingVisual, roomIsClosed, metricDisplay, safeLink, elapsed, clockTime, sourceLabel, timestamp, enqueueSessionEvents, advanceSessionEvents, floorOccupancy, runtimeSessionCounts, knownSource, observationState, metricObservation, nextRoomLighting } from './model.js';
import './styles.css';

const ASSET = `${import.meta.env.BASE_URL}assets/`;
const EMPTY = { residents: [], sessions: [], events: [], questions: [], repositories: [], projects: [], strategy: {}, tasks: [], day: {}, activity: [], sources: {} };
function useFeed() {
  const [data, setData] = useState(null);
  const [connection, setConnection] = useState('loading');
  const [error, setError] = useState('');
  const [eventBatch, setEventBatch] = useState({ events: [], sessions: [], reset: false });
  const ledger = useRef(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  const controller = useRef(null);
  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    controller.current = new AbortController();
    const timeout = setTimeout(() => controller.current?.abort(), 12_000);
    try {
      const response = await fetch('/office-live.json', { cache: 'no-store', signal: controller.current.signal });
      if (!response.ok) throw new Error(response.status === 404 ? '첫 스냅샷을 기다리고 있어요.' : '스냅샷에 연결하지 못했어요.');
      const next = normalizeSnapshot(await response.json());
      if (!next) throw new Error('스냅샷 형식을 확인하고 있어요.');
      if (!mounted.current) return;
      const update = advanceSnapshot(ledger.current, next);
      if (!ledger.current || timestamp(next.observedAt) >= ledger.current.time) {
        setData(previous => mergeSnapshot(previous, next));
      }
      ledger.current = update.ledger;
      if (update.events.length || update.reset) setEventBatch({ events: update.events, sessions: next.sessions, reset: !!update.reset });
      setConnection('ok');
      setError('');
    } catch (reason) {
      if (mounted.current) { if (ledger.current) ledger.current = { ...ledger.current, live: false }; setConnection('error'); setError(reason.name === 'AbortError' ? '스냅샷 응답이 늦어지고 있어요.' : reason.message); }
    } finally { clearTimeout(timeout); busy.current = false; }
  }, []);
  useEffect(() => {
    mounted.current = true;
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => { mounted.current = false; clearInterval(timer); controller.current?.abort(); };
  }, [refresh]);
  return { data, connection, error, eventBatch, refresh };
}
function Link({ href, children, className = '' }) {
  const safe = safeLink(href);
  return safe ? <a className={className} href={safe} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={13} /></a> : <span className={className}>{children}</span>;
}
function Dot({ live }) { return <span className={`status-dot ${live ? 'live' : ''}`} aria-hidden="true" />; }
function Empty({ children }) { return <p className="empty-copy">{children}</p>; }
const taskStatus = value => ({ backlog: '대기', pending: '대기', waiting: '답변 대기', active: '진행 중', working: '진행 중', blocked: '막힘', completed: '완료', done: '완료', cancelled: '취소', archived: '보관', todo: '예정', in_progress: '진행 중' })[value?.toLowerCase()] || '상태 미확인';
function BoardTasks({ data, floor }) {
  const tasks = data.tasks.filter(task => Number(task.floor) === floor).slice(0, 2);
  return <div className="board-tasks">{tasks.length ? tasks.map(task => <span key={task.id} title={task.title}><i>↳</i>{task.title}</span>) : <small>연결된 태스크 없음</small>}</div>;
}
function BoardContent({ floor, data, project, now }) {
  if (floor === 1) return <><span className="board-kicker">SYSTEMS / 01</span><strong>Build. Run. Improve.</strong><div className="board-lines">{['OpenClaw', 'Infinity', 'Knowledge Lab'].map((name, i) => <span key={name}><i>{String(i + 1).padStart(2, '0')}</i>{name}<b>{observationState(data.repositories.find(r => r.name.toLowerCase().replaceAll(' ', '-') === name.toLowerCase().replaceAll(' ', '-')), now) === 'ok' ? '✓' : '—'}</b></span>)}</div><BoardTasks data={data} floor={floor} /></>;
  if (floor === 2) return <><span className="board-kicker">CUSTOMER / 02</span><strong>{project?.name || '고객의 여정'}</strong><div className="board-metrics">{STAGES.map(([stage, label]) => <span key={stage}><i>{label}</i><b>{metricDisplay(metricObservation(project?.metrics?.find(m => m.stage?.toLowerCase() === stage), data.sources.metrics, now))}</b></span>)}</div><small>{project ? '프로젝트별 AARRR' : '프로젝트 연결 대기'}</small><BoardTasks data={data} floor={floor} /></>;
  if (floor === 3) return <><span className="board-kicker">BUSINESS / 03</span><strong>Less, but meaningful.</strong><div className="board-lines">{[['strategy', '전략'], ['values', '가치'], ['hypotheses', '가설']].map(([key, label]) => <span key={key}><i>↗</i>{label}<b>{data.strategy[key]?.length || '—'}</b></span>)}</div><BoardTasks data={data} floor={floor} /></>;
  return <><span className="board-kicker">THE OWNER / 04</span><strong>Room for a decision.</strong><div className="board-owner"><b>{knownSource(data, 'tasks', now) ? data.questions.length : '—'}</b><span>결정 대기</span></div><small>한 번에, 한 가지씩.</small><BoardTasks data={data} floor={floor} /></>;
}
function Actor({ session, question, index, data, now, tick, live, event, selected, onSelect, thresholds, layout, interactive = true }) {
  const isOwner = session.kind === 'owner';
  const canMove = !isOwner && live && freshness(data, now, session).live && (!question || knownSource(data, 'tasks', now));
  const visualRef = useRef(null);
  if (canMove || !visualRef.current) visualRef.current = question && !event ? waitingVisual(question, now, thresholds) : sessionVisual(session, now, tick, event);
  const visual = visualRef.current;
  const positions = question && layout.queue ? layout.queue : layout.seats;
  const pos = positions[index % positions.length];
  const ActorTag = interactive ? 'button' : 'div';
  const direction = event?.type === 'arrived' ? 'arriving' : event?.type === 'departed' ? 'departing' : '';
  return <ActorTag className={`actor ${direction} ${selected ? 'selected' : ''} ${!canMove ? 'is-frozen' : ''}`} style={{ left: `${pos[0]}%`, top: `${pos[1]}%`, '--travel-x': `${layout.entrance[0] - pos[0]}cqw`, '--travel-y': layout.building ? `${layout.entrance[1] - pos[1]}cqh` : `${(layout.entrance[1] - pos[1]) * 2 / 3}cqw`, '--actor-accent': ['#a4563d', '#60745b', '#7d6a95', '#557c89'][index % 4] }} onClick={interactive ? () => onSelect(session.id) : undefined} data-actor-id={session.id} data-session-id={session.sessionId || undefined} data-resident={session.resident || undefined} aria-label={`${session.name || session.agentId || '세션'}, ${isOwner ? '대표 자리' : canMove ? visual.label : '확인 중'}`}>
    <span className="sprite" style={{ backgroundImage: `url("${ASSET}${characterAsset(session)}")`, backgroundPosition: `${visual.col * 100 / 3}% ${visual.row * 50}%` }} />
    {visual.sweat && <span className="sweat" aria-label="오래 진행 중">◦</span>}
    {visual.stars && <span key={event?.id} className="stars" aria-label="새 결과 보고">✦ <i>✧</i></span>}
    <span className="actor-label">{!isOwner && <Dot live={canMove && session.state !== 'idle'} />}{session.name || session.agentId || '실행 세션'}</span>
    {event && <span className="speech">{visual.label}</span>}
    {!canMove && !isOwner && <span className="actor-unknown">확인 중</span>}
  </ActorTag>;
}
function sessionCountLabel(occupancy, suffix) {
  return `${occupancy.verifiedSessionCount}${suffix}${occupancy.unknownSessionCount ? ` · ${occupancy.unknownSessionCount}개 세션 확인 중` : ''}`;
}
function OfficeScene({ floor, data, now, tick, live, eventQueue = [], selected, select, project, direction = '', thresholds, interactive = true }) {
  const [failed, setFailed] = useState(false);
  const current = FLOORS.find(f => f.id === floor);
  const layout = current.visual;
  const BoardTag = interactive ? 'button' : 'div';
  useEffect(() => setFailed(false), [layout.asset]);
  const light = useRef({});
  const previousFloor = useRef(floor);
  const [, redrawLighting] = useState(0);
  // Changing floors never replays a previous closing sequence.
  if (previousFloor.current !== floor && light.current[floor]) light.current[floor] = { ...light.current[floor], sequence: false };
  previousFloor.current = floor;
  if (live) light.current[floor] = nextRoomLighting(light.current[floor], roomIsClosed(data, floor, now), true);
  const lighting = light.current[floor] || { closed: false, sequence: false };
  const occupancy = floorOccupancy(data, eventQueue, floor, now);
  const visible = occupancy.seated;
  const waiting = occupancy.waiting;

  return <div className={`scene-wrapper ${interactive ? '' : 'scene-miniature'} ${live ? '' : 'is-frozen'}`} style={{ '--floor-accent': layout.accent }}>
    <div className={`office-scene ${direction} ${lighting.closed ? 'lights-off' : ''} ${lighting.sequence ? 'lights-sequence' : ''} ${failed ? 'image-failed' : ''}`} key={floor}>
      <img className="office-background" src={`${ASSET}${layout.asset}`} alt={layout.alt} onError={() => setFailed(true)} />
      {failed && <div className="image-error">공간 이미지를 불러오지 못했어요.</div>}
      <BoardTag className="wall-board" style={{ left: `${layout.board[0]}%`, top: `${layout.board[1]}%`, width: `${layout.board[2]}%`, height: `${layout.board[3]}%`, transform: `skewY(${layout.board[4]}deg)` }} onClick={interactive ? () => select(null) : undefined} aria-label={`${current.name} 화이트보드${interactive ? ' 상세 보기' : ''}`}><BoardContent floor={floor} data={data} project={project} now={now} /></BoardTag>
      <div className="leader-plaque" style={{ left: `${layout.plaque[0]}%`, top: `${layout.plaque[1]}%` }}><span>{current.leader}</span><small>{current.name}</small></div>
      <span className="elevator-marker" style={{ left: `${layout.entrance[0] - 2.2}%`, top: `${layout.entrance[1] - 10.7}%` }}>{floor}<small>F</small></span>
      <div className="desk-labels">{layout.zones.map(zone => <span key={zone.label} style={{ left: `${zone.x}%`, top: `${zone.y}%`, transform: `skewY(${zone.angle}deg)` }}>{zone.label}</span>)}</div>
      {visible.slice(0, layout.seats.length).map((s, i) => <Actor key={s.id} session={s} index={i} data={data} now={now} tick={tick} live={live} event={actorEvent(s, eventQueue)} selected={selected === s.id} onSelect={select} layout={layout} interactive={interactive} />)}
      {floor === 4 && waiting.slice(0, 8).map(({ session, question }, i) => <Actor key={`queue-${session.id}`} session={session} question={question} event={actorEvent(session, eventQueue)} index={i} data={data} now={now} tick={tick} live={live} selected={selected === session.id} onSelect={select} thresholds={thresholds} layout={layout} interactive={interactive} />)}
      {floor === 4 && data.questions.some(q => !data.sessions.some(s => s.id === q.sessionId)) && <BoardTag className="queue-tickets" style={layout.ticket ? { left: `${layout.ticket[0]}%`, top: `${layout.ticket[1]}%` } : undefined} onClick={interactive ? () => select(null) : undefined} aria-label="결정 대기 질문 보기"><span>?</span><b>{data.questions.filter(q => !data.sessions.some(s => s.id === q.sessionId)).length}</b><small>결정 대기</small></BoardTag>}
      <div className="light-layers" aria-hidden="true">{[0, 1, 2, 3].map(zone => <div key={zone} aria-hidden="true" className={`light-overlay light-zone-${zone}`} style={{ '--light-delay': `${zone * 450}ms` }} onAnimationEnd={() => {
        if (zone === 3) { light.current[floor] = { ...light.current[floor], sequence: false }; redrawLighting(value => value + 1); }
      }} />)}</div>
    </div>
    {interactive && <div className="scene-caption"><span className="caption-line" /><span>{occupancy.residentCount || occupancy.ownerCount ? `${occupancy.residentCount}명 상주${occupancy.ownerCount ? ' · 대표 자리' : ''} · ${live ? sessionCountLabel(occupancy, '개 실행 세션') : '활동 확인 중'}` : occupancy.count ? live ? sessionCountLabel(occupancy, '개 세션이 관측됐어요') : '활동 확인 중' : live ? '지금 관측된 실행 세션이 없어요' : '새로운 세션 관측을 기다리고 있어요'}</span><span className="caption-line" /></div>}
  </div>;
}
function Repositories({ data, now }) {
  const repos = data.repositories.length ? data.repositories : ['OpenClaw', 'Infinity', 'Knowledge Lab'].map(name => ({ name, state: 'unknown' }));
  return <><div className="panel-heading"><span className="eyebrow">CONNECTED SYSTEMS</span><h2>세 시스템의 오늘</h2><p>만들고, 실행하고, 기억합니다.</p></div><div className="repository-list">{repos.map(repo => <article className="repository" key={repo.name}><div className="item-title"><Link href={repo.url}>{repo.name}</Link><span className={`state-label ${observationState(repo, now) === 'ok' ? 'is-ok' : ''}`}>{sourceLabel(observationState(repo, now))}</span></div><div className="git-line"><GitBranch size={13} /><span>{repo.branch || '브랜치 미확인'}</span><code>{repo.sha?.slice(0, 7) || '—'}</code></div><div className="repo-facts"><span>변경 <b>{repo.dirtyCount ?? '—'}</b></span><span>↑ {repo.ahead ?? '—'}<em> / </em>↓ {repo.behind ?? '—'}</span></div><small>관측 {repo.observedAt ? `${elapsed(repo.observedAt, now)} 전` : '미수집'} · 로컬 Git · 원격 추적 기준</small></article>)}</div><TaskList data={data} floor={1} /></>;
}
function Metrics({ data, project, setProject, now }) {
  return <>
    <div className="panel-heading"><span className="eyebrow">CUSTOMER JOURNEY</span><h2>고객의 여정</h2><p>다음 행동을 바꾸는 숫자만.</p></div>
    <label className="project-label" htmlFor="project">프로젝트</label>
    <select id="project" value={project?.id || ''} onChange={event => setProject(event.target.value)} disabled={!data.projects.length}>
      {!data.projects.length && <option value="">연결된 프로젝트 없음</option>}
      {data.projects.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
    </select>
    <div className="metrics-list">{STAGES.map(([key, title, english], index) => {
      const metric = metricObservation(project?.metrics?.find(item => item.stage?.toLowerCase() === key), data.sources.metrics, now);
      return <article className="metric" key={key}>
        <span className="metric-index">0{index + 1}</span>
        <div><h3>{title}<small>{english}</small></h3><p>{metric.label || '지표 정의 대기'}</p>
          <small>{metric.window || '기간 미정'} · {sourceLabel(metric.state)}</small>
          <small>관측 {metric.observedAt ? <time dateTime={metric.observedAt} title={metric.observedAt}>{clockTime(metric.observedAt, data.day.timeZone)} · {elapsed(metric.observedAt, now)} 전</time> : '미수집'}</small>
        </div><strong>{metricDisplay(metric)}</strong>
      </article>;
    })}</div>
    <p className="source-footnote">프로젝트 최근 표본 {project?.observedAt ? `${elapsed(project.observedAt, now)} 전` : '미수집'}<br />— 는 현재 확인할 수 없는 값입니다.</p>
    {data.sources.metrics?.detail && <p className="source-footnote">{data.sources.metrics.detail}</p>}
    <TaskList data={data} floor={2} />
  </>;
}
const hypothesisStatus = state => ({ hypothesis: '검증 전', unverified: '검증 전', pending: '검증 전', testing: '검증 중', in_progress: '검증 중', validated: '확인됨', confirmed: '확인됨', rejected: '기각', disproven: '기각', paused: '보류' })[state] || '검증 상태 미확인';
function Strategy({ data }) {
  return <>
    <div className="panel-heading"><span className="eyebrow">DIRECTION, NOT NOISE</span><h2>왜 이 일을 하는가</h2><p>전략, 가치, 그리고 검증할 가설.</p></div>
    {[['strategy', '전략', '01'], ['values', '가치', '02'], ['hypotheses', '가설', '03']].map(([key, label, number]) => <section className="strategy-section" key={key}>
      <h3><span>{number}</span>{label}</h3>
      {data.strategy[key]?.length ? data.strategy[key].map(item => <details key={item.id || item.title}>
        <summary>{item.title}<ChevronRight size={14} /></summary><p>{item.detail || '추가 설명이 없어요.'}</p>
        <dl className="strategy-facts">
          {key === 'hypotheses' && <><div><dt>검증 상태</dt><dd>{hypothesisStatus(item.state)}</dd></div><div><dt>다음 행동</dt><dd>{item.nextAction || '아직 정하지 않았어요.'}</dd></div></>}
          <div><dt>근거</dt><dd><Link href={item.sourceUrl} className="text-link">{item.sourceLabel || (item.sourceUrl ? '근거 보기' : '근거 미연결')}</Link></dd></div>
        </dl>
      </details>) : <Empty>공개 요약이 아직 연결되지 않았어요.</Empty>}
    </section>)}
    <TaskList data={data} floor={3} />
  </>;
}
function Owner({ data, now, thresholds, setThresholds }) {
  const fresh = freshness(data, now);
  const counts = runtimeSessionCounts(data, now);
  return <><div className="panel-heading"><span className="eyebrow">A LITTLE ROOM TO THINK</span><h2>결정을 기다려요 <span className="count">{knownSource(data, 'tasks', now) ? data.questions.length : '—'}</span></h2><p>{knownSource(data, 'tasks', now) ? '오래 기다린 질문부터 보여드려요.' : '확인 중 · 마지막 관측의 질문입니다.'}</p></div><div className="question-list">{data.questions.length ? data.questions.map((q, i) => <article className="question" key={q.id}><span className="question-number">{String(i + 1).padStart(2, '0')}</span><div><Link href={q.sourceUrl}>{q.title || '승인 대기 항목'}</Link><small>{elapsed(q.askedAt, now)} 대기</small></div></article>) : <div className="calm-empty"><Check size={26} strokeWidth={1.2} /><h3>{knownSource(data, 'tasks', now) ? '지금은 비어 있어요.' : '결정 대기열 확인 중'}</h3><p>{knownSource(data, 'tasks', now) ? '확인된 결정 대기 항목이 없습니다.' : '다음 수집에서 대기 항목을 확인해요.'}</p></div>}</div><section className="today-summary"><span className="eyebrow">TODAY'S NOTES</span><div><span>현재 실행</span><b>{fresh.live ? counts.workingCount : '—'}</b></div><div><span>막힌 일</span><b>{fresh.live ? counts.blockedCount : '—'}</b></div><div><span>등록된 태스크</span><b>{knownSource(data, 'tasks', now) ? data.tasks.length : '—'}</b></div>{fresh.live && (fresh.partial || counts.unknownSessionCount > 0) && <p className="source-footnote">확인된 세션만 집계합니다.{fresh.partial ? ' 일부 실행 원천 확인 중.' : ''}{counts.unknownSessionCount > 0 ? ` ${counts.unknownSessionCount}개 세션 확인 중.` : ''}</p>}</section><details className="wait-settings"><summary>대기 표현 설정</summary><label>자세 변경 <select aria-label="자세 변경 대기 시간" value={thresholds.crouchAfter} onChange={e => setThresholds({ ...thresholds, crouchAfter: Number(e.target.value) })}><option value="600">10분 후</option><option value="1200">20분 후</option><option value="1800">30분 후</option></select></label><label>땀 표시 <select aria-label="땀 표시 대기 시간" value={thresholds.sweatAfter} onChange={e => setThresholds({ ...thresholds, sweatAfter: Number(e.target.value) })}><option value="2400">40분 후</option><option value="3600">60분 후</option><option value="7200">120분 후</option></select></label></details></>;
}
function TaskList({ data, floor }) {
  const tasks = data.tasks.filter(t => Number(t.floor) === floor);
  return <section className="task-section"><span className="eyebrow">ON THE DESK</span>{tasks.length ? tasks.slice(0, 5).map(t => <div className="task" key={t.id}><span>{t.title}</span><small>{taskStatus(t.status)}</small></div>) : <Empty>이 층에 연결된 태스크가 없어요.</Empty>}</section>;
}
function SessionDetail({ session, data, now, live, close }) {
  const visual = sessionVisual(session, now);
  const fresh = live && freshness(data, now, session).live;
  const parent = data.sessions.find(s => s.id === session.parentId);
  if (session.resident && !session.sessionId) return <><button className="back-to-board" onClick={close}><ArrowDown size={14} /> 화이트보드로</button><div className="panel-heading"><span className="eyebrow">{session.kind === 'owner' ? 'THE OWNER' : 'RESIDENT AGENT'}</span><h2>{session.name}</h2><p>{session.kind === 'owner' ? '대표 자리' : fresh ? '쉬는 중 · 실행 중인 작업 없음' : '활동 확인 중'}</p></div><p className="session-task">{session.kind === 'owner' ? '회사의 방향을 결정하는 자리입니다. 접속 상태를 나타내지는 않습니다.' : session.role || '이 공간에 등록된 에이전트입니다.'}</p><dl className="session-facts"><div><dt>담당 공간</dt><dd>{session.floor}F · {FLOORS.find(f => f.id === session.floor)?.name}</dd></div><div><dt>명단 관측</dt><dd>{clockTime(session.residentObservedAt, data.day.timeZone)}</dd></div></dl></>;
  return <><button className="back-to-board" onClick={close}><ArrowDown size={14} /> 화이트보드로</button><div className="panel-heading"><span className="eyebrow">OBSERVED SESSION</span><h2>{session.name || session.agentId}</h2><p><Dot live={fresh} />{fresh ? visual.label : '확인 중'}</p></div><p className="session-task">{session.taskLabel || '공개된 작업 요약이 없어요.'}</p><dl className="session-facts"><div><dt>실행 시간</dt><dd>{elapsed(session.startedAt, now)}</dd></div><div><dt>마지막 관측</dt><dd>{clockTime(session.observedAt, data.day.timeZone)}</dd></div><div><dt>담당 공간</dt><dd>{session.floor}F · {FLOORS.find(f => f.id === session.floor)?.name}</dd></div>{parent && <div><dt>상위 세션</dt><dd>{parent.name || parent.agentId}</dd></div>}</dl>{!fresh && <p className="source-footnote">새 증거를 받을 때까지 마지막 동작을 멈춥니다.</p>}</>;
}
function SessionList({ data, floor, select, now, live, eventQueue = [] }) {
  const sessions = floorOccupancy(data, eventQueue, floor, now).sessions;
  if (!sessions.length) return null;
  return <details className="session-directory"><summary>이 공간의 사람들 <span>{sessions.length}</span></summary>{sessions.map(session => <button key={session.id} onClick={() => select(session.id)}><span>{session.name || session.agentId || '실행 세션'}</span><small>{session.kind === 'owner' ? '대표 자리' : live && freshness(data, now, session).live ? sessionVisual(session, now).label : '확인 중'}</small><ChevronRight size={12} /></button>)}</details>;
}
function BuildingFloor({ floor, data, now, tick, live, eventQueue, project, thresholds, go }) {
  const occupancy = floorOccupancy(data, eventQueue, floor.id, now);
  const layout = { ...BUILDING[floor.id], building: true };
  const light = useRef(null);
  if (live) light.current = nextRoomLighting(light.current, roomIsClosed(data, floor.id, now), true);
  return <section className="building-floor" data-floor={floor.id} aria-label={`${floor.id}층 ${floor.name}`} style={{ '--floor-accent': floor.visual.accent }}>
    <button className="building-enter" style={{ top: `${layout.top}%`, height: `${layout.bottom-layout.top}%` }} onClick={() => go(floor.id)} aria-label={`${floor.id}층 ${floor.name} 들어가기`}>
      <span className="building-floor-label"><b>0{floor.id}<small>F</small></b><span><strong>{floor.name}</strong><small>{floor.leader}</small><em>{occupancy.residentCount}명 상주{occupancy.ownerCount ? ' · 대표 자리' : ''}</em><em className="building-session-count">{live ? sessionCountLabel(occupancy, '개 세션 관측') : '활동 확인 중'}</em></span><ArrowUpRight size={16} /></span>
    </button>
    <div className="wall-board" style={{ left: `${layout.board[0]}%`, top: `${layout.board[1]}%`, width: `${layout.board[2]}%`, height: `${layout.board[3]}%`, transform: 'none' }} aria-label={`${floor.name} 화이트보드`}><BoardContent floor={floor.id} data={data} project={project} now={now} /></div>
    {occupancy.seated.slice(0, layout.seats.length).map((session,index) => <Actor key={session.id} session={session} index={index} layout={layout} data={data} now={now} tick={tick} live={live} event={actorEvent(session,eventQueue)} interactive={false} />)}
    {occupancy.waiting.slice(0,8).map(({session,question},index) => <Actor key={session.id} session={session} question={question} index={index} layout={layout} data={data} now={now} tick={tick} live={live} event={actorEvent(session,eventQueue)} thresholds={thresholds} interactive={false} />)}
    <div className={`building-shade ${light.current?.closed ? 'is-closed' : ''} ${light.current?.sequence ? 'is-dimming' : ''}`} style={{ top: `${layout.top}%`, height: `${layout.bottom-layout.top}%`, '--close-delay': `${(4-floor.id)*450}ms` }} aria-hidden="true" />
  </section>;
}
function Overview({ data, live, go, now, tick, eventQueue = [], thresholds, project }) {
  const [failed,setFailed] = useState(false);
  return <div className="overview" aria-label="네 층이 세로로 이어진 하나의 LCML 건물">
    <div className={`building-scene ${live ? '' : 'is-frozen'}`}>
      <img className="building-background" src={`${ASSET}building.png`} alt="하나의 골조와 엘리베이터로 연결된 LCML 4층 건물 단면. 위에서 대표실, 비즈니스실, 고객실, 제품실." onError={() => setFailed(true)} />
      {failed && <div className="image-error">건물 이미지를 불러오지 못했어요.</div>}
      {FLOORS.map(floor => <BuildingFloor key={floor.id} floor={floor} data={data} now={now} tick={tick} live={live} eventQueue={eventQueue} project={project} thresholds={thresholds} go={go} />)}
    </div>
    <p className="building-note">상주 인원은 쉬는 동안에도 자리에 있어요. <span>움직임은 마지막으로 확인된 실행 상태를 따릅니다.</span></p>
  </div>;
}
function App() {
  const { data: feed, connection, error, eventBatch, refresh } = useFeed();
  const data = feed || EMPTY;
  const [floor, setFloor] = useState(1);
  const [direction, setDirection] = useState('');
  const [selected, setSelected] = useState(null);
  const [overview, setOverview] = useState(true);
  const [projectId, setProject] = useState('');
  const [now, setNow] = useState(Date.now());
  const [tick, setTick] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => { const query = window.matchMedia('(prefers-reduced-motion: reduce)'); const update = () => setReducedMotion(query.matches); query.addEventListener('change', update); return () => query.removeEventListener('change', update); }, []);
  const [eventQueue, setEventQueue] = useState([]);
  const [thresholds, setThresholds] = useState({ crouchAfter: 600, sweatAfter: 2400 });
  const current = FLOORS.find(f => f.id === floor);
  const fresh = freshness(feed, now);
  const live = fresh.live && connection === 'ok';
  const project = data.projects.find(p => p.id === projectId) || data.projects[0];
  const session = officeActors(data, eventQueue).find(s => s.id === selected);
  const occupancy = floorOccupancy(data, eventQueue, floor, now);
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => { if (!live) return; const id = setInterval(() => setTick(t => t + 1), 650); return () => clearInterval(id); }, [live]);
  useEffect(() => { setEventQueue(previous => enqueueSessionEvents(eventBatch.reset ? [] : previous, eventBatch.events, eventBatch.sessions)); }, [eventBatch]);
  useEffect(() => { setEventQueue(previous => advanceSessionEvents(previous, data, now, live)); }, [tick]);
  const go = useCallback(next => { setFloor(previous => { setDirection(next > previous ? 'going-up' : next < previous ? 'going-down' : ''); return next; }); setOverview(false); setSelected(null); }, []);
  function railKey(event) { if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) { event.preventDefault(); const next = event.key === 'Home' ? 4 : event.key === 'End' ? 1 : Math.min(4, Math.max(1, floor + (event.key === 'ArrowUp' ? 1 : -1))); go(next); document.getElementById(`floor-${next}`)?.focus(); } }
  return <div className={`app-shell ${overview ? 'has-overview' : ''}`}>
    <header className="topbar"><a className="brand" href="/office/" aria-label="LCML 홈"><span className="brand-mark"><i /><i /><i /><i /></span><span>LCML</span></a><p className="brand-tagline">Less complexity,<br /><b>More Life.</b></p><div className="collection-state"><span><Dot live={live} />{connection === 'loading' ? '첫 관측을 불러오는 중' : live ? fresh.partial ? '일부 실행 원천 확인 중' : '10분마다, 지금을 기록해요' : '확인 중 · 새 관측을 기다려요'}</span><small>마지막 수집 {clockTime(feed?.observedAt, data.day.timeZone)} <i>·</i> 10분 주기</small></div><a className="status-home" href="/" aria-label="Status로 돌아가기">Status <ArrowUpRight size={15} /></a></header>
    <div className={`workspace ${overview ? 'is-overview' : ''}`}>
      <nav className="floor-rail" aria-label="엘리베이터 층 선택" onKeyDown={railKey}><span className="rail-label">FLOORS</span><div className="floor-buttons">{FLOORS.map(f => <button id={`floor-${f.id}`} key={f.id} className={floor === f.id && !overview ? 'active' : ''} aria-pressed={floor === f.id && !overview} aria-label={`${f.id}층 ${f.name}`} onClick={() => go(f.id)}><span>0{f.id}</span><small>{f.name}</small><i /></button>)}</div><button className={`overview-button ${overview ? 'active' : ''}`} onClick={() => { setOverview(true); setSelected(null); }} aria-pressed={overview} aria-label="전체 보기"><Layers size={18} /><small>전체 보기</small></button><span className="rail-bottom">L / M</span></nav>
      <main className="main-room">
        {overview ? <div className="overview-room-heading"><div><span className="eyebrow">ONE BUILDING, FOUR FLOORS</span><h1>하나의 건물, 네 개의 일터.</h1></div><p>층을 눌러 사람과 오늘의 일을 살펴보세요.<span>04 FLOORS / LCML</span></p></div> : <div className="room-heading"><div className="room-title"><span className="floor-number">0{floor}<small>F</small></span><div><span className="eyebrow">{current.english}</span><h1>{current.name}</h1><p>{current.description}</p></div></div><div className="room-lead"><span>ROOM LEAD</span><strong>{current.leader}</strong><small>{current.visual.space}</small></div></div>}
        {error && <div className="feed-message" role="status"><CircleHelp size={15} /><span>{error} {feed ? '마지막 관측을 표시합니다.' : '수집되면 자동으로 나타나요.'}</span><button onClick={refresh} aria-label="스냅샷 다시 확인"><RefreshCw size={14} />다시 확인</button></div>}
        {overview ? <Overview data={data} live={live} go={go} now={now} tick={reducedMotion ? 0 : tick} eventQueue={eventQueue} thresholds={thresholds} project={project} /> : <OfficeScene floor={floor} data={data} now={now} tick={reducedMotion ? 0 : tick} live={live} eventQueue={eventQueue} selected={selected} select={setSelected} project={project} direction={direction} thresholds={thresholds} />}
        {!overview && <div className="room-bottom"><div><Dot live={live} /><span>{live ? '관측된 상태' : '확인 중'} <em>·</em> {live ? `${occupancy.residentCount}명 상주 · ${sessionCountLabel(occupancy, '개 실행 세션')}` : '세션 미확인'}</span></div><button onClick={() => document.getElementById('insight-panel')?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })}>화이트보드 자세히 <ArrowUpRight size={14} /></button></div>}
      </main>
      {!overview && <aside className="insight-panel" id="insight-panel" aria-label="화이트보드 상세"><div className="panel-top"><span>THE WHITEBOARD</span><span>0{floor} / 04</span></div>{session ? <SessionDetail session={session} data={data} now={now} live={live} close={() => setSelected(null)} /> : floor === 1 ? <Repositories data={data} now={now} /> : floor === 2 ? <Metrics data={data} project={project} setProject={setProject} now={now} /> : floor === 3 ? <Strategy data={data} /> : <Owner data={data} now={now} thresholds={thresholds} setThresholds={setThresholds} />}<SessionList data={data} floor={floor} select={setSelected} now={now} live={live} eventQueue={eventQueue} /><div className="insight-footer"><Coffee size={15} strokeWidth={1.3} /><span>여유가 생기는 쪽으로.</span></div></aside>}
    </div>
    <footer className="page-footer"><span>LCML OFFICE <i>—</i> A SMALL COMPANY, A FULLER LIFE.</span><span>관측 {feed?.observedAt ? `${elapsed(feed.observedAt, now)} 전` : '대기 중'}<i>·</i> 시간대 {data.day.timeZone || 'Asia/Seoul'}</span></footer>
  </div>;
}
export { Metrics, Strategy, Owner, OfficeScene, Repositories, Overview };
if (typeof document !== 'undefined') createRoot(document.getElementById('root')).render(<App />);
