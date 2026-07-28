/**
 * Infinity Football — Données / Clubs, stades et compétitions
 *
 * Tome XXIX : « Les stades sont des personnages » — chaque stade possède son
 * histoire, son architecture, ses supporters, son ambiance et ses traditions.
 *
 * Les entités sont fictives et originales : le Tome XXIV prévoit que les
 * marques et licences réelles s'ajoutent par-dessus, via des packs de contenu,
 * sans que le moteur n'en dépende.
 */

import { hashString } from '../core/math.js';
import { CITIES, type CityDef } from './cities.js';

export interface StadiumDef {
  readonly id: string;
  readonly name: string;
  readonly cityId: string;
  readonly capacity: number;
  readonly builtYear: number;
  readonly architecture: string;
  /** Intensité sonore de référence 0..1 (Tome IX, ch. 4). */
  readonly atmosphere: number;
  /** Traditions d'avant-match : tifos, hymnes, tambours. */
  readonly traditions: readonly string[];
  readonly hasRoof: boolean;
  readonly hasMuseum: boolean;
  readonly hasHotel: boolean;
  readonly hasShoppingCentre: boolean;
  readonly anthem: string;
}

export interface ClubDef {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly cityId: string;
  readonly countryId: string;
  readonly leagueId: string;
  readonly stadiumId: string;
  readonly foundedYear: number;
  readonly colors: readonly [string, string];
  /** Réputation mondiale 0..100. */
  readonly prestige: number;
  /** Budget annuel en millions d'euros. */
  readonly budgetM: number;
  /** Qualité de l'académie 0..100 (Tome VI, ch. 5). */
  readonly academy: number;
  /** Qualité des infrastructures 0..100 (Tome XXIX, ch. 4). */
  readonly facilities: number;
  readonly nickname: string;
  readonly rivalIds: readonly string[];
}

export type CompetitionKind =
  | 'league'
  | 'nationalCup'
  | 'continental'
  | 'worldCup'
  | 'olympics'
  | 'friendly'
  | 'legends'
  | 'charity';

export interface CompetitionDef {
  readonly id: string;
  readonly name: string;
  readonly kind: CompetitionKind;
  readonly countryId: string | null;
  readonly continent: string | null;
  /** Prestige 0..100 : pilote la couverture médiatique et les primes. */
  readonly prestige: number;
  /** Mois de début (1..12). */
  readonly startMonth: number;
  /** Mois de fin (1..12). */
  readonly endMonth: number;
  /** Périodicité en années (1 = annuel, 4 = Coupe du Monde). */
  readonly everyYears: number;
  readonly trophyName: string;
}

function stadium(
  id: string,
  name: string,
  cityId: string,
  capacity: number,
  builtYear: number,
  architecture: string,
  atmosphere: number,
  traditions: readonly string[],
  anthem: string,
  extras: Partial<Pick<StadiumDef, 'hasRoof' | 'hasMuseum' | 'hasHotel' | 'hasShoppingCentre'>> = {},
): StadiumDef {
  return {
    id,
    name,
    cityId,
    capacity,
    builtYear,
    architecture,
    atmosphere,
    traditions,
    anthem,
    hasRoof: extras.hasRoof ?? capacity > 55000,
    hasMuseum: extras.hasMuseum ?? capacity > 40000,
    hasHotel: extras.hasHotel ?? false,
    hasShoppingCentre: extras.hasShoppingCentre ?? capacity > 60000,
  };
}

