'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');
const {createServer} = require('node:http');
const root = path.join(__dirname, '../dist');
const server = createServer((request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const asset = path.join(root, pathname === '/' ? 'index.html' : pathname);
  if (!fs.existsSync(asset) || !fs.statSync(asset).isFile()) return response.writeHead(404).end();
  response.setHeader('Content-Type', {'.js':'application/javascript','.html':'text/html','.css':'text/css'}[path.extname(asset)] || 'application/octet-stream');
  fs.createReadStream(asset).pipe(response);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser;
  try {
    browser = await chromium.launch({executablePath:process.env.CHROME_PATH || chromium.executablePath(),args:['--no-sandbox']});
    const origin = 'http://127.0.0.1:' + server.address().port;
    const context = await browser.newContext({viewport:{width:375,height:812}});
    const tags = [], hits = [], posthog = [], tagObservedHashes = [];
    await context.route('**/policy-scene.js', route => route.abort());
    await context.route('**/launch-config.js', route => route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig=' + JSON.stringify({projectKey:'phc_Test',signupEnabled:false,signupEndpoint:'',ga4MeasurementId:'G-TEST1234'})}));
    await context.route('https://us.i.posthog.com/i/v0/e/', route => {
      posthog.push(route.request().postDataJSON()); return route.fulfill({json:{status:1}});
    });
    await context.route('https://www.googletagmanager.com/gtag/js?**', route => {
      tags.push({url:route.request().url(),headers:route.request().headers()});
      return route.fulfill({contentType:'application/javascript',body:`window.addEventListener('hashchange',event=>window.__recordHash({hash:location.hash,newURL:event.newURL}));
      for(const args of window.dataLayer){
        if(args[0]==='event') navigator.sendBeacon('https://www.google-analytics.com/g/collect?'+new URLSearchParams({en:args[1],dl:args[2].page_location,dr:args[2].page_referrer,dt:args[2].page_title}));
      }`});
    });
    await context.route('https://www.google-analytics.com/g/collect?**', route => {
      hits.push(route.request().url()); return route.fulfill({status:204,body:''});
    });
    // Even two previous affirmative vendor choices must not silently authorize the new combined choice.
    await context.addInitScript(() => {
      if (localStorage.getItem('policycock.analytics.combined.v1') === null) {
        localStorage.setItem('policycock.analytics.consent.v1','accepted');
        localStorage.setItem('policycock.ga4.consent.v1','accepted');
      }
    });
    const page = await context.newPage();
    await page.exposeFunction('__recordHash', hash => tagObservedHashes.push(hash));
    const secret = 'sensitive-query-and-withdrawal-token';
    await page.goto(origin+'/?search='+secret+'#policy='+secret, {referer:'https://www.google.com/search?q='+secret});
    await page.waitForTimeout(200);
    assert.equal(await page.locator('#analytics-notice').isVisible(), true);
    assert.equal(await page.locator('.analytics-notice').count(), 1, 'only one consent notice');
    assert.match(await page.locator('#analytics-notice').innerText(), /PostHog.*Google Analytics/);
    assert.deepEqual([tags.length,hits.length,posthog.length], [0,0,0], 'old consents do not silently authorize either recipient');
    await page.locator('#analytics-decline').click();
    await page.locator('.person').first().click();
    assert.deepEqual([tags.length,hits.length,posthog.length], [0,0,0]);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.analytics.combined.v1')), 'declined');
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.ga4.consent.v1')), 'declined', 'rollback-safe decline');
    await page.locator('#analytics-settings').click();
    await page.locator('#analytics-accept').click();
    await page.waitForURL(origin+'/?utm_source=google&utm_medium=organic');
    await page.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await page.waitForTimeout(200);
    assert.equal(await page.evaluate(() => document.referrer), '', 'new document drops sensitive referrer');
    const landingEvents = posthog.filter(event => event.event === 'landing_viewed');
    assert.equal(landingEvents.length, 2, 'PostHog observed both documents in the GA4 redirect');
    assert.ok(landingEvents[0].properties.$session_id);
    assert.equal(landingEvents[0].properties.$session_id, landingEvents[1].properties.$session_id, 'GA4 redirect continues the visit');
    assert.equal(tags.length, 1);
    assert.equal(hits.length, 1, 'single sanitized page view');
    assert.equal(tags[0].headers.referer, undefined);
    const sent = new URL(hits[0]);
    assert.equal(sent.searchParams.get('en'), 'page_view');
    assert.equal(sent.searchParams.get('dl'), origin+'/?utm_source=google&utm_medium=organic');
    assert.equal(sent.searchParams.get('dr'), 'https://google.com/');
    assert.doesNotMatch(tags[0].url+hits[0], /sensitive-query-and-withdrawal-token/);
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.analytics.combined.v1')), 'accepted');
    for (const [query, referer] of [
      ['?utm_source=instagram&utm_content='+secret, undefined],
      ['?q='+secret, 'https://l.instagram.com/'+secret],
    ]) {
      const instagram = await context.newPage();
      await instagram.goto(origin+'/'+query, referer ? {referer} : {});
      await instagram.waitForURL(origin+'/?utm_source=instagram&utm_medium=social');
      await instagram.waitForFunction(() => window.policycockGa4Started());
      const event = await instagram.evaluate(() => Array.from(window.dataLayer.find(args => args[0] === 'event')));
      assert.equal(event[2].page_location, origin+'/?utm_source=instagram&utm_medium=social');
      assert.equal(event[2].page_referrer, referer ? 'https://instagram.com/' : '');
      assert.ok(!JSON.stringify(event).includes(secret));
      await instagram.close();
    }
    const hitsAfterInstagram = hits.length;
    const sibling = await context.newPage();
    await sibling.goto(origin+'/');
    await sibling.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    const token = 'a'.repeat(64) + '.' + 'b'.repeat(64);
    // A previously issued hash-only private link can be opened in a tab with a live tag.
    await page.goto(page.url() + '#launch-withdraw=' + token);
    await page.waitForURL(origin+'/index.html#launch');
    assert.equal(await page.locator('script[src^="https://www.googletagmanager.com/gtag/js"]').count(), 0);
    assert.equal(await page.locator('#launch-manage').isVisible(), true);
    assert.equal(hits.length, hitsAfterInstagram + 1, 'private-link navigation creates no Google collection');
    assert.ok(tagObservedHashes.every(value => !JSON.stringify(value).includes(token)), 'pre-existing tag listener never sees the capability, including event.newURL');
    const before = hits.length, posthogBefore = posthog.length;
    await page.locator('#analytics-settings').click();
    await page.locator('#analytics-decline').click();
    await sibling.waitForFunction(() => !document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await sibling.evaluate(() => window.policycockCapture('case_opened'));
    await sibling.waitForTimeout(250);
    assert.equal(hits.length, before, 'cross-tab withdrawal stops Google');
    assert.equal(posthog.length, posthogBefore, 'cross-tab withdrawal stops PostHog');
    await sibling.close();
    const withdrawal = await context.newPage();
    await withdrawal.route('**/launch-config.js', route => route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"",signupEnabled:true,signupEndpoint:"https://signup.test/",ga4MeasurementId:"G-TEST1234"}'}));
    const withdrawals = [];
    await withdrawal.route('https://signup.test/', route => {
      withdrawals.push(JSON.parse(route.request().postData()));
      return route.fulfill({contentType:'application/json',body:'{"ok":true}'});
    });
    await withdrawal.goto(origin+'/?search='+secret+'#launch-withdraw='+token);
    await withdrawal.waitForFunction(() => location.hash === '#launch');
    assert.equal(await withdrawal.locator('#launch-manage').isVisible(), true);
    assert.equal(await withdrawal.locator('#analytics-notice').isVisible(), false);
    assert.equal(await withdrawal.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await withdrawal.locator('#launch-receipts button').filter({hasText:'신청 철회'}).click();
    await withdrawal.waitForFunction(() => document.querySelector('#launch-status').textContent.includes('철회했습니다'));
    assert.deepEqual(withdrawals.map(({action,token:sent}) => ({action,token:sent})),[{action:'withdraw',token}]);
    await withdrawal.close();
    const blocked = await browser.newContext();
    await blocked.addInitScript(() => Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
    await blocked.route('**/policy-scene.js',route=>route.abort());
    await blocked.route('**/launch-config.js',route=>route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"",signupEnabled:false,signupEndpoint:"",ga4MeasurementId:"G-TEST1234"}'}));
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(origin+'/');
    assert.equal(await blockedPage.locator('#analytics-notice').isVisible(), false);
    assert.equal(await blockedPage.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await blocked.close();
    const blank = await browser.newContext();
    await blank.route('**/policy-scene.js',route=>route.abort());
    const blankPage = await blank.newPage();
    await blankPage.goto(origin+'/');
    assert.equal(await blankPage.locator('#analytics-google-copy').isVisible(), false, 'unconfigured GA4 is not described as active');
    assert.equal(await blankPage.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await blankPage.locator('#analytics-accept').click();
    assert.equal(await blankPage.evaluate(() => localStorage.getItem('policycock.analytics.posthog-only.v1')), 'accepted');
    assert.equal(await blankPage.evaluate(() => localStorage.getItem('policycock.analytics.combined.v1')), null);
    await blank.route('**/launch-config.js', route => route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"",signupEnabled:false,signupEndpoint:"",ga4MeasurementId:"G-TEST1234"}'}));
    await blankPage.reload();
    assert.equal(await blankPage.locator('#analytics-notice').isVisible(), true, 'new GA4 recipient asks again');
    assert.equal(await blankPage.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await blank.close();
    const failed = await browser.newContext();
    await failed.addInitScript(() => { Storage.prototype.setItem = () => {throw new Error('storage blocked')}; });
    await failed.route('**/policy-scene.js',route=>route.abort());
    await failed.route('**/launch-config.js',route=>route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"phc_Test",signupEnabled:false,signupEndpoint:"",ga4MeasurementId:"G-TEST1234"}'}));
    const failedPage = await failed.newPage();
    await failedPage.goto(origin+'/');
    await failedPage.locator('#analytics-accept').click();
    assert.match(await failedPage.locator('#analytics-status').innerText(), /저장할 수 없습니다/);
    assert.equal(await failedPage.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    assert.equal(await failedPage.evaluate(() => window.policycockAnalyticsConsent()), false);
    await failed.close();
    const revokeFailure = await browser.newContext();
    await revokeFailure.route('**/policy-scene.js',route=>route.abort());
    await revokeFailure.route('**/launch-config.js',route=>route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"",signupEnabled:false,signupEndpoint:"",ga4MeasurementId:"G-TEST1234"}'}));
    await revokeFailure.route('https://www.googletagmanager.com/gtag/js?**',route=>route.fulfill({contentType:'application/javascript',body:''}));
    const revokePage = await revokeFailure.newPage();
    await revokePage.goto(origin+'/');
    await revokePage.locator('#analytics-accept').click();
    await revokePage.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await revokePage.evaluate(() => { Storage.prototype.setItem = () => {throw new Error('readonly')}; });
    await revokePage.locator('#analytics-settings').click();
    await revokePage.locator('#analytics-decline').click();
    await revokePage.waitForFunction(() => !document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    assert.equal(await revokePage.evaluate(() => localStorage.getItem('policycock.analytics.combined.v1')), null, 'failed overwrite deletes prior grant');
    await revokePage.locator('#analytics-accept').click();
    await revokePage.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await revokePage.evaluate(() => {
      Storage.prototype.setItem = () => {throw new Error('readonly')};
      Storage.prototype.removeItem = () => {throw new Error('readonly')};
    });
    await revokePage.locator('#analytics-settings').click();
    await revokePage.locator('#analytics-decline').click();
    await revokePage.waitForURL(origin+'/privacy.html#analytics-withdrawal-failed');
    assert.equal(await revokePage.locator('#analytics-withdrawal-failed').isVisible(), true, 'persistent storage failure is disclosed on a tag-free page');
    assert.equal(await revokePage.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await revokeFailure.close();
    await context.close();
    console.log('PASS single consent, legacy migration fail-closed, both recipients, single sanitized view, cross-tab revoke, private withdrawal, GPC, blank config, storage failure');
  } finally { if (browser) await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1}).finally(() => server.close());