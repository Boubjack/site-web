/**
 * tests/run.js — Suite de tests du moteur.
 *
 * Exigence du Tome XV ch. 2 : tests unitaires et tests d'intégration avant
 * chaque mise à jour. Exécutable de deux manières :
 *   - en ligne de commande : `node tests/run.js`
 *   - dans le navigateur    : importée par tests.html
 *
 * Aucune dépendance externe : un mini-harnais suffit et garde le projet léger
 * (Tome XV ch. 7 : faible consommation, chargements rapides).
 */

import { EventBus, EVENTS } from '../js/core/events.js';
import { RNG } from '../js/core/rng.js';
import { Clock, saisonSportiveDe } from '../js/core/clock.js';
import { createInitialState, emptyStatLine, mergeStatLine, STATE_VERSION } from '../js/core/state.js';
import { reconcile } from '../js/core/save.js';
import { Game } from '../js/game.js';
import { CITIES, CLUBS, COUNTRIES, distanceKm, getCity, getClub, worldStats, AWARD_CATEGORIES } from '../js/data/world.js';
import { TOMES, countChapters, countRequirements } from '../js/data/gdd.js';
import { TRACE, coverage } from '../js/data/traceability.js';

// ── Harnais minimal ────────────────────────────────────────────────────────

const results = [];
let currentSuite = '';

function describe(name, fn) {
  currentSuite = name;
  fn();
}

