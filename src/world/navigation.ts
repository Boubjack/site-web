/**
 * Infinity Football — Monde / Navigation & GPS
 *
 * Tome XII, ch. 6 : « Le GPS calcule automatiquement le meilleur itinéraire. »
 * Tome XXX, ch. 3 : tous les modes de transport, trajets entièrement jouables.
 *
 * Deux échelles :
 *  - locale : graphe quartiers ↔ lieux d'une ville, parcouru par A* ;
 *  - mondiale : graphe multimodal entre villes (avion, train, voiture, yacht).
 *
 * Le coût d'une arête intègre la distance, le trafic, la météo et le confort
 * du mode choisi, ce qui fait qu'un itinéraire change réellement selon l'heure
 * et les conditions du monde.
 */

import { distance2, haversineKm } from '../core/math.js';
import type { CityRuntime, District, Venue, WorldRuntime } from './model.js';

export type TransportMode =
  | 'walk'
  | 'bike'
  | 'car'
  | 'moto'
  | 'taxi'
  | 'vtc'
  | 'bus'
  | 'metro'
  | 'train'
  | 'plane'
  | 'privateJet'
  | 'helicopter'
  | 'yacht'
  | 'limousine';

export interface ModeProfile {
  readonly mode: TransportMode;
  readonly label: string;
  /** Vitesse moyenne en km/h. */
  readonly speedKmh: number;
  /** Coût par kilomètre en euros. */
  readonly costPerKm: number;
  /** Coût fixe par trajet en euros. */
  readonly baseCost: number;
  /** Sensibilité au trafic 0..1 (l'avion l'ignore, la voiture la subit). */
  readonly trafficSensitivity: number;
  /** Confort 0..1 : réduit la fatigue générée. */
  readonly comfort: number;
  /** Portée maximale en kilomètres. */
  readonly maxRangeKm: number;
  /** Nécessite un lieu de départ spécifique. */
  readonly requiresVenueType: string | null;
  /** Discrétion 0..1 : un joueur très célèbre évite les modes exposés. */
  readonly privacy: number;
}

export const MODE_PROFILES: Readonly<Record<TransportMode, ModeProfile>> = {
  walk: { mode: 'walk', label: 'À pied', speedKmh: 4.8, costPerKm: 0, baseCost: 0, trafficSensitivity: 0, comfort: 0.4, maxRangeKm: 6, requiresVenueType: null, privacy: 0.2 },
  bike: { mode: 'bike', label: 'Vélo', speedKmh: 16, costPerKm: 0, baseCost: 0, trafficSensitivity: 0.2, comfort: 0.45, maxRangeKm: 25, requiresVenueType: null, privacy: 0.3 },
  car: { mode: 'car', label: 'Voiture personnelle', speedKmh: 46, costPerKm: 0.18, baseCost: 0, trafficSensitivity: 1, comfort: 0.8, maxRangeKm: 900, requiresVenueType: null, privacy: 0.75 },
  moto: { mode: 'moto', label: 'Moto', speedKmh: 54, costPerKm: 0.11, baseCost: 0, trafficSensitivity: 0.45, comfort: 0.55, maxRangeKm: 500, requiresVenueType: null, privacy: 0.6 },
  taxi: { mode: 'taxi', label: 'Taxi', speedKmh: 42, costPerKm: 2.1, baseCost: 4.5, trafficSensitivity: 1, comfort: 0.7, maxRangeKm: 200, requiresVenueType: null, privacy: 0.5 },
  vtc: { mode: 'vtc', label: 'VTC', speedKmh: 44, costPerKm: 1.8, baseCost: 3.5, trafficSensitivity: 1, comfort: 0.78, maxRangeKm: 250, requiresVenueType: null, privacy: 0.6 },
  bus: { mode: 'bus', label: 'Bus', speedKmh: 22, costPerKm: 0.12, baseCost: 1.9, trafficSensitivity: 0.9, comfort: 0.35, maxRangeKm: 60, requiresVenueType: 'busStation', privacy: 0.1 },
  metro: { mode: 'metro', label: 'Métro', speedKmh: 34, costPerKm: 0.1, baseCost: 2.1, trafficSensitivity: 0.05, comfort: 0.4, maxRangeKm: 45, requiresVenueType: 'metroStation', privacy: 0.05 },
  train: { mode: 'train', label: 'Train', speedKmh: 190, costPerKm: 0.16, baseCost: 22, trafficSensitivity: 0.05, comfort: 0.75, maxRangeKm: 1800, requiresVenueType: 'trainStation', privacy: 0.35 },
  plane: { mode: 'plane', label: 'Avion de ligne', speedKmh: 820, costPerKm: 0.14, baseCost: 180, trafficSensitivity: 0, comfort: 0.65, maxRangeKm: 16000, requiresVenueType: 'airport', privacy: 0.25 },
  privateJet: { mode: 'privateJet', label: 'Jet privé', speedKmh: 780, costPerKm: 6.4, baseCost: 4200, trafficSensitivity: 0, comfort: 0.98, maxRangeKm: 12000, requiresVenueType: 'airport', privacy: 0.98 },
  helicopter: { mode: 'helicopter', label: 'Hélicoptère', speedKmh: 240, costPerKm: 12, baseCost: 1800, trafficSensitivity: 0, comfort: 0.85, maxRangeKm: 700, requiresVenueType: 'heliport', privacy: 0.9 },
  yacht: { mode: 'yacht', label: 'Yacht', speedKmh: 42, costPerKm: 9.5, baseCost: 5200, trafficSensitivity: 0, comfort: 0.95, maxRangeKm: 4000, requiresVenueType: 'marina', privacy: 0.95 },
  limousine: { mode: 'limousine', label: 'Limousine', speedKmh: 44, costPerKm: 4.2, baseCost: 260, trafficSensitivity: 1, comfort: 0.95, maxRangeKm: 400, requiresVenueType: null, privacy: 0.85 },
};

