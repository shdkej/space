(() => {
  'use strict';
  const config = window.policycockConfig || {};
  const allowedEvents = new Set([
    'landing_viewed', 'case_list_viewed', 'case_opened', 'case_source_opened',
    'launch_cta_clicked', 'signup_request_accepted',
    'signup_withdrawn', 'signup_cleanup_pending', 'signup_failed'
  ]);
  const synthetic = new URLSearchParams(location.search).get('qa') === '1';
  const sessionId = window.crypto?.randomUUID?.();
  function capture(event) {
    if (!allowedEvents.has(event) || !sessionId || !/^phc_[A-Za-z0-9]+$/.test(config.projectKey)) return;
    if (!window.policycockAnalyticsConsent?.()) return;
    const properties = {app_id: 'policycock', traffic_kind: synthetic ? 'synthetic' : 'user',
      $process_person_profile: false, $geoip_disable: true};
    if (synthetic) properties.qa_run_id = sessionId;
    const body = JSON.stringify({api_key: config.projectKey, event, distinct_id: sessionId, properties});
    fetch('https://us.i.posthog.com/i/v0/e/', {method: 'POST', headers: {'Content-Type': 'application/json'},
      credentials: 'omit', referrerPolicy: 'no-referrer', body, keepalive: true}).catch(() => {});
  }
  window.policycockCapture = capture;
  window.addEventListener('policycock:analytics-accepted', () => capture('landing_viewed'));
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
  const form = byId('launch-form'), status = byId('launch-status');
  const tokenPattern = /^[a-f0-9]{64}\.[a-f0-9]{64}$/;
  const receiptKey = 'policycock.launch.withdraw.v3', pendingKey = 'policycock.launch.retry.v3';
  function read(key) { try { return localStorage.getItem(key); } catch { return null; } }
  function write(key, value) {
    try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); return true; }
    catch { return false; }
  }
  function storedTokens() {
    try {
      const data = JSON.parse(read(receiptKey) || '[]');
      return Array.isArray(data) ? data.filter(token => typeof token === 'string' && tokenPattern.test(token)) : [];
    } catch { return []; }
  }
  let tokens = new Set(storedTokens());
  let requestId = read(pendingKey);
  let busy = false;
  const endpoint = config.signupEndpoint;
  byId('launch-pending').hidden = Boolean(endpoint && config.signupEnabled);
  form.hidden = !endpoint || !config.signupEnabled;
  function privateLink(token) {
    // Always use a different document path. A hash-only navigation in an
    // already-open tab could otherwise expose the capability to a loaded tag.
    const safePath = location.pathname === '/index.html' ? '/' : '/index.html';
    return location.origin + safePath + '#launch-withdraw=' + token;
  }
  function showLink(token) {
    byId('launch-private-link').value = privateLink(token);
    byId('launch-recovery').hidden = false;
    byId('launch-private-link').select();
  }
  function render() {
    byId('launch-manage').hidden = !tokens.size;
    const list = byId('launch-receipts');
    list.replaceChildren();
    let number = 0;
    for (const token of tokens) {
      const row = document.createElement('li');
      const title = document.createElement('span'); title.textContent = '내 신청 ' + (++number);
      const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'text-btn';
      copy.textContent = '철회 링크 복사';
      copy.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(privateLink(token)); status.textContent = '개인 철회 링크를 복사했습니다.'; }
        catch { showLink(token); status.textContent = '아래 개인 링크를 선택해 복사해 주세요.'; }
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'text-btn';
      remove.textContent = '신청 철회'; remove.disabled = busy || !endpoint;
      remove.addEventListener('click', () => withdraw(token));
      row.append(title, copy, remove); list.append(row);
    }
  }
  function readLink() {
    const prefix = '#launch-withdraw=';
    if (!location.hash.startsWith(prefix)) return;
    const token = location.hash.slice(prefix.length);
    history.replaceState(null, '', location.pathname + location.search + '#launch');
    byId('launch').scrollIntoView();
    if (!tokenPattern.test(token)) { status.textContent = '개인 철회 링크가 올바르지 않습니다.'; return; }
    tokens.add(token); render();
    status.textContent = endpoint ? '신청을 철회하려면 아래 버튼을 눌러 주세요.' : '신청 관리 연결을 준비 중입니다. 개인 링크를 보관해 주세요.';
  }
  readLink(); render();
  window.addEventListener('hashchange', readLink);
  window.addEventListener('storage', event => {
    if (event.key === receiptKey) { tokens = new Set(storedTokens()); render(); }
  });

  async function api(action, fields) {
    const reply = await fetch(endpoint, {
      method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer',
      headers: {'Content-Type': 'application/json'}, body: JSON.stringify({appId: 'policycock', type: 'launch-notice', action, ...fields}),
      signal: AbortSignal.timeout(15000)
    });
    const result = await reply.json();
    if (!reply.ok || result.ok !== true) throw new Error(result.error || 'failed');
    return result;
  }
  function setBusy(value) {
    busy = value; form.querySelector('button').disabled = value; render();
  }
  function newRequestId() {
    return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || form.hidden || !form.reportValidity()) return;
    capture('launch_cta_clicked');
    setBusy(true);
    status.textContent = '신청을 보내고 있습니다.';
    if (!/^[a-f0-9]{64}$/.test(requestId || '')) requestId = newRequestId();
    write(pendingKey, requestId);
    try {
      const result = await api('request', {replyEmail: byId('launch-email').value.trim(), consent: byId('launch-consent').checked,
        consentVersion: 'launch-notice-v3', requestId, website: byId('launch-website').value});
      const token = result.withdrawToken;
      if (token && !tokenPattern.test(token)) throw new Error('invalid_response');
      status.textContent = '출시 알림 신청을 접수했습니다. 출시할 때 운영자가 이메일로 한 번 알려드립니다.';
      if (token) {
        tokens = new Set([...storedTokens(), ...tokens, token]);
        const saved = write(receiptKey, JSON.stringify([...tokens]));
        if (!saved) { showLink(token); status.textContent += ' 브라우저 저장이 꺼져 있어 개인 철회 링크를 직접 보관해 주세요.'; }
      }
      requestId = null; write(pendingKey, null); form.reset(); capture('signup_request_accepted');
    } catch (error) {
      if (error.message === 'request_withdrawn') { requestId = null; write(pendingKey, null); }
      status.textContent = error.message === 'daily_limit' ? '오늘 접수 한도에 도달했습니다. 다음 날 오전 9시(한국시간) 이후 다시 신청해 주세요.' :
        '접수 결과를 확인할 수 없습니다. 잠시 후 같은 브라우저에서 다시 시도해 주세요.';
      capture('signup_failed');
    } finally { setBusy(false); }
  });
  async function withdraw(token) {
    if (busy || !endpoint) return;
    setBusy(true);
    try {
      const result = await api('withdraw', {token});
      if (result.cleanupPending) {
        status.textContent = '신청을 철회했습니다. 운영자 메일함 정리 통지는 대기 중입니다. 나중에 같은 버튼으로 재시도할 수 있습니다.';
        capture('signup_cleanup_pending');
      } else {
        tokens = new Set([...storedTokens(), ...tokens]); tokens.delete(token); write(receiptKey, JSON.stringify([...tokens]));
        byId('launch-recovery').hidden = true; byId('launch-private-link').value = '';
        status.textContent = '신청을 철회했습니다. 운영자에게 메일 정리를 요청했습니다.';
        capture('signup_withdrawn');
      }
    } catch {
      status.textContent = '철회 결과를 확인할 수 없습니다. 개인 링크를 보관하고 다시 시도해 주세요.'; capture('signup_failed');
    } finally { setBusy(false); }
  }
})();
