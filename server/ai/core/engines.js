/**
 * Définition et enregistrement des MOTEURS IA dans le AI Core Engine.
 *
 * Chaque moteur est indépendant et enveloppe une capacité existante (ou un
 * nouveau petit service) derrière l'interface uniforme du Core. Ajouter un
 * moteur = pousser un objet dans ENGINES ; aucun autre moteur n'est modifié.
 */
const SELLER = ['seller', 'admin'];
const ADMIN = ['admin'];

/** Résout le sellerId (le vendeur ne voit que sa boutique ; l'admin peut cibler). */
function sellerId(input, ctx) {
  return ctx.user && ctx.user.role === 'admin' ? (input.sellerId || ctx.user.id) : (ctx.user ? ctx.user.id : null);
}

/* ---- Capacités existantes réutilisées ---- */
const theme = require('../studio/theme');
const palette = require('../studio/palette');
const storebuilder = require('../studio/storebuilder');
const storeRender = require('../studio/store-render');
const animations = require('../studio/animations');
const brandkit = require('../studio/brandkit');
const creative = require('../studio/creative');
const commerce = require('../services/commerce');
const marketing = require('../services/marketing');
const pricing = require('../services/pricing');
const search = require('../services/search');
const suggest = require('../services/suggest');
const vectors = require('../services/vectors');
const recommender = require('../services/recommender');
const analytics = require('../services/analytics');
const brain = require('../services/brain');
const fraud = require('../services/fraud');
const performance = require('../services/performance');
const accessibility = require('../services/accessibility');
const brandGuardian = require('../services/brand-guardian');
const videoAgent = require('../agents/video');
const clientEngine = require('../services/client-engine');
const operatorEngine = require('../services/operator-engine');
const ctoEngine = require('../services/cto-engine');
const i18n = require('../services/i18n');
const agents = require('../agents');
const { store } = require('../../db/store');

