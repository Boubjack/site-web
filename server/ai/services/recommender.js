/**
 * 2. CONSEILLER SHOPPING INTELLIGENT — moteur de recommandation.
 * Analyse recherches, historique de consultation, favoris, achats, budget et
 * préférences (mémoire IA) pour produire :
 *   - "Recommandé pour vous"
 *   - "Vous pourriez aimer"
 *   - "Complétez votre achat" (cross-sell)
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');
const memory = require('./memory');

// Règles de complémentarité entre sous-catégories (cross-sell).
const COMPLEMENTS = {
  sweats: ['pantalons', 'sneakers', 'casquettes'],
  pantalons: ['sweats', 'tshirts', 'sneakers'],
  tshirts: ['pantalons', 'casquettes', 'sneakers'],
  sneakers: ['sweats', 'pantalons', 'casquettes'],
  'tenues-ceremonie': ['babouches', 'bijoux', 'sacs'],
  costumes: ['sneakers', 'montres'],
  robes: ['sacs', 'bijoux'],
  smartphones: ['audio', 'accessoires-tech', 'montres'],
  audio: ['smartphones', 'accessoires-tech'],
  montres: ['smartphones', 'audio'],
  babouches: ['tenues-ceremonie'],
  sacs: ['robes', 'bijoux'],
  bijoux: ['robes', 'tenues-ceremonie'],
};

function activeProducts() {
  return store.find('products', (p) => p.active !== false);
}

function interactionsOf(userId) {
  const events = store.find('events', (e) => e.userId === userId);
  const orders = store.find('orders', (o) => o.userId === userId);
  const purchased = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)));
  const viewed = events.filter((e) => e.type === 'view').map((e) => e.productId);
  const favorites = events.filter((e) => e.type === 'favorite').map((e) => e.productId);
  return { purchased, viewed, favorites };
}

/** Score de similarité produit / profil utilisateur. */
function affinityScore(product, profile, interactions) {
  let score = 0;
  if (profile.categories.includes(product.category)) score += 4;
  if (product.style && profile.styles.includes(product.style)) score += 3;
  for (const c of product.colors || []) {
    if (profile.colors.includes(c)) score += 1;
  }
  if (profile.averageBudget) {
    const ratio = product.price / profile.averageBudget;
    if (ratio <= 1.2) score += 2;
    else if (ratio > 3) score -= 2;
  }
  // Similarité avec produits vus/aimés (même sous-catégorie).
  const seen = [...interactions.viewed, ...interactions.favorites]
    .map((id) => store.getById('products', id))
    .filter(Boolean);
  if (seen.some((s) => s.subcategory === product.subcategory)) score += 3;
  if (seen.some((s) => s.category === product.category)) score += 2;
  return score;
}

/** "Recommandé pour vous" — personnalisé (repli: meilleures ventes). */
function forYou(userId, limit = 4) {
  if (!userId) return bestSellers(limit);
  const profile = memory.profileFor(userId);
  const interactions = interactionsOf(userId);

  // Alimente la mémoire depuis l'historique (achats pèsent plus lourd).
  for (const id of interactions.purchased) {
    memory.learnFromProduct(userId, store.getById('products', id), 0); // profil déjà appris à l'achat
  }

  const scored = activeProducts()
    .filter((p) => !interactions.purchased.has(p.id))
    .map((p) => ({ p, score: affinityScore(p, profile, interactions) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);

  const picks = scored.slice(0, limit).map((s) => catalog.productCard(s.p));
  return picks.length ? picks : bestSellers(limit);
}

/** "Vous pourriez aimer" — découverte hors des catégories déjà achetées. */
function youMayLike(userId, limit = 4) {
  const interactions = userId ? interactionsOf(userId) : { purchased: new Set(), viewed: [], favorites: [] };
  const ownedCategories = new Set(
    [...interactions.purchased].map((id) => store.getById('products', id)).filter(Boolean).map((p) => p.category)
  );
  const pool = activeProducts().filter(
    (p) => !interactions.purchased.has(p.id) && !ownedCategories.has(p.category)
  );
  const sorted = pool.sort((a, b) => ratingOf(b) - ratingOf(a));
  return (sorted.length ? sorted : activeProducts()).slice(0, limit).map(catalog.productCard);
}

/** "Complétez votre achat" — cross-sell autour d'un produit. */
function completeYourPurchase(productId, limit = 3) {
  const product = store.getById('products', productId);
  if (!product) return [];
  const targets = COMPLEMENTS[product.subcategory] || [];
  const complements = activeProducts()
    .filter((p) => p.id !== productId && targets.includes(p.subcategory))
    .sort((a, b) => targets.indexOf(a.subcategory) - targets.indexOf(b.subcategory) || ratingOf(b) - ratingOf(a));
  return complements.slice(0, limit).map(catalog.productCard);
}

function ratingOf(p) {
  const reviews = store.find('reviews', (r) => r.productId === p.id);
  if (!reviews.length) return 3;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

function bestSellers(limit = 4) {
  const counts = {};
  for (const o of store.all('orders')) {
    for (const i of o.items) counts[i.productId] = (counts[i.productId] || 0) + i.qty;
  }
  return activeProducts()
    .sort((a, b) => (counts[b.id] || 0) - (counts[a.id] || 0) || ratingOf(b) - ratingOf(a))
    .slice(0, limit)
    .map(catalog.productCard);
}

/** Enregistre un événement comportemental et met à jour la mémoire. */
function trackEvent({ userId, type, productId, query }) {
  const event = store.insert('events', { userId: userId || null, type, productId: productId || null, query: query || null });
  if (userId && productId && ['view', 'favorite', 'purchase'].includes(type)) {
    const weight = type === 'purchase' ? 3 : type === 'favorite' ? 2 : 1;
    memory.learnFromProduct(userId, store.getById('products', productId), weight);
  }
  if (userId && type === 'search' && query) memory.learnFromMessage(userId, query);
  return event;
}

module.exports = { forYou, youMayLike, completeYourPurchase, bestSellers, trackEvent };
