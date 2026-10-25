// Applies the theme before the page draws: ?theme=name in the URL wins, then
// `theme` in config.js, then the default (midnight). Each theme's fonts are
// loaded only when that theme is used.
(function () {
  'use strict';
  const FONTS = {
    midnight: 'Fredoka:wght@400;500;600;700',
    cafe: 'Fraunces:opsz,wght@9..144,600;9..144,700&family=Nunito:wght@400;600;700',
    pixel: 'Press+Start+2P',
    park: 'Baloo+2:wght@500;600;700&family=Fredoka:wght@500;600',
    scrapbook: 'Caveat:wght@600;700&family=Patrick+Hand',
    glass: 'Plus+Jakarta+Sans:wght@400;600;700;800',
  };
  const asked = new URLSearchParams(location.search).get('theme');
  const theme = FONTS[asked] ? asked : FONTS[window.MEETCUTE?.theme] ? window.MEETCUTE.theme : 'midnight';
  document.documentElement.dataset.theme = theme;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${FONTS[theme]}&display=swap`;
  document.head.appendChild(link);
  window.Meet = Object.assign(window.Meet || {}, { THEMES: Object.keys(FONTS), theme });
})();
