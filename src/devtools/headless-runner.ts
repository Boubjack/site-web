/**
 * Infinity Football — Exécution headless
 *
 * Fait vivre un monde complet sans interface : crée une carrière, joue des
 * saisons, tient les Boubjack Awards, produit les rapports de qualité et
 * d'équilibrage. Sert de démonstration exécutable et de banc d'essai pour
 * l'intégration continue (Tome XV).
 *
 * Utilisation : npm run simulate -- [--seasons 3] [--seed ma-graine]
 */

import { InfinityFootball } from '../game.js';
import { formatTestReport, qualityGrade } from './quality-system.js';
import { MatchOrchestrator } from '../football/match-orchestrator.js';

interface RunnerOptions {
  readonly seasons: number;
  readonly seed: string;
  readonly playerName: string;
  readonly nationality: string;
}

function parseArgs(argv: readonly string[]): RunnerOptions {
  const options = {
    seasons: 2,
    seed: 'infinity-headless',
    playerName: 'Amadou Traoré',
    nationality: 'ml',
  };
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key || value === undefined) continue;
    if (key === '--seasons') options.seasons = Math.max(1, Number(value) || 1);
    if (key === '--seed') options.seed = value;
    if (key === '--name') options.playerName = value;
    if (key === '--nationality') options.nationality = value;
  }
  return options;
}

function euros(value: number): string {
  return `${Math.round(value).toLocaleString('fr-FR')} €`;
}

function heading(title: string): void {
  console.log(`\n${'─'.repeat(78)}\n${title}\n${'─'.repeat(78)}`);
}

