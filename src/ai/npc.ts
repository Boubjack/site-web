/**
 * Infinity Football — IA / PNJ persistants
 *
 * Tome XXXII, ch. 3 : « Les PNJ vivent leur propre vie : ils changent d'emploi,
 * déménagent, voyagent, se marient, fondent une famille, vieillissent, prennent
 * leur retraite. Le joueur peut croiser plusieurs fois les mêmes personnes au
 * fil des années. »
 * Tome XX, ch. 5 : les PNJ réagissent à la célébrité, aux trophées, au club, à
 * la sélection nationale et à la réputation du joueur.
 *
 * Chaque PNJ possède : une identité, une personnalité, une mémoire, un emploi,
 * un domicile, un emploi du temps utilitaire et une relation évolutive avec le
 * joueur. Ils sont persistants entre les sessions : le vendeur croisé la
 * première saison peut avoir déménagé et fondé une famille dix ans plus tard.
 */

import { clamp, clamp01 } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { NAME_POOLS } from '../data/names.js';
import { getCountry } from '../data/countries.js';
import { clubsOfCity } from '../data/clubs.js';
import { MemoryBank, MemoryFactory, type Memory } from './memory.js';
import { randomPersonality, type Personality } from './personality.js';
import { DialogueEngine, type DialogueTone } from './dialogue.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import type { CityRuntime } from '../world/model.js';

export const NPC_SERVICE = 'npc';

export type NpcOccupation =
  | 'commerçant'
  | 'serveur'
  | 'chauffeur'
  | 'enseignant'
  | 'infirmier'
  | 'ouvrier'
  | 'cadre'
  | 'étudiant'
  | 'journaliste'
  | 'artiste'
  | 'agent de sécurité'
  | 'entraîneur amateur'
  | 'retraité'
  | 'employé d’hôtel'
  | 'vendeur automobile';

export type NpcLifeStage = 'jeune' | 'adulte' | 'parent' | 'senior' | 'retraité';

export interface Npc {
  readonly id: string;
  name: string;
  age: number;
  readonly countryId: string;
  cityId: string;
  districtId: string;
  homeVenueId: string | null;
  workVenueId: string | null;
  occupation: NpcOccupation;
  readonly personality: Personality;
  readonly memory: MemoryBank;
  /** Richesse 0..1. */
  wealth: number;
  /** Club supporté, s'il y en a un. */
  fanOfClubId: string | null;
  /** Ferveur 0..1. */
  fanIntensity: number;
  lifeStage: NpcLifeStage;
  married: boolean;
  children: number;
  /** Relation avec le joueur -1..1. */
  relationship: number;
  /** Nombre de fois où le PNJ a reconnu le joueur. */
  recognitions: number;
  /** Lieu où le PNJ se trouve actuellement. */
  currentVenueId: string | null;
  /** Activité courante, décrite pour l'affichage et les animations. */
  currentActivity: string;
  /** Le PNJ est actuellement en voyage. */
  travelling: boolean;
}

const OCCUPATIONS_BY_STAGE: Record<NpcLifeStage, readonly NpcOccupation[]> = {
  jeune: ['étudiant', 'serveur', 'vendeur automobile', 'artiste', 'ouvrier'],
  adulte: ['commerçant', 'chauffeur', 'cadre', 'journaliste', 'infirmier', 'agent de sécurité', 'employé d’hôtel'],
  parent: ['enseignant', 'cadre', 'commerçant', 'infirmier', 'entraîneur amateur', 'ouvrier'],
  senior: ['enseignant', 'commerçant', 'entraîneur amateur', 'cadre'],
  retraité: ['retraité'],
};

