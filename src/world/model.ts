/**
 * Infinity Football — Monde / Modèle runtime
 *
 * Structures vivantes du monde ouvert : quartiers, lieux, pièces intérieures,
 * routes et villes. Elles sont produites par le générateur procédural puis
 * mises à jour en continu par les systèmes (météo, commerce, foule, événements).
 */

import type { Vec2, GeoPoint } from '../core/math.js';
import type { DistrictKind, CityDef } from '../data/cities.js';
import type { VenueType } from './venues.js';

export type VenueStatus = 'open' | 'closed' | 'renovating' | 'permanentlyClosed';

export interface Room {
  readonly id: string;
  readonly name: string;
  /** Le joueur peut y accéder (certaines pièces exigent un statut). */
  accessible: boolean;
  /** Éclairage interactif (Tome XX, ch. 4). */
  lightsOn: boolean;
  /** Objets manipulables présents dans la pièce. */
  readonly props: string[];
}

export interface Venue {
  readonly id: string;
  readonly type: VenueType;
  readonly name: string;
  readonly cityId: string;
  readonly districtId: string;
  /** Position locale en kilomètres depuis le centre-ville. */
  readonly position: Vec2;
  readonly rooms: Room[];
  status: VenueStatus;
  /** Ouvert à l'instant présent (calculé chaque heure). */
  open: boolean;
  /** Popularité 0..1 : influence la foule et les revenus. */
  popularity: number;
  /** Fréquentation courante (nombre de personnes). */
  occupancy: number;
  readonly capacity: number;
  readonly priceLevel: number;
  /** Marque exploitante, si applicable. */
  brandId: string | null;
  /** Propriétaire (le joueur peut posséder des lieux — Tome XXIII). */
  ownerId: string | null;
  /** Vitrine saisonnière courante (Tome XXIV, ch. 4). */
  windowDisplay: string;
  /** Lieu secret non encore découvert (Tome XXXII, ch. 2). */
  hidden: boolean;
  discovered: boolean;
}

export interface Street {
  readonly id: string;
  readonly name: string;
  readonly districtId: string;
  /** Longueur en kilomètres. */
  readonly lengthKm: number;
  /** Capacité de trafic (véhicules simultanés). */
  readonly capacity: number;
  /** Charge de trafic courante 0..1+ (>1 = embouteillage). */
  load: number;
  /** Travaux en cours (Tome XX, ch. 6). */
  underWorks: boolean;
}

export interface District {
  readonly id: string;
  readonly name: string;
  readonly kind: DistrictKind;
  readonly cityId: string;
  readonly center: Vec2;
  readonly radiusKm: number;
  /** Population du quartier, en habitants. */
  population: number;
  /** Richesse 0..1 : influence prix, véhicules croisés, type de PNJ. */
  readonly wealth: number;
  /** Animation 0..1 : densité de PNJ dans la rue. */
  liveliness: number;
  readonly venueIds: string[];
  readonly streetIds: string[];
}

export interface CityWeather {
  condition: 'clear' | 'cloudy' | 'rain' | 'heavyRain' | 'storm' | 'snow' | 'fog' | 'heatwave';
  temperatureC: number;
  windKmh: number;
  humidity: number;
  /** Sévérité 0..1 : perturbe déplacements et activités. */
  severity: number;
  /** État de la pelouse des stades 0..1 (Tome XX, ch. 3). */
  pitchQuality: number;
}

export interface CityRuntime {
  readonly id: string;
  readonly def: CityDef;
  readonly geo: GeoPoint;
  readonly districts: District[];
  readonly venues: Map<string, Venue>;
  readonly streets: Map<string, Street>;
  weather: CityWeather;
  /** Trafic global 0..1+ (heures de pointe, jours de match). */
  traffic: number;
  /** Ambiance festive 0..1 (tournoi en cours, fête nationale). */
  festivity: number;
  /** Taux d'occupation hôtelière 0..1. */
  hotelOccupancy: number;
  /** Multiplicateur de prix local (grands événements). */
  priceMultiplier: number;
  /** Nombre de PNJ persistants suivis dans cette ville. */
  npcCount: number;
  /** Lieux découverts par le joueur. */
  readonly discoveredVenueIds: Set<string>;
  /** Événements de rue actifs. */
  readonly activeStreetEvents: StreetEvent[];
  /** Décorations d'événement mondial (Tome XIX, ch. 3). */
  decorations: string[];
}

export interface StreetEvent {
  readonly id: string;
  readonly kind: string;
  readonly districtId: string;
  readonly label: string;
  /** Minute absolue de fin. */
  endsAt: number;
  /** Attraction 0..1 : fait converger les PNJ. */
  readonly draw: number;
}

export interface WorldRuntime {
  readonly cities: Map<string, CityRuntime>;
  /** Liaisons aériennes : cityId → destinations desservies. */
  readonly airRoutes: Map<string, string[]>;
  /** Liaisons ferroviaires (villes d'un même pays ou pays limitrophes). */
  readonly railRoutes: Map<string, string[]>;
  /** Liaisons maritimes pour les yachts. */
  readonly seaRoutes: Map<string, string[]>;
}

export function createRoom(id: string, name: string, props: string[] = []): Room {
  return { id, name, accessible: true, lightsOn: true, props };
}

export function venuesOfType(city: CityRuntime, type: VenueType): Venue[] {
  const result: Venue[] = [];
  for (const venue of city.venues.values()) {
    if (venue.type === type) result.push(venue);
  }
  return result;
}

export function openVenuesOfType(city: CityRuntime, type: VenueType): Venue[] {
  return venuesOfType(city, type).filter((v) => v.open && v.status === 'open');
}

export function findDistrict(city: CityRuntime, districtId: string): District | undefined {
  return city.districts.find((d) => d.id === districtId);
}

export function totalPopulation(city: CityRuntime): number {
  return city.districts.reduce((sum, d) => sum + d.population, 0);
}
