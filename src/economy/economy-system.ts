/**
 * Infinity Football — Économie / Patrimoine
 *
 * Tome XXIII intégralement : comptes bancaires, investissements, immobilier,
 * employés, objets de luxe et succession.
 * « L'argent ne doit pas être un simple chiffre » : chaque euro transite par un
 * compte identifié, chaque transaction est archivée, chaque actif a une valeur
 * qui évolue dans le temps, avec rendement et risque.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { getProduct, getVehicle, type ProductDef, type VehicleDef } from '../data/brands.js';
import { getCountry } from '../data/countries.js';
import { getCity } from '../data/cities.js';

export const ECONOMY_SERVICE = 'economy';

export type AccountKind = 'courant' | 'epargne' | 'professionnel' | 'investissement';

export interface Account {
  readonly id: string;
  readonly kind: AccountKind;
  readonly label: string;
  balance: number;
  /** Taux annuel appliqué mensuellement (épargne). */
  readonly annualRate: number;
  readonly currency: string;
}

export interface Transaction {
  readonly id: string;
  readonly accountId: string;
  readonly amount: number;
  readonly category: string;
  readonly label: string;
  readonly at: number;
  readonly balanceAfter: number;
}

export type InvestmentKind =
  | 'immobilier'
  | 'hotel'
  | 'centreCommercial'
  | 'restaurant'
  | 'academie'
  | 'salleDeSport'
  | 'marqueVetements'
  | 'entrepriseTech'
  | 'clubDeFootball';

export interface Investment {
  readonly id: string;
  readonly kind: InvestmentKind;
  readonly label: string;
  readonly cityId: string;
  /** Capital investi. */
  readonly principal: number;
  /** Valeur actuelle. */
  value: number;
  /** Rendement annuel attendu (peut être négatif certains mois). */
  readonly expectedAnnualReturn: number;
  /** Volatilité 0..1. */
  readonly risk: number;
  readonly openedAt: number;
  /** Revenus cumulés versés. */
  cumulativeIncome: number;
  active: boolean;
}

export type PropertyKind =
  | 'appartement'
  | 'maison'
  | 'villa'
  | 'penthouse'
  | 'chalet'
  | 'ilePrivee'
  | 'immeuble';

export interface Property {
  readonly id: string;
  readonly kind: PropertyKind;
  readonly label: string;
  readonly cityId: string;
  readonly venueId: string | null;
  purchasePrice: number;
  value: number;
  /** Niveau de décoration 0..1. */
  decoration: number;
  /** Niveau de rénovation 0..1. */
  condition: number;
  /** Agrandissements réalisés. */
  extensions: number;
  /** Loué ? Génère un revenu mensuel. */
  rented: boolean;
  monthlyRent: number;
  /** Charges mensuelles (entretien, personnel, taxes). */
  monthlyCosts: number;
  readonly boughtAt: number;
}

export type EmployeeRole =
  | 'chauffeur'
  | 'chef cuisinier'
  | 'jardinier'
  | 'personnel de maison'
  | 'garde du corps'
  | 'assistant personnel'
  | 'pilote privé'
  | 'concierge';

export interface Employee {
  readonly id: string;
  readonly name: string;
  readonly role: EmployeeRole;
  /** Compétence 0..1 : qualité du service rendu. */
  readonly skill: number;
  /** Loyauté 0..1. */
  loyalty: number;
  readonly monthlySalary: number;
  readonly hiredAt: number;
  assignedPropertyId: string | null;
}

export type CollectibleKind = 'montre' | 'bijou' | 'oeuvreArt' | 'trophee' | 'voitureCollection';

export interface Collectible {
  readonly id: string;
  readonly kind: CollectibleKind;
  readonly label: string;
  readonly acquiredAt: number;
  purchasePrice: number;
  value: number;
  /** Tendance annuelle (peut être négative). */
  readonly appreciationRate: number;
  /** Exposé au musée personnel ou à la résidence. */
  displayedAt: string | null;
}

