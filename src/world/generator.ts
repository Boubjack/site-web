/**
 * Infinity Football — Monde / Générateur procédural
 *
 * Construit l'intégralité du monde ouvert à partir des définitions de pays et
 * de villes : quartiers, rues, lieux, pièces intérieures, réseaux de transport.
 *
 * Tome II, ch. 1.3 : chaque bâtiment important a une fonction et un intérieur.
 * Tome XXII, ch. 2 : ajouter une ville ou un pays ne demande aucune
 * modification du moteur — seulement une entrée de données.
 *
 * La génération est entièrement déterministe : une même graine reconstruit un
 * monde identique, ce qui rend les sauvegardes légères (on ne sauvegarde que
 * les différences vivantes, pas la géométrie).
 */

import { Rng } from '../core/rng.js';
import { hashString } from '../core/math.js';
import { CITIES, getCity, type CityDef, type DistrictKind } from '../data/cities.js';
import { getCountry } from '../data/countries.js';
import { STADIUMS, clubsOfCity, stadiumsOfCity } from '../data/clubs.js';
import { BUSINESS_ADJECTIVES, STREET_PREFIXES, STREET_ROOTS } from '../data/names.js';
import {
  VENUE_TEMPLATES,
  getVenueTemplate,
  venueTypesForDistrict,
  type VenueTemplate,
  type VenueType,
} from './venues.js';
import {
  createRoom,
  type CityRuntime,
  type District,
  type Street,
  type Venue,
  type WorldRuntime,
} from './model.js';

const DISTRICT_LABELS: Record<DistrictKind, readonly string[]> = {
  centre: ['Centre-Ville', 'Cœur de Ville', 'Hypercentre'],
  affaires: ['Quartier d’Affaires', 'District Financier', 'Business Park'],
  historique: ['Vieille Ville', 'Quartier Historique', 'Cité Ancienne'],
  residentiel: ['Les Jardins', 'Quartier Résidentiel', 'Les Coteaux', 'Belle-Vue'],
  luxe: ['Quartier Doré', 'Les Terrasses', 'Colline Dorée'],
  populaire: ['Le Faubourg', 'Quartier Populaire', 'Les Halles'],
  port: ['Le Port', 'Quartier Portuaire', 'Les Docks'],
  plage: ['Front de Mer', 'La Corniche', 'Bord de Plage'],
  sportif: ['Complexe Sportif', 'Cité du Sport', 'Quartier du Stade'],
  industriel: ['Zone Industrielle', 'Quartier des Ateliers', 'Parc Logistique'],
  universitaire: ['Campus', 'Quartier Latin', 'Cité Universitaire'],
  nuit: ['Quartier des Nuits', 'Rive Animée', 'Le Carré'],
  montagne: ['Balcon de la Montagne', 'Les Hauteurs', 'Val Supérieur'],
};

const DISTRICT_WEALTH: Record<DistrictKind, number> = {
  centre: 0.65,
  affaires: 0.8,
  historique: 0.6,
  residentiel: 0.55,
  luxe: 0.95,
  populaire: 0.3,
  port: 0.45,
  plage: 0.75,
  sportif: 0.5,
  industriel: 0.35,
  universitaire: 0.4,
  nuit: 0.6,
  montagne: 0.8,
};

const DISTRICT_LIVELINESS: Record<DistrictKind, number> = {
  centre: 0.95,
  affaires: 0.7,
  historique: 0.8,
  residentiel: 0.45,
  luxe: 0.5,
  populaire: 0.85,
  port: 0.6,
  plage: 0.75,
  sportif: 0.55,
  industriel: 0.3,
  universitaire: 0.8,
  nuit: 0.9,
  montagne: 0.35,
};

export interface GeneratorOptions {
  /** Graine du monde. */
  readonly seed: string;
  /** Génère les villes secondaires en plus des villes majeures. */
  readonly richWorld: boolean;
  /** Limite le nombre de lieux par ville (mode performance). */
  readonly maxVenuesPerCity?: number;
}

export class WorldGenerator {
  private readonly seed: string;
  private readonly richWorld: boolean;
  private readonly maxVenuesPerCity: number;

  constructor(options: GeneratorOptions) {
    this.seed = options.seed;
    this.richWorld = options.richWorld;
    this.maxVenuesPerCity = options.maxVenuesPerCity ?? 600;
  }

