/**
 * world.js — Données du monde ouvert.
 *
 * Sources : Tome II (Open World), Tome XIX (événements), Tome XXIX (stades),
 * Tome XXX v1 et v2 (pays, villes, transports, activités, vacances).
 *
 * Toutes les entités sont fictives ou génériques : aucune marque, aucun club
 * et aucune personne réelle ne sont utilisés. Le Tome XXIV prévoit que de
 * vraies licences puissent être branchées ultérieurement — la structure de
 * données est prête pour cela (champ `licensed`).
 *
 * Chaque type de lieu prévu par le Tome II ch. 1.3 est représenté, et chaque
 * lieu porte un indicateur `enterable` : « le joueur doit pouvoir entrer dans
 * la majorité des lieux importants ».
 */

/** Catégories de lieux visitables — Tome II ch. 1.3, Tome XXX ch. 2. */
export const VENUE_TYPES = {
  stade: { label: 'Stade', icon: '🏟️', enterable: true },
  centre: { label: "Centre d'entraînement", icon: '⚽', enterable: true },
  academie: { label: 'Académie', icon: '🎓', enterable: true },
  boutique: { label: 'Boutique', icon: '🛍️', enterable: true },
  centreCommercial: { label: 'Centre commercial', icon: '🏬', enterable: true },
  restaurant: { label: 'Restaurant', icon: '🍽️', enterable: true },
  cafe: { label: 'Café', icon: '☕', enterable: true },
  hotel: { label: 'Hôtel', icon: '🏨', enterable: true },
  musee: { label: 'Musée', icon: '🖼️', enterable: true },
  cinema: { label: 'Cinéma', icon: '🎬', enterable: true },
  aeroport: { label: 'Aéroport', icon: '✈️', enterable: true },
  gare: { label: 'Gare', icon: '🚆', enterable: true },
  port: { label: 'Port de plaisance', icon: '⛵', enterable: true },
  concession: { label: 'Concessionnaire', icon: '🚗', enterable: true },
  garage: { label: 'Garage', icon: '🔧', enterable: true },
  residence: { label: 'Résidence', icon: '🏠', enterable: true },
  plage: { label: 'Plage', icon: '🏖️', enterable: true },
  parc: { label: 'Parc', icon: '🌳', enterable: true },
  montagne: { label: 'Station de montagne', icon: '🏔️', enterable: true },
  hub: { label: 'Hub social', icon: '👥', enterable: true },
  fanzone: { label: 'Fan zone', icon: '🎪', enterable: true },
  salle: { label: 'Salle de sport', icon: '🏋️', enterable: true },
  clinique: { label: 'Centre médical', icon: '🏥', enterable: true },
  studio: { label: 'Studio TV', icon: '📺', enterable: true },
};

/**
 * Pays. Chaque pays porte sa monnaie, sa culture, son climat et son
 * multiplicateur de coût de la vie (utilisé par l'économie, Tome XXIII).
 */
export const COUNTRIES = [
  { id: 'ml', name: 'Mali', currency: 'FCFA', continent: 'Afrique', climate: 'sahélien', costIndex: 0.55, footballPassion: 88, language: 'français' },
  { id: 'fr', name: 'France', currency: 'EUR', continent: 'Europe', climate: 'tempéré', costIndex: 1.15, footballPassion: 90, language: 'français' },
  { id: 'gb', name: 'Royaume-Uni', currency: 'GBP', continent: 'Europe', climate: 'océanique', costIndex: 1.3, footballPassion: 97, language: 'anglais' },
  { id: 'es', name: 'Espagne', currency: 'EUR', continent: 'Europe', climate: 'méditerranéen', costIndex: 0.95, footballPassion: 95, language: 'espagnol' },
  { id: 'it', name: 'Italie', currency: 'EUR', continent: 'Europe', climate: 'méditerranéen', costIndex: 1.0, footballPassion: 93, language: 'italien' },
  { id: 'de', name: 'Allemagne', currency: 'EUR', continent: 'Europe', climate: 'continental', costIndex: 1.1, footballPassion: 92, language: 'allemand' },
  { id: 'pt', name: 'Portugal', currency: 'EUR', continent: 'Europe', climate: 'méditerranéen', costIndex: 0.85, footballPassion: 91, language: 'portugais' },
  { id: 'nl', name: 'Pays-Bas', currency: 'EUR', continent: 'Europe', climate: 'océanique', costIndex: 1.15, footballPassion: 87, language: 'néerlandais' },
  { id: 'br', name: 'Brésil', currency: 'BRL', continent: 'Amérique du Sud', climate: 'tropical', costIndex: 0.7, footballPassion: 99, language: 'portugais' },
  { id: 'ar', name: 'Argentine', currency: 'ARS', continent: 'Amérique du Sud', climate: 'tempéré', costIndex: 0.6, footballPassion: 98, language: 'espagnol' },
  { id: 'us', name: 'États-Unis', currency: 'USD', continent: 'Amérique du Nord', climate: 'varié', costIndex: 1.35, footballPassion: 64, language: 'anglais' },
  { id: 'jp', name: 'Japon', currency: 'JPY', continent: 'Asie', climate: 'tempéré humide', costIndex: 1.2, footballPassion: 76, language: 'japonais' },
  { id: 'ae', name: 'Émirats arabes unis', currency: 'AED', continent: 'Asie', climate: 'désertique', costIndex: 1.25, footballPassion: 72, language: 'arabe' },
  { id: 'qa', name: 'Qatar', currency: 'QAR', continent: 'Asie', climate: 'désertique', costIndex: 1.2, footballPassion: 74, language: 'arabe' },
  { id: 'ma', name: 'Maroc', currency: 'MAD', continent: 'Afrique', climate: 'méditerranéen', costIndex: 0.6, footballPassion: 92, language: 'arabe' },
  { id: 'sn', name: 'Sénégal', currency: 'FCFA', continent: 'Afrique', climate: 'sahélien', costIndex: 0.55, footballPassion: 90, language: 'français' },
  { id: 'ci', name: "Côte d'Ivoire", currency: 'FCFA', continent: 'Afrique', climate: 'tropical', costIndex: 0.58, footballPassion: 89, language: 'français' },
  { id: 'ch', name: 'Suisse', currency: 'CHF', continent: 'Europe', climate: 'alpin', costIndex: 1.6, footballPassion: 70, language: 'français' },
  { id: 'mv', name: 'Maldives', currency: 'MVR', continent: 'Asie', climate: 'tropical', costIndex: 1.4, footballPassion: 45, language: 'dhivehi' },
  { id: 'za', name: 'Afrique du Sud', currency: 'ZAR', continent: 'Afrique', climate: 'subtropical', costIndex: 0.7, footballPassion: 80, language: 'anglais' },
];

/**
 * Villes. `hub` marque les hubs sociaux multijoueur (Tome X ch. 2).
 * `venues` liste les lieux visitables ; chacun devient une destination réelle
 * du système de déplacement.
 */
