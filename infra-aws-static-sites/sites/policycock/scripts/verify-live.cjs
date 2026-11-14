const {chromium}=require('playwright-core');
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const base='https://policycock.aws.shdkej.com';
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/opt/google/chrome/chrome',headless:true,args:['--no-sandbox']});const checks=[];try{
const context=await browser.newContext();const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const response=await page.goto(base,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);checks.push('HTTPS 200 및 자산 로드');
assert.equal(await page.locator('.person').count(),10);assert.equal(await page.locator('#council-links a').count(),18);checks.push('정치인 10명·의회 18개 링크');
await page.locator('[data-policy=oh]').click();assert.equal(await page.locator('#detail-title').textContent(),'기후동행카드');await page.locator('#save-policy').click();await page.locator('#note-oh').fill('라이브 검증 메모');await page.reload();assert.equal(await page.locator('#note-oh').inputValue(),'라이브 검증 메모');checks.push('정책 선택·저장·즉시 메모 복원');
const download=page.waitForEvent('download');await page.locator('#export-map').click();const file=await download;assert.equal(JSON.parse(fs.readFileSync(await file.path(),'utf8')).policies[0].id,'oh');await page.locator('.remove-btn').click();checks.push('내보내기·저장 해제');
for(const width of [375,1440]){await page.setViewportSize({width,height:980});await page.evaluate(()=>scrollTo(0,0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(__dirname,'../qa',`live-${width}.png`),fullPage:true});}checks.push('375/1440px 라이브 렌더·가로 넘침 없음');
await page.goto(base+'/sources.html');assert.equal(await page.locator('.source-item').count(),10);checks.push('출처 페이지');assert.deepEqual(errors,[]);checks.push('브라우저 실행 오류 없음');
const result={verifiedAt:new Date().toISOString(),url:base+'/',status:'passed',checks};fs.writeFileSync(path.join(__dirname,'../qa/live-verification.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1});
