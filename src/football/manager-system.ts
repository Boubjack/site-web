/**
 * Infinity Football — Mode Entraîneur
 *
 * Tome V intégralement : recrutement mondial avec recruteurs de niveaux
 * différents, tactiques personnalisées avec IA adverse qui s'adapte, séances
 * d'entraînement à effets réels, relations avec joueurs/dirigeants/médias/
 * supporters/arbitres/confrères, staff aux avantages concrets, objectifs fixés
 * par les dirigeants, et héritage (statue, tribune, documentaire, Hall of Fame).
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { CLUBS, getClub } from '../data/clubs.js';
import { NAME_POOLS } from '../data/names.js';
import { createPlayer, baseRating, type PlayerState, type Position } from '../career/player.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';
import { TacticalMemory, defaultTactics, type Tactics } from './tactics.js';

export const MANAGER_SERVICE = 'manager';

export type StaffRole =
  | 'entraîneur adjoint'
  | 'préparateur physique'
  | 'analyste vidéo'
  | 'médecin'
  | 'psychologue'
  | 'recruteur'
  | 'nutritionniste';

export interface StaffMember {
  readonly id: string;
  readonly name: string;
  readonly role: StaffRole;
  /** Compétence 0..100. */
  readonly ability: number;
  readonly monthlySalary: number;
  loyalty: number;
  readonly hiredAt: number;
}

export interface Scout {
  readonly id: string;
  readonly name: string;
  /** Fiabilité des rapports 0..1 : un mauvais recruteur se trompe. */
  readonly accuracy: number;
  /** Réseau : nombre de pays couverts. */
  readonly network: number;
  readonly monthlySalary: number;
  /** Mission en cours. */
  assignment: ScoutAssignment | null;
}

export interface ScoutAssignment {
  readonly countryId: string;
  readonly positionFocus: Position | null;
  readonly maxAge: number;
  readonly startedAt: number;
  readonly durationDays: number;
}

export interface ScoutReport {
  readonly id: string;
  readonly scoutId: string;
  readonly playerId: string;
  readonly playerName: string;
  readonly age: number;
  readonly position: Position;
  readonly countryId: string;
  /** Note estimée : bruitée selon la fiabilité du recruteur. */
  readonly estimatedRating: number;
  readonly estimatedPotential: number;
  /** Note réelle, invisible pour le joueur mais utilisée à la signature. */
  readonly actualRating: number;
  readonly actualPotential: number;
  readonly askingPrice: number;
  readonly at: number;
}

export type TrainingFocus = 'physique' | 'technique' | 'tactique' | 'mental';

export interface TrainingSession {
  readonly id: string;
  readonly name: string;
  readonly focus: TrainingFocus;
  /** Intensité 0..1. */
  readonly intensity: number;
  readonly durationMinutes: number;
  /** Drills composant la séance. */
  readonly drills: readonly string[];
}

export interface RelationshipState {
  players: number;
  board: number;
  media: number;
  supporters: number;
  referees: number;
  peers: number;
}

export interface ClubObjective {
  readonly id: string;
  readonly kind: 'championnat' | 'coupe' | 'ligue des champions' | 'finances' | 'formation';
  readonly description: string;
  /** Cible chiffrée (place au classement, tour atteint, solde…). */
  readonly target: number;
  progress: number;
  achieved: boolean;
  /** Poids dans la satisfaction des dirigeants. */
  readonly weight: number;
}

export interface ManagerLegacy {
  statue: boolean;
  standNamed: boolean;
  documentary: boolean;
  clubHallOfFame: boolean;
  seasonsInCharge: number;
  trophiesWon: number;
}

const DRILLS: Record<TrainingFocus, readonly string[]> = {
  physique: ['fractionné', 'pliométrie', 'circuit force', 'récupération active', 'vitesse sur 30 m'],
  technique: ['conservation en carré', 'centres et finitions', 'coups de pied arrêtés', 'jeu de tête', 'contrôles orientés'],
  tactique: ['bloc équipe', 'pressing coordonné', 'transitions offensives', 'défense de zone', 'sorties de balle'],
  mental: ['gestion de la pression', 'séance vidéo individuelle', 'cohésion de groupe', 'visualisation', 'travail avec le psychologue'],
};

