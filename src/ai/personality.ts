/**
 * Infinity Football — IA / Personnalités
 *
 * Tome I, pilier 4 : « Chaque personnage possède une mémoire, une personnalité
 * et un comportement crédible. »
 * Tome III, ch. 1 : chaque joueur a une personnalité footballistique, une
 * gestuelle propre, un rythme et une intelligence différents.
 *
 * Deux profils complémentaires :
 *  - `Personality` : traits humains génériques, utilisés par tous les PNJ ;
 *  - `FootballProfile` : traits de jeu, utilisés sur le terrain.
 */

import { clamp01 } from '../core/math.js';
import type { Rng } from '../core/rng.js';

export interface Personality {
  /** Ouverture : curiosité, goût du voyage et de la nouveauté. */
  readonly openness: number;
  /** Rigueur : ponctualité, discipline, entraînement. */
  readonly conscientiousness: number;
  /** Extraversion : sociabilité, aisance médiatique. */
  readonly extraversion: number;
  /** Amabilité : coopération, fair-play, générosité. */
  readonly agreeableness: number;
  /** Instabilité émotionnelle : sensibilité à la pression. */
  readonly neuroticism: number;
  /** Ambition : soif de titres, de records et de gros contrats. */
  readonly ambition: number;
  /** Loyauté : attachement au club et aux proches. */
  readonly loyalty: number;
  /** Rancune : durée pendant laquelle un affront est retenu. */
  readonly grudge: number;
}

export interface FootballProfile {
  /** Vision du jeu : qualité de lecture des espaces. */
  readonly vision: number;
  /** Anticipation : interceptions, appels, déclenchements. */
  readonly anticipation: number;
  /** Prise de risque : passes tranchantes, dribbles, frappes lointaines. */
  readonly risk: number;
  /** Rythme : tempo de jeu privilégié (0 = posé, 1 = vertical). */
  readonly tempo: number;
  /** Agressivité dans les duels. */
  readonly aggression: number;
  /** Travail défensif fourni. */
  readonly workRate: number;
  /** Créativité : gestes rares, imprévisibilité. */
  readonly flair: number;
  /** Sang-froid devant le but. */
  readonly composure: number;
  /** Capacité d'apprentissage : vitesse d'adaptation saison après saison. */
  readonly learning: number;
}

export type PlayStyle =
  | 'meneur'
  | 'finisseur'
  | 'ailier explosif'
  | 'box-to-box'
  | 'sentinelle'
  | 'latéral offensif'
  | 'défenseur de couloir'
  | 'roc défensif'
  | 'libéro moderne'
  | 'gardien relanceur'
  | 'gardien de ligne';

export type MediaStyle = 'diplomate' | 'franc' | 'provocateur' | 'humoriste' | 'discret' | 'passionné';

export interface CharacterProfile {
  readonly personality: Personality;
  readonly football: FootballProfile;
  readonly playStyle: PlayStyle;
  readonly mediaStyle: MediaStyle;
  /** Gestuelle : signature d'animation (Tome XXXI, ch. 5). */
  readonly signatureMotion: string;
  /** Célébration signature. */
  readonly celebration: string;
}

const SIGNATURE_MOTIONS = [
  'foulée ample et relâchée',
  'course hachée, bras bas',
  'appuis courts et nerveux',
  'buste très droit, menton haut',
  'épaules basculantes avant le crochet',
  'démarrage explosif sur trois pas',
  'course glissée, presque silencieuse',
  'bras écartés en course de repli',
];

const CELEBRATIONS = [
  'bras croisés face au virage',
  'course vers le poteau de corner',
  'doigt sur les lèvres devant les tribunes adverses',
  'salut militaire au public',
  'glissade genoux au sol',
  'geste dédié à la famille',
  'saut avec rotation',
  'célébration sobre, poings serrés',
];

export function randomPersonality(rng: Rng): Personality {
  return {
    openness: clamp01(rng.gaussian(0.5, 0.18)),
    conscientiousness: clamp01(rng.gaussian(0.55, 0.18)),
    extraversion: clamp01(rng.gaussian(0.5, 0.2)),
    agreeableness: clamp01(rng.gaussian(0.55, 0.18)),
    neuroticism: clamp01(rng.gaussian(0.45, 0.2)),
    ambition: clamp01(rng.gaussian(0.6, 0.2)),
    loyalty: clamp01(rng.gaussian(0.5, 0.22)),
    grudge: clamp01(rng.gaussian(0.45, 0.2)),
  };
}

