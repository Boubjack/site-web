/**
 * Infinity Football — Décision
 *
 * Chaque joueur, plusieurs fois par seconde, énumère ce qu'il pourrait faire,
 * estime ce que ça rapporterait, ce que ça risquerait, et choisit. Il n'y a
 * aucune table de comportement, aucune machine à états, aucun script : il n'y
 * a que des options évaluées sur la perception — imparfaite — de celui qui
 * décide.
 *
 * Trois mécanismes empêchent la mécanique de se voir :
 *
 *  1. La perception diffère d'un joueur à l'autre (voir perception.ts). Deux
 *     joueurs identiques dans la même situation ne voient pas la même chose.
 *  2. Le choix est un tirage pondéré sur les options, pas un maximum. La
 *     « température » du tirage dépend du sang-froid, de la fatigue et de
 *     l'enjeu : un joueur lucide choisit presque toujours la meilleure option,
 *     un joueur cuit sous pression fait des choix qu'il regrettera.
 *  3. Le tempérament déforme l'évaluation elle-même. Un joueur audacieux
 *     surévalue la passe en profondeur ; un joueur prudent la sous-évalue. Ce
 *     n'est pas du bruit ajouté après coup, c'est une autre lecture du jeu.
 *
 * Chaque poste raisonne différemment : un gardien ne pense pas comme un
 * défenseur, un défenseur ne pense pas comme un meneur.
 *
 * Tome III et Tome VIII — « aucun déplacement ne doit sembler scripté ».
 */

import { clamp, clamp01 } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import type { Position } from '../career/player.js';
import type { Tactics } from './tactics.js';
import {
  PITCH_LENGTH,
  PITCH_WIDTH,
  distanceToGoal,
  expectedGoalsFromPosition,
  goalCentre,
  inPenaltyArea,
  type Side,
} from './pitch.js';
import {
  isOffside,
  offsideLine,
  passingLane,
  positionalValue,
  spaceAt,
  spotMistake,
  type MatchActor,
  type Perception,
  type PerceivedActor,
  type WorldState,
} from './perception.js';
import { timeToReach } from './player-physics.js';

/** Ce qu'un joueur en possession peut décider de faire. */
export type OnBallAction =
  | { kind: 'passe'; targetId: string; targetX: number; targetY: number; power: number; risk: number; lofted: boolean }
  | { kind: 'centre'; targetX: number; targetY: number; power: number; risk: number }
  | { kind: 'tir'; targetX: number; targetY: number; power: number; expected: number }
  | { kind: 'conduite'; dirX: number; dirY: number; sprint: boolean }
  | { kind: 'dribble'; dirX: number; dirY: number; againstId: string | null }
  | { kind: 'protection'; awayFromId: string | null }
  | { kind: 'dégagement'; dirX: number; dirY: number }
  | { kind: 'temporisation' };

/** Ce qu'un joueur sans ballon décide de faire. */
export type OffBallAction =
  | { kind: 'pressing'; targetId: string; targetX: number; targetY: number; intensity: number }
  | { kind: 'couverture'; targetX: number; targetY: number }
  | { kind: 'marquage'; targetId: string; targetX: number; targetY: number }
  | { kind: 'repli'; targetX: number; targetY: number }
  | { kind: 'appel'; targetX: number; targetY: number; sprint: boolean; breakingLine: boolean }
  | { kind: 'soutien'; targetX: number; targetY: number }
  | { kind: 'occupation'; targetX: number; targetY: number }
  | { kind: 'interception'; targetX: number; targetY: number };

/** Contexte de match qui déforme toutes les décisions. */
export interface DecisionContext {
  readonly minute: number;
  /** Différence de buts du point de vue du joueur qui décide. */
  readonly goalDifference: number;
  /** Enjeu 0..1 : un match amical ne se joue pas comme une finale. */
  readonly stakes: number;
  /** Public 0..1, hostile ou porteur selon le camp. */
  readonly crowdPressure: number;
  /** Terrain glissant 0..1 : on tente moins de gestes techniques. */
  readonly slippery: number;
  readonly tactics: Tactics;
  /** L'équipe a le ballon. */
  readonly inPossession: boolean;
}

/**
 * Les consignes tactiques sont écrites comme un entraîneur les formule
 * (« bloc haut », « jeu large »). La décision, elle, a besoin de nombres.
 */
