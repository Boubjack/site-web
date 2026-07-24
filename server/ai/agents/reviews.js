/**
 * AGENT — AI Analyse des avis. Résume points positifs, points négatifs,
 * problèmes récurrents et satisfaction globale à partir des avis clients.
 * Permissions : vendeur (ses produits) / admin (tout). L'isolation vendeur est
 * appliquée par l'appelant (assistant/route) via le paramètre sellerId.
 */
const provider = require('../provider/anthropic');
const { store } = require('../../db/store');
const catalog = require('../services/catalog');

const POSITIVE = ['excellent', 'magnifique', 'parfait', 'rapide', 'qualité', 'top', 'super', 'confortable', 'satisfait', 'recommande', 'beau', 'belle'];
const NEGATIVE = ['déçu', 'decu', 'lent', 'cassé', 'casse', 'petit', 'grand', 'mauvais', 'défaut', 'defaut', 'faux', 'arnaque', 'retard', 'abîmé', 'abime'];

function collectReviews({ productId, sellerId }) {
  if (productId) return store.find('reviews', (r) => r.productId === productId);
  if (sellerId) {
    const ids = new Set(store.find('products', (p) => p.sellerId === sellerId).map((p) => p.id));
    return store.find('reviews', (r) => ids.has(r.productId));
  }
  return store.all('reviews');
}

function localAnalysis(reviews) {
  const positives = {}; const negatives = {};
  for (const r of reviews) {
    const q = catalog.normalize(r.comment || '');
    for (const w of POSITIVE) if (q.includes(w)) positives[w] = (positives[w] || 0) + 1;
    for (const w of NEGATIVE) if (q.includes(w)) negatives[w] = (negatives[w] || 0) + 1;
  }
  const top = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `${k} (${v})`);
  const avg = reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null;
  const recurring = Object.entries(negatives).filter(([, v]) => v >= 2).map(([k]) => k);
  return {
    count: reviews.length,
    satisfaction: avg,
    satisfactionLabel: avg === null ? 'n/a' : avg >= 4 ? 'élevée' : avg >= 3 ? 'moyenne' : 'faible',
    positives: top(positives),
    negatives: top(negatives),
    recurringIssues: recurring,
  };
}

async function run(input) {
  const reviews = collectReviews(input);
  if (!reviews.length) return { count: 0, message: 'Aucun avis à analyser.' };
  const base = localAnalysis(reviews);
  if (!provider.enabled()) return base;
  try {
    const schema = {
      type: 'object',
      properties: {
        positiveSummary: { type: 'string' },
        negativeSummary: { type: 'string' },
        recurringIssues: { type: 'array', items: { type: 'string' } },
        satisfactionLabel: { type: 'string' },
        recommendation: { type: 'string' },
      },
      required: ['positiveSummary', 'negativeSummary', 'recurringIssues', 'satisfactionLabel', 'recommendation'],
      additionalProperties: false,
    };
    const sample = reviews.slice(0, 40).map((r) => `[${r.rating}/5] ${r.comment}`).join('\n');
    const ai = await provider.completeJson({
      system: 'Tu analyses des avis clients e-commerce. Sois factuel et actionnable.',
      messages: [{ role: 'user', content: `Analyse ces ${reviews.length} avis (note moyenne ${base.satisfaction}) :\n${sample}` }],
      schema,
      maxTokens: 800,
    });
    return { ...base, ...ai };
  } catch { return base; }
}

module.exports = {
  id: 'reviews',
  name: 'AI Analyse des avis',
  description: 'Résume les avis clients : points positifs, points négatifs, problèmes récurrents, satisfaction globale.',
  allowedRoles: ['seller', 'admin'],
  keywords: ['avis', 'review', 'commentaire', 'satisfaction', 'note', 'retour client', 'points positifs', 'points négatifs'],
  tool: {
    name: 'analyze_reviews',
    description: 'Analyse les avis (points positifs/négatifs, problèmes récurrents, satisfaction). Pour un produit (productId) ou toute la boutique.',
    input_schema: { type: 'object', properties: { productId: { type: 'string' } } },
  },
  run,
};
