// Tiny-person voices: each letter becomes a short, high blip, so a line of
// text sounds like a miniature talking fast. Synthesised with Web Audio —
// no sound files. Browsers only allow audio after the first tap, so the
// context is created on the first pointer or key event.
(function () {
  'use strict';
  let ctx = null;
  let master = null;
  let storageKey = 'mc-muted';
  let muted = false;
  const read = () => { try { return localStorage.getItem(storageKey); } catch { return null; } };
  muted = read() === '1';

  function unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
  const ready = () => !muted && ctx && ctx.state === 'running';

  function blip(t, freq, len, type = 'triangle', vol = 0.16, glide = 1) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(freq * glide, t + len);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + len + 0.02);
  }

  // Babble a line. Letters set the pitch, so the same word always sounds the
  // same; a question rises at the end, an exclamation goes up and faster.
  function speak(text, { pitch = 520, speed = 1 } = {}) {
    if (!ready()) return;
    const t0 = String(text);
    const letters = [...t0.toLowerCase()].filter((c) => /[a-z0-9]/.test(c)).slice(0, 44);
    const excited = /!/.test(t0);
    const step = 0.058 / speed / (excited ? 1.15 : 1);
    const base = pitch * (excited ? 1.12 : 1);
    let t = ctx.currentTime + 0.02;
    letters.forEach((c, i) => {
      const vowel = 'aeiouy'.includes(c);
      if (!vowel && i % 2) { t += step * 0.45; return; } // drop half the consonants: babble, not spelling
      const rise = /\?\s*$/.test(t0) && i > letters.length - 6 ? 1.25 : 1;
      const f = base * (1 + ((c.charCodeAt(0) * 7) % 12) / 22) * (vowel ? 1.06 : 0.97) * rise;
      blip(t, f, step * 0.9, 'triangle', 0.15, vowel ? 1.12 : 0.92);
      t += step;
    });
  }

  const SFX = {
    boing(t) { blip(t, 180, 0.32, 'sine', 0.3, 3.2); },
    pop(t) { blip(t, 520, 0.09, 'sine', 0.3, 2.2); },
    whoosh(t) {
      const len = 1.1;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      const f = ctx.createBiquadFilter();
      const g = ctx.createGain();
      src.buffer = buf;
      f.type = 'bandpass';
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(3000, t + len);
      g.gain.value = 0.5;
      src.connect(f).connect(g).connect(master);
      src.start(t);
      blip(t + 0.1, 220, 0.9, 'sawtooth', 0.05, 4);
    },
    sparkle(t) { [880, 1175, 1568, 2093].forEach((f, i) => blip(t + i * 0.07, f, 0.18, 'sine', 0.12, 1.02)); },
    sad(t) { blip(t, 520, 0.45, 'triangle', 0.15, 0.6); },
    nope(t) { blip(t, 420, 0.08, 'square', 0.06, 0.8); blip(t + 0.1, 320, 0.12, 'square', 0.06, 0.8); },
  };
  function sfx(name) {
    if (!ready() || !SFX[name]) return;
    SFX[name](ctx.currentTime + 0.01);
  }

  function setMuted(on) {
    muted = !!on;
    try { localStorage.setItem(storageKey, muted ? '1' : '0'); } catch { /* private mode */ }
  }

  // A page can choose its own default (your dashboard starts muted: you're
  // standing next to her and your phone shouldn't squeak too).
  function configure({ key, defaultMuted } = {}) {
    if (key) storageKey = key;
    const v = read();
    muted = v === null ? !!defaultMuted : v === '1';
  }

  // Wire a 🔊 button.
  function button(el) {
    const draw = () => { el.textContent = muted ? '🔇' : '🔊'; el.setAttribute('aria-label', muted ? 'sound off' : 'sound on'); };
    el.onclick = () => { unlock(); setMuted(!muted); draw(); if (!muted) sfx('pop'); };
    draw();
  }

  window.Meet = Object.assign(window.Meet || {}, { voice: { speak, sfx, setMuted, configure, button, get muted() { return muted; } } });
})();
