/**
 * 3. RECHERCHE IA AVANCÉE — comprend les phrases naturelles.
 * "Je veux un téléphone puissant pour jouer à moins de 200 000 FCFA"
 *  → intention structurée → filtres catalogue → meilleurs résultats.
 */
const provider = require('../provider/llm');
const catalog = require('./catalog');
const recommender = require('./recommender');
const vectors = require('./vectors');
const suggestSvc = require('./suggest');

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    keywords: { type: 'string', description: 'Mots-clés produit essentiels' },
    category: { type: ['string', 'null'], enum: ['mode-homme', 'mode-femme', 'electronique', 'chaussures', 'accessoires', null] },
    maxPrice: { type: ['number', 'null'], description: 'Budget max en FCFA' },
    minPrice: { type: ['number', 'null'] },
    color: { type: ['string', 'null'] },
    occasion: { type: ['string', 'null'] },
    gender: { type: ['string', 'null'], enum: ['homme', 'femme', 'unisexe', null] },
  },
  required: ['keywords', 'category', 'maxPrice', 'minPrice', 'color', 'occasion', 'gender'],
  additionalProperties: false,
};

async function parseIntent(query) {
  if (!provider.enabled()) return localIntent(query);
  try {
    const intent = await provider.completeJson({
      fast: true,
      system:
        "Tu extrais l'intention d'achat d'une requête de recherche e-commerce (marketplace ouest-africaine, prix en FCFA). Réponds uniquement le JSON demandé.",
      messages: [{ role: 'user', content: query }],
      schema: INTENT_SCHEMA,
      maxTokens: 300,
    });
    return { ...intent, source: 'ai' };
  } catch {
    return localIntent(query);
  }
}

function localIntent(query) {
  const q = catalog.normalize(query);
  const intent = {
    keywords: query,
    category: null,
    maxPrice: catalog.extractBudget(query),
    minPrice: null,
    color: null,
    occasion: null,
    gender: null,
    source: 'local',
  };
  if (/telephone|smartphone|ecouteur|casque|powerbank|montre connectee|tele/.test(q)) intent.category = 'electronique';
  else if (/robe|sac|femme/.test(q)) intent.category = 'mode-femme';
  else if (/boubou|costume|homme/.test(q)) intent.category = 'mode-homme';
  else if (/chaussure|basket|sneaker|babouche/.test(q)) intent.category = 'chaussures';
  if (/mariage/.test(q)) intent.occasion = 'mariage';
  if (/soiree/.test(q)) intent.occasion = 'soiree';
  for (const color of ['noir', 'noire', 'blanc', 'blanche', 'bleu', 'orange', 'kaki']) {
    if (q.includes(color)) { intent.color = color.replace(/e$/, ''); break; }
  }
  if (/\bhomme\b/.test(q)) intent.gender = 'homme';
  if (/\bfemme\b/.test(q)) intent.gender = 'femme';
  return intent;
}

async function search(query, { userId } = {}) {
  const intent = await parseIntent(query);
  let results = catalog.searchProducts({
    query: intent.keywords || query,
    category: intent.category || undefined,
    maxPrice: intent.maxPrice || undefined,
    minPrice: intent.minPrice || undefined,
    color: intent.color || undefined,
    occasion: intent.occasion || undefined,
    gender: intent.gender || undefined,
    limit: 12,
  });
  let semantic = false;
  let correction = null;
  // Tolérance aux fautes : si rien ne sort, on tente la requête corrigée.
  if (!results.length) {
    const fix = suggestSvc.correct(query);
    if (fix.changed) {
      const retry = catalog.searchProducts({ query: fix.corrected, limit: 12 });
      if (retry.length) { results = retry; correction = fix.corrected; }
    }
  }
  // Repli sémantique (compatible FAISS) quand la recherche lexicale ne
  // rapporte toujours rien : on comprend le sens même sans mot-clé exact.
  if (!results.length) {
    const hits = vectors.semanticSearch(intent.keywords || query, {
      limit: 12,
      category: intent.category || undefined,
    });
    if (hits.length) {
      results = hits.map((h) => catalog.productCard(h.product));
      semantic = true;
    }
  }
  if (userId) recommender.trackEvent({ userId, type: 'search', query });
  return { intent, results, semantic, correction };
}

module.exports = { search, parseIntent };