function widthFactor(tactics: Tactics): number {
  return tactics.width === 'large' ? 0.85 : tactics.width === 'etroit' ? 0.2 : 0.5;
}

function defensiveLineFactor(tactics: Tactics): number {
  return tactics.defensiveLine === 'haute' ? 0.85 : tactics.defensiveLine === 'basse' ? 0.2 : 0.5;
}

/** Verticalité du jeu : à quel point on cherche l'avant plutôt que la sécurité. */
function directnessFactor(tactics: Tactics): number {
  switch (tactics.transition) {
    case 'verticale':
      return 0.8;
    case 'contre-attaque':
      return 0.9;
    case 'lente':
      return 0.2;
    default:
      return 0.5;
  }
}

/** Le gegenpressing est la consigne qui déclenche le contre-pressing immédiat. */
function counterPressing(tactics: Tactics): boolean {
  return tactics.pressing === 'gegenpressing';
}

/** Une option évaluée, avant tirage. */
interface Option<T> {
  readonly action: T;
  /** Valeur espérée : gain probable moins risque. */
  value: number;
}

/**
 * Lucidité du moment : entre 0 et 1. Elle décide si le joueur choisit vraiment
 * la meilleure option ou une option acceptable. C'est le seul endroit du moteur
 * où le hasard entre dans la décision, et il est justifié : un joueur cuit,
 * pressé, dans un stade bouillant, ne voit pas la bonne solution.
 */
function clarityOf(actor: MatchActor, perception: Perception, context: DecisionContext): number {
  const composure = actor.attributes.concentration * 0.5 + actor.attributes.decisions * 0.5;
  const base = composure / 100;
  const breath = 0.7 + actor.body.sprintReserve * 0.3;
  const pressed = 1 - perception.pressure * 0.35;
  const crowd = 1 - context.crowdPressure * 0.12 * context.stakes;
  const confident = 0.85 + actor.confidence * 0.15;
  const balance = 0.6 + actor.body.balance * 0.4;
  return clamp01(base * breath * pressed * crowd * confident * balance);
}

/**
 * Choisit parmi des options évaluées. Plus la lucidité est haute, plus le choix
 * se concentre sur la meilleure ; plus elle est basse, plus il s'éparpille.
 */
function chooseAmong<T>(options: Option<T>[], clarity: number, rng: Rng): T | null {
  if (options.length === 0) return null;
  if (options.length === 1) return options[0]!.action;

  // Température d'un softmax : basse = déterministe, haute = erratique.
  const temperature = 0.08 + (1 - clarity) * 0.5;
  let best = -Infinity;
  for (const option of options) if (option.value > best) best = option.value;

  let total = 0;
  const weights: number[] = [];
  for (const option of options) {
    const weight = Math.exp((option.value - best) / temperature);
    weights.push(weight);
    total += weight;
  }

  let roll = rng.next() * total;
  for (let index = 0; index < options.length; index++) {
    roll -= weights[index]!;
    if (roll <= 0) return options[index]!.action;
  }
  return options[options.length - 1]!.action;
}

/** Le sens de l'attaque pour ce camp : +1 vers x croissant. */
function attackDirection(side: Side): number {
  return side === 'left' ? 1 : -1;
}

/**
 * Appétit pour le risque à cet instant. Mener 2-0 à la 85ᵉ minute et être mené
 * 0-1 à la 85ᵉ ne produisent pas le même football — c'est ici que ça se joue.
 */
function riskAppetite(actor: MatchActor, context: DecisionContext): number {
  let appetite = actor.profile.risk * 0.55 + context.tactics.passRisk * 0.45;

  // Courir après le score fait prendre des risques, et de plus en plus tard.
  const urgency = clamp01((context.minute - 60) / 35);
  if (context.goalDifference < 0) appetite += urgency * (0.18 + Math.min(2, -context.goalDifference) * 0.09);
  // Mener pousse à sécuriser, sauf pour les tempéraments joueurs.
  if (context.goalDifference > 0) appetite -= urgency * 0.22 * (1 - actor.profile.risk * 0.5);

  // Un joueur en confiance ose ; un joueur qui doute joue simple.
  appetite += (actor.confidence - 0.5) * 0.2;
  // On ne tente pas un extérieur du pied sur un terrain savonné.
  appetite -= context.slippery * 0.15;
  // La fatigue rend prudent, par instinct de conservation.
  appetite -= (1 - actor.body.sprintReserve) * 0.1;

  return clamp01(appetite);
}

