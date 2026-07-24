const express = require('express');
const { store } = require('../db/store');
const { requireAuth } = require('../middleware/auth');
const { asyncHandler, ApiError } = require('../middleware/errors');
const fraud = require('../ai/services/fraud');
const recommender = require('../ai/services/recommender');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const orders = store.find('orders', (o) => o.userId === req.user.id);
  res.json({ orders });
});

router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body.items) ? req.body.items : [];
  if (!items.length) throw new ApiError(400, 'items est requis.');

  const resolved = items.map((i) => {
    const p = store.getById('products', i.productId);
    if (!p || p.active === false) throw new ApiError(400, `Produit invalide: ${i.productId}`);
    const qty = Math.max(1, Math.min(10, parseInt(i.qty || 1, 10)));
    if (p.stock < qty) throw new ApiError(409, `Stock insuffisant pour ${p.name}.`);
    return { productId: p.id, qty, price: p.price };
  });
  const total = resolved.reduce((s, i) => s + i.qty * i.price, 0);

  // 11. IA sécurité : contrôle temps réel avant validation.
  const risk = fraud.checkOrder({ userId: req.user.id, total });
  const status = risk.level === 'rouge' ? 'verification-securite' : 'en-cours';

  const order = store.insert('orders', { userId: req.user.id, items: resolved, total, status, risk });

  for (const i of resolved) {
    const p = store.getById('products', i.productId);
    store.update('products', p.id, { stock: p.stock - i.qty });
    recommender.trackEvent({ userId: req.user.id, type: 'purchase', productId: p.id });
  }

  res.status(201).json({ order, risk });
}));

module.exports = router;
