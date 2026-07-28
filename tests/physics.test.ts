/**
 * Tests de la couche physique du gameplay — Tome III.
 *
 * Ces tests ne vérifient pas que le code s'exécute : ils vérifient que la
 * physique produit les valeurs du football réel. Un ballon frappé à 108 km/h
 * doit parcourir une trentaine de mètres en 1,2 s ; un ailier doit couvrir
 * 30 m en environ 4 s ; une pelouse détrempée doit rebondir moins mais rouler
 * plus vite. Si l'une de ces valeurs dérive, la sensation de jeu dérive avec.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  BALL_RADIUS_M,
  airDensity,
  ballSpeedKmh,
  createBall,
  deflectBall,
  predictBall,
  restitutionFor,
  rollingFriction,
  stepBall,
  strikeBall,
  timeToGround,
  type AirState,
  type SurfaceState,
} from '../src/football/ball.js';
import {
  GOAL_HEIGHT,
  GOAL_WIDTH,
  PITCH_LENGTH,
  PITCH_WIDTH,
  channelOf,
  distanceToGoal,
  expectedGoalsFromPosition,
  heatmapZone,
  inPenaltyArea,
  isGoal,
  restartFor,
  shootingAngle,
  thirdOf,
} from '../src/football/pitch.js';
import {
  availableTopSpeed,
  createBody,
  physicalProfile,
  resolveContact,
  shieldingStrength,
  speedOf,
  stepBody,
  timeToReach,
} from '../src/football/player-physics.js';
import { ATTRIBUTE_KEYS, type Attributes } from '../src/career/player.js';

const DRY: SurfaceState = { quality: 0.95, wetness: 0.1, grassLength: 0.3, frozen: false };
const SOAKED: SurfaceState = { quality: 0.95, wetness: 0.9, grassLength: 0.3, frozen: false };
const CALM: AirState = { windX: 0, windY: 0, altitudeM: 0, temperatureC: 15, rain: 0 };

function attributes(overrides: Partial<Attributes> = {}): Attributes {
  const base = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) base[key] = 60;
  return { ...base, ...overrides };
}

/** Fait avancer le ballon et renvoie la distance horizontale parcourue. */
function fly(ball: ReturnType<typeof createBall>, seconds: number, surface = DRY, air = CALM): number {
  const x0 = ball.position.x;
  const y0 = ball.position.y;
  const dt = 0.005;
  for (let elapsed = 0; elapsed < seconds; elapsed += dt) stepBall(ball, dt, surface, air);
  return Math.hypot(ball.position.x - x0, ball.position.y - y0);
}

test('ballon — une frappe puissante parcourt une distance réaliste et décélère', () => {
  const ball = createBall(80, 34);
  strikeBall(ball, { power: 30, direction: Math.PI, elevation: (8 * Math.PI) / 180 });
  assert.ok(ballSpeedKmh(ball) > 105 && ballSpeedKmh(ball) < 112, `vitesse initiale : ${ballSpeedKmh(ball)}`);

  const distance = fly(ball, 1.2);
  assert.ok(distance > 26 && distance < 33, `distance après 1,2 s : ${distance.toFixed(1)} m`);

  // La traînée fait perdre environ un tiers de la vitesse en une seconde.
  const finalSpeed = ballSpeedKmh(ball);
  assert.ok(finalSpeed < 80 && finalSpeed > 55, `vitesse finale : ${finalSpeed.toFixed(0)} km/h`);
});

test('ballon — l’effet Magnus incurve réellement la trajectoire', () => {
  const straight = createBall(75, 34);
  strikeBall(straight, { power: 26, direction: Math.PI, elevation: (14 * Math.PI) / 180, curl: 0 });
  fly(straight, 1.4);
  assert.ok(Math.abs(straight.position.y - 34) < 0.05, 'sans effet, la balle ne dévie pas');

  const curled = createBall(75, 34);
  strikeBall(curled, { power: 26, direction: Math.PI, elevation: (14 * Math.PI) / 180, curl: 95 });
  fly(curled, 1.4);
  const deviation = Math.abs(curled.position.y - 34);
  assert.ok(deviation > 2 && deviation < 8, `déviation latérale : ${deviation.toFixed(2)} m`);

  // L'effet inverse incurve dans l'autre sens, symétriquement.
  const opposite = createBall(75, 34);
  strikeBall(opposite, { power: 26, direction: Math.PI, elevation: (14 * Math.PI) / 180, curl: -95 });
  fly(opposite, 1.4);
  assert.ok(
    Math.sign(opposite.position.y - 34) === -Math.sign(curled.position.y - 34),
    'un effet opposé doit incurver dans l’autre sens',
  );
});

