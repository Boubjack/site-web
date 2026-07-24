/**
 * E-MARKET AI — routeur du module IA (monté sur /api/ai).
 * Module indépendant : toutes les capacités IA passent par ici, avec
 * authentification par rôle, limitation de débit et gestion d'erreurs.
 * Les clés API des modèles ne quittent jamais le serveur.
 */
const express = require('express');
const { asyncHandler, ApiError } = require('../middleware/errors');
const { requireAuth, requireRole } = require('../middleware/auth');
const { rateLimit } = require('../middleware/rateLimit');
const provider = require('./provider/anthropic');
const llm = require('./provider/llm');
const config = require('../config');

const assistants = require('./assistants'); // registre d'assistants : shopping, seller, operator
const agents = require('./agents');          // registre d'agents spécialisés
const orchestrator = require('./orchestrator');
const studioJobs = require('./studio/jobs');
const brandkit = require('./studio/brandkit');
const creative = require('./studio/creative');
const photoAgent = require('./agents/photo');
const videoAgent = require('./agents/video');
const recommender = require('./services/recommender');
const search = require('./services/search');
const seller = require('./services/seller');
const vision = require('./services/vision');
const marketing = require('./services/marketing');
const fraud = require('./services/fraud');
const analytics = require('./services/analytics');
const memory = require('./services/memory');
const i18n = require('./services/i18n');
const discovery = require('./services/discovery');

const router = express.Router();

// Les endpoints IA sont limités : les appels modèles ont un coût.
const aiLimit = rateLimit({ windowMs: 60000, max: 20 });
const heavyLimit = rateLimit({ windowMs: 60000, max: 6 });

/** Prépare une réponse Server-Sent Events et retourne l'émetteur. */
function openSse(res) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();
  return (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };
}

function sanitizeMessages(body) {
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const clean = messages
    .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  if (!clean.length || clean[clean.length - 1].role !== 'user') {
    throw new ApiError(400, 'messages doit se terminer par un message utilisateur.');
  }
  return clean;
}

/* ------------------------------------------------------------------ */
/* Statut du module                                                    */
/* ------------------------------------------------------------------ */
router.get('/status', (_req, res) => {
  const active = llm.activeProvider();
  res.json({
    name: 'E-Market AI',
    providerConfigured: llm.enabled(),
    activeProvider: active,
    mode: llm.enabled() ? 'modeles-cloud-ou-local' : 'moteur-local',
    model: active === 'anthropic' ? config.ai.model
      : active === 'openrouter' ? config.ai.openrouterModel
        : active === 'ollama' ? config.ai.ollamaModel : null,
    mediaProviders: config.media,
    vectors: config.vectors,
    languages: i18n.languages(),
  });
});

/* ================================================================== */
/* ASSISTANTS IA — trois assistants distincts (registre modulaire)     */
/*   shopping (public) · seller (vendeur) · operator (admin)           */
/* Chaque assistant a son prompt, ses permissions, ses outils, ses     */
/* données, son historique et son style propres.                       */
/* ================================================================== */

/** Liste des assistants accessibles à l'utilisateur courant. */
router.get('/assistants', (req, res) => {
  res.json({ assistants: assistants.listFor(req.user || null) });
});

/** Conversation streamée (SSE) avec un assistant donné. */
router.post('/assistants/:id/chat', aiLimit, asyncHandler(async (req, res) => {
  const def = assistants.get(req.params.id);
  if (!def) throw new ApiError(404, 'Assistant introuvable.');
  if (!assistants.canAccess(def, req.user || null)) throw new ApiError(403, 'Accès refusé à cet assistant.');
  const messages = sanitizeMessages(req.body);
  const sse = openSse(res);
  try {
    await assistants.run(req.params.id, { user: req.user || null, messages, sse });
  } catch (err) {
    sse('error', { message: 'E-Market AI est momentanément indisponible.' });
  }
  res.end();
}));

/** Historique propre à un assistant, pour l'utilisateur connecté. */
router.get('/assistants/:id/history', requireAuth, (req, res) => {
  const def = assistants.get(req.params.id);
  if (!def) throw new ApiError(404, 'Assistant introuvable.');
  if (!assistants.canAccess(def, req.user)) throw new ApiError(403, 'Accès refusé.');
  res.json({ messages: assistants.loadHistory(req.params.id, req.user.id) });
});

