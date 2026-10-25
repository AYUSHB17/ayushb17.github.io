// Art styles for the avatars. Every style draws the same rig (same parts,
// same moods, same animations), so switching style never touches the mood
// code. Most of the look comes from SVG filters applied to the avatar's
// `.art-root` group; anime and storybook also switch on extra face parts that
// avatar.js always draws and CSS keeps hidden otherwise (see css/art.css).
//
// The style is a data-art attribute on any ancestor: <html> for the real
// pages, one per card on the gallery page. ?art=name in the URL wins, then
// `art` in config.js, then chibi.
(function () {
  'use strict';
  const ARTS = ['chibi', 'anime', 'pixel', 'game', 'clay', 'sketch', 'storybook'];

  // Filters work in the avatar's own units (viewBox 120×210). The region is
  // generous so a rocket or a jump never gets clipped.
  const R = 'filterUnits="userSpaceOnUse" x="-80" y="-260" width="280" height="560" color-interpolation-filters="sRGB"';
  // Hand-drawn lines "boil": three wobble filters with different noise,
  // cycled by a CSS animation.
  const sketch = (id, seed) => `<filter id="${id}" ${R}>
      <feTurbulence type="fractalNoise" baseFrequency=".045" numOctaves="2" seed="${seed}" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="w"/>
      <feMorphology in="SourceAlpha" operator="dilate" radius="1.1" result="d"/>
      <feComposite in="d" in2="SourceAlpha" operator="out" result="edge"/>
      <feDisplacementMap in="edge" in2="n" scale="5" xChannelSelector="G" yChannelSelector="R" result="we"/>
      <feFlood flood-color="#2b2233"/><feComposite in2="we" operator="in" result="pencil"/>
      <feColorMatrix in="w" type="saturate" values=".72" result="soft"/>
      <feMerge><feMergeNode in="soft"/><feMergeNode in="pencil"/></feMerge>
    </filter>`;

  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
    <!-- 16-bit: sampled on a 4-unit grid. Dark details (eyes, mouth, brows)
         are thickened first (erode keeps the darkest colour nearby) so they
         land on the grid as solid pixels instead of vanishing between samples. -->
    <filter id="art-pixel" ${R}>
      <feMorphology in="SourceAlpha" operator="dilate" radius="2" result="d"/>
      <feFlood flood-color="#1b1226"/><feComposite in2="d" operator="in" result="ink"/>
      <feMorphology in="SourceGraphic" operator="erode" radius="1.1" result="bold"/>
      <feMerge result="art"><feMergeNode in="ink"/><feMergeNode in="bold"/></feMerge>
      <feFlood x="-78" y="-258" width="1" height="1" flood-color="#000" result="dot"/>
      <feComposite in="dot" width="4" height="4" result="cell"/>
      <feTile in="cell" result="grid"/>
      <feComposite in="art" in2="grid" operator="in"/>
      <feMorphology operator="dilate" radius="2"/>
    </filter>
    <!-- 2010s mobile game: thick ink outline, punchy colour, hard drop shadow -->
    <filter id="art-game" ${R}>
      <feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="d"/>
      <feFlood flood-color="#1a1023"/><feComposite in2="d" operator="in" result="ink"/>
      <feOffset in="ink" dx="2.5" dy="3.5" result="o"/>
      <feFlood flood-color="#000" flood-opacity=".35"/><feComposite in2="o" operator="in" result="drop"/>
      <feColorMatrix in="SourceGraphic" type="saturate" values="1.45" result="pop"/>
      <feMerge><feMergeNode in="drop"/><feMergeNode in="ink"/><feMergeNode in="pop"/></feMerge>
    </filter>
    <!-- Clay / toy: puffy diffuse light plus a glossy highlight -->
    <filter id="art-clay" ${R}>
      <feGaussianBlur in="SourceAlpha" stdDeviation="3.2" result="b"/>
      <feDiffuseLighting in="b" surfaceScale="5" diffuseConstant="1.05" lighting-color="#fff" result="dif">
        <feDistantLight azimuth="235" elevation="50"/></feDiffuseLighting>
      <feComposite in="SourceGraphic" in2="dif" operator="arithmetic" k1=".85" k2=".28" result="lit"/>
      <feSpecularLighting in="b" surfaceScale="5" specularConstant=".55" specularExponent="22" lighting-color="#fff" result="sp">
        <fePointLight x="25" y="-30" z="90"/></feSpecularLighting>
      <feComposite in="sp" in2="SourceAlpha" operator="in" result="gloss"/>
      <feComposite in="lit" in2="gloss" operator="arithmetic" k2="1" k3=".7" result="all"/>
      <feComposite in="all" in2="SourceAlpha" operator="in"/>
    </filter>
    ${sketch('art-sketch-a', 3)}${sketch('art-sketch-b', 11)}${sketch('art-sketch-c', 27)}
  </defs></svg>`;

  function install() {
    if (document.getElementById('art-defs')) return;
    const holder = document.createElement('div');
    holder.id = 'art-defs';
    holder.innerHTML = DEFS;
    document.body.prepend(holder);
  }
  if (document.body) install();
  else document.addEventListener('DOMContentLoaded', install);

  function setArt(name, el = document.documentElement) {
    const art = ARTS.includes(name) ? name : 'chibi';
    el.dataset.art = art;
    return art;
  }

  const asked = new URLSearchParams(location.search).get('art');
  window.Meet = Object.assign(window.Meet || {}, { ARTS, setArt });
  window.Meet.art = setArt(ARTS.includes(asked) ? asked : window.MEETCUTE?.art);
})();
