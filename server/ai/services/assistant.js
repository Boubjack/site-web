/**
 * 1. E-MARKET ASSISTANT — chat IA client (+ 10. service client, même moteur).
 * Streaming SSE, boucle d'outils sur le catalogue réel, repli local sans clé.
 */
const provider = require('../provider/anthropic');
const prompts = require('../provider/prompts');
const catalog = require('./catalog');
const memory = require('./memory');
const { store } = require('../../db/store');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:assistant');

const TOOLS = [
  {
    name: 'search_products',
    description:
      "Recherche des produits dans le catalogue E-Market. Appelle cet outil dès qu'un client cherche, compare ou demande une recommandation produit. Retourne des cartes produit (id, nom, prix FCFA, vendeur, note, stock).",
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Mots-clés en français (ex: "boubou mariage homme")' },
        category: { type: 'string', description: 'mode-homme | mode-femme | electronique | chaussures | accessoires' },
        maxPrice: { type: 'number', description: 'Budget maximum en FCFA' },
        occasion: { type: 'string', description: 'mariage, ceremonie, soiree, casual, tabaski...' },
        color: { type: 'string' },
        gender: { type: 'string', description: 'homme | femme | unisexe' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product',
    description: 'Récupère la fiche complète d\'un produit par son id (specs, tailles, couleurs, avis clients).',
    input_schema: {
      type: 'object',
      properties: { productId: { type: 'string' } },
      required: ['productId'],
    },
  },
  {
    name: 'get_my_orders',
    description: 'Liste les commandes du client connecté (statut, montant, articles). À utiliser pour le suivi de commande.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'escalate_to_human',
    description: 'Transfère la conversation vers un opérateur humain en créant un ticket support. À utiliser pour les litiges, remboursements contestés ou à la demande du client.',
    input_schema: {
      type: 'object',
      properties: {
        subject: { type: 'string' },
        summary: { type: 'string', description: 'Résumé du problème pour l\'opérateur' },
      },
      required: ['subject', 'summary'],
    },
  },
];

function makeToolExecutor(user) {
  return async (name, input) => {
    switch (name) {
      case 'search_products':
        return { results: catalog.searchProducts({ ...input, limit: 6 }) };
      case 'get_product': {
        const p = store.getById('products', input.productId);
        if (!p) return { error: 'Produit introuvable' };
        const reviews = store.find('reviews', (r) => r.productId === p.id).map((r) => ({
          rating: r.rating, comment: r.comment,
        }));
        return { product: catalog.productCard(p), reviews };
      }
      case 'get_my_orders': {
        if (!user) return { error: 'Client non connecté. Demande-lui de se connecter.' };
        const orders = store.find('orders', (o) => o.userId === user.id).map((o) => ({
          id: o.id, status: o.status, total: o.total, date: o.createdAt,
          items: o.items.map((i) => {
            const p = store.getById('products', i.productId);
            return { name: p ? p.name : i.productId, qty: i.qty, price: i.price };
          }),
        }));
        return { orders };
      }
      case 'escalate_to_human': {
        const ticket = store.insert('supportTickets', {
          userId: user ? user.id : null,
          subject: input.subject,
          summary: input.summary,
          status: 'ouvert',
          source: 'ai-escalation',
        });
        log.info('ticket créé par escalade IA', { ticketId: ticket.id });
        return { ticketId: ticket.id, status: 'ouvert', message: 'Un opérateur humain prendra contact sous 24h.' };
      }
      default:
        return { error: `Outil inconnu: ${name}` };
    }
  };
}

/** Extrait la ligne PRODUCTS:[...] de la réponse du modèle. */
function extractProductIds(text) {
  const m = text.match(/PRODUCTS:\s*\[([^\]]*)\]/);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
}

function stripProductLine(text) {
  return text.replace(/\n?PRODUCTS:\s*\[[^\]]*\]\s*$/m, '').trim();
}

/**
 * Conversation streamée (SSE). mode: 'shopping' | 'support'.
 */
