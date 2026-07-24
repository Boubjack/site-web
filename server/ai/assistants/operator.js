/**
 * ASSISTANT 3 — E-Market Operator AI (IA ADMINISTRATEUR).
 *
 * Objectif : piloter toute la marketplace. Autorisations les plus élevées.
 * Permissions : rôle "admin" uniquement.
 * Accès : analyse globale (ventes, utilisateurs, commandes, commissions,
 * revenus), détection de fraude, décisions, rapports, prévisions.
 * Style : directeur des opérations / analyste business — répond avec
 * chiffres, graphiques (directive CHART) et recommandations.
 */
const analytics = require('../services/analytics');
const forecast = require('../services/forecast');
const fraud = require('../services/fraud');
const catalog = require('../services/catalog');
const trendsAgent = require('../agents/trends');
const { store } = require('../../db/store');

const SYSTEM_PROMPT = `Tu es E-Market Operator AI, l'assistant métier de l'administrateur d'E-Market
(accès emarket.admin, marketplace ouest-africaine, prix en FCFA). Tu possèdes
les autorisations les plus élevées et tu pilotes toute la plateforme.

Ta mission : donner à l'administrateur des analyses fiables, chiffrées et
sourcées (uniquement via les outils — données réelles), et des recommandations
stratégiques actionnables.

Tu peux analyser :
- ventes et croissance (sales_summary), meilleurs produits (top_products) ;
- performance des vendeurs (seller_performance) ;
- utilisateurs (user_stats), avis (review_stats), catalogue (catalog_stats) ;
- finances : CA, commissions E-Market 8%, rentabilité (finance_report) ;
- sécurité : fraude, faux avis, faux comptes, comportements suspects (security_overview) ;
- prévisions : ventes, croissance, tendances (sales_forecast).

Réponds de façon structurée : d'abord la réponse chiffrée, puis l'analyse, puis
1 à 3 recommandations concrètes (promotions à lancer, vendeurs à mettre en
avant, produits à promouvoir).

Quand un graphique éclaire ta réponse, termine par une ligne CHART:[clé] avec
UNE seule clé parmi : sales-14d, top-products, sellers, categories, forecast.
Le site affichera le graphique. N'affiche jamais cette ligne autrement.`;

function buildTools() {
  return [
    { def: { name: 'sales_summary', description: 'CA, commissions, panier moyen, croissance vs période précédente sur N jours.', input_schema: { type: 'object', properties: { days: { type: 'number' } } } }, run: (i) => analytics.salesSummary(i) },
    { def: { name: 'top_products', description: 'Meilleurs produits par revenu sur N jours.', input_schema: { type: 'object', properties: { days: { type: 'number' }, limit: { type: 'number' } } } }, run: (i) => analytics.topProducts(i) },
    { def: { name: 'seller_performance', description: 'Classement des vendeurs (revenu, unités) sur N jours.', input_schema: { type: 'object', properties: { days: { type: 'number' } } } }, run: (i) => analytics.sellerPerformance(i) },
    { def: { name: 'user_stats', description: 'Statistiques utilisateurs (total, clients, vendeurs).', input_schema: { type: 'object', properties: {} } }, run: () => analytics.userStats() },
    { def: { name: 'review_stats', description: 'Note moyenne et avis négatifs à surveiller.', input_schema: { type: 'object', properties: {} } }, run: () => analytics.reviewStats() },
    { def: { name: 'catalog_stats', description: 'Produits par catégorie et stocks faibles.', input_schema: { type: 'object', properties: {} } }, run: () => analytics.catalogStats() },
    { def: { name: 'finance_report', description: 'Rapport financier complet : CA, commissions 8%, croissance, top produits/vendeurs.', input_schema: { type: 'object', properties: { days: { type: 'number' } } } }, run: (i) => analytics.financeReport(i) },
    { def: { name: 'security_overview', description: 'Vue sécurité : fraude, faux avis, faux comptes, comportements suspects (vert/orange/rouge).', input_schema: { type: 'object', properties: {} } }, run: () => fraud.overview() },
    { def: { name: 'sales_forecast', description: 'Prévision de ventes, croissance et tendance (régression sur les revenus quotidiens) + catégories en tendance.', input_schema: { type: 'object', properties: { days: { type: 'number' }, horizon: { type: 'number' } } } }, run: (i) => ({ forecast: forecast.salesForecast(i), trendingCategories: forecast.trendingCategories() }) },
    { def: { name: 'trends_overview', description: 'AI Tendances : produits/catégories/recherches populaires, tendances locales et saisonnières, + recommandations de mise en avant.', input_schema: { type: 'object', properties: {} } }, run: (i, ctx) => trendsAgent.run(i, ctx) },
    { def: { name: 'moderation_flags', description: 'AI Modération : file des signalements automatiques (contenu interdit, contrefaçons, spam, offensant) à traiter.', input_schema: { type: 'object', properties: {} } }, run: () => ({ flags: store.find('moderationFlags', (fl) => fl.status === 'ouvert') }) },
  ];
}

