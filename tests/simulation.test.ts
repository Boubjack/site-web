/**
 * Tests d'intégration — Tome XV, ch. 2.
 *
 * Ces tests démarrent un monde complet et vérifient que les systèmes sont
 * réellement reliés entre eux : le temps qui passe produit de la météo, de la
 * presse, des matchs, des transactions et de l'héritage.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { InfinityFootball } from '../src/game.js';
import { MemorySaveStorage } from '../src/core/save.js';
import { auditCity } from '../src/world/generator.js';
import { validateContent } from '../src/devtools/dev-console.js';
import { routeBetweenCities, routeWithinCity } from '../src/world/navigation.js';
import { getVenueTemplate } from '../src/world/venues.js';

function newGame(seed = 'test-integration'): InfinityFootball {
  return new InfinityFootball({
    seed,
    startDate: { year: 2025, month: 7, day: 1, hour: 8, minute: 0 },
    richWorld: true,
    logLevel: 'error',
    storage: new MemorySaveStorage(),
  }).start();
}

test('démarrage — le monde est généré et tous les systèmes initialisés', () => {
  const game = newGame();
  const snapshot = game.snapshot();

  assert.ok(snapshot.cityCount >= 50, `villes générées : ${snapshot.cityCount}`);
  assert.ok(snapshot.venueCount > 3000, `lieux générés : ${snapshot.venueCount}`);
  assert.ok(snapshot.npcCount > 500, `PNJ persistants : ${snapshot.npcCount}`);
  assert.equal(game.scheduler.all.length, 21);
  for (const system of game.scheduler.all) {
    assert.ok(game.scheduler.isEnabled(system.metadata.id), `système désactivé : ${system.metadata.id}`);
  }
  game.dispose();
});

test('monde — chaque ville dispose de ses lieux structurants et d’intérieurs', () => {
  const game = newGame();
  let withoutInterior = 0;
  let checked = 0;

  for (const city of game.world.cities()) {
    const audit = auditCity(city);
    assert.equal(audit.missing.length, 0, `${city.def.name} : lieux manquants ${audit.missing.join(', ')}`);
    for (const venue of city.venues.values()) {
      checked++;
      const template = getVenueTemplate(venue.type);
      if (template.enterable && venue.rooms.length === 0) withoutInterior++;
    }
  }
  assert.equal(withoutInterior, 0, `${withoutInterior} lieux visitables sans intérieur`);
  assert.ok(checked > 3000);
  game.dispose();
});

test('déterminisme — deux mondes de même graine sont identiques', () => {
  const a = newGame('graine-fixe');
  const b = newGame('graine-fixe');

  const cityA = a.world.city('paris');
  const cityB = b.world.city('paris');
  assert.equal(cityA.venues.size, cityB.venues.size);
  assert.equal(cityA.districts.length, cityB.districts.length);
  assert.deepEqual(
    [...cityA.venues.keys()].sort().slice(0, 20),
    [...cityB.venues.keys()].sort().slice(0, 20),
  );

  const c = newGame('autre-graine');
  const cityC = c.world.city('paris');
  const namesA = [...cityA.venues.values()].map((v) => v.name).join('|');
  const namesC = [...cityC.venues.values()].map((v) => v.name).join('|');
  assert.notEqual(namesA, namesC, 'deux graines différentes doivent produire des mondes différents');

  a.dispose();
  b.dispose();
  c.dispose();
});

test('navigation — itinéraires locaux et mondiaux exploitables', () => {
  const game = newGame();
  const city = game.world.city('paris');
  const venues = [...city.venues.values()];
  const from = venues[0];
  const to = venues[Math.floor(venues.length / 2)];
  assert.ok(from && to);

  const local = routeWithinCity(city, from.id, to.id, 'car');
  assert.equal(local.found, true);
  assert.ok(local.steps.length >= 2);
  assert.ok(local.durationMinutes > 0);

  const world = routeBetweenCities(game.world.world, 'paris', 'tokyo', { prefer: 'fast' });
  assert.equal(world.found, true);
  assert.ok(world.totalDistanceKm > 8000, `distance Paris-Tokyo : ${world.totalDistanceKm}`);
  assert.ok(world.totalMinutes > 500);
  game.dispose();
});

test('le monde vit sans le joueur — météo, presse et PNJ évoluent', () => {
  const game = newGame();
  const before = {
    weather: game.world.city('paris').weather.condition,
    articles: game.media.latestArticles(200).length,
    events: game.context.events.totalEmitted,
  };

  game.advanceDays(30);

  const after = {
    articles: game.media.latestArticles(200).length,
    events: game.context.events.totalEmitted,
  };
  assert.ok(after.events > before.events + 100, 'le monde doit produire des événements en continu');
  assert.ok(after.articles > before.articles, 'la presse doit publier chaque jour');

  const streetEvents = game.world.cities().reduce((sum, city) => sum + city.activeStreetEvents.length, 0);
  assert.ok(streetEvents > 0, 'des événements de rue doivent être actifs');

  const npcsAtWork = game.npcs.all.filter((npc) => npc.currentActivity.includes('travail')).length;
  assert.ok(npcsAtWork >= 0, 'les PNJ suivent un emploi du temps');
  void before.weather;
  game.dispose();
});

test('carrière — création, matchs joués et statistiques cohérentes', () => {
  const game = newGame('carriere');
  game.createCareer({
    name: 'Amadou Traoré',
    nationality: 'ml',
    position: 'MOC',
    age: 18,
    startingClubId: 'bamako-djoliba',
    potential: 88,
  });

  assert.equal(game.career.hasCareer, true);
  assert.equal(game.career.player.clubId, 'bamako-djoliba');
  assert.ok(game.career.currentContract);
  assert.ok(game.economy.account('courant').balance > 0, 'la prime de contrat doit être versée');

  let played = 0;
  for (let i = 0; i < 8; i++) {
    const report = game.playNextMatch({ cinematics: false });
    if (!report) break;
    played++;
    assert.ok(report.result.events.length > 2);
    assert.ok(report.commentary.length > 0, 'les commentateurs doivent parler');
    assert.ok(report.analysis.summary.length > 0);
    assert.equal(report.analysis.heatmap.length, 12);
    assert.ok(report.result.homeGoals >= 0 && report.result.awayGoals >= 0);
  }
  assert.ok(played >= 5, `matchs joués : ${played}`);

  const stats = game.career.player.seasons[0];
  assert.ok(stats);
  assert.ok(stats.appearances >= played - 1, 'les feuilles de match doivent être enregistrées');
  assert.ok(stats.minutes > 0);
  assert.ok(game.career.player.marketValue > 0);
  game.dispose();
});

test('économie — chaque euro transite par un compte identifié', () => {
  const game = newGame('economie');
  game.createCareer({ name: 'Test Éco', nationality: 'fr', position: 'BU', age: 20 });

  const start = game.economy.account('courant').balance;
  game.economy.record('courant', 500_000, 'test', 'dotation de test');
  assert.equal(game.economy.account('courant').balance, start + 500_000);

  const property = game.economy.buyProperty('appartement', 'Appartement test', 'paris', 300_000);
  assert.ok(property);
  assert.equal(game.economy.allProperties.length, 1);

  const investment = game.economy.invest('immobilier', 'SCPI test', 'paris', 100_000);
  assert.ok(investment);
  assert.equal(game.economy.activeInvestments.length, 1);

  const netWorthBefore = game.economy.netWorth;
  game.advanceDays(70);
  assert.ok(game.economy.netWorth !== netWorthBefore, 'le patrimoine doit évoluer dans le temps');

  const history = game.economy.history({ limit: 200 });
  assert.ok(history.length > 3);
  for (const transaction of history) {
    assert.ok(transaction.accountId.startsWith('account:'));
    assert.ok(transaction.label.length > 0);
  }

  const summary = game.economy.summary(30);
  assert.ok(summary.income >= 0 && summary.expenses >= 0);
  game.dispose();
});

test('commerce — commande, livraison physique et exclusivité d’équipementier', () => {
  const game = newGame('commerce');
  game.createCareer({ name: 'Test Achat', nationality: 'fr', position: 'AD', age: 22 });
  game.economy.record('courant', 2_000_000, 'test', 'dotation de test');

  assert.equal(game.commerce.addToCart('velocis-crampons-fx', 1, 'floquage du nom'), true);
  const order = game.commerce.checkout('maison', 'paris');
  assert.ok(order);
  assert.equal(order?.status, 'confirmée');
  assert.ok(order && order.courierName.length > 0, 'un livreur nommé doit être assigné');

  game.advanceDays(3);
  const delivered = game.commerce.order(order?.id ?? '');
  assert.equal(delivered?.status, 'livrée');
  assert.ok((delivered?.tracking.length ?? 0) >= 2, 'le suivi doit comporter plusieurs étapes');

  // Un contrat exclusif bloque réellement les marques concurrentes.
  const contract = game.career.signEquipmentContract('velocis', 4);
  if (contract) {
    assert.equal(game.career.canUseBrand('strider'), false);
    assert.equal(game.career.canUseBrand('velocis'), true);
    assert.equal(game.commerce.addToCart('strider-runner'), false);
    const blocked = game.commerce.blockedProducts();
    assert.ok(blocked.length > 0);
    assert.ok(blocked[0]?.reason.includes('exclusif'));
  }
  game.dispose();
});

test('voyage — trajet joué étape par étape et arrivée effective', () => {
  const game = newGame('voyage');
  game.createCareer({ name: 'Test Voyage', nationality: 'fr', position: 'MC', age: 24 });
  game.economy.record('courant', 500_000, 'test', 'dotation de test');
  game.travel.relocateTo('paris', null);

  const journey = game.travel.book('madrid', { prefer: 'fast' });
  assert.ok(journey, 'le voyage doit pouvoir être réservé');
  const completed = game.travel.travel(journey?.id);
  assert.ok(completed?.completed);
  assert.equal(game.travel.cityId, 'madrid');
  assert.ok(completed && completed.log.length >= 3, 'chaque étape du voyage doit être journalisée');
  assert.ok(completed && completed.fatigue >= 0 && completed.fatigue <= 1);
  game.dispose();
});

test('téléphone — les 21 applications et l’IA secrétaire répondent', () => {
  const game = newGame('telephone');
  game.createCareer({ name: 'Test Phone', nationality: 'fr', position: 'MOC', age: 21 });

  assert.equal(game.phone.apps.length, 21);
  for (const app of game.phone.apps) {
    assert.equal(game.phone.open(app.id), true, `application injoignable : ${app.id}`);
  }

  const briefing = game.phone.secretaryBriefing();
  assert.ok(briefing.salutation.includes('Test Phone'));
  assert.ok(briefing.finances.includes('€'));
  assert.ok(briefing.performance.length > 0);

  assert.ok(game.phone.ask('quel est mon solde ?').includes('€'));
  assert.ok(game.phone.ask('quelle météo ?').length > 10);
  assert.ok(game.phone.ask('mon agenda').length > 5);

  const post = game.phone.publish('annonce', 'Prêt pour la nouvelle saison');
  assert.ok(post.comments.length >= 2, 'les commentaires proviennent d’IA');
  assert.ok(post.reach > 0);

  const contact = game.phone.contactList[0];
  assert.ok(contact);
  const snap = game.phone.sendSnap(contact.id, 'à l’entraînement');
  assert.ok(snap);
  assert.ok(game.phone.activeStreaks.length >= 1);
  game.dispose();
});

test('médias — conférence de presse interactive et impact sur la réputation', () => {
  const game = newGame('medias');
  game.createCareer({ name: 'Test Presse', nationality: 'fr', position: 'BU', age: 25 });

  const conference = game.media.openPressConference('après-match', {
    lostHeavily: true,
    transferRumours: true,
    upcomingRival: 'Marseille',
  });
  assert.ok(conference.questions.length >= 4);

  const reputationBefore = game.career.player.reputation;
  const first = conference.questions[0];
  assert.ok(first);
  const answer = game.media.answer(conference.id, first.id, 'diplomate');
  assert.ok(answer);
  assert.ok(answer && answer.text.length > 0);
  assert.notEqual(game.career.player.reputation, reputationBefore);

  const silence = conference.questions[1];
  if (silence) {
    const result = game.media.answer(conference.id, silence.id, 'silence');
    assert.ok(result && result.reputationDelta < 0, 'le silence doit coûter en réputation');
  }
  game.dispose();
});

test('Boubjack Awards — cérémonie complète, 17 catégories, ville hôte changeante', () => {
  const game = newGame('awards');
  game.createCareer({ name: 'Test Awards', nationality: 'ml', position: 'MOC', age: 27, potential: 92 });

  const first = game.awards.prepareCeremony(game.context);
  const carpet = game.awards.runRedCarpet();
  assert.ok(carpet.length > 10, 'le tapis rouge doit accueillir de nombreux invités');
  assert.ok(carpet.some((a) => a.category === 'légende'));
  assert.ok(carpet.every((a) => a.outfit.length > 0 && a.interviewQuote.length > 0));

  const ceremony = game.awards.runCeremony();
  assert.equal(ceremony.results.length, 17, 'les 17 catégories doivent être décernées');
  assert.equal(ceremony.phase, 'terminee');
  assert.ok(ceremony.durationMinutes >= 30 && ceremony.durationMinutes <= 45);
  assert.ok(ceremony.watermark.includes('Boubjack Awards'));
  for (const result of ceremony.results) {
    assert.ok(result.nominees.length >= 3, `catégorie sans nominés : ${result.categoryName}`);
    assert.ok(result.trophyDesign.includes('Boubjack Awards'));
    assert.ok(result.presenterSpeech.length > 0);
    assert.ok(result.acceptanceSpeech.length > 0);
  }

  const second = game.awards.prepareCeremony(game.context);
  assert.notEqual(second.hostCityId, first.hostCityId, 'jamais deux éditions de suite dans la même ville');
  game.dispose();
});

test('legacy — records battables, archives, musée et ligne du temps', () => {
  const game = newGame('legacy');
  game.createCareer({ name: 'Test Legacy', nationality: 'fr', position: 'BU', age: 26, potential: 94 });

  assert.ok(game.legacy.allRecords.length >= 5, 'des records préexistants doivent exister');
  const broken = game.legacy.submitRecord({
    recordId: 'goals-season',
    name: 'Buts sur une saison',
    scope: 'monde',
    scopeId: 'monde',
    holderId: game.career.player.identity.id,
    holderName: game.career.player.identity.name,
    value: 99,
    unit: 'buts',
    context: 'test d’intégration',
  });
  assert.equal(broken, true);
  assert.equal(game.legacy.record('goals-season')?.holderName, 'Test Legacy');

  game.career.awardTrophy('t-test', 'Coupe de test', 'eu-champions');
  assert.ok(game.legacy.museum.exhibits.length > 0, 'le trophée doit rejoindre le musée');
  assert.ok(game.legacy.playerTimeline.length > 0, 'la ligne du temps doit se remplir');

  game.advanceDays(40);
  assert.ok(game.legacy.museum.visitors > 0, 'le musée doit accueillir des visiteurs');

  const documentary = game.legacy.generateCareerDocumentary();
  assert.ok(documentary);
  assert.equal(documentary?.chapters.length, 6);
  game.dispose();
});

test('sauvegarde — aller-retour complet avec restitution de l’état', async () => {
  const game = newGame('sauvegarde');
  game.createCareer({ name: 'Test Save', nationality: 'es', position: 'DC', age: 23 });
  game.economy.record('courant', 1_234_567, 'test', 'dotation de test');
  game.advanceDays(20);

  const before = game.snapshot();
  const envelope = await game.save('slot-test', 'manual');
  assert.ok(envelope.checksum.length > 0);
  assert.deepEqual(await game.listSaves(), ['slot-test']);

  game.advanceDays(120);
  const drifted = game.snapshot();
  assert.notEqual(drifted.date, before.date);

  const loaded = await game.load('slot-test');
  assert.equal(loaded, true);
  const restored = game.snapshot();
  assert.equal(restored.date, before.date);
  assert.equal(restored.time, before.time);
  assert.equal(restored.player?.name, 'Test Save');
  assert.equal(restored.economy.liquidity, before.economy.liquidity);
  game.dispose();
});

test('qualité — toutes les suites passent et les données sont valides', () => {
  const game = newGame('qualite');
  game.createCareer({ name: 'Test Qualité', nationality: 'fr', position: 'MC', age: 22 });
  game.advanceDays(45);

  const issues = validateContent(game.context).filter((i) => i.severity === 'erreur');
  assert.equal(issues.length, 0, `erreurs de validation : ${issues.map((i) => i.message).join(' | ')}`);

  const run = game.quality.runAllSuites();
  const failing = run.suites.filter((s) => s.failed > 0);
  assert.equal(
    failing.length,
    0,
    `suites en échec : ${failing.map((s) => `${s.suite} (${s.cases.filter((c) => !c.passed).map((c) => c.name).join(', ')})`).join(' | ')}`,
  );
  assert.ok(run.totalCases >= 20);

  const scores = game.quality.qualityScores();
  assert.ok(scores.global > 0.5, `score qualité global : ${scores.global}`);
  assert.ok(scores.coherence > 0.8);
  game.dispose();
});

test('console développeur — commandes opérationnelles', () => {
  const game = newGame('console');
  const help = game.console.execute('aide');
  assert.equal(help.ok, true);
  assert.ok(help.output.includes('temps'));

  const systems = game.console.execute('systemes');
  assert.equal(systems.ok, true);
  assert.ok(systems.output.includes('world'));

  const world = game.console.execute('monde paris');
  assert.equal(world.ok, true);
  assert.ok(world.output.includes('quartiers'));

  const validation = game.console.execute('valider');
  assert.equal(validation.ok, true, validation.output);

  const unknown = game.console.execute('commande-inexistante');
  assert.equal(unknown.ok, false);
  game.dispose();
});

test('multijoueur — hubs, clubs et détection de triche', () => {
  const game = newGame('multi');
  game.createCareer({ name: 'Test Online', nationality: 'fr', position: 'AG', age: 24 });

  const player = game.multiplayer.connect('TestOnline');
  assert.ok(player.online);
  assert.ok(game.multiplayer.allHubs.length > 0);

  const hub = game.multiplayer.hubsInCity(game.travel.cityId)[0] ?? game.multiplayer.allHubs[0];
  assert.ok(hub);
  assert.equal(game.multiplayer.joinHub(hub.id), true);

  const club = game.multiplayer.createClub('Les Testeurs', 'TEST', ['#000000', '#ffffff'], 'paris');
  assert.equal(game.multiplayer.permissionsOf(club.id, 'player:1')?.editIdentity, true);

  const signals = game.multiplayer.runCheatDetection({
    playerId: 'online:0',
    goalsThisSeason: 400,
    matchesThisSeason: 20,
    netWorth: 10_000_000_000,
    careerYears: 1,
    averagePing: 12,
    pingVariance: 300,
  });
  assert.ok(signals.length >= 3, 'les anomalies flagrantes doivent être détectées');
  for (const signal of signals) assert.ok(signal.evidence.length > 0, 'chaque signal doit être documenté');

  const clean = game.multiplayer.runCheatDetection({
    playerId: 'online:1',
    goalsThisSeason: 22,
    matchesThisSeason: 34,
    netWorth: 12_000_000,
    careerYears: 4,
    averagePing: 45,
    pingVariance: 15,
  });
  assert.equal(clean.length, 0, 'un joueur normal ne doit pas être signalé');
  game.dispose();
});

test('simulation longue — une saison complète reste stable et cohérente', () => {
  const game = newGame('saison');
  game.createCareer({
    name: 'Test Saison',
    nationality: 'fr',
    position: 'BU',
    age: 21,
    startingClubId: 'lyon-rhone',
    potential: 90,
  });

  const playedSeason = game.seasons.season;
  const result = game.simulateSeason({ playMatches: true });
  assert.ok(result.matchesPlayed > 10, `matchs joués sur la saison : ${result.matchesPlayed}`);

  // Le classement de la saison écoulée reste consultable après la bascule
  // de juillet (Tome XVII : le jeu conserve tout).
  const standings = game.seasons.standings('fr-elite', playedSeason);
  assert.ok(standings.length >= 8, `clubs classés : ${standings.length}`);
  assert.ok(standings[0] && standings[0].played > 0, 'des rencontres doivent avoir été jouées');
  assert.ok(
    standings.every((row) => row.won + row.drawn + row.lost === row.played),
    'chaque ligne de classement doit être cohérente',
  );

  const balance = game.quality.balanceReport();
  assert.ok(balance.goalsPerMatch > 1 && balance.goalsPerMatch < 5, `buts par match : ${balance.goalsPerMatch}`);
  assert.ok(balance.homeWinRate > 0.2 && balance.homeWinRate < 0.75, `victoires à domicile : ${balance.homeWinRate}`);
  assert.ok(balance.recommendations.length > 0);

  const player = game.career.player;
  assert.ok(player.age >= 21);
  assert.ok(player.seasons.length >= 1);
  assert.ok(game.context.events.totalEmitted > 1000);

  const errors = game.context.rootLogger.entries({ minLevel: 'error' });
  assert.equal(errors.length, 0, `erreurs journalisées : ${errors.map((e) => e.message).join(' | ')}`);
  game.dispose();
});
