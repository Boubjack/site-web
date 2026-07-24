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

/* ------------------------------------------------------------------ */
/* Séries temporelles + données de graphiques (assistant Operator)     */
/* ------------------------------------------------------------------ */

function dailyRevenue({ days = 14 } = {}) {
  const out = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() - i);
    const end = new Date(start); end.setDate(end.getDate() + 1);
    const orders = store.find('orders', (o) => {
      const t = new Date(o.createdAt).getTime();
      return t >= start.getTime() && t < end.getTime();
    });
    out.push({
      date: start.toISOString().slice(0, 10),
      revenue: orders.reduce((s, o) => s + o.total, 0),
      orders: orders.length,
    });
  }
  return out;
}

/** Données prêtes à tracer, par clé (le graphique est rendu côté client). */
function chartData(key) {
  switch (key) {
    case 'sales-14d': {
      const d = dailyRevenue({ days: 14 });
      return { title: "Chiffre d'affaires — 14 jours", unit: 'FCFA', bars: d.map((x) => ({ label: x.date.slice(5), value: x.revenue })) };
    }
    case 'top-products': {
      const t = topProducts({ days: 30, limit: 6 });
      return { title: 'Top produits — 30 jours', unit: 'FCFA', bars: t.map((x) => ({ label: x.name, value: x.revenue })) };
    }
    case 'sellers': {
      const s = sellerPerformance({ days: 30 });
      return { title: 'Revenu par vendeur — 30 jours', unit: 'FCFA', bars: s.map((x) => ({ label: x.shop, value: x.revenue })) };
    }
    case 'categories': {
      const map = {};
      for (const o of store.all('orders')) {
        for (const i of o.items) {
          const p = store.getById('products', i.productId);
          if (p) map[p.category] = (map[p.category] || 0) + i.qty * i.price;
        }
      }
      return { title: 'Revenu par catégorie', unit: 'FCFA', bars: Object.entries(map).map(([k, v]) => ({ label: k, value: v })).sort((a, b) => b.value - a.value) };
    }
    case 'forecast': {
      const f = require('./forecast').salesForecast({ days: 30, horizon: 7 });
      return { title: 'Prévision — 7 prochains jours', unit: 'FCFA', bars: f.projection.map((x) => ({ label: x.date.slice(5), value: x.revenue })) };
    }
    default:
      return null;
  }
}

const CHART_KEYS = ['sales-14d', 'top-products', 'sellers', 'categories', 'forecast'];

/* ------------------------------------------------------------------ */
/* Analytics limitées à un vendeur (assistant Seller)                  */
/* Toutes ces fonctions ne considèrent que les produits du sellerId.   */
/* ------------------------------------------------------------------ */

function sellerItems(sellerId, sinceTs) {
  const res = [];
  for (const o of store.all('orders')) {
    if (sinceTs && new Date(o.createdAt).getTime() < sinceTs) continue;
    for (const item of o.items) {
      const p = store.getById('products', item.productId);
      if (p && p.sellerId === sellerId) res.push({ order: o, item, product: p });
    }
  }
  return res;
}

function conversionForSeller(sellerId, sinceTs) {
  const ids = new Set(store.find('products', (p) => p.sellerId === sellerId).map((p) => p.id));
  const views = store.find('events', (e) => e.type === 'view' && ids.has(e.productId)
    && (!sinceTs || new Date(e.createdAt).getTime() >= sinceTs)).length;
  const purchases = sellerItems(sellerId, sinceTs).reduce((s, x) => s + x.item.qty, 0);
  return { views, purchases, ratePct: views > 0 ? Math.round((purchases / views) * 1000) / 10 : null };
}

function sellerSalesStats(sellerId, { days = 30 } = {}) {
  const since = Date.now() - days * 86400000;
  const items = sellerItems(sellerId, since);
  const revenue = items.reduce((s, x) => s + x.item.qty * x.item.price, 0);
  const units = items.reduce((s, x) => s + x.item.qty, 0);
  const orderIds = new Set(items.map((x) => x.order.id));

  const prevSince = since - days * 86400000;
  const prevItems = sellerItems(sellerId, prevSince).filter((x) => new Date(x.order.createdAt).getTime() < since);
  const prevRevenue = prevItems.reduce((s, x) => s + x.item.qty * x.item.price, 0);
  const growthPct = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 1000) / 10 : null;

  const byProduct = {};
  for (const x of items) {
    byProduct[x.product.id] = byProduct[x.product.id] || { id: x.product.id, name: x.product.name, qty: 0, revenue: 0 };
    byProduct[x.product.id].qty += x.item.qty;
    byProduct[x.product.id].revenue += x.item.qty * x.item.price;
  }
  const top = Object.values(byProduct).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  return {
    periodDays: days,
    revenueFcfa: revenue,
    unitsSold: units,
    orderCount: orderIds.size,
    averageOrderFcfa: orderIds.size ? Math.round(revenue / orderIds.size) : 0,
    commissionPaidFcfa: Math.round(revenue * COMMISSION_RATE),
    netRevenueFcfa: Math.round(revenue * (1 - COMMISSION_RATE)),
    growthPct,
    topProducts: top,
    conversion: conversionForSeller(sellerId, since),
  };
}

function sellerProductPerformance(sellerId, { days = 30 } = {}) {
  const since = Date.now() - days * 86400000;
  const products = store.find('products', (p) => p.sellerId === sellerId && p.active !== false);
  const sold = {};
  for (const x of sellerItems(sellerId, since)) sold[x.product.id] = (sold[x.product.id] || 0) + x.item.qty;
  const stats = products.map((p) => {
    const views = store.find('events', (e) => e.type === 'view' && e.productId === p.id
      && new Date(e.createdAt).getTime() >= since).length;
    const units = sold[p.id] || 0;
    return { id: p.id, name: p.name, unitsSold: units, views, revenue: units * p.price, stock: p.stock };
  });
  return {
    best: [...stats].sort((a, b) => b.revenue - a.revenue).slice(0, 5),
    weak: [...stats].filter((x) => x.unitsSold === 0).sort((a, b) => b.views - a.views).slice(0, 5),
  };
}

module.exports = {
  COMMISSION_RATE,
  CHART_KEYS,
  salesSummary,
  topProducts,
  sellerPerformance,
  userStats,
  reviewStats,
  catalogStats,
  financeReport,
  dailyRevenue,
  chartData,
  sellerSalesStats,
  sellerProductPerformance,
  conversionForSeller,
};