// ── Décisions ballon au pied ───────────────────────────────────────────────

/**
 * Le porteur du ballon évalue toutes ses options : tirer, passer, centrer,
 * conduire, dribbler, protéger, dégager, temporiser.
 */
export function decideOnBall(
  actor: MatchActor,
  perception: Perception,
  world: WorldState,
  context: DecisionContext,
  rng: Rng,
): OnBallAction {
  const options: Option<OnBallAction>[] = [];
  const dir = attackDirection(actor.side);
  const risk = riskAppetite(actor, context);
  const clarity = clarityOf(actor, perception, context);
  const goal = goalCentre(actor.side === 'left' ? 'right' : 'left');
  const line = offsideLine(perception, actor.side);

  const isKeeper = actor.position === 'GB';
  const defensiveThird = dir > 0 ? actor.body.x < 35 : actor.body.x > PITCH_LENGTH - 35;

  // ── Tirer ────────────────────────────────────────────────────────────────
  if (!isKeeper) {
    const xg = expectedGoalsFromPosition(actor.body.x, actor.body.y, actor.side);
    const distance = distanceToGoal(actor.body.x, actor.body.y, actor.side);
    const finishing = actor.attributes.finishing / 100;
    const longRange = actor.attributes.longShots / 100;
    // Le tireur estime sa propre chance : les bons finisseurs se surestiment
    // moins que les autres ne se sous-estiment.
    const skill = distance < 18 ? finishing : longRange;
    const estimated = xg * (0.55 + skill * 0.9);
    // Un défenseur devant soi ferme l'angle et décourage la frappe.
    const laneToGoal = passingLane(actor.body.x, actor.body.y, goal.x, goal.y, perception.opponents, 24);

    if (distance < 38 && perception.ballZ < 1.2) {
      const value =
        estimated * laneToGoal * (1 + risk * 0.35) * (0.8 + actor.confidence * 0.4) -
        // Tirer, c'est rendre le ballon si on ne marque pas.
        (1 - estimated) * 0.055 * (1 - risk * 0.4);
      options.push({
        action: {
          kind: 'tir',
          targetX: goal.x,
          targetY: goal.y + rng.range(-2.6, 2.6) * (1 - finishing * 0.55),
          power: 22 + skill * 10 + rng.range(-2, 2),
          expected: estimated,
        },
        value,
      });
    }
  }

  // ── Passer ───────────────────────────────────────────────────────────────
  for (const mate of perception.teammates) {
    if (mate.distance > 55) continue;
    const lane = passingLane(actor.body.x, actor.body.y, mate.x, mate.y, perception.opponents);
    if (lane < 0.05) continue;

    const offside = isOffside(mate.x, line, actor.body.x, actor.side);
    if (offside) continue;

    const gain = positionalValue(mate.x, mate.y, actor.side) - positionalValue(actor.body.x, actor.body.y, actor.side);
    const mateSpace = spaceAt(mate.x, mate.y, perception.opponents);
    const forward = (mate.x - actor.body.x) * dir;

    // Une passe se juge sur ce qu'elle rapporte, ce qu'elle risque, et la
    // précision qu'elle demande. La distance coûte, l'incertitude aussi.
    const accuracy = clamp01(
      (actor.attributes.passing / 100) * 0.65 +
        actor.profile.vision * 0.2 +
        mate.confidence * 0.15 -
        mate.distance * 0.004 -
        perception.pressure * 0.15,
    );
    const completion = clamp01(lane * 0.6 + accuracy * 0.4);
    const turnoverCost = defensiveThird ? 0.42 : 0.16;

    let value =
      completion * (0.1 + gain * 1.5 + clamp01(mateSpace / 14) * 0.22 + clamp01(forward / 30) * 0.28) -
      (1 - completion) * turnoverCost;

    // Le tempérament déforme la lecture : l'audacieux voit la passe en
    // profondeur plus belle qu'elle n'est.
    if (forward > 12) value += (risk - 0.5) * 0.3;
    // Les consignes comptent : un bloc qui doit jouer vertical joue vertical.
    value += directnessFactor(context.tactics) * clamp01(forward / 25) * 0.25;
    // Un gardien qui relance long quand il est pressé, c'est du bon sens.
    if (isKeeper && perception.pressure > 0.5 && mate.distance > 25) value += 0.25;

    const lofted = lane < 0.4 || (mate.distance > 28 && perception.pressure > 0.4);
    options.push({
      action: {
        kind: 'passe',
        targetId: mate.id,
        targetX: mate.x + mate.vx * 0.35,
        targetY: mate.y + mate.vy * 0.35,
        power: clamp(6 + mate.distance * 0.75, 6, 32),
        risk: 1 - completion,
        lofted,
      },
      value,
    });
  }

  // ── Centrer ──────────────────────────────────────────────────────────────
  const wide = Math.abs(actor.body.y - PITCH_WIDTH / 2) > 18;
  const advanced = dir > 0 ? actor.body.x > 68 : actor.body.x < PITCH_LENGTH - 68;
  if (wide && advanced && !isKeeper) {
    const boxTargets = perception.teammates.filter((mate) =>
      inPenaltyArea(mate.x, mate.y, actor.side === 'left' ? 'right' : 'left'),
    );
    if (boxTargets.length > 0) {
      const crossing = actor.attributes.crossing / 100;
      const aerial = boxTargets.reduce((best, mate) => Math.max(best, mate.confidence), 0);
      const value = 0.16 + crossing * 0.3 + boxTargets.length * 0.06 + aerial * 0.1 + widthFactor(context.tactics) * 0.12;
      const target = boxTargets[rng.int(0, boxTargets.length - 1)]!;
      options.push({
        action: {
          kind: 'centre',
          targetX: target.x + rng.range(-3, 3) * (1 - crossing * 0.6),
          targetY: target.y + rng.range(-3, 3) * (1 - crossing * 0.6),
          power: 18 + crossing * 6,
          risk: 0.55 - crossing * 0.2,
        },
        value,
      });
    }
  }

  // ── Conduire le ballon ───────────────────────────────────────────────────
  {
    const ahead = spaceAt(actor.body.x + dir * 8, actor.body.y, perception.opponents);
    const gain =
      positionalValue(actor.body.x + dir * 8, actor.body.y, actor.side) -
      positionalValue(actor.body.x, actor.body.y, actor.side);
    const value =
      gain * 1.3 +
      clamp01(ahead / 12) * 0.3 -
      perception.pressure * 0.35 +
      (actor.attributes.dribbling / 100) * 0.12;
    options.push({
      action: { kind: 'conduite', dirX: dir, dirY: rng.range(-0.25, 0.25), sprint: ahead > 8 },
      value,
    });
  }

  // ── Dribbler un adversaire ───────────────────────────────────────────────
  const nearest = perception.opponents
    .filter((opponent) => opponent.distance < 4.5)
    .sort((a, b) => a.distance - b.distance)[0];
  if (nearest && !isKeeper) {
    const dribbling = actor.attributes.dribbling / 100;
    const agility = actor.attributes.agility / 100;
    const mistake = spotMistake(perception, world);
    const exploitable = mistake && mistake.targetId === nearest.id ? mistake.severity : 0;
    const success = clamp01(dribbling * 0.55 + agility * 0.25 + actor.profile.flair * 0.2 + exploitable * 0.35 - 0.18);
    const value =
      success * (0.28 + positionalValue(actor.body.x + dir * 6, actor.body.y, actor.side) * 0.6) -
      (1 - success) * (defensiveThird ? 0.5 : 0.22) +
      (risk - 0.5) * 0.25 +
      actor.profile.flair * 0.08;
    // Le côté vers lequel on dribble : celui où il y a de l'espace.
    const leftSpace = spaceAt(actor.body.x + dir * 3, actor.body.y + 4, perception.opponents);
    const rightSpace = spaceAt(actor.body.x + dir * 3, actor.body.y - 4, perception.opponents);
    options.push({
      action: {
        kind: 'dribble',
        dirX: dir,
        dirY: leftSpace > rightSpace ? 0.6 : -0.6,
        againstId: nearest.id,
      },
      value,
    });
  }

  // ── Protéger le ballon ───────────────────────────────────────────────────
  if (perception.pressure > 0.35) {
    const strength = actor.attributes.strength / 100;
    const value = 0.06 + strength * 0.2 + perception.pressure * 0.18 - risk * 0.12;
    options.push({
      action: { kind: 'protection', awayFromId: nearest?.id ?? null },
      value,
    });
  }

  // ── Dégager ──────────────────────────────────────────────────────────────
  if (defensiveThird && perception.pressure > 0.45) {
    // Dégager n'est presque jamais la meilleure option — sauf quand ça l'est.
    const danger = 1 - positionalValue(actor.body.x, actor.body.y, actor.side === 'left' ? 'right' : 'left');
    const value = perception.pressure * 0.5 + danger * 0.25 - risk * 0.3;
    options.push({
      action: { kind: 'dégagement', dirX: dir, dirY: rng.range(-0.6, 0.6) },
      value,
    });
  }

  // ── Temporiser ───────────────────────────────────────────────────────────
  {
    // Garder le ballon a de la valeur quand on mène et que le temps joue pour
    // nous : c'est de la gestion, pas de la passivité.
    const closing = clamp01((context.minute - 70) / 25);
    const value =
      0.04 +
      (context.goalDifference > 0 ? closing * 0.4 : 0) -
      perception.pressure * 0.4 +
      (1 - context.tactics.tempo) * 0.1;
    options.push({ action: { kind: 'temporisation' }, value });
  }

  return chooseAmong(options, clarity, rng) ?? { kind: 'temporisation' };
}

