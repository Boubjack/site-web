/**
 * AGENT — AI Video Pro (studio vidéo IA cinématographique).
 *
 * Objectif : des vidéos comparables aux publicités des grandes marques. Le
 * vendeur choisit UNIQUEMENT le produit, le style et la durée ; l'IA génère
 * automatiquement le scénario, le storyboard, les plans caméra, l'éclairage,
 * les animations produit, les effets, les textes, la voix-off, la musique et
 * le montage final. Le rendu est délégué à un moteur (studio/jobs) branché via
 * .env ; sans moteur, le plan de production complet est livré.
 *
 * Permissions : vendeurs et administrateurs uniquement.
 */
const config = require('../../config');
const provider = require('../provider/llm');
const jobs = require('../studio/jobs');
const { store } = require('../../db/store');
const catalog = require('../services/catalog');

const RESOLUTIONS = { '1080p': 'Full HD', '2k': '2K', '4k': '4K UHD', '8k': '8K UHD' };
const RES_ORDER = ['1080p', '2k', '4k', '8k'];
const FPS = [24, 30, 60];

const CAMERA_MOVES = ['travelling', 'dolly', 'zoom progressif', 'zoom arrière', 'rotation 360°', 'orbit produit', 'vue aérienne', 'plan rapproché', 'macro', 'slow motion', 'time-lapse', 'suivi automatique', 'accéléré', 'reveal cinématographique'];
const EXPORT_FORMATS = ['MP4', 'MOV'];
const LIGHTING = ['éclairage studio', 'lumière naturelle', 'coucher de soleil', 'lumière premium', 'éclairage dramatique', 'néons', 'lumière douce', 'contre-jour'];
const PRODUCT_ANIMATIONS = ['rotation du produit', 'produit qui flotte', 'ouverture', 'vue éclatée / démontage', 'mise en avant des détails', 'changement de couleur', 'porté par un mannequin', 'apparition premium'];

const STYLES = {
  luxe: { music: 'nappe orchestrale lente, prestige', lighting: 'lumière premium', moves: ['dolly', 'orbit produit', 'macro', 'reveal cinématographique'], mood: 'prestige' },
  streetwear: { music: 'afro-trap énergique', lighting: 'néons', moves: ['zoom progressif', 'accéléré', 'plan rapproché', 'travelling'], mood: 'urbain' },
  sport: { music: 'électro puissante', lighting: 'éclairage dramatique', moves: ['slow motion', 'travelling', 'orbit produit', 'zoom progressif'], mood: 'intense' },
  elegant: { music: 'piano élégant', lighting: 'lumière douce', moves: ['dolly', 'reveal cinématographique', 'macro'], mood: 'raffiné' },
  minimaliste: { music: 'ambient minimal', lighting: 'éclairage studio', moves: ['plan rapproché', 'zoom arrière', 'rotation 360°'], mood: 'épuré' },
  premium: { music: 'cinématique premium', lighting: 'lumière premium', moves: ['orbit produit', 'macro', 'reveal cinématographique', 'vue aérienne'], mood: 'haut de gamme' },
  energique: { music: 'afrobeat rythmé', lighting: 'coucher de soleil', moves: ['accéléré', 'travelling', 'zoom progressif'], mood: 'dynamique' },
};

const FORMATS = {
  tiktok: { ratio: '9:16', defaultDuration: 20, platform: 'TikTok' },
  instagram: { ratio: '9:16', defaultDuration: 15, platform: 'Instagram' },
  'story-instagram': { ratio: '9:16', defaultDuration: 15, platform: 'Story Instagram' },
  'story-facebook': { ratio: '9:16', defaultDuration: 15, platform: 'Story Facebook' },
  facebook: { ratio: '1:1', defaultDuration: 20, platform: 'Facebook' },
  youtube: { ratio: '16:9', defaultDuration: 30, platform: 'YouTube' },
  shorts: { ratio: '9:16', defaultDuration: 30, platform: 'YouTube Shorts' },
  snapchat: { ratio: '9:16', defaultDuration: 15, platform: 'Snapchat' },
  whatsapp: { ratio: '9:16', defaultDuration: 30, platform: 'WhatsApp Status' },
  publicite: { ratio: '16:9', defaultDuration: 30, platform: 'Publicité' },
  presentation: { ratio: '16:9', defaultDuration: 45, platform: 'Présentation produit' },
  catalogue: { ratio: '16:9', defaultDuration: 30, platform: 'Catalogue' },
  reel: { ratio: '9:16', defaultDuration: 20, platform: 'Reel' },
  promotion: { ratio: '9:16', defaultDuration: 15, platform: 'Promotion' },
  lifestyle: { ratio: '16:9', defaultDuration: 30, platform: 'Lifestyle' },
  linkedin: { ratio: '1:1', defaultDuration: 30, platform: 'LinkedIn' },
  pinterest: { ratio: '2:3', defaultDuration: 20, platform: 'Pinterest' },
};

