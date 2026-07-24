/**
 * AGENT — AI Produit. Création automatique de fiches produit :
 * titre, descriptions, catégorie, sous-catégorie, tags, mots-clés SEO,
 * arguments commerciaux, prix conseillé, hashtags. Permissions : vendeur/admin.
 */
const sellerService = require('../services/seller');

function hashtagsFrom(listing) {
  const base = [...(listing.tags || []), ...(listing.seoKeywords || [])]
    .map((t) => '#' + String(t).replace(/[^a-z0-9]+/gi, ''))
    .filter((h) => h.length > 2);
  return [...new Set(['#EMarket', '#Bamako', '#Mali', ...base])].slice(0, 12);
}

async function run(input) {
  if (!input.name) return { error: 'name (nom du produit) requis.' };
  const listing = await sellerService.generateListing({ name: input.name, hints: input.hints || '' });
  return { listing, hashtags: hashtagsFrom(listing) };
}

module.exports = {
  id: 'product',
  name: 'AI Produit',
  description: 'Génère des fiches produit complètes (titre, descriptions, SEO, tags, hashtags, prix conseillé).',
  allowedRoles: ['seller', 'admin'],
  keywords: ['fiche', 'annonce', 'titre', 'description', 'seo', 'mots-clés', 'produit', 'hashtag'],
  tool: {
    name: 'generate_listing',
    description: 'Crée une fiche produit professionnelle complète à partir d\'un nom simple + quelques infos.',
    input_schema: { type: 'object', properties: { name: { type: 'string' }, hints: { type: 'string' } }, required: ['name'] },
  },
  run,
};
