/**
 * Infinity Football — Carrière / Modèle du joueur
 *
 * Tome IV, ch. 1 : création du personnage (éditeur complet, génération de
 * visage depuis une photo, poste, pied fort, style de jeu, nationalité,
 * histoire).
 * Tome IV, ch. 2 : les performances influencent réputation, valeur marchande,
 * salaire, sponsors et sélections nationales.
 * Tome XIV, ch. 5 : vieillissement progressif — rides, cheveux, barbe,
 * blessures visibles, tatouages.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import type { CharacterProfile } from '../ai/personality.js';
import { randomCharacterProfile } from '../ai/personality.js';

export type Position =
  | 'GB'
  | 'DC'
  | 'DD'
  | 'DG'
  | 'MDC'
  | 'MC'
  | 'MOC'
  | 'MD'
  | 'MG'
  | 'AD'
  | 'AG'
  | 'BU';

export type Foot = 'gauche' | 'droit' | 'ambidextre';

export interface Attributes {
  // Technique
  finishing: number;
  passing: number;
  dribbling: number;
  crossing: number;
  firstTouch: number;
  longShots: number;
  freeKicks: number;
  heading: number;
  tackling: number;
  marking: number;
  // Physique
  pace: number;
  acceleration: number;
  stamina: number;
  strength: number;
  agility: number;
  jumping: number;
  // Mental
  positioning: number;
  decisions: number;
  leadership: number;
  determination: number;
  concentration: number;
  teamwork: number;
  // Gardien
  reflexes: number;
  handling: number;
  distribution: number;
  commandOfArea: number;
}

export const ATTRIBUTE_KEYS = [
  'finishing', 'passing', 'dribbling', 'crossing', 'firstTouch', 'longShots', 'freeKicks',
  'heading', 'tackling', 'marking', 'pace', 'acceleration', 'stamina', 'strength', 'agility',
  'jumping', 'positioning', 'decisions', 'leadership', 'determination', 'concentration',
  'teamwork', 'reflexes', 'handling', 'distribution', 'commandOfArea',
] as const satisfies readonly (keyof Attributes)[];

/** Pondérations par poste pour le calcul de la note globale. */
const POSITION_WEIGHTS: Record<Position, Partial<Record<keyof Attributes, number>>> = {
  GB: { reflexes: 5, handling: 4, commandOfArea: 3, distribution: 2.5, positioning: 3, concentration: 3, jumping: 2 },
  DC: { marking: 5, tackling: 4.5, heading: 4, strength: 3.5, positioning: 4, concentration: 3, passing: 2, jumping: 3 },
  DD: { tackling: 3.5, marking: 3.5, crossing: 3, pace: 4, stamina: 4, positioning: 3, teamwork: 2.5 },
  DG: { tackling: 3.5, marking: 3.5, crossing: 3, pace: 4, stamina: 4, positioning: 3, teamwork: 2.5 },
  MDC: { tackling: 4, marking: 3.5, passing: 4, positioning: 4, decisions: 3.5, stamina: 3.5, teamwork: 3 },
  MC: { passing: 5, firstTouch: 4, decisions: 4, stamina: 4, teamwork: 3.5, dribbling: 3, positioning: 3 },
  MOC: { passing: 4.5, dribbling: 4.5, firstTouch: 4.5, decisions: 4, longShots: 3, finishing: 3, freeKicks: 2.5 },
  MD: { crossing: 4, pace: 4, dribbling: 3.5, stamina: 4, passing: 3 },
  MG: { crossing: 4, pace: 4, dribbling: 3.5, stamina: 4, passing: 3 },
  AD: { dribbling: 5, pace: 5, acceleration: 4.5, crossing: 3.5, finishing: 3.5, agility: 3.5 },
  AG: { dribbling: 5, pace: 5, acceleration: 4.5, crossing: 3.5, finishing: 3.5, agility: 3.5 },
  BU: { finishing: 5.5, positioning: 4.5, firstTouch: 4, heading: 3.5, strength: 3, pace: 3.5, longShots: 2.5 },
};

