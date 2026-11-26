const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const code = fs.readFileSync(path.join(__dirname, '../dist/first-visit.js'), 'utf8');

function browser() {
  const makeStorage = () => {
    const map = new Map();
    return {getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k)};
  };
  const localStorage = makeStorage();
  const sessionStorage = makeStorage();
  const events = [];
  let lock = Promise.resolve();
  const state = {now: 1800000000000, accepted: false, networkOk: true, returning: false};
  const load = query => {
    const window = {addEventListener() {}};
    vm.runInNewContext(code, {
      window, location: {search: query}, localStorage, sessionStorage,
      URLSearchParams, crypto, AbortSignal, Date: class extends Date { static now() { return state.now; } },
      navigator: {locks: {request(_key, action) { lock = lock.then(action, action); return lock; }}},
      fetch: async (_url, init) => { events.push(JSON.parse(init.body)); return {ok: state.networkOk}; },
    });
    return window.createFirstVisitTracker({app: 'policycock', key: 'phc_Test',
      allowed: () => state.accepted, knownReturning: () => state.returning});
  };
  return {load, state, events};
}
test('only consented new browsers enter once; share source and QA survive reload without repeating the action', async () => {
  const {load, state, events} = browser();
  const first = load('?qa=1&ref=share&private=test');
  await first.enter();
  assert.deepEqual(events, []);
  state.accepted = true;
  await first.enter();
  const next = load('');
  await Promise.all([next.enter(), next.complete(), first.complete()]);
  assert.deepEqual(events.map(e => e.event), ['first_session_started', 'first_session_activated']);
  assert.equal(events[0].distinct_id, events[1].distinct_id);
  for (const e of events) {
    assert.equal(e.properties.traffic_kind, 'synthetic');
    assert.equal(e.properties.referral_source, 'share');
    assert.doesNotMatch(JSON.stringify(e), /private=test/);
  }
});
test('a returning browser cannot become a new referral and late completion is excluded', async () => {
  const {load, state, events} = browser();
  state.accepted = true;
  await load('').enter();
  state.now += 30 * 60 * 1000;
  await load('?ref=share').complete();
  await load('?ref=share').enter();
  assert.equal(events.length, 1);
  assert.equal(events[0].properties.referral_source, 'other');
});
test('network retry uses the original UUID and timestamp; a known prior browser is excluded', async () => {
  const a = browser();
  a.state.accepted = true;
  a.state.networkOk = false;
  await a.load('').enter();
  a.state.networkOk = true;
  a.state.now += 5000;
  await a.load('?ref=share').enter();
  assert.equal(a.events[1].uuid, a.events[0].uuid);
  assert.equal(a.events[1].timestamp, a.events[0].timestamp);
  assert.equal(a.events[1].properties.referral_source, 'other');
  const b = browser(); b.state.accepted = true; b.state.returning = true;
  await b.load('?ref=share').enter();
  assert.deepEqual(b.events, []);
});
