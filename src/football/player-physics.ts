/**
 * Infinity Football — Physique des joueurs
 *
 * Un footballeur n'est pas un curseur : il a une masse, une inertie, un
 * équilibre, un rayon de braquage et des jambes qui se vident. Ce fichier
 * décide de ce que ça fait de le contrôler.
 *
 * Ce qui est simulé :
 *  - accélération réelle, décroissante avec la vitesse déjà acquise ;
 *  - vitesse de pointe issue des attributs, atteinte en 4 à 6 secondes ;
 *  - inertie : on ne change pas de direction à pleine vitesse ;
 *  - rayon de braquage dépendant de la vitesse et de l'agilité ;
 *  - équilibre du corps : un contact déséquilibre, et un joueur déséquilibré
 *    contrôle mal, tacle mal et perd ses duels ;
 *  - fatigue à deux niveaux — endurance de match et fraîcheur instantanée,
 *    qui se vide sur un sprint et se remplit en marchant ;
 *  - protection du ballon, fonction de la force, du gabarit et de l'orientation.
 *
 * Tome III, ch. 3-4 — inertie, accélérations réalistes, équilibre du corps,
 * fatigue influençant les performances.
 */

import { clamp, clamp01 } from '../core/math.js';
import type { Attributes } from '../career/player.js';

/** Un corps de joueur sur le terrain, en coordonnées mètres/secondes. */
export interface PlayerBody {
  x: number;
  y: number;
  /** Vitesse en m/s. */
  vx: number;
  vy: number;
  /** Orientation du buste en radians : on ne court pas en regardant derrière. */
  facing: number;
  /**
   * Équilibre 0..1. 1 = parfaitement stable. Un contact le fait chuter, il
   * revient en une seconde environ. En dessous de 0,4, tout rate.
   */
  balance: number;
  /**
   * Fraîcheur instantanée 0..1 : la capacité à sprinter *maintenant*. Se vide
   * en dix secondes de course à fond, se recharge en marchant.
   */
  sprintReserve: number;
  /** Endurance de match 0..1 : elle ne remonte pas, elle s'use sur 90 minutes. */
  stamina: number;
  /** Distance parcourue en mètres, pour les statistiques. */
  distanceM: number;
  /** Vitesse de pointe atteinte en m/s. */
  topSpeed: number;
}

export function createBody(x: number, y: number, facing = 0): PlayerBody {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing,
    balance: 1,
    sprintReserve: 1,
    stamina: 1,
    distanceM: 0,
    topSpeed: 0,
  };
}

/**
 * Capacités physiques dérivées des attributs. Calculées une fois par match,
 * pas à chaque pas de temps.
 */
export interface PhysicalProfile {
  /** Vitesse maximale en m/s. Un ailier de pointe : 9,4 m/s ≈ 34 km/h. */
  readonly topSpeed: number;
  /** Accélération maximale en m/s², à l'arrêt. */
  readonly acceleration: number;
  /** Décélération maximale en m/s² : freiner demande moins que lancer. */
  readonly deceleration: number;
  /** Vitesse de rotation maximale du corps en rad/s. */
  readonly turnRate: number;
  /** Masse effective en kg : elle pèse dans les duels et l'inertie. */
  readonly mass: number;
  /** Récupération de la fraîcheur par seconde de marche. */
  readonly recovery: number;
  /** Stabilité : résistance au déséquilibre lors d'un contact. */
  readonly stability: number;
}

/**
 * Traduit les attributs en capacités physiques. Les valeurs sont calées sur les
 * données réelles : un attribut de 99 en vitesse donne 9,7 m/s (35 km/h), ce
 * qu'atteignent les tout meilleurs sprinteurs du football.
 */
