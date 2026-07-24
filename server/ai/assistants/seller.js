/**
 * ASSISTANT 2 — E-Market Seller Assistant (IA VENDEUR).
 *
 * Objectif : aider le vendeur à vendre davantage — un coach commercial.
 * Permissions : rôle "seller" (et "admin" pour prévisualisation).
 * ISOLATION DES DONNÉES : tous les outils sont limités au vendeur connecté
 * (ctx.user.id). Chaque action sur un produit vérifie que le produit lui
 * appartient. Il ne peut JAMAIS accéder aux données d'un autre vendeur.
 * Style : coach commercial.
 */
const { store } = require('../../db/store');
const catalog = require('../services/catalog');
const analytics = require('../services/analytics');
const memory = require('../services/memory');
const sellerService = require('../services/seller');
const marketing = require('../services/marketing');
const photoAgent = require('../agents/photo');
const videoAgent = require('../agents/video');
const stockAgent = require('../agents/stock');
const reviewsAgent = require('../agents/reviews');
const orchestrator = require('../orchestrator');

const SYSTEM_PROMPT = `Tu es E-Market Seller Assistant, le coach commercial des vendeurs d'E-Market
(marketplace ouest-africaine, prix en FCFA, siège Bamako).

Ta mission : aider le vendeur connecté à vendre davantage — analyser ses
performances, optimiser ses annonces, créer du contenu marketing, et le
conseiller comme un vrai coach commercial (concret, motivant, actionnable).

Tu peux :
- créer des fiches produit (titre, descriptions, SEO, mots-clés) — generate_listing ;
- analyser ses ventes, sa croissance, son taux de conversion — my_sales_stats ;
- repérer ses produits populaires et peu performants — my_product_performance ;
- conseiller le prix idéal via les comparables du marché — pricing_advice ;
- optimiser une annonce existante — optimize_listing ;
- créer des publicités et publications (Instagram, Facebook, TikTok) — create_marketing ;
- générer un storyboard de vidéo publicitaire — create_video_ad ;
- lancer une amélioration de photo (studio IA) — enhance_photo.

RÈGLE D'ISOLATION ABSOLUE : tu ne vois QUE les données du vendeur connecté.
Tu n'as aucun accès aux autres vendeurs ni à l'administration. Les comparables
de prix sont anonymisés (fourchettes de marché), jamais nominatifs.
Réponds toujours avec des recommandations claires et priorisées.`;

/** Garde-fou : le produit doit appartenir au vendeur connecté. */
function ownProduct(ctx, productId) {
  const p = store.getById('products', productId);
  if (!p) return { error: 'Produit introuvable.' };
  if (p.sellerId !== ctx.user.id) return { error: "Ce produit ne fait pas partie de votre boutique." };
  return { product: p };
}

