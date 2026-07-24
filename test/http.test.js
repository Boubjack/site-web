require('./setup'); // EN PREMIER : isole les données + seed.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./setup');

let url; let close;
before(() => { const s = startServer(); url = s.url; close = s.close; });
after(() => close());

/* ------------------------- Santé & pages publiques ------------------------- */
test('GET /api/health → ok', async () => {
  const { status, data } = await api(url, '/api/health');
  assert.equal(status, 200);
  assert.equal(data.status, 'ok');
});

test('GET /api/ai/status → moteur local', async () => {
  const { status, data } = await api(url, '/api/ai/status');
  assert.equal(status, 200);
  assert.equal(data.activeProvider, 'local');
});

test('GET /api/ai/stories (public) → stories', async () => {
  const { status, data } = await api(url, '/api/ai/stories');
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.stories));
});

test('POST /api/ai/search → intention + résultats', async () => {
  const { status, data } = await api(url, '/api/ai/search', { method: 'POST', body: { query: 'robe de mariage élégante' } });
  assert.equal(status, 200);
  assert.ok(data.intent);
  assert.ok(Array.isArray(data.results));
});

/* ------------------------- Auth & permissions ------------------------- */
test('login vendeur → token', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  assert.ok(token);
});

test('mauvais mot de passe → 401', async () => {
  const { status } = await api(url, '/api/auth/login', { method: 'POST', body: { email: 'vendeur@emarket.ml', password: 'faux' } });
  assert.equal(status, 401);
});

test('un client ne peut pas accéder à un agent exécutif (403)', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status } = await api(url, '/api/ai/exec/ceo', { token });
  assert.equal(status, 403);
});

test('un admin accède au Marketplace Brain', async () => {
  const token = await login(url, 'admin@emarket.ml', 'admin123');
  const { status, data } = await api(url, '/api/ai/brain', { token });
  assert.equal(status, 200);
  assert.ok(typeof data.healthScore === 'number');
});

/* ------------------------- Creative Studio ------------------------- */
test('Brand Kit : PUT puis GET', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  const put = await api(url, '/api/ai/studio/brandkit', { method: 'PUT', token, body: { brandName: 'HTTP Brand', positioning: 'Sport' } });
  assert.equal(put.status, 200);
  const get = await api(url, '/api/ai/studio/brandkit', { token });
  assert.equal(get.data.brandKit.brandName, 'HTTP Brand');
});

test('campagne sur un produit du vendeur → 202 + 31 livrables', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  const { status, data } = await api(url, '/api/ai/studio/campaign', { method: 'POST', token, body: { productId: 'p-003' } });
  assert.equal(status, 202);
  assert.equal(data.totals.total, 31);
});

test('campagne sur le produit d’un AUTRE vendeur → 403', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  const { status } = await api(url, '/api/ai/studio/campaign', { method: 'POST', token, body: { productId: 'p-001' } });
  assert.equal(status, 403);
});

test('studio réservé aux vendeurs/admin : client refusé (403)', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status } = await api(url, '/api/ai/studio/campaign', { method: 'POST', token, body: { productId: 'p-003' } });
  assert.equal(status, 403);
});
