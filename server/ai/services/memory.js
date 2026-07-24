/**
 * MÉMOIRE IA — mémoires SÉPARÉES par assistant (namespaces).
 *
 * Chaque assistant possède sa propre mémoire, isolée des autres :
 *   - 'shopping' : préférences d'achat du client (catégories, styles, couleurs, budget) ;
 *   - 'seller'   : habitudes du vendeur (campagnes, ton, produits travaillés) ;
 *   - 'operator' : préférences de l'administrateur (période de rapport, focus).
 *
 * Un enregistrement = (userId, namespace). Les mémoires ne se mélangent jamais.
 * Confidentialité : agrégats et préférences uniquement — jamais de conversation
 * brute ; chaque mémoire est consultable et effaçable par son propriétaire.
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');

function getMemory(userId, namespace = 'shopping') {
  return store.findOne('aiMemory', (m) => m.userId === userId && (m.namespace || 'shopping') === namespace);
}

function ensureMemory(userId, namespace = 'shopping') {
  let m = getMemory(userId, namespace);
  if (!m) {
    m = store.insert('aiMemory', {
      userId,
      namespace,
      categories: {}, // (shopping) catégorie -> compteur d'intérêt
      styles: {},
      colors: {},
      budgets: [],
      prefs: {},      // (générique) clé -> valeur
      notes: [],      // (générique) faits récents mémorisés
    });
  }
  return m;
}

function bump(map, key, inc = 1) {
  if (!key) return map;
  map[key] = (map[key] || 0) + inc;
  return map;
}

function top(map, n = 3) {
  return Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/* ---------------- Mémoire SHOPPING (client) ---------------- */

function learnFromProduct(userId, product, weight = 1) {
  if (!userId || !product) return;
  const m = ensureMemory(userId, 'shopping');
  bump(m.categories, product.category, weight);
  bump(m.styles, product.style, weight);
  for (const c of product.colors || []) bump(m.colors, c, weight);
  store.update('aiMemory', m.id, m);
}

function learnFromMessage(userId, text) {
  if (!userId || !text) return;
  const m = ensureMemory(userId, 'shopping');
  const budget = catalog.extractBudget(text);
  if (budget) m.budgets = [...(m.budgets || []), budget].slice(-5);
  const q = catalog.normalize(text);
  for (const color of ['noir', 'blanc', 'bleu', 'rouge', 'kaki', 'dore', 'argent', 'orange']) {
    if (q.includes(color)) bump(m.colors, color, 1);
  }
  store.update('aiMemory', m.id, m);
}

function profileFor(userId, namespace = 'shopping') {
  const m = getMemory(userId, namespace);
  if (namespace !== 'shopping') {
    return { prefs: (m && m.prefs) || {}, notes: (m && m.notes) || [] };
  }
  if (!m) return { categories: [], styles: [], colors: [], averageBudget: null };
  return {
    categories: top(m.categories, 5),
    styles: top(m.styles, 5),
    colors: top(m.colors, 5),
    averageBudget: m.budgets && m.budgets.length
      ? Math.round(m.budgets.reduce((s, b) => s + b, 0) / m.budgets.length) : null,
  };
}

/* ---------------- Mémoire GÉNÉRIQUE (seller / operator / …) ---------------- */

/** Mémorise/écrase des préférences (clé -> valeur) pour un namespace. */
function remember(userId, namespace, patch = {}) {
  if (!userId) return;
  const m = ensureMemory(userId, namespace);
  m.prefs = { ...(m.prefs || {}), ...patch };
  store.update('aiMemory', m.id, m);
}

/** Mémorise un fait récent (déduplique, garde les 8 derniers). */
function noteFact(userId, namespace, fact) {
  if (!userId || !fact) return;
  const m = ensureMemory(userId, namespace);
  m.notes = [fact, ...(m.notes || []).filter((n) => n !== fact)].slice(0, 8);
  store.update('aiMemory', m.id, m);
}

function recall(userId, namespace) {
  const m = getMemory(userId, namespace);
  return m ? { prefs: m.prefs || {}, notes: m.notes || [] } : { prefs: {}, notes: [] };
}

/* ---------------- Résumé injecté dans le contexte d'un assistant ---------------- */

function summaryFor(userId, namespace = 'shopping') {
  const m = getMemory(userId, namespace);
  if (!m) return null;

  if (namespace === 'shopping') {
    const parts = [];
    const cats = top(m.categories); const styles = top(m.styles); const colors = top(m.colors);
    if (cats.length) parts.push(`catégories préférées: ${cats.join(', ')}`);
    if (styles.length) parts.push(`styles: ${styles.join(', ')}`);
    if (colors.length) parts.push(`couleurs: ${colors.join(', ')}`);
    if (m.budgets && m.budgets.length) {
      const avg = Math.round(m.budgets.reduce((s, b) => s + b, 0) / m.budgets.length);
      parts.push(`budget habituel: ~${avg} FCFA`);
    }
    return parts.length ? parts.join(' | ') : null;
  }

  // seller / operator : préférences + faits mémorisés
  const parts = [];
  for (const [k, v] of Object.entries(m.prefs || {})) parts.push(`${k}: ${v}`);
  if (m.notes && m.notes.length) parts.push(`à retenir: ${m.notes.slice(0, 3).join(' ; ')}`);
  return parts.length ? parts.join(' | ') : null;
}

/** Droit à l'oubli, ciblé par namespace. */
function forget(userId, namespace = 'shopping') {
  const m = getMemory(userId, namespace);
  if (m) store.remove('aiMemory', m.id);
  return true;
}

module.exports = {
  learnFromProduct, learnFromMessage, // shopping
  remember, noteFact, recall,         // générique (seller/operator)
  summaryFor, profileFor, forget,     // commun (namespace en 2e argument)
};
