/**
 * Infinity Football — Carrière / Système central
 *
 * Tome IV intégralement (début de carrière, évolution, transferts, contrats,
 * vie de star, héritage) et Tome XXI (carrière après la retraite).
 * Tome XXVI : réputation mondiale, influence, relation aux supporters.
 *
 * Ce système est le pivot : il possède l'état du joueur, le relie au club, au
 * calendrier, à l'économie, aux médias et au Legacy. Toutes les autres couches
 * lisent son état plutôt que d'en dupliquer une copie.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { CLUBS, getClub, getCompetition, type ClubDef } from '../data/clubs.js';
import { getCountry } from '../data/countries.js';
import { BRANDS, getBrand, type BrandDef } from '../data/brands.js';
import { MemoryBank, MemoryFactory } from '../ai/memory.js';
import { transferWillingness } from '../ai/personality.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { SEASON_SERVICE, type SeasonSystem } from './season-system.js';
import {
  ATTRIBUTE_KEYS,
  ageAppearance,
  ageCurve,
  baseRating,
  careerTotals,
  computeMarketValue,
  createPlayer,
  currentSeasonStats,
  emptySeasonStats,
  expectedWeeklyWage,
  isInjured,
  overallRating,
  type Foot,
  type Injury,
  type PlayerState,
  type Position,
  type SeasonStats,
} from './player.js';

export const CAREER_SERVICE = 'career';

export interface Contract {
  readonly clubId: string;
  weeklyWage: number;
  /** Prime de match en euros. */
  appearanceBonus: number;
  goalBonus: number;
  /** Prime de titre. */
  titleBonus: number;
  /** Saison de fin de contrat. */
  expiresSeason: number;
  /** Clause libératoire, 0 = aucune. */
  releaseClause: number;
  readonly signedAt: number;
  /** Clauses spécifiques négociées. */
  readonly clauses: string[];
}

export interface EquipmentContract {
  readonly brandId: string;
  readonly annualValue: number;
  /** Saison de fin. */
  readonly expiresSeason: number;
  /** Marques concurrentes interdites tant que le contrat court. */
  readonly blockedBrandIds: readonly string[];
  /** Obligations à honorer chaque saison. */
  readonly obligations: readonly string[];
  /** Obligations honorées cette saison. */
  obligationsMet: number;
}

export type TransferStage =
  | 'interest'
  | 'negotiation'
  | 'agentTalks'
  | 'agreed'
  | 'facilitiesTour'
  | 'medical'
  | 'signed'
  | 'pressConference'
  | 'presented'
  | 'rejected';

export interface TransferNegotiation {
  readonly id: string;
  readonly fromClubId: string | null;
  readonly toClubId: string;
  stage: TransferStage;
  fee: number;
  proposedWage: number;
  /** Volonté du joueur 0..1. */
  willingness: number;
  /** Accord du club vendeur 0..1. */
  sellingClubAgreement: number;
  readonly openedAt: number;
  readonly clauses: string[];
}

export type PostRetirementRole =
  | 'Entraîneur'
  | 'Président'
  | 'Sélectionneur national'
  | 'Consultant TV'
  | 'Commentateur'
  | 'Agent'
  | 'Recruteur'
  | 'Ambassadeur international'
  | 'Organisateur des Boubjack Awards'
  | 'Fondateur d’une académie'
  | 'Propriétaire d’un club';

export interface StarActivity {
  readonly id: string;
  readonly kind:
    | 'interview'
    | 'séance photo'
    | 'campagne publicitaire'
    | 'événement caritatif'
    | 'inauguration'
    | 'cérémonie';
  readonly label: string;
  readonly fee: number;
  readonly fameGain: number;
  readonly reputationDelta: number;
  readonly fatigue: number;
  readonly brandId: string | null;
}

