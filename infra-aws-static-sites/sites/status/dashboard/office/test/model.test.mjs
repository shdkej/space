import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot, freshness, advanceSnapshot, sessionVisual, waitingVisual, roomIsClosed, metricDisplay, safeLink } from '../src/model.js';

const now = Date.parse('2026-11-11T12:00:00Z');
const iso = offset => new Date(now + offset * 1000).toISOString();
const snapshot = (patch = {}) => ({ schemaVersion: 1, observedAt: iso(0), cadenceSeconds: 600, staleAfterSeconds: 720, sources: { sessions: { state: 'ok', observedAt: iso(0) } }, sessions: [], events: [], questions: [], repositories: [], projects: [], strategy: {}, tasks: [], day: {}, activity: [], ...patch });

test('missing or malformed feeds never become an empty healthy office', () => {
  assert.equal(normalizeSnapshot(null), null);
  assert.equal(normalizeSnapshot({ schemaVersion: 2 }), null);
  assert.equal(normalizeSnapshot(snapshot({ sessions: null })).sessions.length, 0);
  assert.equal(freshness(null, now).live, false);
});

test('freshness uses session evidence, never newer metrics or a successful HTTP response', () => {
  assert.equal(freshness(snapshot(), now).live, true);
  assert.equal(freshness(snapshot({ observedAt: iso(-721) }), now).live, false);
  assert.equal(freshness(snapshot({ sources: { sessions: { state: 'error', observedAt: iso(0) } } }), now).live, false);
  assert.equal(freshness(snapshot({ sources: { sessions: { state: 'ok', observedAt: iso(-721) } } }), now).live, false);
  assert.equal(freshness(snapshot({ sources: {} }), now).live, false);
  assert.equal(freshness(snapshot({ observedAt: iso(61) }), now).live, false);
  assert.equal(freshness(snapshot(), now, { observedAt: iso(-721) }).live, false);
});

test('first connection and duplicate snapshots do not replay historical arrivals', () => {
  const first = snapshot({ events: [{ id: 'a', type: 'arrived', occurredAt: iso(-20), sessionId: 's' }] });
  const initial = advanceSnapshot(null, first, now);
  assert.deepEqual(initial.events, []);
  assert.deepEqual(advanceSnapshot(initial.ledger, first, now).events, []);
  const next = snapshot({ observedAt: iso(600), sources: { sessions: { state: 'ok', observedAt: iso(600) } }, events: [...first.events, { id: 'b', type: 'arrived', sessionId: 't', occurredAt: iso(550) }] });
  const update = advanceSnapshot(initial.ledger, next, now + 600_000);
  assert.deepEqual(update.events.map(e => e.id), ['b']);
  assert.deepEqual(advanceSnapshot(update.ledger, next, now + 600_000).events, []);
});

test('stale recovery and out-of-order snapshots never replay a backlog', () => {
  const initial = advanceSnapshot(null, snapshot(), now);
  const next = snapshot({ observedAt: iso(1800), sources: { sessions: { state: 'ok', observedAt: iso(1800) } }, events: [{ id: 'b', type: 'reported', occurredAt: iso(1700) }] });
  assert.deepEqual(advanceSnapshot(initial.ledger, next, now + 1_800_000).events, []);
  assert.deepEqual(advanceSnapshot(initial.ledger, snapshot({ observedAt: iso(-600) }), now).events, []);
});

test('disappearing sessions never synthesize a departure; source errors suppress new events', () => {
  const initial = advanceSnapshot(null, snapshot({ sessions: [{ id: 's' }] }), now);
  const next = snapshot({ observedAt: iso(600), sources: { sessions: { state: 'error', observedAt: iso(600) } }, events: [{ id: 'b', type: 'departed', occurredAt: iso(550), sessionId: 's' }] });
  assert.deepEqual(advanceSnapshot(initial.ledger, next, now + 600_000).events, []);
  assert.deepEqual(advanceSnapshot(initial.ledger, snapshot({ observedAt: iso(600) }), now + 600_000).events, []);
});

