/**
 * Infinity Football — Mode Président
 *
 * Tome VI intégralement : finances (budget, masse salariale, sponsors,
 * merchandising, billetterie, droits TV, investissements) avec tableaux de bord
 * permanents, construction et rénovation du stade, centre d'entraînement,
 * académie, marketing, conseil d'administration et héritage présidentiel.
 * Tome XXIX, ch. 3 et ch. 7 : évolution des stades avec travaux visibles, et
 * construction d'un stade entièrement personnalisable.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { getClub, getStadium, type ClubDef } from '../data/clubs.js';
import { NAME_POOLS } from '../data/names.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';

export const PRESIDENT_SERVICE = 'president';

export interface ClubFinances {
  /** Budget de fonctionnement annuel, en euros. */
  budget: number;
  /** Masse salariale annuelle. */
  wageBill: number;
  /** Revenus annuels par source. */
  sponsorship: number;
  merchandising: number;
  ticketing: number;
  broadcasting: number;
  /** Trésorerie disponible. */
  cash: number;
  /** Dette en cours. */
  debt: number;
}

export type StadiumUpgradeKind =
  | 'agrandissement'
  | 'toit'
  | 'pelouse'
  | 'éclairage'
  | 'écrans géants'
  | 'sièges'
  | 'panneaux LED'
  | 'musée'
  | 'boutiques'
  | 'restaurants'
  | 'espaces VIP'
  | 'parkings'
  | 'hôtel intégré';

export interface StadiumUpgrade {
  readonly id: string;
  readonly kind: StadiumUpgradeKind;
  readonly cost: number;
  readonly durationDays: number;
  readonly startedAt: number;
  progress: number;
  completed: boolean;
  /** Effet appliqué à la fin des travaux. */
  readonly effect: { capacity?: number; atmosphere?: number; revenue?: number; pitch?: number };
}

export interface TrainingFacility {
  pitches: number;
  gym: number;
  medicalCentre: number;
  performanceLab: number;
  youthAccommodation: number;
  recoveryAreas: number;
  coveredPitches: number;
  pools: number;
}

export interface AcademyState {
  /** Niveau global 0..100. */
  level: number;
  scoutingBudget: number;
  infrastructure: number;
  specialistCoaches: number;
  /** Jeunes actuellement en formation. */
  intake: number;
  /** Talents produits depuis le début du mandat. */
  graduatesProduced: number;
}

export type MarketingCampaignKind =
  | 'tournée estivale'
  | 'événement'
  | 'présentation officielle'
  | 'nouveau maillot'
  | 'collaboration de marque';

export interface MarketingCampaign {
  readonly id: string;
  readonly kind: MarketingCampaignKind;
  readonly name: string;
  readonly cost: number;
  readonly startedAt: number;
  readonly durationDays: number;
  /** Retour attendu sur l'image du club 0..1. */
  readonly imageGain: number;
  /** Revenu généré. */
  revenue: number;
  completed: boolean;
}

export interface BoardMember {
  readonly id: string;
  readonly name: string;
  readonly role: 'vice-président' | 'directeur financier' | 'directeur sportif' | 'actionnaire' | 'représentant des supporters';
  /** Tendance : prudent (0) ↔ ambitieux (1). */
  readonly appetite: number;
  /** Soutien au président -1..1. */
  support: number;
  readonly votingWeight: number;
}

export interface BoardDecision {
  readonly id: string;
  readonly topic: 'investissement' | 'projet' | 'budget' | 'objectif';
  readonly description: string;
  readonly cost: number;
  /** Risque perçu 0..1. */
  readonly risk: number;
  votes: Array<{ memberId: string; inFavour: boolean; reason: string }>;
  approved: boolean | null;
}

export interface PresidentLegacy {
  statue: boolean;
  museumOfMandate: boolean;
  trophiesDisplayed: number;
  documentary: boolean;
  seasonsInOffice: number;
  /** Rang parmi les plus grands présidents. */
  historicalRank: number | null;
}

export interface StadiumBlueprint {
  name: string;
  capacity: number;
  architecture: 'anneau moderne' | 'bol classique' | 'tribunes verticales' | 'arène futuriste' | 'stade paysager';
  colors: [string, string];
  giantScreens: number;
  roof: 'aucun' | 'partiel' | 'complet' | 'rétractable';
  museum: boolean;
  hotel: boolean;
  shoppingCentre: boolean;
  parkingSpaces: number;
}

