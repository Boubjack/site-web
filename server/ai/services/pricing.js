/**
 * AI PRICING ENGINE — recommandation de prix.
 *
 * Compare le prix d'un produit à la moyenne de sa sous-catégorie et au
 * positionnement de la boutique, puis suggère un prix + une fourchette et une
 * justification. Déterministe, sur données réelles.
 */
const { store } = require('../../db/store');
const brandkit = require('../studio/brandkit');

function comparables(product) {
  return store.find('products', (p) => p.subcategory === product.subcategory && p.id !== product.id && p.active !== false);
}

const POSITIONING_FACTOR = { Économique: 0.9, Premium: 1.0, Luxe: 1.25 };

function suggest({ productId } = {}) {
  const product = store.getById('products', productId);
  if (!product) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  const peers = comparables(product);
  const avg = peers.length ? Math.round(peers.reduce((s, p) => s + p.price, 0) / peers.length) : product.price;

  const kit = brandkit.getForSeller(product.sellerId);
  const factor = POSITIONING_FACTOR[kit && kit.positioning] || 1.0;
  const suggested = Math.round((avg * factor) / 100) * 100;
  const min = Math.round((avg * 0.85) / 100) * 100;
  const max = Math.round((avg * factor * 1.15) / 100) * 100;

  const delta = avg ? Math.round(((product.price - avg) / avg) * 100) : 0;
  let position = 'aligné';
  if (delta <= -15) position = 'agressif (sous le marché)';
  else if (delta >= 15) position = 'au-dessus du marché';

  const notes = [];
  if (position.startsWith('au-dessus') && (kit.positioning !== 'Luxe')) notes.push('Prix supérieur au marché sans positionnement luxe : justifier par la valeur ou ajuster.');
  if (position.startsWith('agressif')) notes.push('Prix très bas : vérifier la marge ; possible signal de qualité perçue plus faible.');
  if (!peers.length) notes.push('Peu de comparables : recommandation indicative.');

  return {
    productId, currentPrice: product.price, marketAverage: avg, comparables: peers.length,
    positioning: kit.positioning || 'Premium',
    suggestedPrice: suggested, range: { min, max }, deltaVsMarketPct: delta, position, notes,
  };
}

module.exports = { suggest, comparables };
