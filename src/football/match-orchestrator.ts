/**
 * Infinity Football — Orchestrateur de match
 *
 * Point de jonction entre le moteur de match et le reste du jeu : il compose
 * les équipes, prépare le contexte (stade, météo, arbitre, enjeu, rivalité),
 * fait tourner la rencontre, puis diffuse les conséquences dans tous les
 * systèmes concernés — commentaires (Tome IX), réalisation TV (Tome XVI),
 * ambiance sonore, statistiques de carrière (Tome IV), classements (Tome XIX),
 * archives et records (Tome XXVIII), presse (Tome XXVII) et animations
 * (Tome XXXI).
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { SimulationContext } from '../core/context.js';
import type { Rng } from '../core/rng.js';
import { getClub, getCompetition, getStadium } from '../data/clubs.js';
import { NAME_POOLS } from '../data/names.js';
import { createPlayer, overallRating, type PlayerState, type Position } from '../career/player.js';
import { pressureResistance } from '../ai/personality.js';
import { MemoryBank } from '../ai/memory.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { SEASON_SERVICE, type Fixture, type SeasonSystem } from '../career/season-system.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { AUDIO_SERVICE, type AudioSystem } from '../audio/audio-system.js';
import { LEGACY_SERVICE, type LegacySystem } from '../legacy/legacy-system.js';
import { ANIMATION_SERVICE, type AnimationSystem } from '../animation/animation-system.js';
import { CINEMATIC_SERVICE, type CinematicSystem, type DirectionContext } from '../cinematics/cinematic-system.js';
import {
  CommentarySystem,
  pickDuo,
  type CommentaryContext,
  type CommentaryLine,
} from '../audio/commentary.js';
import { createReferee, updateRefereeReputation, type Referee } from './referee.js';
import { defaultTactics, computeCoefficients, type Tactics } from './tactics.js';
import {
  MatchEngine,
  emptyPlayerStats,
  type MatchEvent,
  type MatchPlayer,
  type MatchResult,
  type MatchTeam,
} from './match-engine.js';

export const MATCH_SERVICE = 'match';

export interface MatchReport {
  readonly result: MatchResult;
  readonly commentary: readonly CommentaryLine[];
  readonly homeName: string;
  readonly awayName: string;
  readonly competitionName: string;
  readonly stadiumName: string;
  readonly refereeName: string;
  readonly playerRating: number | null;
  readonly playerGoals: number;
  readonly playerAssists: number;
  /** Analyse d'après-match produite par l'IA (Tome XXV, ch. 5). */
  readonly analysis: MatchAnalysis;
}

export interface MatchAnalysis {
  readonly summary: string;
  /** Carte de chaleur du joueur : 12 zones, de la défense à l'attaque. */
  readonly heatmap: readonly number[];
  readonly strengths: readonly string[];
  readonly mistakes: readonly string[];
  readonly advice: readonly string[];
  readonly tacticalNote: string;
}

/** Effectif simulé d'un club, mis en cache pour rester stable d'un match à l'autre. */
interface SquadEntry {
  readonly clubId: string;
  readonly players: PlayerState[];
}

const FORMATION_POSITIONS: readonly Position[] = [
  'GB', 'DD', 'DC', 'DC', 'DG', 'MDC', 'MC', 'MC', 'AD', 'BU', 'AG',
];
const BENCH_POSITIONS: readonly Position[] = ['GB', 'DC', 'MC', 'MOC', 'AD', 'BU', 'MDC'];

export class MatchOrchestrator {
  private readonly squads = new Map<string, SquadEntry>();
  private readonly referees: Referee[] = [];
  private commentary: CommentarySystem | null = null;

  constructor(private readonly context: SimulationContext) {
    const rng = context.stream('match.referees');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    for (let i = 0; i < 24; i++) {
      this.referees.push(
        createReferee(`referee:${i}`, `${rng.pick(pool.given)} ${rng.pick(pool.family)}`, 'fr', rng),
      );
    }
    context.provide(MATCH_SERVICE, this);
  }

