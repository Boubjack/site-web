/**
 * Infinity Football — Monde / Typologie des lieux
 *
 * Tome II, ch. 1.3 : « Aucune zone inutile. Chaque bâtiment important doit
 * avoir une fonction. Le joueur doit pouvoir entrer dans la majorité des lieux
 * importants. »
 *
 * Chaque type de lieu déclare : ses quartiers d'implantation, ses horaires,
 * ses pièces intérieures visitables, son niveau de prix et sa densité par
 * ville. Le générateur s'appuie exclusivement sur ce catalogue, ce qui permet
 * d'ajouter un nouveau type de commerce sans modifier une ligne de logique.
 */

import type { DistrictKind } from '../data/cities.js';

export type VenueType =
  // Commerce & services
  | 'shop'
  | 'mall'
  | 'officialStore'
  | 'popupStore'
  | 'dealership'
  | 'bank'
  | 'market'
  // Restauration & nuit
  | 'restaurant'
  | 'cafe'
  | 'nightclub'
  // Hébergement & résidentiel
  | 'hotel'
  | 'apartment'
  | 'villa'
  | 'penthouse'
  | 'chalet'
  | 'privateIsland'
  | 'garage'
  // Culture & loisirs
  | 'museum'
  | 'cinema'
  | 'concertHall'
  | 'festivalGround'
  | 'themePark'
  | 'library'
  | 'artGallery'
  // Sport
  | 'stadium'
  | 'trainingCentre'
  | 'academy'
  | 'gym'
  | 'pool'
  | 'sportsCourt'
  | 'tennisClub'
  | 'golfCourse'
  | 'kartingTrack'
  | 'bowlingAlley'
  | 'billiardsHall'
  | 'streetPitch'
  | 'skiResort'
  | 'surfSchool'
  | 'divingCentre'
  | 'trailhead'
  | 'bungeeSite'
  | 'balloonField'
  | 'natureReserve'
  | 'spa'
  // Transport
  | 'airport'
  | 'trainStation'
  | 'metroStation'
  | 'busStation'
  | 'heliport'
  | 'marina'
  | 'airfield'
  // Espaces publics
  | 'park'
  | 'beach'
  | 'square'
  | 'fanZone'
  // Institutions
  | 'hospital'
  | 'school'
  | 'townHall'
  | 'mediaHouse'
  | 'clubHeadquarters'
  | 'socialHub'
  | 'personalMuseum'
  | 'foundation';

export interface VenueTemplate {
  readonly type: VenueType;
  /** Libellé affiché sur la carte et dans le GPS. */
  readonly label: string;
  /** Quartiers où le lieu peut apparaître ; vide = tous. */
  readonly districts: readonly DistrictKind[];
  /** Heure d'ouverture (0..23) ; 0 avec closeHour 24 = ouvert en permanence. */
  readonly openHour: number;
  readonly closeHour: number;
  /** Ouvert le week-end ? */
  readonly openWeekends: boolean;
  /** Le joueur peut y entrer et parcourir l'intérieur. */
  readonly enterable: boolean;
  /** Pièces intérieures modélisées (Tome XXIX, ch. 2 pour les stades). */
  readonly rooms: readonly string[];
  /** Niveau de prix 0..4. */
  readonly priceLevel: 0 | 1 | 2 | 3 | 4;
  /** Nombre attendu pour 1 million d'habitants. */
  readonly densityPerMillion: number;
  /** Nombre minimal garanti par ville éligible. */
  readonly minPerCity: number;
  /** Palier de ville minimal (1 = mégapole uniquement). */
  readonly minCityTier: 1 | 2 | 3;
  /** Peut fermer/ouvrir au fil des saisons (Tome XXXII, ch. 4). */
  readonly volatile: boolean;
  /** Capacité d'accueil simultanée (foule, réservations). */
  readonly capacity: number;
}

