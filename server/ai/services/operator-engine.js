/**
 * AI OPERATOR ENGINE 2.0 — centre de pilotage de la marketplace.
 *
 * Tableau de bord exécutif, indice de santé, alertes intelligentes classées,
 * centre de missions, analyses vendeur/client, simulateur, prédictions et
 * command center. L'IA OBSERVE, ANALYSE et PROPOSE ; toute action à impact
 * (campagnes, prix, commissions, messages) est soumise à validation humaine.
 */
const { store } = require('../../db/store');
const analytics = require('./analytics');
const forecast = require('./forecast');
const brain = require('./brain');
const fraud = require('./fraud');

const fcfa = (n) => Number(n || 0);

/* ------------------------- Executive dashboard ------------------------- */
function dashboard() {
  const day = analytics.salesSummary({ days: 1 });
  const week = analytics.salesSummary({ days: 7 });
  const month = analytics.salesSummary({ days: 30 });
  const year = analytics.salesSummary({ days: 365 });
  const users = analytics.userStats();
  const catalog = analytics.catalogStats();
  const conv = brain.globalConversion({ days: 30 });
  const byStatus = month.byStatus || {};
  const recentUsers = (role) => store.find('users', (u) => u.role === role && u.createdAt && Date.now() - new Date(u.createdAt).getTime() < 7 * 86400000).length;

  return {
    revenue: { dayFcfa: fcfa(day.revenueFcfa), weekFcfa: fcfa(week.revenueFcfa), monthFcfa: fcfa(month.revenueFcfa), yearFcfa: fcfa(year.revenueFcfa) },
    commissionsMonthFcfa: fcfa(month.commissionFcfa),
    orders: { total: month.orderCount, enAttente: (byStatus['en-cours'] || 0) + (byStatus['verification-securite'] || 0), terminees: byStatus.livree || byStatus['livrée'] || 0, annulees: byStatus.annulee || byStatus['annulée'] || 0 },
    averageOrderFcfa: fcfa(month.averageOrderFcfa),
    conversionPct: conv.ratePct,
    customers: { total: users.clients, nouveaux7j: recentUsers('client') },
    sellers: { total: users.sellers, nouveaux7j: recentUsers('seller'), actifs: analytics.sellerPerformance({ days: 30 }).length },
    catalog: { produits: catalog.total, stockFaible: catalog.lowStock.length },
    growthPct: month.growthPct,
    generatedAt: new Date().toISOString(),
  };
}

/* ------------------------- Indice de santé marketplace ------------------------- */
function health() {
  const snap = brain.snapshot({ days: 30 });
  const base = brain.healthScore(snap);
  const catalog = analytics.catalogStats();
  const products = store.find('products', (p) => p.active !== false);
  const withDesc = products.filter((p) => (p.description || '').length > 30).length;
  const listingQuality = products.length ? Math.round((withDesc / products.length) * 100) : 100;
  const reviews = analytics.reviewStats();
  const satisfaction = reviews.averageRating ? Math.round((reviews.averageRating / 5) * 100) : null;

  const dimensions = {
    qualiteMarketplace: base.score,
    satisfactionClients: satisfaction,
    qualiteFiches: listingQuality,
    livraison: 88, // repère (24-72h) — à brancher sur le suivi réel
    support: 85,
    disponibilite: Math.min(100, 90 + Math.round(process.uptime() / 3600)),
  };
  const vals = Object.values(dimensions).filter((v) => v !== null);
  const global = Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  return { globalScore: global, level: global >= 80 ? 'excellent' : global >= 60 ? 'bon' : 'à surveiller', dimensions, opportunities: brain.opportunities(snap) };
}

/* ------------------------- Smart alerts (classées) ------------------------- */
function smartAlerts() {
  const alerts = [];
  const push = (level, type, message) => alerts.push({ level, type, message });
  const month = analytics.salesSummary({ days: 30 });
  const sec = fraud.overview();
  const catalog = analytics.catalogStats();
  const flags = store.find('moderationFlags', () => true).length;
  const byStatus = month.byStatus || {};

  if (month.growthPct !== null && month.growthPct <= -20) push('critique', 'ventes', `Chute des ventes de ${month.growthPct}% vs période précédente.`);
  else if (month.growthPct !== null && month.growthPct < 0) push('moyen', 'ventes', `Ventes en repli (${month.growthPct}%).`);
  const cancelled = byStatus.annulee || byStatus['annulée'] || 0;
  if (cancelled >= 5) push('eleve', 'remboursements', `${cancelled} commandes annulées ce mois.`);
  if (sec.summary.rouge > 0) push('critique', 'fraude', `${sec.summary.rouge} entité(s) à risque élevé.`);
  if (sec.summary.orange > 0) push('moyen', 'fraude', `${sec.summary.orange} entité(s) à vérifier.`);
  if (flags > 0) push('eleve', 'moderation', `${flags} contenu(s) signalé(s) à traiter.`);
  if (catalog.lowStock.length > 0) push('moyen', 'stock', `${catalog.lowStock.length} produit(s) en stock faible.`);
  const blocked = byStatus['verification-securite'] || 0;
  if (blocked > 0) push('eleve', 'commandes', `${blocked} commande(s) bloquée(s) en vérification.`);

  const order = { critique: 0, eleve: 1, moyen: 2, faible: 3 };
  alerts.sort((a, b) => order[a.level] - order[b.level]);
  const summary = { critique: 0, eleve: 0, moyen: 0, faible: 0 };
  for (const a of alerts) summary[a.level] += 1;
  return { summary, alerts };
}

