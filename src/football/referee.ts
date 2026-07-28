/**
 * Infinity Football — Football / Arbitres
 *
 * Tome III, ch. 7 : « Chaque arbitre possède une personnalité, une tolérance
 * différente, une manière de gérer les joueurs, une réputation. Deux arbitres
 * ne dirigent jamais un match de la même façon. »
 *
 * Chaque arbitre est un individu persistant : il vieillit, gagne en réputation,
 * garde en mémoire les joueurs qui l'ont contesté, et sa gestion évolue selon
 * l'ambiance du stade et l'enjeu.
 */

import { clamp, clamp01 } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import { MemoryBank, MemoryFactory } from '../ai/memory.js';

export type RefereeStyle =
  | 'permissif'
  | 'équilibré'
  | 'strict'
  | 'pointilleux'
  | 'protecteur du jeu'
  | 'autoritaire';

export interface Referee {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  age: number;
  readonly style: RefereeStyle;
  /** Tolérance aux contacts 0..1 : 1 = laisse beaucoup jouer. */
  readonly tolerance: number;
  /** Propension à sortir des cartons 0..1. */
  readonly cardHappiness: number;
  /** Sensibilité à la pression du public 0..1. */
  readonly crowdInfluence: number;
  /** Constance des décisions 0..1. */
  readonly consistency: number;
  /** Qualité du dialogue avec les joueurs 0..1. */
  readonly communication: number;
  /** Réputation 0..100 : détermine les matchs confiés. */
  reputation: number;
  /** Nombre de matchs dirigés. */
  matches: number;
  /** Mémoire des joueurs et des clubs. */
  readonly memory: MemoryBank;
}

const STYLE_PRESETS: Record<RefereeStyle, { tolerance: number; cards: number; crowd: number; consistency: number; communication: number }> = {
  permissif: { tolerance: 0.85, cards: 0.25, crowd: 0.4, consistency: 0.6, communication: 0.7 },
  'équilibré': { tolerance: 0.6, cards: 0.5, crowd: 0.35, consistency: 0.8, communication: 0.7 },
  strict: { tolerance: 0.35, cards: 0.75, crowd: 0.25, consistency: 0.85, communication: 0.5 },
  pointilleux: { tolerance: 0.2, cards: 0.85, crowd: 0.3, consistency: 0.75, communication: 0.35 },
  'protecteur du jeu': { tolerance: 0.5, cards: 0.6, crowd: 0.3, consistency: 0.8, communication: 0.85 },
  autoritaire: { tolerance: 0.4, cards: 0.7, crowd: 0.15, consistency: 0.9, communication: 0.45 },
};

const STYLES: readonly RefereeStyle[] = [
  'permissif',
  'équilibré',
  'strict',
  'pointilleux',
  'protecteur du jeu',
  'autoritaire',
];

export function createReferee(
  id: string,
  name: string,
  countryId: string,
  rng: Rng,
): Referee {
  const style = rng.pick(STYLES);
  const preset = STYLE_PRESETS[style];
  return {
    id,
    name,
    countryId,
    age: rng.int(31, 52),
    style,
    tolerance: clamp01(rng.gaussian(preset.tolerance, 0.08)),
    cardHappiness: clamp01(rng.gaussian(preset.cards, 0.08)),
    crowdInfluence: clamp01(rng.gaussian(preset.crowd, 0.1)),
    consistency: clamp01(rng.gaussian(preset.consistency, 0.07)),
    communication: clamp01(rng.gaussian(preset.communication, 0.1)),
    reputation: clamp(rng.gaussian(55, 14), 20, 95),
    matches: 0,
    memory: new MemoryBank({ capacity: 80, halfLifeDays: 300 }),
  };
}

export interface FoulContext {
  /** Agressivité de l'action 0..1. */
  readonly severity: number;
  /** Zone du terrain 0 (défense) .. 1 (surface adverse). */
  readonly zone: number;
  /** Minute du match. */
  readonly minute: number;
  /** Pression du public en faveur de l'équipe fautive (-1 contre .. +1 pour). */
  readonly crowdPressure: number;
  /** Enjeu du match 0..1. */
  readonly stakes: number;
  /** Le joueur a déjà un carton jaune. */
  readonly alreadyBooked: boolean;
  /** Historique du joueur avec cet arbitre (-1 conflictuel .. +1 cordial). */
  readonly playerRapport: number;
}

export type RefereeDecision =
  | { kind: 'avantage' }
  | { kind: 'faute' }
  | { kind: 'jaune' }
  | { kind: 'rouge' }
  | { kind: 'penalty' }
  | { kind: 'penalty+jaune' }
  | { kind: 'penalty+rouge' };

