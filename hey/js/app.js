// Her side: intro → make a tiny her → both avatars meet and talk.
(function () {
  'use strict';
  const C = window.MEETCUTE;
  const { Stage, detectMood, HAIR, OUTFITS, net, POS } = window.Meet;
  const $ = (id) => document.getElementById(id);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const state = { sid: null, her: null, live: false, run: 0, node: null, closeStream: null };
  const stage = new Stage($('stage'));
  const fill = (t) => t.replace(/\{name\}/g, state.her?.name || 'you');

  $('meName').textContent = $('meName2').textContent = C.me.name;
  Meet.voice.button($('mute'));
  sprinkleSky();

  // ------------------------------------------------------------ session

  function save() {
    try { sessionStorage.setItem('mc', JSON.stringify({ sid: state.sid, her: state.her })); } catch { /* private mode */ }
  }
  function restore() {
    try { return JSON.parse(sessionStorage.getItem('mc') || 'null'); } catch { return null; }
  }
  const send = (type, payload) => state.sid ? net.her.send(state.sid, type, payload).catch(() => {}) : null;

  function listen() {
    state.closeStream?.();
    state.closeStream = net.her.listen(state.sid, onEvent);
  }

  function onEvent(ev) {
    if (ev.type === 'hello') setLive(ev.live);
    else if (ev.type === 'live') setLive(ev.live);
    else if (ev.type === 'typing') stage.typing('me', ev.typing);
    else if (ev.type === 'emote') stage.me?.mood(ev.emote, { energy: 1.2 });
    else if (ev.type === 'msg' && ev.from === 'me') {
      stage.typing('me', false);
      stage.say('me', ev.text, ev.mood || undefined).then(() => log('me', ev.text));
      navigator.vibrate?.(30);
    }
  }

  function setLive(on) {
    state.live = !!on;
    $('liveBadge').hidden = !state.live;
    // Real him takes over: the script stops wherever it was.
    if (state.live) state.run++;
  }

  // ------------------------------------------------------------ 1. intro

  async function intro() {
    const box = $('introText');
    const me = stage.place('me', C.me.avatar, { left: '100%' });
    me.el.classList.add('peek');
    for (const line of C.intro) {
      const p = document.createElement('p');
      box.appendChild(p);
      for (const ch of line) { p.textContent += ch; await wait(ch === ',' ? 160 : 38); }
      await wait(650);
    }
    me.mood('wave', { ms: 2000 });
    await wait(500);
    $('introActions').hidden = false;
    dodgy($('notToday'), {
      labels: ['not today? 🤨', 'nope, try again 🙈', 'you sure? 🥺'],
      giveUp: 'okay fine… not today 🥲',
      onDodge: (n) => {
        // Grow the text, not the box: the button is already full width.
        $('curious').style.fontSize = 18 + n * 4 + 'px';
        stage.me.mood(['puppy', 'cry', 'puppy'][n - 1] || 'puppy', { ms: 1800 });
      },
    });
  }

  // A button that runs away from her finger a few times, then gives up and
  // works. The joke lands and she still has a real way out.
  // wander: also drift around the screen nonstop until it gives up.
  function dodgy(btn, { labels, giveUp, onDodge, onGiveUp, wander = false }) {
    let n = 0;
    let swallowUntil = 0;
    let last = 0;
    let drift = null;
    btn.classList.add('dodgy');

    const launch = () => {
      if (btn.classList.contains('flying')) return;
      // Out of its container so it can fly anywhere on the screen.
      const r = btn.getBoundingClientRect();
      document.body.appendChild(btn);
      btn.classList.add('flying');
      btn.style.left = r.left + 'px';
      btn.style.top = r.top + 'px';
      void btn.offsetWidth;
    };
    // Somewhere random on screen, at least `away` px from where it is now.
    const hop = (away) => {
      const r = btn.getBoundingClientRect();
      let x;
      let y;
      let tries = 0;
      do {
        x = 12 + Math.random() * Math.max(10, innerWidth - r.width - 24);
        y = 64 + Math.random() * Math.max(10, innerHeight * 0.66 - r.height);
      } while (Math.hypot(x - r.left, y - r.top) < away && ++tries < 25);
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
    };
    const surrender = () => {
      clearInterval(drift);
      btn.classList.remove('wander');
      btn.textContent = giveUp;
      onGiveUp?.();
    };

    if (wander) {
      launch();
      btn.classList.add('wander');
      hop(80);
      drift = setInterval(() => {
        if (!btn.isConnected) return clearInterval(drift);
        hop(80);
      }, 1100);
    }

    const flee = (e) => {
      if (n >= labels.length) return false;
      e.preventDefault();
      e.stopImmediatePropagation();
      // A tap fires pointerdown and then a compatibility mouseenter: one dodge, not two.
      if (performance.now() - last < 400) return true;
      last = performance.now();
      launch();
      btn.classList.add('zoom');           // a dodge is a quick jump, faster than the drift
      setTimeout(() => btn.classList.remove('zoom'), 300);
      hop(150);
      btn.textContent = labels[n++];
      if (n === labels.length) setTimeout(surrender, 900);
      // The finger lifts where the button used to be; don't let that land on something else.
      swallowUntil = performance.now() + 500;
      Meet.voice.sfx('nope');
      onDodge?.(n);
      return true;
    };
    btn.addEventListener('pointerdown', flee);
    // On a laptop, dodge when the mouse moves onto it. Not mouseenter: a
    // wandering button drifting under a resting cursor would dodge by itself.
    // Chrome also fires a synthetic move with zero movement when the element
    // slides under the cursor; only real motion counts.
    btn.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'mouse' && (e.movementX || e.movementY)) flee(e);
    });
    // Keyboard "clicks" skip pointerdown; count them as dodges too.
    btn.addEventListener('click', (e) => {
      // The tap that triggered the last dodge also produces a click on the
      // still-sliding button; it must not count as choosing it.
      if (performance.now() < swallowUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      if (n < labels.length) flee(e);
    }, true);
    document.addEventListener('click', (e) => {
      if (performance.now() < swallowUntil && e.target !== btn) { e.preventDefault(); e.stopPropagation(); }
    }, true);
  }

  $('curious').onclick = async () => {
    $('notToday').remove();
    $('intro').hidden = true;
    const me = stage.me;
    me.el.classList.remove('peek');
    await me.walkTo('76%', 900);
    me.mood('excited', { energy: 1.2 });
    openMaker();
  };

  $('notToday').onclick = async () => {
    send('leave');
    $('notToday').remove();
    $('introActions').hidden = true;
    const box = $('introText');
    box.innerHTML = '<p>totally fair 🙂</p><p>have a lovely day ✨</p>';
    stage.me.el.classList.remove('peek');
    stage.me.mood('cry', { ms: 2200 });
    await wait(2300);
    await stage.me.walkTo('70%', 800);
    stage.me.mood('wave', { ms: 0 });
  };

  // ------------------------------------------------------------ 2. maker

  const SKINS = ['#ffe3cc', '#f6cfae', '#eab78f', '#d9a074', '#c68a5e', '#a86b45', '#8a5434', '#5e3a22'];
  const HAIRS = ['#16100f', '#3b2417', '#6b4226', '#a0672e', '#dcb46f', '#b5452f', '#e58cb6', '#7381e0'];
  const CLOTHES = ['#ff7aa8', '#ffd166', '#7bdff2', '#b5a1ff', '#7ed6a5', '#f4f1ea', '#2a2a35', '#e4572e'];
  const draft = { skin: '#eab78f', hair: '#3b2417', hairStyle: 'long', outfit: 'dress',
    outfitColor: '#ff7aa8', pants: '#34405e', glasses: false };
  let preview;

  function openMaker() {
    $('maker').hidden = false;
    preview = new Meet.Avatar(draft, { look: 'front' });
    $('preview').appendChild(preview.el);
    chips($('hairStyles'), ['long', 'bob', 'ponytail', 'bun', 'curly', 'short'], 'hairStyle', (k) => HAIR[k].label);
    chips($('outfits'), Object.keys(OUTFITS).reverse(), 'outfit', (k) => k);
    swatches($('skins'), SKINS, 'skin');
    swatches($('hairs'), HAIRS, 'hair');
    swatches($('outfitColors'), CLOTHES, 'outfitColor');
    setTimeout(() => $('name').focus({ preventScroll: true }), 300);
  }

  function changed(mood = 'happy') {
    preview.update(draft);
    preview.mood(mood, { energy: 0.6, fx: false, ms: 900 });
    for (const el of document.querySelectorAll('[data-key]')) {
      el.classList.toggle('on', draft[el.dataset.key] === el.dataset.val);
    }
  }

  function chips(box, keys, key, label) {
    box.innerHTML = '';
    for (const k of keys) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.textContent = label(k);
      Object.assign(b.dataset, { key, val: k });
      b.onclick = () => { draft[key] = k; changed(); };
      box.appendChild(b);
    }
    changed('idle');
  }

  function swatches(box, colors, key) {
    box.innerHTML = '';
    for (const c of colors) {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.style.background = c;
      b.setAttribute('aria-label', key + ' ' + c);
      Object.assign(b.dataset, { key, val: c });
      b.onclick = () => { draft[key] = c; changed(); };
      box.appendChild(b);
    }
    changed('idle');
  }

  $('glasses').onchange = (e) => { draft.glasses = e.target.checked; changed('surprised'); };
  $('name').oninput = (e) => { $('makeMe').disabled = !e.target.value.trim(); };
  $('name').onkeydown = (e) => { if (e.key === 'Enter') e.target.blur(); };

  // The selfie is drawn to a tiny canvas, sampled for colours, and dropped.
  // Nothing about the image itself is stored or sent.
  $('photo').onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const got = sampleColors(img);
      Object.assign(draft, got);
      $('thumb').src = url;
      $('thumb').hidden = false;
      changed('love');
      Meet.voice.sfx('sparkle');
      stage.me?.mood('surprised', { energy: 1.1 });
    };
    img.src = url;
  };

  function sampleColors(img) {
    const W = 48;
    const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth));
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, W, H);
    const median = (x0, y0, x1, y1) => {
      const d = ctx.getImageData(Math.floor(x0 * W), Math.floor(y0 * H),
        Math.max(1, Math.floor((x1 - x0) * W)), Math.max(1, Math.floor((y1 - y0) * H))).data;
      const ch = [[], [], []];
      for (let i = 0; i < d.length; i += 4) { ch[0].push(d[i]); ch[1].push(d[i + 1]); ch[2].push(d[i + 2]); }
      return ch.map((a) => a.sort((p, q) => p - q)[a.length >> 1]);
    };
    const hex = (rgb) => '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
    const rgbOf = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const nearest = (rgb, palette) => palette.reduce((best, h) => {
      const p = rgbOf(h);
      const dist = (p[0] - rgb[0]) ** 2 + (p[1] - rgb[1]) ** 2 + (p[2] - rgb[2]) ** 2;
      return dist < best.d ? { h, d: dist } : best;
    }, { h: palette[0], d: Infinity }).h;
    // A selfie is roughly: hair across the top, face in the middle, clothes at
    // the bottom. Skin and hair snap to a palette so bad lighting can't give
    // her green skin; clothes keep their real colour.
    return {
      skin: nearest(median(0.4, 0.42, 0.6, 0.58), SKINS),
      hair: nearest(median(0.3, 0.04, 0.7, 0.14), HAIRS),
      outfitColor: hex(median(0.25, 0.86, 0.75, 0.98)),
    };
  }

  $('makeMe').onclick = async () => {
    const name = $('name').value.trim().slice(0, 30);
    if (!name) return;
    state.her = { name, avatar: Object.assign({}, draft) };
    save();
    send('join', { her: state.her });
    $('maker').hidden = true;
    preview.el.remove();
    await enterScene(true);
    run('start');
  };

  // ------------------------------------------------------------ 3. scene

  async function enterScene(fresh) {
    $('herName').textContent = state.her.name;
    $('scene').hidden = false;
    document.body.classList.add('in-scene');
    $('stageSlot').appendChild($('stage'));
    const me = stage.place('me', C.me.avatar);
    me.el.classList.remove('peek');
    me.el.style.transition = '';
    me.el.style.left = '100%';
    const her = stage.place('her', state.her.avatar, { left: '-10%' });
    if (fresh) {
      her.el.classList.add('pop');
      her.el.style.left = POS.HER_X;
      Meet.voice.sfx('sparkle');
      await wait(500);
      her.mood('excited', { energy: 1.3 });
      await me.walkTo(POS.ME_X, 1000);
      await wait(300);
    } else {
      her.el.style.left = POS.HER_X;
      me.el.style.left = POS.ME_X;
    }
  }

  async function run(id) {
    const token = ++state.run;
    const node = C.script[id];
    if (!node) return;
    state.node = id;
    options([]);
    for (const [text, mood] of node.say || []) {
      if (token !== state.run) return;
      // Let a rocket land (or a cry finish) before the next line starts.
      await wait(Math.max(0, (stage.me.busyUntil || 0) - Date.now()));
      if (token !== state.run) return;
      stage.typing('me', true);
      await wait(500 + Math.min(900, text.length * 18));
      if (token !== state.run) return stage.typing('me', false);
      const line = fill(text);
      send('bot', { text: line, mood });
      await stage.say('me', line, mood);
      log('me', line);
    }
    if (token !== state.run) return;
    if (node.bigAsk) bigAsk(node.bigAsk);
    else if (node.contact) contactForm(node.next);
    else if (node.options) options(node.options.map((o) => ({ text: o.text, go: o.next })));
    else if (node.bye) { stage.me.mood('wave', { ms: 3000 }); stage.her?.mood('wave', { ms: 3000 }); }
    else if (node.next && !node.end) run(node.next);
  }

  function options(list) {
    const box = $('options');
    box.innerHTML = '';
    for (const o of list) {
      const b = document.createElement('button');
      b.className = 'chip big';
      b.textContent = o.text;
      // A chip that appears under a resting finger gets a ghost tap; nobody
      // reads and chooses within half a second, so ignore taps until then.
      const shownAt = performance.now();
      b.onclick = () => { if (performance.now() - shownAt > 600) herSays(o.text, 'choice', o.go); };
      box.appendChild(b);
    }
  }

  // The date question floats in the middle of the screen while tiny-him
  // holds out flowers. "yes" is enormous; "no" is tiny and wanders around
  // the screen. Catch it three times and it gives up, stops, and works.
  function bigAsk(q) {
    const nq = q.no || q.maybe;
    const wrap = document.createElement('div');
    wrap.className = 'bigask';
    wrap.innerHTML = `<div class="bigask-card"><span class="big-emoji">💐</span><h2></h2>
      <div class="bigask-btns"><button class="btn primary grow huge-yes" data-a="yes"></button></div>
      <p class="fineprint"></p></div>`;
    wrap.querySelector('h2').textContent = fill(q.text);
    wrap.querySelector('.fineprint').textContent = q.fineprint || '';
    const yes = wrap.querySelector('[data-a=yes]');
    const no = document.createElement('button');
    no.className = 'btn ghost tiny-no';
    no.textContent = nq.text;
    yes.textContent = q.yes.text;
    document.body.appendChild(wrap);
    wrap.appendChild(no);
    Meet.voice.sfx('sparkle');
    stage.me.mood('flowers', { ms: 0 });
    const close = () => { wrap.remove(); no.remove(); state.closeAsk = null; };
    state.closeAsk = close;
    dodgy(no, {
      labels: nq.dodges,
      giveUp: nq.giveUp,
      wander: true,
      onDodge: (n) => {
        yes.style.transform = `scale(${1 + n * 0.14})`;
        stage.me.mood(n === 2 ? 'cry' : 'puppy', { ms: 1600 });
        setTimeout(() => { if (wrap.isConnected) stage.me.mood('flowers', { ms: 0 }); }, 1700);
      },
      // Once it gives up it stops, grows to a normal size and can be tapped.
      onGiveUp: () => no.classList.add('gave-up'),
    });
    // Same ghost-tap guard as the answer chips: the card can appear right under her finger.
    const shownAt = performance.now();
    yes.onclick = () => {
      if (performance.now() - shownAt < 600) return;
      close();
      confetti();
      stage.me.hold('');
      stage.her.hold('flowers');
      stage.setDistance(1);
      herSays(q.yes.text, 'choice', q.yes.next);
    };
    no.onclick = () => {
      close();
      herSays(no.textContent, 'choice', nq.next);
    };
  }

  function confetti(n = 46) {
    const bits = ['💖', '💕', '🌸', '✨', '💐', '🎉', '💗'];
    for (let i = 0; i < n; i++) {
      const c = document.createElement('span');
      c.className = 'confetti';
      c.textContent = pick(bits);
      c.style.left = Math.random() * 100 + 'vw';
      c.style.setProperty('--dx', (Math.random() * 160 - 80).toFixed(0) + 'px');
      c.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      c.style.animationDuration = (2.2 + Math.random() * 1.6).toFixed(2) + 's';
      c.style.animationDelay = (Math.random() * 0.6).toFixed(2) + 's';
      document.body.appendChild(c);
      setTimeout(() => c.remove(), 4800);
    }
    Meet.voice.sfx('sparkle');
  }

  function contactForm(next) {
    const box = $('options');
    box.innerHTML = `<form class="contact" id="contact" autocomplete="off">
      <input class="field" id="phone" type="tel" inputmode="tel" placeholder="📱 number" maxlength="20" autocomplete="tel">
      <input class="field" id="insta" placeholder="📸 insta @" maxlength="35" autocapitalize="none">
      <button class="btn primary">send 💌</button>
      <button type="button" class="btn ghost" id="skip">skip</button></form>`;
    $('contact').onsubmit = async (e) => {
      e.preventDefault();
      const phone = $('phone').value.trim();
      const insta = $('insta').value.trim().replace(/^@/, '');
      if (!phone && !insta) return $('phone').focus();
      send('contact', { contact: { phone, insta } });
      box.innerHTML = '';
      const text = phone && insta ? 'sent my number & insta 💌' : phone ? 'sent my number 📱' : 'sent my insta 📸';
      await stage.say('her', text, 'shy');
      log('her', text);
      stage.me.mood('excited', { energy: 1.6 });
      if (!state.live) run(next);
    };
    $('skip').onclick = () => { box.innerHTML = ''; if (!state.live) run('chat'); };
  }

  const REJECT = /\b(not interested|no thanks|no thank you|seeing someone|have a (boy|girl)friend|i'?m taken|married|leave me alone|go away)\b/i;

  async function herSays(text, kind = 'msg', go) {
    const { mood, energy } = detectMood(text);
    send(kind, { text, mood });
    if (kind === 'choice') options([]);
    state.run++; // a reply from her always cuts off whatever tiny-him was saying
    const rejecting = go === 'no' || go === 'taken' || REJECT.test(text) ||
      (/^\s*(no+|nope|nah)\b/i.test(text) && ['ask', 'yes', 'maybe'].includes(state.node));
    // Every reply brings them a step closer; a no sends tiny-him back to a polite distance.
    // A hesitant "maybe/no" leaves the distance as it is.
    if (rejecting) await stage.setDistance(0);
    else if (go !== 'maybe') await stage.closer();
    await stage.say('her', text, mood, energy);
    log('her', text);
    if (state.live) { if (REJECT.test(text)) state.closeAsk?.(); return; }
    const node = C.script[state.node];
    if (go) return run(go);
    // However the script is going, a clear no ends it kindly.
    if (rejecting) {
      state.closeAsk?.();
      return run(/someone|friend|taken|married/i.test(text) ? 'taken' : 'no');
    }
    if (node?.any && node.options) return run(node.any);
    // Free text outside a question: tiny-him answers from the reply pool,
    // then puts the question back if one was open.
    const pool = C.replies[mood] || C.replies.any;
    const [reply, rmood] = pick(pool);
    stage.typing('me', true);
    await wait(900);
    if (state.live) return stage.typing('me', false);
    send('bot', { text: reply, mood: rmood });
    await stage.say('me', reply, rmood);
    log('me', reply);
    if (state.live || !node) return;
    if (node.options) options(node.options.map((o) => ({ text: o.text, go: o.next })));
    else if (!node.contact && !node.end && node.next) run(node.next);
  }

  // ------------------------------------------------------------ composer

  let typingOn = false;
  let typingTimer;
  $('msg').oninput = () => {
    if (!typingOn) { typingOn = true; send('typing', { typing: true }); stage.her?.mood('think', { ms: 0, fx: false }); }
    clearTimeout(typingTimer);
    typingTimer = setTimeout(() => { typingOn = false; send('typing', { typing: false }); stage.her?.mood('idle'); }, 2500);
  };
  $('composer').onsubmit = (e) => {
    e.preventDefault();
    const text = $('msg').value.trim();
    if (!text) return;
    $('msg').value = '';
    clearTimeout(typingTimer);
    typingOn = false;
    herSays(text);
  };

  function log(who, text) {
    const p = document.createElement('p');
    p.className = 'line ' + who;
    p.textContent = text;
    $('log').appendChild(p);
    $('log').scrollTop = $('log').scrollHeight;
  }

  // ------------------------------------------------------------ ambience

  function sprinkleSky() {
    const sky = document.querySelector('.sky');
    for (let i = 0; i < 40; i++) {
      const s = document.createElement('i');
      s.style.left = Math.random() * 100 + '%';
      s.style.top = Math.random() * 70 + '%';
      s.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
      sky.appendChild(s);
    }
    const floaters = getComputedStyle(document.documentElement).getPropertyValue('--floaters')
      .replace(/['"]/g, '').trim().split(/\s+/).filter(Boolean);
    for (let i = 0; floaters.length && i < 8; i++) {
      const h = document.createElement('b');
      h.textContent = pick(floaters);
      h.style.left = Math.random() * 100 + '%';
      h.style.animationDelay = (Math.random() * 12).toFixed(1) + 's';
      h.style.animationDuration = (10 + Math.random() * 8).toFixed(1) + 's';
      sky.appendChild(h);
    }
  }

  // ------------------------------------------------------------ boot

  // ?demo=intro | chat | ask: a frozen moment for previews (the theme
  // gallery). No session, no network, nothing reaches Firebase.
  async function demo(kind) {
    if (kind === 'intro') {
      stage.place('me', C.me.avatar, { left: '100%' }).el.classList.add('peek');
      $('introText').innerHTML = C.intro.map((l) => `<p>${l.replace(/</g, '&lt;')}</p>`).join('');
      $('introActions').hidden = false;
      return;
    }
    $('intro').hidden = true;
    state.her = { name: 'Riya', avatar: { skin: '#e7b48f', hair: '#2b1a12', hairStyle: 'ponytail', outfit: 'dress',
      outfitColor: '#ff8fb0', pants: '#34405e', glasses: false } };
    await enterScene(false);
    stage.setDistance(0.5, { walk: false });
    for (const [who, t] of [['me', 'oh. hey Riya 👋'], ['her', 'haha hi 😂'], ['me', 'so… is the QR thing too much?'],
      ['her', 'no, it’s actually cute']]) log(who, t);
    if (kind === 'ask') return bigAsk(C.script.ask.bigAsk);
    const loop = [['me', 'I got you something 💐', 'flowers'], ['her', 'omg stop 🙈', 'blush'],
      ['me', 'casual. very casual 😎', 'chill'], ['her', 'YESSS!!!', 'rocket']];
    for (let i = 0; ; i = (i + 1) % loop.length) {
      const [who, text, mood] = loop[i];
      await stage.say(who, text, mood);
      await wait(900);
    }
  }

  (async function boot() {
    const demoKind = new URLSearchParams(location.search).get('demo');
    if (demoKind !== null) return demo(demoKind || 'chat');
    const prev = restore();
    if (prev?.sid && prev.her) {
      // Reloaded mid-conversation: skip straight back to the scene.
      Object.assign(state, prev);
      $('intro').hidden = true;
      listen();
      await enterScene(false);
      log('me', fill('welcome back, {name} 🙂'));
      stage.say('me', fill('welcome back, {name} 🙂'), 'wave');
      return;
    }
    try {
      state.sid = await net.her.start();
      save();
      listen();
    } catch { /* offline: the script still works, just nothing reaches him */ }
    intro();
  })();
})();
