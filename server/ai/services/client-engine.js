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
const memory = require('./memory');
const forecast = require('./forecast');

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

/* ------------------------- Personal Shopper (profil appris) ------------------------- */
function ordersOf(userId) { return store.find('orders', (o) => o.userId === userId); }

function profile({ userId } = {}) {
  const base = userId ? memory.profileFor(userId, 'shopping') : { categories: [], styles: [], colors: [], averageBudget: null };
  const orders = userId ? ordersOf(userId) : [];
  const bought = orders.flatMap((o) => o.items.map((i) => store.getById('products', i.productId))).filter(Boolean);
  const sizes = [...new Set(bought.flatMap((p) => p.sizes || []))].slice(0, 6);
  const brands = [...new Set(bought.map((p) => (store.getById('users', p.sellerId) || {}).shop).filter(Boolean))].slice(0, 5);
  const favorites = userId ? store.find('events', (e) => e.userId === userId && e.type === 'favorite').map((e) => e.productId) : [];
  const spanDays = orders.length >= 2 ? Math.max(1, Math.round((Date.now() - new Date(orders[orders.length - 1].createdAt).getTime()) / 86400000)) : null;
  const frequency = orders.length && spanDays ? `${Math.round(orders.length / (spanDays / 30) * 10) / 10} commandes/mois` : 'nouveau client';
  return {
    userId: userId || null,
    preferredCategories: base.categories, preferredStyles: base.styles, preferredColors: base.colors,
    averageBudgetFcfa: base.averageBudget, sizes, favoriteBrands: brands,
    ordersCount: orders.length, favoritesCount: favorites.length, frequency,
    privacy: 'Vous pouvez consulter, modifier ou supprimer ces préférences à tout moment (DELETE /api/ai/memory).',
  };
}

/* ------------------------- Smart Cart ------------------------- */
function smartCart({ items = [], userId } = {}) {
  const lines = items.map((i) => ({ product: store.getById('products', i.productId), qty: Math.max(1, i.qty || 1) })).filter((l) => l.product);
  if (!lines.length) throw Object.assign(new Error('Panier vide.'), { status: 400 });
  const subtotal = lines.reduce((s, l) => s + l.product.price * l.qty, 0);
  // Coupon automatique + livraison.
  const coupons = [];
  let discount = 0;
  if (subtotal >= 50000) { coupons.push({ code: 'MERCI5', label: '-5% dès 50 000 FCFA', amount: Math.round(subtotal * 0.05) }); discount += Math.round(subtotal * 0.05); }
  const freeDelivery = subtotal >= 25000;
  const deliveryFcfa = freeDelivery ? 0 : 1500;
  // Compléments (cross-sell) sur le 1er article.
  const complements = recommender.completeYourPurchase(lines[0].product.id, 3);
  // Bundle : proposer les compléments en lot avec petit avantage.
  const bundle = complements.length ? { with: complements.map((c) => c.id), label: 'Complétez et économisez sur la livraison', savingFcfa: freeDelivery ? 0 : 1500 } : null;
  return {
    subtotalFcfa: subtotal, coupons, discountFcfa: discount,
    delivery: { freeDelivery, feeFcfa: deliveryFcfa, estimate: '24-72h à Bamako' },
    totalFcfa: subtotal - discount + deliveryFcfa,
    savingsFcfa: discount + (freeDelivery ? 1500 : 0),
    complements, bundle,
    note: 'Optimisation transparente : coupons éligibles appliqués, livraison estimée, compléments suggérés.',
  };
}

/* ------------------------- Gift Finder ------------------------- */
function giftFinder({ budget, occasion, interests, style } = {}) {
  const b = parseInt(budget, 10) || null;
  const query = [interests, style, occasion].filter(Boolean).join(' ');
  let pool = catalog.searchProducts({ query, maxPrice: b || undefined, limit: 20 });
  if (!pool.length) pool = recommender.bestSellers(8);
  const ideas = pool.filter((p) => !b || p.price <= b).slice(0, 6).map((p) => ({ id: p.id, name: p.name, price: p.price, why: `Correspond à « ${occasion || interests || 'vos critères'} »` }));
  return { budget: b, occasion: occasion || null, ideas, note: 'Idées cadeaux classées par pertinence et budget.' };
}

