// The stage: two avatars standing on the bottom edge of the screen, facing
// each other, with speech bubbles over their heads. Shared by her page and
// yours so both phones show the same little scene.
(function () {
  'use strict';
  const { Avatar, detectMood, REACT } = window.Meet;

  const HER_X = '27%';
  const ME_X = '73%';

  class Stage {
    constructor(root) {
      this.root = root;
      this.bubbles = {};
      this.lastTalk = Date.now();
      for (const who of ['her', 'me']) {
        const b = document.createElement('div');
        b.className = `bubble bubble-${who}`;
        root.appendChild(b);
        this.bubbles[who] = b;
      }
      setInterval(() => this.idleLife(), 3500);
    }

    place(who, cfg, { left, look } = {}) {
      if (this[who]) { this[who].update(cfg); return this[who]; }
      const a = new Avatar(cfg, { className: `av-${who}`, look: look || (who === 'her' ? 'right' : 'left') });
      a.el.style.left = left || (who === 'her' ? HER_X : ME_X);
      this.root.appendChild(a.el);
      this[who] = a;
      return a;
    }

    other(who) { return who === 'her' ? this.me : this.her; }

    // Speak a line: bubble + talking mouth + mood, while the other one reacts.
    // Resolves after roughly the time it takes to read it.
    say(who, text, mood, energy) {
      const a = this[who];
      if (!a) return Promise.resolve();
      const detected = detectMood(text);
      mood = mood || detected.mood;
      energy = energy || detected.energy;
      this.lastTalk = Date.now();
      this.bubbles[this.otherName(who)].classList.remove('show');
      const b = this.bubbles[who];
      b.classList.remove('typing');
      b.textContent = text;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
      const readMs = Math.min(5200, 1100 + text.length * 45);
      a.mood(mood, { energy, ms: readMs });
      a.talking(true);
      setTimeout(() => a.talking(false), Math.min(readMs - 300, 600 + text.length * 35));
      const o = this.other(who);
      if (o) setTimeout(() => o.mood(REACT[mood] || 'nod', { energy: energy * 0.7, ms: 1800, fx: false }), 500);
      clearTimeout(b._hide);
      b._hide = setTimeout(() => b.classList.remove('show'), readMs + 4000);
      return new Promise((r) => setTimeout(r, readMs));
    }

    otherName(who) { return who === 'her' ? 'me' : 'her'; }

    typing(who, on) {
      const b = this.bubbles[who];
      if (on) {
        if (b.classList.contains('show') && !b.classList.contains('typing')) return;
        b.innerHTML = '<i></i><i></i><i></i>';
        b.classList.add('show', 'typing');
        this[who]?.mood('think', { ms: 0, fx: false });
      } else if (b.classList.contains('typing')) {
        b.classList.remove('show', 'typing');
        this[who]?.mood('idle');
      }
    }

    // When nobody has spoken for a while, they still fidget like real people
    // standing in front of each other: nods, glances, little shifts.
    idleLife() {
      if (Date.now() - this.lastTalk < 5000) return;
      const pick = Math.random() < 0.5 ? this.her : this.me;
      if (!pick || pick.el.dataset.mood !== 'idle') return;
      const r = Math.random();
      if (r < 0.3) pick.mood('nod', { ms: 1400, fx: false, energy: 0.6 });
      else if (r < 0.5) {
        const was = pick.el.dataset.look;
        pick.look('front');
        setTimeout(() => pick.look(was), 1200);
      } else if (r < 0.62) pick.mood('happy', { ms: 1200, fx: false, energy: 0.4 });
      else if (r < 0.7 && this.her && this.me) pick.mood('shy', { ms: 1600, fx: false, energy: 0.5 });
    }
  }

  window.Meet.Stage = Stage;
  window.Meet.POS = { HER_X, ME_X };
})();