export const CITIES = [
  {
    id: 'bamako', name: 'Bamako', country: 'ml', lat: 12.64, lon: -8.0,
    population: 2800000, hub: true, tags: ['origine', 'fleuve', 'marché'],
    description: "Capitale animée sur les rives du fleuve Niger, terre d'origine du projet.",
    venues: [
      { id: 'stade-26mars', name: 'Stade du 26-Mars', type: 'stade', capacity: 50000, prestige: 62 },
      { id: 'centre-bamako', name: "Centre d'entraînement de Kalaban", type: 'centre' },
      { id: 'academie-niger', name: 'Académie du Niger', type: 'academie' },
      { id: 'marche-rose', name: 'Grand Marché Rose', type: 'centreCommercial' },
      { id: 'resto-djoliba', name: 'Le Djoliba', type: 'restaurant', cuisine: 'malienne', price: 2 },
      { id: 'cafe-badala', name: 'Café Badalabougou', type: 'cafe', price: 1 },
      { id: 'hotel-niger', name: 'Hôtel du Fleuve', type: 'hotel', stars: 4, nightly: 120 },
      { id: 'musee-bamako', name: 'Musée National', type: 'musee' },
      { id: 'aeroport-bko', name: 'Aéroport Bamako-Sénou', type: 'aeroport', code: 'BKO' },
      { id: 'hub-bamako', name: 'Hub Niger Riverside', type: 'hub' },
      { id: 'parc-national-ml', name: 'Parc National du Mali', type: 'parc' },
      { id: 'concession-bko', name: 'Sahel Motors', type: 'concession' },
    ],
  },
  {
    id: 'paris', name: 'Paris', country: 'fr', lat: 48.86, lon: 2.35,
    population: 2100000, hub: true, tags: ['mode', 'capitale', 'gastronomie'],
    description: "Capitale de la mode et scène récurrente des grandes cérémonies.",
    venues: [
      { id: 'stade-lumiere', name: 'Stade Lumière', type: 'stade', capacity: 68000, prestige: 88 },
      { id: 'centre-seine', name: 'Campus Seine', type: 'centre' },
      { id: 'galerie-royale', name: 'Galerie Royale', type: 'centreCommercial' },
      { id: 'resto-atelier', name: "L'Atelier des Halles", type: 'restaurant', cuisine: 'française', price: 4 },
      { id: 'hotel-opera', name: 'Grand Hôtel Opéra', type: 'hotel', stars: 5, nightly: 780 },
      { id: 'musee-paris', name: "Musée du Football Européen", type: 'musee' },
      { id: 'aeroport-cdg', name: 'Aéroport Charles-le-Grand', type: 'aeroport', code: 'CDG' },
      { id: 'gare-nord', name: 'Gare du Nord', type: 'gare' },
      { id: 'concession-paris', name: 'Prestige Automobiles Paris', type: 'concession' },
      { id: 'hub-paris', name: 'Hub Rive Gauche', type: 'hub' },
      { id: 'studio-paris', name: 'Studio Canal Sport', type: 'studio' },
      { id: 'cinema-paris', name: 'Cinéma Le Panthéon', type: 'cinema' },
    ],
  },
  {
    id: 'londres', name: 'Londres', country: 'gb', lat: 51.51, lon: -0.13,
    population: 9000000, hub: true, tags: ['football', 'finance', 'pluie'],
    description: "Le cœur historique du football moderne, ferveur permanente.",
    venues: [
      { id: 'stade-crown', name: 'Crown Park Stadium', type: 'stade', capacity: 74000, prestige: 94 },
      { id: 'stade-eastend', name: 'East End Ground', type: 'stade', capacity: 42000, prestige: 78 },
      { id: 'centre-londres', name: 'Riverside Training Complex', type: 'centre' },
      { id: 'boutique-kings', name: "King's Road Store", type: 'boutique' },
      { id: 'hotel-mayfair', name: 'Mayfair Residence', type: 'hotel', stars: 5, nightly: 920 },
      { id: 'musee-londres', name: 'Hall of Fame Museum', type: 'musee' },
      { id: 'aeroport-lhr', name: 'Aéroport Londres-Ouest', type: 'aeroport', code: 'LHR' },
      { id: 'hub-londres', name: 'Hub Thames Side', type: 'hub' },
      { id: 'salle-londres', name: 'Elite Performance Gym', type: 'salle' },
      { id: 'resto-londres', name: 'The Terrace Grill', type: 'restaurant', cuisine: 'britannique', price: 3 },
      { id: 'cafe-londres', name: 'Corner House Coffee', type: 'cafe', price: 2 },
      { id: 'centreco-londres', name: 'Westgate Galleries', type: 'centreCommercial' },
      { id: 'cinema-londres', name: 'Odeon Riverside', type: 'cinema' },
      { id: 'gare-londres', name: 'King\'s Cross Station', type: 'gare' },
      { id: 'concession-londres', name: 'Belgravia Motors', type: 'concession' },
      { id: 'parc-londres', name: 'Regent\'s Park', type: 'parc' },
      { id: 'academie-londres', name: 'Crown Park Academy', type: 'academie' },
      { id: 'clinique-londres', name: 'Harley Sports Clinic', type: 'clinique' },
      { id: 'studio-londres', name: 'BBC Sport Studios', type: 'studio' },
      { id: 'residence-londres', name: 'Chelsea Townhouses', type: 'residence' },
    ],
  },
  {
    id: 'madrid', name: 'Madrid', country: 'es', lat: 40.42, lon: -3.7,
    population: 3300000, hub: true, tags: ['football', 'soleil', 'nuit'],
    description: "Ville où le football se vit jusque tard dans la nuit.",
    venues: [
      { id: 'stade-corona', name: 'Estadio Corona', type: 'stade', capacity: 81000, prestige: 96 },
      { id: 'centre-madrid', name: 'Ciudad Deportiva', type: 'centre' },
      { id: 'academie-madrid', name: 'Cantera Corona', type: 'academie' },
      { id: 'boutique-gran-via', name: 'Gran Vía Flagship', type: 'boutique' },
      { id: 'hotel-madrid', name: 'Palacio Real Hotel', type: 'hotel', stars: 5, nightly: 640 },
      { id: 'aeroport-mad', name: 'Aéroport Madrid-Centro', type: 'aeroport', code: 'MAD' },
      { id: 'hub-madrid', name: 'Hub Retiro', type: 'hub' },
      { id: 'resto-madrid', name: 'Casa Ibérica', type: 'restaurant', cuisine: 'espagnole', price: 3 },
      { id: 'musee-madrid', name: 'Museo del Trofeo', type: 'musee' },
      { id: 'cafe-madrid', name: 'Café de la Plaza', type: 'cafe', price: 1 },
      { id: 'centreco-madrid', name: 'Centro Comercial Sol', type: 'centreCommercial' },
      { id: 'cinema-madrid', name: 'Cines Callao', type: 'cinema' },
      { id: 'parc-madrid', name: 'Parque del Retiro', type: 'parc' },
      { id: 'concession-madrid', name: 'Ibérica Motor', type: 'concession' },
      { id: 'salle-madrid', name: 'Gimnasio Élite', type: 'salle' },
      { id: 'gare-madrid', name: 'Estación Atocha', type: 'gare' },
      { id: 'residence-madrid', name: 'Villas de La Moraleja', type: 'residence' },
    ],
  },
  {
    id: 'milan', name: 'Milan', country: 'it', lat: 45.46, lon: 9.19,
    population: 1400000, hub: true, tags: ['mode', 'design', 'derby'],
    description: "Capitale du design et théâtre de derbys légendaires.",
    venues: [
      { id: 'stade-scala', name: 'Arena della Scala', type: 'stade', capacity: 76000, prestige: 91 },
      { id: 'boutique-montenapo', name: 'Via Montenapo Atelier', type: 'boutique' },
      { id: 'hotel-milan', name: 'Duomo Suites', type: 'hotel', stars: 5, nightly: 700 },
      { id: 'concession-milan', name: 'Corsa Motori', type: 'concession' },
      { id: 'aeroport-mxp', name: 'Aéroport Milan-Nord', type: 'aeroport', code: 'MXP' },
      { id: 'hub-milan', name: 'Hub Navigli', type: 'hub' },
      { id: 'resto-milan', name: 'Trattoria del Ponte', type: 'restaurant', cuisine: 'italienne', price: 3 },
      { id: 'cafe-milan', name: 'Caffè della Scala', type: 'cafe', price: 2 },
      { id: 'centreco-milan', name: 'Galleria Centrale', type: 'centreCommercial' },
      { id: 'musee-milan', name: 'Museo del Calcio', type: 'musee' },
      { id: 'centre-milan', name: 'Centro Sportivo Scala', type: 'centre' },
      { id: 'academie-milan', name: 'Settore Giovanile', type: 'academie' },
      { id: 'cinema-milan', name: 'Cinema Centrale', type: 'cinema' },
      { id: 'gare-milan', name: 'Stazione Centrale', type: 'gare' },
      { id: 'parc-milan', name: 'Parco Sempione', type: 'parc' },
    ],
  },
  {
    id: 'munich', name: 'Munich', country: 'de', lat: 48.14, lon: 11.58,
    population: 1500000, hub: false, tags: ['rigueur', 'bière', 'alpes'],
    description: "Organisation exemplaire, stades pleins et Alpes à une heure.",
    venues: [
      { id: 'stade-alpen', name: 'Alpen Arena', type: 'stade', capacity: 70000, prestige: 90 },
      { id: 'centre-munich', name: 'Leistungszentrum', type: 'centre' },
      { id: 'hotel-munich', name: 'Bayern Grand', type: 'hotel', stars: 5, nightly: 520 },
      { id: 'aeroport-muc', name: 'Aéroport Munich-Sud', type: 'aeroport', code: 'MUC' },
      { id: 'montagne-munich', name: 'Station Alpenblick', type: 'montagne' },
      { id: 'resto-munich', name: 'Bierhaus am Markt', type: 'restaurant', cuisine: 'allemande', price: 2 },
      { id: 'cafe-munich', name: 'Café Marienplatz', type: 'cafe', price: 2 },
      { id: 'musee-munich', name: 'Sportmuseum München', type: 'musee' },
      { id: 'academie-munich', name: 'Nachwuchsakademie', type: 'academie' },
      { id: 'centreco-munich', name: 'Olympia Einkaufszentrum', type: 'centreCommercial' },
      { id: 'gare-munich', name: 'Hauptbahnhof', type: 'gare' },
      { id: 'parc-munich', name: 'Englischer Garten', type: 'parc' },
      { id: 'clinique-munich', name: 'Sportklinik München', type: 'clinique' },
    ],
  },
  {
    id: 'lisbonne', name: 'Lisbonne', country: 'pt', lat: 38.72, lon: -9.14,
    population: 550000, hub: false, tags: ['tramway', 'océan', 'formation'],
    description: "Formation d'excellence, lumière atlantique et collines.",
    venues: [
      { id: 'stade-atlantico', name: 'Estádio Atlântico', type: 'stade', capacity: 58000, prestige: 84 },
      { id: 'academie-lisbonne', name: 'Academia do Tejo', type: 'academie' },
      { id: 'plage-cascais', name: 'Plage de Cascais', type: 'plage' },
      { id: 'aeroport-lis', name: 'Aéroport Lisbonne', type: 'aeroport', code: 'LIS' },
      { id: 'resto-lisbonne', name: 'Taberna do Mar', type: 'restaurant', cuisine: 'portugaise', price: 2 },
      { id: 'cafe-lisbonne', name: 'Café A Brasileira', type: 'cafe', price: 1 },
      { id: 'hotel-lisbonne', name: 'Pousada do Tejo', type: 'hotel', stars: 4, nightly: 260 },
      { id: 'centre-lisbonne', name: 'Centro de Treino Atlântico', type: 'centre' },
      { id: 'musee-lisbonne', name: 'Museu do Futebol', type: 'musee' },
      { id: 'boutique-lisbonne', name: 'Loja do Clube', type: 'boutique' },
      { id: 'parc-lisbonne', name: 'Parque Eduardo VII', type: 'parc' },
      { id: 'gare-lisbonne', name: 'Estação do Oriente', type: 'gare' },
    ],
  },
  {
    id: 'amsterdam', name: 'Amsterdam', country: 'nl', lat: 52.37, lon: 4.9,
    population: 900000, hub: false, tags: ['canaux', 'vélo', 'jeunesse'],
    description: "Le laboratoire du football total, ville à vélo.",
    venues: [
      { id: 'stade-kanaal', name: 'Kanaal Arena', type: 'stade', capacity: 54000, prestige: 82 },
      { id: 'academie-amsterdam', name: 'Toekomst Academy', type: 'academie' },
      { id: 'aeroport-ams', name: 'Aéroport Amsterdam', type: 'aeroport', code: 'AMS' },
      { id: 'musee-amsterdam', name: 'Museum van de Sport', type: 'musee' },
      { id: 'centre-amsterdam', name: 'Trainingscomplex Kanaal', type: 'centre' },
      { id: 'hotel-amsterdam', name: 'Grachten Hotel', type: 'hotel', stars: 4, nightly: 340 },
      { id: 'resto-amsterdam', name: 'De Kade', type: 'restaurant', cuisine: 'néerlandaise', price: 3 },
      { id: 'cafe-amsterdam', name: 'Bruin Café', type: 'cafe', price: 2 },
      { id: 'boutique-amsterdam', name: 'Kalverstraat Store', type: 'boutique' },
      { id: 'parc-amsterdam', name: 'Vondelpark', type: 'parc' },
      { id: 'gare-amsterdam', name: 'Amsterdam Centraal', type: 'gare' },
      { id: 'cinema-amsterdam', name: 'Tuschinski Cinema', type: 'cinema' },
    ],
  },
  {
    id: 'rio', name: 'Rio de Janeiro', country: 'br', lat: -22.91, lon: -43.17,
    population: 6700000, hub: true, tags: ['plage', 'carnaval', 'futebol'],
    description: "Le football se joue sur le sable avant de se jouer sur la pelouse.",
    venues: [
      { id: 'stade-costa', name: 'Estádio da Costa', type: 'stade', capacity: 82000, prestige: 89 },
      { id: 'plage-copaquara', name: 'Plage de Copaquara', type: 'plage' },
      { id: 'academie-rio', name: 'Escolinha do Morro', type: 'academie' },
      { id: 'aeroport-gig', name: 'Aéroport Rio-Atlantique', type: 'aeroport', code: 'GIG' },
      { id: 'hub-rio', name: 'Hub Praia', type: 'hub' },
      { id: 'resto-rio', name: 'Churrascaria Central', type: 'restaurant', cuisine: 'brésilienne', price: 2 },
      { id: 'cafe-rio', name: 'Café Ipanema', type: 'cafe', price: 1 },
      { id: 'hotel-rio', name: 'Hotel Praia Grande', type: 'hotel', stars: 5, nightly: 420 },
      { id: 'centre-rio', name: 'Centro de Treinamento Costa', type: 'centre' },
      { id: 'musee-rio', name: 'Museu do Futebol Brasileiro', type: 'musee' },
      { id: 'centreco-rio', name: 'Shopping Barra', type: 'centreCommercial' },
      { id: 'parc-rio', name: 'Parque da Floresta', type: 'parc' },
      { id: 'port-rio', name: 'Marina da Glória', type: 'port' },
      { id: 'concession-rio', name: 'Rio Motors', type: 'concession' },
    ],
  },
  {
    id: 'buenos-aires', name: 'Buenos Aires', country: 'ar', lat: -34.6, lon: -58.38,
    population: 3100000, hub: false, tags: ['passion', 'tango', 'chaudron'],
    description: "L'atmosphère la plus bruyante du monde selon les commentateurs.",
    venues: [
      { id: 'stade-caldera', name: 'La Caldera', type: 'stade', capacity: 64000, prestige: 87 },
      { id: 'aeroport-eze', name: 'Aéroport Buenos Aires', type: 'aeroport', code: 'EZE' },
      { id: 'resto-ba', name: 'Parrilla del Sur', type: 'restaurant', cuisine: 'argentine', price: 2 },
      { id: 'cafe-ba', name: 'Café Tortoni', type: 'cafe', price: 1 },
      { id: 'hotel-ba', name: 'Hotel Recoleta', type: 'hotel', stars: 4, nightly: 220 },
      { id: 'academie-ba', name: 'Cantera Caldera', type: 'academie' },
      { id: 'centre-ba', name: 'Predio de Entrenamiento', type: 'centre' },
      { id: 'musee-ba', name: 'Museo de la Pasión', type: 'musee' },
      { id: 'centreco-ba', name: 'Galerías Pacífico', type: 'centreCommercial' },
      { id: 'parc-ba', name: 'Bosques de Palermo', type: 'parc' },
      { id: 'hub-ba', name: 'Hub La Boca', type: 'hub' },
    ],
  },
  {
    id: 'new-york', name: 'New York', country: 'us', lat: 40.71, lon: -74.0,
    population: 8300000, hub: true, tags: ['business', 'gratte-ciels', 'marketing'],
    description: "Vitrine marketing mondiale, cérémonies et tournées estivales.",
    venues: [
      { id: 'stade-liberty', name: 'Liberty Field', type: 'stade', capacity: 62000, prestige: 74 },
      { id: 'boutique-fifth', name: 'Fifth Avenue Flagship', type: 'boutique' },
      { id: 'hotel-ny', name: 'Central Park Tower Hotel', type: 'hotel', stars: 5, nightly: 1100 },
      { id: 'aeroport-jfk', name: 'Aéroport New York-Est', type: 'aeroport', code: 'JFK' },
      { id: 'hub-ny', name: 'Hub Midtown', type: 'hub' },
      { id: 'studio-ny', name: 'Global Sports Network', type: 'studio' },
      { id: 'concession-ny', name: 'Manhattan Supercars', type: 'concession' },
      { id: 'resto-ny', name: 'The Chophouse', type: 'restaurant', cuisine: 'américaine', price: 4 },
      { id: 'cafe-ny', name: 'Brooklyn Roasters', type: 'cafe', price: 2 },
      { id: 'centreco-ny', name: 'Hudson Yards Mall', type: 'centreCommercial' },
      { id: 'musee-ny', name: 'American Sports Museum', type: 'musee' },
      { id: 'parc-ny', name: 'Central Park', type: 'parc' },
      { id: 'salle-ny', name: 'Midtown Athletic Club', type: 'salle' },
      { id: 'cinema-ny', name: 'Broadway Cinema', type: 'cinema' },
      { id: 'gare-ny', name: 'Grand Central Terminal', type: 'gare' },
      { id: 'centre-ny', name: 'Liberty Training Facility', type: 'centre' },
    ],
  },
  {
    id: 'tokyo', name: 'Tokyo', country: 'jp', lat: 35.68, lon: 139.69,
    population: 13900000, hub: true, tags: ['technologie', 'discipline', 'néons'],
    description: "Précision, technologie et supporters d'une rare discipline.",
    venues: [
      { id: 'stade-sakura', name: 'Sakura Dome', type: 'stade', capacity: 67000, prestige: 79 },
      { id: 'boutique-shibuya', name: 'Shibuya Sport Store', type: 'boutique' },
      { id: 'hotel-tokyo', name: 'Skyline Tower Hotel', type: 'hotel', stars: 5, nightly: 690 },
      { id: 'aeroport-hnd', name: 'Aéroport Tokyo-Baie', type: 'aeroport', code: 'HND' },
      { id: 'hub-tokyo', name: 'Hub Shinjuku', type: 'hub' },
      { id: 'cinema-tokyo', name: 'Neon Cinema', type: 'cinema' },
      { id: 'resto-tokyo', name: 'Izakaya Sakura', type: 'restaurant', cuisine: 'japonaise', price: 3 },
      { id: 'cafe-tokyo', name: 'Kissaten Ginza', type: 'cafe', price: 2 },
      { id: 'centreco-tokyo', name: 'Shinjuku Grand Mall', type: 'centreCommercial' },
      { id: 'centre-tokyo', name: 'Sakura Training Ground', type: 'centre' },
      { id: 'academie-tokyo', name: 'Sakura Youth Academy', type: 'academie' },
      { id: 'musee-tokyo', name: 'Japan Football Museum', type: 'musee' },
      { id: 'gare-tokyo', name: 'Tokyo Station', type: 'gare' },
      { id: 'parc-tokyo', name: 'Yoyogi Park', type: 'parc' },
      { id: 'salle-tokyo', name: 'Performance Lab Tokyo', type: 'salle' },
    ],
  },
  {
    id: 'dubai', name: 'Dubaï', country: 'ae', lat: 25.2, lon: 55.27,
    population: 3500000, hub: true, tags: ['luxe', 'désert', 'gratte-ciels'],
    description: "Luxe, concessionnaires exceptionnels et hôtels démesurés.",
    venues: [
      { id: 'stade-mirage', name: 'Mirage Arena', type: 'stade', capacity: 60000, prestige: 76 },
      { id: 'centreco-dubai', name: 'Infinity Mall', type: 'centreCommercial' },
      { id: 'hotel-dubai', name: 'Palm Royal Resort', type: 'hotel', stars: 5, nightly: 1400 },
      { id: 'concession-dubai', name: 'Desert Hypercars', type: 'concession' },
      { id: 'port-dubai', name: 'Marina Yacht Club', type: 'port' },
      { id: 'aeroport-dxb', name: 'Aéroport Dubaï-International', type: 'aeroport', code: 'DXB' },
      { id: 'hub-dubai', name: 'Hub Marina', type: 'hub' },
      { id: 'resto-dubai', name: 'Al Bahar Rooftop', type: 'restaurant', cuisine: 'levantine', price: 4 },
      { id: 'cafe-dubai', name: 'Desert Bean', type: 'cafe', price: 2 },
      { id: 'boutique-dubai', name: 'Gold Souk Boutique', type: 'boutique' },
      { id: 'plage-dubai', name: 'Jumeirah Beach', type: 'plage' },
      { id: 'salle-dubai', name: 'Elite Fitness Marina', type: 'salle' },
      { id: 'cinema-dubai', name: 'Infinity IMAX', type: 'cinema' },
      { id: 'centre-dubai', name: 'Mirage Training Complex', type: 'centre' },
      { id: 'clinique-dubai', name: 'Gulf Sports Medicine', type: 'clinique' },
    ],
  },
  {
    id: 'doha', name: 'Doha', country: 'qa', lat: 25.29, lon: 51.53,
    population: 1200000, hub: false, tags: ['tournois', 'moderne', 'chaleur'],
    description: "Ville-hôte régulière des grands tournois internationaux.",
    venues: [
      { id: 'stade-perle', name: 'Stade de la Perle', type: 'stade', capacity: 65000, prestige: 80 },
      { id: 'hotel-doha', name: 'Corniche Grand', type: 'hotel', stars: 5, nightly: 850 },
      { id: 'aeroport-doh', name: 'Aéroport Doha', type: 'aeroport', code: 'DOH' },
      { id: 'resto-doha', name: 'Souq Waqif Table', type: 'restaurant', cuisine: 'qatarie', price: 3 },
      { id: 'cafe-doha', name: 'Corniche Coffee', type: 'cafe', price: 2 },
      { id: 'centreco-doha', name: 'Pearl Mall', type: 'centreCommercial' },
      { id: 'musee-doha', name: 'Musée du Sport', type: 'musee' },
      { id: 'centre-doha', name: 'Aspire Training Zone', type: 'centre' },
      { id: 'academie-doha', name: 'Académie de la Perle', type: 'academie' },
      { id: 'fanzone-doha', name: 'Fan Zone Corniche', type: 'fanzone' },
      { id: 'port-doha', name: 'Marina de la Perle', type: 'port' },
    ],
  },
  {
    id: 'casablanca', name: 'Casablanca', country: 'ma', lat: 33.57, lon: -7.59,
    population: 3400000, hub: false, tags: ['atlantique', 'ferveur', 'médina'],
    description: "Ferveur africaine et front de mer atlantique.",
    venues: [
      { id: 'stade-atlas', name: 'Stade Atlas', type: 'stade', capacity: 67000, prestige: 78 },
      { id: 'plage-ain-diab', name: "Plage d'Aïn Diab", type: 'plage' },
      { id: 'aeroport-cmn', name: 'Aéroport Casablanca', type: 'aeroport', code: 'CMN' },
      { id: 'resto-casa', name: 'Riad El Fassia', type: 'restaurant', cuisine: 'marocaine', price: 2 },
      { id: 'cafe-casa', name: 'Café Maure', type: 'cafe', price: 1 },
      { id: 'hotel-casa', name: 'Hôtel de la Corniche', type: 'hotel', stars: 4, nightly: 190 },
      { id: 'centreco-casa', name: 'Morocco Mall', type: 'centreCommercial' },
      { id: 'academie-casa', name: 'Académie Atlas', type: 'academie' },
      { id: 'centre-casa', name: "Centre d'Entraînement Atlas", type: 'centre' },
      { id: 'musee-casa', name: 'Musée du Sport Marocain', type: 'musee' },
      { id: 'boutique-casa', name: 'Souk Habous', type: 'boutique' },
      { id: 'gare-casa', name: 'Casa-Voyageurs', type: 'gare' },
    ],
  },
  {
    id: 'dakar', name: 'Dakar', country: 'sn', lat: 14.72, lon: -17.47,
    population: 1200000, hub: false, tags: ['océan', 'teranga', 'lutte'],
    description: "Presqu'île vibrante, viviers de talents et océan omniprésent.",
    venues: [
      { id: 'stade-teranga', name: 'Stade de la Teranga', type: 'stade', capacity: 50000, prestige: 70 },
      { id: 'academie-dakar', name: 'Académie Ndakaru', type: 'academie' },
      { id: 'plage-ngor', name: 'Plage de Ngor', type: 'plage' },
      { id: 'aeroport-dss', name: 'Aéroport Dakar-Blaise', type: 'aeroport', code: 'DSS' },
      { id: 'resto-dakar', name: 'Chez Teranga', type: 'restaurant', cuisine: 'sénégalaise', price: 2 },
      { id: 'cafe-dakar', name: 'Café Almadies', type: 'cafe', price: 1 },
      { id: 'hotel-dakar', name: 'Hôtel des Almadies', type: 'hotel', stars: 4, nightly: 160 },
      { id: 'centreco-dakar', name: 'Marché Sandaga', type: 'centreCommercial' },
      { id: 'centre-dakar', name: "Centre d'Entraînement Ndakaru", type: 'centre' },
      { id: 'musee-dakar', name: 'Musée des Civilisations', type: 'musee' },
      { id: 'hub-dakar', name: 'Hub Corniche', type: 'hub' },
      { id: 'parc-dakar', name: 'Parc de Hann', type: 'parc' },
    ],
  },
  {
    id: 'abidjan', name: 'Abidjan', country: 'ci', lat: 5.36, lon: -4.01,
    population: 5000000, hub: false, tags: ['lagune', 'formation', 'chaleur'],
    description: "Lagune, formation intensive et public exigeant.",
    venues: [
      { id: 'stade-lagune', name: 'Stade de la Lagune', type: 'stade', capacity: 60000, prestige: 72 },
      { id: 'academie-abidjan', name: 'Académie Éburnie', type: 'academie' },
      { id: 'aeroport-abj', name: 'Aéroport Abidjan', type: 'aeroport', code: 'ABJ' },
      { id: 'resto-abidjan', name: 'Maquis du Plateau', type: 'restaurant', cuisine: 'ivoirienne', price: 1 },
      { id: 'cafe-abidjan', name: 'Café Cocody', type: 'cafe', price: 1 },
      { id: 'hotel-abidjan', name: 'Hôtel de la Lagune', type: 'hotel', stars: 4, nightly: 170 },
      { id: 'centreco-abidjan', name: 'Cap Sud Centre', type: 'centreCommercial' },
      { id: 'centre-abidjan', name: "Centre Technique d'Anyama", type: 'centre' },
      { id: 'plage-abidjan', name: 'Plage de Grand-Bassam', type: 'plage' },
      { id: 'musee-abidjan', name: 'Musée des Civilisations', type: 'musee' },
      { id: 'parc-abidjan', name: 'Parc du Banco', type: 'parc' },
    ],
  },
  {
    id: 'zermatt', name: 'Zermatt', country: 'ch', lat: 46.02, lon: 7.75,
    population: 5800, hub: false, tags: ['ski', 'montagne', 'récupération'],
    description: "Station d'altitude prisée pour les stages et les vacances d'hiver.",
    venues: [
      { id: 'montagne-zermatt', name: 'Domaine du Cervin', type: 'montagne' },
      { id: 'hotel-zermatt', name: 'Chalet Alpin Suites', type: 'hotel', stars: 5, nightly: 900 },
      { id: 'clinique-zermatt', name: 'Clinique de Réathlétisation', type: 'clinique' },
      { id: 'resto-zermatt', name: 'Restaurant du Glacier', type: 'restaurant', cuisine: 'suisse', price: 4 },
      { id: 'cafe-zermatt', name: 'Café du Sommet', type: 'cafe', price: 3 },
      { id: 'boutique-zermatt', name: 'Alpine Sport Shop', type: 'boutique' },
      { id: 'salle-zermatt', name: "Centre d'Altitude", type: 'salle' },
      { id: 'gare-zermatt', name: 'Gare de Zermatt', type: 'gare' },
      { id: 'residence-zermatt', name: 'Chalets du Cervin', type: 'residence' },
    ],
  },
  {
    id: 'male', name: 'Malé', country: 'mv', lat: 4.17, lon: 73.51,
    population: 250000, hub: false, tags: ['lagon', 'plongée', 'repos'],
    description: "Destination de récupération par excellence entre deux saisons.",
    venues: [
      { id: 'plage-atoll', name: "Plage de l'Atoll Nord", type: 'plage' },
      { id: 'hotel-male', name: 'Lagoon Villas', type: 'hotel', stars: 5, nightly: 1600 },
      { id: 'port-male', name: 'Marina de Malé', type: 'port' },
      { id: 'aeroport-mle', name: 'Aéroport de Malé', type: 'aeroport', code: 'MLE' },
      { id: 'resto-male', name: 'Ocean Deck', type: 'restaurant', cuisine: 'maldivienne', price: 4 },
      { id: 'cafe-male', name: 'Reef Coffee', type: 'cafe', price: 3 },
      { id: 'boutique-male', name: 'Atoll Boutique', type: 'boutique' },
      { id: 'plage-male-sud', name: 'Plage de l\'Atoll Sud', type: 'plage' },
      { id: 'residence-male', name: 'Villas sur pilotis', type: 'residence' },
    ],
  },
  {
    id: 'le-cap', name: 'Le Cap', country: 'za', lat: -33.92, lon: 18.42,
    population: 4600000, hub: false, tags: ['safari', 'montagne', 'océan'],
    description: "Entre montagne de la Table, vignobles et safaris.",
    venues: [
      { id: 'stade-table', name: 'Table Bay Stadium', type: 'stade', capacity: 55000, prestige: 71 },
      { id: 'plage-camps', name: 'Camps Beach', type: 'plage' },
      { id: 'parc-safari', name: 'Réserve de Winelands', type: 'parc' },
      { id: 'aeroport-cpt', name: 'Aéroport du Cap', type: 'aeroport', code: 'CPT' },
      { id: 'resto-cap', name: 'The Vineyard Table', type: 'restaurant', cuisine: 'sud-africaine', price: 3 },
      { id: 'cafe-cap', name: 'Bo-Kaap Coffee', type: 'cafe', price: 2 },
      { id: 'hotel-cap', name: 'Table Bay Hotel', type: 'hotel', stars: 5, nightly: 380 },
      { id: 'centreco-cap', name: 'Waterfront Mall', type: 'centreCommercial' },
      { id: 'centre-cap', name: 'Table Bay Training Ground', type: 'centre' },
      { id: 'academie-cap', name: 'Cape Youth Academy', type: 'academie' },
      { id: 'musee-cap', name: 'Cape Sports Heritage', type: 'musee' },
      { id: 'montagne-cap', name: 'Montagne de la Table', type: 'montagne' },
      { id: 'port-cap', name: 'V&A Marina', type: 'port' },
    ],
  },
];

