/**
 * Infinity Football — Perception
 *
 * Ce que chaque joueur *croit* savoir du terrain. C'est le fichier le plus
 * important du gameplay, et pour une raison contre-intuitive : ce n'est pas
 * la qualité de la décision qui rend une IA humaine, c'est l'imperfection de
 * l'information sur laquelle elle décide.
 *
 * Deux joueurs au même endroit, à la même seconde, ne voient pas la même
 * chose. L'un a la tête levée, l'autre non. L'un a scanné il y a trois
 * dixièmes de seconde, l'autre il y a deux secondes. L'un est frais, l'autre
 * est cuit et son champ visuel s'est rétréci. De cette divergence naissent des
 * décisions différentes — sans qu'aucune ligne de script ne le décide.
 *
 * Ce qui est modélisé :
 *  - un cône de vision central net et une vision périphérique dégradée ;
 *  - une mémoire de balayage : ce qu'on a vu il y a peu reste connu, le reste
 *    devient une estimation qui vieillit et dérive ;
 *  - un bruit de perception croissant avec la distance, la fatigue, la pression
 *    du public et l'encombrement ;
 *  - l'anticipation : les bons joueurs perçoivent où les choses *vont*, pas
 *    seulement où elles sont ;
 *  - la lecture des lignes de passe, des espaces libres et de la pression.
 *
 * Tome III et Tome VIII, ch. 1-3 — « ils observent, anticipent, communiquent ».
 */

import { clamp, clamp01 } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import type { Attributes, Position } from '../career/player.js';
import type { FootballProfile } from '../ai/personality.js';
import type { Ball } from './ball.js';
import { predictBall } from './ball.js';
import type { PhysicalProfile, PlayerBody } from './player-physics.js';
import { speedOf, timeToReach } from './player-physics.js';
import { PITCH_LENGTH, PITCH_WIDTH, type Side } from './pitch.js';

/** Un joueur sur le terrain, tel que le moteur de match le manipule. */
export interface MatchActor {
  readonly id: string;
  readonly name: string;
  readonly position: Position;
  /** Camp défendu : détermine le sens de l'attaque. */
  readonly side: Side;
  readonly attributes: Attributes;
  readonly profile: FootballProfile;
  readonly physical: PhysicalProfile;
  readonly body: PlayerBody;
  /** Confiance du moment 0..1 : monte sur une réussite, tombe sur une erreur. */
  confidence: number;
  /** Position d'origine dans le dispositif, en coordonnées terrain. */
  readonly anchorX: number;
  readonly anchorY: number;
  onPitch: boolean;
  sentOff: boolean;
}

/** L'état du monde tel qu'il est réellement, avant perception. */
export interface WorldState {
  readonly ball: Ball;
  readonly actors: readonly MatchActor[];
  /** Porteur du ballon, ou null si le ballon est libre. */
  readonly carrierId: string | null;
  /** Minute de jeu écoulée. */
  readonly minute: number;
  /** Buts marqués, du point de vue de chaque camp. */
  readonly scoreLeft: number;
  readonly scoreRight: number;
  /** Intensité du public 0..1 : le bruit dégrade la prise d'information. */
  readonly crowdIntensity: number;
  /** Visibilité 0..1 : brouillard, pluie battante, nuit sans éclairage. */
  readonly visibility: number;
  /**
   * Secondes écoulées depuis le dernier changement de possession. En dessous
   * de cinq, la fenêtre de contre-pressing est ouverte : c'est le moment où
   * l'adversaire est le plus vulnérable, et tout le monde le sait.
   */
  readonly possessionChangedAgo: number;
}

/** Ce qu'un joueur croit savoir d'un autre joueur. */
export interface PerceivedActor {
  readonly id: string;
  /** Position estimée — pas la position réelle. */
  readonly x: number;
  readonly y: number;
  /** Vitesse estimée. */
  readonly vx: number;
  readonly vy: number;
  readonly position: Position;
  readonly side: Side;
  /** Fiabilité de cette estimation 0..1. */
  readonly confidence: number;
  /** Le joueur est dans le cône de vision net. */
  readonly inFocus: boolean;
  /** Distance estimée. */
  readonly distance: number;
}

