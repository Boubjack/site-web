require('./setup'); // EN PREMIER : isole les données + seed.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./setup');
const core = require('../server/ai/core');

const ADMIN = { user: { role: 'admin', id: 'u-admin' } };
const CLIENT = { user: { role: 'client', id: 'u-cli-1' } };

/* ------------------------- AI Client Engine ------------------------- */
test('client.compare : désigne le meilleur rapport qualité/prix', async () => {
  const r = await core.run('client', 'compare', { productIds: ['p-020', 'p-021'] }, CLIENT);
  assert.equal(r.items.length, 2);
  assert.ok(r.bestValue);
});

test('client.compare : moins de 2 produits → 400', async () => {
  await assert.rejects(() => core.run('client', 'compare', { productIds: ['p-020'] }, CLIENT), (e) => e.status === 400);
});

test('client.budget : panier sous le budget', async () => {
  const r = await core.run('client', 'budget', { budget: 60000 }, CLIENT);
  assert.ok(r.total <= 60000);
  assert.ok(r.basket.length >= 1);
});

test('client.sizeGuide : recommande une taille disponible', async () => {
  const r = await core.run('client', 'sizeGuide', { productId: 'p-003' }, CLIENT);
  assert.ok(r.available.includes(r.recommended));
});

test('client.outfit : compose un look de plusieurs pièces', async () => {
  const r = await core.run('client', 'outfit', { occasion: 'mariage' }, CLIENT);
  assert.ok(r.look.length >= 2);
});

test('client.productQA : répond avec des sources', async () => {
  const r = await core.run('client', 'productQA', { productId: 'p-020', question: 'garantie et retour ?' }, CLIENT);
  assert.match(r.answer, /garantie|retour/i);
  assert.ok(r.sources.length);
});

/* ------------------------- AI Operator Engine 2.0 ------------------------- */
test('operator.dashboard : KPIs exécutifs', async () => {
  const d = await core.run('operator', 'dashboard', {}, ADMIN);
  assert.ok(typeof d.revenue.monthFcfa === 'number');
  assert.ok(d.orders);
});

test('operator.health : note globale bornée', async () => {
  const h = await core.run('operator', 'health', {}, ADMIN);
  assert.ok(h.globalScore >= 0 && h.globalScore <= 100);
});

test('operator.alerts : classées par sévérité', async () => {
  const a = await core.run('operator', 'alerts', {}, ADMIN);
  assert.ok(a.summary && 'critique' in a.summary);
});

test('operator.simulate : commission → impact estimé', async () => {
  const s = await core.run('operator', 'simulate', { type: 'commission', value: 10 }, ADMIN);
  assert.ok(typeof s.estimatedImpact.deltaFcfa === 'number');
});

test('operator.predict : horizons supportés', async () => {
  const p = await core.run('operator', 'predict', { horizon: 90 }, ADMIN);
  assert.equal(p.horizonDays, 90);
});

test('operator.commandCenter : briefing + politique de validation', async () => {
  const c = await core.run('operator', 'commandCenter', { name: 'Test' }, ADMIN);
  assert.match(c.greeting, /Bonjour/);
  assert.ok(c.policy.includes('validation'));
});

test('operator réservé admin : client refusé (403)', async () => {
  await assert.rejects(() => core.run('operator', 'dashboard', {}, CLIENT), (e) => e.status === 403);
});

/* ------------------------- AI CTO Engine ------------------------- */
test('cto.selfCheck : audit transverse', async () => {
  const r = await core.run('cto', 'selfCheck', {}, ADMIN);
  assert.ok(Array.isArray(r.areas) && r.areas.length >= 6);
});

test('cto.qualityScore : score global borné', async () => {
  const q = await core.run('cto', 'qualityScore', {}, ADMIN);
  assert.ok(q.global >= 0 && q.global <= 100);
});

test('cto.roadmap : propositions avec statut « proposé »', async () => {
  const r = await core.run('cto', 'roadmap', {}, ADMIN);
  assert.ok(r.items.length > 0);
  assert.ok(r.items.every((i) => i.status === 'proposé'));
});

/* ------------------------- HTTP ------------------------- */
let url; let close;
before(() => { const s = startServer(); url = s.url; close = s.close; });
after(() => close());

test('HTTP : client.compare via le Core (public)', async () => {
  const { status, data } = await api(url, '/api/ai/core/client/compare', { method: 'POST', body: { productIds: ['p-020', 'p-021'] } });
  assert.equal(status, 200);
  assert.ok(data.bestValue);
});

test('HTTP : operator.commandCenter (admin) ; client refusé', async () => {
  const clientToken = await login(url, 'client@emarket.ml', 'client123');
  const refused = await api(url, '/api/ai/core/operator/commandCenter', { method: 'POST', token: clientToken, body: {} });
  assert.equal(refused.status, 403);
  const adminToken = await login(url, 'admin@emarket.ml', 'admin123');
  const ok = await api(url, '/api/ai/core/operator/commandCenter', { method: 'POST', token: adminToken, body: { name: 'Founder' } });
  assert.equal(ok.status, 200);
  assert.match(ok.data.greeting, /Bonjour/);
});
