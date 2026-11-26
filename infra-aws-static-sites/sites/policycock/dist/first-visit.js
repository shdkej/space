/* Shared first-visit protocol used by Policycock and Virtue web. */
(() => {
  'use strict';
  const landing = new URLSearchParams(location.search);
  const fromShare = landing.get('ref') === 'share';
  const syntheticLanding = landing.get('qa') === '1';
  function create({app, key, allowed, knownReturning, sessionId, handoff}) {
    const qaKey = app + '.firstVisit.qaTab';
    let qa = syntheticLanding || handoff?.synthetic === true;
    try { qa ||= sessionStorage.getItem(qaKey) === '1'; } catch { /* No tab marker available. */ }
    const shared = fromShare || handoff?.shared === true;
    const prefix = app + '.firstVisit.v1.';
    const storeKey = prefix + (qa ? 'qa' : 'user');
    const inactive = 30 * 60 * 1000;
    const maximum = 24 * 60 * 60 * 1000;

    async function record(action) {
      if (!allowed() || !/^phc_[A-Za-z0-9]+$/.test(key || '') || !navigator.locks || !crypto.randomUUID) return;
      try { if (qa) sessionStorage.setItem(qaKey, '1'); } catch { /* Memory still marks this page as synthetic. */ }
      const at = Date.now();
      await navigator.locks.request(storeKey, async () => {
        if (!allowed()) return;
        let state = JSON.parse(localStorage.getItem(storeKey) || 'null');
        if (state === 'seen') return;
        if (!state && action === 'activity') return;
        if (!state && knownReturning()) {
          localStorage.setItem(storeKey, JSON.stringify('seen'));
          return;
        }
        if (!state) {
          const time = at.toString(16).padStart(12, '0');
          const visit = sessionId ? sessionId(at) : time.slice(0, 8) + '-' + time.slice(8) + '-7' + crypto.randomUUID().slice(15);
          state = {id: crypto.randomUUID(), visit, started: at, last: at, shared,
            entryEvent: crypto.randomUUID(), doneEvent: crypto.randomUUID()};
        }
        const inSession = at - state.started < maximum && at - state.last < inactive;
        if (inSession) {
          state.last = Math.max(state.last, at);
          if (action === 'complete' && state.completedAt === undefined) state.completedAt = at;
        }
        // Write before sending. Storage denial must never create repeat "first" visits.
        localStorage.setItem(storeKey, JSON.stringify(state));
        async function send(event, uuid, time) {
          if (!allowed()) return false;
          const properties = {app_id: app, traffic_kind: qa ? 'synthetic' : 'user',
            referral_source: state.shared ? 'share' : 'other',
            $process_person_profile: false, $geoip_disable: true};
          properties.$session_id = state.visit;
          if (qa) properties.qa_run_id = state.id;
          const response = await fetch('https://us.i.posthog.com/i/v0/e/', {
            method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
            headers: {'Content-Type': 'application/json'}, signal: AbortSignal.timeout(5000),
            body: JSON.stringify({api_key: key, event, uuid, distinct_id: state.id,
              timestamp: new Date(time).toISOString(), properties}),
          });
          return response.ok;
        }
        if (!state.entered) state.entered = await send('first_session_started', state.entryEvent, state.started);
        if (state.entered && state.completedAt !== undefined && !state.activated) {
          state.activated = await send('first_session_activated', state.doneEvent, state.completedAt);
        }
        // A user may withdraw while the request is in flight.
        if (!allowed() || JSON.parse(localStorage.getItem(storeKey) || 'null')?.id !== state.id) return;
        const settled = state.entered && (state.activated || (!inSession && state.completedAt === undefined));
        localStorage.setItem(storeKey, JSON.stringify(settled ? 'seen' : state));
      }).catch(() => {});
    }

    function clear() {
      try {
        localStorage.removeItem(prefix + 'qa');
        localStorage.removeItem(prefix + 'user');
      } catch { /* Storage is unavailable. */ }
    }
    let lastTouch = 0;
    function touch() {
      if (Date.now() - lastTouch < 10000 || !allowed()) return;
      lastTouch = Date.now();
      void record('activity');
    }
    window.addEventListener('pointerdown', touch, {passive: true});
    window.addEventListener('keydown', touch);
    return {enter: () => record('start'), complete: () => record('complete'), clear};

  }
  window.createFirstVisitTracker = create;
})();