function tpl(
  type: VenueType,
  label: string,
  districts: readonly DistrictKind[],
  openHour: number,
  closeHour: number,
  rooms: readonly string[],
  priceLevel: 0 | 1 | 2 | 3 | 4,
  densityPerMillion: number,
  extras: Partial<
    Pick<VenueTemplate, 'openWeekends' | 'enterable' | 'minPerCity' | 'minCityTier' | 'volatile' | 'capacity'>
  > = {},
): VenueTemplate {
  return {
    type,
    label,
    districts,
    openHour,
    closeHour,
    rooms,
    priceLevel,
    densityPerMillion,
    openWeekends: extras.openWeekends ?? true,
    enterable: extras.enterable ?? true,
    minPerCity: extras.minPerCity ?? 1,
    minCityTier: extras.minCityTier ?? 3,
    volatile: extras.volatile ?? false,
    capacity: extras.capacity ?? 60,
  };
}

export const VENUE_TEMPLATES: readonly VenueTemplate[] = [
  tpl('shop', 'Boutique', ['centre', 'populaire', 'historique', 'residentiel'], 9, 20,
    ['surface de vente', 'cabines d’essayage', 'caisse', 'réserve'], 2, 26, { minPerCity: 4, volatile: true }),
  tpl('officialStore', 'Boutique officielle', ['centre', 'luxe', 'affaires'], 10, 20,
    ['showroom', 'espace personnalisation', 'salon VIP', 'caisse'], 3, 3, { minPerCity: 1, minCityTier: 2 }),
  tpl('popupStore', 'Pop-up store', ['centre', 'luxe', 'nuit'], 11, 21,
    ['espace éphémère', 'comptoir'], 3, 2, { minPerCity: 0, volatile: true, minCityTier: 2 }),
  tpl('mall', 'Centre commercial', ['centre', 'affaires', 'residentiel'], 10, 21,
    ['galerie principale', 'food court', 'parking', 'cinéma intégré', 'toilettes'], 2, 1.4,
    { minPerCity: 1, capacity: 900 }),
  tpl('dealership', 'Concessionnaire', ['affaires', 'industriel', 'centre'], 9, 19,
    ['showroom', 'bureau de configuration', 'atelier', 'piste d’essai'], 4, 1.2,
    { minPerCity: 1, openWeekends: false }),
  tpl('bank', 'Agence bancaire', ['affaires', 'centre'], 9, 17,
    ['accueil', 'bureau conseiller', 'salle des coffres'], 1, 2.2, { openWeekends: false }),
  tpl('market', 'Marché', ['populaire', 'historique', 'centre'], 6, 14,
    ['allées', 'étals', 'buvette'], 1, 1.6, { capacity: 400 }),

  tpl('restaurant', 'Restaurant', ['centre', 'historique', 'luxe', 'plage', 'port', 'nuit'], 12, 23,
    ['salle', 'terrasse', 'cuisine visible', 'salon privé'], 3, 22, { minPerCity: 5, volatile: true, capacity: 90 }),
  tpl('cafe', 'Café', ['centre', 'populaire', 'universitaire', 'historique'], 7, 20,
    ['comptoir', 'salle', 'terrasse'], 1, 30, { minPerCity: 6, volatile: true, capacity: 50 }),
  tpl('nightclub', 'Club', ['nuit', 'luxe', 'port'], 23, 5,
    ['entrée', 'piste', 'carré VIP', 'fumoir'], 4, 2.2, { minPerCity: 1, minCityTier: 2, capacity: 500 }),

  tpl('hotel', 'Hôtel', ['centre', 'affaires', 'plage', 'luxe', 'montagne'], 0, 24,
    ['réception', 'chambre', 'suite', 'restaurant', 'spa', 'salle de sport', 'parking'], 3, 6,
    { minPerCity: 3, capacity: 300 }),
  tpl('apartment', 'Appartement', ['centre', 'residentiel', 'populaire'], 0, 24,
    ['entrée', 'séjour', 'chambre', 'cuisine', 'balcon'], 2, 12, { minPerCity: 5, capacity: 6 }),
  tpl('villa', 'Villa', ['luxe', 'plage', 'residentiel'], 0, 24,
    ['hall', 'séjour', 'cuisine', 'chambres', 'piscine', 'jardin', 'garage', 'salle des trophées'], 4, 3,
    { minPerCity: 2, capacity: 20 }),
  tpl('penthouse', 'Penthouse', ['luxe', 'affaires'], 0, 24,
    ['ascenseur privé', 'séjour panoramique', 'terrasse', 'chambre principale', 'salle des trophées'], 4, 1.2,
    { minPerCity: 1, minCityTier: 2, capacity: 12 }),
  tpl('chalet', 'Chalet', ['montagne'], 0, 24,
    ['séjour cheminée', 'chambres', 'sauna', 'local à skis'], 4, 4, { minPerCity: 0, capacity: 12 }),
  tpl('privateIsland', 'Île privée', ['plage'], 0, 24,
    ['ponton', 'résidence principale', 'plage privée', 'héliport'], 4, 0.05, { minPerCity: 0, capacity: 25 }),
  tpl('garage', 'Garage', ['residentiel', 'luxe', 'industriel'], 0, 24,
    ['plateau véhicules', 'atelier', 'vitrine'], 2, 4, { minPerCity: 2, capacity: 30 }),

  tpl('museum', 'Musée', ['historique', 'centre'], 10, 18,
    ['hall', 'salles d’exposition', 'boutique', 'café', 'auditorium'], 1, 2, { minPerCity: 1, capacity: 300 }),
  tpl('personalMuseum', 'Musée personnel', ['historique', 'centre', 'luxe'], 10, 19,
    ['hall d’entrée', 'galerie des trophées', 'galerie des maillots', 'salle vidéo', 'boutique', 'livre d’or'], 2, 0,
    { minPerCity: 0, capacity: 250 }),
  tpl('cinema', 'Cinéma', ['centre', 'residentiel'], 11, 24,
    ['hall', 'salles', 'confiserie'], 2, 2.4, { minPerCity: 1, capacity: 400 }),
  tpl('concertHall', 'Salle de concert', ['centre', 'nuit'], 18, 24,
    ['parterre', 'balcon', 'backstage', 'bar'], 3, 1.1, { minPerCity: 1, minCityTier: 2, capacity: 4000 }),
  tpl('festivalGround', 'Site de festival', ['plage', 'centre', 'universitaire'], 14, 26,
    ['scène principale', 'scène découverte', 'village food'], 2, 0.6, { minPerCity: 0, volatile: true, capacity: 20000 }),
  tpl('themePark', 'Parc d’attractions', ['residentiel', 'plage'], 10, 21,
    ['entrée', 'attractions', 'restauration', 'boutique souvenirs'], 3, 0.35, { minPerCity: 0, minCityTier: 2, capacity: 15000 }),
  tpl('library', 'Bibliothèque', ['universitaire', 'centre'], 9, 19,
    ['salle de lecture', 'archives'], 0, 1.4, { openWeekends: false }),
  tpl('artGallery', 'Galerie d’art', ['luxe', 'historique'], 11, 19,
    ['salle blanche', 'réserve', 'bureau du galeriste'], 4, 1.5, { minPerCity: 1, minCityTier: 2 }),

  tpl('stadium', 'Stade', ['sportif'], 0, 24,
    ['tribunes', 'loges VIP', 'vestiaires', 'tunnel', 'salle de presse', 'salle des trophées',
     'restaurants', 'boutiques', 'zones techniques', 'parkings', 'musée du club'], 2, 0.5,
    { minPerCity: 1, capacity: 70000 }),
  tpl('trainingCentre', 'Centre d’entraînement', ['sportif', 'residentiel'], 7, 19,
    ['terrains', 'salle de musculation', 'centre médical', 'laboratoire de performance',
     'espaces de récupération', 'réfectoire', 'salle vidéo'], 1, 0.5, { minPerCity: 1, capacity: 200 }),
  tpl('academy', 'Académie', ['sportif', 'residentiel'], 8, 19,
    ['terrains jeunes', 'internat', 'salle de classe', 'infirmerie'], 1, 0.4, { minPerCity: 1, capacity: 300 }),
  tpl('gym', 'Salle de sport', ['residentiel', 'centre', 'universitaire'], 6, 23,
    ['plateau cardio', 'zone poids libres', 'vestiaires', 'sauna'], 2, 6, { minPerCity: 2, capacity: 120 }),
  tpl('pool', 'Piscine', ['residentiel', 'sportif'], 7, 21,
    ['bassin', 'vestiaires', 'solarium'], 1, 2, { minPerCity: 1, capacity: 200 }),
  tpl('sportsCourt', 'Terrain multisport', ['residentiel', 'populaire', 'universitaire'], 7, 22,
    ['terrain', 'gradins'], 0, 6, { minPerCity: 3, capacity: 60 }),
  tpl('tennisClub', 'Club de tennis', ['residentiel', 'luxe'], 8, 21,
    ['courts', 'club house', 'vestiaires'], 3, 1.6, { minPerCity: 1, capacity: 80 }),
  tpl('golfCourse', 'Golf', ['luxe', 'residentiel'], 7, 19,
    ['parcours', 'club house', 'practice', 'pro shop'], 4, 0.5, { minPerCity: 0, capacity: 120 }),
  tpl('kartingTrack', 'Karting', ['industriel', 'residentiel'], 10, 22,
    ['piste', 'stand', 'salle de briefing'], 2, 0.7, { minPerCity: 0, capacity: 60 }),
  tpl('bowlingAlley', 'Bowling', ['residentiel', 'nuit'], 12, 24,
    ['pistes', 'bar', 'salle d’arcade'], 2, 0.9, { minPerCity: 0, capacity: 120 }),
  tpl('billiardsHall', 'Salle de billard', ['nuit', 'populaire'], 14, 26,
    ['tables', 'bar'], 1, 0.9, { minPerCity: 0, capacity: 60 }),
  tpl('streetPitch', 'Terrain de quartier', ['populaire', 'residentiel'], 0, 24,
    ['terrain', 'banc'], 0, 9, { minPerCity: 4, capacity: 30 }),
  tpl('skiResort', 'Station de ski', ['montagne'], 8, 17,
    ['télécabine', 'pistes', 'restaurant d’altitude', 'location de matériel'], 3, 2, { minPerCity: 0, capacity: 5000 }),
  tpl('surfSchool', 'École de surf', ['plage'], 8, 19,
    ['accueil', 'local à planches', 'douches'], 2, 1.6, { minPerCity: 0, capacity: 40 }),
  tpl('divingCentre', 'Centre de plongée', ['plage', 'port'], 8, 18,
    ['accueil', 'local bouteilles', 'bateau'], 3, 1.1, { minPerCity: 0, capacity: 30 }),
  tpl('trailhead', 'Départ de randonnée', ['montagne'], 0, 24,
    ['parking', 'panneau d’information'], 0, 2, { minPerCity: 0, capacity: 40 }),
  tpl('bungeeSite', 'Site de saut à l’élastique', ['montagne', 'port'], 9, 18,
    ['plateforme', 'poste de sécurité'], 3, 0.3, { minPerCity: 0, capacity: 20 }),
  tpl('balloonField', 'Base de montgolfières', ['residentiel', 'montagne'], 5, 11,
    ['aire de gonflage', 'hangar'], 3, 0.25, { minPerCity: 0, capacity: 30 }),
  tpl('natureReserve', 'Réserve naturelle', ['montagne', 'residentiel'], 6, 19,
    ['centre d’accueil', 'pistes de safari', 'observatoire'], 3, 0.2, { minPerCity: 0, capacity: 200 }),
  tpl('spa', 'Spa', ['luxe', 'plage', 'montagne'], 9, 21,
    ['réception', 'cabines', 'hammam', 'espace détente'], 4, 1.5, { minPerCity: 0, capacity: 40 }),

  tpl('airport', 'Aéroport', ['industriel', 'centre'], 0, 24,
    ['hall des départs', 'enregistrement', 'contrôle', 'salon VIP', 'portes d’embarquement',
     'livraison des bagages', 'terminal jets privés', 'parking'], 2, 0.2, { minPerCity: 1, capacity: 20000 }),
  tpl('trainStation', 'Gare', ['centre', 'affaires'], 5, 24,
    ['hall', 'quais', 'commerces', 'salon première classe'], 1, 0.6, { minPerCity: 1, capacity: 6000 }),
  tpl('metroStation', 'Station de métro', ['centre', 'affaires', 'residentiel', 'populaire'], 5, 25,
    ['mezzanine', 'quais'], 0, 8, { minPerCity: 0, minCityTier: 1, capacity: 2000 }),
  tpl('busStation', 'Gare routière', ['populaire', 'centre'], 5, 24,
    ['quais', 'guichets'], 0, 1.2, { minPerCity: 1, capacity: 1200 }),
  tpl('heliport', 'Héliport', ['affaires', 'luxe', 'port'], 7, 21,
    ['aire de poser', 'salon d’attente'], 4, 0.3, { minPerCity: 0, minCityTier: 2, capacity: 20 }),
  tpl('marina', 'Marina', ['port', 'plage'], 6, 22,
    ['pontons', 'capitainerie', 'club nautique'], 4, 0.8, { minPerCity: 0, capacity: 400 }),
  tpl('airfield', 'Aérodrome', ['industriel', 'residentiel'], 8, 19,
    ['hangar', 'piste', 'salle de briefing'], 3, 0.3, { minPerCity: 0, capacity: 60 }),

  tpl('park', 'Parc', ['residentiel', 'centre', 'universitaire'], 6, 22,
    ['allées', 'aire de jeux', 'kiosque'], 0, 5, { minPerCity: 2, capacity: 1500 }),
  // Une ville côtière possède toujours au moins une plage accessible, même
  // lorsque sa population est trop faible pour en générer par densité.
  tpl('beach', 'Plage', ['plage'], 0, 24,
    ['sable', 'poste de secours', 'buvette'], 0, 4, { minPerCity: 1, capacity: 5000 }),
  tpl('square', 'Place publique', ['centre', 'historique', 'populaire'], 0, 24,
    ['esplanade', 'fontaine'], 0, 4, { minPerCity: 2, capacity: 3000 }),
  tpl('fanZone', 'Fan zone', ['centre', 'sportif'], 12, 24,
    ['écran géant', 'stands souvenirs', 'scène', 'espace mini-jeux'], 1, 0.5,
    { minPerCity: 0, volatile: true, capacity: 12000 }),

  tpl('hospital', 'Hôpital', ['residentiel', 'centre'], 0, 24,
    ['urgences', 'imagerie', 'chambres', 'bloc'], 1, 1.2, { minPerCity: 1, capacity: 800 }),
  tpl('school', 'École', ['residentiel', 'populaire'], 8, 17,
    ['cour', 'salles de classe', 'gymnase'], 0, 4, { openWeekends: false, capacity: 600 }),
  tpl('townHall', 'Hôtel de ville', ['centre', 'historique'], 8, 17,
    ['salle des mariages', 'bureaux', 'salle du conseil'], 0, 0.4, { openWeekends: false, capacity: 300 }),
  tpl('mediaHouse', 'Maison des médias', ['affaires', 'centre'], 6, 24,
    ['plateaux TV', 'régie', 'studio radio', 'salle de rédaction'], 2, 0.6, { minPerCity: 1, minCityTier: 2, capacity: 300 }),
  tpl('clubHeadquarters', 'Siège du club', ['affaires', 'sportif'], 9, 18,
    ['accueil', 'salle du conseil', 'bureau présidentiel', 'salle de négociation'], 2, 0.4,
    { openWeekends: false, capacity: 120 }),
  tpl('socialHub', 'Hub social', ['centre', 'nuit', 'sportif'], 0, 24,
    ['salon principal', 'garage d’exposition', 'écran de matchs', 'terrasse'], 1, 0.4,
    { minPerCity: 1, minCityTier: 2, capacity: 200 }),
  tpl('foundation', 'Fondation', ['centre', 'residentiel'], 9, 18,
    ['accueil', 'bureaux', 'salle de projets'], 0, 0.2, { minPerCity: 0, openWeekends: false, capacity: 80 }),
] as const;

const TEMPLATE_INDEX = new Map(VENUE_TEMPLATES.map((t) => [t.type, t]));

export function getVenueTemplate(type: VenueType): VenueTemplate {
  const template = TEMPLATE_INDEX.get(type);
  if (!template) throw new Error(`Type de lieu inconnu : "${type}"`);
  return template;
}

export function venueTypesForDistrict(kind: DistrictKind): VenueTemplate[] {
  return VENUE_TEMPLATES.filter((t) => t.districts.length === 0 || t.districts.includes(kind));
}

/** Un lieu est-il ouvert à l'heure donnée ? Gère les horaires à cheval sur minuit. */
export function isOpenAt(template: VenueTemplate, hour: number, weekday: number): boolean {
  if (!template.openWeekends && weekday >= 5) return false;
  const open = template.openHour;
  const close = template.closeHour;
  if (close >= 24 && open === 0) return true;
  if (close > open) return hour >= open && hour < close;
  // Horaires nocturnes : 23h → 5h.
  return hour >= open || hour < close % 24;
}
