/**
 * 9. IA ADMINISTRATEUR — assistant privé emarket.admin.
 * Répond à "Quels produits marchent le mieux ?", "Quelle promotion lancer ?",
 * "Pourquoi les ventes diminuent ?", "Quels vendeurs progressent ?" en
 * s'appuyant sur les outils analytiques (données réelles) + rapports auto.
 */
const provider = require('../provider/anthropic');
const prompts = require('../provider/prompts');
const analytics = require('./analytics');
const fraud = require('./fraud');
const catalog = require('./catalog');

const TOOLS = [
  {
    name: 'sales_summary',
    description: 'Résumé des ventes sur N jours : CA, commissions, panier moyen, croissance vs période précédente, statuts de commandes.',
    input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Période en jours (défaut 30)' } } },
  },
  {
    name: 'top_products',
    description: 'Meilleurs produits par revenu sur N jours.',
    input_schema: { type: 'object', properties: { days: { type: 'number' }, limit: { type: 'number' } } },
  },
  {
    name: 'seller_performance',
    description: 'Classement des vendeurs par revenu et unités vendues sur N jours.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'user_stats',
    description: 'Statistiques utilisateurs : total, clients, vendeurs.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'review_stats',
    description: 'Statistiques des avis : note moyenne, avis négatifs à surveiller.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'catalog_stats',
    description: 'État du catalogue : produits par catégorie, stocks faibles.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'finance_report',
    description: 'Rapport financier complet : CA, commissions E-Market (8%), croissance, top produits/vendeurs, commissions par catégorie.',
    input_schema: { type: 'object', properties: { days: { type: 'number' } } },
  },
  {
    name: 'security_overview',
    description: 'Vue sécurité : scores de risque des utilisateurs et commandes (vert/orange/rouge), signaux suspects détectés.',
    input_schema: { type: 'object', properties: {} },
  },
];

async function executeTool(name, input = {}) {
  switch (name) {
    case 'sales_summary': return analytics.salesSummary(input);
    case 'top_products': return analytics.topProducts(input);
    case 'seller_performance': return analytics.sellerPerformance(input);
    case 'user_stats': return analytics.userStats();
    case 'review_stats': return analytics.reviewStats();
    case 'catalog_stats': return analytics.catalogStats();
    case 'finance_report': return analytics.financeReport(input);
    case 'security_overview': return fraud.overview();
    default: return { error: `Outil inconnu: ${name}` };
  }
}

async function chatStream({ messages, sse }) {
  if (!provider.enabled()) {
    const answer = localAnswer(messages);
    sse('text', { delta: answer });
    sse('done', { text: answer, local: true });
    return;
  }
  const { text } = await provider.agentLoop({
    system: prompts.ADMIN_ANALYST,
    messages,
    tools: TOOLS,
    executeTool,
    onToolUse: (name) => sse('status', { tool: name }),
    onText: (delta) => sse('text', { delta }),
    maxTokens: 4096,
  });
  sse('done', { text });
}

/** Réponse locale : rapport chiffré direct (sans raisonnement LLM). */
function localAnswer(messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const q = catalog.normalize(typeof last?.content === 'string' ? last.content : '');
  const f = catalog.formatFcfa;

  if (/produit|marche|vend/.test(q)) {
    const top = analytics.topProducts({ days: 30 });
    return 'Top produits (30 jours) :\n' +
      top.map((t, i) => `${i + 1}. ${t.name} — ${t.qty} vendus — ${f(t.revenue)}`).join('\n');
  }
  if (/vendeur/.test(q)) {
    const sellers = analytics.sellerPerformance({ days: 30 });
    return 'Performance vendeurs (30 jours) :\n' +
      sellers.map((s, i) => `${i + 1}. ${s.shop} — ${s.unitsSold} unités — ${f(s.revenue)}`).join('\n');
  }
  if (/securite|fraude|suspect|risque/.test(q)) {
    const o = fraud.overview();
    return `Sécurité : ${o.summary.vert} profils verts, ${o.summary.orange} orange, ${o.summary.rouge} rouges.\n` +
      o.alerts.map((a) => `⚠ ${a.label} — ${a.reason}`).join('\n');
  }
  if (/finance|chiffre|revenu|commission|rapport/.test(q)) {
    const r = analytics.financeReport({ days: 30 });
    return `Rapport financier (30 jours) :\n• CA : ${f(r.revenueFcfa)}\n• Commissions E-Market (8%) : ${f(r.commissionFcfa)}\n` +
      `• Commandes : ${r.orderCount} (panier moyen ${f(r.averageOrderFcfa)})\n` +
      `• Croissance : ${r.growthPct === null ? 'n/a' : r.growthPct + '%'}\n` +
      `• Top produit : ${r.topProducts[0] ? r.topProducts[0].name : 'n/a'}`;
  }
  const s = analytics.salesSummary({ days: 30 });
  return `Vue d'ensemble (30 jours) : ${s.orderCount} commandes, CA ${f(s.revenueFcfa)}, ` +
    `commissions ${f(s.commissionFcfa)}, croissance ${s.growthPct === null ? 'n/a' : s.growthPct + '%'}.\n` +
    `Posez une question précise : produits, vendeurs, finance, sécurité...`;
}

module.exports = { chatStream, TOOLS, executeTool };