/**
 * Clubs. Le prestige pilote l'intérêt lors des transferts (Tome IV ch. 3) et
 * les revenus (Tome VI ch. 2).
 */
export const CLUBS = [
  { id: 'stade-malien', name: 'AS Djoliba Bamako', cityId: 'bamako', prestige: 46, budget: 900000, league: 'Ligue 1 Malienne', tier: 3, colors: ['#e63946', '#ffffff'] },
  { id: 'dakar-united', name: 'Dakar United FC', cityId: 'dakar', prestige: 50, budget: 1400000, league: 'Ligue Sénégalaise', tier: 3, colors: ['#2a9d8f', '#ffffff'] },
  { id: 'abidjan-fc', name: 'Éburnie Abidjan', cityId: 'abidjan', prestige: 52, budget: 1700000, league: 'Ligue Ivoirienne', tier: 3, colors: ['#f77f00', '#003049'] },
  { id: 'atlas-casa', name: 'Atlas Casablanca', cityId: 'casablanca', prestige: 62, budget: 9000000, league: 'Botola Pro', tier: 2, colors: ['#d62828', '#003049'] },
  { id: 'lisbonne-atlantico', name: 'Atlântico Lisboa', cityId: 'lisbonne', prestige: 74, budget: 42000000, league: 'Liga Portuguesa', tier: 2, colors: ['#00a86b', '#ffffff'] },
  { id: 'amsterdam-kanaal', name: 'Kanaal Amsterdam', cityId: 'amsterdam', prestige: 76, budget: 55000000, league: 'Eredivisie', tier: 2, colors: ['#e63946', '#ffffff'] },
  { id: 'paris-lumiere', name: 'Paris Lumière', cityId: 'paris', prestige: 88, budget: 320000000, league: 'Ligue Élite', tier: 1, colors: ['#0d1b2a', '#c9a227'] },
  { id: 'londres-crown', name: 'Crown Park FC', cityId: 'londres', prestige: 92, budget: 380000000, league: 'Premier Championship', tier: 1, colors: ['#1d3557', '#ffffff'] },
  { id: 'londres-eastend', name: 'East End United', cityId: 'londres', prestige: 78, budget: 120000000, league: 'Premier Championship', tier: 1, colors: ['#8d0801', '#ffd166'] },
  { id: 'madrid-corona', name: 'Corona Madrid', cityId: 'madrid', prestige: 95, budget: 420000000, league: 'Liga Corona', tier: 1, colors: ['#ffffff', '#c9a227'] },
  { id: 'milan-scala', name: 'Scala Milano', cityId: 'milan', prestige: 87, budget: 250000000, league: 'Serie Élite', tier: 1, colors: ['#000000', '#e63946'] },
  { id: 'munich-alpen', name: 'Alpen München', cityId: 'munich', prestige: 90, budget: 340000000, league: 'Bundes Élite', tier: 1, colors: ['#d00000', '#ffffff'] },
  { id: 'rio-costa', name: 'Costa Rio', cityId: 'rio', prestige: 80, budget: 60000000, league: 'Brasileirão Ouro', tier: 2, colors: ['#06d6a0', '#ffd166'] },
  { id: 'ba-caldera', name: 'Caldera Buenos Aires', cityId: 'buenos-aires', prestige: 79, budget: 45000000, league: 'Liga Argentina', tier: 2, colors: ['#118ab2', '#ffffff'] },
  { id: 'ny-liberty', name: 'Liberty New York', cityId: 'new-york', prestige: 66, budget: 90000000, league: 'Continental League', tier: 2, colors: ['#1d3557', '#e63946'] },
  { id: 'tokyo-sakura', name: 'Sakura Tokyo', cityId: 'tokyo', prestige: 70, budget: 70000000, league: 'J-Élite', tier: 2, colors: ['#ef476f', '#ffffff'] },
  { id: 'dubai-mirage', name: 'Mirage Dubaï', cityId: 'dubai', prestige: 68, budget: 150000000, league: 'Gulf Pro League', tier: 2, colors: ['#c9a227', '#0d1b2a'] },
  { id: 'doha-perle', name: 'Perle Doha', cityId: 'doha', prestige: 67, budget: 140000000, league: 'Gulf Pro League', tier: 2, colors: ['#7b2cbf', '#ffffff'] },
  { id: 'cap-table', name: 'Table Bay FC', cityId: 'le-cap', prestige: 58, budget: 12000000, league: 'Premier SA', tier: 3, colors: ['#023e8a', '#90e0ef'] },
];