  /** Génère le monde complet : toutes les villes et tous les réseaux. */
  generate(): WorldRuntime {
    const cities = new Map<string, CityRuntime>();
    for (const def of CITIES) {
      if (!this.richWorld && def.tier === 3) continue;
      cities.set(def.id, this.generateCity(def));
    }
    return {
      cities,
      airRoutes: this.buildAirRoutes(cities),
      railRoutes: this.buildRailRoutes(cities),
      seaRoutes: this.buildSeaRoutes(cities),
    };
  }

  /** Génère une ville complète : quartiers, rues, lieux, intérieurs. */
  generateCity(def: CityDef): CityRuntime {
    const rng = new Rng(`${this.seed}::city::${def.id}`);
    const country = getCountry(def.countryId);
    const districts: District[] = [];
    const venues = new Map<string, Venue>();
    const streets = new Map<string, Street>();

    const districtCount = def.districts.length;
    def.districts.forEach((kind, index) => {
      const angle = (index / Math.max(1, districtCount)) * Math.PI * 2 + rng.range(-0.2, 0.2);
      const distance = kind === 'centre' ? 0 : rng.range(1.2, 6.5) * (def.tier === 1 ? 1.6 : 1);
      const labels = DISTRICT_LABELS[kind];
      const label = labels[index % labels.length] ?? kind;
      const district: District = {
        id: `${def.id}:${kind}:${index}`,
        name: label,
        kind,
        cityId: def.id,
        center: { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance },
        radiusKm: kind === 'centre' ? 1.8 : rng.range(1, 3.2),
        population: Math.round(((def.population * 1000) / districtCount) * rng.range(0.7, 1.3)),
        wealth: Math.min(1, Math.max(0, DISTRICT_WEALTH[kind] + rng.range(-0.08, 0.08))),
        liveliness: DISTRICT_LIVELINESS[kind],
        venueIds: [],
        streetIds: [],
      };
      districts.push(district);
      this.generateStreets(district, rng, streets);
    });

    for (const district of districts) {
      this.generateVenues(def, district, rng, venues);
      if (venues.size >= this.maxVenuesPerCity) break;
    }

    this.attachStadiums(def, districts, venues);
    this.ensureEssentialVenues(def, districts, venues, rng);
    this.plantSecrets(def, districts, venues, rng);

    const hemisphere = country.hemisphere;
    const baseTemp = this.baselineTemperature(def.geo.lat, hemisphere);

    return {
      id: def.id,
      def,
      geo: def.geo,
      districts,
      venues,
      streets,
      weather: {
        condition: 'clear',
        temperatureC: baseTemp,
        windKmh: rng.range(2, 18),
        humidity: rng.range(0.3, 0.75),
        severity: 0,
        pitchQuality: 0.95,
      },
      traffic: 0.4,
      festivity: 0,
      hotelOccupancy: rng.range(0.35, 0.65),
      priceMultiplier: 1,
      npcCount: 0,
      discoveredVenueIds: new Set<string>(),
      activeStreetEvents: [],
      decorations: [],
    };
  }

  private generateStreets(district: District, rng: Rng, streets: Map<string, Street>): void {
    const count = Math.max(3, Math.round(district.population / 9000));
    const used = new Set<string>();
    for (let i = 0; i < Math.min(count, 14); i++) {
      const prefix = rng.pick(STREET_PREFIXES);
      const root = rng.pick(STREET_ROOTS);
      const name = `${prefix} ${root}`;
      if (used.has(name)) continue;
      used.add(name);
      const street: Street = {
        id: `${district.id}:street:${i}`,
        name,
        districtId: district.id,
        lengthKm: rng.range(0.3, 2.4),
        capacity: Math.round(rng.range(200, 1400)),
        load: 0.25,
        underWorks: false,
      };
      streets.set(street.id, street);
      district.streetIds.push(street.id);
    }
  }

