'use strict';
const {chromium}=require('playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.join(__dirname,'..');
const base=(process.env.SITE_URL||'https://policy.minimalcollector.com').replace(/\/$/,'');
const isProduction=base==='https://policy.minimalcollector.com';
const dist=path.join(root,'dist');
function listFiles(dir=dist,prefix=''){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(item=>{
    const relative=path.posix.join(prefix,item.name);
    return item.isDirectory()?listFiles(path.join(dir,item.name),relative):[relative];
  });
}
(async()=>{
  const browser=process.env.BROWSER_CDP
    ? await chromium.connectOverCDP(process.env.BROWSER_CDP)
    : await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
  const checks=[];
  const pass=name=>{checks.push(name);console.log('PASS '+name)};
  try{
    const context=await browser.newContext({viewport:{width:1440,height:900}});
    // Real WebGL interaction is verified separately by verify-scene.cjs.
    // This context exercises the HTML fallback without competing for the GPU.
    await context.route('**/policy-scene.js',route=>route.abort());
    const page=await context.newPage(), errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    const response=await page.goto(base+'/?qa=1',{waitUntil:'networkidle'});
    assert.equal(response.status(),200);
    const fileChecks=[];
    for(const relative of listFiles()){
      const asset=await context.request.get(base+'/'+relative);
      assert.equal(asset.status(),200,`${relative} HTTP status`);
      if (relative === 'launch-config.js' && isProduction) {
        const configText = await asset.text();
        const match = /^window\.policycockConfig = (\{[^\n]+\});\n$/.exec(configText);
        assert.ok(match, 'production config format');
        const config = JSON.parse(match[1]);
        assert.deepEqual(Object.keys(config).sort(), ['ga4MeasurementId','projectKey','signupEnabled','signupEndpoint']);
        assert.ok(/^phc_[A-Za-z0-9]+$/.test(config.projectKey), 'public project key present');
        assert.ok(config.ga4MeasurementId === '' || config.ga4MeasurementId === 'G-BT1FX0ZMCD', 'GA4 ID absent or the verified Policycock stream');
        if (process.env.EXPECTED_GA4_ID !== undefined) assert.equal(config.ga4MeasurementId, process.env.EXPECTED_GA4_ID);
        assert.equal(typeof config.signupEnabled, 'boolean');
        assert.ok(!config.signupEnabled || config.signupEndpoint);
        assert.ok(config.signupEndpoint === '' || /^https:\/\/[a-z0-9]{26,40}\.lambda-url\.ap-northeast-2\.on\.aws\/$/.test(config.signupEndpoint), 'Seoul signup URL');
        if (process.env.EXPECTED_SIGNUP_URL !== undefined) assert.equal(config.signupEndpoint, process.env.EXPECTED_SIGNUP_URL);
        assert.equal(await page.locator('#launch-form').isVisible(), config.signupEnabled, 'live signup availability');
        assert.equal(await page.locator('#launch-pending').isVisible(), !config.signupEnabled);
        assert.match(await page.locator('.launch-agreement').innerText(), /운영자에게 바로 전달/);
      } else {
        assert.deepEqual(await asset.body(),fs.readFileSync(path.join(dist,relative)),`${relative} byte parity`);
      }
      fileChecks.push(relative);
    }
    const matchedRoutes=['/',isProduction?'/sources':'/sources.html',isProduction?'/birth-grant-map':'/birth-grant-map.html',isProduction?'/privacy':'/privacy.html'];
    for(const [route,file] of [[matchedRoutes[0],'index.html'],[matchedRoutes[1],'sources.html'],[matchedRoutes[2],'birth-grant-map.html'],[matchedRoutes[3],'privacy.html']]){
      const routeResponse=await context.request.get(base+route);
      assert.equal(routeResponse.status(),200,`${route} HTTP status`);
      assert.deepEqual(await routeResponse.body(),fs.readFileSync(path.join(dist,file)),`${route} byte parity`);
    }
    for(const retired of ['styles.css','ledger.css','assets/ledger-relief.png']){
      const retiredResponse=await context.request.get(base+'/'+retired);
      assert.notEqual(retiredResponse.status(),200,`${retired} should not remain public`);
    }
    assert.ok(fileChecks.includes('birth-grant-map.html'),'지역별 출산지원금 지도 배포 파일 보존');
    const birthResponse=await context.request.get(base+'/birth-grant-map.html');
    assert.equal(birthResponse.status(),200);
    assert.match(await birthResponse.text(),/<title>지역별 출산지원금 지도[^<]*모두의정책<\/title>/);
    pass(`${fileChecks.length}개 dist 파일 검증(배포 시 주입한 설정 포함)·세 경로 바이트 일치·출산지원금 지도 접근·구형 자산 3개 비노출`);
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.person').count(),10);
    const sheet=page.locator('#state-map .state-sheet');
    const nodes=sheet.locator('.state-node[data-state]');
    const stateDialog=page.locator('#state-policy-dialog');
    assert.equal(await sheet.count(),1);
    const stateIds=await nodes.evaluateAll(items=>items.map(n=>n.dataset.state));
    assert.ok(stateIds.length>=9);
    assert.equal(new Set(stateIds).size,stateIds.length,'unique state nodes');
    const stateNames=await nodes.locator('strong').allInnerTexts();
    assert.ok(stateNames.every(name=>name.trim()));
    const stateCases=[];
    for(let i=0;i<stateIds.length;i++){
      const node=nodes.nth(i);
      if(i===0){
        await node.focus();await page.keyboard.press('Enter');
      }else{
        await node.click();
      }
      await stateDialog.waitFor({state:'visible'});
      const cases=stateDialog.locator('.state-policy-case:visible');
      const count=await cases.count();
      assert.ok(count>=2 && count<=3,stateIds[i]+' policy case count: '+count);
      const caseTitles=await cases.locator('h4').allInnerTexts();
      assert.equal(caseTitles.length,count);
      assert.ok(caseTitles.every(title=>title.trim().length>0));
      stateCases.push(caseTitles);
      await page.keyboard.press('Escape');
      await stateDialog.waitFor({state:'hidden'});
      assert.ok(await node.evaluate(n=>n===document.activeElement),'restore focus '+stateIds[i]);
    }
    for(const area of ['.site-header nav','.galaxy-links']){
      assert.equal(await page.locator(area+' a[href="#state-map"]').isVisible(),true);
    }
    await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    pass('국가 지도 기관별 정책 사례 2~3개·키보드 열기·Escape·포커스 복귀');
    assert.equal(await page.locator('link[href="index.css"]').count(),1);
    assert.equal(await page.locator('link[href="ledger.css"],link[href="styles.css"]').count(),0);
    pass('HTTPS 200·새 CSS·정책 10건·국가 지도');

    await page.waitForSelector('#atlas[data-renderer="fallback"]');
    assert.equal(await page.locator('#galaxy-canvas').count(),1);
    const fallbackLinks=page.locator('#atlas a[data-galaxy-policy]');
    const ids=await page.evaluate(()=>POLICY_DATA.map(policy=>policy.id).sort());
    assert.deepEqual(await fallbackLinks.evaluateAll(links=>links.map(a=>a.dataset.galaxyPolicy).sort()),ids);
    const galaxyLinks=page.locator('.galaxy-links');
    assert.match(await galaxyLinks.locator('a[href="#policies"]').innerText(),/정책 사례 목록/);
    assert.ok((await galaxyLinks.locator('a[href="#state-map"]').innerText()).trim());
    const fold=await page.locator('#atlas').evaluate(atlas=>{
      const rect=atlas.getBoundingClientRect();
      return {atlasTop:rect.top,atlasBottom:rect.bottom,width:document.documentElement.scrollWidth};
    });
    assert.ok(fold.atlasTop>=0&&fold.atlasTop<900&&fold.atlasBottom>fold.atlasTop);
    assert.ok(fold.width<=1440);
    if(isProduction)await page.screenshot({path:path.join(root,'qa/live-atlas-fallback-1440.png')});
    await page.locator('.galaxy-links a[href="#policies"]').click();
    assert.equal(await page.evaluate(()=>location.hash),'#policies');
    await page.waitForFunction(()=>{const top=document.querySelector('#policies').getBoundingClientRect().top;return top>=0&&top<innerHeight},null,{timeout:3000});
    pass('1440×900 탐색 히어로·정책 사례 범위·은하 렌더러 로딩 실패 시 정책 목록 접근');

    const policies=await page.evaluate(()=>POLICY_DATA.map(p=>({id:p.id,title:p.policy,source:p.source})));
    for(const p of policies){
      await page.locator(`[data-policy="${p.id}"]`).click();
      assert.equal(await page.locator('#detail-title').textContent(),p.title);
      assert.equal(await page.locator('#detail-links a').first().getAttribute('href'),p.source);
      await page.keyboard.press('Escape');
    }
    pass('정책 10건 상세와 원문 링크 전수');
    await page.locator('[data-policy=lee]').click();
    await page.locator('#save-policy').click();
    await page.keyboard.press('Escape');
    await page.locator('#note-lee').fill('라이브 검증 메모');
    await page.reload();
    assert.equal(await page.locator('#note-lee').inputValue(),'라이브 검증 메모');
    await page.locator('.remove-btn').click();
    pass('관심 정책 저장·메모 복원·삭제');

    const nojs=await browser.newContext({javaScriptEnabled:false});
    const staticPage=await nojs.newPage();await staticPage.goto(base);
    assert.equal(await staticPage.locator('a.person').count(),10);
    const staticSheet=staticPage.locator('#state-map .state-sheet');
    assert.equal(await staticSheet.isVisible(),true);
    const staticNodes=staticSheet.locator('.state-node[data-state]');
    assert.deepEqual(await staticNodes.locator('strong').allInnerTexts(),stateNames);
    for(let i=0;i<stateIds.length;i++){
      await staticNodes.nth(i).click();
      const visibleGroup=staticPage.locator('#state-map .state-case-group:target');
      assert.equal(await visibleGroup.isVisible(),true,'no-JS state '+stateIds[i]);
      assert.deepEqual(await visibleGroup.locator('.state-policy-case:visible h4').allInnerTexts(),stateCases[i]);
    }

    const staticGalaxy=staticPage.locator('#atlas a[data-galaxy-policy]');
    assert.equal(await staticGalaxy.count(),10);
    assert.deepEqual(await staticGalaxy.evaluateAll(links=>links.map(a=>a.dataset.galaxyPolicy).sort()),ids);
    assert.equal(await staticPage.locator('.galaxy-links a[href="#state-map"]').isVisible(),true);
    assert.equal(await staticPage.locator('.galaxy-links a[href="#policies"]').isVisible(),true);
    await nojs.close();
    pass('무스크립트 정책 10건 및 국가 지도');

    for(const [width,height] of [[320,568],[375,667],[768,900],[1280,800]]){
      await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px overflow`);
      assert.equal(await page.locator('.person').count(),10);
      assert.equal(await sheet.locator('.state-node[data-state]:visible').count(),stateIds.length);
      const measured=await sheet.evaluate(el=>{
        const map=el.getBoundingClientRect();
        const items=[...el.querySelectorAll('.state-node[data-state]')].map(n=>n.getBoundingClientRect());
        return {width:map.width,height:map.height,viewport:innerHeight,
          inside:items.every(r=>r.width>0 && r.height>0 && r.left>=map.left-1 && r.right<=map.right+1 &&
            r.top>=map.top-1 && r.bottom<=map.bottom+1)};
      });
      assert.ok(measured.inside,width+'px state nodes within map');
      if(width===320){
        assert.ok(measured.width<=321 && measured.height<=measured.viewport+1,'320px entire map fits one viewport');
      }
      if(width<=375){
        const shortcut=page.locator('.site-header nav a[href="#state-map"]');
        assert.equal(await shortcut.isVisible(),true);
        assert.equal(await page.locator('#atlas').isVisible(),true);
        const title=await page.locator('#hero-title').boundingBox();
        assert.ok(title&&title.y>=0&&title.y+title.height<=height,`${width}px first-fold title: ${JSON.stringify(title)}`);
        assert.equal(await page.locator('.galaxy-links').isVisible(),true);
        const scopeShortcut=page.locator('.galaxy-links a[href="#state-map"]');
        assert.equal(await scopeShortcut.isVisible(),true);
        const policyShortcut=page.locator('.galaxy-links a[href="#policies"]');
        assert.equal(await policyShortcut.isVisible(),true);
        if(width===375&&isProduction){
          await page.waitForFunction(()=>!document.querySelector('#toast').classList.contains('visible'),null,{timeout:5000});
          await page.screenshot({path:path.join(root,'qa/live-atlas-fallback-375.png')});
        }
        await policyShortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#policies');
        await page.waitForFunction(()=>{const top=document.querySelector('#policies').getBoundingClientRect().top;return top>=0&&top<innerHeight},null,{timeout:3000});
        await scopeShortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#state-map');
        await page.waitForFunction(()=>{const top=document.querySelector('#state-map').getBoundingClientRect().top;return top>=0&&top<innerHeight},null,{timeout:3000});
        await page.evaluate(()=>{history.replaceState(null,'',location.pathname);scrollTo({top:0,behavior:'instant'})});
        await shortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#state-map');
        await page.evaluate(()=>{history.replaceState(null,'',location.pathname);scrollTo({top:0,behavior:'instant'})});
      }
      await page.locator('[data-policy=lee]').click();
      assert.equal(await page.locator('#policy-dialog').evaluate(n=>n.open),true);
      await page.keyboard.press('Escape');
      const last=nodes.last();
      await last.scrollIntoViewIfNeeded();
      assert.ok(await last.evaluate(n=>{
        const r=n.getBoundingClientRect();
        return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;
      }),width+'px 마지막 기관에 접근');
    }
    pass('320–1280px: 탐색 표제·정책 목록·국가 지도 바로가기·화면 너비와 마지막 기관 접근');
    const sourceResponse=await page.goto(base+'/sources.html');
    assert.equal(sourceResponse.status(),200);
    assert.equal(await page.locator('.source-item').count(),10);
    assert.match(await page.locator('#state-sources').textContent(),/대한민국 국가 지도/);
    assert.deepEqual(errors,[]);
    pass('출처 페이지 설명 10건·HTML 대체 탐색 스크립트 오류 없음');
    if(isProduction)fs.writeFileSync(path.join(root,'qa/live-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),url:base+'/',status:'passed',checks,fold,matchedDistFiles:fileChecks,matchedRoutes,retiredAssets:['styles.css','ledger.css','assets/ledger-relief.png']},null,2)+'\n');
    else console.log('LOCAL SMOKE ONLY: qa/live-verification.json was not written');
    await context.close();
  }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
