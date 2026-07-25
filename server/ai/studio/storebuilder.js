/**
 * GÉNÉRATEUR DE BOUTIQUES IA PREMIUM.
 *
 * À partir d'un brief vendeur (catégorie, sous-catégorie, public, positionnement,
 * style, couleurs, logo, description), génère PLUSIEURS propositions de boutique
 * complètes, ORIGINALES et distinctes, de qualité « agence web premium ».
 *
 * ORIGINALITÉ — garde-fous stricts :
 *  - aucune reproduction d'un site existant ni d'un thème protégé ;
 *  - couleurs générées par calcul (studio/palette), pas copiées ;
 *  - mises en page composées à partir de primitives (archétypes + variations
 *    par graine) ; chaque boutique diffère.
 * Les agences citées (Hyperflow, Scalerize, Galadrim…) ne servent que de repère
 * de QUALITÉ — jamais de source à copier.
 *
 * Sortie = blueprint (spécification complète) rendu ensuite par store-render.js.
 */
const palette = require('./palette');

/* ---------------- Secteurs (adaptation automatique au métier) ---------------- */
const SECTORS = {
  mode: {
    label: 'Mode', harmony: 'analogue',
    hero: 'plein écran, grande image, titre éditorial',
    sections: ['hero', 'lookbook', 'nouveautes', 'categories', 'bestsellers', 'editorial', 'avis', 'newsletter'],
    card: 'image plein cadre, survol zoom doux, prix en accent',
    gallery: 'galerie éditoriale plein écran',
    product: ['galerie', 'variantes-taille-couleur', 'guide-tailles', 'description', 'lookbook-associe', 'avis'],
    motionMood: 'élégant',
    iconStyle: 'ligne fine',
  },
  cosmetique: {
    label: 'Cosmétique', harmony: 'analogue',
    hero: 'doux, produit héroïsé, halo lumineux',
    sections: ['hero', 'bienfaits', 'ingredients', 'routine', 'avant-apres', 'bestsellers', 'avis', 'faq'],
    card: 'clair, arrondi généreux, ombre douce, badge naturel',
    gallery: 'macro texture + avant/après',
    product: ['galerie', 'ingredients', 'bienfaits', 'routine', 'variantes', 'avis'],
    motionMood: 'doux',
    iconStyle: 'rondes pleines',
  },
  hightech: {
    label: 'High-Tech', harmony: 'split-complementaire',
    hero: 'sombre, effets lumineux, produit éclaté',
    sections: ['hero', 'nouveautes', 'specs-cles', 'comparateur', 'bestsellers', 'accessoires', 'avis', 'faq'],
    card: 'sombre néon, badges specs, survol lumineux',
    gallery: 'vue 360° + zoom détails',
    product: ['galerie', 'fiche-technique', 'specs-comparaison', 'variantes', 'avis'],
    motionMood: 'dynamique',
    iconStyle: 'géométrique',
  },
  bijoux: {
    label: 'Bijoux', harmony: 'complementaire',
    hero: 'luxueux, fond sombre, produit sublimé',
    sections: ['hero', 'signature', 'collections', 'savoir-faire', 'edition-limitee', 'avis', 'sur-mesure'],
    card: 'fond profond, or/argent, survol brillance',
    gallery: 'zoom haute définition, galerie immersive',
    product: ['galerie-zoom-hd', 'materiaux', 'variantes', 'certificat', 'avis'],
    motionMood: 'prestige',
    iconStyle: 'sérif fin',
  },
  restaurant: {
    label: 'Restaurant', harmony: 'analogue',
    hero: 'photos gourmandes, ambiance chaleureuse',
    sections: ['hero', 'menu', 'plats-signature', 'reservation', 'ambiance', 'avis', 'horaires-acces'],
    card: 'photo gourmande, prix lisible, badge du jour',
    gallery: 'galerie appétissante plein écran',
    product: ['photo', 'composition', 'allergenes', 'suggestions', 'avis'],
    motionMood: 'chaleureux',
    iconStyle: 'pleines douces',
  },
  generique: {
    label: 'Boutique', harmony: 'analogue',
    hero: 'moderne, produit mis en avant',
    sections: ['hero', 'nouveautes', 'categories', 'bestsellers', 'avantages', 'avis', 'newsletter'],
    card: 'moderne, survol élévation, prix en accent',
    gallery: 'galerie standard',
    product: ['galerie', 'variantes', 'description', 'avis'],
    motionMood: 'moderne',
    iconStyle: 'ligne',
  },
};

const CATEGORY_TO_SECTOR = {
  'mode-homme': 'mode', 'mode-femme': 'mode', mode: 'mode', fashion: 'mode', chaussures: 'mode', accessoires: 'mode',
  cosmetique: 'cosmetique', beaute: 'cosmetique', cosmetiques: 'cosmetique',
  electronique: 'hightech', hightech: 'hightech', 'high-tech': 'hightech', tech: 'hightech',
  bijoux: 'bijoux', bijouterie: 'bijoux', luxe: 'bijoux', joaillerie: 'bijoux',
  restaurant: 'restaurant', alimentation: 'restaurant', food: 'restaurant', traiteur: 'restaurant',
};

