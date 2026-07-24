/**
 * 5. IA PHOTO (VISION) — analyse d'image produit + recherche par image.
 * - Vendeur : une photo → reconnaissance produit/catégorie/couleur/style/
 *   matière/genre/détails (alimente la génération de fiche).
 * - Client : une photo → produits similaires, moins chers, alternatives.
 */
const provider = require('../provider/anthropic');
const catalog = require('./catalog');

const ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    product: { type: 'string', description: 'Nature du produit identifié' },
    category: { type: 'string', enum: ['mode-homme', 'mode-femme', 'electronique', 'chaussures', 'accessoires', 'autre'] },
    subcategory: { type: 'string' },
    colors: { type: 'array', items: { type: 'string' } },
    style: { type: 'string', description: 'streetwear, traditionnel, elegant, sport...' },
    material: { type: 'string', description: 'Matière probable' },
    gender: { type: 'string', enum: ['homme', 'femme', 'unisexe', 'na'] },
    details: { type: 'array', items: { type: 'string' }, description: 'Détails importants visibles (broderie, logo, état...)' },
    searchQuery: { type: 'string', description: 'Requête de recherche catalogue optimale pour retrouver ce type de produit' },
  },
  required: ['product', 'category', 'subcategory', 'colors', 'style', 'material', 'gender', 'details', 'searchQuery'],
  additionalProperties: false,
};

/** Analyse une image produit (base64). */
async function analyzeImage({ imageBase64, mediaType }) {
  if (!provider.enabled()) {
    return {
      available: false,
      message:
        "L'analyse d'image nécessite une clé API modèle (ANTHROPIC_API_KEY). Configurez-la dans .env pour activer la vision IA.",
    };
  }
  const analysis = await provider.visionJson({
    imageBase64,
    mediaType,
    system:
      "Tu analyses des photos de produits pour E-Market, marketplace ouest-africaine. Identifie précisément le produit (mode, électronique, artisanat local : bazin, wax, babouches, bijoux touareg...).",
    prompt: 'Analyse ce produit et remplis le JSON demandé.',
    schema: ANALYSIS_SCHEMA,
  });
  return { available: true, analysis };
}

/** Recherche par image : similaires / moins chers / alternatives. */
async function searchByImage({ imageBase64, mediaType }) {
  const result = await analyzeImage({ imageBase64, mediaType });
  if (!result.available) return result;

  const { analysis } = result;
  const similar = catalog.searchProducts({
    query: analysis.searchQuery,
    category: analysis.category !== 'autre' ? analysis.category : undefined,
    gender: analysis.gender !== 'na' ? analysis.gender : undefined,
    limit: 6,
  });

  const prices = similar.map((p) => p.price);
  const median = prices.length ? prices.sort((a, b) => a - b)[Math.floor(prices.length / 2)] : null;
  const cheaper = median ? similar.filter((p) => p.price < median) : [];

  // Alternatives : même catégorie, sous-catégorie différente.
  const alternatives = catalog
    .searchProducts({ query: analysis.category, category: analysis.category, limit: 10 })
    .filter((p) => !similar.some((s) => s.id === p.id))
    .slice(0, 3);

  return { available: true, analysis, similar, cheaper, alternatives };
}

module.exports = { analyzeImage, searchByImage, ANALYSIS_SCHEMA };
