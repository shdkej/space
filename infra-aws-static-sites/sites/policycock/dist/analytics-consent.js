(() => {
  'use strict';
  // A new decision is required: neither earlier vendor-specific choice grants both recipients.
  const configured = /^G-[A-Z0-9]{8,}$/.test(window.policycockConfig?.ga4MeasurementId || '');
  // A PostHog-only choice never becomes GA4 permission if a later deploy enables GA4.
  const key = configured ? 'policycock.analytics.combined.v1' : 'policycock.analytics.posthog-only.v1';
  const withdrawalVisit = location.hash.startsWith('#launch-withdraw=');
  const blocked = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const notice = document.getElementById('analytics-notice');
  const settings = document.getElementById('analytics-settings');
  const status = document.getElementById('analytics-status');
  const googleCopy = document.getElementById('analytics-google-copy');
  if (!configured) googleCopy.hidden = true;
  let choice = null;
  let openedFromSettings = false;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'accepted' || saved === 'declined') choice = saved;
  } catch { /* No persistent consent means no analytics. */ }
  const allowed = () => {
    if (choice === 'declined' || blocked() || withdrawalVisit || location.hash.startsWith('#launch-withdraw=')) return false;
    try { return localStorage.getItem(key) === 'accepted'; }
    catch { return false; }
  };
  window.policycockAnalyticsConsent = allowed;
  // An older private link can be pasted into an already-open tab. Remove its
  // fragment before any later tag hash listeners run, then open a fresh document.
  window.addEventListener('hashchange', event => {
    if (!location.hash.startsWith('#launch-withdraw=')) return;
    event.stopImmediatePropagation(); // Later listeners must not read event.newURL.
    const tokenHash = location.hash;
    history.replaceState(null, '', location.pathname + location.search + '#launch');
    location.replace((location.pathname === '/index.html' ? '/' : '/index.html') + tokenHash);
  });
  const render = () => { notice.hidden = withdrawalVisit || blocked() || choice !== null; };
  const restoreFocus = () => {
    (openedFromSettings ? settings : document.querySelector('.site-header .wordmark')).focus();
    openedFromSettings = false;
  };
  function save(value) {
    if (value === 'accepted' && blocked()) return;
    if (value === 'accepted') {
      try { localStorage.setItem(key, value); }
      catch {
        status.textContent = '브라우저 설정으로 선택을 저장할 수 없습니다. 분석은 실행되지 않습니다.';
        return;
      }
    } else {
      try { localStorage.setItem(key, value); }
      catch {
        // If overwrite fails but deletion works, absence of a grant is safe.
        try { localStorage.removeItem(key); }
        catch {
          // No durable withdrawal is possible. Leave the analytics page rather
          // than pretending that an existing accepted value was revoked.
          choice = 'declined';
          location.replace('privacy.html#analytics-withdrawal-failed');
          return;
        }
      }
      // Prevent old separate consents from resurfacing if a release is rolled back.
      for (const oldKey of ['policycock.analytics.consent.v1', 'policycock.ga4.consent.v1']) {
        try { localStorage.setItem(oldKey, 'declined'); }
        catch { try { localStorage.removeItem(oldKey); } catch { /* Cannot rewrite legacy state. */ } }
      }
    }
    choice = value;
    status.textContent = '';
    notice.hidden = true;
    restoreFocus();
    window.dispatchEvent(new Event('policycock:analytics-choice'));
    if (value === 'accepted') window.dispatchEvent(new Event('policycock:analytics-accepted'));
    else if (window.policycockGa4Started?.()) window.location.reload(); // Remove an already loaded tag.
  }
  document.getElementById('analytics-accept').addEventListener('click', () => save('accepted'));
  document.getElementById('analytics-decline').addEventListener('click', () => save('declined'));
  settings.addEventListener('click', () => {
    openedFromSettings = true;
    notice.hidden = false;
    status.textContent = blocked() ? '브라우저의 추적 차단 설정이 켜져 있어 방문 분석을 실행하지 않습니다.' : '';
    document.getElementById('analytics-accept').disabled = blocked();
    document.getElementById('analytics-decline').focus();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = event.newValue === 'accepted' || event.newValue === 'declined' ? event.newValue : null;
    const focusInside = notice.contains(document.activeElement);
    render();
    if (notice.hidden && focusInside) restoreFocus();
    if (!allowed()) window.dispatchEvent(new Event('policycock:analytics-choice'));
  });
  window.addEventListener('focus', () => {
    if (blocked() && window.policycockGa4Started?.()) window.location.reload();
  });
  render();
})();