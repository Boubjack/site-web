/**
 * Infinity Football — Données du football de rue
 *
 * Le football de rue n'est pas un mode annexe : c'est là que naissent les
 * joueurs. Un gamin repéré sur un city stadium à quinze ans, une vidéo qui
 * tourne, un recruteur anonyme dans un coin du grillage — et une carrière
 * bascule. Ce fichier contient le contenu écrit à la main de cet univers :
 * disciplines, gestes, terrains, crews, marques et tournois.
 *
 * Tome II (monde ouvert), Tome III (gameplay), Tome IV (carrière),
 * Tome XX (immersion), Tome XXIV (marques), Tome XXX (univers complet).
 */

/** Les formes que prend le football hors des stades. */
export type StreetDiscipline =
  | 'cage'
  | 'futsal'
  | 'panna'
  | 'freestyle'
  | 'beachSoccer'
  | 'cinqContreCinq'
  | 'nocturne'
  | 'tekkers';

export interface DisciplineDef {
  readonly id: StreetDiscipline;
  readonly name: string;
  /** Description montrée dans l'invitation et le résumé d'après-match. */
  readonly pitch: string;
  /** Type de lieu où la discipline se pratique. */
  readonly surface: 'bitume' | 'parquet' | 'sable' | 'synthétique' | 'terre';
  /** Nombre de joueurs par équipe (1 = duel individuel). */
  readonly teamSize: number;
  /** Durée d'une rencontre en minutes de jeu. */
  readonly durationMinutes: number;
  /**
   * Attributs que la discipline sollicite et fait progresser. Un hiver de cage
   * ne donne pas le même joueur qu'un été de beach soccer.
   */
  readonly trains: readonly StreetTrainableAttribute[];
  /** Heure d'ouverture typique (les tournois nocturnes commencent tard). */
  readonly startHour: number;
  /** Prestige de base 0..1 : influence le gain de réputation de rue. */
  readonly prestige: number;
}

/** Attributs de joueur que la rue développe réellement. */
export type StreetTrainableAttribute =
  | 'dribbling'
  | 'firstTouch'
  | 'agility'
  | 'acceleration'
  | 'finishing'
  | 'passing'
  | 'strength'
  | 'stamina'
  | 'concentration'
  | 'decisions'
  | 'teamwork'
  | 'longShots';

export const DISCIPLINES: readonly DisciplineDef[] = [
  {
    id: 'cage',
    name: 'Cage football',
    pitch: 'Grillage, rebonds, aucune touche. Le ballon ne sort jamais, la pression non plus.',
    surface: 'bitume',
    teamSize: 4,
    durationMinutes: 20,
    trains: ['dribbling', 'firstTouch', 'agility', 'concentration'],
    startHour: 17,
    prestige: 0.5,
  },
  {
    id: 'futsal',
    name: 'Futsal',
    pitch: 'Parquet, ballon lourd, quatre secondes pour décider. L’école du toucher.',
    surface: 'parquet',
    teamSize: 5,
    durationMinutes: 40,
    trains: ['firstTouch', 'passing', 'decisions', 'teamwork'],
    startHour: 19,
    prestige: 0.62,
  },
  {
    id: 'panna',
    name: 'Panna',
    pitch: 'Un contre un dans un cercle. Passer le ballon entre les jambes met fin au duel.',
    surface: 'bitume',
    teamSize: 1,
    durationMinutes: 6,
    trains: ['dribbling', 'agility', 'concentration'],
    startHour: 18,
    prestige: 0.58,
  },
  {
    id: 'freestyle',
    name: 'Freestyle',
    pitch: 'Aucun adversaire, aucun but. Seulement le ballon, le corps et le regard des autres.',
    surface: 'bitume',
    teamSize: 1,
    durationMinutes: 8,
    trains: ['firstTouch', 'agility', 'concentration'],
    startHour: 16,
    prestige: 0.45,
  },
  {
    id: 'beachSoccer',
    name: 'Beach soccer',
    pitch: 'Le sable mange les appuis. Tout se joue en une touche, souvent en l’air.',
    surface: 'sable',
    teamSize: 5,
    durationMinutes: 36,
    trains: ['finishing', 'strength', 'agility', 'longShots'],
    startHour: 11,
    prestige: 0.52,
  },
  {
    id: 'cinqContreCinq',
    name: 'Cinq contre cinq du quartier',
    pitch: 'Le city stadium du coin, deux équipes montées en dix minutes, l’honneur du quartier.',
    surface: 'synthétique',
    teamSize: 5,
    durationMinutes: 30,
    trains: ['passing', 'teamwork', 'stamina', 'dribbling'],
    startHour: 15,
    prestige: 0.4,
  },
  {
    id: 'nocturne',
    name: 'Tournoi nocturne',
    pitch: 'Projecteurs, sono, gradins improvisés. On y joue à 23 h et la ville entière en parle le lendemain.',
    surface: 'synthétique',
    teamSize: 5,
    durationMinutes: 30,
    trains: ['dribbling', 'finishing', 'concentration', 'stamina'],
    startHour: 22,
    prestige: 0.75,
  },
  {
    id: 'tekkers',
    name: 'Tekkers',
    pitch: 'Concours de gestes techniques jugé par la foule. Le bruit décide, pas le score.',
    surface: 'bitume',
    teamSize: 1,
    durationMinutes: 10,
    trains: ['dribbling', 'firstTouch', 'agility'],
    startHour: 17,
    prestige: 0.48,
  },
];