export function physicalProfile(attributes: Attributes, heightCm = 180, weightKg = 76): PhysicalProfile {
  const pace = attributes.pace / 100;
  const accel = attributes.acceleration / 100;
  const agility = attributes.agility / 100;
  const strength = attributes.strength / 100;
  const stamina = attributes.stamina / 100;

  // Le gabarit joue : un grand gabarit accélère moins vite mais finit plus fort.
  const heightFactor = clamp(180 / Math.max(150, heightCm), 0.9, 1.1);
  const weightFactor = clamp(76 / Math.max(55, weightKg), 0.88, 1.12);

  return {
    topSpeed: 5.6 + pace * 4.1,
    acceleration: (4.2 + accel * 4.6) * weightFactor,
    deceleration: 6.5 + agility * 3.5,
    turnRate: (3.4 + agility * 4.2) * heightFactor,
    mass: weightKg,
    recovery: 0.055 + stamina * 0.075,
    stability: clamp01(0.32 + strength * 0.42 + agility * 0.16 + (weightKg - 60) / 200),
  };
}

/** Vitesse scalaire actuelle en m/s. */
export function speedOf(body: PlayerBody): number {
  return Math.hypot(body.vx, body.vy);
}

/**
 * Vitesse de pointe réellement disponible à cet instant. La fatigue de match
 * coûte jusqu'à 12 % de vitesse — l'écart mesuré entre la 5ᵉ et la 90ᵉ minute
 * chez un joueur qui a tout donné — et l'essoufflement immédiat coûte plus
 * encore.
 */
export function availableTopSpeed(profile: PhysicalProfile, body: PlayerBody): number {
  const staminaFactor = 0.88 + body.stamina * 0.12;
  const breathFactor = 0.78 + body.sprintReserve * 0.22;
  const balanceFactor = 0.55 + body.balance * 0.45;
  return profile.topSpeed * staminaFactor * breathFactor * balanceFactor;
}

/**
 * Fait avancer un joueur d'un pas de temps vers une intention de déplacement.
 *
 * `desiredVx/Vy` est la vitesse voulue, pas une force : c'est ainsi que pense
 * un joueur (« je veux aller là-bas, vite »). La physique décide de ce qui est
 * réellement possible — et c'est exactement là que naît la sensation d'inertie.
 */
