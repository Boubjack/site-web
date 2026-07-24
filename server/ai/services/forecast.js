/**
 * Prévisions (assistant Operator) : projection de ventes, croissance,
 * tendance. Régression linéaire simple sur les revenus quotidiens réels.
 */
const analytics = require('./analytics');
const { store } = require('../../db/store');

function linreg(points) {
  const n = points.length;
  if (!n) return { slope: 0, intercept: 0 };
  const sx = points.reduce((s, p) => s + p.x, 0);
  const sy = points.reduce((s, p) => s + p.y, 0);
  const sxx = points.reduce((s, p) => s + p.x * p.x, 0);
  const sxy = points.reduce((s, p) => s + p.x * p.y, 0);
  const d = n * sxx - sx * sx;
  if (d === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / d;
  return { slope, intercept: (sy - slope * sx) / n };
}

function salesForecast({ days = 30, horizon = 7 } = {}) {
  const hist = analytics.dailyRevenue({ days });
  const pts = hist.map((h, i) => ({ x: i, y: h.revenue }));
  const { slope, intercept } = linreg(pts);
  const lastX = pts.length - 1;

  const projection = [];
  for (let i = 1; i <= horizon; i += 1) {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() + i);
    projection.push({
      date: date.toISOString().slice(0, 10),
      revenue: Math.max(0, Math.round(slope * (lastX + i) + intercept)),
    });
  }

  const histAvg = pts.reduce((s, p) => s + p.y, 0) / (pts.length || 1);
  const projAvg = projection.reduce((s, p) => s + p.revenue, 0) / (projection.length || 1);
  const trend = slope > histAvg * 0.02 ? 'hausse' : slope < -histAvg * 0.02 ? 'baisse' : 'stable';

  return {
    horizonDays: horizon,
    trend,
    dailySlopeFcfa: Math.round(slope),
    projectedGrowthPct: histAvg > 0 ? Math.round(((projAvg - histAvg) / histAvg) * 1000) / 10 : null,
    projectedRevenueFcfa: projection.reduce((s, p) => s + p.revenue, 0),
    projection,
  };
}

/** Catégories en tendance : évolution de part de marché sur deux périodes. */
function trendingCategories({ days = 14 } = {}) {
  const now = Date.now();
  const share = (fromTs, toTs) => {
    const map = {}; let total = 0;
    for (const o of store.find('orders', (x) => {
      const t = new Date(x.createdAt).getTime(); return t >= fromTs && t < toTs;
    })) {
      for (const i of o.items) {
        const p = store.getById('products', i.productId);
        if (!p) continue;
        map[p.category] = (map[p.category] || 0) + i.qty * i.price;
        total += i.qty * i.price;
      }
    }
    for (const k of Object.keys(map)) map[k] = total ? map[k] / total : 0;
    return map;
  };
  const recent = share(now - days * 86400000, now);
  const prev = share(now - 2 * days * 86400000, now - days * 86400000);
  const cats = new Set([...Object.keys(recent), ...Object.keys(prev)]);
  return [...cats]
    .map((c) => ({ category: c, deltaShare: Math.round(((recent[c] || 0) - (prev[c] || 0)) * 1000) / 10 }))
    .sort((a, b) => b.deltaShare - a.deltaShare);
}

module.exports = { salesForecast, trendingCategories };
