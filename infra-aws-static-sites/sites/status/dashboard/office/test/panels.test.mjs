import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';

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
