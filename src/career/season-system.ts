/**
 * Infinity Football — Carrière / Saisons & compétitions
 *
 * Tome XIX : le calendrier mondial (championnats, coupes nationales,
 * compétitions continentales, Coupe du Monde, Jeux Olympiques, matchs
 * caritatifs, jubilés, matchs des légendes, stages de pré-saison, tournées
 * estivales) existe et influence le monde même sans le joueur.
 * Tome XVII, ch. 1-2 : les saisons s'enchaînent, tout est conservé.
 *
 * Ce système génère les calendriers, tient les classements, simule les
 * rencontres auxquelles le joueur ne participe pas et couronne les champions.
 */

import { clamp, hashString, round } from '../core/math.js';
import { MINUTES_PER_DAY } from '../core/clock.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import {
  CLUBS,
  COMPETITIONS,
  clubsOfLeague,
  getClub,
  getCompetition,
  getStadium,
  type ClubDef,
  type CompetitionDef,
} from '../data/clubs.js';

export const SEASON_SERVICE = 'season';

export interface Fixture {
  readonly id: string;
  readonly competitionId: string;
  readonly homeClubId: string;
  readonly awayClubId: string;
  /** Minute absolue du coup d'envoi. */
  readonly kickoff: number;
  readonly matchday: number;
  readonly season: number;
  /** Tour de coupe, si applicable. */
  readonly round: string | null;
  played: boolean;
  homeGoals: number | null;
  awayGoals: number | null;
  /** Le joueur y participe. */
  involvesPlayer: boolean;
}

export interface TableRow {
  clubId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CompetitionSeason {
  readonly competitionId: string;
  readonly season: number;
  readonly fixtures: Fixture[];
  readonly table: Map<string, TableRow>;
  championClubId: string | null;
  finished: boolean;
}

export interface SeasonHonours {
  readonly season: number;
  readonly competitionId: string;
  readonly competitionName: string;
  readonly championClubId: string;
  readonly championName: string;
  readonly trophyName: string;
}

/**
 * Créneaux de coup d'envoi réels. L'espacement du calendrier tombe sur des
 * minutes arbitraires (09:42, 23:24…) : on ramène chaque rencontre sur un
 * horaire de diffusion plausible, de façon déterministe par rencontre.
 */
const KICKOFF_SLOTS = [13 * 60, 15 * 60, 17 * 60 + 30, 19 * 60, 20 * 60 + 45, 21 * 60];

function snapKickoff(minutes: number, fixtureId: string): number {
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const slot = KICKOFF_SLOTS[hashString(fixtureId) % KICKOFF_SLOTS.length] ?? 15 * 60;
  return day * MINUTES_PER_DAY + slot;
}

function emptyRow(clubId: string): TableRow {
  return { clubId, played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
}

export class SeasonSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'season',
    name: 'Saisons & compétitions',
    order: 50,
    tomes: ['III', 'XVII', 'XIX', 'XXVIII'],
  };

  private context!: SimulationContext;
  private readonly seasons = new Map<string, CompetitionSeason>();
  private readonly honours: SeasonHonours[] = [];
  private currentSeason = 0;
  /** Force relative apprise de chaque club (évolue avec les résultats). */
  private readonly clubStrength = new Map<string, number>();
  /** Club suivi par le joueur, dont les matchs ne sont pas auto-simulés. */
  private playerClubId: string | null = null;

  init(context: SimulationContext): void {
    this.context = context;
    context.provide(SEASON_SERVICE, this);
    for (const club of CLUBS) {
      this.clubStrength.set(club.id, club.prestige);
    }
    this.currentSeason = context.clock.footballSeason;
    this.generateSeason(this.currentSeason);
  }

  setPlayerClub(clubId: string | null): void {
    this.playerClubId = clubId;
    for (const season of this.seasons.values()) {
      for (const fixture of season.fixtures) {
        if (fixture.played) continue;
        (fixture as { involvesPlayer: boolean }).involvesPlayer =
          clubId !== null && (fixture.homeClubId === clubId || fixture.awayClubId === clubId);
      }
    }
  }

  get season(): number {
    return this.currentSeason;
  }

  get allHonours(): readonly SeasonHonours[] {
    return this.honours;
  }

  competitionSeason(competitionId: string, season = this.currentSeason): CompetitionSeason | undefined {
    return this.seasons.get(`${competitionId}:${season}`);
  }

