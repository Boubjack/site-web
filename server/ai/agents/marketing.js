/**
 * AGENT — AI Marketing. Slogans, affiches, publications Facebook/Instagram/
 * TikTok, campagnes publicitaires (Ramadan, Tabaski, Black Friday), + emails,
 * SMS et notifications push. Permissions : vendeur/admin.
 */
const provider = require('../provider/llm');
const marketing = require('../services/marketing');
const catalog = require('../services/catalog');
const { store } = require('../../db/store');

function channelPosts(kit) {
  return {
    facebook: `${kit.socialPost}\n\n👉 Commandez sur E-Market.`,
    instagram: `${kit.socialPost}\n${kit.hashtags.join(' ')}`,
    tiktok: `${kit.slogan}\n${kit.hashtags.slice(0, 5).join(' ')}`,
  };
}

async function directMessages({ product, campaign }) {
  const price = catalog.formatFcfa(product.price);
  const fete = campaign && campaign !== 'standard' ? ` (spécial ${campaign})` : '';
  const fallback = {
    email: {
      subject: `${product.name} — offre à ne pas manquer${fete}`,
      body: `Bonjour,\n\nDécouvrez ${product.name} à ${price} sur E-Market${fete}.\nLivraison 24-72h à Bamako, paiement à la livraison.\n\nCommandez maintenant → E-Market.\n\nÀ bientôt,\nL'équipe E-Market`,
    },
    sms: `E-Market: ${product.name} à ${price}${fete}. Livraison 24-72h Bamako. Commandez: emarket.ml`,
    push: { title: `${product.name}${fete}`, body: `${price} — livraison rapide. Commandez sur E-Market 🧡` },
  };
  if (!provider.enabled()) return fallback;
  try {
    const schema = {
      type: 'object',
      properties: {
        email: { type: 'object', properties: { subject: { type: 'string' }, body: { type: 'string' } }, required: ['subject', 'body'], additionalProperties: false },
        sms: { type: 'string', description: 'SMS ≤ 160 caractères' },
        push: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' } }, required: ['title', 'body'], additionalProperties: false },
      },
      required: ['email', 'sms', 'push'],
      additionalProperties: false,
    };
    return await provider.completeJson({
      system: 'Tu es rédacteur marketing e-commerce (Afrique de l\'Ouest, FCFA). Concis, percutant, local.',
      messages: [{ role: 'user', content: `Produit: ${product.name} à ${price}. Campagne: ${campaign || 'standard'}. Génère email, SMS (≤160c) et notification push.` }],
      schema,
      maxTokens: 800,
    });
  } catch { return fallback; }
}

async function run(input) {
  const product = store.getById('products', input.productId);
  if (!product) return { error: 'Produit introuvable.' };
  const campaign = input.campaign || 'standard';
  const kit = await marketing.generateKit({ productId: input.productId, campaign });
  const result = { kit, channels: channelPosts(kit), campaigns: Object.keys(marketing.CAMPAIGNS) };
  if (input.includeDirect !== false) result.direct = await directMessages({ product, campaign });
  return result;
}

module.exports = {
  id: 'marketing',
  name: 'AI Marketing',
  description: 'Slogans, affiches, posts Facebook/Instagram/TikTok, campagnes (Ramadan/Tabaski/Black Friday), emails, SMS, push.',
  allowedRoles: ['seller', 'admin'],
  keywords: ['marketing', 'pub', 'publicité', 'slogan', 'campagne', 'affiche', 'post', 'instagram', 'facebook', 'tiktok', 'email', 'sms', 'push', 'ramadan', 'tabaski', 'black friday'],
  tool: {
    name: 'marketing_kit',
    description: 'Crée un kit marketing complet pour un produit : slogan, pub, posts réseaux, hashtags, script, voix-off, + email/SMS/push. Campagnes: ramadan, tabaski, black-friday, saison.',
    input_schema: { type: 'object', properties: { productId: { type: 'string' }, campaign: { type: 'string' } }, required: ['productId'] },
  },
  run,
};
