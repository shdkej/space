import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const section = (from, to) => {
  const start = html.indexOf(from), end = html.indexOf(to, start);
  assert.ok(start > 0 && end > start, `missing app section ${from}`);
  return html.slice(start, end);
};
const app = [
  section('  let selected=null,', '  const qa='),
  section('  const error=', '  fileInput.addEventListener('),
  section("  fileInput.addEventListener('change'", "  transform.addEventListener('click'"),
].join('\n');

function harness() {
  const listeners = new Map(), reads = [];
  const node = (text = '') => ({ textContent: text, dataset: {}, disabled: true, hidden: true,
    removeAttribute() {} });
  const fileInput = { files: [], addEventListener(name, fn) { listeners.set(`file:${name}`, fn); } };
  const edgeInput = { addEventListener(name, fn) { listeners.set(`edge:${name}`, fn); } };
  const formatInput = { addEventListener(name, fn) { listeners.set(`format:${name}`, fn); } };
  const source = node(), status = node('이미지를 선택하면 시작할 수 있습니다.');
  const transform = node(), download = node(), preview = node(), empty = node(), meta = node();
  const context = createContext({ fileInput, edgeInput, formatInput, source, status, transform,
    download, preview, empty, meta, MAX_BYTES: 12 * 1024 * 1024, MAX_EDGE: 10000,
    MAX_PIXELS: 20_000_000, TYPES: new Set(['image/png']), capture() {}, URL: { revokeObjectURL() {} } });
  runInContext(app, context);
  const header = new Uint8Array(24);
  header.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  header.set([0x49, 0x48, 0x44, 0x52], 12);
  const file = (width, height, name) => {
    const bytes = header.slice();
    new DataView(bytes.buffer).setUint32(16, width);
    new DataView(bytes.buffer).setUint32(20, height);
    return { name, type: 'image/png', size: bytes.length, slice() {
      return { arrayBuffer() { return new Promise(resolve => reads.push(() => resolve(bytes.buffer))); } };
    } };
  };
  return { listeners, reads, fileInput, file, source, status, transform, download, preview,
    selected: () => runInContext('selected', context), async flush() { await new Promise(resolve => setImmediate(resolve)); } };
}

test('changing edge and format while native header read is pending retains the selected file', async () => {
  const h = harness(), a = h.file(160, 80, 'a.png');
  h.fileInput.files = [a];
  const reading = h.listeners.get('file:change')();
  assert.equal(h.source.textContent, '이미지를 확인하고 있습니다.');
  h.listeners.get('edge:input')();
  h.listeners.get('format:change')();
  h.reads.shift()(); await reading;
  assert.equal(h.selected(), a);
  assert.equal(h.source.textContent, '160 × 80px · 24B');
  assert.equal(h.transform.disabled, false);
  assert.equal(h.download.disabled, true);
  assert.equal(h.preview.hidden, true);
});

test('late header A cannot replace newer selected B', async () => {
  const h = harness(), a = h.file(160, 80, 'a.png'), b = h.file(120, 60, 'b.png');
  h.fileInput.files = [a]; const readA = h.listeners.get('file:change')();
  h.fileInput.files = [b]; const readB = h.listeners.get('file:change')();
  h.reads[1](); await readB;
  assert.equal(h.selected(), b);
  h.reads[0](); await readA;
  assert.equal(h.selected(), b);
  assert.equal(h.source.textContent, '120 × 60px · 24B');
  assert.equal(h.transform.disabled, false);
});