/* ---------------- Directions créatives (rend chaque proposition unique) ---------------- */
const DIRECTIONS = [
  {
    id: 'editorial', name: 'Éditorial',
    pitch: 'Grandes images, typographie forte, espaces généreux — magazine moderne.',
    typography: { display: "'Sora', sans-serif", body: "'Plus Jakarta Sans', sans-serif", scale: 1.12, weightDisplay: 800 },
    layout: { nav: 'transparente puis fixe', heroHeight: '92vh', grid: 'aéré (3 colonnes)', density: 'aéré', footer: 'colonnes éditoriales' },
    motion: { ease: 'cubic-bezier(0.22,1,0.36,1)', reveal: 'fade-up', hover: 'zoom doux 1.04', parallax: true, duration: '0.7s' },
    radius: '16px', dark: true,
  },
  {
    id: 'immersif', name: 'Immersif',
    pitch: 'Fond sombre, effets lumineux, animations reveal, galerie immersive.',
    typography: { display: "'Sora', sans-serif", body: "'Plus Jakarta Sans', sans-serif", scale: 1.18, weightDisplay: 800 },
    layout: { nav: 'flottante en verre', heroHeight: '100vh', grid: 'plein (4 colonnes)', density: 'dense', footer: 'large immersif' },
    motion: { ease: 'cubic-bezier(0.16,1,0.3,1)', reveal: 'scale-in', hover: 'brillance + élévation', parallax: true, duration: '0.85s' },
    radius: '22px', dark: true,
  },
  {
    id: 'minimal', name: 'Minimal-Lux',
    pitch: 'Épuré, lignes fines, beaucoup d\'espace, micro-interactions subtiles.',
    typography: { display: "'Sora', sans-serif", body: "'Plus Jakarta Sans', sans-serif", scale: 1.06, weightDisplay: 700 },
    layout: { nav: 'minimale discrète', heroHeight: '84vh', grid: 'épuré (3 colonnes)', density: 'très aéré', footer: 'minimal centré' },
    motion: { ease: 'cubic-bezier(0.32,0.72,0,1)', reveal: 'fade', hover: 'soulignement fin', parallax: false, duration: '0.5s' },
    radius: '10px', dark: false,
  },
];

/* ---------------- Contenu (personnalisé, secteur + marque) ---------------- */
function content(brief, sector, pal) {
  const brand = brief.brandName || brief.description ? (brief.brandName || 'votre marque') : 'votre marque';
  const audience = brief.audience || 'vos clients';
  const taglines = {
    mode: [`${brand} — le style qui vous ressemble`, 'La mode, réinventée pour vous', 'Des pièces qui font la différence'],
    cosmetique: [`${brand} — révélez votre éclat`, 'La beauté, naturellement', 'Des soins pensés pour votre peau'],
    hightech: [`${brand} — la technologie sans compromis`, 'L\'innovation à portée de main', 'La performance, redéfinie'],
    bijoux: [`${brand} — l\'éclat de l\'exception`, 'Des pièces d\'exception, pour vous', 'Le luxe, sublimé'],
    restaurant: [`${brand} — le goût de l\'authentique`, 'Une expérience gourmande', 'Des saveurs qui rassemblent'],
    generique: [`${brand} — la qualité, simplement`, 'Votre boutique de confiance', 'Le meilleur, sélectionné pour vous'],
  };
  const faqBySector = {
    mode: [['Quelles sont les tailles disponibles ?', 'Un guide des tailles détaillé est disponible sur chaque fiche produit.'], ['Puis-je retourner un article ?', 'Oui, retours gratuits sous 14 jours.']],
    cosmetique: [['Vos produits sont-ils naturels ?', 'Nous privilégions des ingrédients d\'origine naturelle, listés sur chaque fiche.'], ['Testés sur les animaux ?', 'Non — nos produits ne sont jamais testés sur les animaux.']],
    hightech: [['Garantie ?', 'Tous nos produits sont garantis. La durée figure sur la fiche technique.'], ['Livraison rapide ?', 'Livraison 24-72h à Bamako, suivi en temps réel.']],
    bijoux: [['Vos bijoux sont-ils certifiés ?', 'Chaque pièce est accompagnée d\'un certificat d\'authenticité.'], ['Gravure possible ?', 'Oui, personnalisation et gravure sur demande.']],
    restaurant: [['Peut-on réserver ?', 'Oui, réservation en ligne en quelques clics.'], ['Options végétariennes ?', 'Plusieurs plats végétariens sont proposés au menu.']],
    generique: [['Modes de paiement ?', 'Orange Money, Moov Money, Wave et paiement à la livraison.'], ['Délais de livraison ?', 'Livraison 24-72h à Bamako.']],
  };
  const about = brief.description
    ? brief.description
    : `${brand} propose une sélection pensée pour ${audience}, avec exigence et authenticité. Notre mission : offrir une expérience à la hauteur de vos attentes.`;
  return {
    tagline: taglines[sector.key] || taglines.generique,
    about,
    faq: faqBySector[sector.key] || faqBySector.generique,
    reviewsStyle: sector.key === 'bijoux' || sector.key === 'mode' ? 'cartes élégantes avec étoiles' : 'liste avec note et vérification',
    banners: [
      { title: 'Livraison 24-72h à Bamako', kind: 'trust' },
      { title: sector.key === 'restaurant' ? 'Réservez votre table' : 'Nouveautés de la saison', kind: 'promo' },
    ],
    marketingSections: sector.sections.filter((s) => !['hero', 'avis', 'faq', 'newsletter'].includes(s)),
  };
}