  private generateVenues(
    cityDef: CityDef,
    district: District,
    rng: Rng,
    venues: Map<string, Venue>,
  ): void {
    const populationMillions = (cityDef.population * 1000) / 1_000_000;
    const candidates = venueTypesForDistrict(district.kind).filter(
      (template) => template.minCityTier >= cityDef.tier,
    );

    for (const template of candidates) {
      if (!this.templateAllowedInCity(template, cityDef)) continue;
      const share = 1 / Math.max(1, template.districts.length || 1);
      const expected = template.densityPerMillion * populationMillions * share;
      let count = Math.floor(expected);
      if (rng.next() < expected - count) count++;
      count = Math.min(count, 24);
      for (let i = 0; i < count; i++) {
        if (venues.size >= this.maxVenuesPerCity) return;
        const venue = this.createVenue(cityDef, district, template, rng, venues.size);
        venues.set(venue.id, venue);
        district.venueIds.push(venue.id);
      }
    }
  }

  private templateAllowedInCity(template: VenueTemplate, cityDef: CityDef): boolean {
    switch (template.type) {
      case 'beach':
      case 'surfSchool':
      case 'divingCentre':
        return cityDef.coastal;
      case 'marina':
        return cityDef.hasPort || cityDef.coastal;
      case 'skiResort':
        return cityDef.hasSkiResort;
      case 'trailhead':
      case 'balloonField':
      case 'bungeeSite':
      case 'natureReserve':
        return cityDef.mountainous || cityDef.tier >= 2;
      case 'airport':
        return cityDef.hasAirport;
      case 'metroStation':
        return cityDef.hasMetro;
      case 'chalet':
        return cityDef.mountainous;
      case 'privateIsland':
        return cityDef.coastal && cityDef.tourism > 0.8;
      default:
        return true;
    }
  }

  private createVenue(
    cityDef: CityDef,
    district: District,
    template: VenueTemplate,
    rng: Rng,
    index: number,
  ): Venue {
    const angle = rng.range(0, Math.PI * 2);
    const distance = rng.range(0, district.radiusKm);
    const name = this.venueName(template, district, rng);
    const country = getCountry(cityDef.countryId);
    const priceLevel = Math.min(
      4,
      Math.max(0, Math.round(template.priceLevel * (0.7 + district.wealth * 0.6) * (0.7 + country.costOfLiving * 0.6))),
    );
    return {
      id: `${district.id}:venue:${template.type}:${index}`,
      type: template.type,
      name,
      cityId: cityDef.id,
      districtId: district.id,
      position: {
        x: district.center.x + Math.cos(angle) * distance,
        y: district.center.y + Math.sin(angle) * distance,
      },
      rooms: template.rooms.map((roomName, roomIndex) =>
        createRoom(
          `${district.id}:venue:${template.type}:${index}:room:${roomIndex}`,
          roomName,
          this.propsForRoom(template.type, roomName),
        ),
      ),
      status: 'open',
      open: true,
      popularity: Math.min(1, Math.max(0.05, rng.gaussian(0.45 + district.liveliness * 0.25, 0.18))),
      occupancy: 0,
      capacity: template.capacity,
      priceLevel,
      brandId: null,
      ownerId: null,
      windowDisplay: 'collection permanente',
      hidden: false,
      discovered: false,
    };
  }

  private venueName(template: VenueTemplate, district: District, rng: Rng): string {
    switch (template.type) {
      case 'stadium':
      case 'airport':
      case 'trainStation':
        return `${template.label} de ${district.name}`;
      case 'apartment':
      case 'villa':
      case 'penthouse':
      case 'chalet':
        return `${template.label} ${rng.pick(BUSINESS_ADJECTIVES)}`;
      default:
        return `${template.label} ${rng.pick(BUSINESS_ADJECTIVES)}`;
    }
  }

