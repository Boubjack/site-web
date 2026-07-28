/**
 * Tests unitaires du noyau — Tome XV, ch. 2.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  GameClock,
  absoluteMinutesFromDate,
  dateFromAbsoluteMinutes,
  daysInMonth,
  footballSeasonOf,
  isLeapYear,
  seasonFor,
} from '../src/core/clock.js';
import { EventBus } from '../src/core/event-bus.js';
import { Rng } from '../src/core/rng.js';
import { MemoryBank, MemoryFactory } from '../src/ai/memory.js';
import { DialogueEngine } from '../src/ai/dialogue.js';
import {
  MemorySaveStorage,
  SAVE_FORMAT_VERSION,
  createEnvelope,
  loadEnvelope,
  SaveCorruptionError,
  stableStringify,
} from '../src/core/save.js';
import { clamp, haversineKm, hashString, weightedAverage } from '../src/core/math.js';

test('calendrier — années bissextiles et longueurs de mois', () => {
  assert.equal(isLeapYear(2024), true);
  assert.equal(isLeapYear(2025), false);
  assert.equal(isLeapYear(2000), true);
  assert.equal(isLeapYear(1900), false);
  assert.equal(daysInMonth(2024, 2), 29);
  assert.equal(daysInMonth(2025, 2), 28);
  assert.equal(daysInMonth(2025, 4), 30);
});

test('calendrier — conversion date ↔ minutes réversible', () => {
  const dates = [
    { year: 2025, month: 1, day: 1, hour: 0, minute: 0 },
    { year: 2025, month: 7, day: 1, hour: 8, minute: 30 },
    { year: 2032, month: 12, day: 31, hour: 23, minute: 59 },
    { year: 2028, month: 2, day: 29, hour: 12, minute: 0 },
  ];
  for (const date of dates) {
    const minutes = absoluteMinutesFromDate(date);
    const restored = dateFromAbsoluteMinutes(minutes);
    assert.equal(restored.year, date.year);
    assert.equal(restored.month, date.month);
    assert.equal(restored.day, date.day);
    assert.equal(restored.hour, date.hour);
    assert.equal(restored.minute, date.minute);
  }
});

test('horloge — les paliers se déclenchent tous, même sur un grand saut', () => {
  const clock = new GameClock({ year: 2025, month: 7, day: 1, hour: 8 }, 1);
  let hours = 0;
  let days = 0;
  let months = 0;
  let years = 0;
  clock.advanceMinutes(400 * 24 * 60, {
    onHour: () => hours++,
    onDay: () => days++,
    onMonth: () => months++,
    onYear: () => years++,
  });
  assert.equal(days, 400, 'chaque journée doit être notifiée');
  assert.ok(hours >= 400);
  assert.equal(months, 13);
  assert.equal(years, 1);
});

test('horloge — pause et reprise conservent l’instant exact', () => {
  const clock = new GameClock({ year: 2025, month: 7, day: 1, hour: 8 }, 60);
  clock.advanceRealSeconds(10);
  const before = clock.absoluteMinutes;
  clock.pause();
  clock.advanceRealSeconds(120);
  assert.equal(clock.absoluteMinutes, before, 'le monde ne doit pas avancer en pause');
  clock.resume();
  clock.advanceRealSeconds(1);
  assert.ok(clock.absoluteMinutes > before);
});

test('saison sportive — bascule en juillet', () => {
  assert.equal(footballSeasonOf({ year: 2025, month: 6, day: 30, hour: 0, minute: 0, weekday: 0 }), 2024);
  assert.equal(footballSeasonOf({ year: 2025, month: 7, day: 1, hour: 0, minute: 0, weekday: 0 }), 2025);
  assert.equal(seasonFor(1), 'winter');
  assert.equal(seasonFor(1, 'south'), 'summer');
  assert.equal(seasonFor(7, 'south'), 'winter');
});

test('RNG — déterminisme, restauration et flux dérivés indépendants', () => {
  const a = new Rng('infinity');
  const b = new Rng('infinity');
  for (let i = 0; i < 100; i++) assert.equal(a.next(), b.next());

  const state = a.save();
  const sequence = [a.next(), a.next(), a.next()];
  a.restore(state);
  assert.deepEqual([a.next(), a.next(), a.next()], sequence);

  const child1 = new Rng('infinity').derive('monde');
  const child2 = new Rng('infinity').derive('monde');
  const other = new Rng('infinity').derive('economie');
  assert.equal(child1.next(), child2.next());
  assert.notEqual(child1.next(), other.next());
});

test('RNG — distributions bornées', () => {
  const rng = new Rng('bornes');
  for (let i = 0; i < 2000; i++) {
    const value = rng.next();
    assert.ok(value >= 0 && value < 1);
    const int = rng.int(3, 7);
    assert.ok(int >= 3 && int <= 7);
    const gaussian = rng.gaussian(0, 1);
    assert.ok(gaussian >= -4 && gaussian <= 4);
  }
  const picked = rng.pickMany([1, 2, 3, 4, 5], 3);
  assert.equal(picked.length, 3);
  assert.equal(new Set(picked).size, 3, 'les éléments tirés doivent être distincts');
});

test('bus d’événements — ordre de priorité et isolation des erreurs', () => {
  const bus = new EventBus({ onHandlerError: () => undefined });
  const order: string[] = [];
  bus.on('world.tick', () => order.push('basse'), 0);
  bus.on('world.tick', () => {
    throw new Error('abonné défaillant');
  }, 5);
  bus.on('world.tick', () => order.push('haute'), 10);

  bus.emit({ type: 'world.tick', at: 0, deltaMinutes: 1 });
  assert.deepEqual(order, ['haute', 'basse'], 'une exception ne doit pas bloquer les autres abonnés');
  assert.equal(bus.totalEmitted, 1);
});

test('bus d’événements — désabonnement et once', () => {
  const bus = new EventBus();
  let count = 0;
  const off = bus.on('world.tick', () => count++);
  bus.emit({ type: 'world.tick', at: 0, deltaMinutes: 1 });
  off();
  bus.emit({ type: 'world.tick', at: 1, deltaMinutes: 1 });
  assert.equal(count, 1);

  let onceCount = 0;
  bus.once('world.tick', () => onceCount++);
  bus.emit({ type: 'world.tick', at: 2, deltaMinutes: 1 });
  bus.emit({ type: 'world.tick', at: 3, deltaMinutes: 1 });
  assert.equal(onceCount, 1);
});

test('mémoire IA — décroissance, permanence et sentiment', () => {
  const bank = new MemoryBank();
  const now = 0;
  bank.remember(MemoryFactory.trophy('t1', 'Ligue des Champions', ['trophée', 'club-a'], now));
  bank.remember(MemoryFactory.betrayal('b1', 'départ chez le rival', ['transfert', 'club-a'], now));
  bank.remember(MemoryFactory.interaction('i1', 'salut rapide', ['club-a'], now, 0.2));

  const tenYears = 10 * 365 * 24 * 60;
  const trophy = bank.recall(['trophée'], tenYears)[0];
  assert.ok(trophy, 'un trophée doit rester en mémoire dix ans plus tard');
  assert.ok(trophy.strength > 0.5, 'un souvenir historique conserve son intensité');

  const anecdote = bank.recall(['club-a'], tenYears).find((m) => m.id === 'i1');
  assert.ok(!anecdote || anecdote.strength < 0.1, 'une anecdote doit s’effacer');

  const sentiment = bank.sentimentTowards('club-a', now);
  assert.ok(sentiment >= -1 && sentiment <= 1);
});

test('mémoire IA — capacité bornée sans perte des souvenirs majeurs', () => {
  const bank = new MemoryBank({ capacity: 20 });
  bank.remember(MemoryFactory.record('record', 'record du monde', ['record'], 0));
  for (let i = 0; i < 60; i++) {
    bank.remember(MemoryFactory.interaction(`i${i}`, 'banal', ['banal'], i, 0.05));
  }
  assert.ok(bank.size <= 20);
  assert.ok(bank.has('record'), 'le record ne doit jamais être oublié en premier');
});

test('dialogue — anti-répétition et volume combinatoire', () => {
  const engine = new DialogueEngine(200);
  const rng = new Rng('dialogue');
  const signatures = new Set<string>();
  for (let i = 0; i < 150; i++) {
    const line = engine.generate('commentaire.but', 'enthousiaste', { player: 'Amadou Traoré' }, rng);
    assert.ok(line.text.length > 0);
    assert.ok(!line.text.includes('{'), 'toutes les variables doivent être substituées');
    signatures.add(line.signature);
  }
  assert.ok(signatures.size > 100, `variété insuffisante : ${signatures.size} combinaisons`);
  assert.ok(engine.totalVariantCount() > 500_000, `volume combinatoire trop faible : ${engine.totalVariantCount()}`);
});

test('dialogue — les variables manquantes reçoivent un repli lisible', () => {
  const engine = new DialogueEngine();
  const rng = new Rng('fallback');
  for (let i = 0; i < 40; i++) {
    const line = engine.generate('commentaire.memoire', 'nostalgique', {}, rng);
    assert.ok(!line.text.includes('{'));
    assert.ok(!line.text.includes('undefined'));
  }
});

test('sauvegarde — enveloppe, somme de contrôle et détection de corruption', async () => {
  const payload = {
    clock: { absoluteMinutes: 1000, timeScale: 1, paused: false },
    rngStreams: { monde: { a: 1, b: 2, c: 3, d: 4 } },
    systems: { world: { closedVenues: [] } },
  };
  const meta = {
    seed: 'test',
    playerName: 'Test',
    clubName: 'Club',
    season: 2025,
    dateLabel: '1 juillet 2025',
    playtimeMinutes: 120,
    reputation: 40,
    netWorth: 1000,
  };
  const envelope = createEnvelope('slot1', 'manual', meta, payload);
  assert.equal(envelope.version, SAVE_FORMAT_VERSION);

  const loaded = loadEnvelope(envelope);
  assert.equal(loaded.migrated, false);
  assert.deepEqual(loaded.payload.systems, payload.systems);

  const corrupted = { ...envelope, checksum: 'deadbeef' };
  assert.throws(() => loadEnvelope(corrupted), SaveCorruptionError);

  const storage = new MemorySaveStorage();
  await storage.write('slot1', envelope);
  const read = await storage.read('slot1');
  assert.ok(read);
  assert.equal(read?.meta.playerName, 'Test');
  assert.deepEqual(await storage.list(), ['slot1']);
});

test('sauvegarde — migration depuis une version ancienne', () => {
  const legacyPayload = {
    clock: { absoluteMinutes: 500, timeScale: 1, paused: false },
    world: { closedVenues: ['paris/x'] },
  };
  const envelope = {
    magic: 'INFINITY_FOOTBALL_SAVE' as const,
    version: 1,
    createdAt: new Date().toISOString(),
    slot: 'ancien',
    kind: 'manual' as const,
    checksum: undefined as unknown as string,
    meta: {
      seed: 'x',
      playerName: 'x',
      clubName: 'x',
      season: 2025,
      dateLabel: '',
      playtimeMinutes: 0,
      reputation: 0,
      netWorth: 0,
    },
    payload: legacyPayload as never,
  };
  const loaded = loadEnvelope(envelope);
  assert.equal(loaded.migrated, true);
  assert.ok(loaded.payload.systems, 'la migration doit produire un bloc systems');
  assert.ok(loaded.payload.rngStreams, 'la migration doit produire un bloc rngStreams');
});

test('sérialisation stable — clés triées, sortie reproductible', () => {
  const a = stableStringify({ b: 1, a: 2, c: { z: 1, y: 2 } });
  const b = stableStringify({ c: { y: 2, z: 1 }, a: 2, b: 1 });
  assert.equal(a, b);
});

test('math — utilitaires géographiques et statistiques', () => {
  assert.equal(clamp(15, 0, 10), 10);
  assert.equal(clamp(-5, 0, 10), 0);

  const parisLondres = haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 51.5074, lon: -0.1278 });
  assert.ok(parisLondres > 330 && parisLondres < 360, `distance Paris-Londres inattendue : ${parisLondres}`);

  const parisTokyo = haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 35.6762, lon: 139.6503 });
  assert.ok(parisTokyo > 9500 && parisTokyo < 10000, `distance Paris-Tokyo inattendue : ${parisTokyo}`);

  assert.equal(weightedAverage([{ value: 10, weight: 1 }, { value: 20, weight: 3 }]), 17.5);
  assert.equal(weightedAverage([]), 0);
  assert.equal(hashString('a'), hashString('a'));
  assert.notEqual(hashString('a'), hashString('b'));
});