/**
 * Décision d'arbitrage. Deux arbitres face à la même action ne concluent pas
 * de la même façon : la tolérance, la sensibilité au public, la mémoire du
 * joueur et la constance interviennent toutes.
 */
export function judge(referee: Referee, context: FoulContext, rng: Rng, now: number): RefereeDecision {
  // Un arbitre inconstant introduit du bruit dans sa propre lecture.
  const noise = rng.gaussian(0, (1 - referee.consistency) * 0.18);
  const crowdBias = context.crowdPressure * referee.crowdInfluence * 0.12;
  const rapportBias = context.playerRapport * (1 - referee.communication) * -0.08;
  const memoryBias = referee.memory.sentimentTowards('contestation', now) * -0.06;

  const perceived = clamp01(context.severity + noise - crowdBias + rapportBias + memoryBias);
  const threshold = referee.tolerance * 0.55;

  if (perceived < threshold * 0.6) return { kind: 'avantage' };

  const inBox = context.zone > 0.88;
  const isFoul = perceived >= threshold;
  if (!isFoul) return { kind: 'avantage' };

  const cardPropensity =
    referee.cardHappiness * (0.7 + context.stakes * 0.5) * (1 + (perceived - threshold));
  const redThreshold = 0.86 - referee.cardHappiness * 0.08;
  const yellowThreshold = 0.5 - referee.cardHappiness * 0.12;

  if (perceived >= redThreshold && rng.chance(clamp01(cardPropensity * 0.55))) {
    return inBox ? { kind: 'penalty+rouge' } : { kind: 'rouge' };
  }
  if (perceived >= yellowThreshold && rng.chance(clamp01(cardPropensity * 0.65))) {
    if (context.alreadyBooked) {
      return inBox ? { kind: 'penalty+rouge' } : { kind: 'rouge' };
    }
    return inBox ? { kind: 'penalty+jaune' } : { kind: 'jaune' };
  }
  return inBox ? { kind: 'penalty' } : { kind: 'faute' };
}

/** Temps additionnel accordé : dépend du style et des interruptions. */
export function stoppageTime(
  referee: Referee,
  events: { goals: number; cards: number; substitutions: number; injuries: number },
  rng: Rng,
): number {
  const base =
    events.goals * 0.6 + events.cards * 0.35 + events.substitutions * 0.45 + events.injuries * 1.4;
  const styleFactor = referee.style === 'pointilleux' ? 1.3 : referee.style === 'permissif' ? 0.75 : 1;
  return clamp(Math.round(base * styleFactor + rng.range(0, 1.6)), 1, 12);
}

/** Un joueur conteste : la relation avec l'arbitre se dégrade durablement. */
export function registerDissent(referee: Referee, playerId: string, playerName: string, now: number): void {
  referee.memory.remember(
    MemoryFactory.interaction(
      `ref:${referee.id}:dissent:${playerId}:${now}`,
      `contestation de ${playerName}`,
      ['contestation', playerId],
      now,
      -0.7,
    ),
  );
}

/** Un joueur fait preuve de fair-play : capital de sympathie. */
export function registerFairPlay(referee: Referee, playerId: string, playerName: string, now: number): void {
  referee.memory.remember(
    MemoryFactory.fairplay(
      `ref:${referee.id}:fair:${playerId}:${now}`,
      `geste de fair-play de ${playerName}`,
      ['fairplay', playerId],
      now,
    ),
  );
}

/** Relation actuelle entre un joueur et un arbitre (-1..1). */
export function rapportWith(referee: Referee, playerId: string, now: number): number {
  return clamp(referee.memory.sentimentTowards(playerId, now), -1, 1);
}

/** Après le match : la réputation évolue selon la qualité de la prestation. */
export function updateRefereeReputation(
  referee: Referee,
  performance: { correctDecisions: number; totalDecisions: number; controversies: number },
): void {
  referee.matches += 1;
  if (performance.totalDecisions === 0) return;
  const accuracy = performance.correctDecisions / performance.totalDecisions;
  const delta = (accuracy - 0.85) * 8 - performance.controversies * 1.6;
  referee.reputation = clamp(referee.reputation + delta, 10, 100);
}

/** Description en langage naturel, utilisée par la presse et le HUD. */
export function describeReferee(referee: Referee): string {
  const parts: string[] = [`arbitre ${referee.style}`];
  if (referee.tolerance > 0.7) parts.push('laisse beaucoup jouer');
  else if (referee.tolerance < 0.35) parts.push('siffle au moindre contact');
  if (referee.cardHappiness > 0.7) parts.push('sort facilement les cartons');
  if (referee.crowdInfluence > 0.55) parts.push('sensible à l’ambiance du stade');
  if (referee.communication > 0.75) parts.push('dialogue beaucoup avec les joueurs');
  if (referee.reputation > 80) parts.push('réputation internationale');
  return parts.join(', ');
}