  get refereePool(): readonly Referee[] {
    return this.referees;
  }

  /**
   * Joue une rencontre de bout en bout et propage les conséquences.
   * Si le joueur incarné participe, ses statistiques réelles sont appliquées.
   */
  play(fixture: Fixture, options: { playerTactics?: Tactics; cinematics?: boolean } = {}): MatchReport {
    const rng = this.context.stream(`match.${fixture.id}`);
    const career = this.context.optional<CareerSystem>(CAREER_SERVICE);
    const seasons = this.context.require<SeasonSystem>(SEASON_SERVICE);
    const world = this.context.require<WorldSystem>(WORLD_SERVICE);
    const audio = this.context.optional<AudioSystem>(AUDIO_SERVICE);
    const legacy = this.context.optional<LegacySystem>(LEGACY_SERVICE);
    const animation = this.context.optional<AnimationSystem>(ANIMATION_SERVICE);
    const cinematics = this.context.optional<CinematicSystem>(CINEMATIC_SERVICE);

    const homeClub = getClub(fixture.homeClubId);
    const awayClub = getClub(fixture.awayClubId);
    const competition = getCompetition(fixture.competitionId);
    const stadium = getStadium(homeClub.stadiumId);
    const city = world.world.cities.get(homeClub.cityId);

    const playerClubId = career?.hasCareer ? career.player.clubId : null;
    const playerIsHome = playerClubId === homeClub.id;
    const playerIsAway = playerClubId === awayClub.id;
    const playerPlays = (playerIsHome || playerIsAway) && !(career?.injured ?? false);

    const home = this.buildTeam(homeClub.id, playerIsHome && playerPlays, options.playerTactics, rng);
    const away = this.buildTeam(awayClub.id, playerIsAway && playerPlays, options.playerTactics, rng);

    const referee = rng.pick(this.referees);
    const rivalry = homeClub.rivalIds.includes(awayClub.id) || awayClub.rivalIds.includes(homeClub.id) ? 1 : 0.25;
    const stakes = clamp01(competition.prestige / 100 * 0.7 + rivalry * 0.3);

    const weather = city?.weather ?? {
      condition: 'clear' as const,
      temperatureC: 18,
      windKmh: 8,
      humidity: 0.5,
      severity: 0,
      pitchQuality: 0.95,
    };

    const matchContext = {
      matchId: fixture.id,
      competitionId: competition.id,
      competitionPrestige: competition.prestige,
      stadiumId: stadium.id,
      stadiumName: stadium.name,
      stadiumCapacity: stadium.capacity,
      stadiumAtmosphere: stadium.atmosphere,
      cityId: homeClub.cityId,
      weather,
      pitchQuality: weather.pitchQuality,
      referee,
      stakes,
      rivalry,
    };

    // Commentateurs : duo choisi selon la langue configurée, mémoire de carrière.
    if (!this.commentary) {
      const duo = pickDuo(this.context.config.language, null, rng);
      // Sans carrière active, les commentateurs disposent d'une mémoire vierge.
      this.commentary = new CommentarySystem(duo, career?.careerMemory ?? new MemoryBank());
    }
    const commentaryContext = this.buildCommentaryContext(homeClub.name, awayClub.name, competition.name, stadium.name, city?.def.name ?? homeClub.cityId);
    const lines: CommentaryLine[] = [];
    const commentary = this.commentary;
    if (commentary) {
      lines.push(...commentary.pregame(commentaryContext, this.context.clock.absoluteMinutes, rng));
    }

    // Ambiance et réalisation d'avant-match.
    audio?.playAnthem(stadium.id);
    if (options.cinematics !== false && cinematics) {
      const direction: DirectionContext = {
        stakes,
        competitionPrestige: competition.prestige,
        stadiumAtmosphere: stadium.atmosphere,
        weatherSeverity: weather.severity,
        goalDifference: 0,
        minute: 0,
        minutesRemaining: 90,
      };
      cinematics.play(cinematics.broadcastOpening(direction, stadium.name, city?.def.name ?? homeClub.cityId));
      if (stakes > 0.7) cinematics.play(cinematics.buildMatchDay(direction, career?.hasCareer ? career.player.identity.id : null));
    }

    const engine = new MatchEngine(rng);
    const result = engine.simulate(home, away, matchContext, (event, crowd) => {
      if (commentary) {
        lines.push(...commentary.react(event, crowd, commentaryContext, this.context.clock.absoluteMinutes, rng));
      }
      audio?.updateStadium(stadium.id, {
        intensity: crowd.intensity,
        tension: crowd.tension,
        homeScoring: event.kind === 'but' ? event.teamId === home.clubId : null,
      });
      if (options.cinematics !== false && cinematics && event.drama > 0.6) {
        cinematics.play(
          cinematics.directMatchEvent(event, {
            stakes,
            competitionPrestige: competition.prestige,
            stadiumAtmosphere: stadium.atmosphere,
            weatherSeverity: weather.severity,
            goalDifference: home.goals - away.goals,
            minute: event.minute,
            minutesRemaining: Math.max(0, 90 - event.minute),
          }),
          { skip: true },
        );
      }
    });

    // Usure visuelle : maillots salis, transpiration, traces sur la pelouse.
    animation?.applyMatchWear(
      90,
      clamp01(0.6 + stakes * 0.4),
      weather.condition === 'rain' || weather.condition === 'heavyRain' || weather.condition === 'storm',
    );

    // Résultat enregistré au classement.
    seasons.recordResult(fixture.id, result.homeGoals, result.awayGoals);

    // Conséquences pour le joueur incarné.
    const userPlayer = [...home.players, ...home.bench, ...away.players, ...away.bench].find((p) => p.isUser);
    let playerRating: number | null = null;
    if (playerPlays && userPlayer && career?.hasCareer) {
      const isHomeSide = home.players.includes(userPlayer) || home.bench.includes(userPlayer);
      const conceded = isHomeSide ? result.awayGoals : result.homeGoals;
      playerRating = userPlayer.stats.rating;
      career.applyMatchPerformance({
        minutes: userPlayer.minutesPlayed,
        goals: userPlayer.stats.goals,
        assists: userPlayer.stats.assists,
        shots: userPlayer.stats.shots,
        shotsOnTarget: userPlayer.stats.shotsOnTarget,
        passes: userPlayer.stats.passes,
        passesCompleted: userPlayer.stats.passesCompleted,
        tackles: userPlayer.stats.tackles,
        saves: userPlayer.stats.saves,
        cleanSheet: conceded === 0 && userPlayer.minutesPlayed > 60,
        yellow: userPlayer.booked,
        red: userPlayer.sentOff,
        distanceKm: userPlayer.stats.distanceKm,
        topSpeedKmh: userPlayer.stats.topSpeedKmh,
        rating: userPlayer.stats.rating,
        manOfTheMatch: result.manOfTheMatchId === userPlayer.id,
        competitionId: competition.id,
      });
      legacy?.auditPlayerRecords();
    }

    // Réputation de l'arbitre : un match propre la renforce.
    const cards = result.events.filter((e) => e.kind === 'jaune' || e.kind === 'rouge').length;
    updateRefereeReputation(referee, {
      correctDecisions: Math.max(0, result.foulsHome + result.foulsAway - Math.floor(cards / 3)),
      totalDecisions: Math.max(1, result.foulsHome + result.foulsAway),
      controversies: result.events.filter((e) => e.kind === 'rouge' || e.kind === 'penaltyManque').length,
    });

    this.context.emit({
      type: 'match.ended',
      matchId: fixture.id,
      homeClubId: homeClub.id,
      awayClubId: awayClub.id,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      competitionId: competition.id,
      playerRating,
    });

    const analysis = this.buildAnalysis(result, userPlayer ?? null, home, away, playerIsHome);

    return {
      result,
      commentary: lines,
      homeName: homeClub.name,
      awayName: awayClub.name,
      competitionName: competition.name,
      stadiumName: stadium.name,
      refereeName: referee.name,
      playerRating,
      playerGoals: userPlayer?.stats.goals ?? 0,
      playerAssists: userPlayer?.stats.assists ?? 0,
      analysis,
    };
  }