/* ------------------------- Review Analyzer ------------------------- */
const POSITIVE = ['bon', 'bonne', 'super', 'excellent', 'parfait', 'top', 'rapide', 'qualite', 'qualité', 'satisfait', 'recommande', 'genial', 'génial', 'nickel'];
const NEGATIVE = ['mauvais', 'lent', 'defaut', 'défaut', 'casse', 'decu', 'déçu', 'probleme', 'problème', 'petit', 'cher', 'abime', 'abîmé'];
function reviewSummary({ productId } = {}) {
  const reviews = store.find('reviews', (r) => r.productId === productId);
  if (!reviews.length) return { productId, count: 0, message: 'Aucun avis pour le moment.' };
  const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
  const pros = []; const cons = [];
  for (const r of reviews) {
    const t = catalog.normalize(r.comment || '');
    if (r.rating >= 4 || POSITIVE.some((w) => t.includes(w))) pros.push(r.comment);
    if (r.rating <= 2 || NEGATIVE.some((w) => t.includes(w))) cons.push(r.comment);
  }
  const sentiment = avg >= 4 ? 'globalement positif' : avg >= 3 ? 'mitigé' : 'plutôt négatif';
  return {
    productId, count: reviews.length, averageRating: avg, sentiment,
    strengths: [...new Set(pros)].slice(0, 3), weaknesses: [...new Set(cons)].slice(0, 3),
    note: 'Résumé automatique des avis clients réels.',
  };
}

/* ------------------------- Trust Score ------------------------- */
function trustScore({ productId } = {}) {
  const p = store.getById('products', productId);
  if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  const seller = store.getById('users', p.sellerId);
  const reviews = store.find('reviews', (r) => r.productId === productId);
  const sellerOrders = store.find('orders', (o) => o.items.some((i) => { const pr = store.getById('products', i.productId); return pr && pr.sellerId === p.sellerId; }));
  const infoQuality = ((p.description || '').length > 30 ? 25 : 10) + (p.specs ? 10 : 0) + ((p.colors || []).length ? 5 : 0);
  const sellerRep = Math.round(((seller && seller.rating) || 3.5) / 5 * 30);
  const reviewScore = reviews.length ? Math.min(20, reviews.length * 4) : 5;
  const history = Math.min(15, sellerOrders.length * 2);
  const score = Math.min(100, infoQuality + sellerRep + reviewScore + history + 10);
  return {
    productId, score,
    breakdown: { qualiteInfos: infoQuality, reputationVendeur: sellerRep, avis: reviewScore, historique: history },
    seller: seller ? { shop: seller.shop || seller.name, rating: seller.rating || null } : null,
    delivery: '24-72h à Bamako',
    disclaimer: 'Indice d\'aide à la décision, pas une garantie.',
  };
}

/* ------------------------- Delivery Assistant ------------------------- */
const DELIVERY_STEPS = ['en-cours', 'preparation', 'expediee', 'livree'];
function delivery({ orderId, userId } = {}) {
  const order = store.getById('orders', orderId);
  if (!order || (userId && order.userId !== userId)) throw Object.assign(new Error('Commande introuvable.'), { status: 404 });
  const statusIndex = { 'en-cours': 0, 'verification-securite': 0, preparation: 1, expediee: 2, livree: 3, annulee: -1 }[order.status] ?? 0;
  const timeline = DELIVERY_STEPS.map((s, i) => ({ step: s, done: statusIndex >= i, current: statusIndex === i }));
  const created = new Date(order.createdAt).getTime();
  const eta = new Date(created + 3 * 86400000).toISOString().slice(0, 10);
  return {
    orderId, status: order.status,
    progressPct: order.status === 'annulee' ? 0 : Math.round(((statusIndex + 1) / 4) * 100),
    timeline, estimatedDelivery: eta, note: DELIVERY,
  };
}