export class CareerSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'career',
    name: 'Carrière du joueur',
    order: 60,
    tomes: ['IV', 'XXI', 'XXVI', 'XXVIII'],
  };

  private context!: SimulationContext;
  private economy!: EconomySystem;
  private seasons!: SeasonSystem;

  private playerState: PlayerState | null = null;
  private contract: Contract | null = null;
  private equipmentContract: EquipmentContract | null = null;
  private readonly negotiations = new Map<string, TransferNegotiation>();
  private readonly memory = new MemoryBank({ capacity: 400, halfLifeDays: 900 });
  private readonly formerClubIds: string[] = [];
  private readonly trophies: Array<{ id: string; name: string; season: number; competitionId: string }> = [];
  private readonly awards: Array<{ id: string; name: string; season: number }> = [];
  private postRetirementRole: PostRetirementRole | null = null;
  private legendStatus = false;
  private negotiationCounter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(CAREER_SERVICE, this);
  }

  // ── Création & accès ─────────────────────────────────────────────────────

  /** Tome IV, ch. 1 — création du personnage. */
  createCareer(options: {
    name: string;
    nationality: string;
    position: Position;
    foot?: Foot;
    age?: number;
    backstory?: string;
    photoScan?: boolean;
    startingClubId?: string;
    potential?: number;
  }): PlayerState {
    const rng = this.context.stream('career.creation');
    const startingYear = this.context.clock.date.year;
    const player = createPlayer(
      {
        id: 'player:1',
        name: options.name,
        nationality: options.nationality,
        position: options.position,
        foot: options.foot,
        age: options.age ?? 17,
        startingYear,
        quality: 0.45,
        potential: options.potential,
        backstory: options.backstory,
        photoScan: options.photoScan,
      },
      rng,
    );
    player.marketValue = computeMarketValue(player);
    this.playerState = player;

    const clubId =
      options.startingClubId ??
      this.suggestStartingClub(options.nationality, rng);
    this.joinClub(clubId, {
      weeklyWage: expectedWeeklyWage(player, getClub(clubId).prestige),
      years: 3,
      appearanceBonus: 1500,
      goalBonus: 3000,
      titleBonus: 40_000,
      releaseClause: 0,
      clauses: ['clause de formation'],
    });

    // Dotation initiale : prime à la signature.
    this.economy.record('courant', 25_000, 'contrat', 'prime de premier contrat professionnel');

    this.context.logger.info('carrière créée', {
      joueur: player.identity.name,
      poste: player.identity.position,
      club: getClub(clubId).name,
    });
    return player;
  }

  get player(): PlayerState {
    if (!this.playerState) throw new Error('Aucune carrière active');
    return this.playerState;
  }

  get hasCareer(): boolean {
    return this.playerState !== null;
  }

  get currentContract(): Contract | null {
    return this.contract;
  }

  get boots(): EquipmentContract | null {
    return this.equipmentContract;
  }

  get careerMemory(): MemoryBank {
    return this.memory;
  }

  get formerClubs(): readonly string[] {
    return this.formerClubIds;
  }

  get trophyList(): ReadonlyArray<{ id: string; name: string; season: number; competitionId: string }> {
    return this.trophies;
  }

  get awardList(): ReadonlyArray<{ id: string; name: string; season: number }> {
    return this.awards;
  }

  get isLegend(): boolean {
    return this.legendStatus;
  }

  get role(): PostRetirementRole | null {
    return this.postRetirementRole;
  }

  private suggestStartingClub(nationality: string, rng: Rng): string {
    const local = CLUBS.filter((c) => c.countryId === nationality);
    const pool = local.length > 0 ? local : CLUBS;
    // Un jeune débute rarement dans un club à très fort prestige.
    const modest = pool.filter((c) => c.prestige < 80);
    return rng.pick(modest.length > 0 ? modest : pool).id;
  }

  // ── Contrats & clubs ─────────────────────────────────────────────────────

  joinClub(
    clubId: string,
    terms: {
      weeklyWage: number;
      years: number;
      appearanceBonus: number;
      goalBonus: number;
      titleBonus: number;
      releaseClause: number;
      clauses: string[];
    },
  ): Contract {
    const player = this.player;
    if (player.clubId && player.clubId !== clubId) {
      this.formerClubIds.push(player.clubId);
    }
    player.clubId = clubId;
    player.yearsAtClub = 0;
    const contract: Contract = {
      clubId,
      weeklyWage: terms.weeklyWage,
      appearanceBonus: terms.appearanceBonus,
      goalBonus: terms.goalBonus,
      titleBonus: terms.titleBonus,
      expiresSeason: this.seasons.season + terms.years,
      releaseClause: terms.releaseClause,
      signedAt: this.context.clock.absoluteMinutes,
      clauses: terms.clauses,
    };
    this.contract = contract;
    this.seasons.setPlayerClub(clubId);

    const season = this.seasons.season;
    if (!currentSeasonStats(player, season)) {
      player.seasons.push(emptySeasonStats(season, clubId));
    }

    this.context.emit({
      type: 'career.contractSigned',
      playerId: player.identity.id,
      clubId,
      weeklyWage: terms.weeklyWage,
      years: terms.years,
    });
    this.memory.remember(
      MemoryFactory.transfer(
        `career:sign:${clubId}:${contract.signedAt}`,
        `signature à ${getClub(clubId).name}`,
        ['transfert', 'contrat', clubId],
        contract.signedAt,
        0.6,
      ),
    );
    return contract;
  }

  /** Renégociation : le club accepte selon la performance et la réputation. */
  renegotiate(requestedWage: number): { accepted: boolean; counterOffer: number } {
    const player = this.player;
    if (!this.contract) return { accepted: false, counterOffer: 0 };
    const club = getClub(this.contract.clubId);
    const fair = expectedWeeklyWage(player, club.prestige);
    const budgetLimit = (club.budgetM * 1_000_000 * 0.12) / 52;
    const counterOffer = Math.min(budgetLimit, Math.round(fair * 1.05));
    const accepted = requestedWage <= counterOffer;
    if (accepted) {
      this.contract.weeklyWage = requestedWage;
      this.contract.expiresSeason = this.seasons.season + 3;
    }
    return { accepted, counterOffer: Math.round(counterOffer) };
  }

  // ── Transferts (Tome IV, ch. 3) ──────────────────────────────────────────

  /** Un club manifeste son intérêt : ouvre une négociation en plusieurs étapes. */
  openNegotiation(toClubId: string): TransferNegotiation | null {
    const player = this.player;
    if (player.retired) return null;
    const targetClub = getClub(toClubId);
    if (targetClub.id === player.clubId) return null;

    const currentClub = player.clubId ? getClub(player.clubId) : null;
    const fee = this.estimateFee(player, targetClub);
    const proposedWage = expectedWeeklyWage(player, targetClub.prestige);
    const wageIncrease = this.contract
      ? clamp01((proposedWage - this.contract.weeklyWage) / Math.max(1, this.contract.weeklyWage))
      : 1;
    const prestigeIncrease = currentClub
      ? clamp01((targetClub.prestige - currentClub.prestige) / 40)
      : 0.5;
    const playingTimeGain = clamp01(
      (baseRating(player) - targetClub.prestige * 0.85) / 20 + 0.5,
    );

    const negotiation: TransferNegotiation = {
      id: `transfer:${this.negotiationCounter++}`,
      fromClubId: player.clubId,
      toClubId,
      stage: 'interest',
      fee,
      proposedWage,
      willingness: transferWillingness(player.profile, {
        wageIncrease,
        prestigeIncrease,
        playingTimeGain,
        yearsAtClub: player.yearsAtClub,
      }),
      sellingClubAgreement: currentClub
        ? clamp01((fee / Math.max(1, player.marketValue)) - 0.6)
        : 1,
      openedAt: this.context.clock.absoluteMinutes,
      clauses: [],
    };
    this.negotiations.set(negotiation.id, negotiation);

    this.context.emit({
      type: 'career.transfer',
      playerId: player.identity.id,
      fromClubId: player.clubId,
      toClubId,
      fee,
      stage: 'interest',
    });
    return negotiation;
  }

  /**
   * Fait progresser une négociation d'une étape.
   * L'ordre suit exactement le Tome IV, ch. 3 : négociations, réunion avec les
   * dirigeants, discussion avec l'agent, visite des installations, examens
   * médicaux, signature, conférence de presse, présentation.
   */
  advanceNegotiation(
    negotiationId: string,
    decision: { accept: boolean; demandedWage?: number; demandedClauses?: string[] },
  ): TransferNegotiation | null {
    const negotiation = this.negotiations.get(negotiationId);
    if (!negotiation) return null;
    const player = this.player;

    if (!decision.accept) {
      negotiation.stage = 'rejected';
      this.emitTransferStage(negotiation);
      return negotiation;
    }

    switch (negotiation.stage) {
      case 'interest':
        negotiation.stage = 'negotiation';
        // Le club vendeur pousse le prix.
        negotiation.fee = Math.round(negotiation.fee * 1.08);
        negotiation.sellingClubAgreement = clamp01(negotiation.sellingClubAgreement + 0.25);
        break;
      case 'negotiation':
        negotiation.stage = 'agentTalks';
        if (decision.demandedWage) {
          const target = getClub(negotiation.toClubId);
          const ceiling = (target.budgetM * 1_000_000 * 0.14) / 52;
          if (decision.demandedWage <= ceiling) {
            negotiation.proposedWage = decision.demandedWage;
            negotiation.willingness = clamp01(negotiation.willingness + 0.12);
          } else {
            negotiation.willingness = clamp01(negotiation.willingness - 0.1);
          }
        }
        if (decision.demandedClauses) negotiation.clauses.push(...decision.demandedClauses);
        break;
      case 'agentTalks':
        negotiation.stage = 'agreed';
        break;
      case 'agreed':
        negotiation.stage = 'facilitiesTour';
        negotiation.willingness = clamp01(negotiation.willingness + 0.08);
        break;
      case 'facilitiesTour':
        negotiation.stage = 'medical';
        break;
      case 'medical': {
        // La visite médicale peut révéler une fragilité.
        const rng = this.context.stream('career.medical');
        const risk = clamp01(player.injuries.length * 0.04 + (player.age - 28) * 0.02);
        if (rng.chance(risk)) {
          negotiation.fee = Math.round(negotiation.fee * 0.85);
          this.context.logger.info('visite médicale : réserve détectée, prix révisé');
        }
        negotiation.stage = 'signed';
        this.completeTransfer(negotiation);
        break;
      }
      case 'signed':
        negotiation.stage = 'pressConference';
        break;
      case 'pressConference':
        negotiation.stage = 'presented';
        this.context.emit({
          type: 'cinematic.played',
          cinematicId: 'transfer.presentation',
          category: 'transfert',
          durationSeconds: 95,
          skipped: false,
        });
        break;
      default:
        break;
    }
    this.emitTransferStage(negotiation);
    return negotiation;
  }

  private emitTransferStage(negotiation: TransferNegotiation): void {
    this.context.emit({
      type: 'career.transfer',
      playerId: this.player.identity.id,
      fromClubId: negotiation.fromClubId,
      toClubId: negotiation.toClubId,
      fee: negotiation.fee,
      stage:
        negotiation.stage === 'agentTalks' || negotiation.stage === 'facilitiesTour'
          ? 'negotiation'
          : negotiation.stage === 'pressConference' || negotiation.stage === 'presented'
            ? 'presented'
            : negotiation.stage === 'rejected'
              ? 'interest'
              : negotiation.stage,
    });
  }

  private completeTransfer(negotiation: TransferNegotiation): void {
    const player = this.player;
    const previousClubId = player.clubId;
    this.joinClub(negotiation.toClubId, {
      weeklyWage: negotiation.proposedWage,
      years: 4,
      appearanceBonus: Math.round(negotiation.proposedWage * 0.35),
      goalBonus: Math.round(negotiation.proposedWage * 0.6),
      titleBonus: Math.round(negotiation.proposedWage * 12),
      releaseClause: Math.round(negotiation.fee * 2.2),
      clauses: negotiation.clauses,
    });
    // Prime à la signature : 8 % du transfert.
    const signingBonus = Math.round(negotiation.fee * 0.08);
    if (signingBonus > 0) {
      this.economy.record('courant', signingBonus, 'contrat', `prime de signature — ${getClub(negotiation.toClubId).name}`);
    }
    this.memory.remember(
      MemoryFactory.transfer(
        `career:transfer:${negotiation.id}`,
        `transfert vers ${getClub(negotiation.toClubId).name} pour ${(negotiation.fee / 1_000_000).toFixed(1)} M€`,
        ['transfert', negotiation.toClubId, previousClubId ?? 'libre'],
        this.context.clock.absoluteMinutes,
        0.5,
      ),
    );
  }

  private estimateFee(player: PlayerState, targetClub: ClubDef): number {
    const value = player.marketValue > 0 ? player.marketValue : computeMarketValue(player);
    const contractPressure = this.contract
      ? clamp(1.3 - (this.contract.expiresSeason - this.seasons.season) * 0.12, 0.4, 1.3)
      : 0.5;
    const buyerWealth = clamp(targetClub.budgetM / 300, 0.5, 2);
    return Math.round((value * contractPressure * (0.9 + buyerWealth * 0.2)) / 100_000) * 100_000;
  }

  /** Négociations en cours (affichées sur le téléphone et dans les médias). */
  get openNegotiations(): TransferNegotiation[] {
    return [...this.negotiations.values()].filter(
      (n) => n.stage !== 'presented' && n.stage !== 'rejected',
    );
  }

  // ── Contrats d'équipementier (Tome IV ch. 4, Tome XXIV ch. 3) ────────────

  /** Marques prêtes à approcher le joueur, selon sa notoriété. */
  availableBrandOffers(): BrandDef[] {
    const player = this.player;
    return BRANDS.filter(
      (brand) => brand.category === 'equipementier' && brand.fameRequired <= player.fame,
    );
  }

  signEquipmentContract(brandId: string, years = 4): EquipmentContract | null {
    const player = this.player;
    const brand = getBrand(brandId);
    if (brand.fameRequired > player.fame) return null;
    const value = Math.round(
      brand.baseAnnualValue * (0.5 + player.fame / 100) * (0.7 + player.reputation / 140),
    );
    const contract: EquipmentContract = {
      brandId,
      annualValue: value,
      expiresSeason: this.seasons.season + years,
      blockedBrandIds: brand.competitorIds,
      obligations: [
        'porter les produits de la marque pendant les matchs',
        'participer à deux campagnes publicitaires par saison',
        'assister à un événement de la marque',
      ],
      obligationsMet: 0,
    };
    this.equipmentContract = contract;
    this.context.emit({
      type: 'commerce.brandContract',
      brandId,
      action: 'signed',
      annualValue: value,
    });
    return contract;
  }

  /**
   * Une marque est-elle achetable ? Un contrat exclusif bloque les concurrents
   * tant qu'il court (Tome XXII, ch. 4 et Tome XXIV, ch. 3).
   */
  canUseBrand(brandId: string): boolean {
    if (!this.equipmentContract) return true;
    if (this.equipmentContract.expiresSeason < this.seasons.season) return true;
    return !this.equipmentContract.blockedBrandIds.includes(brandId);
  }

  fulfilBrandObligation(): void {
    if (!this.equipmentContract) return;
    this.equipmentContract.obligationsMet++;
    this.context.emit({
      type: 'commerce.brandContract',
      brandId: this.equipmentContract.brandId,
      action: 'obligationMet',
      annualValue: this.equipmentContract.annualValue,
    });
  }

  // ── Performances & progression ───────────────────────────────────────────

  /** Applique les statistiques d'un match au joueur et paie les primes. */
  applyMatchPerformance(performance: {
    minutes: number;
    goals: number;
    assists: number;
    shots: number;
    shotsOnTarget: number;
    passes: number;
    passesCompleted: number;
    tackles: number;
    saves: number;
    cleanSheet: boolean;
    yellow: boolean;
    red: boolean;
    distanceKm: number;
    topSpeedKmh: number;
    rating: number;
    manOfTheMatch: boolean;
    competitionId: string;
  }): void {
    const player = this.player;
    const season = this.seasons.season;
    let stats = currentSeasonStats(player, season);
    if (!stats) {
      stats = emptySeasonStats(season, player.clubId ?? 'libre');
      player.seasons.push(stats);
    }

    const previousAppearances = stats.appearances;
    stats.appearances++;
    stats.minutes += performance.minutes;
    stats.goals += performance.goals;
    stats.assists += performance.assists;
    stats.shots += performance.shots;
    stats.shotsOnTarget += performance.shotsOnTarget;
    stats.passes += performance.passes;
    stats.passesCompleted += performance.passesCompleted;
    stats.tackles += performance.tackles;
    stats.saves += performance.saves;
    if (performance.cleanSheet) stats.cleanSheets++;
    if (performance.yellow) stats.yellowCards++;
    if (performance.red) stats.redCards++;
    stats.distanceKm = round(stats.distanceKm + performance.distanceKm, 2);
    stats.topSpeedKmh = Math.max(stats.topSpeedKmh, performance.topSpeedKmh);
    if (performance.manOfTheMatch) stats.manOfTheMatch++;
    stats.averageRating = round(
      (stats.averageRating * previousAppearances + performance.rating) / stats.appearances,
      2,
    );

    // Forme, fatigue et moral.
    player.form = clamp01(player.form * 0.75 + (performance.rating / 10) * 0.25);
    player.fitness = clamp01(player.fitness - performance.minutes / 900);
    player.sharpness = clamp01(player.sharpness + 0.06);
    player.morale = clamp01(player.morale + (performance.rating - 6.4) * 0.06);

    // Primes contractuelles.
    if (this.contract) {
      const bonus =
        this.contract.appearanceBonus + performance.goals * this.contract.goalBonus;
      if (bonus > 0) {
        this.economy.record('courant', bonus, 'primes', `primes de match (${performance.competitionId})`);
      }
    }

    // Réputation & célébrité.
    const competitionPrestige = (() => {
      try {
        return getCompetition(performance.competitionId).prestige;
      } catch {
        return 60;
      }
    })();
    const impact =
      (performance.rating - 6.3) * 0.55 +
      performance.goals * 1.1 +
      performance.assists * 0.6 +
      (performance.manOfTheMatch ? 1.2 : 0);
    this.adjustReputation(impact * (competitionPrestige / 100), 'performance');

    // Mémoire de carrière : les grandes performances restent.
    if (performance.rating >= 8.5 || performance.goals >= 3) {
      this.memory.remember(
        MemoryFactory.match(
          `career:match:${this.context.clock.absoluteMinutes}`,
          performance.goals >= 3
            ? `triplé en ${performance.competitionId}`
            : `performance majuscule (note ${performance.rating})`,
          ['match', 'performance', performance.competitionId],
          this.context.clock.absoluteMinutes,
          clamp01(performance.rating / 10),
        ),
      );
    }

    player.marketValue = computeMarketValue(player);
  }

  /** Ajuste la réputation globale et par pays. */
  adjustReputation(delta: number, reason: string, countryId?: string): void {
    const player = this.player;
    player.reputation = clamp(player.reputation + delta, 0, 100);
    player.fame = clamp(player.fame + delta * 0.85, 0, 100);
    const target = countryId ?? player.clubId ? getClub(player.clubId as string).countryId : player.identity.nationality;
    if (target) {
      player.reputationByCountry[target] = clamp(
        (player.reputationByCountry[target] ?? player.reputation) + delta * 1.4,
        0,
        100,
      );
    }
    this.context.emit({
      type: 'career.reputationChanged',
      playerId: player.identity.id,
      delta: round(delta, 3),
      reason,
      value: round(player.reputation, 2),
    });
  }

  /** Entraînement : progression, fatigue, risque de blessure (Tome V, ch. 4). */
  train(session: {
    focus: 'physique' | 'technique' | 'tactique' | 'mental';
    intensity: number;
    durationMinutes: number;
  }): { progress: number; injured: boolean } {
    const player = this.player;
    const rng = this.context.stream('career.training');
    const intensity = clamp01(session.intensity);
    const ceiling = player.potential * ageCurve(player.age);

    const focusKeys: Record<typeof session.focus, (keyof typeof player.attributes)[]> = {
      physique: ['pace', 'acceleration', 'stamina', 'strength', 'agility', 'jumping'],
      technique: ['finishing', 'passing', 'dribbling', 'crossing', 'firstTouch', 'longShots', 'freeKicks', 'heading'],
      tactique: ['positioning', 'decisions', 'marking', 'tackling', 'teamwork'],
      mental: ['concentration', 'determination', 'leadership'],
    };

    let progress = 0;
    for (const key of focusKeys[session.focus]) {
      const current = player.attributes[key];
      if (current >= ceiling) continue;
      const gain =
        intensity *
        (session.durationMinutes / 90) *
        (0.16 + player.profile.football.learning * 0.25) *
        (1 - current / Math.max(1, ceiling)) *
        rng.range(0.6, 1.4);
      player.attributes[key] = clamp(round(current + gain, 2), 1, 99);
      progress += gain;
    }

    player.fitness = clamp01(player.fitness - intensity * 0.09);
    player.sharpness = clamp01(player.sharpness + intensity * 0.05);
    player.morale = clamp01(player.morale + (intensity > 0.85 ? -0.01 : 0.01));

    const injuryRisk = intensity * 0.012 * (1 + (1 - player.fitness)) * (player.age > 31 ? 1.4 : 1);
    let injured = false;
    if (rng.chance(injuryRisk)) {
      this.injure('light', rng);
      injured = true;
    }

    this.context.emit({
      type: 'club.training',
      sessionId: `train:${this.context.clock.absoluteMinutes}`,
      focus: session.focus,
      intensity,
      injuryRisk: round(injuryRisk, 4),
    });
    return { progress: round(progress, 3), injured };
  }

  /** Inflige une blessure et planifie la guérison. */
  injure(severity: 'light' | 'moderate' | 'serious', rng: Rng): Injury {
    const player = this.player;
    const daysOut =
      severity === 'light' ? rng.int(3, 12) : severity === 'moderate' ? rng.int(14, 45) : rng.int(60, 240);
    const labels: Record<typeof severity, string[]> = {
      light: ['contracture', 'coup reçu', 'entorse légère'],
      moderate: ['lésion musculaire', 'entorse de la cheville', 'fracture du nez'],
      serious: ['rupture ligamentaire', 'fracture de fatigue', 'lésion tendineuse grave'],
    };
    const injury: Injury = {
      id: `injury:${this.context.clock.absoluteMinutes}`,
      label: rng.pick(labels[severity]),
      severity,
      recoversAt: this.context.clock.absoluteMinutes + daysOut * 24 * 60,
      daysOut,
      leavesScar: severity === 'serious' && rng.chance(0.4),
    };
    player.injuries.push(injury);
    if (injury.leavesScar) player.appearance.visibleScars.push(injury.label);
    player.morale = clamp01(player.morale - (severity === 'serious' ? 0.3 : 0.1));
    player.fitness = clamp01(player.fitness - 0.25);

    this.memory.remember(
      MemoryFactory.injury(
        injury.id,
        `${injury.label} — ${daysOut} jours d'absence`,
        ['blessure', severity],
        this.context.clock.absoluteMinutes,
        severity === 'serious' ? 0.9 : severity === 'moderate' ? 0.5 : 0.2,
      ),
    );
    this.context.emit({
      type: 'career.injury',
      playerId: player.identity.id,
      severity,
      daysOut,
    });
    return injury;
  }

  get injured(): boolean {
    return this.playerState ? isInjured(this.playerState, this.context.clock.absoluteMinutes) : false;
  }

  // ── Vie de star (Tome IV, ch. 5) ─────────────────────────────────────────

  /** Propositions d'activités de célébrité, filtrées par la notoriété. */
  starOpportunities(): StarActivity[] {
    const player = this.player;
    const rng = this.context.stream('career.star');
    const opportunities: StarActivity[] = [];
    const fameTier = player.fame;

    opportunities.push({
      id: `star:interview:${this.context.clock.absoluteMinutes}`,
      kind: 'interview',
      label: 'Interview exclusive pour une chaîne nationale',
      fee: Math.round(2_000 + fameTier * 400),
      fameGain: 0.4,
      reputationDelta: 0.2,
      fatigue: 0.05,
      brandId: null,
    });
    if (fameTier > 25) {
      opportunities.push({
        id: `star:photo:${this.context.clock.absoluteMinutes}`,
        kind: 'séance photo',
        label: 'Séance photo pour un magazine',
        fee: Math.round(8_000 + fameTier * 900),
        fameGain: 0.6,
        reputationDelta: 0.1,
        fatigue: 0.1,
        brandId: null,
      });
    }
    if (this.equipmentContract) {
      opportunities.push({
        id: `star:campaign:${this.context.clock.absoluteMinutes}`,
        kind: 'campagne publicitaire',
        label: `Campagne mondiale ${getBrand(this.equipmentContract.brandId).name}`,
        fee: Math.round(this.equipmentContract.annualValue * 0.18),
        fameGain: 1.4,
        reputationDelta: 0.3,
        fatigue: 0.2,
        brandId: this.equipmentContract.brandId,
      });
    }
    opportunities.push({
      id: `star:charity:${this.context.clock.absoluteMinutes}`,
      kind: 'événement caritatif',
      label: 'Match caritatif au profit d’une association',
      fee: 0,
      fameGain: 0.5,
      reputationDelta: 1.4,
      fatigue: 0.25,
      brandId: null,
    });
    if (fameTier > 55) {
      opportunities.push({
        id: `star:opening:${this.context.clock.absoluteMinutes}`,
        kind: 'inauguration',
        label: rng.pick([
          'Inauguration d’un complexe sportif',
          'Inauguration d’une boutique officielle',
          'Inauguration d’un terrain de quartier rénové',
        ]),
        fee: Math.round(15_000 + fameTier * 1_200),
        fameGain: 0.8,
        reputationDelta: 0.6,
        fatigue: 0.15,
        brandId: null,
      });
    }
    return opportunities;
  }

  /** Le joueur accepte une activité de célébrité. */
  acceptStarActivity(activity: StarActivity): void {
    const player = this.player;
    if (activity.fee > 0) {
      this.economy.record('professionnel', activity.fee, 'image', activity.label);
    }
    player.fame = clamp(player.fame + activity.fameGain, 0, 100);
    player.fitness = clamp01(player.fitness - activity.fatigue);
    this.adjustReputation(activity.reputationDelta, activity.kind);
    if (activity.brandId) this.fulfilBrandObligation();
    this.context.emit({
      type: 'life.milestone',
      milestone: activity.kind,
      detail: activity.label,
    });
  }

  // ── Trophées, récompenses, sélections ────────────────────────────────────

  awardTrophy(trophyId: string, trophyName: string, competitionId: string): void {
    const player = this.player;
    const season = this.seasons.season;
    this.trophies.push({ id: trophyId, name: trophyName, season, competitionId });
    this.memory.remember(
      MemoryFactory.trophy(
        `career:trophy:${trophyId}`,
        trophyName,
        ['trophée', competitionId],
        this.context.clock.absoluteMinutes,
      ),
    );
    if (this.contract && this.contract.titleBonus > 0) {
      this.economy.record('courant', this.contract.titleBonus, 'primes', `prime de titre — ${trophyName}`);
    }
    this.economy.addTrophyToCollection(trophyName);
    this.adjustReputation(4, 'titre');
    this.context.emit({
      type: 'career.trophyWon',
      playerId: player.identity.id,
      trophyId,
      trophyName,
      competitionId,
      season,
    });
    this.evaluateLegendStatus();
  }

  awardIndividual(awardId: string, awardName: string): void {
    this.awards.push({ id: awardId, name: awardName, season: this.seasons.season });
    this.memory.remember(
      MemoryFactory.record(
        `career:award:${awardId}`,
        awardName,
        ['récompense', 'award'],
        this.context.clock.absoluteMinutes,
      ),
    );
    this.adjustReputation(6, 'récompense individuelle');
    this.evaluateLegendStatus();
  }

  /** Sélection en équipe nationale, appelée par le calendrier international. */
  callUp(goals: number): void {
    const player = this.player;
    player.caps++;
    player.internationalGoals += goals;
    this.adjustReputation(0.8 + goals * 0.9, 'sélection nationale', player.identity.nationality);
  }

  /** Éligibilité en sélection : réputation, régularité, âge. */
  isNationalTeamEligible(): boolean {
    const player = this.player;
    if (player.retired) return false;
    const stats = currentSeasonStats(player, this.seasons.season);
    const regular = (stats?.appearances ?? 0) >= 8;
    return player.reputation > 45 && regular && !this.injured;
  }

  private evaluateLegendStatus(): void {
    const player = this.player;
    const majorTrophies = this.trophies.filter((t) => {
      try {
        return getCompetition(t.competitionId).prestige >= 88;
      } catch {
        return false;
      }
    }).length;
    const wasLegend = this.legendStatus;
    this.legendStatus =
      player.reputation >= 88 && (majorTrophies >= 3 || this.awards.length >= 3);
    if (this.legendStatus && !wasLegend) {
      this.context.emit({
        type: 'legacy.hallOfFame',
        personId: player.identity.id,
        personName: player.identity.name,
        category: 'player',
      });
      this.context.logger.info('statut de légende atteint', { joueur: player.identity.name });
    }
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    if (!this.playerState) return;
    const player = this.playerState;
    const now = context.clock.absoluteMinutes;

    // Guérison des blessures.
    const before = player.injuries.length;
    player.injuries = player.injuries.filter((injury) => injury.recoversAt > now);
    if (player.injuries.length < before) {
      player.fitness = clamp01(player.fitness + 0.25);
      player.sharpness = clamp01(player.sharpness - 0.2);
    }

    // Récupération naturelle.
    player.fitness = clamp01(player.fitness + 0.11);
    player.sharpness = clamp01(player.sharpness - 0.008);
    player.morale = clamp01(player.morale + (player.morale < 0.5 ? 0.01 : -0.003));

    // La célébrité s'érode doucement sans exposition.
    player.fame = clamp(player.fame - 0.012, 0, 100);
  }

  onWeek(context: SimulationContext, _date: GameDate): void {
    if (!this.playerState || !this.contract) return;
    // Salaire hebdomadaire.
    this.economy.record('courant', this.contract.weeklyWage, 'salaire', `salaire — ${getClub(this.contract.clubId).name}`);
    this.playerState.marketValue = computeMarketValue(this.playerState);
    void context;
  }

  onMonth(_context: SimulationContext, date: GameDate): void {
    if (!this.playerState || !this.equipmentContract) return;
    if (date.month !== 1) return;
    // Versement annuel du contrat d'équipementier, en janvier.
    this.economy.record(
      'professionnel',
      this.equipmentContract.annualValue,
      'sponsoring',
      `contrat ${getBrand(this.equipmentContract.brandId).name}`,
    );
  }

  onYear(context: SimulationContext, date: GameDate): void {
    if (!this.playerState) return;
    const player = this.playerState;
    player.age++;
    player.yearsAtClub++;
    ageAppearance(player);

    // Vieillissement des attributs physiques après le pic.
    const curve = ageCurve(player.age);
    const previousCurve = ageCurve(player.age - 1);
    if (curve < previousCurve) {
      const decline = (previousCurve - curve) * 100;
      for (const key of ATTRIBUTE_KEYS) {
        const physical =
          key === 'pace' || key === 'acceleration' || key === 'stamina' || key === 'agility' || key === 'jumping';
        if (!physical) continue;
        player.attributes[key] = clamp(round(player.attributes[key] - decline * 0.9, 2), 1, 99);
      }
    }

    player.marketValue = computeMarketValue(player);

    // Fin de contrat d'équipementier.
    if (this.equipmentContract && this.equipmentContract.expiresSeason < this.seasons.season) {
      context.emit({
        type: 'commerce.brandContract',
        brandId: this.equipmentContract.brandId,
        action: 'expired',
        annualValue: this.equipmentContract.annualValue,
      });
      this.equipmentContract = null;
    }

    // Retraite : au-delà de 33 ans, si le niveau chute ou la volonté s'éteint.
    if (!player.retired && this.shouldRetire()) this.retire(date.year);
  }

  private shouldRetire(): boolean {
    const player = this.player;
    if (player.age < 32) return false;
    const rating = baseRating(player);
    const rng = this.context.stream('career.retirement');
    const decline = clamp01((player.potential - rating) / 30);
    const ageFactor = clamp01((player.age - 32) / 8);
    const willpower = player.profile.personality.ambition * 0.6 + player.profile.personality.loyalty * 0.4;
    return rng.chance(clamp01(ageFactor * 0.55 + decline * 0.2 - willpower * 0.15));
  }

  /** Fin de carrière : tout est conservé (Tome IV, ch. 6 ; Tome XXI). */
  retire(year: number): void {
    const player = this.player;
    if (player.retired) return;
    player.retired = true;
    player.retirementYear = year;
    this.contract = null;
    this.seasons.setPlayerClub(null);
    this.evaluateLegendStatus();

    this.context.emit({
      type: 'career.retired',
      playerId: player.identity.id,
      age: player.age,
      seasonsPlayed: player.seasons.length,
    });
    this.memory.remember(
      MemoryFactory.record(
        `career:retirement`,
        `fin de carrière à ${player.age} ans`,
        ['retraite', 'carrière'],
        this.context.clock.absoluteMinutes,
      ),
    );
    this.context.logger.info('retraite sportive', {
      joueur: player.identity.name,
      age: player.age,
      trophées: this.trophies.length,
    });
  }

  /** Tome XXI, ch. 2 — nouvelles professions après la carrière. */
  availablePostRetirementRoles(): PostRetirementRole[] {
    const player = this.player;
    if (!player.retired) return [];
    const roles: PostRetirementRole[] = ['Consultant TV', 'Commentateur', 'Agent', 'Recruteur'];
    if (player.reputation > 55) roles.push('Entraîneur', 'Fondateur d’une académie');
    if (player.reputation > 70) roles.push('Sélectionneur national', 'Ambassadeur international');
    if (this.economy.netWorth > 80_000_000) roles.push('Président', 'Propriétaire d’un club');
    if (this.legendStatus) roles.push('Organisateur des Boubjack Awards');
    return roles;
  }

  takeRole(role: PostRetirementRole): boolean {
    if (!this.availablePostRetirementRoles().includes(role)) return false;
    this.postRetirementRole = role;
    this.context.emit({
      type: 'life.milestone',
      milestone: 'nouvelle carrière',
      detail: role,
    });
    return true;
  }

  /** Résumé statistique compact, utilisé par les commentateurs et la presse. */
  statline(): string {
    const player = this.player;
    const totals: SeasonStats = careerTotals(player);
    return `${totals.appearances} matchs, ${totals.goals} buts, ${totals.assists} passes décisives`;
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      player: this.playerState,
      contract: this.contract,
      equipmentContract: this.equipmentContract,
      negotiations: [...this.negotiations.values()],
      memories: this.memory.serialize(),
      formerClubIds: this.formerClubIds,
      trophies: this.trophies,
      awards: this.awards,
      postRetirementRole: this.postRetirementRole,
      legendStatus: this.legendStatus,
      negotiationCounter: this.negotiationCounter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.playerState = (state.player as PlayerState | null) ?? null;
    this.contract = (state.contract as Contract | null) ?? null;
    this.equipmentContract = (state.equipmentContract as EquipmentContract | null) ?? null;
    this.negotiations.clear();
    for (const negotiation of (state.negotiations as TransferNegotiation[]) ?? []) {
      this.negotiations.set(negotiation.id, negotiation);
    }
    this.memory.restore((state.memories as never[]) ?? []);
    this.formerClubIds.length = 0;
    this.formerClubIds.push(...(((state.formerClubIds as string[]) ?? [])));
    this.trophies.length = 0;
    this.trophies.push(...(((state.trophies as typeof this.trophies) ?? [])));
    this.awards.length = 0;
    this.awards.push(...(((state.awards as typeof this.awards) ?? [])));
    this.postRetirementRole = (state.postRetirementRole as PostRetirementRole | null) ?? null;
    this.legendStatus = Boolean(state.legendStatus);
    this.negotiationCounter = (state.negotiationCounter as number) ?? 0;
    if (this.playerState?.clubId) this.seasons.setPlayerClub(this.playerState.clubId);
  }
}

/** Note globale exportée pour les modules d'affichage. */
export { overallRating, baseRating, careerTotals };

/** Pays d'appartenance sportive du joueur, pour la presse locale. */
export function homeCountryOf(player: PlayerState): string {
  try {
    return getCountry(player.identity.nationality).name;
  } catch {
    return player.identity.nationality;
  }
}