// ── Décisions sans ballon ──────────────────────────────────────────────────

/**
 * Un joueur sans ballon décide où aller. C'est ici que se jouent le pressing,
 * la couverture, les appels et l'occupation des espaces — c'est-à-dire 95 % du
 * temps de jeu d'un footballeur.
 */
export function decideOffBall(
  actor: MatchActor,
  perception: Perception,
  world: WorldState,
  context: DecisionContext,
  rng: Rng,
): OffBallAction {
  return context.inPossession
    ? decideInPossession(actor, perception, context, rng)
    : decideOutOfPossession(actor, perception, world, context, rng);
}

/** Comportement quand l'équipe a le ballon : offrir, occuper, décrocher, percuter. */
function decideInPossession(
  actor: MatchActor,
  perception: Perception,
  context: DecisionContext,
  rng: Rng,
): OffBallAction {
  const options: Option<OffBallAction>[] = [];
  const dir = attackDirection(actor.side);
  const clarity = clarityOf(actor, perception, context);
  const risk = riskAppetite(actor, context);
  const line = offsideLine(perception, actor.side);
  const role = roleOf(actor.position);

  // ── Appel en profondeur ──────────────────────────────────────────────────
  if (role !== 'gardien' && role !== 'défenseur') {
    // On part dans le dos de la défense, juste avant la ligne : trop tôt, c'est
    // hors-jeu ; trop tard, l'espace s'est refermé.
    const targetX = line + dir * rng.range(1, 7);
    const targetY = clamp(actor.body.y + rng.range(-9, 9), 3, PITCH_WIDTH - 3);
    const space = spaceAt(targetX, targetY, perception.opponents);
    const offsideRisk = clamp01((dir > 0 ? targetX - line : line - targetX) / 6);
    const timing = clamp01(actor.profile.anticipation * 0.6 + (actor.attributes.positioning / 100) * 0.4);

    const value =
      positionalValue(targetX, targetY, actor.side) * 1.1 +
      clamp01(space / 12) * 0.35 -
      offsideRisk * (0.5 - timing * 0.3) +
      risk * 0.2 +
      (role === 'attaquant' ? 0.22 : 0);
    options.push({
      action: { kind: 'appel', targetX, targetY, sprint: true, breakingLine: true },
      value,
    });
  }

  // ── Se montrer en soutien ────────────────────────────────────────────────
  {
    const targetX = perception.ballX - dir * rng.range(4, 12);
    const targetY = clamp(perception.ballY + rng.range(-14, 14), 2, PITCH_WIDTH - 2);
    const lane = passingLane(perception.ballX, perception.ballY, targetX, targetY, perception.opponents);
    const value =
      lane * 0.45 +
      clamp01(spaceAt(targetX, targetY, perception.opponents) / 12) * 0.25 +
      (role === 'milieu' ? 0.22 : 0.05) -
      Math.abs(actor.body.x - targetX) * 0.004;
    options.push({ action: { kind: 'soutien', targetX, targetY }, value });
  }

  // ── Occuper sa zone ──────────────────────────────────────────────────────
  {
    // La position de référence glisse avec le ballon : c'est le bloc qui
    // respire, pas onze joueurs punaisés sur des coordonnées fixes.
    const shift = (perception.ballX - PITCH_LENGTH / 2) * (0.25 + context.tactics.compactness * 0.3);
    const lateral = (perception.ballY - PITCH_WIDTH / 2) * (0.12 + (1 - widthFactor(context.tactics)) * 0.2);
    const targetX = clamp(actor.anchorX + shift, 2, PITCH_LENGTH - 2);
    const targetY = clamp(actor.anchorY + lateral, 2, PITCH_WIDTH - 2);
    const drift = Math.hypot(actor.body.x - targetX, actor.body.y - targetY);
    const value = 0.18 + clamp01(drift / 18) * 0.4;
    options.push({ action: { kind: 'occupation', targetX, targetY }, value });
  }

  // ── Créer de l'espace pour un autre ──────────────────────────────────────
  if (role === 'attaquant' || role === 'milieu') {
    // Décrocher ou s'écarter pour ouvrir un couloir : le geste le plus
    // intelligent du football, et le moins visible.
    const away = actor.body.y > PITCH_WIDTH / 2 ? 1 : -1;
    const targetX = clamp(actor.body.x - dir * rng.range(2, 8), 2, PITCH_LENGTH - 2);
    const targetY = clamp(actor.body.y + away * rng.range(5, 12), 2, PITCH_WIDTH - 2);
    const pulls = perception.opponents.filter((opponent) => opponent.distance < 12).length;
    const value = pulls * 0.12 + (actor.profile.vision - 0.5) * 0.25 + widthFactor(context.tactics) * 0.1;
    options.push({ action: { kind: 'appel', targetX, targetY, sprint: false, breakingLine: false }, value });
  }

  return chooseAmong(options, clarity, rng) ?? {
    kind: 'occupation',
    targetX: actor.anchorX,
    targetY: actor.anchorY,
  };
}

