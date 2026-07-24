/**
 * AGENT — AI CMO (directeur marketing). Croissance, acquisition, tendances,
 * conversion, produits à pousser, recherches populaires. Admin.
 */
const analytics = require('../services/analytics');
const forecast = require('../services/forecast');
const brain = require('../services/brain');
const trendsAgent = require('./trends');

async function run(input = {}) {
  const days = Math.min(365, Math.max(1, parseInt(input.days, 10) || 30));
  const conversion = brain.globalConversion({ days });
  const trending = forecast.trendingCategories({ days: 14 });
  const t = await trendsAgent.run({});
  const top = analytics.topProducts({ days, limit: 5 });

  const recommendations = [];
  if (trending[0] && trending[0].deltaShare > 0) recommendations.push(`Campagne sur « ${trending[0].category} » (catégorie montante +${trending[0].deltaShare} pts).`);
  if (t.popularSearches[0]) recommendations.push(`Créer une sélection « ${t.popularSearches[0].query} » (recherche n°1) + Stories IA.`);
  if (conversion.ratePct !== null && conversion.ratePct < 2) recommendations.push(`Conversion ${conversion.ratePct} % : renforcer personnalisation, hover intelligent et preuve sociale (avis).`);
  if (top[0]) recommendations.push(`Mettre « ${top[0].name} » en héros de la vitrine vivante (meilleur revenu).`);

  return {
    role: 'AI CMO',
    headline: `Conversion ${conversion.ratePct === null ? 'n/a' : conversion.ratePct + ' %'} · tendance forte : ${trending[0] ? trending[0].category : '—'}.`,
    metrics: { conversion, trendingCategories: trending.slice(0, 4) },
    popularSearches: t.popularSearches.slice(0, 5),
    productsToPush: top,
    recommendations,
  };
}

module.exports = {
  id: 'cmo',
  name: 'AI CMO',
  description: 'Directeur marketing IA : tendances, conversion, acquisition, produits à promouvoir.',
  allowedRoles: ['admin'],
  keywords: ['cmo', 'marketing', 'acquisition', 'conversion', 'campagne', 'promouvoir', 'pousser', 'audience', 'croissance'],
  tool: {
    name: 'cmo_analysis',
    description: 'Analyse marketing IA (CMO) : conversion, tendances, recherches populaires, produits à promouvoir.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  run,
};