/** Courbe d'évolution physique/technique par âge (multiplicateur de potentiel). */
export function ageCurve(age: number): number {
  if (age < 17) return 0.62;
  if (age < 21) return 0.62 + (age - 17) * 0.075;
  if (age < 25) return 0.92 + (age - 21) * 0.02;
  if (age <= 29) return 1;
  if (age <= 32) return 1 - (age - 29) * 0.025;
  if (age <= 36) return 0.925 - (age - 32) * 0.05;
  return Math.max(0.4, 0.725 - (age - 36) * 0.07);
}

/** Traits physiques qui vieillissent visiblement (Tome XIV, ch. 5). */
export interface Appearance {
  /** 0..1 — profondeur des rides. */
  wrinkles: number;
  /** 0..1 — densité capillaire (décroît avec l'âge). */
  hairDensity: number;
  hairStyle: string;
  beardStyle: string;
  /** 0..1 — longueur de barbe. */
  beardLength: number;
  skinTone: string;
  heightCm: number;
  weightKg: number;
  tattoos: string[];
  /** Cicatrices visibles héritées des blessures. */
  visibleScars: string[];
  /** Généré à partir d'une photo importée. */
  photoScanApplied: boolean;
}

export interface SeasonStats {
  season: number;
  clubId: string;
  appearances: number;
  minutes: number;
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  saves: number;
  cleanSheets: number;
  yellowCards: number;
  redCards: number;
  distanceKm: number;
  topSpeedKmh: number;
  averageRating: number;
  manOfTheMatch: number;
}

export function emptySeasonStats(season: number, clubId: string): SeasonStats {
  return {
    season,
    clubId,
    appearances: 0,
    minutes: 0,
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    saves: 0,
    cleanSheets: 0,
    yellowCards: 0,
    redCards: 0,
    distanceKm: 0,
    topSpeedKmh: 0,
    averageRating: 0,
    manOfTheMatch: 0,
  };
}

export interface Injury {
  readonly id: string;
  readonly label: string;
  readonly severity: 'light' | 'moderate' | 'serious';
  /** Minute absolue de guérison. */
  readonly recoversAt: number;
  readonly daysOut: number;
  /** Laisse une marque visible. */
  readonly leavesScar: boolean;
}

export interface PlayerIdentity {
  readonly id: string;
  name: string;
  readonly nationality: string;
  /** Seconde nationalité éligible en sélection. */
  secondNationality: string | null;
  birthYear: number;
  position: Position;
  secondaryPositions: Position[];
  foot: Foot;
  shirtNumber: number;
  /** Histoire d'origine choisie à la création (Tome IV, ch. 1). */
  backstory: string;
}

export interface PlayerState {
  readonly identity: PlayerIdentity;
  readonly profile: CharacterProfile;
  readonly appearance: Appearance;
  attributes: Attributes;
  /** Potentiel maximal atteignable 0..100. */
  potential: number;
  age: number;
  /** Forme du moment 0..1. */
  form: number;
  /** Fraîcheur physique 0..1. */
  fitness: number;
  /** Moral 0..1. */
  morale: number;
  /** Netteté mentale 0..1 — affectée par la pression et la vie privée. */
  sharpness: number;
  clubId: string | null;
  /** Nombre d'années au club actuel. */
  yearsAtClub: number;
  /** Réputation mondiale 0..100 (Tome XXVI, ch. 2). */
  reputation: number;
  /** Célébrité 0..100 : reconnaissance dans la rue et pression médiatique. */
  fame: number;
  /** Valeur marchande en euros. */
  marketValue: number;
  injuries: Injury[];
  seasons: SeasonStats[];
  /** Sélections nationales. */
  caps: number;
  internationalGoals: number;
  retired: boolean;
  retirementYear: number | null;
  /** Réputation par pays (Tome XXVI : « la réputation varie selon les pays »). */
  reputationByCountry: Record<string, number>;
}

