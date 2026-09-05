(() => {
  const form = document.querySelector('.search-form'), input = document.querySelector('#place-search');
  const status = document.querySelector('#map-status'), fallback = document.querySelector('#map-fallback');
  const config = window.SAFETY_MAP_E03_CONFIG, styles = { light: 'mapbox://styles/mapbox/light-v11', satellite: 'mapbox://styles/mapbox/satellite-streets-v12' };
  let map;
  const setStatus = (value) => { status.textContent = `GLOBAL FIELD / ${value}`; };
  const start = () => {
    if (!config?.accessToken || !window.mapboxgl) { setStatus('보호 설정 대기'); return; }
    mapboxgl.accessToken = config.accessToken;
    map = new mapboxgl.Map({container:'map',style:styles.light,center:[12.4964,41.9028],zoom:3.1,performanceMetricsCollection:false});
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.on('load', () => { fallback.hidden = true; setStatus('탐색 가능'); const layer = document.createElement('button'); layer.className = 'layer-toggle'; layer.type = 'button'; layer.textContent = '위성'; layer.setAttribute('aria-pressed','false'); layer.onclick = () => { const satellite = layer.getAttribute('aria-pressed') !== 'true'; map.setStyle(styles[satellite ? 'satellite' : 'light']); layer.setAttribute('aria-pressed', String(satellite)); layer.textContent = satellite ? '기본' : '위성'; }; map.getContainer().append(layer); });
    map.on('error', () => setStatus('연결을 다시 확인 중'));
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const query = input.value.trim(); if (!query) return input.focus();
    if (!map) { setStatus('보호 설정이 필요합니다'); return; }
    try { const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&limit=1&access_token=${encodeURIComponent(mapboxgl.accessToken)}`); const data = await response.json(); const item = data.features?.[0]; if (!item?.geometry?.coordinates) throw Error(); map.flyTo({center:item.geometry.coordinates,zoom:12,essential:true}); setStatus(item.properties?.name || query); } catch { setStatus('장소를 찾지 못했습니다'); }
  });
  start();
})();
