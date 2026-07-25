/**
 * RECHERCHE INTELLIGENTE — tolérance aux fautes + autocomplétion.
 *
 * Reproduit l'UX des grands moteurs (Meilisearch/OpenSearch) sans serveur
 * externe : 100 % local, pur JavaScript, sur le catalogue réel.
 *   - correction de frappe par distance de Levenshtein contre le vocabulaire
 *     produit ;
 *   - suggestions instantanées (noms de produits, catégories, recherches
 *     populaires) préfixe + sous-chaîne.
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');

/* ---------------- Vocabulaire (mémoïsé, invalidé au changement) ---------------- */
let vocab = null;
let vocabKey = '';

function buildVocab() {
  const products = store.find('products', (p) => p.active !== false);
  const key = String(products.length);
  if (vocab && key === vocabKey) return vocab;
  const words = new Set();
  const names = [];
  for (const p of products) {
    names.push(p.name);
    for (const w of catalog.tokenize(`${p.name} ${p.category} ${p.subcategory || ''} ${(p.colors || []).join(' ')}`)) {
      if (w.length >= 3) words.add(w);
    }
  }
  vocab = { words: [...words], names, categories: [...new Set(products.map((p) => p.category))] };
  vocabKey = key;
  return vocab;
}

/* ---------------- Distance de Levenshtein (bornée) ---------------- */
function levenshtein(a, b, max = 2) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let best = i;
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const tmp = prev[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + cost);
      diag = tmp;
      if (prev[j] < best) best = prev[j];
    }
    if (best > max) return max + 1; // court-circuit
  }
  return prev[b.length];
}

/** Corrige chaque mot d'une requête vers le vocabulaire le plus proche. */
function correct(query) {
  const { words } = buildVocab();
  const tokens = catalog.normalize(query).split(/\s+/).filter(Boolean);
  let changed = false;
  const fixed = tokens.map((t) => {
    if (t.length < 4 || words.includes(t)) return t;
    let best = t;
    let bestD = 3;
    for (const w of words) {
      const d = levenshtein(t, w, 2);
      if (d < bestD || (d === bestD && w.length > best.length)) { bestD = d; best = w; }
    }
    if (best !== t && bestD <= 2) { changed = true; return best; }
    return t;
  });
  return { corrected: fixed.join(' '), changed };
}

/** Suggestions d'autocomplétion instantanées. */
function suggest(query, limit = 8) {
  const q = catalog.normalize(query).trim();
  if (!q) return [];
  const { names, categories } = buildVocab();
  const out = [];
  const seen = new Set();
  const push = (label, type) => {
    const k = label.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k); out.push({ label, type });
  };
  // Produits : préfixe d'abord, puis sous-chaîne.
  for (const n of names) if (catalog.normalize(n).startsWith(q)) push(n, 'produit');
  for (const n of names) if (catalog.normalize(n).includes(q)) push(n, 'produit');
  for (const c of categories) if (catalog.normalize(c).includes(q)) push(c, 'catégorie');
  // Recherches populaires (événements).
  const searches = store.find('events', (e) => e.type === 'search' && e.query);
  const pop = {};
  for (const e of searches) { const s = catalog.normalize(e.query); if (s.includes(q)) pop[s] = (pop[s] || 0) + 1; }
  for (const [s] of Object.entries(pop).sort((a, b) => b[1] - a[1])) push(s, 'recherche');
  return out.slice(0, limit);
}

function invalidate() { vocab = null; vocabKey = ''; }

module.exports = { suggest, correct, levenshtein, invalidate };