const DISCIPLINE_INDEX = new Map(DISCIPLINES.map((d) => [d.id, d]));

export function getDiscipline(id: StreetDiscipline): DisciplineDef {
  const found = DISCIPLINE_INDEX.get(id);
  if (!found) throw new Error(`Discipline de rue inconnue : "${id}"`);
  return found;
}

/**
 * Gestes techniques. Chacun a une difficulté, un gain de spectacle, et un
 * risque de rater qui coûte le ballon — la rue ne pardonne pas.
 */
export interface StreetMove {
  readonly id: string;
  readonly name: string;
  /** Difficulté 0..1 : au-delà de la maîtrise du joueur, le geste rate. */
  readonly difficulty: number;
  /** Spectacle 0..1 : ce que la foule retient. */
  readonly showmanship: number;
  /** Disciplines où le geste a un sens. */
  readonly disciplines: readonly StreetDiscipline[];
  /** Le geste peut conclure un duel de panna. */
  readonly canPanna: boolean;
}

export const STREET_MOVES: readonly StreetMove[] = [
  { id: 'elastico', name: 'élastique', difficulty: 0.62, showmanship: 0.72, disciplines: ['cage', 'panna', 'tekkers', 'cinqContreCinq', 'nocturne'], canPanna: false },
  { id: 'rainbow', name: 'coup du sombrero', difficulty: 0.7, showmanship: 0.85, disciplines: ['cage', 'tekkers', 'freestyle', 'nocturne'], canPanna: false },
  { id: 'nutmeg', name: 'petit pont', difficulty: 0.48, showmanship: 0.9, disciplines: ['cage', 'panna', 'futsal', 'cinqContreCinq', 'nocturne', 'tekkers'], canPanna: true },
  { id: 'doubleNutmeg', name: 'double petit pont', difficulty: 0.88, showmanship: 1, disciplines: ['panna', 'tekkers'], canPanna: true },
  { id: 'rouletteZidane', name: 'roulette', difficulty: 0.5, showmanship: 0.6, disciplines: ['cage', 'futsal', 'cinqContreCinq', 'nocturne'], canPanna: false },
  { id: 'crochetCourt', name: 'crochet court', difficulty: 0.3, showmanship: 0.35, disciplines: ['cage', 'futsal', 'cinqContreCinq', 'beachSoccer', 'nocturne', 'panna'], canPanna: false },
  { id: 'akka', name: 'akka', difficulty: 0.75, showmanship: 0.88, disciplines: ['panna', 'tekkers', 'freestyle'], canPanna: true },
  { id: 'passeSousLeCorps', name: 'passe sous le corps', difficulty: 0.55, showmanship: 0.55, disciplines: ['futsal', 'cage', 'cinqContreCinq'], canPanna: false },
  { id: 'talonnade', name: 'talonnade', difficulty: 0.42, showmanship: 0.62, disciplines: ['futsal', 'cage', 'beachSoccer', 'cinqContreCinq', 'nocturne'], canPanna: false },
  { id: 'aroundTheWorld', name: 'around the world', difficulty: 0.66, showmanship: 0.78, disciplines: ['freestyle', 'tekkers'], canPanna: false },
  { id: 'crossover', name: 'crossover', difficulty: 0.58, showmanship: 0.68, disciplines: ['freestyle', 'tekkers', 'panna'], canPanna: false },
  { id: 'hoketa', name: 'hoketa', difficulty: 0.8, showmanship: 0.9, disciplines: ['freestyle'], canPanna: false },
  { id: 'retourneSable', name: 'retourné dans le sable', difficulty: 0.72, showmanship: 0.95, disciplines: ['beachSoccer'], canPanna: false },
  { id: 'lobDuGardien', name: 'lob du gardien', difficulty: 0.6, showmanship: 0.75, disciplines: ['cage', 'futsal', 'beachSoccer', 'cinqContreCinq', 'nocturne'], canPanna: false },
  { id: 'frappeEnLucarne', name: 'frappe en lucarne', difficulty: 0.68, showmanship: 0.8, disciplines: ['cage', 'futsal', 'nocturne', 'cinqContreCinq'], canPanna: false },
  { id: 'controlePoitrine', name: 'contrôle poitrine orienté', difficulty: 0.35, showmanship: 0.3, disciplines: ['futsal', 'beachSoccer', 'cinqContreCinq', 'cage'], canPanna: false },
];

