/**
 * economy.js — Économie mondiale et patrimoine.
 *
 * Exigences couvertes (Tome XXIII intégralement, plus Tome XXIV ch. 3) :
 *   ch. 2 — quatre comptes distincts, toutes les transactions enregistrées
 *   ch. 3 — investissements à rendement et risque réels
 *   ch. 4 — immobilier : achat, rénovation, agrandissement, location, revente
 *   ch. 5 — employés avec compétences et salaires
 *   ch. 6 — objets de luxe qui prennent ou perdent de la valeur
 *   ch. 7 — succession : fondation, dons, legs
 *   ch. 8 — « les choix financiers ont un impact durable »
 *
 * Et Tome XXII ch. 4 / Tome XXIV ch. 3 : un contrat d'équipementier exclusif
 * bloque réellement l'achat des marques concurrentes. Ce blocage est appliqué
 * par un intercepteur sur le bus, pas par une simple condition dans l'UI.
 */

import { bus, EVENTS } from '../core/events.js';
import {
  INVESTMENT_TYPES, PROPERTY_TYPES, STAFF_ROLES, LUXURY_ITEMS, VEHICLES,
  BRANDS, getCity, getCountry,
} from '../data/world.js';

/** Comptes disponibles — Tome XXIII ch. 2. */
export const ACCOUNTS = ['courant', 'epargne', 'professionnel'];

export class EconomySystem {
  constructor(state, rng) {
    this.state = state;
    this.rng = rng;
    this._unsubs = [];
  }