/* ------------------------- Mission center ------------------------- */
function missions() {
  const list = [];
  const add = (title, priority, impact, eta) => list.push({ id: `m-${list.length + 1}`, title, priority, estimatedImpact: impact, estimatedTimeMin: eta, status: 'à faire', owner: 'opérateur' });

  const sellers = store.find('users', (u) => u.role === 'seller');
  const active = new Set(analytics.sellerPerformance({ days: 30 }).map((s) => s.sellerId));
  const inactive = sellers.filter((s) => !active.has(s.id));
  if (inactive.length) add(`Accompagner ${inactive.length} vendeur(s) inactif(s)`, 'moyenne', 'rétention vendeurs', 30);

  const blocked = store.find('orders', (o) => o.status === 'verification-securite');
  if (blocked.length) add(`Débloquer ${blocked.length} commande(s) en vérification`, 'haute', 'CA + satisfaction', 20);

  const lowStock = analytics.catalogStats().lowStock;
  if (lowStock.length) add(`Relancer le réappro sur ${lowStock.length} produit(s)`, 'moyenne', 'éviter les ruptures', 25);

  const flags = store.find('moderationFlags', () => true);
  if (flags.length) add(`Modérer ${flags.length} contenu(s) signalé(s)`, 'haute', 'conformité', 15);

  const newSellers = sellers.filter((s) => s.createdAt && Date.now() - new Date(s.createdAt).getTime() < 7 * 86400000);
  if (newSellers.length) add(`Vérifier ${newSellers.length} nouveau(x) vendeur(s)`, 'moyenne', 'qualité', 20);

  if (!list.length) add('Revue qualité hebdomadaire du catalogue', 'basse', 'qualité globale', 40);
  return { missions: list, policy: 'Missions préparées par l\'IA ; exécution validée par un opérateur.' };
}

/* ------------------------- Analyse vendeur ------------------------- */
function sellerAnalysis({ sellerId } = {}) {
  const seller = store.getById('users', sellerId);
  if (!seller) throw Object.assign(new Error('Vendeur introuvable.'), { status: 404 });
  const stats = analytics.sellerSalesStats(sellerId, { days: 30 });
  const perf = analytics.sellerProductPerformance(sellerId, { days: 30 });
  const products = store.find('products', (p) => p.sellerId === sellerId && p.active !== false);
  const withPhotos = products.filter((p) => p.emoji || p.image).length;
  const withDesc = products.filter((p) => (p.description || '').length > 30).length;

  const suggestions = [];
  if (products.length && withDesc / products.length < 0.7) suggestions.push('Optimisez les fiches produit (descriptions incomplètes).');
  if (stats.conversion.ratePct !== null && stats.conversion.ratePct < 1.5) suggestions.push('Refaites votre Hero et ajoutez des avis pour améliorer la conversion.');
  suggestions.push('Ajoutez une vidéo produit (AI Video Pro).');
  if (perf.weak.length) suggestions.push(`Ajoutez plus de photos aux ${perf.weak.length} produit(s) peu vus.`);

  return {
    sellerId, shop: seller.shop || seller.name,
    quality: { fiches: products.length ? Math.round((withDesc / products.length) * 100) : 100, photos: products.length ? Math.round((withPhotos / products.length) * 100) : 100 },
    conversion: stats.conversion, revenueFcfa: stats.revenueFcfa, growthPct: stats.growthPct,
    best: perf.best.slice(0, 3), weak: perf.weak.slice(0, 3),
    suggestions,
  };
}

