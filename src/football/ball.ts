/**
 * Infinity Football — Physique du ballon
 *
 * Le ballon n'est pas une variable d'état : c'est un corps rigide qui vole,
 * tourne, dévie et rebondit. Toute la sensation d'un jeu de football tient
 * dans ce fichier — si la balle ment, tout le reste ment.
 *
 * Ce qui est simulé :
 *  - traînée aérodynamique quadratique, avec la densité de l'air réelle ;
 *  - effet Magnus : une balle qui tourne s'incurve, dans les trois axes, ce qui
 *    donne le coup franc enroulé, la frappe brossée et la feuille morte ;
 *  - gravité, rebond avec restitution dépendant du sol et de son humidité ;
 *  - friction de roulement et transfert rotation ↔ translation au sol ;
 *  - vent, qui pousse et modifie la traînée relative ;
 *  - déviations sur contact (défenseur, poteau) avec perte d'énergie ;
 *  - dégonflage : un ballon lourd de pluie ne va pas aussi loin.
 *
 * Toutes les unités sont SI : mètres, secondes, kilogrammes, radians.
 * Le repère : x le long du terrain (0 → 105), y en travers (0 → 68),
 * z la hauteur (0 = pelouse).
 *
 * Tome III, ch. 2 — « chaque rebond, chaque effet, chaque rotation ».
 */

import { clamp, clamp01 } from '../core/math.js';

/**
 * Vecteur mutable. Le `Vec3` du noyau est immuable, ce qui est le bon choix
 * partout ailleurs — mais une boucle physique à 50 Hz sur 22 joueurs ne peut
 * pas allouer un objet par composante et par pas de temps.
 */
export interface MutableVec3 {
  x: number;
  y: number;
  z: number;
}

/** Masse réglementaire d'un ballon de football (FIFA : 410-450 g). */
export const BALL_MASS_KG = 0.43;
/** Rayon réglementaire (circonférence 68-70 cm). */
export const BALL_RADIUS_M = 0.11;
/** Section frontale, utilisée par la traînée. */
const BALL_AREA_M2 = Math.PI * BALL_RADIUS_M * BALL_RADIUS_M;
/** Densité de l'air au niveau de la mer, 15 °C. */
const AIR_DENSITY_SEA_LEVEL = 1.225;
const GRAVITY = 9.81;

/**
 * Coefficient de traînée. Une balle de football est en régime turbulent
 * au-dessus de ~12 m/s (crise de traînée) : elle « accélère » visuellement sur
 * les frappes puissantes, ce qui est exactement ce que voient les gardiens.
 */
function dragCoefficient(speed: number): number {
  if (speed < 8) return 0.47;
  if (speed > 22) return 0.19;
  // Transition continue entre régime laminaire et turbulent.
  const t = (speed - 8) / 14;
  return 0.47 - t * t * (0.47 - 0.19);
}

/** Coefficient de portance Magnus, croissant avec le rapport rotation/vitesse. */
function magnusCoefficient(spinRateRadS: number, speed: number): number {
  if (speed < 0.5) return 0;
  const spinParameter = (spinRateRadS * BALL_RADIUS_M) / speed;
  // Saturation : au-delà d'une certaine rotation, la portance plafonne.
  return clamp(0.385 * Math.pow(clamp(spinParameter, 0, 1.2), 0.7), 0, 0.35);
}

/** État de la pelouse : conditionne rebond, roulement et prise d'effet. */
export interface SurfaceState {
  /** Qualité 0..1 : 1 = pelouse hybride parfaite, 0 = terrain défoncé. */
  readonly quality: number;
  /** Humidité 0..1 : une pelouse mouillée est plus rapide et rebondit moins. */
  readonly wetness: number;
  /** Hauteur d'herbe 0..1 : herbe haute = ballon qui freine. */
  readonly grassLength: number;
  /** Terrain gelé : rebonds secs et imprévisibles. */
  readonly frozen: boolean;
}

export const PERFECT_SURFACE: SurfaceState = {
  quality: 1,
  wetness: 0.15,
  grassLength: 0.3,
  frozen: false,
};

/** Conditions atmosphériques appliquées au vol du ballon. */
export interface AirState {
  /** Vitesse du vent en m/s, dans le plan du terrain. */
  readonly windX: number;
  readonly windY: number;
  /** Altitude du stade en mètres : l'air se raréfie, la balle file. */
  readonly altitudeM: number;
  /** Température en °C : influence la densité de l'air. */
  readonly temperatureC: number;
  /** Pluie 0..1 : le ballon s'alourdit et glisse. */
  readonly rain: number;
}

export const STILL_AIR: AirState = {
  windX: 0,
  windY: 0,
  altitudeM: 0,
  temperatureC: 15,
  rain: 0,
};

