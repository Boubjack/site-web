/**
 * AI CLIENT ENGINE — Personal Shopping Assistant (couche structurée).
 *
 * Complète l'assistant conversationnel « shopping » avec des capacités
 * outillées et TRANSPARENTES : comparateur, panier optimisé par budget, guide
 * des tailles, création de tenue, assistant produit (Q/R) et alertes.
 * Toutes les sorties sont sourcées sur les données réelles du catalogue.
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');
const recommender = require('./recommender');
const vectors = require('./vectors');

const DELIVERY = 'Livraison 24-72h à Bamako';
const POLICIES = {
  livraison: `${DELIVERY}. Suivi de commande disponible.`,
  garantie: 'Garantie selon le produit (voir la fiche). Les articles neufs sont couverts contre les défauts.',
  retour: 'Retour possible sous 14 jours si l\'article est non utilisé et dans son emballage.',
  paiement: 'Paiement Orange Money, Moov Money, Wave, ou à la livraison.',
  entretien: 'Suivez les recommandations d\'entretien de la fiche produit (matière indiquée).',
};

function card(id) { const p = store.getById('products', id); return p ? catalog.productCard(p) : null; }
function valueScore(c) { return c.rating ? Math.round(((c.rating / 5) / (c.price / 10000)) * 100) / 100 : null; }

/* ------------------------- Comparateur ------------------------- */
function compare({ productIds = [] } = {}) {
  const items = productIds.map(card).filter(Boolean);
  if (items.length < 2) throw Object.assign(new Error('Indiquez au moins 2 produits à comparer.'), { status: 400 });
  const prices = items.map((i) => i.price);
  const cheapest = Math.min(...prices);
  const bestRated = Math.max(...items.map((i) => i.rating || 0));
  const rows = items.map((i) => {
    const pros = []; const cons = [];
    if (i.price === cheapest) pros.push('Prix le plus bas'); else cons.push(`+${((i.price - cheapest) / cheapest * 100).toFixed(0)}% vs le moins cher`);
    if ((i.rating || 0) === bestRated && bestRated) pros.push('Mieux noté');
    if ((i.reviewCount || 0) >= 3) pros.push(`${i.reviewCount} avis`); else cons.push('Peu d\'avis');
    if ((i.stock || 0) <= 3) cons.push('Stock limité');
    return {
      id: i.id, name: i.name, price: i.price, rating: i.rating, reviewCount: i.reviewCount,
      delivery: DELIVERY, valueScore: valueScore(i), pros, cons,
    };
  });
  const best = [...rows].sort((a, b) => (b.valueScore || 0) - (a.valueScore || 0))[0];
  return { items: rows, bestValue: best ? best.id : null, transparency: 'Comparaison basée sur prix, note moyenne, nombre d\'avis et rapport qualité/prix réels.' };
}

/* ------------------------- Budget intelligent ------------------------- */
function budgetBasket({ budget, category, needs } = {}) {
  const b = parseInt(budget, 10);
  if (!Number.isFinite(b) || b < 1000) throw Object.assign(new Error('Budget invalide.'), { status: 400 });
  let pool = catalog.searchProducts({ query: needs || '', category, limit: 40 });
  if (!pool.length) pool = store.find('products', (p) => p.active !== false).map((p) => catalog.productCard(p));
  // Meilleur rapport qualité/prix d'abord, puis remplissage glouton du budget.
  const ranked = pool.filter((p) => p.price <= b).sort((a, b2) => (valueScore(b2) || 0) - (valueScore(a) || 0));
  const basket = []; let spent = 0; const seenSub = new Set();
  for (const p of ranked) {
    if (spent + p.price > b) continue;
    if (seenSub.has(p.subcategory)) continue; // variété
    basket.push({ id: p.id, name: p.name, price: p.price, rating: p.rating, subcategory: p.subcategory });
    seenSub.add(p.subcategory); spent += p.price;
  }
  return { budget: b, basket, total: spent, remaining: b - spent, count: basket.length, transparency: 'Panier construit pour maximiser le rapport qualité/prix et la variété sous votre budget.' };
}

/* ------------------------- Guide des tailles ------------------------- */
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
function sizeGuide({ productId, usualSize, fit } = {}) {
  const p = store.getById('products', productId);
  if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  const sizes = p.sizes || [];
  let recommended = usualSize && sizes.includes(usualSize) ? usualSize : (sizes[Math.floor(sizes.length / 2)] || null);
  // Ajustement selon la coupe déclarée du produit ou la préférence.
  const runsSmall = /slim|ajust|cintr/i.test(`${p.style || ''} ${p.name}`);
  if (recommended && SIZE_ORDER.includes(recommended)) {
    let idx = SIZE_ORDER.indexOf(recommended);
    if (runsSmall || fit === 'ample') idx = Math.min(SIZE_ORDER.length - 1, idx + 1);
    const cand = SIZE_ORDER[idx];
    if (sizes.includes(cand)) recommended = cand;
  }
  return {
    productId, available: sizes, recommended,
    advice: runsSmall ? 'Coupe ajustée : prenez une taille au-dessus si vous hésitez.' : 'Coupe standard : prenez votre taille habituelle.',
    note: 'Recommandation indicative ; les mensurations exactes de la fiche priment.',
  };
}