export interface OwnedVehicle {
  readonly id: string;
  readonly definitionId: string;
  readonly label: string;
  purchasePrice: number;
  value: number;
  /** Kilométrage. */
  odometerKm: number;
  /** État 0..1. */
  condition: number;
  garageVenueId: string | null;
  readonly acquiredAt: number;
}

export interface Legacy {
  /** Bénéficiaires et parts (0..1). */
  readonly beneficiaries: Array<{ personId: string; share: number }>;
  foundationId: string | null;
  academyFunded: boolean;
  museumBequeathed: boolean;
  donationsTotal: number;
}

export class EconomySystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'economy',
    name: 'Économie & patrimoine',
    order: 40,
    tomes: ['XXIII', 'XXIV', 'XXVI'],
  };

  private context!: SimulationContext;
  private readonly accounts = new Map<string, Account>();
  private readonly transactions: Transaction[] = [];
  private readonly investments = new Map<string, Investment>();
  private readonly properties = new Map<string, Property>();
  private readonly employees = new Map<string, Employee>();
  private readonly collectibles = new Map<string, Collectible>();
  private readonly vehicles = new Map<string, OwnedVehicle>();
  private legacy: Legacy = {
    beneficiaries: [],
    foundationId: null,
    academyFunded: false,
    museumBequeathed: false,
    donationsTotal: 0,
  };
  private transactionCounter = 0;
  private assetCounter = 0;
  /** Plafond d'historique conservé en mémoire vive. */
  private readonly transactionCap = 5000;

  init(context: SimulationContext): void {
    this.context = context;
    context.provide(ECONOMY_SERVICE, this);
    this.openAccount('courant', 'Compte courant', 0, 0);
    this.openAccount('epargne', 'Compte épargne', 0, 0.021);
    this.openAccount('professionnel', 'Compte professionnel', 0, 0.005);
    this.openAccount('investissement', 'Portefeuille d’investissement', 0, 0);
  }

  // ── Comptes & transactions ───────────────────────────────────────────────

  openAccount(kind: AccountKind, label: string, initialBalance: number, annualRate: number): Account {
    const account: Account = {
      id: `account:${kind}`,
      kind,
      label,
      balance: initialBalance,
      annualRate,
      currency: 'EUR',
    };
    this.accounts.set(account.id, account);
    return account;
  }

  account(kind: AccountKind): Account {
    const account = this.accounts.get(`account:${kind}`);
    if (!account) throw new Error(`Compte inexistant : ${kind}`);
    return account;
  }

  get allAccounts(): Account[] {
    return [...this.accounts.values()];
  }

  /** Solde total tous comptes confondus. */
  get liquidity(): number {
    let total = 0;
    for (const account of this.accounts.values()) total += account.balance;
    return round(total, 2);
  }

  /**
   * Enregistre un mouvement. Un montant positif crédite, négatif débite.
   * Le débit est autorisé même à découvert : le joueur reste responsable de
   * ses choix, et un solde négatif déclenche des alertes de l'IA secrétaire.
   */
  record(
    kind: AccountKind,
    amount: number,
    category: string,
    label: string,
  ): Transaction {
    const account = this.account(kind);
    account.balance = round(account.balance + amount, 2);
    const transaction: Transaction = {
      id: `tx:${this.transactionCounter++}`,
      accountId: account.id,
      amount: round(amount, 2),
      category,
      label,
      at: this.context.clock.absoluteMinutes,
      balanceAfter: account.balance,
    };
    this.transactions.push(transaction);
    if (this.transactions.length > this.transactionCap) {
      this.transactions.splice(0, this.transactions.length - this.transactionCap);
    }
    this.context.emit({
      type: 'economy.transaction',
      accountId: account.id,
      amount: transaction.amount,
      category,
      label,
      balanceAfter: account.balance,
    });
    return transaction;
  }

  /** Peut-on payer ce montant depuis un compte ? */
  canAfford(amount: number, kind: AccountKind = 'courant'): boolean {
    return this.account(kind).balance >= amount;
  }

  transfer(from: AccountKind, to: AccountKind, amount: number): boolean {
    if (amount <= 0 || !this.canAfford(amount, from)) return false;
    this.record(from, -amount, 'virement', `vers ${to}`);
    this.record(to, amount, 'virement', `depuis ${from}`);
    return true;
  }

  history(options: { limit?: number; category?: string } = {}): Transaction[] {
    const filtered = options.category
      ? this.transactions.filter((t) => t.category === options.category)
      : this.transactions;
    const limit = options.limit ?? 50;
    return filtered.slice(Math.max(0, filtered.length - limit)).reverse();
  }

  /** Revenus et dépenses agrégés sur une fenêtre de jours. */
  summary(days = 30): { income: number; expenses: number; net: number; byCategory: Record<string, number> } {
    const since = this.context.clock.absoluteMinutes - days * 24 * 60;
    let income = 0;
    let expenses = 0;
    const byCategory: Record<string, number> = {};
    for (const transaction of this.transactions) {
      if (transaction.at < since) continue;
      if (transaction.amount >= 0) income += transaction.amount;
      else expenses += -transaction.amount;
      byCategory[transaction.category] = round(
        (byCategory[transaction.category] ?? 0) + transaction.amount,
        2,
      );
    }
    return { income: round(income, 2), expenses: round(expenses, 2), net: round(income - expenses, 2), byCategory };
  }

  // ── Investissements ──────────────────────────────────────────────────────

  invest(
    kind: InvestmentKind,
    label: string,
    cityId: string,
    principal: number,
  ): Investment | null {
    if (!this.canAfford(principal, 'courant')) return null;
    const rng = this.context.stream('economy.invest');
    const risk = this.riskFor(kind);
    const baseReturn = this.returnFor(kind);
    const cityFactor = this.cityEconomicFactor(cityId);
    const investment: Investment = {
      id: `inv:${this.assetCounter++}`,
      kind,
      label,
      cityId,
      principal,
      value: principal,
      expectedAnnualReturn: round(baseReturn * cityFactor * rng.range(0.85, 1.2), 4),
      risk,
      openedAt: this.context.clock.absoluteMinutes,
      cumulativeIncome: 0,
      active: true,
    };
    this.investments.set(investment.id, investment);
    this.record('courant', -principal, 'investissement', `ouverture — ${label}`);
    this.context.emit({
      type: 'economy.investment',
      investmentId: investment.id,
      action: 'opened',
      amount: principal,
    });
    return investment;
  }

  sellInvestment(investmentId: string): number {
    const investment = this.investments.get(investmentId);
    if (!investment || !investment.active) return 0;
    investment.active = false;
    const proceeds = round(investment.value, 2);
    this.record('courant', proceeds, 'investissement', `cession — ${investment.label}`);
    this.context.emit({
      type: 'economy.investment',
      investmentId,
      action: 'sold',
      amount: proceeds,
    });
    return proceeds;
  }

  get activeInvestments(): Investment[] {
    return [...this.investments.values()].filter((i) => i.active);
  }

  private riskFor(kind: InvestmentKind): number {
    const table: Record<InvestmentKind, number> = {
      immobilier: 0.15,
      hotel: 0.3,
      centreCommercial: 0.28,
      restaurant: 0.45,
      academie: 0.35,
      salleDeSport: 0.32,
      marqueVetements: 0.55,
      entrepriseTech: 0.7,
      clubDeFootball: 0.6,
    };
    return table[kind];
  }

  private returnFor(kind: InvestmentKind): number {
    const table: Record<InvestmentKind, number> = {
      immobilier: 0.055,
      hotel: 0.085,
      centreCommercial: 0.075,
      restaurant: 0.11,
      academie: 0.06,
      salleDeSport: 0.09,
      marqueVetements: 0.14,
      entrepriseTech: 0.19,
      clubDeFootball: 0.05,
    };
    return table[kind];
  }

  private cityEconomicFactor(cityId: string): number {
    try {
      const city = getCity(cityId);
      const country = getCountry(city.countryId);
      return 0.7 + country.costOfLiving * 0.4 + city.tourism * 0.2;
    } catch {
      return 1;
    }
  }

  // ── Immobilier ───────────────────────────────────────────────────────────

  buyProperty(
    kind: PropertyKind,
    label: string,
    cityId: string,
    price: number,
    venueId: string | null = null,
  ): Property | null {
    if (!this.canAfford(price, 'courant')) return null;
    const property: Property = {
      id: `prop:${this.assetCounter++}`,
      kind,
      label,
      cityId,
      venueId,
      purchasePrice: price,
      value: price,
      decoration: 0.3,
      condition: 0.85,
      extensions: 0,
      rented: false,
      monthlyRent: 0,
      monthlyCosts: round(price * 0.0012, 2),
      boughtAt: this.context.clock.absoluteMinutes,
    };
    this.properties.set(property.id, property);
    this.record('courant', -price, 'immobilier', `achat — ${label}`);
    this.context.emit({ type: 'economy.property', propertyId: property.id, action: 'bought', amount: price });
    return property;
  }

  sellProperty(propertyId: string): number {
    const property = this.properties.get(propertyId);
    if (!property) return 0;
    const proceeds = round(property.value, 2);
    this.properties.delete(propertyId);
    this.record('courant', proceeds, 'immobilier', `vente — ${property.label}`);
    this.context.emit({ type: 'economy.property', propertyId, action: 'sold', amount: proceeds });
    return proceeds;
  }

  renovateProperty(propertyId: string, budget: number): boolean {
    const property = this.properties.get(propertyId);
    if (!property || !this.canAfford(budget, 'courant')) return false;
    property.condition = clamp01(property.condition + budget / Math.max(1, property.value) * 3);
    property.value = round(property.value * (1 + budget / Math.max(1, property.value) * 0.6), 2);
    this.record('courant', -budget, 'immobilier', `rénovation — ${property.label}`);
    this.context.emit({ type: 'economy.property', propertyId, action: 'renovated', amount: budget });
    return true;
  }

  decorateProperty(propertyId: string, budget: number): boolean {
    const property = this.properties.get(propertyId);
    if (!property || !this.canAfford(budget, 'courant')) return false;
    property.decoration = clamp01(property.decoration + budget / Math.max(1, property.value) * 4);
    property.value = round(property.value * (1 + budget / Math.max(1, property.value) * 0.3), 2);
    this.record('courant', -budget, 'immobilier', `décoration — ${property.label}`);
    this.context.emit({ type: 'economy.property', propertyId, action: 'decorated', amount: budget });
    return true;
  }

  expandProperty(propertyId: string, budget: number): boolean {
    const property = this.properties.get(propertyId);
    if (!property || !this.canAfford(budget, 'courant')) return false;
    property.extensions += 1;
    property.value = round(property.value + budget * 1.15, 2);
    property.monthlyCosts = round(property.monthlyCosts * 1.1, 2);
    this.record('courant', -budget, 'immobilier', `agrandissement — ${property.label}`);
    this.context.emit({ type: 'economy.property', propertyId, action: 'expanded', amount: budget });
    return true;
  }

  rentOutProperty(propertyId: string, monthlyRent: number): boolean {
    const property = this.properties.get(propertyId);
    if (!property) return false;
    property.rented = true;
    property.monthlyRent = monthlyRent;
    this.context.emit({ type: 'economy.property', propertyId, action: 'rented', amount: monthlyRent });
    return true;
  }

  get allProperties(): Property[] {
    return [...this.properties.values()];
  }

  property(id: string): Property | undefined {
    return this.properties.get(id);
  }

  // ── Employés ─────────────────────────────────────────────────────────────

  hire(
    name: string,
    role: EmployeeRole,
    skill: number,
    monthlySalary: number,
    propertyId: string | null = null,
  ): Employee {
    const employee: Employee = {
      id: `emp:${this.assetCounter++}`,
      name,
      role,
      skill: clamp01(skill),
      loyalty: 0.5,
      monthlySalary,
      hiredAt: this.context.clock.absoluteMinutes,
      assignedPropertyId: propertyId,
    };
    this.employees.set(employee.id, employee);
    this.context.emit({
      type: 'economy.employee',
      employeeId: employee.id,
      action: 'hired',
      role,
      amount: monthlySalary,
    });
    return employee;
  }

  fire(employeeId: string): boolean {
    const employee = this.employees.get(employeeId);
    if (!employee) return false;
    this.employees.delete(employeeId);
    // Indemnité d'un mois.
    this.record('courant', -employee.monthlySalary, 'personnel', `départ — ${employee.name}`);
    this.context.emit({
      type: 'economy.employee',
      employeeId,
      action: 'fired',
      role: employee.role,
      amount: employee.monthlySalary,
    });
    return true;
  }

  get staff(): Employee[] {
    return [...this.employees.values()];
  }

  hasRole(role: EmployeeRole): boolean {
    for (const employee of this.employees.values()) if (employee.role === role) return true;
    return false;
  }

  /** Qualité de service cumulée d'un rôle (0 si absent). */
  serviceQuality(role: EmployeeRole): number {
    let best = 0;
    for (const employee of this.employees.values()) {
      if (employee.role === role) best = Math.max(best, employee.skill * (0.6 + employee.loyalty * 0.4));
    }
    return best;
  }

  // ── Luxe & véhicules ─────────────────────────────────────────────────────

  buyCollectible(product: ProductDef | { id: string; name: string; priceEur: number; appreciates: boolean }): Collectible | null {
    const price = product.priceEur;
    if (!this.canAfford(price, 'courant')) return null;
    const rng = this.context.stream('economy.luxury');
    const kind: CollectibleKind =
      'category' in product && product.category === 'montre'
        ? 'montre'
        : 'category' in product && product.category === 'bijou'
          ? 'bijou'
          : 'category' in product && product.category === 'oeuvreArt'
            ? 'oeuvreArt'
            : 'montre';
    const collectible: Collectible = {
      id: `col:${this.assetCounter++}`,
      kind,
      label: product.name,
      acquiredAt: this.context.clock.absoluteMinutes,
      purchasePrice: price,
      value: price,
      appreciationRate: product.appreciates ? rng.range(0.03, 0.13) : rng.range(-0.14, -0.03),
      displayedAt: null,
    };
    this.collectibles.set(collectible.id, collectible);
    this.record('courant', -price, 'luxe', `achat — ${product.name}`);
    return collectible;
  }

  /** Ajoute un trophée à la collection : valeur symbolique, jamais revendable. */
  addTrophyToCollection(label: string): Collectible {
    const collectible: Collectible = {
      id: `col:${this.assetCounter++}`,
      kind: 'trophee',
      label,
      acquiredAt: this.context.clock.absoluteMinutes,
      purchasePrice: 0,
      value: 0,
      appreciationRate: 0,
      displayedAt: 'musée personnel',
    };
    this.collectibles.set(collectible.id, collectible);
    return collectible;
  }

  displayCollectible(collectibleId: string, location: string): boolean {
    const collectible = this.collectibles.get(collectibleId);
    if (!collectible) return false;
    collectible.displayedAt = location;
    return true;
  }

  get collection(): Collectible[] {
    return [...this.collectibles.values()];
  }

  buyVehicle(definitionId: string, garageVenueId: string | null = null): OwnedVehicle | null {
    const definition: VehicleDef = getVehicle(definitionId);
    if (!this.canAfford(definition.priceEur, 'courant')) return null;
    const vehicle: OwnedVehicle = {
      id: `veh:${this.assetCounter++}`,
      definitionId,
      label: definition.name,
      purchasePrice: definition.priceEur,
      value: definition.priceEur,
      odometerKm: 0,
      condition: 1,
      garageVenueId,
      acquiredAt: this.context.clock.absoluteMinutes,
    };
    this.vehicles.set(vehicle.id, vehicle);
    this.record('courant', -definition.priceEur, 'véhicule', `achat — ${definition.name}`);
    return vehicle;
  }

  sellVehicle(vehicleId: string): number {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return 0;
    const proceeds = round(vehicle.value * vehicle.condition, 2);
    this.vehicles.delete(vehicleId);
    this.record('courant', proceeds, 'véhicule', `vente — ${vehicle.label}`);
    return proceeds;
  }

  /** Enregistre les kilomètres parcourus : usure et entretien. */
  driveVehicle(vehicleId: string, km: number): void {
    const vehicle = this.vehicles.get(vehicleId);
    if (!vehicle) return;
    vehicle.odometerKm = round(vehicle.odometerKm + km, 1);
    vehicle.condition = clamp01(vehicle.condition - km * 0.00002);
    const definition = getVehicle(vehicle.definitionId);
    const fuelCost = round((km / 100) * definition.consumption * 1.85, 2);
    if (fuelCost > 0) this.record('courant', -fuelCost, 'véhicule', `carburant — ${vehicle.label}`);
  }

  get garage(): OwnedVehicle[] {
    return [...this.vehicles.values()];
  }

  // ── Patrimoine global ────────────────────────────────────────────────────

  get netWorth(): number {
    let total = this.liquidity;
    for (const investment of this.investments.values()) if (investment.active) total += investment.value;
    for (const property of this.properties.values()) total += property.value;
    for (const collectible of this.collectibles.values()) total += collectible.value;
    for (const vehicle of this.vehicles.values()) total += vehicle.value * vehicle.condition;
    return round(total, 2);
  }

  get monthlyCommitments(): number {
    let total = 0;
    for (const employee of this.employees.values()) total += employee.monthlySalary;
    for (const property of this.properties.values()) total += property.monthlyCosts;
    return round(total, 2);
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onMonth(context: SimulationContext, date: GameDate): void {
    const rng = context.stream('economy.monthly');

    // Intérêts de l'épargne.
    for (const account of this.accounts.values()) {
      if (account.annualRate <= 0 || account.balance <= 0) continue;
      const interest = round((account.balance * account.annualRate) / 12, 2);
      if (interest > 0) this.record(account.kind, interest, 'intérêts', `intérêts ${account.label}`);
    }

    // Rendement et risque des investissements.
    for (const investment of this.investments.values()) {
      if (!investment.active) continue;
      const drift = investment.expectedAnnualReturn / 12;
      const shock = rng.gaussian(0, investment.risk / Math.sqrt(12));
      const monthlyReturn = drift + shock;
      const income = round(investment.value * Math.max(0, monthlyReturn) * 0.6, 2);
      investment.value = round(Math.max(0, investment.value * (1 + monthlyReturn * 0.4)), 2);
      if (income > 0) {
        investment.cumulativeIncome = round(investment.cumulativeIncome + income, 2);
        this.record('professionnel', income, 'revenus investissement', investment.label);
        context.emit({
          type: 'economy.investment',
          investmentId: investment.id,
          action: 'yield',
          amount: income,
        });
      } else if (monthlyReturn < -0.04) {
        context.emit({
          type: 'economy.investment',
          investmentId: investment.id,
          action: 'loss',
          amount: round(investment.value * monthlyReturn, 2),
        });
      }
      // Un investissement ruiné se ferme.
      if (investment.value < investment.principal * 0.05) {
        investment.active = false;
        context.logger.warn('investissement liquidé après effondrement', { label: investment.label });
      }
    }

    // Immobilier : loyers, charges, valorisation.
    for (const property of this.properties.values()) {
      if (property.rented && property.monthlyRent > 0) {
        this.record('professionnel', property.monthlyRent, 'loyers', `loyer — ${property.label}`);
      }
      if (property.monthlyCosts > 0) {
        this.record('courant', -property.monthlyCosts, 'charges', `charges — ${property.label}`);
      }
      const appreciation = rng.gaussian(0.0035, 0.006) + property.decoration * 0.0008;
      property.value = round(Math.max(1000, property.value * (1 + appreciation)), 2);
      property.condition = clamp01(property.condition - 0.006);
    }

    // Salaires du personnel et loyauté.
    for (const employee of this.employees.values()) {
      this.record('courant', -employee.monthlySalary, 'personnel', `salaire — ${employee.name}`);
      employee.loyalty = clamp01(employee.loyalty + 0.02);
      this.context.emit({
        type: 'economy.employee',
        employeeId: employee.id,
        action: 'paid',
        role: employee.role,
        amount: employee.monthlySalary,
      });
    }

    // Objets de collection : cote qui monte ou descend.
    for (const collectible of this.collectibles.values()) {
      if (collectible.kind === 'trophee') continue;
      const monthly = collectible.appreciationRate / 12 + rng.gaussian(0, 0.012);
      collectible.value = round(Math.max(0, collectible.value * (1 + monthly)), 2);
    }

    // Véhicules : décote.
    for (const vehicle of this.vehicles.values()) {
      const definition = getVehicle(vehicle.definitionId);
      const monthly = definition.appreciates ? rng.range(0.001, 0.006) : -rng.range(0.004, 0.012);
      vehicle.value = round(Math.max(500, vehicle.value * (1 + monthly)), 2);
    }

    context.logger.debug('clôture mensuelle du patrimoine', {
      mois: `${date.month}/${date.year}`,
      patrimoine: this.netWorth,
      liquidites: this.liquidity,
    });
  }

  // ── Succession (Tome XXIII, ch. 7) ───────────────────────────────────────

  createFoundation(name: string, endowment: number): boolean {
    if (!this.canAfford(endowment, 'courant')) return false;
    this.legacy = { ...this.legacy, foundationId: `foundation:${name}` };
    this.record('courant', -endowment, 'philanthropie', `dotation fondation ${name}`);
    this.context.emit({
      type: 'life.charity',
      projectId: `foundation:${name}`,
      action: 'founded',
      amount: endowment,
    });
    return true;
  }

  donate(cause: string, amount: number): boolean {
    if (!this.canAfford(amount, 'courant')) return false;
    this.record('courant', -amount, 'philanthropie', `don — ${cause}`);
    this.legacy = { ...this.legacy, donationsTotal: round(this.legacy.donationsTotal + amount, 2) };
    this.context.emit({ type: 'life.charity', projectId: cause, action: 'funded', amount });
    return true;
  }

  fundAcademy(name: string, amount: number): boolean {
    if (!this.canAfford(amount, 'courant')) return false;
    this.record('courant', -amount, 'philanthropie', `financement académie ${name}`);
    this.legacy = { ...this.legacy, academyFunded: true };
    this.context.emit({ type: 'life.charity', projectId: `academy:${name}`, action: 'expanded', amount });
    return true;
  }

  setBeneficiaries(beneficiaries: Array<{ personId: string; share: number }>): void {
    const total = beneficiaries.reduce((sum, b) => sum + b.share, 0);
    const normalised =
      total > 0 ? beneficiaries.map((b) => ({ ...b, share: clamp01(b.share / total) })) : [];
    this.legacy = { ...this.legacy, beneficiaries: normalised };
  }

  bequeathMuseum(): void {
    this.legacy = { ...this.legacy, museumBequeathed: true };
  }

  get estate(): Legacy {
    return this.legacy;
  }

  /** Achat d'un produit du catalogue (utilisé par le système de commandes). */
  purchaseProduct(productId: string, quantity = 1): number {
    const product = getProduct(productId);
    const total = round(product.priceEur * quantity, 2);
    if (!this.canAfford(total, 'courant')) return 0;
    this.record('courant', -total, 'achats', `${product.name} ×${quantity}`);
    return total;
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      accounts: [...this.accounts.values()],
      transactions: this.transactions.slice(-1500),
      investments: [...this.investments.values()],
      properties: [...this.properties.values()],
      employees: [...this.employees.values()],
      collectibles: [...this.collectibles.values()],
      vehicles: [...this.vehicles.values()],
      legacy: this.legacy,
      transactionCounter: this.transactionCounter,
      assetCounter: this.assetCounter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.accounts.clear();
    for (const account of (state.accounts as Account[]) ?? []) this.accounts.set(account.id, account);
    this.transactions.length = 0;
    this.transactions.push(...(((state.transactions as Transaction[]) ?? [])));
    this.investments.clear();
    for (const investment of (state.investments as Investment[]) ?? []) {
      this.investments.set(investment.id, investment);
    }
    this.properties.clear();
    for (const property of (state.properties as Property[]) ?? []) {
      this.properties.set(property.id, property);
    }
    this.employees.clear();
    for (const employee of (state.employees as Employee[]) ?? []) {
      this.employees.set(employee.id, employee);
    }
    this.collectibles.clear();
    for (const collectible of (state.collectibles as Collectible[]) ?? []) {
      this.collectibles.set(collectible.id, collectible);
    }
    this.vehicles.clear();
    for (const vehicle of (state.vehicles as OwnedVehicle[]) ?? []) {
      this.vehicles.set(vehicle.id, vehicle);
    }
    if (state.legacy) this.legacy = state.legacy as Legacy;
    this.transactionCounter = (state.transactionCounter as number) ?? this.transactions.length;
    this.assetCounter = (state.assetCounter as number) ?? 0;
    if (this.accounts.size === 0) {
      this.openAccount('courant', 'Compte courant', 0, 0);
      this.openAccount('epargne', 'Compte épargne', 0, 0.021);
      this.openAccount('professionnel', 'Compte professionnel', 0, 0.005);
      this.openAccount('investissement', 'Portefeuille d’investissement', 0, 0);
    }
  }
}

