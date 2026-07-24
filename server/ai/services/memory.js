/**
 * 14. MÉMOIRE IA — préférences utilisateur apprises des interactions.
 * Confidentialité : uniquement des préférences d'achat agrégées (catégories,
 * styles, couleurs, budget) — jamais de contenu de conversation brut ;
 * consultable et effaçable par l'utilisateur (RGPD-friendly).
 */
const { store } = require('../../db/store');
const catalog = require('./catalog');

function getMemory(userId) {
  return store.findOne('aiMemory', (m) => m.userId === userId);
}

function ensureMemory(userId) {
  let m = getMemory(userId);
  if (!m) {
    m = store.insert('aiMemory', {
      userId,
      categories: {},   // catégorie -> compteur d'intérêt
      styles: {},
      colors: {},
      budgets: [],      // derniers budgets exprimés
    });
  }
  return m;
}

function bump(map, key, inc = 1) {
  if (!key) return map;
  map[key] = (map[key] || 0) + inc;
  return map;
}

/** Apprend depuis un événement produit (vue, favori, achat). */
function learnFromProduct(userId, product, weight = 1) {
  if (!userId || !product) return;
  const m = ensureMemory(userId);
  bump(m.categories, product.category, weight);
  bump(m.styles, product.style, weight);
  for (const c of product.colors || []) bump(m.colors, c, weight);
  store.update('aiMemory', m.id, m);
}

/** Apprend depuis un message texte (budget, couleurs mentionnées). */
function learnFromMessage(userId, text) {
  if (!userId || !text) return;
  const m = ensureMemory(userId);
  const budget = catalog.extractBudget(text);
  if (budget) {
    m.budgets = [...(m.budgets || []), budget].slice(-5);
  }
  const q = catalog.normalize(text);
  for (const color of ['noir', 'blanc', 'orange', 'bleu', 'rouge', 'kaki', 'dore', 'argent']) {
    if (q.includes(color)) bump(m.colors, color, 1);
  }
  store.update('aiMemory', m.id, m);
}

function top(map, n = 3) {
  return Object.entries(map || {}).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

/** Résumé compact injecté dans le contexte de l'assistant. */
function summaryFor(userId) {
  const m = getMemory(userId);
  if (!m) return null;
  const parts = [];
  const cats = top(m.categories);
  const styles = top(m.styles);
  const colors = top(m.colors);
  if (cats.length) parts.push(`catégories préférées: ${cats.join(', ')}`);
  if (styles.length) parts.push(`styles: ${styles.join(', ')}`);
  if (colors.length) parts.push(`couleurs: ${colors.join(', ')}`);
  if (m.budgets && m.budgets.length) {
    const avg = Math.round(m.budgets.reduce((s, b) => s + b, 0) / m.budgets.length);
    parts.push(`budget habituel: ~${avg} FCFA`);
  }
  return parts.length ? parts.join(' | ') : null;
}

/** Profil consultable par l'utilisateur. */
function profileFor(userId) {
  const m = getMemory(userId);
  if (!m) return { categories: [], styles: [], colors: [], averageBudget: null };
  return {
    categories: top(m.categories, 5),
    styles: top(m.styles, 5),
    colors: top(m.colors, 5),
    averageBudget: m.budgets && m.budgets.length
      ? Math.round(m.budgets.reduce((s, b) => s + b, 0) / m.budgets.length)
      : null,
  };
}

/** Droit à l'oubli. */
function forget(userId) {
  const m = getMemory(userId);
  if (m) store.remove('aiMemory', m.id);
  return true;
}

module.exports = { learnFromProduct, learnFromMessage, summaryFor, profileFor, forget };
