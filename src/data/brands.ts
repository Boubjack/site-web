/**
 * Infinity Football — Données / Marques, produits et véhicules
 *
 * Tome XXIV : le jeu est conçu pour accueillir des marques partenaires
 * (équipementiers, mode, automobile, électronique, horlogerie, compagnies
 * aériennes). Les marques ci-dessous sont fictives et servent de socle neutre :
 * un pack de licence peut les remplacer sans toucher au code (Tome XXII).
 */

export type BrandCategory =
  | 'equipementier'
  | 'mode'
  | 'automobile'
  | 'electronique'
  | 'horlogerie'
  | 'aerien'
  | 'boisson'
  | 'immobilier';

export interface BrandDef {
  readonly id: string;
  readonly name: string;
  readonly category: BrandCategory;
  /** Prestige 0..100 : conditionne l'accès aux contrats. */
  readonly prestige: number;
  /** Notoriété requise du joueur pour être approché (0..100). */
  readonly fameRequired: number;
  /** Valeur annuelle de référence d'un contrat, en euros. */
  readonly baseAnnualValue: number;
  /** Marques concurrentes bloquées par une clause d'exclusivité. */
  readonly competitorIds: readonly string[];
  readonly signatureColor: string;
}

export const BRANDS: readonly BrandDef[] = [
  { id: 'velocis', name: 'Velocis', category: 'equipementier', prestige: 95, fameRequired: 55, baseAnnualValue: 4_200_000, competitorIds: ['strider', 'kaptor'], signatureColor: '#ff4d00' },
  { id: 'strider', name: 'Strider Athletics', category: 'equipementier', prestige: 92, fameRequired: 48, baseAnnualValue: 3_600_000, competitorIds: ['velocis', 'kaptor'], signatureColor: '#0057ff' },
  { id: 'kaptor', name: 'Kaptor Sport', category: 'equipementier', prestige: 84, fameRequired: 32, baseAnnualValue: 1_800_000, competitorIds: ['velocis', 'strider'], signatureColor: '#00b36b' },
  { id: 'onze', name: 'Onze Performance', category: 'equipementier', prestige: 71, fameRequired: 18, baseAnnualValue: 620_000, competitorIds: ['velocis', 'strider', 'kaptor'], signatureColor: '#8a2be2' },

  { id: 'maisonlune', name: 'Maison Lune', category: 'mode', prestige: 96, fameRequired: 68, baseAnnualValue: 3_000_000, competitorIds: ['atelierverd'], signatureColor: '#d4af37' },
  { id: 'atelierverd', name: 'Atelier Verdi', category: 'mode', prestige: 88, fameRequired: 52, baseAnnualValue: 1_700_000, competitorIds: ['maisonlune'], signatureColor: '#1f6f4a' },
  { id: 'urbano', name: 'Urbano Streetwear', category: 'mode', prestige: 74, fameRequired: 24, baseAnnualValue: 480_000, competitorIds: [], signatureColor: '#e8452a' },

  { id: 'aureus', name: 'Aureus Motors', category: 'automobile', prestige: 97, fameRequired: 72, baseAnnualValue: 2_400_000, competitorIds: ['ventari', 'norvik'], signatureColor: '#101820' },
  { id: 'ventari', name: 'Ventari', category: 'automobile', prestige: 94, fameRequired: 64, baseAnnualValue: 2_000_000, competitorIds: ['aureus', 'norvik'], signatureColor: '#c8102e' },
  { id: 'norvik', name: 'Norvik Automobiles', category: 'automobile', prestige: 82, fameRequired: 40, baseAnnualValue: 900_000, competitorIds: ['aureus', 'ventari'], signatureColor: '#3a5a7a' },

  { id: 'lumitech', name: 'Lumitech', category: 'electronique', prestige: 93, fameRequired: 50, baseAnnualValue: 1_600_000, competitorIds: ['nexawave'], signatureColor: '#0aa2c0' },
  { id: 'nexawave', name: 'Nexawave', category: 'electronique', prestige: 86, fameRequired: 38, baseAnnualValue: 1_000_000, competitorIds: ['lumitech'], signatureColor: '#5b2ea6' },

  { id: 'chronis', name: 'Chronis Genève', category: 'horlogerie', prestige: 98, fameRequired: 78, baseAnnualValue: 2_800_000, competitorIds: ['meridien'], signatureColor: '#0f3d2e' },
  { id: 'meridien', name: 'Méridien Horlogerie', category: 'horlogerie', prestige: 90, fameRequired: 60, baseAnnualValue: 1_400_000, competitorIds: ['chronis'], signatureColor: '#7a5c2e' },

  { id: 'skyalliance', name: 'Sky Alliance', category: 'aerien', prestige: 89, fameRequired: 45, baseAnnualValue: 1_200_000, competitorIds: ['azurjet'], signatureColor: '#1b4f9c' },
  { id: 'azurjet', name: 'AzurJet', category: 'aerien', prestige: 80, fameRequired: 30, baseAnnualValue: 700_000, competitorIds: ['skyalliance'], signatureColor: '#00a6a6' },

  { id: 'hydrafuel', name: 'HydraFuel', category: 'boisson', prestige: 78, fameRequired: 26, baseAnnualValue: 800_000, competitorIds: ['vitalix'], signatureColor: '#f4a300' },
  { id: 'vitalix', name: 'Vitalix', category: 'boisson', prestige: 72, fameRequired: 20, baseAnnualValue: 500_000, competitorIds: ['hydrafuel'], signatureColor: '#61b34a' },

  { id: 'meridia-estates', name: 'Meridia Estates', category: 'immobilier', prestige: 85, fameRequired: 55, baseAnnualValue: 900_000, competitorIds: [], signatureColor: '#8b6f47' },
] as const;