  private propsForRoom(type: VenueType, roomName: string): string[] {
    // Tome XIV, ch. 7 : les objets importants sont manipulables.
    const base = ['porte', 'interrupteur'];
    if (type === 'villa' || type === 'penthouse' || type === 'apartment' || type === 'chalet') {
      if (roomName.includes('séjour') || roomName.includes('panoramique')) {
        return [...base, 'télévision', 'télécommande', 'canapé', 'clés de voiture', 'courrier'];
      }
      if (roomName.includes('trophées')) {
        return [...base, 'trophées', 'maillots encadrés', 'ballons dédicacés', 'photos'];
      }
      if (roomName.includes('cuisine')) return [...base, 'réfrigérateur', 'verre', 'assiette'];
      if (roomName.includes('chambre')) return [...base, 'lit', 'téléphone', 'montre', 'sac'];
    }
    if (type === 'stadium') {
      if (roomName.includes('trophées')) return [...base, 'vitrines', 'trophées', 'plaques'];
      if (roomName.includes('vestiaire')) return [...base, 'maillot', 'crampons', 'tableau tactique'];
      if (roomName.includes('presse')) return [...base, 'micro', 'pupitre', 'panneau sponsors'];
    }
    if (type === 'personalMuseum') {
      return [...base, 'trophées', 'Ballons d’Or', 'Boubjack Awards', 'crampons historiques', 'écran vidéo', 'livre d’or'];
    }
    if (type === 'garage') return [...base, 'véhicules', 'clés', 'outils', 'élévateur'];
    if (type === 'shop' || type === 'officialStore') return [...base, 'portants', 'miroir', 'terminal de paiement'];
    return base;
  }

  private attachStadiums(cityDef: CityDef, districts: District[], venues: Map<string, Venue>): void {
    const sportDistrict =
      districts.find((d) => d.kind === 'sportif') ?? districts[0];
    if (!sportDistrict) return;
    for (const stadiumDef of stadiumsOfCity(cityDef.id)) {
      const id = `stadium:${stadiumDef.id}`;
      if (venues.has(id)) continue;
      const template = getVenueTemplate('stadium');
      const rooms = template.rooms.map((roomName, roomIndex) =>
        createRoom(`${id}:room:${roomIndex}`, roomName, this.propsForRoom('stadium', roomName)),
      );
      if (stadiumDef.hasHotel) rooms.push(createRoom(`${id}:room:hotel`, 'hôtel intégré', ['réception', 'chambre']));
      if (stadiumDef.hasShoppingCentre) {
        rooms.push(createRoom(`${id}:room:mall`, 'centre commercial', ['boutiques', 'food court']));
      }
      venues.set(id, {
        id,
        type: 'stadium',
        name: stadiumDef.name,
        cityId: cityDef.id,
        districtId: sportDistrict.id,
        position: { x: sportDistrict.center.x, y: sportDistrict.center.y },
        rooms,
        status: 'open',
        open: true,
        popularity: 0.95,
        occupancy: 0,
        capacity: stadiumDef.capacity,
        priceLevel: 2,
        brandId: null,
        ownerId: clubsOfCity(cityDef.id)[0]?.id ?? null,
        windowDisplay: 'affiche du prochain match',
        hidden: false,
        discovered: true,
      });
      sportDistrict.venueIds.push(id);
    }
  }

  /**
   * Garantit la présence des lieux indispensables même dans les petites villes
   * (Tome II : « tout doit être visitable »).
   */
  private ensureEssentialVenues(
    cityDef: CityDef,
    districts: District[],
    venues: Map<string, Venue>,
    rng: Rng,
  ): void {
    for (const template of VENUE_TEMPLATES) {
      if (template.minPerCity <= 0) continue;
      if (!this.templateAllowedInCity(template, cityDef)) continue;
      if (template.minCityTier < cityDef.tier) continue;
      let existing = 0;
      for (const venue of venues.values()) if (venue.type === template.type) existing++;
      let missing = template.minPerCity - existing;
      while (missing > 0) {
        const preferred = districts.filter(
          (d) => template.districts.length === 0 || template.districts.includes(d.kind),
        );
        const district = preferred.length > 0 ? rng.pick(preferred) : districts[0];
        if (!district) break;
        const venue = this.createVenue(cityDef, district, template, rng, venues.size + missing);
        venues.set(venue.id, venue);
        district.venueIds.push(venue.id);
        missing--;
      }
    }
  }

