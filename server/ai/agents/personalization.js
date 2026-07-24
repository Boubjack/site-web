/**
 * AGENT — AI Personnalisation. Construit une page d'accueil différente pour
 * chaque client : produits affichés, promotions, recommandations, catégories
 * et bannière, selon l'historique, les préférences, le budget et le
 * comportement. Permissions : client (ses propres données) / admin.
 */
const { store } = require('../../db/store');
const recommender = require('../services/recommender');
const memory = require('../services/memory');
const catalog = require('../services/catalog');

const CATEGORY_LABELS = {
  'mode-femme': 'Mode femme', 'mode-homme': 'Mode homme', electronique: 'Électronique',
  chaussures: 'Chaussures', accessoires: 'Accessoires',
};

/** Catégories préférées déduites de l'historique réel (events + commandes). */
function categoriesFromHistory(userId) {
  if (!userId) return [];
  const counts = {};
  for (const e of store.find('events', (x) => x.userId === userId && x.productId)) {
    const p = store.getById('products', e.productId);
    if (p) counts[p.category] = (counts[p.category] || 0) + (e.type === 'favorite' ? 2 : 1);
  }
  for (const o of store.find('orders', (x) => x.userId === userId)) {
    for (const i of o.items) { const p = store.getById('products', i.productId); if (p) counts[p.category] = (counts[p.category] || 0) + 3; }
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

function personalize(userId) {
  const profile = userId ? memory.profileFor(userId, 'shopping') : { categories: [], colors: [], averageBudget: null };
  // Fusionne préférences mémorisées et catégories déduites de l'historique réel.
  if (userId && (!profile.categories || !profile.categories.length)) {
    profile.categories = categoriesFromHistory(userId);
  }
  const forYou = recommender.forYou(userId, 6);
  const mayLike = recommender.youMayLike(userId, 4);

  // Bannière personnalisée selon la catégorie/budget préférés.
  const topCat = profile.categories && profile.categories[0];
  const banner = topCat
    ? { title: `Sélection ${CATEGORY_LABELS[topCat] || topCat} pour vous`, subtitle: profile.averageBudget ? `Autour de ${catalog.formatFcfa(profile.averageBudget)}` : 'Rien que pour vous', category: topCat }
    : { title: 'Bienvenue sur E-Market', subtitle: 'Découvrez nos produits vedettes', category: null };

  // Bons plans : produits abordables dans les catégories préférées.
  const prefCats = new Set(profile.categories || []);
  const promos = catalog.searchProducts({ query: '', limit: 30 })
    .filter((p) => (prefCats.size ? prefCats.has(p.category) : true))
    .sort((a, b) => a.price - b.price).slice(0, 4);

  // Catégories ordonnées par préférence.
  const allCats = ['mode-femme', 'mode-homme', 'electronique', 'chaussures', 'accessoires'];
  const orderedCats = [...allCats].sort((a, b) => {
    const ia = (profile.categories || []).indexOf(a); const ib = (profile.categories || []).indexOf(b);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  }).map((c) => ({ id: c, label: CATEGORY_LABELS[c] || c }));

  return {
    personalized: Boolean(userId && topCat),
    banner,
    sections: [
      { key: 'for-you', title: 'Recommandé pour vous', items: forYou },
      { key: 'promos', title: 'Bons plans pour vous', items: promos },
      { key: 'may-like', title: 'Vous pourriez aimer', items: mayLike },
    ],
    categories: orderedCats,
    profile,
  };
}

async function run(input, ctx) {
  const userId = input.userId || (ctx.user && ctx.user.id) || null;
  return personalize(userId);
}

module.exports = {
  id: 'personalization',
  name: 'AI Personnalisation',
  description: 'Page d\'accueil personnalisée par client (produits, promos, recommandations, catégories, bannière).',
  allowedRoles: null, // chaque client accède à SA personnalisation (données propres)
  keywords: ['personnalisation', 'accueil', 'pour vous', 'recommandé', 'personnalisé'],
  run,
  personalize,
};
