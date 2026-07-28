/**
 * Infinity Football — Commerce / Boutiques, commandes et livraisons
 *
 * Tome XXX v2, ch. 5 : le joueur commande vêtements, chaussures, voitures,
 * meubles, décoration, nourriture, cadeaux et matériel de sport ; il choisit le
 * lieu de livraison (maison, hôtel, centre d'entraînement, stade, musée) et
 * « le livreur arrive physiquement et remet le colis ».
 * Tome XXIV, ch. 4-5 : boutiques officielles (essayage, personnalisation,
 * commande, livraison), concessionnaires (essai, configuration, options,
 * livraison mise en scène), vitrines qui changent selon les saisons.
 * Tome XXII, ch. 5 : nouvelles boutiques, magasins temporaires, pop-up stores,
 * collections limitées.
 */

import { clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { NAME_POOLS } from '../data/names.js';
import { PRODUCTS, VEHICLES, getBrand, getProduct, getVehicle, type ProductDef } from '../data/brands.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';

export const COMMERCE_SERVICE = 'commerce';

export type DeliveryTarget = 'maison' | 'hôtel' | 'centre d’entraînement' | 'stade' | 'musée';

export type OrderStatus =
  | 'panier'
  | 'confirmée'
  | 'préparation'
  | 'expédiée'
  | 'en cours de livraison'
  | 'livrée'
  | 'annulée';

export interface OrderLine {
  readonly productId: string;
  readonly label: string;
  readonly unitPrice: number;
  readonly quantity: number;
  /** Personnalisation demandée en boutique officielle. */
  readonly customisation: string | null;
}

export interface Order {
  readonly id: string;
  readonly lines: OrderLine[];
  readonly total: number;
  readonly target: DeliveryTarget;
  readonly cityId: string;
  status: OrderStatus;
  readonly placedAt: number;
  /** Minute absolue de livraison prévue. */
  expectedAt: number;
  readonly courierName: string;
  /** Suivi lisible affiché dans l'application Commandes. */
  readonly tracking: Array<{ at: number; label: string }>;
}

export interface FittingSession {
  readonly venueId: string;
  readonly productId: string;
  /** Impression du joueur 0..1 : influence la décision d'achat. */
  readonly fit: number;
  readonly customisationOptions: readonly string[];
}

export interface VehicleConfiguration {
  readonly definitionId: string;
  paint: string;
  interior: string;
  wheels: string;
  options: string[];
  /** Prix final, options comprises. */
  price: number;
}

export interface TestDriveBooking {
  readonly id: string;
  readonly venueId: string;
  readonly definitionId: string;
  readonly scheduledAt: number;
  completed: boolean;
  /** Impression laissée 0..1. */
  impression: number;
}

const PAINTS = ['noir profond', 'blanc nacré', 'gris titane', 'rouge course', 'bleu nuit', 'vert British'];
const INTERIORS = ['cuir noir', 'cuir camel', 'alcantara', 'tissu technique', 'bi-ton crème'];
const WHEELS = ['jantes 19"', 'jantes 20" forgées', 'jantes 21" carbone', 'jantes rétro'];
const VEHICLE_OPTIONS = [
  { label: 'toit ouvrant panoramique', price: 4_200 },
  { label: 'système audio haute fidélité', price: 6_800 },
  { label: 'sièges chauffants et ventilés', price: 2_900 },
  { label: 'pack aérodynamique carbone', price: 14_500 },
  { label: 'freins céramique', price: 11_000 },
  { label: 'peinture personnalisée', price: 9_400 },
  { label: 'affichage tête haute', price: 2_100 },
];

const CUSTOMISATIONS = [
  'floquage du nom',
  'numéro personnalisé',
  'broderie initiales',
  'coloris exclusif',
  'semelle gravée',
];

export class CommerceSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'commerce',
    name: 'Commerce & livraisons',
    order: 70,
    tomes: ['XXIV', 'XXVI', 'XXX'],
  };

  private context!: SimulationContext;
  private economy!: EconomySystem;
  private career: CareerSystem | null = null;
  private world!: WorldSystem;

  private readonly orders = new Map<string, Order>();
  private readonly cart: OrderLine[] = [];
  private readonly testDrives = new Map<string, TestDriveBooking>();
  private orderCounter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    context.provide(COMMERCE_SERVICE, this);
  }

  // ── Catalogue ────────────────────────────────────────────────────────────

  /**
   * Catalogue accessible : les marques bloquées par un contrat d'équipementier
   * exclusif sont retirées (Tome XXII, ch. 4 ; Tome XXIV, ch. 3).
   */
  catalogue(options: { category?: ProductDef['category']; cityId?: string } = {}): ProductDef[] {
    let items = [...PRODUCTS];
    if (options.category) items = items.filter((p) => p.category === options.category);
    if (this.career?.hasCareer) {
      items = items.filter((p) => this.career?.canUseBrand(p.brandId) ?? true);
    }
    if (options.cityId) {
      // Les collections limitées ne sont pas partout : filtrées par la ville.
      const seed = options.cityId.length;
      items = items.filter((p) => p.rarity < 0.8 || (p.id.length + seed) % 3 !== 0);
    }
    return items;
  }

  /** Produits indisponibles à cause d'un contrat exclusif, avec la raison. */
  blockedProducts(): Array<{ product: ProductDef; reason: string }> {
    if (!this.career?.hasCareer) return [];
    const contract = this.career.boots;
    if (!contract) return [];
    return PRODUCTS.filter((p) => contract.blockedBrandIds.includes(p.brandId)).map((product) => ({
      product,
      reason: `contrat exclusif avec ${getBrand(contract.brandId).name} jusqu'à la saison ${contract.expiresSeason}`,
    }));
  }

  // ── Essayage & personnalisation en boutique ──────────────────────────────

  /** Tome XXIV, ch. 4 — essayer les vêtements en boutique officielle. */
  tryOn(venueId: string, productId: string): FittingSession | null {
    const product = getProduct(productId);
    if (this.career?.hasCareer && !this.career.canUseBrand(product.brandId)) return null;
    const rng = this.context.stream('commerce.fitting');
    return {
      venueId,
      productId,
      fit: clamp01(rng.gaussian(0.7, 0.15)),
      customisationOptions: rng.pickMany(CUSTOMISATIONS, 3),
    };
  }

  // ── Panier & commandes ───────────────────────────────────────────────────

  addToCart(productId: string, quantity = 1, customisation: string | null = null): boolean {
    const product = getProduct(productId);
    if (this.career?.hasCareer && !this.career.canUseBrand(product.brandId)) return false;
    this.cart.push({
      productId,
      label: product.name,
      unitPrice: product.priceEur + (customisation ? Math.round(product.priceEur * 0.12) : 0),
      quantity,
      customisation,
    });
    return true;
  }

  clearCart(): void {
    this.cart.length = 0;
  }

  get cartLines(): readonly OrderLine[] {
    return this.cart;
  }

  get cartTotal(): number {
    return round(this.cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), 2);
  }

  /** Valide la commande, débite le compte et planifie la livraison. */
  checkout(target: DeliveryTarget, cityId: string): Order | null {
    if (this.cart.length === 0) return null;
    const total = this.cartTotal;
    if (!this.economy.canAfford(total, 'courant')) return null;

    const rng = this.context.stream('commerce.orders');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    const now = this.context.clock.absoluteMinutes;
    const slowest = this.cart.reduce(
      (max, line) => Math.max(max, getProduct(line.productId).deliveryHours),
      1,
    );
    // Un concierge accélère les livraisons (Tome XXIII, ch. 5).
    const conciergeBoost = 1 - this.economy.serviceQuality('concierge') * 0.35;

    const order: Order = {
      id: `order:${this.orderCounter++}`,
      lines: [...this.cart],
      total,
      target,
      cityId,
      status: 'confirmée',
      placedAt: now,
      expectedAt: now + Math.round(slowest * 60 * conciergeBoost),
      courierName: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
      tracking: [{ at: now, label: 'commande confirmée' }],
    };
    this.orders.set(order.id, order);
    this.cart.length = 0;

    this.economy.record('courant', -total, 'achats', `commande ${order.id} (${order.lines.length} article(s))`);
    this.context.emit({
      type: 'commerce.orderPlaced',
      orderId: order.id,
      total,
      deliveryTarget: target,
    });
    return order;
  }

  order(id: string): Order | undefined {
    return this.orders.get(id);
  }

  get allOrders(): Order[] {
    return [...this.orders.values()].sort((a, b) => b.placedAt - a.placedAt);
  }

  get pendingOrders(): Order[] {
    return this.allOrders.filter((o) => o.status !== 'livrée' && o.status !== 'annulée');
  }

  cancelOrder(orderId: string): boolean {
    const order = this.orders.get(orderId);
    if (!order || order.status === 'livrée' || order.status === 'annulée') return false;
    order.status = 'annulée';
    order.tracking.push({ at: this.context.clock.absoluteMinutes, label: 'commande annulée' });
    this.economy.record('courant', order.total, 'remboursement', `annulation ${order.id}`);
    return true;
  }

  // ── Concessionnaires (Tome XXIV, ch. 5) ──────────────────────────────────

  configureVehicle(definitionId: string, choices: Partial<VehicleConfiguration> = {}): VehicleConfiguration {
    const definition = getVehicle(definitionId);
    const rng = this.context.stream('commerce.vehicles');
    const options = choices.options ?? [];
    const optionsPrice = options.reduce(
      (sum, label) => sum + (VEHICLE_OPTIONS.find((o) => o.label === label)?.price ?? 0),
      0,
    );
    return {
      definitionId,
      paint: choices.paint ?? rng.pick(PAINTS),
      interior: choices.interior ?? rng.pick(INTERIORS),
      wheels: choices.wheels ?? rng.pick(WHEELS),
      options,
      price: definition.priceEur + optionsPrice,
    };
  }

  get vehicleOptions(): typeof VEHICLE_OPTIONS {
    return VEHICLE_OPTIONS;
  }

  availableVehicles(): typeof VEHICLES {
    if (!this.career?.hasCareer) return VEHICLES;
    return VEHICLES.filter((v) => this.career?.canUseBrand(v.brandId) ?? true);
  }

  bookTestDrive(venueId: string, definitionId: string, inHours = 24): TestDriveBooking {
    const booking: TestDriveBooking = {
      id: `testdrive:${this.orderCounter++}`,
      venueId,
      definitionId,
      scheduledAt: this.context.clock.absoluteMinutes + inHours * 60,
      completed: false,
      impression: 0,
    };
    this.testDrives.set(booking.id, booking);
    return booking;
  }

  completeTestDrive(bookingId: string): TestDriveBooking | null {
    const booking = this.testDrives.get(bookingId);
    if (!booking || booking.completed) return null;
    const rng = this.context.stream('commerce.testdrive');
    const definition = getVehicle(booking.definitionId);
    booking.completed = true;
    booking.impression = clamp01(
      rng.gaussian(0.5 + definition.prestige / 250 + (1 / definition.acceleration) * 0.5, 0.12),
    );
    return booking;
  }

  /**
   * Commande d'un véhicule : livraison mise en scène (Tome XVI, ch. 6 —
   * cinématique « livraison d'une voiture »).
   */
  orderVehicle(
    configuration: VehicleConfiguration,
    garageVenueId: string | null,
    deliveryDays = 21,
  ): Order | null {
    if (!this.economy.canAfford(configuration.price, 'courant')) return null;
    const definition = getVehicle(configuration.definitionId);
    const rng = this.context.stream('commerce.vehicleOrder');
    const pool = NAME_POOLS[0] as (typeof NAME_POOLS)[number];
    const now = this.context.clock.absoluteMinutes;

    const order: Order = {
      id: `order:${this.orderCounter++}`,
      lines: [
        {
          productId: `vehicle:${configuration.definitionId}`,
          label: `${definition.name} — ${configuration.paint}, ${configuration.interior}, ${configuration.wheels}`,
          unitPrice: configuration.price,
          quantity: 1,
          customisation: configuration.options.join(', ') || null,
        },
      ],
      total: configuration.price,
      target: 'maison',
      cityId: this.currentCityId(),
      status: 'confirmée',
      placedAt: now,
      expectedAt: now + deliveryDays * 24 * 60,
      courierName: `${rng.pick(pool.given)} ${rng.pick(pool.family)}`,
      tracking: [{ at: now, label: 'configuration validée en concession' }],
    };
    this.orders.set(order.id, order);
    this.economy.record('courant', -configuration.price, 'véhicule', `commande — ${definition.name}`);

    // Le véhicule entre au garage à la livraison, via le suivi de commande.
    this.pendingVehicleDeliveries.set(order.id, { definitionId: configuration.definitionId, garageVenueId });

    this.context.emit({
      type: 'commerce.orderPlaced',
      orderId: order.id,
      total: configuration.price,
      deliveryTarget: 'maison',
    });
    return order;
  }

  private readonly pendingVehicleDeliveries = new Map<
    string,
    { definitionId: string; garageVenueId: string | null }
  >();

  // ── Suivi des livraisons ─────────────────────────────────────────────────

  onHour(context: SimulationContext, _date: GameDate): void {
    const now = context.clock.absoluteMinutes;
    for (const order of this.orders.values()) {
      if (order.status === 'livrée' || order.status === 'annulée') continue;
      const elapsed = now - order.placedAt;
      const total = Math.max(1, order.expectedAt - order.placedAt);
      const progress = elapsed / total;

      const advance = (status: OrderStatus, label: string): void => {
        if (order.status === status) return;
        order.status = status;
        order.tracking.push({ at: now, label });
      };

      if (progress >= 1) {
        advance('livrée', `colis remis en main propre par ${order.courierName} — ${order.target}`);
        this.completeDelivery(order, context);
      } else if (progress >= 0.85) {
        advance('en cours de livraison', `${order.courierName} est en route`);
      } else if (progress >= 0.5) {
        advance('expédiée', 'colis expédié du centre logistique');
      } else if (progress >= 0.15) {
        advance('préparation', 'commande en préparation');
      }
    }
  }

  private completeDelivery(order: Order, context: SimulationContext): void {
    context.emit({
      type: 'commerce.orderDelivered',
      orderId: order.id,
      courierName: order.courierName,
      deliveryTarget: order.target,
    });

    // Livraison de véhicule : mise en scène dédiée et entrée au garage.
    const vehicleDelivery = this.pendingVehicleDeliveries.get(order.id);
    if (vehicleDelivery) {
      this.pendingVehicleDeliveries.delete(order.id);
      // Le paiement a eu lieu à la commande : on inscrit l'actif sans redébiter.
      this.economy.registerVehicle(vehicleDelivery.definitionId, vehicleDelivery.garageVenueId);
      context.emit({
        type: 'cinematic.played',
        cinematicId: 'delivery.vehicle',
        category: 'open world',
        durationSeconds: 65,
        skipped: false,
      });
      return;
    }

    // Les objets de luxe rejoignent la collection patrimoniale.
    for (const line of order.lines) {
      if (line.productId.startsWith('vehicle:')) continue;
      const product = getProduct(line.productId);
      if (product.appreciates && product.priceEur > 5000) {
        // Déjà payé à la commande : entrée directe au patrimoine.
        this.economy.registerCollectible(product);
      }
    }
    context.emit({
      type: 'cinematic.played',
      cinematicId: 'delivery.parcel',
      category: 'open world',
      durationSeconds: 22,
      skipped: false,
    });
  }

  // ── Vitrines saisonnières & pop-up stores ────────────────────────────────

  onSeason(context: SimulationContext, season: string): void {
    const rng = context.stream('commerce.season');
    for (const city of this.world.cities()) {
      // Ouverture de pop-up stores éphémères dans les grandes villes.
      if (city.def.tier > 2) continue;
      const popups = [...city.venues.values()].filter((v) => v.type === 'popupStore');
      for (const popup of popups) {
        const opening = rng.chance(0.6);
        popup.status = opening ? 'open' : 'closed';
        popup.windowDisplay = `collection capsule ${season}`;
        context.emit({
          type: 'world.businessLifecycle',
          venueId: popup.id,
          cityId: city.id,
          change: opening ? 'popupOpened' : 'popupClosed',
        });
      }
    }
  }

  private currentCityId(): string {
    const cities = this.world.cities();
    return cities[0]?.id ?? 'paris';
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      orders: [...this.orders.values()],
      cart: this.cart,
      testDrives: [...this.testDrives.values()],
      pendingVehicleDeliveries: [...this.pendingVehicleDeliveries.entries()],
      orderCounter: this.orderCounter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.orders.clear();
    for (const order of (state.orders as Order[]) ?? []) this.orders.set(order.id, order);
    this.cart.length = 0;
    this.cart.push(...(((state.cart as OrderLine[]) ?? [])));
    this.testDrives.clear();
    for (const booking of (state.testDrives as TestDriveBooking[]) ?? []) {
      this.testDrives.set(booking.id, booking);
    }
    this.pendingVehicleDeliveries.clear();
    for (const [id, payload] of ((state.pendingVehicleDeliveries as [string, { definitionId: string; garageVenueId: string | null }][]) ?? [])) {
      this.pendingVehicleDeliveries.set(id, payload);
    }
    this.orderCounter = (state.orderCounter as number) ?? 0;
  }
}
