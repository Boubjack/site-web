/**
 * AGENT — AI Photo Pro (studio photo IA de qualité cinématographique).
 *
 * Produit la DIRECTION ARTISTIQUE et le DOSSIER DE PRODUCTION complets pour des
 * visuels de niveau photographe professionnel : pipeline de traitement
 * (4K/8K, upscale, super-résolution, débruitage, HDR, balance des blancs,
 * exposition, préservation des détails…), 14 types de photos, mannequins IA,
 * essayage virtuel, génération multi-angles, mise en scène intelligente et
 * garde-fous de cohérence visuelle. Le rendu des pixels est délégué à un
 * moteur (studio/jobs) branché via .env ; sans moteur, le dossier complet est
 * livré (mode spécification).
 *
 * Permissions : vendeurs et administrateurs uniquement.
 */
const config = require('../../config');
const provider = require('../provider/anthropic');
const jobs = require('../studio/jobs');
const { store } = require('../../db/store');
const catalog = require('../services/catalog');

/* ---------------- Référentiels professionnels ---------------- */

const RESOLUTIONS = {
  '1080p': { w: 1920, h: 1080, label: 'Full HD' },
  '2k': { w: 2560, h: 1440, label: '2K QHD' },
  '4k': { w: 3840, h: 2160, label: '4K UHD' },
  '8k': { w: 7680, h: 4320, label: '8K UHD' },
};
const RES_ORDER = ['1080p', '2k', '4k', '8k'];

// Pipeline de post-traitement (ordonné), appliqué automatiquement.
const ENHANCE_PIPELINE = [
  { step: 'upscale', detail: 'Upscaling IA vers la résolution cible' },
  { step: 'super-resolution', detail: 'Super-résolution, reconstruction des micro-détails' },
  { step: 'denoise', detail: 'Réduction automatique du bruit' },
  { step: 'smart-sharpen', detail: 'Netteté intelligente préservant les contours' },
  { step: 'hdr', detail: 'Tone-mapping HDR, plage dynamique étendue' },
  { step: 'shadow-realism', detail: 'Ombres portées réalistes et douces' },
  { step: 'reflection-realism', detail: 'Reflets physiquement plausibles' },
  { step: 'texture-realism', detail: 'Restitution fidèle des textures (tissu, cuir, métal)' },
  { step: 'color-enhance', detail: 'Amélioration automatique des couleurs' },
  { step: 'white-balance', detail: 'Balance des blancs intelligente' },
  { step: 'exposure-correction', detail: 'Correction automatique de l\'exposition' },
  { step: 'defect-correction', detail: 'Correction des défauts et artefacts' },
  { step: 'detail-preservation', detail: 'Préservation des détails et de la netteté produit' },
];