async function chatStream({ messages, user, mode = 'shopping', sse }) {
  const system = mode === 'support' ? prompts.SUPPORT_AGENT : prompts.CLIENT_ASSISTANT;

  if (!provider.enabled()) {
    return localFallback({ messages, user, mode, sse });
  }

  // Mémoire utilisateur (préférences) injectée comme contexte volatil.
  const memoryNote = user ? memory.summaryFor(user.id) : null;
  const history = [...messages];
  if (memoryNote && history.length) {
    const last = history[history.length - 1];
    history[history.length - 1] = {
      ...last,
      content: `${last.content}\n\n<contexte_client>${memoryNote}</contexte_client>`,
    };
  }

  let buffered = '';
  const { text } = await provider.agentLoop({
    system,
    messages: history,
    tools: TOOLS,
    executeTool: makeToolExecutor(user),
    onToolUse: (name) => sse('status', { tool: name }),
    onText: (delta) => {
      buffered += delta;
      // Ne pas streamer la ligne technique PRODUCTS:[...] au client.
      if (!buffered.includes('PRODUCTS:')) sse('text', { delta });
    },
  });

  const productIds = extractProductIds(text);
  const products = productIds
    .map((id) => store.getById('products', id))
    .filter(Boolean)
    .map(catalog.productCard);

  if (user) memory.learnFromMessage(user.id, messages[messages.length - 1]?.content || '');

  sse('done', { text: stripProductLine(text), products });
}

/** Moteur local (sans clé API) : NLU par règles + catalogue. */
function localFallback({ messages, user, mode, sse }) {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const query = typeof lastUser?.content === 'string' ? lastUser.content : '';
  const q = catalog.normalize(query);

  let text;
  let products = [];

  if (mode === 'support' || /commande|livraison|retour|paiement|rembours|compte|vendeur/.test(q)) {
    if (/commande|suivi|livr/.test(q) && user) {
      const orders = store.find('orders', (o) => o.userId === user.id);
      text = orders.length
        ? `Voici vos commandes :\n${orders.map((o) => `• ${o.id} — ${catalog.formatFcfa(o.total)} — statut : ${o.status}`).join('\n')}\n\nBesoin d'autre chose ?`
        : "Vous n'avez pas encore de commande. Je peux vous aider à trouver un produit ?";
    } else if (/retour/.test(q)) {
      text = 'Les retours sont acceptés sous 14 jours pour tout produit non porté, dans son emballage d\'origine. Rendez-vous dans "Mes commandes" pour lancer un retour.';
    } else if (/paiement|payer/.test(q)) {
      text = 'Nous acceptons Orange Money, Moov Money, carte bancaire et le paiement à la livraison à Bamako.';
    } else if (/vendeur|vendre/.test(q)) {
      text = "Devenir vendeur est gratuit : créez un compte vendeur, ajoutez vos produits (notre IA rédige vos fiches), et E-Market prélève 8% par vente.";
    } else if (/livraison/.test(q)) {
      text = 'Livraison à Bamako sous 24-72h, et 3 à 7 jours pour les régions. Frais calculés au moment de la commande.';
    } else {
      const ticket = store.insert('supportTickets', {
        userId: user ? user.id : null,
        subject: 'Demande support (mode local)',
        summary: query.slice(0, 300),
        status: 'ouvert',
        source: 'ai-local-fallback',
      });
      text = `Je transmets votre demande à un opérateur humain (ticket ${ticket.id}). Vous serez recontacté sous 24h.`;
    }
  } else {
    products = catalog.searchProducts({ query, limit: 4 });
    const budget = catalog.extractBudget(query);
    if (products.length) {
      text = `Voici ma sélection${budget ? ` pour un budget de ${catalog.formatFcfa(budget)}` : ''} :\n` +
        products.map((p) => `• ${p.emoji} ${p.name} — ${catalog.formatFcfa(p.price)} (${p.seller?.shop}${p.rating ? `, ★${p.rating}` : ''})`).join('\n') +
        '\n\nDites-moi votre taille ou couleur préférée pour affiner !';
    } else {
      text = "Je n'ai pas trouvé de produit correspondant. Précisez la catégorie (mode, électronique, accessoires...) ou votre budget en FCFA ?";
    }
  }

  if (user) memory.learnFromMessage(user.id, query);
  sse('text', { delta: text });
  sse('done', { text, products, local: true });
}

module.exports = { chatStream, TOOLS, makeToolExecutor };
