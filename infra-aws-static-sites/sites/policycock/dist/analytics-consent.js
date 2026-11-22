(() => {
  'use strict';
  // Increment the version if the tools, data recipients or stated purposes change.
  const key = 'policycock.analytics.consent.v1';
  const blocked = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1';
  const notice = document.getElementById('analytics-notice');
  const settings = document.getElementById('analytics-settings');
  let choice = null;
  let memoryOnly = false;
  let openedFromSettings = false;
  try {
    const saved = localStorage.getItem(key);
    if (saved === 'accepted' || saved === 'declined') choice = saved;
  } catch { /* Storage unavailable: ask again on the next visit. */ }
  window.policycockAnalyticsConsent = () => {
    if (blocked()) return false;
    if (memoryOnly) return choice === 'accepted';
    try { return localStorage.getItem(key) === 'accepted'; }
    catch { return choice === 'accepted'; }
  };
  const show = () => { notice.hidden = false; };
  const save = value => {
    choice = value;
    try { localStorage.setItem(key, value); memoryOnly = false; }
    catch { memoryOnly = true; }
    notice.hidden = true;
    (openedFromSettings ? settings : document.querySelector('.site-header .wordmark')).focus();
    openedFromSettings = false;
    window.dispatchEvent(new Event('policycock:posthog-choice'));
  };
  document.getElementById('analytics-accept').addEventListener('click', () => {
    if (blocked()) { save('declined'); return; }
    save('accepted');
    window.dispatchEvent(new Event('policycock:analytics-accepted'));
  });
  document.getElementById('analytics-decline').addEventListener('click', () => save('declined'));
  settings.addEventListener('click', () => {
    openedFromSettings = true;
    show();
    document.getElementById('analytics-decline').focus();
  });
  window.addEventListener('storage', event => {
    if (event.key !== key && event.key !== null) return;
    choice = event.newValue === 'accepted' || event.newValue === 'declined' ? event.newValue : null;
    memoryOnly = false;
    const focusInside = notice.contains(document.activeElement);
    notice.hidden = choice !== null || blocked();
    if (notice.hidden && focusInside) {
      (openedFromSettings ? settings : document.querySelector('.site-header .wordmark')).focus();
      openedFromSettings = false;
    }
    window.dispatchEvent(new Event('policycock:posthog-choice'));
  });
  if (choice === null && !blocked()) show();
})();
