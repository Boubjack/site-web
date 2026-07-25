/**
 * Moteur de couleurs ORIGINAL — génère des palettes harmonieuses par calcul,
 * jamais par copie. Aucune palette d'un site ou d'un thème existant n'est
 * reproduite : tout est dérivé mathématiquement d'un accent et d'un
 * positionnement, avec variation par graine (chaque boutique diffère).
 *
 * Pur JavaScript, sans dépendance.
 */

/* ---------------- Conversions ---------------- */
function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6);
  return { r: parseInt(v.slice(0, 2), 16), g: parseInt(v.slice(2, 4), 16), b: parseInt(v.slice(4, 6), 16) };
}
function rgbToHex(r, g, b) {
  const c = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b); const min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s, l };
}
function hslToHex({ h, s, l }) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0; let g = 0; let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function toHsl(hex) { return rgbToHsl(hexToRgb(hex)); }

/** Luminance relative → choix auto texte clair/sombre (contraste WCAG). */
function readableOn(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  const L = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  return L > 0.45 ? '#0d1017' : '#f6f7fb';
}

const HARMONIES = {
  analogue: [0, 30, -30],
  complementaire: [0, 180, 150],
  triadique: [0, 120, 240],
  'split-complementaire': [0, 160, 200],
};

/**
 * Génère une palette complète depuis un accent, un positionnement et une graine.
 * @returns {object} tokens de couleurs prêts à l'emploi.
 */
function generate({ accent = '#2a90ff', positioning = 'Premium', harmony = 'analogue', seed = 0, dark = true } = {}) {
  const base = toHsl(accent);
  const shifts = HARMONIES[harmony] || HARMONIES.analogue;
  // Variation déterministe par graine (teinte + saturation), légère → cohérente.
  const jitter = ((seed * 47) % 24) - 12;
  const h = base.h + jitter;
  const accentSat = Math.min(1, Math.max(0.45, base.s || 0.7));

  const luxe = /luxe/i.test(positioning);
  const eco = /économique|economique|eco/i.test(positioning);

  const accentHex = hslToHex({ h, s: accentSat, l: luxe ? 0.52 : 0.56 });
  const accent2 = hslToHex({ h: h + shifts[1], s: accentSat * 0.9, l: 0.6 });
  const accent3 = hslToHex({ h: h + shifts[2], s: accentSat * 0.8, l: 0.62 });

  // Fonds : sombre (défaut premium/luxe) ou clair (économique/frais).
  const bg = dark
    ? hslToHex({ h, s: luxe ? 0.10 : 0.14, l: luxe ? 0.045 : 0.06 })
    : hslToHex({ h, s: 0.20, l: 0.975 });
  const surface = dark ? hslToHex({ h, s: 0.12, l: 0.10 }) : '#ffffff';
  const surface2 = dark ? hslToHex({ h, s: 0.12, l: 0.14 }) : hslToHex({ h, s: 0.16, l: 0.95 });
  const text = dark ? '#f6f7fb' : '#0d1017';
  const textSoft = dark ? hslToHex({ h, s: 0.08, l: 0.66 }) : hslToHex({ h, s: 0.10, l: 0.40 });
  const border = dark ? 'rgba(255,255,255,0.10)' : 'rgba(12,18,32,0.10)';

  return {
    accent: accentHex,
    accentInk: hslToHex({ h, s: accentSat, l: 0.42 }),
    accent2, accent3,
    bg, surface, surface2, text, textSoft, border,
    onAccent: readableOn(accentHex),
    scheme: dark ? 'dark' : 'light',
    harmony,
    // Dégradé signature (original, dérivé).
    gradient: `linear-gradient(135deg, ${accentHex}, ${eco ? accent2 : hslToHex({ h, s: accentSat, l: 0.4 })})`,
  };
}

module.exports = { generate, toHsl, hslToHex, hexToRgb, rgbToHex, readableOn, HARMONIES };
