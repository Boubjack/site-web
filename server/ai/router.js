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
const config = require('../config');

const assistant = require('./services/assistant');
const recommender = require('./services/recommender');
const search = require('./services/search');
const seller = require('./services/seller');
const vision = require('./services/vision');
const photoStudio = require('./services/photoStudio');
const videoStudio = require('./services/videoStudio');
const marketing = require('./services/marketing');
const adminAnalyst = require('./services/adminAnalyst');
const fraud = require('./services/fraud');
const analytics = require('./services/analytics');
const memory = require('./services/memory');
const i18n = require('./services/i18n');

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
  res.json({
    name: 'E-Market AI',
    providerConfigured: provider.enabled(),
    mode: provider.enabled() ? 'modeles-cloud' : 'moteur-local',
    model: provider.enabled() ? config.ai.model : null,
    mediaProviders: config.media,
    languages: i18n.languages(),
  });
});

/* ------------------------------------------------------------------ */
/* 1 & 10. Assistant client + service client (chat SSE)                */
/* ------------------------------------------------------------------ */
router.post('/chat', aiLimit, asyncHandler(async (req, res) => {
  const messages = sanitizeMessages(req.body);
  const mode = req.body.mode === 'support' ? 'support' : 'shopping';
  const sse = openSse(res);
  try {
    await assistant.chatStream({ messages, user: req.user || null, mode, sse });
  } catch (err) {
    sse('error', { message: 'E-Market AI est momentanément indisponible.' });
    req.log && req.log.error(err.message);
  }
  res.end();
}));

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
  const product = seller.publishListing(req.user.id, listing, extra || {});
  res.status(201).json({ product });
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
/* 6 & 7. Studios photo et vidéo                                       */
/* ------------------------------------------------------------------ */
router.post('/studio/photo', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  const job = await photoStudio.createJob({
    userId: req.user.id,
    productName: req.body.productName,
    imageRef: req.body.imageRef,
    operations: req.body.operations,
    style: req.body.style || null,
  });
  res.status(202).json({ job });
}));

router.post('/studio/video', requireRole('seller', 'admin'), heavyLimit, asyncHandler(async (req, res) => {
  const job = await videoStudio.createJob({
    userId: req.user.id,
    productId: req.body.productId,
    description: String(req.body.description || '').slice(0, 1000),
    format: req.body.format || 'tiktok',
    photos: Array.isArray(req.body.photos) ? req.body.photos.slice(0, 10) : [],
  });
  res.status(202).json({ job });
}));

router.get('/studio/jobs', requireRole('seller', 'admin'), (req, res) => {
  res.json({ jobs: photoStudio.listJobs(req.user.id, req.query.kind) });
});

router.get('/studio/jobs/:id', requireRole('seller', 'admin'), (req, res) => {
  const job = photoStudio.getJob(req.params.id);
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

/* ------------------------------------------------------------------ */
/* 9. Assistant administrateur (chat SSE)                              */
/* ------------------------------------------------------------------ */
router.post('/admin/chat', requireRole('admin'), aiLimit, asyncHandler(async (req, res) => {
  const messages = sanitizeMessages(req.body);
  const sse = openSse(res);
  try {
    await adminAnalyst.chatStream({ messages, sse });
  } catch {
    sse('error', { message: 'E-Market AI est momentanément indisponible.' });
  }
  res.end();
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
/* 14. Mémoire IA (consultable et effaçable par l'utilisateur)         */
/* ------------------------------------------------------------------ */
router.get('/memory', requireAuth, (req, res) => {
  res.json({ profile: memory.profileFor(req.user.id) });
});

router.delete('/memory', requireAuth, (req, res) => {
  memory.forget(req.user.id);
  res.json({ ok: true, message: 'Votre mémoire IA a été effacée.' });
});

module.exports = router;