/* ------------------------- Analyse client ------------------------- */
function customerAnalysis() {
  const clients = store.find('users', (u) => u.role === 'client');
  const scored = clients.map((c) => {
    const orders = store.find('orders', (o) => o.userId === c.id);
    const spent = orders.reduce((s, o) => s + o.total, 0);
    const last = orders.length ? Math.max(...orders.map((o) => new Date(o.createdAt).getTime())) : 0;
    const daysSince = last ? Math.round((Date.now() - last) / 86400000) : null;
    return { id: c.id, name: c.name, orders: orders.length, spent, daysSince };
  });
  const bySpent = [...scored].sort((a, b) => b.spent - a.spent);
  return {
    vip: bySpent.filter((c) => c.spent >= 100000).slice(0, 5),
    fideles: scored.filter((c) => c.orders >= 3),
    inactifs: scored.filter((c) => c.daysSince !== null && c.daysSince > 60),
    aRisque: scored.filter((c) => c.orders >= 2 && c.daysSince !== null && c.daysSince > 45),
    fraudeSuspecte: fraud.overview().results.filter((r) => r.role === 'client' && r.level === 'rouge').map((r) => ({ id: r.id, name: r.name, signals: r.signals })),
    recommendations: ['Remercier les VIP (message + avantage).', 'Relancer les inactifs avec une offre ciblée.'],
  };
}

/* ------------------------- Simulateur ------------------------- */
function simulate({ type, value } = {}) {
  const month = analytics.salesSummary({ days: 30 });
  const rev = month.revenueFcfa;
  if (type === 'commission') {
    const newRate = Number(value) / 100;
    const currentComm = month.commissionFcfa;
    const newComm = Math.round(rev * newRate);
    return { type, from: '8%', to: `${value}%`, estimatedImpact: { commissionFcfa: newComm, deltaFcfa: newComm - currentComm, risque: newRate > 0.1 ? 'Départ possible de vendeurs si trop élevé' : 'faible' }, note: 'Estimation à volume constant ; l\'élasticité vendeurs n\'est pas modélisée.' };
  }
  if (type === 'promotion') {
    const uplift = Math.min(0.4, Math.max(0.05, Number(value || 15) / 100));
    return { type, discountPct: Number(value || 15), estimatedImpact: { ventesDeltaPct: Math.round(uplift * 100), revenueDeltaFcfa: Math.round(rev * uplift * 0.6), margeImpact: 'réduite pendant la promo' }, note: 'Estimation heuristique d\'uplift ; à confirmer par A/B test.' };
  }
  if (type === 'category-removal') {
    const map = {};
    for (const o of store.all('orders')) for (const i of o.items) { const p = store.getById('products', i.productId); if (p) map[p.category] = (map[p.category] || 0) + i.qty * i.price; }
    return { type, category: value, estimatedImpact: { revenueLostFcfa: map[value] || 0 }, note: 'CA historiquement porté par cette catégorie.' };
  }
  throw Object.assign(new Error('Simulation inconnue (commission|promotion|category-removal).'), { status: 400 });
}

/* ------------------------- Prédictions ------------------------- */
function predict({ horizon } = {}) {
  const h = [7, 30, 90, 365].includes(Number(horizon)) ? Number(horizon) : 30;
  const fc = forecast.salesForecast({ days: 30, horizon: Math.min(h, 90) });
  const factor = h / Math.min(h, 90);
  return {
    horizonDays: h, trend: fc.trend,
    projectedRevenueFcfa: Math.round(fc.projectedRevenueFcfa * factor),
    projectedGrowthPct: fc.projectedGrowthPct,
    trendingCategories: forecast.trendingCategories({ days: 14 }).slice(0, 3),
    note: h > 90 ? 'Projection long terme extrapolée ; incertitude élevée.' : 'Projection par régression sur les revenus réels.',
  };
}

/* ------------------------- Command center (briefing) ------------------------- */
function commandCenter({ name } = {}) {
  const d = dashboard();
  const al = smartAlerts();
  const ms = missions();
  const hl = health();
  return {
    greeting: `Bonjour${name ? ' ' + name : ''}. Voici la situation actuelle de E-Market.`,
    keyStats: { caMoisFcfa: d.revenue.monthFcfa, commandes: d.orders.total, conversionPct: d.conversionPct, santeGlobale: hl.globalScore, croissancePct: d.growthPct },
    urgences: al.alerts.filter((a) => a.level === 'critique'),
    alertes: al.alerts.filter((a) => a.level === 'eleve'),
    priorites: ms.missions.filter((m) => m.priority === 'haute').slice(0, 3),
    opportunites: hl.opportunities.opportunities,
    actionsRecommandees: [
      ...ms.missions.slice(0, 3).map((m) => ({ action: m.title, impact: m.estimatedImpact, statut: 'à valider' })),
    ],
    policy: 'Toutes les actions à impact (campagnes, prix, commissions, messages) requièrent votre validation.',
  };
}

module.exports = { dashboard, health, smartAlerts, missions, sellerAnalysis, customerAnalysis, simulate, predict, commandCenter };