const STAFF_SALARIES: Record<StaffRole, number> = {
  'entraîneur adjoint': 18_000,
  'préparateur physique': 12_000,
  'analyste vidéo': 9_000,
  médecin: 14_000,
  psychologue: 8_500,
  recruteur: 7_500,
  nutritionniste: 6_500,
};

export class ManagerSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'manager',
    name: 'Mode Entraîneur',
    order: 120,
    tomes: ['V', 'XXIX'],
  };

  private context!: SimulationContext;
  private seasons!: SeasonSystem;

  private clubId: string | null = null;
  private tactics: Tactics = defaultTactics();
  private readonly tacticalMemory = new TacticalMemory();
  private readonly staff = new Map<string, StaffMember>();
  private readonly scouts = new Map<string, Scout>();
  private readonly reports: ScoutReport[] = [];
  private readonly shortlist = new Set<string>();
  private readonly sessions = new Map<string, TrainingSession>();
  private weeklyPlan: string[] = [];
  private relationships: RelationshipState = {
    players: 0.5,
    board: 0.5,
    media: 0.5,
    supporters: 0.5,
    referees: 0.5,
    peers: 0.5,
  };
  private objectives: ClubObjective[] = [];
  private legacy: ManagerLegacy = {
    statue: false,
    standNamed: false,
    documentary: false,
    clubHallOfFame: false,
    seasonsInCharge: 0,
    trophiesWon: 0,
  };
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(MANAGER_SERVICE, this);
    this.createDefaultSessions();
  }

  /** Prise de fonction dans un club. */
  takeCharge(clubId: string): void {
    this.clubId = clubId;
    this.objectives = this.buildObjectives(clubId);
    this.legacy = {
      statue: false,
      standNamed: false,
      documentary: false,
      clubHallOfFame: false,
      seasonsInCharge: 0,
      trophiesWon: 0,
    };
    this.context.logger.info('prise de fonction (entraîneur)', { club: getClub(clubId).name });
  }

  get club(): string | null {
    return this.clubId;
  }

  get inCharge(): boolean {
    return this.clubId !== null;
  }

  // ── Tactiques (Tome V, ch. 3) ────────────────────────────────────────────

  setTactics(tactics: Tactics): void {
    this.tactics = tactics;
  }

  get currentTactics(): Tactics {
    return this.tactics;
  }

  /** Plan de match adapté à un adversaire déjà rencontré. */
  planAgainst(opponentClubId: string): Tactics {
    return this.tacticalMemory.counterPlan(opponentClubId, this.tactics);
  }

  /** Après un match : l'IA enregistre le style adverse pour s'y adapter. */
  observeOpponent(opponentClubId: string, opponentTactics: Tactics, threat: number): void {
    this.tacticalMemory.observe(opponentClubId, opponentTactics, clamp01(threat));
  }

  opponentProfile(opponentClubId: string) {
    return this.tacticalMemory.profile(opponentClubId);
  }

  // ── Staff (Tome V, ch. 6) ────────────────────────────────────────────────

  hireStaff(role: StaffRole, ability: number, name?: string): StaffMember {
    const rng = this.context.stream('manager.staff');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    const member: StaffMember = {
      id: `staff:${this.counter++}`,
      name: name ?? `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
      role,
      ability: clamp(ability, 1, 100),
      monthlySalary: Math.round(STAFF_SALARIES[role] * (0.5 + ability / 100)),
      loyalty: 0.5,
      hiredAt: this.context.clock.absoluteMinutes,
    };
    this.staff.set(member.id, member);
    return member;
  }

  dismissStaff(staffId: string): boolean {
    return this.staff.delete(staffId);
  }

  get staffList(): StaffMember[] {
    return [...this.staff.values()];
  }

  /**
   * Bénéfices concrets apportés par le staff — chaque membre a un effet réel
   * (Tome V, ch. 6 : « chaque membre apporte de véritables avantages »).
   */
  staffBonuses(): {
    trainingEfficiency: number;
    injuryReduction: number;
    recoverySpeed: number;
    moraleSupport: number;
    scoutingAccuracy: number;
    tacticalInsight: number;
    conditionRetention: number;
  } {
    const best = (role: StaffRole): number => {
      let value = 0;
      for (const member of this.staff.values()) {
        if (member.role === role) value = Math.max(value, member.ability / 100);
      }
      return value;
    };
    return {
      trainingEfficiency: 1 + best('entraîneur adjoint') * 0.25,
      injuryReduction: 1 - best('médecin') * 0.35,
      recoverySpeed: 1 + best('médecin') * 0.4 + best('nutritionniste') * 0.2,
      moraleSupport: best('psychologue') * 0.5,
      scoutingAccuracy: best('recruteur') * 0.4,
      tacticalInsight: best('analyste vidéo') * 0.5,
      conditionRetention: 1 + best('préparateur physique') * 0.3,
    };
  }

  // ── Recrutement (Tome V, ch. 2) ──────────────────────────────────────────

  hireScout(accuracy: number, network: number, name?: string): Scout {
    const rng = this.context.stream('manager.scouts');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    const scout: Scout = {
      id: `scout:${this.counter++}`,
      name: name ?? `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
      accuracy: clamp01(accuracy),
      network: Math.max(1, Math.round(network)),
      monthlySalary: Math.round(4_000 + accuracy * 9_000 + network * 400),
      assignment: null,
    };
    this.scouts.set(scout.id, scout);
    return scout;
  }

  get scoutList(): Scout[] {
    return [...this.scouts.values()];
  }

  /** Envoie un recruteur en mission dans un pays donné. */
  assignScout(
    scoutId: string,
    countryId: string,
    options: { positionFocus?: Position; maxAge?: number; durationDays?: number } = {},
  ): boolean {
    const scout = this.scouts.get(scoutId);
    if (!scout) return false;
    scout.assignment = {
      countryId,
      positionFocus: options.positionFocus ?? null,
      maxAge: options.maxAge ?? 23,
      startedAt: this.context.clock.absoluteMinutes,
      durationDays: options.durationDays ?? 21,
    };
    return true;
  }

  /** Observation directe d'un match en direct : rapport immédiat et fiable. */
  watchLive(playerName: string, countryId: string, position: Position, age: number): ScoutReport {
    const rng = this.context.stream('manager.live');
    const actualRating = clamp(rng.gaussian(65, 10), 30, 92);
    const actualPotential = clamp(actualRating + rng.range(2, 22), actualRating, 96);
    return this.pushReport({
      scoutId: 'observation directe',
      playerName,
      age,
      position,
      countryId,
      actualRating,
      actualPotential,
      accuracy: 0.92,
      rng,
    });
  }

  /** Essai organisé au club : la marge d'erreur devient très faible. */
  organiseTrial(reportId: string): { retained: boolean; revealedRating: number } | null {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return null;
    const rng = this.context.stream('manager.trial');
    const revealed = clamp(report.actualRating + rng.range(-1.5, 1.5), 1, 99);
    const retained = revealed >= 60 || report.actualPotential >= 78;
    if (retained) this.shortlist.add(report.id);
    return { retained, revealedRating: round(revealed, 1) };
  }

  get scoutReports(): readonly ScoutReport[] {
    return this.reports;
  }

  get shortlistedReports(): ScoutReport[] {
    return this.reports.filter((r) => this.shortlist.has(r.id));
  }

  shortlistPlayer(reportId: string): boolean {
    if (!this.reports.some((r) => r.id === reportId)) return false;
    this.shortlist.add(reportId);
    return true;
  }

  /** Analyse statistique avancée d'un rapport, enrichie par l'analyste vidéo. */
  analyseReport(reportId: string): Record<string, number> | null {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return null;
    const insight = this.staffBonuses().tacticalInsight;
    const rng = this.context.stream('manager.analysis');
    const noise = (1 - insight) * 6;
    return {
      noteEstimée: round(report.estimatedRating, 1),
      potentielEstimé: round(report.estimatedPotential, 1),
      minutesJouées: Math.round(rng.range(600, 3200)),
      butsAttendus: round(rng.range(0.05, 0.8) + rng.gaussian(0, noise / 40), 2),
      passesProgressives: Math.round(rng.range(20, 160)),
      duelsGagnésPourcent: round(rng.range(38, 68) + rng.gaussian(0, noise), 1),
      intensitéCourse: round(rng.range(0.5, 1), 2),
    };
  }

  private pushReport(input: {
    scoutId: string;
    playerName: string;
    age: number;
    position: Position;
    countryId: string;
    actualRating: number;
    actualPotential: number;
    accuracy: number;
    rng: Rng;
  }): ScoutReport {
    const errorMargin = (1 - clamp01(input.accuracy + this.staffBonuses().scoutingAccuracy)) * 18;
    const report: ScoutReport = {
      id: `report:${this.counter++}`,
      scoutId: input.scoutId,
      playerId: `prospect:${this.counter}`,
      playerName: input.playerName,
      age: input.age,
      position: input.position,
      countryId: input.countryId,
      estimatedRating: round(clamp(input.actualRating + input.rng.gaussian(0, errorMargin), 1, 99), 1),
      estimatedPotential: round(clamp(input.actualPotential + input.rng.gaussian(0, errorMargin * 1.4), 1, 99), 1),
      actualRating: round(input.actualRating, 1),
      actualPotential: round(input.actualPotential, 1),
      askingPrice: Math.round(Math.pow(input.actualRating / 10, 4.2) * 90_000),
      at: this.context.clock.absoluteMinutes,
    };
    this.reports.push(report);
    if (this.reports.length > 400) this.reports.splice(0, this.reports.length - 400);
    this.context.emit({
      type: 'club.scouting',
      scoutId: input.scoutId,
      targetId: report.playerId,
      accuracy: round(input.accuracy, 3),
      potential: report.actualPotential,
    });
    return report;
  }

  /** Concrétise un recrutement : produit un joueur réel à partir du rapport. */
  signProspect(reportId: string, rng?: Rng): PlayerState | null {
    const report = this.reports.find((r) => r.id === reportId);
    if (!report) return null;
    const stream = rng ?? this.context.stream('manager.signings');
    return createPlayer(
      {
        id: report.playerId,
        name: report.playerName,
        nationality: report.countryId,
        position: report.position,
        age: report.age,
        startingYear: this.context.clock.date.year,
        quality: report.actualRating / 100,
        potential: report.actualPotential,
      },
      stream,
    );
  }

  // ── Entraînements (Tome V, ch. 4) ────────────────────────────────────────

  private createDefaultSessions(): void {
    const presets: Array<{ name: string; focus: TrainingFocus; intensity: number; minutes: number }> = [
      { name: 'Reprise athlétique', focus: 'physique', intensity: 0.75, minutes: 90 },
      { name: 'Récupération', focus: 'physique', intensity: 0.25, minutes: 45 },
      { name: 'Finition', focus: 'technique', intensity: 0.6, minutes: 75 },
      { name: 'Circulation de balle', focus: 'technique', intensity: 0.5, minutes: 80 },
      { name: 'Bloc défensif', focus: 'tactique', intensity: 0.55, minutes: 70 },
      { name: 'Pressing coordonné', focus: 'tactique', intensity: 0.8, minutes: 85 },
      { name: 'Préparation mentale', focus: 'mental', intensity: 0.3, minutes: 50 },
    ];
    for (const preset of presets) {
      const session: TrainingSession = {
        id: `session:${preset.name.toLowerCase().replace(/\s+/g, '-')}`,
        name: preset.name,
        focus: preset.focus,
        intensity: preset.intensity,
        durationMinutes: preset.minutes,
        drills: DRILLS[preset.focus].slice(0, 3),
      };
      this.sessions.set(session.id, session);
    }
    this.weeklyPlan = [
      'session:récupération',
      'session:circulation-de-balle',
      'session:bloc-défensif',
      'session:finition',
      'session:pressing-coordonné',
      'session:préparation-mentale',
      'session:récupération',
    ];
  }

  /** Crée une séance sur mesure. */
  createSession(
    name: string,
    focus: TrainingFocus,
    intensity: number,
    durationMinutes: number,
    drills?: readonly string[],
  ): TrainingSession {
    const session: TrainingSession = {
      id: `session:${this.counter++}`,
      name,
      focus,
      intensity: clamp01(intensity),
      durationMinutes,
      drills: drills ?? DRILLS[focus],
    };
    this.sessions.set(session.id, session);
    return session;
  }

  get sessionLibrary(): TrainingSession[] {
    return [...this.sessions.values()];
  }

  setWeeklyPlan(sessionIds: readonly string[]): boolean {
    if (sessionIds.some((id) => !this.sessions.has(id))) return false;
    this.weeklyPlan = [...sessionIds];
    return true;
  }

  get plan(): readonly string[] {
    return this.weeklyPlan;
  }

  /**
   * Applique une séance à l'effectif : progression, fatigue, moral et risque
   * de blessure, modulés par le staff.
   */
  runSession(sessionId: string, squadSize: number): {
    progress: number;
    fatigue: number;
    moraleDelta: number;
    injuries: number;
  } | null {
    const session = this.sessions.get(sessionId);
    if (!session) return null;
    const bonuses = this.staffBonuses();
    const rng = this.context.stream('manager.training');

    const progress = round(
      session.intensity * (session.durationMinutes / 90) * bonuses.trainingEfficiency * 0.8,
      3,
    );
    const fatigue = round(session.intensity * 0.18 / bonuses.conditionRetention, 3);
    const moraleDelta = round(
      (session.focus === 'mental' ? 0.05 : 0) + bonuses.moraleSupport * 0.04 - (session.intensity > 0.85 ? 0.03 : 0),
      3,
    );

    let injuries = 0;
    const risk = session.intensity * 0.02 * bonuses.injuryReduction;
    for (let i = 0; i < squadSize; i++) {
      if (rng.chance(risk)) injuries++;
    }

    this.context.emit({
      type: 'club.training',
      sessionId: session.id,
      focus: session.focus,
      intensity: session.intensity,
      injuryRisk: round(risk, 4),
    });
    return { progress, fatigue, moraleDelta, injuries };
  }

  // ── Relations (Tome V, ch. 5) ────────────────────────────────────────────

  get relations(): RelationshipState {
    return { ...this.relationships };
  }

  adjustRelation(target: keyof RelationshipState, delta: number): void {
    this.relationships[target] = clamp01(this.relationships[target] + delta);
  }

  /**
   * Réponse en conférence de presse : l'effet diffère selon l'interlocuteur.
   * Défendre son groupe rapproche les joueurs mais peut irriter la presse.
   */
  pressAnswer(
    tone: 'protecteur' | 'critique interne' | 'provocateur' | 'consensuel' | 'humoristique',
  ): RelationshipState {
    const table: Record<typeof tone, Partial<RelationshipState>> = {
      protecteur: { players: 0.08, media: -0.03, supporters: 0.02 },
      'critique interne': { players: -0.12, board: 0.04, media: 0.06 },
      provocateur: { media: 0.05, supporters: 0.06, referees: -0.08, peers: -0.1 },
      consensuel: { media: 0.02, board: 0.03, players: 0.01 },
      humoristique: { media: 0.07, supporters: 0.05, board: -0.01 },
    };
    for (const [key, delta] of Object.entries(table[tone]) as [keyof RelationshipState, number][]) {
      this.adjustRelation(key, delta);
    }
    return this.relations;
  }

  // ── Objectifs (Tome V, ch. 7) ────────────────────────────────────────────

  private buildObjectives(clubId: string): ClubObjective[] {
    const club = getClub(clubId);
    const rank = [...CLUBS].sort((a, b) => b.prestige - a.prestige).findIndex((c) => c.id === clubId);
    const leagueSize = Math.max(4, CLUBS.filter((c) => c.leagueId === club.leagueId).length);
    const expectedPosition = clamp(Math.round((rank / CLUBS.length) * leagueSize) + 1, 1, leagueSize);

    const objectives: ClubObjective[] = [
      {
        id: 'obj:league',
        kind: 'championnat',
        description: `Terminer au minimum ${expectedPosition}e du championnat`,
        target: expectedPosition,
        progress: 0,
        achieved: false,
        weight: 0.4,
      },
      {
        id: 'obj:cup',
        kind: 'coupe',
        description: 'Atteindre au moins les quarts de finale de la coupe nationale',
        target: 3,
        progress: 0,
        achieved: false,
        weight: 0.15,
      },
      {
        id: 'obj:finance',
        kind: 'finances',
        description: 'Maintenir un budget à l’équilibre',
        target: 0,
        progress: 0,
        achieved: false,
        weight: 0.2,
      },
      {
        id: 'obj:academy',
        kind: 'formation',
        description: 'Lancer au moins deux jeunes de l’académie en équipe première',
        target: 2,
        progress: 0,
        achieved: false,
        weight: 0.15,
      },
    ];
    if (club.prestige >= 85) {
      objectives.push({
        id: 'obj:ucl',
        kind: 'ligue des champions',
        description: 'Atteindre les demi-finales continentales',
        target: 4,
        progress: 0,
        achieved: false,
        weight: 0.25,
      });
    }
    return objectives;
  }

  get clubObjectives(): readonly ClubObjective[] {
    return this.objectives;
  }

  updateObjective(objectiveId: string, progress: number): void {
    const objective = this.objectives.find((o) => o.id === objectiveId);
    if (!objective) return;
    objective.progress = progress;
    objective.achieved =
      objective.kind === 'championnat' ? progress <= objective.target : progress >= objective.target;
  }

  /** Satisfaction des dirigeants : conditionne l'avenir de l'entraîneur. */
  boardSatisfaction(): number {
    if (this.objectives.length === 0) return this.relationships.board;
    let weighted = 0;
    let total = 0;
    for (const objective of this.objectives) {
      weighted += (objective.achieved ? 1 : clamp01(objective.progress / Math.max(1, objective.target))) * objective.weight;
      total += objective.weight;
    }
    const objectiveScore = total > 0 ? weighted / total : 0.5;
    return round(clamp01(objectiveScore * 0.7 + this.relationships.board * 0.3), 3);
  }

  /** L'entraîneur est-il menacé ? */
  get underPressure(): boolean {
    return this.boardSatisfaction() < 0.35;
  }

  // ── Héritage (Tome V, ch. 8) ─────────────────────────────────────────────

  get managerLegacy(): ManagerLegacy {
    return { ...this.legacy };
  }

  recordTrophy(): void {
    this.legacy.trophiesWon++;
    this.evaluateLegacy();
  }

  private evaluateLegacy(): void {
    const before = { ...this.legacy };
    if (this.legacy.trophiesWon >= 2 && this.legacy.seasonsInCharge >= 3) this.legacy.standNamed = true;
    if (this.legacy.trophiesWon >= 4 && this.legacy.seasonsInCharge >= 5) this.legacy.statue = true;
    if (this.legacy.seasonsInCharge >= 6) this.legacy.documentary = true;
    if (this.legacy.trophiesWon >= 3 || this.legacy.seasonsInCharge >= 8) this.legacy.clubHallOfFame = true;

    if (this.clubId) {
      const club = getClub(this.clubId);
      if (!before.statue && this.legacy.statue) {
        this.context.emit({ type: 'legacy.monument', kind: 'statue', personId: 'manager', cityId: club.cityId });
      }
      if (!before.standNamed && this.legacy.standNamed) {
        this.context.emit({ type: 'legacy.monument', kind: 'stand', personId: 'manager', cityId: club.cityId });
      }
    }
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;
    const now = context.clock.absoluteMinutes;
    const rng = context.stream('manager.scouting');

    for (const scout of this.scouts.values()) {
      const assignment = scout.assignment;
      if (!assignment) continue;
      const elapsedDays = (now - assignment.startedAt) / (24 * 60);
      if (elapsedDays < 1) continue;
      // Un recruteur remonte des rapports au fil de la mission.
      if (!rng.chance(0.2 + scout.network * 0.02)) continue;

      const pool =
        NAME_POOLS.find((p) => p.countryIds.includes(assignment.countryId)) ??
        (NAME_POOLS[0] as (typeof NAME_POOLS)[number]);
      const positions: Position[] = ['GB', 'DC', 'DD', 'DG', 'MDC', 'MC', 'MOC', 'AD', 'AG', 'BU'];
      const position = assignment.positionFocus ?? rng.pick(positions);
      const age = rng.int(16, assignment.maxAge);
      const actualRating = clamp(rng.gaussian(58 + scout.network * 0.4, 11), 25, 90);
      const actualPotential = clamp(actualRating + rng.range(3, 28), actualRating, 97);

      this.pushReport({
        scoutId: scout.id,
        playerName: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
        age,
        position,
        countryId: assignment.countryId,
        actualRating,
        actualPotential,
        accuracy: scout.accuracy,
        rng,
      });

      if (elapsedDays >= assignment.durationDays) scout.assignment = null;
    }
  }

  onMonth(context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;
    // Le solde financier du club influence l'objectif « finances ».
    const strength = this.seasons.strengthOf(this.clubId);
    this.updateObjective('obj:finance', clamp01(strength / 100));

    // Le staff gagne en loyauté ; un staff sous-payé s'en va.
    for (const member of this.staff.values()) {
      member.loyalty = clamp01(member.loyalty + 0.02);
    }
    void context;
  }

  onYear(_context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;
    this.legacy.seasonsInCharge++;
    this.evaluateLegacy();

    // Classement final : mise à jour de l'objectif championnat.
    const club = getClub(this.clubId);
    const standings = this.seasons.standings(club.leagueId);
    const position = standings.findIndex((row) => row.clubId === this.clubId) + 1;
    if (position > 0) this.updateObjective('obj:league', position);
  }

  serialize(): unknown {
    return {
      clubId: this.clubId,
      tactics: this.tactics,
      tacticalMemory: this.tacticalMemory.serialize(),
      staff: [...this.staff.values()],
      scouts: [...this.scouts.values()],
      reports: this.reports.slice(-200),
      shortlist: [...this.shortlist],
      sessions: [...this.sessions.values()],
      weeklyPlan: this.weeklyPlan,
      relationships: this.relationships,
      objectives: this.objectives,
      legacy: this.legacy,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.clubId = (state.clubId as string | null) ?? null;
    if (state.tactics) this.tactics = state.tactics as Tactics;
    this.tacticalMemory.restore((state.tacticalMemory as never[]) ?? []);
    this.staff.clear();
    for (const member of (state.staff as StaffMember[]) ?? []) this.staff.set(member.id, member);
    this.scouts.clear();
    for (const scout of (state.scouts as Scout[]) ?? []) this.scouts.set(scout.id, scout);
    this.reports.length = 0;
    this.reports.push(...(((state.reports as ScoutReport[]) ?? [])));
    this.shortlist.clear();
    for (const id of (state.shortlist as string[]) ?? []) this.shortlist.add(id);
    this.sessions.clear();
    for (const session of (state.sessions as TrainingSession[]) ?? []) this.sessions.set(session.id, session);
    if (this.sessions.size === 0) this.createDefaultSessions();
    this.weeklyPlan = (state.weeklyPlan as string[]) ?? this.weeklyPlan;
    if (state.relationships) this.relationships = state.relationships as RelationshipState;
    this.objectives = (state.objectives as ClubObjective[]) ?? [];
    if (state.legacy) this.legacy = state.legacy as ManagerLegacy;
    this.counter = (state.counter as number) ?? 0;
  }
}

/** Note d'un rapport de scouting confrontée à la réalité, pour le débriefing. */
export function scoutingError(report: ScoutReport): number {
  return round(Math.abs(report.estimatedRating - report.actualRating), 2);
}

/** Meilleur onze théorique à partir d'un effectif, selon la formation choisie. */
export function pickBestEleven(
  squad: readonly PlayerState[],
  tactics: Tactics,
): Array<{ position: Position; player: PlayerState | null }> {
  const used = new Set<string>();
  return tactics.formation.slots.map((slot) => {
    let best: PlayerState | null = null;
    let bestScore = -Infinity;
    for (const player of squad) {
      if (used.has(player.identity.id)) continue;
      const natural = player.identity.position === slot.position;
      const secondary = player.identity.secondaryPositions.includes(slot.position);
      const penalty = natural ? 1 : secondary ? 0.92 : 0.78;
      const score = baseRating(player, slot.position) * penalty;
      if (score > bestScore) {
        bestScore = score;
        best = player;
      }
    }
    if (best) used.add(best.identity.id);
    return { position: slot.position, player: best };
  });
}
