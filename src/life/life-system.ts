/**
 * Infinity Football — Vie personnelle
 *
 * Tome XI, ch. 7 : temps avec la famille, sorties entre amis, anniversaires,
 * vacances, invitations, cadeaux — les relations évoluent selon les actions.
 * Tome XVI, ch. 4 : cinématiques de vie (maison, voiture, naissance, mariage,
 * anniversaire, vacances, inauguration du musée, remise des clés).
 * Tome XXX, ch. 4-5 : activités et vacances, seul, en famille, entre amis ou
 * avec les coéquipiers ; chaque destination propose des activités exclusives.
 * Tome XXVI, ch. 4-5 : relation aux supporters et actions caritatives.
 * Tome XX, ch. 2 : gestes du quotidien contextuels.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate, Season } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { ACTIVITIES, getActivity, type ActivityDef } from '../data/activities.js';
import { getCountry } from '../data/countries.js';
import { NAME_POOLS } from '../data/names.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { TRAVEL_SERVICE, type TravelSystem } from '../transport/travel-system.js';

export const LIFE_SERVICE = 'life';

export type RelationKind =
  | 'parent'
  | 'frère/sœur'
  | 'conjoint'
  | 'enfant'
  | 'ami'
  | 'coéquipier'
  | 'agent'
  | 'mentor';

export interface Relation {
  readonly id: string;
  name: string;
  readonly kind: RelationKind;
  /** Proximité -1..1. */
  closeness: number;
  /** Jour de naissance (mois, jour) pour les rappels d'anniversaire. */
  readonly birthday: { month: number; day: number };
  /** Minute absolue du dernier contact. */
  lastContact: number;
  /** Ville de résidence. */
  cityId: string;
  /** Le proche assiste aux matchs. */
  attendsMatches: boolean;
  age: number;
  /** Pour les enfants : suit la tradition familiale (Tome XXI, ch. 6). */
  playsFootball: boolean;
}

export interface CharityProject {
  readonly id: string;
  readonly kind: 'fondation' | 'école' | 'académie' | 'hôpital' | 'association';
  readonly name: string;
  readonly cityId: string;
  readonly foundedAt: number;
  /** Financement cumulé. */
  funding: number;
  /** Niveau de développement 0..1. */
  progress: number;
  /** Bénéficiaires touchés. */
  beneficiaries: number;
}

export interface Vacation {
  readonly id: string;
  readonly destinationCityId: string;
  readonly startsAt: number;
  readonly days: number;
  readonly companions: readonly string[];
  readonly plannedActivities: string[];
  completed: boolean;
  /** Satisfaction moyenne 0..1. */
  enjoyment: number;
}

export interface DailyGesture {
  readonly id: string;
  readonly label: string;
  readonly animationClip: string;
  readonly durationMinutes: number;
}

/** Tome XX, ch. 2 — les gestes du quotidien, tous contextuels. */
export const DAILY_GESTURES: readonly DailyGesture[] = [
  { id: 'open-door', label: 'ouvrir une porte', animationClip: 'gesture.door.open', durationMinutes: 0 },
  { id: 'close-door', label: 'fermer une porte', animationClip: 'gesture.door.close', durationMinutes: 0 },
  { id: 'elevator', label: 'prendre un ascenseur', animationClip: 'gesture.elevator', durationMinutes: 1 },
  { id: 'sit', label: 's’asseoir', animationClip: 'gesture.sit', durationMinutes: 0 },
  { id: 'stand', label: 'se lever', animationClip: 'gesture.stand', durationMinutes: 0 },
  { id: 'drink', label: 'boire', animationClip: 'gesture.drink', durationMinutes: 1 },
  { id: 'eat', label: 'manger', animationClip: 'gesture.eat', durationMinutes: 25 },
  { id: 'watch-tv', label: 'regarder la télévision', animationClip: 'gesture.tv', durationMinutes: 45 },
  { id: 'listen-music', label: 'écouter de la musique', animationClip: 'gesture.music', durationMinutes: 30 },
  { id: 'read-mail', label: 'lire son courrier', animationClip: 'gesture.mail', durationMinutes: 5 },
  { id: 'sign-autograph', label: 'signer un autographe', animationClip: 'gesture.autograph', durationMinutes: 1 },
  { id: 'use-phone', label: 'utiliser son téléphone', animationClip: 'gesture.phone', durationMinutes: 3 },
  { id: 'sleep', label: 'dormir', animationClip: 'gesture.sleep', durationMinutes: 480 },
  { id: 'shake-hand', label: 'serrer la main', animationClip: 'interaction.handshake', durationMinutes: 0 },
  { id: 'hug', label: 'faire une accolade', animationClip: 'interaction.hug', durationMinutes: 0 },
  { id: 'high-five', label: 'taper dans la main', animationClip: 'interaction.highfive', durationMinutes: 0 },
  { id: 'selfie', label: 'prendre un selfie', animationClip: 'interaction.selfie', durationMinutes: 1 },
  { id: 'give-shirt', label: 'donner un maillot', animationClip: 'interaction.giveShirt', durationMinutes: 2 },
  { id: 'swap-ball', label: 'échanger un ballon', animationClip: 'interaction.swapBall', durationMinutes: 1 },
  { id: 'give-gift', label: 'offrir un cadeau', animationClip: 'interaction.gift', durationMinutes: 3 },
];