// Effets appliqués automatiquement au montage (cinématographiques).
const VIDEO_EFFECTS = ['effets lumineux', 'transitions premium', 'particules', 'profondeur de champ', 'flou cinématique', 'ralenti', 'accéléré', 'animations texte', 'animation du logo'];
const MUSIC_STYLES = ['Luxe', 'Premium', 'Streetwear', 'Sport', 'Élégant', 'Minimaliste', 'Dynamique'];

function clampResolution(requested) {
  const cap = config.media.videoMaxResolution || '4k';
  const capIdx = RES_ORDER.indexOf(cap);
  let idx = RES_ORDER.indexOf(requested || '4k');
  if (idx === -1) idx = RES_ORDER.indexOf('4k');
  if (idx > capIdx) idx = capIdx;
  return RES_ORDER[idx];
}

function pick(arr, i) { return arr[i % arr.length]; }

/** Storyboard cinématographique complet (règles) — enrichi par LLM si dispo. */
function ruleStoryboard({ product, style, duration, format }) {
  const s = STYLES[style] || STYLES.premium;
  const sceneCount = Math.max(3, Math.min(8, Math.round(duration / 4)));
  const per = Math.max(2, Math.round(duration / sceneCount));
  const name = product ? product.name : 'votre produit';
  const price = product ? catalog.formatFcfa(product.price) : '';

  const scenes = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const last = i === sceneCount - 1;
    scenes.push({
      index: i + 1,
      duration: per,
      camera: last ? 'reveal cinématographique' : pick(s.moves, i),
      lighting: i === 0 ? s.lighting : pick(LIGHTING, i + 2),
      animation: last ? 'apparition premium' : pick(PRODUCT_ANIMATIONS, i),
      text: last ? 'Commandez sur E-Market' : (i === 0 ? name : i === 1 ? 'Qualité premium ✦' : price ? `Seulement ${price}` : 'Détails soignés'),
      transition: last ? 'fondu au logo' : pick(['cut sec', 'fondu enchaîné', 'glissement', 'flash', 'whip pan'], i),
      sfx: last ? 'signature sonore E-Market' : pick(['whoosh', 'impact doux', 'riser', 'clic premium'], i),
    });
  }
  return { scenes, styleData: s, sceneCount };
}

async function scenario({ product, style, duration }) {
  const s = STYLES[style] || STYLES.premium;
  const fallback = `Pub ${style} (${duration}s) : ouverture ${s.mood}, montée en désir sur le produit, ` +
    `climax sur le prix/atout clé, clôture logo E-Market avec appel à l'action.`;
  if (!provider.enabled()) return fallback;
  try {
    return await provider.complete({
      fast: true,
      system: 'Tu es réalisateur de publicités produit haut de gamme (niveau Apple/Nike). Écris un pitch de scénario percutant en 3-4 lignes.',
      messages: [{ role: 'user', content: `Produit: ${product ? product.name : 'produit'}. Style: ${style}. Durée: ${duration}s.` }],
      maxTokens: 260,
    });
  } catch { return fallback; }
}

function voiceOver({ product, style, gender = 'femme', lang = 'fr' }) {
  const name = product ? product.name : 'ce produit';
  const price = product ? catalog.formatFcfa(product.price) : '';
  const scriptFr = `${name}. L'excellence, à portée de main. ${price ? `Disponible à ${price}. ` : ''}E-Market — votre marché, en mieux.`;
  const scriptEn = `${name}. Excellence, within reach. ${product ? `Available now. ` : ''}E-Market — your market, elevated.`;
  return {
    voices: ['homme', 'femme'],
    languages: { fr: 'actif', en: 'actif', bm: 'préparé (Bambara)' },
    selected: { gender, lang },
    script: lang === 'en' ? scriptEn : scriptFr,
    sync: 'voix synchronisée sur le montage (timecodes par scène)',
    provider: config.media.ttsProvider,
  };
}

