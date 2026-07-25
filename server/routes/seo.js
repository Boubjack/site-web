/**
 * SEO technique — au niveau des grandes marketplaces, sans dépendance :
 *   - /robots.txt            (indexation + lien sitemap)
 *   - /sitemap.xml           (accueil + une URL par produit actif)
 *   - /p/:id                 (page produit crawlable : Open Graph + Twitter Card
 *                             + JSON-LD schema.org/Product ; redirige l'humain
 *                             vers la boutique)
 *
 * Les URLs sont propres (/p/<id>) et les métadonnées sont générées
 * automatiquement à partir du catalogue réel.
 */
const express = require('express');
const { store } = require('../db/store');
const catalog = require('../ai/services/catalog');
const storebuilder = require('../ai/studio/storebuilder');
const storeRender = require('../ai/studio/store-render');

const router = express.Router();

function baseUrl(req) {
  return process.env.PUBLIC_URL || `${req.protocol}://${req.get('host')}`;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

router.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(`User-agent: *\nAllow: /\nSitemap: ${baseUrl(req)}/sitemap.xml\n`);
});

router.get('/sitemap.xml', (req, res) => {
  const base = baseUrl(req);
  const products = store.find('products', (p) => p.active !== false);
  const urls = [
    `<url><loc>${base}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>`,
    ...products.map((p) => `<url><loc>${base}/p/${esc(p.id)}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
  ];
  res.type('application/xml').send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`,
  );
});

/** Page produit crawlable : métadonnées riches + redirection vers la boutique. */
router.get('/p/:id', (req, res) => {
  const p = store.getById('products', req.params.id);
  if (!p || p.active === false) return res.status(404).type('text/plain').send('Produit introuvable.');
  const base = baseUrl(req);
  const card = catalog.productCard(p);
  const title = `${p.name} — ${catalog.formatFcfa(p.price)} | E-Market`;
  const desc = (p.description || `${p.name} sur E-Market, la marketplace intelligente de Bamako.`).slice(0, 200);
  const url = `${base}/p/${p.id}`;
  const jsonld = {
    '@context': 'https://schema.org', '@type': 'Product',
    name: p.name, description: p.description || undefined, category: p.category, sku: p.id,
    brand: { '@type': 'Brand', name: card.seller ? card.seller.shop : 'E-Market' },
    offers: { '@type': 'Offer', price: p.price, priceCurrency: 'XOF', availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url },
    ...(card.rating ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: card.rating, reviewCount: card.reviewCount || 1 } } : {}),
  };
  res.type('html').send(`<!DOCTYPE html><html lang="fr"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<link rel="canonical" href="${esc(url)}">
<meta property="og:type" content="product"><meta property="og:title" content="${esc(p.name)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta property="product:price:amount" content="${p.price}"><meta property="product:price:currency" content="XOF">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(p.name)}">
<meta name="twitter:description" content="${esc(desc)}">
<script type="application/ld+json">${JSON.stringify(jsonld)}</script>
<meta http-equiv="refresh" content="0; url=/?p=${encodeURIComponent(p.id)}">
</head><body>
<p>${esc(p.name)} — ${esc(catalog.formatFcfa(p.price))}. <a href="/?p=${encodeURIComponent(p.id)}">Voir sur E-Market</a></p>
</body></html>`);
});

/** Boutique vendeur publique, rendue depuis le blueprint IA (?proposal=N pour prévisualiser). */
router.get('/shop/:sellerId', (req, res) => {
  const seller = store.getById('users', req.params.sellerId);
  if (!seller || (seller.role !== 'seller' && seller.role !== 'admin')) return res.status(404).type('text/plain').send('Boutique introuvable.');
  const products = store.find('products', (p) => p.sellerId === seller.id && p.active !== false);
  const doc = store.findOne('storeBlueprints', (d) => d.sellerId === seller.id);

  let blueprint;
  if (doc) {
    const wanted = parseInt(req.query.proposal, 10) || doc.selectedProposal || 1;
    blueprint = doc.proposals.find((p) => p.proposal === wanted) || doc.proposals[0];
  } else {
    // Pas encore généré : boutique par défaut dérivée de la catégorie dominante.
    const cat = (products[0] && products[0].category) || 'generique';
    blueprint = storebuilder.generateProposals({ category: cat, brandName: seller.shop || seller.name, positioning: 'Premium' }, 1)[0];
  }
  res.type('html').send(storeRender.renderStorefront(blueprint, { seller, products }));
});

module.exports = router;
