/**
 * DÉCOUVERTE IA — trois expériences de la vitrine :
 *
 *  - Stories IA        : « stories » promotionnelles auto-générées (nouveautés,
 *                        catégorie montante, bons plans, coups de cœur, derniers
 *                        exemplaires) — comme des stories Instagram, mais
 *                        pilotées par les données réelles.
 *  - Vitrine vivante   : sections d'accueil ré-ordonnées en direct selon le
 *                        profil, les tendances et les stocks.
 *  - Hover intelligent : au survol d'un produit, une raison courte + faits clés
 *                        + un produit proche (recherche sémantique).
 *
 * Aucune image récupérée sur Internet : uniquement le catalogue E-Market.
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');
const recommender = require('./recommender');
const forecast = require('./forecast');
const vectors = require('./vectors');

function activeProducts() {
  return store.find('products', (p) => p.active !== false);
}

function ratingOf(id) {
  const reviews = store.find('reviews', (r) => r.productId === id);
  return reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;
}

function newArrivals(limit = 6) {
  return [...activeProducts()]
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, limit);
}

function bestDeals(limit = 6) {
  // « Bon plan » = prix nettement sous la moyenne de sa sous-catégorie.
  const bySub = {};
  for (const p of activeProducts()) (bySub[p.subcategory] = bySub[p.subcategory] || []).push(p);
  const deals = [];
  for (const [, list] of Object.entries(bySub)) {
    if (list.length < 2) continue;
    const avg = list.reduce((s, p) => s + p.price, 0) / list.length;
    for (const p of list) {
      const discount = Math.round((1 - p.price / avg) * 100);
      if (discount >= 12) deals.push({ product: p, discount });
    }
  }
  return deals.sort((a, b) => b.discount - a.discount).slice(0, limit);
}

/* ------------------------------------------------------------------ */
/* Stories IA                                                          */
/* ------------------------------------------------------------------ */
function stories() {
  const out = [];

  const arrivals = newArrivals(6);
  if (arrivals.length) out.push({ id: 'nouveautes', kind: 'new', emoji: '✨', accent: '#2a90ff', title: 'Nouveautés', subtitle: 'Fraîchement arrivés', products: arrivals.map(catalog.productCard) });

  const trending = forecast.trendingCategories({ days: 14 }).filter((c) => c.deltaShare > 0)[0];
  if (trending) {
    const prods = activeProducts().filter((p) => p.category === trending.category).slice(0, 6);
    if (prods.length) out.push({ id: `tendance-${trending.category}`, kind: 'trend', emoji: '🔥', accent: '#f5a524', title: `Tendance : ${trending.category}`, subtitle: `+${trending.deltaShare} pts cette quinzaine`, products: prods.map(catalog.productCard) });
  }

  const deals = bestDeals(6);
  if (deals.length) out.push({ id: 'bons-plans', kind: 'deal', emoji: '💸', accent: '#22c55e', title: 'Bons plans', subtitle: `Jusqu'à -${deals[0].discount} %`, products: deals.map((d) => ({ ...catalog.productCard(d.product), discountPct: d.discount })) });

  const topRated = activeProducts().map((p) => ({ p, r: ratingOf(p.id) || 0 })).filter((x) => x.r >= 4.5).sort((a, b) => b.r - a.r).slice(0, 6);
  if (topRated.length) out.push({ id: 'coups-de-coeur', kind: 'top', emoji: '⭐', accent: '#8b5cf6', title: 'Coups de cœur', subtitle: 'Les mieux notés', products: topRated.map((x) => catalog.productCard(x.p)) });

  const lastChance = activeProducts().filter((p) => p.stock > 0 && p.stock <= 3).slice(0, 6);
  if (lastChance.length) out.push({ id: 'derniers-exemplaires', kind: 'scarcity', emoji: '⏳', accent: '#f04438', title: 'Derniers exemplaires', subtitle: 'Stock limité', products: lastChance.map(catalog.productCard) });

  return { stories: out, generatedAt: new Date().toISOString() };
}

/* ------------------------------------------------------------------ */
/* Vitrine vivante                                                     */
/* ------------------------------------------------------------------ */
function showcase(userId) {
  const sections = [];
  const forYou = recommender.forYou(userId, 8);
  const hero = forYou[0] || recommender.bestSellers(1)[0] || null;

  sections.push({ key: 'for-you', title: userId ? 'Recommandé pour vous' : 'Sélection populaire', ai: true, products: forYou });

  const trending = forecast.trendingCategories({ days: 14 }).filter((c) => c.deltaShare > 0)[0];
  if (trending) {
    const prods = activeProducts().filter((p) => p.category === trending.category).slice(0, 8).map(catalog.productCard);
    if (prods.length) sections.push({ key: 'trending', title: `🔥 En hausse : ${trending.category}`, ai: true, products: prods });
  }

  const deals = bestDeals(8);
  if (deals.length) sections.push({ key: 'deals', title: '💸 Bons plans du moment', ai: true, products: deals.map((d) => ({ ...catalog.productCard(d.product), discountPct: d.discount })) });

  sections.push({ key: 'discover', title: 'À découvrir', ai: true, products: recommender.youMayLike(userId, 8) });

  return { hero: hero ? { ...hero, reason: heroReason(hero, userId) } : null, sections, live: true, generatedAt: new Date().toISOString() };
}

function heroReason(product) {
  const r = ratingOf(product.id);
  if (r && r >= 4.5) return `Coup de cœur ${r}★ de la communauté`;
  if (product.stock > 0 && product.stock <= 3) return 'Stock limité — à saisir';
  return 'Sélectionné pour vous par E-Market AI';
}

/* ------------------------------------------------------------------ */
/* Hover intelligent                                                   */
/* ------------------------------------------------------------------ */
function hoverInsight(productId, userId) {
  const product = store.getById('products', productId);
  if (!product) return null;
  const card = catalog.productCard(product);
  const facts = [];

  if (card.rating) facts.push(`★ ${card.rating}${card.reviewCount ? ` (${card.reviewCount} avis)` : ''}`);
  if (product.stock > 0 && product.stock <= 3) facts.push(`Plus que ${product.stock} en stock`);
  if (product.specs) {
    const spec = Object.entries(product.specs)[0];
    if (spec) facts.push(`${spec[0]} : ${spec[1]}`);
  }
  if ((product.colors || []).length) facts.push(`${product.colors.length} coloris`);

  // Raison personnalisée si l'utilisateur a un profil ; sinon générique.
  let reason = 'Populaire dans sa catégorie';
  if (userId) {
    const memory = require('./memory');
    const profile = memory.profileFor(userId);
    if (profile.categories.includes(product.category)) reason = `Correspond à votre intérêt pour « ${product.category} »`;
    else if (card.rating && card.rating >= 4.5) reason = 'Très bien noté — souvent recommandé';
  } else if (card.rating && card.rating >= 4.5) {
    reason = 'Très bien noté — souvent recommandé';
  }

  const similar = vectors.similar(productId, { limit: 3 })
    .map((s) => ({ id: s.product.id, name: s.product.name, price: s.product.price, emoji: s.product.emoji || '🛍️' }));

  return { productId, reason, facts: facts.slice(0, 3), similar };
}

module.exports = { stories, showcase, hoverInsight };
