/**
 * AI BRAND KIT — identité visuelle propre à chaque vendeur.
 *
 * Le vendeur enregistre une fois son identité (nom, logo, couleurs, police,
 * style, slogan, site, réseaux, positionnement). Toutes les créations du
 * Creative Studio (photos, vidéos, publicités, réseaux sociaux) l'appliquent
 * automatiquement pour garantir une cohérence graphique totale.
 */
const { store } = require('../../db/store');

const POSITIONING = ['Luxe', 'Streetwear', 'Sport', 'Élégant', 'Minimaliste', 'Premium', 'Casual', 'Artisanal'];
const GRAPHIC_STYLES = ['Épuré', 'Audacieux', 'Éditorial', 'Chaleureux', 'Futuriste', 'Naturel', 'Rétro'];

// Correspondance positionnement → style vidéo par défaut (agent video.js).
const POSITIONING_TO_VIDEO_STYLE = {
  Luxe: 'luxe', Streetwear: 'streetwear', Sport: 'sport', Élégant: 'elegant',
  Minimaliste: 'minimaliste', Premium: 'premium', Casual: 'energique', Artisanal: 'elegant',
};

// Correspondance positionnement → style musical par défaut.
const POSITIONING_TO_MUSIC = {
  Luxe: 'Luxe', Streetwear: 'Streetwear', Sport: 'Sport', Élégant: 'Élégant',
  Minimaliste: 'Minimaliste', Premium: 'Premium', Casual: 'Dynamique', Artisanal: 'Élégant',
};

function defaults(seller) {
  return {
    brandName: seller ? (seller.shop || seller.name) : 'Ma marque',
    logo: null,
    primaryColors: ['#2a90ff', '#0a5bd8'],
    secondaryColors: ['#f6f7fb', '#08080a'],
    font: 'Sora',
    graphicStyle: 'Épuré',
    slogan: '',
    website: '',
    socials: {},
    positioning: 'Premium',
    configured: false,
  };
}

/** Brand Kit du vendeur (ou valeurs par défaut, non persistées). */
function getForSeller(sellerId) {
  const existing = store.findOne('brandKits', (k) => k.sellerId === sellerId);
  if (existing) return existing;
  const seller = store.getById('users', sellerId);
  return { sellerId, ...defaults(seller) };
}

const FIELDS = ['brandName', 'logo', 'primaryColors', 'secondaryColors', 'font', 'graphicStyle', 'slogan', 'website', 'socials', 'positioning'];

function save(sellerId, patch = {}) {
  const clean = {};
  for (const f of FIELDS) if (patch[f] !== undefined) clean[f] = patch[f];
  clean.configured = true;
  const existing = store.findOne('brandKits', (k) => k.sellerId === sellerId);
  if (existing) return store.update('brandKits', existing.id, clean);
  const seller = store.getById('users', sellerId);
  return store.insert('brandKits', { sellerId, ...defaults(seller), ...clean });
}

/**
 * Guide de style condensé injecté dans les prompts de création : ce que chaque
 * moteur (photo, vidéo, pub) doit respecter pour rester fidèle à la marque.
 */
function styleGuide(kit) {
  return {
    brand: kit.brandName,
    slogan: kit.slogan || null,
    palette: { primary: kit.primaryColors, secondary: kit.secondaryColors },
    font: kit.font,
    graphicStyle: kit.graphicStyle,
    positioning: kit.positioning,
    videoStyle: POSITIONING_TO_VIDEO_STYLE[kit.positioning] || 'premium',
    musicStyle: POSITIONING_TO_MUSIC[kit.positioning] || 'Premium',
    directives: [
      `Toujours incruster le logo ${kit.logo ? 'fourni' : '(à ajouter)'} et respecter la marque « ${kit.brandName} »`,
      `Palette imposée : primaires ${kit.primaryColors.join(', ')} · secondaires ${kit.secondaryColors.join(', ')}`,
      `Typographie : ${kit.font}`,
      `Style graphique : ${kit.graphicStyle} · positionnement : ${kit.positioning}`,
      kit.slogan ? `Signature/slogan : « ${kit.slogan} »` : 'Signature à définir',
      'Cohérence graphique identique sur toutes les créations',
    ],
  };
}

module.exports = { getForSeller, save, styleGuide, defaults, POSITIONING, GRAPHIC_STYLES, POSITIONING_TO_VIDEO_STYLE, POSITIONING_TO_MUSIC };