/** La vue du monde propre à un joueur, à un instant donné. */
export interface Perception {
  readonly selfId: string;
  /** Position estimée du ballon. */
  readonly ballX: number;
  readonly ballY: number;
  readonly ballZ: number;
  /** Où le joueur croit que le ballon sera dans une demi-seconde. */
  readonly ballNextX: number;
  readonly ballNextY: number;
  readonly ballConfidence: number;
  readonly teammates: readonly PerceivedActor[];
  readonly opponents: readonly PerceivedActor[];
  /** Pression subie 0..1 : combien d'adversaires proches et orientés sur lui. */
  readonly pressure: number;
  /** Espace libre autour de soi, en mètres jusqu'au premier adversaire. */
  readonly spaceRadius: number;
  /** Le joueur est le plus proche du ballon dans son camp. */
  readonly closestOfTeam: boolean;
  /** Temps estimé pour atteindre le ballon. */
  readonly timeToBall: number;
}

/**
 * Qualité de la prise d'information d'un joueur, tous facteurs confondus.
 * C'est le multiplicateur qui décide si sa perception est nette ou floue.
 */
export function awarenessOf(actor: MatchActor, world: WorldState): number {
  const base =
    (actor.attributes.positioning / 100) * 0.3 +
    (actor.attributes.decisions / 100) * 0.2 +
    (actor.attributes.concentration / 100) * 0.2 +
    actor.profile.vision * 0.3;

  // Un joueur essoufflé garde la tête basse : son champ visuel se réduit.
  const breath = 0.72 + actor.body.sprintReserve * 0.28;
  // La fatigue de match érode la concentration sur la durée.
  const stamina = 0.85 + actor.body.stamina * 0.15;
  // Un stade bouillant coûte réellement en lucidité, d'autant plus aux joueurs
  // qui encaissent mal la pression.
  const crowd = 1 - world.crowdIntensity * 0.14 * (1 - (actor.attributes.concentration / 100) * 0.6);
  // Brouillard, pluie battante, nuit.
  const visibility = 0.55 + world.visibility * 0.45;
  // Un joueur en confiance lève la tête ; un joueur qui doute regarde le ballon.
  const confidence = 0.82 + actor.confidence * 0.18;

  return clamp01(base * breath * stamina * crowd * visibility * confidence);
}

/**
 * Netteté de la perception d'une cible selon sa place dans le champ visuel.
 * 1 dans l'axe du regard, décroissant vers la périphérie, quasi nul derrière.
 */
export function visualClarity(observer: MatchActor, targetX: number, targetY: number, awareness: number): number {
  const angleToTarget = Math.atan2(targetY - observer.body.y, targetX - observer.body.x);
  let offset = angleToTarget - observer.body.facing;
  while (offset > Math.PI) offset -= 2 * Math.PI;
  while (offset < -Math.PI) offset += 2 * Math.PI;
  const absolute = Math.abs(offset);

  // Le cône net fait environ 60° ; la vision périphérique porte jusqu'à 100°
  // de chaque côté, et s'élargit avec la qualité de prise d'information.
  const focusCone = (Math.PI / 6) * (1 + awareness * 0.5);
  const peripheralCone = (Math.PI * 0.62) * (1 + awareness * 0.35);

  if (absolute <= focusCone) return 1;
  if (absolute >= peripheralCone) {
    // Derrière soi : on ne voit rien, mais un très bon joueur *sait* quand même
    // à peu près, parce qu'il a scanné il y a une seconde.
    return awareness * 0.18;
  }
  const t = (absolute - focusCone) / (peripheralCone - focusCone);
  return clamp01((1 - t * t) * (0.45 + awareness * 0.55));
}

/**
 * Travail partagé par les 22 perceptions d'un même pas de temps.
 *
 * La trajectoire future du ballon ne dépend pas de qui regarde : la calculer
 * une fois au lieu de vingt-deux divise par plus de deux le coût du cycle de
 * décision. Seule la façon dont chaque joueur *interprète* cette trajectoire
 * lui est propre.
 */
export interface PerceptionCache {
  predictedX: number;
  predictedY: number;
  /** Empreinte de l'état du ballon ayant servi au calcul. */
  stamp: number;
}

export function createPerceptionCache(): PerceptionCache {
  return { predictedX: 0, predictedY: 0, stamp: Number.NaN };
}