function buildTools() {
  return [
    {
      def: {
        name: 'generate_listing',
        description: 'Génère une fiche produit professionnelle (titre, descriptions courte/longue, catégorie, tags, SEO, arguments, prix conseillé) à partir d\'un nom simple.',
        input_schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            hints: { type: 'string', description: 'Matière, taille, état, détails' },
          },
          required: ['name'],
        },
      },
      run: (input) => sellerService.generateListing({ name: input.name, hints: input.hints || '' }),
    },
    {
      def: {
        name: 'my_sales_stats',
        description: 'Statistiques de vente du vendeur connecté : chiffre d\'affaires, unités, croissance, panier moyen, taux de conversion, top produits.',
        input_schema: { type: 'object', properties: { days: { type: 'number', description: 'Période en jours (défaut 30)' } } },
      },
      run: (input, ctx) => analytics.sellerSalesStats(ctx.user.id, { days: input.days || 30 }),
    },
    {
      def: {
        name: 'my_product_performance',
        description: 'Produits du vendeur les mieux et les moins performants (ventes, vues, revenu, stock).',
        input_schema: { type: 'object', properties: { days: { type: 'number' } } },
      },
      run: (input, ctx) => analytics.sellerProductPerformance(ctx.user.id, { days: input.days || 30 }),
    },
    {
      def: {
        name: 'pricing_advice',
        description: 'Conseil de prix pour un produit du vendeur, basé sur la fourchette anonymisée des produits comparables du marché.',
        input_schema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] },
      },
      run: ({ productId }, ctx) => {
        const own = ownProduct(ctx, productId);
        if (own.error) return own;
        const p = own.product;
        const comparables = store.find('products', (x) => x.subcategory === p.subcategory && x.id !== p.id && x.active !== false);
        if (!comparables.length) return { productPrice: p.price, market: null, note: 'Aucun comparable — fixez selon votre coût et votre marge.' };
        const prices = comparables.map((c) => c.price).sort((a, b) => a - b);
        const avg = Math.round(prices.reduce((s, x) => s + x, 0) / prices.length);
        return {
          productPrice: p.price,
          market: { min: prices[0], median: prices[Math.floor(prices.length / 2)], max: prices[prices.length - 1], average: avg, sampleSize: prices.length },
          position: p.price > avg ? 'au-dessus du marché' : p.price < avg ? 'en-dessous du marché' : 'aligné',
        };
      },
    },
    {
      def: {
        name: 'optimize_listing',
        description: 'Régénère une annonce optimisée (titre, descriptions, SEO) pour un produit existant du vendeur.',
        input_schema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] },
      },
      run: async ({ productId }, ctx) => {
        const own = ownProduct(ctx, productId);
        if (own.error) return own;
        const p = own.product;
        const listing = await sellerService.generateListing({ name: p.name, hints: `${p.material || ''} ${p.description || ''}`.slice(0, 300) });
        return { current: { name: p.name, price: p.price }, optimized: listing };
      },
    },
    {
      def: {
        name: 'create_marketing',
        description: 'Crée un kit de contenu marketing pour un produit du vendeur : slogan, texte pub, publication réseaux sociaux (Instagram/Facebook/TikTok), hashtags, script, voix-off.',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            campaign: { type: 'string', description: 'standard | ramadan | tabaski | black-friday | saison' },
            channel: { type: 'string', description: 'instagram | facebook | tiktok | general' },
          },
          required: ['productId'],
        },
      },
      run: async ({ productId, campaign, channel }, ctx) => {
        const own = ownProduct(ctx, productId);
        if (own.error) return own;
        const kit = await marketing.generateKit({ productId, campaign: campaign || 'standard' });
        return { channel: channel || 'general', kit };
      },
    },
    {
      def: {
        name: 'create_video_ad',
        description: 'AI Video Pro : génère un plan de production vidéo publicitaire cinématographique (scénario, storyboard, plans caméra, éclairage, animations, voix-off, musique, montage) pour un produit du vendeur. Le vendeur choisit produit, style, durée.',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            style: { type: 'string', description: 'luxe | streetwear | sport | elegant | minimaliste | premium | energique' },
            duration: { type: 'number', description: 'Durée en secondes (6-60)' },
            format: { type: 'string', description: 'tiktok | instagram | facebook | youtube | catalogue' },
          },
          required: ['productId'],
        },
      },
      run: async (input, ctx) => {
        const own = ownProduct(ctx, input.productId);
        if (own.error) return own;
        if (input.style) memory.remember(ctx.user.id, 'seller', { styleVideoPrefere: input.style });
        const r = await videoAgent.run(input, ctx);
        return { jobId: r.jobId, format: r.plan.format, plan: r.plan };
      },
    },
    {
      def: {
        name: 'create_photo',
        description: 'AI Photo Pro : crée un dossier de production photo professionnel (type de photo, mise en scène intelligente, mannequin, multi-angles, pipeline 4K/8K) pour un produit du vendeur. 14 types disponibles.',
        input_schema: {
          type: 'object',
          properties: {
            productId: { type: 'string' },
            photoType: { type: 'string', description: 'catalogue-ecommerce | studio-blanc | premium-noir | luxe | lifestyle | publicitaire | flat-lay | magazine …' },
            resolution: { type: 'string', description: '1080p | 2k | 4k | 8k' },
            mannequin: { type: 'boolean' },
            multiAngle: { type: 'boolean' },
          },
        },
      },
      run: async (input, ctx) => {
        if (input.productId) { const own = ownProduct(ctx, input.productId); if (own.error) return own; }
        const r = await photoAgent.run({ ...input, action: 'produce' }, ctx);
        return { jobId: r.jobId, spec: r.spec };
      },
    },
    {
      def: {
        name: 'create_full_ad',
        description: 'Publicité complète : mobilise plusieurs agents IA qui collaborent (Produit → Photo → Vidéo → Marketing) via l\'orchestrateur, pour un produit du vendeur.',
        input_schema: { type: 'object', properties: { productId: { type: 'string' } }, required: ['productId'] },
      },
      run: async ({ productId }, ctx) => {
        const own = ownProduct(ctx, productId);
        if (own.error) return own;
        return orchestrator.handle({ user: ctx.user, text: 'créer une publicité vidéo complète', productId });
      },
    },
    {
      def: {
        name: 'stock_alerts',
        description: 'AI Stock : alertes de rupture de stock pour la boutique du vendeur (vitesse de vente, jours de couverture, saison).',
        input_schema: { type: 'object', properties: {} },
      },
      run: (_input, ctx) => stockAgent.analyze({ sellerId: ctx.user.id }),
    },
    {
      def: {
        name: 'analyze_reviews',
        description: 'AI Analyse des avis : points positifs, négatifs, problèmes récurrents et satisfaction, pour un produit du vendeur ou toute sa boutique.',
        input_schema: { type: 'object', properties: { productId: { type: 'string' } } },
      },
      run: async ({ productId }, ctx) => {
        if (productId) { const own = ownProduct(ctx, productId); if (own.error) return own; return reviewsAgent.run({ productId }, ctx); }
        return reviewsAgent.run({ sellerId: ctx.user.id }, ctx);
      },
    },
  ];
}

