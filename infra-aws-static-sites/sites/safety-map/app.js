/* Fixture-only MVP: no network requests, tracking, geolocation, or real-time claims. */
const sensitiveInput = /(?:https?:\/\/|www\.|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b|\B@\w+|\+?\d[\d\s().-]{6,}|\b(?:via|street|st\.|road|rd\.|avenue|ave\.)\s+[A-Z0-9][A-Z0-9 .'-]*\s+\d+[A-Z]?\b|\b(?:street|st\.|road|rd\.|avenue|ave\.|호텔|숙소|주소)\b|(?:[가-힣]+(?:시|도)\s+)?(?:[가-힣]+(?:구|군|동)\s+)?[가-힣0-9-]+(?:로|길)\s*\d+(?:-\d+)?\b|\b-?\d{1,2}\.\d{3,}\s*[,/]\s*-?\d{1,3}\.\d{3,}\b|\b\d{1,2}[°º]\s*\d{1,2}[′']\s*\d{1,2}(?:[″\"])?\s*[NSEW]\b|\b[23456789CFGHJMPQRVWX]{2,8}\+[23456789CFGHJMPQRVWX]{2,}\b)/i;
function containsSensitiveInput(value) { return sensitiveInput.test(String(value)); }
if (typeof module !== 'undefined') module.exports = { containsSensitiveInput };

if (typeof document !== 'undefined') {
const cities = [
  {name:'Rome',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내와 현지 이동 정보를 여는 시작점',source:'UK FCDO travel advice',url:'https://www.gov.uk/foreign-travel-advice/italy'},
  {name:'Palermo',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내를 출발 전 다시 확인',source:'UK FCDO Italy advice',url:'https://www.gov.uk/foreign-travel-advice/italy'},
  {name:'Catania',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내를 출발 전 다시 확인',source:'UK FCDO Italy advice',url:'https://www.gov.uk/foreign-travel-advice/italy'},
  {name:'Naples',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내를 출발 전 다시 확인',source:'UK FCDO Italy advice',url:'https://www.gov.uk/foreign-travel-advice/italy'},
  {name:'Istanbul',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 정보 확인 필요',source:'GoTürkiye',url:'https://goturkiye.com/'},
  {name:'Cairo',status:'SOURCE CONTEXT',kind:'context',note:'이 MVP의 데이터 범위 밖',source:'Egypt tourism portal',url:'https://www.experienceegypt.eg/'},
  {name:'Barcelona',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 정보 확인 필요',source:'Spain travel portal',url:'https://www.spain.info/en/'},
  {name:'Paris',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내를 출발 전 다시 확인',source:'France Diplomacy',url:'https://www.diplomatie.gouv.fr/en/country-files/france/'},
  {name:'London',status:'SOURCE CONTEXT',kind:'context',note:'공식 여행 안내를 출발 전 다시 확인',source:'Visit London',url:'https://www.visitlondon.com/'},
  {name:'New York',status:'SOURCE CONTEXT',kind:'context',note:'공식 도시·여행 안내 확인 필요',source:'NYC Tourism',url:'https://www.nyctourism.com/'},
];
const $ = (q) => document.querySelector(q);
const safe = (text) => String(text).replace(/[&<>'"]/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
function card(city, detail = false) { return `<article class="${detail ? 'detail ' : ''}city"><span class="pill ${city.kind}">${safe(city.status)}</span><h3>${safe(city.name)}</h3><p>${safe(city.note)}</p><div class="meta">SOURCE: <a href="${city.url}" target="_blank" rel="noopener noreferrer">${safe(city.source)} ↗</a><br>CHECKED: 2026-09-02 (not live)<br>CONFIDENCE: fixture / low<br>COVERAGE: city-level context only; no live street, road, block, or incident data</div></article>`; }
function render() { $('#rome-card').innerHTML = card(cities[0], true); $('#city-grid').innerHTML = cities.map((c) => card(c)).join(''); $('#report-city').innerHTML = cities.map((c) => `<option>${safe(c.name)}</option>`).join(''); }
$('#mode-toggle').addEventListener('click', () => { const night = document.body.classList.toggle('night'); $('#mode-toggle').textContent = night ? '☀ 주간 맥락 보기' : '☾ 야간 맥락 보기'; $('#mode-toggle').setAttribute('aria-pressed', String(night)); });
$('#demo-layer-toggle').addEventListener('click', () => { const map = $('#fixture-map'); const visible = map.classList.toggle('demo-visible'); $('#demo-layer-toggle').setAttribute('aria-pressed', String(visible)); $('#demo-layer-toggle').textContent = visible ? '비지리적 fixture 도식 숨기기' : '비지리적 fixture 도식 보기'; $('#map-output').textContent = visible ? '점선은 실제 도로·지리·사건·안전 점수가 아닌, 데이터 분리 방식을 설명하는 비지리적 fixture 도식입니다.' : '회색 표면은 현재 거리·도로·블록·사건 데이터가 없음을 뜻합니다. 표식과 구역명은 비지리적 fixture UI이며 안전 등급이 아닙니다.'; });
document.querySelectorAll('.map-marker').forEach((marker) => marker.addEventListener('click', () => { $('#map-output').textContent = `${marker.dataset.marker}: 비지리적 fixture 탐색 표식입니다. 실제 거리·도로·블록 상태나 실시간 사건 정보는 없습니다.`; }));
$('#report-form').addEventListener('submit', (event) => { event.preventDefault(); const note = $('#report-note').value.trim(); const output = $('#report-output'); if (containsSensitiveInput(note)) { output.textContent = 'URL·계정·연락처·주소·좌표 등 식별/위치 정보는 제거해 주세요. 이 양식은 로컬 형식 점검만 합니다.'; return; } output.textContent = '입력 형식을 이 브라우저에서만 점검했습니다. 어떤 정보도 전송·저장·대기열 등록·제출하지 않았습니다.'; event.target.reset(); });
render();
}
