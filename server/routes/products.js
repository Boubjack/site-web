const express = require('express');
const { store } = require('../db/store');
const catalog = require('../ai/services/catalog');
const recommender = require('../ai/services/recommender');
const moderation = require('../ai/agents/moderation');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errors');

const router = express.Router();

router.get('/', (req, res) => {
  const { category, q, limit } = req.query;
  let items;
  if (q || category) {
    items = catalog.searchProducts({ query: q || '', category, limit: parseInt(limit || '24', 10) });
  } else {
    items = store.find('products', (p) => p.active !== false).map(catalog.productCard);
  }
  res.json({ items });
});

router.get('/:id', asyncHandler(async (req, res) => {
  const product = store.getById('products', req.params.id);
  if (!product || product.active === false) throw new ApiError(404, 'Produit introuvable.');
  const reviews = store.find('reviews', (r) => r.productId === product.id).map((r) => {
    const u = store.getById('users', r.userId);
    return { rating: r.rating, comment: r.comment, author: u ? u.name : 'Client' };
  });
  if (req.user) recommender.trackEvent({ userId: req.user.id, type: 'view', productId: product.id });
  res.json({ product: catalog.productCard(product), reviews });
}));

// Déposer un avis — passé par AI Modération (contenu offensant/spam signalé).
router.post('/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  const product = store.getById('products', req.params.id);
  if (!product || product.active === false) throw new ApiError(404, 'Produit introuvable.');
  const rating = Math.max(1, Math.min(5, parseInt(req.body.rating, 10) || 0));
  const comment = String(req.body.comment || '').slice(0, 500);
  if (!rating) throw new ApiError(400, 'rating (1-5) requis.');

  const verdict = moderation.moderateText(comment);
  if (verdict.level === 'blocked') throw new ApiError(422, 'Avis refusé par la modération.', verdict.reasons);

  const review = store.insert('reviews', { productId: product.id, userId: req.user.id, rating, comment });
  if (verdict.status === 'flag') {
    moderation.flag({ entityType: 'review', entityId: review.id, ownerId: req.user.id, verdict, excerpt: comment });
  }
  res.status(201).json({ review: { rating, comment }, moderation: verdict });
}));

module.exports = router;
