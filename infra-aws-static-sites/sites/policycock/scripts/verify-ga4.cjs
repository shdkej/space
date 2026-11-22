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
    const tagRequests = [], hits = [];
    await context.route('**/policy-scene.js', route => route.abort());
    await context.route('**/launch-config.js', route => route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig=' + JSON.stringify({projectKey:'',signupEnabled:false,signupEndpoint:'',ga4MeasurementId:'G-TEST1234'})}));
    await context.route('https://www.googletagmanager.com/gtag/js?**', route => {
      tagRequests.push({url:route.request().url(),headers:route.request().headers()});
      // A simulated transport reads only the commands our integration queued.
      return route.fulfill({contentType:'application/javascript',body:`for(const args of window.dataLayer){
        if(args[0]==='event') navigator.sendBeacon('https://www.google-analytics.com/g/collect?'+new URLSearchParams({en:args[1],dl:args[2].page_location,dr:args[2].page_referrer,dt:args[2].page_title}));
      }`});
    });
    await context.route('https://www.google-analytics.com/g/collect?**', route => {
      hits.push(route.request().url()); return route.fulfill({status:204,body:''});
    });
    const page = await context.newPage();
    const secret = 'sensitive-query-and-withdrawal-token';
    await page.goto(origin+'/?search='+secret+'#policy='+secret, {referer:'https://www.google.com/search?q='+secret});
    await page.waitForTimeout(200);
    assert.equal(tagRequests.length + hits.length, 0, 'no tag or collection before either consent');
    assert.equal(await page.locator('#ga4-notice').isVisible(), false, 'GA4 does not stack over PostHog notice');
    await page.locator('#analytics-decline').click();
    assert.equal(await page.locator('#ga4-notice').isVisible(), true, 'GA4 choice follows separate PostHog choice');
    await page.locator('#ga4-decline').click();
    await page.waitForTimeout(200);
    assert.equal(tagRequests.length + hits.length, 0, 'GA4 refusal sends nothing');
    await page.locator('#ga4-settings').click();
    await page.locator('#ga4-accept').click();
    await page.waitForURL(origin+'/?utm_source=google&utm_medium=organic');
    assert.equal(await page.evaluate(() => document.referrer), '', 'new document drops original search referrer');
    await page.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await page.waitForTimeout(200);
    assert.equal(tagRequests.length, 1);
    assert.equal(hits.length, 1);
    assert.equal(tagRequests[0].headers.referer, undefined, 'script fetch has no sensitive referrer');
    const sent = new URL(hits[0]);
    assert.equal(sent.searchParams.get('en'), 'page_view');
    assert.equal(sent.searchParams.get('dl'), origin+'/?utm_source=google&utm_medium=organic');
    assert.equal(sent.searchParams.get('dr'), 'https://google.com/');
    assert.equal(sent.searchParams.get('dt'), '모두의정책');
    assert.doesNotMatch(tagRequests[0].url+hits[0], /sensitive-query-and-withdrawal-token/);
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.analytics.consent.v1')), 'declined');
    assert.equal(await page.evaluate(() => localStorage.getItem('policycock.ga4.consent.v1')), 'accepted');
    const sibling = await context.newPage();
    await sibling.goto(origin+'/');
    await sibling.waitForFunction(() => !!document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    const before = hits.length;
    await page.locator('#ga4-settings').click();
    await page.locator('#ga4-decline').click();
    await sibling.waitForFunction(() => !document.querySelector('script[src^="https://www.googletagmanager.com/gtag/js"]'));
    await sibling.locator('.person').first().click();
    await sibling.waitForTimeout(250);
    assert.equal(hits.length, before, 'cross-tab withdrawal reloads and blocks further collection');
    await sibling.close();
    // A withdrawal capability is consumed by launch.js, never by GA4's clean navigation.
    const token = 'a'.repeat(64) + '.' + 'b'.repeat(64);
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
    assert.match(await withdrawal.locator('#launch-status').innerText(), /철회/);
    assert.equal(await withdrawal.locator('#ga4-settings').isVisible(), false);
    assert.equal(await withdrawal.locator('script[src^="https://www.googletagmanager.com"]').count(), 0);
    await withdrawal.locator('#launch-receipts button').filter({hasText:'신청 철회'}).click();
    await withdrawal.waitForFunction(() => document.querySelector('#launch-status').textContent.includes('철회했습니다'));
    assert.deepEqual(withdrawals.map(({action,token:sent}) => ({action,token:sent})),[{action:'withdraw',token}]);
    assert.equal(tagRequests.length, 2, 'withdrawal visit never loads the tag');
    await withdrawal.close();
    const blocked = await browser.newContext({viewport:{width:375,height:812}});
    await blocked.addInitScript(() => Object.defineProperty(navigator,'globalPrivacyControl',{get:()=>true}));
    await blocked.route('**/policy-scene.js',route=>route.abort());
    await blocked.route('**/launch-config.js',route=>route.fulfill({contentType:'application/javascript',body:
      'window.policycockConfig={projectKey:"",signupEnabled:false,signupEndpoint:"",ga4MeasurementId:"G-TEST1234"}'}));
    const blockedPage = await blocked.newPage();
    await blockedPage.goto(origin+'/');
    await blockedPage.waitForTimeout(200);
    assert.equal(await blockedPage.locator('#ga4-notice').isVisible(),false);
    assert.equal(await blockedPage.locator('script[src^="https://www.googletagmanager.com"]').count(),0);
    await blocked.close();
    const blank = await browser.newContext();
    await blank.route('**/policy-scene.js',route=>route.abort());
    const blankPage = await blank.newPage();
    await blankPage.goto(origin+'/');
    assert.equal(await blankPage.locator('#ga4-settings').isVisible(),false,'unconfigured production ships no GA4 choice or tag');
    assert.equal(await blankPage.locator('script[src^="https://www.googletagmanager.com"]').count(),0);
    await blank.close();
    await context.close();
    console.log('PASS GA4 separate choice, fail-closed blank config/refusal/GPC, sanitized single page view, cross-tab withdrawal, private withdrawal link (mocked transport)');
  } finally { if (browser) await browser.close(); }
})().catch(error => {console.error(error);process.exitCode=1}).finally(() => server.close());
