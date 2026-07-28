/**
 * Infinity Football — Géométrie du terrain
 *
 * Un terrain réel, aux dimensions réelles, avec ses lignes, ses surfaces et
 * ses buts. Tout le reste du gameplay s'y réfère : savoir si le ballon est
 * sorti, si une faute est dans la surface, si un joueur est hors-jeu, où se
 * trouve l'espace libre.
 *
 * Repère : origine au coin inférieur gauche du terrain vu du ciel.
 *   x de 0 (ligne de but domicile) à 105 (ligne de but adverse)
 *   y de 0 (touche du bas) à 68 (touche du haut)
 *   z hauteur au-dessus de la pelouse
 *
 * L'équipe « domicile » attaque vers x croissant en première période.
 *
 * Tome III, ch. 1 — les règles du jeu s'appliquent sur un vrai rectangle.
 */

import { clamp } from '../core/math.js';
import type { MutableVec3 } from './ball.js';
import { BALL_RADIUS_M } from './ball.js';

/** Dimensions officielles pour les compétitions internationales. */
export const PITCH_LENGTH = 105;
export const PITCH_WIDTH = 68;

/** Buts : 7,32 m d'ouverture, 2,44 m de haut. */
export const GOAL_WIDTH = 7.32;
export const GOAL_HEIGHT = 2.44;
export const GOAL_Y_MIN = (PITCH_WIDTH - GOAL_WIDTH) / 2;
export const GOAL_Y_MAX = (PITCH_WIDTH + GOAL_WIDTH) / 2;

/** Surface de réparation : 16,5 m de profondeur, 40,32 m de large. */
export const PENALTY_AREA_DEPTH = 16.5;
export const PENALTY_AREA_WIDTH = 40.32;
export const PENALTY_Y_MIN = (PITCH_WIDTH - PENALTY_AREA_WIDTH) / 2;
export const PENALTY_Y_MAX = (PITCH_WIDTH + PENALTY_AREA_WIDTH) / 2;

/** Surface de but : 5,5 m de profondeur, 18,32 m de large. */
export const GOAL_AREA_DEPTH = 5.5;
export const GOAL_AREA_WIDTH = 18.32;
export const GOAL_AREA_Y_MIN = (PITCH_WIDTH - GOAL_AREA_WIDTH) / 2;
export const GOAL_AREA_Y_MAX = (PITCH_WIDTH + GOAL_AREA_WIDTH) / 2;

/** Point de penalty : 11 m de la ligne de but. */
export const PENALTY_SPOT_DISTANCE = 11;
/** Rond central et arc de cercle de la surface : 9,15 m. */
export const CENTRE_CIRCLE_RADIUS = 9.15;

export const CENTRE: Readonly<{ x: number; y: number }> = { x: PITCH_LENGTH / 2, y: PITCH_WIDTH / 2 };

/** Le côté du terrain qu'une équipe défend. */
export type Side = 'left' | 'right';

/** Centre du but défendu par ce côté. */
export function goalCentre(side: Side): { x: number; y: number } {
  return { x: side === 'left' ? 0 : PITCH_LENGTH, y: PITCH_WIDTH / 2 };
}

/** Point de penalty du côté indiqué. */
export function penaltySpot(side: Side): { x: number; y: number } {
  return {
    x: side === 'left' ? PENALTY_SPOT_DISTANCE : PITCH_LENGTH - PENALTY_SPOT_DISTANCE,
    y: PITCH_WIDTH / 2,
  };
}

/** Le point est-il dans la surface de réparation du côté indiqué ? */
export function inPenaltyArea(x: number, y: number, side: Side): boolean {
  if (y < PENALTY_Y_MIN || y > PENALTY_Y_MAX) return false;
  return side === 'left' ? x <= PENALTY_AREA_DEPTH : x >= PITCH_LENGTH - PENALTY_AREA_DEPTH;
}

/** Le point est-il dans la surface de but ? */
export function inGoalArea(x: number, y: number, side: Side): boolean {
  if (y < GOAL_AREA_Y_MIN || y > GOAL_AREA_Y_MAX) return false;
  return side === 'left' ? x <= GOAL_AREA_DEPTH : x >= PITCH_LENGTH - GOAL_AREA_DEPTH;
}

