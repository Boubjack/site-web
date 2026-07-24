/**
 * AGENT — AI COO (directeur des opérations). Exécution : stocks, exécution des
 * commandes (statuts), couverture catalogue, performance des vendeurs. Admin.
 */
const analytics = require('../services/analytics');
const stockAgent = require('./stock');

async function run(input = {}) {
  const days = Math.min(365, Math.max(1, parseInt(input.days, 10) || 30));
  const sales = analytics.salesSummary({ days });
  const catalog = analytics.catalogStats();
  const sellers = analytics.sellerPerformance({ days }).slice(0, 5);
  const stock = stockAgent.analyze({});

  const byStatus = sales.byStatus || {};
  const delivered = byStatus.livree || byStatus['livrée'] || 0;
  const cancelled = byStatus.annulee || byStatus['annulée'] || 0;
  const fulfillmentPct = sales.orderCount ? Math.round((delivered / sales.orderCount) * 100) : null;

  const recommendations = [];
  if (catalog.lowStock.length) recommendations.push(`${catalog.lowStock.length} produit(s) en stock faible : réapprovisionner (AI Stock).`);
  if (cancelled >= 3) recommendations.push(`${cancelled} commandes annulées : analyser les causes (paiement, délai, rupture).`);
  const emptyCats = Object.entries(catalog.byCategory).filter(([, n]) => n <= 2).map(([c]) => c);
  if (emptyCats.length) recommendations.push(`Catégories peu fournies (${emptyCats.join(', ')}) : recruter des vendeurs.`);

  return {
    role: 'AI COO',
    headline: `${sales.orderCount} commandes · exécution ${fulfillmentPct === null ? 'n/a' : fulfillmentPct + ' %'} · ${catalog.lowStock.length} stock(s) faible(s).`,
    metrics: {
      orderCount: sales.orderCount,
      byStatus,
      fulfillmentPct,
      catalog: { total: catalog.total, byCategory: catalog.byCategory },
      lowStock: catalog.lowStock,
    },
    stockAlerts: stock.alerts || stock,
    topSellers: sellers,
    recommendations,
  };
}

module.exports = {
  id: 'coo',
  name: 'AI COO',
  description: 'Directeur des opérations IA : stocks, exécution des commandes, catalogue, vendeurs.',
  allowedRoles: ['admin'],
  keywords: ['coo', 'opération', 'operation', 'stock', 'logistique', 'livraison', 'exécution', 'execution', 'rupture', 'catalogue'],
  tool: {
    name: 'coo_analysis',
    description: 'Analyse opérationnelle IA (COO) : stocks, exécution des commandes, couverture catalogue, vendeurs.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  run,
};
