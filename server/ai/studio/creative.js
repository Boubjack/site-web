/**
 * E-MARKET AI CREATIVE STUDIO — orchestration.
 *
 * Compose le Brand Kit + AI Photo Pro + AI Video Pro + IA Publicitaire pour
 * qu'un vendeur produise, en quelques clics, un contenu marketing de niveau
 * grande marque, cohérent avec l'identité de sa boutique.
 *
 * Comprend : déclinaisons réseaux sociaux (dimensions/durée/résolution),
 * générateur de publicités (affiches, flyers, bannières, carrousels,
 * miniatures + slogans/textes/hashtags/CTA), options d'export, et le workflow
 * « Créer ma campagne » qui génère tout le pack d'un coup.
 *
 * Rendu délégué à un moteur branché via .env ; sans moteur, chaque livrable est
 * fourni sous forme de spécification de production complète.
 */
const { store } = require('../../db/store');
const photo = require('../agents/photo');
const video = require('../agents/video');
const marketing = require('../services/marketing');
const brandkit = require('./brandkit');
const jobs = require('./jobs');
const catalog = require('../services/catalog');

/* ---------------- Déclinaisons réseaux sociaux ---------------- */
const SOCIAL_TARGETS = {
  'instagram-feed': { platform: 'Instagram Feed', kind: 'image', width: 1080, height: 1350, ratio: '4:5' },
  'instagram-story': { platform: 'Instagram Story', kind: 'image', width: 1080, height: 1920, ratio: '9:16' },
  'instagram-reel': { platform: 'Instagram Reel', kind: 'video', width: 1080, height: 1920, ratio: '9:16', duration: 15 },
  'facebook-post': { platform: 'Facebook', kind: 'image', width: 1200, height: 1200, ratio: '1:1' },
  'facebook-story': { platform: 'Facebook Story', kind: 'image', width: 1080, height: 1920, ratio: '9:16' },
  tiktok: { platform: 'TikTok', kind: 'video', width: 1080, height: 1920, ratio: '9:16', duration: 20 },
  'youtube-shorts': { platform: 'YouTube Shorts', kind: 'video', width: 1080, height: 1920, ratio: '9:16', duration: 30 },
  snapchat: { platform: 'Snapchat', kind: 'image', width: 1080, height: 1920, ratio: '9:16' },
  'whatsapp-status': { platform: 'WhatsApp Status', kind: 'image', width: 1080, height: 1920, ratio: '9:16' },
  linkedin: { platform: 'LinkedIn', kind: 'image', width: 1200, height: 627, ratio: '1.91:1' },
  pinterest: { platform: 'Pinterest', kind: 'image', width: 1000, height: 1500, ratio: '2:3' },
};

/* ---------------- Options d'export ---------------- */
const EXPORT = {
  imageFormats: ['PNG', 'JPG', 'WEBP'],
  videoFormats: ['MP4', 'MOV'],
  qualityTiers: {
    Standard: { image: '1080p', video: '1080p' },
    Haute: { image: '2k', video: '2k' },
    Ultra: { image: '4k', video: '4k' },
    Maximum: { image: '8k', video: '8k' },
  },
};

/* ---------------- Générateur de publicités ---------------- */
const AD_FORMATS = {
  affiche: { label: 'Affiche', width: 1080, height: 1350, ratio: '4:5', use: 'print/social' },
  flyer: { label: 'Flyer', width: 1240, height: 1748, ratio: 'A4', use: 'print' },
  banniere: { label: 'Bannière', width: 1500, height: 500, ratio: '3:1', use: 'web' },
  carrousel: { label: 'Carrousel', width: 1080, height: 1080, ratio: '1:1', slides: 5, use: 'social' },
  miniature: { label: 'Miniature', width: 1280, height: 720, ratio: '16:9', use: 'vidéo/thumbnail' },
  catalogue: { label: 'Catalogue', width: 1240, height: 1748, ratio: 'A4', pages: 'multi', use: 'print/pdf' },
  publicite: { label: 'Publicité', width: 1080, height: 1350, ratio: '4:5', use: 'ads' },
};

function resolveProduct(input) {
  if (input.productId) {
    const p = store.getById('products', input.productId);
    if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
    return p;
  }
  return { name: input.productName || 'produit', category: input.category || 'divers' };
}

async function copyFor(product, campaign) {
  try {
    if (product.id) return await marketing.generateKit({ productId: product.id, campaign: campaign || 'standard' });
  } catch { /* repli ci-dessous */ }
  const card = product.id ? catalog.productCard(product) : { name: product.name, price: 0, category: product.category || 'divers', description: '' };
  return {
    slogan: `${card.name} — l'essentiel, en mieux.`,
    adCopy: `${card.name} sur E-Market. Qualité vérifiée, livraison à Bamako.`,
    socialPost: `🔥 ${card.name}\n👉 Sur E-Market`,
    hashtags: ['#EMarket', '#Bamako', `#${(card.category || 'shop').replace(/-/g, '')}`],
    cta: 'Commandez maintenant',
  };
}