/** Compétitions du calendrier mondial — Tome XIX ch. 2. */
export const COMPETITIONS = [
  { id: 'championnat', name: 'Championnat national', type: 'ligue', months: [7, 8, 9, 10, 11, 0, 1, 2, 3, 4], prestige: 70, matchdays: 34 },
  { id: 'coupe-nationale', name: 'Coupe nationale', type: 'coupe', months: [10, 0, 2, 4], prestige: 62, matchdays: 6 },
  { id: 'continentale', name: 'Ligue Continentale', type: 'coupe', months: [8, 9, 10, 1, 2, 3, 4], prestige: 95, matchdays: 13 },
  { id: 'supercoupe', name: 'Supercoupe', type: 'coupe', months: [7], prestige: 55, matchdays: 1 },
  { id: 'coupe-du-monde', name: 'Coupe du Monde', type: 'selection', months: [5, 6], prestige: 100, matchdays: 7, everyYears: 4 },
  { id: 'continentale-nations', name: 'Coupe des Nations', type: 'selection', months: [0, 1], prestige: 84, matchdays: 6, everyYears: 2 },
  { id: 'jeux-olympiques', name: 'Jeux Olympiques', type: 'selection', months: [6, 7], prestige: 78, matchdays: 6, everyYears: 4 },
  { id: 'tournee-estivale', name: 'Tournée estivale', type: 'amical', months: [6], prestige: 35, matchdays: 4 },
  { id: 'match-caritatif', name: 'Match caritatif', type: 'amical', months: [11, 5], prestige: 30, matchdays: 1 },
  { id: 'match-legendes', name: 'Match des légendes', type: 'legende', months: [5], prestige: 45, matchdays: 1 },
];

