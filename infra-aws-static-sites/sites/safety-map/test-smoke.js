const fs = require('fs');
const path = __dirname;
const html = fs.readFileSync(`${path}/index.html`, 'utf8');
const js = fs.readFileSync(`${path}/app.js`, 'utf8');
const css = fs.readFileSync(`${path}/styles.css`, 'utf8');
const { containsSensitiveInput } = require('./app.js');
const required = ['mode-toggle', 'display-disclosure', 'report-form', 'city-grid', 'ad-slot', 'fixture-map', 'demo-layer-toggle', 'demo-roads'];
for (const item of required) if (!html.includes(item)) throw new Error(`missing UI anchor: ${item}`);
if (!js.includes('no network requests') || !html.includes('GRAY / NO LIVE DATA')) throw new Error('missing conservative data semantics');
const expectedCities = ['Rome', 'Palermo', 'Catania', 'Naples', 'Istanbul', 'Cairo', 'Barcelona', 'Paris', 'London', 'New York'];
for (const city of expectedCities) if (!js.includes(`name:'${city}'`)) throw new Error(`missing required city: ${city}`);
const sourceCount = (js.match(/url:'https:\/\//g) || []).length;
if (sourceCount !== 10) throw new Error(`expected 10 fixture sources, found ${sourceCount}`);
if (!js.includes("cities.map((c) => card(c))") || !js.includes('COVERAGE: city-level context only; no live street, road, block, or incident data')) throw new Error('every city card must render source/checked/confidence/coverage limits');
if (js.includes("kind:'caution'") || js.includes('CONTEXT READY') || js.includes('NO LIVE FEED')) throw new Error('risk-semantic fixture labels remain');
if (!js.includes("classList.toggle('demo-visible')") || !html.includes('비지리적 fixture UI') || !js.includes('비지리적 fixture 도식')) throw new Error('missing default-off, non-geographic map fixture boundary');
for (const realLabel of ['CENTRO', 'TESTACCIO', 'TERMINI', 'data-marker="Centro"', 'data-marker="Termini"', 'data-marker="Testaccio"']) if (html.includes(realLabel)) throw new Error(`real geographic fixture label remains: ${realLabel}`);
for (const syntheticLabel of ['ZONE A', 'ZONE B', 'ZONE C', 'data-marker="Zone A"', 'data-marker="Zone B"', 'data-marker="Zone C"']) if (!html.includes(syntheticLabel)) throw new Error(`missing synthetic fixture label: ${syntheticLabel}`);
if (!html.includes('광고 / 제휴 안내') || !html.includes('지도, 출처, 정렬 로직과 독립')) throw new Error('ad labeling/separation is incomplete');
for (const phrase of ['전송·저장·대기열 등록·제출을 하지 않습니다', 'URL·@계정·전화번호·좌표(소수점/DMS/Plus Code)', '이 브라우저에서 입력 점검하기']) if (!html.includes(phrase)) throw new Error(`missing report privacy disclosure: ${phrase}`);
for (const fragment of ['https?:\\/\\/', '\\B@\\w+', '\\d{1,2}\\.\\d{3,}', '[23456789CFGHJMPQRVWX]{2,8}']) if (!js.includes(fragment)) throw new Error(`missing sensitive-input rejection: ${fragment}`);
const sensitiveCases = [
  'https://example.test/notice', 'alice@example.com', '@traveler_handle', '+82 10 1234 5678',
  '123 Example Street', 'Via Roma 12', '서울시 강남구 테헤란로 123',
  '41.9028, 12.4964', "41° 54′ 10″ N", '8FVC9G8F+5W'
];
for (const value of sensitiveCases) if (!containsSensitiveInput(value)) throw new Error(`sensitive input was accepted: ${value}`);
const benignTravelObservation = '늦은 시간 이동 전 공식 운행 공지를 확인했어요.';
if (containsSensitiveInput(benignTravelObservation)) throw new Error('benign travel observation was rejected');
if (js.includes('임시 검토 대기열에 저장했습니다') || js.includes('localStorage') || js.includes('fetch(')) throw new Error('report must not persist, queue, or send data');
if (css.length < 8000) throw new Error(`stylesheet is unexpectedly small (${css.length} bytes)`);
for (const selector of ['.masthead', '.fixture-map', '.city-grid', '.lower-grid', '.ad-slot', 'form {', '@media (max-width:680px)', 'overflow-x:hidden']) {
  if (!css.includes(selector)) throw new Error(`missing responsive style contract: ${selector}`);
}
if (!css.includes('--map:#c8ccc8') || !css.includes('.demo-visible .demo-roads')) throw new Error('map must keep its neutral, default-off fixture presentation');
console.log('safety-map smoke test passed: 10 transparent cards, gray/default-off fixture map, independent ad, local-only report validation');
