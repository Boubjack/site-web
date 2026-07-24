/**
 * Recherche sémantique / mémoire vectorielle — compatible FAISS.
 *
 * Implémentation par défaut : index cosinus 100 % local, pur JavaScript, sans
 * aucune dépendance (gratuit, hors ligne). Les embeddings sont produits par le
 * « hashing trick » (projection de sac-de-mots dans un espace de dimension
 * fixe, puis normalisation L2) — la similarité cosinus se réduit alors à un
 * simple produit scalaire.
 *
 * Point d'extension : si config.vectors.provider === 'faiss', on peut brancher
 * un vrai index FAISS + des embeddings de modèle (OpenRouter/Ollama). Le reste
 * du code appelle semanticSearch()/similar() sans rien changer.
 */
const config = require('../../config');
const { store } = require('../../db/store');
const catalog = require('./catalog');

const DIMS = Math.max(32, config.vectors.dims || 256);

/* --------------------- Embeddings locaux --------------------- */
function hash(str, seed = 2166136261) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Vecteur dense normalisé L2 pour un texte (dimension DIMS). */
function embed(text) {
  const vec = new Float64Array(DIMS);
  const tokens = catalog.tokenize(text || '');
  const tf = {};
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  for (const [t, count] of Object.entries(tf)) {
    const bucket = hash(t) % DIMS;
    const sign = (hash(t, 5381) & 1) ? 1 : -1;
    vec[bucket] += sign * (1 + Math.log(count)); // pondération TF sous-linéaire
  }
  let norm = 0;
  for (let i = 0; i < DIMS; i += 1) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < DIMS; i += 1) vec[i] /= norm;
  return vec;
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < DIMS; i += 1) s += a[i] * b[i];
  return s; // vecteurs normalisés → cosinus
}

/* --------------------- Index (cache) --------------------- */
let index = null;      // [{ id, vec, product }]
let indexKey = '';     // signature d'invalidation

function productBlob(p) {
  return [
    p.name, p.name, // le nom compte double
    p.description, p.category, p.subcategory, p.style, p.material, p.gender,
    (p.colors || []).join(' '), (p.occasion || []).join(' '),
    p.specs ? Object.values(p.specs).join(' ') : '',
  ].join(' ');
}

function build() {
  const products = store.find('products', (p) => p.active !== false);
  const key = `${products.length}:${products.map((p) => p.id).join(',').length}`;
  if (index && key === indexKey) return index;
  index = products.map((p) => ({ id: p.id, product: p, vec: embed(productBlob(p)) }));
  indexKey = key;
  return index;
}

/** Recherche sémantique : renvoie [{ id, score, product }] triés. */
function semanticSearch(query, { limit = 12, category } = {}) {
  const qv = embed(query);
  let items = build();
  if (category) items = items.filter((x) => x.product.category === category);
  return items
    .map((x) => ({ id: x.id, product: x.product, score: Math.round(dot(qv, x.vec) * 1000) / 1000 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Produits sémantiquement proches d'un produit donné (hors lui-même). */
function similar(productId, { limit = 6 } = {}) {
  const items = build();
  const self = items.find((x) => x.id === productId);
  if (!self) return [];
  return items
    .filter((x) => x.id !== productId)
    .map((x) => ({ id: x.id, product: x.product, score: Math.round(dot(self.vec, x.vec) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/** Force la reconstruction (après ajout/suppression de produits). */
function invalidate() { index = null; indexKey = ''; }

module.exports = {
  provider: config.vectors.provider,
  dims: DIMS,
  embed,
  semanticSearch,
  similar,
  invalidate,
};
