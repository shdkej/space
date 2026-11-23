(() => {
  'use strict';
  const META_PIXEL_ID = '1824168211816282';
  const site = 'https://policy.minimalcollector.com';
  if (!/^\d{12,20}$/.test(META_PIXEL_ID) || location.origin !== site || window.top !== window.self) return;
  if (!['/', '/index.html'].includes(location.pathname) || location.hash.startsWith('#launch-withdraw=')) return;
  const key = 'policycock.meta.ads.v1.' + META_PIXEL_ID;
  const settings = document.getElementById('meta-settings');
  const accept = document.getElementById('meta-accept');
  const status = document.getElementById('meta-choice');
  // A GA4 privacy redirect can erase query or fragment context and duplicate a visit.
  // Observe its one-use handoff before ga4-consent.js consumes it.
  let cleanRedirect = true;
  try { cleanRedirect = sessionStorage.getItem('policycock.ga4.clean-navigation.v1') !== null; }
  catch { /* Unknown navigation context remains excluded. */ }
  let sentView = false;
  let revokedHere = false;
  const blocked = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  function choice() {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  function allowed() {
    if (revokedHere || blocked() || choice() !== 'accepted') return false;
    if (!['', '#launch'].includes(location.hash)) return false;
    return [...new URLSearchParams(location.search).keys()].every(name => /^utm_(source|medium|campaign|content|term)$/.test(name) || name === 'fbclid');
  }
  window.policycockMetaAllowed = allowed;
  function send(event) {
    if (!allowed()) return;
    // Only these literals reach Meta. No SDK can inspect the parent page or forms.
    const pixel = new URL('https://www.facebook.com/tr');
    pixel.search = new URLSearchParams({id:META_PIXEL_ID, ev:event, dl:site + '/', noscript:'1'});
    fetch(pixel, {method:'GET', mode:'no-cors', credentials:'omit', referrerPolicy:'no-referrer',
      cache:'no-store', keepalive:true}).catch(() => {});
  }
  function render() {
    accept.disabled = blocked();
    status.textContent = blocked() ? '브라우저의 추적 차단 설정이 켜져 있습니다.' :
      choice() === 'accepted' && !revokedHere ? '현재 광고 측정에 동의했습니다.' : '현재 광고 측정은 꺼져 있습니다.';
  }
  function pageView() {
    if (sentView || cleanRedirect || !allowed()) return;
    sentView = true;
    send('PageView');
  }
  function choose(value) {
    if (value === 'accepted' && blocked()) return;
    revokedHere = value === 'declined';
    try { localStorage.setItem(key, value); }
    catch {
      // Never claim a persistent choice if a storage write failed.
      status.textContent = '선택을 저장할 수 없습니다. 브라우저의 사이트 데이터를 지우거나 추적 차단을 켜 주세요.';
      return;
    }
    render();
    settings.close();
    if (value === 'accepted') pageView();
  }
  accept.addEventListener('click', () => choose('accepted'));
  document.getElementById('meta-decline').addEventListener('click', () => choose('declined'));
  window.addEventListener('policycock:new-signup', () => send('Lead'));
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) {
      revokedHere = false;
      render();
    }
  });
  for (const control of document.querySelectorAll('.meta-settings-link')) {
    control.hidden = false;
    control.addEventListener('click', () => {
      render();
      settings.showModal();
      document.getElementById('meta-decline').focus();
    });
  }
  document.getElementById('meta-notice').hidden = false;
  window.addEventListener('pageshow', render);
  render();
  pageView();
})();