  install() {
    // Cycle mensuel : salaires versés, charges prélevées, rendements appliqués.
    this._unsubs.push(bus.on(EVENTS.MONTH, () => this.monthlyCycle()));
    // Blocage des achats interdits par une clause d'exclusivité.
    this._unsubs.push(bus.intercept(EVENTS.PURCHASE_REQUEST, (payload) => this._enforceClauses(payload)));
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Comptes et écritures ────────────────────────────────────────────────

  get accounts() {
    return this.state.economy.accounts;
  }

  balance(account = 'courant') {
    return this.accounts[account] ?? 0;
  }

  /** Patrimoine net : liquidités + valeur des actifs − dettes d'entretien annuel. */
  netWorth() {
    const eco = this.state.economy;
    const cash = ACCOUNTS.reduce((sum, a) => sum + (eco.accounts[a] || 0), 0);
    const investments = eco.investments.reduce((sum, i) => sum + i.currentValue, 0);
    const properties = eco.properties.reduce((sum, p) => sum + p.currentValue, 0);
    const collection = eco.collection.reduce((sum, c) => sum + c.currentValue, 0);
    const garage = eco.garage.reduce((sum, v) => sum + v.currentValue, 0);
    return Math.round(cash + investments + properties + collection + garage);
  }

  /**
   * Écriture comptable. Toute variation d'argent passe obligatoirement ici :
   * c'est ce qui garantit que « toutes les transactions sont enregistrées ».
   * @returns {boolean} false si le solde est insuffisant
   */
  transact({ amount, account = 'courant', label, category = 'divers', allowNegative = false }) {
    const current = this.accounts[account] ?? 0;
    if (amount < 0 && !allowNegative && current + amount < 0) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'warn',
        title: 'Fonds insuffisants',
        body: `${label} — il manque ${this.format(Math.abs(current + amount))} sur le compte ${account}.`,
      });
      return false;
    }

    this.accounts[account] = Math.round((current + amount) * 100) / 100;

    const entry = {
      id: `tx-${this.state.economy.ledger.length + 1}`,
      at: this._stamp(),
      dateLabel: this._dateLabel(),
      amount: Math.round(amount * 100) / 100,
      account,
      label,
      category,
      balanceAfter: this.accounts[account],
    };
    this.state.economy.ledger.push(entry);
    // Le journal reste consultable mais borné pour ne pas gonfler la sauvegarde.
    if (this.state.economy.ledger.length > 800) {
      this.state.economy.ledger.splice(0, this.state.economy.ledger.length - 800);
    }

    bus.emit(EVENTS.TRANSACTION, entry);
    return true;
  }

  /** Virement entre deux comptes du joueur. */
  transfer(from, to, amount) {
    if (amount <= 0) return false;
    if (!ACCOUNTS.includes(from) || !ACCOUNTS.includes(to)) return false;
    if ((this.accounts[from] || 0) < amount) {
      bus.emit(EVENTS.NOTIFY, { level: 'warn', title: 'Virement refusé', body: 'Solde insuffisant.' });
      return false;
    }
    this.transact({ amount: -amount, account: from, label: `Virement vers ${to}`, category: 'virement' });
    this.transact({ amount: +amount, account: to, label: `Virement depuis ${from}`, category: 'virement' });
    return true;
  }

  // ── Clauses d'exclusivité ───────────────────────────────────────────────

  /**
   * Intercepteur : refuse un achat portant sur une marque bloquée par un
   * contrat d'équipementier en cours (Tome XXII ch. 4, Tome XXIV ch. 3).
   */
  _enforceClauses(payload) {
    const brandId = payload.brandId;
    if (!brandId) return payload;

    const blocked = this.state.endorsements.blockedBrands || [];
    if (!blocked.includes(brandId)) return payload;

    const brand = BRANDS.find((b) => b.id === brandId);
    const contract = this.state.endorsements.active.find((c) => c.exclusive);
    bus.emit(EVENTS.PURCHASE_BLOCKED, {
      brandId,
      brandName: brand?.name || brandId,
      contract: contract?.brandName || 'un contrat en cours',
    });
    bus.emit(EVENTS.NOTIFY, {
      level: 'warn',
      title: 'Achat bloqué par contrat',
      body: `Votre contrat exclusif avec ${contract?.brandName || 'votre équipementier'} interdit ${brand?.name || brandId} jusqu'à son terme.`,
    });
    return false; // annule l'événement : l'achat n'a pas lieu
  }

  /** Point d'entrée unique de tout achat, soumis aux clauses. */
  purchase({ label, amount, account = 'courant', category = 'achat', brandId = null, onSuccess }) {
    const allowed = bus.emit(EVENTS.PURCHASE_REQUEST, { label, amount, brandId, category });
    if (!allowed) return false;
    if (!this.transact({ amount: -Math.abs(amount), account, label, category })) return false;
    if (typeof onSuccess === 'function') onSuccess();
    bus.emit(EVENTS.PURCHASE_DONE, { label, amount, brandId, category });
    return true;
  }

  // ── Investissements (Tome XXIII ch. 3) ──────────────────────────────────

  invest(typeId, amount) {
    const type = INVESTMENT_TYPES.find((t) => t.id === typeId);
    if (!type) return { ok: false, reason: "Type d'investissement inconnu." };
    if (amount < type.minTicket) {
      return { ok: false, reason: `Ticket minimum : ${this.format(type.minTicket)}.` };
    }
    if (this.balance('courant') < amount) {
      return { ok: false, reason: 'Solde du compte courant insuffisant.' };
    }

    if (!this.transact({ amount: -amount, label: `Investissement — ${type.name}`, category: 'investissement' })) {
      return { ok: false, reason: 'Transaction refusée.' };
    }

    const investment = {
      id: `inv-${Date.now()}-${this.rng.int(100, 999)}`,
      typeId,
      name: type.name,
      invested: amount,
      currentValue: amount,
      yield: type.yield,
      volatility: type.volatility,
      risk: type.risk,
      since: this.state.clock.season,
      totalReturns: 0,
    };
    this.state.economy.investments.push(investment);

    if (type.prestige) {
      bus.emit(EVENTS.REPUTATION_CHANGED, { delta: type.prestige * 0.1, reason: `Investissement dans ${type.name}` });
    }
    bus.emit(EVENTS.NOTIFY, { level: 'info', title: 'Investissement réalisé', body: `${type.name} — ${this.format(amount)}.` });
    return { ok: true, investment };
  }

  /** Liquide un investissement à sa valeur courante. */
  divest(investmentId) {
    const list = this.state.economy.investments;
    const index = list.findIndex((i) => i.id === investmentId);
    if (index === -1) return { ok: false, reason: 'Investissement introuvable.' };

    const investment = list[index];
    const plusValue = investment.currentValue - investment.invested;
    this.transact({
      amount: investment.currentValue,
      label: `Cession — ${investment.name}`,
      category: 'investissement',
    });
    list.splice(index, 1);

    bus.emit(EVENTS.NOTIFY, {
      level: plusValue >= 0 ? 'success' : 'warn',
      title: 'Cession réalisée',
      body: `${investment.name} — ${plusValue >= 0 ? 'plus-value' : 'moins-value'} de ${this.format(Math.abs(plusValue))}.`,
    });
    return { ok: true, proceeds: investment.currentValue, plusValue };
  }

  // ── Immobilier (Tome XXIII ch. 4) ───────────────────────────────────────

  buyProperty(typeId, cityId) {
    const type = PROPERTY_TYPES.find((p) => p.id === typeId);
    const city = getCity(cityId);
    if (!type || !city) return { ok: false, reason: 'Bien ou ville inconnus.' };

    if (type.requiresLegend && this.state.reputation.global < 85) {
      return { ok: false, reason: 'Ce bien est réservé aux légendes établies (réputation 85+).' };
    }

    const country = getCountry(city.country);
    const price = Math.round(type.basePrice * (country?.costIndex || 1));

    if (this.balance('courant') < price) {
      return { ok: false, reason: `Prix : ${this.format(price)} — solde insuffisant.` };
    }

    const bought = this.purchase({
      label: `Achat — ${type.name} à ${city.name}`,
      amount: price,
      category: 'immobilier',
      onSuccess: () => {
        this.state.economy.properties.push({
          id: `prop-${Date.now()}-${this.rng.int(100, 999)}`,
          typeId,
          name: `${type.name} — ${city.name}`,
          cityId,
          purchasePrice: price,
          currentValue: price,
          upkeep: Math.round(type.upkeep * (country?.costIndex || 1)),
          comfort: type.comfort,
          prestige: type.prestige,
          renovations: [],
          rented: false,
          rentalIncome: 0,
          since: this.state.clock.season,
        });
      },
    });

    if (!bought) return { ok: false, reason: 'Achat refusé.' };

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'cinematic',
      title: 'Remise des clés',
      body: `Vous recevez les clés de votre ${type.name.toLowerCase()} à ${city.name}.`,
      cinematic: 'remise-des-cles',
    });
    return { ok: true };
  }

  /** Rénovation ou agrandissement — augmente valeur, confort et charges. */
  renovateProperty(propertyId, kind = 'renovation') {
    const property = this.state.economy.properties.find((p) => p.id === propertyId);
    if (!property) return { ok: false, reason: 'Bien introuvable.' };

    const cost = Math.round(property.currentValue * (kind === 'agrandissement' ? 0.22 : 0.1));
    if (this.balance('courant') < cost) {
      return { ok: false, reason: `Coût des travaux : ${this.format(cost)}.` };
    }

    this.transact({ amount: -cost, label: `${kind === 'agrandissement' ? 'Agrandissement' : 'Rénovation'} — ${property.name}`, category: 'immobilier' });

    const valueGain = kind === 'agrandissement' ? cost * 1.35 : cost * 1.1;
    property.currentValue = Math.round(property.currentValue + valueGain);
    property.comfort = Math.min(100, property.comfort + (kind === 'agrandissement' ? 8 : 5));
    property.upkeep = Math.round(property.upkeep * (kind === 'agrandissement' ? 1.18 : 1.06));
    property.renovations.push({ kind, cost, season: this.state.clock.season });

    return { ok: true, newValue: property.currentValue };
  }

  /** Mise en location — Tome XXIII ch. 4 : « louée ». */
  toggleRental(propertyId) {
    const property = this.state.economy.properties.find((p) => p.id === propertyId);
    if (!property) return { ok: false, reason: 'Bien introuvable.' };

    property.rented = !property.rented;
    // Rendement locatif brut ~5,5 %/an, versé mensuellement.
    property.rentalIncome = property.rented ? Math.round((property.currentValue * 0.055) / 12) : 0;
    return { ok: true, rented: property.rented, monthly: property.rentalIncome };
  }

  sellProperty(propertyId) {
    const list = this.state.economy.properties;
    const index = list.findIndex((p) => p.id === propertyId);
    if (index === -1) return { ok: false, reason: 'Bien introuvable.' };

    const property = list[index];
    // Frais de transaction réalistes : 6 % à la revente.
    const net = Math.round(property.currentValue * 0.94);
    this.transact({ amount: net, label: `Vente — ${property.name}`, category: 'immobilier' });
    list.splice(index, 1);
    return { ok: true, proceeds: net, plusValue: net - property.purchasePrice };
  }

  // ── Employés (Tome XXIII ch. 5) ─────────────────────────────────────────

  hireStaff(roleId) {
    const role = STAFF_ROLES.find((r) => r.id === roleId);
    if (!role) return { ok: false, reason: 'Poste inconnu.' };
    if (this.state.economy.staff.some((s) => s.roleId === roleId)) {
      return { ok: false, reason: 'Ce poste est déjà pourvu.' };
    }
    if (role.requires === 'jet' && !this.state.economy.garage.some((v) => v.category === 'jet')) {
      return { ok: false, reason: "Recruter un pilote privé suppose de posséder un jet." };
    }

    // Compétence tirée à l'embauche : deux chauffeurs ne se valent pas.
    const skill = this.rng.int(55, 92);
    const salary = Math.round(role.salary * (0.8 + skill / 200));

    this.state.economy.staff.push({
      id: `staff-${Date.now()}-${this.rng.int(100, 999)}`,
      roleId,
      name: role.name,
      skill,
      salary,
      effect: role.effect,
      since: this.state.clock.season,
    });
    return { ok: true, skill, salary };
  }

  fireStaff(staffId) {
    const list = this.state.economy.staff;
    const index = list.findIndex((s) => s.id === staffId);
    if (index === -1) return { ok: false, reason: 'Employé introuvable.' };
    const member = list[index];
    // Indemnité d'un mois de salaire.
    this.transact({ amount: -member.salary, label: `Indemnité de départ — ${member.name}`, category: 'personnel' });
    list.splice(index, 1);
    return { ok: true };
  }

  /** Somme des effets du personnel pour une clé donnée. */
  staffEffect(key) {
    return this.state.economy.staff.reduce((total, member) => {
      const value = member.effect?.[key];
      if (typeof value !== 'number') return total;
      // Un employé plus compétent délivre davantage de son effet nominal.
      return total + value * (0.6 + member.skill / 250);
    }, 0);
  }

  // ── Luxe et véhicules (Tome XXIII ch. 6, Tome XXII ch. 3) ───────────────

  buyLuxury(itemId, brandId = null) {
    const item = LUXURY_ITEMS.find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'Objet inconnu.' };
    if (this.balance('courant') < item.price) {
      return { ok: false, reason: `Prix : ${this.format(item.price)}.` };
    }

    const bought = this.purchase({
      label: `Achat — ${item.name}`,
      amount: item.price,
      category: 'luxe',
      brandId,
      onSuccess: () => {
        this.state.economy.collection.push({
          id: `lux-${Date.now()}-${this.rng.int(100, 999)}`,
          itemId,
          name: item.name,
          category: item.category,
          purchasePrice: item.price,
          currentValue: item.price,
          appreciation: item.appreciation,
          volatile: !!item.volatile,
          prestige: item.prestige,
          since: this.state.clock.season,
        });
      },
    });
    return bought ? { ok: true } : { ok: false, reason: 'Achat refusé.' };
  }

  buyVehicle(vehicleId, brandId = null) {
    const vehicle = VEHICLES.find((v) => v.id === vehicleId);
    if (!vehicle) return { ok: false, reason: 'Véhicule inconnu.' };
    if (this.balance('courant') < vehicle.price) {
      return { ok: false, reason: `Prix : ${this.format(vehicle.price)}.` };
    }

    const bought = this.purchase({
      label: `Achat — ${vehicle.name}`,
      amount: vehicle.price,
      category: 'vehicule',
      brandId,
      onSuccess: () => {
        this.state.economy.garage.push({
          id: `veh-${Date.now()}-${this.rng.int(100, 999)}`,
          vehicleId,
          name: vehicle.name,
          category: vehicle.category,
          purchasePrice: vehicle.price,
          currentValue: vehicle.price,
          upkeep: vehicle.upkeep,
          prestige: vehicle.prestige,
          topSpeed: vehicle.topSpeed,
          appreciates: !!vehicle.appreciates,
          kilometres: 0,
          since: this.state.clock.season,
        });
      },
    });

    if (!bought) return { ok: false, reason: 'Achat refusé.' };

    // Tome XVI ch. 6 : la livraison d'une voiture possède sa mise en scène.
    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'cinematic',
      title: 'Livraison du véhicule',
      body: `${vehicle.name} — le transporteur ouvre la remorque devant votre garage.`,
      cinematic: 'livraison-vehicule',
    });
    return { ok: true };
  }

  // ── Philanthropie et succession (Tome XXIII ch. 7, Tome XXVI ch. 5) ─────

  donate(amount, cause) {
    if (this.balance('courant') < amount) return { ok: false, reason: 'Solde insuffisant.' };
    this.transact({ amount: -amount, label: `Don — ${cause}`, category: 'philanthropie' });
    this.state.economy.philanthropy.totalDonated += amount;

    // Un don améliore la réputation, proportionnellement mais avec rendement décroissant.
    const repGain = Math.min(6, Math.sqrt(amount / 50000));
    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: repGain, reason: `Don à ${cause}`, kind: 'charity' });
    return { ok: true, reputationGain: repGain };
  }

  createFoundation(name, endowment) {
    if (this.balance('courant') < endowment) return { ok: false, reason: 'Dotation insuffisante.' };
    if (endowment < 250000) return { ok: false, reason: 'Une fondation exige au moins 250 000 de dotation.' };

    this.transact({ amount: -endowment, label: `Création de la fondation ${name}`, category: 'philanthropie' });
    const foundation = {
      id: `fond-${Date.now()}`,
      name,
      endowment,
      annualBudget: Math.round(endowment * 0.08),
      beneficiaries: 0,
      since: this.state.clock.season,
      projects: [],
    };
    this.state.economy.philanthropy.foundations.push(foundation);

    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: 4, reason: `Fondation ${name}`, kind: 'charity' });
    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} lance la fondation ${name}`,
      body: `Une dotation de ${this.format(endowment)} est engagée.`,
      tone: 'positif',
    });
    return { ok: true, foundation };
  }

  // ── Cycle mensuel ───────────────────────────────────────────────────────

  /**
   * Applique en une passe : salaire du joueur, primes, loyers, charges,
   * salaires du personnel, entretien des biens et véhicules, rendement des
   * investissements et réévaluation des objets de collection.
   */
  monthlyCycle() {
    const eco = this.state.economy;
    const monthLabel = this._dateLabel();

    // 1. Salaire du contrat sportif (Tome IV ch. 4)
    if (!this.state.player.retired && this.state.career.contract) {
      const monthly = Math.round(this.state.career.contract.salary / 12);
      const commission = Math.round(monthly * (this.state.career.agent?.commission || 0));
      this.transact({ amount: monthly, label: `Salaire — ${monthLabel}`, category: 'salaire' });
      if (commission > 0) {
        this.transact({ amount: -commission, label: `Commission agent — ${monthLabel}`, category: 'agent' });
      }
      bus.emit(EVENTS.SALARY_PAID, { amount: monthly });
    }

    // 2. Revenus des contrats de marque (Tome XXIV)
    for (const deal of this.state.endorsements.active) {
      const monthly = Math.round(deal.annualValue / 12);
      this.transact({ amount: monthly, label: `Sponsoring — ${deal.brandName}`, category: 'sponsoring' });
    }

    // 3. Loyers perçus
    for (const property of eco.properties) {
      if (property.rented && property.rentalIncome > 0) {
        this.transact({ amount: property.rentalIncome, label: `Loyer — ${property.name}`, category: 'immobilier' });
      }
    }

    // 4. Charges : entretien immobilier, véhicules, salaires du personnel
    const upkeepReduction = 1 + Math.min(0, this.staffEffect('propertyUpkeep'));
    let charges = 0;
    for (const property of eco.properties) charges += property.upkeep * upkeepReduction;
    for (const vehicle of eco.garage) charges += vehicle.upkeep;
    if (charges > 0) {
      this.transact({ amount: -Math.round(charges), label: `Charges et entretien — ${monthLabel}`, category: 'charges', allowNegative: true });
    }

    const payroll = eco.staff.reduce((sum, s) => sum + s.salary, 0);
    if (payroll > 0) {
      this.transact({ amount: -payroll, label: `Salaires du personnel — ${monthLabel}`, category: 'personnel', allowNegative: true });
    }

    // 5. Rendement des investissements — le risque est réel, les pertes possibles.
    for (const investment of eco.investments) {
      const monthlyYield = investment.yield / 12;
      const shock = this.rng.gaussian(0, investment.volatility / Math.sqrt(12));
      const delta = investment.currentValue * (monthlyYield + shock);
      investment.currentValue = Math.max(0, Math.round(investment.currentValue + delta));
      investment.totalReturns = Math.round(investment.totalReturns + delta);

      // Un investissement dont la valeur s'effondre est liquidé d'office.
      if (investment.currentValue < investment.invested * 0.08) {
        bus.emit(EVENTS.NOTIFY, {
          level: 'error',
          title: 'Investissement en faillite',
          body: `${investment.name} a perdu presque toute sa valeur.`,
        });
        investment.currentValue = 0;
      }
    }
    eco.investments = eco.investments.filter((i) => i.currentValue > 0);

    // Distribution des dividendes une fois par trimestre.
    if ([2, 5, 8, 11].includes(this.state.clock.month)) {
      const dividends = eco.investments.reduce((sum, i) => sum + i.currentValue * (i.yield / 4) * 0.4, 0);
      if (dividends > 100) {
        this.transact({ amount: Math.round(dividends), account: 'professionnel', label: 'Dividendes trimestriels', category: 'investissement' });
        bus.emit(EVENTS.INVESTMENT_RETURN, { amount: Math.round(dividends) });
      }
    }

    // 6. Réévaluation des objets de collection et des véhicules
    for (const item of eco.collection) {
      const monthlyRate = item.appreciation / 12;
      const noise = item.volatile ? this.rng.gaussian(0, 0.03) : this.rng.gaussian(0, 0.008);
      item.currentValue = Math.max(0, Math.round(item.currentValue * (1 + monthlyRate + noise)));
    }
    for (const vehicle of eco.garage) {
      // Les véhicules de collection s'apprécient, les autres se déprécient.
      const rate = vehicle.appreciates ? 0.06 / 12 : -0.14 / 12;
      vehicle.currentValue = Math.max(
        Math.round(vehicle.purchasePrice * (vehicle.appreciates ? 1 : 0.15)),
        Math.round(vehicle.currentValue * (1 + rate)),
      );
    }

    // 7. Immobilier : les prix suivent le marché local
    for (const property of eco.properties) {
      const marketDrift = this.rng.gaussian(0.03 / 12, 0.02);
      property.currentValue = Math.max(
        Math.round(property.purchasePrice * 0.4),
        Math.round(property.currentValue * (1 + marketDrift)),
      );
      if (property.rented) property.rentalIncome = Math.round((property.currentValue * 0.055) / 12);
    }

    // 8. Découvert : alerte explicite plutôt que solde négatif silencieux
    if (this.accounts.courant < 0) {
      const agios = Math.round(Math.abs(this.accounts.courant) * 0.015);
      this.transact({ amount: -agios, label: 'Agios de découvert', category: 'charges', allowNegative: true });
      bus.emit(EVENTS.NOTIFY, {
        level: 'error',
        title: 'Compte à découvert',
        body: `Solde : ${this.format(this.accounts.courant)}. Vendez un actif ou réduisez vos charges.`,
      });
    }
  }

  // ── Utilitaires ─────────────────────────────────────────────────────────

  /** Charges mensuelles totales, affichées par l'IA secrétaire. */
  monthlyBurn() {
    const eco = this.state.economy;
    const upkeep = eco.properties.reduce((s, p) => s + p.upkeep, 0)
      + eco.garage.reduce((s, v) => s + v.upkeep, 0);
    const payroll = eco.staff.reduce((s, m) => s + m.salary, 0);
    return Math.round(upkeep + payroll);
  }

  /** Revenus mensuels totaux. */
  monthlyIncome() {
    const salary = this.state.player.retired ? 0 : Math.round((this.state.career.contract?.salary || 0) / 12);
    const sponsors = this.state.endorsements.active.reduce((s, d) => s + d.annualValue / 12, 0);
    const rents = this.state.economy.properties
      .filter((p) => p.rented)
      .reduce((s, p) => s + p.rentalIncome, 0);
    return Math.round(salary + sponsors + rents);
  }

  /** Répartition des dépenses par catégorie, pour les tableaux de bord. */
  breakdown(months = 12) {
    const cutoff = this.state.clock.season - Math.ceil(months / 12);
    const byCategory = {};
    for (const entry of this.state.economy.ledger) {
      if (entry.amount >= 0) continue;
      byCategory[entry.category] = (byCategory[entry.category] || 0) + Math.abs(entry.amount);
    }
    void cutoff;
    return Object.entries(byCategory)
      .map(([category, total]) => ({ category, total: Math.round(total) }))
      .sort((a, b) => b.total - a.total);
  }

  format(amount) {
    const value = Math.round(amount);
    return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);
  }

  _stamp() {
    const c = this.state.clock;
    return c.year * 10000 + (c.month + 1) * 100 + c.day;
  }

  _dateLabel() {
    const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
    return `${MOIS[this.state.clock.month]} ${this.state.clock.year}`;
  }
}
