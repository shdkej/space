'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {spawn} = require('node:child_process');
const {chromium} = require('playwright-core');
const {setTimeout: delay} = require('node:timers/promises');

const root = process.env.SITE_ROOT || path.resolve(__dirname, '..');
const live = Boolean(process.env.SITE_URL);
const url = process.env.SITE_URL || 'http://127.0.0.1:4193';
const labels = '#atlas [data-galaxy-policy]';

async function verifyLabels(page) {
  const policies = await page.evaluate(() => POLICY_DATA.map(p => ({id:p.id, title:p.policy})));
  assert.equal(policies.length, 10);
  const banks = page.locator('#atlas .galaxy-bank');
  assert.equal(await banks.count(),2);
  for(const bank of await banks.all()) assert.equal(await bank.locator('[data-galaxy-policy]').count(),5);
  const ids = await page.locator(labels).evaluateAll(nodes => nodes.map(n => n.dataset.galaxyPolicy));
  assert.deepEqual(ids.sort(), policies.map(p => p.id).sort());
  const missed = await page.locator(labels).evaluateAll(nodes => nodes.flatMap(n => {
    const rect = n.getBoundingClientRect();
    const x = (rect.left + rect.right) / 2;
    const y = (rect.top + rect.bottom) / 2;
    const hit = document.elementFromPoint(x,y);
    const rootBox = n.closest('#atlas').getBoundingClientRect();
    const visible = rect.width > 0 && rect.height > 0 && rect.left >= 0 &&
      rect.right <= innerWidth + 1 && rect.top >= rootBox.top - 1 && rect.bottom <= rootBox.bottom + 1;
    // The hero can extend below the fold on a small screen.
    const reachable = y < 0 || y >= innerHeight || (hit && n.contains(hit));
    return visible && reachable ? [] : [n.dataset.galaxyPolicy];
  }));
  assert.deepEqual(missed, [], 'each visible planet label must be unobscured and within the hero');
  return policies;
}

async function verifyFirstScreen(page) {
  const bounds=await page.evaluate(()=>{
    const hero=document.querySelector('#atlas').getBoundingClientRect();
    const header=document.querySelector('.site-header').getBoundingClientRect();
    const next=document.querySelector('.ledger-overview').getBoundingClientRect();
    const links=document.querySelector('.galaxy-links').getBoundingClientRect();
    const title=document.querySelector('.galaxy-intro-copy').getBoundingClientRect();
    const targets=[...document.querySelectorAll('#atlas [data-galaxy-policy]')].map(a=>a.getBoundingClientRect());
    const overlap=targets.some(r=>r.bottom>links.top+1 ||
      (r.top<title.bottom && r.bottom>title.top && r.left<title.right && r.right>title.left));
    return {height:innerHeight,first:header.top,top:hero.top,headerBottom:header.bottom,bottom:hero.bottom,next:next.top,overlap};
  });
  assert.ok(Math.abs(bounds.first)<=1 && Math.abs(bounds.top-bounds.headerBottom)<=1 &&
    Math.abs(bounds.bottom-bounds.height)<=1 && bounds.next>=bounds.height-1 && !bounds.overlap,
    'first screen must fit its header, hero, policy links and footer: '+JSON.stringify(bounds));
}

async function openAndClose(page, policy, method) {
  const target = page.locator('#atlas [data-galaxy-policy="' + policy.id + '"]');
  if (method === 'keyboard') {
    await target.focus();
    await page.keyboard.press('Enter');
  } else if (method === 'touch') {
    await target.tap();
  } else {
    await target.click();
  }
  await page.locator('#policy-dialog[open]').waitFor();
  assert.equal(await page.locator('#detail-title').innerText(), policy.title);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#policy-dialog').open);
  assert.ok(await target.evaluate(n => n === document.activeElement), 'closing policy restores source focus');
}

async function snapshot(page,name) {
  const directory = path.join(root,'qa');
  fs.mkdirSync(directory,{recursive:true});
  await page.locator('#atlas').screenshot({path:path.join(directory,(live?'live-':'')+'galaxy-'+name+'.png')});
}

async function verifyCanvas(page) {
  const canvas = page.locator('#galaxy-canvas');
  await canvas.waitFor();
  assert.ok(await canvas.evaluate(n=>window.__galaxyQaGlCanvases.has(n)),'renderer acquired a WebGL context on this canvas');
  const {width,height} = await canvas.boundingBox();
  assert.ok(width > 0 && height > 0);
  // Decode a compositor screenshot: stale WebGL drawing buffers can be cleared after presentation.
  const pixels = await canvas.screenshot();
  const contrast = await page.evaluate(async encoded => {
    const src = await createImageBitmap(await (await fetch('data:image/png;base64,'+encoded)).blob());
    const sample = document.createElement('canvas');
    sample.width = 320; sample.height = 180;
    const ctx = sample.getContext('2d');
    ctx.drawImage(src,0,0,320,180);
    const data = ctx.getImageData(0,0,320,180).data;
    let low=255,high=0;
    for(let i=0;i<data.length;i+=4) {
      const bright=Math.max(data[i],data[i+1],data[i+2]);
      low=Math.min(low,bright);high=Math.max(high,bright);
    }
    src.close();
    return high-low;
  },pixels.toString('base64'));
  assert.ok(contrast>8,'galaxy screenshot has visible contrast');
}