  /** Sème les lieux secrets et hommages (Tome XXXII, ch. 2). */
  private plantSecrets(
    cityDef: CityDef,
    districts: District[],
    venues: Map<string, Venue>,
    rng: Rng,
  ): void {
    const secretCount = cityDef.tier === 1 ? 4 : cityDef.tier === 2 ? 3 : 2;
    const secretTemplates: Array<{ type: VenueType; name: string }> = [
      { type: 'streetPitch', name: 'Terrain historique des origines' },
      { type: 'cafe', name: 'Café des Légendes' },
      { type: 'museum', name: 'Musée caché du Football' },
      { type: 'shop', name: 'Boutique confidentielle' },
      { type: 'artGallery', name: 'Galerie secrète' },
      { type: 'square', name: 'Fresque hommage aux pionniers' },
    ];
    for (let i = 0; i < secretCount; i++) {
      const pick = rng.pick(secretTemplates);
      const template = getVenueTemplate(pick.type);
      const district = rng.pick(districts);
      const venue = this.createVenue(cityDef, district, template, rng, 9000 + i);
      const secret: Venue = {
        ...venue,
        id: `${district.id}:secret:${i}`,
        name: pick.name,
        hidden: true,
        discovered: false,
        popularity: 0.35,
      };
      venues.set(secret.id, secret);
      district.venueIds.push(secret.id);
    }
  }

  /** Température moyenne annuelle approchée selon la latitude. */
  private baselineTemperature(lat: number, hemisphere: 'north' | 'south'): number {
    const absLat = Math.abs(lat);
    const base = 30 - absLat * 0.45;
    return hemisphere === 'south' ? base : base;
  }

  /**
   * Réseau aérien : chaque aéroport dessert les grandes plaques mondiales et
   * ses voisins régionaux. Les hubs de palier 1 sont interconnectés.
   */
  private buildAirRoutes(cities: Map<string, CityRuntime>): Map<string, string[]> {
    const routes = new Map<string, string[]>();
    const airports = [...cities.values()].filter((c) => c.def.hasAirport);
    for (const from of airports) {
      const destinations: string[] = [];
      for (const to of airports) {
        if (to.id === from.id) continue;
        const sameCountry = to.def.countryId === from.def.countryId;
        const bothHubs = from.def.tier === 1 && to.def.tier === 1;
        const hubToRegional = from.def.tier === 1 || to.def.tier === 1;
        const touristic = to.def.tourism > 0.8 || from.def.tourism > 0.8;
        if (sameCountry || bothHubs || (hubToRegional && touristic) || hubToRegional) {
          destinations.push(to.id);
        }
      }
      routes.set(from.id, destinations.sort());
    }
    return routes;
  }

  /** Réseau ferroviaire : liaisons nationales et transfrontalières européennes. */
  private buildRailRoutes(cities: Map<string, CityRuntime>): Map<string, string[]> {
    const routes = new Map<string, string[]>();
    const list = [...cities.values()];
    for (const from of list) {
      const destinations: string[] = [];
      for (const to of list) {
        if (to.id === from.id) continue;
        const sameCountry = to.def.countryId === from.def.countryId;
        const bothEuropean =
          getCountry(from.def.countryId).continent === 'Europe' &&
          getCountry(to.def.countryId).continent === 'Europe';
        if (sameCountry || bothEuropean) destinations.push(to.id);
      }
      routes.set(from.id, destinations.sort());
    }
    return routes;
  }

  /** Réseau maritime : ports et villes côtières. */
  private buildSeaRoutes(cities: Map<string, CityRuntime>): Map<string, string[]> {
    const routes = new Map<string, string[]>();
    const coastal = [...cities.values()].filter((c) => c.def.coastal);
    for (const from of coastal) {
      const destinations = coastal.filter((c) => c.id !== from.id).map((c) => c.id).sort();
      routes.set(from.id, destinations);
    }
    return routes;
  }
}

/** Identifiant stable dérivé d'un nom — utile aux packs de contenu. */
export function stableId(prefix: string, name: string): string {
  return `${prefix}:${hashString(name).toString(36)}`;
}

/** Vérifie qu'une ville dispose bien de tous les lieux structurants attendus. */
export function auditCity(city: CityRuntime): { missing: VenueType[]; venueCount: number } {
  const present = new Set<VenueType>();
  for (const venue of city.venues.values()) present.add(venue.type);
  const required: VenueType[] = ['shop', 'restaurant', 'cafe', 'hotel', 'museum', 'park', 'stadium'];
  const cityDef = getCity(city.id);
  if (cityDef.coastal) required.push('beach');
  if (cityDef.hasAirport) required.push('airport');
  return {
    missing: required.filter((type) => !present.has(type)),
    venueCount: city.venues.size,
  };
}

export { STADIUMS };
