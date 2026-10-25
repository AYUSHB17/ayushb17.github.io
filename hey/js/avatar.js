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
    // Open, wavy, centre-parted; strands fall past the cheeks to the shoulders.
    wavy: { label: 'wavy open',
      back: '<path d="M24,58 C20,24 42,14 60,14 C78,14 100,24 96,58 C100,80 93,96 101,112 C96,122 103,132 93,136 C84,140 78,132 74,128 L46,128 C42,132 36,140 27,136 C17,132 24,122 19,112 C27,96 20,80 24,58Z"/>',
      front: '<path d="M60,18 C44,18 30,28 26,46 C24,58 27,74 23,94 C30,86 33,68 34,55 C38,40 48,31 60,27 C72,31 82,40 86,55 C87,68 90,86 97,94 C93,74 96,58 94,46 C90,28 76,18 60,18Z"/>' },
    long: { label: 'long straight',
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

  // Props live inside the arm group so they move with the hand.
  const BOUQUET = `<g class="prop prop-flowers">
    <path d="M85,147 L81,127 M85,147 L85,124 M85,147 L89,127" stroke="#3f9b4f" stroke-width="1.6"/>
    <path d="M90,130 Q96,126 94,121 Q89,124 90,130Z M80,130 Q74,126 76,121 Q81,124 80,130Z" fill="#5cbf6a"/>
    <path d="M78,131 L92,131 L85,152Z" fill="#fff3c4" stroke="#f2d48a" stroke-width="1"/>
    <circle cx="80" cy="126" r="4.4" fill="#ff5c8a"/><circle cx="90" cy="126" r="4.4" fill="#ffd166"/>
    <circle cx="85" cy="120" r="4.8" fill="#ff8fb5"/>
    <circle cx="80" cy="126" r="1.6" fill="#ffd9e5"/><circle cx="90" cy="126" r="1.6" fill="#fff2c7"/>
    <circle cx="85" cy="120" r="1.8" fill="#ffd9e5"/></g>`;

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
        ${side === 'r' ? BOUQUET : ''}
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
  <g class="flames"><path d="M43,200 Q51,232 59,200Z" fill="#ffb703"/><path d="M61,200 Q69,232 77,200Z" fill="#ffb703"/>
    <path d="M47,200 Q51,218 55,200Z" fill="#fb5607"/><path d="M65,200 Q69,218 73,200Z" fill="#fb5607"/></g>
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
      <path class="blush-lines" d="M37,70 L35,74 M41,70 L39,74 M45,70 L43,74 M77,70 L75,74 M81,70 L79,74 M85,70 L83,74"
        stroke="#ff5c86" stroke-width="1.4" stroke-linecap="round"/>
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
        <g class="e e-puppy"><ellipse cx="47" cy="62" rx="5.8" ry="7" fill="${ink}"/><ellipse cx="73" cy="62" rx="5.8" ry="7" fill="${ink}"/>
          <circle cx="49.4" cy="59" r="2.4" fill="#fff"/><circle cx="75.4" cy="59" r="2.4" fill="#fff"/>
          <circle cx="45" cy="65.4" r="1.2" fill="#fff"/><circle cx="71" cy="65.4" r="1.2" fill="#fff"/></g>
        <g class="e e-half"><path d="M42,61.5 L52,61.5 M68,61.5 L78,61.5" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/>
          <ellipse cx="47" cy="64.2" rx="3.6" ry="2.6" fill="${ink}"/><ellipse cx="73" cy="64.2" rx="3.6" ry="2.6" fill="${ink}"/></g>
        <g class="e e-heart" fill="#ff3d6e">
          <path d="M47,67 L41.5,61.5 A3.2,3.2 0 0 1 47,57.6 A3.2,3.2 0 0 1 52.5,61.5Z"/>
          <path d="M73,67 L67.5,61.5 A3.2,3.2 0 0 1 73,57.6 A3.2,3.2 0 0 1 78.5,61.5Z"/></g>
      </g>
      <g class="tears" fill="#8fdcff"><path class="tear" d="M43,69 Q40.5,74 43,76.5 Q45.5,74 43,69Z"/>
        <path class="tear" d="M77,69 Q74.5,74 77,76.5 Q79.5,74 77,69Z"/></g>
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
 <path class="m m-wobble" d="M53,80 Q56.5,76.5 60,80 Q63.5,83.5 67,80" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path class="m m-smirk" d="M54,78 Q61,80.5 67,75" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path class="m m-cat" d="M53,76 Q56.5,80.5 60,76 Q63.5,80.5 67,76" stroke="${ink}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <ellipse class="m m-talk" cx="60" cy="78" rx="4.6" ry="3.6" fill="${ink}"/>
      </g>
    </g>
    <g class="hair-front" fill="${c.hair}">${hs.front}</g>
    <ellipse class="backhead" cx="60" cy="57" rx="35.5" ry="33.5" fill="${c.hair}"/>
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
    shy:       { eyes: 'closed', mouth: 'cat',   anim: 'shy',    fx: ['🙈'] },
    surprised: { eyes: 'wide',   mouth: 'o',     anim: 'jump',   fx: ['!'] },
    think:     { eyes: 'normal', mouth: 'flat',  anim: 'think',  fx: ['?'] },
    sad:       { eyes: 'puppy',  mouth: 'wobble', anim: 'sob',   min: 2600 },
    cry:       { eyes: 'puppy',  mouth: 'wobble', anim: 'sob',   min: 2600 },
    puppy:     { eyes: 'puppy',  mouth: 'smile', anim: 'puppy',  fx: ['🥺'] },
    blush:     { eyes: 'closed', mouth: 'cat',   anim: 'shy',    fx: ['💗', '💕'] },
    jump:      { eyes: 'happy',  mouth: 'laugh', anim: 'bigjump', fx: ['✨', '💖', '✨'], min: 1500 },
    rocket:    { eyes: 'happy',  mouth: 'laugh', anim: 'rocket', fx: ['🚀'], min: 2900, sfx: 'whoosh' },
    flowers:   { eyes: 'closed', mouth: 'smile', anim: 'offer',  fx: ['🌸', '💐'], min: 3000 },
    chill:     { eyes: 'half',   mouth: 'smirk', anim: 'chill',  fx: ['♪', '♫'] },
    giggle:    { eyes: 'happy',  mouth: 'cat',   anim: 'laugh',  fx: ['hehe'] },
    spin:      { eyes: 'happy',  mouth: 'grin',  anim: 'spin',   fx: ['✨'], min: 900 },
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
    // Something kept in hand across moods (her bouquet after she says yes).
    hold(prop) { this.el.dataset.prop = prop || ''; }
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
      if (m.sfx) window.Meet.voice?.sfx(m.sfx);
      this.busyUntil = Date.now() + (m.min || 0);
      clearTimeout(this._t);
      // Big moves (rocket, crying, flowers) must finish even if the line is short.
      if (name !== 'idle' && ms) this._t = setTimeout(() => this.mood('idle'), Math.max(ms, m.min || 0));
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
    const positive = /\b(yes+|yea+h?|yep|yup|sure|of course|why not|would love|i'?d love|sounds (good|fun|nice)|okay|ok|definitely|absolutely|let'?s go)\b|💖|🥰|😍/.test(s)
      && !/\bnot\b|\bno\b/.test(s);
    const energy = Math.min(2, 0.7 + bangs * 0.25 + emoji * 0.15 + (caps ? 0.5 : 0) + (t.length > 80 ? 0.2 : 0));
    if (mood === 'excited' && energy >= 1.5) mood = 'rocket';
    if (mood === 'sad') mood = 'cry';
    return { mood, energy, positive };
  }

  // How the *other* avatar reacts while listening.
  // Sad gets puppy eyes back, a crush gets a blush, big energy gets a jump.
  const REACT = { laugh: 'giggle', love: 'blush', shy: 'blush', surprised: 'surprised', sad: 'puppy', cry: 'puppy',
    think: 'think', neutral: 'chill', excited: 'jump', rocket: 'jump', happy: 'happy' };

  // Swatches shared by her avatar maker and your prep screen.
  const PALETTE = {
    skins: ['#ffe3cc', '#f6cfae', '#eab78f', '#d9a074', '#c68a5e', '#a86b45', '#8a5434', '#5e3a22'],
    hairs: ['#16100f', '#3b2417', '#6b4226', '#a0672e', '#dcb46f', '#b5452f', '#e58cb6', '#7381e0'],
    clothes: ['#ff7aa8', '#ffd166', '#7bdff2', '#b5a1ff', '#7ed6a5', '#f4f1ea', '#2a2a35', '#e4572e'],
  };

  window.Meet = Object.assign(window.Meet || {}, { Avatar, detectMood, REACT, HAIR, OUTFITS, PALETTE, shade, svg });
})();