/** Distance au centre du but adverse, en mètres. */
export function distanceToGoal(x: number, y: number, attackingSide: Side): number {
  // On attaque le but opposé à celui qu'on défend.
  const target = goalCentre(attackingSide === 'left' ? 'right' : 'left');
  return Math.hypot(target.x - x, target.y - y);
}

/**
 * Angle de tir en radians : l'ouverture du but vue depuis le point de frappe.
 * C'est la mesure qui distingue une position dangereuse d'une position stérile,
 * bien mieux que la seule distance — d'où son usage dans les modèles d'xG.
 */
export function shootingAngle(x: number, y: number, attackingSide: Side): number {
  const goalX = attackingSide === 'left' ? PITCH_LENGTH : 0;
  const toPost1 = Math.atan2(GOAL_Y_MIN - y, goalX - x);
  const toPost2 = Math.atan2(GOAL_Y_MAX - y, goalX - x);
  return Math.abs(toPost2 - toPost1);
}

/**
 * Probabilité de but attendue depuis une position, avant toute considération
 * de tireur ou de gardien. Calée sur les modèles d'xG publics : ~0,76 sur un
 * penalty, ~0,35 à six mètres plein axe, ~0,03 à trente mètres.
 */
export function expectedGoalsFromPosition(x: number, y: number, attackingSide: Side): number {
  const distance = distanceToGoal(x, y, attackingSide);
  const angle = shootingAngle(x, y, attackingSide);
  // Régression logistique ajustée sur huit positions de référence dont les
  // valeurs sont documentées dans la littérature publique : 0,45 à six mètres
  // plein axe, 0,28 sur le point de penalty en jeu courant, 0,12 à seize
  // mètres, 0,02 à trente mètres.
  //
  // Le coefficient d'angle est contraint positif. Un ajustement libre donnait
  // un meilleur résidu avec un angle *négatif* — distance et angle étant très
  // corrélés sur ces points, la régression les échangeait — mais cela aurait
  // signifié qu'un but plus ouvert fait moins marquer. Une erreur de 0,017 sur
  // un modèle honnête vaut mieux que 0,009 sur un modèle absurde.
  const logit = 0.6918 + 0.2 * angle - 0.1633 * distance;
  return clamp(1 / (1 + Math.exp(-logit)), 0.002, 0.95);
}

/** Le ballon est-il sorti par une ligne de touche ? */
export function outByTouchline(ball: { position: MutableVec3 }): boolean {
  return ball.position.y < 0 || ball.position.y > PITCH_WIDTH;
}

/** Le ballon est-il sorti par une ligne de but (hors du cadre) ? */
export function outByGoalLine(ball: { position: MutableVec3 }): boolean {
  return ball.position.x < 0 || ball.position.x > PITCH_LENGTH;
}

/**
 * Le ballon a-t-il franchi la ligne de but à l'intérieur du cadre ?
 * La règle est stricte : le ballon entier doit avoir dépassé la ligne.
 */
export function isGoal(ball: { position: MutableVec3 }, attackedSide: Side): boolean {
  const { x, y, z } = ball.position;
  if (y < GOAL_Y_MIN || y > GOAL_Y_MAX) return false;
  if (z > GOAL_HEIGHT) return false;
  return attackedSide === 'left' ? x + BALL_RADIUS_M < 0 : x - BALL_RADIUS_M > PITCH_LENGTH;
}

/**
 * Le ballon a-t-il touché un montant ou la barre ? Renvoie l'élément touché,
 * ou null. Les poteaux ont 12 cm de diamètre en compétition.
 */
export function hitsWoodwork(ball: { position: MutableVec3 }, attackedSide: Side): 'poteau' | 'barre' | null {
  const postRadius = 0.06;
  const goalX = attackedSide === 'left' ? 0 : PITCH_LENGTH;
  const crossedPlane = Math.abs(ball.position.x - goalX) < BALL_RADIUS_M + postRadius;
  if (!crossedPlane) return null;
  if (ball.position.z > GOAL_HEIGHT - postRadius && ball.position.z < GOAL_HEIGHT + BALL_RADIUS_M + postRadius) {
    if (ball.position.y > GOAL_Y_MIN && ball.position.y < GOAL_Y_MAX) return 'barre';
  }
  const nearPost1 = Math.abs(ball.position.y - GOAL_Y_MIN) < BALL_RADIUS_M + postRadius;
  const nearPost2 = Math.abs(ball.position.y - GOAL_Y_MAX) < BALL_RADIUS_M + postRadius;
  if ((nearPost1 || nearPost2) && ball.position.z < GOAL_HEIGHT) return 'poteau';
  return null;
}