test('ballon — la pelouse mouillée rebondit moins mais roule plus vite', () => {
  assert.ok(restitutionFor(SOAKED) < restitutionFor(DRY), 'une pelouse détrempée absorbe le rebond');
  // Contre-intuitif et pourtant vrai : l'eau lubrifie l'herbe.
  assert.ok(rollingFriction(SOAKED) < rollingFriction(DRY), 'une pelouse mouillée est plus rapide au sol');

  function bounceHeight(surface: SurfaceState): number {
    const ball = createBall(52, 34, 2);
    ball.rolling = false;
    let touched = false;
    let peak = 0;
    for (let t = 0; t < 3; t += 0.005) {
      stepBall(ball, 0.005, surface, CALM);
      if (ball.position.z <= BALL_RADIUS_M + 0.005) touched = true;
      if (touched) peak = Math.max(peak, ball.position.z);
    }
    return peak;
  }
  const dryBounce = bounceHeight(DRY);
  const wetBounce = bounceHeight(SOAKED);
  assert.ok(dryBounce > wetBounce, `rebond sec ${dryBounce.toFixed(2)} m vs mouillé ${wetBounce.toFixed(2)} m`);
  assert.ok(dryBounce > 0.4 && dryBounce < 1.1, `hauteur de rebond plausible : ${dryBounce.toFixed(2)} m`);

  function rollDistance(surface: SurfaceState): number {
    const ball = createBall(20, 34);
    strikeBall(ball, { power: 12, direction: 0, elevation: 0 });
    return fly(ball, 4, surface);
  }
  assert.ok(rollDistance(SOAKED) > rollDistance(DRY), 'la balle roule plus loin sur une pelouse mouillée');
});

test('ballon — l’altitude et le vent modifient le vol', () => {
  assert.ok(airDensity({ ...CALM, altitudeM: 2_600 }) < airDensity(CALM), 'l’air se raréfie en altitude');

  function range(air: AirState): number {
    const ball = createBall(20, 34);
    strikeBall(ball, { power: 28, direction: 0, elevation: (20 * Math.PI) / 180 });
    return fly(ball, 2.5, DRY, air);
  }
  const seaLevel = range(CALM);
  const altitude = range({ ...CALM, altitudeM: 2_600 });
  assert.ok(altitude > seaLevel, `en altitude la balle file : ${altitude.toFixed(1)} m vs ${seaLevel.toFixed(1)} m`);

  const headwind = range({ ...CALM, windX: -8 });
  const tailwind = range({ ...CALM, windX: 8 });
  assert.ok(tailwind > seaLevel && seaLevel > headwind, 'le vent porte ou freine selon son sens');
});

test('ballon — prédiction et déviation restent cohérentes', () => {
  const ball = createBall(30, 34);
  strikeBall(ball, { power: 22, direction: 0.4, elevation: (18 * Math.PI) / 180 });

  const predicted = predictBall(ball, 1, DRY, CALM);
  const dt = 0.005;
  for (let t = 0; t < 1; t += dt) stepBall(ball, dt, DRY, CALM);
  // La prédiction utilise un pas plus grossier : on tolère quelques dizaines
  // de centimètres, pas davantage.
  assert.ok(Math.hypot(predicted.x - ball.position.x, predicted.y - ball.position.y) < 0.6, 'prédiction fidèle');

  const timeLeft = timeToGround(createBall(52, 34, 3), DRY, CALM);
  assert.ok(timeLeft > 0.6 && timeLeft < 1.1, `chute de 3 m : ${timeLeft.toFixed(2)} s`);

  const before = ballSpeedKmh(ball);
  deflectBall(ball, { directionChange: 0.9, absorption: 0.4 });
  assert.ok(ballSpeedKmh(ball) < before, 'une déviation coûte de l’énergie');
});