/** Moyens de transport — Tome XXX v1 ch. 3 et v2 ch. 3. */
export const TRANSPORTS = [
  { id: 'marche', name: 'À pied', kmh: 5, costPerKm: 0, comfort: 20, maxKm: 8, icon: '🚶', requires: null },
  { id: 'velo', name: 'Vélo', kmh: 18, costPerKm: 0, comfort: 30, maxKm: 40, icon: '🚲', requires: null },
  { id: 'moto', name: 'Moto', kmh: 70, costPerKm: 0.12, comfort: 45, maxKm: 400, icon: '🏍️', requires: 'vehicule' },
  { id: 'voiture', name: 'Voiture', kmh: 85, costPerKm: 0.22, comfort: 70, maxKm: 900, icon: '🚗', requires: 'vehicule' },
  { id: 'bus', name: 'Bus', kmh: 45, costPerKm: 0.06, comfort: 35, maxKm: 300, icon: '🚌', requires: null },
  { id: 'metro', name: 'Métro', kmh: 35, costPerKm: 0.05, comfort: 40, maxKm: 40, icon: '🚇', requires: null },
  { id: 'taxi', name: 'Taxi', kmh: 60, costPerKm: 1.6, comfort: 60, maxKm: 200, icon: '🚕', requires: null },
  { id: 'vtc', name: 'VTC', kmh: 65, costPerKm: 1.9, comfort: 72, maxKm: 300, icon: '🚙', requires: null },
  { id: 'limousine', name: 'Limousine', kmh: 70, costPerKm: 5.5, comfort: 92, maxKm: 300, icon: '🛻', requires: null },
  { id: 'train', name: 'Train', kmh: 190, costPerKm: 0.18, comfort: 68, maxKm: 1500, icon: '🚆', requires: null },
  { id: 'avion', name: 'Avion de ligne', kmh: 850, costPerKm: 0.14, comfort: 65, maxKm: 20000, icon: '✈️', requires: null },
  { id: 'jet', name: 'Jet privé', kmh: 900, costPerKm: 2.4, comfort: 98, maxKm: 12000, icon: '🛩️', requires: 'notoriete:60' },
  { id: 'helicoptere', name: 'Hélicoptère', kmh: 240, costPerKm: 4.2, comfort: 85, maxKm: 600, icon: '🚁', requires: 'notoriete:50' },
  { id: 'yacht', name: 'Yacht', kmh: 35, costPerKm: 3.8, comfort: 95, maxKm: 3000, icon: '⛵', requires: 'yacht' },
];

