/**
 * Tests de la couche perception & décision — Tomes III et VIII.
 *
 * Ce qu'on vérifie ici n'est pas que le code tourne, mais qu'il produit du
 * comportement de footballeur : que deux joueurs voient des mondes différents,
 * qu'un attaquant presse quand un défenseur couvre, qu'un joueur mené à dix
 * minutes de la fin prend plus de risques qu'à 0-0, et que vingt-deux joueurs
 * réfléchissant vingt fois par seconde tiennent largement dans le budget.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createBall } from '../src/football/ball.js';
import { createBody, physicalProfile } from '../src/football/player-physics.js';
import {
  awarenessOf,
  createPerceptionCache,
  isOffside,
  offsideLine,
  passingLane,
  perceive,
  positionalValue,
  spaceAt,
  spotMistake,
  visualClarity,
  type MatchActor,
  type WorldState,
} from '../src/football/perception.js';
import {
  decideKeeperPositioning,
  decideOffBall,
  decideOnBall,
  roleOf,
  type DecisionContext,
} from '../src/football/decision.js';
import { defaultTactics } from '../src/football/tactics.js';
import { PITCH_LENGTH, PITCH_WIDTH } from '../src/football/pitch.js';
import { Rng } from '../src/core/rng.js';
import { randomFootballProfile } from '../src/ai/personality.js';
import { ATTRIBUTE_KEYS, type Attributes, type Position } from '../src/career/player.js';

function attributes(overrides: Partial<Attributes> = {}): Attributes {
  const base = {} as Attributes;
  for (const key of ATTRIBUTE_KEYS) base[key] = 60;
  return { ...base, ...overrides };
}

const SLOTS: ReadonlyArray<[Position, number, number]> = [
  ['GB', 5, 34],
  ['DD', 22, 12],
  ['DC', 18, 26],
  ['DC', 18, 42],
  ['DG', 22, 56],
  ['MDC', 35, 34],
  ['MC', 45, 22],
  ['MC', 45, 46],
  ['AD', 62, 10],
  ['BU', 60, 34],
  ['AG', 62, 58],
];

function makeActor(
  rng: Rng,
  id: string,
  position: Position,
  side: 'left' | 'right',
  x: number,
  y: number,
  overrides: Partial<Attributes> = {},
): MatchActor {
  const attrs = attributes(overrides);
  return {
    id,
    name: id,
    position,
    side,
    attributes: attrs,
    profile: randomFootballProfile(rng, 0.6),
    physical: physicalProfile(attrs),
    body: createBody(x, y, side === 'left' ? 0 : Math.PI),
    confidence: 0.6,
    anchorX: x,
    anchorY: y,
    onPitch: true,
    sentOff: false,
  };
}

function buildWorld(rng: Rng, carrierId: string): WorldState {
  const actors: MatchActor[] = [];
  SLOTS.forEach(([position, x, y], index) => actors.push(makeActor(rng, `H${index}`, position, 'left', x, y)));
  SLOTS.forEach(([position, x, y], index) =>
    actors.push(makeActor(rng, `A${index}`, position, 'right', PITCH_LENGTH - x, PITCH_WIDTH - y)),
  );

  const ball = createBall(52.5, 34);
  const carrier = actors.find((actor) => actor.id === carrierId);
  if (carrier) {
    ball.position.x = carrier.body.x;
    ball.position.y = carrier.body.y;
  }
  return {
    ball,
    actors,
    carrierId,
    minute: 30,
    scoreLeft: 0,
    scoreRight: 0,
    crowdIntensity: 0.6,
    visibility: 1,
    possessionChangedAgo: 30,
  };
}

function context(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    minute: 30,
    goalDifference: 0,
    stakes: 0.7,
    crowdPressure: 0.6,
    slippery: 0.1,
    tactics: defaultTactics('4-3-3'),
    inPossession: true,
    ...overrides,
  };
}

test('perception — le champ visuel a un axe net et une périphérie dégradée', () => {
  const rng = new Rng('vision');
  const actor = makeActor(rng, 'obs', 'MC', 'left', 50, 34);
  const awareness = awarenessOf(actor, buildWorld(rng, 'obs'));

  const ahead = visualClarity(actor, 65, 34, awareness);
  const side = visualClarity(actor, 50, 49, awareness);
  const behind = visualClarity(actor, 35, 34, awareness);

  assert.equal(ahead, 1, 'dans l’axe du regard, la lecture est parfaite');
  assert.ok(side < ahead && side > behind, 'la périphérie est dégradée mais pas aveugle');
  assert.ok(behind < 0.3, 'derrière soi, on ne voit presque rien');

  // Un joueur essoufflé garde la tête basse.
  const tired = makeActor(rng, 'tired', 'MC', 'left', 50, 34);
  tired.body.sprintReserve = 0.1;
  tired.body.stamina = 0.5;
  assert.ok(
    awarenessOf(tired, buildWorld(rng, 'tired')) < awareness,
    'la fatigue dégrade la prise d’information',
  );
});

test('perception — l’erreur croît avec la distance, même en regardant droit devant', () => {
  const rng = new Rng('erreur');
  const world = buildWorld(rng, 'H5');

  // Les deux observateurs regardent droit vers le ballon : seule la distance
  // les sépare. Comparer deux joueurs quelconques ne prouverait rien, puisque
  // l'orientation du regard pèse davantage que l'éloignement.
  function meanError(distance: number): number {
    const actor = world.actors.find((a) => a.id === 'H6')!;
    actor.body.x = world.ball.position.x - distance;
    actor.body.y = world.ball.position.y;
    actor.body.facing = 0;
    let total = 0;
    for (let index = 0; index < 120; index++) {
      const perception = perceive(actor, world, rng);
      total += Math.hypot(perception.ballX - world.ball.position.x, perception.ballY - world.ball.position.y);
    }
    return total / 120;
  }

  const near = meanError(8);
  const far = meanError(55);
  assert.ok(far > near, `le lointain se trompe davantage : ${far.toFixed(2)} m contre ${near.toFixed(2)} m`);
  assert.ok(far > 0.3, 'on ne lit pas un ballon à cinquante mètres au centimètre près');
  assert.ok(near < 0.6, 'à huit mètres, dans l’axe, la lecture est nette');
});

test('perception — deux joueurs ne voient jamais exactement la même chose', () => {
  const rng = new Rng('divergence');
  const world = buildWorld(rng, 'H5');
  const first = world.actors.find((actor) => actor.id === 'H6')!;
  const second = world.actors.find((actor) => actor.id === 'H7')!;

  const a = perceive(first, world, rng);
  const b = perceive(second, world, rng);
  assert.ok(
    Math.abs(a.ballX - b.ballX) > 1e-9 || Math.abs(a.ballY - b.ballY) > 1e-9,
    'les estimations doivent diverger',
  );
  // Et pourtant tout reste déterministe : même graine, même perception.
  const replay = new Rng('divergence');
  const replayWorld = buildWorld(replay, 'H5');
  const replayFirst = replayWorld.actors.find((actor) => actor.id === 'H6')!;
  const replayed = perceive(replayFirst, replayWorld, replay);
  assert.equal(replayed.ballX, a.ballX, 'le déterminisme doit être préservé');
});

test('perception — lignes de passe, espaces et hors-jeu', () => {
  const rng = new Rng('lignes');
  const world = buildWorld(rng, 'H5');
  const carrier = world.actors.find((actor) => actor.id === 'H5')!;
  const perception = perceive(carrier, world, rng);

  // Une passe latérale dans le vide est ouverte ; une passe à travers le bloc
  // adverse ne l'est pas.
  const clear = passingLane(50, 5, 60, 5, perception.opponents);
  const blocked = passingLane(50, 34, 95, 34, perception.opponents);
  assert.ok(clear > blocked, `dégagée ${clear.toFixed(2)} contre fermée ${blocked.toFixed(2)}`);

  assert.ok(spaceAt(52, 2, perception.opponents) > spaceAt(70, 34, perception.opponents));

  // La valeur de position croît vers le but adverse et l'axe.
  assert.ok(positionalValue(95, 34, 'left') > positionalValue(52, 34, 'left'));
  assert.ok(positionalValue(95, 34, 'left') > positionalValue(95, 3, 'left'));

  const line = offsideLine(perception, 'left');
  assert.ok(line > PITCH_LENGTH / 2, 'la ligne adverse est dans leur moitié');
  assert.ok(isOffside(line + 3, line, 60, 'left'), 'au-delà de la ligne et du ballon = hors-jeu');
  assert.ok(!isOffside(line - 3, line, 60, 'left'), 'en deçà de la ligne = régulier');
  assert.ok(!isOffside(line + 3, line, line + 5, 'left'), 'devant le ballon, pas de hors-jeu');
});

test('décision — le poste change radicalement le comportement sans ballon', () => {
  const rng = new Rng('postes');
  const world = { ...buildWorld(rng, 'A5'), carrierId: 'A5' };
  const carrier = world.actors.find((actor) => actor.id === 'A5')!;
  world.ball.position.x = carrier.body.x;
  world.ball.position.y = carrier.body.y;
  const defending = context({ inPossession: false });

  function tally(id: string): Record<string, number> {
    const actor = world.actors.find((a) => a.id === id)!;
    const counts: Record<string, number> = {};
    for (let index = 0; index < 150; index++) {
      const perception = perceive(actor, world, rng);
      const action = decideOffBall(actor, perception, world, defending, rng);
      counts[action.kind] = (counts[action.kind] ?? 0) + 1;
    }
    return counts;
  }

  const keeper = tally('H0');
  const defender = tally('H2');
  const striker = tally('H9');

  assert.ok((keeper.couverture ?? 0) > 100, 'un gardien se place, il ne fait pas autre chose');
  assert.equal(keeper.pressing ?? 0, 0, 'un gardien ne part jamais presser hors de sa zone');
  assert.ok((striker.pressing ?? 0) > 40, `l’attaquant doit presser : ${JSON.stringify(striker)}`);
  assert.ok(
    (defender.couverture ?? 0) + (defender.marquage ?? 0) > (defender.pressing ?? 0),
    'un défenseur couvre et marque plus qu’il ne presse',
  );
  assert.equal(roleOf('GB'), 'gardien');
  assert.equal(roleOf('MOC'), 'milieu');
  assert.equal(roleOf('BU'), 'attaquant');
});

test('décision — le score et le temps changent la prise de risque', () => {
  const rng = new Rng('risque');
  const world = buildWorld(rng, 'H5');
  const carrier = world.actors.find((actor) => actor.id === 'H5')!;

  function forwardShare(overrides: Partial<DecisionContext>): number {
    const situation = context({ ...overrides });
    let forward = 0;
    let total = 0;
    for (let index = 0; index < 300; index++) {
      const perception = perceive(carrier, world, rng);
      const action = decideOnBall(carrier, perception, world, situation, rng);
      total++;
      if (action.kind === 'passe' && action.targetX > carrier.body.x + 6) forward++;
      if (action.kind === 'tir' || action.kind === 'dribble') forward++;
    }
    return forward / total;
  }

  const level = forwardShare({ minute: 30, goalDifference: 0 });
  const chasing = forwardShare({ minute: 85, goalDifference: -1 });
  const protecting = forwardShare({ minute: 85, goalDifference: 2 });

  assert.ok(chasing > level, `mené à la 85e on force : ${chasing.toFixed(2)} contre ${level.toFixed(2)}`);
  assert.ok(protecting < chasing, `en tête on gère : ${protecting.toFixed(2)} contre ${chasing.toFixed(2)}`);
});

test('décision — le porteur varie ses choix sans jamais faire n’importe quoi', () => {
  const rng = new Rng('variete');
  const world = buildWorld(rng, 'H5');
  const carrier = world.actors.find((actor) => actor.id === 'H5')!;
  const situation = context();

  const counts: Record<string, number> = {};
  for (let index = 0; index < 400; index++) {
    const perception = perceive(carrier, world, rng);
    const action = decideOnBall(carrier, perception, world, situation, rng);
    counts[action.kind] = (counts[action.kind] ?? 0) + 1;
  }

  assert.ok(Object.keys(counts).length >= 2, `le joueur doit varier : ${JSON.stringify(counts)}`);
  // Un milieu au rond central ne tire pas de quarante mètres à chaque ballon.
  assert.ok((counts.tir ?? 0) < 60, `tirs trop fréquents : ${counts.tir ?? 0}/400`);
  // Et il ne dégage pas non plus depuis le milieu de terrain.
  assert.equal(counts['dégagement'] ?? 0, 0, 'aucun dégagement depuis le rond central');
});

test('décision — un joueur lucide choisit mieux qu’un joueur cuit', () => {
  const rng = new Rng('lucidite');
  const world = buildWorld(rng, 'H5');
  const situation = context();

  function riskyShare(actor: MatchActor): number {
    let risky = 0;
    let total = 0;
    for (let index = 0; index < 300; index++) {
      const perception = perceive(actor, world, rng);
      const action = decideOnBall(actor, perception, world, situation, rng);
      total++;
      if (action.kind === 'passe' && action.risk > 0.5) risky++;
    }
    return risky / total;
  }

  const sharp = world.actors.find((actor) => actor.id === 'H5')!;
  const spent = world.actors.find((actor) => actor.id === 'H6')!;
  spent.body.sprintReserve = 0.05;
  spent.body.stamina = 0.45;
  spent.body.balance = 0.5;
  spent.confidence = 0.2;
  spent.body.x = sharp.body.x;
  spent.body.y = sharp.body.y;

  assert.ok(
    riskyShare(spent) > riskyShare(sharp),
    'un joueur cuit et sans confiance tente davantage de passes hasardeuses',
  );
});

test('décision — le gardien se place selon le ballon et son bloc', () => {
  const rng = new Rng('gardien');
  const world = buildWorld(rng, 'A9');
  const keeper = world.actors.find((actor) => actor.id === 'H0')!;

  // Ballon loin : le gardien reste près de sa ligne.
  world.ball.position.x = 80;
  world.ball.position.y = 34;
  const far = decideKeeperPositioning(keeper, perceive(keeper, world, rng), context({ inPossession: false }));

  // Ballon proche : il sort pour réduire l'angle.
  world.ball.position.x = 20;
  world.ball.position.y = 34;
  const near = decideKeeperPositioning(keeper, perceive(keeper, world, rng), context({ inPossession: false }));

  assert.ok(near.targetX > far.targetX, `il sort quand le danger approche : ${near.targetX.toFixed(1)} > ${far.targetX.toFixed(1)}`);
  assert.ok(near.targetX < 22, 'il ne quitte pas sa surface sans raison');

  // Un bloc haut le fait jouer plus haut : c'est un choix tactique.
  const high = decideKeeperPositioning(
    keeper,
    perceive(keeper, world, rng),
    context({ inPossession: false, tactics: { ...defaultTactics('4-3-3'), defensiveLine: 'haute' } }),
  );
  const low = decideKeeperPositioning(
    keeper,
    perceive(keeper, world, rng),
    context({ inPossession: false, tactics: { ...defaultTactics('4-3-3'), defensiveLine: 'basse' } }),
  );
  assert.ok(high.targetX > low.targetX, 'un bloc haut sort le gardien de sa surface');
});

test('décision — repérer une erreur adverse dépend de ce qu’on regarde', () => {
  const rng = new Rng('erreur-adverse');
  const world = buildWorld(rng, 'A5');
  const opponent = world.actors.find((actor) => actor.id === 'A5')!;
  // L'adversaire est déséquilibré et orienté à l'opposé du ballon.
  opponent.body.balance = 0.15;
  opponent.body.facing = Math.PI / 2;
  opponent.body.x = 55;
  opponent.body.y = 34;
  world.ball.position.x = 55;
  world.ball.position.y = 34;

  const watcher = world.actors.find((actor) => actor.id === 'H9')!;
  watcher.body.x = 50;
  watcher.body.y = 34;
  watcher.body.facing = 0;
  const seen = spotMistake(perceive(watcher, world, rng), world);
  assert.ok(seen && seen.severity > 0.25, 'un joueur qui regarde doit voir la faiblesse');

  assert.equal(seen!.targetId, 'A5', 'c’est bien la faiblesse de A5 qui est repérée');

  // Le même joueur, dos tourné, ne repère plus *cette* faiblesse-là. Il peut
  // encore percevoir autre chose ailleurs : on vérifie la cible, pas l'absence.
  watcher.body.facing = Math.PI;
  let missedA5 = 0;
  for (let index = 0; index < 30; index++) {
    const spotted = spotMistake(perceive(watcher, world, rng), world);
    if (!spotted || spotted.targetId !== 'A5') missedA5++;
  }
  assert.ok(missedA5 > 20, `dos tourné, l’erreur de A5 échappe : ${missedA5}/30`);
});

test('performance — 22 joueurs qui réfléchissent 20 fois par seconde restent fluides', () => {
  const rng = new Rng('performance');
  const world = buildWorld(rng, 'H5');
  const tactics = defaultTactics('4-3-3');

  function cycle(): void {
    const cache = createPerceptionCache();
    for (const actor of world.actors) {
      const situation = context({ inPossession: actor.side === 'left', tactics });
      const perception = perceive(actor, world, rng, cache);
      if (actor.id === world.carrierId) decideOnBall(actor, perception, world, situation, rng);
      else decideOffBall(actor, perception, world, situation, rng);
    }
  }

  // Chauffe, pour ne pas mesurer la compilation à la volée.
  for (let index = 0; index < 30; index++) cycle();

  const iterations = 300;
  const started = process.hrtime.bigint();
  for (let index = 0; index < iterations; index++) cycle();
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  const perCycle = elapsedMs / iterations;

  // Vingt cycles par seconde de jeu doivent tenir très largement dans une
  // seconde de calcul — en pratique on vise moins de 5 % d'un cœur.
  const costPerGameSecond = perCycle * 20;
  assert.ok(costPerGameSecond < 50, `coût par seconde de jeu : ${costPerGameSecond.toFixed(1)} ms`);
  assert.ok(perCycle < 5, `un cycle de 22 joueurs : ${perCycle.toFixed(2)} ms`);
});