export function stepBody(
  body: PlayerBody,
  profile: PhysicalProfile,
  dt: number,
  intent: { desiredVx: number; desiredVy: number; sprinting: boolean },
): void {
  const currentSpeed = speedOf(body);
  const maxSpeed = availableTopSpeed(profile, body);

  // L'intention est plafonnée par ce que les jambes peuvent donner.
  let targetVx = intent.desiredVx;
  let targetVy = intent.desiredVy;
  const desiredSpeed = Math.hypot(targetVx, targetVy);
  if (desiredSpeed > maxSpeed && desiredSpeed > 0) {
    targetVx = (targetVx / desiredSpeed) * maxSpeed;
    targetVy = (targetVy / desiredSpeed) * maxSpeed;
  }

  // Écart entre ce qu'on veut et ce qu'on fait.
  const dvx = targetVx - body.vx;
  const dvy = targetVy - body.vy;
  const dv = Math.hypot(dvx, dvy);

  if (dv > 1e-4) {
    // Accélérer coûte plus cher que freiner, et coûte de plus en plus cher à
    // mesure qu'on va vite : c'est ce qui rend une relance progressive.
    const accelerating = Math.hypot(targetVx, targetVy) > currentSpeed;
    const speedRatio = clamp01(currentSpeed / Math.max(0.1, profile.topSpeed));
    const capability = accelerating
      ? profile.acceleration * (1 - speedRatio * 0.72) * (0.7 + body.sprintReserve * 0.3)
      : profile.deceleration;

    // Changer de direction à pleine vitesse est physiquement limité : on
    // ne pivote pas à 30 km/h. C'est la contrainte qui donne du poids au corps.
    const turningPenalty = (() => {
      if (currentSpeed < 0.5 || dv < 1e-4) return 1;
      const cosAngle = (body.vx * dvx + body.vy * dvy) / (currentSpeed * dv);
      // cosAngle proche de -1 = demi-tour demandé.
      return clamp(0.35 + (cosAngle + 1) * 0.42, 0.35, 1);
    })();

    const maxDelta = capability * turningPenalty * body.balance * dt;
    const scale = Math.min(1, maxDelta / dv);
    body.vx += dvx * scale;
    body.vy += dvy * scale;
  }

  // Déplacement.
  const stepX = body.vx * dt;
  const stepY = body.vy * dt;
  body.x += stepX;
  body.y += stepY;
  const travelled = Math.hypot(stepX, stepY);
  body.distanceM += travelled;

  const newSpeed = speedOf(body);
  if (newSpeed > body.topSpeed) body.topSpeed = newSpeed;

  // Le buste s'oriente vers le déplacement, à vitesse limitée.
  if (newSpeed > 0.3) {
    const desiredFacing = Math.atan2(body.vy, body.vx);
    let delta = desiredFacing - body.facing;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    const maxTurn = profile.turnRate * dt;
    body.facing += clamp(delta, -maxTurn, maxTurn);
  }

  // ── Souffle et endurance ─────────────────────────────────────────────────
  const effort = clamp01(newSpeed / Math.max(0.1, profile.topSpeed));
  if (intent.sprinting && effort > 0.72) {
    // Un sprint à fond vide la réserve en une dizaine de secondes.
    body.sprintReserve = clamp01(body.sprintReserve - dt * (0.075 + effort * 0.055));
    body.stamina = clamp01(body.stamina - dt * 0.00095);
  } else if (effort > 0.45) {
    body.sprintReserve = clamp01(body.sprintReserve - dt * 0.018);
    body.stamina = clamp01(body.stamina - dt * 0.00042);
  } else {
    body.sprintReserve = clamp01(body.sprintReserve + dt * profile.recovery);
    body.stamina = clamp01(body.stamina - dt * 0.00013);
  }

  // L'équilibre se rétablit tout seul, en une seconde environ.
  body.balance = clamp01(body.balance + dt * 0.9);
}

/**
 * Applique un contact physique entre deux joueurs. Renvoie qui a gagné le
 * duel de corps et à quel point le perdant est déséquilibré.
 *
 * Le modèle est un choc : la quantité de mouvement compte, la stabilité aussi,
 * et l'orientation décide — être pris de dos, c'est déjà avoir perdu.
 */
export function resolveContact(
  a: { body: PlayerBody; profile: PhysicalProfile },
  b: { body: PlayerBody; profile: PhysicalProfile },
  intensity = 1,
): { winner: 'a' | 'b'; margin: number } {
  const momentumA = a.profile.mass * speedOf(a.body);
  const momentumB = b.profile.mass * speedOf(b.body);

  // Être orienté vers l'adversaire double l'appui ; être de dos l'annule.
  const angleAtoB = Math.atan2(b.body.y - a.body.y, b.body.x - a.body.x);
  const facingA = Math.cos(a.body.facing - angleAtoB);
  const facingB = Math.cos(b.body.facing - (angleAtoB + Math.PI));

  const strengthA = a.profile.stability * a.body.balance * (0.6 + Math.max(0, facingA) * 0.5) + momentumA * 0.004;
  const strengthB = b.profile.stability * b.body.balance * (0.6 + Math.max(0, facingB) * 0.5) + momentumB * 0.004;

  const total = strengthA + strengthB;
  const shareA = total > 0 ? strengthA / total : 0.5;
  const winner: 'a' | 'b' = shareA >= 0.5 ? 'a' : 'b';
  const margin = Math.abs(shareA - 0.5) * 2;

  // Le perdant est déséquilibré, le gagnant un peu bousculé aussi.
  const loserBody = winner === 'a' ? b.body : a.body;
  const winnerBody = winner === 'a' ? a.body : b.body;
  loserBody.balance = clamp01(loserBody.balance - (0.28 + margin * 0.45) * intensity);
  winnerBody.balance = clamp01(winnerBody.balance - 0.08 * intensity);

  // Un choc renvoie physiquement : les corps se repoussent.
  const push = 0.9 * intensity * (1 + margin);
  const dx = b.body.x - a.body.x;
  const dy = b.body.y - a.body.y;
  const distance = Math.max(0.2, Math.hypot(dx, dy));
  const nx = dx / distance;
  const ny = dy / distance;
  const massRatioA = b.profile.mass / (a.profile.mass + b.profile.mass);
  const massRatioB = a.profile.mass / (a.profile.mass + b.profile.mass);
  a.body.vx -= nx * push * massRatioA;
  a.body.vy -= ny * push * massRatioA;
  b.body.vx += nx * push * massRatioB;
  b.body.vy += ny * push * massRatioB;

  return { winner, margin };
}

