import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const source = html.slice(html.indexOf('  function dimensionsFromHeader('), html.indexOf("  fileInput.addEventListener('change'"));
assert.ok(source.startsWith('  function dimensionsFromHeader('));
const dimensionsFromHeader = runInNewContext(`${source}\ndimensionsFromHeader`);
const bytes = (...values) => Uint8Array.from(values).buffer;

test('PNG header yields width and height; rejects invalid header', () => {
  const png = bytes(0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a,0,0,0,13,0x49,0x48,0x44,0x52,0,0,2,0,0,0,1,0);
  assert.deepEqual(Array.from(dimensionsFromHeader(png, 'image/png')), [512, 256]);
  assert.equal(dimensionsFromHeader(bytes(0,1,2), 'image/png'), null);
});

test('JPEG SOF dimensions and truncated segment', () => {
  const jpeg = bytes(0xff,0xd8,0xff,0xc0,0,11,8,0,32,0,64,3,1,0x11,0,0xff,0xd9);
  assert.deepEqual(Array.from(dimensionsFromHeader(jpeg, 'image/jpeg')), [64,32]);
  assert.equal(dimensionsFromHeader(bytes(0xff,0xd8,0xff,0xc0,0,11,8), 'image/jpeg'), null);
});

test('WebP VP8X dimensions and unsupported header', () => {
  const webp = bytes(0x52,0x49,0x46,0x46,0,0,0,0,0x57,0x45,0x42,0x50,0x56,0x50,0x38,0x58,0,0,0,0,0,0,0,0,0x7f,0x01,0,0xff,0,0);
  assert.deepEqual(Array.from(dimensionsFromHeader(webp, 'image/webp')), [384, 256]);
  assert.equal(dimensionsFromHeader(bytes(0,0,0), 'image/webp'), null);
});
