/**
 * AGENT — Marketplace Brain. Intelligence centrale : instantané transverse de
 * la plateforme, score de santé /100, opportunités et risques. Admin.
 */
const brain = require('../services/brain');

async function run(input = {}) {
  const days = Math.min(365, Math.max(1, parseInt(input.days, 10) || 30));
  const snap = brain.snapshot({ days });
  const health = brain.healthScore(snap);
  const { opportunities, risks } = brain.opportunities(snap);
  return {
    role: 'Marketplace Brain',
    healthScore: health.score,
    scoreBreakdown: health.parts,
    snapshot: snap,
    opportunities,
    risks,
    headline: `Santé plateforme : ${health.score}/100 · CA ${snap.finance.revenueFcfa.toLocaleString('fr-FR')} FCFA (${snap.finance.growthPct === null ? 'n/a' : (snap.finance.growthPct >= 0 ? '+' : '') + snap.finance.growthPct + ' %'}) · tendance ${snap.growth.trend}.`,
  };
}

module.exports = {
  id: 'brain',
  name: 'Marketplace Brain',
  description: 'Cerveau central : score de santé, opportunités et risques transverses de la marketplace.',
  allowedRoles: ['admin'],
  keywords: ['brain', 'cerveau', 'santé', 'sante', 'vue globale', 'pilotage', 'plateforme', 'score', 'opportunité', 'opportunite', 'risque'],
  tool: {
    name: 'marketplace_brain',
    description: 'Score de santé /100 de la plateforme, opportunités et risques (instantané transverse).',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Fenêtre en jours (défaut 30)' } } },
  },
  run,
};
