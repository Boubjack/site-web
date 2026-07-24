/**
 * MARKETPLACE BRAIN — intelligence centrale d'E-Market.
 *
 * Agrège les signaux transverses (finance, commerce, catalogue, confiance,
 * croissance) en un instantané unique + un score de santé /100, des
 * opportunités et des risques. Les agents C-suite (CEO/CFO/CMO/COO/CTO) et
 * l'assistant Operator s'appuient dessus. Calculs déterministes sur données
 * réelles — aucun chiffre inventé.
 */
const { store } = require('../../db/store');
const analytics = require('./analytics');
const forecast = require('./forecast');
const fraud = require('./fraud');

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

/** Conversion globale vue → achat sur la période. */
function globalConversion({ days = 30 } = {}) {
  const since = Date.now() - days * 86400000;
  const views = store.find('events', (e) => e.type === 'view' && new Date(e.createdAt).getTime() >= since).length;
  const purchases = store.find('orders', (o) => new Date(o.createdAt).getTime() >= since)
    .reduce((s, o) => s + o.items.reduce((n, i) => n + i.qty, 0), 0);
  // Un taux de conversion est borné à 100 % (part des vues qui convertissent).
  const ratePct = views ? Math.min(100, Math.round((purchases / views) * 1000) / 10) : null;
  return { views, purchases, ratePct };
}

/** Instantané complet de la plateforme. */
function snapshot({ days = 30 } = {}) {
  const sales = analytics.salesSummary({ days });
  const fc = forecast.salesForecast({ days: 30, horizon: 7 });
  const catalog = analytics.catalogStats();
  const reviews = analytics.reviewStats();
  const users = analytics.userStats();
  const security = fraud.overview();
  const conversion = globalConversion({ days });
  const trending = forecast.trendingCategories({ days: 14 });

  const flags = store.find('moderationFlags', () => true).length;

  return {
    periodDays: days,
    finance: {
      revenueFcfa: sales.revenueFcfa,
      commissionFcfa: sales.commissionFcfa,
      orderCount: sales.orderCount,
      averageOrderFcfa: sales.averageOrderFcfa,
      growthPct: sales.growthPct,
    },
    growth: { trend: fc.trend, projectedGrowthPct: fc.projectedGrowthPct, projectedRevenueFcfa: fc.projectedRevenueFcfa, trendingCategories: trending.slice(0, 3) },
    commerce: { conversion, byStatus: sales.byStatus },
    catalog,
    customers: users,
    trust: { averageRating: reviews.averageRating, negativeReviews: reviews.negativeReviews.length, moderationFlags: flags, security: security.summary },
  };
}

/** Score de santé /100 pondéré + décomposition. */
function healthScore(snap = snapshot()) {
  const parts = {};

  // Finance (croissance) — 25 pts
  const g = snap.finance.growthPct;
  parts.finance = g === null ? 15 : clamp(15 + g * 0.5, 0, 25);

  // Croissance projetée — 20 pts
  parts.growth = snap.growth.trend === 'hausse' ? 20 : snap.growth.trend === 'stable' ? 12 : 5;

  // Conversion — 20 pts (2 % ≈ bon repère e-commerce)
  const r = snap.commerce.conversion.ratePct;
  parts.conversion = r === null ? 8 : clamp(r * 6, 0, 20);

  // Confiance (avis + fraude + modération) — 20 pts
  const rating = snap.trust.averageRating || 0;
  let trust = clamp((rating - 3) * 8, 0, 16); // 3★→0, 5★→16
  trust -= Math.min(8, (snap.trust.security.rouge || 0) * 3 + (snap.trust.moderationFlags || 0));
  parts.trust = clamp(trust + 4, 0, 20);

  // Santé catalogue (stock) — 15 pts
  const low = snap.catalog.lowStock.length;
  parts.catalog = clamp(15 - low * 1.5, 0, 15);

  const score = Math.round(Object.values(parts).reduce((s, v) => s + v, 0));
  return { score: clamp(score), parts };
}

/** Opportunités et risques actionnables déduits de l'instantané. */
function opportunities(snap = snapshot()) {
  const ops = [];
  const risks = [];

  const topTrend = snap.growth.trendingCategories[0];
  if (topTrend && topTrend.deltaShare > 0) ops.push(`Catégorie « ${topTrend.category} » en hausse (+${topTrend.deltaShare} pts) : augmenter l'offre et la mettre en avant.`);
  if (snap.commerce.conversion.ratePct !== null && snap.commerce.conversion.ratePct < 1.5) ops.push(`Conversion faible (${snap.commerce.conversion.ratePct} %) : activer recommandations personnalisées, Stories IA et vitrine vivante.`);
  if (snap.finance.growthPct !== null && snap.finance.growthPct > 0) ops.push(`Croissance de +${snap.finance.growthPct} % : réinvestir en acquisition et en visuels AI Photo/Video Pro.`);

  if (snap.catalog.lowStock.length) risks.push(`${snap.catalog.lowStock.length} produit(s) en stock faible : risque de rupture (AI Stock).`);
  if ((snap.trust.security.rouge || 0) > 0) risks.push(`${snap.trust.security.rouge} entité(s) à risque élevé signalée(s) par l'IA Sécurité.`);
  if (snap.trust.moderationFlags > 0) risks.push(`${snap.trust.moderationFlags} contenu(s) en attente de modération.`);
  if (snap.trust.negativeReviews > 0) risks.push(`${snap.trust.negativeReviews} avis négatif(s) à traiter (AI Avis).`);
  if (snap.growth.trend === 'baisse') risks.push('Tendance de revenu à la baisse : prioriser rétention et promotions ciblées.');

  return { opportunities: ops, risks };
}

module.exports = { snapshot, healthScore, opportunities, globalConversion };
