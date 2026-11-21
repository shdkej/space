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
    const context = await browser.newContext({viewport: {width: 375, height: 812}});
    const page = await context.newPage();
    const url = 'http://127.0.0.1:' + server.address().port;
    const events = [], requests = [];
    const token = '1'.repeat(64) + '.' + 'a'.repeat(64);
    let enabled = false, fail = false, cleanupPending = true, duplicate = false;
    await page.route('**/policy-scene.js', route => route.abort());
    await page.route('**/launch-config.js', route => route.fulfill({ contentType: 'application/javascript', body:
      'window.policycockConfig=' + JSON.stringify({ projectKey:'phc_Test', signupEnabled: enabled, signupEndpoint: url + '/signup' }) }));
    await page.route('https://us.i.posthog.com/i/v0/e/', route => {
      events.push(route.request().postDataJSON());
      return route.fulfill({json: {status: 1}});
    });
    await page.route('**/signup', route => {
      requests.push(route.request().postDataJSON());
      const op = requests.at(-1).action;
      const result = op === 'request' ? (duplicate ? {ok: true} : {ok: true, withdrawToken: token}) : {ok: true, cleanupPending};
      return route.fulfill({status: fail ? 503 : 200, json: fail ? {error: 'registration_pending'} : result});
    });
    await page.goto(url + '/?qa=1');
    await page.waitForTimeout(150);
    assert.equal(events.length, 0, 'no PostHog call before consent');
    await page.getByRole('button', {name:'거부하고 계속'}).click();
    await page.locator('.person').first().click();
    assert.equal(events.length, 0, 'decline also blocks case events');
    await page.locator('#policy-dialog button.dialog-close').click();
    await page.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'방문 분석 동의'}).click();
    await page.waitForTimeout(150);
    assert.equal(events.some(event => event.event === 'landing_viewed'), true, 'consent starts analytics');
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.analytics.consent.v1')), 'accepted');
    const sibling = await context.newPage();
    const siblingEvents = [];
    await sibling.route('**/launch-config.js', route => route.fulfill({ contentType: 'application/javascript', body:
      'window.policycockConfig=' + JSON.stringify({projectKey:'phc_Test', signupEnabled: false, signupEndpoint: url + '/signup'}) }));
    await sibling.route('https://us.i.posthog.com/i/v0/e/', route => {
      siblingEvents.push(route.request().postDataJSON());
      return route.fulfill({json: {status: 1}});
    });
    await sibling.goto(url + '/?qa=1');
    assert.equal(await sibling.evaluate(() => window.policycockAnalyticsConsent()), true);
    await page.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'거부하고 계속'}).click();
    await sibling.waitForFunction(() => !window.policycockAnalyticsConsent());
    const siblingBefore = siblingEvents.length;
    await sibling.evaluate(() => window.policycockCapture('case_opened'));
    await sibling.waitForTimeout(500);
    assert.equal(siblingEvents.length, siblingBefore, 'cross-tab withdrawal blocks capture');
    await sibling.getByRole('button', {name:'방문 분석 설정'}).click();
    await sibling.getByRole('button', {name:'방문 분석 동의'}).click();
    await page.waitForFunction(() => window.policycockAnalyticsConsent());
    await sibling.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'거부하고 계속'}).click();
    await sibling.waitForFunction(() => document.activeElement?.id === 'analytics-settings');
    assert.equal(await sibling.locator('#analytics-notice').isVisible(), false, 'cross-tab choice closes notice without losing focus');
    await sibling.close();
    await page.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'방문 분석 동의'}).click();
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
    await page.getByText(/접수 결과를 확인할 수 없습니다/).waitFor();
    const retry = requests.at(-1).requestId;
    assert.match(retry, /^[a-f0-9]{64}$/);
    fail = false;
    await page.locator('#launch-form button').click();
    await page.getByText(/출시 알림 신청을 접수했습니다/).waitFor();
    assert.equal(requests.at(-1).replyEmail, 'qa-user@example.org');
    assert.equal(requests.at(-1).requestId, retry);
    assert.equal(requests.at(-1).consentVersion, 'launch-notice-v3');
    assert.equal(requests.at(-1).consent, true);
    assert.equal(requests.at(-1).website, '');
    assert.doesNotMatch(await page.evaluate(() => JSON.stringify(localStorage)), /example\.org/);
    // A fresh browser obtains no withdrawal capability by submitting an existing address.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', {name:'방문 분석 동의'}).click();
    duplicate = true;
    await page.locator('#launch-email').fill('qa-user@example.org');
    await page.locator('#launch-consent').check();
    await page.locator('#launch-form button').click();
    await page.getByText(/출시 알림 신청을 접수했습니다/).waitFor();
    assert.equal(await page.locator('#launch-manage').isVisible(), false);
    // Restoring the private link works even while new registrations are closed.
    enabled = false;
    await page.goto(url + '/?qa=1&restore=1#launch-withdraw=' + token);
    assert.equal(await page.locator('#launch-form').isVisible(), false);
    assert.equal(new URL(page.url()).hash, '#launch');
    assert.equal(requests.filter(r => r.action === 'withdraw').length, 0);
    await page.getByRole('button', {name:'신청 철회'}).click();
    await page.getByText(/운영자 메일함 정리 통지는 대기/).waitFor();
    cleanupPending = false;
    await page.getByRole('button', {name:'신청 철회'}).click();
    await page.getByText(/운영자에게 메일 정리를 요청/).waitFor();
    assert.equal(await page.locator('#launch-manage').isVisible(), false);
    assert.equal(requests.at(-1).token, token);
    for (const name of ['case_opened','signup_request_accepted','signup_cleanup_pending','signup_withdrawn']) {
      assert.equal(events.some(event => event.event === name), true, name);
    }
    for (const event of events) {
      assert.equal(event.properties.app_id, 'policycock');
      assert.equal(event.properties.traffic_kind, 'synthetic');
      assert.deepEqual(Object.keys(event.properties).sort(), ['$geoip_disable','$process_person_profile','app_id','qa_run_id','traffic_kind'].sort());
      assert.doesNotMatch(JSON.stringify(event), /qa-user|gmail|example\.org|청년기본소득|launch-withdraw|이재명/);
      assert.ok(!JSON.stringify(event).includes(token) && !JSON.stringify(event).includes(retry));
    }
    const beforeRevoke = events.length;
    await page.getByRole('button', {name:'방문 분석 설정'}).click();
    await page.getByRole('button', {name:'거부하고 계속'}).click();
    await page.evaluate(() => window.policycockCapture('case_opened'));
    assert.equal(events.length, beforeRevoke, 'withdrawal blocks subsequent calls');
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.analytics.consent.v1')), 'declined');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    console.log('PASS mobile case reading, closed registration, direct signup, duplicate privacy, withdrawal and anonymous analytics');
  } finally {
    await browser?.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