const ENGINES = [
  /* ---------------- DESIGN ---------------- */
  {
    id: 'theme', name: 'AI Theme Engine', category: 'design', allowedRoles: SELLER,
    description: 'Identité graphique : palettes originales, thèmes par secteur, fusion Brand Kit.',
    actions: {
      generate: { description: 'Thème complet pour une catégorie.', cacheTtlMs: 30000, handler: (i, ctx) => theme.generate({ category: i.category || 'mode', sellerId: sellerId(i, ctx) }) },
      palette: { description: 'Palette harmonieuse originale (accent + positionnement).', handler: (i) => palette.generate({ accent: i.accent, positioning: i.positioning, seed: i.seed || 0, dark: i.dark !== false }) },
      categories: { description: 'Catégories de thèmes disponibles.', handler: () => ({ categories: theme.categories() }) },
    },
  },
  {
    id: 'layout', name: 'AI Layout Engine', category: 'design', allowedRoles: SELLER,
    description: 'Structure & parcours : génère la charpente des pages selon le brief. Indépendant du Theme Engine.',
    actions: {
      plan: {
        description: 'Structure de pages/sections pour un brief (3 propositions).',
        handler: (i) => ({ proposals: storebuilder.generateProposals(i, 3).map((b) => ({ id: b.id, direction: b.direction, sector: b.sector, pages: b.pages, layout: b.layout })) }),
      },
      sectors: { description: 'Secteurs et directions de mise en page.', handler: () => ({ sectors: Object.entries(storebuilder.SECTORS).map(([id, v]) => ({ id, label: v.label })), directions: storebuilder.DIRECTIONS.map((d) => ({ id: d.id, name: d.name })) }) },
    },
  },
  {
    id: 'component', name: 'AI Component Engine', category: 'design', allowedRoles: SELLER,
    description: 'Bibliothèque de composants + rendu réel de la boutique (HTML autonome, responsive).',
    actions: {
      render: {
        description: 'Rend la boutique du vendeur (blueprint sélectionné) en HTML.',
        handler: (i, ctx) => {
          const sid = sellerId(i, ctx);
          const seller = store.getById('users', sid);
          const products = store.find('products', (p) => p.sellerId === sid && p.active !== false);
          const doc = store.findOne('storeBlueprints', (d) => d.sellerId === sid);
          const bp = doc ? (doc.proposals.find((p) => p.proposal === (i.proposal || doc.selectedProposal || 1)) || doc.proposals[0])
            : storebuilder.generateProposals({ category: (products[0] && products[0].category) || 'generique', brandName: seller && (seller.shop || seller.name) }, 1)[0];
          return { html: storeRender.renderStorefront(bp, { seller, products }), length: undefined };
        },
      },
      catalog: { description: 'Catalogue de familles de composants + variantes.', handler: () => COMPONENT_CATALOG },
    },
  },
  {
    id: 'animation', name: 'AI Animation Engine', category: 'design', allowedRoles: null,
    description: 'Bibliothèque d\'animations premium (scroll, hover, transitions, loading, micro-interactions).',
    actions: {
      catalog: { description: 'Catalogue complet d\'animations + courbes.', handler: () => animations.catalog() },
      profile: { description: 'Profil d\'animation selon une personnalité de marque.', handler: (i) => animations.profile(i.mood) },
    },
  },
  {
    id: 'branding', name: 'AI Branding Engine', category: 'design', allowedRoles: SELLER,
    description: 'Brand Kit du vendeur : identité appliquée à toutes les créations.',
    actions: {
      get: { description: 'Brand Kit courant.', handler: (i, ctx) => brandkit.getForSeller(sellerId(i, ctx)) },
      save: { description: 'Enregistre le Brand Kit.', handler: (i, ctx) => brandkit.save(sellerId(i, ctx), i) },
      styleGuide: { description: 'Guide de style injectable.', handler: (i, ctx) => brandkit.styleGuide(brandkit.getForSeller(sellerId(i, ctx))) },
    },
  },

  /* ---------------- COMMERCE ---------------- */
  {
    id: 'commerce', name: 'AI Commerce Engine', category: 'commerce', allowedRoles: SELLER,
    description: 'Analyse comportementale + propositions d\'amélioration (validées par le vendeur).',
    actions: {
      analyze: { description: 'Métriques d\'engagement de la boutique.', handler: (i, ctx) => commerce.analyze(sellerId(i, ctx)) },
      recommendations: { description: 'Propositions d\'optimisation (le vendeur décide).', handler: (i, ctx) => commerce.recommendations(sellerId(i, ctx)) },
      merchandising: { description: 'Marchandisage intelligent (produits à mettre en avant).', handler: (i, ctx) => commerce.merchandising(sellerId(i, ctx)) },
    },
  },
  {
    id: 'marketing', name: 'AI Marketing Engine', category: 'commerce', allowedRoles: SELLER,
    description: 'Kits publicitaires + campagne complète (respect du Brand Kit).',
    actions: {
      kit: { description: 'Kit pub d\'un produit.', handler: (i) => marketing.generateKit({ productId: i.productId, campaign: i.campaign }) },
      campaign: { description: '« Créer ma campagne » (pack complet).', handler: (i, ctx) => creative.fullCampaign(i, sellerId(i, ctx)) },
    },
  },
  {
    id: 'pricing', name: 'AI Pricing Engine', category: 'commerce', allowedRoles: SELLER,
    description: 'Recommandation de prix (marché + positionnement + marge).',
    actions: {
      suggest: { description: 'Prix conseillé + fourchette pour un produit.', handler: (i) => pricing.suggest({ productId: i.productId }) },
    },
  },
  {
    id: 'inventory', name: 'AI Inventory Engine', category: 'commerce', allowedRoles: SELLER,
    description: 'Prévision de rupture et alertes de stock.',
    actions: {
      alerts: { description: 'Alertes de stock de la boutique.', handler: (i, ctx) => agents.get('stock').analyze({ sellerId: sellerId(i, ctx) }) },
    },
  },

  /* ---------------- MEDIA ---------------- */
  {
    id: 'photo', name: 'AI Photo Engine', category: 'media', allowedRoles: SELLER,
    description: 'Studio photo IA : types, décors, mannequins, angles (dont 360°), retouche, export.',
    actions: {
      produce: { description: 'Dossier de production + rendu.', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'produce' }, { user: ctx.user }) },
      variants: { description: '5 variantes (angle/lumière/scène/décor).', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'variants' }, { user: ctx.user }) },
      backgrounds: { description: 'Décors adaptés + bibliothèque complète.', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'backgrounds' }, { user: ctx.user }) },
      mannequin: { description: 'Mannequin virtuel personnalisable.', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'mannequin' }, { user: ctx.user }) },
      retouch: { description: 'Smart Retouch (nettoyage + amélioration).', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'retouch' }, { user: ctx.user }) },
      export: { description: 'Options d\'export web (PNG/JPG/WEBP).', handler: (i, ctx) => agents.get('photo').run({ ...i, action: 'export' }, { user: ctx.user }) },
    },
  },
  {
    id: 'video', name: 'AI Video Engine', category: 'media', allowedRoles: SELLER,
    description: 'Studio vidéo IA : storyboard, caméra (dont time-lapse/suivi), effets, voix-off, musique, export MP4/MOV.',
    actions: {
      produce: { description: 'Plan de production vidéo + rendu.', handler: (i, ctx) => agents.get('video').run(i, { user: ctx.user }) },
      options: { description: 'Formats, styles, caméra, effets, export.', handler: () => ({ formats: Object.keys(videoAgent.FORMATS), styles: Object.keys(videoAgent.STYLES), camera: videoAgent.CAMERA_MOVES, effects: videoAgent.VIDEO_EFFECTS, fps: videoAgent.FPS, export: videoAgent.EXPORT_FORMATS }) },
    },
  },
  {
    id: 'brand-guardian', name: 'AI Brand Guardian', category: 'media', allowedRoles: SELLER,
    description: 'Vérifie la cohérence de marque AVANT chaque génération (couleurs, logo, police, ton, style) et corrige les écarts.',
    actions: {
      check: { description: 'Rapport de conformité d\'une création.', handler: (i, ctx) => brandGuardian.check(i.creation || i, sellerId(i, ctx)) },
      guard: { description: 'Renvoie une version alignée sur la marque.', handler: (i, ctx) => brandGuardian.guard(i.creation || i, sellerId(i, ctx)) },
    },
  },

  /* ---------------- INTELLIGENCE ---------------- */
  {
    id: 'search', name: 'AI Search Engine', category: 'intelligence', allowedRoles: null,
    description: 'Recherche NL + tolérance aux fautes + suggestions + repli sémantique.',
    actions: {
      query: { description: 'Recherche en langage naturel.', handler: (i, ctx) => search.search(String(i.query || ''), { userId: ctx.user ? ctx.user.id : null }) },
      suggest: { description: 'Autocomplétion instantanée.', handler: (i) => ({ suggestions: suggest.suggest(String(i.q || ''), 8) }) },
      similar: { description: 'Produits sémantiquement proches.', handler: (i) => ({ similar: vectors.similar(i.productId, { limit: 6 }).map((s) => ({ id: s.id, name: s.product.name, score: s.score })) }) },
    },
  },
  {
    id: 'recommendation', name: 'AI Recommendation Engine', category: 'intelligence', allowedRoles: null,
    description: 'Recommandations personnalisées + cross-sell.',
    actions: {
      forYou: { description: 'Recommandé pour l\'utilisateur.', handler: (i, ctx) => ({ items: recommender.forYou(ctx.user ? ctx.user.id : null, i.limit || 8) }) },
      complete: { description: 'Complétez votre achat.', handler: (i) => ({ items: recommender.completeYourPurchase(i.productId, i.limit || 3) }) },
    },
  },
  {
    id: 'analytics', name: 'AI Analytics Engine', category: 'intelligence', allowedRoles: ADMIN,
    description: 'Analytique plateforme : rapports, prévisions, score de santé.',
    actions: {
      finance: { description: 'Rapport financier.', cacheTtlMs: 15000, handler: (i) => analytics.financeReport({ days: i.days || 30 }) },
      brain: { description: 'Score de santé + opportunités/risques.', cacheTtlMs: 15000, handler: (i) => ({ health: brain.healthScore(brain.snapshot({ days: i.days || 30 })), snapshot: brain.snapshot({ days: i.days || 30 }) }) },
    },
  },
  {
    id: 'fraud', name: 'AI Fraud Engine', category: 'intelligence', allowedRoles: ADMIN,
    description: 'Détection de fraude, faux avis, comportements suspects.',
    actions: {
      overview: { description: 'Vue sécurité (vert/orange/rouge).', handler: () => fraud.overview() },
    },
  },

  /* ---------------- PLATEFORME ---------------- */
  {
    id: 'seo', name: 'AI SEO Engine', category: 'platform', allowedRoles: null,
    description: 'Métadonnées, sitemap, JSON-LD — au niveau des grandes marketplaces.',
    actions: {
      product: {
        description: 'Métadonnées SEO d\'un produit.',
        handler: (i) => {
          const p = store.getById('products', i.productId);
          if (!p) throw Object.assign(new Error('Produit introuvable.'), { status: 404 });
          return { title: `${p.name} — E-Market`, description: (p.description || '').slice(0, 160), jsonldType: 'Product', canonical: `/p/${p.id}` };
        },
      },
    },
  },
  {
    id: 'performance', name: 'AI Performance Engine', category: 'platform', allowedRoles: SELLER,
    description: 'Audit de performance web (PWA, cache, lazy, payload) + recommandations.',
    actions: { audit: { description: 'Audit + score /100.', cacheTtlMs: 60000, handler: () => performance.audit() } },
  },
  {
    id: 'accessibility', name: 'AI Accessibility Engine', category: 'platform', allowedRoles: SELLER,
    description: 'Audit d\'accessibilité (focus, thèmes, contraste, mouvement réduit) + score.',
    actions: { audit: { description: 'Audit a11y + score /100.', cacheTtlMs: 60000, handler: () => accessibility.audit() } },
  },
  {
    id: 'translation', name: 'AI Translation Engine', category: 'platform', allowedRoles: null,
    description: 'Traduction FR/EN (bambara préparé).',
    actions: { translate: { description: 'Traduit un texte.', handler: (i) => i18n.translate({ text: String(i.text || ''), target: i.target || 'en' }) } },
  },

  /* ---------------- CLIENT (Personal Shopping Assistant) ---------------- */
  {
    id: 'client', name: 'AI Client Engine', category: 'client', allowedRoles: null,
    description: 'Assistant d\'achat : comparateur, panier par budget, guide des tailles, tenues, Q/R produit, alertes.',
    actions: {
      compare: { description: 'Compare plusieurs produits (avantages/prix/avis/qualité-prix).', handler: (i) => clientEngine.compare(i) },
      budget: { description: 'Panier optimisé pour un budget.', handler: (i) => clientEngine.budgetBasket(i) },
      sizeGuide: { description: 'Recommande la bonne taille.', handler: (i) => clientEngine.sizeGuide(i) },
      outfit: { description: 'Crée une tenue/look complet.', handler: (i) => clientEngine.outfit(i) },
      productQA: { description: 'Répond aux questions produit (matière, livraison, garantie…).', handler: (i) => clientEngine.productQA(i) },
      alerts: { description: 'Alertes personnalisées (stock, nouveautés).', handler: (i, ctx) => clientEngine.alerts({ userId: ctx.user ? ctx.user.id : null }) },
    },
  },

  /* ---------------- OPERATOR 2.0 (command center) ---------------- */
  {
    id: 'operator', name: 'AI Operator Engine 2.0', category: 'operator', allowedRoles: ADMIN,
    description: 'Centre de pilotage : dashboard, santé, alertes classées, missions, analyses, simulateur, prédictions, command center.',
    actions: {
      dashboard: { description: 'Tableau de bord exécutif.', cacheTtlMs: 10000, handler: () => operatorEngine.dashboard() },
      health: { description: 'Indice de santé marketplace + dimensions.', cacheTtlMs: 15000, handler: () => operatorEngine.health() },
      alerts: { description: 'Alertes intelligentes classées (critique→faible).', handler: () => operatorEngine.smartAlerts() },
      missions: { description: 'Centre de missions opérationnelles.', handler: () => operatorEngine.missions() },
      sellerAnalysis: { description: 'Analyse d\'un vendeur + suggestions.', handler: (i) => operatorEngine.sellerAnalysis(i) },
      customerAnalysis: { description: 'Segments clients (VIP, fidèles, inactifs, à risque).', handler: () => operatorEngine.customerAnalysis() },
      simulate: { description: 'Simule une décision (commission, promo, retrait catégorie).', handler: (i) => operatorEngine.simulate(i) },
      predict: { description: 'Prévisions 7/30/90/365 jours.', handler: (i) => operatorEngine.predict(i) },
      commandCenter: { description: 'Briefing du fondateur (priorités, urgences, actions).', handler: (i) => operatorEngine.commandCenter(i) },
    },
  },

  /* ---------------- CTO (évolution technique) ---------------- */
  {
    id: 'cto', name: 'AI CTO Engine', category: 'operator', allowedRoles: ADMIN,
    description: 'Veille technique : self-check, scores qualité, feuille de route, changelog. Aucun déploiement sans validation.',
    actions: {
      selfCheck: { description: 'Audit transverse automatique.', cacheTtlMs: 30000, handler: () => ctoEngine.selfCheck() },
      qualityScore: { description: 'Scores qualité/sécurité/perf/a11y/UX/stabilité.', handler: () => ctoEngine.qualityScore() },
      roadmap: { description: 'Feuille de route de propositions.', handler: () => ctoEngine.roadmap() },
      changelog: { description: 'Résumé d\'une évolution (pour validation).', handler: (i) => ctoEngine.changelog(i) },
    },
  },
];