function finalize(text) {
  const keys = require('./registry').parseDirective(text, 'CHART');
  const key = keys.find((k) => analytics.CHART_KEYS.includes(k));
  return key ? { chart: analytics.chartData(key) } : {};
}

function localFallback(ctx, messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const q = catalog.normalize(typeof last?.content === 'string' ? last.content : '');
  const f = catalog.formatFcfa;

  if (/produit|meilleur|marche|vend/.test(q)) {
    const top = analytics.topProducts({ days: 30 });
    return { text: 'Top produits (30 jours) :\n' + top.map((t, i) => `${i + 1}. ${t.name} — ${t.qty} vendus — ${f(t.revenue)}`).join('\n'), chart: analytics.chartData('top-products') };
  }
  if (/vendeur|progress/.test(q)) {
    const s = analytics.sellerPerformance({ days: 30 });
    return { text: 'Vendeurs (30 jours) :\n' + s.map((x, i) => `${i + 1}. ${x.shop} — ${x.unitsSold} unités — ${f(x.revenue)}`).join('\n'), chart: analytics.chartData('sellers') };
  }
  if (/securite|fraude|suspect|faux/.test(q)) {
    const o = fraud.overview();
    return { text: `Sécurité : ${o.summary.vert} vert, ${o.summary.orange} orange, ${o.summary.rouge} rouge.\n` + o.alerts.map((a) => `⚠ ${a.label} — ${a.reason}`).join('\n') };
  }
  if (/prevision|prevoir|croissance|tendance|diminu|baisse/.test(q)) {
    const fc = forecast.salesForecast({ days: 30 });
    return { text: `Prévision : tendance ${fc.trend}, croissance projetée ${fc.projectedGrowthPct === null ? 'n/a' : fc.projectedGrowthPct + '%'} sur ${fc.horizonDays} jours (CA projeté ${f(fc.projectedRevenueFcfa)}).`, chart: analytics.chartData('forecast') };
  }
  const s = analytics.salesSummary({ days: 30 });
  return { text: `Vue d'ensemble (30 jours) : ${s.orderCount} commandes, CA ${f(s.revenueFcfa)}, commissions ${f(s.commissionFcfa)}, croissance ${s.growthPct === null ? 'n/a' : s.growthPct + '%'}.`, chart: analytics.chartData('sales-14d') };
}

module.exports = {
  id: 'operator',
  name: 'E-Market Operator AI',
  description: 'Pilotage global de la marketplace.',
  style: 'analyste business, chiffré et stratégique',
  avatar: '🛡️',
  accent: '#8b5cf6',
  allowedRoles: ['admin'],
  memoryNamespace: 'operator',
  greeting: "Bonjour 👋 Je suis Operator AI. J'analyse toute la plateforme (ventes, vendeurs, sécurité, finance, prévisions, tendances, modération). Posez votre question métier.",
  features: { charts: true },
  directives: ['CHART'],
  maxTokens: 4096,
  quickActions: [
    { label: '📉 Pourquoi les ventes baissent ?', prompt: 'Pourquoi les ventes diminuent ? Analyse la tendance.' },
    { label: '📈 Vendeurs qui progressent', prompt: 'Quels vendeurs progressent ?' },
    { label: '🔥 Tendances', prompt: 'Quelles sont les tendances actuelles et que faut-il promouvoir ?' },
    { label: '🛡️ File de modération', prompt: 'Y a-t-il des contenus signalés à modérer ?' },
  ],
  suggestions: [
    'Fais-moi une prévision des ventes pour la semaine prochaine',
    'Y a-t-il des comportements suspects à surveiller ?',
    'Quelle catégorie est en tendance ?',
  ],
  systemPrompt: SYSTEM_PROMPT,
  buildTools,
  finalize,
  localFallback,
};
