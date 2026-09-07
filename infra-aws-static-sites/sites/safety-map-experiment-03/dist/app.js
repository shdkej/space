(() => {
  const form = document.querySelector('.search-form'), input = document.querySelector('#place-search');
  const status = document.querySelector('#map-status'), fallback = document.querySelector('#map-fallback');
  const drawer = document.querySelector('#evidence-drawer'), drawerClose = document.querySelector('#drawer-close'), fallbackEvidenceOpen = document.querySelector('#fallback-evidence-open');
  const config = window.SAFETY_MAP_E03_CONFIG, styles = { light: 'mapbox://styles/mapbox/light-v11', satellite: 'mapbox://styles/mapbox/satellite-streets-v12' };
  let map, drawerReturnFocus = fallbackEvidenceOpen;
  const termini = { center:[12.5018,41.9010], bounds:[[12.4938,41.8964],[12.5098,41.9058]] };
  const terminiArea = { type:'Feature', properties:{name:'Roma Termini · 환승 시 소지품 주의'}, geometry:{type:'Polygon',coordinates:[[[12.4943,41.8970],[12.5078,41.8970],[12.5093,41.9013],[12.5065,41.9053],[12.4973,41.9058],[12.4938,41.9016],[12.4943,41.8970]]]}};
  const setStatus = (value) => { status.textContent = `GLOBAL FIELD / ${value}`; };
  const showDrawer = (trigger) => {
    drawerReturnFocus = trigger instanceof HTMLElement ? trigger : (document.activeElement instanceof HTMLElement ? document.activeElement : fallbackEvidenceOpen);
    drawer.hidden = false;
    drawerClose.focus();
  };
  const hideDrawer = () => { drawer.hidden = true; drawerReturnFocus?.focus(); };
  drawerClose.addEventListener('click', hideDrawer);
  fallbackEvidenceOpen.addEventListener('click', () => showDrawer(fallbackEvidenceOpen));
  const installEvidenceLayer = () => {
    if (!map.isStyleLoaded() || map.getSource('termini-caution')) return false;
    map.addSource('termini-caution', {type:'geojson',data:{type:'FeatureCollection',features:[terminiArea]}});
    map.addLayer({id:'termini-caution-fill',type:'fill',source:'termini-caution',paint:{'fill-color':'#d94c45','fill-opacity':0.32}});
    map.addLayer({id:'termini-caution-line',type:'line',source:'termini-caution',paint:{'line-color':'#aa302c','line-width':2,'line-opacity':0.86}});
    return true;
  };
  const activateEvidence = () => {
    if (!installEvidenceLayer()) return;
    fallback.hidden = true;
    setStatus('Termini 근거 신호 표시');
  };
  const isInTerminiArea = ({ lng, lat }) => lng >= termini.bounds[0][0] && lng <= termini.bounds[1][0] && lat >= termini.bounds[0][1] && lat <= termini.bounds[1][1];
  const start = () => {
    if (!config?.accessToken || !window.mapboxgl) { setStatus('보호 설정 대기'); return; }
    mapboxgl.accessToken = config.accessToken;
    map = new mapboxgl.Map({container:'map',style:styles.light,center:termini.center,zoom:13.1,performanceMetricsCollection:false});
    map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
    map.on('mousemove', (event) => { map.getCanvas().style.cursor = isInTerminiArea(event.lngLat) ? 'pointer' : ''; });
    map.on('click', (event) => { if (isInTerminiArea(event.lngLat)) showDrawer(fallbackEvidenceOpen); });
    map.on('load', () => { map.once('idle', activateEvidence); const layer = document.createElement('button'); layer.className = 'layer-toggle'; layer.type = 'button'; layer.textContent = '위성'; layer.setAttribute('aria-pressed','false'); layer.onclick = () => { const satellite = layer.getAttribute('aria-pressed') !== 'true'; map.setStyle(styles[satellite ? 'satellite' : 'light']); layer.setAttribute('aria-pressed', String(satellite)); layer.textContent = satellite ? '기본' : '위성'; }; map.getContainer().append(layer); });
    map.on('style.load', () => map.once('idle', activateEvidence));
    map.on('error', () => setStatus('지도 연결 중 · 근거는 열 수 있습니다'));
  };
  form.addEventListener('submit', async (event) => {
    event.preventDefault(); const query = input.value.trim(); if (!query) return input.focus();
    if (!map) { setStatus('보호 설정이 필요합니다'); return; }
    if (/termini/i.test(query)) { map.fitBounds(termini.bounds,{padding:70,maxZoom:14,essential:true}); setStatus('Roma Termini · 근거 열림'); showDrawer(input); return; }
    try { const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?q=${encodeURIComponent(query)}&limit=1&bbox=12.2,41.7,12.8,42.1&proximity=12.4964,41.9028&access_token=${encodeURIComponent(mapboxgl.accessToken)}`); const data = await response.json(); const item = data.features?.[0]; if (!item?.geometry?.coordinates) throw Error(); map.flyTo({center:item.geometry.coordinates,zoom:13,essential:true}); setStatus(item.properties?.name || query); } catch { setStatus('로마 안에서 장소를 찾지 못했습니다'); }
  });
  start();
})();