async function checkMotion(page) {
  // Query positions and animations after the first layout. Opacity-only effects need not move hit targets.
  const read=()=>page.locator(labels).evaluateAll(nodes=>nodes.map(n=>{
    const r=n.getBoundingClientRect();return [r.x,r.y];
  }));
  const before=await read();
  await delay(300);
  const after=await read();
  assert.ok(before.every((p,i)=>Math.hypot(p[0]-after[i][0],p[1]-after[i][1])<=1.5),
    'reduced motion keeps interactive targets stable');
}

async function main() {
  const server = live ? null : spawn('python3',
    ['-m','http.server','4193','--bind','127.0.0.1','--directory',path.join(root,'dist')],
    {stdio:'ignore'});
  let browser;
  try {
    if(server) {
      for(let i=0;i<60;i++) {
        if(server.exitCode !== null) throw new Error('local galaxy QA server exited');
        try { if((await fetch(url)).ok) break; } catch {}
        await delay(80);
      }
    }
    browser=await chromium.launch({executablePath:process.env.CHROME_PATH || chromium.executablePath(),
      headless:true,args:['--no-sandbox','--enable-unsafe-swiftshader']});
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    await context.addInitScript(()=>{
      const original=HTMLCanvasElement.prototype.getContext;
      window.__galaxyQaGlCanvases=new WeakSet();
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        const result=original.call(this,type,...args);
        if(result && ['webgl2','webgl','experimental-webgl'].includes(type)) window.__galaxyQaGlCanvases.add(this);
        return result;
      };
    });
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.goto(url);
    await page.locator('#atlas[data-renderer="webgl"]').waitFor({timeout:45000});
    await page.evaluate(()=>document.fonts.ready);
    if(await page.locator('#analytics-decline').isVisible())await page.locator('#analytics-decline').click();
    await verifyFirstScreen(page);
    await verifyCanvas(page);
    const motion=page.locator('#galaxy-motion');
    await motion.click();
    assert.equal(await page.locator('#atlas').getAttribute('data-motion'),'paused');
    await motion.click();
    assert.equal(await page.locator('#atlas').getAttribute('data-motion'),'running');
    const policies=await verifyLabels(page);
    await snapshot(page,'desktop');
    for(const policy of policies) await openAndClose(page,policy,'pointer');

    const phone=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,reducedMotion:'reduce'});
    const mobile=await phone.newPage();
    mobile.on('pageerror',e=>errors.push(e.message));
    await mobile.goto(url);
    await mobile.locator('#atlas:is([data-renderer="webgl"],[data-renderer="fallback"])').waitFor();
    await mobile.evaluate(()=>document.fonts.ready);
    if(await mobile.locator('#analytics-decline').isVisible())await mobile.locator('#analytics-decline').click();
    for (const [width,height] of [[320,568],[375,667],[768,812],[844,390],[1920,1200]]) {
      await mobile.setViewportSize({width,height});
      await mobile.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
      await verifyFirstScreen(mobile);
      await verifyLabels(mobile);
      await checkMotion(mobile);
      assert.ok(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      if(width===375) await snapshot(mobile,'mobile');
    }
    await mobile.setViewportSize({width:375,height:812});
    await openAndClose(mobile,policies[0],'touch');
    await openAndClose(mobile,policies.at(-1),'keyboard');

    const plain=await browser.newContext({javaScriptEnabled:false});
    const staticPage=await plain.newPage();
    await staticPage.goto(url);
    const staticTargets=await staticPage.locator('#atlas a[data-galaxy-policy]').evaluateAll(nodes=>
      nodes.map(n=>({id:n.dataset.galaxyPolicy,url:n.href})).sort((a,b)=>a.id.localeCompare(b.id)));
    const sourceLinks=await page.evaluate(()=>POLICY_DATA.map(p=>({id:p.id,url:p.source})).sort((a,b)=>a.id.localeCompare(b.id)));
    assert.deepEqual(staticTargets,sourceLinks,'no-JS planets link directly to the matching sources');

    const fallback=await browser.newContext({viewport:{width:1280,height:800}});
    await fallback.addInitScript(()=>{
      const orig=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(kind,...args) {
        if(['webgl2','webgl','experimental-webgl'].includes(kind)) return null;
        return orig.call(this,kind,...args);
      };
    });
    const degraded=await fallback.newPage();
    degraded.on('pageerror',e=>errors.push(e.message));
    await degraded.goto(url);
    await degraded.locator('#atlas[data-renderer="fallback"]').waitFor();
    // A failed renderer may retain HTML planet buttons or offer the normal policy list.
    const list=degraded.locator('.person[data-policy]');
    assert.equal(await list.count(),10);
    await list.first().click();
    await degraded.locator('#policy-dialog[open]').waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS WebGL hero, ten policy mappings, mobile/touch, reduced-motion labels, keyboard focus and WebGL fallback');
  } finally {
    try { if(browser) await browser.close(); } finally { if(server) server.kill(); }
  }
}
main().catch(error=>{ console.error(error);process.exitCode=1; });