/** Densité de l'air selon l'altitude et la température. */
export function airDensity(air: AirState): number {
  // Modèle barométrique simplifié, suffisant et monotone.
  const altitudeFactor = Math.exp(-air.altitudeM / 8_500);
  const temperatureFactor = 288.15 / (273.15 + clamp(air.temperatureC, -25, 50));
  return AIR_DENSITY_SEA_LEVEL * altitudeFactor * temperatureFactor;
}

/** Le ballon, corps rigide complet. */
export interface Ball {
  /** Position en mètres. z = hauteur du centre au-dessus de la pelouse. */
  position: MutableVec3;
  /** Vitesse en m/s. */
  velocity: MutableVec3;
  /**
   * Rotation en rad/s. L'axe porte le sens de l'effet :
   *  - spin.z > 0 : effet latéral (la balle part à gauche puis revient) ;
   *  - spin.y : effet brossé (la balle plonge ou flotte) ;
   *  - spin.x : rotation autour de l'axe de déplacement, peu d'effet.
   */
  spin: MutableVec3;
  /** Masse effective : elle augmente sous la pluie (ballon gorgé d'eau). */
  mass: number;
  /** Le ballon roule au sol (z ≈ 0 et vitesse verticale négligeable). */
  rolling: boolean;
  /** Dernier joueur à l'avoir touché, pour les touches et les corners. */
  lastTouchedBy: string | null;
}

export function createBall(x = 52.5, y = 34, z = BALL_RADIUS_M): Ball {
  return {
    position: { x, y, z },
    velocity: { x: 0, y: 0, z: 0 },
    spin: { x: 0, y: 0, z: 0 },
    mass: BALL_MASS_KG,
    rolling: true,
    lastTouchedBy: null,
  };
}

