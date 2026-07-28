/**
 * Infinity Football — Données / Onomastique
 *
 * Réservoirs de noms utilisés par la génération procédurale des PNJ, des
 * joueurs, des journalistes, des commentateurs et des employés.
 * Le mélange culturel suit la répartition des pays du monde du jeu, de sorte
 * qu'un PNJ croisé à Bamako, Osaka ou Buenos Aires sonne juste (Tome XX, ch. 5).
 */

export interface NamePool {
  readonly countryIds: readonly string[];
  readonly given: readonly string[];
  readonly family: readonly string[];
}

export const NAME_POOLS: readonly NamePool[] = [
  {
    countryIds: ['fr', 'be', 'ch', 'ca'],
    given: ['Lucas', 'Hugo', 'Théo', 'Nathan', 'Camille', 'Louise', 'Léa', 'Manon', 'Antoine', 'Rémi', 'Sarah', 'Élise', 'Maxime', 'Julien', 'Chloé', 'Noé'],
    family: ['Martin', 'Bernard', 'Dubois', 'Moreau', 'Laurent', 'Girard', 'Rousseau', 'Fontaine', 'Perrin', 'Lemoine', 'Barré', 'Chevalier'],
  },
  {
    countryIds: ['es', 'mx', 'co', 'ar', 'uy'],
    given: ['Mateo', 'Diego', 'Álvaro', 'Sergio', 'Lucía', 'Valentina', 'Camila', 'Javier', 'Nicolás', 'Rodrigo', 'Sofía', 'Martina'],
    family: ['García', 'Fernández', 'Morales', 'Reyes', 'Navarro', 'Iglesias', 'Cabrera', 'Ortega', 'Quintero', 'Salazar', 'Vidal', 'Peralta'],
  },
  {
    countryIds: ['gb', 'us', 'au', 'za', 'ng'],
    given: ['James', 'Oliver', 'Harry', 'Ethan', 'Grace', 'Amelia', 'Chloe', 'Marcus', 'Tyler', 'Jordan', 'Ava', 'Isla'],
    family: ['Whitmore', 'Ashford', 'Brennan', 'Caldwell', 'Hollis', 'Ravenhill', 'Sutcliffe', 'Marlow', 'Kendrick', 'Pemberton', 'Okafor', 'Adeyemi'],
  },
  {
    countryIds: ['it'],
    given: ['Marco', 'Lorenzo', 'Alessandro', 'Matteo', 'Giulia', 'Chiara', 'Francesca', 'Davide', 'Simone', 'Elena'],
    family: ['Ferrari', 'Ricci', 'Marchetti', 'Bellini', 'Colombo', 'Fontana', 'Greco', 'Barbieri', 'Vitali', 'Santoro'],
  },
  {
    countryIds: ['de', 'at'],
    given: ['Lukas', 'Felix', 'Jonas', 'Maximilian', 'Lena', 'Hanna', 'Mia', 'Tobias', 'Niklas', 'Greta'],
    family: ['Brandt', 'Keller', 'Hofmann', 'Vogel', 'Reinhardt', 'Wendt', 'Sommer', 'Bergmann', 'Kraus', 'Lindner'],
  },
  {
    countryIds: ['pt', 'br'],
    given: ['João', 'Rafael', 'Bruno', 'Tiago', 'Beatriz', 'Mariana', 'Inês', 'Gustavo', 'Vinícius', 'Larissa'],
    family: ['Silva', 'Almeida', 'Carvalho', 'Ribeiro', 'Teixeira', 'Nogueira', 'Moreira', 'Barbosa', 'Pinto', 'Cardoso'],
  },
  {
    countryIds: ['ml', 'sn', 'ci'],
    given: ['Amadou', 'Ibrahim', 'Modibo', 'Seydou', 'Aminata', 'Fatoumata', 'Oumar', 'Cheikh', 'Mariam', 'Kadiatou', 'Boubacar', 'Aïssata'],
    family: ['Traoré', 'Keïta', 'Diarra', 'Coulibaly', 'Diallo', 'Sissoko', 'Ndiaye', 'Sow', 'Konaté', 'Touré', 'Camara', 'Bamba'],
  },
  {
    countryIds: ['ma', 'eg', 'ae', 'qa', 'sa', 'tr'],
    given: ['Youssef', 'Karim', 'Omar', 'Hakim', 'Salma', 'Nour', 'Yasmine', 'Bilal', 'Rayan', 'Layla', 'Emre', 'Deniz'],
    family: ['El Amrani', 'Benali', 'Haddad', 'Nasser', 'Farouk', 'Mansouri', 'Zeidan', 'Kaya', 'Demir', 'Yilmaz'],
  },
  {
    countryIds: ['jp'],
    given: ['Haruto', 'Sota', 'Riku', 'Yui', 'Aoi', 'Ren', 'Sakura', 'Hina', 'Kaito', 'Mei'],
    family: ['Takahashi', 'Nakamura', 'Kobayashi', 'Yamamoto', 'Fujiwara', 'Ishikawa', 'Morita', 'Ogawa', 'Hasegawa', 'Kuroda'],
  },
  {
    countryIds: ['kr', 'cn'],
    given: ['Jiho', 'Minjun', 'Seoyeon', 'Haeun', 'Wei', 'Lei', 'Yun', 'Xin', 'Jian', 'Mei'],
    family: ['Kim', 'Park', 'Choi', 'Jeong', 'Chen', 'Zhang', 'Liu', 'Huang', 'Zhao', 'Sun'],
  },
  {
    countryIds: ['nl'],
    given: ['Daan', 'Sem', 'Luuk', 'Sanne', 'Fenna', 'Bram', 'Jesse', 'Lotte'],
    family: ['De Vries', 'Van Dijk', 'Bakker', 'Jansen', 'Visser', 'Smit', 'Meijer', 'Kuiper'],
  },
  {
    countryIds: ['no', 'se'],
    given: ['Erik', 'Magnus', 'Ingrid', 'Astrid', 'Sven', 'Freja', 'Nils', 'Elin'],
    family: ['Lindqvist', 'Berg', 'Halvorsen', 'Nordvik', 'Sandberg', 'Eriksen', 'Dahl', 'Sjöberg'],
  },
  {
    countryIds: ['gr'],
    given: ['Nikos', 'Yannis', 'Dimitra', 'Eleni', 'Kostas', 'Maria'],
    family: ['Papadopoulos', 'Georgiou', 'Nikolaidis', 'Stavrou', 'Vasilakis', 'Antoniou'],
  },
  {
    countryIds: ['in'],
    given: ['Arjun', 'Rohan', 'Aditya', 'Priya', 'Ananya', 'Kabir', 'Meera', 'Vikram'],
    family: ['Sharma', 'Patel', 'Iyer', 'Nair', 'Chatterjee', 'Reddy', 'Kulkarni', 'Bhatt'],
  },
];

