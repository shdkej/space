(() => {
  'use strict';
  // Both analytics recipients are governed by one new, explicit visitor choice.
  const handoffKey = 'policycock.ga4.clean-navigation.v1';
  const withdrawalVisit = location.hash.startsWith('#launch-withdraw=');
  const id = window.policycockConfig?.ga4MeasurementId;
  if (!/^G-[A-Z0-9]{8,}$/.test(id || '')) return;
  // The signup withdrawal fragment is an access capability. Let launch.js
  // consume it without a GA4 reload, choice prompt or tag on this page.
  if (withdrawalVisit) return;
  const status = document.getElementById('analytics-status');
  let started = false;
  window.policycockGa4Started = () => started;
  const allowed = () => window.policycockAnalyticsConsent?.() === true;
  function safeReferrer() {
    try {
      const host = new URL(document.referrer).hostname.toLowerCase();
      for (const domain of ['google.com', 'naver.com', 'bing.com', 'daum.net', 'duckduckgo.com']) {
        if (host === domain || host.endsWith('.' + domain)) return 'https://' + domain + '/';
      }
    } catch { /* Missing or invalid referrer. */ }
    return '';
  }
  function start() {
    if (!allowed() || started) return;
    let handoff;
    try {
      const saved = sessionStorage.getItem(handoffKey);
      sessionStorage.removeItem(handoffKey);
      if (saved) handoff = JSON.parse(saved);
    } catch { status.textContent = '브라우저 설정 때문에 GA4를 실행하지 않습니다.'; return; }
    let referrer = '';
    let cleanPage;
    if (handoff) {
      if (handoff.url !== location.href || document.referrer ||
          (handoff.referrer && !/^https:\/\/(google\.com|naver\.com|bing\.com|daum\.net|duckduckgo\.com)\/$/.test(handoff.referrer))) {
        status.textContent = '주소를 보호할 수 없어 GA4를 실행하지 않습니다.';
        return;
      }
      cleanPage = new URL(handoff.url);
      referrer = handoff.referrer || '';
    } else {
      referrer = safeReferrer();
      cleanPage = new URL('/', location.origin);
      if (referrer) {
        cleanPage.searchParams.set('utm_source', new URL(referrer).hostname.split('.')[0]);
        cleanPage.searchParams.set('utm_medium', 'organic');
      }
      // The actual Google tag may ignore URL/referrer overrides. A fresh
      // no-referrer document removes both originals before the tag can run.
      if (location.href !== cleanPage.href || document.referrer) {
        try {
          sessionStorage.setItem(handoffKey, JSON.stringify({url: cleanPage.href, referrer, firstVisit: window.policycockFirstVisitHandoff}));
          location.replace(cleanPage.href);
        } catch { status.textContent = '주소를 보호할 수 없어 GA4를 실행하지 않습니다.'; }
        return;
      }
    }
    started = true;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'});
    // Suppress tag-level automatic page views; the explicit sanitized event below is the only one.
    window.gtag('set', 'send_page_view', false);
    window.gtag('js', new Date());
    window.gtag('config', id, {send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: cleanPage.href,
      page_referrer: referrer, page_title: '모두의정책'});
    if (allowed()) window.gtag('event', 'page_view', {page_location: cleanPage.href,
      page_referrer: referrer, page_title: '모두의정책'});
    if (!allowed()) { location.reload(); return; }
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(script);
  }
  window.addEventListener('policycock:analytics-accepted', start);
  window.addEventListener('storage', event => {
    if (event.key !== 'policycock.analytics.combined.v1' && event.key !== null) return;
    if (!allowed() && started) location.reload();
  });
  window.addEventListener('focus', () => { if (!allowed() && started) location.reload(); });

  start();
})();