test('sprites expose working, elapsed pressure and waiting without celebrating state alone', () => {
  assert.deepEqual(sessionVisual({ state: 'working', startedAt: iso(-2401) }, now, 2), { col: 2, row: 0, sweat: true, stars: false, label: '작업 중' });
  assert.equal(sessionVisual({ state: 'blocked' }, now, 1).sweat, true);
  assert.equal(sessionVisual({ state: 'reporting' }, now, 1).stars, false);
  assert.equal(sessionVisual({ state: 'reporting' }, now, 1, { type: 'reported' }).stars, true);
  assert.equal(sessionVisual({ state: 'waiting', startedAt: iso(-900) }, now, 1).row, 2);
  assert.equal(sessionVisual({ state: 'unknown' }, now, 1).label, '확인 중');
});

test('owner waiting posture is derived from question time and configurable thresholds', () => {
  assert.equal(waitingVisual({ askedAt: iso(-500) }, now).col, 3);
  assert.equal(waitingVisual({ askedAt: iso(-601) }, now).col, 2);
  assert.equal(waitingVisual({ askedAt: iso(-2401) }, now).sweat, true);
  assert.equal(waitingVisual({ askedAt: iso(-601) }, now, { crouchAfter: 1200, sweatAfter: 2400 }).col, 3);
});

test('closing requires evidence and preserves rooms with active work or pending questions', () => {
  const closing = snapshot({ day: { phase: 'closing', closedAt: iso(-10) } });
  assert.equal(roomIsClosed(closing, 1, now), true);
  assert.equal(roomIsClosed(snapshot({ day: { phase: 'closing' } }), 1, now), false);
  assert.equal(roomIsClosed({ ...closing, sessions: [{ floor: 1, state: 'working' }] }, 1, now), false);
  assert.equal(roomIsClosed({ ...closing, questions: [{ id: 'q' }] }, 4, now), false);
});

test('zero is measured, missing metrics remain unavailable, and executable links are rejected', () => {
  assert.equal(metricDisplay({ value: 0, state: 'ok', unit: '%' }), '0%');
  assert.equal(metricDisplay({ value: null, state: 'ok' }), '—');
  assert.equal(metricDisplay({ value: 100, state: 'error' }), '—');
  assert.equal(safeLink('javascript:alert(1)'), null);
  assert.equal(safeLink('https://example.com/task'), 'https://example.com/task');
});

test('a repeated snapshot with failed source invalidates animation continuity', () => {
  const initial = advanceSnapshot(null, snapshot(), now);
  const failed = advanceSnapshot(initial.ledger, snapshot({ sources: { sessions: { state: 'error', observedAt: iso(0) } } }), now + 30_000);
  const recovered = snapshot({ observedAt: iso(600), sources: { sessions: { state: 'ok', observedAt: iso(600) } }, events: [{ id: 'report', type: 'reported', occurredAt: iso(550) }] });
  assert.deepEqual(advanceSnapshot(failed.ledger, recovered, now + 600_000).events, []);
});

test('closed rooms keep a light on for waiting sessions', () => {
  const closed = snapshot({ day: { phase: 'closed', closedAt: iso(-10) } });
  assert.equal(roomIsClosed(closed, 1, now), true);
  assert.equal(roomIsClosed({ ...closed, sessions: [{ floor: 1, state: 'waiting' }] }, 1, now), false);
});

test('observed reporting uses its pose without replaying a celebration', () => {
  const visual = sessionVisual({ state: 'reporting' }, now, 0);
  assert.equal(visual.col, 2);
  assert.equal(visual.row, 1);
  assert.equal(visual.stars, false);
});

