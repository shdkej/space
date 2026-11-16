'use strict';
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const base=(process.env.SITE_URL||'https://policycock.aws.shdkej.com').replace(/\/$/,'');
const agencies=JSON.parse(fs.readFileSync(path.join(root,'dist/institutions.json'),'utf8')).institutions;
(async()=>{
  const browser=process.env.BROWSER_CDP
    ? await chromium.connectOverCDP(process.env.BROWSER_CDP)
    : await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
  const checks=[];
  const pass=name=>{checks.push(name);console.log('PASS '+name)};
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base,{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.person').count(),10);
    assert.equal(await page.locator('.agency-link').count(),44);
    assert.equal(await page.locator('#council-links a').count(),18);
    assert.deepEqual((await page.locator('.agency-link').evaluateAll(a=>a.map(n=>n.href))).sort(),agencies.map(a=>a.url).sort());
    assert.equal(await page.locator('link[href="ledger.css"]').count(),1);
    assert.equal(await page.locator('link[href="galaxy.css"]').count(),0);
    assert.equal(await page.locator('.outline-branches>.branch a').first().isVisible(),true);
    pass('HTTPS 200·새 CSS·정책 10·기관 44·의회 18·국회 링크');

    const fold=await page.evaluate(()=>({
      bottom:Math.max(...[...document.querySelectorAll('.person,.agency-link')].map(n=>n.getBoundingClientRect().bottom)),
      width:document.documentElement.scrollWidth,
      minTarget:Math.min(...[...document.querySelectorAll('.agency-link')].map(n=>n.getBoundingClientRect().height)),
      minFont:Math.min(...[...document.querySelectorAll('.agency-link')].map(n=>parseFloat(getComputedStyle(n).fontSize))),
      clipped:[...document.querySelectorAll('.agency-link')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent),
      asset:(()=>{const n=document.querySelector('.ledger-relief');return n.complete&&n.naturalWidth>0})()
    }));
    assert.ok(fold.bottom<=900,`last item beyond 900px: ${fold.bottom}`);
    assert.ok(fold.width<=1440&&fold.minTarget>=24&&fold.minFont>=12&&fold.asset);
    assert.deepEqual(fold.clipped,[]);
    await page.screenshot({path:path.join(root,'qa/live-1440.png')});
    pass('1440×900 정책·기관 전체 첫 화면 가독성과 Blender 장식 로드');

    const policies=await page.evaluate(()=>POLICY_DATA.map(p=>({id:p.id,title:p.policy,source:p.source})));
    for(const p of policies){
      await page.locator(`[data-policy="${p.id}"]`).click();
      assert.equal(await page.locator('#detail-title').textContent(),p.title);
      assert.equal(await page.locator('#detail-links a').first().getAttribute('href'),p.source);
      await page.keyboard.press('Escape');
    }
    for(const a of agencies){
      const link=page.locator('.agency-link').filter({hasText:a.name}).first();
      await link.click();
      assert.equal(await page.locator('#agency-dialog-title').textContent(),a.name);
      assert.equal(await page.locator('#agency-official').getAttribute('href'),a.url);
      await page.keyboard.press('Escape');
    }
    pass('정책 10건·기관 44곳 상세와 원문 링크 전수');

    await page.locator('[data-agency-filter="처"]').click();
    assert.equal(await page.locator('.agency-link').count(),6);
    await page.locator('[data-agency-filter="all"]').click();
    await page.locator('#agency-search').fill('기상청');
    assert.equal(await page.locator('.agency-link').count(),1);
    await page.locator('#agency-search').fill('');
    await page.locator('[data-policy=lee]').click();
    await page.locator('#save-policy').click();
    await page.keyboard.press('Escape');
    await page.locator('#note-lee').fill('라이브 검증 메모');
    await page.reload();
    assert.equal(await page.locator('#note-lee').inputValue(),'라이브 검증 메모');
    await page.locator('.remove-btn').click();
    pass('기관 유형·검색, 관심 정책 저장·메모 복원·삭제');

    const nojs=await browser.newContext({javaScriptEnabled:false});
    const staticPage=await nojs.newPage();await staticPage.goto(base);
    assert.equal(await staticPage.locator('a.person').count(),10);
    assert.equal(await staticPage.locator('.agency-link').count(),44);
    await nojs.close();
    pass('무스크립트 정책 10·기관 44 원문 링크');

    for(const [width,height] of [[320,568],[375,667],[768,900],[1280,800]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`);
      assert.equal(await page.locator('.person').count(),10);
      assert.equal(await page.locator('.agency-link').count(),44);
      if(width<=375){
        const shortcut=page.locator('.site-header nav a[href="#agencies"]');
        assert.equal(await shortcut.isVisible(),true);
        await shortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#agencies');
        await page.evaluate(()=>{history.replaceState(null,'',location.pathname);scrollTo({top:0,behavior:'instant'})});
      }
      await page.locator('[data-policy=lee]').click();
      assert.equal(await page.locator('#policy-dialog').evaluate(n=>n.open),true);
      await page.keyboard.press('Escape');
      const last=page.locator('.agency-link').last();
      await last.scrollIntoViewIfNeeded();await last.focus();
      assert.ok(await last.evaluate(n=>{const r=n.getBoundingClientRect();return n===document.activeElement&&r.top>=0&&r.bottom<=innerHeight}));
      await last.click();assert.equal(await page.locator('#agency-dialog-title').textContent(),agencies.at(-1).name);
      await page.keyboard.press('Escape');
      assert.equal(await last.evaluate(n=>n===document.activeElement),true);
      if(width===375)await page.screenshot({path:path.join(root,'qa/live-375-last-agency.png')});
    }
    pass('320·375·768·1280px 넘침 없음·모달·마지막 기관 키보드 접근');
    const sourceResponse=await page.goto(base+'/sources.html');
    assert.equal(sourceResponse.status(),200);
    assert.equal(await page.locator('.source-item').count(),10);
    assert.match(await page.locator('.source-page').textContent(),/지형이나 국회 건축 모형을 표시하지 않습니다/);
    assert.deepEqual(errors,[]);
    pass('출처 페이지 새 설명 10건·스크립트 오류 없음');
    fs.writeFileSync(path.join(root,'qa/live-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),url:base+'/',status:'passed',checks,fold},null,2)+'\n');
    await context.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
