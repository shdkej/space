'use strict';
// Real Google tag, intercepted collection: verify transport without sending QA secrets.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');
const origin = 'https://policycock.aws.shdkej.com';
const dist = path.join(__dirname, '../dist');
const staged = process.env.GA4_PREVIEW === '1';
(async () => {
  const browser = await chromium.launch({executablePath: process.env.CHROME_PATH || chromium.executablePath(), args:['--no-sandbox']});
  try {
    const context = await browser.newContext({viewport:{width:375,height:812}});
    const requests = [], tags = [];
    await context.route('**/policy-scene.js', route => route.abort());
    if (staged) {
      for (const file of ['index.html', 'analytics-consent.js', 'ga4-consent.js', 'index.css', 'privacy.html']) {
        const url = file === 'index.html' ? origin + '/?*' : '**/' + file;
        const contentType = file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'application/javascript';
        await context.route(url, route => route.fulfill({contentType,body:fs.readFileSync(path.join(dist,file))}));
      }
      await context.route('**/launch-config.js', route => route.fulfill({contentType:'application/javascript',body:
        "window.policycockConfig={projectKey:'',signupEnabled:false,signupEndpoint:'',ga4MeasurementId:'G-BT1FX0ZMCD'};"}));
    }
    await context.route(/^https:\/\/[^/]*google-analytics\.com\//, route => {
      requests.push({url:route.request().url(),body:route.request().postData() || ''});
      return route.fulfill({status:204,body:''});
    });
    const page = await context.newPage();
    page.on('request', request => {if(request.url().includes('googletagmanager.com/gtag/js'))tags.push(request.url())});
    const secret = 'sensitive-transport-probe';
    await page.goto(origin+'/?search='+secret+'#policy='+secret,{referer:'https://www.google.com/search?q='+secret});
    await page.waitForTimeout(800);
    assert.deepEqual([tags.length,requests.length],[0,0],'no Google tag or hit before GA4 consent');
    await page.locator('#analytics-accept').click();
    await page.waitForURL(origin+'/?utm_source=google&utm_medium=organic');
    await page.waitForTimeout(4000);
    assert.equal(await page.evaluate(()=>document.referrer),'','original referrer removed by clean navigation');
    assert.equal(tags.length,1,'one Google tag load');
    assert.equal(requests.length,1,'one page view only');
    const hit = new URL(requests[0].url);
    assert.equal(hit.searchParams.get('tid'),'G-BT1FX0ZMCD');
    assert.equal(hit.searchParams.get('en'),'page_view');
    assert.equal(hit.searchParams.get('dl'),origin+'/?utm_source=google&utm_medium=organic');
    assert.ok(!hit.searchParams.get('dr') || hit.searchParams.get('dr')==='https://google.com/');
    assert.doesNotMatch(JSON.stringify({tags,requests}),new RegExp(secret));
    await page.locator('#analytics-settings').click();await page.locator('#analytics-decline').click();
    await page.waitForTimeout(800);
    assert.equal(requests.length,1,'no additional hit after withdrawal');
    console.log(`PASS ${staged?'STAGED':'LIVE'} real Google tag intercepted: pre-consent 0, sanitized page_view 1, after withdrawal 0; no collection forwarded`);
    await context.close();
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1});