/**
 * Capacité à protéger le ballon face à un adversaire donné. 1 = imprenable.
 *
 * Se mettre entre l'adversaire et le ballon change tout : c'est le geste que
 * font les attaquants dos au but, et il doit être récompensé.
 */
export function shieldingStrength(
  holder: { body: PlayerBody; profile: PhysicalProfile; attributes: Attributes },
  challenger: { body: PlayerBody; profile: PhysicalProfile },
): number {
  const angleToChallenger = Math.atan2(
    challenger.body.y - holder.body.y,
    challenger.body.x - holder.body.x,
  );
  // Dos tourné à l'adversaire = protection maximale.
  const shielding = clamp01((-Math.cos(holder.body.facing - angleToChallenger) + 1) / 2);

  const physical = holder.profile.stability * 0.5 + (holder.attributes.strength / 100) * 0.3;
  // Le sang-froid n'est pas un attribut brut : il se lit dans la concentration
  // et la qualité de décision, comme ailleurs dans le moteur.
  const technical =
    (holder.attributes.firstTouch / 100) * 0.12 +
    ((holder.attributes.concentration + holder.attributes.decisions) / 200) * 0.08;

  return clamp01((physical + technical) * (0.45 + shielding * 0.75) * holder.body.balance);
}

/**
 * Temps nécessaire pour rejoindre un point, en tenant compte de l'inertie.
 * C'est la fonction que consultent les joueurs pour décider s'ils partent à
 * l'interception ou s'ils renoncent — et elle doit être honnête, sinon les
 * défenseurs partent sur des ballons qu'ils ne peuvent pas atteindre.
 */
export function timeToReach(
  body: PlayerBody,
  profile: PhysicalProfile,
  targetX: number,
  targetY: number,
): number {
  const dx = targetX - body.x;
  const dy = targetY - body.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 0.2) return 0;

  const speed = speedOf(body);
  const maxSpeed = availableTopSpeed(profile, body);

  // Composante de la vitesse actuelle utile vers la cible.
  const useful = speed > 0.1 ? (body.vx * dx + body.vy * dy) / (speed * distance) : 0;
  const effectiveStart = Math.max(0, speed * useful);

  // Pénalité de demi-tour : aller à l'opposé coûte du temps avant même de partir.
  const turnPenalty = useful < 0 ? (speed / Math.max(1, profile.deceleration)) * (0.5 - useful * 0.5) : 0;

  // Phase d'accélération puis phase à vitesse constante.
  const accelTime = Math.max(0, (maxSpeed - effectiveStart) / profile.acceleration);
  const accelDistance = effectiveStart * accelTime + 0.5 * profile.acceleration * accelTime * accelTime;

  if (accelDistance >= distance) {
    // On n'atteint jamais la vitesse de pointe : résolution du trinôme.
    const a = 0.5 * profile.acceleration;
    const b = effectiveStart;
    const c = -distance;
    const discriminant = Math.max(0, b * b - 4 * a * c);
    return turnPenalty + (-b + Math.sqrt(discriminant)) / (2 * a);
  }
  return turnPenalty + accelTime + (distance - accelDistance) / Math.max(0.5, maxSpeed);
}
