/**
 * AGENT — AI CEO (directeur général). Synthèse exécutive : s'appuie sur le
 * Marketplace Brain (score de santé, opportunités, risques) et consolide les
 * lectures CFO/CMO/COO pour dégager les 3 priorités stratégiques. Admin.
 */
const brain = require('../services/brain');
const cfo = require('./cfo');
const cmo = require('./cmo');
const coo = require('./coo');

async function run(input = {}) {
  const days = Math.min(365, Math.max(1, parseInt(input.days, 10) || 30));
  const snap = brain.snapshot({ days });
  const health = brain.healthScore(snap);
  const { opportunities, risks } = brain.opportunities(snap);

  // Consolidation des directions (chaque agent respecte ses propres calculs).
  const [f, m, o] = await Promise.all([cfo.run({ days }), cmo.run({ days }), coo.run({ days })]);

  // 3 priorités : risques d'abord, puis meilleures opportunités.
  const priorities = [...risks, ...opportunities].slice(0, 3);

  const verdict = health.score >= 75 ? 'Plateforme en bonne santé — capitaliser sur la croissance.'
    : health.score >= 50 ? 'Plateforme stable — lever les points de friction identifiés.'
      : 'Vigilance — traiter en priorité les risques ci-dessous.';

  return {
    role: 'AI CEO',
    healthScore: health.score,
    headline: `${verdict} (santé ${health.score}/100, tendance ${snap.growth.trend}).`,
    priorities,
    executiveSummary: {
      finance: f.headline,
      marketing: m.headline,
      operations: o.headline,
    },
    opportunities,
    risks,
    scoreBreakdown: health.parts,
  };
}

module.exports = {
  id: 'ceo',
  name: 'AI CEO',
  description: 'Directeur général IA : synthèse exécutive, score de santé et 3 priorités stratégiques.',
  allowedRoles: ['admin'],
  keywords: ['ceo', 'stratégie', 'strategie', 'priorité', 'priorite', 'direction', 'exécutif', 'executif', 'vue globale', 'bilan', 'synthèse', 'synthese'],
  tool: {
    name: 'ceo_briefing',
    description: 'Briefing exécutif IA (CEO) : score de santé, 3 priorités stratégiques, synthèse finance/marketing/opérations.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  run,
};