/* ---------------- Construction d'un blueprint ---------------- */
function resolveSector(category) {
  const key = CATEGORY_TO_SECTOR[String(category || '').toLowerCase()] || 'generique';
  return { key, ...SECTORS[key] };
}

function positioningDark(positioning, directionDark) {
  if (/luxe/i.test(positioning)) return true;
  if (/économique|economique|eco/i.test(positioning)) return false;
  return directionDark;
}

function buildBlueprint(brief, direction, index) {
  const sector = resolveSector(brief.category);
  const seed = index * 7 + (brief.category ? brief.category.length : 3);
  const dark = positioningDark(brief.positioning, direction.dark);
  const accent = (Array.isArray(brief.colors) && brief.colors[0]) || brief.color || defaultAccentFor(sector.key);
  const pal = palette.generate({ accent, positioning: brief.positioning || 'Premium', harmony: sector.harmony, seed, dark });

  return {
    id: `${sector.key}-${direction.id}-${index + 1}`,
    proposal: index + 1,
    name: `${direction.name} · ${sector.label}`,
    direction: direction.id,
    pitch: direction.pitch,
    sector: sector.key,
    sectorLabel: sector.label,
    brief: {
      category: brief.category || null, subcategory: brief.subcategory || null,
      audience: brief.audience || null, positioning: brief.positioning || 'Premium',
      style: brief.style || null, hasLogo: Boolean(brief.hasLogo), brandName: brief.brandName || null,
    },
    designSystem: {
      palette: pal,
      typography: direction.typography,
      radius: direction.radius,
      motion: { ...direction.motion, mood: sector.motionMood },
      density: direction.layout.density,
      iconStyle: sector.iconStyle,
      effects: dark ? ['dégradés profonds', 'lueurs d\'accent', 'grain léger'] : ['ombres douces', 'dégradés clairs'],
    },
    layout: { ...direction.layout, hero: sector.hero },
    pages: {
      accueil: { sections: sector.sections },
      catalogue: { view: 'grille filtrable', filters: ['catégorie', 'prix', 'couleur', 'tri'], card: sector.card },
      categorie: { view: 'grille + bannière catégorie', card: sector.card },
      produit: { blocks: sector.product, gallery: sector.gallery },
      panier: { style: 'panneau latéral', upsell: 'complétez votre achat' },
      checkout: { steps: ['livraison', 'paiement', 'confirmation'], payments: ['Orange Money', 'Moov Money', 'Wave', 'À la livraison'] },
      apropos: { style: 'récit de marque + valeurs' },
      faq: { style: 'accordéon' },
    },
    components: {
      card: sector.card,
      hover: direction.motion.hover,
      gallery: sector.gallery,
      variants: 'sélecteur couleur/taille en pastilles',
      buttons: dark ? 'plein dégradé + halo au survol' : 'plein net + ombre douce',
      search: 'barre avec suggestions instantanées',
      menu: direction.layout.nav,
      footer: direction.layout.footer,
      icons: sector.iconStyle,
    },
    content: content(brief, sector, pal),
    originality: {
      generated: true,
      method: 'Palette dérivée par calcul (HSL) + archétypes de mise en page variés par graine.',
      note: 'Design original généré pour ce vendeur. Aucune reproduction de site ou de thème protégé. Agences citées = repère de qualité uniquement.',
    },
  };
}

function defaultAccentFor(sectorKey) {
  return ({ mode: '#e63d6a', cosmetique: '#ff7a9c', hightech: '#2a90ff', bijoux: '#c9a227', restaurant: '#e0812f' })[sectorKey] || '#2a90ff';
}

/** Génère N propositions distinctes (défaut 3). */
function generateProposals(brief = {}, count = 3) {
  const dirs = DIRECTIONS.slice(0, Math.max(1, Math.min(DIRECTIONS.length, count)));
  return dirs.map((d, i) => buildBlueprint(brief, d, i));
}

module.exports = { generateProposals, buildBlueprint, resolveSector, SECTORS, DIRECTIONS, CATEGORY_TO_SECTOR };
