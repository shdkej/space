import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  function invalidate(');
const end = html.indexOf('  function dimensionsFromHeader(', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);

test('changing a setting after success invalidates the result and replaces stale success guidance', () => {
  let generation = 1;
  let cleared = 0;
  const status = { textContent: '변환이 끝났습니다. 미리보기를 확인하고 내려받으세요.', dataset: { error: 'false' } };
  const transform = { disabled: false };
  const context = {
    selected: { type: 'image/png' }, generation, status, transform,
    clearOutput: () => { cleared++; },
    message: text => { status.textContent = text; status.dataset.error = 'false'; },
  };
  runInNewContext(`${source}\ninvalidate(true)`, context);
  assert.equal(cleared, 1);
  assert.equal(context.generation, generation + 1);
  assert.equal(transform.disabled, false);
  assert.match(status.textContent, /다시 이미지 변환을 누르세요/);
  assert.doesNotMatch(status.textContent, /변환이 끝났습니다/);
});
