/**
 * File de jobs de rendu média (photo/vidéo) + adaptateurs de fournisseurs.
 *
 * Sans moteur configuré (provider 'none'), le job passe en "termine" avec le
 * DOSSIER DE PRODUCTION complet (mode simulation) : toutes les specs sont
 * prêtes, il ne manque que le rendu des pixels. Brancher un vrai moteur
 * (Replicate, Stability, Runway, Sora…) revient à implémenter run(job) dans
 * l'adaptateur correspondant — sans toucher au reste du code.
 */
const config = require('../../config');
const { store } = require('../../db/store');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:studio');

// Adaptateurs image. Pour brancher un moteur : ajouter { async run(job) }.
const imageProviders = {
  none: {
    async run(job) {
      const res = job.spec && job.spec.resolution ? String(job.spec.resolution).toUpperCase() : '4K';
      return {
        rendered: false,
        mode: 'specification',
        message: `Aucun moteur d'image configuré (IMAGE_PROVIDER=none). ` +
          `Dossier de production prêt en ${res} — ` +
          `branchez un moteur (ex. FLUX.1) pour générer les pixels.`,
      };
    },
  },
  // flux / sdxl / replicate / stability : { async run(job) { /* → { rendered:true, outputUrl } */ } },
};

const videoProviders = {
  none: {
    async run(job) {
      const res = job.spec && job.spec.resolution ? String(job.spec.resolution).toUpperCase() : '4K';
      const fps = job.spec && job.spec.fps ? job.spec.fps : 30;
      return {
        rendered: false,
        mode: 'specification',
        message: `Aucun moteur vidéo configuré (VIDEO_PROVIDER=none). ` +
          `Storyboard et plan de production prêts en ${res} ${fps} FPS — ` +
          `branchez un moteur (ex. LTX-Video/Wan 2.2) pour générer la vidéo.`,
      };
    },
  },
  // ltx / wan / runway / pika : { async run(job) { ... } },
};

// Campagne complète (« Créer ma campagne ») : pack multi-livrables.
const campaignProviders = {
  none: {
    async run(job) {
      const t = (job.spec && job.spec.totals) || {};
      return {
        rendered: false,
        mode: 'specification',
        message: `Pack de campagne prêt (${t.total || 0} livrables) — mode spécification. ` +
          `Branchez les moteurs image/vidéo (.env) pour produire les fichiers finaux.`,
        totals: t,
      };
    },
  },
};

function providerFor(kind) {
  if (kind === 'video') return videoProviders[config.media.videoProvider] || videoProviders.none;
  if (kind === 'campaign') return campaignProviders.none;
  return imageProviders[config.media.imageProvider] || imageProviders.none;
}

/** Crée un job et lance le rendu de façon asynchrone (ne bloque pas la requête). */
function createJob({ kind, userId, spec, meta = {} }) {
  const job = store.insert('mediaJobs', {
    kind,
    userId,
    provider: kind === 'video' ? config.media.videoProvider : config.media.imageProvider,
    spec,
    ...meta,
    status: 'en-file',
  });

  process.nextTick(async () => {
    try {
      store.update('mediaJobs', job.id, { status: 'en-cours' });
      const result = await providerFor(kind).run(job);
      store.update('mediaJobs', job.id, { status: 'termine', result });
    } catch (err) {
      log.error('render job failed', { jobId: job.id, error: err.message });
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

module.exports = { createJob, getJob, listJobs };
