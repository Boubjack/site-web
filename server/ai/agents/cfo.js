/**
 * AGENT — AI CFO (directeur financier). Lecture financière : revenus,
 * commissions, panier moyen, croissance, prévision, rentabilité par catégorie.
 * Admin. Raisonne sur les chiffres réels via analytics/forecast.
 */
const analytics = require('../services/analytics');
const forecast = require('../services/forecast');

async function run(input = {}) {
  const days = Math.min(365, Math.max(1, parseInt(input.days, 10) || 30));
  const report = analytics.financeReport({ days });
  const fc = forecast.salesForecast({ days: 30, horizon: 7 });

  const insights = [];
  if (report.growthPct !== null) insights.push(`Croissance ${report.growthPct >= 0 ? '+' : ''}${report.growthPct} % vs période précédente.`);
  insights.push(`Panier moyen : ${report.averageOrderFcfa.toLocaleString('fr-FR')} FCFA sur ${report.orderCount} commandes.`);
  insights.push(`Prévision 7 j : ${fc.projectedRevenueFcfa.toLocaleString('fr-FR')} FCFA (tendance ${fc.trend}).`);

  const recommendations = [];
  const topCat = Object.entries(report.commissionByCategory).sort((a, b) => b[1] - a[1])[0];
  if (topCat) recommendations.push(`Sécuriser la marge sur « ${topCat[0]} » (catégorie la plus contributive aux commissions).`);
  if (fc.trend === 'baisse') recommendations.push('Revenu en repli : lancer des promotions ciblées et surveiller le panier moyen.');
  if (report.averageOrderFcfa < 20000) recommendations.push('Augmenter le panier moyen via ventes croisées (recommandations « complétez votre achat »).');

  return {
    role: 'AI CFO',
    headline: `CA ${report.revenueFcfa.toLocaleString('fr-FR')} FCFA · commissions ${report.commissionFcfa.toLocaleString('fr-FR')} FCFA · ${report.growthPct === null ? 'n/a' : (report.growthPct >= 0 ? '+' : '') + report.growthPct + ' %'}.`,
    metrics: {
      revenueFcfa: report.revenueFcfa,
      commissionFcfa: report.commissionFcfa,
      averageOrderFcfa: report.averageOrderFcfa,
      orderCount: report.orderCount,
      growthPct: report.growthPct,
      forecast: { trend: fc.trend, projectedRevenueFcfa: fc.projectedRevenueFcfa, projectedGrowthPct: fc.projectedGrowthPct },
    },
    topProducts: report.topProducts,
    commissionByCategory: report.commissionByCategory,
    insights,
    recommendations,
  };
}

module.exports = {
  id: 'cfo',
  name: 'AI CFO',
  description: 'Directeur financier IA : revenus, commissions, croissance, prévision, rentabilité.',
  allowedRoles: ['admin'],
  keywords: ['cfo', 'finance', 'financier', 'revenu', 'chiffre', 'commission', 'marge', 'rentab', 'panier moyen', 'prévision', 'prevision', 'budget'],
  tool: {
    name: 'cfo_analysis',
    description: 'Analyse financière IA (CFO) : CA, commissions, croissance, prévision, rentabilité par catégorie.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  run,
};