/** Noms de rues, utilisés par le générateur de quartiers. */
export const STREET_PREFIXES: readonly string[] = [
  'Avenue', 'Boulevard', 'Rue', 'Allée', 'Place', 'Quai', 'Cours', 'Promenade', 'Impasse', 'Esplanade',
];

export const STREET_ROOTS: readonly string[] = [
  'des Tilleuls', 'du Stade', 'de la Victoire', 'du Marché', 'des Artisans', 'du Fleuve',
  'de la Gare', 'des Oliviers', 'du Vieux Port', 'de la République', 'des Écoles',
  'du Théâtre', 'des Champions', 'de la Paix', 'du Levant', 'des Cèdres', 'du Belvédère',
  'des Palmiers', 'du Panorama', 'de la Cathédrale', 'des Halles', 'du Parc',
];

/** Noms de commerces, combinés à un type de lieu. */
export const BUSINESS_ADJECTIVES: readonly string[] = [
  'Doré', 'Central', 'Royal', 'Moderne', 'du Coin', 'Étoilé', 'Bleu', 'Ancien',
  'Panorama', 'Riviera', 'Impérial', 'Atlantique', 'Boréal', 'Solaire', 'Nocturne',
];

/** Prénoms de commentateurs et journalistes vedettes. */
export const MEDIA_PERSONA_NAMES: readonly string[] = [
  'Vincent Aubert', 'Nadia Ferrand', 'Marc Delacroix', 'Sofia Mendes', 'Karim Belhadj',
  'Elena Rossi', 'Thomas Vasseur', 'Aminata Diarra', 'Peter Hallow', 'Yuki Morita',
  'Diego Salinas', 'Claire Bonnet', 'Ousmane Cissé', 'Ingrid Halvorsen', 'Rafael Nogueira',
];

/** Noms de légendes historiques du monde (fictives, réutilisées par le Legacy). */
export const LEGEND_NAMES: readonly string[] = [
  'Aldo Ferreira', 'Baba Konaté', 'Sergio Valcárcel', 'Henrik Solberg', 'Tarek Mansouri',
  'Michel Vasseur', 'Dario Bellini', 'Kwame Osei', 'Renato Villar', 'Ivan Petrov',
  'Jules Marchand', 'Salif Traoré', 'Rui Nogueira', 'Andrés Peralta', 'Kenji Nakamura',
];
