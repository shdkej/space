// Coordinates are percentages of each full 1536 × 1024 floor image.
export const FLOORS = [
  {
    id: 4, name: '대표실', english: 'THE OWNER', leader: '사용자', description: '다음 방향을 결정하는 곳', board: '결정 대기', short: 'Decide',
    visual: {
      asset: 'floor-owner.png', alt: '독립 집무 책상, 서재와 식물이 있는 대표실 정원 라운지', accent: '#66765c', space: '집무실 · 정원 라운지',
      board: [24.1, 28.85, 17.65, 14.45, -16.8], plaque: [44, 44.3], entrance: [14, 66],
      // The three bench seats below belong exclusively to the question queue.
      seats: [[55,49],[29,70],[86,58]],
      queue: [[63,70],[67,68],[71,66],[60,75],[65,77],[70,79],[55,78],[59,82]], ticket: [56,72],
      zones: [{ label: 'PRIVATE OFFICE', x: 49, y: 57, angle: -18 }, { label: 'GARDEN LOUNGE', x: 79, y: 65, angle: 18 }],
    },
  },
  {
    id: 3, name: '비즈니스실', english: 'BUSINESS', leader: '샘 · SAM', description: '할 일보다, 해야 할 이유를 선명하게', board: '전략 · 가치 · 가설', short: 'Think',
    visual: {
      asset: 'floor-business.png', alt: '긴 월넛 회의 테이블과 전략 자료 벽을 갖춘 비즈니스실', accent: '#7c6150', space: '전략 회의실 · 자료 아카이브',
      board: [24.1, 28.85, 17.65, 14.45, -16.8], plaque: [44, 44.3], entrance: [14, 66],
      seats: [[29,60],[39,54],[51,49],[39.5,71],[51,67],[61,61],[80,55],[88,57]],
      zones: [{ label: 'STRATEGY TABLE', x: 35, y: 73, angle: -18 }, { label: 'RESEARCH ARCHIVE', x: 79, y: 63, angle: 18 }],
    },
  },
  {
    id: 2, name: '고객실', english: 'CUSTOMER', leader: '세스고딘 · CMO', description: '만드는 것과 필요한 것 사이', board: '고객의 여정', short: 'Listen',
    visual: {
      asset: 'floor-customer.png', alt: '원형 고객 인터뷰 라운지, 여정 전시와 워크숍 테이블이 있는 고객실', accent: '#a4563d', space: '고객 인터뷰 · 리서치 스튜디오',
      board: [24.1, 28.85, 17.65, 14.45, -16.8], plaque: [44, 44.3], entrance: [14, 66],
      seats: [[38,52],[51,51],[36,61],[52,62],[56,75],[67,75],[74,71],[82,58],[92,59],[34,77],[42,80],[60,63]],
      zones: [{ label: 'CUSTOMER INTERVIEW', x: 37, y: 68, angle: 18 }, { label: 'JOURNEY WORKSHOP', x: 55, y: 81, angle: 18 }, { label: 'RESEARCH BOOTH', x: 79, y: 65, angle: 18 }],
    },
  },
  {
    id: 1, name: '제품실', english: 'PRODUCT', leader: '지니', description: '생각을 제품으로, 제품을 일상으로', board: '세 시스템의 오늘', short: 'Make',
    visual: {
      asset: 'floor-product.png', alt: '세 개발 워크벤치, 서버 관제와 참고 자료 라이브러리를 갖춘 제품실', accent: '#597183', space: '개발 랩 · 세 시스템 워크벤치',
      board: [24.1, 28.85, 17.65, 14.45, -16.8], plaque: [44, 44.3], entrance: [14, 66],
      seats: [[33,64],[41,60],[60,55],[66,53],[48,85],[57,80],[64,76],[82,57]],
      zones: [{ label: 'OPENCLAW', x: 26, y: 66.5, angle: 18 }, { label: 'INFINITY', x: 53.4, y: 60.5, angle: 18 }, { label: 'KNOWLEDGE LAB', x: 42, y: 86, angle: 18 }],
    },
  },
];
export const STAGES = [
  ['acquisition', '유입', 'Acquisition'], ['activation', '활성화', 'Activation'],
  ['retention', '재방문', 'Retention'], ['revenue', '매출', 'Revenue'], ['referral', '추천', 'Referral'],
];
// Identity belongs to the person, not their seat, current task or display order.
const CHARACTER_ASSETS = new Map([
  ['owner', 'characters.png'],
  ...['genie', 'main', 'marketing', 'design', 'red', 'hj', 'taxops', 'codex']
    .map(id => [id, `characters-${id}.webp`]),
]);
export function characterAsset(actor) {
  return CHARACTER_ASSETS.get(actor.kind === 'owner' ? 'owner' : actor.agentId)
    || CHARACTER_ASSETS.get('codex');
}
// Percentages of the connected 1024 × 1536 building, independent of room art.
export const BUILDING = {
  4: { top: 8, bottom: 32, label: 22, entrance: [13,28], board: [25.7,13,18.7,6.6,0], seats: [[57,24],[32,28],[87,26]], queue: [[61,30],[67,30],[73,29],[79,29],[56,30.5],[84,29],[48,30.5],[42,30.5]] },
  3: { top: 32, bottom: 53.5, label: 44, entrance: [13,49], board: [25.7,34.4,18.7,6.2,0], seats: [[36,48.5],[57,49],[82,47],[47,44],[64,44],[30,45],[73,50],[90,48]] },
  2: { top: 53.5, bottom: 75.5, label: 66, entrance: [13,71], board: [25.7,55.2,18.7,5.1,0], seats: [[39,68.5],[68,72],[52,67],[85,68],[33,72],[58,72],[75,68],[91,69],[44,72],[60,68],[29,67],[79,72]] },
  1: { top: 75.5, bottom: 98, label: 88, entrance: [13,93], board: [25.7,76.5,18.7,6,0], seats: [[35,90],[59,94],[81,90],[44,88],[64,88],[50,95],[72,94],[27,94]] },
};
export const timestamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const okay = state => ['ok', 'healthy', 'connected'].includes(state);
export function normalizeSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !Number.isFinite(timestamp(value.observedAt))) return null;
  const result = { ...value, sources: value.sources || {}, strategy: value.strategy || {}, day: value.day || {} };
  for (const key of ['residents', 'sessions', 'events', 'questions', 'repositories', 'projects', 'tasks', 'activity']) result[key] = list(value[key]);
  const residentIds = new Set();
  result.residents = result.residents.filter(r => {
    if (typeof r.id !== 'string' || typeof r.agentId !== 'string' || residentIds.has(r.agentId) || ![1,2,3,4].includes(Number(r.floor)) || !['agent','owner'].includes(r.kind)) return false;
    residentIds.add(r.agentId); return true;
  }).map(r => ({ ...r, floor: Number(r.floor) }));
  result.sessions = result.sessions.filter(s => typeof s.id === 'string' && [1, 2, 3, 4].includes(Number(s.floor))).map(s => ({ ...s, floor: Number(s.floor) }));
  result.questions.sort((a, b) => (timestamp(a.askedAt) || Infinity) - (timestamp(b.askedAt) || Infinity));
  return result;
}
export function mergeSnapshot(previous, next, now = Date.now()) {
  if (!previous) return next;
  const sessions = [...next.sessions];
  for (const session of previous.sessions || []) {
    const source = session.provider === 'codex' ? 'codexSessions' : session.provider === 'openclaw' ? 'openclawSessions' : 'sessions';
    const sourceKey = next.sources?.[source] ? source : 'sessions';
    if (!knownSource(next, sourceKey, now) && !sessions.some(s => s.id === session.id)) sessions.push(session);
  }
  return { ...next, sessions, residents: !knownSource(next, 'residents', now) && !next.residents.length ? previous.residents || [] : next.residents };
}
export function freshness(snapshot, now = Date.now(), session) {
  if (!snapshot) return { live: false, reason: '수집 대기' };
  const provider = session?.provider === 'codex' ? 'codexSessions' : session?.provider === 'openclaw' || session?.resident ? 'openclawSessions' : null;
  const source = (provider && snapshot.sources?.[provider]) || snapshot.sources?.sessions;
  const partial = !session && source?.state === 'partial' && ['openclawSessions', 'codexSessions'].some(key => knownSource(snapshot, key, now));
  if (!okay(source?.state) && !partial) return { live: false, reason: '세션 확인 중' };
  if (session?.resident && (!knownSource(snapshot, 'residents', now) || observationState({ state: 'ok', observedAt: session.residentObservedAt }, now) !== 'ok')) return { live: false, reason: '명단 확인 중' };
  const times = [snapshot.observedAt, source.observedAt, ...(session ? [session.observedAt] : [])].map(timestamp);
  if (times.some(t => !Number.isFinite(t))) return { live: false, reason: '관측 시각 미확인' };
  if (times.some(t => t > now + 60_000)) return { live: false, reason: '관측 시각 확인 중' };
  if (times.some(t => now - t > 720_000)) return { live: false, reason: '새 관측 대기' };
  if (session?.state === 'unknown') return { live: false, reason: '세션 확인 중' };
  return { live: true, partial: !!partial, reason: partial ? '일부 세션 확인 중' : '최근 관측' };
}
export function advanceSnapshot(previous, snapshot, now = Date.now()) {
  const time = timestamp(snapshot?.observedAt);
  // A partially available collection can update known poses, but cannot prove
  // an uninterrupted arrival/departure sequence across providers.
  const continuous = okay(snapshot?.sources?.sessions?.state) && freshness(snapshot, now).live;
  if (!Number.isFinite(time) || (previous && time < previous.time)) return { ledger: previous, events: [] };
  if (previous && time === previous.time) return { ledger: { ...previous, live: previous.live && continuous }, events: [], reset: !previous.live && continuous };
  const seen = new Set(previous?.seen || []);
  const canAnimate = previous && previous.live && continuous && now - previous.time <= 720_000;
  const events = [];
  for (const event of snapshot.events || []) {
    const eventTime = timestamp(event.occurredAt);
    if (canAnimate && event.id && !seen.has(event.id) && eventTime > previous.time && eventTime <= time && ['arrived', 'departed', 'reported'].includes(event.type)) events.push(event);
    if (event.id) seen.add(event.id);
  }
  return { ledger: { time, live: continuous, seen: [...seen].slice(-2000) }, events, reset: !canAnimate };
}
export function sessionVisual(session, now, tick = 0, event) {
  const pressure = session.state === 'blocked' || (session.state === 'working' && now - timestamp(session.startedAt) > 2_400_000);
  const base = { col: 3, row: 2, sweat: pressure, stars: false, label: '확인 중' };
  if (event?.type === 'reported') return { ...base, col: 2, row: 1, stars: true, label: '결과 보고' };
  if (event?.type === 'arrived' || event?.type === 'departed') return { ...base, col: tick % 2, row: 1, label: event.type === 'arrived' ? '출근합니다!' : '퇴근합니다!' };
  if (session.state === 'working' || session.state === 'blocked') return { ...base, col: tick % 4, row: 0, label: session.state === 'blocked' ? '도움 필요' : '작업 중' };
  if (session.state === 'waiting') return { ...base, col: tick % 8 < 6 ? 0 : 1, row: 2, label: '대기 중' };
  if (session.state === 'idle') return { ...base, col: tick % 8 < 6 ? 0 : 1, row: 2, label: '쉬는 중' };
  if (session.state === 'owner') return { ...base, label: '대표 자리' };
  if (session.state === 'reporting') return { ...base, col: 2, row: 1, label: '보고 중' };
  if (session.state === 'ended') return { ...base, label: '종료' };
  return base;
}
export function waitingVisual(question, now, { crouchAfter = 600, sweatAfter = 2400 } = {}) {
  const age = (now - timestamp(question.askedAt)) / 1000;
  return { col: age >= crouchAfter ? 2 : 3, row: age >= crouchAfter ? 2 : 1, sweat: age >= sweatAfter, stars: false, label: '답변 대기' };
}
export function roomIsClosed(snapshot, floor, now) {
  const closed = timestamp(snapshot?.day?.closedAt);
  return ['closing', 'closed'].includes(snapshot?.day?.phase) && Number.isFinite(closed) && closed <= now
    && !(snapshot.sessions || []).some(s => Number(s.floor) === floor && ['working', 'blocked', 'reporting', 'waiting', 'unknown'].includes(s.state))
    && !(snapshot.questions || []).some(q => floor === 4 || (snapshot.sessions || []).some(s => s.id === q.sessionId && Number(s.floor) === floor));
}
export function metricDisplay(metric) {
  if (!metric || metric.value == null || !okay(metric.state) || (typeof metric.value === 'number' && !Number.isFinite(metric.value))) return '—';
  const value = typeof metric.value === 'number' ? new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(metric.value) : String(metric.value);
  return value + (metric.unit === '%' ? '%' : metric.unit ? ` ${metric.unit}` : '');
}
export function safeLink(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
export function elapsed(value, now = Date.now()) {
  const age = now - timestamp(value);
  if (!Number.isFinite(age) || age < -60_000) return '미확인';
  const minutes = Math.max(0, Math.floor(age / 60_000));
  if (minutes < 1) return '방금';
  if (minutes < 60) return `${minutes}분`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}시간 ${minutes % 60}분`;
  return `${Math.floor(minutes / 1440)}일`;
}
export function clockTime(value, zone) {
  const time = timestamp(value);
  if (!Number.isFinite(time)) return '미수집';
  try { return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: zone || 'Asia/Seoul' }).format(time); } catch { return new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Seoul' }).format(time); }
}
export function sourceLabel(state) {
  return ({ ok: '연결됨', healthy: '연결됨', connected: '연결됨', error: '수집 오류', unavailable: '미연결', unknown: '미확인', stale: '오래된 관측', unconfigured: '미연결', missing: '미연결' })[state] || '미연결';
}

// Each session owns its queue. A finished session remains available until its
// final departure has been shown; the queue never invents a missing session.
export function enqueueSessionEvents(previous, incoming, sessions) {
  const queue = previous.map(entry => ({ ...entry, events: [...entry.events] }));
  const order = { arrived: 0, reported: 1, departed: 2 };
  for (const event of [...incoming].sort((a, b) => timestamp(a.occurredAt) - timestamp(b.occurredAt) || order[a.type] - order[b.type])) {
    if (!event.id || !event.sessionId || !(event.type in order)) continue;
    let entry = queue.find(item => item.session.id === event.sessionId);
    const session = sessions.find(item => item.id === event.sessionId) || entry?.session;
    if (!session) continue;
    if (!entry) { entry = { session, events: [], ticks: 0 }; queue.push(entry); }
    if (!entry.events.some(item => item.id === event.id)) entry.events.push(event);
    entry.session = session;
  }
  return queue;
}
export function advanceSessionEvents(queue, snapshot, now, live) {
  if (!live) return queue;
  return queue.flatMap(entry => {
    if (!freshness(snapshot, now, entry.session).live) return [entry];
    if (entry.ticks + 1 < 6) return [{ ...entry, ticks: entry.ticks + 1 }];
    return entry.events.length > 1 ? [{ ...entry, ticks: 0, events: entry.events.slice(1) }] : [];
  });
}
export function sceneSessions(sessions, queue, floor) {
  const combined = [...sessions, ...queue.map(entry => entry.session).filter(session => !sessions.some(item => item.id === session.id))];
  return combined.filter(session => session.floor === floor && (session.state !== 'ended' || queue.some(entry => entry.session.id === session.id)));
}
// Membership is independent of activity: a resident keeps their place when a
// turn ends. A real primary session animates that person; children stay separate.
export function officeActors(snapshot, eventQueue = []) {
  const sessions = [...(snapshot.sessions || []), ...eventQueue.map(entry => entry.session).filter(s => !(snapshot.sessions || []).some(item => item.id === s.id))];
  const queued = new Set(eventQueue.map(entry => entry.session.id));
  const available = sessions.filter(s => s.state !== 'ended' || queued.has(s.id));
  const bound = new Set();
  const rank = ['owner','hj','main','taxops','marketing','design','genie','red'];
  const residents = [...(snapshot.residents || [])].sort((a,b) => rank.indexOf(a.agentId) - rank.indexOf(b.agentId)).map(resident => {
    const primary = resident.kind !== 'owner' && available.filter(s => !s.parentId && s.agentId === resident.agentId && s.provider !== 'codex')
      .sort((a,b) => Number(a.state === 'ended') - Number(b.state === 'ended') || (timestamp(b.startedAt) || 0) - (timestamp(a.startedAt) || 0))[0];
    if (primary) bound.add(primary.id);
    return {
      ...primary, ...resident, resident: true, sessionId: primary?.id || null, provider: 'openclaw',
      residentObservedAt: resident.observedAt,
      observedAt: primary?.observedAt || snapshot.sources?.openclawSessions?.observedAt || snapshot.sources?.sessions?.observedAt,
      state: resident.kind === 'owner' ? 'owner' : primary && primary.state !== 'ended' ? primary.state : 'idle',
    };
  });
  return [...residents, ...available.filter(s => !bound.has(s.id)).map(s => ({ ...s, sessionId: s.id }))];
}
export function actorEvent(actor, eventQueue = []) {
  const event = eventQueue.find(entry => entry.session.id === (actor.sessionId || actor.id))?.events[0];
  return actor.resident && event?.type !== 'reported' ? undefined : event;
}
export function runtimeSessionCounts(snapshot, now, sessions = snapshot.sessions || []) {
  const candidates = sessions.filter(s => !['idle', 'owner', 'ended'].includes(s.state));
  const verified = candidates.filter(s => ['working', 'blocked', 'reporting', 'waiting'].includes(s.state) && freshness(snapshot, now, s).live);
  return {
    verifiedSessionCount: verified.length,
    unknownSessionCount: candidates.length - verified.length,
    workingCount: verified.filter(s => ['working', 'blocked', 'reporting'].includes(s.state)).length,
    blockedCount: verified.filter(s => s.state === 'blocked').length,
  };
}
export function floorOccupancy(snapshot, eventQueue, floor, now = Date.now()) {
  const actors = officeActors(snapshot, eventQueue);
  const questions = snapshot.questions || [];
  const waiting = [];
  const questioners = new Set();
  for (const question of questions) {
    const session = actors.find(item => item.sessionId === question.sessionId || item.id === question.sessionId);
    if (!session || questioners.has(session.id) || (session.state === 'ended' && !eventQueue.some(entry => entry.session.id === session.id))) continue;
    questioners.add(session.id);
    if (floor === 4) waiting.push({ session, question });
  }
  const seated = actors.filter(session => Number(session.floor) === floor && !questioners.has(session.id));
  const sessions = [...seated, ...waiting.map(item => item.session)];
  const counts = runtimeSessionCounts(snapshot, now, sessions.filter(s => s.sessionId));
  return { seated, waiting, sessions, count: sessions.length, ...counts,
    residentCount: sessions.filter(s => s.resident && s.kind !== 'owner').length,
    ownerCount: sessions.filter(s => s.kind === 'owner').length,
    sessionCount: counts.verifiedSessionCount,
  };
}
export function observationState(record, now = Date.now()) {
  if (!record || !okay(record.state)) return record?.state || 'unknown';
  const observed = timestamp(record.observedAt);
  if (!Number.isFinite(observed) || observed > now + 60_000) return 'unknown';
  return now - observed > 720_000 ? 'stale' : record.state;
}
export function knownSource(data, source, now = Date.now()) {
  return okay(observationState({ state: 'ok', observedAt: data.observedAt }, now))
    && okay(observationState(data.sources?.[source], now));
}
export function metricObservation(metric, source, now = Date.now()) {
  if (!metric) return { state: 'unknown', value: null };
  const ownState = observationState(metric, now);
  const sourceState = observationState(source, now);
  return { ...metric, state: okay(ownState) ? sourceState : ownState };
}
export function nextRoomLighting(previous, closed, hasFreshEvidence) {
  if (!hasFreshEvidence) return previous || { closed: false, sequence: false };
  if (!previous) return { closed, sequence: false };
  if (previous.closed === closed) return previous;
  return { closed, sequence: closed };
}