export type ProductCategory =
  | 'maillot'
  | 'chaussures'
  | 'crampons'
  | 'survetement'
  | 'costume'
  | 'montre'
  | 'bijou'
  | 'lunettes'
  | 'sac'
  | 'meuble'
  | 'decoration'
  | 'nourriture'
  | 'cadeau'
  | 'materielSport'
  | 'electronique'
  | 'oeuvreArt';

export interface ProductDef {
  readonly id: string;
  readonly name: string;
  readonly category: ProductCategory;
  readonly brandId: string;
  readonly priceEur: number;
  /** Rareté 0..1 : influence la valeur de collection et le prestige social. */
  readonly rarity: number;
  /** Prend de la valeur avec le temps (Tome XXIII, ch. 6). */
  readonly appreciates: boolean;
  /** Délai de livraison en heures de jeu. */
  readonly deliveryHours: number;
}

export const PRODUCTS: readonly ProductDef[] = [
  { id: 'velocis-maillot-pro', name: 'Maillot Pro Velocis', category: 'maillot', brandId: 'velocis', priceEur: 120, rarity: 0.2, appreciates: false, deliveryHours: 6 },
  { id: 'velocis-crampons-fx', name: 'Crampons Velocis FX', category: 'crampons', brandId: 'velocis', priceEur: 260, rarity: 0.35, appreciates: false, deliveryHours: 8 },
  { id: 'velocis-crampons-signature', name: 'Crampons Signature Édition Limitée', category: 'crampons', brandId: 'velocis', priceEur: 900, rarity: 0.85, appreciates: true, deliveryHours: 48 },
  { id: 'strider-runner', name: 'Strider Runner', category: 'chaussures', brandId: 'strider', priceEur: 180, rarity: 0.25, appreciates: false, deliveryHours: 6 },
  { id: 'strider-survet', name: 'Survêtement Strider Elite', category: 'survetement', brandId: 'strider', priceEur: 220, rarity: 0.3, appreciates: false, deliveryHours: 8 },
  { id: 'kaptor-training', name: 'Kit d’entraînement Kaptor', category: 'materielSport', brandId: 'kaptor', priceEur: 340, rarity: 0.2, appreciates: false, deliveryHours: 12 },
  { id: 'onze-ballon', name: 'Ballon Onze Match', category: 'materielSport', brandId: 'onze', priceEur: 90, rarity: 0.15, appreciates: false, deliveryHours: 4 },

  { id: 'maisonlune-costume', name: 'Costume sur mesure Maison Lune', category: 'costume', brandId: 'maisonlune', priceEur: 6_800, rarity: 0.7, appreciates: false, deliveryHours: 120 },
  { id: 'maisonlune-sac', name: 'Sac de voyage Maison Lune', category: 'sac', brandId: 'maisonlune', priceEur: 3_200, rarity: 0.6, appreciates: true, deliveryHours: 72 },
  { id: 'atelierverd-manteau', name: 'Manteau Atelier Verdi', category: 'costume', brandId: 'atelierverd', priceEur: 2_900, rarity: 0.55, appreciates: false, deliveryHours: 72 },
  { id: 'urbano-hoodie', name: 'Hoodie Urbano', category: 'survetement', brandId: 'urbano', priceEur: 150, rarity: 0.2, appreciates: false, deliveryHours: 6 },
  { id: 'urbano-lunettes', name: 'Lunettes Urbano Solar', category: 'lunettes', brandId: 'urbano', priceEur: 240, rarity: 0.3, appreciates: false, deliveryHours: 8 },

  { id: 'chronis-heritage', name: 'Chronis Heritage 1902', category: 'montre', brandId: 'chronis', priceEur: 82_000, rarity: 0.95, appreciates: true, deliveryHours: 168 },
  { id: 'chronis-sport', name: 'Chronis Sport Chrono', category: 'montre', brandId: 'chronis', priceEur: 24_000, rarity: 0.75, appreciates: true, deliveryHours: 96 },
  { id: 'meridien-classic', name: 'Méridien Classic', category: 'montre', brandId: 'meridien', priceEur: 9_500, rarity: 0.6, appreciates: true, deliveryHours: 72 },
  { id: 'meridien-bracelet', name: 'Bracelet Méridien Or', category: 'bijou', brandId: 'meridien', priceEur: 14_000, rarity: 0.7, appreciates: true, deliveryHours: 96 },

  { id: 'lumitech-phone', name: 'Lumitech Halo (smartphone)', category: 'electronique', brandId: 'lumitech', priceEur: 1_400, rarity: 0.3, appreciates: false, deliveryHours: 24 },
  { id: 'lumitech-tv', name: 'Lumitech Wall 98"', category: 'electronique', brandId: 'lumitech', priceEur: 12_000, rarity: 0.5, appreciates: false, deliveryHours: 72 },
  { id: 'nexawave-audio', name: 'Nexawave Studio Audio', category: 'electronique', brandId: 'nexawave', priceEur: 3_400, rarity: 0.4, appreciates: false, deliveryHours: 48 },

  { id: 'meridia-canape', name: 'Canapé modulaire Meridia', category: 'meuble', brandId: 'meridia-estates', priceEur: 18_000, rarity: 0.45, appreciates: false, deliveryHours: 120 },
  { id: 'meridia-deco', name: 'Ensemble décoration signature', category: 'decoration', brandId: 'meridia-estates', priceEur: 7_500, rarity: 0.4, appreciates: false, deliveryHours: 96 },
  { id: 'meridia-oeuvre', name: 'Œuvre contemporaine numérotée', category: 'oeuvreArt', brandId: 'meridia-estates', priceEur: 145_000, rarity: 0.92, appreciates: true, deliveryHours: 240 },

  { id: 'hydrafuel-pack', name: 'Pack HydraFuel Performance', category: 'nourriture', brandId: 'hydrafuel', priceEur: 60, rarity: 0.1, appreciates: false, deliveryHours: 2 },
  { id: 'vitalix-chef', name: 'Menu chef Vitalix (livraison)', category: 'nourriture', brandId: 'vitalix', priceEur: 180, rarity: 0.15, appreciates: false, deliveryHours: 1 },
  { id: 'urbano-cadeau', name: 'Coffret cadeau Urbano', category: 'cadeau', brandId: 'urbano', priceEur: 320, rarity: 0.25, appreciates: false, deliveryHours: 12 },
] as const;

