/**
 * AI COMMERCE ENGINE — analyse le comportement d'achat et PROPOSE des
 * améliorations que le vendeur valide ou refuse. Aucune modification n'est
 * appliquée automatiquement.
 *
 * S'appuie sur les données réelles (événements, commandes, produits, avis) via
 * analytics/brain. Chaque proposition a un statut « proposé ».
 */
const { store } = require('../../db/store');
const analytics = require('./analytics');
const brain = require('./brain');

/** Métriques d'engagement d'une boutique. */
function analyze(sellerId) {
  const productIds = new Set(store.find('products', (p) => p.sellerId === sellerId).map((p) => p.id));
  const views = store.find('events', (e) => e.type === 'view' && productIds.has(e.productId)).length;
  const favorites = store.find('events', (e) => e.type === 'favorite' && productIds.has(e.productId)).length;
  const stats = analytics.sellerSalesStats(sellerId, { days: 30 });
  const perf = analytics.sellerProductPerformance(sellerId, { days: 30 });
  return {
    views, favorites,
    unitsSold: stats.unitsSold, revenueFcfa: stats.revenueFcfa, conversion: stats.conversion,
    bestProducts: perf.best.slice(0, 3), weakProducts: perf.weak.slice(0, 3),
  };
}

/** Propositions d'amélioration (le vendeur décide). */
function recommendations(sellerId) {
  const a = analyze(sellerId);
  const props = [];
  const add = (type, title, why, action) => props.push({ id: `${type}-${props.length + 1}`, type, title, why, action, status: 'proposé' });

  if (a.conversion.ratePct !== null && a.conversion.ratePct < 1.5) {
    add('cta', 'Renforcer les appels à l\'action', `Conversion faible (${a.conversion.ratePct}%).`, 'Boutons plus visibles + preuve sociale (avis).');
    add('hero', 'Changer le Hero', 'Un Hero plus percutant améliore l\'engagement initial.', 'Générer un nouveau Hero via le Layout Engine.');
  }
  if (a.weakProducts.length) {
    add('merchandising', `Mettre en avant ou revoir ${a.weakProducts.length} produit(s) peu vus`, 'Produits à faible traction.', 'Ajouter photos AI Photo Pro, avis, ou repositionner.');
  }
  if (a.bestProducts[0]) {
    add('promotion', `Créer un bundle autour de « ${a.bestProducts[0].name} »`, 'Capitaliser sur le best-seller.', 'Bundle + livraison offerte au-delà d\'un montant.');
  }
  if (a.favorites > a.unitsSold) {
    add('promotion', 'Relancer les favoris non achetés', 'Beaucoup de mises en favori sans achat.', 'Flash sale ou coupon ciblé.');
  }
  add('media', 'Ajouter des vidéos produit', 'La vidéo augmente la conversion.', 'Générer une vidéo via AI Video Pro.');

  return { sellerId, analysis: a, recommendations: props, policy: 'Aucune modification appliquée sans validation du vendeur.' };
}

/** Marchandisage intelligent : blocs à mettre en avant automatiquement. */
function merchandising(sellerId) {
  const snapshot = brain.snapshot({ days: 30 });
  const perf = analytics.sellerProductPerformance(sellerId, { days: 30 });
  return {
    populaires: perf.best.slice(0, 4),
    nouveautes: store.find('products', (p) => p.sellerId === sellerId && p.active !== false).slice(-4).reverse().map((p) => ({ id: p.id, name: p.name })),
    aPousser: perf.weak.slice(0, 3),
    tendanceMarche: snapshot.growth.trendingCategories[0] || null,
  };
}

module.exports = { analyze, recommendations, merchandising };