/** Activités de loisir et de vacances — Tome XXX v1 ch. 4, v2 ch. 4. */
export const ACTIVITIES = [
  { id: 'football-plage', name: 'Football de plage', venueType: 'plage', cost: 0, fatigue: 12, wellbeing: 10, skill: { technique: 0.4 }, duration: 3 },
  { id: 'basketball', name: 'Basketball', venueType: 'parc', cost: 10, fatigue: 10, wellbeing: 8, skill: { physique: 0.3 }, duration: 2 },
  { id: 'tennis', name: 'Tennis', venueType: 'parc', cost: 40, fatigue: 10, wellbeing: 9, skill: { vitesse: 0.2 }, duration: 2 },
  { id: 'golf', name: 'Golf', venueType: 'parc', cost: 180, fatigue: 4, wellbeing: 12, skill: { mental: 0.3 }, duration: 5 },
  { id: 'karting', name: 'Karting', venueType: 'parc', cost: 90, fatigue: 5, wellbeing: 10, skill: {}, duration: 2 },
  { id: 'bowling', name: 'Bowling', venueType: 'centreCommercial', cost: 30, fatigue: 3, wellbeing: 7, skill: {}, duration: 2 },
  { id: 'billard', name: 'Billard', venueType: 'cafe', cost: 20, fatigue: 2, wellbeing: 6, skill: { mental: 0.1 }, duration: 2 },
  { id: 'natation', name: 'Natation', venueType: 'plage', cost: 15, fatigue: -8, wellbeing: 11, skill: { physique: 0.2 }, duration: 2 },
  { id: 'surf', name: 'Surf', venueType: 'plage', cost: 60, fatigue: 12, wellbeing: 14, skill: { physique: 0.2 }, duration: 3 },
  { id: 'jet-ski', name: 'Jet-ski', venueType: 'plage', cost: 220, fatigue: 8, wellbeing: 13, skill: {}, duration: 2 },
  { id: 'plongee', name: 'Plongée', venueType: 'plage', cost: 320, fatigue: 6, wellbeing: 16, skill: { mental: 0.2 }, duration: 4 },
  { id: 'randonnee', name: 'Randonnée', venueType: 'montagne', cost: 20, fatigue: 14, wellbeing: 15, skill: { physique: 0.3 }, duration: 6 },
  { id: 'ski', name: 'Ski', venueType: 'montagne', cost: 260, fatigue: 12, wellbeing: 14, skill: { physique: 0.2 }, duration: 5 },
  { id: 'snowboard', name: 'Snowboard', venueType: 'montagne', cost: 250, fatigue: 13, wellbeing: 14, skill: {}, duration: 5 },
  { id: 'parachutisme', name: 'Parachutisme', venueType: 'montagne', cost: 480, fatigue: 6, wellbeing: 20, skill: { mental: 0.4 }, duration: 4, risk: 0.02 },
  { id: 'elastique', name: "Saut à l'élastique", venueType: 'montagne', cost: 190, fatigue: 4, wellbeing: 17, skill: { mental: 0.3 }, duration: 2, risk: 0.015 },
  { id: 'montgolfiere', name: 'Montgolfière', venueType: 'parc', cost: 350, fatigue: 1, wellbeing: 18, skill: {}, duration: 3 },
  { id: 'safari', name: 'Safari', venueType: 'parc', cost: 700, fatigue: 5, wellbeing: 19, skill: {}, duration: 8 },
  { id: 'cinema', name: 'Cinéma', venueType: 'cinema', cost: 18, fatigue: 0, wellbeing: 7, skill: {}, duration: 3 },
  { id: 'shopping', name: 'Shopping', venueType: 'centreCommercial', cost: 0, fatigue: 3, wellbeing: 8, skill: {}, duration: 3 },
  { id: 'musee-visite', name: 'Visite de musée', venueType: 'musee', cost: 22, fatigue: 1, wellbeing: 9, skill: { mental: 0.1 }, duration: 3 },
  { id: 'restaurant-sortie', name: 'Dîner au restaurant', venueType: 'restaurant', cost: 0, fatigue: 0, wellbeing: 10, skill: {}, duration: 2 },
  { id: 'concert', name: 'Concert', venueType: 'fanzone', cost: 140, fatigue: 5, wellbeing: 15, skill: {}, duration: 4 },
  { id: 'musculation', name: 'Séance de musculation', venueType: 'salle', cost: 25, fatigue: 16, wellbeing: 4, skill: { physique: 0.6 }, duration: 2 },
];

