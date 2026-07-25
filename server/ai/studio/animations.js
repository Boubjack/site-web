/**
 * AI ANIMATION ENGINE — bibliothèque d'animations premium (catalogue).
 *
 * Regroupe des presets fluides (viser 60 FPS), activables/désactivables, et
 * respectueux de `prefers-reduced-motion`. Le catalogue alimente le générateur
 * de boutiques et l'UI ; chaque preset porte une courbe et une durée.
 */
const CATALOG = {
  scroll: ['fade', 'slide', 'scale', 'rotate', 'blur', 'reveal', 'mask-reveal', 'clip-reveal', 'text-reveal', 'image-reveal', 'cards-reveal'],
  hover: ['glow', 'lift', 'tilt', '3d', 'magnetic', 'expand', 'border-animation', 'shadow-animation', 'image-zoom', 'quick-view'],
  transitions: ['fade', 'slide', 'scale', 'morph', 'blur', 'luxury'],
  loading: ['skeleton', 'progress', 'animated-placeholder', 'shimmer', 'lazy', 'smart'],
  micro: ['button-hover', 'like', 'add-to-cart', 'wishlist', 'notification', 'success', 'error', 'form', 'validation'],
  scrollExperience: ['smooth-scroll', 'scroll-snap', 'parallax', 'sticky-sections', 'floating-objects', 'infinite-scroll', 'mouse-follow', 'cursor-effects'],
};

const EASINGS = {
  natural: 'cubic-bezier(0.32,0.72,0,1)',
  spring: 'cubic-bezier(0.34,1.56,0.64,1)',
  smooth: 'cubic-bezier(0.22,1,0.36,1)',
  inOut: 'cubic-bezier(0.65,0,0.35,1)',
};

/** Un profil d'animation cohérent selon une « personnalité » de marque. */
function profile(mood = 'moderne') {
  const map = {
    élégant: { ease: EASINGS.smooth, duration: '0.7s', scroll: 'fade', hover: 'lift' },
    prestige: { ease: EASINGS.smooth, duration: '0.9s', scroll: 'mask-reveal', hover: 'glow' },
    dynamique: { ease: EASINGS.spring, duration: '0.5s', scroll: 'slide', hover: 'tilt' },
    doux: { ease: EASINGS.natural, duration: '0.7s', scroll: 'fade', hover: 'expand' },
    moderne: { ease: EASINGS.natural, duration: '0.6s', scroll: 'reveal', hover: 'lift' },
  };
  return map[mood] || map.moderne;
}

module.exports = {
  catalog: () => ({ ...CATALOG, easings: EASINGS, principles: ['fluide', '60 FPS', 'jamais agressif', 'activable/désactivable', 'respecte prefers-reduced-motion'] }),
  profile,
  CATALOG, EASINGS,
};
