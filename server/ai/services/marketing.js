/**
 * 8. IA CRÉATEUR PUBLICITAIRE — assistant marketing.
 * À partir d'un produit : slogan, texte publicitaire, publication réseaux
 * sociaux, hashtags, script vidéo, voix-off. Campagnes : Ramadan, Tabaski,
 * Black Friday, promotions saisonnières.
 */
const provider = require('../provider/anthropic');
const catalog = require('./catalog');
const { store } = require('../../db/store');

const CAMPAIGNS = {
  standard: 'Aucune campagne particulière — mise en avant du produit.',
  ramadan: 'Campagne Ramadan : ton respectueux et chaleureux, moments de partage, iftar, préparation de la fête.',
  tabaski: 'Campagne Tabaski (Aïd el-Kebir) : fête, tenues neuves, famille, élégance, promotions spéciales fête.',
  'black-friday': 'Black Friday : urgence, réductions fortes, stock limité, compte à rebours.',
  saison: 'Promotion saisonnière : renouvellement, bons plans du moment.',
};

const KIT_SCHEMA = {
  type: 'object',
  properties: {
    slogan: { type: 'string' },
    adCopy: { type: 'string', description: 'Texte publicitaire (2-3 phrases)' },
    socialPost: { type: 'string', description: 'Publication réseaux sociaux prête à poster (avec emojis)' },
    hashtags: { type: 'array', items: { type: 'string' } },
    videoScript: { type: 'string', description: 'Script vidéo 20s (scène par scène)' },
    voiceOver: { type: 'string', description: 'Texte de voix-off (~15s à lire)' },
  },
  required: ['slogan', 'adCopy', 'socialPost', 'hashtags', 'videoScript', 'voiceOver'],
  additionalProperties: false,
};

async function generateKit({ productId, campaign = 'standard', tone = 'énergique' }) {
  const product = store.getById('products', productId);
  if (!product) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
  const campaignBrief = CAMPAIGNS[campaign] || CAMPAIGNS.standard;
  const card = catalog.productCard(product);

  if (!provider.enabled()) return localKit(card, campaign);

  return provider.completeJson({
    system:
      "Tu es le créatif publicitaire d'E-Market (marketplace ouest-africaine, Bamako). Tu écris en français avec des touches locales, percutant et authentique. Prix en FCFA.",
    messages: [{
      role: 'user',
      content:
        `Produit : ${card.name}\nPrix : ${catalog.formatFcfa(card.price)}\nDescription : ${card.description}\n` +
        `Vendeur : ${card.seller ? card.seller.shop : 'E-Market'}\n` +
        `Campagne : ${campaignBrief}\nTon : ${tone}\n\nGénère le kit publicitaire complet.`,
    }],
    schema: KIT_SCHEMA,
    maxTokens: 2048,
  });
}

function localKit(card, campaign) {
  const price = catalog.formatFcfa(card.price);
  const fete = campaign === 'tabaski' ? ' spécial Tabaski' : campaign === 'ramadan' ? ' spécial Ramadan' : campaign === 'black-friday' ? ' Black Friday' : '';
  return {
    slogan: `${card.name} — le choix malin${fete} !`,
    adCopy: `${card.name} à seulement ${price} sur E-Market. Qualité vérifiée, livraison 24-72h à Bamako, paiement à la livraison.${fete ? ` Offre${fete}, stock limité !` : ''}`,
    socialPost: `🔥 ${card.name}${fete ? ` — offre${fete} !` : ''}\n💰 ${price} seulement\n🚚 Livraison rapide à Bamako\n👉 Commandez sur E-Market !`,
    hashtags: ['#EMarket', '#Bamako', '#Mali', `#${card.category.replace(/-/g, '')}`, ...(fete ? [`#${campaign.replace('-', '')}`] : []), '#BonPlan'],
    videoScript: `0-3s : gros plan produit sur fond noir, texte "${card.name}".\n3-8s : rotation produit, points forts en texte animé.\n8-14s : mise en situation, prix ${price} en orange.\n14-20s : logo E-Market + CTA "Commandez maintenant".`,
    voiceOver: `${card.name}, disponible dès maintenant sur E-Market à ${price}. Qualité garantie, livraison express à Bamako. E-Market, votre marché, en mieux.`,
    local: true,
  };
}

module.exports = { generateKit, CAMPAIGNS };