/**
 * Noms de terrains de rue. Assemblés avec le nom du quartier pour produire
 * « le City de Barbès », « la Cage du Vieux Port ».
 */
export const PITCH_PREFIXES: readonly string[] = [
  'le City',
  'la Cage',
  'le Playground',
  'le Terrain',
  'le Bitume',
  'la Dalle',
  'le Five',
  'le Boulodrome',
];

export const PITCH_LEGENDS: readonly string[] = [
  'on dit qu’un international y a fait ses premiers pas',
  'le grillage porte encore les initiales des anciens',
  'le panier de basket sert de but depuis vingt ans',
  'personne n’a jamais gagné ici en venant d’un autre quartier',
  'la lumière ne marche qu’un projecteur sur deux',
  'le sol est lisse à force d’avoir été joué',
  'les anciens s’asseyent sur le muret et commentent chaque action',
  'il y a un trou dans le grillage que tout le monde connaît',
];

/** Surnoms des légendes locales. La rue nomme avant que la presse ne le fasse. */
export const CREW_NICKNAMES: readonly string[] = [
  'Zapata', 'Le Chat', 'Bibou', 'Tornade', 'Le Facteur', 'Ronaldinho du quartier',
  'Petit Prince', 'Le Mur', 'Fantôme', 'Sniper', 'Le Métronome', 'Boomerang',
  'La Flèche', 'Anguille', 'Le Rouleau', 'Diamant', 'Panthère', 'Le Chirurgien',
  'Coco', 'Le Ministre', 'Vif-Argent', 'Le Poète', 'Machine', 'Sultan',
];

export const CREW_NAMES: readonly string[] = [
  'Les Loups du Bitume', 'Team Grillage', 'Panna Kings', 'Les Fantômes du Five',
  'Collectif Nocturne', 'Les Enfants du Terrain', 'Street Legends', 'La Meute',
  'Les Rois du Sable', 'Freestyle Union', 'Les Intouchables du City', 'Génération Cage',
];

/** Tournois récurrents, avec leur identité propre. */
export interface StreetTournamentDef {
  readonly id: string;
  readonly name: string;
  readonly discipline: StreetDiscipline;
  /** Mois de l'année où il se tient (1-12). */
  readonly month: number;
  /** Prestige 0..1 : détermine la dotation, l'audience et les recruteurs. */
  readonly prestige: number;
  /** Réputation de rue minimale pour être invité. */
  readonly minStreetCred: number;
  /** Dotation en euros au vainqueur. */
  readonly prize: number;
  /** Le tournoi est caché tant que la condition n'est pas remplie. */
  readonly secret: boolean;
  readonly flavour: string;
}

export const STREET_TOURNAMENTS: readonly StreetTournamentDef[] = [
  {
    id: 'tournoi-quartier',
    name: 'Tournoi du quartier',
    discipline: 'cinqContreCinq',
    month: 6,
    prestige: 0.3,
    minStreetCred: 0,
    prize: 500,
    secret: false,
    flavour: 'Le tournoi que tout le monde fait, celui où tout commence.',
  },
  {
    id: 'coupe-des-cages',
    name: 'Coupe des Cages',
    discipline: 'cage',
    month: 3,
    prestige: 0.5,
    minStreetCred: 15,
    prize: 2_000,
    secret: false,
    flavour: 'Douze cages de la ville, une seule équipe debout à la fin.',
  },
  {
    id: 'nuit-du-bitume',
    name: 'La Nuit du Bitume',
    discipline: 'nocturne',
    month: 7,
    prestige: 0.78,
    minStreetCred: 35,
    prize: 8_000,
    secret: false,
    flavour: 'Projecteurs, sono, deux mille personnes debout à minuit passé.',
  },
  {
    id: 'panna-world',
    name: 'Panna World Series',
    discipline: 'panna',
    month: 9,
    prestige: 0.85,
    minStreetCred: 45,
    prize: 12_000,
    secret: false,
    flavour: 'Le cercle, un adversaire, et le monde entier qui filme.',
  },
  {
    id: 'futsal-hiver',
    name: 'Ligue d’hiver de futsal',
    discipline: 'futsal',
    month: 1,
    prestige: 0.55,
    minStreetCred: 10,
    prize: 3_000,
    secret: false,
    flavour: 'Quand les terrains gèlent, la ville rentre au gymnase.',
  },
  {
    id: 'sables-dor',
    name: 'Sables d’Or',
    discipline: 'beachSoccer',
    month: 8,
    prestige: 0.6,
    minStreetCred: 20,
    prize: 4_000,
    secret: false,
    flavour: 'Pieds nus, mer derrière le but, trois mille personnes sur la plage.',
  },
  {
    id: 'cercle-ferme',
    name: 'Le Cercle Fermé',
    discipline: 'panna',
    month: 11,
    prestige: 0.95,
    minStreetCred: 70,
    prize: 25_000,
    secret: true,
    flavour:
      'On n’y entre pas, on y est invité. Aucune affiche, aucune annonce — un message, une adresse, une heure.',
  },
  {
    id: 'derniere-nuit',
    name: 'La Dernière Nuit',
    discipline: 'nocturne',
    month: 12,
    prestige: 1,
    minStreetCred: 85,
    prize: 40_000,
    secret: true,
    flavour:
      'Une fois par an, sur un terrain différent, sans public annoncé. Ceux qui y ont joué n’en parlent pas.',
  },
];