export type VehicleCategory =
  | 'citadine'
  | 'berline'
  | 'suv'
  | 'supercar'
  | 'hypercar'
  | 'collection'
  | 'moto'
  | 'limousine'
  | 'utilitaire';

export interface VehicleDef {
  readonly id: string;
  readonly name: string;
  readonly brandId: string;
  readonly category: VehicleCategory;
  readonly priceEur: number;
  /** Vitesse maximale km/h. */
  readonly topSpeed: number;
  /** 0-100 km/h en secondes. */
  readonly acceleration: number;
  readonly seats: number;
  /** Consommation L/100km — influence les coûts d'entretien. */
  readonly consumption: number;
  /** Signature sonore du moteur (banque audio dédiée, Tome XXII ch. 3). */
  readonly engineSound: string;
  /** Description de l'intérieur complet modélisé. */
  readonly interior: string;
  readonly prestige: number;
  readonly appreciates: boolean;
}

export const VEHICLES: readonly VehicleDef[] = [
  { id: 'norvik-cita', name: 'Norvik Cita', brandId: 'norvik', category: 'citadine', priceEur: 24_000, topSpeed: 185, acceleration: 9.8, seats: 5, consumption: 5.2, engineSound: 'quatre cylindres sobre', interior: 'tissu technique, écran central 10"', prestige: 18, appreciates: false },
  { id: 'norvik-vega', name: 'Norvik Vega', brandId: 'norvik', category: 'berline', priceEur: 58_000, topSpeed: 240, acceleration: 6.4, seats: 5, consumption: 7.1, engineSound: 'six cylindres feutré', interior: 'cuir nappa, éclairage d’ambiance', prestige: 42, appreciates: false },
  { id: 'norvik-terra', name: 'Norvik Terra', brandId: 'norvik', category: 'suv', priceEur: 92_000, topSpeed: 250, acceleration: 5.6, seats: 7, consumption: 9.4, engineSound: 'V8 sourd', interior: 'sept places, toit panoramique', prestige: 55, appreciates: false },
  { id: 'ventari-corsa', name: 'Ventari Corsa', brandId: 'ventari', category: 'supercar', priceEur: 320_000, topSpeed: 330, acceleration: 2.9, seats: 2, consumption: 15.2, engineSound: 'V8 biturbo rageur', interior: 'baquets carbone, volant méplat', prestige: 88, appreciates: true },
  { id: 'ventari-strada', name: 'Ventari Strada GT', brandId: 'ventari', category: 'supercar', priceEur: 265_000, topSpeed: 315, acceleration: 3.3, seats: 2, consumption: 13.8, engineSound: 'V8 atmosphérique', interior: 'cuir rouge, sellerie surpiquée', prestige: 84, appreciates: true },
  { id: 'aureus-phantom', name: 'Aureus Phantom', brandId: 'aureus', category: 'hypercar', priceEur: 1_850_000, topSpeed: 380, acceleration: 2.4, seats: 2, consumption: 18.9, engineSound: 'W16 hurlant', interior: 'carbone apparent, compteur analogique', prestige: 99, appreciates: true },
  { id: 'aureus-noir', name: 'Aureus Noir Limousine', brandId: 'aureus', category: 'limousine', priceEur: 640_000, topSpeed: 250, acceleration: 5.1, seats: 5, consumption: 12.4, engineSound: 'V12 silencieux', interior: 'salon arrière, bar réfrigéré, séparation vitrée', prestige: 94, appreciates: false },
  { id: 'aureus-heritage', name: 'Aureus Heritage 1967', brandId: 'aureus', category: 'collection', priceEur: 780_000, topSpeed: 220, acceleration: 7.2, seats: 2, consumption: 16.5, engineSound: 'six en ligne vintage', interior: 'bois verni, cadrans chromés', prestige: 92, appreciates: true },
  { id: 'ventari-moto-r', name: 'Ventari Moto R', brandId: 'ventari', category: 'moto', priceEur: 42_000, topSpeed: 299, acceleration: 3.1, seats: 2, consumption: 6.4, engineSound: 'quatre cylindres aigu', interior: 'selle carbone, compteur TFT', prestige: 66, appreciates: false },
  { id: 'norvik-moto-city', name: 'Norvik City Moto', brandId: 'norvik', category: 'moto', priceEur: 11_000, topSpeed: 180, acceleration: 4.6, seats: 2, consumption: 4.1, engineSound: 'bicylindre urbain', interior: 'selle confort, coffre intégré', prestige: 24, appreciates: false },
  { id: 'norvik-van', name: 'Norvik Van Pro', brandId: 'norvik', category: 'utilitaire', priceEur: 46_000, topSpeed: 170, acceleration: 11.2, seats: 3, consumption: 8.8, engineSound: 'diesel régulier', interior: 'cabine haute, plancher plat', prestige: 12, appreciates: false },
] as const;