/** Comportement sans ballon : presser, marquer, couvrir, se replier, intercepter. */
function decideOutOfPossession(
  actor: MatchActor,
  perception: Perception,
  world: WorldState,
  context: DecisionContext,
  rng: Rng,
): OffBallAction {
  const options: Option<OffBallAction>[] = [];
  const dir = attackDirection(actor.side);
  const clarity = clarityOf(actor, perception, context);
  const role = roleOf(actor.position);
  const ownGoal = goalCentre(actor.side);

  const carrier = perception.opponents.find((opponent) => opponent.id === world.carrierId) ?? null;
  const ballLoose = world.carrierId === null;

  // ── Presser le porteur ───────────────────────────────────────────────────
  // Un gardien ne presse jamais hors de sa zone : quel que soit le calcul
  // d'utilité, sortir à quarante mètres de son but n'est pas une option de
  // football. C'est la seule interdiction structurelle du système ; tout le
  // reste est évalué.
  const keeperMayPress =
    role !== 'gardien' ||
    (carrier !== null && Math.hypot(carrier.x - ownGoal.x, carrier.y - ownGoal.y) < 25);
  if (carrier && keeperMayPress) {
    const distance = carrier.distance;
    const arrivalTime = timeToReach(actor.body, actor.physical, carrier.x, carrier.y);
    // La hauteur de pressing est une consigne : un bloc bas ne monte pas
    // chercher le porteur à quarante mètres de son but.
    const pressingHeight =
      context.tactics.pressing === 'haut' ? 0.85 : context.tactics.pressing === 'medium' ? 0.55 : 0.3;
    const ownHalfProgress = dir > 0 ? carrier.x / PITCH_LENGTH : 1 - carrier.x / PITCH_LENGTH;
    const withinRemit = ownHalfProgress < pressingHeight + 0.2;

    const workRate = actor.profile.workRate;
    const aggression = actor.profile.aggression * 0.6 + context.tactics.aggression * 0.4;
    // On part au pressing sur un porteur qu'on peut réellement rejoindre. Quatre
    // secondes, c'est la durée d'une course de pressing crédible ; en dessous de
    // trois, aucun bloc ne montait jamais.
    const canReach = clamp01(1 - arrivalTime / 4.2);
    const mistake = spotMistake(perception, world);
    const smellsBlood = mistake && mistake.targetId === carrier.id ? mistake.severity : 0;

    let value =
      canReach * (0.75 + aggression * 0.5) * (withinRemit ? 1 : 0.3) +
      smellsBlood * 0.55 +
      workRate * 0.15 -
      (1 - actor.body.sprintReserve) * 0.3 -
      distance * 0.012;
    // Le premier pressing est celui du joueur le plus proche : les autres
    // couvrent. Sans cela, onze joueurs partaient sur le même ballon.
    if (!perception.closestOfTeam) value -= 0.35;

    // Contre-pressing : dans les cinq secondes suivant une perte, tout le monde
    // remonte. C'est la fenêtre où l'adversaire est le plus vulnérable.
    if (counterPressing(context.tactics) && recentlyLost(world)) {
      value += 0.4 * workRate;
    }

    options.push({
      action: {
        kind: 'pressing',
        targetId: carrier.id,
        targetX: carrier.x + carrier.vx * 0.4,
        targetY: carrier.y + carrier.vy * 0.4,
        intensity: clamp01(0.5 + aggression * 0.5),
      },
      value,
    });
  }

  // ── Aller au ballon libre ────────────────────────────────────────────────
  if (ballLoose) {
    const value =
      (perception.closestOfTeam ? 0.85 : 0.15) +
      clamp01(1 - perception.timeToBall / 3) * 0.5 +
      actor.profile.anticipation * 0.2;
    options.push({
      action: { kind: 'interception', targetX: perception.ballNextX, targetY: perception.ballNextY },
      value,
    });
  }

  // ── Marquer un adversaire dangereux ──────────────────────────────────────
  {
    let bestTarget: PerceivedActor | null = null;
    let bestThreat = 0;
    for (const opponent of perception.opponents) {
      if (opponent.id === world.carrierId) continue;
      // La menace, c'est la valeur de sa position plus l'espace dont il jouit.
      const threat =
        positionalValue(opponent.x, opponent.y, opponent.side) * 0.7 +
        clamp01(spaceAt(opponent.x, opponent.y, perception.teammates) / 15) * 0.3;
      // On marque ce qui est dans sa zone, pas à l'autre bout du terrain.
      const relevance = clamp01(1 - Math.hypot(opponent.x - actor.anchorX, opponent.y - actor.anchorY) / 30);
      const score = threat * relevance;
      if (score > bestThreat) {
        bestThreat = score;
        bestTarget = opponent;
      }
    }
    if (bestTarget) {
      const marking = actor.attributes.marking / 100;
      // On se place entre l'adversaire et son but : le b.a.-ba du marquage.
      const toGoalX = ownGoal.x - bestTarget.x;
      const toGoalY = ownGoal.y - bestTarget.y;
      const norm = Math.max(0.5, Math.hypot(toGoalX, toGoalY));
      const value = bestThreat * (0.5 + marking * 0.6) + (role === 'défenseur' ? 0.25 : 0.05);
      options.push({
        action: {
          kind: 'marquage',
          targetId: bestTarget.id,
          targetX: bestTarget.x + (toGoalX / norm) * 1.8,
          targetY: bestTarget.y + (toGoalY / norm) * 1.8,
        },
        value,
      });
    }
  }

  // ── Couvrir l'espace derrière ────────────────────────────────────────────
  if (role === 'défenseur' || role === 'milieu' || role === 'gardien') {
    // La couverture vise le point dangereux entre le ballon et son propre but.
    const targetX = perception.ballX * 0.32 + ownGoal.x * 0.68;
    const targetY = perception.ballY * 0.45 + ownGoal.y * 0.55;
    const exposure = clamp01(1 - spaceAt(targetX, targetY, perception.teammates) / 18);
    const value =
      exposure * 0.5 +
      (role === 'défenseur' ? 0.22 : role === 'gardien' ? 0.6 : 0.04) +
      (actor.attributes.positioning / 100) * 0.2;
    options.push({ action: { kind: 'couverture', targetX, targetY }, value });
  }

  // ── Se replier dans le bloc ──────────────────────────────────────────────
  {
    // Le bloc se compacte vers le ballon et recule quand l'adversaire progresse.
    const blockShift = (perception.ballX - PITCH_LENGTH / 2) * (0.3 + context.tactics.compactness * 0.35);
    const targetX = clamp(actor.anchorX + blockShift - dir * 3, 2, PITCH_LENGTH - 2);
    const targetY = clamp(
      actor.anchorY + (perception.ballY - PITCH_WIDTH / 2) * (0.2 + context.tactics.compactness * 0.3),
      2,
      PITCH_WIDTH - 2,
    );
    const drift = Math.hypot(actor.body.x - targetX, actor.body.y - targetY);
    // Se replier n'a de valeur que si l'on est réellement hors de sa place.
    // Une base fixe généreuse faisait de ce choix le comportement par défaut
    // de toute l'équipe, gardien compris.
    const value =
      clamp01(drift / 12) * 0.6 + (1 - actor.body.sprintReserve) * 0.2 - (role === 'gardien' ? 0.5 : 0);
    options.push({ action: { kind: 'repli', targetX, targetY }, value });
  }

  return chooseAmong(options, clarity, rng) ?? {
    kind: 'repli',
    targetX: actor.anchorX,
    targetY: actor.anchorY,
  };
}

