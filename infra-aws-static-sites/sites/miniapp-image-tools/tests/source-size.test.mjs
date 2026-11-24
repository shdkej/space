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