test('all events in a short session are consumed in order before its ended character is removed', async () => {
  const { enqueueSessionEvents, advanceSessionEvents, sceneSessions } = await import('../src/model.js');
  const ended = { id: 'short', name: '짧은 작업', floor: 1, state: 'ended', observedAt: iso(0) };
  const feed = snapshot({ sessions: [ended] });
  const events = [
    { id: 'bye', sessionId: 'short', type: 'departed', occurredAt: iso(-10) },
    { id: 'hello', sessionId: 'short', type: 'arrived', occurredAt: iso(-50) },
    { id: 'report', sessionId: 'short', type: 'reported', occurredAt: iso(-20) },
  ];
  let queue = enqueueSessionEvents([], events, [ended]);
  assert.equal(queue.length, 1);
  for (const type of ['arrived', 'reported', 'departed']) {
    assert.equal(queue[0].events[0].type, type);
    assert.deepEqual(sceneSessions([], queue, 1).map(s => s.id), ['short']);
    for (let i = 0; i < 6; i++) queue = advanceSessionEvents(queue, feed, now, true);
  }
  assert.deepEqual(queue, []);
  assert.deepEqual(sceneSessions([ended], queue, 1), []);
});

test('event queues freeze with their source and do not duplicate queued events', async () => {
  const { enqueueSessionEvents, advanceSessionEvents } = await import('../src/model.js');
  const session = { id: 's', floor: 1, state: 'working', observedAt: iso(0) };
  const event = { id: 'a', sessionId: 's', type: 'arrived', occurredAt: iso(-20) };
  const queue = enqueueSessionEvents([], [event], [session]);
  assert.equal(queue.length, 1);
  assert.equal(enqueueSessionEvents(queue, [event], [session])[0].events.length, 1);
  assert.deepEqual(advanceSessionEvents(queue, snapshot(), now, false), queue);
  assert.deepEqual(advanceSessionEvents(queue, snapshot({ sources: { sessions: { state: 'error' } } }), now, true), queue);
  assert.deepEqual(enqueueSessionEvents([], [event], []), []);
});

test('reconnect explicitly resets a pending queue rather than resuming its historical events', () => {
  const initial = advanceSnapshot(null, snapshot(), now);
  const recovered = advanceSnapshot({ ...initial.ledger, live: false }, snapshot({ observedAt: iso(600), sources: { sessions: { state: 'ok', observedAt: iso(600) } } }), now + 600_000);
  assert.equal(recovered.reset, true);
  assert.deepEqual(recovered.events, []);
});

test('ok task and metric sources become unknown when evidence is missing, stale or in the future', async () => {
  const { knownSource, observationState, metricObservation } = await import('../src/model.js');
  assert.equal(knownSource(snapshot({ sources: { tasks: { state: 'ok', observedAt: iso(-721) } } }), 'tasks', now), false);
  assert.equal(knownSource(snapshot({ sources: { tasks: { state: 'ok', observedAt: iso(-720) } } }), 'tasks', now), true);
  assert.equal(knownSource(snapshot({ sources: { tasks: { state: 'ok' } } }), 'tasks', now), false);
  assert.equal(observationState({ state: 'ok', observedAt: iso(61) }, now), 'unknown');
  assert.equal(observationState({ state: 'ok', observedAt: iso(-721) }, now), 'stale');
  assert.equal(metricObservation({ state: 'ok', value: 0, observedAt: iso(-721) }, { state: 'ok', observedAt: iso(0) }, now).state, 'stale');
  assert.equal(metricObservation({ state: 'ok', value: 0, observedAt: iso(0) }, { state: 'ok', observedAt: iso(-721) }, now).state, 'stale');
});

test('reconnecting to the same snapshot discards the old in-flight queue', () => {
  const baseline = advanceSnapshot(null, snapshot(), now);
  const reconnected = advanceSnapshot({ ...baseline.ledger, live: false }, snapshot(), now + 30_000);
  assert.equal(reconnected.reset, true);
  assert.deepEqual(reconnected.events, []);
});

test('room lighting animates only a newly observed open-to-closed transition', async () => {
  const { nextRoomLighting } = await import('../src/model.js');
  assert.deepEqual(nextRoomLighting(undefined, true, true), { closed: true, sequence: false });
  const open = nextRoomLighting(undefined, false, true);
  const closing = nextRoomLighting(open, true, true);
  assert.deepEqual(closing, { closed: true, sequence: true });
  assert.deepEqual(nextRoomLighting(closing, false, false), closing);
  assert.deepEqual(nextRoomLighting(closing, false, true), { closed: false, sequence: false });
});