const UPGRADE_CATALOGUE: Record<StadiumUpgradeKind, { cost: number; days: number; effect: StadiumUpgrade['effect'] }> = {
  agrandissement: { cost: 85_000_000, days: 420, effect: { capacity: 12_000, revenue: 6_500_000 } },
  toit: { cost: 42_000_000, days: 260, effect: { atmosphere: 0.06, revenue: 1_200_000 } },
  pelouse: { cost: 3_500_000, days: 45, effect: { pitch: 0.25 } },
  éclairage: { cost: 6_800_000, days: 60, effect: { atmosphere: 0.03 } },
  'écrans géants': { cost: 12_000_000, days: 90, effect: { atmosphere: 0.04, revenue: 900_000 } },
  sièges: { cost: 9_500_000, days: 120, effect: { atmosphere: 0.02, revenue: 700_000 } },
  'panneaux LED': { cost: 5_200_000, days: 50, effect: { revenue: 2_400_000 } },
  musée: { cost: 18_000_000, days: 200, effect: { revenue: 1_800_000 } },
  boutiques: { cost: 11_000_000, days: 150, effect: { revenue: 3_600_000 } },
  restaurants: { cost: 14_000_000, days: 170, effect: { revenue: 2_900_000 } },
  'espaces VIP': { cost: 26_000_000, days: 240, effect: { revenue: 7_400_000 } },
  parkings: { cost: 8_000_000, days: 110, effect: { revenue: 600_000 } },
  'hôtel intégré': { cost: 64_000_000, days: 520, effect: { revenue: 9_800_000 } },
};

