// Your side: who scanned, what she says (as she sends it), and tiny-you's
// voice. The first thing you send flips her page to live and stops the script.
(function () {
  'use strict';
  const C = window.MEETCUTE;
  const { Stage, Avatar, net } = window.Meet;
  const $ = (id) => document.getElementById(id);
  // Your phone starts silent: you're standing next to her.
  Meet.voice.configure({ key: 'mc-muted-me', defaultMuted: true });
  Meet.voice.button($('mute'));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const sessions = new Map(); // sid → session (+ online, typing)
  let open = null;            // sid of the conversation on screen
  let stage = null;

  // ------------------------------------------------------------ auth + boot

  if (net.me.mode === 'google') {
    $('key').hidden = true;
    $('loginHint').textContent = 'only your Google account gets in';
    $('loginBtn').textContent = 'sign in with Google';
  }

  $('loginForm').onsubmit = async (e) => {
    e.preventDefault();
    $('loginErr').textContent = '';
    try {
      await net.me.login($('key').value.trim());
      $('key').value = '';
      $('login').hidden = true;
      start();
    } catch (err) {
      // Signed in, but the rules don't know this account yet: show its UID so
      // it can be pasted into database.rules.json.
      if (err.uid) {
        $('loginErr').innerHTML = `signed in, but this account isn’t the admin yet.<br>UID: <code>${esc(err.uid)}</code>`;
      } else {
        $('loginErr').textContent = err.status === 401 ? 'that’s not it' : 'could not sign in: ' + (err.code || err.message);
      }
    }
  };

  (async function boot() {
    if (await net.me.authed().catch(() => false)) start();
    else $('login').hidden = false;
  })();

  function start() {
    showList();
    net.me.listen(onEvent, (ok) => $('conn').classList.toggle('on', ok));
  }

  // ------------------------------------------------------------ events

  function onEvent(m) {
    if (m.type === 'snapshot') {
      sessions.clear();
      for (const s of m.sessions) sessions.set(s.sid, s);
    } else if (m.type === 'session') {
      sessions.set(m.session.sid, Object.assign(m.session, { online: true }));
      buzz();
    } else if (m.type === 'presence') {
      const s = sessions.get(m.sid);
      if (s) s.online = m.online;
    } else if (m.type === 'typing') {
      const s = sessions.get(m.sid);
      if (s) s.typing = m.typing;
      if (m.sid === open) {
        stage.typing('her', m.typing);
        status();
      }
    } else if (m.type === 'whisper') {
      const s = sessions.get(m.sid);
      if (s) { s.whisper = m.open; s.whispers = m.list || []; }
      if (m.sid === open) renderWhisper();
      if (m.open && m.list?.length && m.list[m.list.length - 1].from === 'friends') buzz();
    } else if (m.type === 'deleted') {
      sessions.delete(m.sid);
      if (open === m.sid) showList();
    } else if (m.type === 'event') {
      const prev = sessions.get(m.session.sid);
      sessions.set(m.session.sid, Object.assign(m.session, { online: prev?.online ?? true }));
      onConvoEvent(m.ev, m.session);
    }
    renderList();
    if (open && sessions.has(open)) renderHeader();
  }

  // Her actions also play out on your little stage, so you can see the moment.
  function onConvoEvent(ev, s) {
    if (ev.from !== 'me' && ev.from !== 'bot' && ev.type !== 'live') buzz();
    if (ev.sid !== open) return;
    if (ev.type === 'join') { stage.place('her', s.her.avatar); stage.her.mood('excited'); }
    // Only her own words go on her side. This used to test `from !== 'me'`,
    // which also put every scripted 🤖 line on her side, so the log read as
    // one person talking to themself.
    else if (ev.type === 'choice' || (ev.type === 'msg' && ev.from === 'her')) {
      stage.typing('her', false);
      stage.closer();
      stage.say('her', ev.text, ev.mood || undefined);
      addLine('her', ev.text, ev.type === 'choice');
    } else if (ev.type === 'msg') {
      stage.say('me', ev.text, ev.mood || undefined);
      addLine(ev.from, ev.text);
    } else if (ev.type === 'emote') stage.me.mood(ev.emote, { energy: 1.2 });
    else if (ev.type === 'contact') { stage.setDistance(1); stage.her?.mood('shy'); stage.me.mood('excited', { energy: 1.8 }); }
    else if (ev.type === 'leave') stage.me.mood('wave');
    status();
  }

  function buzz() { navigator.vibrate?.([40, 60, 40]); }

  // ------------------------------------------------------------ list

  function showList() {
    open = null;
    document.body.classList.remove('whispering');
    Meet.setTheme(Meet.defaultTheme);
    $('convo').hidden = true;
    $('list').hidden = false;
    renderList();
  }

  function renderList() {
    if ($('list').hidden) return;
    const list = [...sessions.values()].sort((a, b) => b.updated - a.updated);
    $('empty').hidden = list.length > 0;
    const box = $('cards');
    box.innerHTML = '';
    for (const s of list) {
      const last = s.messages?.[s.messages.length - 1];
      const btn = document.createElement('button');
      btn.className = 'convo-card' + (s.left ? ' left' : '');
      const name = s.her?.name || (s.left ? 'said not today' : 'scanned… making her avatar');
      const line = s.typing ? 'typing…' : last ? ({ her: '', bot: '🤖 ' }[last.from] ?? 'you: ') + last.text : ago(s.created);
      btn.innerHTML = `<div class="mini"></div><div class="who"><b>${esc(name)}</b> <span class="dot${s.online ? ' on' : ''}"></span>
        <p>${esc(line)}</p></div>${s.contact ? '<span class="tag">📱 got it</span>' : ''}`;
      if (s.her) btn.firstChild.appendChild(new Avatar(s.her.avatar, { look: 'front' }).el);
      btn.onclick = () => openConvo(s.sid);
      box.appendChild(btn);
    }
  }

  function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : new Date(t).toLocaleString();
  }

  // ------------------------------------------------------------ conversation

  function openConvo(sid) {
    const s = sessions.get(sid);
    if (!s) return;
    open = sid;
    $('list').hidden = true;
    $('convo').hidden = false;
    if (!stage) stage = new Stage($('stage'));
    stage.place('me', C.me.avatar);
    if (s.her) stage.place('her', s.her.avatar);
    else if (stage.her) { stage.her.el.remove(); stage.her = null; }
    // Her setting and friends, as you prepped them (or as her page reported them).
    Meet.setTheme(Meet.PLACE_THEME[s.scene?.place] || Meet.defaultTheme);
    stage.placeFriends([]);          // friends only appear when you call them
    stage.whispering = false;
    seenW = 0;
    $('cLog').innerHTML = '';
    for (const m of s.messages) addLine(m.from, m.text, m.choice);
    // Same closeness she sees: one step per reply of hers.
    const replies = s.messages.filter((m) => m.from === 'her').length;
    stage.setDistance(s.contact ? 1 : Math.min(0.85, replies * 0.2), { walk: false });
    renderHeader();
    status();
    renderWhisper();
  }

  // ------------------------------------------------------------ whisper

  let seenW = 0;
  let wShownAt = 0; // "close & erase" pops up right after your tap; ignore ghost taps for a moment
  async function renderWhisper() {
    const s = sessions.get(open);
    if (!s) return;
    const on = !!s.whisper;
    if (on && $('wbox').hidden) wShownAt = performance.now();
    $('wbox').hidden = !on;
    $('wbar').hidden = on || !s.her;
    document.body.classList.toggle('whispering', on);
    if (on !== stage.whispering) {
      if (!on) { $('wlog').innerHTML = ''; seenW = 0; }
      await stage.whisper(on, s.scene?.friends);
    }
    if (!on) return;
    const list = s.whispers || [];
    $('wlog').innerHTML = '';
    for (const w of list) {
      const p = document.createElement('p');
      p.className = w.from === 'me' ? 'me' : 'friends';
      p.textContent = w.text;
      $('wlog').appendChild(p);
    }
    $('wlog').scrollTop = $('wlog').scrollHeight;
    // Act out only what's new since last time.
    for (const w of list.slice(seenW)) stage.say(w.from === 'me' ? 'me' : 'friends', w.text);
    seenW = list.length;
  }

  $('wStart').onclick = () => open && net.me.whisper(open, true);
  $('wClose').onclick = () => open && performance.now() - wShownAt > 800 && net.me.whisper(open, false);
  $('wform').onsubmit = (e) => {
    e.preventDefault();
    const text = $('wmsg').value.trim();
    if (!text || !open) return;
    $('wmsg').value = '';
    net.me.wmsg(open, text).catch(() => { $('wmsg').value = text; });
  };
  for (const line of C.whisperLines || []) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = line;
    b.onclick = () => open && net.me.wmsg(open, line);
    $('wquick').appendChild(b);
  }

  function renderHeader() {
    const s = sessions.get(open);
    if (!s) return;
    $('cName').textContent = s.her?.name || '…';
    $('cOnline').className = 'dot' + (s.online ? ' on' : '');
    $('liveToggle').checked = !!s.live;
    const c = s.contact;
    $('cContact').hidden = !c;
    if (c) {
      const parts = [];
      if (c.phone) parts.push(`📱 <a href="tel:${esc(c.phone.replace(/[^\d+]/g, ''))}">${esc(c.phone)}</a>`);
      if (c.insta) parts.push(`📸 <a href="https://instagram.com/${encodeURIComponent(c.insta)}" target="_blank" rel="noopener">@${esc(c.insta)}</a>`);
      $('cContact').innerHTML = parts.join(' &nbsp; ');
    }
  }

  function status() {
    const s = sessions.get(open);
    if (!s) return;
    const last = s.messages?.[s.messages.length - 1];
    $('cStatus').textContent = s.left ? 'she said not today 🙂'
      : s.typing ? `${s.her?.name || 'she'} is typing…`
      : !s.her ? 'she’s making her avatar…'
      : s.live ? 'you’re live — she sees what you send'
      // She typed something herself: the script no longer answers that, you do.
      : last?.from === 'her' && !last.choice ? 'she wrote to you — reply to take over'
      : 'script is running · send anything to take over';
  }

  function addLine(who, text, choice) {
    const p = document.createElement('p');
    p.className = 'line ' + (who === 'bot' ? 'me bot' : who);
    p.textContent = (choice ? '☑ ' : who === 'bot' ? '🤖 ' : '') + text;
    $('cLog').appendChild(p);
    $('cLog').scrollTop = $('cLog').scrollHeight;
  }

  // ------------------------------------------------------------ sending

  const EMOTES = [['💐', 'flowers'], ['👋', 'wave'], ['🦘', 'jump'], ['🚀', 'rocket'], ['😳', 'blush'],
    ['🥺', 'puppy'], ['😭', 'cry'], ['😏', 'chill'], ['😂', 'laugh'], ['🥰', 'love'], ['💃', 'dance'],
    ['😮', 'surprised'], ['🤔', 'think']];
  for (const [icon, emote] of EMOTES) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = icon;
    b.onclick = () => open && net.me.send(open, '', emote);
    $('emotes').appendChild(b);
  }
  for (const line of C.quickLines) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = line;
    b.onclick = () => open && net.me.send(open, line);
    $('quick').appendChild(b);
  }

  let typingOn = false;
  let typingTimer;
  $('msg').oninput = () => {
    if (!open) return;
    if (!typingOn) { typingOn = true; net.me.typing(open, true).catch(() => {}); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typingOn = false; net.me.typing(open, false).catch(() => {}); }, 2500);
  };
  $('composer').onsubmit = (e) => {
    e.preventDefault();
    const text = $('msg').value.trim();
    if (!text || !open) return;
    $('msg').value = '';
    clearTimeout(typingTimer);
    typingOn = false;
    net.me.send(open, text).catch(() => { $('msg').value = text; });
  };

  $('liveToggle').onchange = (e) => open && net.me.live(open, e.target.checked);
  $('back').onclick = showList;

  // ------------------------------------------------------------ QR

  // Points at her page on whatever host this dashboard is served from; a
  // prep id rides along when you prepped.
  function showQr(pid, label) {
    const url = new URL('./', location.href);
    if (pid) url.searchParams.set('p', pid);
    $('qrPrep').textContent = label ? `prepped: ${label}` : '';
    $('qrCode').innerHTML = '';
    new QRCode($('qrCode'), { text: url.href, width: 600, height: 600, colorDark: '#2b1640', colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.M });
    $('qr').hidden = false;
    // Max brightness isn't scriptable; keeping the screen awake is.
    navigator.wakeLock?.request('screen').catch(() => {});
  }
  $('showQr').onclick = () => showQr();
  $('prepBtn').onclick = () => Meet.prep.open((done) => {
    showList();
    if (done) showQr(done.pid, done.label);
  });
  $('qr').onclick = () => { $('qr').hidden = true; };
})();
