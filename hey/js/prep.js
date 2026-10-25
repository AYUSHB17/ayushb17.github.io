// Prep, on your dashboard, before she scans: what she looks like, how many
// friends she's with and roughly what they look like, where you are, and one
// line about her that tiny-you will say. Saved under a random id that the QR
// carries, so her page opens already set up.
(function () {
  'use strict';
  const { Stage, HAIR, OUTFITS, PALETTE, net } = window.Meet;
  const $ = (id) => document.getElementById(id);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const STORE = 'mc-prep';

  const PLACES = [['street', '🌃 night out'], ['cafe', '☕ café'], ['park', '🌳 park'], ['mall', '🛍️ mall'],
    ['college', '📚 college'], ['arcade', '🕹️ arcade']];
  const HAIR_KEYS = ['long', 'bob', 'ponytail', 'bun', 'curly', 'short'];

  const randomLook = () => ({ skin: pick(PALETTE.skins.slice(1, 7)), hair: pick(PALETTE.hairs.slice(0, 5)),
    hairStyle: pick(HAIR_KEYS), outfit: pick(['dress', 'tee', 'jacket', 'kurta', 'hoodie']),
    outfitColor: pick(PALETTE.clothes), pants: '#34405e', glasses: Math.random() < 0.2 });

  let draft = load() || { place: 'street', detail: '', her: { avatar: { skin: '#eab78f', hair: '#3b2417',
    hairStyle: 'long', outfit: 'dress', outfitColor: '#ff7aa8', pants: '#34405e', glasses: false } }, friends: [] };
  let editing = 'her'; // 'her' or a friend's index
  let stage = null;
  let onDone = null;

  function load() { try { return JSON.parse(localStorage.getItem(STORE)); } catch { return null; } }
  function save() { try { localStorage.setItem(STORE, JSON.stringify(draft)); } catch { /* private mode */ } }
  const current = () => (editing === 'her' ? draft.her.avatar : draft.friends[editing].avatar);

  function open(done) {
    onDone = done;
    $('list').hidden = true;
    $('prep').hidden = false;
    if (!stage) stage = new Stage($('prepStage'));
    stage.place('me', window.MEETCUTE.me.avatar);
    $('pDetail').value = draft.detail || '';
    render();
  }

  function close() {
    $('prep').hidden = true;
    Meet.setTheme(Meet.defaultTheme);
    onDone?.(null);
  }

  // Redraw everything from `draft`. Cheap enough to do on every tap.
  function render() {
    Meet.setTheme(Meet.PLACE_THEME[draft.place]);
    const her = stage.place('her', draft.her.avatar);
    her.update(draft.her.avatar);
    stage.placeFriends(draft.friends);
    stage.setDistance(0.3, { walk: false });

    chips($('pPlace'), PLACES, draft.place, (k) => { draft.place = k; });
    chips($('pCount'), [0, 1, 2, 3, 4].map((n) => [n, n === 0 ? 'just her' : `+${n}`]), draft.friends.length, (n) => {
      while (draft.friends.length < n) draft.friends.push({ avatar: randomLook() });
      draft.friends.length = n;
      if (editing !== 'her' && editing >= n) editing = 'her';
    });
    chips($('pWho'), [['her', '💖 her'], ...draft.friends.map((_, i) => [i, `friend ${i + 1}`])], editing, (k) => { editing = k; });
    const a = current();
    chips($('pHair'), HAIR_KEYS.map((k) => [k, HAIR[k].label]), a.hairStyle, (k) => { a.hairStyle = k; });
    chips($('pOutfit'), Object.keys(OUTFITS).reverse().map((k) => [k, k]), a.outfit, (k) => { a.outfit = k; });
    swatches($('pSkin'), PALETTE.skins, a.skin, (c) => { a.skin = c; });
    swatches($('pHairC'), PALETTE.hairs, a.hair, (c) => { a.hair = c; });
    swatches($('pOutC'), PALETTE.clothes, a.outfitColor, (c) => { a.outfitColor = c; });
    $('pGlasses').checked = !!a.glasses;
    save();
  }

  function chips(box, items, selected, set) {
    box.innerHTML = '';
    for (const [key, label] of items) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chip' + (key === selected ? ' on' : '');
      b.textContent = label;
      b.onclick = () => { set(key); render(); };
      box.appendChild(b);
    }
  }
  function swatches(box, colors, selected, set) {
    box.innerHTML = '';
    for (const c of colors) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (c === selected ? ' on' : '');
      b.style.background = c;
      b.setAttribute('aria-label', c);
      b.onclick = () => { set(c); render(); };
      box.appendChild(b);
    }
  }

  $('pGlasses').onchange = (e) => { current().glasses = e.target.checked; render(); };
  $('pDetail').oninput = (e) => { draft.detail = e.target.value; save(); };
  $('pBack').onclick = close;
  $('pGo').onclick = async () => {
    $('pGo').disabled = true;
    try {
      const pid = await net.me.prep(draft);
      $('prep').hidden = true;
      Meet.setTheme(Meet.defaultTheme);
      const n = draft.friends.length;
      onDone?.({ pid, label: `${PLACES.find(([k]) => k === draft.place)?.[1] || ''}${n ? ` · +${n} friend${n > 1 ? 's' : ''}` : ''}` });
    } catch (err) {
      $('pGo').textContent = 'couldn’t save — try again';
    } finally {
      $('pGo').disabled = false;
    }
  };

  window.Meet.prep = { open };
})();