  // ── Composition des équipes ──────────────────────────────────────────────

  private buildTeam(
    clubId: string,
    includeUser: boolean,
    playerTactics: Tactics | undefined,
    rng: Rng,
  ): MatchTeam {
    const club = getClub(clubId);
    const squad = this.squadFor(clubId, rng);
    const career = this.context.optional<CareerSystem>(CAREER_SERVICE);

    const starters: MatchPlayer[] = [];
    const bench: MatchPlayer[] = [];

    // Le joueur incarné prend la place du titulaire le plus faible à son poste.
    let userSlotTaken = false;
    FORMATION_POSITIONS.forEach((position, index) => {
      if (includeUser && !userSlotTaken && career?.hasCareer && career.player.identity.position === position) {
        starters.push(this.toMatchPlayer(career.player, position, true));
        userSlotTaken = true;
        return;
      }
      const source = squad.players[index] ?? (squad.players[0] as PlayerState);
      starters.push(this.toMatchPlayer(source, position, false));
    });

    // Si le poste exact n'existe pas dans le 11, le joueur entre quand même.
    if (includeUser && !userSlotTaken && career?.hasCareer) {
      starters[starters.length - 1] = this.toMatchPlayer(
        career.player,
        career.player.identity.position,
        true,
      );
    }

    BENCH_POSITIONS.forEach((position, index) => {
      const source = squad.players[FORMATION_POSITIONS.length + index] ?? (squad.players[0] as PlayerState);
      const player = this.toMatchPlayer(source, position, false);
      player.onPitch = false;
      bench.push(player);
    });

    const tactics = includeUser && playerTactics ? playerTactics : this.defaultTacticsFor(club.prestige, rng);

    return {
      clubId,
      name: club.name,
      prestige: club.prestige,
      tactics,
      players: starters,
      substitutionsLeft: 5,
      bench,
      goals: 0,
      momentum: 0.5,
    };
  }