/* ------------------------- Reorder ------------------------- */
function reorder({ userId } = {}) {
  if (!userId) return { items: [], note: 'Connectez-vous pour vos rachats.' };
  const counts = {};
  for (const o of ordersOf(userId)) for (const i of o.items) counts[i.productId] = (counts[i.productId] || 0) + i.qty;
  const regular = Object.entries(counts).filter(([, n]) => n >= 2)
    .map(([id]) => { const p = store.getById('products', id); return p ? { id, name: p.name, price: p.price, timesBought: counts[id] } : null; })
    .filter(Boolean).sort((a, b) => b.timesBought - a.timesBought).slice(0, 6);
  return { items: regular, note: 'Produits achetés régulièrement — un clic pour recommander.' };
}

/* ------------------------- Shopping Calendar ------------------------- */
const EVENTS = [
  { name: 'Saint-Valentin', md: '02-14', category: 'accessoires' },
  { name: 'Rentrée', md: '09-15', category: 'mode-homme' },
  { name: 'Noël', md: '12-25', category: 'accessoires' },
  { name: 'Nouvel An', md: '12-31', category: 'mode-femme' },
];
function calendar() {
  const now = new Date();
  const year = now.getFullYear();
  const upcoming = EVENTS.map((e) => {
    let d = new Date(`${year}-${e.md}`);
    if (d < now) d = new Date(`${year + 1}-${e.md}`);
    return { name: e.name, date: d.toISOString().slice(0, 10), inDays: Math.round((d - now) / 86400000), suggestionCategory: e.category };
  }).sort((a, b) => a.inDays - b.inDays);
  return {
    upcoming,
    religious: [{ name: 'Ramadan', note: 'date lunaire — variable' }, { name: 'Tabaski (Aïd el-Kebir)', note: 'date lunaire — variable' }],
    note: 'L\'IA prépare des suggestions adaptées à l\'approche de chaque événement.',
  };
}

/* ------------------------- Loyalty / Gamification ------------------------- */
const TIERS = [{ n: 'Bronze', min: 0 }, { n: 'Argent', min: 50 }, { n: 'Or', min: 150 }, { n: 'Platine', min: 400 }];
function loyalty({ userId } = {}) {
  const orders = userId ? ordersOf(userId) : [];
  const spent = orders.reduce((s, o) => s + o.total, 0);
  const points = Math.floor(spent / 1000);
  const tier = [...TIERS].reverse().find((t) => points >= t.min) || TIERS[0];
  const next = TIERS.find((t) => t.min > points);
  const reviewsWritten = userId ? store.find('reviews', (r) => r.userId === userId).length : 0;
  const badges = [];
  if (orders.length >= 1) badges.push('Première commande');
  if (orders.length >= 5) badges.push('Client fidèle');
  if (reviewsWritten >= 1) badges.push('Contributeur d\'avis');
  if (spent >= 100000) badges.push('VIP');
  const challenges = [
    { title: 'Passez une commande cette semaine', reward: '+20 points' },
    { title: 'Laissez un avis', reward: 'badge Contributeur' },
  ];
  return {
    points, tier: tier.n,
    nextTier: next ? { name: next.n, pointsNeeded: next.min - points } : null,
    badges, challenges,
    coupons: points >= 50 ? [{ code: 'FIDELE10', label: '-10% (fidélité)' }] : [],
  };
}

/* ------------------------- Subscription Advisor ------------------------- */
const PLANS = [
  { id: 'gratuit', name: 'Gratuit', priceFcfa: 0, perks: ['Achat standard', 'Recommandations IA'] },
  { id: 'premium', name: 'Premium', priceFcfa: 2000, perks: ['Livraison offerte dès 25 000 FCFA', 'Ventes flash en avant-première', 'Support prioritaire'] },
  { id: 'premium-plus', name: 'Premium+', priceFcfa: 5000, perks: ['Livraison toujours offerte', '-5% permanent', 'Accès anticipé aux nouveautés'] },
];
function subscriptionAdvisor({ userId } = {}) {
  const orders = userId ? ordersOf(userId) : [];
  const monthlySpend = orders.length ? Math.round(orders.reduce((s, o) => s + o.total, 0) / 3) : 0;
  let recommended = 'gratuit';
  if (monthlySpend >= 60000 || orders.length >= 4) recommended = 'premium-plus';
  else if (monthlySpend >= 20000 || orders.length >= 2) recommended = 'premium';
  const plan = PLANS.find((p) => p.id === recommended);
  return {
    plans: PLANS, recommended,
    rationale: recommended === 'gratuit' ? 'Votre volume actuel ne justifie pas encore un abonnement payant.' : `Avec ~${monthlySpend.toLocaleString('fr-FR')} FCFA/mois, ${plan.name} devient rentable via la livraison offerte et les réductions.`,
    note: 'Recommandation transparente basée sur votre activité réelle.',
  };
}

