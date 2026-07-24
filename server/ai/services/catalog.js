/**
 * Accès catalogue partagé par les services IA :
 *  - moteur de recherche à scoring (sert d'outil au modèle ET de moteur
 *    local quand aucune clé API n'est configurée) ;
 *  - mise en forme "carte produit" (image, prix, vendeur, avis).
 */
const { store } = require('../../db/store');

const STOPWORDS = new Set([
  'je', 'un', 'une', 'de', 'des', 'du', 'la', 'le', 'les', 'pour', 'avec', 'sans',
  'cherche', 'veux', 'voudrais', 'recherche', 'moins', 'plus', 'a', 'à', 'au', 'et',
  'ou', 'mon', 'ma', 'mes', 'the', 'for', 'with', 'budget', 'fcfa', 'cfa', 'prix',
]);

const SYNONYMS = {
  telephone: ['smartphone', 'phone', 'portable'],
  tel: ['smartphone'],
  puissant: ['gaming', 'pro', 'performance'],
  jouer: ['gaming', 'jeu'],
  jeu: ['gaming'],
  tenue: ['boubou', 'costume', 'robe', 'ensemble'],
  habit: ['boubou', 'costume', 'robe'],
  mariage: ['ceremonie', 'mariage'],
  fete: ['ceremonie', 'soiree'],
  elegante: ['elegant', 'soiree', 'chic'],
  chic: ['elegant'],
  sweat: ['hoodie'],
  capuche: ['hoodie'],
  chaussure: ['sneakers', 'babouches'],
  basket: ['sneakers'],
  ecouteur: ['audio', 'ecouteurs'],
  casque: ['audio'],
  batterie: ['powerbank'],
  montre: ['montre', 'connectee'],
  sac: ['sac'],
  bijou: ['bijoux'],
  cadeau: ['bijoux', 'accessoires', 'montre'],
};

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
}

function tokenize(query) {
  const raw = normalize(query).split(/[^a-z0-9]+/).filter((t) => t.length > 1 && !STOPWORDS.has(t));
  const expanded = new Set(raw);
  for (const t of raw) {
    const base = t.replace(/s$/, '');
    expanded.add(base);
    for (const syn of SYNONYMS[base] || SYNONYMS[t] || []) expanded.add(syn);
  }
  return [...expanded];
}

/** Extraction naïve d'un budget en FCFA depuis une phrase ("200 000 FCFA", "50000"). */
function extractBudget(query) {
  const q = normalize(query).replace(/\s/g, ' ');
  const m = q.match(/(\d[\d\s.,]{2,})\s*(?:fcfa|cfa|f\b|francs?)?/);
  if (!m) return null;
  const value = parseInt(m[1].replace(/[\s.,]/g, ''), 10);
  return Number.isFinite(value) && value >= 1000 ? value : null;
}

function productText(p) {
  return normalize([
    p.name, p.description, p.category, p.subcategory, p.style, p.material,
    p.gender, (p.colors || []).join(' '), (p.occasion || []).join(' '),
    p.specs ? Object.values(p.specs).join(' ') : '',
  ].join(' '));
}

/**
 * Recherche produits avec scoring lexical + filtres structurés.
 */
function searchProducts({ query = '', category, maxPrice, minPrice, color, occasion, gender, limit = 8 } = {}) {
  const budget = maxPrice || extractBudget(query);
  const tokens = tokenize(query);
  const products = store.find('products', (p) => p.active !== false);

  const scored = products.map((p) => {
    const text = productText(p);
    let score = 0;
    for (const t of tokens) {
      if (text.includes(t)) score += 2;
      if (normalize(p.name).includes(t)) score += 2;
    }
    if (category && normalize(p.category).includes(normalize(category))) score += 4;
    if (occasion && (p.occasion || []).some((o) => normalize(o).includes(normalize(occasion)))) score += 4;
    if (gender && p.gender && normalize(p.gender).includes(normalize(gender))) score += 2;
    if (color && (p.colors || []).some((c) => normalize(c).includes(normalize(color)))) score += 3;
    if (budget && p.price <= budget) score += 1;
    if (budget && p.price > budget) score -= 6;
    if (minPrice && p.price < minPrice) score -= 4;
    return { product: p, score };
  });

  const hasCriteria = tokens.length || category || occasion || color || gender;
  return scored
    .filter((s) => (hasCriteria ? s.score > 0 : true))
    .sort((a, b) => b.score - a.score || a.product.price - b.product.price)
    .slice(0, limit)
    .map((s) => productCard(s.product));
}

/** Carte produit publique : image, prix, vendeur, note moyenne, nb d'avis. */
function productCard(p) {
  const seller = store.getById('users', p.sellerId);
  const reviews = store.find('reviews', (r) => r.productId === p.id);
  const rating = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;
  return {
    id: p.id,
    name: p.name,
    price: p.price,
    currency: 'FCFA',
    emoji: p.emoji || '🛍️',
    category: p.category,
    subcategory: p.subcategory,
    colors: p.colors || [],
    sizes: p.sizes || [],
    description: p.description,
    specs: p.specs || null,
    stock: p.stock,
    seller: seller ? { id: seller.id, shop: seller.shop || seller.name, rating: seller.rating || null } : null,
    rating,
    reviewCount: reviews.length,
  };
}

function formatFcfa(n) {
  return `${Number(n).toLocaleString('fr-FR')} FCFA`;
}

module.exports = { searchProducts, productCard, extractBudget, tokenize, normalize, formatFcfa };