const WORK_VENUE_BY_OCCUPATION: Partial<Record<NpcOccupation, string>> = {
  commerçant: 'shop',
  serveur: 'restaurant',
  chauffeur: 'busStation',
  enseignant: 'school',
  infirmier: 'hospital',
  ouvrier: 'market',
  cadre: 'mall',
  étudiant: 'library',
  journaliste: 'mediaHouse',
  artiste: 'artGallery',
  'agent de sécurité': 'stadium',
  'entraîneur amateur': 'sportsCourt',
  'employé d’hôtel': 'hotel',
  'vendeur automobile': 'dealership',
};

/** Réactions possibles d'un PNJ face au joueur, selon sa célébrité. */
export type RecognitionReaction =
  | 'ignore'
  | 'regard appuyé'
  | 'sourire discret'
  | 'demande un autographe'
  | 'demande un selfie'
  | 'chante son nom'
  | 'foule enthousiaste'
  | 'remarque hostile';

export interface NpcInteractionResult {
  readonly npc: Npc;
  readonly reaction: RecognitionReaction;
  readonly line: string;
  readonly relationshipDelta: number;
}

export class NpcSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'npc',
    name: 'PNJ persistants',
    order: 30,
    tomes: ['I', 'VIII', 'XX', 'XXXII'],
  };

  private readonly npcs = new Map<string, Npc>();
  private readonly byCity = new Map<string, Set<string>>();
  private dialogue = new DialogueEngine(300);
  private context!: SimulationContext;
  private world!: WorldSystem;
  private nextIndex = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    context.provide(NPC_SERVICE, this);

    const rng = context.stream('npc.generation');
    // Chaque ville reçoit un noyau de PNJ persistants ; la foule anonyme est
    // simulée statistiquement par le WorldSystem (occupancy).
    for (const city of this.world.cities()) {
      const count = city.def.tier === 1 ? 48 : city.def.tier === 2 ? 32 : 18;
      for (let i = 0; i < count; i++) this.spawn(city, rng);
    }
    context.logger.info('PNJ persistants générés', { total: this.npcs.size });
  }

  get all(): Npc[] {
    return [...this.npcs.values()];
  }

  get count(): number {
    return this.npcs.size;
  }

  get(id: string): Npc | undefined {
    return this.npcs.get(id);
  }

  inCity(cityId: string): Npc[] {
    const ids = this.byCity.get(cityId);
    if (!ids) return [];
    const result: Npc[] = [];
    for (const id of ids) {
      const npc = this.npcs.get(id);
      if (npc) result.push(npc);
    }
    return result;
  }

  /** PNJ présents dans un lieu donné à l'instant présent. */
  atVenue(venueId: string): Npc[] {
    return this.all.filter((npc) => npc.currentVenueId === venueId);
  }

  onHour(context: SimulationContext, date: GameDate): void {
    const rng = context.stream('npc.schedule');
    for (const npc of this.npcs.values()) {
      if (npc.travelling) continue;
      this.updateActivity(npc, date, rng);
    }
  }

  onDay(context: SimulationContext, _date: GameDate): void {
    const rng = context.stream('npc.daily');
    for (const npc of this.npcs.values()) {
      // Voyages ponctuels : le monde bouge même sans le joueur.
      if (!npc.travelling && rng.chance(0.004 + npc.personality.openness * 0.006)) {
        npc.travelling = true;
        context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'travelled' });
      } else if (npc.travelling && rng.chance(0.25)) {
        npc.travelling = false;
      }
      // La relation avec le joueur s'estompe doucement sans contact.
      npc.relationship *= 0.9995;
    }
  }

  onYear(context: SimulationContext, _date: GameDate): void {
    const rng = context.stream('npc.life');
    for (const npc of this.npcs.values()) {
      npc.age += 1;
      this.advanceLifeStage(npc, context, rng);

      if (!npc.married && npc.age >= 24 && rng.chance(0.06 + npc.personality.agreeableness * 0.05)) {
        npc.married = true;
        context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'married' });
      }
      if (npc.married && npc.children < 4 && npc.age < 46 && rng.chance(0.09)) {
        npc.children += 1;
        context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'child' });
      }
      if (rng.chance(0.07)) {
        this.changeJob(npc, context, rng);
      }
      if (rng.chance(0.03)) {
        this.relocate(npc, context, rng);
      }
    }
  }

  /**
   * Interaction du joueur avec un PNJ : la réaction dépend de la célébrité, de
   * la réputation, du club soutenu et de l'historique commun.
   */
  interact(
    npc: Npc,
    options: {
      fame: number;
      reputation: number;
      playerClubId: string | null;
      playerName: string;
      action: 'passer' | 'saluer' | 'autographe' | 'selfie' | 'offrir un maillot' | 'ignorer';
    },
  ): NpcInteractionResult {
    const rng = this.context.stream('npc.interaction');
    const now = this.context.clock.absoluteMinutes;
    const affinity = this.affinityFor(npc, options.playerClubId, now);
    const reaction = this.reactionFor(npc, options.fame, affinity, options.reputation, rng);

    let delta = 0;
    switch (options.action) {
      case 'autographe':
        delta = 0.18 + npc.fanIntensity * 0.15;
        break;
      case 'selfie':
        delta = 0.16 + npc.fanIntensity * 0.14;
        break;
      case 'offrir un maillot':
        delta = 0.4 + npc.fanIntensity * 0.2;
        break;
      case 'saluer':
        delta = 0.08;
        break;
      case 'ignorer':
        delta = -0.22 * (0.5 + npc.fanIntensity);
        break;
      default:
        delta = 0.01;
    }
    if (affinity < -0.3) delta *= 0.4;

    npc.relationship = clamp(npc.relationship + delta, -1, 1);
    npc.recognitions += reaction === 'ignore' ? 0 : 1;

    npc.memory.remember(
      MemoryFactory.interaction(
        `npc:${npc.id}:meet:${now}`,
        `${options.action} avec ${options.playerName}`,
        ['joueur', options.playerName, options.action],
        now,
        delta,
      ),
    );

    const tone: DialogueTone =
      delta > 0.2 ? 'enthousiaste' : delta < 0 ? 'critique' : affinity > 0.3 ? 'admiratif' : 'neutre';
    const city = this.world.city(npc.cityId);
    const line = this.dialogue.generate(
      'supporter.rue',
      tone,
      {
        player: options.playerName,
        city: city.def.name,
        club: options.playerClubId ?? undefined,
        rival: npc.fanOfClubId ?? undefined,
      },
      rng,
    ).text;

    this.context.emit({
      type: 'npc.recognition',
      npcId: npc.id,
      reaction,
      fameLevel: options.fame,
    });

    return { npc, reaction, line, relationshipDelta: delta };
  }

  /** Réplique d'ambiance d'un PNJ croisé dans la rue. */
  ambientLine(npc: Npc): string {
    const rng = this.context.stream('npc.ambient');
    const city = this.world.city(npc.cityId);
    return this.dialogue.generate(
      'pnj.quotidien',
      npc.personality.extraversion > 0.6 ? 'enthousiaste' : 'neutre',
      { city: city.def.name, club: npc.fanOfClubId ?? undefined },
      rng,
    ).text;
  }

  /** Diffuse un souvenir mondial à tous les PNJ concernés (Tome XXV, ch. 3). */
  broadcastMemory(memory: Memory, filter?: (npc: Npc) => boolean): number {
    let count = 0;
    for (const npc of this.npcs.values()) {
      if (filter && !filter(npc)) continue;
      npc.memory.remember({ ...memory, id: `${memory.id}:${npc.id}` });
      count++;
    }
    return count;
  }

  // ── Génération et cycle de vie ───────────────────────────────────────────

  private spawn(city: CityRuntime, rng: Rng): Npc {
    const country = getCountry(city.def.countryId);
    const pool =
      NAME_POOLS.find((p) => p.countryIds.includes(country.id)) ??
      (NAME_POOLS[0] as (typeof NAME_POOLS)[number]);
    const age = rng.int(16, 78);
    const lifeStage = this.lifeStageFor(age);
    const occupation = rng.pick(OCCUPATIONS_BY_STAGE[lifeStage]);
    const district = rng.pick(city.districts);
    const homeVenue = this.pickVenue(city, ['apartment', 'villa', 'penthouse', 'chalet'], rng);
    const workType = WORK_VENUE_BY_OCCUPATION[occupation];
    const workVenue = workType ? this.pickVenue(city, [workType], rng) : null;
    const localClubs = clubsOfCity(city.id);
    const supports = localClubs.length > 0 && rng.chance(0.55 + country.footballPassion * 0.35);

    const npc: Npc = {
      id: `npc:${city.id}:${this.nextIndex++}`,
      name: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
      age,
      countryId: country.id,
      cityId: city.id,
      districtId: district.id,
      homeVenueId: homeVenue,
      workVenueId: workVenue,
      occupation,
      personality: randomPersonality(rng),
      memory: new MemoryBank({ capacity: 60, halfLifeDays: 240 }),
      wealth: clamp01(rng.gaussian(district.wealth, 0.15)),
      fanOfClubId: supports ? rng.pick(localClubs).id : null,
      fanIntensity: supports ? clamp01(rng.gaussian(country.footballPassion, 0.2)) : 0.05,
      lifeStage,
      married: age > 26 && rng.chance(0.5),
      children: age > 28 && rng.chance(0.55) ? rng.int(1, 3) : 0,
      relationship: 0,
      recognitions: 0,
      currentVenueId: homeVenue,
      currentActivity: 'à la maison',
      travelling: false,
    };

    this.npcs.set(npc.id, npc);
    let set = this.byCity.get(city.id);
    if (!set) {
      set = new Set<string>();
      this.byCity.set(city.id, set);
    }
    set.add(npc.id);
    city.npcCount = set.size;
    return npc;
  }

  private pickVenue(city: CityRuntime, types: readonly string[], rng: Rng): string | null {
    const candidates: string[] = [];
    for (const venue of city.venues.values()) {
      if (types.includes(venue.type) && venue.status !== 'permanentlyClosed') candidates.push(venue.id);
    }
    return candidates.length > 0 ? rng.pick(candidates) : null;
  }

  private lifeStageFor(age: number): NpcLifeStage {
    if (age < 25) return 'jeune';
    if (age < 34) return 'adulte';
    if (age < 52) return 'parent';
    if (age < 66) return 'senior';
    return 'retraité';
  }

  private advanceLifeStage(npc: Npc, context: SimulationContext, rng: Rng): void {
    const next = this.lifeStageFor(npc.age);
    if (next === npc.lifeStage) return;
    npc.lifeStage = next;
    if (next === 'retraité') {
      npc.occupation = 'retraité';
      npc.workVenueId = null;
      context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'retired' });
    } else {
      npc.occupation = rng.pick(OCCUPATIONS_BY_STAGE[next]);
      const city = this.world.city(npc.cityId);
      const workType = WORK_VENUE_BY_OCCUPATION[npc.occupation];
      npc.workVenueId = workType ? this.pickVenue(city, [workType], rng) : null;
    }
  }

  private changeJob(npc: Npc, context: SimulationContext, rng: Rng): void {
    if (npc.lifeStage === 'retraité') return;
    const options = OCCUPATIONS_BY_STAGE[npc.lifeStage];
    const next = rng.pick(options);
    if (next === npc.occupation) return;
    npc.occupation = next;
    const city = this.world.city(npc.cityId);
    const workType = WORK_VENUE_BY_OCCUPATION[next];
    npc.workVenueId = workType ? this.pickVenue(city, [workType], rng) : null;
    npc.wealth = clamp01(npc.wealth + rng.range(-0.08, 0.12));
    context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'jobChanged' });
  }

  private relocate(npc: Npc, context: SimulationContext, rng: Rng): void {
    const cities = this.world.cities();
    const sameCountry = cities.filter(
      (c) => c.def.countryId === npc.countryId && c.id !== npc.cityId,
    );
    const pool = sameCountry.length > 0 && rng.chance(0.75) ? sameCountry : cities;
    const target = rng.pick(pool);
    if (target.id === npc.cityId) return;

    this.byCity.get(npc.cityId)?.delete(npc.id);
    npc.cityId = target.id;
    npc.districtId = rng.pick(target.districts).id;
    npc.homeVenueId = this.pickVenue(target, ['apartment', 'villa', 'penthouse', 'chalet'], rng);
    const workType = WORK_VENUE_BY_OCCUPATION[npc.occupation];
    npc.workVenueId = workType ? this.pickVenue(target, [workType], rng) : null;
    npc.currentVenueId = npc.homeVenueId;

    let set = this.byCity.get(target.id);
    if (!set) {
      set = new Set<string>();
      this.byCity.set(target.id, set);
    }
    set.add(npc.id);
    target.npcCount = set.size;

    context.emit({ type: 'npc.lifeEvent', npcId: npc.id, change: 'moved' });
  }

  /** Emploi du temps utilitaire : choisit le lieu le plus pertinent à cette heure. */
  private updateActivity(npc: Npc, date: GameDate, rng: Rng): void {
    const city = this.world.city(npc.cityId);
    const isWeekend = date.weekday >= 5;
    const hour = date.hour;

    if (hour >= 23 || hour < 6) {
      npc.currentVenueId = npc.homeVenueId;
      npc.currentActivity = 'dort';
      return;
    }

    const candidates: Array<{ item: { venueId: string | null; label: string }; weight: number }> = [];
    const push = (venueId: string | null, label: string, weight: number): void => {
      if (weight <= 0) return;
      candidates.push({ item: { venueId, label }, weight });
    };

    if (!isWeekend && npc.workVenueId && hour >= 8 && hour < 18) {
      push(npc.workVenueId, `au travail (${npc.occupation})`, 6 + npc.personality.conscientiousness * 4);
    }
    push(npc.homeVenueId, 'à la maison', hour >= 19 ? 4 : 1.5);
    push(this.pickVenue(city, ['cafe'], rng), 'au café', hour >= 7 && hour <= 18 ? 2.5 : 0.5);
    push(this.pickVenue(city, ['restaurant'], rng), 'au restaurant',
      (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22) ? 3 : 0.3);
    push(this.pickVenue(city, ['park', 'square'], rng), 'se promène',
      city.weather.severity < 0.3 ? 2 : 0.3);
    push(this.pickVenue(city, ['mall', 'shop'], rng), 'fait des courses', isWeekend ? 3 : 1.2);
    push(this.pickVenue(city, ['gym', 'pool', 'sportsCourt'], rng), 'fait du sport',
      1.5 + npc.personality.conscientiousness * 2);
    if (npc.fanOfClubId && npc.fanIntensity > 0.5) {
      push(this.pickVenue(city, ['stadium', 'fanZone'], rng), 'suit son club',
        isWeekend ? npc.fanIntensity * 4 : npc.fanIntensity);
    }
    if (hour >= 22) {
      push(this.pickVenue(city, ['nightclub', 'billiardsHall'], rng), 'sort en ville',
        npc.personality.extraversion * 3);
    }

    if (candidates.length === 0) {
      npc.currentVenueId = npc.homeVenueId;
      npc.currentActivity = 'à la maison';
      return;
    }
    const choice = rng.weighted(candidates);
    npc.currentVenueId = choice.venueId ?? npc.homeVenueId;
    npc.currentActivity = choice.label;
  }

  /** Affinité d'un PNJ envers le joueur : club supporté + souvenirs. */
  private affinityFor(npc: Npc, playerClubId: string | null, now: number): number {
    let affinity = 0;
    if (playerClubId && npc.fanOfClubId) {
      affinity += npc.fanOfClubId === playerClubId ? npc.fanIntensity : -npc.fanIntensity * 0.55;
    }
    affinity += npc.memory.sentimentTowards('joueur', now) * 0.5;
    affinity += npc.relationship * 0.6;
    return clamp(affinity, -1, 1);
  }

  private reactionFor(
    npc: Npc,
    fame: number,
    affinity: number,
    reputation: number,
    rng: Rng,
  ): RecognitionReaction {
    const noticeChance = clamp01(fame / 100 + npc.fanIntensity * 0.3 - 0.1);
    if (!rng.chance(noticeChance)) return 'ignore';
    if (affinity < -0.45 && rng.chance(0.5)) return 'remarque hostile';
    if (fame > 92 && npc.fanIntensity > 0.7 && rng.chance(0.4)) return 'foule enthousiaste';
    if (fame > 80 && npc.fanIntensity > 0.5 && rng.chance(0.35)) return 'chante son nom';
    if (reputation > 60 && rng.chance(0.45)) return rng.chance(0.5) ? 'demande un selfie' : 'demande un autographe';
    return rng.chance(0.5) ? 'sourire discret' : 'regard appuyé';
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      nextIndex: this.nextIndex,
      npcs: [...this.npcs.values()].map((npc) => ({
        id: npc.id,
        name: npc.name,
        age: npc.age,
        countryId: npc.countryId,
        cityId: npc.cityId,
        districtId: npc.districtId,
        homeVenueId: npc.homeVenueId,
        workVenueId: npc.workVenueId,
        occupation: npc.occupation,
        personality: npc.personality,
        memories: npc.memory.serialize(),
        wealth: npc.wealth,
        fanOfClubId: npc.fanOfClubId,
        fanIntensity: npc.fanIntensity,
        lifeStage: npc.lifeStage,
        married: npc.married,
        children: npc.children,
        relationship: npc.relationship,
        recognitions: npc.recognitions,
        currentVenueId: npc.currentVenueId,
        currentActivity: npc.currentActivity,
        travelling: npc.travelling,
      })),
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as { nextIndex?: number; npcs?: Array<Record<string, unknown>> };
    if (!Array.isArray(state.npcs)) return;

    this.npcs.clear();
    this.byCity.clear();
    this.nextIndex = state.nextIndex ?? 0;

    for (const raw of state.npcs) {
      const memory = new MemoryBank({ capacity: 60, halfLifeDays: 240 });
      memory.restore((raw.memories as Memory[]) ?? []);
      const npc: Npc = {
        id: raw.id as string,
        name: raw.name as string,
        age: raw.age as number,
        countryId: raw.countryId as string,
        cityId: raw.cityId as string,
        districtId: raw.districtId as string,
        homeVenueId: (raw.homeVenueId as string | null) ?? null,
        workVenueId: (raw.workVenueId as string | null) ?? null,
        occupation: raw.occupation as NpcOccupation,
        personality: raw.personality as Personality,
        memory,
        wealth: raw.wealth as number,
        fanOfClubId: (raw.fanOfClubId as string | null) ?? null,
        fanIntensity: raw.fanIntensity as number,
        lifeStage: raw.lifeStage as NpcLifeStage,
        married: raw.married as boolean,
        children: raw.children as number,
        relationship: raw.relationship as number,
        recognitions: raw.recognitions as number,
        currentVenueId: (raw.currentVenueId as string | null) ?? null,
        currentActivity: raw.currentActivity as string,
        travelling: raw.travelling as boolean,
      };
      this.npcs.set(npc.id, npc);
      let set = this.byCity.get(npc.cityId);
      if (!set) {
        set = new Set<string>();
        this.byCity.set(npc.cityId, set);
      }
      set.add(npc.id);
    }
    this.dialogue = new DialogueEngine(300);
  }
}
