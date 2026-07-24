/**
 * ASSISTANT 1 — E-Market Shopping Assistant (IA CLIENT).
 *
 * Objectif : aider les clients à acheter.
 * Permissions : public (invités + clients). Ne voit JAMAIS les données privées
 * des vendeurs ni les outils d'administration — ses outils n'exposent que le
 * catalogue public et les commandes du client connecté.
 * Style : conseiller personnel de shopping.
 */
const { store } = require('../../db/store');
const catalog = require('../services/catalog');
const memory = require('../services/memory');
const { CONTEXT } = require('./brand');

const SYSTEM_PROMPT = `Tu es E-Market Shopping Assistant, le conseiller personnel de shopping des
clients d'E-Market. ${CONTEXT}

Ta mission : aider le client à trouver et choisir le bon produit, avec chaleur
et efficacité, comme un vrai personal shopper.

Tu peux :
- trouver des produits (search_products) ;
- recommander et comparer des produits (compare_products) ;
- conseiller selon le budget, la taille, la couleur, l'occasion ;
- proposer des idées de cadeaux (gift_ideas) ;
- répondre aux questions sur les commandes du client et le suivi (get_my_orders) ;
- expliquer les modes de paiement et la livraison (voir ci-dessous).

Connaissances service client (réponds directement, sans outil) :
- Paiement : Orange Money, Moov Money, carte bancaire, paiement à la livraison à Bamako.
- Livraison : Bamako 24-72h, régions 3-7 jours.
- Retours : 14 jours, produit non porté dans son emballage.

Règles :
- Tu n'as accès qu'au catalogue public et aux commandes du client connecté.
- Tu ne connais PAS les statistiques des vendeurs ni l'administration ; si on te
  le demande, explique poliment que ce n'est pas ton rôle.
- Pour un budget donné, ne propose que des produits à un prix inférieur ou égal.
- Quand tu proposes des produits, termine par une ligne PRODUCTS:[id1,id2,...]
  avec les identifiants exacts (le site les affiche en cartes). N'affiche jamais
  cette ligne autrement.`;

function buildTools() {
  return [
    {
      def: {
        name: 'search_products',
        description: "Recherche dans le catalogue public E-Market. À utiliser dès qu'un client cherche, compare ou demande une recommandation.",
        input_schema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Mots-clés (ex: "boubou mariage homme")' },
            category: { type: 'string', description: 'mode-homme | mode-femme | electronique | chaussures | accessoires' },
            maxPrice: { type: 'number', description: 'Budget maximum en FCFA' },
            occasion: { type: 'string', description: 'mariage, ceremonie, soiree, casual, tabaski...' },
            color: { type: 'string' },
            gender: { type: 'string', description: 'homme | femme | unisexe' },
          },
          required: ['query'],
        },
      },
      run: (input) => ({ results: catalog.searchProducts({ ...input, limit: 6 }) }),
    },
    {
      def: {
        name: 'get_product',
        description: "Fiche complète d'un produit (specs, tailles, couleurs, avis publics) par son id.",
        input_schema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] },
      },
      run: ({ productId }) => {
        const p = store.getById('products', productId);
        if (!p || p.active === false) return { error: 'Produit introuvable' };
        const reviews = store.find('reviews', (r) => r.productId === p.id).map((r) => ({ rating: r.rating, comment: r.comment }));
        return { product: catalog.productCard(p), reviews };
      },
    },
    {
      def: {
        name: 'compare_products',
        description: 'Compare 2 à 4 produits (prix, caractéristiques, avis) pour aider le client à choisir.',
        input_schema: {
          type: 'object',
          properties: { productIds: { type: 'array', items: { type: 'string' } } },
          required: ['productIds'],
        },
      },
      run: ({ productIds }) => {
        const items = (productIds || []).slice(0, 4).map((id) => store.getById('products', id)).filter(Boolean).map((p) => {
          const card = catalog.productCard(p);
          return { id: card.id, name: card.name, price: card.price, rating: card.rating, specs: card.specs, colors: card.colors, sizes: card.sizes };
        });
        return { comparison: items };
      },
    },
    {
      def: {
        name: 'gift_ideas',
        description: 'Génère des idées de cadeaux adaptées au destinataire, au budget et à l\'occasion, à partir du catalogue.',
        input_schema: {
          type: 'object',
          properties: {
            recipient: { type: 'string', description: 'ex: ma mère, un ami, ado...' },
            budget: { type: 'number', description: 'Budget en FCFA' },
            occasion: { type: 'string' },
            interests: { type: 'string' },
          },
        },
      },
      run: (input) => {
        const query = [input.recipient, input.occasion, input.interests].filter(Boolean).join(' ');
        return { ideas: catalog.searchProducts({ query: query || 'cadeau', maxPrice: input.budget, occasion: input.occasion, limit: 6 }) };
      },
    },
    {
      def: {
        name: 'get_my_orders',
        description: 'Commandes du client connecté (statut, montant, articles) pour le suivi de commande.',
        input_schema: { type: 'object', properties: {} },
      },
      run: (_input, ctx) => {
        if (!ctx.user) return { error: 'Client non connecté. Invite-le à se connecter pour suivre ses commandes.' };
        const orders = store.find('orders', (o) => o.userId === ctx.user.id).map((o) => ({
          id: o.id, status: o.status, total: o.total, date: o.createdAt,
          items: o.items.map((i) => {
            const p = store.getById('products', i.productId);
            return { name: p ? p.name : i.productId, qty: i.qty };
          }),
        }));
        return { orders };
      },
    },
  ];
}

