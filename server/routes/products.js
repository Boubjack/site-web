const express = require('express');
const { store } = require('../db/store');
const catalog = require('../ai/services/catalog');
const recommender = require('../ai/services/recommender');
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

module.exports = router;
