require('./setup'); // EN PREMIER : isole les données + seed.

const { test } = require('node:test');
const assert = require('node:assert/strict');

const agents = require('../server/ai/agents');
const vectors = require('../server/ai/services/vectors');
const search = require('../server/ai/services/search');
const discovery = require('../server/ai/services/discovery');
const brandkit = require('../server/ai/studio/brandkit');
const creative = require('../server/ai/studio/creative');
const llm = require('../server/ai/provider/llm');
const jobs = require('../server/ai/studio/jobs');
const photo = require('../server/ai/agents/photo');

const admin = { id: 'u-admin', role: 'admin' };
const client = { id: 'u-cli-1', role: 'client' };
const SELLER = 'u-vend-1';
const SELLER_PRODUCT = 'p-003';

/* ------------------------- Comité de direction IA ------------------------- */
test('les 6 agents C-suite/brain s’exécutent (admin)', async () => {
  for (const id of ['brain', 'ceo', 'cfo', 'cmo', 'coo', 'cto']) {
    const r = await agents.run(id, { days: 30 }, { user: admin });
    assert.ok(r.headline, `${id} doit renvoyer un headline`);
  }
});

test('un client ne peut pas exécuter un agent admin (403)', async () => {
  await assert.rejects(() => agents.run('ceo', {}, { user: client }), (e) => e.status === 403);
});

test('le score de santé du Brain est borné 0..100', async () => {
  const r = await agents.run('brain', {}, { user: admin });
  assert.ok(r.healthScore >= 0 && r.healthScore <= 100);
});

/* ------------------------- Recherche sémantique ------------------------- */
test('recherche sémantique (FAISS-compatible) trouve des résultats', () => {
  const hits = vectors.semanticSearch('tenue élégante de cérémonie', { limit: 5 });
  assert.ok(hits.length > 0);
  assert.ok(hits[0].score > 0);
});

test('produits proches : exclut le produit lui-même', () => {
  const sim = vectors.similar(SELLER_PRODUCT, { limit: 3 });
  assert.ok(sim.length > 0);
  assert.ok(!sim.find((s) => s.id === SELLER_PRODUCT));
});

test('la recherche NL renvoie une intention + résultats (mode local)', async () => {
  const r = await search.search('un téléphone puissant à moins de 200000');
  assert.equal(r.intent.source, 'local');
  assert.ok(Array.isArray(r.results));
});

/* ------------------------- Découverte ------------------------- */
test('Stories IA génère au moins une story avec produits', () => {
  const { stories } = discovery.stories();
  assert.ok(stories.length > 0);
  assert.ok(stories[0].products.length > 0);
});

test('Vitrine vivante renvoie des sections', () => {
  const s = discovery.showcase(null);
  assert.ok(s.sections.length > 0);
});

test('Hover intelligent renvoie raison + faits + produits proches', () => {
  const h = discovery.hoverInsight(SELLER_PRODUCT, null);
  assert.ok(h.reason);
  assert.ok(Array.isArray(h.facts));
  assert.ok(Array.isArray(h.similar));
});

/* ------------------------- Brand Kit + Creative Studio ------------------------- */
test('Brand Kit : sauvegarde puis relecture', () => {
  brandkit.save(SELLER, { brandName: 'Test Brand', positioning: 'Luxe', slogan: 'S' });
  const kit = brandkit.getForSeller(SELLER);
  assert.equal(kit.brandName, 'Test Brand');
  assert.equal(brandkit.styleGuide(kit).videoStyle, 'luxe');
});

test('« Générer 5 variantes » : angles/décors distincts', async () => {
  const r = await photo.run({ action: 'variants', productId: SELLER_PRODUCT, count: 5 }, { user: { id: SELLER } });
  assert.equal(r.variants.length, 5);
  assert.equal(new Set(r.variants.map((v) => v.angle)).size, 5);
});

test('« Créer ma campagne » produit le pack complet (31 livrables)', async () => {
  const c = await creative.fullCampaign({ productId: SELLER_PRODUCT }, SELLER);
  assert.equal(c.totals.photos, 10);
  assert.equal(c.totals.affiches, 5);
  assert.equal(c.totals.total, 31);
  assert.ok(c.brandKit.brand);
});

/* ------------------------- Fournisseur & rendu ------------------------- */
test('LLM en mode local : enabled=false, activeProvider=local', () => {
  assert.equal(llm.enabled(), false);
  assert.equal(llm.activeProvider(), 'local');
});

test('rendu sans moteur : job en mode spécification (jamais d’erreur)', async () => {
  const r = await photo.run({ action: 'produce', productId: SELLER_PRODUCT, photoType: 'luxe' }, { user: { id: SELLER } });
  await new Promise((res) => setTimeout(res, 300));
  const job = jobs.getJob(r.jobId);
  assert.equal(job.status, 'termine');
  assert.equal(job.result.mode, 'specification');
});
