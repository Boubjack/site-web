/**
 * 4. IA POUR VENDEURS — "Générer une annonce IA".
 * Le vendeur fournit un nom simple + quelques informations (+ photo analysée
 * par le module vision) ; l'IA génère une fiche produit professionnelle
 * complète avec suggestion de prix basée sur le catalogue existant.
 */
const provider = require('../provider/anthropic');
const catalog = require('./catalog');
const { store } = require('../../db/store');

const LISTING_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Titre professionnel accrocheur (max 70 caractères)' },
    shortDescription: { type: 'string', description: '1-2 phrases vendeuses' },
    longDescription: { type: 'string', description: 'Description détaillée structurée (matière, coupe, usage, entretien)' },
    category: { type: 'string', enum: ['mode-homme', 'mode-femme', 'electronique', 'chaussures', 'accessoires'] },
    subcategory: { type: 'string' },
    tags: { type: 'array', items: { type: 'string' } },
    seoKeywords: { type: 'array', items: { type: 'string' } },
    sellingPoints: { type: 'array', items: { type: 'string' }, description: '3-5 arguments commerciaux' },
    suggestedPrice: { type: 'number', description: 'Prix conseillé en FCFA' },
    priceRationale: { type: 'string', description: 'Justification courte du prix' },
  },
  required: ['title', 'shortDescription', 'longDescription', 'category', 'subcategory', 'tags', 'seoKeywords', 'sellingPoints', 'suggestedPrice', 'priceRationale'],
  additionalProperties: false,
};

/** Fourchette de prix des produits comparables (ancrage marché). */
function marketContext(name, hints) {
  const similar = catalog.searchProducts({ query: `${name} ${hints || ''}`, limit: 5 });
  if (!similar.length) return 'Aucun produit comparable dans le catalogue.';
  return 'Produits comparables sur E-Market :\n' +
    similar.map((p) => `- ${p.name} : ${p.price} FCFA (note ${p.rating || 'n/a'})`).join('\n');
}

async function generateListing({ name, hints = '', condition = 'neuf', visionAnalysis = null }) {
  if (!provider.enabled()) return localListing({ name, hints });

  const context = [
    `Nom fourni par le vendeur : ${name}`,
    hints ? `Informations complémentaires : ${hints}` : null,
    `État : ${condition}`,
    visionAnalysis ? `Analyse IA de la photo : ${JSON.stringify(visionAnalysis)}` : null,
    marketContext(name, hints),
  ].filter(Boolean).join('\n\n');

  return provider.completeJson({
    system:
      "Tu es l'assistant vendeur d'E-Market (marketplace ouest-africaine, prix en FCFA). Tu rédiges des fiches produit professionnelles en français, optimisées pour la conversion et le SEO local. Le prix suggéré doit être cohérent avec les produits comparables fournis.",
    messages: [{ role: 'user', content: `Génère la fiche produit complète.\n\n${context}` }],
    schema: LISTING_SCHEMA,
    maxTokens: 2048,
  });
}

/** Repli local : gabarit + ancrage prix sur les comparables. */
function localListing({ name, hints }) {
  const similar = catalog.searchProducts({ query: `${name} ${hints || ''}`, limit: 5 });
  const avgPrice = similar.length
    ? Math.round(similar.reduce((s, p) => s + p.price, 0) / similar.length / 500) * 500
    : 10000;
  const ref = similar[0];
  const category = ref ? ref.category : 'accessoires';
  const subcategory = ref ? ref.subcategory : 'divers';
  const clean = name.trim();
  return {
    title: `${clean.charAt(0).toUpperCase()}${clean.slice(1)} — qualité premium`,
    shortDescription: `${clean} de qualité, disponible dès maintenant sur E-Market.${hints ? ` ${hints}.` : ''}`,
    longDescription:
      `Découvrez ${clean} sur E-Market.\n\n` +
      `${hints ? `Caractéristiques : ${hints}.\n\n` : ''}` +
      `Produit vérifié par nos équipes, livraison rapide à Bamako (24-72h) et partout au Mali. ` +
      `Paiement sécurisé (Orange Money, Moov Money, carte, paiement à la livraison). Retour sous 14 jours.`,
    category,
    subcategory,
    tags: [clean.split(' ')[0].toLowerCase(), category, 'bamako', 'mali'],
    seoKeywords: [`${clean} prix mali`, `acheter ${clean} bamako`, `${clean} fcfa`, `${clean} livraison`],
    sellingPoints: [
      'Qualité vérifiée par E-Market',
      'Livraison 24-72h à Bamako',
      'Paiement à la livraison disponible',
      'Retour gratuit sous 14 jours',
    ],
    suggestedPrice: avgPrice,
    priceRationale: similar.length
      ? `Aligné sur la moyenne des ${similar.length} produits comparables du catalogue (~${avgPrice} FCFA).`
      : 'Prix indicatif par défaut — aucun comparable trouvé, ajustez selon votre coût.',
    local: true,
  };
}

/** Publication de la fiche générée comme produit du vendeur. */
function publishListing(sellerId, listing, extra = {}) {
  return store.insert('products', {
    name: listing.title,
    description: listing.longDescription,
    shortDescription: listing.shortDescription,
    category: listing.category,
    subcategory: listing.subcategory,
    tags: listing.tags,
    seoKeywords: listing.seoKeywords,
    price: extra.price || listing.suggestedPrice,
    colors: extra.colors || [],
    sizes: extra.sizes || [],
    stock: extra.stock || 1,
    emoji: extra.emoji || '🛍️',
    occasion: extra.occasion || [],
    style: extra.style || '',
    material: extra.material || '',
    gender: extra.gender || '',
    sellerId,
    active: true,
    aiGenerated: true,
  });
}

module.exports = { generateListing, publishListing, LISTING_SCHEMA };