// 14 types de photos produit.
const PHOTO_TYPES = {
  'catalogue-ecommerce': { label: 'Catalogue e-commerce', background: 'blanc pur #ffffff', lighting: 'éclairage diffus 3 points', composition: 'produit centré, ombre légère', mood: 'net, commercial' },
  'studio-blanc': { label: 'Studio fond blanc', background: 'cyclo blanc infini', lighting: 'softbox bilatéral', composition: 'produit isolé', mood: 'épuré' },
  'premium-noir': { label: 'Premium fond noir', background: 'noir profond #0a0a0b', lighting: 'rim light + spéculaire', composition: 'clair-obscur', mood: 'haut de gamme' },
  luxe: { label: 'Luxe', background: 'marbre / velours', lighting: 'lumière dorée douce', composition: 'produit surélevé, reflets maîtrisés', mood: 'prestige' },
  lifestyle: { label: 'Lifestyle', background: 'scène de vie réaliste', lighting: 'lumière naturelle fenêtre', composition: 'produit en usage', mood: 'authentique' },
  exterieur: { label: 'Extérieur', background: 'décor extérieur adapté', lighting: 'lumière du jour / golden hour', composition: 'produit dans l\'environnement', mood: 'dynamique' },
  interieur: { label: 'Intérieur', background: 'intérieur soigné', lighting: 'lumière chaude d\'ambiance', composition: 'mise en contexte', mood: 'chaleureux' },
  table: { label: 'Sur une table', background: 'plateau bois / pierre', lighting: 'lumière rasante', composition: 'vue 3/4 posée', mood: 'artisanal' },
  presentoir: { label: 'Sur présentoir', background: 'présentoir premium', lighting: 'spot directionnel', composition: 'produit mis en valeur', mood: 'boutique' },
  'flat-lay': { label: 'Flat lay', background: 'surface texturée vue de dessus', lighting: 'lumière zénithale uniforme', composition: 'mise à plat organisée', mood: 'éditorial' },
  minimaliste: { label: 'Minimaliste', background: 'aplat de couleur unie', lighting: 'lumière douce homogène', composition: 'négatif large, produit décalé', mood: 'design' },
  publicitaire: { label: 'Publicitaire', background: 'décor conceptuel', lighting: 'éclairage dramatique', composition: 'accroche visuelle forte', mood: 'impactant' },
  editoriale: { label: 'Éditoriale', background: 'décor narratif', lighting: 'lumière contrastée', composition: 'cadrage magazine', mood: 'artistique' },
  magazine: { label: 'Magazine', background: 'set couverture', lighting: 'beauty dish', composition: 'espace pour titres', mood: 'premium presse' },
};

const MANNEQUIN_OPTIONS = {
  gender: ['homme', 'femme', 'enfant'],
  morphology: ['élancée', 'athlétique', 'standard', 'grande taille'],
  skinTone: ['claire', 'métisse', 'foncée', 'ébène'],
  hair: ['courts', 'longs', 'tressés', 'afro', 'voilée'],
  expression: ['neutre', 'sourire', 'confiant', 'sérieux'],
  posture: ['debout de face', 'de profil', 'en marche', 'assis', '3/4 dynamique'],
};

// Génération multi-angles à partir d'une seule photo.
const ANGLES = [
  { id: 'face', label: 'Face', note: 'vue frontale de référence' },
  { id: 'dos', label: 'Dos', note: 'arrière du produit' },
  { id: 'profil-gauche', label: 'Profil gauche', note: 'côté gauche' },
  { id: 'profil-droit', label: 'Profil droit', note: 'côté droit' },
  { id: 'vue-45', label: 'Vue 45°', note: 'trois-quarts avant' },
  { id: 'zoom-details', label: 'Zoom détails', note: 'macro coutures/finitions' },
  { id: 'vue-portee', label: 'Vue portée', note: 'sur mannequin' },
  { id: 'vue-rapprochee', label: 'Vue rapprochée', note: 'gros plan produit' },
];

// Garde-fous de cohérence visuelle — passés au moteur de rendu.
const CONSISTENCY = [
  'préserver la forme exacte du produit',
  'respecter les vraies couleurs',
  'conserver les logos intacts',
  'conserver les motifs et imprimés',
  'restituer les textures réelles',
  'garder les proportions correctes',
  'ne jamais déformer ni inventer de détail produit',
];

// Mise en scène intelligente : décor auto selon le type de produit.
const STAGING_RULES = [
  { match: /sport|basket|sneaker|running|chaussure de sport/, decors: ['terrain de basket', 'salle de sport', 'rue urbaine', 'piste d\'athlétisme'] },
  { match: /montre|watch|horlog/, decors: ['plateau de marbre', 'bois noble', 'cuir pleine fleur', 'bureau premium'] },
  { match: /parfum|fragrance|eau de/, decors: ['bloc de verre', 'surface d\'eau', 'composition florale', 'lumière douce satinée'] },
  { match: /bijou|bague|collier|touareg|argent|or\b/, decors: ['velours sombre', 'pierre naturelle', 'soie', 'écrin premium'] },
  { match: /boubou|bazin|wax|pagne|robe|costume|tenue/, decors: ['studio mode', 'mur texturé bogolan', 'lumière éditoriale', 'décor cérémonie'] },
  { match: /telephone|smartphone|ecouteur|casque|tech|montre connect/, decors: ['surface ardoise', 'desk minimaliste', 'néons cyber', 'fond dégradé tech'] },
  { match: /sac|babouche|cuir/, decors: ['bois brut', 'cuir', 'pierre', 'lumière naturelle'] },
];

