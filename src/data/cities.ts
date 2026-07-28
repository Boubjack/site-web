/**
 * Infinity Football — Données / Villes
 *
 * Tome XXX, ch. 2 : chaque ville possède boutiques, centres commerciaux,
 * cinémas, restaurants, cafés, hôtels, villas, appartements, concessionnaires,
 * aéroports, plages, parcs, musées et stades.
 *
 * Les coordonnées sont réelles : elles alimentent le réseau aérien mondial, les
 * fuseaux horaires, la météo par latitude et la carte interactive (Tome XII).
 * Les quartiers et les lieux sont ensuite générés procéduralement à partir de
 * ces gabarits par `world/city-generator.ts`.
 */

import type { GeoPoint } from '../core/math.js';

/** Palette de quartiers disponibles — pilote la génération des lieux. */
export type DistrictKind =
  | 'centre'
  | 'affaires'
  | 'historique'
  | 'residentiel'
  | 'luxe'
  | 'populaire'
  | 'port'
  | 'plage'
  | 'sportif'
  | 'industriel'
  | 'universitaire'
  | 'nuit'
  | 'montagne';

export interface CityDef {
  readonly id: string;
  readonly name: string;
  readonly countryId: string;
  readonly geo: GeoPoint;
  /** Population en milliers d'habitants. */
  readonly population: number;
  /** 1 = mégapole mondiale, 2 = grande ville, 3 = ville secondaire. */
  readonly tier: 1 | 2 | 3;
  /** Décalage UTC en heures. */
  readonly utcOffset: number;
  readonly coastal: boolean;
  readonly mountainous: boolean;
  readonly hasAirport: boolean;
  readonly hasMetro: boolean;
  readonly hasPort: boolean;
  readonly hasSkiResort: boolean;
  readonly districts: readonly DistrictKind[];
  readonly landmarks: readonly string[];
  /** Peut accueillir les Boubjack Awards (Tome VII, ch. 2). */
  readonly awardsHost: boolean;
  /** Attrait touristique 0..1 : influence vacances et hôtels. */
  readonly tourism: number;
  /** Poids footballistique local 0..1. */
  readonly footballWeight: number;
}

const CORE: readonly DistrictKind[] = ['centre', 'historique', 'residentiel', 'sportif'];

function city(
  id: string,
  name: string,
  countryId: string,
  lat: number,
  lon: number,
  population: number,
  tier: 1 | 2 | 3,
  utcOffset: number,
  extras: Partial<Omit<CityDef, 'id' | 'name' | 'countryId' | 'geo' | 'population' | 'tier' | 'utcOffset'>> = {},
): CityDef {
  return {
    id,
    name,
    countryId,
    geo: { lat, lon },
    population,
    tier,
    utcOffset,
    coastal: extras.coastal ?? false,
    mountainous: extras.mountainous ?? false,
    hasAirport: extras.hasAirport ?? tier <= 2,
    hasMetro: extras.hasMetro ?? tier === 1,
    hasPort: extras.hasPort ?? (extras.coastal ?? false),
    hasSkiResort: extras.hasSkiResort ?? false,
    districts: extras.districts ?? [
      ...CORE,
      ...(tier === 1 ? (['affaires', 'luxe', 'nuit', 'universitaire'] as DistrictKind[]) : []),
      ...(extras.coastal ? (['plage', 'port'] as DistrictKind[]) : []),
      ...(extras.mountainous ? (['montagne'] as DistrictKind[]) : []),
    ],
    landmarks: extras.landmarks ?? [],
    awardsHost: extras.awardsHost ?? false,
    tourism: extras.tourism ?? (tier === 1 ? 0.8 : tier === 2 ? 0.55 : 0.35),
    footballWeight: extras.footballWeight ?? (tier === 1 ? 0.85 : tier === 2 ? 0.6 : 0.4),
  };
}