export interface LocalRouteStep {
  readonly kind: 'district' | 'venue';
  readonly id: string;
  readonly name: string;
  readonly distanceKm: number;
}

export interface LocalRoute {
  readonly steps: readonly LocalRouteStep[];
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly mode: TransportMode;
  readonly costEur: number;
  readonly found: boolean;
}

interface GraphNode {
  readonly id: string;
  readonly name: string;
  readonly kind: 'district' | 'venue';
  readonly position: { x: number; y: number };
  readonly neighbours: string[];
}

/** Graphe local d'une ville, reconstruit à la demande et mis en cache. */
export class CityNavGraph {
  private readonly nodes = new Map<string, GraphNode>();

  constructor(city: CityRuntime) {
    for (const district of city.districts) {
      this.nodes.set(district.id, {
        id: district.id,
        name: district.name,
        kind: 'district',
        position: district.center,
        neighbours: [],
      });
    }
    // Les quartiers sont reliés entre eux (routes principales).
    for (const a of city.districts) {
      for (const b of city.districts) {
        if (a.id === b.id) continue;
        this.nodes.get(a.id)?.neighbours.push(b.id);
      }
    }
    // Chaque lieu est rattaché à son quartier (rues secondaires).
    for (const venue of city.venues.values()) {
      this.nodes.set(venue.id, {
        id: venue.id,
        name: venue.name,
        kind: 'venue',
        position: venue.position,
        neighbours: [venue.districtId],
      });
      this.nodes.get(venue.districtId)?.neighbours.push(venue.id);
    }
  }

  node(id: string): GraphNode | undefined {
    return this.nodes.get(id);
  }

  get size(): number {
    return this.nodes.size;
  }

  /** A* avec heuristique euclidienne — admissible, donc optimal. */
  findPath(fromId: string, toId: string): GraphNode[] {
    const start = this.nodes.get(fromId);
    const goal = this.nodes.get(toId);
    if (!start || !goal) return [];
    if (fromId === toId) return [start];

    const open = new Set<string>([fromId]);
    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>([[fromId, 0]]);
    const fScore = new Map<string, number>([[fromId, distance2(start.position, goal.position)]]);

    while (open.size > 0) {
      let current: string | null = null;
      let bestScore = Infinity;
      for (const id of open) {
        const score = fScore.get(id) ?? Infinity;
        if (score < bestScore) {
          bestScore = score;
          current = id;
        }
      }
      if (current === null) break;
      if (current === toId) return this.reconstruct(cameFrom, current);
      open.delete(current);

      const node = this.nodes.get(current);
      if (!node) continue;
      for (const neighbourId of node.neighbours) {
        const neighbour = this.nodes.get(neighbourId);
        if (!neighbour) continue;
        const tentative = (gScore.get(current) ?? Infinity) + distance2(node.position, neighbour.position);
        if (tentative < (gScore.get(neighbourId) ?? Infinity)) {
          cameFrom.set(neighbourId, current);
          gScore.set(neighbourId, tentative);
          fScore.set(neighbourId, tentative + distance2(neighbour.position, goal.position));
          open.add(neighbourId);
        }
      }
    }
    return [];
  }

