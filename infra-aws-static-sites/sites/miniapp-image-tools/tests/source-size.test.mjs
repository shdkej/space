import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function formatSourceBytes(');
const end = html.indexOf('  function dimensionsFromHeader(', start);

test('source label presents nonzero tiny files and unit boundaries accurately', () => {
  assert.ok(start > 0 && end > start, 'source size formatter exists');
  const cases = [
    [0, '0B'], [1, '1B'], [270, '270B'], [1023, '1023B'],
    [1024, '1.00KB'], [1048575, '1023.99KB'], [1048576, '1.00MB'],
  ];
  for (const [bytes, expected] of cases) {
    assert.equal(runInNewContext(`${html.slice(start, end)}\nformatSourceBytes(${bytes})`), expected);
  }
  assert.match(html, /source\.textContent=`\$\{size\[0\]\} × \$\{size\[1\]\}px · \$\{formatSourceBytes\(file\.size\)\}`/);
});

test('empty PNG explains empty input without changing the size-limit error code', async () => {
  const selection = html.slice(html.indexOf("  fileInput.addEventListener('change'"), html.indexOf("  edgeInput.addEventListener('input'"));
  assert.ok(selection.startsWith("  fileInput.addEventListener('change'"));
  const state = { source: { textContent: '' }, status: '', code: '' };
  const fileInput = { files: [{ type: 'image/png', size: 0 }], addEventListener(_event, fn) { this.change = fn; } };
  const context = {
    fileInput, source: state.source, TYPES: new Set(['image/png', 'image/jpeg', 'image/webp']), MAX_BYTES: 12 * 1024 * 1024,
    invalidate() {}, error(text, code) { state.status = text; state.code = code; }, message() {},
    dimensionsFromHeader() { throw Error('empty input must not decode'); }, capture() {},
  };
  runInNewContext(`let selected=null,dimensions=null,generation=0; ${selection}`, context);
  await fileInput.change();
  assert.equal(state.source.textContent, '선택한 파일이 비어 있습니다.');
  assert.equal(state.status, '파일이 비어 있어 변환할 수 없습니다. 다른 이미지 파일을 선택해 주세요.');
  assert.equal(state.code, 'file_too_large');
});

test('oversize and unsupported or corrupt inputs retain their messages and error codes', async () => {
  const selection = html.slice(html.indexOf("  fileInput.addEventListener('change'"), html.indexOf("  edgeInput.addEventListener('input'"));
  const results = [];
  const source = { textContent: '' };
  const fileInput = { files: [], addEventListener(_event, fn) { this.change = fn; } };
  const context = {
    fileInput, source, TYPES: new Set(['image/png', 'image/jpeg', 'image/webp']), MAX_BYTES: 12 * 1024 * 1024,
    invalidate() {}, error(text, code) { results.push([text, code]); }, message() {},
    dimensionsFromHeader() { return null; }, capture() {},
  };
  runInNewContext(`let selected=null,dimensions=null,generation=0; ${selection}`, context);
  for (const file of [
    { type: 'image/png', size: 12 * 1024 * 1024 + 1 },
    { type: 'image/gif', size: 43 },
    { type: 'image/png', size: 14, slice() { return { arrayBuffer: async () => new ArrayBuffer(14) }; } },
  ]) {
    fileInput.files = [file]; await fileInput.change();
    if (file.size > context.MAX_BYTES) assert.equal(source.textContent, '파일 크기가 허용 범위를 벗어났습니다.');
  }
  assert.deepEqual(results, [
    ['12MB 이하의 이미지를 선택하세요.', 'file_too_large'],
    ['PNG, JPEG, WebP 파일을 선택하세요.', 'unsupported_format'],
    ['손상되었거나 지원되지 않는 이미지입니다. 다른 파일을 선택하세요.', 'invalid_file'],
  ]);
});