  private defaultTacticsFor(prestige: number, rng: Rng): Tactics {
    const base = defaultTactics(rng.pick(['4-3-3', '4-2-3-1', '4-4-2', '3-5-2', '4-1-4-1', '3-4-3']));
    // Les grands clubs pressent plus haut et prennent plus de risques.
    const ambition = clamp01(prestige / 100);
    return {
      ...base,
      pressing: ambition > 0.8 ? 'haut' : ambition > 0.55 ? 'medium' : 'bas',
      tempo: clamp01(0.4 + ambition * 0.35 + rng.range(-0.08, 0.08)),
      passRisk: clamp01(0.32 + ambition * 0.3 + rng.range(-0.06, 0.06)),
      aggression: clamp01(0.45 + rng.range(-0.12, 0.15)),
    };
  }

  private toMatchPlayer(source: PlayerState, position: Position, isUser: boolean): MatchPlayer {
    return {
      id: source.identity.id,
      name: source.identity.name,
      position,
      attributes: source.attributes,
      rating: overallRating(source, position),
      stamina: clamp01(source.fitness),
      form: clamp01(source.form),
      morale: clamp01(source.morale),
      pressureResistance: pressureResistance(source.profile),
      risk: source.profile.football.risk,
      flair: source.profile.football.flair,
      vision: source.profile.football.vision,
      anticipation: source.profile.football.anticipation,
      isUser,
      booked: false,
      sentOff: false,
      onPitch: true,
      minutesPlayed: 0,
      stats: emptyPlayerStats(),
    };
  }