export const CITIES: readonly CityDef[] = [
  // ── Europe ────────────────────────────────────────────────────────────────
  city('paris', 'Paris', 'fr', 48.8566, 2.3522, 2160, 1, 1, {
    awardsHost: true,
    landmarks: ['Tour de fer', 'Avenue triomphale', 'Musée du Louvre-like'],
    tourism: 0.98,
    footballWeight: 0.92,
  }),
  city('marseille', 'Marseille', 'fr', 43.2965, 5.3698, 870, 2, 1, {
    coastal: true,
    landmarks: ['Vieux-Port', 'Basilique sur la colline'],
    footballWeight: 0.88,
  }),
  city('lyon', 'Lyon', 'fr', 45.764, 4.8357, 520, 2, 1, {
    landmarks: ['Presqu’île', 'Colline de la basilique'],
  }),
  city('nice', 'Nice', 'fr', 43.7102, 7.262, 340, 3, 1, {
    coastal: true,
    tourism: 0.72,
    landmarks: ['Promenade du littoral'],
  }),
  city('chamonix', 'Chamonix', 'fr', 45.9237, 6.8694, 9, 3, 1, {
    mountainous: true,
    hasSkiResort: true,
    hasAirport: false,
    tourism: 0.7,
    footballWeight: 0.1,
    landmarks: ['Aiguille panoramique'],
  }),
  city('madrid', 'Madrid', 'es', 40.4168, -3.7038, 3300, 1, 1, {
    awardsHost: true,
    landmarks: ['Grande place', 'Parc royal'],
    footballWeight: 0.97,
  }),
  city('barcelone', 'Barcelone', 'es', 41.3874, 2.1686, 1620, 1, 1, {
    coastal: true,
    landmarks: ['Basilique moderniste', 'Avenue piétonne'],
    tourism: 0.93,
    footballWeight: 0.96,
  }),
  city('seville', 'Séville', 'es', 37.3891, -5.9845, 690, 2, 1, {
    landmarks: ['Palais mauresque', 'Tour fluviale'],
  }),
  city('ibiza', 'Ibiza', 'es', 38.9067, 1.4206, 50, 3, 1, {
    coastal: true,
    tourism: 0.85,
    footballWeight: 0.15,
    landmarks: ['Vieille ville fortifiée', 'Criques turquoise'],
  }),
  city('londres', 'Londres', 'gb', 51.5074, -0.1278, 8900, 1, 0, {
    awardsHost: true,
    landmarks: ['Tour horlogère', 'Pont basculant', 'Parc royal'],
    tourism: 0.96,
    footballWeight: 1,
  }),
  city('manchester', 'Manchester', 'gb', 53.4808, -2.2426, 550, 2, 0, {
    footballWeight: 0.95,
    landmarks: ['Quartier industriel réhabilité'],
  }),
  city('liverpool', 'Liverpool', 'gb', 53.4084, -2.9916, 500, 2, 0, {
    coastal: true,
    footballWeight: 0.94,
    landmarks: ['Docks classés'],
  }),
  city('milan', 'Milan', 'it', 45.4642, 9.19, 1400, 1, 1, {
    awardsHost: true,
    landmarks: ['Dôme gothique', 'Galerie couverte', 'Quartier de la mode'],
    footballWeight: 0.95,
  }),
  city('rome', 'Rome', 'it', 41.9028, 12.4964, 2870, 1, 1, {
    landmarks: ['Amphithéâtre antique', 'Fontaine baroque'],
    tourism: 0.95,
    footballWeight: 0.9,
  }),
  city('naples', 'Naples', 'it', 40.8518, 14.2681, 960, 2, 1, {
    coastal: true,
    footballWeight: 0.93,
    landmarks: ['Baie volcanique'],
  }),
  city('turin', 'Turin', 'it', 45.0703, 7.6869, 870, 2, 1, {
    mountainous: true,
    footballWeight: 0.9,
  }),
  city('berlin', 'Berlin', 'de', 52.52, 13.405, 3760, 1, 1, {
    landmarks: ['Porte monumentale', 'Tour de télévision'],
    footballWeight: 0.85,
  }),
  city('munich', 'Munich', 'de', 48.1351, 11.582, 1490, 1, 1, {
    landmarks: ['Jardin anglais', 'Place de la mairie'],
    footballWeight: 0.94,
  }),
  city('dortmund', 'Dortmund', 'de', 51.5136, 7.4653, 590, 2, 1, {
    footballWeight: 0.93,
  }),
  city('hambourg', 'Hambourg', 'de', 53.5511, 9.9937, 1840, 2, 1, {
    coastal: true,
    landmarks: ['Philharmonie portuaire'],
  }),
  city('lisbonne', 'Lisbonne', 'pt', 38.7223, -9.1393, 550, 2, 0, {
    coastal: true,
    landmarks: ['Tour fluviale', 'Tramway historique'],
    tourism: 0.85,
    footballWeight: 0.9,
  }),
  city('porto', 'Porto', 'pt', 41.1579, -8.6291, 240, 2, 0, {
    coastal: true,
    footballWeight: 0.88,
    landmarks: ['Pont métallique', 'Caves à vin'],
  }),
  city('madere', 'Madère', 'pt', 32.6669, -16.9241, 110, 3, 0, {
    coastal: true,
    mountainous: true,
    tourism: 0.78,
    footballWeight: 0.35,
    landmarks: ['Falaises océaniques'],
  }),
  city('amsterdam', 'Amsterdam', 'nl', 52.3676, 4.9041, 900, 1, 1, {
    landmarks: ['Ceinture de canaux', 'Musée national'],
    tourism: 0.9,
    footballWeight: 0.88,
  }),
  city('bruxelles', 'Bruxelles', 'be', 50.8503, 4.3517, 1210, 2, 1, {
    landmarks: ['Grand-Place', 'Atomium'],
    footballWeight: 0.82,
  }),
  city('istanbul', 'Istanbul', 'tr', 41.0082, 28.9784, 15500, 1, 3, {
    coastal: true,
    landmarks: ['Détroit', 'Basilique-mosquée', 'Grand bazar'],
    tourism: 0.88,
    footballWeight: 0.96,
  }),
  city('athenes', 'Athènes', 'gr', 37.9838, 23.7275, 660, 2, 2, {
    coastal: true,
    landmarks: ['Acropole'],
    tourism: 0.82,
  }),
  city('santorin', 'Santorin', 'gr', 36.3932, 25.4615, 15, 3, 2, {
    coastal: true,
    hasAirport: true,
    tourism: 0.92,
    footballWeight: 0.1,
    landmarks: ['Caldeira', 'Villages blancs'],
  }),
  city('zurich', 'Zurich', 'ch', 47.3769, 8.5417, 430, 2, 1, {
    mountainous: true,
    landmarks: ['Lac panoramique', 'Quartier bancaire'],
  }),
  city('zermatt', 'Zermatt', 'ch', 46.0207, 7.7491, 6, 3, 1, {
    mountainous: true,
    hasSkiResort: true,
    hasAirport: false,
    tourism: 0.86,
    footballWeight: 0.08,
    landmarks: ['Sommet pyramidal'],
  }),
  city('vienne', 'Vienne', 'at', 48.2082, 16.3738, 1900, 2, 1, {
    landmarks: ['Palais impérial', 'Opéra'],
  }),
  city('oslo', 'Oslo', 'no', 59.9139, 10.7522, 700, 2, 1, {
    coastal: true,
    landmarks: ['Opéra de marbre', 'Fjord urbain'],
  }),
  city('stockholm', 'Stockholm', 'se', 59.3293, 18.0686, 980, 2, 1, {
    coastal: true,
    landmarks: ['Vieille ville insulaire'],
  }),

  // ── Afrique ───────────────────────────────────────────────────────────────
  city('bamako', 'Bamako', 'ml', 12.6392, -8.0029, 2800, 2, 0, {
    awardsHost: true,
    landmarks: ['Fleuve majestueux', 'Marché central', 'Monument de l’indépendance'],
    footballWeight: 0.9,
    tourism: 0.4,
    districts: ['centre', 'historique', 'residentiel', 'sportif', 'populaire', 'affaires', 'nuit'],
  }),
  city('dakar', 'Dakar', 'sn', 14.7167, -17.4677, 1150, 2, 0, {
    coastal: true,
    landmarks: ['Monument continental', 'Corniche océanique'],
    footballWeight: 0.9,
    tourism: 0.55,
  }),
  city('abidjan', 'Abidjan', 'ci', 5.36, -4.0083, 5200, 2, 0, {
    coastal: true,
    landmarks: ['Lagune urbaine', 'Pont haubané'],
    footballWeight: 0.9,
  }),
  city('casablanca', 'Casablanca', 'ma', 33.5731, -7.5898, 3400, 2, 1, {
    coastal: true,
    landmarks: ['Grande mosquée maritime', 'Corniche'],
    footballWeight: 0.88,
  }),
  city('marrakech', 'Marrakech', 'ma', 31.6295, -7.9811, 950, 3, 1, {
    landmarks: ['Médina', 'Place animée', 'Jardins'],
    tourism: 0.88,
    footballWeight: 0.6,
  }),
  city('lecaire', 'Le Caire', 'eg', 30.0444, 31.2357, 9500, 1, 2, {
    landmarks: ['Nécropole antique', 'Corniche fluviale'],
    footballWeight: 0.92,
    tourism: 0.8,
  }),
  city('lagos', 'Lagos', 'ng', 6.5244, 3.3792, 15400, 1, 1, {
    coastal: true,
    landmarks: ['Pont urbain', 'Île financière'],
    footballWeight: 0.9,
  }),
  city('lecap', 'Le Cap', 'za', -33.9249, 18.4241, 4600, 2, 2, {
    coastal: true,
    mountainous: true,
    landmarks: ['Montagne plate', 'Waterfront'],
    tourism: 0.9,
  }),
  city('johannesburg', 'Johannesburg', 'za', -26.2041, 28.0473, 5700, 2, 2, {
    landmarks: ['Quartier créatif', 'Stade emblématique'],
    footballWeight: 0.8,
  }),

  // ── Amériques ─────────────────────────────────────────────────────────────
  city('newyork', 'New York', 'us', 40.7128, -74.006, 8400, 1, -5, {
    coastal: true,
    awardsHost: true,
    landmarks: ['Statue emblématique', 'Parc central', 'Skyline'],
    tourism: 0.97,
    footballWeight: 0.7,
  }),
  city('losangeles', 'Los Angeles', 'us', 34.0522, -118.2437, 3900, 1, -8, {
    coastal: true,
    awardsHost: true,
    landmarks: ['Collines aux lettres', 'Boulevard des étoiles', 'Plages'],
    tourism: 0.92,
    footballWeight: 0.68,
  }),
  city('miami', 'Miami', 'us', 25.7617, -80.1918, 450, 2, -5, {
    coastal: true,
    landmarks: ['Front de mer art déco', 'Marina'],
    tourism: 0.9,
    footballWeight: 0.7,
  }),
  city('mexico', 'Mexico', 'mx', 19.4326, -99.1332, 9200, 1, -6, {
    mountainous: true,
    landmarks: ['Place centrale', 'Cathédrale coloniale'],
    footballWeight: 0.9,
  }),
  city('toronto', 'Toronto', 'ca', 43.6532, -79.3832, 2900, 2, -5, {
    coastal: true,
    landmarks: ['Tour panoramique', 'Rive du lac'],
  }),
  city('riodejaneiro', 'Rio de Janeiro', 'br', -22.9068, -43.1729, 6700, 1, -3, {
    coastal: true,
    mountainous: true,
    landmarks: ['Statue monumentale', 'Plage mythique', 'Pain de sucre'],
    tourism: 0.95,
    footballWeight: 0.98,
  }),
  city('saopaulo', 'São Paulo', 'br', -23.5505, -46.6333, 12300, 1, -3, {
    landmarks: ['Avenue moderniste', 'Marché municipal'],
    footballWeight: 0.97,
  }),
  city('salvador', 'Salvador', 'br', -12.9777, -38.5016, 2900, 2, -3, {
    coastal: true,
    landmarks: ['Ville haute colorée'],
    tourism: 0.78,
  }),
  city('buenosaires', 'Buenos Aires', 'ar', -34.6037, -58.3816, 3100, 1, -3, {
    coastal: true,
    landmarks: ['Obélisque', 'Quartier coloré', 'Théâtre historique'],
    footballWeight: 0.98,
  }),
  city('montevideo', 'Montevideo', 'uy', -34.9011, -56.1645, 1300, 2, -3, {
    coastal: true,
    landmarks: ['Rambla', 'Stade historique'],
    footballWeight: 0.9,
  }),
  city('bogota', 'Bogotá', 'co', 4.711, -74.0721, 7400, 2, -5, {
    mountainous: true,
    landmarks: ['Mont sanctuaire', 'Vieille ville'],
    footballWeight: 0.86,
  }),

  // ── Asie / Océanie ────────────────────────────────────────────────────────
  city('tokyo', 'Tokyo', 'jp', 35.6762, 139.6503, 13900, 1, 9, {
    coastal: true,
    awardsHost: true,
    landmarks: ['Tour futuriste', 'Carrefour géant', 'Jardin impérial'],
    tourism: 0.93,
    footballWeight: 0.75,
  }),
  city('osaka', 'Osaka', 'jp', 34.6937, 135.5023, 2700, 2, 9, {
    coastal: true,
    landmarks: ['Château historique', 'Quartier gastronomique'],
  }),
  city('seoul', 'Séoul', 'kr', 37.5665, 126.978, 9700, 1, 9, {
    landmarks: ['Palais royal', 'Tour panoramique'],
    footballWeight: 0.78,
  }),
  city('shanghai', 'Shanghai', 'cn', 31.2304, 121.4737, 24800, 1, 8, {
    coastal: true,
    landmarks: ['Skyline financière', 'Promenade fluviale'],
    footballWeight: 0.7,
  }),
  city('dubai', 'Dubaï', 'ae', 25.2048, 55.2708, 3500, 1, 4, {
    coastal: true,
    awardsHost: true,
    landmarks: ['Tour la plus haute', 'Île artificielle', 'Souk moderne'],
    tourism: 0.94,
    footballWeight: 0.7,
  }),
  city('abudhabi', 'Abu Dhabi', 'ae', 24.4539, 54.3773, 1500, 2, 4, {
    coastal: true,
    landmarks: ['Grande mosquée blanche', 'Corniche'],
  }),
  city('doha', 'Doha', 'qa', 25.2854, 51.531, 2400, 1, 3, {
    coastal: true,
    awardsHost: true,
    landmarks: ['Musée national', 'Corniche', 'Village culturel'],
    footballWeight: 0.8,
  }),
  city('riyad', 'Riyad', 'sa', 24.7136, 46.6753, 7600, 1, 3, {
    landmarks: ['Tour royale', 'Vieille ville restaurée'],
    footballWeight: 0.85,
  }),
  city('mumbai', 'Mumbai', 'in', 19.076, 72.8777, 12400, 1, 5.5, {
    coastal: true,
    landmarks: ['Porte maritime', 'Promenade en arc'],
    footballWeight: 0.55,
  }),
  city('sydney', 'Sydney', 'au', -33.8688, 151.2093, 5300, 1, 10, {
    coastal: true,
    landmarks: ['Opéra emblématique', 'Pont d’arche', 'Plage de surf'],
    tourism: 0.93,
    footballWeight: 0.65,
  }),
  city('melbourne', 'Melbourne', 'au', -37.8136, 144.9631, 5100, 2, 10, {
    coastal: true,
    landmarks: ['Ruelles street art', 'Quartier sportif'],
  }),
] as const;

const CITY_INDEX = new Map(CITIES.map((c) => [c.id, c]));

export function getCity(id: string): CityDef {
  const found = CITY_INDEX.get(id);
  if (!found) throw new Error(`Ville inconnue : "${id}"`);
  return found;
}

export function findCity(id: string): CityDef | undefined {
  return CITY_INDEX.get(id);
}

export function citiesOfCountry(countryId: string): CityDef[] {
  return CITIES.filter((c) => c.countryId === countryId);
}

export function awardsHostCities(): CityDef[] {
  return CITIES.filter((c) => c.awardsHost);
}

export function citiesWithAirport(): CityDef[] {
  return CITIES.filter((c) => c.hasAirport);
}