router.delete('/assistants/:id/history', requireAuth, (req, res) => {
  assistants.clearHistory(req.params.id, req.user.id);
  res.json({ ok: true });
});

/** Données de graphique pour l'assistant Operator (admin uniquement). */
router.get('/operator/chart/:key', requireRole('admin'), (req, res) => {
  const data = analytics.chartData(req.params.key);
  if (!data) throw new ApiError(404, 'Graphique inconnu.');
  res.json({ chart: data });
});

/* ------------------------------------------------------------------ */
/* 2. Recommandations + tracking comportemental                        */
/* ------------------------------------------------------------------ */
router.get('/recommendations', asyncHandler(async (req, res) => {
  const userId = req.user ? req.user.id : null;
  const { type = 'for-you', productId } = req.query;
  let items;
  if (type === 'complete-purchase') {
    if (!productId) throw new ApiError(400, 'productId requis pour complete-purchase.');
    items = recommender.completeYourPurchase(productId);
  } else if (type === 'you-may-like') {
    items = recommender.youMayLike(userId);
  } else {
    items = recommender.forYou(userId);
  }
  res.json({ type, items });
}));

router.post('/events', asyncHandler(async (req, res) => {
  const { type, productId, query } = req.body;
  if (!['view', 'favorite', 'search', 'purchase'].includes(type)) {
    throw new ApiError(400, 'type invalide (view|favorite|search|purchase).');
  }
  recommender.trackEvent({ userId: req.user ? req.user.id : null, type, productId, query });
  res.json({ ok: true });
}));

/* ------------------------------------------------------------------ */
/* 3. Recherche IA en langage naturel                                  */
/* ------------------------------------------------------------------ */
router.post('/search', aiLimit, asyncHandler(async (req, res) => {
  const query = String(req.body.query || '').slice(0, 500);
  if (!query.trim()) throw new ApiError(400, 'query est requis.');
  const result = await search.search(query, { userId: req.user ? req.user.id : null });
  res.json(result);
}));

/* ------------------------------------------------------------------ */
/* 4. Assistant vendeur — génération de fiche produit                  */
/* ------------------------------------------------------------------ */
router.post('/seller/listing', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  const { name, hints, condition, visionAnalysis } = req.body;
  if (!name || !String(name).trim()) throw new ApiError(400, 'name (nom du produit) est requis.');
  const listing = await seller.generateListing({
    name: String(name).slice(0, 200),
    hints: String(hints || '').slice(0, 1000),
    condition,
    visionAnalysis: visionAnalysis || null,
  });
  res.json({ listing });
}));

router.post('/seller/listing/publish', requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const { listing, extra } = req.body;
  if (!listing || !listing.title) throw new ApiError(400, 'listing généré requis.');

  // AI Modération : vérifie titre + description avant mise en ligne, signale si besoin.
  const moderation = require('./agents/moderation');
  const verdict = moderation.moderateText(`${listing.title}\n${listing.longDescription || ''}`);
  if (verdict.level === 'blocked') {
    throw new ApiError(422, 'Contenu refusé par la modération.', verdict.reasons);
  }
  const product = seller.publishListing(req.user.id, listing, extra || {});
  if (verdict.status === 'flag') {
    moderation.flag({ entityType: 'product', entityId: product.id, ownerId: req.user.id, verdict, excerpt: listing.title });
  }
  res.status(201).json({ product, moderation: verdict });
}));

/* ------------------------------------------------------------------ */
/* 5. Vision — analyse d'image et recherche par image                  */
/* ------------------------------------------------------------------ */
function readImage(req) {
  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) throw new ApiError(400, 'imageBase64 est requis (image encodée base64, sans préfixe data:).');
  if (!/^image\/(jpeg|png|webp|gif)$/.test(mediaType || '')) {
    throw new ApiError(400, 'mediaType invalide (image/jpeg, image/png, image/webp, image/gif).');
  }
  if (imageBase64.length > 7_000_000) throw new ApiError(413, 'Image trop volumineuse (max ~5 Mo).');
  return { imageBase64, mediaType };
}