/* ---------------- Fonctions utilitaires ---------------- */

function clampResolution(requested) {
  const cap = config.media.imageMaxResolution || '4k';
  const capIdx = RES_ORDER.indexOf(cap);
  let idx = RES_ORDER.indexOf(requested || '4k');
  if (idx === -1) idx = RES_ORDER.indexOf('4k');
  if (idx > capIdx) idx = capIdx;
  return RES_ORDER[idx];
}

function productKeywordsText(product) {
  return catalog.normalize([product.name, product.category, product.subcategory, product.material, product.style].filter(Boolean).join(' '));
}

/** Mise en scène : liste de décors adaptés au produit. */
function stagingFor(product) {
  const text = productKeywordsText(product);
  const rule = STAGING_RULES.find((r) => r.match.test(text));
  const decors = rule ? rule.decors : ['studio neutre premium', 'décor lifestyle adapté', 'fond minimaliste'];
  return { productType: rule ? rule.match.source.split('|')[0] : product.category, decors };
}

function buildMannequin(opts = {}) {
  const pick = (arr, v) => (arr.includes(v) ? v : arr[0]);
  return {
    gender: pick(MANNEQUIN_OPTIONS.gender, opts.gender),
    age: opts.age || (opts.gender === 'enfant' ? 8 : 28),
    morphology: pick(MANNEQUIN_OPTIONS.morphology, opts.morphology),
    skinTone: pick(MANNEQUIN_OPTIONS.skinTone, opts.skinTone || 'métisse'),
    hair: pick(MANNEQUIN_OPTIONS.hair, opts.hair),
    expression: pick(MANNEQUIN_OPTIONS.expression, opts.expression),
    posture: pick(MANNEQUIN_OPTIONS.posture, opts.posture),
    note: 'Mannequin virtuel réutilisable : les vêtements peuvent être changés sans modifier le mannequin.',
  };
}

function multiAnglePlan(selection) {
  const wanted = Array.isArray(selection) && selection.length ? selection : ANGLES.map((a) => a.id);
  return ANGLES.filter((a) => wanted.includes(a.id));
}

/** Note de direction artistique (LLM si disponible, sinon règle). */
async function artDirection({ product, photoType, staging }) {
  const preset = PHOTO_TYPES[photoType];
  const fallback = `Direction : ${preset.label}. Fond ${preset.background}, ${preset.lighting}. ` +
    `Décor suggéré : ${staging.decors[0]}. Ambiance ${preset.mood}. Produit net, couleurs fidèles, cohérence absolue.`;
  if (!provider.enabled()) return fallback;
  try {
    return await provider.complete({
      fast: true,
      system: 'Tu es directeur artistique photo produit e-commerce haut de gamme. Écris une note de direction concise et actionnable (4 lignes max), photoréaliste.',
      messages: [{ role: 'user', content: `Produit: ${product.name} (${product.category}).\nType: ${preset.label}.\nDécors possibles: ${staging.decors.join(', ')}.` }],
      maxTokens: 300,
    });
  } catch {
    return fallback;
  }
}

/* ---------------- Construction du dossier de production ---------------- */

