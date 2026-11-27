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
  return {load, state, events, localStorage};
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
  assert.deepEqual(events.filter(e => e.event !== 'pmf_core_completed').map(e => e.event), ['first_session_started', 'first_session_activated']);
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
  assert.equal(events.filter(e => e.event !== 'pmf_core_completed').length, 1);
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

test('core completions share a 30-day identity across visits, with consent and QA boundaries', async () => {
  const b = browser(); b.state.accepted = true;
  await b.load('?qa=1&ref=share').enter();
  await b.load('').complete();
  b.state.now += 2 * 86400000;
  await b.load('').complete();
  const core = b.events.filter(e => e.event === 'pmf_core_completed');
  assert.equal(core.length, 2);
  assert.equal(core[0].distinct_id, b.events[0].distinct_id);
  assert.equal(core[1].distinct_id, core[0].distinct_id);
  assert.equal(b.events[0].properties.pmf_identity_version, 1);
  assert.ok(core.every(e => e.properties.traffic_kind === 'synthetic'));
  assert.equal(b.events.filter(e => e.event === 'first_session_started').length, 1);
  b.state.accepted = false;
  const before = b.events.length;
  const tracker = b.load(''); tracker.clear(); await tracker.complete();
  assert.equal(b.events.length, before);
  assert.equal(b.localStorage.getItem('policycock.pmf.v1.qa'), null);
});
test('expired identities rotate without declaring another first visit', async () => {
  const b = browser(); b.state.accepted = true;
  await b.load('').complete();
  const id = b.events[0].distinct_id;
  b.state.now += 31 * 86400000;
  await b.load('').complete();
  assert.notEqual(b.events.at(-1).distinct_id, id);
  assert.equal(b.events.filter(e => e.event === 'first_session_started').length, 1);
});
test('core retry preserves UUID and time and legacy browsers do not become new cohorts', async () => {
  const b = browser(); b.state.accepted = true; b.state.returning = true; b.state.networkOk = false;
  await b.load('').complete();
  b.state.networkOk = true; b.state.now += 1000;
  await b.load('').enter();
  assert.equal(b.events.length, 2);
  assert.equal(b.events[0].event, 'pmf_core_completed');
  assert.equal(b.events[0].uuid, b.events[1].uuid);
  assert.equal(b.events[0].timestamp, b.events[1].timestamp);
});