/** Catégories de véhicules — Tome XXII ch. 3, Tome XXIV ch. 5. */
export const VEHICLES = [
  { id: 'citadine', name: 'Citadine compacte', category: 'citadine', price: 22000, upkeep: 90, prestige: 5, topSpeed: 180 },
  { id: 'berline', name: 'Berline exécutive', category: 'berline', price: 68000, upkeep: 260, prestige: 22, topSpeed: 240 },
  { id: 'suv', name: 'SUV grand format', category: 'suv', price: 95000, upkeep: 380, prestige: 30, topSpeed: 230 },
  { id: 'moto-sport', name: 'Moto sportive', category: 'moto', price: 24000, upkeep: 120, prestige: 18, topSpeed: 299 },
  { id: 'coupe-sport', name: 'Coupé sport', category: 'sport', price: 145000, upkeep: 620, prestige: 46, topSpeed: 305 },
  { id: 'supercar', name: 'Supercar V10', category: 'supercar', price: 340000, upkeep: 1500, prestige: 72, topSpeed: 340 },
  { id: 'hypercar', name: 'Hypercar hybride', category: 'supercar', price: 2400000, upkeep: 6800, prestige: 96, topSpeed: 385 },
  { id: 'ancienne-60', name: 'Roadster de collection 1962', category: 'collection', price: 480000, upkeep: 2100, prestige: 80, topSpeed: 190, appreciates: true },
  { id: 'ancienne-80', name: 'Coupé de collection 1987', category: 'collection', price: 260000, upkeep: 1400, prestige: 66, topSpeed: 250, appreciates: true },
  { id: 'limousine-veh', name: 'Limousine blindée', category: 'luxe', price: 410000, upkeep: 2600, prestige: 74, topSpeed: 210 },
];

/**
 * Catégories de marques partenaires — Tome XXIV ch. 2.
 * Les marques sont fictives : le champ `licensed:false` indique qu'une vraie
 * licence pourrait les remplacer sans changer le code.
 */
export const BRANDS = [
  { id: 'volt', name: 'Volt Athletics', category: 'équipementier', tier: 3, licensed: false, exclusive: true },
  { id: 'kairo', name: 'Kairo Sport', category: 'équipementier', tier: 2, licensed: false, exclusive: true },
  { id: 'sahel-wear', name: 'Sahel Wear', category: 'équipementier', tier: 1, licensed: false, exclusive: false },
  { id: 'maison-orin', name: 'Maison Orin', category: 'mode', tier: 3, licensed: false, exclusive: false },
  { id: 'nord-atelier', name: 'Nord Atelier', category: 'mode', tier: 2, licensed: false, exclusive: false },
  { id: 'corsa-auto', name: 'Corsa Automobili', category: 'automobile', tier: 3, licensed: false, exclusive: true },
  { id: 'meridian-motors', name: 'Meridian Motors', category: 'automobile', tier: 2, licensed: false, exclusive: true },
  { id: 'lumen-tech', name: 'Lumen Technologies', category: 'électronique', tier: 3, licensed: false, exclusive: false },
  { id: 'chrono-astra', name: 'Chrono Astra', category: 'horlogerie', tier: 3, licensed: false, exclusive: false },
  { id: 'skyward', name: 'Skyward Airlines', category: 'aérien', tier: 2, licensed: false, exclusive: false },
];

/** Types d'investissement — Tome XXIII ch. 3. */
export const INVESTMENT_TYPES = [
  { id: 'immobilier', name: 'Immobilier locatif', minTicket: 150000, yield: 0.055, volatility: 0.06, risk: 'faible' },
  { id: 'hotel', name: 'Hôtellerie', minTicket: 900000, yield: 0.085, volatility: 0.16, risk: 'moyen' },
  { id: 'centre-commercial', name: 'Centre commercial', minTicket: 2500000, yield: 0.075, volatility: 0.14, risk: 'moyen' },
  { id: 'restaurant', name: 'Restaurant', minTicket: 220000, yield: 0.11, volatility: 0.3, risk: 'élevé' },
  { id: 'academie', name: 'Académie de football', minTicket: 600000, yield: 0.05, volatility: 0.1, risk: 'faible', prestige: 8 },
  { id: 'salle-sport', name: 'Salle de sport', minTicket: 280000, yield: 0.09, volatility: 0.2, risk: 'moyen' },
  { id: 'marque-vetements', name: 'Marque de vêtements', minTicket: 750000, yield: 0.13, volatility: 0.36, risk: 'élevé', prestige: 6 },
  { id: 'tech', name: 'Entreprise technologique', minTicket: 500000, yield: 0.16, volatility: 0.45, risk: 'très élevé' },
  { id: 'club', name: 'Participation dans un club', minTicket: 5000000, yield: 0.04, volatility: 0.25, risk: 'élevé', prestige: 20 },
];

/** Biens immobiliers achetables — Tome XXIII ch. 4. */
export const PROPERTY_TYPES = [
  { id: 'appartement', name: 'Appartement', basePrice: 240000, upkeep: 400, comfort: 45, prestige: 6 },
  { id: 'maison', name: 'Maison', basePrice: 520000, upkeep: 800, comfort: 62, prestige: 14 },
  { id: 'villa', name: 'Villa', basePrice: 1800000, upkeep: 3200, comfort: 85, prestige: 38 },
  { id: 'penthouse', name: 'Penthouse', basePrice: 3400000, upkeep: 5200, comfort: 92, prestige: 52 },
  { id: 'chalet', name: 'Chalet', basePrice: 2200000, upkeep: 3800, comfort: 88, prestige: 44 },
  { id: 'immeuble', name: 'Immeuble de rapport', basePrice: 6500000, upkeep: 9000, comfort: 20, prestige: 30, rental: true },
  { id: 'ile', name: 'Île privée', basePrice: 42000000, upkeep: 45000, comfort: 100, prestige: 95, requiresLegend: true },
];

