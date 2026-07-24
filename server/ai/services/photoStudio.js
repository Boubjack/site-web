/**
 * 6. STUDIO PHOTO IA — pipeline d'amélioration d'images produit.
 *
 * Architecture en file de jobs (collection mediaJobs) avec adaptateurs de
 * fournisseurs de génération d'image (IMAGE_PROVIDER dans .env). Sans
 * fournisseur branché, le job est planifié et documenté (mode simulation) —
 * l'interface reste identique quand un vrai fournisseur est configuré.
 *
 * Opérations : remove-background | enhance-quality | fix-lighting |
 *              sharpen | pro-background
 * Styles de fond : ecommerce-blanc | luxe-premium | lifestyle
 */
const config = require('../../config');
const provider = require('../provider/anthropic');
const { store } = require('../../db/store');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:photo-studio');

const OPERATIONS = ['remove-background', 'enhance-quality', 'fix-lighting', 'sharpen', 'pro-background'];
const STYLES = ['ecommerce-blanc', 'luxe-premium', 'lifestyle'];

/**
 * Adaptateurs fournisseurs. Pour brancher un vrai service (Replicate,
 * Stability, interne...), implémenter run(job) => { outputUrl }.
 */
const providers = {
  none: {
    async run(job) {
      // Mode simulation : le pipeline est validé, aucun rendu réel.
      return {
        simulated: true,
        note: `Aucun fournisseur image configuré (IMAGE_PROVIDER=none). ` +
          `Le job est prêt : ${job.operations.join(' → ')}${job.style ? ` avec fond "${job.style}"` : ''}.`,
      };
    },
  },
  // replicate: { async run(job) { ... } },
  // stability: { async run(job) { ... } },
};

/** Génère un brief de retouche professionnel (guidage du rendu). */
async function buildBrief({ productName, operations, style }) {
  const fallback =
    `Retouche e-commerce : ${operations.join(', ')}.` +
    (style ? ` Fond ${style}. Produit net, couleurs fidèles, ombre portée douce.` : '');
  if (!provider.enabled()) return fallback;
  try {
    return await provider.complete({
      fast: true,
      system: 'Tu écris des briefs de retouche photo produit e-commerce, concis et actionnables (4 lignes max).',
      messages: [{
        role: 'user',
        content: `Produit: ${productName || 'produit'}\nOpérations: ${operations.join(', ')}\nStyle de fond: ${style || 'aucun'}`,
      }],
      maxTokens: 300,
    });
  } catch {
    return fallback;
  }
}

async function createJob({ userId, productName, imageRef, operations = ['enhance-quality'], style = null }) {
  const ops = operations.filter((o) => OPERATIONS.includes(o));
  if (!ops.length) throw Object.assign(new Error(`Opérations invalides. Choix: ${OPERATIONS.join(', ')}`), { status: 400 });
  if (style && !STYLES.includes(style)) throw Object.assign(new Error(`Style invalide. Choix: ${STYLES.join(', ')}`), { status: 400 });

  const brief = await buildBrief({ productName, operations: ops, style });
  const job = store.insert('mediaJobs', {
    kind: 'photo',
    userId,
    productName: productName || null,
    imageRef: imageRef || null,
    operations: ops,
    style,
    brief,
    provider: config.media.imageProvider,
    status: 'en-file',
  });

  // Exécution asynchrone (ne bloque pas la requête HTTP).
  process.nextTick(async () => {
    try {
      store.update('mediaJobs', job.id, { status: 'en-cours' });
      const adapter = providers[config.media.imageProvider] || providers.none;
      const result = await adapter.run(job);
      store.update('mediaJobs', job.id, { status: 'termine', result });
    } catch (err) {
      log.error('photo job failed', { jobId: job.id, error: err.message });
      store.update('mediaJobs', job.id, { status: 'erreur', error: err.message });
    }
  });

  return job;
}

function getJob(id) {
  return store.getById('mediaJobs', id);
}

function listJobs(userId, kind) {
  return store.find('mediaJobs', (j) => j.userId === userId && (!kind || j.kind === kind));
}

module.exports = { createJob, getJob, listJobs, OPERATIONS, STYLES };