/**
 * Construit la perception d'un joueur. Le bruit est tiré du flux aléatoire, ce
 * qui garde le déterminisme : la même graine reproduit les mêmes erreurs de
 * lecture, donc les mêmes matchs.
 *
 * `cache` est facultatif ; le moteur de match en fournit un par pas de temps.
 */
export function perceive(actor: MatchActor, world: WorldState, rng: Rng, cache?: PerceptionCache): Perception {
  const awareness = awarenessOf(actor, world);
  const ball = world.ball;

  // ── Le ballon ────────────────────────────────────────────────────────────
  const ballClarity = visualClarity(actor, ball.position.x, ball.position.y, awareness);
  const ballDistance = Math.hypot(ball.position.x - actor.body.x, ball.position.y - actor.body.y);
  // L'erreur croît avec la distance et l'imprécision du regard, et se réduit
  // fortement quand le ballon est proche : à trois mètres, personne ne se trompe.
  // Deux sources d'erreur, pas une : ne pas regarder, et regarder de loin. La
  // seconde subsiste même dans l'axe du regard — c'est pour cela qu'un gardien
  // se trompe sur la trajectoire d'un centre venu de l'autre côté du terrain.
  const distanceError = clamp(ballDistance * 0.012, 0, 0.9) * (1.25 - awareness * 0.6);
  const attentionError = (1 - ballClarity) * (0.35 + ballDistance * 0.028) * (1.3 - awareness * 0.6);
  const ballError = distanceError + attentionError;
  const ballX = ball.position.x + rng.gaussian(0, ballError);
  const ballY = ball.position.y + rng.gaussian(0, ballError);

  // L'anticipation : où le ballon *sera*. Un joueur médiocre extrapole en ligne
  // droite ; un joueur d'exception lit le rebond et l'effet.
  const anticipation = clamp01(actor.profile.anticipation * 0.6 + (actor.attributes.positioning / 100) * 0.4);
  const horizon = 0.5;
  // Empreinte bon marché de l'état du ballon : si elle n'a pas changé depuis le
  // dernier calcul, la prédiction est encore valable pour tout le monde.
  const stamp =
    ball.position.x * 1e6 + ball.position.y * 1e3 + ball.position.z + ball.velocity.x * 7.13 + ball.velocity.y * 3.17;
  let predicted: { x: number; y: number };
  if (cache && cache.stamp === stamp) {
    predicted = { x: cache.predictedX, y: cache.predictedY };
  } else {
    const computed = predictBall(ball, horizon, undefined, undefined, 0.05);
    predicted = { x: computed.x, y: computed.y };
    if (cache) {
      cache.predictedX = computed.x;
      cache.predictedY = computed.y;
      cache.stamp = stamp;
    }
  }
  const naiveX = ball.position.x + ball.velocity.x * horizon;
  const naiveY = ball.position.y + ball.velocity.y * horizon;
  const ballNextX = naiveX + (predicted.x - naiveX) * anticipation + rng.gaussian(0, ballError * 0.8);
  const ballNextY = naiveY + (predicted.y - naiveY) * anticipation + rng.gaussian(0, ballError * 0.8);

  // ── Les autres joueurs ───────────────────────────────────────────────────
  const teammates: PerceivedActor[] = [];
  const opponents: PerceivedActor[] = [];
  let pressure = 0;
  let nearestOpponent = 60;

  for (const other of world.actors) {
    if (other.id === actor.id || !other.onPitch || other.sentOff) continue;

    const dx = other.body.x - actor.body.x;
    const dy = other.body.y - actor.body.y;
    const distance = Math.hypot(dx, dy);
    const clarity = visualClarity(actor, other.body.x, other.body.y, awareness);

    // Au-delà de quarante mètres, hors du cône net, on ne perçoit plus rien
    // d'exploitable : on ne charge pas la décision de bruit inutile.
    if (distance > 45 && clarity < 0.5) continue;

    const error =
      clamp(distance * 0.016, 0, 1.4) * (1.2 - awareness * 0.55) +
      (1 - clarity) * (0.5 + distance * 0.05) * (1.25 - awareness * 0.55);
    const perceived: PerceivedActor = {
      id: other.id,
      x: other.body.x + rng.gaussian(0, error),
      y: other.body.y + rng.gaussian(0, error),
      vx: other.body.vx * (0.6 + clarity * 0.4),
      vy: other.body.vy * (0.6 + clarity * 0.4),
      position: other.position,
      side: other.side,
      confidence: clarity,
      inFocus: clarity > 0.85,
      distance,
    };

    if (other.side === actor.side) {
      teammates.push(perceived);
    } else {
      opponents.push(perceived);
      if (distance < nearestOpponent) nearestOpponent = distance;
      // La pression n'est pas une distance : c'est un adversaire proche *et*
      // qui vient sur vous. Un défenseur qui recule ne met aucune pression.
      if (distance < 12) {
        const closing = distance > 0.1 ? -(other.body.vx * dx + other.body.vy * dy) / distance : 0;
        const proximity = 1 - distance / 12;
        pressure += proximity * proximity * (0.55 + clamp01(closing / 6) * 0.65);
      }
    }
  }

  // ── Position relative au ballon dans l'équipe ────────────────────────────
  const timeToBall = timeToReach(actor.body, actor.physical, ballNextX, ballNextY);
  let closestOfTeam = true;
  for (const other of world.actors) {
    if (other.id === actor.id || other.side !== actor.side || !other.onPitch || other.sentOff) continue;
    if (timeToReach(other.body, other.physical, ball.position.x, ball.position.y) < timeToBall - 0.05) {
      closestOfTeam = false;
      break;
    }
  }

  return {
    selfId: actor.id,
    ballX,
    ballY,
    ballZ: ball.position.z,
    ballNextX,
    ballNextY,
    ballConfidence: ballClarity,
    teammates,
    opponents,
    pressure: clamp01(pressure),
    spaceRadius: nearestOpponent,
    closestOfTeam,
    timeToBall,
  };
}