/** Une perte de balle récente ouvre la fenêtre de contre-pressing. */
function recentlyLost(world: WorldState): boolean {
  return world.possessionChangedAgo < 5;
}

/** Familles de postes : chacune raisonne différemment. */
export type RoleFamily = 'gardien' | 'défenseur' | 'milieu' | 'attaquant';

export function roleOf(position: Position): RoleFamily {
  switch (position) {
    case 'GB':
      return 'gardien';
    case 'DC':
    case 'DD':
    case 'DG':
      return 'défenseur';
    case 'MDC':
    case 'MC':
    case 'MOC':
    case 'MD':
    case 'MG':
      return 'milieu';
    default:
      return 'attaquant';
  }
}

/**
 * Le gardien raisonne à part : sa décision principale n'est pas « que faire du
 * ballon » mais « où me placer », et une erreur de placement se paie cash.
 */
export function decideKeeperPositioning(
  actor: MatchActor,
  perception: Perception,
  context: DecisionContext,
): { targetX: number; targetY: number; rushing: boolean } {
  const ownGoal = goalCentre(actor.side);
  const dir = attackDirection(actor.side);

  const dx = perception.ballX - ownGoal.x;
  const dy = perception.ballY - ownGoal.y;
  const distance = Math.max(0.5, Math.hypot(dx, dy));

  // Sortir sur la ligne ballon-but pour réduire l'angle : plus le ballon est
  // proche, plus on sort — mais jamais au-delà de la surface sans raison.
  const closeness = clamp01(1 - distance / 40);
  const positioning = actor.attributes.positioning / 100;
  const command = actor.attributes.commandOfArea / 100;
  const advance = clamp(1.5 + closeness * closeness * 9 * (0.7 + positioning * 0.5), 0, 15);

  // Le gardien moderne joue haut quand son bloc est haut : il devient le
  // dernier défenseur, ce qui est un choix tactique, pas un réflexe.
  const sweeping = defensiveLineFactor(context.tactics) * command * 6;

  const targetX = ownGoal.x + (dx / distance) * (advance + sweeping);
  const targetY = ownGoal.y + (dy / distance) * Math.min(advance * 0.55, 4.5);

  // Sortir dans les pieds : seulement si on peut vraiment y arriver.
  const timeForKeeper = timeToReach(actor.body, actor.physical, perception.ballX, perception.ballY);
  const nearestAttacker = perception.opponents.reduce(
    (best, opponent) =>
      Math.min(best, Math.hypot(opponent.x - perception.ballX, opponent.y - perception.ballY)),
    99,
  );
  const rushing =
    inPenaltyArea(perception.ballX, perception.ballY, actor.side) &&
    timeForKeeper < 1.1 &&
    (nearestAttacker > 2.5 || command > 0.7);

  return {
    targetX: clamp(targetX, dir > 0 ? 0.4 : PITCH_LENGTH - 22, dir > 0 ? 22 : PITCH_LENGTH - 0.4),
    targetY: clamp(targetY, 4, PITCH_WIDTH - 4),
    rushing,
  };
}
