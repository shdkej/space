'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { createServer } = require('node:http');
const root = path.join(__dirname, '../dist');
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const asset = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(asset) || !fs.statSync(asset).isFile()) return response.writeHead(404).end();
  const types = { '.js': 'application/javascript', '.html': 'text/html', '.css': 'text/css' };
  response.setHeader('Content-Type', types[path.extname(asset)] || 'application/octet-stream');
  fs.createReadStream(asset).pipe(response);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath: process.env.CHROME_PATH || chromium.executablePath(), args: ['--no-sandbox']});
    const page = await browser.newPage({viewport: {width: 375, height: 812}});
    const url = 'http://127.0.0.1:' + server.address().port;
    const events = [], requests = [];
    const token = '1'.repeat(64) + '.' + 'a'.repeat(43);
    let enabled = false, fail = false;
    await page.route('**/policy-scene.js', route => route.abort());
    await page.route('**/launch-config.js', route => route.fulfill({ contentType: 'application/javascript', body:
      'window.policycockConfig=' + JSON.stringify({ projectKey:'phc_Test', signupEndpoint: enabled ? url + '/signup' : '' }) }));
    await page.route('https://us.i.posthog.com/i/v0/e/', route => {
      events.push(route.request().postDataJSON());
      return route.fulfill({json: {status: 1}});
    });
    await page.route('**/signup', route => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({status: fail ? 503 : 200, json: {ok: !fail}});
    });
    await page.goto(url + '/?qa=1');
    await page.getByRole('button', {name: '이메일 등록 준비 중'}).waitFor({timeout: 2500});
    assert.equal(await page.locator('#launch-pending button').isDisabled(), true);
    assert.equal(await page.locator('a[href^="mailto:"]').count(), 0);
    assert.equal(await page.locator('#launch-form').isVisible(), false);
    await page.locator('.site-header a[href="#policies"]').click();
    await page.locator('.person').first().click();
    await page.locator('#policy-dialog[open]').waitFor();
    await page.locator('#policy-dialog a[href="#launch"]').click();
    assert.equal(await page.locator('#policy-dialog').isVisible(), false);
    assert.equal(new URL(page.url()).hash, '#launch');
    enabled = true;
    await page.reload();
    await page.locator('#launch-email').fill('qa-user@example.org');
    await page.locator('#launch-consent').check();
    fail = true;
    await page.locator('#launch-form button').click();
    await page.getByText(/신청 요청을 접수하지 못/).waitFor();
    fail = false;
    await page.locator('#launch-form button').click();
    await page.getByText(/받은편지함/).waitFor();
    assert.equal(requests.at(-1).replyEmail, 'qa-user@example.org');
    assert.equal(requests.at(-1).consentVersion, 'launch-notice-v2');
    await page.goto(url + '/?qa=1#launch-confirm=' + token);
    await page.locator('#launch-confirm').click();
    await page.getByText(/출시 알림 신청을 확인했습니다/).waitFor();
    await page.locator('#launch-withdraw').click();
    await page.getByText(/신청을 철회했습니다/).waitFor();
    assert.deepEqual(requests.slice(-2).map(r => r.action), ['confirm','withdraw']);
    assert.equal(requests.at(-1).token, token);
    assert.equal(events.some(e => e.event === 'case_opened'), true);
    assert.equal(events.some(e => e.event === 'signup_confirmed'), true);
    for (const event of events) {
      assert.equal(event.properties.app_id, 'policycock');
      assert.equal(event.properties.traffic_kind, 'synthetic');
      assert.deepEqual(Object.keys(event.properties).sort(), ['$geoip_disable','$process_person_profile','app_id','qa_run_id','traffic_kind'].sort());
      assert.doesNotMatch(JSON.stringify(event), /qa-user|gmail|example\.org|청년기본소득|launch-confirm|이재명/);
      assert.ok(!JSON.stringify(event).includes(token));
    }
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log('PASS mobile case reading, closed registration, gated signup, confirmation, withdrawal and anonymous analytics');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