/**
 * Qualité d'une ligne de passe entre deux points : 1 = dégagée, 0 = fermée.
 *
 * Le calcul est géométrique et honnête — on projette chaque adversaire sur le
 * segment et on regarde s'il peut y arriver avant le ballon. C'est ce qui
 * distingue une passe « fermée » d'une passe « risquée mais jouable ».
 */
export function passingLane(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  opponents: readonly PerceivedActor[],
  ballSpeed = 16,
): number {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return 1;

  const ux = dx / length;
  const uy = dy / length;
  let worst = 1;

  for (const opponent of opponents) {
    // Projection de l'adversaire sur le segment de passe.
    const relX = opponent.x - fromX;
    const relY = opponent.y - fromY;
    const along = relX * ux + relY * uy;
    if (along < -1 || along > length + 1) continue;

    const lateral = Math.abs(relX * -uy + relY * ux);
    // Temps que met le ballon à atteindre le point de croisement.
    const ballTime = Math.max(0.05, along / ballSpeed);
    // Distance que l'adversaire peut couvrir dans ce temps : un joueur couvre
    // environ 6 m/s en interception, moins s'il doit réagir d'abord.
    const reach = 0.55 + ballTime * 6.2;

    if (lateral < reach) {
      // Plus l'adversaire est près de la trajectoire, plus la passe est fermée.
      const danger = 1 - lateral / reach;
      worst = Math.min(worst, 1 - danger * danger);
    }
  }
  return clamp01(worst);
}

/**
 * Espace libre autour d'un point : distance au plus proche adversaire, pondérée
 * par le fait qu'il regarde ou non dans cette direction.
 */
export function spaceAt(x: number, y: number, opponents: readonly PerceivedActor[]): number {
  let nearest = 40;
  for (const opponent of opponents) {
    const distance = Math.hypot(opponent.x - x, opponent.y - y);
    if (distance < nearest) nearest = distance;
  }
  return nearest;
}

/**
 * Valeur d'une position sur le terrain pour l'équipe qui attaque, entre 0 et 1.
 * Sert à comparer « avancer de dix mètres au milieu » et « donner sur l'aile ».
 *
 * Calé sur les modèles de valeur de possession : le terrain vaut peu près de
 * ses propres buts, énormément dans la surface adverse, et la valeur monte
 * beaucoup plus vite dans l'axe que le long des lignes de touche.
 */