  /** Effectif persistant d'un club : généré une fois, réutilisé ensuite. */
  private squadFor(clubId: string, rng: Rng): SquadEntry {
    const existing = this.squads.get(clubId);
    if (existing) return existing;

    const club = getClub(clubId);
    const squadRng = rng.derive(`squad:${clubId}`);
    const pool =
      NAME_POOLS.find((p) => p.countryIds.includes(club.countryId)) ??
      (NAME_POOLS[0] as (typeof NAME_POOLS)[number]);
    const players: PlayerState[] = [];
    const positions = [...FORMATION_POSITIONS, ...BENCH_POSITIONS, 'DC' as Position, 'MC' as Position];

    positions.forEach((position, index) => {
      const quality = clamp(club.prestige / 100 + squadRng.gaussian(0, 0.07), 0.25, 0.98);
      const player = createPlayer(
        {
          id: `${clubId}:player:${index}`,
          name: `${squadRng.pick(pool.given)} ${squadRng.pick(pool.family)}`,
          nationality: club.countryId,
          position,
          age: squadRng.int(19, 33),
          startingYear: this.context.clock.date.year,
          quality,
          potential: clamp(club.prestige + squadRng.gaussian(4, 8), 45, 96),
        },
        squadRng,
      );
      player.clubId = clubId;
      player.form = clamp01(squadRng.gaussian(0.6, 0.12));
      player.fitness = clamp01(squadRng.gaussian(0.9, 0.08));
      players.push(player);
    });

    const entry: SquadEntry = { clubId, players };
    this.squads.set(clubId, entry);
    return entry;
  }

  /** Effectif d'un club, exposé au mode Entraîneur. */
  squad(clubId: string): readonly PlayerState[] {
    const rng = this.context.stream('match.squads');
    return this.squadFor(clubId, rng).players;
  }

  // ── Contexte de commentaire ──────────────────────────────────────────────

  private buildCommentaryContext(
    homeName: string,
    awayName: string,
    competitionName: string,
    stadiumName: string,
    cityName: string,
  ): CommentaryContext {
    const career = this.context.optional<CareerSystem>(CAREER_SERVICE);
    const legacy = this.context.optional<LegacySystem>(LEGACY_SERVICE);
    const hasCareer = career?.hasCareer ?? false;

    return {
      playerName: hasCareer ? (career as CareerSystem).player.identity.name : 'le joueur',
      clubName: homeName,
      opponentName: awayName,
      competitionName,
      stadiumName,
      cityName,
      formerClubs: hasCareer ? [...(career as CareerSystem).formerClubs] : [],
      trophies: hasCareer ? (career as CareerSystem).trophyList.map((t) => t.name) : [],
      awards: hasCareer ? (career as CareerSystem).awardList.map((a) => a.name) : [],
      records: legacy
        ? legacy.allRecords
            .filter((r) => hasCareer && r.holderId === (career as CareerSystem).player.identity.id)
            .map((r) => r.name)
        : [],
      rivals: [],
      familyPresent: [],
      injuries: hasCareer
        ? (career as CareerSystem).player.injuries.map((i) => i.label)
        : [],
      museumName: legacy && legacy.museum.exhibits.length > 0 ? 'son musée personnel' : null,
      legendComparisons: [],
      careerStatline: hasCareer ? (career as CareerSystem).statline() : '',
      managerName: 'l’entraîneur',
    };
  }

  // ── Analyse d'après-match (Tome XXV, ch. 5) ──────────────────────────────

