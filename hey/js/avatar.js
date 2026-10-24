// Tiny chibi avatars drawn as SVG, plus the mood system that animates them.
//
// An avatar is a config — { skin, hair, hairStyle, outfit, outfitColor,
// pants, glasses, beard } — rendered once. Everything after that (blinking,
// talking, laughing, waving, walking) is CSS driven by data-* attributes on
// the wrapper, so changing mood never rebuilds the SVG.
(function () {
  'use strict';

  function shade(hex, amt) {
    let c = String(hex || '#888888').replace('#', '');
    if (c.length === 3) c = c.split('').map((x) => x + x).join('');
    const n = parseInt(c, 16) || 0;
    const f = (v) => Math.round(amt < 0 ? v * (1 + amt) : v + (255 - v) * amt);
    return '#' + [n >> 16, (n >> 8) & 255, n & 255]
      .map((v) => Math.max(0, Math.min(255, f(v))).toString(16).padStart(2, '0')).join('');
  }

  function curls(cx, cy, r, a0, a1, n, size) {
    let s = '';
    for (let i = 0; i < n; i++) {
      const a = ((a0 + ((a1 - a0) * i) / (n - 1)) * Math.PI) / 180;
      s += `<circle cx="${(cx + r * Math.cos(a)).toFixed(1)}" cy="${(cy + r * Math.sin(a)).toFixed(1)}" r="${size}"/>`;
    }
    return s;
  }

  // Head is an ellipse at (60,58) rx34 ry32; bangs must stop above y≈47 (brows).
  const CAP = 'M25,56 C22,24 42,15 60,15 C78,15 98,24 95,56Z';
  const SWEPT = 'M26,64 C21,30 40,17 60,17 C82,17 99,30 94,64 C91,50 84,42 74,36 C64,46 46,48 34,44 C30,50 28,56 26,64Z';
  const HAIR = {
    short: { label: 'short', back: '',
      front: '<path d="M26,60 C22,32 38,18 60,18 C84,18 99,32 94,60 C92,50 88,44 82,41 C74,46 60,45 50,40 C42,46 32,50 26,60Z"/>' },
    spiky: { label: 'spiky', back: '',
      front: '<path d="M26,58 C20,36 30,20 44,20 L46,9 L56,17 L62,6 L69,17 L79,10 L79,22 C93,26 100,40 94,58 C92,50 88,44 82,41 C74,46 60,45 50,40 C42,46 32,50 26,58Z"/>' },
    side: { label: 'side part', back: '',
      front: '<path d="M26,60 C22,30 40,17 62,17 C86,17 99,32 94,60 C90,46 80,38 66,36 C52,40 38,42 30,52 Q28,56 26,60Z"/>' },
    long: { label: 'long',
      back: '<path d="M25,56 C22,24 42,15 60,15 C78,15 98,24 95,56 L101,126 Q92,134 78,128 L42,128 Q28,134 19,126Z"/>',
      front: `<path d="${SWEPT}"/>` },
    bob: { label: 'bob',
      back: '<path d="M23,58 C21,24 42,15 60,15 C78,15 99,24 97,58 L99,94 Q60,102 21,94Z"/>',
      front: '<path d="M25,62 C22,26 42,16 60,16 C78,16 98,26 95,62 L93,46 Q60,40 27,46Z"/>' },
    ponytail: { label: 'ponytail',
      back: `<path d="${CAP}"/><path d="M86,26 C114,22 120,72 106,104 C104,80 98,58 88,42Z"/>`,
      front: `<path d="${SWEPT}"/><circle cx="90" cy="31" r="4.5" class="tie"/>` },
    bun: { label: 'bun',
      back: `<path d="${CAP}"/><circle cx="60" cy="13" r="14"/>`,
      front: '<path d="M26,60 C22,30 40,18 60,18 C80,18 98,30 94,60 C90,48 80,40 60,40 C40,40 30,48 26,60Z"/>' },
    curly: { label: 'curly',
      back: curls(60, 56, 35, 150, 390, 16, 11.5) +
        '<circle cx="24" cy="88" r="10"/><circle cx="96" cy="88" r="10"/><circle cx="27" cy="104" r="9"/><circle cx="93" cy="104" r="9"/>',
      front: curls(60, 52, 27, 195, 345, 7, 9.5) },
  };

  const OUTFITS = {
    tee: 'tee', hoodie: 'hoodie', shirt: 'shirt', jacket: 'jacket', kurta: 'kurta', dress: 'dress',
  };

  function outfitSvg(type, color, skin, pants) {
    const dark = shade(color, -0.22);
    const TORSO = 'M40,112 Q40,101 53,100 L67,100 Q80,101 80,112 L82,156 Q60,161 38,156Z';
    const longSleeve = type !== 'tee' && type !== 'dress';
    const legColor = type === 'dress' ? skin : pants;
    const legTop = type === 'dress' || type === 'kurta' ? 168 : 150;
    let legs = `<g class="legs">
      <g class="leg leg-l"><rect x="47" y="${legTop}" width="10" height="${196 - legTop}" rx="5" fill="${legColor}"/>
        <ellipse cx="51" cy="198" rx="9" ry="5" fill="#2a2433"/></g>
      <g class="leg leg-r"><rect x="63" y="${legTop}" width="10" height="${196 - legTop}" rx="5" fill="${legColor}"/>
        <ellipse cx="69" cy="198" rx="9" ry="5" fill="#2a2433"/></g></g>`;
    const arm = (side) => {
      const [sx, hx] = side === 'l' ? [44, 35] : [76, 85];
      const ex = (sx + hx) / 2;
      const sleeveEnd = longSleeve ? `${hx},143` : `${ex},126`;
      return `<g class="arm arm-${side}">
        <path d="M${sx},108 L${hx},146" stroke="${skin}" stroke-width="8" stroke-linecap="round"/>
        <path d="M${sx},108 L${sleeveEnd}" stroke="${color}" stroke-width="${longSleeve ? 10 : 11}" stroke-linecap="round"/>
        <circle cx="${hx}" cy="147" r="5.5" fill="${skin}"/></g>`;
    };
    let torso;
    switch (type) {
      case 'hoodie':
        torso = `<path d="${TORSO}" fill="${color}"/>
          <path d="M45,104 Q60,94 75,104 Q60,113 45,104Z" fill="${dark}"/>
          <path d="M56,106 L55,121 M64,106 L65,121" stroke="#f5f2ec" stroke-width="1.6" stroke-linecap="round"/>
          <path d="M48,136 L72,136 L69,149 L51,149Z" fill="${dark}"/>`;
        break;
      case 'shirt':
        torso = `<path d="${TORSO}" fill="${color}"/>
          <path d="M53,100 L60,110 L50,108Z M67,100 L60,110 L70,108Z" fill="${shade(color, 0.55)}"/>
          <circle cx="60" cy="118" r="1.3" fill="${dark}"/><circle cx="60" cy="129" r="1.3" fill="${dark}"/>
          <circle cx="60" cy="140" r="1.3" fill="${dark}"/>`;
        break;
      case 'jacket':
        torso = `<path d="${TORSO}" fill="${color}"/>
          <path d="M54,101 L66,101 L64,158 L56,158Z" fill="#f4f1ea"/>
          <path d="M54,101 L49,124 L57,118 M66,101 L71,124 L63,118" stroke="${dark}" stroke-width="2" fill="none" stroke-linejoin="round"/>`;
        break;
      case 'kurta':
        torso = `<path d="M40,112 Q40,101 53,100 L67,100 Q80,101 80,112 L85,174 Q60,179 35,174Z" fill="${color}"/>
          <path d="M60,101 L60,124" stroke="${dark}" stroke-width="2"/>
          <path d="M53,100 Q60,106 67,100" stroke="${dark}" stroke-width="2" fill="none"/>
          <path d="M36,168 Q60,173 84,168" stroke="${shade(color, 0.4)}" stroke-width="2.5" fill="none"/>`;
        break;
      case 'dress':
        torso = `<path d="M44,110 Q44,100 53,100 L67,100 Q76,100 76,110 L93,174 Q60,183 27,174Z" fill="${color}"/>
          <path d="M45,124 Q60,128 75,124" stroke="${dark}" stroke-width="3" fill="none"/>
          <path d="M53,100 Q60,107 67,100" stroke="${dark}" stroke-width="1.6" fill="none"/>`;
        break;
      default:
        torso = `<path d="${TORSO}" fill="${color}"/>
          <path d="M53,100 Q60,108 67,100" stroke="${dark}" stroke-width="2" fill="none"/>`;
    }
    return { legs, torso: `<g class="torso">${torso}</g>`, arms: arm('l') + arm('r') };
  }

  function svg(cfg) {
    const c = Object.assign({ skin: '#e0ac69', hair: '#2b1d16', hairStyle: 'short', outfit: 'tee',
      outfitColor: '#ff7aa8', pants: '#34405e', glasses: false, beard: false }, cfg || {});
    const hs = HAIR[c.hairStyle] || HAIR.short;
    const o = outfitSvg(c.outfit, c.outfitColor, c.skin, c.pants);
    const skinDark = shade(c.skin, -0.12);
    const ink = '#2b2233';
    return `<svg viewBox="0 0 120 210" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <ellipse class="shadow" cx="60" cy="203" rx="30" ry="5" fill="rgba(0,0,0,.25)"/>
  <g class="headpart hair-back" fill="${c.hair}">${hs.back}</g>
  ${o.legs}
  <g class="bodypart">
    ${o.torso}
    <rect x="54" y="88" width="12" height="14" rx="4" fill="${skinDark}"/>
    ${o.arms}
  </g>
  <g class="headpart head">
    <circle cx="27" cy="62" r="6" fill="${c.skin}"/><circle cx="93" cy="62" r="6" fill="${c.skin}"/>
    <ellipse cx="60" cy="58" rx="34" ry="32" fill="${c.skin}"/>
    <g class="face">
      <g class="blush" fill="#ff7f9c"><ellipse cx="40" cy="72" rx="6" ry="3.4"/><ellipse cx="80" cy="72" rx="6" ry="3.4"/></g>
      <g class="brows" stroke="${shade(c.hair, -0.1)}" stroke-width="2.4" stroke-linecap="round" fill="none">
        <path d="M41,51 Q47,48 52,51"/><path d="M68,51 Q73,48 79,51"/></g>
      <g class="eyes">
        <g class="e e-normal"><ellipse cx="47" cy="62" rx="4.3" ry="5.6" fill="${ink}"/><ellipse cx="73" cy="62" rx="4.3" ry="5.6" fill="${ink}"/>
          <circle cx="48.6" cy="59.8" r="1.6" fill="#fff"/><circle cx="74.6" cy="59.8" r="1.6" fill="#fff"/></g>
        <g class="e e-wide"><circle cx="47" cy="62" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/><circle cx="73" cy="62" r="6" fill="#fff" stroke="${ink}" stroke-width="1.5"/>
          <circle cx="47" cy="62" r="3" fill="${ink}"/><circle cx="73" cy="62" r="3" fill="${ink}"/></g>
        <g class="e e-happy" stroke="${ink}" stroke-width="2.6" stroke-linecap="round" fill="none">
          <path d="M42,64 Q47,57 52,64"/><path d="M68,64 Q73,57 78,64"/></g>
        <g class="e e-closed" stroke="${ink}" stroke-width="2.4" stroke-linecap="round" fill="none">
          <path d="M42,61 Q47,66 52,61"/><path d="M68,61 Q73,66 78,61"/></g>
        <g class="e e-heart" fill="#ff3d6e">
          <path d="M47,67 L41.5,61.5 A3.2,3.2 0 0 1 47,57.6 A3.2,3.2 0 0 1 52.5,61.5Z"/>
          <path d="M73,67 L67.5,61.5 A3.2,3.2 0 0 1 73,57.6 A3.2,3.2 0 0 1 78.5,61.5Z"/></g>
      </g>
      ${c.glasses ? `<g class="glasses" stroke="${ink}" stroke-width="2" fill="rgba(255,255,255,.18)">
        <rect x="37" y="54" width="20" height="16" rx="6"/><rect x="63" y="54" width="20" height="16" rx="6"/>
        <path d="M57,61 Q60,58 63,61" fill="none"/></g>` : ''}
      ${c.beard ? `<path class="beard" d="M30,66 C32,86 46,93 60,93 C74,93 88,86 90,66 C86,78 76,84 60,84 C44,84 34,78 30,66Z" fill="${c.hair}" opacity=".85"/>` : ''}
      <g class="mouths">
        <path class="m m-smile" d="M53,76 Q60,82 67,76" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path class="m m-grin" d="M52,75 Q60,85 68,75Z" fill="${ink}"/>
        <g class="m m-laugh"><path d="M51,73 Q60,92 69,73Z" fill="${ink}"/><path d="M55,83 Q60,79 65,83 Q60,88 55,83Z" fill="#ff7f8f"/></g>
        <ellipse class="m m-o" cx="60" cy="78" rx="3.4" ry="4.4" fill="${ink}"/>
        <path class="m m-flat" d="M55,78 L65,78" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>
        <path class="m m-sad" d="M54,80 Q60,74 66,80" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse class="m m-talk" cx="60" cy="78" rx="4.6" ry="3.6" fill="${ink}"/>
      </g>
    </g>
    <g class="hair-front" fill="${c.hair}">${hs.front}</g>
  </g>
</svg>`;
  }

  // mood → which eyes, which mouth, which body animation, which particles
  const MOODS = {
    idle:      { eyes: 'normal', mouth: 'smile', anim: 'idle' },
    neutral:   { eyes: 'normal', mouth: 'flat',  anim: 'idle' },
    happy:     { eyes: 'happy',  mouth: 'grin',  anim: 'hop' },
    excited:   { eyes: 'happy',  mouth: 'laugh', anim: 'bounce', fx: ['✨', '⭐', '✨'] },
    laugh:     { eyes: 'happy',  mouth: 'laugh', anim: 'laugh',  fx: ['ha', 'ha!', '😂'] },
    love:      { eyes: 'heart',  mouth: 'grin',  anim: 'sway',   fx: ['💕', '💗', '💖'] },
    shy:       { eyes: 'closed', mouth: 'smile', anim: 'shy',    fx: ['🙈'] },
    surprised: { eyes: 'wide',   mouth: 'o',     anim: 'jump',   fx: ['!'] },
    think:     { eyes: 'normal', mouth: 'flat',  anim: 'think',  fx: ['?'] },
    sad:       { eyes: 'closed', mouth: 'sad',   anim: 'droop',  fx: ['💧'] },
    wave:      { eyes: 'happy',  mouth: 'grin',  anim: 'wave' },
    nod:       { eyes: 'normal', mouth: 'smile', anim: 'nod' },
    dance:     { eyes: 'happy',  mouth: 'grin',  anim: 'dance',  fx: ['🎵', '🎶'] },
    walk:      { eyes: 'normal', mouth: 'smile', anim: 'walk' },
  };

  class Avatar {
    constructor(cfg, opts = {}) {
      this.el = document.createElement('div');
      this.el.className = 'av' + (opts.className ? ' ' + opts.className : '');
      this.el.innerHTML = '<div class="av-body"></div><div class="av-fx"></div>';
      this.body = this.el.firstChild;
      this.fx = this.el.lastChild;
      this.update(cfg);
      this.mood('idle');
      if (opts.look) this.look(opts.look);
      // Stagger blinks so two avatars never blink in sync.
      this.el.style.setProperty('--blink-delay', (Math.random() * 3).toFixed(2) + 's');
    }
    update(cfg) {
      this.cfg = Object.assign({}, this.cfg, cfg);
      this.body.innerHTML = svg(this.cfg);
    }
    look(dir) { this.el.dataset.look = dir; }
    talking(on) { this.el.dataset.talking = on ? '1' : ''; }
    // Set a mood; it fades back to idle after `ms` unless another mood replaces it.
    mood(name, { ms = 2400, energy = 1, fx = true } = {}) {
      const m = MOODS[name] || MOODS.idle;
      Object.assign(this.el.dataset, { mood: name, eyes: m.eyes, mouth: m.mouth, anim: m.anim });
      this.el.style.setProperty('--e', Math.max(0.4, Math.min(2, energy)).toFixed(2));
      // Restart the CSS animation even when the same mood repeats.
      this.body.style.animation = 'none';
      void this.body.offsetWidth;
      this.body.style.animation = '';
      if (fx && m.fx) this.burst(m.fx, Math.round(2 + energy * 2));
      clearTimeout(this._t);
      if (name !== 'idle' && ms) this._t = setTimeout(() => this.mood('idle'), ms);
    }
    burst(symbols, n = 3) {
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        s.textContent = symbols[i % symbols.length];
        s.style.left = 25 + Math.random() * 50 + '%';
        s.style.animationDelay = i * 0.18 + 's';
        s.style.setProperty('--dx', (Math.random() * 40 - 20).toFixed(0) + 'px');
        this.fx.appendChild(s);
        setTimeout(() => s.remove(), 2200 + i * 180);
      }
    }
    // Move horizontally to `left` (a CSS length) with a walk cycle.
    walkTo(left, ms = 1200) {
      return new Promise((done) => {
        this.mood('walk', { ms: 0, fx: false });
        this.el.style.transition = `left ${ms}ms ease-in-out`;
        this.el.style.left = left;
        setTimeout(() => { this.mood('idle'); done(); }, ms);
      });
    }
  }

  // Read a message's mood and energy from its text, so the avatar acts the way
  // the message *feels*: "HAHAHA no way 😂😂" laughs harder than "haha".
  function detectMood(text) {
    const t = String(text || '');
    const s = t.toLowerCase();
    const bangs = (t.match(/!/g) || []).length;
    const emoji = (t.match(/\p{Extended_Pictographic}/gu) || []).length;
    const caps = t.length > 3 && /[A-Z]/.test(t) && t === t.toUpperCase();
    let mood = 'happy';
    if (/😂|🤣|😆|💀|\bha(ha)+|\bhehe|\blo+l\b|\blmao/.test(s)) mood = 'laugh';
    else if (/😍|🥰|😘|❤|💕|💖|♥|\blove\b|\bcute\b|\bsweet\b|\badorable\b/.test(s)) mood = 'love';
    else if (/😳|🙈|☺|🥺|\bshy\b|\bstop+ it\b|\bblush/.test(s)) mood = 'shy';
    else if (/😮|😲|🤯|😱|\bwow\b|\bomg\b|\bno way\b|\bwhoa\b|\breally\?/.test(s)) mood = 'surprised';
    else if (/😢|😭|😔|☹|🙁|\bsad\b|\bsorry\b|\bnot interested\b|\btaken\b|\bboyfriend\b/.test(s)) mood = 'sad';
    else if (/🤔|\bhm+\b|\bmaybe\b|\bidk\b|\bnot sure\b/.test(s) || /\?\s*$/.test(t)) mood = 'think';
    else if (/^(ok|okay|k|hm+|fine|sure|cool)\.?$/.test(s.trim())) mood = 'neutral';
    else if (bangs || caps) mood = 'excited';
    const energy = Math.min(2, 0.7 + bangs * 0.25 + emoji * 0.15 + (caps ? 0.5 : 0) + (t.length > 80 ? 0.2 : 0));
    return { mood, energy };
  }

  // How the *other* avatar reacts while listening.
  const REACT = { laugh: 'laugh', love: 'shy', shy: 'love', surprised: 'surprised', sad: 'sad',
    think: 'think', neutral: 'nod', excited: 'excited', happy: 'happy' };

  window.Meet = Object.assign(window.Meet || {}, { Avatar, detectMood, REACT, HAIR, OUTFITS, shade, svg });
})();
