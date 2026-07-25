require('./setup'); // EN PREMIER : isole les données + seed.

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startServer, api, login } = require('./setup');

const storebuilder = require('../server/ai/studio/storebuilder');
const storeRender = require('../server/ai/studio/store-render');
const palette = require('../server/ai/studio/palette');
const { store } = require('../server/db/store');

/* ------------------------- Palette originale ------------------------- */
test('palette : graines différentes → accents différents', () => {
  const a = palette.generate({ accent: '#2a90ff', seed: 0 }).accent;
  const b = palette.generate({ accent: '#2a90ff', seed: 3 }).accent;
  assert.notEqual(a, b);
});

test('palette : texte lisible sur accent (contraste)', () => {
  assert.match(palette.readableOn('#ffffff'), /#0d1017/);
  assert.match(palette.readableOn('#000000'), /#f6f7fb/);
});

/* ------------------------- Générateur de blueprints ------------------------- */
test('génère 3 propositions distinctes', () => {
  const props = storebuilder.generateProposals({ category: 'bijoux', positioning: 'Luxe', colors: ['#c9a227'] }, 3);
  assert.equal(props.length, 3);
  const accents = props.map((p) => p.designSystem.palette.accent);
  assert.equal(new Set(accents).size, 3, 'les 3 accents doivent différer');
  const dirs = props.map((p) => p.direction);
  assert.equal(new Set(dirs).size, 3, 'les 3 directions doivent différer');
});

test('adaptation par secteur (bijoux ≠ high-tech)', () => {
  const bijoux = storebuilder.generateProposals({ category: 'bijoux' }, 1)[0];
  const tech = storebuilder.generateProposals({ category: 'electronique' }, 1)[0];
  assert.equal(bijoux.sector, 'bijoux');
  assert.equal(tech.sector, 'hightech');
  assert.notDeepEqual(bijoux.pages.produit.blocks, tech.pages.produit.blocks);
});

test('blueprint complet : pages + composants + contenu + garde-fou originalité', () => {
  const bp = storebuilder.generateProposals({ category: 'mode-femme', brandName: 'Test' }, 1)[0];
  for (const page of ['accueil', 'catalogue', 'categorie', 'produit', 'panier', 'checkout', 'apropos', 'faq']) {
    assert.ok(bp.pages[page], `page ${page} manquante`);
  }
  assert.ok(bp.components.card && bp.components.hover && bp.components.gallery);
  assert.ok(bp.content.tagline.length && bp.content.faq.length);
  assert.equal(bp.originality.generated, true);
});

/* ------------------------- Rendu HTML ------------------------- */
test('rend une page boutique HTML autonome', () => {
  const bp = storebuilder.generateProposals({ category: 'mode-femme', brandName: 'Bamako Style' }, 1)[0];
  const products = store.find('products', (p) => p.sellerId === 'u-vend-1');
  const html = storeRender.renderStorefront(bp, { seller: { shop: 'Bamako Style' }, products });
  assert.match(html, /<!DOCTYPE html>/);
  assert.match(html, /Bamako Style/);
  assert.match(html, /Questions fréquentes/);
  assert.ok(html.length > 5000);
});

/* ------------------------- Intégration HTTP ------------------------- */
let url; let close;
before(() => { const s = startServer(); url = s.url; close = s.close; });
after(() => close());

test('POST /studio/store (vendeur) → 3 propositions + persistées', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  const { status, data } = await api(url, '/api/ai/studio/store', { method: 'POST', token, body: { category: 'mode-femme', positioning: 'Premium', colors: ['#e63d6a'], brandName: 'Bamako Style' } });
  assert.equal(status, 200);
  assert.equal(data.proposals.length, 3);
});

test('client ne peut pas générer de boutique (403)', async () => {
  const token = await login(url, 'client@emarket.ml', 'client123');
  const { status } = await api(url, '/api/ai/studio/store', { method: 'POST', token, body: { category: 'mode' } });
  assert.equal(status, 403);
});

test('sélection + rendu public de la boutique', async () => {
  const token = await login(url, 'vendeur@emarket.ml', 'vendeur123');
  await api(url, '/api/ai/studio/store', { method: 'POST', token, body: { category: 'mode-femme', colors: ['#e63d6a'] } });
  const sel = await api(url, '/api/ai/studio/store/select', { method: 'POST', token, body: { proposal: 2 } });
  assert.equal(sel.status, 200);
  const res = await fetch(url + '/shop/u-vend-1');
  const html = await res.text();
  assert.equal(res.status, 200);
  assert.match(html, /boutique générée par E-Market AI/);
});
