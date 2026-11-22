(() => {
  'use strict';
  // GA4 is a distinct recipient; PostHog v1 choices never authorize it.
  const key = 'policycock.ga4.consent.v1';
  const id = window.policycockConfig?.ga4MeasurementId;
  if (!/^G-[A-Z0-9]{8,}$/.test(id || '')) return;
  const notice = document.getElementById('ga4-notice');
  const settings = document.getElementById('ga4-settings');
  const status = document.getElementById('ga4-status');
  const posthogNotice = document.getElementById('analytics-notice');
  settings.hidden = false;
  const blocked = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  let choice = null;
  let openedFromSettings = false;
  let started = false;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'accepted' || saved === 'declined') choice = saved;
  } catch { /* No persistence means no GA4 consent. */ }
  const allowed = () => {
    if (blocked()) return false;
    try { return localStorage.getItem(key) === 'accepted'; }
    catch { return false; }
  };
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
    started = true;
    const cleanPage = location.origin + '/';
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', {analytics_storage: 'granted', ad_storage: 'denied',
      ad_user_data: 'denied', ad_personalization: 'denied'});
    window.gtag('js', new Date());
    window.gtag('config', id, {send_page_view: false, allow_google_signals: false,
      allow_ad_personalization_signals: false, page_location: cleanPage,
      page_referrer: safeReferrer(), page_title: '모두의정책'});
    // A single allowlisted page view; no policy, search, signup or outbound-click events.
    if (allowed()) window.gtag('event', 'page_view', {page_location: cleanPage,
      page_referrer: safeReferrer(), page_title: '모두의정책'});
    if (!allowed()) { location.reload(); return; }
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(id);
    document.head.append(script);
  }
  function render() {
    notice.hidden = blocked() || choice !== null || !posthogNotice.hidden;
  }
  function save(value) {
    try { localStorage.setItem(key, value); choice = value; }
    catch { status.textContent = '브라우저 설정 때문에 선택을 저장할 수 없습니다. GA4는 실행되지 않습니다.'; return; }
    status.textContent = '';
    notice.hidden = true;
    (openedFromSettings ? settings : document.querySelector('.site-header .wordmark')).focus();
    openedFromSettings = false;
    if (value === 'accepted') start();
    else if (started) location.reload(); // Remove an already loaded tag after withdrawal.
  }
  document.getElementById('ga4-accept').addEventListener('click', () => {
    if (blocked()) { save('declined'); return; }
    save('accepted');
  });
  document.getElementById('ga4-decline').addEventListener('click', () => save('declined'));
  settings.addEventListener('click', () => {
    openedFromSettings = true;
    notice.hidden = false;
    document.getElementById('ga4-decline').focus();
  });
  window.addEventListener('policycock:posthog-choice', render);
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = event.newValue === 'accepted' || event.newValue === 'declined' ? event.newValue : null;
    const focusInside = notice.contains(document.activeElement);
    render();
    if (notice.hidden && focusInside) {
      (openedFromSettings ? settings : document.querySelector('.site-header .wordmark')).focus();
      openedFromSettings = false;
    }
    if (!allowed() && started) location.reload();
  });
  window.addEventListener('focus', () => { if (blocked() && started) location.reload(); });
  render();
  start();
})();