/** Employés recrutables — Tome XXIII ch. 5. */
export const STAFF_ROLES = [
  { id: 'chauffeur', name: 'Chauffeur', salary: 2400, effect: { fatigueTravel: -0.3 } },
  { id: 'chef', name: 'Chef cuisinier', salary: 4200, effect: { recovery: 0.12, wellbeing: 3 } },
  { id: 'jardinier', name: 'Jardinier', salary: 1600, effect: { propertyUpkeep: -0.1 } },
  { id: 'menage', name: 'Personnel de maison', salary: 1800, effect: { wellbeing: 2 } },
  { id: 'garde', name: 'Garde du corps', salary: 5200, effect: { incidentRisk: -0.5 } },
  { id: 'assistant', name: 'Assistant personnel', salary: 3800, effect: { agendaSlots: 2 } },
  { id: 'pilote', name: 'Pilote privé', salary: 9500, effect: { jetCost: -0.35 }, requires: 'jet' },
  { id: 'concierge', name: 'Concierge', salary: 3000, effect: { bookingDiscount: 0.15 } },
  { id: 'nutritionniste', name: 'Nutritionniste', salary: 4600, effect: { fatigueRate: -0.15 } },
  { id: 'kine', name: 'Kinésithérapeute personnel', salary: 5400, effect: { injuryRisk: -0.25, recovery: 0.2 } },
];

/** Objets de collection — Tome XXIII ch. 6, Tome XXIV ch. 7. */
export const LUXURY_ITEMS = [
  { id: 'montre-acier', name: 'Montre chronographe acier', price: 8500, category: 'montres', appreciation: 0.02, prestige: 4 },
  { id: 'montre-or', name: 'Montre or perpétuelle', price: 62000, category: 'montres', appreciation: 0.06, prestige: 12 },
  { id: 'montre-piece-unique', name: 'Montre pièce unique', price: 480000, category: 'montres', appreciation: 0.11, prestige: 34 },
  { id: 'bijou-chaine', name: 'Chaîne sertie', price: 24000, category: 'bijoux', appreciation: 0.01, prestige: 7 },
  { id: 'art-contemporain', name: "Œuvre d'art contemporaine", price: 180000, category: 'art', appreciation: 0.09, prestige: 18, volatile: true },
  { id: 'art-maitre', name: 'Toile de maître', price: 2600000, category: 'art', appreciation: 0.07, prestige: 46 },
  { id: 'trophee-historique', name: 'Trophée historique aux enchères', price: 340000, category: 'trophées', appreciation: 0.08, prestige: 26 },
  { id: 'crampons-legende', name: 'Crampons signés par une légende', price: 42000, category: 'trophées', appreciation: 0.05, prestige: 10 },
];

/** Catégories des Boubjack Awards — Tome VII ch. 5, reprises intégralement. */
export const AWARD_CATEGORIES = [
  { id: 'revelation', name: "Révélation de l'année", scope: 'joueur' },
  { id: 'plus-beau-but', name: 'Plus beau but', scope: 'action' },
  { id: 'plus-belle-parade', name: 'Plus belle parade', scope: 'action' },
  { id: 'meilleur-entraineur', name: 'Meilleur entraîneur', scope: 'staff' },
  { id: 'meilleur-jeune', name: 'Meilleur jeune', scope: 'joueur' },
  { id: 'meilleur-club', name: 'Meilleur club', scope: 'club' },
  { id: 'meilleure-academie', name: 'Meilleure académie', scope: 'club' },
  { id: 'meilleur-stade', name: 'Meilleur stade', scope: 'lieu' },
  { id: 'meilleurs-supporters', name: 'Meilleurs supporters', scope: 'club' },
  { id: 'meilleur-arbitre', name: 'Meilleur arbitre', scope: 'staff' },
  { id: 'meilleur-xi', name: "Meilleur XI de l'année", scope: 'equipe' },
  { id: 'plus-belle-remontee', name: 'Plus belle remontée', scope: 'club' },
  { id: 'meilleur-capitaine', name: 'Meilleur capitaine', scope: 'joueur' },
  { id: 'fair-play', name: 'Prix Fair-Play', scope: 'joueur' },
  { id: 'prix-carriere', name: 'Prix Carrière', scope: 'joueur' },
  { id: 'legende', name: 'Légende du Football', scope: 'joueur' },
  { id: 'icone', name: "Icône de l'année", scope: 'joueur' },
];

/** Villes hôtes possibles des Boubjack Awards — Tome VII ch. 2. */
export const AWARDS_HOST_CITIES = [
  'bamako', 'paris', 'londres', 'madrid', 'new-york', 'tokyo', 'dubai', 'doha', 'milan', 'le-cap',
];

/** Métiers d'après-carrière — Tome XXI ch. 2. */
export const POST_CAREER_ROLES = [
  { id: 'entraineur', name: 'Entraîneur', minReputation: 45, income: 900000 },
  { id: 'president', name: 'Président de club', minReputation: 70, income: 1400000 },
  { id: 'selectionneur', name: 'Sélectionneur national', minReputation: 75, income: 1100000 },
  { id: 'consultant', name: 'Consultant TV', minReputation: 40, income: 420000 },
  { id: 'commentateur', name: 'Commentateur', minReputation: 35, income: 300000 },
  { id: 'agent', name: 'Agent de joueurs', minReputation: 30, income: 650000 },
  { id: 'recruteur', name: 'Recruteur', minReputation: 25, income: 220000 },
  { id: 'ambassadeur', name: 'Ambassadeur international', minReputation: 80, income: 750000 },
  { id: 'organisateur-awards', name: 'Organisateur des Boubjack Awards', minReputation: 88, income: 1900000 },
  { id: 'fondateur-academie', name: "Fondateur d'une académie", minReputation: 50, income: 380000 },
  { id: 'proprietaire-club', name: "Propriétaire d'un club", minReputation: 85, income: 2600000 },
];

// ── Index et utilitaires de requête ────────────────────────────────────────

const cityIndex = new Map(CITIES.map((c) => [c.id, c]));
const countryIndex = new Map(COUNTRIES.map((c) => [c.id, c]));
const clubIndex = new Map(CLUBS.map((c) => [c.id, c]));

export function getCity(id) { return cityIndex.get(id) || null; }
export function getCountry(id) { return countryIndex.get(id) || null; }
export function getClub(id) { return clubIndex.get(id) || null; }

export function getVenue(cityId, venueId) {
  const city = getCity(cityId);
  if (!city) return null;
  return city.venues.find((v) => v.id === venueId) || null;
}

/** Tous les lieux d'une ville d'un type donné. */
export function venuesOfType(cityId, type) {
  const city = getCity(cityId);
  if (!city) return [];
  return city.venues.filter((v) => v.type === type);
}

/** Clubs situés dans une ville. */
export function clubsInCity(cityId) {
  return CLUBS.filter((c) => c.cityId === cityId);
}

/**
 * Distance orthodromique en kilomètres (formule de haversine).
 * Utilisée par le système de voyage pour calculer durée et coût réels.
 */
export function distanceKm(cityA, cityB) {
  const a = typeof cityA === 'string' ? getCity(cityA) : cityA;
  const b = typeof cityB === 'string' ? getCity(cityB) : cityB;
  if (!a || !b) return 0;
  const R = 6371;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Statistiques globales du monde, affichées dans l'interface. */
export function worldStats() {
  const venues = CITIES.reduce((n, c) => n + c.venues.length, 0);
  return {
    countries: COUNTRIES.length,
    cities: CITIES.length,
    venues,
    clubs: CLUBS.length,
    competitions: COMPETITIONS.length,
    transports: TRANSPORTS.length,
    activities: ACTIVITIES.length,
    vehicles: VEHICLES.length,
    hubs: CITIES.filter((c) => c.hub).length,
  };
}
