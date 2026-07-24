/**
 * 11. IA SÉCURITÉ — détection de fraude et de comportements suspects.
 * Analyse faux comptes, faux avis, comportements anormaux, commandes
 * inhabituelles, vendeurs suspects. Chaque entité reçoit un niveau :
 *   vert (normal) | orange (vérification) | rouge (risque élevé).
 *
 * Moteur : règles déterministes explicables (chaque signal est motivé),
 * conçues pour être enrichies par un scoring modèle si besoin.
 */
const { store } = require('../../db/store');

function levelFor(score) {
  if (score >= 60) return 'rouge';
  if (score >= 30) return 'orange';
  return 'vert';
}

function scoreUser(user) {
  const signals = [];
  let score = 0;

  const orders = store.find('orders', (o) => o.userId === user.id);
  const reviews = store.find('reviews', (r) => r.userId === user.id);
  const events = store.find('events', (e) => e.userId === user.id);

  // Faux compte probable : aucune activité + email jetable.
  if (/@(tempmail|yopmail|mailinator)/i.test(user.email || '')) {
    score += 40; signals.push('Email jetable détecté');
  }
  if (user.role === 'client' && !orders.length && !events.length) {
    const ageDays = (Date.now() - new Date(user.createdAt || Date.now()).getTime()) / 86400000;
    if (ageDays > 30) { score += 15; signals.push('Compte ancien sans aucune activité'); }
  }

  // Faux avis : avis sans achat correspondant.
  const purchasedIds = new Set(orders.flatMap((o) => o.items.map((i) => i.productId)));
  const unverifiedReviews = reviews.filter((r) => !purchasedIds.has(r.productId));
  if (unverifiedReviews.length >= 3) {
    score += 35; signals.push(`${unverifiedReviews.length} avis sans achat vérifié`);
  } else if (unverifiedReviews.length > 0) {
    score += 10; signals.push(`${unverifiedReviews.length} avis sans achat vérifié`);
  }

  // Rafale d'avis extrêmes le même jour.
  const byDay = {};
  for (const r of reviews) {
    const day = String(r.createdAt || '').slice(0, 10);
    byDay[day] = (byDay[day] || 0) + 1;
  }
  if (Object.values(byDay).some((n) => n >= 5)) {
    score += 30; signals.push('Rafale d\'avis publiés le même jour');
  }

  // Commandes inhabituelles : montant très supérieur à l'habitude.
  if (orders.length >= 2) {
    const totals = orders.map((o) => o.total).sort((a, b) => a - b);
    const median = totals[Math.floor(totals.length / 2)];
    const max = totals[totals.length - 1];
    if (median > 0 && max > median * 6) {
      score += 25; signals.push(`Commande inhabituelle : ${max} FCFA vs médiane ${median} FCFA`);
    }
  }

  // Commandes annulées en série.
  const cancelled = orders.filter((o) => o.status === 'annulee').length;
  if (cancelled >= 3) { score += 30; signals.push(`${cancelled} commandes annulées`); }

  return { id: user.id, name: user.name, role: user.role, score, level: levelFor(score), signals };
}

function scoreSeller(seller) {
  const base = scoreUser(seller);
  const products = store.find('products', (p) => p.sellerId === seller.id);
  const productIds = new Set(products.map((p) => p.id));
  const reviews = store.find('reviews', (r) => productIds.has(r.productId));

  // Vendeur suspect : prix aberrants vs produits comparables (même sous-catégorie).
  for (const p of products) {
    const sameSub = store.find('products', (x) => x.subcategory === p.subcategory && x.id !== p.id);
    if (sameSub.length >= 2) {
      const avg = sameSub.reduce((s, x) => s + x.price, 0) / sameSub.length;
      if (p.price < avg * 0.2) {
        base.score += 25;
        base.signals.push(`Prix anormalement bas : "${p.name}" à ${p.price} FCFA (moyenne des comparables ~${Math.round(avg)} FCFA)`);
      }
    }
  }

  // Auto-avis (avis du vendeur sur ses propres produits).
  const selfReviews = reviews.filter((r) => r.userId === seller.id);
  if (selfReviews.length) {
    base.score += 40;
    base.signals.push(`${selfReviews.length} avis publiés sur ses propres produits`);
  }

  base.level = levelFor(base.score);
  return base;
}

/** Vue d'ensemble pour le tableau de bord admin. */
function overview() {
  const users = store.all('users').filter((u) => u.role !== 'admin');
  const results = users.map((u) => (u.role === 'seller' ? scoreSeller(u) : scoreUser(u)));
  const summary = { vert: 0, orange: 0, rouge: 0 };
  for (const r of results) summary[r.level] += 1;
  const alerts = results
    .filter((r) => r.level !== 'vert')
    .map((r) => ({ label: `${r.name} (${r.role})`, level: r.level, reason: r.signals.join(' ; ') }));
  return { summary, results, alerts };
}

/** Contrôle temps réel d'une commande avant validation. */
function checkOrder({ userId, total }) {
  const signals = [];
  let score = 0;
  const orders = store.find('orders', (o) => o.userId === userId);
  const recent = orders.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 3600000);
  if (recent.length >= 3) { score += 35; signals.push('Plus de 3 commandes dans la dernière heure'); }
  if (orders.length) {
    const avg = orders.reduce((s, o) => s + o.total, 0) / orders.length;
    if (total > avg * 8) { score += 30; signals.push('Montant très supérieur aux habitudes du compte'); }
  } else if (total > 300000) {
    score += 20; signals.push('Première commande à montant élevé');
  }
  return { score, level: levelFor(score), signals };
}

module.exports = { overview, scoreUser, scoreSeller, checkOrder };