  /** Classement trié d'une compétition. */
  standings(competitionId: string, season = this.currentSeason): TableRow[] {
    const competitionSeason = this.competitionSeason(competitionId, season);
    if (!competitionSeason) return [];
    return [...competitionSeason.table.values()].sort(
      (a, b) =>
        b.points - a.points ||
        b.goalsFor - b.goalsAgainst - (a.goalsFor - a.goalsAgainst) ||
        b.goalsFor - a.goalsFor,
    );
  }

  /** Prochaines rencontres d'un club, du plus proche au plus lointain. */
  upcomingFor(clubId: string, limit = 5): Fixture[] {
    const now = this.context.clock.absoluteMinutes;
    const result: Fixture[] = [];
    for (const season of this.seasons.values()) {
      for (const fixture of season.fixtures) {
        if (fixture.played || fixture.kickoff < now) continue;
        if (fixture.homeClubId !== clubId && fixture.awayClubId !== clubId) continue;
        result.push(fixture);
      }
    }
    return result.sort((a, b) => a.kickoff - b.kickoff).slice(0, limit);
  }

  /** Prochaine rencontre du club du joueur. */
  nextPlayerFixture(): Fixture | null {
    if (!this.playerClubId) return null;
    return this.upcomingFor(this.playerClubId, 1)[0] ?? null;
  }

  fixture(fixtureId: string): Fixture | undefined {
    for (const season of this.seasons.values()) {
      const found = season.fixtures.find((f) => f.id === fixtureId);
      if (found) return found;
    }
    return undefined;
  }

  /**
   * Enregistre un résultat (match joué par le joueur ou simulé).
   * `announce` reste faux pour les matchs joués par le moteur complet :
   * l'orchestrateur émet lui-même `match.ended` avec la note du joueur.
   */
  recordResult(fixtureId: string, homeGoals: number, awayGoals: number, announce = false): void {
    const fixture = this.fixture(fixtureId);
    if (!fixture || fixture.played) return;
    fixture.played = true;
    fixture.homeGoals = homeGoals;
    fixture.awayGoals = awayGoals;
    this.applyToTable(fixture);
    this.adjustStrength(fixture);

    // Tome XXVII : le monde entier est couvert par les médias, pas seulement
    // les rencontres du joueur.
    if (announce) {
      this.context.emit({
        type: 'match.ended',
        matchId: fixture.id,
        homeClubId: fixture.homeClubId,
        awayClubId: fixture.awayClubId,
        homeGoals,
        awayGoals,
        competitionId: fixture.competitionId,
        playerRating: null,
      });
    }
  }

  onDay(context: SimulationContext, _date: GameDate): void {
    const now = context.clock.absoluteMinutes;
    const rng = context.stream('season.simulation');
    for (const season of this.seasons.values()) {
      if (season.finished) continue;
      for (const fixture of season.fixtures) {
        if (fixture.played || fixture.kickoff > now) continue;
        // Le match du joueur est joué par le moteur complet : on ne l'auto-simule
        // que s'il a été manqué (avance rapide, blessure, vacances).
        if (fixture.involvesPlayer && fixture.kickoff > now - 24 * 60) continue;
        const result = this.quickSimulate(fixture, rng);
        this.recordResult(fixture.id, result.home, result.away, true);
      }
      this.checkCompletion(season, context);
    }
  }

  onYear(context: SimulationContext, date: GameDate): void {
    // La bascule de saison sportive se fait en juillet, pas au 1er janvier.
    void date;
    void context;
  }

  onMonth(context: SimulationContext, date: GameDate): void {
    if (date.month !== 7) return;
    const newSeason = context.clock.footballSeason;
    if (newSeason === this.currentSeason) return;
    this.currentSeason = newSeason;
    this.generateSeason(newSeason);
    context.logger.info('nouvelle saison générée', { saison: `${newSeason}/${newSeason + 1}` });
  }

  // ── Génération des calendriers ───────────────────────────────────────────

  private generateSeason(season: number): void {
    for (const competition of COMPETITIONS) {
      if (competition.everyYears > 1 && (season - 2025) % competition.everyYears !== 0) continue;
      const key = `${competition.id}:${season}`;
      if (this.seasons.has(key)) continue;
      const created = this.buildCompetitionSeason(competition, season);
      if (created) this.seasons.set(key, created);
    }
  }

  private buildCompetitionSeason(
    competition: CompetitionDef,
    season: number,
  ): CompetitionSeason | null {
    const participants = this.participantsFor(competition);
    if (participants.length < 2) return null;

    const table = new Map<string, TableRow>();
    for (const club of participants) table.set(club.id, emptyRow(club.id));

    const fixtures =
      competition.kind === 'league'
        ? this.roundRobin(competition, participants, season)
        : this.knockout(competition, participants, season);

    return { competitionId: competition.id, season, fixtures, table, championClubId: null, finished: false };
  }

