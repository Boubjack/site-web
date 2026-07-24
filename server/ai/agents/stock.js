/**
 * AGENT — AI Stock. Prévoit les ruptures de stock en analysant la vitesse des
 * ventes, l'historique et un facteur saisonnier. Prévient automatiquement le
 * vendeur. Permissions : vendeur (ses produits) / admin (tout). Le sellerId
 * est fixé par l'appelant pour garantir l'isolation.
 */
const { store } = require('../../db/store');

// Facteur saisonnier simplifié (mois → catégories en tension).
const SEASON = {
  ceremonie: [3, 4, 5, 6, 11], // saison des mariages / fêtes
};

function velocity(productId, days = 30) {
  const since = Date.now() - days * 86400000;
  let units = 0;
  for (const o of store.find('orders', (x) => new Date(x.createdAt).getTime() >= since)) {
    for (const i of o.items) if (i.productId === productId) units += i.qty;
  }
  return units / days; // unités / jour
}

function analyze({ sellerId }) {
  const products = store.find('products', (p) => p.active !== false && (!sellerId || p.sellerId === sellerId));
  const alerts = products.map((p) => {
    const v = velocity(p.id);
    const daysOfCover = v > 0 ? Math.round(p.stock / v) : null;
    const seasonal = (p.occasion || []).some((o) => (SEASON.ceremonie || []).includes(new Date().getMonth() + 1) && /ceremonie|mariage|tabaski/.test(o));
    let level = 'ok';
    if (daysOfCover !== null && daysOfCover <= 3) level = 'critique';
    else if (daysOfCover !== null && daysOfCover <= 7) level = 'bientot';
    else if (p.stock <= 3) level = 'bientot';
    if (seasonal && daysOfCover !== null && daysOfCover <= 14) level = level === 'ok' ? 'surveiller' : level;
    return {
      id: p.id, name: p.name, stock: p.stock,
      dailyVelocity: Math.round(v * 100) / 100,
      daysOfCover, seasonal, level,
      recommendation: level === 'critique' ? 'Réapprovisionner immédiatement'
        : level === 'bientot' ? 'Prévoir un réapprovisionnement'
          : level === 'surveiller' ? 'Surveiller (demande saisonnière)' : 'OK',
    };
  });
  const order = { critique: 0, bientot: 1, surveiller: 2, ok: 3 };
  return {
    alerts: alerts.filter((a) => a.level !== 'ok').sort((a, b) => order[a.level] - order[b.level]),
    okCount: alerts.filter((a) => a.level === 'ok').length,
    total: alerts.length,
  };
}

async function run(input) {
  return analyze({ sellerId: input.sellerId });
}

module.exports = {
  id: 'stock',
  name: 'AI Stock',
  description: 'Prévoit les ruptures de stock (vitesse des ventes, historique, saison) et alerte le vendeur.',
  allowedRoles: ['seller', 'admin'],
  keywords: ['stock', 'rupture', 'réappro', 'reappro', 'inventaire', 'quantité', 'épuisé'],
  tool: {
    name: 'stock_alerts',
    description: 'Alertes de rupture de stock pour la boutique du vendeur (vitesse de vente, jours de couverture, saison).',
    input_schema: { type: 'object', properties: {} },
  },
  run,
  analyze,
};
