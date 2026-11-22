const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const port=4187, base=`http://127.0.0.1:${port}`;
const server=spawn('python3',['-m','http.server',String(port),'--directory',path.join(root,'dist'),'--bind','127.0.0.1'],{stdio:'ignore'});
const results=[];
const pass=label=>{results.push(label);console.log('PASS',label)};
(async()=>{
  let browser;
  try{
    for(let i=0;i<50;i++){
      try{if((await fetch(base)).ok)break;}catch{}
      await new Promise(r=>setTimeout(r,100));
    }
    browser=process.env.BROWSER_CDP
      ? await chromium.connectOverCDP(process.env.BROWSER_CDP)
      : await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
    const context=await browser.newContext({viewport:{width:1440,height:900},acceptDownloads:true});
    // Isolate HTML/storage regressions from GPU setup; verify-scene covers the integrated scene.
    await context.route('**/policy-scene.js',route=>route.abort());
    const page=await context.newPage();
    const errors=[], external=[];
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url())});
    await page.goto(base);await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('.person').count(),10);
    const sheet=page.locator('#council-map .council-sheet');
    assert.equal(await sheet.count(),1);
    assert.equal(await sheet.locator('.council-region').count(),16);
    assert.equal(await sheet.locator('.council-region li.council-local').count(),227);
    const localNames=await sheet.locator('li.council-local').allTextContents();
    assert.ok(localNames.every(name=>name.trim().length>0));
    const national=sheet.locator('a.council-national, .council-national a');
    assert.equal(await national.count(),1);
    assert.match(new URL(await national.getAttribute('href'),base).hostname,/(^|\.)assembly\.go\.kr$/);
    assert.equal(await page.locator('#agencies,#agency-dialog,.agency-link,#agency-search,#council-links').count(),0);
    for(const area of ['.site-header nav','.atlas-scope']){
      assert.equal(await page.locator(area+' a[href="#council-map"]').isVisible(),true);
    }
    pass('국회 공식 링크·광역 16곳·기초 227곳·헤더와 소개에서 의회 지도 진입');
    const box=await sheet.boundingBox();
    const aspect=Math.max(box.width,box.height)/Math.min(box.width,box.height);
    assert.ok(Math.abs(aspect-297/210)<0.04,'desktop council sheet A4 aspect');
    await page.emulateMedia({media:'print'});
    assert.equal(await sheet.isVisible(),true);
    assert.equal(await sheet.locator('li.council-local:visible').count(),227);
    const pdf=await page.pdf({preferCSSPageSize:true,printBackground:true});
    const printable=pdf.toString('latin1');
    assert.equal((printable.match(/\/Type\s*\/Page\b/g)||[]).length,1,'council map must print on one sheet');
    const mediaBox=/\/MediaBox\s*\[\s*0\s+0\s+([\d.]+)\s+([\d.]+)/.exec(printable);
    assert.ok(mediaBox,'printed page dimensions');
    const [short,long]=mediaBox.slice(1).map(Number).sort((a,b)=>a-b);
    assert.ok(Math.abs(short-595.28)<2&&Math.abs(long-841.89)<2,'printed page is A4');
    await page.emulateMedia({media:'screen'});
    pass('데스크톱 A4 비율과 국회·지방의회 A4 한 장 인쇄');

    const sceneFallback=page.locator('#policy-scene[data-status="fallback"]');
    await sceneFallback.waitFor();
    assert.equal(await sceneFallback.locator('a[href="#policies"]').isVisible(),true);
    pass('3D 모듈 실패 시 정책 목록 진입');

    const policies=await page.evaluate(()=>POLICY_DATA.map(p=>({id:p.id,title:p.policy,source:p.source})));
    for(const policy of policies){
      await page.locator(`[data-policy="${policy.id}"]`).click();
      assert.equal(await page.locator('#detail-title').textContent(),policy.title);
      assert.equal(await page.locator('#detail-links a').first().getAttribute('href'),policy.source);
      await page.keyboard.press('Escape');
    }
    pass('정책 10건 모달 제목·출처 전수 검증');

    await page.locator('[data-policy="lee"]').click();
    await page.locator('#save-policy').click();
    assert.equal(await page.locator('#saved-count').textContent(),'1');
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>document.activeElement?.matches('.person[data-policy="lee"]'),null,{timeout:2000});
    assert.equal(await page.locator('[data-policy="lee"]').evaluate(e=>e===document.activeElement),true);
    await page.locator('#note-lee').fill('<img src=x onerror=alert(1)>');
    await page.reload();
    assert.equal(await page.locator('#note-lee').inputValue(),'<img src=x onerror=alert(1)>');
    assert.equal(await page.locator('#saved-policies img').count(),0);
    await page.evaluate(()=>{const original=URL.createObjectURL.bind(URL);URL.createObjectURL=blob=>{window.__lastExportBlob=blob;return original(blob)};});
    await page.locator('#export-map').click();
    const exported=await page.evaluate(async()=>JSON.parse(await window.__lastExportBlob.text()));
    assert.equal(exported.policies[0].id,'lee');
    await page.locator('.remove-btn').click();
    await page.reload();
    assert.equal(await page.locator('#saved-count').textContent(),'0');
    pass('관심 저장·포커스 복귀·메모 XSS 방어·JSON 내보내기·삭제');
    await page.locator('[data-filter="democratic"]').click();
    assert.equal(await page.locator('.person.is-dimmed').count(),5);
    assert.equal(await page.locator('[data-filter="democratic"]').getAttribute('aria-pressed'),'true');
    await page.locator('[data-filter="all"]').click();
    await page.locator('[data-policy="lee"]').click();
    for(let i=0;i<8;i++){
      await page.keyboard.press(i%2?'Shift+Tab':'Tab');
      assert.equal(await page.evaluate(()=>!!document.activeElement?.closest('#policy-dialog')),true);
    }
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-policy="lee"]').evaluate(n=>n===document.activeElement),true);
    pass('정책 필터와 대화상자 키보드 초점 경계');

    await page.evaluate(()=>localStorage.setItem('modu-policy-map-v1','{broken'));
    await page.reload();
    assert.equal(await page.locator('.person').count(),10);
    assert.match(await page.locator('#storage-note').textContent(),/읽거나 저장하지 못/);
    await page.locator('[data-policy="lee"]').click();await page.locator('#save-policy').click();
    assert.equal(await page.locator('#saved-count').textContent(),'1');await page.keyboard.press('Escape');
    await page.evaluate(()=>localStorage.setItem('modu-policy-map-v1',JSON.stringify({unknown:{note:'x'},lee:{note:123},oh:{note:'유효'}})));
    await page.reload();
    assert.equal(await page.locator('#saved-count').textContent(),'2');
    assert.equal(await page.locator('#note-lee').inputValue(),'');
    pass('손상·미확인 저장 데이터에서 탐색 유지 및 복구');

    await page.evaluate(()=>localStorage.clear());await page.reload();
    const secondTab=await context.newPage();await secondTab.goto(base);
    await page.locator('[data-policy=lee]').click();await page.locator('#save-policy').click();await page.keyboard.press('Escape');
    await page.locator('#note-lee').fill('다른 탭에서도 유지');
    await secondTab.locator('[data-policy=oh]').click();await secondTab.locator('#save-policy').click();
    await page.reload();
    assert.equal(await page.locator('#saved-count').textContent(),'2');
    assert.equal(await page.locator('#note-lee').inputValue(),'다른 탭에서도 유지');
    assert.equal(await secondTab.locator('#saved-count').textContent(),'2');
    await secondTab.close();await page.evaluate(()=>localStorage.clear());await page.reload();
    pass('두 탭 관심 정책 병합·메모 보존·화면 동기화');

    const nojsContext=await browser.newContext({javaScriptEnabled:false});
    const nojs=await nojsContext.newPage();await nojs.goto(base);
    assert.equal(await nojs.locator('a.person').count(),10);
    assert.equal(await nojs.locator('#council-map .council-region').count(),16);
    assert.equal(await nojs.locator('#scene-start').isVisible(),false,'no-JS start action must not remain inert');
    assert.equal(await nojs.locator('.scene-fallback a[href="#policies"]').isVisible(),true);
    assert.deepEqual((await nojs.locator('a.person').evaluateAll(a=>a.map(n=>n.href))).sort(),policies.map(p=>p.source).sort());
    assert.deepEqual(await nojs.locator('#council-map li.council-local').allTextContents(),localNames);
    await nojsContext.close();
    pass('JS 비활성 상태에서도 정책 10건 원문과 전체 의회 지도 접근');

    const sources=await context.newPage();await sources.goto(base+'/sources.html');
    assert.equal(await sources.locator('.source-item').count(),10);
    assert.match(await sources.locator('.source-page').textContent(),/우리 의회 지도/);
    assert.ok(await sources.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await sources.close();
    pass('출처 페이지 10건 및 새 디자인 설명 일치');

    for(const width of [320,375,390,620,768,950,1024,1280,1440]){
      await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px horizontal overflow`);
      assert.equal(await page.locator('.person').count(),10);
      assert.equal(await sheet.locator('.council-local:visible').count(),227);
      const clipped=await sheet.locator('.council-region, .council-local').evaluateAll(nodes=>nodes.filter(n=>{
        const rect=n.getBoundingClientRect();
        return rect.left < -1 || rect.right > innerWidth+1 || n.scrollWidth>n.clientWidth+2;
      }).map(n=>n.textContent.trim().slice(0,40)));
      assert.deepEqual(clipped,[],width+'px 의회 지도 너비·의회명 잘림');
      if(width<=620){
        const shortcut=page.locator('.site-header nav a[href="#council-map"]');
        assert.equal(await shortcut.isVisible(),true,width+'px 의회 지도 바로가기');
        await shortcut.click();
        assert.equal(await page.evaluate(()=>location.hash),'#council-map');
        await page.waitForFunction(()=>scrollY>0,null,{timeout:2500});
        await page.evaluate(()=>{history.replaceState(null,'',location.pathname);scrollTo({top:0,behavior:'instant'})});
      }
      const overlaps=await page.evaluate(()=>{
        const list=[...document.querySelectorAll('.person')].map(n=>n.getBoundingClientRect());
        return list.some((a,i)=>list.slice(i+1).some(b=>Math.min(a.right,b.right)-Math.max(a.left,b.left)>3&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>3));
      });
      assert.equal(overlaps,false,`${width}px policy cards overlap`);
      if([375,1440].includes(width))await page.screenshot({path:path.join(root,'qa',`atlas-fallback-${width}.png`),fullPage:false});
    }
    pass('320–1440px 아홉 너비에서 수평 오버플로·정책 카드 겹침 없음');
    for(const [width,height] of [[320,568],[375,667]]){
      await page.setViewportSize({width,height});
      await page.locator('[data-policy=lee]').click();
      assert.ok(await page.locator('#policy-dialog .dialog-close').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}));
      await page.locator('#save-policy').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#save-policy').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight}));
      await page.keyboard.press('Escape');
      const last=sheet.locator('.council-local').last();
      await last.scrollIntoViewIfNeeded();
      assert.ok(await last.evaluate(n=>{
        const r=n.getBoundingClientRect();
        return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth;
      }),width+'px 마지막 기초의회에 접근');
    }
    pass('320×568·375×667 정책 모달과 마지막 기초의회 접근');
    await page.setViewportSize({width:375,height:667});
    await page.locator('[data-policy="lee"]').click();
    assert.ok(await page.locator('#policy-dialog .dialog-close').isVisible());
    await page.keyboard.press('Escape');
    pass('작은 화면에서 정책 모달 진입·닫기');

    const fallback=await browser.newContext();
    const missing=await fallback.newPage();
    await missing.route('**/app.js',route=>route.abort());await missing.goto(base);
    assert.equal(await missing.locator('a.person').count(),10);
    assert.equal(await missing.locator('#council-map li.council-local').count(),227);
    await fallback.close();
    pass('앱 스크립트 오류에도 정적 링크 보존');
    const failed=await browser.newContext(),failure=await failed.newPage();
    await failure.route('**/data.js',route=>route.abort());await failure.goto(base);
    assert.equal(await failure.locator('a.person').count(),10);
    assert.equal(await failure.locator('#council-map li.council-local').count(),227);
    await failed.close();
    pass('정책 데이터 스크립트 실패에도 정적 정책 링크와 의회 지도 보존');
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    pass('브라우저 스크립트 오류·자동 외부 요청 없음');
    fs.writeFileSync(path.join(root,'qa','verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),status:'passed',checks:results,limits:['현행 정책 효력과 외부 원문 응답은 검증하지 않음','실제 사용자 조사 및 운영 배포는 별도 승인·검증 대상']},null,2)+'\n');
    await context.close();
  }finally{if(browser)await browser.close();server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1});