/** Un lot de publicités (specs) pour un produit, cohérent avec la marque. */
async function adKit(input, sellerId) {
  const product = resolveProduct(input);
  const kit = brandkit.getForSeller(sellerId);
  const guide = brandkit.styleGuide(kit);
  const copy = await copyFor(product, input.campaign);
  const wanted = Array.isArray(input.formats) && input.formats.length ? input.formats : Object.keys(AD_FORMATS);
  const ads = wanted.filter((f) => AD_FORMATS[f]).map((f) => ({
    format: f,
    ...AD_FORMATS[f],
    headline: copy.slogan,
    brand: guide.brand,
    palette: guide.palette,
    font: guide.font,
    background: photo.backgroundsFor(product).recommended,
    consistency: guide.directives,
  }));
  return {
    product: { name: product.name },
    brandKit: guide,
    copy: { slogan: copy.slogan, adCopy: copy.adCopy, socialPost: copy.socialPost, hashtags: copy.hashtags, cta: copy.cta || 'Commandez maintenant', description: copy.adCopy },
    ads,
  };
}

/** Déclinaisons réseaux sociaux demandées (dimensions/durée/résolution). */
function socialVersions(input, sellerId) {
  const product = resolveProduct(input);
  const kit = brandkit.getForSeller(sellerId);
  const guide = brandkit.styleGuide(kit);
  const wanted = Array.isArray(input.targets) && input.targets.length ? input.targets : Object.keys(SOCIAL_TARGETS);
  const versions = wanted.filter((t) => SOCIAL_TARGETS[t]).map((t) => ({ target: t, ...SOCIAL_TARGETS[t], brand: guide.brand, palette: guide.palette }));
  return { product: { name: product.name }, brandKit: guide, versions };
}

function compactVideo(product, { format, style, duration }) {
  const f = video.FORMATS[format] || video.FORMATS.tiktok;
  return {
    format, platform: f.platform, ratio: f.ratio,
    duration: duration || f.defaultDuration, style,
    hook: `${product.name} — ${style}`,
    cameraSample: (video.STYLES[style] || video.STYLES.premium).moves.slice(0, 2),
    effects: video.VIDEO_EFFECTS.slice(0, 4),
    cta: 'Commandez sur E-Market',
  };
}

/* ---------------- « Créer ma campagne » ---------------- */
/**
 * Workflow intelligent : à partir d'un simple produit, génère tout le pack
 * marketing (10 photos, 5 affiches, 3 bannières, 5 stories, 3 reels, 3 TikTok,
 * 1 pub, 1 miniature, textes/hashtags/descriptions), 100 % cohérent avec le
 * Brand Kit du vendeur.
 */
async function fullCampaign(input, sellerId) {
  const product = resolveProduct(input);
  const kit = brandkit.getForSeller(sellerId);
  const guide = brandkit.styleGuide(kit);
  const style = guide.videoStyle;
  const quality = EXPORT.qualityTiers[input.quality] ? input.quality : 'Ultra';
  const imgRes = EXPORT.qualityTiers[quality].image;

  const copy = await copyFor(product, input.campaign);

  const deliverables = {
    photos: photo.variants(product, { count: 10, photoType: 'premium-noir', resolution: imgRes }),
    affiches: Array.from({ length: 5 }, (_, i) => ({ index: i + 1, ...AD_FORMATS.affiche, headline: copy.slogan, background: photo.backgroundsFor(product).options[i % 4] })),
    bannieres: Array.from({ length: 3 }, (_, i) => ({ index: i + 1, ...AD_FORMATS.banniere, headline: copy.slogan })),
    stories: Array.from({ length: 5 }, () => compactVideo(product, { format: 'story-instagram', style, duration: 15 })),
    reels: Array.from({ length: 3 }, () => compactVideo(product, { format: 'instagram', style, duration: 20 })),
    tiktoks: Array.from({ length: 3 }, () => compactVideo(product, { format: 'tiktok', style, duration: 20 })),
    publicite: compactVideo(product, { format: 'publicite', style, duration: 30 }),
    miniature: { ...AD_FORMATS.miniature, headline: copy.slogan },
    textes: {
      slogan: copy.slogan,
      adCopy: copy.adCopy,
      socialPost: copy.socialPost,
      descriptions: [copy.adCopy, `${product.name} — ${guide.positioning} · ${guide.brand}`],
      hashtags: copy.hashtags,
      cta: copy.cta || 'Commandez maintenant',
    },
  };

  const totals = {
    photos: deliverables.photos.length,
    affiches: deliverables.affiches.length,
    bannieres: deliverables.bannieres.length,
    stories: deliverables.stories.length,
    reels: deliverables.reels.length,
    tiktoks: deliverables.tiktoks.length,
    publicite: 1, miniature: 1,
  };
  totals.total = Object.values(totals).reduce((s, n) => s + n, 0);

  // Un seul job « campagne » regroupe tout le pack (visible dans la file studio).
  const job = jobs.createJob({
    kind: 'campaign',
    userId: sellerId,
    spec: { product: { name: product.name }, brandKit: guide, totals, quality },
    meta: { productId: product.id || null, productName: product.name, totals },
  });

  return {
    jobId: job.id,
    status: job.status,
    product: { name: product.name },
    brandKit: guide,
    quality,
    exportOptions: EXPORT,
    totals,
    deliverables,
    note: 'Campagne complète générée en respectant l\'identité de la marque. Branchez un moteur de rendu (.env) pour produire les fichiers finaux.',
  };
}

module.exports = {
  SOCIAL_TARGETS, EXPORT, AD_FORMATS,
  adKit, socialVersions, fullCampaign,
};
