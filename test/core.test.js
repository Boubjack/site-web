require('./setup'); // EN PREMIER : isole les données + seed.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./setup');

const { Core } = require('../server/ai/core/core');
const { EventBus } = require('../server/ai/core/events');
const { Cache } = require('../server/ai/core/cache');
const core = require('../server/ai/core');

/* ------------------------- Infrastructure ------------------------- */
test('EventBus : publication/abonnement + désabonnement', () => {
  const bus = new EventBus();
  let n = 0;
  const off = bus.on('x', () => { n += 1; });
  bus.emit('x'); bus.emit('x');
  off(); bus.emit('x');
  assert.equal(n, 2);
});

test('Cache : TTL + wrap (mémoïsation)', async () => {
  const c = new Cache({ defaultTtlMs: 1000 });
  let calls = 0;
  const f = () => c.wrap('k', 1000, async () => { calls += 1; return 42; });
  assert.equal(await f(), 42);
  assert.equal(await f(), 42);
  assert.equal(calls, 1); // second appel servi par le cache
});

test('Core : moteur invalide rejeté, doublon rejeté', () => {
  const c = new Core();
  assert.throws(() => c.register({ name: 'x' })); // id/actions manquants
  c.register({ id: 'e', name: 'E', actions: { a: { handler: () => 1 } } });
  assert.throws(() => c.register({ id: 'e', name: 'E2', actions: {} }));
});

/* ------------------------- Registre réel ------------------------- */
test('les moteurs attendus sont enregistrés', () => {
  const ids = core.list({ role: 'admin' }).map((e) => e.id);
  for (const id of ['theme', 'layout', 'component', 'animation', 'branding', 'commerce', 'marketing', 'pricing', 'inventory', 'photo', 'video', 'brand-guardian', 'search', 'recommendation', 'analytics', 'fraud', 'seo', 'performance', 'accessibility', 'translation']) {
    assert.ok(ids.includes(id), `moteur ${id} attendu`);
  }
});

test('permissions : invité < vendeur < admin', () => {
  const guest = core.list(null).length;
  const seller = core.list({ role: 'seller' }).length;
  const admin = core.list({ role: 'admin' }).length;
  assert.ok(guest < seller && seller <= admin);
});

test('run : moteur/action inconnus → 404, accès refusé → 403', async () => {
  await assert.rejects(() => core.run('nope', 'x', {}, {}), (e) => e.status === 404);
  await assert.rejects(() => core.run('theme', 'nope', {}, { user: { role: 'seller' } }), (e) => e.status === 404);
  await assert.rejects(() => core.run('analytics', 'finance', {}, { user: null }), (e) => e.status === 403);
});

test('run : moteurs clés renvoient un résultat + métriques', async () => {
  const seller = { user: { role: 'seller', id: 'u-vend-1' } };
  assert.ok((await core.run('theme', 'generate', { category: 'mode' }, seller)).label);
  assert.ok((await core.run('pricing', 'suggest', { productId: 'p-003' }, seller)).suggestedPrice);
  assert.ok((await core.run('performance', 'audit', {}, seller)).score >= 0);
  assert.ok((await core.run('accessibility', 'audit', {}, seller)).score >= 0);
  assert.ok(Array.isArray((await core.run('commerce', 'recommendations', {}, seller)).recommendations));
  assert.ok(core.health().metrics.totalCalls > 0);
});

test('brand-guardian : détecte les écarts et propose des corrections', async () => {
  const seller = { user: { role: 'seller', id: 'u-vend-1' } };
  const r = await core.run('brand-guardian', 'check', { colors: ['#123456'], font: 'Comic Sans' }, seller);
  assert.equal(r.compliant, false);
  assert.ok(r.corrections);
});

/* ------------------------- Intégration HTTP ------------------------- */
let url; let close;
before(() => { const s = startServer(); url = s.url; close = s.close; });
after(() => close());

test('GET /core/engines (public) liste les moteurs publics', async () => {
  const { status, data } = await api(url, '/api/ai/core/engines');
  assert.equal(status, 200);
  assert.ok(data.engines.length >= 5);
});

test('GET /core/health réservé admin', async () => {
  const anon = await api(url, '/api/ai/core/health');
  assert.ok(anon.status === 401 || anon.status === 403); // non authentifié / non autorisé
  const token = await login(url, 'admin@emarket.ml', 'admin123');
  const ok = await api(url, '/api/ai/core/health', { token });
  assert.equal(ok.status, 200);
  assert.ok(ok.data.engines.total >= 20);
});

test('POST /core/:engine/:action invoque via le Core', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  const { status, data } = await api(url, '/api/ai/core/pricing/suggest', { method: 'POST', token, body: { productId: 'p-003' } });
  assert.equal(status, 200);
  assert.ok(data.suggestedPrice);
});

test('POST /core : moteur admin refusé au client (403)', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status } = await api(url, '/api/ai/core/fraud/overview', { method: 'POST', token, body: {} });
  assert.equal(status, 403);
});