const BRAND_INDEX = new Map(BRANDS.map((b) => [b.id, b]));
const PRODUCT_INDEX = new Map(PRODUCTS.map((p) => [p.id, p]));
const VEHICLE_INDEX = new Map(VEHICLES.map((v) => [v.id, v]));

export function getBrand(id: string): BrandDef {
  const brand = BRAND_INDEX.get(id);
  if (!brand) throw new Error(`Marque inconnue : "${id}"`);
  return brand;
}

export function getProduct(id: string): ProductDef {
  const product = PRODUCT_INDEX.get(id);
  if (!product) throw new Error(`Produit inconnu : "${id}"`);
  return product;
}

export function getVehicle(id: string): VehicleDef {
  const vehicle = VEHICLE_INDEX.get(id);
  if (!vehicle) throw new Error(`Véhicule inconnu : "${id}"`);
  return vehicle;
}

export function brandsOfCategory(category: BrandCategory): BrandDef[] {
  return BRANDS.filter((b) => b.category === category);
}

export function productsOfBrand(brandId: string): ProductDef[] {
  return PRODUCTS.filter((p) => p.brandId === brandId);
}

export function vehiclesOfCategory(category: VehicleCategory): VehicleDef[] {
  return VEHICLES.filter((v) => v.category === category);
}