/** Ramène un point à l'intérieur des limites du terrain. */
export function clampToPitch(point: { x: number; y: number }): { x: number; y: number } {
  return {
    x: clamp(point.x, 0, PITCH_LENGTH),
    y: clamp(point.y, 0, PITCH_WIDTH),
  };
}

/** Les tiers du terrain, tels que les entraîneurs les nomment. */
export type PitchThird = 'défensif' | 'médian' | 'offensif';

export function thirdOf(x: number, attackingSide: Side): PitchThird {
  const progress = attackingSide === 'left' ? x / PITCH_LENGTH : 1 - x / PITCH_LENGTH;
  if (progress < 1 / 3) return 'défensif';
  if (progress < 2 / 3) return 'médian';
  return 'offensif';
}

/** Couloir latéral, du point de vue de l'équipe qui attaque. */
export type PitchChannel = 'aile gauche' | 'demi-espace gauche' | 'axe' | 'demi-espace droit' | 'aile droite';

export function channelOf(y: number): PitchChannel {
  if (y < PITCH_WIDTH * 0.2) return 'aile droite';
  if (y < PITCH_WIDTH * 0.37) return 'demi-espace droit';
  if (y < PITCH_WIDTH * 0.63) return 'axe';
  if (y < PITCH_WIDTH * 0.8) return 'demi-espace gauche';
  return 'aile gauche';
}

/**
 * Zone à douze cases utilisée par la carte de chaleur d'après-match :
 * 4 colonnes dans la longueur × 3 rangées dans la largeur.
 */
export function heatmapZone(x: number, y: number): number {
  const column = clamp(Math.floor((x / PITCH_LENGTH) * 4), 0, 3);
  const row = clamp(Math.floor((y / PITCH_WIDTH) * 3), 0, 2);
  return row * 4 + column;
}

/**
 * Position de remise en jeu après une sortie. Renvoie le type de reprise et
 * l'endroit exact, en appliquant les règles : touche là où le ballon est
 * sorti, corner au drapeau, six mètres sur la ligne de la surface de but.
 */
export function restartFor(
  ball: { position: MutableVec3; lastTouchedBy: string | null },
  lastTouchSide: Side | null,
): { kind: 'touche' | 'corner' | 'sixMetres' | 'aucun'; x: number; y: number; forSide: Side | null } {
  const { x, y } = ball.position;

  if (y < 0 || y > PITCH_WIDTH) {
    return {
      kind: 'touche',
      x: clamp(x, 0, PITCH_LENGTH),
      y: y < 0 ? 0 : PITCH_WIDTH,
      forSide: lastTouchSide === 'left' ? 'right' : lastTouchSide === 'right' ? 'left' : null,
    };
  }

  if (x < 0 || x > PITCH_LENGTH) {
    const behindSide: Side = x < 0 ? 'left' : 'right';
    // Le ballon est sorti derrière la ligne de but défendue par `behindSide`.
    // S'il a été touché en dernier par un défenseur de ce camp : corner.
    const conceded = lastTouchSide === behindSide;
    if (conceded) {
      return {
        kind: 'corner',
        x: behindSide === 'left' ? 0 : PITCH_LENGTH,
        y: y < PITCH_WIDTH / 2 ? 0 : PITCH_WIDTH,
        forSide: behindSide === 'left' ? 'right' : 'left',
      };
    }
    return {
      kind: 'sixMetres',
      x: behindSide === 'left' ? GOAL_AREA_DEPTH : PITCH_LENGTH - GOAL_AREA_DEPTH,
      y: PITCH_WIDTH / 2,
      forSide: behindSide,
    };
  }

  return { kind: 'aucun', x, y, forSide: null };
}
