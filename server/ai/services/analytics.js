/**
 * Socle analytique partagé — 9. IA ADMINISTRATEUR & 12. IA ANALYSE FINANCIÈRE.
 * Calculs exacts sur les données réelles (commandes, ventes, utilisateurs,
 * produits, avis, revenus). Le modèle IA raisonne SUR ces chiffres via les
 * outils — il ne les invente jamais.
 */
const { store } = require('../../db/store');

const COMMISSION_RATE = 0.08; // Commission E-Market : 8% par vente.

function salesSummary({ days = 30 } = {}) {
  const since = Date.now() - days * 86400000;
  const orders = store.find('orders', (o) => new Date(o.createdAt).getTime() >= since);
  const revenue = orders.reduce((s, o) => s + o.total, 0);
  const byStatus = {};
  for (const o of orders) byStatus[o.status] = (byStatus[o.status] || 0) + 1;

  // Croissance : comparaison avec la période précédente.
  const prevSince = since - days * 86400000;
  const prevOrders = store.find('orders', (o) => {
    const t = new Date(o.createdAt).getTime();
    return t >= prevSince && t < since;
  });
  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const growthPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;

  return {
    periodDays: days,
    orderCount: orders.length,
    revenueFcfa: revenue,
    commissionFcfa: Math.round(revenue * COMMISSION_RATE),
    averageOrderFcfa: orders.length ? Math.round(revenue / orders.length) : 0,
    byStatus,
    previousPeriod: { orderCount: prevOrders.length, revenueFcfa: prevRevenue },
    growthPct,
  };
}

function topProducts({ days = 30, limit = 5 } = {}) {
  const since = Date.now() - days * 86400000;
  const counts = {};
  for (const o of store.find('orders', (x) => new Date(x.createdAt).getTime() >= since)) {
    for (const i of o.items) {
      counts[i.productId] = counts[i.productId] || { qty: 0, revenue: 0 };
      counts[i.productId].qty += i.qty;
      counts[i.productId].revenue += i.qty * i.price;
    }
  }
  return Object.entries(counts)
    .map(([productId, v]) => {
      const p = store.getById('products', productId);
      return { productId, name: p ? p.name : productId, category: p ? p.category : null, ...v };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

function sellerPerformance({ days = 30 } = {}) {
  const since = Date.now() - days * 86400000;
  const sellers = {};
  for (const o of store.find('orders', (x) => new Date(x.createdAt).getTime() >= since)) {
    for (const i of o.items) {
      const p = store.getById('products', i.productId);
      if (!p) continue;
      const s = store.getById('users', p.sellerId);
      const key = p.sellerId;
      sellers[key] = sellers[key] || { sellerId: key, shop: s ? s.shop || s.name : key, revenue: 0, unitsSold: 0 };
      sellers[key].revenue += i.qty * i.price;
      sellers[key].unitsSold += i.qty;
    }
  }
  return Object.values(sellers).sort((a, b) => b.revenue - a.revenue);
}

function userStats() {
  const users = store.all('users');
  return {
    total: users.length,
    clients: users.filter((u) => u.role === 'client').length,
    sellers: users.filter((u) => u.role === 'seller').length,
    admins: users.filter((u) => u.role === 'admin').length,
  };
}

function reviewStats() {
  const reviews = store.all('reviews');
  const avg = reviews.length
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;
  const low = reviews.filter((r) => r.rating <= 2).map((r) => ({
    productId: r.productId, rating: r.rating, comment: r.comment,
  }));
  return { count: reviews.length, averageRating: avg, negativeReviews: low };
}

function catalogStats() {
  const products = store.find('products', (p) => p.active !== false);
  const byCategory = {};
  for (const p of products) byCategory[p.category] = (byCategory[p.category] || 0) + 1;
  const lowStock = products.filter((p) => p.stock <= 5).map((p) => ({ id: p.id, name: p.name, stock: p.stock }));
  return { total: products.length, byCategory, lowStock };
}

/** 12. Rapport financier complet (chiffre d'affaires, commissions, croissance, rentabilité). */
function financeReport({ days = 30 } = {}) {
  const sales = salesSummary({ days });
  const top = topProducts({ days, limit: 5 });
  const sellers = sellerPerformance({ days });
  const marginByCategory = {};
  for (const t of top) {
    if (!t.category) continue;
    marginByCategory[t.category] = (marginByCategory[t.category] || 0) + Math.round(t.revenue * COMMISSION_RATE);
  }
  return {
    generatedAt: new Date().toISOString(),
    periodDays: days,
    revenueFcfa: sales.revenueFcfa,
    commissionFcfa: sales.commissionFcfa,
    orderCount: sales.orderCount,
    averageOrderFcfa: sales.averageOrderFcfa,
    growthPct: sales.growthPct,
    topProducts: top,
    topSellers: sellers.slice(0, 5),
    commissionByCategory: marginByCategory,
  };
}

module.exports = {
  COMMISSION_RATE,
  salesSummary,
  topProducts,
  sellerPerformance,
  userStats,
  reviewStats,
  catalogStats,
  financeReport,
};