/** Norme d'un vecteur 3D. */
function magnitude(v: MutableVec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

/** Produit vectoriel, nécessaire à la force de Magnus. */
function cross(a: MutableVec3, b: MutableVec3): MutableVec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Coefficient de restitution : quelle part de la vitesse verticale survit au
 * rebond. Une pelouse détrempée absorbe, un terrain gelé renvoie sèchement.
 */
export function restitutionFor(surface: SurfaceState): number {
  if (surface.frozen) return 0.72;
  const base = 0.55 + surface.quality * 0.08;
  const wetPenalty = surface.wetness * 0.22;
  const grassPenalty = surface.grassLength * 0.1;
  return clamp(base - wetPenalty - grassPenalty, 0.2, 0.7);
}

/**
 * Friction de roulement. Contre-intuitif mais réel : une pelouse mouillée est
 * plus *rapide* qu'une pelouse sèche — l'eau lubrifie les brins d'herbe.
 */
export function rollingFriction(surface: SurfaceState): number {
  if (surface.frozen) return 0.12;
  const base = 0.42 - surface.quality * 0.08;
  const wetBonus = surface.wetness * 0.14;
  const grassPenalty = surface.grassLength * 0.28;
  return clamp(base - wetBonus + grassPenalty, 0.12, 0.9);
}

/**
 * Fait avancer le ballon d'un pas de temps. `dt` doit rester petit (≤ 0.02 s)
 * pour que l'intégration reste stable sur les frappes les plus violentes.
 */
export function stepBall(
  ball: Ball,
  dt: number,
  surface: SurfaceState = PERFECT_SURFACE,
  air: AirState = STILL_AIR,
): void {
  const rho = airDensity(air);

  // Vitesse relative à l'air : c'est elle qui produit traînée et portance.
  const relative: MutableVec3 = {
    x: ball.velocity.x - air.windX,
    y: ball.velocity.y - air.windY,
    z: ball.velocity.z,
  };
  const speed = magnitude(relative);

  let ax = 0;
  let ay = 0;
  let az = -GRAVITY;

  if (speed > 0.01) {
    // Traînée : opposée au mouvement, quadratique en vitesse.
    const cd = dragCoefficient(speed);
    const dragMagnitude = 0.5 * rho * cd * BALL_AREA_M2 * speed * speed;
    const dragAccel = dragMagnitude / ball.mass;
    ax -= (relative.x / speed) * dragAccel;
    ay -= (relative.y / speed) * dragAccel;
    az -= (relative.z / speed) * dragAccel;

    // Magnus : F = ½ ρ Cl A v² · (ω × v̂). C'est ce terme, et lui seul, qui
    // fait rentrer un coup franc dans la lucarne opposée.
    const spinRate = magnitude(ball.spin);
    if (spinRate > 0.1) {
      const cl = magnusCoefficient(spinRate, speed);
      const magnusMagnitude = 0.5 * rho * cl * BALL_AREA_M2 * speed * speed;
      const unitVelocity: MutableVec3 = { x: relative.x / speed, y: relative.y / speed, z: relative.z / speed };
      const direction = cross(ball.spin, unitVelocity);
      const dirNorm = magnitude(direction);
      if (dirNorm > 1e-6) {
        const accel = magnusMagnitude / ball.mass;
        ax += (direction.x / dirNorm) * accel;
        ay += (direction.y / dirNorm) * accel;
        az += (direction.z / dirNorm) * accel;
      }
    }
  }

  ball.velocity.x += ax * dt;
  ball.velocity.y += ay * dt;
  ball.velocity.z += az * dt;

  ball.position.x += ball.velocity.x * dt;
  ball.position.y += ball.velocity.y * dt;
  ball.position.z += ball.velocity.z * dt;

  // La rotation s'amortit dans l'air : un effet ne dure pas indéfiniment.
  const spinDecay = Math.exp(-0.28 * dt);
  ball.spin.x *= spinDecay;
  ball.spin.y *= spinDecay;
  ball.spin.z *= spinDecay;

  // ── Contact avec la pelouse ──────────────────────────────────────────────
  if (ball.position.z <= BALL_RADIUS_M) {
    ball.position.z = BALL_RADIUS_M;

    const impactSpeed = -ball.velocity.z;
    if (impactSpeed > 0.35) {
      const restitution = restitutionFor(surface);
      ball.velocity.z = impactSpeed * restitution;

      // Le sol freine la composante horizontale, d'autant plus qu'il accroche.
      const grip = 0.82 + surface.quality * 0.1 - surface.wetness * 0.12;
      ball.velocity.x *= grip;
      ball.velocity.y *= grip;

      // Le rebond convertit une part de l'effet en trajectoire : c'est le
      // « ballon qui repart de travers » après un rebond brossé.
      ball.velocity.x += ball.spin.z * BALL_RADIUS_M * 0.16;
      ball.velocity.y -= ball.spin.z * BALL_RADIUS_M * 0.16;
      ball.spin.z *= 0.62;
      ball.spin.y *= 0.5;

      // Un terrain irrégulier crée le faux rebond. Il est déterministe : il
      // dépend de l'endroit exact où la balle tape, pas d'un tirage caché.
      if (surface.quality < 0.85) {
        const bumpSeed = Math.sin(ball.position.x * 12.9898 + ball.position.y * 78.233) * 43758.5453;
        const bump = (bumpSeed - Math.floor(bumpSeed)) - 0.5;
        const severity = (1 - surface.quality) * (surface.frozen ? 1.8 : 1) * impactSpeed * 0.12;
        ball.velocity.x += bump * severity;
        ball.velocity.y += bump * severity * 0.8;
        ball.velocity.z += Math.abs(bump) * severity * 0.5;
      }

      ball.rolling = false;
    } else {
      // Trop lent pour rebondir : le ballon roule.
      ball.velocity.z = 0;
      ball.rolling = true;
    }
  } else {
    ball.rolling = false;
  }

  // ── Roulement au sol ─────────────────────────────────────────────────────
  if (ball.rolling) {
    const horizontal = Math.hypot(ball.velocity.x, ball.velocity.y);
    if (horizontal > 0.02) {
      const decel = rollingFriction(surface) * GRAVITY * dt;
      const factor = Math.max(0, (horizontal - decel) / horizontal);
      ball.velocity.x *= factor;
      ball.velocity.y *= factor;

      // Une balle qui roule avec de l'effet latéral s'incurve encore un peu :
      // le fameux corner rentrant qui continue de tourner au sol.
      ball.velocity.x += ball.spin.z * 0.012;
      ball.velocity.y -= ball.spin.z * 0.012;
      ball.spin.z *= Math.exp(-1.6 * dt);
    } else {
      ball.velocity.x = 0;
      ball.velocity.y = 0;
      ball.spin.x = 0;
      ball.spin.y = 0;
      ball.spin.z = 0;
    }
  }
}

/** Vitesse scalaire du ballon en m/s. */
export function ballSpeed(ball: Ball): number {
  return magnitude(ball.velocity);
}

/** Vitesse du ballon en km/h, l'unité qu'affichent les diffuseurs. */
export function ballSpeedKmh(ball: Ball): number {
  return ballSpeed(ball) * 3.6;
}

/**
 * Frappe le ballon. `power` en m/s, `elevation` en radians au-dessus de
 * l'horizontale, `direction` en radians dans le plan du terrain.
 * `curl` positif enroule vers la gauche du tireur, négatif vers la droite.
 */
export function strikeBall(
  ball: Ball,
  options: {
    power: number;
    direction: number;
    elevation: number;
    /** Effet latéral en rad/s (un coup franc enroulé : 60 à 110). */
    curl?: number;
    /** Effet rétro (+) ou lifté (−) en rad/s. */
    topspin?: number;
    byPlayerId?: string;
    /** Ballon détrempé : il part moins vite et tourne moins. */
    rain?: number;
  },
): void {
  const wetness = clamp01(options.rain ?? 0);
  // Un ballon gorgé d'eau gagne jusqu'à 8 % de masse et perd en restitution.
  ball.mass = BALL_MASS_KG * (1 + wetness * 0.08);
  const power = options.power * (1 - wetness * 0.06);

  const horizontal = Math.cos(options.elevation) * power;
  ball.velocity.x = Math.cos(options.direction) * horizontal;
  ball.velocity.y = Math.sin(options.direction) * horizontal;
  ball.velocity.z = Math.sin(options.elevation) * power;

  const curl = (options.curl ?? 0) * (1 - wetness * 0.25);
  const topspin = (options.topspin ?? 0) * (1 - wetness * 0.25);
  ball.spin.z = curl;
  // L'effet brossé agit perpendiculairement au déplacement horizontal.
  ball.spin.x = -Math.sin(options.direction) * topspin;
  ball.spin.y = Math.cos(options.direction) * topspin;

  ball.rolling = false;
  if (options.byPlayerId) ball.lastTouchedBy = options.byPlayerId;
  if (ball.position.z < BALL_RADIUS_M) ball.position.z = BALL_RADIUS_M;
}

/**
 * Dévie le ballon lors d'un contact non maîtrisé : tacle, tête défensive,
 * poteau. `absorption` 0..1 dit combien d'énergie disparaît dans le contact.
 */
export function deflectBall(
  ball: Ball,
  options: { directionChange: number; elevationChange?: number; absorption?: number; byPlayerId?: string },
): void {
  const absorption = clamp01(options.absorption ?? 0.35);
  const speed = ballSpeed(ball) * (1 - absorption);
  const currentDirection = Math.atan2(ball.velocity.y, ball.velocity.x);
  const currentElevation = Math.asin(clamp(ball.velocity.z / Math.max(0.01, ballSpeed(ball)), -1, 1));

  const direction = currentDirection + options.directionChange;
  const elevation = clamp(currentElevation + (options.elevationChange ?? 0), -Math.PI / 2, Math.PI / 2);

  const horizontal = Math.cos(elevation) * speed;
  ball.velocity.x = Math.cos(direction) * horizontal;
  ball.velocity.y = Math.sin(direction) * horizontal;
  ball.velocity.z = Math.sin(elevation) * speed;

  // Un contact brutal casse l'effet : la balle « meurt » après un contre.
  ball.spin.x *= 0.35;
  ball.spin.y *= 0.35;
  ball.spin.z *= 0.35;
  ball.rolling = false;
  if (options.byPlayerId) ball.lastTouchedBy = options.byPlayerId;
}

/**
 * Prédit où le ballon sera dans `seconds`, sans modifier l'original.
 * C'est ce que fait un défenseur qui part à l'interception, et c'est aussi ce
 * qui permet à un attaquant de courir là où la balle *va*.
 */
export function predictBall(
  ball: Ball,
  seconds: number,
  surface: SurfaceState = PERFECT_SURFACE,
  air: AirState = STILL_AIR,
  dt = 0.02,
): MutableVec3 {
  const copy: Ball = {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    spin: { ...ball.spin },
    mass: ball.mass,
    rolling: ball.rolling,
    lastTouchedBy: ball.lastTouchedBy,
  };
  const steps = Math.max(1, Math.round(seconds / dt));
  for (let index = 0; index < steps; index++) {
    stepBall(copy, dt, surface, air);
  }
  return copy.position;
}

/**
 * Temps de vol restant avant que le ballon ne retouche la pelouse.
 * Renvoie 0 s'il roule déjà.
 */
export function timeToGround(
  ball: Ball,
  surface: SurfaceState = PERFECT_SURFACE,
  air: AirState = STILL_AIR,
  maxSeconds = 8,
): number {
  if (ball.rolling && ball.position.z <= BALL_RADIUS_M + 1e-6) return 0;
  const copy: Ball = {
    position: { ...ball.position },
    velocity: { ...ball.velocity },
    spin: { ...ball.spin },
    mass: ball.mass,
    rolling: ball.rolling,
    lastTouchedBy: ball.lastTouchedBy,
  };
  const dt = 0.02;
  for (let elapsed = 0; elapsed < maxSeconds; elapsed += dt) {
    const wasAirborne = copy.position.z > BALL_RADIUS_M + 1e-6;
    stepBall(copy, dt, surface, air);
    if (wasAirborne && copy.position.z <= BALL_RADIUS_M + 1e-6) return elapsed + dt;
  }
  return maxSeconds;
}