  private reconstruct(cameFrom: Map<string, string>, current: string): GraphNode[] {
    const path: GraphNode[] = [];
    let cursor: string | undefined = current;
    while (cursor !== undefined) {
      const node = this.nodes.get(cursor);
      if (node) path.unshift(node);
      cursor = cameFrom.get(cursor);
    }
    return path;
  }
}

const GRAPH_CACHE = new WeakMap<CityRuntime, CityNavGraph>();

export function navGraphFor(city: CityRuntime): CityNavGraph {
  let graph = GRAPH_CACHE.get(city);
  if (!graph) {
    graph = new CityNavGraph(city);
    GRAPH_CACHE.set(city, graph);
  }
  return graph;
}

/** Itinéraire intra-ville tenant compte du trafic et de la météo courants. */
export function routeWithinCity(
  city: CityRuntime,
  fromId: string,
  toId: string,
  mode: TransportMode,
): LocalRoute {
  const profile = MODE_PROFILES[mode];
  const graph = navGraphFor(city);
  const path = graph.findPath(fromId, toId);
  if (path.length === 0) {
    return { steps: [], distanceKm: 0, durationMinutes: 0, mode, costEur: 0, found: false };
  }

  const steps: LocalRouteStep[] = [];
  let distanceKm = 0;
  for (let i = 0; i < path.length; i++) {
    const node = path[i] as GraphNode;
    const previous = i > 0 ? (path[i - 1] as GraphNode) : null;
    const segment = previous ? distance2(previous.position, node.position) : 0;
    distanceKm += segment;
    steps.push({ kind: node.kind, id: node.id, name: node.name, distanceKm: segment });
  }

  const trafficPenalty = 1 + city.traffic * profile.trafficSensitivity * 0.9;
  const weatherPenalty = 1 + city.weather.severity * (mode === 'walk' || mode === 'bike' ? 0.5 : 0.3);
  const effectiveSpeed = Math.max(1, profile.speedKmh / (trafficPenalty * weatherPenalty));
  const durationMinutes = (distanceKm / effectiveSpeed) * 60;
  const costEur = profile.baseCost + distanceKm * profile.costPerKm * city.priceMultiplier;

  return {
    steps,
    distanceKm,
    durationMinutes: Math.max(1, durationMinutes),
    mode,
    costEur,
    found: true,
  };
}

/** Meilleur mode disponible pour un trajet local, selon le critère demandé. */
export function bestLocalMode(
  city: CityRuntime,
  distanceKm: number,
  options: { available: readonly TransportMode[]; prefer: 'fast' | 'cheap' | 'discreet' | 'comfort' },
): TransportMode {
  const candidates = options.available.filter((mode) => {
    const profile = MODE_PROFILES[mode];
    if (distanceKm > profile.maxRangeKm) return false;
    if (profile.requiresVenueType) {
      for (const venue of city.venues.values()) {
        if (venue.type === profile.requiresVenueType && venue.open) return true;
      }
      return false;
    }
    return true;
  });
  if (candidates.length === 0) return 'walk';

  let best = candidates[0] as TransportMode;
  let bestScore = -Infinity;
  for (const mode of candidates) {
    const profile = MODE_PROFILES[mode];
    const trafficPenalty = 1 + city.traffic * profile.trafficSensitivity * 0.9;
    const minutes = (distanceKm / Math.max(1, profile.speedKmh / trafficPenalty)) * 60;
    const cost = profile.baseCost + distanceKm * profile.costPerKm;
    let score: number;
    switch (options.prefer) {
      case 'fast':
        score = -minutes;
        break;
      case 'cheap':
        score = -cost;
        break;
      case 'discreet':
        score = profile.privacy * 100 - minutes * 0.1;
        break;
      default:
        score = profile.comfort * 100 - minutes * 0.2 - cost * 0.01;
    }
    if (score > bestScore) {
      bestScore = score;
      best = mode;
    }
  }
  return best;
}

