// All networking in one place. Pages call Meet.net.* and never fetch directly.
// Two backends with the same API: Firebase (net-firebase.js, used whenever
// firebase-config.js holds a config — that's the hosted site) and the local
// Node server below (offline development).
(function () {
  'use strict';

  async function post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {}), credentials: 'same-origin' });
    if (!r.ok) throw Object.assign(new Error((await r.json().catch(() => ({}))).error || r.status), { status: r.status });
    return r.json();
  }

  function stream(url, onEvent, onState) {
    const es = new EventSource(url);
    es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ } };
    es.onopen = () => onState?.(true);
    es.onerror = () => onState?.(false);
    return () => es.close();
  }

  const her = {
    start: () => post('/api/start').then((r) => r.sid),
    // The setup you made before she scanned (her look, friends, place), if the QR carried one.
    prep: (pid) => fetch('/api/prep?id=' + encodeURIComponent(pid)).then((r) => (r.ok ? r.json() : null)),
    listen: (sid, onEvent, onState) => stream('/api/stream?sid=' + encodeURIComponent(sid), onEvent, onState),
    send: (sid, type, payload) => post('/api/her', Object.assign({ sid, type }, payload)),
  };

  const me = {
    mode: 'key',
    login: (key) => post('/api/admin/login', { key }),
    listen: (onEvent, onState) => stream('/api/admin/stream', onEvent, onState),
    // EventSource hides the 401; probe once so the page knows to show login.
    authed: () => fetch('/api/admin/stream', { method: 'HEAD' }).then((r) => r.status !== 401),
    send: (sid, text, emote) => post('/api/admin/send', { sid, text, emote }),
    typing: (sid, typing) => post('/api/admin/typing', { sid, typing }),
    live: (sid, live) => post('/api/admin/live', { sid, live }),
    remove: (sid) => post('/api/admin/delete', { sid }),
    prep: (prep) => post('/api/admin/prep', { prep }).then((r) => r.pid),
    whisper: (sid, open) => post('/api/admin/whisper', { sid, open }),
    wmsg: (sid, text) => post('/api/admin/wmsg', { sid, text }),
  };

  window.Meet = Object.assign(window.Meet || {}, { net: window.Meet?.netFirebase || { her, me } });
})();