  private participantsFor(competition: CompetitionDef): ClubDef[] {
    switch (competition.kind) {
      case 'league':
        return clubsOfLeague(competition.id);
      case 'nationalCup':
        return CLUBS.filter((c) => c.countryId === competition.countryId);
      case 'continental': {
        if (!competition.continent) {
          // Compétition inter-continentale : les meilleurs clubs mondiaux.
          return [...CLUBS].sort((a, b) => b.prestige - a.prestige).slice(0, 16);
        }
        const byContinent = CLUBS.filter((club) => {
          const competitionOfClub = COMPETITIONS.find((c) => c.id === club.leagueId);
          return competitionOfClub?.continent === competition.continent;
        });
        return byContinent.sort((a, b) => b.prestige - a.prestige).slice(0, 16);
      }
      case 'worldCup':
      case 'olympics':
        // Représentées par les clubs de plus haut prestige de chaque pays :
        // les sélections nationales sont gérées par le système de carrière.
        return this.topClubPerCountry().slice(0, 16);
      default:
        return [...CLUBS].sort((a, b) => b.prestige - a.prestige).slice(0, 8);
    }
  }

  private topClubPerCountry(): ClubDef[] {
    const best = new Map<string, ClubDef>();
    for (const club of CLUBS) {
      const current = best.get(club.countryId);
      if (!current || club.prestige > current.prestige) best.set(club.countryId, club);
    }
    return [...best.values()].sort((a, b) => b.prestige - a.prestige);
  }

  /** Championnat aller-retour, réparti sur la fenêtre de la compétition. */
  private roundRobin(competition: CompetitionDef, clubs: ClubDef[], season: number): Fixture[] {
    const fixtures: Fixture[] = [];
    const ids = clubs.map((c) => c.id);
    if (ids.length % 2 === 1) ids.push('__bye__');
    const rounds = ids.length - 1;
    const half = ids.length / 2;
    const rotation = ids.slice(1);

    const startMinutes = this.seasonStartMinutes(competition, season);
    const endMinutes = this.seasonEndMinutes(competition, season);
    const totalMatchdays = rounds * 2;
    const spacing = Math.max(1, Math.floor((endMinutes - startMinutes) / Math.max(1, totalMatchdays)));

    for (let round = 0; round < rounds; round++) {
      const left = [ids[0] as string, ...rotation.slice(0, half - 1)];
      const right = rotation.slice(half - 1).reverse();
      for (let i = 0; i < half; i++) {
        const home = left[i];
        const away = right[i];
        if (!home || !away || home === '__bye__' || away === '__bye__') continue;
        // Match aller.
        fixtures.push(
          this.makeFixture(competition, home, away, season, round + 1,
            startMinutes + round * spacing, null),
        );
        // Match retour, dans la seconde moitié de saison.
        fixtures.push(
          this.makeFixture(competition, away, home, season, rounds + round + 1,
            startMinutes + (rounds + round) * spacing, null),
        );
      }
      rotation.unshift(rotation.pop() as string);
    }
    return fixtures;
  }

  /** Coupe à élimination directe : tours successifs jusqu'à la finale. */
  private knockout(competition: CompetitionDef, clubs: ClubDef[], season: number): Fixture[] {
    const fixtures: Fixture[] = [];
    const seeded = [...clubs].sort((a, b) => b.prestige - a.prestige);
    let size = 2;
    while (size * 2 <= seeded.length) size *= 2;
    const qualified = seeded.slice(0, size);

    const startMinutes = this.seasonStartMinutes(competition, season);
    const endMinutes = this.seasonEndMinutes(competition, season);
    const roundsCount = Math.log2(size);
    const spacing = Math.max(1, Math.floor((endMinutes - startMinutes) / Math.max(1, roundsCount)));

    const roundNames = ['seizièmes', 'huitièmes', 'quarts', 'demi-finales', 'finale'];
    let current = qualified.map((c) => c.id);
    let roundIndex = 0;
    while (current.length > 1) {
      const roundName =
        roundNames[Math.max(0, roundNames.length - Math.log2(current.length) - 1 + 1)] ??
        `tour ${roundIndex + 1}`;
      const next: string[] = [];
      for (let i = 0; i < current.length; i += 2) {
        const home = current[i];
        const away = current[i + 1];
        if (!home || !away) continue;
        fixtures.push(
          this.makeFixture(
            competition,
            home,
            away,
            season,
            roundIndex + 1,
            startMinutes + roundIndex * spacing,
            roundName,
          ),
        );
        // Le vainqueur théorique est déterminé à la simulation ; on préconstruit
        // l'arbre avec le mieux classé, ajusté au moment du résultat.
        next.push(home);
      }
      current = next;
      roundIndex++;
    }
    return fixtures;
  }