export interface WorldLeg {
  readonly fromCityId: string;
  readonly toCityId: string;
  readonly mode: TransportMode;
  readonly distanceKm: number;
  readonly durationMinutes: number;
  readonly costEur: number;
}

export interface WorldRoute {
  readonly legs: readonly WorldLeg[];
  readonly totalDistanceKm: number;
  readonly totalMinutes: number;
  readonly totalCostEur: number;
  readonly found: boolean;
}

/** Modes disponibles entre deux villes selon les réseaux existants. */
export function availableIntercityModes(
  world: WorldRuntime,
  fromCityId: string,
  toCityId: string,
): TransportMode[] {
  const modes: TransportMode[] = [];
  if (world.airRoutes.get(fromCityId)?.includes(toCityId)) modes.push('plane', 'privateJet');
  if (world.railRoutes.get(fromCityId)?.includes(toCityId)) modes.push('train');
  if (world.seaRoutes.get(fromCityId)?.includes(toCityId)) modes.push('yacht');
  const from = world.cities.get(fromCityId);
  const to = world.cities.get(toCityId);
  if (from && to) {
    const km = haversineKm(from.geo, to.geo);
    if (km <= MODE_PROFILES.car.maxRangeKm) modes.push('car', 'limousine');
    if (km <= MODE_PROFILES.helicopter.maxRangeKm) modes.push('helicopter');
  }
  return modes;
}

/**
 * Itinéraire intervilles, éventuellement avec escale.
 * Dijkstra sur le graphe des villes, pondéré par le critère choisi.
 */
export function routeBetweenCities(
  world: WorldRuntime,
  fromCityId: string,
  toCityId: string,
  options: {
    prefer: 'fast' | 'cheap' | 'discreet' | 'comfort';
    allowedModes?: readonly TransportMode[];
  },
): WorldRoute {
  const from = world.cities.get(fromCityId);
  const to = world.cities.get(toCityId);
  if (!from || !to) {
    return { legs: [], totalDistanceKm: 0, totalMinutes: 0, totalCostEur: 0, found: false };
  }
  if (fromCityId === toCityId) {
    return { legs: [], totalDistanceKm: 0, totalMinutes: 0, totalCostEur: 0, found: true };
  }

  const allowed = options.allowedModes;
  const cost = new Map<string, number>([[fromCityId, 0]]);
  const previous = new Map<string, WorldLeg>();
  const visited = new Set<string>();
  const queue = new Set<string>([fromCityId]);

  while (queue.size > 0) {
    let current: string | null = null;
    let bestCost = Infinity;
    for (const id of queue) {
      const value = cost.get(id) ?? Infinity;
      if (value < bestCost) {
        bestCost = value;
        current = id;
      }
    }
    if (current === null) break;
    queue.delete(current);
    if (visited.has(current)) continue;
    visited.add(current);
    if (current === toCityId) break;

    for (const neighbourId of neighboursOf(world, current)) {
      if (visited.has(neighbourId)) continue;
      const leg = bestLegBetween(world, current, neighbourId, options.prefer, allowed);
      if (!leg) continue;
      const weight = legWeight(leg, options.prefer);
      const candidate = (cost.get(current) ?? Infinity) + weight;
      if (candidate < (cost.get(neighbourId) ?? Infinity)) {
        cost.set(neighbourId, candidate);
        previous.set(neighbourId, leg);
        queue.add(neighbourId);
      }
    }
  }

  if (!previous.has(toCityId) && fromCityId !== toCityId) {
    return { legs: [], totalDistanceKm: 0, totalMinutes: 0, totalCostEur: 0, found: false };
  }

  const legs: WorldLeg[] = [];
  let cursor = toCityId;
  while (cursor !== fromCityId) {
    const leg = previous.get(cursor);
    if (!leg) break;
    legs.unshift(leg);
    cursor = leg.fromCityId;
  }

  return {
    legs,
    totalDistanceKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    totalMinutes: legs.reduce((sum, leg) => sum + leg.durationMinutes, 0),
    totalCostEur: legs.reduce((sum, leg) => sum + leg.costEur, 0),
    found: legs.length > 0,
  };
}