export const STADIUMS: readonly StadiumDef[] = [
  stadium('stade-lumiere', 'Stade Lumière', 'paris', 68000, 1974, 'bol asymétrique en verre', 0.9,
    ['tifo géant du virage nord', 'fumigènes bleus', 'chant du kop à la 12e minute'],
    'Lumière éternelle', { hasHotel: true }),
  stadium('velodrome-sud', 'Vélodrome du Sud', 'marseille', 67000, 1937, 'tribunes en vagues blanches', 0.97,
    ['tambours du virage', 'écharpes levées avant le coup d’envoi'], 'Le chant du port'),
  stadium('arena-rhone', 'Arena Rhône', 'lyon', 59000, 2016, 'coque translucide', 0.78,
    ['présentation laser', 'hymne repris a cappella'], 'Deux fleuves'),
  stadium('coliseo-real', 'Coliseo Real', 'madrid', 81000, 1947, 'façade de lames d’acier', 0.93,
    ['hymne joué à l’orgue', 'drapeaux blancs déployés'], 'Marche royale'),
  stadium('templo-blau', 'Templo Blaugrana', 'barcelone', 99000, 1957, 'triple anneau ouvert', 0.94,
    ['mosaïque de cartons', 'chant catalan avant le coup d’envoi'], 'Cant del camp'),
  stadium('kings-park', 'Kings Park', 'londres', 62000, 2019, 'anneau lumineux rétractable', 0.91,
    ['hymne du club à la sortie du tunnel', 'écharpes tendues'], 'Old Kings'),
  stadium('northgate', 'Northgate Ground', 'manchester', 74000, 1910, 'brique rouge et charpente', 0.95,
    ['minute de chant continu', 'cathédrale du silence avant le coup d’envoi'], 'Northern Pride'),
  stadium('dockside', 'Dockside Arena', 'liverpool', 61000, 1892, 'tribunes verticales rapprochées', 0.99,
    ['hymne bras dessus bras dessous', 'mur d’écharpes'], 'Never Alone'),
  stadium('scala-nord', 'Scala del Nord', 'milan', 80000, 1926, 'rampes hélicoïdales', 0.92,
    ['tifo peint à la main', 'torches et bâches'], 'Notte di Scala'),
  stadium('arena-imperiale', 'Arena Imperiale', 'rome', 72000, 1953, 'anneau antique revisité', 0.9,
    ['chœur des ultras', 'drapeaux romains'], 'Eterna'),
  stadium('vesuvio-park', 'Vesuvio Park', 'naples', 55000, 1959, 'gradins volcaniques', 0.96,
    ['fumigènes bleu ciel', 'chant du golfe'], 'Golfo Azzurro'),
  stadium('alpen-arena', 'Alpen Arena', 'munich', 75000, 2005, 'coussins gonflables lumineux', 0.89,
    ['illumination changeante', 'chant bavarois'], 'Weiss-Rot'),
  stadium('mur-jaune', 'Stade du Mur Jaune', 'dortmund', 81000, 1974, 'tribune debout monumentale', 1,
    ['mur jaune debout', 'You’ll never walk alone local'], 'Gelbe Wand'),
  stadium('olympia-berlin', 'Olympia Berlin', 'berlin', 74000, 1936, 'colonnade de pierre', 0.82,
    ['piste bleue', 'entrée par le portail antique'], 'Hauptstadt'),
  stadium('atlantico', 'Estádio Atlântico', 'lisbonne', 65000, 2003, 'toit suspendu à câbles', 0.88,
    ['aigle en vol avant le match', 'chant fadiste'], 'Águia'),
  stadium('douro-arena', 'Douro Arena', 'porto', 50000, 2003, 'béton brut et bleu', 0.9,
    ['drapeaux du fleuve', 'chant du nord'], 'Rio Azul'),
  stadium('canal-arena', 'Canal Arena', 'amsterdam', 55000, 1996, 'arche translucide', 0.85,
    ['tifo damier', 'sifflets rythmés'], 'Kanaal'),
  stadium('bosphore-arena', 'Bosphore Arena', 'istanbul', 76000, 2011, 'vagues d’acier', 0.99,
    ['enfer sonore', 'feux d’artifice d’avant-match'], 'Boğaz'),
  stadium('niger-arena', 'Stade du Niger', 'bamako', 52000, 1999, 'béton ocre et bois local', 0.95,
    ['djembés du virage', 'danse des supporters', 'lever du drapeau'], 'Fleuve d’Or'),
  stadium('atlantique-dakar', 'Arena Atlantique', 'dakar', 50000, 2022, 'voiles blanches sur mer', 0.93,
    ['tambours sabar', 'lutte traditionnelle en lever de rideau'], 'Teranga'),
  stadium('lagune-arena', 'Lagune Arena', 'abidjan', 60000, 2020, 'anneau lagunaire', 0.94,
    ['orchestre de rue', 'vagues de couleurs'], 'Éburnie'),
  stadium('atlas-arena', 'Atlas Arena', 'casablanca', 67000, 2018, 'zellige contemporain', 0.95,
    ['tifo calligraphié', 'chant continu 90 minutes'], 'Atlas'),
  stadium('nil-arena', 'Nil Arena', 'lecaire', 75000, 1960, 'anneau ouvert sur le fleuve', 0.96,
    ['fumigènes rouges', 'roulement de tambours'], 'Nil Éternel'),
  stadium('atlantic-lagos', 'Atlantic Bowl', 'lagos', 60000, 2015, 'coque tropicale ventilée', 0.94,
    ['percussions', 'danse des tribunes'], 'Ocean Roar'),
  stadium('table-arena', 'Table Arena', 'lecap', 55000, 2009, 'panier tressé lumineux', 0.86,
    ['vuvuzelas', 'panorama sur la montagne'], 'Kaap'),
  stadium('maracana-novo', 'Estádio Novo Litoral', 'riodejaneiro', 78000, 1950, 'anneau bas panoramique', 0.99,
    ['samba des tribunes', 'batucada continue', 'pluie de confettis'], 'Litoral'),
  stadium('paulista-arena', 'Arena Paulista', 'saopaulo', 72000, 1960, 'béton moderniste', 0.96,
    ['chants d’ultras organisés', 'drapeaux géants'], 'Paulista'),
  stadium('bombonera-sur', 'La Caldera del Sur', 'buenosaires', 57000, 1940, 'tribune verticale vibrante',
    1, ['tribune qui tremble', 'papelitos', 'chant ininterrompu'], 'Caldera'),
  stadium('centenario-uy', 'Estadio Centenario Nuevo', 'montevideo', 60000, 1930, 'tour hommage',
    0.92, ['hommage aux pionniers', 'drapeaux célestes'], 'Centenario'),
  stadium('liberty-ny', 'Liberty Field', 'newyork', 68000, 2014, 'verre et acier vertical', 0.8,
    ['show d’avant-match', 'feux d’artifice'], 'Liberty'),
  stadium('pacific-la', 'Pacific Bowl', 'losangeles', 70000, 2020, 'toit ajouré translucide', 0.79,
    ['spectacle lumineux', 'invités célèbres'], 'Pacific'),
  stadium('azteca-nuevo', 'Coloso del Valle', 'mexico', 83000, 1966, 'cuvette d’altitude', 0.97,
    ['ola géante', 'mariachis d’avant-match'], 'Coloso'),
  stadium('tokyo-dome-fc', 'Sakura Arena', 'tokyo', 68000, 2019, 'bois lamellé et acier', 0.84,
    ['chorégraphie synchronisée', 'nettoyage des tribunes'], 'Sakura'),
  stadium('desert-jewel', 'Desert Jewel', 'dubai', 60000, 2021, 'résille dorée climatisée', 0.82,
    ['show de drones', 'climatisation de gradins'], 'Jewel'),
  stadium('pearl-doha', 'Pearl Stadium', 'doha', 62000, 2021, 'coque nacrée', 0.83,
    ['calligraphie lumineuse', 'accueil traditionnel'], 'Pearl'),
  stadium('harbour-sydney', 'Harbour Arena', 'sydney', 58000, 2018, 'voiles maritimes', 0.8,
    ['show du port', 'chant australien'], 'Harbour'),
] as const;