export class PresidentSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'president',
    name: 'Mode Président',
    order: 125,
    tomes: ['VI', 'XXIX'],
  };

  private context!: SimulationContext;
  private seasons!: SeasonSystem;

  private clubId: string | null = null;
  private finances: ClubFinances = {
    budget: 0,
    wageBill: 0,
    sponsorship: 0,
    merchandising: 0,
    ticketing: 0,
    broadcasting: 0,
    cash: 0,
    debt: 0,
  };
  private stadiumCapacity = 0;
  private stadiumAtmosphere = 0.8;
  private pitchQuality = 0.95;
  private readonly upgrades = new Map<string, StadiumUpgrade>();
  private facility: TrainingFacility = {
    pitches: 3,
    gym: 50,
    medicalCentre: 50,
    performanceLab: 30,
    youthAccommodation: 40,
    recoveryAreas: 40,
    coveredPitches: 1,
    pools: 1,
  };
  private academy: AcademyState = {
    level: 50,
    scoutingBudget: 500_000,
    infrastructure: 50,
    specialistCoaches: 2,
    intake: 24,
    graduatesProduced: 0,
  };
  private readonly campaigns = new Map<string, MarketingCampaign>();
  private readonly board = new Map<string, BoardMember>();
  private readonly decisions = new Map<string, BoardDecision>();
  private clubImage = 0.5;
  private legacy: PresidentLegacy = {
    statue: false,
    museumOfMandate: false,
    trophiesDisplayed: 0,
    documentary: false,
    seasonsInOffice: 0,
    historicalRank: null,
  };
  private newStadium: StadiumBlueprint | null = null;
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(PRESIDENT_SERVICE, this);
  }

  /** Prise de fonction : initialise finances, stade et conseil. */
  takeOffice(clubId: string): void {
    const club = getClub(clubId);
    const stadium = getStadium(club.stadiumId);
    this.clubId = clubId;
    this.stadiumCapacity = stadium.capacity;
    this.stadiumAtmosphere = stadium.atmosphere;
    this.pitchQuality = 0.95;
    this.finances = this.initialFinances(club, stadium.capacity);
    this.facility = {
      pitches: Math.round(2 + club.facilities / 25),
      gym: club.facilities,
      medicalCentre: club.facilities,
      performanceLab: Math.round(club.facilities * 0.8),
      youthAccommodation: club.academy,
      recoveryAreas: Math.round(club.facilities * 0.9),
      coveredPitches: club.facilities > 80 ? 2 : 1,
      pools: club.facilities > 70 ? 2 : 1,
    };
    this.academy = {
      level: club.academy,
      scoutingBudget: Math.round(club.budgetM * 1_000_000 * 0.01),
      infrastructure: club.academy,
      specialistCoaches: Math.round(club.academy / 25),
      intake: Math.round(16 + club.academy / 4),
      graduatesProduced: 0,
    };
    this.clubImage = clamp01(club.prestige / 100);
    this.buildBoard(club);
    this.context.logger.info('prise de fonction (président)', { club: club.name });
  }

  private initialFinances(club: ClubDef, capacity: number): ClubFinances {
    const budget = club.budgetM * 1_000_000;
    return {
      budget,
      wageBill: round(budget * 0.58, 2),
      sponsorship: round(budget * 0.22, 2),
      merchandising: round(budget * 0.14, 2),
      ticketing: round(capacity * 19 * 25, 2),
      broadcasting: round(budget * 0.34, 2),
      cash: round(budget * 0.18, 2),
      debt: round(budget * 0.12, 2),
    };
  }

  private buildBoard(club: ClubDef): void {
    const rng = this.context.stream('president.board');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    const roles: BoardMember['role'][] = [
      'vice-président',
      'directeur financier',
      'directeur sportif',
      'actionnaire',
      'représentant des supporters',
    ];
    this.board.clear();
    for (const role of roles) {
      const member: BoardMember = {
        id: `board:${this.counter++}`,
        name: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
        role,
        appetite:
          role === 'directeur financier' ? clamp01(rng.gaussian(0.25, 0.12)) :
          role === 'actionnaire' ? clamp01(rng.gaussian(0.7, 0.15)) :
          role === 'représentant des supporters' ? clamp01(rng.gaussian(0.6, 0.15)) :
          clamp01(rng.gaussian(0.5, 0.18)),
        support: clamp(rng.gaussian(club.prestige / 140, 0.2), -1, 1),
        votingWeight:
          role === 'actionnaire' ? 2 : role === 'vice-président' ? 1.5 : 1,
      };
      this.board.set(member.id, member);
    }
  }

  get inOffice(): boolean {
    return this.clubId !== null;
  }

  get club(): string | null {
    return this.clubId;
  }

  // ── Finances (Tome VI, ch. 2) ────────────────────────────────────────────

  /** Tableau de bord détaillé, disponible en permanence. */
  dashboard(): {
    finances: ClubFinances;
    annualRevenue: number;
    annualCosts: number;
    result: number;
    wageRatio: number;
    stadium: { capacity: number; atmosphere: number; pitch: number; worksInProgress: number };
    academy: AcademyState;
    image: number;
    boardSupport: number;
  } {
    const annualRevenue =
      this.finances.sponsorship +
      this.finances.merchandising +
      this.finances.ticketing +
      this.finances.broadcasting;
    const annualCosts = this.finances.wageBill + this.finances.budget * 0.18 + this.finances.debt * 0.045;
    return {
      finances: { ...this.finances },
      annualRevenue: round(annualRevenue, 2),
      annualCosts: round(annualCosts, 2),
      result: round(annualRevenue - annualCosts, 2),
      wageRatio: round(this.finances.wageBill / Math.max(1, annualRevenue), 3),
      stadium: {
        capacity: this.stadiumCapacity,
        atmosphere: round(this.stadiumAtmosphere, 3),
        pitch: round(this.pitchQuality, 3),
        worksInProgress: [...this.upgrades.values()].filter((u) => !u.completed).length,
      },
      academy: { ...this.academy },
      image: round(this.clubImage, 3),
      boardSupport: this.boardSupport(),
    };
  }

  setWageBill(amount: number): boolean {
    if (amount < 0) return false;
    this.finances.wageBill = round(amount, 2);
    return true;
  }

  negotiateSponsorship(target: number): { accepted: boolean; agreed: number } {
    const ceiling = this.finances.budget * (0.18 + this.clubImage * 0.22);
    const agreed = Math.min(target, ceiling);
    const accepted = target <= ceiling;
    this.finances.sponsorship = round(agreed, 2);
    return { accepted, agreed: round(agreed, 2) };
  }

  setTicketPrice(averagePrice: number): void {
    const attendanceFactor = clamp01(1.25 - averagePrice / 90);
    this.finances.ticketing = round(this.stadiumCapacity * averagePrice * 25 * attendanceFactor, 2);
  }

  takeLoan(amount: number, years: number): boolean {
    if (amount <= 0 || amount > this.finances.budget * 1.5) return false;
    this.finances.cash = round(this.finances.cash + amount, 2);
    this.finances.debt = round(this.finances.debt + amount * (1 + 0.045 * years), 2);
    return true;
  }

  repayDebt(amount: number): boolean {
    if (amount <= 0 || amount > this.finances.cash) return false;
    const repaid = Math.min(amount, this.finances.debt);
    this.finances.cash = round(this.finances.cash - repaid, 2);
    this.finances.debt = round(this.finances.debt - repaid, 2);
    return true;
  }

  // ── Stade (Tome VI, ch. 3 ; Tome XXIX, ch. 3) ────────────────────────────

  /** Lance des travaux : le chantier est visible pendant sa durée. */
  startUpgrade(kind: StadiumUpgradeKind): StadiumUpgrade | null {
    const spec = UPGRADE_CATALOGUE[kind];
    if (this.finances.cash < spec.cost) return null;
    this.finances.cash = round(this.finances.cash - spec.cost, 2);
    const upgrade: StadiumUpgrade = {
      id: `upgrade:${this.counter++}`,
      kind,
      cost: spec.cost,
      durationDays: spec.days,
      startedAt: this.context.clock.absoluteMinutes,
      progress: 0,
      completed: false,
      effect: spec.effect,
    };
    this.upgrades.set(upgrade.id, upgrade);
    this.context.emit({
      type: 'club.stadiumWorks',
      stadiumId: this.stadiumId(),
      upgradeId: upgrade.id,
      stage: 'started',
      progress: 0,
    });
    return upgrade;
  }

  get stadiumWorks(): StadiumUpgrade[] {
    return [...this.upgrades.values()];
  }

  get upgradeCatalogue(): typeof UPGRADE_CATALOGUE {
    return UPGRADE_CATALOGUE;
  }

  /** Tome XXIX, ch. 7 — construire un stade entièrement personnalisable. */
  designNewStadium(blueprint: StadiumBlueprint): { cost: number; durationDays: number; affordable: boolean } {
    const base = blueprint.capacity * 4_200;
    const roofCost =
      blueprint.roof === 'rétractable' ? 120_000_000 :
      blueprint.roof === 'complet' ? 70_000_000 :
      blueprint.roof === 'partiel' ? 30_000_000 : 0;
    const extras =
      (blueprint.museum ? 18_000_000 : 0) +
      (blueprint.hotel ? 64_000_000 : 0) +
      (blueprint.shoppingCentre ? 46_000_000 : 0) +
      blueprint.giantScreens * 6_000_000 +
      blueprint.parkingSpaces * 9_000;
    const cost = Math.round(base + roofCost + extras);
    const durationDays = Math.round(600 + blueprint.capacity / 120 + (blueprint.roof === 'rétractable' ? 260 : 0));
    return { cost, durationDays, affordable: this.finances.cash + this.finances.budget * 0.5 >= cost };
  }

  /** Valide la construction : le chantier démarre pour plusieurs saisons. */
  buildNewStadium(blueprint: StadiumBlueprint): StadiumUpgrade | null {
    const quote = this.designNewStadium(blueprint);
    if (!quote.affordable) return null;
    const financed = Math.max(0, quote.cost - this.finances.cash);
    this.finances.cash = round(Math.max(0, this.finances.cash - quote.cost), 2);
    if (financed > 0) this.takeLoan(financed, 15);

    this.newStadium = blueprint;
    const upgrade: StadiumUpgrade = {
      id: `stadium:new:${this.counter++}`,
      kind: 'agrandissement',
      cost: quote.cost,
      durationDays: quote.durationDays,
      startedAt: this.context.clock.absoluteMinutes,
      progress: 0,
      completed: false,
      effect: {
        capacity: blueprint.capacity - this.stadiumCapacity,
        atmosphere: 0.08,
        revenue: blueprint.capacity * 320,
        pitch: 0.3,
      },
    };
    this.upgrades.set(upgrade.id, upgrade);
    this.context.emit({
      type: 'club.stadiumWorks',
      stadiumId: this.stadiumId(),
      upgradeId: upgrade.id,
      stage: 'started',
      progress: 0,
    });
    return upgrade;
  }

  get plannedStadium(): StadiumBlueprint | null {
    return this.newStadium;
  }

  // ── Centre d'entraînement & académie (Tome VI, ch. 4-5) ──────────────────

  investInFacility(area: keyof TrainingFacility, amount: number): boolean {
    if (amount <= 0 || amount > this.finances.cash) return false;
    this.finances.cash = round(this.finances.cash - amount, 2);
    const gain = amount / 900_000;
    if (area === 'pitches' || area === 'coveredPitches' || area === 'pools') {
      this.facility[area] = Math.round(this.facility[area] + Math.max(1, gain / 6));
    } else {
      this.facility[area] = clamp(round(this.facility[area] + gain, 1), 0, 100);
    }
    return true;
  }

  get facilities(): TrainingFacility {
    return { ...this.facility };
  }

  investInAcademy(
    area: 'scoutingBudget' | 'infrastructure' | 'specialistCoaches',
    amount: number,
  ): boolean {
    if (amount <= 0 || amount > this.finances.cash) return false;
    this.finances.cash = round(this.finances.cash - amount, 2);
    if (area === 'scoutingBudget') {
      this.academy.scoutingBudget = round(this.academy.scoutingBudget + amount, 2);
    } else if (area === 'specialistCoaches') {
      this.academy.specialistCoaches += Math.max(1, Math.floor(amount / 1_200_000));
    } else {
      this.academy.infrastructure = clamp(round(this.academy.infrastructure + amount / 800_000, 1), 0, 100);
    }
    this.academy.level = clamp(
      round(
        this.academy.infrastructure * 0.5 +
          Math.min(100, this.academy.scoutingBudget / 60_000) * 0.3 +
          Math.min(100, this.academy.specialistCoaches * 12) * 0.2,
        1,
      ),
      0,
      100,
    );
    return true;
  }

  get academyState(): AcademyState {
    return { ...this.academy };
  }

  // ── Marketing (Tome VI, ch. 6) ───────────────────────────────────────────

  launchCampaign(kind: MarketingCampaignKind, name: string, budget: number): MarketingCampaign | null {
    if (budget <= 0 || budget > this.finances.cash) return null;
    this.finances.cash = round(this.finances.cash - budget, 2);
    const multiplier: Record<MarketingCampaignKind, { image: number; revenue: number; days: number }> = {
      'tournée estivale': { image: 0.12, revenue: 3.2, days: 30 },
      événement: { image: 0.06, revenue: 1.4, days: 7 },
      'présentation officielle': { image: 0.05, revenue: 0.9, days: 3 },
      'nouveau maillot': { image: 0.09, revenue: 4.5, days: 21 },
      'collaboration de marque': { image: 0.14, revenue: 2.6, days: 60 },
    };
    const spec = multiplier[kind];
    const campaign: MarketingCampaign = {
      id: `campaign:${this.counter++}`,
      kind,
      name,
      cost: budget,
      startedAt: this.context.clock.absoluteMinutes,
      durationDays: spec.days,
      imageGain: spec.image * clamp01(budget / 6_000_000),
      revenue: 0,
      completed: false,
    };
    this.campaigns.set(campaign.id, campaign);
    return campaign;
  }

  get activeCampaigns(): MarketingCampaign[] {
    return [...this.campaigns.values()].filter((c) => !c.completed);
  }

  get imageScore(): number {
    return round(this.clubImage, 3);
  }

  // ── Conseil d'administration (Tome VI, ch. 7) ────────────────────────────

  get boardMembers(): BoardMember[] {
    return [...this.board.values()];
  }

  boardSupport(): number {
    let weighted = 0;
    let total = 0;
    for (const member of this.board.values()) {
      weighted += member.support * member.votingWeight;
      total += member.votingWeight;
    }
    return total > 0 ? round(clamp((weighted / total + 1) / 2, 0, 1), 3) : 0.5;
  }

  /** Soumet une décision au vote : chaque membre vote selon son tempérament. */
  submitToBoard(
    topic: BoardDecision['topic'],
    description: string,
    cost: number,
    risk: number,
  ): BoardDecision {
    const decision: BoardDecision = {
      id: `decision:${this.counter++}`,
      topic,
      description,
      cost,
      risk: clamp01(risk),
      votes: [],
      approved: null,
    };

    const affordability = clamp01(1 - cost / Math.max(1, this.finances.cash + this.finances.budget * 0.5));
    let favour = 0;
    let against = 0;
    for (const member of this.board.values()) {
      const appetite = member.appetite;
      const score =
        affordability * (1 - appetite) * 1.2 +
        appetite * (1 - decision.risk) * 0.9 +
        member.support * 0.5 +
        (topic === 'objectif' ? 0.2 : 0);
      const inFavour = score > 0.55;
      const reason = inFavour
        ? appetite > 0.6
          ? 'projet ambitieux, cohérent avec notre trajectoire'
          : 'financement maîtrisé, risque acceptable'
        : affordability < 0.4
          ? 'le club n’en a pas les moyens actuellement'
          : 'le risque me paraît trop élevé';
      decision.votes.push({ memberId: member.id, inFavour, reason });
      if (inFavour) favour += member.votingWeight;
      else against += member.votingWeight;
    }

    decision.approved = favour > against;
    this.decisions.set(decision.id, decision);

    // Le vote influence le soutien futur.
    for (const vote of decision.votes) {
      const member = this.board.get(vote.memberId);
      if (!member) continue;
      member.support = clamp(member.support + (vote.inFavour === decision.approved ? 0.03 : -0.02), -1, 1);
    }

    this.context.emit({
      type: 'club.board',
      clubId: this.clubId ?? 'inconnu',
      decision: description,
      approved: decision.approved,
      satisfaction: this.boardSupport(),
    });
    return decision;
  }

  get boardDecisions(): BoardDecision[] {
    return [...this.decisions.values()];
  }

  // ── Héritage (Tome VI, ch. 8) ────────────────────────────────────────────

  get presidentLegacy(): PresidentLegacy {
    return { ...this.legacy };
  }

  recordTrophy(): void {
    this.legacy.trophiesDisplayed++;
    this.evaluateLegacy();
  }

  private evaluateLegacy(): void {
    const before = { ...this.legacy };
    if (this.legacy.seasonsInOffice >= 5 && this.legacy.trophiesDisplayed >= 2) this.legacy.museumOfMandate = true;
    if (this.legacy.seasonsInOffice >= 8 && this.legacy.trophiesDisplayed >= 4) this.legacy.statue = true;
    if (this.legacy.seasonsInOffice >= 10) this.legacy.documentary = true;
    // Classement historique : combinaison durée, titres et santé financière.
    const score =
      this.legacy.seasonsInOffice * 2 +
      this.legacy.trophiesDisplayed * 6 +
      (this.finances.debt < this.finances.budget * 0.1 ? 8 : 0);
    this.legacy.historicalRank = score > 60 ? 1 : score > 40 ? 2 : score > 25 ? 3 : score > 12 ? 5 : 10;

    if (this.clubId && !before.statue && this.legacy.statue) {
      this.context.emit({
        type: 'legacy.monument',
        kind: 'statue',
        personId: 'president',
        cityId: getClub(this.clubId).cityId,
      });
    }
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;
    const now = context.clock.absoluteMinutes;

    for (const upgrade of this.upgrades.values()) {
      if (upgrade.completed) continue;
      const elapsedDays = (now - upgrade.startedAt) / (24 * 60);
      upgrade.progress = clamp01(elapsedDays / upgrade.durationDays);
      if (upgrade.progress >= 1) {
        upgrade.completed = true;
        if (upgrade.effect.capacity) this.stadiumCapacity += upgrade.effect.capacity;
        if (upgrade.effect.atmosphere) {
          this.stadiumAtmosphere = clamp01(this.stadiumAtmosphere + upgrade.effect.atmosphere);
        }
        if (upgrade.effect.pitch) this.pitchQuality = clamp01(this.pitchQuality + upgrade.effect.pitch);
        if (upgrade.effect.revenue) {
          this.finances.ticketing = round(this.finances.ticketing + upgrade.effect.revenue, 2);
        }
        context.emit({
          type: 'club.stadiumWorks',
          stadiumId: this.stadiumId(),
          upgradeId: upgrade.id,
          stage: 'completed',
          progress: 1,
        });
      }
    }

    for (const campaign of this.campaigns.values()) {
      if (campaign.completed) continue;
      const elapsedDays = (now - campaign.startedAt) / (24 * 60);
      if (elapsedDays < campaign.durationDays) continue;
      campaign.completed = true;
      campaign.revenue = round(campaign.cost * (1 + campaign.imageGain * 8), 2);
      this.finances.cash = round(this.finances.cash + campaign.revenue, 2);
      this.finances.merchandising = round(this.finances.merchandising * (1 + campaign.imageGain * 0.5), 2);
      this.clubImage = clamp01(this.clubImage + campaign.imageGain);
    }
  }

  onMonth(context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;

    // Résultat mensuel : recettes moins charges.
    const dashboard = this.dashboard();
    const monthlyResult = round(dashboard.result / 12, 2);
    this.finances.cash = round(this.finances.cash + monthlyResult, 2);
    if (this.finances.cash < 0) {
      this.finances.debt = round(this.finances.debt - this.finances.cash, 2);
      this.finances.cash = 0;
    }

    // Rapport d'avancement des travaux visibles.
    for (const upgrade of this.upgrades.values()) {
      if (upgrade.completed) continue;
      context.emit({
        type: 'club.stadiumWorks',
        stadiumId: this.stadiumId(),
        upgradeId: upgrade.id,
        stage: 'progress',
        progress: round(upgrade.progress, 3),
      });
    }

    // Le soutien du conseil suit la santé financière et sportive.
    const sporting = clamp01(this.seasons.strengthOf(this.clubId) / 100);
    const financial = clamp01(1 - this.finances.debt / Math.max(1, this.finances.budget));
    for (const member of this.board.values()) {
      const target = member.role === 'directeur financier' ? financial : sporting * 0.6 + financial * 0.4;
      member.support = clamp(member.support + (target - 0.5) * 0.08, -1, 1);
    }

    // L'image du club s'érode doucement sans marketing.
    this.clubImage = clamp01(this.clubImage - 0.004);
  }

  onYear(context: SimulationContext, _date: GameDate): void {
    if (!this.clubId) return;
    this.legacy.seasonsInOffice++;
    this.evaluateLegacy();

    // Promotion de jeunes issus de l'académie.
    const rng = context.stream('president.academy');
    const graduates = Math.max(0, Math.round((this.academy.level / 100) * rng.range(0, 5)));
    this.academy.graduatesProduced += graduates;
    if (graduates > 0) {
      context.logger.info('jeunes promus de l’académie', { club: this.clubId, nombre: graduates });
    }

    // Revalorisation annuelle des droits TV selon les résultats.
    const strength = this.seasons.strengthOf(this.clubId);
    this.finances.broadcasting = round(this.finances.broadcasting * (0.9 + strength / 200), 2);
  }

  private stadiumId(): string {
    if (!this.clubId) return 'inconnu';
    try {
      return getClub(this.clubId).stadiumId;
    } catch {
      return 'inconnu';
    }
  }

  serialize(): unknown {
    return {
      clubId: this.clubId,
      finances: this.finances,
      stadiumCapacity: this.stadiumCapacity,
      stadiumAtmosphere: this.stadiumAtmosphere,
      pitchQuality: this.pitchQuality,
      upgrades: [...this.upgrades.values()],
      facility: this.facility,
      academy: this.academy,
      campaigns: [...this.campaigns.values()],
      board: [...this.board.values()],
      decisions: [...this.decisions.values()],
      clubImage: this.clubImage,
      legacy: this.legacy,
      newStadium: this.newStadium,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.clubId = (state.clubId as string | null) ?? null;
    if (state.finances) this.finances = state.finances as ClubFinances;
    this.stadiumCapacity = (state.stadiumCapacity as number) ?? 0;
    this.stadiumAtmosphere = (state.stadiumAtmosphere as number) ?? 0.8;
    this.pitchQuality = (state.pitchQuality as number) ?? 0.95;
    this.upgrades.clear();
    for (const upgrade of (state.upgrades as StadiumUpgrade[]) ?? []) this.upgrades.set(upgrade.id, upgrade);
    if (state.facility) this.facility = state.facility as TrainingFacility;
    if (state.academy) this.academy = state.academy as AcademyState;
    this.campaigns.clear();
    for (const campaign of (state.campaigns as MarketingCampaign[]) ?? []) {
      this.campaigns.set(campaign.id, campaign);
    }
    this.board.clear();
    for (const member of (state.board as BoardMember[]) ?? []) this.board.set(member.id, member);
    this.decisions.clear();
    for (const decision of (state.decisions as BoardDecision[]) ?? []) {
      this.decisions.set(decision.id, decision);
    }
    this.clubImage = (state.clubImage as number) ?? 0.5;
    if (state.legacy) this.legacy = state.legacy as PresidentLegacy;
    this.newStadium = (state.newStadium as StadiumBlueprint | null) ?? null;
    this.counter = (state.counter as number) ?? 0;
  }
}