function neighboursOf(world: WorldRuntime, cityId: string): string[] {
  const set = new Set<string>();
  for (const list of [
    world.airRoutes.get(cityId) ?? [],
    world.railRoutes.get(cityId) ?? [],
    world.seaRoutes.get(cityId) ?? [],
  ]) {
    for (const id of list) set.add(id);
  }
  // Liaison routière entre villes proches.
  const from = world.cities.get(cityId);
  if (from) {
    for (const other of world.cities.values()) {
      if (other.id === cityId) continue;
      if (haversineKm(from.geo, other.geo) <= MODE_PROFILES.car.maxRangeKm) set.add(other.id);
    }
  }
  return [...set];
}

function bestLegBetween(
  world: WorldRuntime,
  fromCityId: string,
  toCityId: string,
  prefer: 'fast' | 'cheap' | 'discreet' | 'comfort',
  allowed: readonly TransportMode[] | undefined,
): WorldLeg | null {
  const from = world.cities.get(fromCityId);
  const to = world.cities.get(toCityId);
  if (!from || !to) return null;
  const distanceKm = haversineKm(from.geo, to.geo);
  let modes = availableIntercityModes(world, fromCityId, toCityId);
  if (allowed) modes = modes.filter((mode) => allowed.includes(mode));
  if (modes.length === 0) return null;

  let best: WorldLeg | null = null;
  let bestWeight = Infinity;
  for (const mode of modes) {
    const profile = MODE_PROFILES[mode];
    if (distanceKm > profile.maxRangeKm) continue;
    // Les vols intègrent l'enregistrement, l'embarquement et la récupération
    // des bagages (Tome XXX v2, ch. 3 : le voyage est entièrement jouable).
    const overheadMinutes =
      mode === 'plane' ? 150 : mode === 'privateJet' ? 35 : mode === 'train' ? 25 : mode === 'yacht' ? 45 : 5;
    const leg: WorldLeg = {
      fromCityId,
      toCityId,
      mode,
      distanceKm,
      durationMinutes: (distanceKm / profile.speedKmh) * 60 + overheadMinutes,
      costEur: profile.baseCost + distanceKm * profile.costPerKm,
    };
    const weight = legWeight(leg, prefer);
    if (weight < bestWeight) {
      bestWeight = weight;
      best = leg;
    }
  }
  return best;
}

function legWeight(leg: WorldLeg, prefer: 'fast' | 'cheap' | 'discreet' | 'comfort'): number {
  const profile = MODE_PROFILES[leg.mode];
  switch (prefer) {
    case 'fast':
      return leg.durationMinutes;
    case 'cheap':
      return leg.costEur;
    case 'discreet':
      return leg.durationMinutes * 0.4 + (1 - profile.privacy) * 400;
    default:
      return leg.durationMinutes * 0.6 + (1 - profile.comfort) * 300 + leg.costEur * 0.02;
  }
}

/** Recherche de lieux pour la carte interactive et le GPS (Tome XII, ch. 6). */
export function searchVenues(
  city: CityRuntime,
  query: string,
  options: { openOnly?: boolean; limit?: number } = {},
): Venue[] {
  const needle = query.trim().toLowerCase();
  const results: Venue[] = [];
  for (const venue of city.venues.values()) {
    if (venue.hidden && !venue.discovered) continue;
    if (options.openOnly && !venue.open) continue;
    if (
      needle.length === 0 ||
      venue.name.toLowerCase().includes(needle) ||
      venue.type.toLowerCase().includes(needle)
    ) {
      results.push(venue);
    }
  }
  results.sort((a, b) => b.popularity - a.popularity);
  return results.slice(0, options.limit ?? 25);
}

/** Lieu ouvert le plus proche d'un type donné. */
export function nearestVenue(
  city: CityRuntime,
  fromPosition: { x: number; y: number },
  type: string,
  openOnly = true,
): Venue | null {
  let best: Venue | null = null;
  let bestDistance = Infinity;
  for (const venue of city.venues.values()) {
    if (venue.type !== type) continue;
    if (openOnly && !venue.open) continue;
    if (venue.hidden && !venue.discovered) continue;
    const d = distance2(fromPosition, venue.position);
    if (d < bestDistance) {
      bestDistance = d;
      best = venue;
    }
  }
  return best;
}

export function districtOf(city: CityRuntime, districtId: string): District | undefined {
  return city.districts.find((d) => d.id === districtId);
}
