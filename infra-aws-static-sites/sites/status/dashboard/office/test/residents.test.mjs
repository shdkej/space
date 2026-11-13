import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSnapshot, mergeSnapshot, advanceSnapshot, floorOccupancy, freshness, roomIsClosed, actorEvent } from '../src/model.js';

const now = Date.parse('2026-11-11T21:00:00Z');
const observedAt = new Date(now).toISOString();
const ok = { state: 'ok', observedAt };
const resident = (id, floor = 1) => ({ id: `resident:${id}`, agentId: id, name: id, kind: 'agent', floor, observedAt });
const session = (id, agentId = 'genie', extra = {}) => ({ id, agentId, name: agentId, provider: 'openclaw', floor: 1, state: 'working', observedAt, startedAt: observedAt, ...extra });
const snapshot = (extra = {}) => normalizeSnapshot({ schemaVersion: 1, observedAt, residents: [resident('genie'), resident('red')], sessions: [], sources: { residents: ok, sessions: ok, openclawSessions: ok, codexSessions: ok }, ...extra });

test('registered people remain in their room with no running sessions', () => {
  const data = snapshot();
  const room = floorOccupancy(data, [], 1, now);
  assert.equal(room.count, 2);
  assert.equal(room.residentCount, 2);
  assert.equal(room.sessionCount, 0);
  assert.ok(room.seated.every(actor => actor.state === 'idle'));
  assert.ok(room.seated.every(actor => freshness(data, now, actor).live));
});

test('primary session binds to its resident; concurrent and child sessions remain separate', () => {
  const data = snapshot({ sessions: [session('primary'), session('child', 'genie', { parentId: 'primary' }), session('concurrent')] });
  const room = floorOccupancy(data, [], 1, now);
  assert.equal(room.count, 4);
  assert.equal(room.sessionCount, 3);
  assert.equal(room.seated.find(s => s.id === 'resident:genie').sessionId, 'primary');
  assert.equal(room.seated.filter(s => s.id === 'primary').length, 0);
  assert.ok(room.seated.some(s => s.id === 'child'));
});

test('questioning resident moves once to the owner queue and returns after resolution', () => {
  const data = snapshot({ sessions: [session('primary')], questions: [{ id: 'q', sessionId: 'primary', askedAt: observedAt }] });
  assert.equal(floorOccupancy(data, [], 1, now).count, 1);
  assert.equal(floorOccupancy(data, [], 4, now).waiting[0].session.id, 'resident:genie');
  data.questions = [];
  assert.equal(floorOccupancy(data, [], 1, now).count, 2);
});

test('ended work never removes the resident or counts an idle resident as a running session', () => {
  const data = snapshot({ sessions: [session('finished', 'genie', { state: 'ended' })] });
  const room = floorOccupancy(data, [], 1, now);
  assert.equal(room.count, 2);
  assert.equal(room.sessionCount, 0);
  assert.equal(room.seated[0].state, 'idle');
  data.day = { phase: 'closed', closedAt: observedAt };
  assert.equal(roomIsClosed(data, 1, now), true);
});

test('stale roster and unavailable activity freeze people without removing them', () => {
  const data = snapshot();
  assert.equal(floorOccupancy(data, [], 1, now).count, 2);
  assert.equal(freshness(data, now + 721_000, floorOccupancy(data, [], 1, now).seated[0]).live, false);
  data.sources.openclawSessions = { state: 'unknown', observedAt };
  assert.equal(freshness(data, now, floorOccupancy(data, [], 1, now).seated[0]).live, false);
  assert.equal(floorOccupancy(data, [], 1, now).count, 2);
});

test('partial collection preserves known Codex activity and freezes the failed provider', () => {
  const data = snapshot({ sessions: [session('codex:one', 'codex', { provider: 'codex' })] });
  data.sources.sessions = { ...ok, state: 'partial' };
  data.sources.openclawSessions = { ...ok, state: 'unknown' };
  assert.equal(freshness(data, now).live, true);
  assert.equal(freshness(data, now, floorOccupancy(data, [], 1, now).seated.find(s => s.id === 'codex:one')).live, true);
  assert.equal(freshness(data, now, floorOccupancy(data, [], 1, now).seated.find(s => s.id === 'resident:genie')).live, false);
});

