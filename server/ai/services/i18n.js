/**
 * 13. IA MULTILINGUE — Français / Anglais, architecture prête pour le
 * bambara et d'autres langues africaines : il suffit d'ajouter un code
 * dans SUPPORTED (le repli lexical local couvre déjà quelques bases).
 */
const provider = require('../provider/llm');

const SUPPORTED = {
  fr: { name: 'Français', status: 'actif' },
  en: { name: 'English', status: 'actif' },
  bm: { name: 'Bamanankan (Bambara)', status: 'préparé' },
};

// Mini-lexique de repli (démonstration de l'architecture bambara).
const LEXICON = {
  en: { Accueil: 'Home', Rechercher: 'Search', Panier: 'Cart', Prix: 'Price', Vendeur: 'Seller', Acheter: 'Buy', Livraison: 'Delivery' },
  bm: { Accueil: 'So', Rechercher: 'Ɲini', Panier: 'Segi', Prix: 'Sɔngɔ', Vendeur: 'Feerekɛla', Acheter: 'San', Livraison: 'Lase' },
};

async function translate({ text, target = 'en', context = 'e-commerce' }) {
  if (!SUPPORTED[target]) {
    throw Object.assign(new Error(`Langue non supportée. Choix: ${Object.keys(SUPPORTED).join(', ')}`), { status: 400 });
  }
  if (target === 'fr') return { text, target, source: 'identity' };

  if (provider.enabled()) {
    const translated = await provider.complete({
      fast: true,
      system:
        `Tu traduis des contenus e-commerce (marketplace ouest-africaine) vers ${SUPPORTED[target].name}. ` +
        `Réponds uniquement avec la traduction, sans commentaire. Contexte: ${context}. ` +
        `Garde les montants FCFA et noms propres inchangés.`,
      messages: [{ role: 'user', content: text }],
      maxTokens: Math.max(300, text.length * 2),
    });
    return { text: translated.trim(), target, source: 'ai' };
  }

  // Repli lexical mot à mot (démo).
  const lex = LEXICON[target] || {};
  let out = text;
  for (const [fr, tr] of Object.entries(lex)) {
    out = out.replace(new RegExp(`\\b${fr}\\b`, 'g'), tr);
  }
  return { text: out, target, source: 'local-lexicon' };
}

function languages() {
  return Object.entries(SUPPORTED).map(([code, v]) => ({ code, ...v }));
}

module.exports = { translate, languages, SUPPORTED };