/* ------------------------- Création de tenue / look ------------------------- */
function outfit({ productId, occasion } = {}) {
  let base = productId ? store.getById('products', productId) : null;
  if (!base && occasion) base = (catalog.searchProducts({ query: occasion, limit: 1 })[0] && store.getById('products', catalog.searchProducts({ query: occasion, limit: 1 })[0].id)) || null;
  if (!base) base = store.find('products', (p) => p.active !== false && /mode/.test(p.category))[0];
  if (!base) throw Object.assign(new Error('Aucun produit de base trouvé.'), { status: 404 });

  const pieces = [catalog.productCard(base)];
  const wanted = ['chaussures', 'accessoires', base.category === 'mode-homme' ? 'mode-femme' : 'mode-homme'];
  // Complémentaires via cross-sell puis via similarité par catégorie complémentaire.
  const complements = recommender.completeYourPurchase(base.id, 3);
  for (const c of complements) if (!pieces.find((x) => x.id === c.id)) pieces.push(c);
  for (const cat of wanted) {
    if (pieces.length >= 4) break;
    const pick = store.find('products', (p) => p.active !== false && p.category === cat && p.id !== base.id)[0];
    if (pick && !pieces.find((x) => x.id === pick.id)) pieces.push(catalog.productCard(pick));
  }
  const total = pieces.reduce((s, p) => s + p.price, 0);
  return {
    occasion: occasion || null, base: base.id,
    look: pieces.map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category })),
    total, note: 'Tenue assemblée à partir de produits réels et complémentaires du catalogue.',
  };
}

/* ------------------------- Assistant produit (Q/R) ------------------------- */
function productQA({ productId, question } = {}) {
  const p = store.getById('products', productId);
  if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  const q = catalog.normalize(question || '');
  const answers = [];
  if (/matiere|matière|tissu|composition/.test(q) && p.material) answers.push(`Matière : ${p.material}.`);
  if (/dimension|taille|mesure|dim/.test(q)) answers.push(p.sizes && p.sizes.length ? `Tailles disponibles : ${p.sizes.join(', ')}.` : 'Voir les dimensions sur la fiche.');
  if (/livraison|delai|délai/.test(q)) answers.push(POLICIES.livraison);
  if (/garantie/.test(q)) answers.push(POLICIES.garantie);
  if (/retour|rembours/.test(q)) answers.push(POLICIES.retour);
  if (/paiement|payer/.test(q)) answers.push(POLICIES.paiement);
  if (/entretien|laver|nettoy/.test(q)) answers.push(POLICIES.entretien);
  if (/compatib/.test(q) && p.specs) answers.push(`Caractéristiques : ${Object.entries(p.specs).map(([k, v]) => `${k}: ${v}`).join(', ')}.`);
  if (/couleur/.test(q) && (p.colors || []).length) answers.push(`Couleurs : ${p.colors.join(', ')}.`);
  if (!answers.length) answers.push(`${p.name} — ${p.description || 'voir la fiche produit'}. ${POLICIES.livraison}`);
  return { productId, question: question || null, answer: answers.join(' '), sources: ['fiche produit', 'politiques E-Market'] };
}

/* ------------------------- Alertes personnalisées ------------------------- */
function alerts({ userId } = {}) {
  const interactions = userId ? {
    viewed: store.find('events', (e) => e.userId === userId && e.type === 'view').map((e) => e.productId),
    favorites: store.find('events', (e) => e.userId === userId && e.type === 'favorite').map((e) => e.productId),
  } : { viewed: [], favorites: [] };
  const watched = [...new Set([...interactions.favorites, ...interactions.viewed])];
  const out = [];
  for (const id of watched.slice(0, 20)) {
    const p = store.getById('products', id);
    if (!p) continue;
    if (p.stock > 0 && p.stock <= 3) out.push({ type: 'stock-faible', productId: id, name: p.name, message: `Plus que ${p.stock} en stock — à saisir.` });
    if (p.stock === 0) out.push({ type: 'rupture', productId: id, name: p.name, message: 'Actuellement en rupture — activez le retour en stock.' });
  }
  // Nouveautés dans les catégories suivies.
  const cats = new Set(watched.map((id) => (store.getById('products', id) || {}).category).filter(Boolean));
  const news = store.find('products', (p) => p.active !== false && cats.has(p.category)).slice(-3).reverse();
  for (const p of news) out.push({ type: 'nouveaute', productId: p.id, name: p.name, message: `Nouveauté dans « ${p.category} ».` });
  return { userId: userId || null, alerts: out.slice(0, 12), note: 'Alertes basées sur vos produits vus et favoris.' };
}

module.exports = { compare, budgetBasket, sizeGuide, outfit, productQA, alerts };