async function buildProductionSpec(input, ctx) {
  const product = input.productId ? store.getById('products', input.productId)
    : { name: input.productName || 'produit', category: input.category || 'divers' };
  const photoType = PHOTO_TYPES[input.photoType] ? input.photoType : 'catalogue-ecommerce';
  const resolution = clampResolution(input.resolution);
  const staging = stagingFor(product);
  const withMannequin = Boolean(input.mannequin) || input.photoType === 'lifestyle';
  const mannequin = withMannequin ? buildMannequin(input.mannequin || {}) : null;
  const angles = input.multiAngle ? multiAnglePlan(input.angles) : null;
  const direction = await artDirection({ product, photoType, staging });

  return {
    resolution,
    resolutionLabel: RESOLUTIONS[resolution].label,
    dimensions: `${RESOLUTIONS[resolution].w}×${RESOLUTIONS[resolution].h}`,
    maxByConfig: config.media.imageMaxResolution,
    photoType,
    photoTypeLabel: PHOTO_TYPES[photoType].label,
    lighting: PHOTO_TYPES[photoType].lighting,
    background: PHOTO_TYPES[photoType].background,
    staging,
    mannequin,
    angles,
    enhancementPipeline: ENHANCE_PIPELINE,
    consistency: CONSISTENCY,
    direction,
    product: { name: product.name, category: product.category },
  };
}

/* ---------------- Contrat d'agent ---------------- */

const tool = {
  name: 'photo_studio',
  description: 'AI Photo Pro : crée un dossier de production photo professionnel (type de photo, mise en scène, mannequin, multi-angles, pipeline 4K/8K) et lance le rendu. Types: ' + Object.keys(PHOTO_TYPES).join(', ') + '.',
  input_schema: {
    type: 'object',
    properties: {
      productId: { type: 'string' },
      productName: { type: 'string' },
      photoType: { type: 'string', description: Object.keys(PHOTO_TYPES).join(' | ') },
      resolution: { type: 'string', description: '1080p | 2k | 4k | 8k' },
      mannequin: { type: 'object', description: 'gender, morphology, skinTone, hair, expression, posture' },
      multiAngle: { type: 'boolean' },
    },
  },
};

async function run(input, ctx) {
  const action = input.action || 'produce';

  if (action === 'staging') {
    const product = input.productId ? store.getById('products', input.productId) : { name: input.productName, category: input.category };
    return { staging: stagingFor(product || {}) };
  }
  if (action === 'mannequin') return { mannequin: buildMannequin(input.mannequin || input), options: MANNEQUIN_OPTIONS };
  if (action === 'multiangle') return { angles: multiAnglePlan(input.angles), source: 'une seule photo suffit' };
  if (action === 'tryon') {
    // Architecture d'essayage virtuel (prête pour un moteur try-on).
    return {
      virtualTryOn: {
        mannequin: buildMannequin(input.mannequin || {}),
        garment: input.productName || (input.productId && (store.getById('products', input.productId) || {}).name) || 'vêtement',
        variations: { colors: input.colors || ['couleur d\'origine'], sizes: input.sizes || ['S', 'M', 'L', 'XL'] },
        angles: multiAnglePlan(['face', 'profil-gauche', 'profil-droit', 'dos']),
        consistency: CONSISTENCY,
        note: 'Architecture prête : essayage sur mannequin IA, changement automatique de couleurs/tailles, vues multiples.',
      },
    };
  }

  // action 'produce' : dossier complet + job de rendu.
  const spec = await buildProductionSpec(input, ctx);
  const job = jobs.createJob({
    kind: 'photo',
    userId: ctx.user ? ctx.user.id : null,
    spec,
    meta: { productId: input.productId || null, productName: spec.product.name },
  });
  return { jobId: job.id, status: job.status, spec, provider: config.media.imageProvider };
}

module.exports = {
  id: 'photo',
  name: 'AI Photo Pro',
  description: 'Studio photo IA cinématographique : 14 types de photos, mannequins, multi-angles, mise en scène, pipeline 4K/8K.',
  allowedRoles: ['seller', 'admin'],
  keywords: ['photo', 'image', 'visuel', 'fond', 'retouche', 'mannequin', 'studio', 'shooting', 'flat lay', 'angle'],
  tool,
  run,
  // API additionnelle (endpoints /studio, autres agents)
  createProductionSpec: buildProductionSpec,
  createJob: (args) => run({ ...args, action: 'produce' }, { user: { id: args.userId } }),
  stagingFor,
  buildMannequin,
  multiAnglePlan,
  PHOTO_TYPES,
  RESOLUTIONS,
  MANNEQUIN_OPTIONS,
  ANGLES,
};
