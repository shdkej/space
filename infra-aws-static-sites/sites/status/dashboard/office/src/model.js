export const FLOORS = [
  { id: 4, name: '대표실', english: 'THE OWNER', leader: '사용자', description: '다음 방향을 결정하는 곳', board: '결정 대기', short: 'Decide' },
  { id: 3, name: '비즈니스실', english: 'BUSINESS', leader: '샘 · SAM', description: '할 일보다, 해야 할 이유를 선명하게', board: '전략 · 가치 · 가설', short: 'Think' },
  { id: 2, name: '고객실', english: 'CUSTOMER', leader: '세스고딘 · CMO', description: '만드는 것과 필요한 것 사이', board: '고객의 여정', short: 'Listen' },
  { id: 1, name: '제품실', english: 'PRODUCT', leader: '지니', description: '생각을 제품으로, 제품을 일상으로', board: '세 시스템의 오늘', short: 'Make' },
];
export const STAGES = [
  ['acquisition', '유입', 'Acquisition'], ['activation', '활성화', 'Activation'],
  ['retention', '재방문', 'Retention'], ['revenue', '매출', 'Revenue'], ['referral', '추천', 'Referral'],
];
export const timestamp = value => typeof value === 'string' ? Date.parse(value) : NaN;
const list = value => Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
const okay = state => ['ok', 'healthy', 'connected'].includes(state);
export function normalizeSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || !Number.isFinite(timestamp(value.observedAt))) return null;
  const result = { ...value, sources: value.sources || {}, strategy: value.strategy || {}, day: value.day || {} };
  for (const key of ['sessions', 'events', 'questions', 'repositories', 'projects', 'tasks', 'activity']) result[key] = list(value[key]);
  result.sessions = result.sessions.filter(s => typeof s.id === 'string' && [1, 2, 3, 4].includes(Number(s.floor))).map(s => ({ ...s, floor: Number(s.floor) }));
  result.questions.sort((a, b) => (timestamp(a.askedAt) || Infinity) - (timestamp(b.askedAt) || Infinity));
  return result;
}
export function freshness(snapshot, now = Date.now(), session) {
  if (!snapshot) return { live: false, reason: '수집 대기' };
  const source = snapshot.sources?.sessions;
  if (!okay(source?.state)) return { live: false, reason: '세션 확인 중' };
  const times = [snapshot.observedAt, source.observedAt, ...(session ? [session.observedAt] : [])].map(timestamp);
  if (times.some(t => !Number.isFinite(t))) return { live: false, reason: '관측 시각 미확인' };
  if (times.some(t => t > now + 60_000)) return { live: false, reason: '관측 시각 확인 중' };
  if (times.some(t => now - t > 720_000)) return { live: false, reason: '새 관측 대기' };
  if (session?.state === 'unknown') return { live: false, reason: '세션 확인 중' };
  return { live: true, reason: '최근 관측' };
}
export function advanceSnapshot(previous, snapshot, now = Date.now()) {
  const time = timestamp(snapshot?.observedAt);
  if (!Number.isFinite(time) || (previous && time < previous.time)) return { ledger: previous, events: [] };
  if (previous && time === previous.time) return { ledger: { ...previous, live: previous.live && freshness(snapshot, now).live }, events: [], reset: !previous.live && freshness(snapshot, now).live };
  const seen = new Set(previous?.seen || []);
  const canAnimate = previous && previous.live && freshness(snapshot, now).live && now - previous.time <= 720_000;
  const events = [];
  for (const event of snapshot.events || []) {
    const eventTime = timestamp(event.occurredAt);
    if (canAnimate && event.id && !seen.has(event.id) && eventTime > previous.time && eventTime <= time && ['arrived', 'departed', 'reported'].includes(event.type)) events.push(event);
    if (event.id) seen.add(event.id);
  }
  return { ledger: { time, live: freshness(snapshot, now).live, seen: [...seen].slice(-2000) }, events, reset: !canAnimate };
}
export function sessionVisual(session, now, tick = 0, event) {
  const pressure = session.state === 'blocked' || (session.state === 'working' && now - timestamp(session.startedAt) > 2_400_000);
  const base = { col: 3, row: 2, sweat: pressure, stars: false, label: '확인 중' };
  if (event?.type === 'reported') return { ...base, col: 2, row: 1, stars: true, label: '결과 보고' };
  if (event?.type === 'arrived' || event?.type === 'departed') return { ...base, col: tick % 2, row: 1, label: event.type === 'arrived' ? '출근합니다!' : '퇴근합니다!' };
  if (session.state === 'working' || session.state === 'blocked') return { ...base, col: tick % 4, row: 0, label: session.state === 'blocked' ? '도움 필요' : '작업 중' };
  if (session.state === 'waiting') return { ...base, col: tick % 8 < 6 ? 0 : 1, row: 2, label: '대기 중' };
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
