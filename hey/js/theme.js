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
  // Where you met her (set in prep) → which theme fits.
  const PLACE_THEME = { cafe: 'cafe', park: 'park', street: 'midnight', mall: 'glass', college: 'scrapbook', arcade: 'pixel' };
  const loaded = new Set();

  function setTheme(name) {
    const theme = FONTS[name] ? name : 'midnight';
    document.documentElement.dataset.theme = theme;
    if (!loaded.has(theme)) {
      loaded.add(theme);
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://fonts.googleapis.com/css2?family=${FONTS[theme]}&display=swap`;
      document.head.appendChild(link);
    }
    window.Meet.theme = theme;
    return theme;
  }

  const asked = new URLSearchParams(location.search).get('theme');
  window.Meet = Object.assign(window.Meet || {}, { THEMES: Object.keys(FONTS), PLACE_THEME, setTheme });
  window.Meet.defaultTheme = setTheme(FONTS[asked] ? asked : window.MEETCUTE?.theme);
})();