test('owner place has no invented AI session or live working state', () => {
  const data = snapshot({ residents: [{ ...resident('owner', 4), kind: 'owner' }] });
  const room = floorOccupancy(data, [], 4, now);
  assert.equal(room.count, 1);
  assert.equal(room.ownerCount, 1);
  assert.equal(room.residentCount, 0);
  assert.equal(room.sessionCount, 0);
  assert.equal(room.seated[0].state, 'owner');
});

test('failed provider and roster retain last people without refreshing their evidence', () => {
  const previous = snapshot({ sessions: [session('codex:old','codex',{provider:'codex'})] });
  const next = snapshot({ residents: [], sessions: [session('new')], sources: { residents: {...ok,state:'unknown'}, sessions:{...ok,state:'partial'}, openclawSessions:ok, codexSessions:{...ok,state:'unknown'} } });
  const merged = mergeSnapshot(previous,next,now);
  assert.equal(merged.residents.length,2);
  assert.equal(merged.sessions.length,2);
  const actor = floorOccupancy(merged,[],1,now).sessions.find(s=>s.id==='codex:old');
  assert.equal(actor.observedAt,observedAt);
  assert.equal(freshness(merged,now,actor).live,false);
  assert.equal(mergeSnapshot(merged,snapshot(),now).sessions.length,0,'a successful empty query clears the old activity');
});

test('a resident can report a result but never walks out after their task ends', () => {
  const data=snapshot({ sessions:[session('finished','genie',{state:'ended'})] });
  const queue=[{session:data.sessions[0],events:[{type:'departed',sessionId:'finished'}]}];
  const actor=floorOccupancy(data,queue,1,now).sessions.find(s=>s.agentId==='genie');
  assert.equal(actor.id,'resident:genie');
  assert.equal(actor.state,'idle');
  assert.equal(actorEvent(actor,queue),undefined);
  queue[0].events=[{type:'reported',sessionId:'finished'}];
  assert.equal(actorEvent(actor,queue).type,'reported');
});

test('partial provider recovery never replays old lifecycle events', () => {
  const first=advanceSnapshot(null,snapshot(),now);
  const next=snapshot({ observedAt:new Date(now+1000).toISOString() });
  next.sources.sessions.state='partial';
  next.events=[{id:'arrival',sessionId:'one',type:'arrived',occurredAt:next.observedAt}];
  const partial=advanceSnapshot(first.ledger,next,now+1000);
  assert.equal(partial.events.length,0);
  assert.equal(partial.reset,true);
  next.sources.sessions.state='ok';
  next.observedAt=new Date(now+2000).toISOString();
  assert.equal(advanceSnapshot(partial.ledger,next,now+2000).events.length,0);
});


test('partial failure preserves people but excludes unverified old working rows from current counts', () => {
  const previous = snapshot({ sessions: [session('codex:old', 'codex', { provider: 'codex' })] });
  const next = snapshot({ sources: { residents: ok, sessions: { ...ok, state: 'partial' }, openclawSessions: ok, codexSessions: { ...ok, state: 'unknown' } } });
  const merged = mergeSnapshot(previous, next, now);
  const room = floorOccupancy(merged, [], 1, now);
  assert.equal(room.count, 3, 'two residents and the preserved Codex person stay visible');
  assert.equal(room.residentCount, 2);
  assert.equal(room.sessionCount, 0);
  assert.equal(room.verifiedSessionCount, 0);
  assert.equal(room.unknownSessionCount, 1);
  assert.equal(merged.sessions.length, 1);
});

test('current room counts use the caller time and separate explicit unknown states', () => {
  const data = snapshot({ sessions: [session('known'), session('unknown', 'red', { state: 'unknown' })] });
  const fresh = floorOccupancy(data, [], 1, now);
  assert.equal(fresh.verifiedSessionCount, 1);
  assert.equal(fresh.unknownSessionCount, 1);
  const stale = floorOccupancy(data, [], 1, now + 721_000);
  assert.equal(stale.verifiedSessionCount, 0);
  assert.equal(stale.unknownSessionCount, 2);
  assert.equal(stale.count, fresh.count);
});