  private buildAnalysis(
    result: MatchResult,
    userPlayer: MatchPlayer | null,
    home: MatchTeam,
    away: MatchTeam,
    playerIsHome: boolean,
  ): MatchAnalysis {
    const strengths: string[] = [];
    const mistakes: string[] = [];
    const advice: string[] = [];

    const totalHeat = result.userHeatmap.reduce((sum, value) => sum + value, 0);
    const heatmap = totalHeat > 0 ? result.userHeatmap.map((value) => round(value / totalHeat, 3)) : result.userHeatmap;

    if (userPlayer) {
      const stats = userPlayer.stats;
      const passAccuracy = stats.passes > 0 ? stats.passesCompleted / stats.passes : 0;
      const shotAccuracy = stats.shots > 0 ? stats.shotsOnTarget / stats.shots : 0;

      if (stats.goals > 0) strengths.push(`${stats.goals} but(s) marqué(s)`);
      if (stats.assists > 0) strengths.push(`${stats.assists} passe(s) décisive(s)`);
      if (passAccuracy > 0.85) strengths.push(`${Math.round(passAccuracy * 100)} % de passes réussies`);
      if (stats.duelsWon > stats.duelsLost) strengths.push(`${stats.duelsWon} duels gagnés`);
      if (stats.distanceKm > 10) strengths.push(`${round(stats.distanceKm, 1)} km parcourus`);

      if (passAccuracy < 0.72 && stats.passes > 10) {
        mistakes.push(`déchet technique : ${Math.round(passAccuracy * 100)} % de passes réussies`);
        advice.push('Réduire la prise de risque à la passe sous pression, ou travailler la conservation à l’entraînement.');
      }
      if (stats.shots >= 4 && shotAccuracy < 0.35) {
        mistakes.push(`${stats.shots} tirs pour ${stats.shotsOnTarget} cadré(s)`);
        advice.push('Privilégier les positions de frappe plus centrales : la finition gagne en efficacité.');
      }
      if (userPlayer.sentOff) {
        mistakes.push('expulsion');
        advice.push('Maîtriser l’agressivité dans les duels : l’arbitre du jour était peu tolérant.');
      } else if (userPlayer.booked) {
        mistakes.push('avertissement reçu');
      }
      if (stats.touches < 25 && userPlayer.minutesPlayed > 60) {
        mistakes.push('trop peu de ballons touchés');
        advice.push('Décrocher davantage entre les lignes pour recevoir le ballon.');
      }
      if (advice.length === 0) advice.push('Prestation solide : conserver ce rythme et cette rigueur.');
    } else {
      advice.push('Le joueur n’a pas participé à cette rencontre.');
    }

    const possession = round(result.possessionHome * 100, 1);
    const playerPossession = playerIsHome ? possession : round(100 - possession, 1);
    const homeCoefficients = computeCoefficients(home.tactics);
    const awayCoefficients = computeCoefficients(away.tactics);
    const own = playerIsHome ? homeCoefficients : awayCoefficients;
    const opponent = playerIsHome ? awayCoefficients : homeCoefficients;

    const tacticalNote =
      own.counterVulnerability > opponent.chanceCreation
        ? 'Bloc trop exposé aux transitions adverses : envisager une ligne défensive plus basse.'
        : own.chanceCreation > opponent.defensiveSolidity
          ? 'Supériorité dans la création : le plan de jeu offensif fonctionne.'
          : 'Équilibre tactique globalement respecté des deux côtés.';

    const goalDiff = playerIsHome ? result.homeGoals - result.awayGoals : result.awayGoals - result.homeGoals;
    const outcome = goalDiff > 0 ? 'victoire' : goalDiff === 0 ? 'match nul' : 'défaite';

    return {
      summary:
        `${outcome} ${result.homeGoals}-${result.awayGoals} — ${playerPossession} % de possession, ` +
        `${playerIsHome ? result.shotsHome : result.shotsAway} tirs dont ` +
        `${playerIsHome ? result.shotsOnTargetHome : result.shotsOnTargetAway} cadrés, ` +
        `${result.attendance.toLocaleString('fr-FR')} spectateurs.`,
      heatmap,
      strengths,
      mistakes,
      advice,
      tacticalNote,
    };
  }

  /** Événements marquants d'un match, pour la presse et les archives. */
  static highlights(result: MatchResult, limit = 6): MatchEvent[] {
    return [...result.events]
      .sort((a, b) => b.drama - a.drama)
      .slice(0, limit)
      .sort((a, b) => a.minute - b.minute);
  }
}