/** Barème indicatif des salaires du personnel de maison. */
export const EMPLOYEE_SALARY_TABLE: Readonly<Record<EmployeeRole, number>> = {
  chauffeur: 3200,
  'chef cuisinier': 5200,
  jardinier: 2400,
  'personnel de maison': 2600,
  'garde du corps': 6800,
  'assistant personnel': 4800,
  'pilote privé': 12500,
  concierge: 3600,
};

export const PROPERTY_BASE_PRICES: Readonly<Record<PropertyKind, number>> = {
  appartement: 480_000,
  maison: 900_000,
  villa: 3_400_000,
  penthouse: 6_800_000,
  chalet: 2_900_000,
  ilePrivee: 42_000_000,
  immeuble: 12_000_000,
};

/** Prix d'un bien selon la ville : coût de la vie, tourisme, palier urbain. */
export function propertyPrice(kind: PropertyKind, cityId: string): number {
  const base = PROPERTY_BASE_PRICES[kind];
  try {
    const city = getCity(cityId);
    const country = getCountry(city.countryId);
    const tierFactor = city.tier === 1 ? 1.5 : city.tier === 2 ? 1 : 0.7;
    const factor = (0.4 + country.costOfLiving * 1.1) * tierFactor * (0.85 + city.tourism * 0.4);
    return Math.round((base * factor) / 10_000) * 10_000;
  } catch {
    return base;
  }
}

/** Clamp exporté pour les modules de présentation financière. */
export { clamp as clampCurrency };
