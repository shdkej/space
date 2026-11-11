import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { normalizeSnapshot, mergeSnapshot } from '../src/model.js';

let server;
let components;
const now = Date.parse('2026-11-11T12:00:00Z');
const at = offset => new Date(now + offset * 1000).toISOString();
const data = (overrides = {}) => ({ observedAt: at(0), sessions: [], projects: [], questions: [], tasks: [], strategy: {}, day: { timeZone: 'UTC' }, sources: {}, ...overrides });
before(async () => {
  server = await createServer({ configFile: new URL('../../vite.office.config.js', import.meta.url).pathname, server: { middlewareMode: true }, optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom', logLevel: 'error' });
  components = await server.ssrLoadModule('/src/main.jsx');
});
after(async () => { await server?.close(); });

test('a stale successful tasks source cannot render a confirmed empty decision queue', () => {
  const props = { data: data({ sources: { tasks: { state: 'ok', observedAt: at(-721) } } }), now, thresholds: { crouchAfter: 600, sweatAfter: 2400 }, setThresholds() {} };
  const html = renderToStaticMarkup(createElement(components.Owner, props));
  assert.match(html, /결정 대기열 확인 중/);
  assert.doesNotMatch(html, /지금은 비어 있어요|확인된 결정 대기 항목이 없습니다/);
  assert.match(html, /class="count">—</);
});

test('each AARRR stage renders its own observation time and stale state, independent of project max time', () => {
  const project = { id: 'test', name: 'Test', observedAt: at(0), metrics: [
    { stage: 'acquisition', value: 0, state: 'ok', observedAt: at(-30), window: '7일' },
    { stage: 'retention', value: 42, state: 'ok', observedAt: at(-800), window: '7일' },
  ] };
  const html = renderToStaticMarkup(createElement(components.Metrics, { data: data({ projects: [project], sources: { metrics: { state: 'ok', observedAt: at(0) } } }), project, now, setProject() {} }));
  assert.match(html, /dateTime="2026-11-11T11:59:30.000Z"/i);
  assert.match(html, /dateTime="2026-11-11T11:46:40.000Z"/i);
  assert.match(html, /오래된 관측/);
  assert.match(html, /<strong>0<\/strong>/);
  assert.doesNotMatch(html, /<strong>42<\/strong>/);
});

test('hypotheses expose validation state, source label, and next action without a required URL', () => {
  const html = renderToStaticMarkup(createElement(components.Strategy, { data: data({ strategy: { hypotheses: [{ id: 'hypothesis', title: '가설 제목', detail: '확인할 내용', state: 'hypothesis', sourceLabel: '운영 가설 문서', nextAction: '다음 인터뷰에서 확인' }] } }) }));
  assert.match(html, /검증 전/);
  assert.match(html, /운영 가설 문서/);
  assert.match(html, /다음 인터뷰에서 확인/);
});

test('old git observations are labeled stale while retaining the last observed counts', () => {
  const html = renderToStaticMarkup(createElement(components.Repositories, { data: data({ repositories: [{ name: 'Infinity', state: 'ok', branch: 'main', dirtyCount: 3, observedAt: at(-721) }] }), now }));
  assert.match(html, /오래된 관측/);
  assert.doesNotMatch(html, />연결됨</);
  assert.match(html, /<b>3<\/b>/);
});

test('overview contains one connected building with vertically ordered floors and four accessible entrances', () => {
  const html = renderToStaticMarkup(createElement(components.Overview, { data: data({ repositories: [] }), now, tick: 0, live: false, eventQueue: [], thresholds: {}, go() {} }));
  assert.ok(html.includes('building.png'));
  assert.equal((html.match(/class="building-background"/g) || []).length, 1);
  assert.deepEqual([...html.matchAll(/data-floor="(\d)"/g)].map(m => Number(m[1])), [4,3,2,1]);
  assert.equal((html.match(/<button\b/g) || []).length, 4);
  assert.match(html, /aria-label="4층 대표실 들어가기"/);
  assert.match(html, /aria-label="1층 제품실 들어가기"/);
});

test('overview keeps observed session sprites and actual boards without nested interactive controls', () => {
  const session = { id: 'one', name: '관측 세션', state: 'working', floor: 1, observedAt: at(0), startedAt: at(-60) };
  const html = renderToStaticMarkup(createElement(components.Overview, { data: data({ repositories: [], sessions: [session], sources: { sessions: { state: 'ok', observedAt: at(0) } }, tasks: [{ id: 'task', title: '실제 제품 태스크', floor: 1 }] }), now, tick: 0, live: true, eventQueue: [], thresholds: {}, go() {} }));
  assert.match(html, /관측 세션/);
  assert.match(html, /실제 제품 태스크/);
  assert.equal((html.match(/<button\b/g) || []).length, 4);
  assert.equal((html.match(/class="wall-board"/g) || []).length, 4);
});

test('owner floor gives ordinary sessions and a waiting question distinct physical positions', () => {
  const sessions = [1, 2, 3, 4].map(index => ({ id: `owner-${index}`, name: `대표실 세션 ${index}`, floor: 4, state: index === 4 ? 'waiting' : 'working', observedAt: at(0), startedAt: at(-60) }));
  const fixture = data({ repositories: [], sessions, questions: [{ id: 'question', sessionId: 'owner-4', askedAt: at(-30), title: '결정 대기' }], sources: { sessions: { state: 'ok', observedAt: at(0) }, tasks: { state: 'ok', observedAt: at(0) } } });
  const html = renderToStaticMarkup(createElement(components.OfficeScene, { floor: 4, data: fixture, now, tick: 0, live: true, eventQueue: [], thresholds: {}, select() {} }));
  const positions = [...html.matchAll(/class="actor[^\"]*" style="left:([^;]+);top:([^;]+)/g)].map(match => `${match[1]},${match[2]}`);
  assert.equal(positions.length, 4, 'all three ordinary sessions and the waiting session remain visible');
  assert.equal(new Set(positions).size, 4, 'no waiting session shares an occupied ordinary seat');
});

test('overview moves a question-linked session to the owner queue without cloning it on its source floor', () => {
  const sessions = [1, 2, 3].map(index => ({ id: `owner-${index}`, name: `일반 대표실 ${index}`, floor: 4, state: 'working', observedAt: at(0), startedAt: at(-60) }));
  sessions.push({ id: 'product-question', name: '제품실 질문자', floor: 1, state: 'waiting', observedAt: at(0), startedAt: at(-60) });
  const fixture = data({ repositories: [], sessions, questions: [{ id: 'question', sessionId: 'product-question', askedAt: at(-30), title: '결정 대기' }], sources: { sessions: { state: 'ok', observedAt: at(0) }, tasks: { state: 'ok', observedAt: at(0) } } });
  const html = renderToStaticMarkup(createElement(components.Overview, { data: fixture, now, tick: 0, live: true, eventQueue: [], thresholds: {}, go() {} }));
  const actors = [...html.matchAll(/class="actor[^\"]*" style="left:([^;]+);top:([^;]+)[^\"]*"[^>]*aria-label="([^\"]+)"/g)];
  assert.equal(actors.length, 4, 'three ordinary owner sessions and one questioner are shown once');
  assert.equal(new Set(actors.map(actor => actor[3])).size, 4, 'no session has a duplicate actor in another floor');
  assert.equal(new Set(actors.map(actor => `${actor[1]},${actor[2]}`)).size, 4, 'owner seats and queue do not overlap');
  assert.equal(sessions[3].floor, 1, 'moving the display position does not rewrite the source floor');
});

test('overview counts the space a questioner occupies while preserving source-floor membership', () => {
  const sessions = [1, 2, 3].flatMap(index => [
    { id: `owner-${index}`, name: `대표실 ${index}`, floor: 4, state: 'working', observedAt: at(0) },
    { id: `product-${index}`, name: `제품실 ${index}`, floor: 1, state: index === 3 ? 'waiting' : 'working', observedAt: at(0) },
  ]);
  const fixture = data({ repositories: [], sessions, questions: [{ id: 'q', sessionId: 'product-3', askedAt: at(-20) }], sources: { sessions: { state: 'ok', observedAt: at(0) }, tasks: { state: 'ok', observedAt: at(0) } } });
  const html = renderToStaticMarkup(createElement(components.Overview, { data: fixture, now, tick: 0, live: true, eventQueue: [], thresholds: {}, go() {} }));
  const counts = [...html.matchAll(/class="building-session-count">[\s\S]*?(\d+)개 세션 관측/g)].map(match => Number(match[1]));
  assert.deepEqual(counts, [4, 0, 0, 2]);
  const product = renderToStaticMarkup(createElement(components.OfficeScene, { floor: 1, data: fixture, now, tick: 0, live: true, eventQueue: [], thresholds: {}, select() {} }));
  assert.match(product, /2개 세션이 관측됐어요/);
  assert.equal(sessions.find(session => session.id === 'product-3').floor, 1);
});


test('partial provider failure shows confirmed zero and an unknown hint in actual runtime aggregates', () => {
  const ok = { state: 'ok', observedAt: at(0) };
  const previous = normalizeSnapshot({ schemaVersion: 1, ...data({ sessions: [{ id: 'old', name: '이전 Codex', provider: 'codex', floor: 1, state: 'working', observedAt: at(0) }], sources: { sessions: ok, openclawSessions: ok, codexSessions: ok } }) });
  const next = normalizeSnapshot({ schemaVersion: 1, ...data({ sources: { sessions: { ...ok, state: 'partial' }, openclawSessions: ok, codexSessions: { ...ok, state: 'unknown' } } }) });
  const fixture = mergeSnapshot(previous, next, now);
  const owner = renderToStaticMarkup(createElement(components.Owner, { data: fixture, now, thresholds: {}, setThresholds() {} }));
  assert.match(owner, /<span>현재 실행<\/span><b>0<\/b>/);
  assert.match(owner, /<span>막힌 일<\/span><b>0<\/b>/);
  assert.match(owner, /일부 실행 원천 확인 중/);
  assert.match(owner, /1개 세션 확인 중/);
  const props = { data: fixture, now, tick: 0, live: true, eventQueue: [], thresholds: {}, go() {}, select() {} };
  const overview = renderToStaticMarkup(createElement(components.Overview, props));
  assert.doesNotMatch(overview, /1개 세션 관측/);
  assert.match(overview, /1개 세션 확인 중/);
  const scene = renderToStaticMarkup(createElement(components.OfficeScene, { ...props, floor: 1 }));
  assert.match(scene, /1개 세션 확인 중/);
  assert.doesNotMatch(scene, /1개 세션이 관측됐어요|1개 실행 세션/);
  assert.match(scene, /이전 Codex/);
});

test('owner warns of unavailable provider even without preserved rows and keeps known working counts', () => {
  const ok = { state: 'ok', observedAt: at(0) };
  const fixture = data({ sessions: [{ id: 'known', provider: 'openclaw', floor: 1, state: 'blocked', observedAt: at(0) }, { id: 'unknown', provider: 'openclaw', floor: 1, state: 'unknown', observedAt: at(0) }], sources: { sessions: { ...ok, state: 'partial' }, openclawSessions: ok, codexSessions: { ...ok, state: 'unknown' } } });
  const render = () => renderToStaticMarkup(createElement(components.Owner, { data: fixture, now, thresholds: {}, setThresholds() {} }));
  const html = render();
  assert.match(html, /<span>현재 실행<\/span><b>1<\/b>/);
  assert.match(html, /<span>막힌 일<\/span><b>1<\/b>/);
  assert.match(html, /1개 세션 확인 중/);
  fixture.sessions = [];
  assert.match(render(), /일부 실행 원천 확인 중/);
});