router.post('/vision/analyze', requireAuth, heavyLimit, asyncHandler(async (req, res) => {
  res.json(await vision.analyzeImage(readImage(req)));
}));

router.post('/vision/search', heavyLimit, asyncHandler(async (req, res) => {
  res.json(await vision.searchByImage(readImage(req)));
}));

/* ------------------------------------------------------------------ */
/* AI Photo Pro / AI Video Pro (studios cinématographiques)            */
/* ------------------------------------------------------------------ */

/** Vérifie que le produit référencé appartient au vendeur (ou admin). */
function assertOwnsProduct(req) {
  if (!req.body.productId) return;
  const { store } = require('../db/store');
  const p = store.getById('products', req.body.productId);
  if (!p) throw new ApiError(404, 'Produit introuvable.');
  if (req.user.role !== 'admin' && p.sellerId !== req.user.id) {
    throw new ApiError(403, 'Ce produit ne fait pas partie de votre boutique.');
  }
}

/** Injecte le guide de style du Brand Kit du vendeur dans la création. */
function withBrandKit(req) {
  const sellerId = req.user.role === 'admin' ? (req.body.sellerId || req.user.id) : req.user.id;
  return { ...(req.body || {}), brandKit: brandkit.styleGuide(brandkit.getForSeller(sellerId)) };
}

// AI Photo Pro — action: produce | variants | staging | mannequin | backgrounds | multiangle | tryon
router.post('/studio/photo', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  res.status(202).json(await photoAgent.run(withBrandKit(req), { user: req.user }));
}));

// AI Video Pro — le vendeur choisit produit + style + durée
router.post('/studio/video', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  res.status(202).json(await videoAgent.run(withBrandKit(req), { user: req.user }));
}));

/* ---- AI Brand Kit (identité visuelle du vendeur) ---- */
router.get('/studio/brandkit', requireRole('seller', 'admin'), (req, res) => {
  const sellerId = req.user.role === 'admin' ? (req.query.sellerId || req.user.id) : req.user.id;
  res.json({ brandKit: brandkit.getForSeller(sellerId), options: { positioning: brandkit.POSITIONING, graphicStyles: brandkit.GRAPHIC_STYLES } });
});

router.put('/studio/brandkit', requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  const sellerId = req.user.role === 'admin' ? (req.body.sellerId || req.user.id) : req.user.id;
  res.json({ brandKit: brandkit.save(sellerId, req.body || {}) });
}));

/* ---- Creative Studio : variantes, décors, réseaux, pub, campagne ---- */
router.post('/studio/photo/variants', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  res.json(await photoAgent.run({ ...withBrandKit(req), action: 'variants', count: req.body.count || 5 }, { user: req.user }));
}));

router.post('/studio/backgrounds', requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  res.json(await photoAgent.run({ ...(req.body || {}), action: 'backgrounds' }, { user: req.user }));
}));

router.post('/studio/social', requireRole('seller', 'admin'), asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  const sellerId = req.user.role === 'admin' ? (req.body.sellerId || req.user.id) : req.user.id;
  res.json(creative.socialVersions(req.body || {}, sellerId));
}));

router.post('/studio/ad-kit', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  const sellerId = req.user.role === 'admin' ? (req.body.sellerId || req.user.id) : req.user.id;
  res.json(await creative.adKit(req.body || {}, sellerId));
}));

// AI Smart Workflow — « Créer ma campagne » (pack complet, identité respectée).
router.post('/studio/campaign', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  assertOwnsProduct(req);
  const sellerId = req.user.role === 'admin' ? (req.body.sellerId || req.user.id) : req.user.id;
  res.status(202).json(await creative.fullCampaign(req.body || {}, sellerId));
}));

