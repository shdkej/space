(() => {
  'use strict';
  const config = window.policycockConfig || {};
  const allowedEvents = new Set([
    'landing_viewed', 'case_list_viewed', 'case_opened', 'case_source_opened',
    'launch_cta_clicked', 'signup_request_accepted',
    'signup_confirmed', 'signup_withdrawn', 'signup_failed'
  ]);
  const synthetic = new URLSearchParams(location.search).get('qa') === '1';
  const sessionId = window.crypto?.randomUUID?.();
  function capture(event) {
    if (!allowedEvents.has(event) || !sessionId || !/^phc_[A-Za-z0-9]+$/.test(config.projectKey)) return;
    if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
    const properties = {app_id: 'policycock', traffic_kind: synthetic ? 'synthetic' : 'user',
      $process_person_profile: false, $geoip_disable: true};
    if (synthetic) properties.qa_run_id = sessionId;
    const body = JSON.stringify({api_key: config.projectKey, event, distinct_id: sessionId, properties});
    fetch('https://us.i.posthog.com/i/v0/e/', {method: 'POST', headers: {'Content-Type': 'application/json'},
      credentials: 'omit', referrerPolicy: 'no-referrer', body, keepalive: true}).catch(() => {});
  }
  window.policycockCapture = capture;
  capture('landing_viewed');
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        capture('case_list_viewed');
        observer.disconnect();
      }
    });
    observer.observe(document.getElementById('galaxy-title'));
  }
  document.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link?.closest('#detail-links')) capture('case_source_opened');
    if (link?.getAttribute('href') === '#launch') {
      link.closest('dialog[open]')?.close();
      capture('launch_cta_clicked');
    }
  });

  const byId = id => document.getElementById(id);
  const manage = byId('launch-manage'), pending = byId('launch-pending'), form = byId('launch-form');
  const status = byId('launch-status');
  let token;
  function selectMode() {
    if (location.hash.startsWith('#launch-confirm=')) {
      const supplied = location.hash.slice('#launch-confirm='.length);
      token = /^[a-f0-9]{64}\.[A-Za-z0-9_-]{30,128}$/.test(supplied) ? supplied : null;
      history.replaceState(null, '', location.pathname + location.search + '#launch');
      byId('launch').scrollIntoView();
      if (!token) status.textContent = '확인 링크가 올바르지 않습니다. 확인 메일의 전체 링크를 다시 열어주세요.';
      else if (!config.signupEndpoint) status.textContent = '현재 신청 관리를 사용할 수 없습니다. 잠시 후 확인 메일의 링크에서 다시 시도해 주세요.';
    }
    pending.hidden = Boolean(config.signupEndpoint);
    form.hidden = !config.signupEndpoint || Boolean(token);
    manage.hidden = !config.signupEndpoint || !token;
  }
  selectMode();
  window.addEventListener('hashchange', selectMode);

  let sending = false;
  async function submit(action, fields) {
    if (sending || !config.signupEndpoint) return;
    sending = true;
    const buttons = [...document.querySelectorAll('#launch-form button,#launch-manage button')];
    buttons.forEach(button => { button.disabled = true; });
    status.textContent = '요청을 보내고 있습니다.';
    try {
      const response = await fetch(config.signupEndpoint, {
        method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({appId: 'policycock', type: 'launch-notice', action, ...fields}),
        signal: AbortSignal.timeout(15000)
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) {
        if (result.error === 'invalid_or_expired_token' || result.error === 'invalid_token') {
          status.textContent = '유효하지 않거나 만료된 확인 링크입니다. 이메일로 다시 신청해 주세요.';
          token = null; selectMode(); capture('signup_failed'); return;
        }
        throw new Error('request failed');
      }
      if (action === 'request') {
        status.textContent = '받은편지함과 스팸함을 확인해 주세요. 새 신청은 확인 메일의 링크에서 이메일을 확인해야 완료됩니다.';
        form.reset(); capture('signup_request_accepted');
      } else if (action === 'confirm') {
        status.textContent = '출시 알림 신청을 확인했습니다. 확인 메일의 링크에서 철회할 수 있습니다.';
        capture('signup_confirmed');
      } else {
        status.textContent = '출시 알림 신청을 철회했습니다.';
        token = null; selectMode(); capture('signup_withdrawn');
      }
    } catch {
      status.textContent = action === 'request' ? '신청 요청을 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.' :
        '요청 결과를 확인할 수 없습니다. 확인 메일의 링크에서 다시 시도해 주세요.';
      capture('signup_failed');
    } finally {
      sending = false;
      buttons.forEach(button => { button.disabled = false; });
    }
  }
  form.addEventListener('submit', event => {
    event.preventDefault();
    capture('launch_cta_clicked');
    if (form.reportValidity()) submit('request', {replyEmail: byId('launch-email').value.trim(), consent: byId('launch-consent').checked, consentVersion: 'launch-notice-v2'});
  });
  byId('launch-confirm').addEventListener('click', () => submit('confirm', {token}));
  byId('launch-withdraw').addEventListener('click', () => submit('withdraw', {token}));
})();
