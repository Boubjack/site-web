/**
 * IA BOUTIQUE — génération automatique d'un thème de boutique complet.
 *
 * Selon la catégorie choisie par le vendeur (mode, luxe, cosmétique, automobile,
 * électronique, alimentation…), l'IA produit un thème cohérent : palette,
 * typographies, animations, style des cartes/boutons, icônes, sections et
 * effets visuels. Le thème est ensuite fusionné avec le Brand Kit du vendeur
 * (les couleurs/police/slogan de la marque priment). Chaque vendeur obtient une
 * boutique unique, sans designer.
 *
 * Sortie = SPÉCIFICATION de thème (variables + structure), applicable par le
 * front (data-theme boutique) ou exportable — sans casser le thème global.
 */
const brandkit = require('./brandkit');

const PRESETS = {
  mode: {
    label: 'Mode', palette: ['#111114', '#e63d6a', '#f6f7fb'], accent: '#e63d6a',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '18px',
    animations: ['fade-up au scroll', 'zoom doux au survol', 'carrousel plein écran'],
    cardStyle: 'image plein cadre, titre en bas, prix en accent',
    buttonStyle: 'plein arrondi, majuscules légères', icons: 'ligne fine',
    sections: ['Héro éditorial', 'Nouveautés', 'Lookbook', 'Best-sellers', 'Collections'],
    effects: ['grain léger', 'dégradés doux'],
  },
  luxe: {
    label: 'Luxe', palette: ['#0a0a0b', '#c9a227', '#f4efe6'], accent: '#c9a227',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '8px',
    animations: ['reveal lent', 'parallaxe subtile', 'fondu au noir'],
    cardStyle: 'fond sombre, or, large marge, typographie fine',
    buttonStyle: 'contour or, fin, espacé', icons: 'sérif fin',
    sections: ['Héro cinématique', 'Signature', 'Édition limitée', 'Savoir-faire', 'Sur-mesure'],
    effects: ['reflets dorés', 'clair-obscur'],
  },
  cosmetique: {
    label: 'Cosmétique', palette: ['#fff7f5', '#ff7a9c', '#2a2320'], accent: '#ff7a9c',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '26px',
    animations: ['bulles flottantes', 'apparition en douceur', 'survol pétillant'],
    cardStyle: 'clair, rond, ombre douce, avant/après',
    buttonStyle: 'pilule pastel', icons: 'rondes pleines',
    sections: ['Héro produit', 'Bienfaits', 'Ingrédients', 'Routine', 'Avis clients'],
    effects: ['dégradés pastel', 'reflets satinés'],
  },
  automobile: {
    label: 'Automobile', palette: ['#0d0f12', '#1e88e5', '#e8eef5'], accent: '#1e88e5',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '10px',
    animations: ['travelling latéral', 'compteur animé', 'reveal 3/4'],
    cardStyle: 'sombre technique, specs en badges, vue 3/4',
    buttonStyle: 'anguleux, technique', icons: 'techniques',
    sections: ['Héro dynamique', 'Modèles', 'Performances', 'Options', 'Essai'],
    effects: ['reflets métalliques', 'grille technique'],
  },
  electronique: {
    label: 'Électronique', palette: ['#08080c', '#2a90ff', '#eaf1fb'], accent: '#2a90ff',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '16px',
    animations: ['apparition néon', 'éclaté produit', 'survol lumineux'],
    cardStyle: 'sombre, néon, specs clés, badges',
    buttonStyle: 'plein dégradé bleu', icons: 'géométriques',
    sections: ['Héro tech', 'Nouveautés', 'Comparateur', 'Specs', 'Accessoires'],
    effects: ['néons', 'dégradés cyber'],
  },
  alimentation: {
    label: 'Alimentation', palette: ['#fffaf2', '#e0812f', '#26331f'], accent: '#e0812f',
    font: { display: 'Sora', body: 'Plus Jakarta Sans' }, radius: '22px',
    animations: ['apparition appétissante', 'survol gourmand', 'défilé de produits frais'],
    cardStyle: 'clair chaleureux, photo gourmande, badge frais/local',
    buttonStyle: 'rond chaleureux', icons: 'pleines douces',
    sections: ['Héro appétissant', 'Frais du jour', 'Terroir', 'Promos', 'Recettes'],
    effects: ['textures naturelles', 'lumière chaude'],
  },
};

const ALIASES = { fashion: 'mode', beaute: 'cosmetique', beauté: 'cosmetique', tech: 'electronique', food: 'alimentation', auto: 'automobile', premium: 'luxe' };

function categories() {
  return Object.entries(PRESETS).map(([id, v]) => ({ id, label: v.label }));
}

/** Génère un thème pour une catégorie, fusionné avec le Brand Kit du vendeur. */
function generate({ category = 'mode', sellerId } = {}) {
  const key = ALIASES[String(category).toLowerCase()] || String(category).toLowerCase();
  const preset = PRESETS[key] || PRESETS.mode;
  const kit = sellerId ? brandkit.getForSeller(sellerId) : null;

  // Le Brand Kit prime : couleurs / police / slogan de la marque.
  const primary = kit && kit.configured && kit.primaryColors && kit.primaryColors.length ? kit.primaryColors : [preset.palette[0], preset.accent];
  const accent = primary[1] || preset.accent;
  const bg = primary[0] || preset.palette[0];
  const font = kit && kit.configured && kit.font ? kit.font : preset.font.display;

  return {
    category: key,
    label: preset.label,
    brand: kit ? kit.brandName : null,
    slogan: kit ? kit.slogan : null,
    tokens: {
      '--shop-bg': bg,
      '--shop-accent': accent,
      '--shop-text': preset.palette[2],
      '--shop-radius': preset.radius,
      '--shop-font': font,
    },
    palette: preset.palette,
    typography: { display: font, body: preset.font.body },
    animations: preset.animations,
    effects: preset.effects,
    cardStyle: preset.cardStyle,
    buttonStyle: preset.buttonStyle,
    icons: preset.icons,
    sections: preset.sections,
    note: 'Thème généré automatiquement. Le Brand Kit du vendeur prime sur les couleurs/typo. Applicable en boutique (data-theme boutique) sans affecter le thème global.',
  };
}

module.exports = { generate, categories, PRESETS };