function localFallback(ctx, messages) {
  const last = [...messages].reverse().find((m) => m.role === 'user');
  const q = catalog.normalize(typeof last?.content === 'string' ? last.content : '');
  const f = catalog.formatFcfa;

  if (/optimis|produit|performan|faible|populaire/.test(q)) {
    const perf = analytics.sellerProductPerformance(ctx.user.id, { days: 30 });
    return {
      text: 'Vos produits (30 jours) :\n' +
        'MEILLEURS :\n' + (perf.best.map((p) => `• ${p.name} — ${p.unitsSold} vendus — ${f(p.revenue)}`).join('\n') || '• (aucune vente)') +
        '\nÀ OPTIMISER (0 vente) :\n' + (perf.weak.map((p) => `• ${p.name} — ${p.views} vues`).join('\n') || '• (aucun)') +
        '\n\nConseil : retravaillez le titre, les photos et le prix des produits vus mais non achetés.',
    };
  }
  const stats = analytics.sellerSalesStats(ctx.user.id, { days: 30 });
  return {
    text: `Vos ventes (30 jours) :\n• CA : ${f(stats.revenueFcfa)} (net ${f(stats.netRevenueFcfa)} après commission)\n` +
      `• Unités : ${stats.unitsSold} · Commandes : ${stats.orderCount} · Panier moyen : ${f(stats.averageOrderFcfa)}\n` +
      `• Croissance : ${stats.growthPct === null ? 'n/a' : stats.growthPct + '%'}\n` +
      `• Conversion : ${stats.conversion.ratePct === null ? 'n/a' : stats.conversion.ratePct + '%'} (${stats.conversion.purchases} achats / ${stats.conversion.views} vues)\n` +
      `• Top : ${stats.topProducts[0] ? stats.topProducts[0].name : 'n/a'}\n\n` +
      `Demandez-moi : « optimise mes produits faibles », « crée une pub », « conseil de prix ».`,
  };
}

module.exports = {
  id: 'seller',
  name: 'E-Market Seller Assistant',
  description: 'Votre coach commercial — vendez plus, mieux.',
  style: 'coach commercial actionnable',
  avatar: '📈',
  accent: '#10b981',
  allowedRoles: ['seller', 'admin'],
  memoryNamespace: 'seller',
  greeting: "Salut 👋 Je suis votre coach commercial E-Market. Je n'analyse que VOTRE boutique. Ventes, optimisation, alertes de stock, avis clients, photos/vidéos Pro, pub complète — demandez !",
  features: {},
  quickActions: [
    { label: '📊 Analyser mes ventes', prompt: 'Analyse mes ventes des 30 derniers jours et donne-moi 3 priorités.' },
    { label: '📦 Alertes de stock', prompt: 'Quels produits risquent la rupture de stock ?' },
    { label: '⭐ Analyse des avis', prompt: 'Analyse les avis de ma boutique : points forts et problèmes récurrents.' },
    { label: '🎬 Pub complète IA', prompt: 'Crée une publicité vidéo complète pour mon meilleur produit.' },
  ],
  suggestions: [
    'Rédige une fiche pour « chemise en wax faite main, tailles M à XL »',
    'Crée une photo premium fond noir en 4K pour mon produit phare',
    'Génère une vidéo TikTok style premium de 20 secondes',
  ],
  systemPrompt: SYSTEM_PROMPT,
  buildTools,
  localFallback,
};
