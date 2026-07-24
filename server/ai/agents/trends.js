/**
 * AGENT — AI Tendances. Analyse produits populaires, catégories populaires,
 * recherches populaires, tendances locales et saisonnières, et fait des
 * recommandations à l'administrateur. Permissions : admin.
 */
const { store } = require('../../db/store');
const analytics = require('../services/analytics');
const forecast = require('../services/forecast');
const catalog = require('../services/catalog');

function popularSearches({ days = 30, limit = 8 } = {}) {
  const since = Date.now() - days * 86400000;
  const counts = {};
  for (const e of store.find('events', (x) => x.type === 'search' && x.query && new Date(x.createdAt).getTime() >= since)) {
    const key = catalog.normalize(e.query).slice(0, 40);
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([q, n]) => ({ query: q, count: n }));
}

function popularProducts({ days = 30, limit = 6 } = {}) {
  const since = Date.now() - days * 86400000;
  const score = {};
  for (const e of store.find('events', (x) => x.type === 'view' && x.productId && new Date(x.createdAt).getTime() >= since)) {
    score[e.productId] = (score[e.productId] || 0) + 1;
  }
  for (const o of store.find('orders', (x) => new Date(x.createdAt).getTime() >= since)) {
    for (const i of o.items) score[i.productId] = (score[i.productId] || 0) + i.qty * 3;
  }
  return Object.entries(score)
    .map(([id, s]) => { const p = store.getById('products', id); return p ? { id, name: p.name, category: p.category, score: s } : null; })
    .filter(Boolean).sort((a, b) => b.score - a.score).slice(0, limit);
}

async function run(input) {
  const trending = forecast.trendingCategories({ days: 14 });
  const recos = [];
  const topCat = trending[0];
  if (topCat && topCat.deltaShare > 0) recos.push(`Mettre en avant la catégorie « ${topCat.category} » (+${topCat.deltaShare} pts de part).`);
  const searches = popularSearches();
  if (searches[0]) recos.push(`Créer une sélection autour de « ${searches[0].query} » (recherche la plus fréquente).`);
  const products = popularProducts();
  if (products[0]) recos.push(`Promouvoir « ${products[0].name} » (produit le plus consulté/acheté).`);

  return {
    popularProducts: products,
    trendingCategories: trending,
    popularSearches: searches,
    topCategoriesByRevenue: analytics.topProducts({ days: 30, limit: 5 }),
    recommendations: recos,
  };
}

module.exports = {
  id: 'trends',
  name: 'AI Tendances',
  description: 'Produits/catégories/recherches populaires, tendances locales et saisonnières, recommandations à l\'administrateur.',
  allowedRoles: ['admin'],
  keywords: ['tendance', 'trend', 'populaire', 'à la mode', 'recherche populaire', 'saison', 'promouvoir'],
  tool: {
    name: 'trends_overview',
    description: 'Analyse des tendances : produits/catégories/recherches populaires + recommandations de mise en avant.',
    input_schema: { type: 'object', properties: {} },
  },
  run,
};
