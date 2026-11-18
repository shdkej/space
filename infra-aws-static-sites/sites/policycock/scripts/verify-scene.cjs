'use strict';
const {chromium}=require('playwright-core');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const base=(process.env.SITE_URL||'http://127.0.0.1:4193').replace(/\/$/,'');
const live=base.startsWith('https://policycock.aws.shdkej.com');
const server=process.env.SITE_URL?null:spawn('python3',['-m','http.server','4193','--directory',path.join(root,'dist'),'--bind','127.0.0.1'],{stdio:'ignore'});
const checks=[], errors=[];
const pass=name=>{checks.push(name);console.log('PASS '+name)};
const shot=name=>path.join(root,'qa',`${live?'live-':''}atlas-${name}.png`);
const nextFrames=page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
async function settle(page){await page.waitForTimeout(1000);await nextFrames(page);}
const positions=page=>page.locator('[data-scene-policy]').evaluateAll(nodes=>nodes.map(n=>({id:n.dataset.scenePolicy,x:parseFloat(n.style.left),y:parseFloat(n.style.top)})));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
async function reset(page){await page.locator('#scene-reset').click();await settle(page);assert.equal(await page.locator('#scene-detail').isVisible(),false);}
async function checkLayout(page,width){
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px horizontal overflow`);
  const bounds=await page.locator('[data-scene-policy]').evaluateAll(nodes=>nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.dataset.scenePolicy,x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height,visible:getComputedStyle(n).visibility};}));
  assert.equal(bounds.length,10);
  assert.ok(bounds.every(r=>r.visible==='visible'&&r.x>=0&&r.right<=width&&r.width>=44&&r.height>=44),`${width}px clipped or small labels: ${JSON.stringify(bounds)}`);
  const overlaps=[];
  bounds.forEach((a,i)=>bounds.slice(i+1).forEach(b=>{if(Math.min(a.right,b.right)-Math.max(a.x,b.x)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)>2)overlaps.push([a.id,b.id]);}));
  assert.deepEqual(overlaps,[],`${width}px label overlap`);
}
(async()=>{let browser;try{
  let serving=false;
  for(let i=0;i<40;i++){try{if((await fetch(base)).ok){serving=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}
  assert.ok(serving,'preview server');
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext({viewport:{width:1440,height:900},hasTouch:true});
  const page=await context.newPage();page.setDefaultTimeout(45000);
  page.on('pageerror',e=>errors.push(e.message));
  const started=Date.now();await page.goto(base);await page.evaluate(()=>document.fonts.ready);
  await page.waitForSelector('#policy-scene[data-status="ready"]',{timeout:60000});
  const readyMs=Date.now()-started;
  assert.equal(await page.locator('#policy-scene canvas').count(),1);
  await settle(page);await checkLayout(page,1440);
  const scope=await page.locator('.atlas-scope').boundingBox();assert.ok(scope.y+scope.height<=900);
  await page.screenshot({path:shot('1440')});
  pass('실제 WebGL 캔버스·정책 10개·1440px 장면과 자료 범위');

  // Drag starts on a label: a common interaction must rotate, not select.
  const before=await positions(page);
  const label=await page.locator('[data-scene-policy="lee"]').boundingBox();
  await page.mouse.move(label.x+label.width/2,label.y+label.height/2);
  await page.mouse.down();await page.mouse.move(label.x+label.width/2+120,label.y+label.height/2+40,{steps:7});await page.mouse.up();
  await page.mouse.move(10,10);await settle(page);
  const rotated=await positions(page);assert.ok(rotated.some((p,i)=>distance(p,before[i])>12),'drag changes projected positions');
  assert.equal(await page.locator('#scene-detail').isVisible(),false,'drag must not select');
  await reset(page);
  pass('타일 라벨 위 드래그로 실제 카메라 회전·클릭 분리·전체 복귀');

  const assembled=await positions(page);
  await page.locator('#scene-expand').click();await settle(page);
  const expanded=await positions(page);assert.ok(expanded.some((p,i)=>distance(p,assembled[i])>12),'expanded geometry moves');
  assert.equal(await page.locator('#scene-expand').getAttribute('aria-pressed'),'true');
  await page.screenshot({path:shot('expanded')});
  // Hold the CSS backdrop constant so the comparison measures the rendered lighting.
  await page.locator('#atlas').evaluate(n=>n.style.background='#f7f8f2');
  await page.locator('#scene-evening').click();await settle(page);
  assert.equal(await page.locator('#policy-scene').getAttribute('data-lighting'),'evening');
  const evening=await page.locator('#policy-scene canvas').screenshot();
  await page.locator('#scene-day').click();await settle(page);
  const day=await page.locator('#policy-scene canvas').screenshot();assert.notDeepEqual(day,evening,'lighting changes rendered pixels');
  await page.locator('#atlas').evaluate(n=>n.style.removeProperty('background'));
  await page.locator('#scene-assemble').click();await reset(page);
  pass('펼침/모으기 실제 좌표 변화·두 조명의 렌더 결과 변화');

  await page.locator('[data-scene-policy="lee"]').focus();await page.keyboard.press('Enter');
  await page.waitForFunction(()=>document.querySelector('#scene-detail-title')?.textContent==='청년기본소득'&&!document.querySelector('#scene-detail').hidden);
  await settle(page);
  assert.equal(await page.locator('#policy-dialog').evaluate(n=>n.open),false,'selection keeps scene visible');
  assert.ok((await positions(page)).filter((p,i)=>p.id!=='lee'&&distance(p,assembled[i])>8).length>=2,'camera moves at least two unselected tiles');
  await page.screenshot({path:shot('selected')});
  await page.locator('#scene-save').click();assert.equal(await page.locator('#saved-count').textContent(),'1');
  assert.ok(await page.locator('[data-scene-policy="lee"]').evaluate(n=>n.classList.contains('is-saved')));
  await page.locator('#scene-read').click();assert.equal(await page.locator('#detail-title').textContent(),'청년기본소득');
  await page.keyboard.press('Escape');assert.equal(await page.locator('#scene-read').evaluate(n=>n===document.activeElement),true);
  await reset(page);
  await page.evaluate(()=>{policyScene.select('lee');policyScene.select('oh');policyScene.reset();});await settle(page);
  assert.equal(await page.locator('#scene-detail').isVisible(),false);
  pass('키보드 선택·카메라 접근·상세/저장 동기화·모달 포커스 복귀·빠른 선택 취소');

  // Prefer immediate transitions in the responsive checks; the earlier checks used normal motion.
  await page.emulateMedia({reducedMotion:'reduce'});
  for(const width of [320,375,390,414,768,1024,1100,1101,1280,1440]){
    await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));
    await settle(page);await checkLayout(page,width);
    assert.ok(await page.locator('[data-scene-policy="lee"]').evaluate(n=>n.classList.contains('is-saved')),`${width}px saved marker after rebuild`);
    if(width===390)await page.screenshot({path:shot('390')});
  }
  pass('320–1440px 10개 폭 라벨 비겹침·44px 대상·저장 표시 유지');
  await page.setViewportSize({width:390,height:844});await settle(page);
  assert.equal(await page.locator('#policy-scene').getAttribute('data-rotation'),'false');
  assert.equal(await page.locator('#policy-scene').evaluate(n=>getComputedStyle(n).touchAction),'pan-y');
  await page.locator('#scene-touch').click();assert.equal(await page.locator('#policy-scene').evaluate(n=>getComputedStyle(n).touchAction),'none');
  const touchBefore=await positions(page);
  const tile=await page.locator('[data-scene-policy="lee"]').boundingBox();
  const cdp=await context.newCDPSession(page);
  const x=tile.x+tile.width/2,y=tile.y+tile.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+i*12,y:y+i*4}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await settle(page);
  assert.ok((await positions(page)).some((p,i)=>distance(p,touchBefore[i])>8),'touch rotates camera');
  assert.equal(await page.locator('#scene-detail').isVisible(),false);
  await page.locator('#scene-touch').click();await reset(page);
  await page.locator('[data-scene-policy="lee"]').tap();await nextFrames(page);
  assert.equal(await page.locator('#scene-detail').isVisible(),true,'reduced motion selection completes within two frames');
  assert.equal(await page.locator('#scene-detail-title').textContent(),'청년기본소득');
  await page.locator('#scene-back').click();await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await settle(page);
  const canvasBox=await page.locator('#policy-scene').boundingBox();const startY=Math.min(700,canvasBox.y+canvasBox.height-35);
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:195,y:startY}]});
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:195,y:startY-i*25}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.waitForFunction(()=>scrollY>50);await cdp.detach();
  pass('모션 감소·모바일 실제 터치 회전/선택·기본 세로 스크롤');

  await page.evaluate(()=>document.querySelector('#policy-scene canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await page.waitForSelector('#policy-scene[data-status="fallback"]');
  assert.equal(await page.locator('#policy-scene canvas').count(),0);assert.equal(await page.evaluate(()=>typeof policyScene),'undefined');
  assert.equal(await page.locator('.person').count(),10);assert.equal(await page.locator('.agency-link').count(),44);
  pass('WebGL 실행 중 손실 시 자원 정리·HTML 탐색 유지');
  await context.close();

  for(const failure of ['module','webgl','partial']){
    const ctx=await browser.newContext();const p=await ctx.newPage();
    p.on('pageerror',e=>errors.push(e.message));
    if(failure==='module')await p.route('**/policy-scene.js',r=>r.abort());
    else await p.addInitScript(mode=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){if((mode==='webgl'&&kind.startsWith('webgl'))||(mode==='partial'&&kind==='2d'))return null;return original.call(this,kind,...args);};},failure);
    await p.goto(base);await p.waitForSelector('#policy-scene[data-status="fallback"]',{timeout:60000});
    assert.equal(await p.locator('#policy-scene canvas').count(),0);assert.equal(await p.evaluate(()=>typeof policyScene),'undefined');
    await p.locator('[data-policy="lee"]').click();assert.equal(await p.locator('#detail-title').textContent(),'청년기본소득');
    await ctx.close();
  }
  pass('모듈 실패·WebGL 미지원·초기화 도중 실패 시 정리와 정책 상세 유지');
  assert.deepEqual(errors,[]);pass('처리되지 않은 브라우저 스크립트 오류 없음');
  fs.writeFileSync(path.join(root,'qa',`${live?'live-':''}scene-verification.json`),JSON.stringify({verifiedAt:new Date().toISOString(),url:base,status:'passed',checks,desktopReadyMs:readyMs,browser:await browser.version(),performanceBoundary:'Headless Chrome software WebGL; real device FPS/battery not measured',screenshots:['1440','expanded','selected','390'].map(n=>path.basename(shot(n)))},null,2)+'\n');
}finally{if(browser)await browser.close();server?.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