function editPlan({ scenes, style }) {
  const s = STYLES[style] || STYLES.premium;
  return {
    cutting: 'découpage rythmé synchronisé sur les temps forts de la musique',
    transitions: 'transitions premium (fondus, whip pan, glissements)',
    pacing: s.mood === 'urbain' || s.mood === 'dynamique' ? 'rythme rapide' : 'rythme maîtrisé',
    musicSync: true,
    sfx: scenes.map((sc) => sc.sfx),
    animatedTitles: true,
    subtitles: true,
    logo: 'incrustation logo E-Market',
    endScreen: 'écran de fin : logo + appel à l\'action + réseaux',
  };
}

/* ---------------- Construction du plan de production ---------------- */

async function buildProductionPlan(input, ctx) {
  const product = input.productId ? store.getById('products', input.productId) : (input.productName ? { name: input.productName } : null);
  const style = STYLES[input.style] ? input.style : 'premium';
  const format = FORMATS[input.format] ? input.format : 'tiktok';
  const duration = Math.max(6, Math.min(60, parseInt(input.duration, 10) || FORMATS[format].defaultDuration));
  const resolution = clampResolution(input.resolution);
  const fps = FPS.includes(Number(input.fps)) ? Number(input.fps) : 30;

  const { scenes, sceneCount } = ruleStoryboard({ product, style, duration, format });
  const scenarioText = await scenario({ product, style, duration });

  return {
    title: `${product ? product.name : 'Produit'} — pub ${style} ${format}`,
    style,
    format, ratio: FORMATS[format].ratio, platform: FORMATS[format].platform,
    duration, sceneCount,
    resolution, resolutionLabel: RESOLUTIONS[resolution], fps,
    quality: { sharpness: true, colors: true, hdr: true, stabilization: true, denoise: true, audio: 'mastering audio' },
    scenario: scenarioText,
    scenes,
    cameraMoves: [...new Set(scenes.map((s) => s.camera))],
    lighting: [...new Set(scenes.map((s) => s.lighting))],
    animations: [...new Set(scenes.map((s) => s.animation))],
    effects: VIDEO_EFFECTS,
    music: { style, musicStyle: input.musicStyle || null, track: (STYLES[style] || STYLES.premium).music, provider: config.media.musicProvider, syncedToBeat: true },
    voiceOver: voiceOver({ product, style, gender: input.voiceGender, lang: input.lang }),
    edit: editPlan({ scenes, style }),
    brandKit: input.brandKit || null,
    product: product ? { name: product.name } : null,
  };
}

/* ---------------- Contrat d'agent ---------------- */

const tool = {
  name: 'video_studio',
  description: 'AI Video Pro : génère un plan de production vidéo publicitaire complet (scénario, storyboard, plans caméra, éclairage, animations, voix-off, musique, montage) et lance le rendu. Le vendeur choisit produit, style, durée. Styles: ' + Object.keys(STYLES).join(', ') + '. Formats: ' + Object.keys(FORMATS).join(', ') + '.',
  input_schema: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      productName: { type: 'string' },
      style: { type: 'string', description: Object.keys(STYLES).join(' | ') },
      duration: { type: 'number', description: 'Durée en secondes (6-60)' },
      format: { type: 'string', description: Object.keys(FORMATS).join(' | ') },
      resolution: { type: 'string', description: '1080p | 2k | 4k | 8k' },
      fps: { type: 'number', description: '24 | 30 | 60' },
      voiceGender: { type: 'string', description: 'homme | femme' },
      lang: { type: 'string', description: 'fr | en' },
    },
  },
};

async function run(input, ctx) {
  const plan = await buildProductionPlan(input, ctx);
  const job = jobs.createJob({
    kind: 'video',
    userId: ctx.user ? ctx.user.id : null,
    spec: plan,
    meta: { productId: input.productId || null, format: plan.format },
  });
  return { jobId: job.id, status: job.status, plan, provider: config.media.videoProvider };
}

module.exports = {
  id: 'video',
  name: 'AI Video Pro',
  description: 'Studio vidéo IA cinématographique : storyboard, plans caméra, éclairage, animations, voix-off, musique, montage — FHD à 8K.',
  allowedRoles: ['seller', 'admin'],
  keywords: ['video', 'vidéo', 'pub', 'publicité', 'clip', 'reel', 'tiktok', 'story', 'storyboard', 'film', 'spot'],
  tool,
  run,
  createProductionPlan: buildProductionPlan,
  createJob: (args) => run({ ...args }, { user: { id: args.userId } }),
  STYLES,
  FORMATS,
  CAMERA_MOVES,
  LIGHTING,
  PRODUCT_ANIMATIONS,
  VIDEO_EFFECTS,
  MUSIC_STYLES,
  EXPORT_FORMATS,
  FPS,
  RESOLUTIONS,
};