/* ------------------------- Price History ------------------------- */
function recordPrice(productId, price) {
  const last = store.find('priceHistory', (h) => h.productId === productId).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))[0];
  if (!last || last.price !== price) store.insert('priceHistory', { productId, price });
}
function priceHistory({ productId } = {}) {
  const p = store.getById('products', productId);
  if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  recordPrice(productId, p.price); // amorce le suivi
  const history = store.find('priceHistory', (h) => h.productId === productId).map((h) => ({ price: h.price, date: h.createdAt }));
  const prices = history.map((h) => h.price);
  return {
    productId, current: p.price,
    lowest: prices.length ? Math.min(...prices) : p.price, highest: prices.length ? Math.max(...prices) : p.price,
    history, note: history.length <= 1 ? 'Le suivi des prix vient de démarrer ; l\'historique s\'enrichira dans le temps.' : 'Historique des prix réels.',
  };
}

/* ------------------------- Discovery ------------------------- */
function discovery({ userId } = {}) {
  const prof = userId ? memory.profileFor(userId, 'shopping') : { categories: [] };
  const trend = forecast.trendingCategories({ days: 14 }).filter((c) => c.deltaShare > 0)[0];
  const news = store.find('products', (p) => p.active !== false).slice(-6).reverse().map(catalog.productCard);
  const forYou = recommender.forYou(userId, 6);
  return {
    parPreferences: forYou,
    tendance: trend ? { category: trend.category, products: store.find('products', (p) => p.category === trend.category && p.active !== false).slice(0, 4).map(catalog.productCard) } : null,
    nouveautes: news,
    note: 'Découvertes basées sur vos préférences, les tendances et les nouveautés.',
  };
}

/* ------------------------- Personal Dashboard (agrégat) ------------------------- */
function dashboard({ userId } = {}) {
  const prof = profile({ userId });
  const orders = userId ? ordersOf(userId) : [];
  const spent = orders.reduce((s, o) => s + o.total, 0);
  // Économies estimées : achats sous la moyenne de leur sous-catégorie.
  let savings = 0;
  for (const o of orders) for (const i of o.items) {
    const p = store.getById('products', i.productId); if (!p) continue;
    const peers = store.find('products', (x) => x.subcategory === p.subcategory && x.id !== p.id);
    if (peers.length) { const avg = peers.reduce((s, x) => s + x.price, 0) / peers.length; if (p.price < avg) savings += Math.round((avg - p.price) * i.qty); }
  }
  return {
    profile: { categories: prof.preferredCategories, colors: prof.preferredColors, averageBudgetFcfa: prof.averageBudgetFcfa, sizes: prof.sizes },
    orders: { count: orders.length, totalSpentFcfa: spent, estimatedSavingsFcfa: savings },
    loyalty: loyalty({ userId }),
    wishlistCount: prof.favoritesCount,
    recommendations: recommender.forYou(userId, 4),
    reorder: reorder({ userId }).items.slice(0, 3),
    note: 'Votre espace personnel : préférences apprises, achats, fidélité, suggestions.',
  };
}

module.exports = {
  compare, budgetBasket, sizeGuide, outfit, productQA, alerts,
  profile, smartCart, giftFinder, reviewSummary, trustScore, delivery, reorder,
  calendar, loyalty, subscriptionAdvisor, priceHistory, discovery, dashboard, recordPrice,
};
