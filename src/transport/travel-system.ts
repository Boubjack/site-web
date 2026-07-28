/**
 * Infinity Football — Transport / Voyages
 *
 * Tome XXX, ch. 3 et Tome XXX v2, ch. 3 : tous les modes de transport, et
 * « le voyage est entièrement jouable » — réservation, embarquement, décollage,
 * vol, arrivée, récupération des bagages, trajet jusqu'à l'hôtel.
 * Tome XVI, ch. 6 : cinématiques dynamiques associées à chaque étape.
 *
 * Le système gère la position du joueur dans le monde, les trajets locaux, les
 * voyages intervilles multimodaux, la fatigue induite et les réservations.
 */

import { clamp01, haversineKm, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import {
  MODE_PROFILES,
  bestLocalMode,
  routeBetweenCities,
  routeWithinCity,
  type TransportMode,
  type WorldRoute,
} from '../world/navigation.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';

export const TRAVEL_SERVICE = 'travel';

export type JourneyStage =
  | 'réservation'
  | 'trajet vers le terminal'
  | 'enregistrement'
  | 'embarquement'
  | 'décollage'
  | 'en vol'
  | 'atterrissage'
  | 'récupération des bagages'
  | 'trajet vers l’hôtel'
  | 'arrivée'
  | 'en route'
  | 'terminé';

export interface Journey {
  readonly id: string;
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly route: WorldRoute;
  readonly bookedAt: number;
  readonly departsAt: number;
  arrivesAt: number;
  stage: JourneyStage;
  /** Étapes déjà franchies, horodatées. */
  readonly log: Array<{ at: number; stage: JourneyStage }>;
  readonly cost: number;
  /** Compagnons de voyage (famille, amis, coéquipiers). */
  readonly companions: readonly string[];
  /** Fatigue accumulée par le trajet 0..1. */
  fatigue: number;
  completed: boolean;
}

export interface HotelBooking {
  readonly id: string;
  readonly cityId: string;
  readonly venueId: string;
  readonly nights: number;
  readonly pricePerNight: number;
  readonly checkIn: number;
  readonly checkOut: number;
  readonly roomType: 'chambre' | 'suite' | 'suite présidentielle';
}

export interface RestaurantBooking {
  readonly id: string;
  readonly cityId: string;
  readonly venueId: string;
  readonly at: number;
  readonly guests: number;
}

/** Étapes détaillées selon le mode principal du voyage. */
const STAGE_FLOWS: Record<string, readonly JourneyStage[]> = {
  plane: [
    'réservation',
    'trajet vers le terminal',
    'enregistrement',
    'embarquement',
    'décollage',
    'en vol',
    'atterrissage',
    'récupération des bagages',
    'trajet vers l’hôtel',
    'arrivée',
  ],
  privateJet: [
    'réservation',
    'trajet vers le terminal',
    'embarquement',
    'décollage',
    'en vol',
    'atterrissage',
    'trajet vers l’hôtel',
    'arrivée',
  ],
  helicopter: ['réservation', 'embarquement', 'décollage', 'en vol', 'atterrissage', 'arrivée'],
  train: ['réservation', 'trajet vers le terminal', 'embarquement', 'en route', 'arrivée'],
  yacht: ['réservation', 'embarquement', 'en route', 'arrivée'],
  default: ['réservation', 'en route', 'arrivée'],
};

export class TravelSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'travel',
    name: 'Voyages & transports',
    order: 65,
    tomes: ['II', 'XVI', 'XXX'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private career: CareerSystem | null = null;

  private currentCity = 'paris';
  private currentVenueId: string | null = null;
  private readonly journeys = new Map<string, Journey>();
  private activeJourneyId: string | null = null;
  private readonly hotelBookings = new Map<string, HotelBooking>();
  private readonly restaurantBookings = new Map<string, RestaurantBooking>();
  /** Modes de transport débloqués (véhicules possédés, services payants). */
  private readonly unlockedModes = new Set<TransportMode>([
    'walk', 'bike', 'bus', 'metro', 'taxi', 'vtc', 'train', 'plane',
  ]);
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(TRAVEL_SERVICE, this);

    const first = this.world.cities()[0];
    if (first) {
      this.currentCity = first.id;
      const home = [...first.venues.values()].find((v) => v.type === 'apartment');
      this.currentVenueId = home?.id ?? null;
    }
    this.world.setFocusCity(this.currentCity);
  }

  get cityId(): string {
    return this.currentCity;
  }

  get venueId(): string | null {
    return this.currentVenueId;
  }

  get availableModes(): TransportMode[] {
    const modes = [...this.unlockedModes];
    // Un véhicule possédé débloque la conduite personnelle.
    if (this.economy.garage.length > 0) {
      if (!modes.includes('car')) modes.push('car');
      if (this.economy.garage.some((v) => v.definitionId.includes('moto')) && !modes.includes('moto')) {
        modes.push('moto');
      }
    }
    if (this.economy.hasRole('chauffeur') && !modes.includes('limousine')) modes.push('limousine');
    if (this.economy.hasRole('pilote privé')) {
      if (!modes.includes('privateJet')) modes.push('privateJet');
      if (!modes.includes('helicopter')) modes.push('helicopter');
    }
    if (this.economy.netWorth > 30_000_000 && !modes.includes('yacht')) modes.push('yacht');
    return modes;
  }

  unlockMode(mode: TransportMode): void {
    this.unlockedModes.add(mode);
  }

  // ── Déplacements locaux ──────────────────────────────────────────────────

  /**
   * Déplacement dans la ville courante. Le joueur ouvre réellement la porte,
   * monte dans le véhicule et parcourt l'itinéraire (Tome II, ch. 1.5).
   */
  goTo(
    venueId: string,
    options: { mode?: TransportMode; prefer?: 'fast' | 'cheap' | 'discreet' | 'comfort' } = {},
  ): { arrived: boolean; minutes: number; cost: number; mode: TransportMode; steps: string[] } {
    const city = this.world.city(this.currentCity);
    const target = city.venues.get(venueId);
    if (!target) return { arrived: false, minutes: 0, cost: 0, mode: 'walk', steps: [] };

    const fromId = this.currentVenueId ?? (city.districts[0]?.id ?? venueId);
    const from = city.venues.get(fromId);
    const distanceKm = from
      ? Math.hypot(target.position.x - from.position.x, target.position.y - from.position.y)
      : 3;

    const mode =
      options.mode ??
      bestLocalMode(city, distanceKm, {
        available: this.availableModes,
        prefer: options.prefer ?? (this.career?.hasCareer && this.career.player.fame > 75 ? 'discreet' : 'fast'),
      });

    const route = routeWithinCity(city, fromId, venueId, mode);
    if (!route.found) return { arrived: false, minutes: 0, cost: 0, mode, steps: [] };

    if (route.costEur > 0) {
      this.economy.record('courant', -route.costEur, 'transport', `${MODE_PROFILES[mode].label} — ${target.name}`);
    }
    if (mode === 'car' || mode === 'moto') {
      const vehicle = this.economy.garage[0];
      if (vehicle) this.economy.driveVehicle(vehicle.id, route.distanceKm);
    }

    this.context.clock.advanceMinutes(Math.round(route.durationMinutes));
    const previousVenue = this.currentVenueId;
    this.currentVenueId = venueId;

    this.context.emit({
      type: 'player.moved',
      fromLocationId: previousVenue ?? 'inconnu',
      toLocationId: venueId,
      cityId: this.currentCity,
    });
    if (target.hidden && !target.discovered) this.world.discover(this.currentCity, venueId);

    return {
      arrived: true,
      minutes: Math.round(route.durationMinutes),
      cost: round(route.costEur, 2),
      mode,
      steps: route.steps.map((step) => step.name),
    };
  }

  /** Entrée dans un lieu et dans une pièce précise (Tome II, ch. 1.3). */
  enter(venueId: string, roomId?: string): { entered: boolean; room: string | null } {
    const city = this.world.city(this.currentCity);
    const venue = city.venues.get(venueId);
    if (!venue || !venue.open) return { entered: false, room: null };
    this.currentVenueId = venueId;
    const room = roomId ? venue.rooms.find((r) => r.id === roomId) : venue.rooms[0];
    if (room && !room.accessible) return { entered: false, room: null };
    this.context.emit({
      type: 'player.enteredInterior',
      venueId,
      roomId: room?.id ?? 'entrée',
    });
    return { entered: true, room: room?.name ?? null };
  }

  // ── Voyages intervilles ──────────────────────────────────────────────────

  /** Devis de voyage : itinéraires possibles avec durée et coût. */
  quote(
    toCityId: string,
    prefer: 'fast' | 'cheap' | 'discreet' | 'comfort' = 'fast',
  ): WorldRoute {
    return routeBetweenCities(this.world.world, this.currentCity, toCityId, {
      prefer,
      allowedModes: this.availableModes,
    });
  }

  /** Réserve et démarre un voyage. Le trajet est ensuite joué étape par étape. */
  book(
    toCityId: string,
    options: {
      prefer?: 'fast' | 'cheap' | 'discreet' | 'comfort';
      companions?: readonly string[];
      departInMinutes?: number;
    } = {},
  ): Journey | null {
    if (toCityId === this.currentCity) return null;
    const route = this.quote(toCityId, options.prefer ?? 'fast');
    if (!route.found || route.legs.length === 0) return null;
    const cost = round(route.totalCostEur * (1 + (options.companions?.length ?? 0) * 0.85), 2);
    if (!this.economy.canAfford(cost, 'courant')) return null;

    const now = this.context.clock.absoluteMinutes;
    const departsAt = now + (options.departInMinutes ?? 60);
    const primaryMode = route.legs[0]?.mode ?? 'plane';

    const journey: Journey = {
      id: `journey:${this.counter++}`,
      fromCityId: this.currentCity,
      toCityId,
      route,
      bookedAt: now,
      departsAt,
      arrivesAt: departsAt + Math.round(route.totalMinutes),
      stage: 'réservation',
      log: [{ at: now, stage: 'réservation' }],
      cost,
      companions: options.companions ?? [],
      fatigue: 0,
      completed: false,
    };
    this.journeys.set(journey.id, journey);
    this.activeJourneyId = journey.id;

    this.economy.record('courant', -cost, 'voyage', `${MODE_PROFILES[primaryMode].label} vers ${toCityId}`);
    this.context.emit({
      type: 'travel.booked',
      journeyId: journey.id,
      mode: primaryMode,
      fromCityId: this.currentCity,
      toCityId,
      cost,
    });
    return journey;
  }

  /**
   * Joue le voyage jusqu'à l'arrivée : chaque étape avance l'horloge, émet une
   * cinématique et accumule de la fatigue selon le confort du mode.
   */
  travel(journeyId?: string): Journey | null {
    const id = journeyId ?? this.activeJourneyId;
    if (!id) return null;
    const journey = this.journeys.get(id);
    if (!journey || journey.completed) return null;

    const primaryMode = journey.route.legs[0]?.mode ?? 'plane';
    const flow = STAGE_FLOWS[primaryMode] ?? STAGE_FLOWS.default ?? [];
    const totalMinutes = Math.max(1, journey.route.totalMinutes);
    const comfort = MODE_PROFILES[primaryMode].comfort;

    for (const stage of flow) {
      journey.stage = stage;
      const share = this.stageShare(stage);
      const minutes = Math.round(totalMinutes * share);
      if (minutes > 0) this.context.clock.advanceMinutes(minutes);
      journey.log.push({ at: this.context.clock.absoluteMinutes, stage });

      this.context.emit({ type: 'travel.stage', journeyId: journey.id, stage });
      this.context.emit({
        type: 'cinematic.played',
        cinematicId: `travel.${stage}`,
        category: 'open world',
        durationSeconds: Math.max(6, Math.round(minutes / 4)),
        skipped: false,
      });
    }

    journey.fatigue = clamp01((totalMinutes / 600) * (1 - comfort * 0.7));
    journey.arrivesAt = this.context.clock.absoluteMinutes;
    journey.stage = 'terminé';
    journey.completed = true;
    this.activeJourneyId = null;

    // Arrivée effective dans la ville de destination : elle devient la ville
    // simulée en détail maximal.
    this.currentCity = journey.toCityId;
    this.world.setFocusCity(this.currentCity);
    const city = this.world.city(this.currentCity);
    const hotel = [...city.venues.values()].find((v) => v.type === 'hotel');
    this.currentVenueId = hotel?.id ?? null;

    if (this.career?.hasCareer) {
      const player = this.career.player;
      player.fitness = clamp01(player.fitness - journey.fatigue * 0.5);
    }

    this.context.emit({
      type: 'travel.completed',
      journeyId: journey.id,
      toCityId: journey.toCityId,
      fatigue: round(journey.fatigue, 3),
    });
    return journey;
  }

  private stageShare(stage: JourneyStage): number {
    switch (stage) {
      case 'réservation':
        return 0;
      case 'trajet vers le terminal':
        return 0.08;
      case 'enregistrement':
        return 0.05;
      case 'embarquement':
        return 0.06;
      case 'décollage':
        return 0.03;
      case 'en vol':
      case 'en route':
        return 0.6;
      case 'atterrissage':
        return 0.03;
      case 'récupération des bagages':
        return 0.05;
      case 'trajet vers l’hôtel':
        return 0.09;
      default:
        return 0.01;
    }
  }

  get activeJourney(): Journey | null {
    return this.activeJourneyId ? this.journeys.get(this.activeJourneyId) ?? null : null;
  }

  get journeyHistory(): Journey[] {
    return [...this.journeys.values()].sort((a, b) => b.bookedAt - a.bookedAt);
  }

  /** Distance parcourue depuis le début de la carrière, en kilomètres. */
  get totalDistanceKm(): number {
    return round(
      [...this.journeys.values()].reduce((sum, j) => sum + j.route.totalDistanceKm, 0),
      1,
    );
  }

  // ── Réservations (Tome VIII, ch. 5 — l'IA secrétaire réserve pour le joueur) ──

  bookHotel(
    cityId: string,
    nights: number,
    roomType: HotelBooking['roomType'] = 'suite',
  ): HotelBooking | null {
    const city = this.world.city(cityId);
    const hotels = [...city.venues.values()].filter((v) => v.type === 'hotel' && v.status === 'open');
    if (hotels.length === 0) return null;
    const rng = this.context.stream('travel.hotels');
    const hotel = rng.pick(hotels);
    const basePrice = 180 * (1 + hotel.priceLevel * 0.55) * city.priceMultiplier;
    const multiplier = roomType === 'suite présidentielle' ? 6 : roomType === 'suite' ? 2.4 : 1;
    const pricePerNight = Math.round(basePrice * multiplier);
    const total = pricePerNight * nights;
    if (!this.economy.canAfford(total, 'courant')) return null;

    const checkIn = this.context.clock.absoluteMinutes;
    const booking: HotelBooking = {
      id: `hotel:${this.counter++}`,
      cityId,
      venueId: hotel.id,
      nights,
      pricePerNight,
      checkIn,
      checkOut: checkIn + nights * 24 * 60,
      roomType,
    };
    this.hotelBookings.set(booking.id, booking);
    this.economy.record('courant', -total, 'hébergement', `${hotel.name} — ${nights} nuit(s)`);
    return booking;
  }

  bookRestaurant(cityId: string, guests: number, inHours = 4): RestaurantBooking | null {
    const city = this.world.city(cityId);
    const restaurants = [...city.venues.values()].filter(
      (v) => v.type === 'restaurant' && v.status === 'open',
    );
    if (restaurants.length === 0) return null;
    const rng = this.context.stream('travel.restaurants');
    const restaurant = rng.pick(restaurants);
    const booking: RestaurantBooking = {
      id: `resto:${this.counter++}`,
      cityId,
      venueId: restaurant.id,
      at: this.context.clock.absoluteMinutes + inHours * 60,
      guests,
    };
    this.restaurantBookings.set(booking.id, booking);
    return booking;
  }

  get bookings(): { hotels: HotelBooking[]; restaurants: RestaurantBooking[] } {
    return {
      hotels: [...this.hotelBookings.values()],
      restaurants: [...this.restaurantBookings.values()],
    };
  }

  /** Téléportation contrôlée, utilisée par les scripts de carrière et les tests. */
  relocateTo(cityId: string, venueId: string | null = null): void {
    this.currentCity = cityId;
    this.currentVenueId = venueId;
    this.world.setFocusCity(cityId);
  }

  /** Distance directe vers une ville, en kilomètres. */
  distanceTo(cityId: string): number {
    const from = this.world.city(this.currentCity);
    const to = this.world.world.cities.get(cityId);
    if (!to) return 0;
    return round(haversineKm(from.geo, to.geo), 1);
  }

  onDay(_context: SimulationContext, _date: GameDate): void {
    const now = this.context.clock.absoluteMinutes;
    for (const [id, booking] of [...this.hotelBookings]) {
      if (booking.checkOut < now) this.hotelBookings.delete(id);
    }
    for (const [id, booking] of [...this.restaurantBookings]) {
      if (booking.at + 4 * 60 < now) this.restaurantBookings.delete(id);
    }
  }

  serialize(): unknown {
    return {
      currentCity: this.currentCity,
      currentVenueId: this.currentVenueId,
      journeys: [...this.journeys.values()],
      activeJourneyId: this.activeJourneyId,
      hotelBookings: [...this.hotelBookings.values()],
      restaurantBookings: [...this.restaurantBookings.values()],
      unlockedModes: [...this.unlockedModes],
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.currentCity = (state.currentCity as string) ?? this.currentCity;
    this.currentVenueId = (state.currentVenueId as string | null) ?? null;
    this.journeys.clear();
    for (const journey of (state.journeys as Journey[]) ?? []) this.journeys.set(journey.id, journey);
    this.activeJourneyId = (state.activeJourneyId as string | null) ?? null;
    this.hotelBookings.clear();
    for (const booking of (state.hotelBookings as HotelBooking[]) ?? []) {
      this.hotelBookings.set(booking.id, booking);
    }
    this.restaurantBookings.clear();
    for (const booking of (state.restaurantBookings as RestaurantBooking[]) ?? []) {
      this.restaurantBookings.set(booking.id, booking);
    }
    this.unlockedModes.clear();
    for (const mode of (state.unlockedModes as TransportMode[]) ?? []) this.unlockedModes.add(mode);
    this.counter = (state.counter as number) ?? 0;
  }
}
