/**
 * AGENT — AI Recommandation. Recommandations intelligentes, produits
 * complémentaires (cross-sell), paniers complets. Public (chaque client sur ses
 * propres données). Permissions : null.
 */
const recommender = require('../services/recommender');
const { store } = require('../../db/store');
const catalog = require('../services/catalog');

/** Compose un panier complet (tenue/pack) autour d'un produit. */
function completeBasket(productId, budget) {
  const anchor = store.getById('products', productId);
  if (!anchor) return { error: 'Produit introuvable.' };
  const complements = recommender.completeYourPurchase(productId, 3);
  const items = [catalog.productCard(anchor), ...complements];
  const total = items.reduce((s, p) => s + p.price, 0);
  return { basket: items, total, currency: 'FCFA', withinBudget: budget ? total <= budget : null };
}

async function run(input, ctx) {
  const userId = input.userId || (ctx.user && ctx.user.id) || null;
  if (input.basket && input.productId) return completeBasket(input.productId, input.budget);
  if (input.type === 'complete-purchase' && input.productId) return { items: recommender.completeYourPurchase(input.productId) };
  if (input.type === 'you-may-like') return { items: recommender.youMayLike(userId) };
  return { items: recommender.forYou(userId) };
}

module.exports = {
  id: 'recommendation',
  name: 'AI Recommandation',
  description: 'Recommandations personnalisées, produits complémentaires, paniers complets.',
  allowedRoles: null,
  keywords: ['recommandation', 'recommandé', 'complémentaire', 'panier', 'complète', 'assortir', 'cross-sell'],
  run,
  completeBasket,
};
