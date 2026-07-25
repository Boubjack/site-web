require('./setup'); // EN PREMIER : isole les données + seed.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./setup');

const suggest = require('../server/ai/services/suggest');
const search = require('../server/ai/services/search');
const shopTheme = require('../server/ai/studio/theme');

/* ------------------------- Recherche intelligente ------------------------- */
test('correction de frappe : "chausure" → "chaussure"', () => {
  const fix = suggest.correct('chausure noir');
  assert.equal(fix.changed, true);
  assert.match(fix.corrected, /chaussure/);
});

test('autocomplétion : préfixe "boub" propose un produit', () => {
  const s = suggest.suggest('boub', 5);
  assert.ok(s.length > 0);
  assert.match(s[0].label.toLowerCase(), /boubou/);
});

test('recherche : requête mal orthographiée renvoie quand même des résultats', async () => {
  const r = await search.search('smartfone');
  assert.ok(r.results.length > 0);
  assert.ok(r.correction);
});

/* ------------------------- IA Boutique ------------------------- */
test('thème par catégorie : luxe → accent + sections + animations', () => {
  const t = shopTheme.generate({ category: 'luxe' });
  assert.equal(t.label, 'Luxe');
  assert.ok(t.tokens['--shop-accent']);
  assert.ok(t.sections.length >= 4);
  assert.ok(t.animations.length >= 2);
});

test('alias de catégorie : "tech" → électronique', () => {
  assert.equal(shopTheme.generate({ category: 'tech' }).category, 'electronique');
});

/* ------------------------- Intégration HTTP ------------------------- */
let url; let close;
before(() => { const s = startServer(); url = s.url; close = s.close; });
after(() => close());

test('SEO : /robots.txt référence le sitemap', async () => {
  const res = await fetch(url + '/robots.txt');
  const txt = await res.text();
  assert.equal(res.status, 200);
  assert.match(txt, /Sitemap:/);
});

test('SEO : /sitemap.xml liste les produits', async () => {
  const res = await fetch(url + '/sitemap.xml');
  const xml = await res.text();
  assert.match(xml, /<urlset/);
  assert.match(xml, /\/p\/p-001/);
});

test('SEO : /p/:id expose OG + JSON-LD Product', async () => {
  const res = await fetch(url + '/p/p-003');
  const html = await res.text();
  assert.match(html, /og:title/);
  assert.match(html, /"@type":"Product"/);
});

test('PWA : manifest + service worker + offline servis', async () => {
  for (const [path, type] of [['/manifest.webmanifest', /json/], ['/sw.js', /javascript/], ['/offline.html', /html/]]) {
    const res = await fetch(url + path);
    assert.equal(res.status, 200, `${path} doit répondre 200`);
    assert.match(res.headers.get('content-type') || '', type);
  }
});

test('en-têtes de sécurité présents', async () => {
  const res = await fetch(url + '/api/health');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
});

test('autocomplétion via /api/ai/search/suggest', async () => {
  const { status, data } = await api(url, '/api/ai/search/suggest?q=boub');
  assert.equal(status, 200);
  assert.ok(Array.isArray(data.suggestions));
});

/* ------------------------- Paiements locaux ------------------------- */
test('moyens de paiement : les 4 locaux uniquement', async () => {
  const { data } = await api(url, '/api/orders/payment-methods');
  const ids = data.methods.map((m) => m.id).sort();
  assert.deepEqual(ids, ['cod', 'moov-money', 'orange-money', 'wave']);
});

test('commande avec Wave → étiquette + statut de paiement', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status, data } = await api(url, '/api/orders', { method: 'POST', token, body: { items: [{ productId: 'p-013', qty: 1 }], paymentMethod: 'wave' } });
  assert.equal(status, 201);
  assert.equal(data.order.paymentLabel, 'Wave');
});

test('moyen de paiement invalide → 400', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status } = await api(url, '/api/orders', { method: 'POST', token, body: { items: [{ productId: 'p-013', qty: 1 }], paymentMethod: 'paypal' } });
  assert.equal(status, 400);
});