test('terrain — géométrie, buts et remises en jeu suivent les règles', () => {
  assert.equal(PITCH_LENGTH, 105);
  assert.equal(PITCH_WIDTH, 68);
  assert.ok(Math.abs(GOAL_WIDTH - 7.32) < 1e-9);
  assert.ok(Math.abs(GOAL_HEIGHT - 2.44) < 1e-9);

  assert.ok(inPenaltyArea(10, 34, 'left'));
  assert.ok(!inPenaltyArea(20, 34, 'left'));
  assert.ok(!inPenaltyArea(10, 5, 'left'), 'hors de la largeur de la surface');

  // Le ballon entier doit avoir franchi la ligne.
  const onLine = createBall(-0.05, 34, 1);
  assert.ok(!isGoal(onLine, 'left'), 'un ballon sur la ligne n’est pas un but');
  const inside = createBall(-0.3, 34, 1);
  assert.ok(isGoal(inside, 'left'), 'ballon entièrement franchi = but');
  const overBar = createBall(-0.3, 34, 3);
  assert.ok(!isGoal(overBar, 'left'), 'au-dessus de la barre, pas de but');

  const outWide = createBall(60, -0.4, 0.11);
  const touche = restartFor(outWide, 'left');
  assert.equal(touche.kind, 'touche');
  assert.equal(touche.forSide, 'right', 'la touche revient à l’adversaire du dernier toucheur');

  const behind = createBall(-0.5, 20, 0.11);
  assert.equal(restartFor(behind, 'left').kind, 'corner', 'dégagé par le défenseur = corner');
  assert.equal(restartFor(behind, 'right').kind, 'sixMetres', 'dégagé par l’attaquant = six mètres');

  assert.equal(thirdOf(10, 'left'), 'défensif');
  assert.equal(thirdOf(95, 'left'), 'offensif');
  assert.equal(channelOf(34), 'axe');
  assert.ok(heatmapZone(0, 0) === 0 && heatmapZone(104, 67) === 11, 'les douze zones couvrent le terrain');
});

test('terrain — le modèle d’occasions reproduit les valeurs réelles', () => {
  const sixMetres = expectedGoalsFromPosition(PITCH_LENGTH - 6, 34, 'left');
  const penaltySpot = expectedGoalsFromPosition(PITCH_LENGTH - 11, 34, 'left');
  const edgeOfBox = expectedGoalsFromPosition(PITCH_LENGTH - 16, 34, 'left');
  const distance = expectedGoalsFromPosition(PITCH_LENGTH - 30, 34, 'left');

  assert.ok(sixMetres > 0.4 && sixMetres < 0.56, `six mètres : ${sixMetres.toFixed(3)}`);
  assert.ok(penaltySpot > 0.22 && penaltySpot < 0.34, `onze mètres : ${penaltySpot.toFixed(3)}`);
  assert.ok(edgeOfBox > 0.09 && edgeOfBox < 0.17, `seize mètres : ${edgeOfBox.toFixed(3)}`);
  assert.ok(distance < 0.03, `trente mètres : ${distance.toFixed(3)}`);
  assert.ok(sixMetres > penaltySpot && penaltySpot > edgeOfBox && edgeOfBox > distance, 'monotone en distance');

  // À distance égale, un angle plus ouvert doit valoir davantage.
  const central = expectedGoalsFromPosition(PITCH_LENGTH - 14, 34, 'left');
  const wide = expectedGoalsFromPosition(PITCH_LENGTH - 8, 22, 'left');
  assert.ok(
    Math.abs(distanceToGoal(PITCH_LENGTH - 14, 34, 'left') - distanceToGoal(PITCH_LENGTH - 8, 22, 'left')) < 1,
    'les deux positions doivent être à distance comparable',
  );
  assert.ok(
    shootingAngle(PITCH_LENGTH - 14, 34, 'left') > shootingAngle(PITCH_LENGTH - 8, 22, 'left'),
    'la position axiale ouvre davantage le but',
  );
  assert.ok(central > wide, 'à distance égale, l’axe vaut mieux que l’angle fermé');
});

