/**
 * Infinity Football — Événements / Calendrier mondial
 *
 * Tome XIX intégralement : championnats, coupes nationales, compétitions
 * continentales, Coupe du Monde, Jeux Olympiques, Boubjack Awards, Ballon d'Or,
 * matchs caritatifs, jubilés, matchs des légendes, stages de pré-saison et
 * tournées estivales. Chaque événement possède ses affiches, ses publicités et
 * sa couverture médiatique, transforme la ville hôte, ouvre des fan zones,
 * dispose de cérémonies d'ouverture et de clôture, et modifie l'économie locale.
 */

import { clamp01 } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { CITIES, awardsHostCities, getCity } from '../data/cities.js';
import { COMPETITIONS, getCompetition } from '../data/clubs.js';
import { LEGEND_NAMES } from '../data/names.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';

export const CALENDAR_SERVICE = 'calendar';

export type WorldEventKind =
  | 'championnat'
  | 'coupeNationale'
  | 'continentale'
  | 'coupeDuMonde'
  | 'jeuxOlympiques'
  | 'boubjackAwards'
  | 'ballonDor'
  | 'matchCaritatif'
  | 'jubile'
  | 'matchDesLegendes'
  | 'stagePreSaison'
  | 'tourneeEstivale';

export interface WorldEvent {
  readonly id: string;
  readonly kind: WorldEventKind;
  readonly name: string;
  readonly hostCityId: string;
  readonly startsAt: number;
  readonly endsAt: number;
  /** Ampleur 0..1 : détermine l'impact sur la ville et les médias. */
  readonly magnitude: number;
  readonly poster: string;
  readonly advertisingCampaign: string;
  readonly mediaCoverage: string;
  /** Fan zones ouvertes pendant l'événement. */
  readonly fanZones: FanZone[];
  readonly openingCeremony: CeremonyProgramme | null;
  readonly closingCeremony: CeremonyProgramme | null;
  active: boolean;
  concluded: boolean;
}

export interface FanZone {
  readonly id: string;
  readonly cityId: string;
  readonly districtId: string;
  readonly capacity: number;
  /** Activités disponibles (Tome XIX, ch. 4). */
  readonly activities: readonly string[];
  /** Légendes présentes pour rencontrer les supporters. */
  readonly legendsPresent: readonly string[];
  /** Concerts programmés. */
  readonly concerts: readonly string[];
  attendance: number;
}

export interface CeremonyProgramme {
  readonly kind: 'ouverture' | 'clôture';
  readonly segments: readonly string[];
  readonly durationMinutes: number;
}

const POSTERS = [
  'affiche minimaliste au ballon doré',
  'affiche typographique monumentale',
  'affiche illustrée aux couleurs du pays hôte',
  'affiche photographique en noir et blanc',
  'affiche graphique aux motifs traditionnels',
];

const CAMPAIGNS = [
  'campagne d’affichage urbain et spots TV',
  'campagne digitale et panneaux animés',
  'campagne radio et affichage dans les transports',
  'campagne cinéma et partenariats de marques',
];

const COVERAGE = [
  'diffusion mondiale sur toutes les chaînes partenaires',
  'émissions spéciales quotidiennes et magazines dédiés',
  'couverture continue avec plateaux délocalisés',
  'programmation spéciale et documentaires quotidiens',
];

const FANZONE_ACTIVITIES = [
  'écran géant',
  'boutique de souvenirs',
  'mini-jeux de précision',
  'concours de jonglage',
  'rencontres avec d’anciennes légendes',
  'concerts en soirée',
  'espace restauration du monde',
  'terrain urbain en accès libre',
];

const OPENING_SEGMENTS = [
  'spectacle chorégraphié',
  'ballet de drones lumineux',
  'feux d’artifice synchronisés',
  'performance musicale internationale',
  'présentation des équipes participantes',
  'arrivée du trophée sous escorte',
];

const CLOSING_SEGMENTS = [
  'remise des médailles',
  'remise du trophée',
  'photo officielle des vainqueurs',
  'tour d’honneur',
  'conférence de presse finale',
  'célébration avec les supporters',
];