export async function run(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  const options = parseArgs(argv);
  const startedAt = Date.now();

  heading('INFINITY FOOTBALL — SIMULATION HEADLESS');
  console.log(`Graine : ${options.seed} — ${options.seasons} saison(s) simulée(s)`);

  const game = new InfinityFootball({
    seed: options.seed,
    startDate: { year: 2025, month: 7, day: 1, hour: 8, minute: 0 },
    richWorld: true,
    logLevel: 'warn',
  }).start();

  const boot = game.snapshot();
  console.log(
    `Monde généré : ${boot.cityCount} villes, ${boot.venueCount.toLocaleString('fr-FR')} lieux, ` +
      `${boot.npcCount.toLocaleString('fr-FR')} PNJ persistants (${Date.now() - startedAt} ms)`,
  );

  game.createCareer({
    name: options.playerName,
    nationality: options.nationality,
    position: 'MOC',
    age: 18,
    potential: 90,
    backstory: 'formé dans les terrains de quartier, repéré à seize ans',
  });
  const player = game.career.player;
  console.log(
    `Carrière : ${player.identity.name}, ${player.age} ans, ${player.identity.position}, ` +
      `club ${player.clubId} — potentiel ${Math.round(player.potential)}`,
  );

  // Le joueur s'installe et équipe sa vie : le monde ouvert sert dès le départ.
  game.phone.setContext('maison');
  game.phone.connectSpotify('compte-demo');
  game.economy.record('courant', 150_000, 'contrat', 'prime de début de carrière');

  heading('SAISONS');
  for (let season = 0; season < options.seasons; season++) {
    const seasonNumber = game.seasons.season;
    const result = game.simulateSeason({ playMatches: true });

    const stats = game.career.player.seasons.find((s) => s.season === seasonNumber);
    const bestReport = result.reports
      .filter((r) => r.playerRating !== null)
      .sort((a, b) => (b.playerRating ?? 0) - (a.playerRating ?? 0))[0];

    console.log(
      `\nSaison ${seasonNumber}/${seasonNumber + 1} — ${result.matchesPlayed} matchs joués\n` +
        `  ${stats ? `${stats.appearances} apparitions, ${stats.goals} buts, ${stats.assists} passes, note ${stats.averageRating}` : 'aucune feuille de match'}\n` +
        `  réputation ${Math.round(game.career.player.reputation)}/100, ` +
        `célébrité ${Math.round(game.career.player.fame)}/100, ` +
        `valeur ${euros(game.career.player.marketValue)}`,
    );

    if (bestReport) {
      const highlights = MatchOrchestrator.highlights(bestReport.result, 3);
      console.log(
        `  Meilleur match : ${bestReport.homeName} ${bestReport.result.homeGoals}-` +
          `${bestReport.result.awayGoals} ${bestReport.awayName} (note ${bestReport.playerRating})`,
      );
      for (const event of highlights) {
        console.log(`    ${String(event.minute).padStart(2)}′ ${event.detail}`);
      }
      const line = bestReport.commentary[bestReport.commentary.length - 1];
      if (line) console.log(`    « ${line.text} » — ${line.commentatorName}`);
      console.log(`    Analyse : ${bestReport.analysis.summary}`);
      if (bestReport.analysis.advice[0]) {
        console.log(`    Conseil : ${bestReport.analysis.advice[0]}`);
      }
    }
  }

  heading('BOUBJACK AWARDS');
  const ceremony = game.awards.runCeremony();
  console.log(
    `Édition ${ceremony.season} à ${ceremony.hostCityName} — ${ceremony.durationMinutes} min\n` +
      `  scène : ${ceremony.stageDesign}\n` +
      `  décor : ${ceremony.decoration} (identité ${ceremony.visualIdentity})\n` +
      `  tapis rouge : ${ceremony.redCarpet.length} arrivées`,
  );
  for (const result of ceremony.results.slice(0, 6)) {
    console.log(`  ${result.categoryName.padEnd(28)} → ${result.winnerName} (remis par ${result.presenterName})`);
  }
  console.log(`  … et ${ceremony.results.length - 6} autres catégories`);

  heading('MONDE VIVANT');
  const city = game.world.city(game.travel.cityId);
  console.log(
    `Position : ${city.def.name} — ${city.weather.condition}, ${city.weather.temperatureC} °C, ` +
      `trafic ${city.traffic.toFixed(2)}, hôtels ${Math.round(city.hotelOccupancy * 100)} %`,
  );
  console.log(`Événements de rue actifs : ${city.activeStreetEvents.map((e) => e.label).join(', ') || 'aucun'}`);
  const events = game.calendar.upcoming(3);
  for (const event of events) {
    console.log(`  À venir : ${event.name} (ampleur ${event.magnitude.toFixed(2)})`);
  }

  heading('PRESSE DU JOUR');
  for (const article of game.media.frontPage(5)) {
    console.log(`  ${article.outletName.padEnd(24)} ${article.headline}`);
  }

  heading('IA SECRÉTAIRE');
  const briefing = game.phone.secretaryBriefing();
  console.log(`  ${briefing.salutation}`);
  console.log(`  ${briefing.finances}`);
  console.log(`  ${briefing.performance}`);
  for (const recommendation of briefing.recommendations.slice(0, 2)) {
    console.log(`  Conseil : ${recommendation}`);
  }

  heading('PATRIMOINE');
  console.log(
    `  Liquidités ${euros(game.economy.liquidity)} — patrimoine ${euros(game.economy.netWorth)}\n` +
      `  ${game.economy.allProperties.length} bien(s), ${game.economy.garage.length} véhicule(s), ` +
      `${game.economy.activeInvestments.length} investissement(s), ` +
      `${game.economy.staff.length} employé(s)`,
  );

  heading('HÉRITAGE');
  const museum = game.legacy.museum;
  console.log(
    `  Musée : ${museum.exhibits.length} pièces dans ${museum.rooms.length} salle(s), ` +
      `${museum.visitors.toLocaleString('fr-FR')} visiteurs, note ${game.legacy.museumRating()}/5`,
  );
  console.log(`  Trophées : ${game.career.trophyList.length} — récompenses : ${game.career.awardList.length}`);
  console.log(`  Ligne du temps : ${game.legacy.playerTimeline.length} événements archivés`);
  const records = game.legacy.allRecords.filter((r) => r.holderId === game.career.player.identity.id);
  console.log(`  Records mondiaux détenus : ${records.length}${records[0] ? ` (${records[0].name})` : ''}`);

  heading('QUALITÉ & ÉQUILIBRAGE');
  const suites = game.quality.runAllSuites();
  console.log(formatTestReport(suites.suites));
  const scores = game.quality.qualityScores();
  console.log(
    `\nScore qualité global : ${scores.global} (${qualityGrade(scores.global)})\n` +
      `  stabilité ${scores.stabilite} · cohérence ${scores.coherence} · réalisme ${scores.realisme} · ` +
      `immersion ${scores.immersion} · performances ${scores.performances}`,
  );
  const balance = game.quality.balanceReport();
  console.log(
    `\nÉquilibrage : ${balance.goalsPerMatch} buts/match, ` +
      `${Math.round(balance.homeWinRate * 100)} % de victoires à domicile, ` +
      `${Math.round(balance.drawRate * 100)} % de nuls`,
  );
  for (const recommendation of balance.recommendations) console.log(`  → ${recommendation}`);

  heading('SAUVEGARDE');
  const envelope = await game.save('headless', 'manual');
  console.log(
    `  Slot "headless" — version ${envelope.version}, somme ${envelope.checksum}, ` +
      `${envelope.meta.dateLabel}`,
  );
  const reloaded = await game.load('headless');
  console.log(`  Rechargement : ${reloaded ? 'réussi' : 'échec'}`);

  heading('PERFORMANCES');
  const samples = game.context.profiler.samples().slice(0, 6);
  for (const sample of samples) {
    console.log(`  ${sample.label.padEnd(30)} ${sample.averageMs.toFixed(3)} ms (${sample.calls} appels)`);
  }
  console.log(
    `\nTemps total d'exécution : ${((Date.now() - startedAt) / 1000).toFixed(1)} s — ` +
      `${game.context.events.totalEmitted.toLocaleString('fr-FR')} événements de monde émis`,
  );

  game.dispose();
}

// Exécution directe : node dist/src/devtools/headless-runner.js
const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('headless-runner.js');

if (isDirectRun) {
  run().catch((error: unknown) => {
    console.error('échec de la simulation headless :', error);
    process.exitCode = 1;
  });
}
