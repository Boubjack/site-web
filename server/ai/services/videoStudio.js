/**
 * 7. IA VIDÉO — studio de création de vidéos produit ("Créer une publicité IA").
 *
 * Entrées : photos produit + description + style choisi.
 * Sortie : vidéo marketing (zoom, rotation, transitions, textes animés,
 * effets premium, musique adaptée).
 *
 * Architecture : l'IA génère un STORYBOARD structuré (scènes, textes animés,
 * effets, musique) puis un adaptateur de rendu (VIDEO_PROVIDER) produit la
 * vidéo. Sans fournisseur branché, le storyboard complet est livré (mode
 * simulation) — prêt à être rendu dès qu'un moteur vidéo est configuré.
 *
 * Formats : tiktok (9:16, 15-30s) | instagram (9:16 ou 1:1) | catalogue (16:9)
 */
const config = require('../../config');
const provider = require('../provider/anthropic');
const { store } = require('../../db/store');
const catalog = require('./catalog');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:video-studio');

const FORMATS = {
  tiktok: { ratio: '9:16', duration: 20, vibe: 'rythmé, cuts rapides, texte punchy' },
  instagram: { ratio: '9:16', duration: 15, vibe: 'esthétique, transitions douces' },
  catalogue: { ratio: '16:9', duration: 30, vibe: 'sobre, informatif, premium' },
};

const STORYBOARD_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    music: { type: 'string', description: 'Ambiance musicale (ex: afrobeat énergique, coupé-décalé, lounge)' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          duration: { type: 'number', description: 'Durée en secondes' },
          shot: { type: 'string', description: 'Plan: zoom produit, rotation 360, détail matière, lifestyle...' },
          effect: { type: 'string', description: 'Effet: slow zoom, glitch, flash, parallaxe...' },
          text: { type: 'string', description: "Texte animé à l'écran (court)" },
          transition: { type: 'string' },
        },
        required: ['duration', 'shot', 'effect', 'text', 'transition'],
        additionalProperties: false,
      },
    },
    cta: { type: 'string', description: 'Appel à l\'action final' },
  },
  required: ['title', 'music', 'scenes', 'cta'],
  additionalProperties: false,
};

const renderers = {
  none: {
    async render(job) {
      return {
        simulated: true,
        note: `Aucun moteur vidéo configuré (VIDEO_PROVIDER=none). ` +
          `Storyboard prêt pour le rendu (${job.format}, ${FORMATS[job.format].ratio}).`,
      };
    },
  },
  // runway: { async render(job) { ... } },
};

function localStoryboard(product, format) {
  const f = FORMATS[format];
  const name = product ? product.name : 'votre produit';
  const price = product ? catalog.formatFcfa(product.price) : '';
  return {
    title: `${name} — pub ${format}`,
    music: format === 'catalogue' ? 'lounge premium instrumental' : 'afrobeat énergique',
    scenes: [
      { duration: 3, shot: 'zoom produit sur fond noir', effect: 'slow zoom avant', text: name, transition: 'fondu' },
      { duration: 4, shot: 'rotation 360° du produit', effect: 'lumière tournante', text: 'Qualité premium ✦', transition: 'cut' },
      { duration: 4, shot: 'détail matière / caractéristique clé', effect: 'macro + parallaxe', text: product && product.material ? product.material : 'Détails soignés', transition: 'glissement' },
      { duration: 4, shot: 'mise en situation lifestyle', effect: 'ralenti', text: price ? `Seulement ${price}` : 'Prix imbattable', transition: 'flash blanc' },
      { duration: Math.max(3, f.duration - 15), shot: 'packshot final logo E-Market', effect: 'texte animé bleu', text: 'Commandez sur E-Market 💙', transition: 'fondu noir' },
    ],
    cta: 'Livraison 24-72h à Bamako — commandez maintenant sur E-Market !',
    local: true,
  };
}

async function buildStoryboard({ product, description, format }) {
  if (!provider.enabled()) return localStoryboard(product, format);
  const f = FORMATS[format];
  try {
    return await provider.completeJson({
      system:
        "Tu es réalisateur de publicités produit pour E-Market (marketplace ouest-africaine). Tu crées des storyboards vidéo percutants adaptés au format demandé. Textes courts en français, ton local (Bamako), CTA vers E-Market.",
      messages: [{
        role: 'user',
        content:
          `Format: ${format} (${f.ratio}, ~${f.duration}s, style: ${f.vibe})\n` +
          `Produit: ${product ? `${product.name} — ${product.description} — ${catalog.formatFcfa(product.price)}` : 'non précisé'}\n` +
          `Brief vendeur: ${description || 'aucun'}`,
      }],
      schema: STORYBOARD_SCHEMA,
      maxTokens: 2048,
    });
  } catch (err) {
    log.warn('storyboard IA indisponible, repli local', { error: err.message });
    return localStoryboard(product, format);
  }
}

async function createJob({ userId, productId, description, format = 'tiktok', photos = [] }) {
  if (!FORMATS[format]) {
    throw Object.assign(new Error(`Format invalide. Choix: ${Object.keys(FORMATS).join(', ')}`), { status: 400 });
  }
  const product = productId ? store.getById('products', productId) : null;
  const storyboard = await buildStoryboard({ product, description, format });

  const job = store.insert('mediaJobs', {
    kind: 'video',
    userId,
    productId: productId || null,
    format,
    spec: FORMATS[format],
    photos,
    storyboard,
    provider: config.media.videoProvider,
    status: 'en-file',
  });

  process.nextTick(async () => {
    try {
      store.update('mediaJobs', job.id, { status: 'en-cours' });
      const renderer = renderers[config.media.videoProvider] || renderers.none;
      const result = await renderer.render(job);
      store.update('mediaJobs', job.id, { status: 'termine', result });
    } catch (err) {
      log.error('video job failed', { jobId: job.id, error: err.message });
      store.update('mediaJobs', job.id, { status: 'erreur', error: err.message });
    }
  });

  return job;
}

module.exports = { createJob, FORMATS };
