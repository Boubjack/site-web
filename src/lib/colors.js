const FRENCH_COLOR_MAP = {
  noir: '#000000',
  blanc: '#ffffff',
  rouge: '#c1121f',
  bleu: '#1d4ed8',
  vert: '#15803d',
  jaune: '#eab308',
  gris: '#6b7280',
  rose: '#ec4899',
  orange: '#ea580c',
  marron: '#78350f',
  violet: '#7c3aed',
  beige: '#d6cbb3',
  doré: '#b8860b',
  dore: '#b8860b',
  argenté: '#c0c0c0',
  argente: '#c0c0c0',
  bordeaux: '#7f1d1d',
  turquoise: '#14b8a6',
  kaki: '#6b7043'
};

export function colorToHex(name) {
  const key = String(name || '').trim().toLowerCase();
  if (FRENCH_COLOR_MAP[key]) return FRENCH_COLOR_MAP[key];
  if (/^#[0-9a-f]{3,8}$/i.test(key)) return key;
  return '#9ca3af';
}