test('joueur — sprint, vitesse de pointe et inertie sont réalistes', () => {
  const elite = physicalProfile(attributes({ pace: 95, acceleration: 94, agility: 88, stamina: 80 }));
  const body = createBody(0, 34);

  let tenMetres: number | null = null;
  let thirtyMetres: number | null = null;
  for (let t = 0; t < 8 && thirtyMetres === null; t += 0.02) {
    stepBody(body, elite, 0.02, { desiredVx: 20, desiredVy: 0, sprinting: true });
    if (tenMetres === null && body.x >= 10) tenMetres = t + 0.02;
    if (body.x >= 30) thirtyMetres = t + 0.02;
  }
  assert.ok(tenMetres !== null && tenMetres > 1.6 && tenMetres < 2.05, `10 m en ${tenMetres?.toFixed(2)} s`);
  assert.ok(thirtyMetres !== null && thirtyMetres > 3.7 && thirtyMetres < 4.4, `30 m en ${thirtyMetres?.toFixed(2)} s`);
  assert.ok(body.topSpeed * 3.6 > 31 && body.topSpeed * 3.6 < 36, `pointe ${(body.topSpeed * 3.6).toFixed(1)} km/h`);

  // Un joueur lancé ne fait pas demi-tour instantanément.
  const launched = createBody(50, 34);
  for (let t = 0; t < 4; t += 0.02) stepBody(launched, elite, 0.02, { desiredVx: 20, desiredVy: 0, sprinting: true });
  const startX = launched.x;
  for (let t = 0; t < 0.6; t += 0.02) {
    stepBody(launched, elite, 0.02, { desiredVx: -20, desiredVy: 0, sprinting: true });
  }
  assert.ok(launched.x > startX, 'il continue d’avancer avant de pouvoir repartir en arrière');
});

test('joueur — la fatigue coûte de la vitesse et la marche la rend', () => {
  const profile = physicalProfile(attributes({ pace: 85, acceleration: 85, stamina: 70 }));
  const body = createBody(0, 34);
  const fresh = availableTopSpeed(profile, body);

  for (let t = 0; t < 12; t += 0.02) stepBody(body, profile, 0.02, { desiredVx: 20, desiredVy: 0, sprinting: true });
  const winded = availableTopSpeed(profile, body);
  assert.ok(winded < fresh * 0.85, `essoufflé : ${winded.toFixed(2)} contre ${fresh.toFixed(2)} m/s`);
  assert.ok(body.sprintReserve < 0.15, 'la réserve doit être épuisée');

  for (let t = 0; t < 25; t += 0.02) stepBody(body, profile, 0.02, { desiredVx: 1.4, desiredVy: 0, sprinting: false });
  assert.ok(body.sprintReserve > 0.9, 'la marche rend le souffle');
  // L'endurance de match, elle, ne remonte pas.
  assert.ok(body.stamina < 1, 'l’endurance de match ne se récupère pas en marchant');
});

test('joueur — contacts, protection du ballon et interception', () => {
  const strongProfile = physicalProfile(attributes({ strength: 92, agility: 70 }), 188, 88);
  const lightProfile = physicalProfile(attributes({ strength: 48, agility: 85 }), 172, 66);

  const strong = { body: createBody(50, 34, 0), profile: strongProfile };
  const light = { body: createBody(51, 34, Math.PI), profile: lightProfile };
  const contact = resolveContact(strong, light, 1);
  assert.equal(contact.winner, 'a', 'le joueur puissant doit gagner le duel de corps');
  assert.ok(light.body.balance < strong.body.balance, 'le perdant est davantage déséquilibré');
  assert.ok(light.body.balance < 1, 'un contact déséquilibre réellement');

  // Se placer dos à l'adversaire protège mieux que lui faire face.
  const holderAttributes = attributes({ strength: 80, firstTouch: 78 });
  const facingAway = {
    body: createBody(50, 34, Math.PI),
    profile: physicalProfile(holderAttributes),
    attributes: holderAttributes,
  };
  const facingTowards = {
    body: createBody(50, 34, 0),
    profile: physicalProfile(holderAttributes),
    attributes: holderAttributes,
  };
  const challenger = { body: createBody(51.5, 34, Math.PI), profile: lightProfile };
  assert.ok(
    shieldingStrength(facingAway, challenger) > shieldingStrength(facingTowards, challenger),
    'dos à l’adversaire, le ballon est mieux protégé',
  );

  // Le temps d'interception doit être honnête : partir dans le mauvais sens coûte.
  const runner = createBody(50, 34);
  const profile = physicalProfile(attributes({ pace: 80, acceleration: 80 }));
  for (let t = 0; t < 3; t += 0.02) stepBody(runner, profile, 0.02, { desiredVx: 18, desiredVy: 0, sprinting: true });
  const forward = timeToReach(runner, profile, runner.x + 15, 34);
  const backward = timeToReach(runner, profile, runner.x - 15, 34);
  assert.ok(backward > forward, 'revenir en arrière prend plus de temps que continuer');
  assert.ok(forward > 1 && forward < 3, `15 m dans l’élan : ${forward.toFixed(2)} s`);
});