// Référentiels (types de photos, styles vidéo, options mannequin…) pour l'UI.
router.get('/studio/options', requireRole('seller', 'admin'), (_req, res) => {
  res.json({
    photoTypes: Object.entries(photoAgent.PHOTO_TYPES).map(([id, v]) => ({ id, label: v.label })),
    resolutions: Object.keys(photoAgent.RESOLUTIONS),
    mannequin: photoAgent.MANNEQUIN_OPTIONS,
    backgrounds: photoAgent.BACKGROUNDS,
    angles: photoAgent.ANGLES,
    videoStyles: Object.keys(videoAgent.STYLES),
    videoFormats: Object.entries(videoAgent.FORMATS).map(([id, v]) => ({ id, label: v.platform, ratio: v.ratio })),
    fps: videoAgent.FPS,
    cameraMoves: videoAgent.CAMERA_MOVES,
    videoEffects: videoAgent.VIDEO_EFFECTS,
    musicStyles: videoAgent.MUSIC_STYLES,
    adFormats: Object.entries(creative.AD_FORMATS).map(([id, v]) => ({ id, label: v.label })),
    socialTargets: Object.entries(creative.SOCIAL_TARGETS).map(([id, v]) => ({ id, label: v.platform, kind: v.kind })),
    export: creative.EXPORT,
    positioning: brandkit.POSITIONING,
    graphicStyles: brandkit.GRAPHIC_STYLES,
  });
});

router.get('/studio/jobs', requireRole('seller', 'admin'), (req, res) => {
  res.json({ jobs: studioJobs.listJobs(req.user.id, req.query.kind) });
});

router.get('/studio/jobs/:id', requireRole('seller', 'admin'), (req, res) => {
  const job = studioJobs.getJob(req.params.id);
  if (!job || job.userId !== req.user.id) return res.status(404).json({ error: 'Job introuvable.' });
  res.json({ job });
});

/* ------------------------------------------------------------------ */
/* 8. Assistant marketing                                              */
/* ------------------------------------------------------------------ */
router.post('/marketing/kit', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  const kit = await marketing.generateKit({
    productId: req.body.productId,
    campaign: req.body.campaign || 'standard',
    tone: String(req.body.tone || 'énergique').slice(0, 50),
  });
  res.json({ kit, campaigns: Object.keys(marketing.CAMPAIGNS) });
}));

/* ================================================================== */
/* ORCHESTRATEUR IA + AGENTS SPÉCIALISÉS                               */
/* ================================================================== */

/** Orchestrateur : reçoit une demande, route vers le(s) agent(s), combine. */
router.post('/orchestrator', aiLimit, asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').slice(0, 1000);
  if (!text.trim()) throw new ApiError(400, 'text est requis.');
  const result = await orchestrator.handle({ user: req.user || null, text, productId: req.body.productId });
  res.json(result);
}));

router.get('/orchestrator/pipelines', (req, res) => {
  res.json({ pipelines: orchestrator.pipelinesFor(req.user || null) });
});

/** Liste des agents accessibles selon le rôle. */
router.get('/agents', (req, res) => {
  res.json({ agents: agents.listForRole(req.user || null) });
});

/* ------------------------------------------------------------------ */
/* AI Personnalisation — page d'accueil différente par client          */
/* ------------------------------------------------------------------ */
router.get('/home', (req, res) => {
  res.json(agents.get('personalization').personalize(req.user ? req.user.id : null));
});

/* ------------------------------------------------------------------ */
/* Découverte — Stories IA · Vitrine vivante · Hover intelligent       */
/* ------------------------------------------------------------------ */
router.get('/stories', (_req, res) => {
  res.json(discovery.stories());
});

router.get('/showcase', (req, res) => {
  res.json(discovery.showcase(req.user ? req.user.id : null));
});

router.get('/hover/:productId', (req, res) => {
  const insight = discovery.hoverInsight(req.params.productId, req.user ? req.user.id : null);
  if (!insight) throw new ApiError(404, 'Produit introuvable.');
  res.json(insight);
});

/* ------------------------------------------------------------------ */
/* AI Stock — alertes de rupture (limité au vendeur connecté)          */
/* ------------------------------------------------------------------ */
router.get('/seller/stock-alerts', requireRole('seller', 'admin'), (req, res) => {
  const sellerId = req.user.role === 'admin' ? (req.query.sellerId || undefined) : req.user.id;
  res.json(agents.get('stock').analyze({ sellerId }));
});

