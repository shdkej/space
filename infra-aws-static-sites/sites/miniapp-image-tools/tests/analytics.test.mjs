import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const html = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  const allowedEvents=');
const end = html.indexOf('  const error=', start);
assert.ok(start > 0 && end > start);
const source = html.slice(start, end);
const limits = { TYPES: new Set(['image/png', 'image/jpeg', 'image/webp']), MAX_EDGE: 10000, MAX_BYTES: 12 * 1024 * 1024, MAX_OUTPUT_BYTES: 64 * 1024 * 1024 };

function harness(qa) {
  const requests = [];
  const context = {
    ...limits,
    analytics: { host: 'https://us.i.posthog.com', key: 'phc_example123' },
    HOSTS: new Set(['https://us.i.posthog.com']),
    crypto: { randomUUID: () => 'anonymous-test-id' },
    qa, qaRunId: qa ? 'qa-test-id' : null,
    fetch: (url, options) => { requests.push({ url, options }); return Promise.resolve(); },
  };
  return { context, requests, capture: runInNewContext(`${source}\ncapture`, context) };
}

test('five custom events only, scoped properties, no private image metadata', () => {
  const { requests, capture } = harness(true);
  const events = ['image_selected', 'transform_started', 'transform_succeeded', 'transform_failed', 'download_requested'];
  for (const event of events) capture(event, {
    input_mime: 'image/png', input_width: 42, input_bytes: 1234,
    error_code: 'invalid_file', filename: 'sensitive.jpg', exif: 'secret', pixels: 'secret',
    error_message: 'sensitive free text',
  });
  capture('$pageview', {});
  assert.equal(requests.length, 5);
  for (const [index, { url, options }] of requests.entries()) {
    assert.equal(url, 'https://us.i.posthog.com/i/v0/e/');
    assert.equal(options.credentials, 'omit');
    const body = JSON.parse(options.body);
    assert.equal(body.event, events[index]);
    assert.deepEqual(Object.keys(body).sort(), ['api_key', 'distinct_id', 'event', 'properties']);
    assert.equal(body.properties.app_id, 'miniapp-image-tools');
    assert.equal(body.properties.traffic_kind, 'synthetic');
    assert.equal(body.properties.qa_run_id, 'qa-test-id');
    assert.equal(body.properties.$process_person_profile, false);
    for (const forbidden of ['filename', 'exif', 'pixels', 'error_message']) assert.ok(!(forbidden in body.properties));
  }
});

test('user traffic has no synthetic run ID and invalid configuration disables capture', () => {
  const { context, requests, capture } = harness(false);
  capture('image_selected', {});
  assert.equal(JSON.parse(requests[0].options.body).properties.traffic_kind, 'user');
  assert.ok(!('qa_run_id' in JSON.parse(requests[0].options.body).properties));
  context.analytics = { host: 'https://eu.i.posthog.com', key: 'phc_example123' };
  capture('image_selected', {});
  assert.equal(requests.length, 1);
});