export function randomFootballProfile(rng: Rng, quality = 0.5): FootballProfile {
  const spread = 0.16;
  return {
    vision: clamp01(rng.gaussian(quality, spread)),
    anticipation: clamp01(rng.gaussian(quality, spread)),
    risk: clamp01(rng.gaussian(0.5, 0.2)),
    tempo: clamp01(rng.gaussian(0.5, 0.2)),
    aggression: clamp01(rng.gaussian(0.5, 0.2)),
    workRate: clamp01(rng.gaussian(quality * 0.8 + 0.15, spread)),
    flair: clamp01(rng.gaussian(quality * 0.7 + 0.15, 0.2)),
    composure: clamp01(rng.gaussian(quality, spread)),
    learning: clamp01(rng.gaussian(0.5, 0.2)),
  };
}

const PLAY_STYLES: readonly PlayStyle[] = [
  'meneur',
  'finisseur',
  'ailier explosif',
  'box-to-box',
  'sentinelle',
  'latéral offensif',
  'défenseur de couloir',
  'roc défensif',
  'libéro moderne',
  'gardien relanceur',
  'gardien de ligne',
];

const MEDIA_STYLES: readonly MediaStyle[] = [
  'diplomate',
  'franc',
  'provocateur',
  'humoriste',
  'discret',
  'passionné',
];

export function randomCharacterProfile(rng: Rng, quality = 0.5): CharacterProfile {
  const personality = randomPersonality(rng);
  return {
    personality,
    football: randomFootballProfile(rng, quality),
    playStyle: rng.pick(PLAY_STYLES),
    mediaStyle: mediaStyleFor(personality, rng),
    signatureMotion: rng.pick(SIGNATURE_MOTIONS),
    celebration: rng.pick(CELEBRATIONS),
  };
}

/** Le style médiatique découle de la personnalité, avec une part d'aléa. */
export function mediaStyleFor(personality: Personality, rng: Rng): MediaStyle {
  const weights: Array<{ item: MediaStyle; weight: number }> = [
    { item: 'diplomate', weight: personality.agreeableness * 2 + personality.conscientiousness },
    { item: 'franc', weight: (1 - personality.agreeableness) * 1.5 + personality.extraversion },
    { item: 'provocateur', weight: personality.ambition * 1.4 + (1 - personality.agreeableness) * 1.2 },
    { item: 'humoriste', weight: personality.extraversion * 1.8 + personality.openness },
    { item: 'discret', weight: (1 - personality.extraversion) * 2.2 },
    { item: 'passionné', weight: personality.neuroticism * 1.3 + personality.extraversion },
  ];
  return rng.weighted(weights);
}

/** Résistance à la pression d'un grand match : 0 = se liquéfie, 1 = imperturbable. */
export function pressureResistance(profile: CharacterProfile): number {
  return clamp01(
    profile.football.composure * 0.55 +
      (1 - profile.personality.neuroticism) * 0.3 +
      profile.personality.ambition * 0.15,
  );
}

/** Probabilité qu'un joueur accepte de quitter son club pour une offre donnée. */
export function transferWillingness(
  profile: CharacterProfile,
  options: { wageIncrease: number; prestigeIncrease: number; playingTimeGain: number; yearsAtClub: number },
): number {
  const attachment = profile.personality.loyalty * Math.min(1, options.yearsAtClub / 6);
  const pull =
    options.wageIncrease * 0.35 * (0.5 + profile.personality.ambition) +
    options.prestigeIncrease * 0.4 * (0.4 + profile.personality.ambition) +
    options.playingTimeGain * 0.3;
  return clamp01(pull - attachment * 0.6 + 0.1);
}

/** Décrit une personnalité en langage naturel (fiches, presse, scouting). */
export function describePersonality(personality: Personality): string {
  const traits: string[] = [];
  if (personality.extraversion > 0.7) traits.push('très à l’aise devant les caméras');
  else if (personality.extraversion < 0.3) traits.push('réservé, parle peu');
  if (personality.conscientiousness > 0.7) traits.push('professionnel exemplaire');
  else if (personality.conscientiousness < 0.3) traits.push('irrégulier à l’entraînement');
  if (personality.ambition > 0.75) traits.push('dévoré par l’ambition');
  if (personality.loyalty > 0.75) traits.push('viscéralement attaché à ses couleurs');
  if (personality.neuroticism > 0.7) traits.push('sensible à la pression');
  else if (personality.neuroticism < 0.3) traits.push('imperturbable');
  if (personality.agreeableness > 0.75) traits.push('apprécié de tout le vestiaire');
  else if (personality.agreeableness < 0.3) traits.push('caractère difficile');
  if (personality.grudge > 0.75) traits.push('n’oublie jamais un affront');
  return traits.length > 0 ? traits.join(', ') : 'profil équilibré, sans excès';
}