function club(
  id: string,
  name: string,
  shortName: string,
  cityId: string,
  countryId: string,
  leagueId: string,
  stadiumId: string,
  foundedYear: number,
  colors: readonly [string, string],
  prestige: number,
  budgetM: number,
  academy: number,
  facilities: number,
  nickname: string,
  rivalIds: readonly string[] = [],
): ClubDef {
  return {
    id,
    name,
    shortName,
    cityId,
    countryId,
    leagueId,
    stadiumId,
    foundedYear,
    colors,
    prestige,
    budgetM,
    academy,
    facilities,
    nickname,
    rivalIds,
  };
}

export const CLUBS: readonly ClubDef[] = [
  // France
  club('paris-lumiere', 'Paris Lumière FC', 'Paris L.', 'paris', 'fr', 'fr-elite', 'stade-lumiere',
    1970, ['#0b1e3d', '#c8102e'], 91, 620, 82, 92, 'Les Lumières', ['marseille-port']),
  club('marseille-port', 'Olympique du Port', 'OP Marseille', 'marseille', 'fr', 'fr-elite', 'velodrome-sud',
    1899, ['#ffffff', '#2fa8dc'], 82, 220, 78, 78, 'Les Phocéens', ['paris-lumiere']),
  club('lyon-rhone', 'Rhône Athlétic', 'Rhône AC', 'lyon', 'fr', 'fr-elite', 'arena-rhone',
    1950, ['#ffffff', '#d6001c'], 76, 160, 88, 84, 'Les Gones', []),
  // Espagne
  club('madrid-real', 'Real Castilla CF', 'Castilla', 'madrid', 'es', 'es-liga', 'coliseo-real',
    1902, ['#ffffff', '#d4af37'], 96, 780, 86, 95, 'Les Blancs', ['barcelona-blau']),
  club('barcelona-blau', 'Barcelona Blaugrana', 'Blaugrana', 'barcelone', 'es', 'es-liga', 'templo-blau',
    1899, ['#8b0f2f', '#12356b'], 95, 720, 95, 93, 'Le Temple', ['madrid-real']),
  club('sevilla-sur', 'Sevilla del Sur', 'Sevilla S.', 'seville', 'es', 'es-liga', 'scala-nord',
    1905, ['#ffffff', '#d90429'], 74, 140, 79, 76, 'Les Andalous', []),
  // Angleterre
  club('london-kings', 'London Kings FC', 'Kings', 'londres', 'gb', 'gb-premier', 'kings-park',
    1886, ['#0a2f5c', '#ffffff'], 90, 640, 84, 94, 'Les Rois', ['manchester-north']),
  club('manchester-north', 'Manchester Northgate', 'Northgate', 'manchester', 'gb', 'gb-premier', 'northgate',
    1878, ['#c1121f', '#ffffff'], 93, 700, 90, 95, 'Les Rouges du Nord', ['london-kings', 'liverpool-dock']),
  club('liverpool-dock', 'Liverpool Dockers', 'Dockers', 'liverpool', 'gb', 'gb-premier', 'dockside',
    1892, ['#c8102e', '#f1c40f'], 92, 620, 88, 92, 'Les Dockers', ['manchester-north']),
  // Italie
  club('milano-scala', 'Milano Scala', 'Scala', 'milan', 'it', 'it-serie', 'scala-nord',
    1899, ['#000000', '#c8102e'], 88, 420, 83, 88, 'La Scala', ['roma-imperiale']),
  club('roma-imperiale', 'Roma Imperiale', 'Imperiale', 'rome', 'it', 'it-serie', 'arena-imperiale',
    1927, ['#8b1a1a', '#f1c40f'], 82, 260, 80, 82, 'Les Impériaux', ['milano-scala']),
  club('napoli-vesuvio', 'Napoli Vesuvio', 'Vesuvio', 'naples', 'it', 'it-serie', 'vesuvio-park',
    1926, ['#12a5d9', '#ffffff'], 84, 280, 81, 80, 'Les Bleu Ciel', []),
  club('torino-alpi', 'Torino Alpi', 'Alpi', 'turin', 'it', 'it-serie', 'arena-imperiale',
    1897, ['#000000', '#ffffff'], 86, 380, 87, 90, 'Les Alpins', []),
  // Allemagne
  club('munich-alpen', 'Munich Alpen', 'Alpen', 'munich', 'de', 'de-bundes', 'alpen-arena',
    1900, ['#c8102e', '#ffffff'], 94, 680, 91, 96, 'Les Alpins Rouges', ['dortmund-mur']),
  club('dortmund-mur', 'Dortmund Mauer', 'Mauer', 'dortmund', 'de', 'de-bundes', 'mur-jaune',
    1909, ['#f6e400', '#000000'], 87, 380, 93, 90, 'Le Mur Jaune', ['munich-alpen']),
  club('berlin-olympia', 'Berlin Olympia', 'Olympia', 'berlin', 'de', 'de-bundes', 'olympia-berlin',
    1892, ['#0057b7', '#ffffff'], 74, 150, 78, 80, 'Les Capitalins', []),
  // Portugal
  club('lisboa-aguia', 'Lisboa Águia', 'Águia', 'lisbonne', 'pt', 'pt-liga', 'atlantico',
    1904, ['#c8102e', '#ffffff'], 82, 160, 90, 85, 'Les Aigles', ['porto-douro']),
  club('porto-douro', 'Porto Douro', 'Douro', 'porto', 'pt', 'pt-liga', 'douro-arena',
    1893, ['#0057b7', '#ffffff'], 83, 170, 89, 86, 'Les Dragons du Fleuve', ['lisboa-aguia']),
  // Pays-Bas / Turquie
  club('amsterdam-canal', 'Amsterdam Canal FC', 'Canal', 'amsterdam', 'nl', 'nl-eredivisie', 'canal-arena',
    1900, ['#c8102e', '#ffffff'], 80, 130, 96, 88, 'Les Canaux', []),
  club('istanbul-bosphore', 'Bosphore SK', 'Bosphore', 'istanbul', 'tr', 'tr-super', 'bosphore-arena',
    1905, ['#f6e400', '#c8102e'], 81, 140, 82, 82, 'Les Détroits', []),
  // Afrique
  club('bamako-djoliba', 'AS Djoliba Bamako', 'Djoliba', 'bamako', 'ml', 'ml-premiere', 'niger-arena',
    1960, ['#c8102e', '#f6e400'], 66, 22, 84, 62, 'Les Rouges du Fleuve', []),
  club('dakar-teranga', 'Teranga FC Dakar', 'Teranga', 'dakar', 'sn', 'sn-ligue', 'atlantique-dakar',
    1969, ['#1a8f4c', '#f6e400'], 68, 26, 86, 68, 'Les Lions', []),
  club('abidjan-lagune', 'Lagune Sporting', 'Lagune', 'abidjan', 'ci', 'ci-ligue', 'lagune-arena',
    1948, ['#f4820b', '#ffffff'], 69, 30, 88, 70, 'Les Éléphants du Sud', []),
  club('casablanca-atlas', 'Atlas Casablanca', 'Atlas', 'casablanca', 'ma', 'ma-botola', 'atlas-arena',
    1949, ['#c8102e', '#1a8f4c'], 73, 45, 85, 76, 'Les Lions de l’Atlas', []),
  club('caire-nil', 'Nil Sporting Club', 'Nil SC', 'lecaire', 'eg', 'eg-premier', 'nil-arena',
    1907, ['#c8102e', '#ffffff'], 76, 55, 84, 74, 'Les Pharaons Rouges', []),
  club('lagos-atlantic', 'Atlantic Lagos FC', 'Atlantic', 'lagos', 'ng', 'ng-npfl', 'atlantic-lagos',
    1970, ['#1a8f4c', '#ffffff'], 67, 24, 87, 66, 'Les Super Aigles du Port', []),
  club('lecap-table', 'Table Bay United', 'Table Bay', 'lecap', 'za', 'za-premier', 'table-arena',
    1971, ['#0057b7', '#f6e400'], 65, 28, 78, 72, 'Les Montagnards', []),
  // Amériques
  club('rio-litoral', 'Litoral Rio FC', 'Litoral', 'riodejaneiro', 'br', 'br-serie', 'maracana-novo',
    1904, ['#000000', '#c8102e'], 84, 90, 97, 82, 'Les Côtiers', ['sao-paulista']),
  club('sao-paulista', 'Paulista Athletic', 'Paulista', 'saopaulo', 'br', 'br-serie', 'paulista-arena',
    1900, ['#ffffff', '#c8102e'], 85, 100, 96, 84, 'Les Tricolores', ['rio-litoral']),
  club('buenos-caldera', 'Caldera Junior', 'Caldera', 'buenosaires', 'ar', 'ar-primera', 'bombonera-sur',
    1905, ['#0b3d91', '#f6e400'], 83, 70, 95, 78, 'Les Bleu et Or', []),
  club('montevideo-centenario', 'Centenario FC', 'Centenario', 'montevideo', 'uy', 'uy-primera', 'centenario-uy',
    1891, ['#0b3d91', '#ffffff'], 72, 30, 90, 70, 'Les Célestes', []),
  club('newyork-liberty', 'New York Liberty SC', 'NY Liberty', 'newyork', 'us', 'us-major', 'liberty-ny',
    1996, ['#0b1e3d', '#ffffff'], 71, 120, 72, 88, 'Les Libertaires', ['la-pacific']),
  club('la-pacific', 'Los Angeles Pacific', 'LA Pacific', 'losangeles', 'us', 'us-major', 'pacific-la',
    2014, ['#000000', '#f6e400'], 72, 130, 74, 90, 'Les Pacifiques', ['newyork-liberty']),
  club('mexico-coloso', 'Coloso del Valle CF', 'Coloso', 'mexico', 'mx', 'mx-liga', 'azteca-nuevo',
    1943, ['#1a8f4c', '#ffffff'], 76, 60, 84, 78, 'Les Aigles du Valle', []),
  // Asie / Océanie
  club('tokyo-sakura', 'Tokyo Sakura FC', 'Sakura', 'tokyo', 'jp', 'jp-league', 'tokyo-dome-fc',
    1993, ['#e75480', '#ffffff'], 70, 90, 82, 92, 'Les Cerisiers', []),
  club('dubai-jewel', 'Desert Jewel SC', 'Jewel', 'dubai', 'ae', 'ae-league', 'desert-jewel',
    2005, ['#d4af37', '#ffffff'], 69, 150, 68, 94, 'Les Joyaux', []),
  club('doha-pearl', 'Pearl Doha SC', 'Pearl', 'doha', 'qa', 'qa-stars', 'pearl-doha',
    1972, ['#7b1e3a', '#ffffff'], 70, 170, 72, 95, 'Les Perles', []),
  club('riyad-royal', 'Riyad Royal FC', 'Royal', 'riyad', 'sa', 'sa-pro', 'pearl-doha',
    1957, ['#1a8f4c', '#f6e400'], 75, 260, 74, 92, 'Les Royaux', []),
  club('sydney-harbour', 'Sydney Harbour FC', 'Harbour', 'sydney', 'au', 'au-league', 'harbour-sydney',
    2004, ['#0b3d91', '#7fd4f0'], 64, 45, 70, 84, 'Les Marins', []),
] as const;