/** Marques de rue : elles signent avant les équipementiers, et pour moins cher. */
export interface StreetBrandDef {
  readonly id: string;
  readonly name: string;
  /** Réputation de rue minimale pour intéresser la marque. */
  readonly minStreetCred: number;
  /** Valeur annuelle du contrat en euros. */
  readonly annualValue: number;
  readonly obligation: string;
  readonly style: string;
}

export const STREET_BRANDS: readonly StreetBrandDef[] = [
  { id: 'bitume-wear', name: 'Bitume Wear', minStreetCred: 12, annualValue: 1_200, obligation: 'porter le maillot en tournoi', style: 'streetwear brut' },
  { id: 'panna-lab', name: 'Panna Lab', minStreetCred: 28, annualValue: 4_500, obligation: 'une vidéo technique par mois', style: 'technique et minimal' },
  { id: 'nocturne-fc', name: 'Nocturne FC', minStreetCred: 45, annualValue: 11_000, obligation: 'présence aux tournois de nuit', style: 'noir, réfléchissant' },
  { id: 'cage-culture', name: 'Cage Culture', minStreetCred: 60, annualValue: 26_000, obligation: 'une collection capsule à son nom', style: 'graphique, quartier' },
  { id: 'asphalte-paris', name: 'Asphalte Paris', minStreetCred: 78, annualValue: 60_000, obligation: 'ambassadeur, deux événements par an', style: 'luxe urbain' },
];

/** Réactions de la foule, du silence gêné à l'explosion. */
export const CROWD_REACTIONS: readonly { readonly threshold: number; readonly text: string }[] = [
  { threshold: 0.95, text: 'le terrain explose, tout le monde est debout sur le muret' },
  { threshold: 0.8, text: 'la foule hurle, quelqu’un jette son sweat en l’air' },
  { threshold: 0.62, text: 'ça crie derrière le grillage, les téléphones se lèvent' },
  { threshold: 0.42, text: 'quelques « ohhh » montent du bord du terrain' },
  { threshold: 0.22, text: 'un ancien hoche la tête depuis son muret' },
  { threshold: 0, text: 'personne ne réagit, le jeu reprend' },
];

export function crowdReaction(intensity: number): string {
  for (const reaction of CROWD_REACTIONS) {
    if (intensity >= reaction.threshold) return reaction.text;
  }
  return CROWD_REACTIONS[CROWD_REACTIONS.length - 1]?.text ?? '';
}

/** Titres de vidéos virales, assemblés avec le nom du joueur et du geste. */
export const VIRAL_TITLES: readonly string[] = [
  '{player} humilie tout le monde avec ce {move} 😱',
  'Ce {move} de {player} ne devrait pas être légal',
  '{player} — le {move} qui fait le tour de la ville',
  'IL A FAIT QUOI ?! {player}, {move}, terrain de {district}',
  'On a trouvé le prochain crack : {player} ({move})',
  '{move} + silence total : {player} a tué le terrain',
  'Le {move} de {player} tourne partout depuis ce matin',
];

/** Ce que murmurent les recruteurs anonymes avant de se présenter. */
export const SCOUT_WHISPERS: readonly string[] = [
  'un homme en veste sombre est resté une heure sans parler à personne',
  'quelqu’un a filmé tout le match depuis le même angle, sans jamais bouger',
  'une voiture est garée depuis le début, moteur éteint, vitre baissée',
  'un type a demandé ton prénom à un gamin, puis il est parti',
  'il y avait un carnet. Personne ne prend de notes sur un terrain de quartier',
];
