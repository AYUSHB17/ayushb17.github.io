// The stage: two avatars standing on the bottom edge of the screen, facing
// each other, with speech bubbles over their heads. Shared by her page and
// yours so both phones show the same little scene.
(function () {
  'use strict';
  const { Avatar, detectMood, REACT } = window.Meet;
  const voice = () => window.Meet.voice;

  // Start apart, end side by side; setDistance() moves between the two.
  const HER_X = '22%';
  const ME_X = '78%';
  const NEAR = 18; // % each one moves from start to right next to each other
  const VOICES = Object.assign({ me: { pitch: 470 }, her: { pitch: 660 }, friends: { pitch: 760 } }, window.MEETCUTE?.voices);
  const FRIEND_X = [10, 33, 3, 41];        // prep preview only: a little group around her
  const OFFSTAGE = '-18%';                 // where friends wait before you call them
  const POKES = {
    me: [['giggle', 'hehe'], ['blush', 'oh! hi'], ['spin', 'wheee'], ['chill', 'mhm']],
    her: [['giggle', 'hehe'], ['spin', 'wheee'], ['blush', 'heyy'], ['surprised', 'oh!']],
  };
  POKES.friends = POKES.her;

  class Stage {
    constructor(root) {
      this.root = root;
      this.bubbles = {};
      this.lastTalk = Date.now();
      this.friends = [];
      this.whispering = false;
      for (const who of ['her', 'me', 'friends']) {
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
      a.el.addEventListener('click', () => this.poke(who));
      this.root.appendChild(a.el);
      this[who] = a;
      return a;
    }

    // 0 = where they start, 1 = right next to each other. They walk there.
    setDistance(d, { walk = true } = {}) {
      this.distance = Math.max(0, Math.min(1, d));
      const to = { her: 22 + NEAR * this.distance + '%', me: 78 - NEAR * this.distance + '%' };
      return Promise.all(['her', 'me'].map((who) => {
        const a = this[who];
        if (!a || a.el.style.left === to[who]) return null;
        if (!walk) { a.el.style.left = to[who]; return null; }
        return a.walkTo(to[who], 700);
      }));
    }

    // One small step closer per reply, never all the way: that's for a yes.
    closer(step = 0.2, max = 0.85) {
      const now = this.distance || 0;
      return this.setDistance(Math.max(now, Math.min(max, now + step)));
    }

    other(who) { return who === 'me' ? (this.whispering ? this.friends[0] : this.her) : this.me; }

    // Her friends: same avatars, a bit smaller, standing behind her.
    placeFriends(list = [], { offstage = false } = {}) {
      for (const f of this.friends) f.el.remove();
      this.friends = list.slice(0, 4).map((f, i) => {
        const a = new Avatar(f.avatar, { className: 'av-friend', look: 'right' });
        a.el.style.left = offstage ? OFFSTAGE : FRIEND_X[i] + '%';
        a.el.addEventListener('click', () => this.poke('friends', a));
        this.root.insertBefore(a.el, this.root.firstChild);
        return a;
      });
      return this.friends;
    }

    // Whisper: her friends aren't on screen until you call them. They walk
    // in from the edge and huddle around tiny-him; she turns her back and
    // steps aside. Closing sends them off screen again.
    async whisper(on, friends) {
      this.whispering = on;
      // Faded bubbles still hold their last words; blank them so nothing
      // whispered survives in the page after it's closed.
      for (const b of Object.values(this.bubbles)) {
        b.classList.remove('show', 'typing');
        clearTimeout(b._hide);
        b.textContent = '';
      }
      const her = this.her;
      if (on) {
        this.placeFriends(friends?.length ? friends : window.Meet.DEFAULT_FRIENDS, { offstage: true });
        const meX = parseFloat(this.me?.el.style.left) || 78;
        const spots = [meX - 13, meX + 12, meX - 23, meX + 21].map((x) => Math.max(3, Math.min(96, x)));
        her?.mood('shy', { ms: 1400 });
        her?.el.classList.add('turned');
        this.me?.look('left');
        await Promise.all([
          her?.walkTo('6%', 800),
          ...this.friends.map((f, i) => {
            f.look(spots[i] < meX ? 'right' : 'left');   // face tiny-him
            return new Promise((r) => setTimeout(r, i * 250)).then(() => f.walkTo(spots[i] + '%', 1400));
          }),
        ]);
        this.friends.forEach((f) => f.mood('giggle', { ms: 1400 }));
        this.me?.mood('blush', { ms: 2000 });
      } else {
        her?.el.classList.remove('turned');
        await Promise.all([
          ...this.friends.map((f) => { f.look('left'); return f.walkTo(OFFSTAGE, 1400); }),
          this.setDistance(this.distance || 0),   // walks her back to where she was
        ]);
        this.placeFriends([]);
        her?.mood('happy', { ms: 1200 });
      }
    }

    // Tapping an avatar makes it react, so there's something to play with.
    poke(who, friend) {
      const a = friend || this[who];
      if (!a || a.el.dataset.mood !== 'idle') return;
      const [mood, sound] = POKES[who][Math.floor(Math.random() * POKES[who].length)];
      a.mood(mood, { ms: 1400, energy: 0.9 });
      voice()?.speak(sound, VOICES[who]);
    }

    // Who's talking: her, me, or one of her friends (whoever's first in line).
    speaker(who) { return who === 'friends' ? this.friends[0] : this[who]; }

    // Speak a line: bubble, squeaky voice, talking mouth and a mood, while
    // the other one reacts. Resolves after roughly the time it takes to read.
    say(who, text, mood, energy) {
      const a = this.speaker(who);
      if (!a) return Promise.resolve();
      const d = detectMood(text);
      mood = mood || d.mood;
      energy = energy || d.energy;
      this.lastTalk = Date.now();
      for (const [k, other] of Object.entries(this.bubbles)) if (k !== who) other.classList.remove('show');
      const b = this.bubbles[who];
      b.classList.remove('typing');
      b.textContent = text;
      b.classList.remove('show');
      void b.offsetWidth;
      b.classList.add('show');
      const readMs = Math.min(5200, 1100 + text.length * 45);
      a.mood(mood, { energy, ms: readMs });
      a.talking(true);
      voice()?.speak(text, VOICES[who]);
      setTimeout(() => a.talking(false), Math.min(readMs - 300, 600 + text.length * 35));
      // Listener: anything hopeful ("yes", "sure", "I'd love to") gets a jump.
      if (who === 'friends') this.friends.slice(1).forEach((f) => f.mood('giggle', { ms: 1200, fx: false }));
      const o = this.other(who);
      const react = d.positive ? 'jump' : REACT[mood] || 'nod';
      if (o) setTimeout(() => o.mood(react, { energy: Math.max(0.8, energy * 0.8), ms: 1800, fx: react !== 'nod' }), 500);
      if (react === 'jump') setTimeout(() => voice()?.sfx('boing'), 600);
      clearTimeout(b._hide);
      b._hide = setTimeout(() => b.classList.remove('show'), readMs + 4000);
      return new Promise((r) => setTimeout(r, readMs));
    }

    typing(who, on) {
      const b = this.bubbles[who];
      if (on) {
        if (b.classList.contains('show') && !b.classList.contains('typing')) return;
        b.innerHTML = '<i></i><i></i><i></i>';
        b.classList.add('show', 'typing');
        this.speaker(who)?.mood('think', { ms: 0, fx: false });
      } else if (b.classList.contains('typing')) {
        b.classList.remove('show', 'typing');
        this.speaker(who)?.mood('idle');
      }
    }

    // When nobody has spoken for a while, they still fidget like real people
    // standing in front of each other. Tiny-him plays it cool: leans,
    // whistles, glances over, looks away.
    idleLife() {
      if (Date.now() - this.lastTalk < 5000) return;
      const pick = Math.random() < 0.55 ? this.me : this.her;
      if (!pick || pick.el.dataset.mood !== 'idle') return;
      const r = Math.random();
      if (pick === this.me && r < 0.3) pick.mood('chill', { ms: 2600, energy: 0.6 });
      else if (r < 0.45) pick.mood('nod', { ms: 1400, fx: false, energy: 0.6 });
      else if (r < 0.62) {
        const was = pick.el.dataset.look;
        pick.look('front');
        setTimeout(() => pick.look(was), 1200);
      } else if (r < 0.72) pick.mood('happy', { ms: 1200, fx: false, energy: 0.4 });
      else if (r < 0.8 && this.her && this.me) pick.mood('blush', { ms: 1600, fx: false, energy: 0.5 });
    }
  }

  window.Meet.Stage = Stage;
  window.Meet.POS = { HER_X, ME_X };
  // Used when you open a whisper but didn't prep any friends: two generic ones.
  window.Meet.DEFAULT_FRIENDS = [
    { avatar: { skin: '#d9a074', hair: '#16100f', hairStyle: 'bob', outfit: 'tee', outfitColor: '#7bdff2', pants: '#34405e' } },
    { avatar: { skin: '#f6cfae', hair: '#6b4226', hairStyle: 'bun', outfit: 'jacket', outfitColor: '#b5a1ff', pants: '#2a2a35' } },
  ];
})();