export class WorldCalendarSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'calendar',
    name: 'Calendrier mondial',
    order: 105,
    tomes: ['XIX', 'VII', 'XXIX'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private readonly events = new Map<string, WorldEvent>();
  private eventCounter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    context.provide(CALENDAR_SERVICE, this);
    this.planYear(context.clock.date.year);
  }

  get allEvents(): WorldEvent[] {
    return [...this.events.values()].sort((a, b) => a.startsAt - b.startsAt);
  }

  get activeEvents(): WorldEvent[] {
    return this.allEvents.filter((e) => e.active);
  }

  upcoming(limit = 8): WorldEvent[] {
    const now = this.context.clock.absoluteMinutes;
    return this.allEvents.filter((e) => e.startsAt > now).slice(0, limit);
  }

  eventsInCity(cityId: string): WorldEvent[] {
    return this.allEvents.filter((e) => e.hostCityId === cityId);
  }

  onDay(context: SimulationContext, _date: GameDate): void {
    const now = context.clock.absoluteMinutes;
    for (const event of this.events.values()) {
      if (!event.active && !event.concluded && event.startsAt <= now) {
        this.startEvent(event, context);
      } else if (event.active && event.endsAt <= now) {
        this.concludeEvent(event, context);
      }
      if (event.active) this.updateFanZones(event, context);
    }
  }

  onYear(context: SimulationContext, date: GameDate): void {
    this.planYear(date.year + 1);
    // Purge des éditions anciennes pour garder la mémoire bornée.
    const cutoff = context.clock.absoluteMinutes - 5 * 365 * 24 * 60;
    for (const [id, event] of [...this.events]) {
      if (event.concluded && event.endsAt < cutoff) this.events.delete(id);
    }
  }

  /** Planifie tous les événements d'une année civile. */
  planYear(year: number): void {
    const rng = this.context.stream(`calendar.plan.${year}`);

    for (const competition of COMPETITIONS) {
      if (competition.everyYears > 1 && (year - 2026) % competition.everyYears !== 0) continue;

      const kind = this.kindFor(competition.kind);
      if (!kind) continue;

      const hostCity =
        competition.kind === 'league' || competition.kind === 'nationalCup'
          ? this.pickCityOfCountry(competition.countryId, rng)
          : this.pickGlobalHost(rng);
      if (!hostCity) continue;

      const magnitude = clamp01(competition.prestige / 100);
      const start = this.minutesFor(year, competition.startMonth, 1);
      const endYear = competition.endMonth >= competition.startMonth ? year : year + 1;
      const end = this.minutesFor(endYear, competition.endMonth, 28);

      const event: WorldEvent = {
        id: `event:${competition.id}:${year}`,
        kind,
        name: `${competition.name} ${year}`,
        hostCityId: hostCity,
        startsAt: start,
        endsAt: end,
        magnitude,
        poster: rng.pick(POSTERS),
        advertisingCampaign: rng.pick(CAMPAIGNS),
        mediaCoverage: rng.pick(COVERAGE),
        fanZones: magnitude > 0.7 ? this.buildFanZones(hostCity, rng, magnitude) : [],
        openingCeremony:
          magnitude > 0.85
            ? { kind: 'ouverture', segments: rng.pickMany(OPENING_SEGMENTS, 5), durationMinutes: rng.int(35, 70) }
            : null,
        closingCeremony:
          magnitude > 0.7
            ? { kind: 'clôture', segments: [...CLOSING_SEGMENTS], durationMinutes: rng.int(25, 50) }
            : null,
        active: false,
        concluded: false,
      };
      if (!this.events.has(event.id)) this.events.set(event.id, event);
    }

    // Événements hors compétitions officielles.
    this.planStandalone(year, 'boubjackAwards', 'Boubjack Awards', 12, 3, 0.95, rng, true);
    this.planStandalone(year, 'ballonDor', 'Cérémonie du Ballon d’Or', 11, 2, 0.9, rng, true);
    this.planStandalone(year, 'matchCaritatif', 'Match caritatif mondial', 12, 1, 0.55, rng, false);
    this.planStandalone(year, 'matchDesLegendes', 'Match des légendes', 6, 1, 0.6, rng, false);
    this.planStandalone(year, 'jubile', 'Jubilé d’une légende', 5, 1, 0.5, rng, false);
    this.planStandalone(year, 'stagePreSaison', 'Stage de pré-saison', 7, 14, 0.35, rng, false);
    this.planStandalone(year, 'tourneeEstivale', 'Tournée estivale internationale', 7, 21, 0.6, rng, false);
  }

  private planStandalone(
    year: number,
    kind: WorldEventKind,
    name: string,
    month: number,
    durationDays: number,
    magnitude: number,
    rng: ReturnType<SimulationContext['stream']>,
    preferAwardsHost: boolean,
  ): void {
    const id = `event:${kind}:${year}`;
    if (this.events.has(id)) return;
    const hostPool = preferAwardsHost ? awardsHostCities() : CITIES.filter((c) => c.tier <= 2);
    const host = rng.pick(hostPool.length > 0 ? hostPool : CITIES);
    const start = this.minutesFor(year, month, rng.int(1, 20));
    const event: WorldEvent = {
      id,
      kind,
      name: `${name} ${year}`,
      hostCityId: host.id,
      startsAt: start,
      endsAt: start + durationDays * 24 * 60,
      magnitude,
      poster: rng.pick(POSTERS),
      advertisingCampaign: rng.pick(CAMPAIGNS),
      mediaCoverage: rng.pick(COVERAGE),
      fanZones: magnitude > 0.55 ? this.buildFanZones(host.id, rng, magnitude) : [],
      openingCeremony:
        magnitude > 0.85
          ? { kind: 'ouverture', segments: rng.pickMany(OPENING_SEGMENTS, 4), durationMinutes: rng.int(25, 45) }
          : null,
      closingCeremony:
        magnitude > 0.55
          ? { kind: 'clôture', segments: rng.pickMany(CLOSING_SEGMENTS, 4), durationMinutes: rng.int(20, 40) }
          : null,
      active: false,
      concluded: false,
    };
    this.events.set(event.id, event);
  }

  private buildFanZones(
    cityId: string,
    rng: ReturnType<SimulationContext['stream']>,
    magnitude: number,
  ): FanZone[] {
    let city;
    try {
      city = this.world.city(cityId);
    } catch {
      return [];
    }
    const count = magnitude > 0.9 ? 3 : magnitude > 0.7 ? 2 : 1;
    const zones: FanZone[] = [];
    for (let i = 0; i < count; i++) {
      const district = rng.pick(city.districts);
      zones.push({
        id: `fanzone:${cityId}:${this.eventCounter++}`,
        cityId,
        districtId: district.id,
        capacity: Math.round(4000 + magnitude * 26_000),
        activities: rng.pickMany(FANZONE_ACTIVITIES, 5),
        legendsPresent: rng.pickMany(LEGEND_NAMES, 2),
        concerts: [`concert d’ouverture`, `soirée de clôture`],
        attendance: 0,
      });
    }
    return zones;
  }

  private startEvent(event: WorldEvent, context: SimulationContext): void {
    event.active = true;

    // La ville hôte se transforme (Tome XIX, ch. 3 et ch. 7).
    const decorations = [
      `affiches « ${event.name} » sur les grands axes`,
      event.advertisingCampaign,
      'écrans géants installés sur les places',
      'animations de rue quotidiennes',
      'sécurité renforcée aux abords des sites',
    ];
    if (event.fanZones.length > 0) decorations.push(`${event.fanZones.length} fan zones ouvertes`);
    this.world.decorateForEvent(event.hostCityId, decorations, event.magnitude);

    if (event.openingCeremony) {
      context.emit({
        type: 'cinematic.played',
        cinematicId: `ceremony.opening.${event.id}`,
        category: 'cérémonie d’ouverture',
        durationSeconds: event.openingCeremony.durationMinutes * 60,
        skipped: false,
      });
    }

    context.logger.info('événement mondial démarré', {
      nom: event.name,
      ville: this.cityName(event.hostCityId),
      ampleur: event.magnitude,
    });
  }

  private concludeEvent(event: WorldEvent, context: SimulationContext): void {
    event.active = false;
    event.concluded = true;

    if (event.closingCeremony) {
      context.emit({
        type: 'cinematic.played',
        cinematicId: `ceremony.closing.${event.id}`,
        category: 'cérémonie de clôture',
        durationSeconds: event.closingCeremony.durationMinutes * 60,
        skipped: false,
      });
    }
    this.world.clearEventDecorations(event.hostCityId);
    context.logger.info('événement mondial terminé', { nom: event.name });
  }

  /** Fréquentation des fan zones : météo, ampleur, phase du tournoi. */
  private updateFanZones(event: WorldEvent, context: SimulationContext): void {
    const rng = context.stream('calendar.fanzones');
    let city;
    try {
      city = this.world.city(event.hostCityId);
    } catch {
      return;
    }
    for (const zone of event.fanZones) {
      const weatherFactor = clamp01(1 - city.weather.severity * 0.9);
      zone.attendance = Math.round(
        zone.capacity * event.magnitude * weatherFactor * rng.range(0.45, 0.95),
      );
    }
  }

  private kindFor(competitionKind: string): WorldEventKind | null {
    switch (competitionKind) {
      case 'league':
        return 'championnat';
      case 'nationalCup':
        return 'coupeNationale';
      case 'continental':
        return 'continentale';
      case 'worldCup':
        return 'coupeDuMonde';
      case 'olympics':
        return 'jeuxOlympiques';
      case 'charity':
        return 'matchCaritatif';
      case 'legends':
        return 'matchDesLegendes';
      case 'friendly':
        return 'tourneeEstivale';
      default:
        return null;
    }
  }

  private pickCityOfCountry(
    countryId: string | null,
    rng: ReturnType<SimulationContext['stream']>,
  ): string | null {
    if (!countryId) return this.pickGlobalHost(rng);
    const cities = CITIES.filter((c) => c.countryId === countryId);
    return cities.length > 0 ? rng.pick(cities).id : this.pickGlobalHost(rng);
  }

  private pickGlobalHost(rng: ReturnType<SimulationContext['stream']>): string | null {
    const candidates = CITIES.filter((c) => c.tier <= 2 && c.hasAirport);
    return candidates.length > 0 ? rng.pick(candidates).id : null;
  }

  private cityName(cityId: string): string {
    try {
      return getCity(cityId).name;
    } catch {
      return cityId;
    }
  }

  private minutesFor(year: number, month: number, day: number): number {
    let days = 0;
    for (let y = 2025; y < year; y++) {
      days += (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 366 : 365;
    }
    const lengths = [
      31,
      (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
      31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    for (let m = 1; m < month; m++) days += lengths[m - 1] as number;
    days += day - 1;
    return days * 24 * 60 + 18 * 60;
  }

  /** Prochaine grande échéance du joueur, affichée par l'IA secrétaire. */
  nextMajorEvent(): WorldEvent | null {
    return this.upcoming(20).find((e) => e.magnitude > 0.8) ?? null;
  }

  /** Compétition associée à un événement, si applicable. */
  competitionOf(event: WorldEvent): ReturnType<typeof getCompetition> | null {
    const parts = event.id.split(':');
    const competitionId = parts[1];
    if (!competitionId) return null;
    try {
      return getCompetition(competitionId);
    } catch {
      return null;
    }
  }

  serialize(): unknown {
    return { events: [...this.events.values()], eventCounter: this.eventCounter };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.events.clear();
    for (const event of (state.events as WorldEvent[]) ?? []) this.events.set(event.id, event);
    this.eventCounter = (state.eventCounter as number) ?? 0;
  }
}