// Catalogue de composants (familles + variantes) exposé par le Component Engine.
const COMPONENT_CATALOG = {
  navigation: ['navbar', 'sidebar', 'mega-menu', 'dropdown', 'mobile-menu', 'floating', 'sticky', 'transparent', 'search-nav'],
  hero: ['luxury', 'modern', 'minimal', 'glass', 'video', 'image', 'slider', 'split-screen', '3d', 'interactive', 'animated'],
  productCard: ['hover', 'quick-view', 'wishlist', 'compare', 'video-preview', '360', 'color-variants', 'badges', 'countdown', 'promotion', 'stock', 'livraison'],
  productPage: ['galerie', 'sticky-buy', 'avis', 'faq', 'description', 'caracteristiques', 'similaires', 'upsell', 'cross-sell', 'videos', 'zoom', '360'],
  checkout: ['one-page', 'multi-step', 'express', 'minimal', 'luxury', 'glass', 'modern'],
  autres: ['footer', 'cta', 'newsletter', 'testimonials', 'faq', 'collections', 'categories', 'search', 'wishlist', 'cart', 'order-tracking', 'coupons', 'notifications', 'chat', 'support', 'vendor-profile', 'store-header', 'store-banner', 'blog', 'carousel', 'timeline', 'pricing', 'badges', 'stats', 'charts', 'dashboard-widgets'],
  themes: ['light', 'dark', 'auto'],
  note: 'Familles de composants compatibles Theme Engine + Layout Engine ; responsive ; light/dark/auto.',
};

module.exports = { ENGINES };
