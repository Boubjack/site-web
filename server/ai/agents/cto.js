/**
 * AGENT — AI CTO (directeur technique). Santé du système IA : fournisseurs
 * configurés (texte, image, vidéo, vecteurs), couverture fonctionnelle,
 * volumétrie de données, et recommandations de branchement (gratuit/OSS). Admin.
 */
const config = require('../../config');
const llm = require('../provider/llm');
const { store } = require('../../db/store');

async function run() {
  const active = llm.activeProvider();
  const media = config.media;

  const providers = {
    texte: active,
    image: media.imageProvider,
    upscale: media.upscaleProvider,
    detourage: media.bgRemovalProvider,
    detection: media.detectionProvider,
    ocr: media.ocrProvider,
    video: media.videoProvider,
    voix: media.ttsProvider,
    musique: media.musicProvider,
    vecteurs: config.vectors.provider,
  };

  const data = {
    produits: store.all('products').length,
    utilisateurs: store.all('users').length,
    commandes: store.all('orders').length,
    avis: store.all('reviews').length,
    evenements: store.all('events').length,
    conversationsIA: store.all('aiConversations').length,
  };

  const recommendations = [];
  if (active === 'local') recommendations.push('Aucun modèle de texte branché : activer OpenRouter (modèles gratuits) ou Ollama (local) pour des réponses génératives.');
  if (media.imageProvider === 'none') recommendations.push('Rendu image en mode spécification : brancher FLUX.1 (IMAGE_PROVIDER=flux) pour la génération réelle.');
  if (media.videoProvider === 'none') recommendations.push('Rendu vidéo en mode spécification : brancher LTX-Video/Wan 2.2 (VIDEO_PROVIDER=ltx|wan).');
  if (config.vectors.provider === 'local') recommendations.push('Recherche sémantique en index local (OK, gratuit) : passer à FAISS + embeddings modèle pour monter en volume.');
  const health = active !== 'local' ? 'optimal' : 'fonctionnel (moteur local)';

  return {
    role: 'AI CTO',
    headline: `Système IA ${health} · texte: ${active} · image: ${media.imageProvider} · vidéo: ${media.videoProvider} · vecteurs: ${config.vectors.provider}.`,
    providers,
    dataVolume: data,
    coverage: {
      assistants: ['shopping', 'seller', 'operator'],
      studios: ['AI Photo Pro', 'AI Video Pro'],
      note: 'Architecture modulaire : agents et assistants ajoutables sans modifier l\'existant.',
    },
    recommendations,
  };
}

module.exports = {
  id: 'cto',
  name: 'AI CTO',
  description: 'Directeur technique IA : fournisseurs, couverture fonctionnelle, volumétrie, recommandations de branchement.',
  allowedRoles: ['admin'],
  keywords: ['cto', 'technique', 'système', 'systeme', 'infra', 'fournisseur', 'provider', 'modèle', 'modele', 'api', 'stack'],
  tool: {
    name: 'cto_analysis',
    description: 'Santé du système IA (CTO) : fournisseurs configurés, volumétrie de données, recommandations techniques.',
    input_schema: { type: 'object', properties: {} },
  },
  run,
};