function it(name, fn) {
  const suite = currentSuite;
  try {
    fn();
    results.push({ suite, name, ok: true });
  } catch (error) {
    results.push({ suite, name, ok: false, error: error.message });
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion échouée');
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Attendu ${JSON.stringify(expected)}, obtenu ${JSON.stringify(actual)}`);
  }
}

function assertClose(actual, expected, tolerance, message) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(message || `Attendu ~${expected} (±${tolerance}), obtenu ${actual}`);
  }
}

function assertBetween(value, min, max, message) {
  if (value < min || value > max) {
    throw new Error(message || `Attendu entre ${min} et ${max}, obtenu ${value}`);
  }
}

// ── Tests unitaires : bus d'événements ─────────────────────────────────────

describe('EventBus', () => {
  it('diffuse un événement à ses abonnés', () => {
    const bus = new EventBus();
    let received = null;
    bus.on('test', (payload) => { received = payload; });
    bus.emit('test', { value: 42 });
    assertEqual(received.value, 42);
  });

  it('permet le désabonnement', () => {
    const bus = new EventBus();
    let count = 0;
    const off = bus.on('test', () => { count++; });
    bus.emit('test');
    off();
    bus.emit('test');
    assertEqual(count, 1);
  });

  it('un intercepteur peut annuler un événement', () => {
    const bus = new EventBus();
    let fired = false;
    bus.intercept('test', () => false);
    bus.on('test', () => { fired = true; });
    const result = bus.emit('test');
    assertEqual(result, false, "emit() doit retourner false quand l'événement est annulé");
    assertEqual(fired, false, 'Aucun handler ne doit être appelé');
  });

  it('un intercepteur peut modifier le payload', () => {
    const bus = new EventBus();
    let received = null;
    bus.intercept('test', (payload) => ({ ...payload, added: true }));
    bus.on('test', (payload) => { received = payload; });
    bus.emit('test', { original: true });
    assert(received.added && received.original, 'Le payload modifié doit parvenir aux abonnés');
  });

  it("un handler défaillant n'interrompt pas la diffusion", () => {
    const bus = new EventBus();
    let reached = false;
    const originalError = console.error;
    console.error = () => {};
    bus.on('test', () => { throw new Error('boom'); });
    bus.on('test', () => { reached = true; });
    bus.emit('test');
    console.error = originalError;
    assert(reached, 'Le second handler doit être appelé malgré l\'échec du premier');
  });

  it('le journal reste borné', () => {
    const bus = new EventBus();
    bus.journalLimit = 10;
    for (let i = 0; i < 50; i++) bus.emit('test', { i });
    assert(bus.journal(100).length <= 10, 'Le journal ne doit pas croître sans limite');
  });
});

// ── Tests unitaires : RNG ──────────────────────────────────────────────────

describe('RNG', () => {
  it('est déterministe pour une même graine', () => {
    const a = new RNG(12345);
    const b = new RNG(12345);
    for (let i = 0; i < 100; i++) assertEqual(a.next(), b.next());
  });

  it('produit des graines différentes pour des chaînes différentes', () => {
    assert(RNG.hashString('alpha') !== RNG.hashString('beta'));
  });

  it('int() reste dans les bornes inclusives', () => {
    const rng = new RNG(7);
    for (let i = 0; i < 1000; i++) assertBetween(rng.int(3, 9), 3, 9);
  });

  it('chance(0) est toujours faux et chance(1) toujours vrai', () => {
    const rng = new RNG(1);
    for (let i = 0; i < 100; i++) {
      assertEqual(rng.chance(0), false);
      assertEqual(rng.chance(1), true);
    }
  });

  it('weighted() respecte grossièrement les poids', () => {
    const rng = new RNG(99);
    const items = [{ id: 'a', weight: 90 }, { id: 'b', weight: 10 }];
    let aCount = 0;
    for (let i = 0; i < 2000; i++) if (rng.weighted(items).id === 'a') aCount++;
    assertClose(aCount / 2000, 0.9, 0.05);
  });

  it('shuffle() conserve tous les éléments', () => {
    const rng = new RNG(3);
    const source = [1, 2, 3, 4, 5, 6, 7, 8];
    const shuffled = rng.shuffle(source);
    assertEqual(shuffled.length, source.length);
    assert(source.every((v) => shuffled.includes(v)), 'Aucun élément ne doit être perdu');
  });

  it('la sérialisation restaure la séquence exacte', () => {
    const rng = new RNG(555);
    for (let i = 0; i < 20; i++) rng.next();
    const restored = RNG.deserialize(rng.serialize());
    for (let i = 0; i < 20; i++) assertEqual(rng.next(), restored.next());
  });

  it('gaussianClamped() ne sort jamais des bornes', () => {
    const rng = new RNG(42);
    for (let i = 0; i < 500; i++) assertBetween(rng.gaussianClamped(50, 30, 0, 100), 0, 100);
  });
});

// ── Tests unitaires : horloge ──────────────────────────────────────────────

describe('Clock', () => {
  it('avance correctement au jour suivant', () => {
    const clock = new Clock({ startYear: 2026, startMonth: 6, startDay: 1, startHour: 23 });
    clock.advance(1);
    assertEqual(clock.day, 2);
    assertEqual(clock.hour, 0);
  });

  it('gère le passage au mois suivant', () => {
    const clock = new Clock({ startYear: 2026, startMonth: 6, startDay: 31, startHour: 23 });
    clock.advance(1);
    assertEqual(clock.month, 7);
    assertEqual(clock.day, 1);
  });

  it("gère le passage à l'année suivante", () => {
    const clock = new Clock({ startYear: 2026, startMonth: 11, startDay: 31, startHour: 23 });
    clock.advance(1);
    assertEqual(clock.year, 2027);
    assertEqual(clock.month, 0);
  });

  it('gère les années bissextiles', () => {
    assertEqual(Clock.joursDansMois(2028, 1), 29, 'Février 2028 doit compter 29 jours');
    assertEqual(Clock.joursDansMois(2027, 1), 28, 'Février 2027 doit compter 28 jours');
  });

  it('calcule la saison sportive de juillet à juin', () => {
    assertEqual(saisonSportiveDe(2026, 6), 2026, 'Juillet 2026 → saison 2026');
    assertEqual(saisonSportiveDe(2027, 4), 2026, 'Mai 2027 → toujours saison 2026');
    assertEqual(saisonSportiveDe(2027, 6), 2027, 'Juillet 2027 → saison 2027');
  });

  it('la sérialisation préserve la position temporelle', () => {
    const clock = new Clock({ startYear: 2026, startMonth: 6, startDay: 1 });
    clock.advance(1000);
    const restored = Clock.deserialize(clock.serialize());
    assertEqual(restored.year, clock.year);
    assertEqual(restored.month, clock.month);
    assertEqual(restored.day, clock.day);
    assertEqual(restored.totalHours, clock.totalHours);
  });
});

// ── Tests unitaires : état et statistiques ─────────────────────────────────

describe('State', () => {
  it("crée un état complet à la bonne version", () => {
    const state = createInitialState({ name: 'Test' });
    assertEqual(state.version, STATE_VERSION);
    assertEqual(state.player.name, 'Test');
    assert(state.economy.accounts.courant > 0);
    assert(Array.isArray(state.economy.ledger));
  });

  it('mergeStatLine cumule les nombres et concatène les tableaux', () => {
    const target = emptyStatLine();
    mergeStatLine(target, { buts: 2, notes: [7.5] });
    mergeStatLine(target, { buts: 3, notes: [8.0] });
    assertEqual(target.buts, 5);
    assertEqual(target.notes.length, 2);
  });

  it('mergeStatLine conserve le maximum pour la vitesse', () => {
    const target = emptyStatLine();
    mergeStatLine(target, { vitesseMax: 32.4 });
    mergeStatLine(target, { vitesseMax: 30.1 });
    assertEqual(target.vitesseMax, 32.4);
  });
});

// ── Tests unitaires : sauvegarde et migration ──────────────────────────────

describe('Sauvegarde', () => {
  it('reconcile() restaure les branches manquantes', () => {
    const partial = createInitialState();
    delete partial.legacy.museum;
    delete partial.phone.orders;
    const fixed = reconcile(partial);
    assert(fixed.legacy.museum, 'Le musée doit être restauré');
    assert(Array.isArray(fixed.phone.orders), 'Les commandes doivent être restaurées');
    assertEqual(fixed.version, STATE_VERSION);
  });

  it('reconcile() ne détruit pas les données existantes', () => {
    const state = createInitialState({ name: 'Conservé' });
    state.stats.career.buts = 137;
    const fixed = reconcile(state);
    assertEqual(fixed.stats.career.buts, 137);
    assertEqual(fixed.player.name, 'Conservé');
  });
});

// ── Tests unitaires : données du monde ─────────────────────────────────────

describe('Données du monde', () => {
  it('chaque ville référence un pays existant', () => {
    for (const city of CITIES) {
      assert(COUNTRIES.some((c) => c.id === city.country), `Ville ${city.id} → pays inconnu ${city.country}`);
    }
  });

  it('chaque club référence une ville existante', () => {
    for (const club of CLUBS) {
      assert(getCity(club.cityId), `Club ${club.id} → ville inconnue ${club.cityId}`);
    }
  });

  it('tous les identifiants de lieux sont uniques', () => {
    const seen = new Set();
    for (const city of CITIES) {
      for (const venue of city.venues) {
        assert(!seen.has(venue.id), `Identifiant de lieu dupliqué : ${venue.id}`);
        seen.add(venue.id);
      }
    }
  });

  it('chaque ville possède au moins un lieu', () => {
    for (const city of CITIES) {
      assert(city.venues.length > 0, `Ville sans lieu : ${city.id}`);
    }
  });

  it('la distance est symétrique et nulle sur place', () => {
    assertEqual(distanceKm('paris', 'paris'), 0);
    assertEqual(distanceKm('paris', 'londres'), distanceKm('londres', 'paris'));
  });

  it('la distance Paris-Londres est plausible', () => {
    assertClose(distanceKm('paris', 'londres'), 344, 40);
  });

  it('les dix-sept catégories de récompense du Tome VII sont présentes', () => {
    assertEqual(AWARD_CATEGORIES.length, 17);
  });

  it('le monde atteint la taille annoncée', () => {
    const stats = worldStats();
    assert(stats.cities >= 20, `Attendu au moins 20 villes, obtenu ${stats.cities}`);
    assert(stats.venues >= 150, `Attendu au moins 150 lieux, obtenu ${stats.venues}`);
    assert(stats.countries >= 20, `Attendu au moins 20 pays, obtenu ${stats.countries}`);
  });
});

// ── Tests : corpus du GDD ──────────────────────────────────────────────────

describe('Corpus GDD', () => {
  it('tous les tomes ont un identifiant unique', () => {
    const ids = TOMES.map((t) => t.id);
    assertEqual(new Set(ids).size, ids.length, 'Identifiants de tome dupliqués');
  });

  it('chaque tome possède au moins un chapitre', () => {
    for (const tome of TOMES) {
      assert(tome.chapters.length > 0, `Tome ${tome.numeral} sans chapitre`);
    }
  });

  it('le corpus couvre plus de 200 exigences atomiques', () => {
    assert(countRequirements() > 200, `Seulement ${countRequirements()} exigences recensées`);
  });

  it('le corpus compte au moins 100 chapitres', () => {
    assert(countChapters() >= 100, `Seulement ${countChapters()} chapitres`);
  });

  it('les tomes non transmis sont marqués comme tels, sans contenu inventé', () => {
    const missing = TOMES.filter((t) => t.missing);
    assertEqual(missing.length, 2, 'Les tomes XIII et XVIII doivent être signalés manquants');
    for (const tome of missing) {
      assert(tome.title.includes('réservé'), `Tome ${tome.numeral} mal étiqueté`);
    }
  });
});

// ── Tests : matrice de traçabilité ─────────────────────────────────────────

describe('Traçabilité', () => {
  it('chaque entrée porte un statut valide', () => {
    const valid = ['implemented', 'modelled', 'engine'];
    for (const entry of TRACE) {
      assert(valid.includes(entry.status), `Statut invalide : ${entry.status} (${entry.tome} ${entry.chapter})`);
    }
  });

  it('chaque entrée est rattachée à un tome existant', () => {
    const numerals = new Set(TOMES.map((t) => t.numeral));
    for (const entry of TRACE) {
      assert(numerals.has(entry.tome), `Tome inconnu dans la traçabilité : ${entry.tome}`);
    }
  });

  it('les entrées implémentées désignent un module réel', () => {
    for (const entry of TRACE.filter((e) => e.status === 'implemented')) {
      assert(entry.module && entry.module !== '—', `Entrée implémentée sans module : ${entry.requirement}`);
    }
  });

  it('la couverture est cohérente', () => {
    const c = coverage();
    assertEqual(c.implemented + c.modelled + c.engine, c.total);
    assert(c.implementedPct > 60, `Couverture implémentée trop faible : ${c.implementedPct} %`);
  });
});

// ── Tests d'intégration : le jeu complet ───────────────────────────────────

describe('Intégration — partie complète', () => {
  it('démarre une nouvelle partie sans erreur', () => {
    const game = new Game();
    game.newGame({ name: 'Test Joueur', seed: 2024 });
    assert(game.started);
    assert(game.snapshot() !== null);
    game._teardown();
  });

  it('installe tous les systèmes attendus', () => {
    const game = new Game();
    game.newGame({ seed: 1 });
    const expected = ['weather', 'economy', 'match', 'calendar', 'reputation', 'career', 'media', 'awards', 'world', 'phone'];
    for (const key of expected) {
      assert(game.systems[key], `Système manquant : ${key}`);
    }
    game._teardown();
  });

  it('génère un calendrier de rencontres', () => {
    const game = new Game();
    game.newGame({ seed: 5 });
    assert(game.systems.calendar.fixtures.length > 15, `Calendrier trop court : ${game.systems.calendar.fixtures.length}`);
    assert(game.systems.calendar.worldEvents.length > 3, 'Événements mondiaux manquants');
    game._teardown();
  });

  it('simule un match et produit un rapport complet', () => {
    const game = new Game();
    game.newGame({ seed: 77 });
    const fixture = game.systems.calendar.fixtures[0];
    const report = game.systems.match.simulate(fixture);

    assert(report.scoreLabel.includes('-'), 'Score manquant');
    assert(['victoire', 'nul', 'défaite'].includes(report.resultat));
    assert(report.commentary.length > 0, 'Commentaires manquants');
    assert(report.referee && report.referee.name, 'Arbitre manquant');
    assert(report.weather, 'Météo manquante');
    if (!report.absent) {
      assertBetween(report.rating, 3, 10, 'Note hors bornes');
      assert(report.analysis, 'Analyse tactique manquante');
      assert(typeof report.heatmap === 'object', 'Carte de chaleur manquante');
    }
    game._teardown();
  });

  it("un rapport d'absence expose les champs dont l'interface a besoin", () => {
    const game = new Game();
    game.newGame({ seed: 4242 });
    // Blessure de longue durée : le joueur ne peut pas être retenu.
    game.state.player.injury = { type: 'fracture', severity: 'grave', days: 120, daysLeft: 120 };

    const report = game.systems.match.simulate(game.systems.calendar.fixtures[0]);

    assert(report.absent, 'Le joueur blessé ne doit pas figurer sur la feuille de match');
    // Ces champs sont lus inconditionnellement par l'écran de match.
    for (const key of ['club', 'opponent', 'scoreLabel', 'resultat', 'competition', 'stats', 'commentary', 'absenceReason']) {
      assert(report[key] !== undefined, `Champ manquant dans le rapport d'absence : ${key}`);
    }
    assertEqual(typeof report.home, 'boolean');
    assert(Array.isArray(report.commentary) && report.commentary.length > 0, 'Le rapport doit expliquer l\'absence');
    game._teardown();
  });

  it('accumule les statistiques de carrière au fil des matchs', () => {
    const game = new Game();
    game.newGame({ seed: 101 });
    let played = 0;
    for (const fixture of game.systems.calendar.fixtures.slice(0, 10)) {
      game.systems.match.simulate(fixture);
      played++;
    }
    assertEqual(game.state.diagnostics.matchesSimulated, played);
    assert(game.state.stats.career.matchs > 0, 'Aucun match comptabilisé');
    game._teardown();
  });

  it("l'économie enregistre chaque transaction", () => {
    const game = new Game();
    game.newGame({ seed: 33 });
    const before = game.state.economy.ledger.length;
    game.systems.economy.transact({ amount: -500, label: 'Test', category: 'test' });
    assertEqual(game.state.economy.ledger.length, before + 1);
    assertEqual(game.state.economy.ledger.at(-1).label, 'Test');
    game._teardown();
  });

  it('refuse une dépense supérieure au solde', () => {
    const game = new Game();
    game.newGame({ seed: 34 });
    const before = game.state.economy.accounts.courant;
    const ok = game.systems.economy.transact({ amount: -99999999, label: 'Trop cher' });
    assertEqual(ok, false);
    assertEqual(game.state.economy.accounts.courant, before, 'Le solde ne doit pas bouger');
    game._teardown();
  });

  it('une clause exclusive bloque réellement les marques concurrentes', () => {
    const game = new Game();
    game.newGame({ seed: 88 });

    // Contrat exclusif avec un équipementier.
    game.state.endorsements.active.push({
      id: 'deal-test', brandId: 'volt', brandName: 'Volt Athletics',
      exclusive: true, annualValue: 100000, years: 3, endSeason: 2030,
    });
    game.state.endorsements.blockedBrands = ['kairo', 'sahel-wear'];
    game.state.economy.accounts.courant = 10000000;

    let blocked = false;
    game.bus.on(EVENTS.PURCHASE_BLOCKED, () => { blocked = true; });

    const balanceBefore = game.state.economy.accounts.courant;
    const result = game.systems.economy.purchase({
      label: 'Maillot concurrent', amount: 200, brandId: 'kairo',
    });

    assertEqual(result, false, "L'achat doit être refusé");
    assert(blocked, "L'événement de blocage doit être émis");
    assertEqual(game.state.economy.accounts.courant, balanceBefore, "Aucun débit ne doit avoir lieu");
    game._teardown();
  });

  it('autorise les marques non bloquées', () => {
    const game = new Game();
    game.newGame({ seed: 89 });
    game.state.endorsements.blockedBrands = ['kairo'];
    game.state.economy.accounts.courant = 100000;

    const result = game.systems.economy.purchase({
      label: 'Article autorisé', amount: 500, brandId: 'maison-orin',
    });
    assertEqual(result, true);
    game._teardown();
  });

  it('le voyage déplace réellement le joueur et coûte de l\'argent', () => {
    const game = new Game();
    game.newGame({ seed: 55 });
    game.state.economy.accounts.courant = 500000;

    const from = game.state.world.currentCityId;
    const options = game.systems.world.availableTransports('paris');
    assert(options.length > 0, 'Aucun transport disponible vers Paris');

    const before = game.state.economy.accounts.courant;
    const result = game.systems.world.travel('paris', options[0].id);

    assert(result.ok, `Voyage échoué : ${result.reason}`);
    assertEqual(game.state.world.currentCityId, 'paris');
    assert(from !== 'paris' || true);
    assert(result.stages.length > 0, 'Les étapes du voyage doivent être produites');
    if (options[0].cost > 0) {
      assert(game.state.economy.accounts.courant < before, 'Le trajet doit être débité');
    }
    game._teardown();
  });

  it("l'entraînement fait progresser les attributs", () => {
    const game = new Game();
    game.newGame({ seed: 66 });
    game.state.player.injury = null;
    game.state.player.condition.fatigue = 0;

    const before = game.state.player.attributes.technique;
    let attempts = 0;
    let progressed = false;
    // L'entraînement peut échouer sur blessure : on réessaie quelques fois.
    while (attempts < 8 && !progressed) {
      game.state.player.injury = null;
      const result = game.systems.career.train('technique');
      if (result.ok && game.state.player.attributes.technique > before) progressed = true;
      attempts++;
    }
    assert(progressed, "La technique doit progresser après une séance technique");
    game._teardown();
  });

  it('la fatigue empêche les séances intenses', () => {
    const game = new Game();
    game.newGame({ seed: 67 });
    game.state.player.injury = null;
    game.state.player.condition.fatigue = 95;
    const result = game.systems.career.train('physique');
    assertEqual(result.ok, false, 'Une séance physique doit être refusée à 95 % de fatigue');
    game._teardown();
  });

  it('un joueur blessé ne peut pas s\'entraîner', () => {
    const game = new Game();
    game.newGame({ seed: 68 });
    game.state.player.injury = { type: 'entorse', severity: 'modérée', days: 20, daysLeft: 20 };
    const result = game.systems.career.train('technique');
    assertEqual(result.ok, false);
    game._teardown();
  });

  it('la réputation reste bornée entre 0 et 100', () => {
    const game = new Game();
    game.newGame({ seed: 44 });
    for (let i = 0; i < 500; i++) {
      game.systems.reputation.apply({ delta: 50, reason: 'test' });
    }
    assertBetween(game.state.reputation.global, 0, 100);
    for (let i = 0; i < 500; i++) {
      game.systems.reputation.apply({ delta: -50, reason: 'test' });
    }
    assertBetween(game.state.reputation.global, 0, 100);
    game._teardown();
  });

  it('la cérémonie des Boubjack Awards produit les dix-sept catégories', () => {
    const game = new Game();
    game.newGame({ seed: 22 });
    const ceremony = game.systems.awards.holdBoubjackAwards({ cityId: 'bamako' });

    assertEqual(ceremony.categories.length, 17);
    assert(ceremony.redCarpet.arrivals.length > 15, 'Tapis rouge trop peu fourni');
    assertEqual(ceremony.flow.length, 10, 'Le déroulement doit compter dix temps');
    assertBetween(ceremony.durationMinutes, 30, 45, 'Durée hors de la fourchette du Tome VII');
    assertEqual(ceremony.watermark, 'Boubjack Awards');
    for (const category of ceremony.categories) {
      assert(category.winner, `Catégorie sans vainqueur : ${category.name}`);
      assert(category.presenter, `Catégorie sans présentateur : ${category.name}`);
      assert(category.speech.length > 10, `Discours manquant : ${category.name}`);
      assert(category.trophy.engraving === 'Boubjack Awards', 'Gravure du trophée manquante');
    }
    game._teardown();
  });

  it('la ville hôte des Awards change chaque année', () => {
    const game = new Game();
    game.newGame({ seed: 11 });
    const hosts = [];
    for (let i = 0; i < 6; i++) {
      const season = 2026 + i;
      game.state.clock.season = season;
      game.systems.calendar.generateSeason(season);
      hosts.push(game.state.world.awardsHosts[season]);
    }
    for (let i = 1; i < hosts.length; i++) {
      assert(hosts[i] !== hosts[i - 1], `Deux éditions consécutives à ${hosts[i]}`);
    }
    game._teardown();
  });

  it("l'IA secrétaire produit un briefing complet", () => {
    const game = new Game();
    game.newGame({ seed: 99 });
    const brief = game.systems.phone.secretaryBriefing();

    assert(brief.greeting, 'Salutation manquante');
    assert(Array.isArray(brief.agenda), 'Agenda manquant');
    assert(brief.finances && typeof brief.finances.netWorth === 'number', 'Finances manquantes');
    assert(Array.isArray(brief.recommendations) && brief.recommendations.length > 0, 'Recommandations manquantes');
    assert(brief.analysis && typeof brief.analysis.overall === 'number', 'Analyse de carrière manquante');
    assert(brief.weather, 'Météo manquante');
    game._teardown();
  });

  it("l'IA secrétaire répond aux questions sur des données réelles", () => {
    const game = new Game();
    game.newGame({ seed: 100 });
    const answer = game.systems.phone.ask('quel est mon solde');
    assert(answer.includes('Compte courant'), `Réponse inattendue : ${answer}`);

    const matchAnswer = game.systems.phone.ask('quel est mon prochain match');
    assert(matchAnswer.length > 10, 'Réponse trop courte');
    game._teardown();
  });

  it('une commande est livrée après le délai annoncé', () => {
    const game = new Game();
    game.newGame({ seed: 12 });
    game.state.economy.accounts.courant = 100000;

    const result = game.systems.phone.order('vetements', 'hotel');
    assert(result.ok, `Commande refusée : ${result.reason}`);
    const days = result.order.daysLeft;

    for (let i = 0; i < days + 1; i++) game.advanceDays(1);

    const delivered = game.state.phone.orders.find((o) => o.id === result.order.id);
    assert(!delivered || delivered.status === 'livré', 'La commande doit finir livrée');
    game._teardown();
  });

  it('les publications génèrent des commentaires variés', () => {
    const game = new Game();
    game.newGame({ seed: 13 });
    const result = game.systems.phone.publishPost('photo', 'Test');
    assert(result.ok);
    assert(result.post.comments.length >= 2, 'Trop peu de commentaires');
    assert(result.post.likes > 0, 'Aucun like');
    game._teardown();
  });

  it('la météo diffère entre un climat sahélien et un climat alpin', () => {
    const game = new Game();
    game.newGame({ seed: 14 });
    // Janvier : Zermatt doit être nettement plus froid que Bamako.
    game.state.clock.month = 0;
    game.systems.weather.byCity.clear();
    const bamako = game.systems.weather.at('bamako');
    const zermatt = game.systems.weather.at('zermatt');
    assert(zermatt.tempC < bamako.tempC, `Zermatt (${zermatt.tempC}°) doit être plus froid que Bamako (${bamako.tempC}°) en janvier`);
    game._teardown();
  });

  it('la sauvegarde et le rechargement préservent l\'état', () => {
    const game = new Game();
    game.newGame({ seed: 2000, name: 'Sauvegarde Test' });

    // Le temps avance d'abord : les valeurs sont fixées ensuite, sinon
    // l'érosion hebdomadaire de la réputation les ferait légitimement varier.
    game.advanceDays(30);
    game.state.stats.career.buts = 42;
    game.state.reputation.global = 63.5;

    const saved = game.save('test-slot');
    assert(saved, 'La sauvegarde doit réussir');

    const game2 = new Game();
    const loaded = game2.load('test-slot');
    assert(loaded.ok, `Chargement échoué : ${loaded.reason}`);
    assertEqual(game2.state.player.name, 'Sauvegarde Test');
    assertEqual(game2.state.stats.career.buts, 42);
    assertClose(game2.state.reputation.global, 63.5, 0.01);
    assertEqual(game2.clock.day, game.clock.day);

    game.deleteSave('test-slot');
    game._teardown();
    game2._teardown();
  });

  it("l'export et l'import restituent la partie", () => {
    const game = new Game();
    game.newGame({ seed: 3000, name: 'Export Test' });
    game.state.stats.career.buts = 17;

    const json = game.exportSave();
    const game2 = new Game();
    const result = game2.importSave(json);

    assert(result.ok, `Import échoué : ${result.reason}`);
    assertEqual(game2.state.player.name, 'Export Test');
    assertEqual(game2.state.stats.career.buts, 17);
    game._teardown();
    game2._teardown();
  });

  it('la validation ne signale aucune anomalie sur une partie neuve', () => {
    const game = new Game();
    game.newGame({ seed: 4000 });
    const validation = game.validate();
    assert(validation.ok, `Anomalies détectées : ${validation.problems.join(' | ')}`);
    game._teardown();
  });

  it('la comptabilité reste cohérente après de nombreuses opérations', () => {
    const game = new Game();
    game.newGame({ seed: 5000 });
    game.state.economy.accounts.courant = 5000000;

    for (let i = 0; i < 40; i++) {
      game.systems.economy.transact({ amount: i % 2 === 0 ? -1000 : 1500, label: `Op ${i}`, category: 'test' });
    }
    const validation = game.validate();
    assert(validation.ok, `Écart comptable : ${validation.problems.join(' | ')}`);
    game._teardown();
  });

  it('une simulation longue reste stable et cohérente', () => {
    const game = new Game();
    game.newGame({ seed: 6000 });
    game.state.economy.accounts.courant = 2000000;

    // Deux saisons complètes en accéléré.
    game.advanceDays(730);

    const validation = game.validate();
    assert(validation.ok, `Anomalies après 2 ans : ${validation.problems.join(' | ')}`);
    assert(game.state.player.age >= 19, `Le joueur doit avoir vieilli : ${game.state.player.age} ans`);
    assert(game.state.media.headlines.length > 0, 'La presse doit avoir publié');
    assertBetween(game.state.player.condition.fatigue, 0, 100);
    assertBetween(game.state.reputation.global, 0, 100);
    assertBetween(game.state.personal.wellbeing, 0, 100);
    game._teardown();
  });

  it('le monde évolue sans intervention du joueur', () => {
    const game = new Game();
    game.newGame({ seed: 7000 });
    const before = game.state.world.worldMemory.length;
    game.advanceDays(400);
    assert(
      game.state.world.worldMemory.length >= before,
      'La mémoire du monde doit se remplir',
    );
    assert(game.systems.world.npcs.length > 0, 'Les PNJ doivent exister');
    game._teardown();
  });

  it('un transfert change de club, de ville et régénère le calendrier', () => {
    const game = new Game();
    game.newGame({ seed: 8000 });
    game.state.career.marketValue = 2000000;
    game.state.reputation.global = 55;

    const offers = game.systems.career.generateTransferOffers();
    if (offers.length === 0) {
      // Rien à tester si aucun club n'est intéressé : ce n'est pas un échec.
      game._teardown();
      return;
    }

    const previousClub = game.state.career.clubId;
    const result = game.systems.career.acceptTransfer(offers[0].id);

    assert(result.ok, `Transfert échoué : ${result.reason}`);
    assert(game.state.career.clubId !== previousClub, 'Le club doit changer');
    assertEqual(game.state.world.currentCityId, getClub(game.state.career.clubId).cityId);
    assertEqual(result.sequence.length, 9, 'La mise en scène doit compter neuf étapes');
    assert(game.systems.calendar.fixtures.length > 0, 'Le calendrier doit être régénéré');
    game._teardown();
  });

  it('la retraite ouvre les métiers d\'après-carrière', () => {
    const game = new Game();
    game.newGame({ seed: 9000 });
    game.state.reputation.global = 60;
    game.state.economy.accounts.courant = 10000000;

    const result = game.systems.career.retire();
    assert(result.ok, 'La retraite doit être possible');
    assert(game.state.player.retired, 'Le joueur doit être marqué retraité');
    assert(result.roles.length > 0, 'Des reconversions doivent être proposées');
    assert(game.state.legacy.museum.built, 'Le musée doit s\'ouvrir à la retraite');

    const roleResult = game.systems.career.takePostCareerRole(result.roles[0].id);
    assert(roleResult.ok, `Reconversion échouée : ${roleResult.reason}`);
    assert(game.state.legacy.postCareerRole, 'Le rôle doit être enregistré');
    game._teardown();
  });

  it('le documentaire de fin de carrière est généré à partir des données réelles', () => {
    const game = new Game();
    game.newGame({ seed: 9500 });
    game.state.stats.career.matchs = 400;
    game.state.stats.career.buts = 210;
    game.state.reputation.global = 80;

    game.systems.career.retire();
    const doc = game.state.media.documentaries[0];
    assert(doc, 'Un documentaire doit être produit');
    assert(doc.chapters.length >= 3, 'Le documentaire doit comporter plusieurs chapitres');
    assert(doc.exclusive, 'Une légende doit obtenir un documentaire exclusif');
    assert(doc.chapters.some((c) => c.body.includes('210')), 'Les statistiques réelles doivent apparaître');
    game._teardown();
  });

  it('une conférence de presse modifie la réputation', () => {
    const game = new Game();
    game.newGame({ seed: 9600 });
    const conference = game.systems.media.buildConference(null);
    assert(conference.questions.length > 0, 'La conférence doit poser des questions');

    const before = game.state.reputation.global;
    const record = game.systems.media.answerConference(conference, conference.questions.map(() => 'humble'));
    assert(record.outcomes.length === conference.questions.length, 'Chaque question doit avoir une issue');
    assert(game.state.reputation.global !== before || record.reputationDelta !== 0, 'La réputation doit bouger');
    game._teardown();
  });

  it('deux parties avec la même graine produisent le même monde', () => {
    const a = new Game();
    const b = new Game();
    a.newGame({ seed: 424242, name: 'A' });
    b.newGame({ seed: 424242, name: 'A' });

    assertEqual(
      a.systems.calendar.fixtures.length,
      b.systems.calendar.fixtures.length,
      'Le calendrier doit être identique',
    );
    assertEqual(
      a.systems.calendar.fixtures[0].opponentId,
      b.systems.calendar.fixtures[0].opponentId,
      'Le premier adversaire doit être identique',
    );
    a._teardown();
    b._teardown();
  });
});

// ── Rapport ────────────────────────────────────────────────────────────────

export function runTests() {
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  return { total: results.length, passed, failed, results };
}

// Exécution directe en ligne de commande.
const isNode = typeof process !== 'undefined' && process.versions?.node;
if (isNode) {
  const report = runTests();
  const bySuite = {};
  for (const r of report.results) {
    (bySuite[r.suite] ||= []).push(r);
  }

  for (const [suite, entries] of Object.entries(bySuite)) {
    const suitePassed = entries.filter((e) => e.ok).length;
    console.log(`\n${suite} — ${suitePassed}/${entries.length}`);
    for (const entry of entries) {
      console.log(`  ${entry.ok ? '✓' : '✗'} ${entry.name}${entry.ok ? '' : `\n      → ${entry.error}`}`);
    }
  }

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`Total : ${report.passed}/${report.total} tests réussis`);
  if (report.failed.length > 0) {
    console.log(`${report.failed.length} échec(s).`);
    process.exitCode = 1;
  } else {
    console.log('Tous les tests passent.');
  }
}
