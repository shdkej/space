'use strict';
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const base=(process.env.SITE_URL||'https://policycock.aws.shdkej.com').replace(/\/$/,'');
const isProduction=base==='https://policycock.aws.shdkej.com';
const dist=path.join(root,'dist');
function listFiles(dir=dist,prefix=''){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
    const relative=path.posix.join(prefix,item.name);
    return item.isDirectory()?listFiles(path.join(dir,item.name),relative):[relative];
  });
}
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
    const fileChecks=[];
    for(const relative of listFiles()){
      const asset=await context.request.get(base+'/'+relative);
      assert.equal(asset.status(),200,`${relative} HTTP status`);
      assert.deepEqual(await asset.body(),fs.readFileSync(path.join(dist,relative)),`${relative} byte parity`);
      fileChecks.push(relative);
    }
    const matchedRoutes=['/',isProduction?'/sources':'/sources.html'];
    for(const [route,file] of [[matchedRoutes[0],'index.html'],[matchedRoutes[1],'sources.html']]){
      const routeResponse=await context.request.get(base+route);
      assert.equal(routeResponse.status(),200,`${route} HTTP status`);
      assert.deepEqual(await routeResponse.body(),fs.readFileSync(path.join(dist,file)),`${route} byte parity`);
    }
    for(const retired of ['styles.css','ledger.css','assets/ledger-relief.png']){
      const retiredResponse=await context.request.get(base+'/'+retired);
      assert.notEqual(retiredResponse.status(),200,`${retired} should not remain public`);
    }
    pass(`${fileChecks.length}개 dist 파일·두 경로 바이트 일치·구형 자산 3개 비노출`);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.person').count(),10);
    assert.equal(await page.locator('.agency-link').count(),44);
    assert.equal(await page.locator('#council-links a').count(),18);
    assert.deepEqual((await page.locator('.agency-link').evaluateAll(a=>a.map(n=>n.href))).sort(),agencies.map(a=>a.url).sort());
    assert.equal(await page.locator('link[href="index.css"]').count(),1);
    assert.equal(await page.locator('link[href="ledger.css"],link[href="styles.css"]').count(),0);
    assert.equal(await page.locator('.outline-branches>.branch a').first().isVisible(),true);
    pass('HTTPS 200·새 CSS·정책 10·기관 44·의회 18·국회 링크');

    const fold=await page.evaluate(()=>({
      policyBottom:Math.max(...[...document.querySelectorAll('.person')].map(n=>n.getBoundingClientRect().bottom)),
      mapBottom:document.querySelector('.overview-agencies').getBoundingClientRect().bottom,
      kinds:[...document.querySelectorAll('.overview-agencies-kinds span')].map(n=>n.textContent.trim()),
      width:document.documentElement.scrollWidth,
      minTarget:Math.min(...[...document.querySelectorAll('.agency-link')].map(n=>n.getBoundingClientRect().height)),
      minFont:Math.min(...[...document.querySelectorAll('.agency-link')].map(n=>parseFloat(getComputedStyle(n).fontSize))),
      clipped:[...document.querySelectorAll('.agency-link')].filter(n=>n.scrollWidth>n.clientWidth+2).map(n=>n.textContent)
    }));
    assert.ok(fold.policyBottom<=900&&fold.mapBottom<=900,`overview beyond 900px: ${JSON.stringify(fold)}`);
    assert.deepEqual(fold.kinds,['부 19','처 6','청 19']);
    assert.ok(fold.width<=1440&&fold.minTarget>=39&&fold.minFont>=17);
    assert.deepEqual(fold.clipped,[]);
    if(isProduction)await page.screenshot({path:path.join(root,'qa/live-editorial-map-1440.png')});
    pass('1440×900 정책 10건 이름·기관 44곳의 범위와 유형을 한 조망면에 표시');

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
        assert.equal(await page.locator('.overview-counts').isVisible(),true);
        const overview=await page.locator('.overview-counts').evaluate(n=>({text:n.textContent,top:n.getBoundingClientRect().top,bottom:n.getBoundingClientRect().bottom}));
        assert.match(overview.text,/정책 사례 10건/);
        assert.match(overview.text,/중앙행정기관 44곳/);
        assert.ok(overview.top>=0&&overview.bottom<=height,`${width}px first-fold scope: ${JSON.stringify(overview)}`);
        const listShortcut=page.locator('.overview-counts a[href="#agency-list"]');
        assert.equal(await listShortcut.isVisible(),true);
        if(width===375&&isProduction)await page.screenshot({path:path.join(root,'qa/live-editorial-map-375.png')});
        await listShortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#agency-list');
        await page.waitForFunction(()=>{const top=document.querySelector('#agency-list').getBoundingClientRect().top;return top>=0&&top<innerHeight},null,{timeout:3000});
        const listTop=await page.locator('#agency-list').evaluate(n=>n.getBoundingClientRect().top);
        assert.ok(listTop>=0&&listTop<height,`${width}px agency list anchor top: ${listTop}`);
        await page.evaluate(()=>{history.replaceState(null,'',location.pathname);scrollTo({top:0,behavior:'instant'})});
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
      if(width===375&&isProduction)await page.screenshot({path:path.join(root,'qa/live-editorial-map-375-last-agency.png')});
    }
    pass('320·375px 첫 화면 범위·명단 바로가기, 320·375·768·1280px 넘침 없음·모달·마지막 기관 키보드 접근');
    const sourceResponse=await page.goto(base+'/sources.html');
    assert.equal(sourceResponse.status(),200);
    assert.equal(await page.locator('.source-item').count(),10);
    assert.match(await page.locator('.source-page').textContent(),/44개 기관명은 이어지는 본문/);
    assert.deepEqual(errors,[]);
    pass('출처 페이지 새 설명 10건·스크립트 오류 없음');
    if(isProduction)fs.writeFileSync(path.join(root,'qa/live-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),url:base+'/',status:'passed',checks,fold,matchedDistFiles:fileChecks,matchedRoutes,retiredAssets:['styles.css','ledger.css','assets/ledger-relief.png']},null,2)+'\n');
    else console.log('LOCAL SMOKE ONLY: qa/live-verification.json was not written');
    await context.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