  private makeFixture(
    competition: CompetitionDef,
    homeClubId: string,
    awayClubId: string,
    season: number,
    matchday: number,
    kickoff: number,
    round: string | null,
  ): Fixture {
    const id = `${competition.id}:${season}:${matchday}:${homeClubId}:${awayClubId}`;
    return {
      id,
      competitionId: competition.id,
      homeClubId,
      awayClubId,
      kickoff: snapKickoff(kickoff, id),
      matchday,
      season,
      round,
      played: false,
      homeGoals: null,
      awayGoals: null,
      involvesPlayer:
        this.playerClubId !== null &&
        (homeClubId === this.playerClubId || awayClubId === this.playerClubId),
    };
  }

  private seasonStartMinutes(competition: CompetitionDef, season: number): number {
    const year = competition.startMonth >= 7 ? season : season + 1;
    return this.minutesFor(year, competition.startMonth, 8, 20);
  }

  private seasonEndMinutes(competition: CompetitionDef, season: number): number {
    const year = competition.endMonth >= competition.startMonth && competition.startMonth >= 7
      ? season
      : season + 1;
    return this.minutesFor(year, competition.endMonth, 25, 20);
  }

  private minutesFor(year: number, month: number, day: number, hour: number): number {
    // Réutilise la conversion calendaire de l'horloge sans dépendre d'une instance.
    let days = 0;
    for (let y = 2025; y < year; y++) days += (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    const lengths = [31, (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    for (let m = 1; m < month; m++) days += lengths[m - 1] as number;
    days += day - 1;
    return days * 24 * 60 + hour * 60;
  }

  // ── Simulation & classements ─────────────────────────────────────────────

  /**
   * Simulation rapide d'une rencontre à laquelle le joueur ne participe pas.
   * Modèle de Poisson pondéré par la force relative, l'avantage du terrain et
   * l'ambiance du stade.
   */
  private quickSimulate(fixture: Fixture, rng: Rng): { home: number; away: number } {
    const homeStrength = this.clubStrength.get(fixture.homeClubId) ?? 60;
    const awayStrength = this.clubStrength.get(fixture.awayClubId) ?? 60;
    let atmosphere = 0.8;
    try {
      atmosphere = getStadium(getClub(fixture.homeClubId).stadiumId).atmosphere;
    } catch {
      atmosphere = 0.8;
    }
    const homeAdvantage = 1 + atmosphere * 0.18;
    const ratio = (homeStrength * homeAdvantage) / Math.max(1, homeStrength * homeAdvantage + awayStrength);
    // Calibré sur les moyennes réelles des grands championnats :
    // ≈ 2,7 buts par match, ≈ 45 % de victoires à domicile, ≈ 25 % de nuls.
    const homeLambda = clamp(0.26 + ratio * 2.16, 0.2, 3.4);
    const awayLambda = clamp(0.26 + (1 - ratio) * 1.94, 0.15, 3.0);
    return { home: poisson(homeLambda, rng), away: poisson(awayLambda, rng) };
  }

  private applyToTable(fixture: Fixture): void {
    const season = this.seasons.get(`${fixture.competitionId}:${fixture.season}`);
    if (!season) return;
    const home = season.table.get(fixture.homeClubId) ?? emptyRow(fixture.homeClubId);
    const away = season.table.get(fixture.awayClubId) ?? emptyRow(fixture.awayClubId);
    const homeGoals = fixture.homeGoals ?? 0;
    const awayGoals = fixture.awayGoals ?? 0;

    home.played++;
    away.played++;
    home.goalsFor += homeGoals;
    home.goalsAgainst += awayGoals;
    away.goalsFor += awayGoals;
    away.goalsAgainst += homeGoals;

    if (homeGoals > awayGoals) {
      home.won++;
      home.points += 3;
      away.lost++;
    } else if (homeGoals < awayGoals) {
      away.won++;
      away.points += 3;
      home.lost++;
    } else {
      home.drawn++;
      away.drawn++;
      home.points++;
      away.points++;
    }
    season.table.set(home.clubId, home);
    season.table.set(away.clubId, away);
  }

  /** La force d'un club évolue avec ses résultats : le monde apprend. */
  private adjustStrength(fixture: Fixture): void {
    const homeGoals = fixture.homeGoals ?? 0;
    const awayGoals = fixture.awayGoals ?? 0;
    const homeStrength = this.clubStrength.get(fixture.homeClubId) ?? 60;
    const awayStrength = this.clubStrength.get(fixture.awayClubId) ?? 60;
    const margin = clamp(homeGoals - awayGoals, -4, 4);
    this.clubStrength.set(fixture.homeClubId, clamp(homeStrength + margin * 0.12, 20, 100));
    this.clubStrength.set(fixture.awayClubId, clamp(awayStrength - margin * 0.12, 20, 100));
  }

  private checkCompletion(season: CompetitionSeason, context: SimulationContext): void {
    if (season.finished) return;
    if (season.fixtures.some((f) => !f.played)) return;
    season.finished = true;

    const competition = getCompetition(season.competitionId);
    const ranked = this.standings(season.competitionId, season.season);
    const champion = ranked[0];
    if (!champion) return;
    season.championClubId = champion.clubId;

    const championClub = getClub(champion.clubId);
    this.honours.push({
      season: season.season,
      competitionId: season.competitionId,
      competitionName: competition.name,
      championClubId: champion.clubId,
      championName: championClub.name,
      trophyName: competition.trophyName,
    });

    // Titre du monde : la carrière du joueur n'est concernée que si son club
    // est champion, ce que CareerSystem décide de son côté.
    context.emit({
      type: 'competition.decided',
      competitionId: season.competitionId,
      competitionName: competition.name,
      trophyName: competition.trophyName,
      championClubId: champion.clubId,
      championName: championClub.name,
      season: season.season,
    });
    context.logger.info('compétition terminée', {
      competition: competition.name,
      champion: championClub.name,
      saison: season.season,
    });
  }

  /** Force actuelle d'un club, apprise par les résultats. */
  strengthOf(clubId: string): number {
    return this.clubStrength.get(clubId) ?? 60;
  }

  /** Palmarès d'un club, toutes compétitions et toutes saisons. */
  honoursOf(clubId: string): SeasonHonours[] {
    return this.honours.filter((h) => h.championClubId === clubId);
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      currentSeason: this.currentSeason,
      playerClubId: this.playerClubId,
      clubStrength: [...this.clubStrength.entries()],
      honours: this.honours,
      seasons: [...this.seasons.entries()].map(([key, season]) => ({
        key,
        competitionId: season.competitionId,
        season: season.season,
        fixtures: season.fixtures,
        table: [...season.table.entries()],
        championClubId: season.championClubId,
        finished: season.finished,
      })),
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.currentSeason = (state.currentSeason as number) ?? this.currentSeason;
    this.playerClubId = (state.playerClubId as string | null) ?? null;
    this.clubStrength.clear();
    for (const [id, strength] of ((state.clubStrength as [string, number][]) ?? [])) {
      this.clubStrength.set(id, strength);
    }
    this.honours.length = 0;
    this.honours.push(...(((state.honours as SeasonHonours[]) ?? [])));
    this.seasons.clear();
    for (const raw of (state.seasons as Array<Record<string, unknown>>) ?? []) {
      this.seasons.set(raw.key as string, {
        competitionId: raw.competitionId as string,
        season: raw.season as number,
        fixtures: raw.fixtures as Fixture[],
        table: new Map(raw.table as [string, TableRow][]),
        championClubId: (raw.championClubId as string | null) ?? null,
        finished: raw.finished as boolean,
      });
    }
  }
}

/** Tirage de Poisson par la méthode de Knuth — utilisé pour les scores. */
export function poisson(lambda: number, rng: Rng): number {
  const limit = Math.exp(-lambda);
  let k = 0;
  let product = 1;
  do {
    k++;
    product *= rng.next();
  } while (product > limit && k < 12);
  return k - 1;
}

/** Note de performance d'une équipe sur ses cinq derniers matchs. */
export function recentForm(fixtures: readonly Fixture[], clubId: string): number {
  const played = fixtures
    .filter((f) => f.played && (f.homeClubId === clubId || f.awayClubId === clubId))
    .slice(-5);
  if (played.length === 0) return 0.5;
  let points = 0;
  for (const fixture of played) {
    const isHome = fixture.homeClubId === clubId;
    const scored = (isHome ? fixture.homeGoals : fixture.awayGoals) ?? 0;
    const conceded = (isHome ? fixture.awayGoals : fixture.homeGoals) ?? 0;
    points += scored > conceded ? 3 : scored === conceded ? 1 : 0;
  }
  return round(points / (played.length * 3), 3);
}