const BACKSTORIES = [
  'formé dans les terrains de quartier, repéré à seize ans',
  'issu d’une famille de footballeurs, sous pression depuis l’enfance',
  'passé par le futsal avant de basculer sur grand terrain',
  'recruté à l’étranger très jeune, loin de sa famille',
  'refusé par trois centres de formation avant de percer',
  'passé par le championnat amateur jusqu’à vingt-et-un ans',
];

const HAIR_STYLES = ['court dégradé', 'tresses', 'boule à zéro', 'mi-long', 'afro court', 'coupe classique'];
const BEARD_STYLES = ['rasé de près', 'barbe de trois jours', 'barbe fournie', 'bouc', 'moustache'];
const SKIN_TONES = ['clair', 'mat', 'olive', 'brun', 'foncé', 'très foncé'];

export function createPlayer(
  options: {
    id: string;
    name: string;
    nationality: string;
    position: Position;
    foot?: Foot;
    age?: number;
    startingYear: number;
    quality?: number;
    potential?: number;
    backstory?: string;
    photoScan?: boolean;
  },
  rng: Rng,
): PlayerState {
  const age = options.age ?? 17;
  const quality = options.quality ?? 0.45;
  const potential = options.potential ?? clamp(rng.gaussian(70, 9), 45, 96);
  const profile = randomCharacterProfile(rng, quality);

  const base = potential * ageCurve(age);
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) {
    const isKeeperAttr =
      key === 'reflexes' || key === 'handling' || key === 'distribution' || key === 'commandOfArea';
    const relevant = isKeeperAttr === (options.position === 'GB');
    const target = relevant ? base : base * 0.35;
    attributes[key] = clamp(round(rng.gaussian(target, 7)), 1, 99);
  }

  return {
    identity: {
      id: options.id,
      name: options.name,
      nationality: options.nationality,
      secondNationality: null,
      birthYear: options.startingYear - age,
      position: options.position,
      secondaryPositions: [],
      foot: options.foot ?? rng.weighted([
        { item: 'droit' as Foot, weight: 7 },
        { item: 'gauche' as Foot, weight: 2.5 },
        { item: 'ambidextre' as Foot, weight: 0.5 },
      ]),
      shirtNumber: rng.int(2, 45),
      backstory: options.backstory ?? rng.pick(BACKSTORIES),
    },
    profile,
    appearance: {
      wrinkles: clamp01((age - 20) / 40),
      hairDensity: clamp01(1 - Math.max(0, age - 26) * 0.012),
      hairStyle: rng.pick(HAIR_STYLES),
      beardStyle: rng.pick(BEARD_STYLES),
      beardLength: rng.range(0, 0.6),
      skinTone: rng.pick(SKIN_TONES),
      heightCm: Math.round(rng.gaussian(options.position === 'GB' ? 190 : 180, 6)),
      weightKg: Math.round(rng.gaussian(76, 6)),
      tattoos: rng.chance(0.45) ? [rng.pick(['avant-bras', 'épaule', 'mollet', 'dos'])] : [],
      visibleScars: [],
      photoScanApplied: options.photoScan ?? false,
    },
    attributes,
    potential,
    age,
    form: 0.6,
    fitness: 1,
    morale: 0.7,
    sharpness: 0.6,
    clubId: null,
    yearsAtClub: 0,
    reputation: clamp(potential * 0.25, 1, 100),
    fame: clamp(potential * 0.15, 1, 100),
    marketValue: 0,
    injuries: [],
    seasons: [],
    caps: 0,
    internationalGoals: 0,
    retired: false,
    retirementYear: null,
    reputationByCountry: {},
  };
}

/** Note globale pondérée par le poste (0..100). */
export function overallRating(player: PlayerState, position?: Position): number {
  const weights = POSITION_WEIGHTS[position ?? player.identity.position];
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights) as [keyof Attributes, number][]) {
    total += player.attributes[key] * weight;
    weightSum += weight;
  }
  const base = weightSum === 0 ? 0 : total / weightSum;
  return clamp(round(base * (0.85 + player.form * 0.2)), 1, 99);
}