/* ------------------------------------------------------------------ */
/* AI Analyse des avis — vendeur (ses produits) / admin (tout)         */
/* ------------------------------------------------------------------ */
router.get('/reviews/analysis', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  const input = {};
  if (req.query.productId) {
    if (req.user.role !== 'admin') {
      const { store } = require('../db/store');
      const p = store.getById('products', req.query.productId);
      if (!p || p.sellerId !== req.user.id) throw new ApiError(403, 'Produit hors de votre boutique.');
    }
    input.productId = req.query.productId;
  } else if (req.user.role !== 'admin') {
    input.sellerId = req.user.id;
  }
  res.json(await agents.get('reviews').run(input, { user: req.user }));
}));

/* ------------------------------------------------------------------ */
/* AI Tendances — recommandations à l'administrateur                   */
/* ------------------------------------------------------------------ */
router.get('/trends', requireRole('admin'), asyncHandler(async (req, res) => {
  res.json(await agents.get('trends').run({}, { user: req.user }));
}));

/* ------------------------------------------------------------------ */
/* AI Modération — file de signalements + vérification manuelle        */
/* ------------------------------------------------------------------ */
router.get('/moderation/flags', requireRole('admin'), (_req, res) => {
  const { store } = require('../db/store');
  res.json({ flags: store.find('moderationFlags', () => true).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)) });
});

router.post('/moderation/check', requireRole('admin'), heavyLimit, asyncHandler(async (req, res) => {
  res.json(await agents.get('moderation').run(req.body || {}, { user: req.user }));
}));

/* ------------------------------------------------------------------ */
/* Marketplace Brain + Comité de direction IA (C-suite)                */
/* ------------------------------------------------------------------ */
router.get('/brain', requireRole('admin'), asyncHandler(async (req, res) => {
  const days = parseInt(req.query.days || '30', 10) || 30;
  res.json(await agents.get('brain').run({ days }, { user: req.user }));
}));

const EXEC_ROLES = { ceo: 'ceo', cfo: 'cfo', cmo: 'cmo', coo: 'coo', cto: 'cto' };
router.get('/exec/:role', requireRole('admin'), asyncHandler(async (req, res) => {
  const id = EXEC_ROLES[String(req.params.role).toLowerCase()];
  if (!id) throw new ApiError(404, 'Rôle exécutif inconnu (ceo|cfo|cmo|coo|cto).');
  const days = parseInt(req.query.days || '30', 10) || 30;
  res.json(await agents.get(id).run({ days }, { user: req.user }));
}));

/* ------------------------------------------------------------------ */
/* 11. Sécurité & fraude                                               */
/* ------------------------------------------------------------------ */
router.get('/security/overview', requireRole('admin'), (_req, res) => {
  res.json(fraud.overview());
});

/* ------------------------------------------------------------------ */
/* 12. Analyse financière                                              */
/* ------------------------------------------------------------------ */
router.get('/finance/report', requireRole('admin'), (req, res) => {
  const days = Math.min(365, Math.max(1, parseInt(req.query.days || '30', 10) || 30));
  res.json(analytics.financeReport({ days }));
});

/* ------------------------------------------------------------------ */
/* 13. Multilingue                                                     */
/* ------------------------------------------------------------------ */
router.post('/translate', aiLimit, asyncHandler(async (req, res) => {
  const text = String(req.body.text || '').slice(0, 5000);
  if (!text.trim()) throw new ApiError(400, 'text est requis.');
  res.json(await i18n.translate({ text, target: req.body.target || 'en' }));
}));

/* ------------------------------------------------------------------ */
/* 14. Mémoire IA — SÉPARÉE par assistant (namespace)                  */
/*   ?namespace=shopping|seller|operator ; consultable et effaçable.    */
/* ------------------------------------------------------------------ */
const MEMORY_NS = { client: 'shopping', seller: 'seller', admin: 'operator' };

router.get('/memory', requireAuth, (req, res) => {
  const ns = req.query.namespace || MEMORY_NS[req.user.role] || 'shopping';
  res.json({ namespace: ns, profile: memory.profileFor(req.user.id, ns) });
});

router.delete('/memory', requireAuth, (req, res) => {
  const ns = req.query.namespace || MEMORY_NS[req.user.role] || 'shopping';
  memory.forget(req.user.id, ns);
  res.json({ ok: true, message: `Mémoire « ${ns} » effacée.` });
});

module.exports = router;