export const COMPETITIONS: readonly CompetitionDef[] = [
  { id: 'fr-elite', name: 'Élite Française', kind: 'league', countryId: 'fr', continent: 'Europe', prestige: 82, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Hexagone d’Or' },
  { id: 'es-liga', name: 'Liga Ibérica', kind: 'league', countryId: 'es', continent: 'Europe', prestige: 92, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Copa Ibérica' },
  { id: 'gb-premier', name: 'Premier League Anglaise', kind: 'league', countryId: 'gb', continent: 'Europe', prestige: 95, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Couronne Anglaise' },
  { id: 'it-serie', name: 'Serie Italienne', kind: 'league', countryId: 'it', continent: 'Europe', prestige: 88, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Scudo Italiano' },
  { id: 'de-bundes', name: 'Bundes Allemande', kind: 'league', countryId: 'de', continent: 'Europe', prestige: 89, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Schale Allemande' },
  { id: 'pt-liga', name: 'Liga Portugaise', kind: 'league', countryId: 'pt', continent: 'Europe', prestige: 78, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Taça Lusitana' },
  { id: 'nl-eredivisie', name: 'Championnat Néerlandais', kind: 'league', countryId: 'nl', continent: 'Europe', prestige: 75, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Schaal des Canaux' },
  { id: 'tr-super', name: 'Super Ligue Turque', kind: 'league', countryId: 'tr', continent: 'Europe', prestige: 74, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Kupa du Bosphore' },
  { id: 'ml-premiere', name: 'Première Division Malienne', kind: 'league', countryId: 'ml', continent: 'Afrique', prestige: 58, startMonth: 10, endMonth: 6, everyYears: 1, trophyName: 'Trophée du Fleuve' },
  { id: 'sn-ligue', name: 'Ligue Sénégalaise', kind: 'league', countryId: 'sn', continent: 'Afrique', prestige: 59, startMonth: 10, endMonth: 6, everyYears: 1, trophyName: 'Coupe de la Teranga' },
  { id: 'ci-ligue', name: 'Ligue Ivoirienne', kind: 'league', countryId: 'ci', continent: 'Afrique', prestige: 60, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Trophée de la Lagune' },
  { id: 'ma-botola', name: 'Championnat Marocain', kind: 'league', countryId: 'ma', continent: 'Afrique', prestige: 66, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Coupe de l’Atlas' },
  { id: 'eg-premier', name: 'Premier League Égyptienne', kind: 'league', countryId: 'eg', continent: 'Afrique', prestige: 68, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Trophée du Nil' },
  { id: 'ng-npfl', name: 'Championnat Nigérian', kind: 'league', countryId: 'ng', continent: 'Afrique', prestige: 58, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Coupe Atlantique' },
  { id: 'za-premier', name: 'Premier Sud-Africain', kind: 'league', countryId: 'za', continent: 'Afrique', prestige: 60, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Trophée du Cap' },
  { id: 'br-serie', name: 'Série Brésilienne', kind: 'league', countryId: 'br', continent: 'Amérique du Sud', prestige: 84, startMonth: 4, endMonth: 12, everyYears: 1, trophyName: 'Taça Brasileira' },
  { id: 'ar-primera', name: 'Primera Argentine', kind: 'league', countryId: 'ar', continent: 'Amérique du Sud', prestige: 81, startMonth: 2, endMonth: 11, everyYears: 1, trophyName: 'Copa Argentina' },
  { id: 'uy-primera', name: 'Primera Uruguayenne', kind: 'league', countryId: 'uy', continent: 'Amérique du Sud', prestige: 70, startMonth: 2, endMonth: 11, everyYears: 1, trophyName: 'Copa Celeste' },
  { id: 'us-major', name: 'Major League Nord-Américaine', kind: 'league', countryId: 'us', continent: 'Amérique du Nord', prestige: 72, startMonth: 3, endMonth: 11, everyYears: 1, trophyName: 'Liberty Cup' },
  { id: 'mx-liga', name: 'Liga Mexicaine', kind: 'league', countryId: 'mx', continent: 'Amérique du Nord', prestige: 74, startMonth: 7, endMonth: 5, everyYears: 1, trophyName: 'Copa del Valle' },
  { id: 'jp-league', name: 'J-Ligue', kind: 'league', countryId: 'jp', continent: 'Asie', prestige: 70, startMonth: 2, endMonth: 12, everyYears: 1, trophyName: 'Sakura Cup' },
  { id: 'ae-league', name: 'Ligue des Émirats', kind: 'league', countryId: 'ae', continent: 'Asie', prestige: 66, startMonth: 9, endMonth: 5, everyYears: 1, trophyName: 'Desert Cup' },
  { id: 'qa-stars', name: 'Stars League Qatarienne', kind: 'league', countryId: 'qa', continent: 'Asie', prestige: 67, startMonth: 9, endMonth: 5, everyYears: 1, trophyName: 'Pearl Cup' },
  { id: 'sa-pro', name: 'Pro League Saoudienne', kind: 'league', countryId: 'sa', continent: 'Asie', prestige: 76, startMonth: 8, endMonth: 5, everyYears: 1, trophyName: 'Royal Cup' },
  { id: 'au-league', name: 'A-Ligue Australienne', kind: 'league', countryId: 'au', continent: 'Océanie', prestige: 62, startMonth: 10, endMonth: 5, everyYears: 1, trophyName: 'Harbour Cup' },

  { id: 'fr-coupe', name: 'Coupe de France', kind: 'nationalCup', countryId: 'fr', continent: 'Europe', prestige: 70, startMonth: 11, endMonth: 5, everyYears: 1, trophyName: 'Coupe Nationale' },
  { id: 'gb-coupe', name: 'Coupe d’Angleterre', kind: 'nationalCup', countryId: 'gb', continent: 'Europe', prestige: 80, startMonth: 11, endMonth: 5, everyYears: 1, trophyName: 'Old Cup' },
  { id: 'es-coupe', name: 'Coupe d’Espagne', kind: 'nationalCup', countryId: 'es', continent: 'Europe', prestige: 76, startMonth: 11, endMonth: 4, everyYears: 1, trophyName: 'Copa del Reino' },
  { id: 'it-coupe', name: 'Coupe d’Italie', kind: 'nationalCup', countryId: 'it', continent: 'Europe', prestige: 74, startMonth: 11, endMonth: 5, everyYears: 1, trophyName: 'Coppa Italiana' },
  { id: 'de-coupe', name: 'Coupe d’Allemagne', kind: 'nationalCup', countryId: 'de', continent: 'Europe', prestige: 75, startMonth: 10, endMonth: 5, everyYears: 1, trophyName: 'Pokal' },
  { id: 'ml-coupe', name: 'Coupe du Mali', kind: 'nationalCup', countryId: 'ml', continent: 'Afrique', prestige: 52, startMonth: 12, endMonth: 6, everyYears: 1, trophyName: 'Coupe du Président' },

  { id: 'eu-champions', name: 'Ligue des Champions Européenne', kind: 'continental', countryId: null, continent: 'Europe', prestige: 99, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Coupe aux Grandes Oreilles d’Europe' },
  { id: 'eu-league', name: 'Ligue Europa', kind: 'continental', countryId: null, continent: 'Europe', prestige: 82, startMonth: 9, endMonth: 5, everyYears: 1, trophyName: 'Trophée Continental' },
  { id: 'af-champions', name: 'Ligue des Champions Africaine', kind: 'continental', countryId: null, continent: 'Afrique', prestige: 84, startMonth: 9, endMonth: 6, everyYears: 1, trophyName: 'Coupe d’Afrique des Clubs' },
  { id: 'sa-libertad', name: 'Coupe Sud-Américaine des Champions', kind: 'continental', countryId: null, continent: 'Amérique du Sud', prestige: 90, startMonth: 2, endMonth: 11, everyYears: 1, trophyName: 'Copa de los Libertadores' },
  { id: 'as-champions', name: 'Ligue des Champions Asiatique', kind: 'continental', countryId: null, continent: 'Asie', prestige: 78, startMonth: 9, endMonth: 5, everyYears: 1, trophyName: 'Coupe d’Asie des Clubs' },
  { id: 'na-champions', name: 'Coupe des Champions Nord-Américaine', kind: 'continental', countryId: null, continent: 'Amérique du Nord', prestige: 72, startMonth: 2, endMonth: 6, everyYears: 1, trophyName: 'Concacoupe' },

  { id: 'world-cup', name: 'Coupe du Monde', kind: 'worldCup', countryId: null, continent: null, prestige: 100, startMonth: 6, endMonth: 7, everyYears: 4, trophyName: 'Trophée Mondial' },
  { id: 'olympics', name: 'Tournoi Olympique', kind: 'olympics', countryId: null, continent: null, prestige: 78, startMonth: 7, endMonth: 8, everyYears: 4, trophyName: 'Médaille d’Or Olympique' },
  { id: 'continental-nations', name: 'Championnat Continental des Nations', kind: 'continental', countryId: null, continent: null, prestige: 92, startMonth: 6, endMonth: 7, everyYears: 2, trophyName: 'Coupe des Nations' },
  { id: 'legends-cup', name: 'Coupe des Légendes', kind: 'legends', countryId: null, continent: null, prestige: 60, startMonth: 12, endMonth: 12, everyYears: 1, trophyName: 'Trophée des Légendes' },
  { id: 'charity-shield', name: 'Match Caritatif Mondial', kind: 'charity', countryId: null, continent: null, prestige: 55, startMonth: 12, endMonth: 12, everyYears: 1, trophyName: 'Trophée Solidarité' },
  { id: 'summer-tour', name: 'Tournée Estivale', kind: 'friendly', countryId: null, continent: null, prestige: 45, startMonth: 7, endMonth: 8, everyYears: 1, trophyName: 'Trophée de la Tournée' },
] as const;

/**
 * Complétion automatique des championnats.
 *
 * Les clubs ci-dessus sont les formations « vedettes » écrites à la main. Un
 * championnat crédible en compte davantage : cette étape génère de manière
 * déterministe les clubs manquants à partir des villes réelles du pays, pour
 * qu'aucune compétition ne soit dégénérée. Un pack de contenu qui ajoute de
 * vrais clubs les remplace simplement en réduisant le nombre de places à
 * combler (Tome XXII, ch. 2).
 */
const MIN_CLUBS_PER_LEAGUE = 8;

const FILLER_SUFFIXES = [
  'Athletic',
  'Sporting',
  'United',
  'Racing',
  'Olympique',
  'Union',
  'Club',
  'Académie',
  'Étoile',
  'Avenir',
] as const;

const FILLER_NICKNAMES = [
  'Les Espoirs',
  'Les Bâtisseurs',
  'Les Vagues',
  'Les Sentinelles',
  'Les Comètes',
  'Les Ancrés',
  'Les Braves',
  'Les Insoumis',
] as const;

const FILLER_COLOURS: ReadonlyArray<readonly [string, string]> = [
  ['#1b4f9c', '#ffffff'],
  ['#c8102e', '#f6e400'],
  ['#0f7b46', '#ffffff'],
  ['#f4820b', '#101820'],
  ['#5b2ea6', '#ffffff'],
  ['#101820', '#d4af37'],
  ['#0aa2c0', '#ffffff'],
  ['#7b1e3a', '#f0e6d2'],
];

function buildFillerClubs(): ClubDef[] {
  const fillers: ClubDef[] = [];
  const authored = new Map<string, number>();
  for (const club of CLUBS) {
    authored.set(club.leagueId, (authored.get(club.leagueId) ?? 0) + 1);
  }

  for (const competition of COMPETITIONS) {
    if (competition.kind !== 'league' || !competition.countryId) continue;
    const existing = authored.get(competition.id) ?? 0;
    const missing = MIN_CLUBS_PER_LEAGUE - existing;
    if (missing <= 0) continue;

    const countryCities = CITIES.filter((city) => city.countryId === competition.countryId);
    if (countryCities.length === 0) continue;
    const usedStadiums = STADIUMS.filter((stadium) =>
      countryCities.some((city) => city.id === stadium.cityId),
    );

    for (let index = 0; index < missing; index++) {
      const city = countryCities[index % countryCities.length] as CityDef;
      const seed = hashString(`${competition.id}:${index}`);
      const suffix = FILLER_SUFFIXES[seed % FILLER_SUFFIXES.length] as string;
      const colours = FILLER_COLOURS[seed % FILLER_COLOURS.length] as readonly [string, string];
      const nickname = FILLER_NICKNAMES[(seed >>> 3) % FILLER_NICKNAMES.length] as string;
      // Les clubs générés sont volontairement modestes : ils peuplent le
      // championnat sans éclipser les formations écrites à la main.
      const prestige = 42 + ((seed >>> 5) % 18) - Math.min(10, index);
      const stadium = usedStadiums[index % Math.max(1, usedStadiums.length)];

      fillers.push({
        id: `${competition.id}-club-${index + 1}`,
        name: `${city.name} ${suffix}`,
        shortName: `${city.name.slice(0, 8)} ${suffix.slice(0, 3)}`,
        cityId: city.id,
        countryId: competition.countryId,
        leagueId: competition.id,
        stadiumId: stadium?.id ?? (STADIUMS[0] as StadiumDef).id,
        foundedYear: 1900 + ((seed >>> 7) % 90),
        colors: colours,
        prestige: Math.max(28, Math.min(70, prestige)),
        budgetM: Math.max(4, Math.round(prestige * 0.9)),
        academy: 40 + ((seed >>> 9) % 30),
        facilities: 38 + ((seed >>> 11) % 32),
        nickname,
        rivalIds: [],
      });
    }
  }
  return fillers;
}

/** Ensemble complet des clubs : formations écrites à la main puis complétion. */
export const ALL_CLUBS: readonly ClubDef[] = [...CLUBS, ...buildFillerClubs()];

const CLUB_INDEX = new Map(ALL_CLUBS.map((c) => [c.id, c]));
const STADIUM_INDEX = new Map(STADIUMS.map((s) => [s.id, s]));
const COMPETITION_INDEX = new Map(COMPETITIONS.map((c) => [c.id, c]));

export function getClub(id: string): ClubDef {
  const club = CLUB_INDEX.get(id);
  if (!club) throw new Error(`Club inconnu : "${id}"`);
  return club;
}

export function findClub(id: string): ClubDef | undefined {
  return CLUB_INDEX.get(id);
}

export function getStadium(id: string): StadiumDef {
  const stadium = STADIUM_INDEX.get(id);
  if (!stadium) throw new Error(`Stade inconnu : "${id}"`);
  return stadium;
}

export function findStadium(id: string): StadiumDef | undefined {
  return STADIUM_INDEX.get(id);
}

export function getCompetition(id: string): CompetitionDef {
  const competition = COMPETITION_INDEX.get(id);
  if (!competition) throw new Error(`Compétition inconnue : "${id}"`);
  return competition;
}

export function clubsOfLeague(leagueId: string): ClubDef[] {
  return ALL_CLUBS.filter((c) => c.leagueId === leagueId);
}

export function clubsOfCity(cityId: string): ClubDef[] {
  return ALL_CLUBS.filter((c) => c.cityId === cityId);
}

export function clubsOfCountry(countryId: string): ClubDef[] {
  return ALL_CLUBS.filter((c) => c.countryId === countryId);
}

export function stadiumsOfCity(cityId: string): StadiumDef[] {
  return STADIUMS.filter((s) => s.cityId === cityId);
}

export function leagues(): CompetitionDef[] {
  return COMPETITIONS.filter((c) => c.kind === 'league');
}