/** Note brute sans effet de forme — utilisée par le scouting et les fiches. */
export function baseRating(player: PlayerState, position?: Position): number {
  const weights = POSITION_WEIGHTS[position ?? player.identity.position];
  let total = 0;
  let weightSum = 0;
  for (const [key, weight] of Object.entries(weights) as [keyof Attributes, number][]) {
    total += player.attributes[key] * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : round(total / weightSum, 1);
}

/**
 * Valeur marchande : combine note, âge, réputation et forme.
 * Une courbe exponentielle rend les très hauts niveaux nettement plus chers.
 */
export function computeMarketValue(player: PlayerState): number {
  if (player.retired) return 0;
  const rating = baseRating(player);
  const ageFactor =
    player.age <= 23 ? 1.35 : player.age <= 27 ? 1.15 : player.age <= 30 ? 0.85 : player.age <= 33 ? 0.5 : 0.2;
  const potentialBonus = clamp01((player.potential - rating) / 30) * 0.4 + 1;
  const reputationFactor = 0.7 + player.reputation / 140;
  const formFactor = 0.9 + player.form * 0.2;
  const raw = Math.pow(Math.max(1, rating) / 10, 4.4) * 900;
  return Math.round(
    (raw * ageFactor * potentialBonus * reputationFactor * formFactor) / 100_000,
  ) * 100_000;
}

/** Salaire hebdomadaire attendu selon la valeur et le prestige du club. */
export function expectedWeeklyWage(player: PlayerState, clubPrestige: number): number {
  const value = player.marketValue > 0 ? player.marketValue : computeMarketValue(player);
  const base = value * 0.00035;
  const prestigeFactor = 0.6 + clubPrestige / 130;
  return Math.round((base * prestigeFactor) / 500) * 500;
}

/** Statistiques cumulées sur toute la carrière (Tome XXVIII, ch. 2). */
export function careerTotals(player: PlayerState): SeasonStats {
  const totals = emptySeasonStats(0, 'carrière');
  let ratingSum = 0;
  let ratedSeasons = 0;
  for (const season of player.seasons) {
    totals.appearances += season.appearances;
    totals.minutes += season.minutes;
    totals.goals += season.goals;
    totals.assists += season.assists;
    totals.shots += season.shots;
    totals.shotsOnTarget += season.shotsOnTarget;
    totals.passes += season.passes;
    totals.passesCompleted += season.passesCompleted;
    totals.tackles += season.tackles;
    totals.saves += season.saves;
    totals.cleanSheets += season.cleanSheets;
    totals.yellowCards += season.yellowCards;
    totals.redCards += season.redCards;
    totals.distanceKm += season.distanceKm;
    totals.topSpeedKmh = Math.max(totals.topSpeedKmh, season.topSpeedKmh);
    totals.manOfTheMatch += season.manOfTheMatch;
    if (season.appearances > 0) {
      ratingSum += season.averageRating * season.appearances;
      ratedSeasons += season.appearances;
    }
  }
  totals.averageRating = ratedSeasons > 0 ? round(ratingSum / ratedSeasons, 2) : 0;
  return totals;
}

export function currentSeasonStats(player: PlayerState, season: number): SeasonStats | undefined {
  return player.seasons.find((s) => s.season === season);
}

export function isInjured(player: PlayerState, now: number): boolean {
  return player.injuries.some((injury) => injury.recoversAt > now);
}

export function activeInjury(player: PlayerState, now: number): Injury | null {
  return player.injuries.find((injury) => injury.recoversAt > now) ?? null;
}

/** Applique le vieillissement visuel annuel (Tome XIV, ch. 5). */
export function ageAppearance(player: PlayerState): void {
  player.appearance.wrinkles = clamp01(player.appearance.wrinkles + 0.022);
  if (player.age > 26) {
    player.appearance.hairDensity = clamp01(player.appearance.hairDensity - 0.014);
  }
}