function finalize(text) {
  const ids = require('./registry').parseDirective(text, 'PRODUCTS');
  const products = ids.map((id) => store.getById('products', id)).filter(Boolean).map(catalog.productCard);
  return { products };
}

/** Moteur local (sans clé API) : NLU par règles sur le catalogue. */
function localFallback(ctx, messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const query = typeof last?.content === 'string' ? last.content : '';
  const q = catalog.normalize(query);
  let text; let products = [];

  if (/commande|suivi|livr/.test(q) && ctx.user) {
    const orders = store.find('orders', (o) => o.userId === ctx.user.id);
    text = orders.length
      ? `Voici vos commandes :\n${orders.map((o) => `• ${o.id.slice(0, 8)} — ${catalog.formatFcfa(o.total)} — ${o.status}`).join('\n')}`
      : "Vous n'avez pas encore de commande. Je peux vous aider à trouver un produit ?";
  } else if (/paiement|payer/.test(q)) {
    text = 'Paiements acceptés : Orange Money, Moov Money, carte bancaire et paiement à la livraison à Bamako.';
  } else if (/retour/.test(q)) {
    text = 'Retours acceptés sous 14 jours pour tout produit non porté, dans son emballage.';
  } else if (/livraison/.test(q)) {
    text = 'Livraison à Bamako sous 24-72h, 3 à 7 jours pour les régions.';
  } else {
    products = catalog.searchProducts({ query, limit: 4 });
    const budget = catalog.extractBudget(query);
    text = products.length
      ? `Voici ma sélection${budget ? ` pour ${catalog.formatFcfa(budget)}` : ''} :\n${products.map((p) => `• ${p.emoji} ${p.name} — ${catalog.formatFcfa(p.price)}`).join('\n')}\n\nVotre taille ou couleur préférée pour affiner ?`
      : "Je n'ai pas trouvé de produit correspondant. Précisez la catégorie ou votre budget en FCFA ?";
  }
  if (ctx.user) memory.learnFromMessage(ctx.user.id, query);
  return { text, products };
}

module.exports = {
  id: 'shopping',
  name: 'E-Market Shopping Assistant',
  description: 'Votre conseiller personnel de shopping.',
  style: 'conseiller shopping chaleureux',
  avatar: '🛍️',
  accent: '#1a8cff',
  allowedRoles: null, // public
  greeting: "Bonjour 👋 Je suis votre conseiller shopping E-Market. Dites-moi ce que vous cherchez — par exemple : « une tenue de mariage à Bamako pour 50 000 FCFA ».",
  features: { products: true },
  directives: ['PRODUCTS'],
  quickActions: [
    { label: '🎁 Idées cadeaux', prompt: "Donne-moi des idées de cadeaux." },
    { label: '📦 Suivre ma commande', prompt: 'Où en est ma commande ?' },
    { label: '💳 Modes de paiement', prompt: 'Quels sont les modes de paiement ?' },
    { label: '⚖️ Comparer', prompt: 'Aide-moi à comparer deux produits.' },
  ],
  suggestions: [
    'Une robe élégante noire pour une soirée',
    'Un téléphone puissant pour jouer à moins de 200 000 FCFA',
    'Une tenue de mariage homme à 50 000 FCFA',
  ],
  systemPrompt: SYSTEM_PROMPT,
  buildTools,
  finalize,
  localFallback,
};