export class LifeSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'life',
    name: 'Vie personnelle',
    order: 75,
    tomes: ['XI', 'XVI', 'XX', 'XXVI', 'XXX', 'XXXI'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private travel!: TravelSystem;
  private career: CareerSystem | null = null;

  private readonly relations = new Map<string, Relation>();
  private readonly charities = new Map<string, CharityProject>();
  private readonly vacations = new Map<string, Vacation>();
  private activeVacationId: string | null = null;
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.travel = context.require<TravelSystem>(TRAVEL_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(LIFE_SERVICE, this);
    this.seedFamily();
  }

  /** Famille et entourage de départ, cohérents avec la nationalité du joueur. */
  private seedFamily(): void {
    const rng = this.context.stream('life.family');
    const nationality = this.career?.hasCareer ? this.career.player.identity.nationality : 'fr';
    const pool =
      NAME_POOLS.find((p) => p.countryIds.includes(nationality)) ??
      (NAME_POOLS[0] as (typeof NAME_POOLS)[number]);
    const cityId = this.travel.cityId;

    const add = (kind: RelationKind, closeness: number, age: number, attends: boolean): void => {
      const relation: Relation = {
        id: `relation:${this.counter++}`,
        name: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
        kind,
        closeness,
        birthday: { month: rng.int(1, 12), day: rng.int(1, 28) },
        lastContact: this.context.clock.absoluteMinutes,
        cityId,
        attendsMatches: attends,
        age,
        playsFootball: false,
      };
      this.relations.set(relation.id, relation);
    };

    add('parent', 0.85, rng.int(45, 62), true);
    add('parent', 0.85, rng.int(44, 60), true);
    add('frère/sœur', 0.7, rng.int(14, 30), true);
    add('ami', 0.6, rng.int(17, 26), false);
    add('ami', 0.55, rng.int(17, 26), false);
    add('agent', 0.5, rng.int(35, 55), false);
    add('mentor', 0.6, rng.int(48, 70), false);
  }

  // ── Relations ────────────────────────────────────────────────────────────

  get family(): Relation[] {
    return [...this.relations.values()].filter(
      (r) => r.kind === 'parent' || r.kind === 'conjoint' || r.kind === 'enfant' || r.kind === 'frère/sœur',
    );
  }

  get friends(): Relation[] {
    return [...this.relations.values()].filter((r) => r.kind === 'ami' || r.kind === 'coéquipier');
  }

  get allRelations(): Relation[] {
    return [...this.relations.values()];
  }

  relation(id: string): Relation | undefined {
    return this.relations.get(id);
  }

  /** Ajoute un coéquipier au cercle proche (relations de vestiaire). */
  addTeammate(name: string, closeness = 0.3): Relation {
    const rng = this.context.stream('life.teammates');
    const relation: Relation = {
      id: `relation:${this.counter++}`,
      name,
      kind: 'coéquipier',
      closeness,
      birthday: { month: rng.int(1, 12), day: rng.int(1, 28) },
      lastContact: this.context.clock.absoluteMinutes,
      cityId: this.travel.cityId,
      attendsMatches: false,
      age: rng.int(18, 35),
      playsFootball: true,
    };
    this.relations.set(relation.id, relation);
    return relation;
  }

  /** Passer du temps avec un proche : la relation se renforce réellement. */
  spendTime(
    relationId: string,
    activityId: string,
  ): { success: boolean; enjoyment: number; closenessDelta: number } | null {
    const relation = this.relations.get(relationId);
    if (!relation) return null;
    const result = this.doActivity(activityId, [relationId]);
    if (!result.success) return { success: false, enjoyment: 0, closenessDelta: 0 };

    const activity = getActivity(activityId);
    const delta = round(activity.socialBonus * 0.25 + result.enjoyment * 0.1, 3);
    relation.closeness = clamp(relation.closeness + delta, -1, 1);
    relation.lastContact = this.context.clock.absoluteMinutes;

    this.context.emit({
      type: 'life.relationshipChanged',
      personId: relationId,
      delta,
      value: round(relation.closeness, 3),
      reason: activity.name,
    });
    return { success: true, enjoyment: result.enjoyment, closenessDelta: delta };
  }

  /** Offrir un cadeau : l'effet dépend du montant relatif à la richesse du joueur. */
  giveGift(relationId: string, amount: number, label: string): boolean {
    const relation = this.relations.get(relationId);
    if (!relation || !this.economy.canAfford(amount, 'courant')) return false;
    this.economy.record('courant', -amount, 'cadeaux', `${label} — ${relation.name}`);
    const generosity = clamp01(amount / Math.max(1000, this.economy.liquidity * 0.02));
    const delta = round(0.05 + generosity * 0.25, 3);
    relation.closeness = clamp(relation.closeness + delta, -1, 1);
    relation.lastContact = this.context.clock.absoluteMinutes;
    this.context.emit({
      type: 'life.relationshipChanged',
      personId: relationId,
      delta,
      value: round(relation.closeness, 3),
      reason: `cadeau : ${label}`,
    });
    return true;
  }

  /** Organiser un anniversaire (Tome XI, ch. 7 ; cinématique Tome XVI, ch. 4). */
  organiseBirthday(relationId: string, budget: number): boolean {
    const relation = this.relations.get(relationId);
    if (!relation || !this.economy.canAfford(budget, 'courant')) return false;
    this.economy.record('courant', -budget, 'événements', `anniversaire de ${relation.name}`);
    const quality = clamp01(budget / 25_000);
    relation.closeness = clamp(relation.closeness + 0.12 + quality * 0.2, -1, 1);

    // Tous les proches présents voient leur relation progresser.
    for (const other of this.relations.values()) {
      if (other.id === relationId) continue;
      if (other.closeness > 0.3) other.closeness = clamp(other.closeness + 0.03, -1, 1);
    }

    this.context.emit({
      type: 'life.milestone',
      milestone: 'anniversaire',
      detail: `${relation.name} — budget ${budget.toLocaleString('fr-FR')} €`,
    });
    this.context.emit({
      type: 'cinematic.played',
      cinematicId: 'life.birthday',
      category: 'vie personnelle',
      durationSeconds: 55,
      skipped: false,
    });
    return true;
  }

  /** Étapes de vie majeures : mariage, naissance, emménagement. */
  milestone(kind: 'mariage' | 'naissance' | 'emménagement' | 'inauguration du musée', detail: string): void {
    if (kind === 'mariage') {
      const rng = this.context.stream('life.marriage');
      const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
      const spouse: Relation = {
        id: `relation:${this.counter++}`,
        name: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
        kind: 'conjoint',
        closeness: 0.9,
        birthday: { month: rng.int(1, 12), day: rng.int(1, 28) },
        lastContact: this.context.clock.absoluteMinutes,
        cityId: this.travel.cityId,
        attendsMatches: true,
        age: rng.int(22, 34),
        playsFootball: false,
      };
      this.relations.set(spouse.id, spouse);
    }
    if (kind === 'naissance') {
      const rng = this.context.stream('life.children');
      const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
      const child: Relation = {
        id: `relation:${this.counter++}`,
        name: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
        kind: 'enfant',
        closeness: 1,
        birthday: {
          month: this.context.clock.date.month,
          day: this.context.clock.date.day,
        },
        lastContact: this.context.clock.absoluteMinutes,
        cityId: this.travel.cityId,
        attendsMatches: true,
        age: 0,
        playsFootball: false,
      };
      this.relations.set(child.id, child);
    }

    this.context.emit({ type: 'life.milestone', milestone: kind, detail });
    this.context.emit({
      type: 'cinematic.played',
      cinematicId: `life.${kind}`,
      category: 'vie personnelle',
      durationSeconds: 80,
      skipped: false,
    });
  }

  // ── Activités (Tome XXX, ch. 4) ──────────────────────────────────────────

  /** Activités réellement praticables ici et maintenant. */
  availableActivities(cityId = this.travel.cityId): ActivityDef[] {
    const city = this.world.city(cityId);
    const country = getCountry(city.def.countryId);
    const season = this.seasonOf(this.context.clock.date, country.hemisphere);
    const venueTypes = new Set([...city.venues.values()].filter((v) => v.open).map((v) => v.type));

    return ACTIVITIES.filter((activity) => {
      if (!venueTypes.has(activity.venueType as never)) return false;
      if (activity.seasons.length > 0 && !activity.seasons.includes(season)) return false;
      if (activity.blockedByWeather.includes(city.weather.condition)) return false;
      if (
        activity.requiresTerrain.length > 0 &&
        !activity.requiresTerrain.some((terrain) => country.terrain.includes(terrain))
      ) {
        return false;
      }
      return true;
    });
  }

  /** Pratique une activité : coût, temps, fatigue, plaisir, risque de blessure. */
  doActivity(
    activityId: string,
    companionIds: readonly string[] = [],
  ): { success: boolean; enjoyment: number; fatigue: number; injured: boolean } {
    const activity = getActivity(activityId);
    const cityId = this.travel.cityId;
    if (!this.availableActivities(cityId).some((a) => a.id === activityId)) {
      return { success: false, enjoyment: 0, fatigue: 0, injured: false };
    }
    const city = this.world.city(cityId);
    const cost = round(activity.costEur * city.priceMultiplier, 2);
    if (cost > 0 && !this.economy.canAfford(cost, 'courant')) {
      return { success: false, enjoyment: 0, fatigue: 0, injured: false };
    }
    if (cost > 0) this.economy.record('courant', -cost, 'loisirs', activity.name);

    const rng = this.context.stream('life.activities');
    const companionBonus = companionIds.length > 0 ? activity.socialBonus * 0.5 : 0;
    const weatherPenalty = city.weather.severity * 0.3;
    const enjoyment = clamp01(activity.enjoyment + companionBonus - weatherPenalty + rng.range(-0.1, 0.1));
    const fatigue = clamp(activity.fatigue, -1, 1);

    this.context.clock.advanceMinutes(activity.durationMinutes);

    let injured = false;
    if (this.career?.hasCareer) {
      const player = this.career.player;
      player.fitness = clamp01(player.fitness - fatigue * 0.5);
      player.morale = clamp01(player.morale + enjoyment * 0.08);
      if (rng.chance(activity.injuryRisk)) {
        this.career.injure('light', rng);
        injured = true;
      }
    }

    for (const companionId of companionIds) {
      const relation = this.relations.get(companionId);
      if (!relation) continue;
      relation.lastContact = this.context.clock.absoluteMinutes;
    }

    this.context.emit({
      type: 'life.activity',
      activityId,
      cityId,
      enjoyment: round(enjoyment, 3),
      fatigue: round(fatigue, 3),
    });
    return { success: true, enjoyment, fatigue, injured };
  }

  /** Geste contextuel du quotidien : anime le personnage sans quitter le monde. */
  performGesture(gestureId: string): DailyGesture | null {
    const gesture = DAILY_GESTURES.find((g) => g.id === gestureId);
    if (!gesture) return null;
    if (gesture.durationMinutes > 0) this.context.clock.advanceMinutes(gesture.durationMinutes);
    this.context.emit({
      type: 'animation.played',
      clipId: gesture.animationClip,
      actorId: 'player',
      context: gesture.label,
    });
    if (gesture.id === 'sleep' && this.career?.hasCareer) {
      const player = this.career.player;
      player.fitness = clamp01(player.fitness + 0.35);
      player.morale = clamp01(player.morale + 0.05);
    }
    return gesture;
  }

  // ── Vacances (Tome XXX, ch. 5) ───────────────────────────────────────────

  /** Destinations proposées : chaque ville a ses activités exclusives. */
  vacationDestinations(limit = 8): Array<{ cityId: string; name: string; exclusiveActivities: string[]; tourism: number }> {
    return this.world
      .cities()
      .filter((city) => city.def.tourism > 0.6 && city.id !== this.travel.cityId)
      .sort((a, b) => b.def.tourism - a.def.tourism)
      .slice(0, limit)
      .map((city) => ({
        cityId: city.id,
        name: city.def.name,
        exclusiveActivities: this.availableActivities(city.id)
          .filter((a) => a.exclusive)
          .map((a) => a.name),
        tourism: city.def.tourism,
      }));
  }

  /** Planifie des vacances : le voyage est réservé et joué réellement. */
  planVacation(
    destinationCityId: string,
    days: number,
    companionIds: readonly string[] = [],
  ): Vacation | null {
    const journey = this.travel.book(destinationCityId, {
      prefer: 'comfort',
      companions: companionIds.map((id) => this.relations.get(id)?.name ?? id),
    });
    if (!journey) return null;
    this.travel.travel(journey.id);

    const hotelNights = Math.max(1, days);
    this.travel.bookHotel(destinationCityId, hotelNights, companionIds.length > 2 ? 'suite présidentielle' : 'suite');

    const vacation: Vacation = {
      id: `vacation:${this.counter++}`,
      destinationCityId,
      startsAt: this.context.clock.absoluteMinutes,
      days,
      companions: companionIds,
      plannedActivities: this.availableActivities(destinationCityId)
        .slice(0, Math.min(6, days * 2))
        .map((a) => a.id),
      completed: false,
      enjoyment: 0,
    };
    this.vacations.set(vacation.id, vacation);
    this.activeVacationId = vacation.id;

    this.context.emit({
      type: 'life.vacation',
      destinationCityId,
      companions: companionIds,
      days,
    });
    this.context.emit({
      type: 'cinematic.played',
      cinematicId: 'life.vacation.arrival',
      category: 'vie personnelle',
      durationSeconds: 45,
      skipped: false,
    });
    return vacation;
  }

  /** Déroule les vacances : les activités planifiées sont pratiquées jour après jour. */
  runVacation(vacationId?: string): Vacation | null {
    const id = vacationId ?? this.activeVacationId;
    if (!id) return null;
    const vacation = this.vacations.get(id);
    if (!vacation || vacation.completed) return null;

    let totalEnjoyment = 0;
    let count = 0;
    for (const activityId of vacation.plannedActivities) {
      const result = this.doActivity(activityId, vacation.companions);
      if (!result.success) continue;
      totalEnjoyment += result.enjoyment;
      count++;
    }
    // Le reste du séjour : repos et récupération.
    const remainingMinutes = Math.max(0, vacation.days * 24 * 60 - (this.context.clock.absoluteMinutes - vacation.startsAt));
    if (remainingMinutes > 0) this.context.clock.advanceMinutes(remainingMinutes);

    vacation.enjoyment = count > 0 ? round(totalEnjoyment / count, 3) : 0.5;
    vacation.completed = true;
    this.activeVacationId = null;

    if (this.career?.hasCareer) {
      const player = this.career.player;
      player.fitness = clamp01(player.fitness + 0.4);
      player.morale = clamp01(player.morale + vacation.enjoyment * 0.3);
      player.sharpness = clamp01(player.sharpness - 0.15);
    }
    for (const companionId of vacation.companions) {
      const relation = this.relations.get(companionId);
      if (relation) relation.closeness = clamp(relation.closeness + 0.15, -1, 1);
    }
    return vacation;
  }

  get vacationHistory(): Vacation[] {
    return [...this.vacations.values()].sort((a, b) => b.startsAt - a.startsAt);
  }

  // ── Actions caritatives (Tome XXVI, ch. 5) ───────────────────────────────

  foundCharity(
    kind: CharityProject['kind'],
    name: string,
    cityId: string,
    initialFunding: number,
  ): CharityProject | null {
    if (!this.economy.canAfford(initialFunding, 'courant')) return null;
    this.economy.donate(name, initialFunding);
    const project: CharityProject = {
      id: `charity:${this.counter++}`,
      kind,
      name,
      cityId,
      foundedAt: this.context.clock.absoluteMinutes,
      funding: initialFunding,
      progress: 0.05,
      beneficiaries: 0,
    };
    this.charities.set(project.id, project);
    this.career?.adjustReputation(2.5, 'projet caritatif');
    this.context.emit({
      type: 'life.charity',
      projectId: project.id,
      action: 'founded',
      amount: initialFunding,
    });
    return project;
  }

  fundCharity(projectId: string, amount: number): boolean {
    const project = this.charities.get(projectId);
    if (!project || !this.economy.canAfford(amount, 'courant')) return false;
    this.economy.donate(project.name, amount);
    project.funding = round(project.funding + amount, 2);
    project.progress = clamp01(project.progress + amount / 2_000_000);
    this.career?.adjustReputation(0.8, 'don caritatif');
    this.context.emit({ type: 'life.charity', projectId, action: 'funded', amount });
    return true;
  }

  get charityProjects(): CharityProject[] {
    return [...this.charities.values()];
  }

  // ── Relation aux supporters (Tome XXVI, ch. 4) ───────────────────────────

  meetFans(
    action: 'autographes' | 'selfies' | 'don de maillot' | 'événement fan' | 'association de supporters',
  ): { reputationDelta: number; fansReached: number } {
    const rng = this.context.stream('life.fans');
    const fame = this.career?.hasCareer ? this.career.player.fame : 20;
    const table: Record<typeof action, { rep: number; reach: number }> = {
      autographes: { rep: 0.5, reach: 40 },
      selfies: { rep: 0.45, reach: 60 },
      'don de maillot': { rep: 1.2, reach: 15 },
      'événement fan': { rep: 2.2, reach: 400 },
      'association de supporters': { rep: 2.8, reach: 150 },
    };
    const entry = table[action];
    const fansReached = Math.round(entry.reach * (0.5 + fame / 100) * rng.range(0.8, 1.3));
    const reputationDelta = round(entry.rep * (0.7 + fame / 200), 3);
    this.career?.adjustReputation(reputationDelta, `rencontre supporters (${action})`);
    this.context.emit({
      type: 'player.interaction',
      interaction: action,
      targetId: 'supporters',
      satisfaction: clamp01(0.6 + reputationDelta / 5),
    });
    return { reputationDelta, fansReached };
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, date: GameDate): void {
    const now = context.clock.absoluteMinutes;

    for (const relation of this.relations.values()) {
      // Les relations s'étiolent sans contact.
      const daysSinceContact = (now - relation.lastContact) / (24 * 60);
      if (daysSinceContact > 14) {
        relation.closeness = clamp(relation.closeness - 0.004, -1, 1);
      }
      // Rappel d'anniversaire via l'IA secrétaire.
      if (relation.birthday.month === date.month && relation.birthday.day === date.day) {
        context.emit({
          type: 'assistant.reminder',
          subject: 'anniversaire',
          detail: `${relation.name} (${relation.kind}) fête son anniversaire aujourd'hui`,
          dueAt: now,
        });
      }
    }

    // Les projets caritatifs progressent et touchent des bénéficiaires.
    const rng = context.stream('life.charityTick');
    for (const project of this.charities.values()) {
      if (project.progress >= 1) continue;
      project.progress = clamp01(project.progress + 0.0009 + project.funding / 60_000_000);
      project.beneficiaries += Math.round(project.progress * rng.range(1, 8));
      if (project.progress >= 1) {
        context.emit({
          type: 'life.charity',
          projectId: project.id,
          action: 'milestone',
          amount: project.funding,
        });
      }
    }
  }

  onYear(_context: SimulationContext, _date: GameDate): void {
    const rng = this.context.stream('life.aging');
    for (const relation of this.relations.values()) {
      relation.age++;
      // Les enfants suivent parfois la tradition familiale (Tome XXI, ch. 6).
      if (relation.kind === 'enfant' && relation.age >= 6 && !relation.playsFootball) {
        if (rng.chance(0.35)) {
          relation.playsFootball = true;
          this.context.emit({
            type: 'life.milestone',
            milestone: 'tradition familiale',
            detail: `${relation.name} commence le football`,
          });
        }
      }
    }
  }

  private seasonOf(date: GameDate, hemisphere: 'north' | 'south'): Season {
    const northern: Season =
      date.month === 12 || date.month <= 2
        ? 'winter'
        : date.month <= 5
          ? 'spring'
          : date.month <= 8
            ? 'summer'
            : 'autumn';
    if (hemisphere === 'north') return northern;
    const flip: Record<Season, Season> = {
      winter: 'summer',
      spring: 'autumn',
      summer: 'winter',
      autumn: 'spring',
    };
    return flip[northern];
  }

  serialize(): unknown {
    return {
      relations: [...this.relations.values()],
      charities: [...this.charities.values()],
      vacations: [...this.vacations.values()],
      activeVacationId: this.activeVacationId,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.relations.clear();
    for (const relation of (state.relations as Relation[]) ?? []) this.relations.set(relation.id, relation);
    this.charities.clear();
    for (const project of (state.charities as CharityProject[]) ?? []) this.charities.set(project.id, project);
    this.vacations.clear();
    for (const vacation of (state.vacations as Vacation[]) ?? []) this.vacations.set(vacation.id, vacation);
    this.activeVacationId = (state.activeVacationId as string | null) ?? null;
    this.counter = (state.counter as number) ?? 0;
  }
}
