(() => {
  const form = document.querySelector('.search-form'), input = document.querySelector('#place-search'), countrySelect = document.querySelector('#verified-country');
  const status = document.querySelector('#map-status'), fallback = document.querySelector('#map-fallback');
  const config = window.SAFETY_MAP_E03_CONFIG, styles = { light: 'mapbox://styles/mapbox/light-v11', satellite: 'mapbox://styles/mapbox/satellite-streets-v12' };
  let map;
  const demoZone = { type:'Feature', properties:{ label:'주의 영역 예시', detail:'테스트용 반투명 표시입니다. 실제 위험 정보나 안전 판단이 아닙니다.' }, geometry:{ type:'Polygon', coordinates:[[[12.478,41.884],[12.499,41.884],[12.499,41.897],[12.478,41.897],[12.478,41.884]]] } };
  const showDemoZone = () => {
    if (map.getSource('demo-attention-zone')) return;
    map.addSource('demo-attention-zone', { type:'geojson', data:demoZone });
    map.addLayer({ id:'demo-attention-zone-fill', type:'fill', source:'demo-attention-zone', paint:{ 'fill-color':'#e33426', 'fill-opacity':0.28 } });
    map.addLayer({ id:'demo-attention-zone-line', type:'line', source:'demo-attention-zone', paint:{ 'line-color':'#be2017', 'line-width':2, 'line-opacity':0.88 } });
  };
  const setStatus = (value) => { status.textContent = `GLOBAL FIELD / ${value}`; };
  const start = () => {
    if (!config?.accessToken || !window.mapboxgl) { setStatus('보호 설정 대기'); return; }
    mapboxgl.accessToken = config.accessToken;
    map = new mapboxgl.Map({container:'map',style:styles.light,center:[12.4964,41.9028],zoom:12,performanceMetricsCollection:false});
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.on('load', () => { fallback.hidden = true; showDemoZone(); map.on('click', 'demo-attention-zone-fill', () => new mapboxgl.Popup().setLngLat([12.4885,41.8905]).setHTML('<strong>주의 영역 예시</strong><br>테스트용 반투명 표시입니다. 실제 위험 정보나 안전 판단이 아닙니다.').addTo(map)); setStatus('탐색 가능 · 빨간 영역은 테스트'); const layer = document.createElement('button'); layer.className = 'layer-toggle'; layer.type = 'button'; layer.textContent = '위성'; layer.setAttribute('aria-pressed','false'); layer.onclick = () => { const satellite = layer.getAttribute('aria-pressed') !== 'true'; map.setStyle(styles[satellite ? 'satellite' : 'light']); layer.setAttribute('aria-pressed', String(satellite)); layer.textContent = satellite ? '기본' : '위성'; }; map.getContainer().append(layer); });
    map.on('style.load', showDemoZone);
    map.on('error', () => setStatus('연결을 다시 확인 중'));
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const query = input.value.trim(); if (!query) return input.focus();
    if (!map) { setStatus('보호 설정이 필요합니다'); return; }
    try { const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&bbox=12.25,41.75,12.75,42.10&proximity=12.4964,41.9028&limit=1&access_token=${encodeURIComponent(mapboxgl.accessToken)}`); if (!response.ok) throw Error(); const data = await response.json(); const item = data.features?.[0]; if (!item?.geometry?.coordinates) throw Error(); map.flyTo({center:item.geometry.coordinates,zoom:15,essential:true}); setStatus(item.properties?.name || query); } catch { setStatus('장소를 찾지 못했습니다. 로마 안의 장소·랜드마크 이름으로 다시 검색해 주세요.'); }
  });
  countrySelect.addEventListener('change', () => { map.flyTo({ center:[12.4885,41.8905], zoom:14, essential:true }); setStatus('이탈리아 · 로마 테스트 영역'); });
  start();
})();