export function positionalValue(x: number, y: number, attackingSide: Side): number {
  const progress = attackingSide === 'left' ? x / PITCH_LENGTH : 1 - x / PITCH_LENGTH;
  // Progression fortement non linéaire : les trente derniers mètres valent
  // bien plus que les trente premiers.
  const longitudinal = Math.pow(clamp01(progress), 2.4);
  // Centralité : l'axe vaut plus, mais l'aile garde de la valeur en zone haute
  // parce que c'est de là que viennent les centres.
  const centrality = 1 - Math.abs(y - PITCH_WIDTH / 2) / (PITCH_WIDTH / 2);
  const lateral = 0.45 + centrality * 0.55;
  return clamp01(longitudinal * lateral);
}

/**
 * Un adversaire vient-il de commettre une erreur exploitable ? Renvoie
 * l'identifiant du fautif et l'ampleur de l'occasion.
 *
 * On ne triche pas : l'erreur est un fait objectif du monde (déséquilibre,
 * mauvaise orientation, contrôle raté), mais seul un joueur qui *regarde* la
 * verra. C'est ce que le GDD appelle « repérer les erreurs adverses ».
 */
export function spotMistake(
  perception: Perception,
  world: WorldState,
): { targetId: string; severity: number } | null {
  let best: { targetId: string; severity: number } | null = null;

  for (const opponent of perception.opponents) {
    if (opponent.confidence < 0.45) continue;
    const real = world.actors.find((actor) => actor.id === opponent.id);
    if (!real) continue;

    // Un adversaire déséquilibré, ou lancé dans le mauvais sens, est prenable.
    const offBalance = 1 - real.body.balance;
    const carrying = world.carrierId === opponent.id;
    const facingAway = (() => {
      const angle = Math.atan2(perception.ballY - real.body.y, perception.ballX - real.body.x);
      let offset = angle - real.body.facing;
      while (offset > Math.PI) offset -= 2 * Math.PI;
      while (offset < -Math.PI) offset += 2 * Math.PI;
      return clamp01((Math.abs(offset) - Math.PI / 3) / (Math.PI / 2));
    })();

    const severity = clamp01(
      (offBalance * 0.55 + facingAway * 0.35 + (carrying ? 0.25 : 0)) *
        opponent.confidence *
        clamp01(1 - opponent.distance / 25),
    );
    if (severity > 0.25 && (!best || severity > best.severity)) {
      best = { targetId: opponent.id, severity };
    }
  }
  return best;
}

/**
 * Ligne de hors-jeu adverse telle que perçue. Un attaquant qui la lit mal part
 * trop tôt — et c'est une des erreurs les plus humaines du football.
 */
export function offsideLine(perception: Perception, attackingSide: Side): number {
  const defenders = perception.opponents
    .map((opponent) => opponent.x)
    .sort((a, b) => (attackingSide === 'left' ? b - a : a - b));
  // Le deuxième défenseur le plus reculé fait la ligne (le gardien est le premier).
  const second = defenders[1];
  if (second === undefined) return attackingSide === 'left' ? PITCH_LENGTH : 0;
  return second;
}

/** Un joueur est-il en position de hors-jeu au moment de la passe ? */
export function isOffside(x: number, line: number, ballX: number, attackingSide: Side): boolean {
  if (attackingSide === 'left') {
    // On attaque vers x croissant : hors-jeu si devant la ligne et devant le ballon.
    return x > line + 0.05 && x > ballX + 0.05 && x > PITCH_LENGTH / 2;
  }
  return x < line - 0.05 && x < ballX - 0.05 && x < PITCH_LENGTH / 2;
}

/**
 * Vitesse à laquelle un joueur « rafraîchit » sa lecture du jeu, en balayages
 * par seconde. Les meilleurs milieux tournent la tête six à huit fois par
 * dizaine de secondes ; un joueur cuit ou sous pression, deux fois moins.
 */
export function scanRate(actor: MatchActor): number {
  const base = 0.35 + actor.profile.vision * 0.55 + (actor.attributes.positioning / 100) * 0.3;
  const fatigue = 0.6 + actor.body.sprintReserve * 0.4;
  return clamp(base * fatigue, 0.15, 1.2);
}

/** Vitesse de course réelle vers un point, en tenant compte de l'inertie. */
export function approachSpeed(actor: MatchActor): number {
  return speedOf(actor.body);
}
