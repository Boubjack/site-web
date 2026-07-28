/**
 * career.js — Carrière du joueur.
 *
 * Exigences couvertes :
 *   - Tome IV ch. 2 : progression, réputation, valeur, salaire, sponsors, sélection
 *   - Tome IV ch. 3 : transferts dynamiques — négociation, agent, dirigeants,
 *                     conférence de presse, visite des installations, signature,
 *                     réactions des supporters et des coéquipiers
 *   - Tome IV ch. 4 : contrats détaillés (salaire, primes, bonus, durée, clauses)
 *   - Tome IV ch. 5 : vie de star — interviews, séances photo, campagnes,
 *                     événements caritatifs, inaugurations, cérémonies
 *   - Tome V ch. 4  : séances physiques, techniques, tactiques, mentales et leur
 *                     effet sur progression, fatigue, moral et risque de blessure
 *   - Tome XXIV     : contrats d'équipementier et clauses d'exclusivité réelles
 *   - Tome XXI      : retraite et reconversion
 */

import { bus, EVENTS } from '../core/events.js';
import { CLUBS, BRANDS, POST_CAREER_ROLES, getClub, getCity } from '../data/world.js';

/** Séances d'entraînement — Tome V ch. 4. */
export const TRAINING_SESSIONS = [
  {
    id: 'physique', name: 'Séance physique', duration: 3,
    gains: { physique: 0.5, vitesse: 0.25 },
    fatigue: 18, moral: -2, injuryRisk: 0.028,
    description: 'Puissance, endurance et explosivité.',
  },
  {
    id: 'technique', name: 'Séance technique', duration: 3,
    gains: { technique: 0.45, dribble: 0.35, passe: 0.2 },
    fatigue: 10, moral: 2, injuryRisk: 0.008,
    description: 'Contrôles, conduites de balle et gestes spécifiques.',
  },
  {
    id: 'tactique', name: 'Séance tactique', duration: 3,
    gains: { placement: 0.5, vision: 0.3, defense: 0.15 },
    fatigue: 8, moral: 0, injuryRisk: 0.005,
    description: 'Animation collective, pressing et transitions.',
  },
  {
    id: 'mental', name: 'Séance mentale', duration: 2,
    gains: { mental: 0.55, vision: 0.15 },
    fatigue: 4, moral: 5, injuryRisk: 0.001,
    description: 'Gestion de la pression et concentration avec le psychologue.',
  },
  {
    id: 'finition', name: 'Atelier finition', duration: 2,
    gains: { tir: 0.55, placement: 0.2 },
    fatigue: 12, moral: 3, injuryRisk: 0.012,
    description: 'Répétition des frappes et des situations de but.',
  },
  {
    id: 'recuperation', name: 'Séance de récupération', duration: 2,
    gains: {},
    fatigue: -22, moral: 4, injuryRisk: 0,
    description: 'Soins, bains froids et travail léger.',
  },
];

/** Activités de la vie de star — Tome IV ch. 5. */
export const STAR_ACTIVITIES = [
  { id: 'interview', name: 'Interview télévisée', duration: 2, fee: 8000, reputation: 0.8, wellbeing: -2, media: 3 },
  { id: 'photo', name: 'Séance photo', duration: 3, fee: 25000, reputation: 1.2, wellbeing: -3, media: 4 },
  { id: 'publicite', name: 'Campagne publicitaire', duration: 5, fee: 120000, reputation: 2.0, wellbeing: -6, media: 8, requiresEndorsement: true },
  { id: 'caritatif', name: 'Événement caritatif', duration: 4, fee: -15000, reputation: 3.2, wellbeing: 6, media: 5, charity: true },
  { id: 'inauguration', name: "Inauguration d'un lieu", duration: 3, fee: 45000, reputation: 1.4, wellbeing: -2, media: 3 },
  { id: 'ceremonie', name: 'Cérémonie officielle', duration: 4, fee: 0, reputation: 2.2, wellbeing: 3, media: 6, minReputation: 40 },
  { id: 'rencontre-fans', name: 'Rencontre avec les supporters', duration: 3, fee: 0, reputation: 1.8, wellbeing: 5, media: 2, fanRelation: 6 },
];

export class CareerSystem {
  constructor(state, rng, { economy, matchEngine, calendar }) {
    this.state = state;
    this.rng = rng;
    this.economy = economy;
    this.matchEngine = matchEngine;
    this.calendar = calendar;
    /** Offres de transfert reçues */
    this.transferOffers = [];
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.onDay()));
    this._unsubs.push(bus.on(EVENTS.SEASON_END, ({ season }) => this.onSeasonEnd(season)));
    this._unsubs.push(bus.on(EVENTS.MATCH_PLAYED, (report) => this.onMatchPlayed(report)));
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Cycle quotidien ─────────────────────────────────────────────────────

  onDay() {
    const player = this.state.player;

    // Récupération naturelle de la fatigue, accélérée par le staff médical.
    const recoveryBoost = 1 + this.economy.staffEffect('recovery');
    const baseRecovery = 3.5 * recoveryBoost * (0.7 + player.attributes.physique / 200);
    player.condition.fatigue = Math.max(0, player.condition.fatigue - baseRecovery);

    // Guérison des blessures.
    if (player.injury) {
      player.injury.daysLeft -= 1;
      if (player.injury.daysLeft <= 0) {
        const healed = player.injury;
        player.injury = null;
        // Une blessure grave laisse des traces sur la forme.
        const formPenalty = { 'légère': 3, 'modérée': 10, 'grave': 22 }[healed.severity] || 5;
        player.condition.forme = Math.max(25, player.condition.forme - formPenalty);
        bus.emit(EVENTS.RECOVERY, { injury: healed });
        bus.emit(EVENTS.NOTIFY, {
          level: 'success',
          title: 'Retour à la compétition',
          body: `${player.name} est remis de sa ${healed.type}. Reprise progressive.`,
        });
      }
    }

    // Le bien-être personnel dérive lentement vers un point d'équilibre.
    const equilibrium = 50 + this.state.reputation.fanRelation * 0.1 + (this.state.personal.relationships.length * 3);
    this.state.personal.wellbeing += (equilibrium - this.state.personal.wellbeing) * 0.03;
    this.state.personal.wellbeing = Math.max(0, Math.min(100, this.state.personal.wellbeing));

    // Le moral suit le bien-être.
    player.condition.moral += (this.state.personal.wellbeing - player.condition.moral) * 0.02;

    // Les rencontres non jouées à échéance sont simulées automatiquement :
    // le monde n'attend pas le joueur (Tome II ch. 1.2).
    for (const fixture of this.calendar.overdueFixtures()) {
      this.playFixture(fixture.id, { auto: true });
    }

    // Vieillissement au 1er janvier.
    if (this.state.clock.month === 0 && this.state.clock.day === 1) {
      player.age += 1;
      this._applyAging();
    }

    this.state.diagnostics.ticksProcessed++;
  }

  _applyAging() {
    const player = this.state.player;
    if (player.age < 30) return;

    // Après 30 ans, le physique et la vitesse déclinent ; l'expérience monte.
    const decline = (player.age - 29) * 0.35;
    player.attributes.vitesse = Math.max(20, player.attributes.vitesse - decline);
    player.attributes.physique = Math.max(20, player.attributes.physique - decline * 0.8);
    player.attributes.mental = Math.min(99, player.attributes.mental + 0.6);
    player.attributes.vision = Math.min(99, player.attributes.vision + 0.4);

    bus.emit(EVENTS.NOTIFY, {
      level: 'info',
      title: `${player.age} ans`,
      body: player.age >= 33
        ? "L'expérience compense de moins en moins le déclin physique. La retraite se rapproche."
        : "Le corps demande davantage d'entretien, mais la lecture du jeu progresse.",
    });
  }

  // ── Entraînement (Tome V ch. 4) ─────────────────────────────────────────

  train(sessionId) {
    const session = TRAINING_SESSIONS.find((s) => s.id === sessionId);
    if (!session) return { ok: false, reason: 'Séance inconnue.' };

    const player = this.state.player;
    if (player.injury) {
      return { ok: false, reason: `Blessé (${player.injury.type}) — ${player.injury.daysLeft} jours restants.` };
    }
    if (player.condition.fatigue > 90 && session.fatigue > 0) {
      return { ok: false, reason: 'Fatigue trop élevée : seule la récupération est possible.' };
    }

    // Risque de blessure à l'entraînement, réduit par le kiné et la nutrition.
    const riskReduction = 1 + Math.min(0, this.economy.staffEffect('injuryRisk'));
    const fatigueMultiplier = 1 + player.condition.fatigue / 120;
    const risk = session.injuryRisk * riskReduction * fatigueMultiplier;

    if (this.rng.chance(risk)) {
      const severity = this.rng.weighted([
        { v: 'légère', weight: 65 }, { v: 'modérée', weight: 28 }, { v: 'grave', weight: 7 },
      ]).v;
      const durations = { 'légère': [3, 10], 'modérée': [14, 40], 'grave': [55, 150] };
      const [min, max] = durations[severity];
      player.injury = {
        type: this.rng.pick(['élongation', 'contracture', 'entorse', 'lésion musculaire']),
        severity,
        days: this.rng.int(min, max),
        daysLeft: 0,
        since: { ...this.state.clock },
      };
      player.injury.daysLeft = player.injury.days;
      bus.emit(EVENTS.INJURY, { injury: player.injury, context: 'entraînement' });
      return { ok: false, injured: true, reason: `Blessure à l'entraînement : ${player.injury.type} (${player.injury.days} jours).` };
    }

    // Application des gains, modulés par l'âge et le moral.
    const ageFactor = player.age < 22 ? 1.4 : player.age < 27 ? 1.0 : player.age < 31 ? 0.6 : 0.25;
    const moralFactor = 0.7 + player.condition.moral / 250;
    const gains = {};

    for (const [attribute, amount] of Object.entries(session.gains)) {
      const before = player.attributes[attribute];
      const gain = amount * ageFactor * moralFactor * this.rng.float(0.7, 1.3);
      player.attributes[attribute] = Math.min(99, Math.round((before + gain) * 10) / 10);
      gains[attribute] = Math.round((player.attributes[attribute] - before) * 10) / 10;
    }

    // Fatigue, réduite par le nutritionniste.
    const fatigueRate = 1 + Math.min(0, this.economy.staffEffect('fatigueRate'));
    player.condition.fatigue = Math.max(0, Math.min(100, player.condition.fatigue + session.fatigue * fatigueRate));
    player.condition.moral = Math.max(0, Math.min(100, player.condition.moral + session.moral));
    player.condition.forme = Math.min(100, player.condition.forme + (session.fatigue > 0 ? 1.2 : 0.4));

    bus.emit(EVENTS.TRAINING_DONE, { session, gains });
    this.matchEngine._updateMarketValue();

    return { ok: true, session, gains, duration: session.duration };
  }

  // ── Matchs ──────────────────────────────────────────────────────────────

  /** Joue une rencontre du calendrier. */
  playFixture(fixtureId, { auto = false } = {}) {
    const fixture = this.calendar.fixtures.find((f) => f.id === fixtureId);
    if (!fixture) return { ok: false, reason: 'Rencontre introuvable.' };
    if (fixture.played) return { ok: false, reason: 'Rencontre déjà disputée.' };

    const report = this.matchEngine.simulate(fixture);
    this.calendar.markPlayed(fixtureId);
    report.auto = auto;
    return { ok: true, report };
  }

  onMatchPlayed(report) {
    // Statut dans l'effectif réévalué selon les performances récentes.
    const notes = (this.state.stats.seasons[this.state.clock.season]?.notes || []).slice(-8);
    if (notes.length >= 5) {
      const average = notes.reduce((a, b) => a + b, 0) / notes.length;
      const statuses = ['Espoir', 'Remplaçant', 'Rotation', 'Titulaire', 'Titulaire indiscutable', "Star de l'équipe"];
      let index = statuses.indexOf(this.state.career.squadStatus);
      if (index < 0) index = 0;
      if (average >= 7.6 && index < statuses.length - 1) index++;
      else if (average < 6.0 && index > 0) index--;
      const next = statuses[index];
      if (next !== this.state.career.squadStatus) {
        this.state.career.squadStatus = next;
        bus.emit(EVENTS.NOTIFY, { level: 'info', title: 'Statut dans l\'effectif', body: `Vous êtes désormais : ${next}.` });
      }
    }

    // Sélection nationale — Tome IV ch. 2.
    if (!this.state.career.nationalTeam.called && this.state.reputation.global >= 35 && this.matchEngine.overall() >= 70) {
      this.state.career.nationalTeam.called = true;
      bus.emit(EVENTS.HEADLINE, {
        title: `${this.state.player.name} appelé en sélection`,
        body: `Première convocation avec ${this.state.player.nationality}. Une étape majeure.`,
        tone: 'positif',
      });
      this.state.legacy.timeline.push({
        season: this.state.clock.season,
        type: 'selection',
        title: 'Première sélection nationale',
        detail: `Convoqué avec ${this.state.player.nationality}.`,
      });
    }

    void report;
  }

  // ── Vie de star (Tome IV ch. 5) ─────────────────────────────────────────

  doStarActivity(activityId) {
    const activity = STAR_ACTIVITIES.find((a) => a.id === activityId);
    if (!activity) return { ok: false, reason: 'Activité inconnue.' };

    if (activity.minReputation && this.state.reputation.global < activity.minReputation) {
      return { ok: false, reason: `Réputation insuffisante (${activity.minReputation} requise).` };
    }
    if (activity.requiresEndorsement && this.state.endorsements.active.length === 0) {
      return { ok: false, reason: 'Aucun contrat de sponsoring en cours.' };
    }

    // Cachet ou coût.
    if (activity.fee !== 0) {
      const label = activity.fee > 0 ? `Cachet — ${activity.name}` : `Participation — ${activity.name}`;
      const ok = this.economy.transact({
        amount: activity.fee,
        label,
        category: activity.charity ? 'philanthropie' : 'image',
      });
      if (!ok) return { ok: false, reason: 'Fonds insuffisants pour cet engagement.' };
    }

    bus.emit(EVENTS.REPUTATION_CHANGED, {
      delta: activity.reputation,
      reason: activity.name,
      kind: activity.charity ? 'charity' : 'media',
    });

    this.state.reputation.mediaInfluence = Math.min(100, this.state.reputation.mediaInfluence + activity.media * 0.4);
    if (activity.fanRelation) {
      this.state.reputation.fanRelation = Math.min(100, this.state.reputation.fanRelation + activity.fanRelation);
    }
    this.state.personal.wellbeing = Math.max(0, Math.min(100, this.state.personal.wellbeing + activity.wellbeing));
    if (activity.charity) {
      this.state.reputation.charity = Math.min(100, this.state.reputation.charity + 4);
      this.state.economy.philanthropy.totalDonated += Math.abs(activity.fee);
    }

    return { ok: true, activity };
  }

  // ── Contrats d'équipementier (Tome XXIV ch. 3) ─────────────────────────

  /** Génère des offres de sponsoring en fonction de la notoriété. */
  generateEndorsementOffers() {
    const reputation = this.state.reputation.global;
    const offers = [];

    for (const brand of BRANDS) {
      const already = this.state.endorsements.active.some((d) => d.brandId === brand.id);
      if (already) continue;

      // Une marque de rang 3 n'approche que les joueurs très en vue.
      const threshold = { 1: 5, 2: 30, 3: 62 }[brand.tier] || 30;
      if (reputation < threshold) continue;
      if (!this.rng.chance(0.35)) continue;

      const base = { 1: 30000, 2: 220000, 3: 1400000 }[brand.tier];
      const annualValue = Math.round(base * (0.6 + reputation / 90) * this.rng.float(0.85, 1.25));

      offers.push({
        id: `deal-${brand.id}-${this.state.clock.season}`,
        brandId: brand.id,
        brandName: brand.name,
        category: brand.category,
        annualValue,
        years: this.rng.int(2, 5),
        exclusive: brand.exclusive,
        obligations: this._buildObligations(brand),
        signingBonus: Math.round(annualValue * 0.2),
      });
    }

    this.state.endorsements.offersPending = offers;
    return offers;
  }

  _buildObligations(brand) {
    const obligations = ['Porter les produits de la marque pendant les matchs'];
    if (brand.tier >= 2) obligations.push('Participer à deux campagnes publicitaires par an');
    if (brand.tier >= 3) obligations.push('Assister aux événements officiels de la marque');
    if (brand.exclusive) {
      const competitors = BRANDS.filter((b) => b.category === brand.category && b.id !== brand.id);
      obligations.push(`Exclusivité : ${competitors.map((c) => c.name).join(', ')} deviennent inaccessibles à l'achat`);
    }
    return obligations;
  }

  /**
   * Signe un contrat de marque. Si le contrat est exclusif, les marques
   * concurrentes deviennent réellement inaccessibles : l'économie refusera
   * tout achat les concernant.
   */
  signEndorsement(offerId) {
    const offer = this.state.endorsements.offersPending.find((o) => o.id === offerId);
    if (!offer) return { ok: false, reason: 'Offre expirée ou introuvable.' };

    const brand = BRANDS.find((b) => b.id === offer.brandId);
    const deal = {
      ...offer,
      signedSeason: this.state.clock.season,
      endSeason: this.state.clock.season + offer.years,
    };
    this.state.endorsements.active.push(deal);
    this.state.endorsements.offersPending = this.state.endorsements.offersPending.filter((o) => o.id !== offerId);

    if (offer.exclusive && brand) {
      const competitors = BRANDS.filter((b) => b.category === brand.category && b.id !== brand.id).map((b) => b.id);
      const blocked = new Set(this.state.endorsements.blockedBrands);
      competitors.forEach((id) => blocked.add(id));
      this.state.endorsements.blockedBrands = Array.from(blocked);
    }

    if (offer.signingBonus > 0) {
      this.economy.transact({ amount: offer.signingBonus, label: `Prime à la signature — ${offer.brandName}`, category: 'sponsoring' });
    }

    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} signe avec ${offer.brandName}`,
      body: `Un accord de ${offer.years} ans valorisé à ${this.economy.format(offer.annualValue)} par an.`,
      tone: 'positif',
    });

    return { ok: true, deal };
  }

  /** Résiliation d'un contrat de marque, avec pénalité. */
  terminateEndorsement(dealId) {
    const index = this.state.endorsements.active.findIndex((d) => d.id === dealId);
    if (index === -1) return { ok: false, reason: 'Contrat introuvable.' };

    const deal = this.state.endorsements.active[index];
    const remaining = Math.max(0, deal.endSeason - this.state.clock.season);
    const penalty = Math.round(deal.annualValue * remaining * 0.35);

    if (this.economy.balance('courant') < penalty) {
      return { ok: false, reason: `Indemnité de rupture : ${this.economy.format(penalty)} — solde insuffisant.` };
    }

    this.economy.transact({ amount: -penalty, label: `Rupture de contrat — ${deal.brandName}`, category: 'sponsoring' });
    this.state.endorsements.active.splice(index, 1);
    this._recomputeBlockedBrands();

    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: -2.5, reason: `Rupture du contrat ${deal.brandName}` });
    return { ok: true, penalty };
  }

  _recomputeBlockedBrands() {
    const blocked = new Set();
    for (const deal of this.state.endorsements.active) {
      if (!deal.exclusive) continue;
      const brand = BRANDS.find((b) => b.id === deal.brandId);
      if (!brand) continue;
      BRANDS.filter((b) => b.category === brand.category && b.id !== brand.id).forEach((b) => blocked.add(b.id));
    }
    this.state.endorsements.blockedBrands = Array.from(blocked);
  }

  // ── Transferts (Tome IV ch. 3) ──────────────────────────────────────────

  /**
   * Génère les offres de transfert du mercato. L'intérêt d'un club dépend de
   * son prestige, de la valeur du joueur, de sa réputation et de son âge.
   */
  generateTransferOffers() {
    this.transferOffers = [];
    const currentClub = getClub(this.state.career.clubId);
    if (!currentClub) return [];

    const value = this.state.career.marketValue;
    const overall = this.matchEngine.overall();
    const reputation = this.state.reputation.global;

    for (const club of CLUBS) {
      if (club.id === currentClub.id) continue;

      // Un club ne recrute que ce qu'il peut payer et ce qui l'améliore.
      const affordability = club.budget / Math.max(1, value);
      if (affordability < 1.2) continue;

      // Attractivité du joueur pour ce club.
      const fit = overall + reputation * 0.35 - club.prestige * 0.55;
      const interest = fit + this.rng.gaussian(0, 8);
      if (interest < 5) continue;

      const fee = Math.round(value * this.rng.float(0.9, 1.6) / 10000) * 10000;
      const salary = Math.round(
        (this.state.career.contract.salary * this.rng.float(1.15, 2.4) * (1 + club.prestige / 200)) / 1000,
      ) * 1000;

      this.transferOffers.push({
        id: `offer-${club.id}-${this.state.clock.season}`,
        clubId: club.id,
        clubName: club.name,
        league: club.league,
        prestige: club.prestige,
        fee,
        contract: {
          salary,
          years: this.rng.int(3, 5),
          signingBonus: Math.round(salary * this.rng.float(0.2, 0.8)),
          goalBonus: Math.round(salary / 100),
          appearanceBonus: Math.round(salary / 300),
          clauses: this._proposeClauses(club),
        },
        squadStatus: club.prestige > currentClub.prestige + 15 ? 'Rotation' : 'Titulaire',
        cityId: club.cityId,
        interest: Math.round(interest),
      });
    }

    this.transferOffers.sort((a, b) => b.fee - a.fee);
    this.transferOffers = this.transferOffers.slice(0, 6);

    if (this.transferOffers.length > 0) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'info',
        title: 'Mercato ouvert',
        body: `${this.transferOffers.length} club(s) ont formulé une offre. Votre agent ${this.state.career.agent.name} attend vos instructions.`,
      });
    }
    return this.transferOffers;
  }

  _proposeClauses(club) {
    const clauses = [];
    if (club.prestige >= 85) clauses.push('Clause libératoire');
    if (club.prestige >= 75) clauses.push('Prime de qualification continentale');
    clauses.push('Prime de rendement');
    if (this.state.reputation.global >= 60) clauses.push('Droit à l\'image partagé');
    return clauses;
  }

  /**
   * Négociation avec l'agent — Tome IV ch. 3. La compétence de l'agent
   * détermine ce qu'il obtient en plus de l'offre initiale.
   */
  negotiate(offerId, demand) {
    const offer = this.transferOffers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, reason: 'Offre introuvable.' };

    const agent = this.state.career.agent;
    const leverage = agent.skill / 100 + this.state.reputation.global / 200 + (this.transferOffers.length > 2 ? 0.15 : 0);

    const results = { accepted: false, changes: {} };

    if (demand === 'salaire') {
      const requested = Math.round(offer.contract.salary * 1.25);
      if (this.rng.chance(Math.min(0.9, leverage))) {
        offer.contract.salary = requested;
        results.accepted = true;
        results.changes.salary = requested;
      }
    } else if (demand === 'duree') {
      if (this.rng.chance(Math.min(0.85, leverage + 0.1))) {
        offer.contract.years = Math.min(6, offer.contract.years + 1);
        results.accepted = true;
        results.changes.years = offer.contract.years;
      }
    } else if (demand === 'statut') {
      if (this.rng.chance(Math.min(0.8, leverage - 0.1))) {
        offer.squadStatus = 'Titulaire indiscutable';
        results.accepted = true;
        results.changes.squadStatus = offer.squadStatus;
      }
    } else if (demand === 'liberatoire') {
      if (this.rng.chance(Math.min(0.75, leverage - 0.05))) {
        if (!offer.contract.clauses.includes('Clause libératoire')) {
          offer.contract.clauses.push('Clause libératoire');
        }
        results.accepted = true;
        results.changes.clause = 'Clause libératoire';
      }
    }

    if (!results.accepted) {
      // Un échec de négociation peut refroidir le club.
      offer.interest -= this.rng.int(2, 8);
      if (offer.interest < 0) {
        this.transferOffers = this.transferOffers.filter((o) => o.id !== offerId);
        return { ok: false, reason: `${offer.clubName} retire son offre après l'échec des négociations.`, withdrawn: true };
      }
    }

    return { ok: true, ...results, offer };
  }

  /**
   * Accepte un transfert. Toute la mise en scène décrite au Tome IV ch. 3 et
   * au Tome XVI ch. 3 est produite comme séquence d'événements.
   */
  acceptTransfer(offerId) {
    const offer = this.transferOffers.find((o) => o.id === offerId);
    if (!offer) return { ok: false, reason: 'Offre introuvable.' };

    const previousClub = getClub(this.state.career.clubId);
    const newClub = getClub(offer.clubId);
    const newCity = getCity(newClub.cityId);

    // Séquence cinématique complète du transfert.
    const sequence = [
      { step: 'reunion', title: 'Réunion avec les dirigeants', body: `Les dirigeants de ${newClub.name} exposent leur projet sportif.` },
      { step: 'agent', title: `Discussion avec ${this.state.career.agent.name}`, body: 'Votre agent valide les termes financiers du contrat.' },
      { step: 'depart', title: `Adieux à ${previousClub?.name || 'votre club'}`, body: 'Les coéquipiers vous saluent dans le vestiaire. Les supporters réagissent au départ.' },
      { step: 'vol', title: 'Arrivée en avion', body: `Atterrissage à ${newCity?.name}. Des supporters vous attendent à l'aéroport.` },
      { step: 'medical', title: 'Examens médicaux', body: 'Batterie de tests au centre médical du club.' },
      { step: 'visite', title: 'Visite des installations', body: `Découverte du centre d'entraînement et du stade.` },
      { step: 'signature', title: 'Signature du contrat', body: `${offer.contract.years} ans, ${this.economy.format(offer.contract.salary)} par saison.` },
      { step: 'presentation', title: 'Présentation officielle', body: `Présentation avec le maillot devant la presse et les supporters.` },
      { step: 'presse', title: 'Conférence de presse', body: 'Les journalistes analysent le transfert et interrogent sur vos ambitions.' },
    ];

    // Application du transfert.
    const history = this.state.career.clubHistory;
    const currentEntry = history.find((h) => h.clubId === this.state.career.clubId && h.to === null);
    if (currentEntry) currentEntry.to = this.state.clock.season;

    this.state.career.clubId = offer.clubId;
    this.state.career.contract = {
      salary: offer.contract.salary,
      signingBonus: offer.contract.signingBonus,
      endSeason: this.state.clock.season + offer.contract.years,
      goalBonus: offer.contract.goalBonus,
      appearanceBonus: offer.contract.appearanceBonus,
      clauses: offer.contract.clauses,
    };
    this.state.career.squadStatus = offer.squadStatus;
    history.push({ clubId: offer.clubId, from: this.state.clock.season, to: null, fee: offer.fee });

    // Prime à la signature versée.
    if (offer.contract.signingBonus > 0) {
      this.economy.transact({
        amount: offer.contract.signingBonus,
        label: `Prime à la signature — ${newClub.name}`,
        category: 'contrat',
      });
    }

    // Déplacement physique dans le monde.
    this.state.world.currentCityId = newClub.cityId;

    // Fidélité : partir souvent réduit la loyauté (Tome XXVI ch. 2).
    const seasonsAtClub = currentEntry ? this.state.clock.season - currentEntry.from : 0;
    this.state.reputation.loyalty = Math.max(0, Math.min(100,
      this.state.reputation.loyalty + (seasonsAtClub >= 4 ? 6 : seasonsAtClub <= 1 ? -10 : -3),
    ));

    // Réputation : rejoindre un grand club fait grimper la notoriété.
    bus.emit(EVENTS.REPUTATION_CHANGED, {
      delta: (newClub.prestige - (previousClub?.prestige || 50)) * 0.12,
      reason: `Transfert vers ${newClub.name}`,
    });

    this.state.legacy.timeline.push({
      season: this.state.clock.season,
      type: 'transfert',
      title: `Transfert : ${previousClub?.name || '—'} → ${newClub.name}`,
      detail: `${this.economy.format(offer.fee)} — contrat de ${offer.contract.years} ans.`,
    });

    bus.emit(EVENTS.TRANSFER, { from: previousClub?.id, to: offer.clubId, fee: offer.fee, sequence });
    bus.emit(EVENTS.CONTRACT_SIGNED, { contract: this.state.career.contract, club: newClub.name });
    bus.emit(EVENTS.HEADLINE, {
      title: `Officiel : ${this.state.player.name} rejoint ${newClub.name}`,
      body: `Transfert estimé à ${this.economy.format(offer.fee)}. Les supporters de ${previousClub?.name} digèrent mal ce départ.`,
      tone: 'majeur',
    });

    this.transferOffers = [];
    // Le calendrier doit être régénéré : nouveau club, nouvelles compétitions.
    this.calendar.generateSeason(this.state.clock.season);

    return { ok: true, sequence, club: newClub };
  }

  /** Prolongation au club actuel — alternative au transfert. */
  renewContract() {
    const club = getClub(this.state.career.clubId);
    if (!club) return { ok: false, reason: 'Club introuvable.' };

    const agent = this.state.career.agent;
    const overall = this.matchEngine.overall();
    const leverage = agent.skill / 100 + this.state.reputation.global / 150 + this.transferOffers.length * 0.08;

    const raise = 1 + Math.min(1.8, leverage * (overall / 70));
    const newSalary = Math.round((this.state.career.contract.salary * raise) / 1000) * 1000;
    const years = this.rng.int(2, 5);

    // Le club refuse si le joueur est trop cher pour son budget.
    if (newSalary * years > club.budget * 0.45) {
      return { ok: false, reason: `${club.name} juge vos exigences salariales incompatibles avec son budget.` };
    }

    this.state.career.contract = {
      ...this.state.career.contract,
      salary: newSalary,
      endSeason: this.state.clock.season + years,
    };

    this.state.reputation.loyalty = Math.min(100, this.state.reputation.loyalty + 8);
    bus.emit(EVENTS.CONTRACT_SIGNED, { contract: this.state.career.contract, club: club.name, renewal: true });
    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} prolonge à ${club.name}`,
      body: `Un nouveau bail de ${years} ans. Les supporters saluent la fidélité.`,
      tone: 'positif',
    });

    return { ok: true, salary: newSalary, years };
  }

  // ── Fin de saison ───────────────────────────────────────────────────────

  onSeasonEnd(season) {
    const seasonStats = this.state.stats.seasons[season];
    if (seasonStats && seasonStats.matchs > 0) {
      const average = seasonStats.notes.length
        ? seasonStats.notes.reduce((a, b) => a + b, 0) / seasonStats.notes.length
        : 0;
      bus.emit(EVENTS.NOTIFY, {
        level: 'info',
        title: `Bilan de la saison ${season}`,
        body: `${seasonStats.matchs} matchs, ${seasonStats.buts} buts, ${seasonStats.passesD} passes décisives, note moyenne ${average.toFixed(2)}.`,
      });
    }

    // Mercato : offres de transfert et de sponsoring.
    this.generateTransferOffers();
    this.generateEndorsementOffers();

    // Contrats de marque arrivés à échéance.
    const expired = this.state.endorsements.active.filter((d) => d.endSeason <= season);
    if (expired.length > 0) {
      this.state.endorsements.active = this.state.endorsements.active.filter((d) => d.endSeason > season);
      this._recomputeBlockedBrands();
      for (const deal of expired) {
        bus.emit(EVENTS.NOTIFY, { level: 'info', title: 'Contrat terminé', body: `Votre accord avec ${deal.brandName} arrive à son terme.` });
      }
    }

    // Contrat sportif expirant.
    if (this.state.career.contract.endSeason <= season && !this.state.player.retired) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'warn',
        title: 'Contrat expiré',
        body: 'Vous êtes libre. Prolongez ou étudiez les offres avant la reprise.',
      });
    }

    // Proposition de retraite quand le déclin est marqué.
    this._considerRetirement();
  }

  _considerRetirement() {
    const player = this.state.player;
    if (player.retired || player.age < 33) return;

    const overall = this.matchEngine.overall();
    const declineFactor = (player.age - 33) * 0.18 + Math.max(0, (65 - overall)) * 0.02;
    if (this.rng.chance(Math.min(0.9, declineFactor))) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'warn',
        title: 'La retraite approche',
        body: `À ${player.age} ans, le corps ne suit plus comme avant. Vous pouvez annoncer votre retraite depuis l'onglet Carrière.`,
      });
    }
  }

  // ── Retraite et reconversion (Tome XXI) ─────────────────────────────────

  retire() {
    const player = this.state.player;
    if (player.retired) return { ok: false, reason: 'Déjà à la retraite.' };

    player.retired = true;
    player.retiredAt = { season: this.state.clock.season, age: player.age };

    const stats = this.state.stats.career;
    this.state.legacy.timeline.push({
      season: this.state.clock.season,
      type: 'retraite',
      title: 'Fin de carrière',
      detail: `${stats.matchs} matchs, ${stats.buts} buts, ${stats.passesD} passes décisives.`,
    });

    // Le musée personnel s'ouvre automatiquement (Tome XXI ch. 4).
    if (!this.state.legacy.museum.built) this.buildMuseum();

    bus.emit(EVENTS.RETIREMENT, {
      player: player.name,
      age: player.age,
      stats,
      trophies: this.state.legacy.trophies.length,
      awards: this.state.legacy.awards.length,
    });

    bus.emit(EVENTS.HEADLINE, {
      title: `${player.name} raccroche les crampons`,
      body: `${stats.matchs} matchs et ${stats.buts} buts au terme d'une carrière de ${this.state.clock.season - (player.birthSeason + 17)} saisons.`,
      tone: 'majeur',
    });

    return { ok: true, roles: this.availablePostCareerRoles() };
  }

  availablePostCareerRoles() {
    return POST_CAREER_ROLES.filter((r) => this.state.reputation.global >= r.minReputation);
  }

  /** Choix d'un métier d'après-carrière — Tome XXI ch. 2. */
  takePostCareerRole(roleId) {
    const role = POST_CAREER_ROLES.find((r) => r.id === roleId);
    if (!role) return { ok: false, reason: 'Rôle inconnu.' };
    if (!this.state.player.retired) return { ok: false, reason: 'Ce choix intervient après la retraite.' };
    if (this.state.reputation.global < role.minReputation) {
      return { ok: false, reason: `Réputation insuffisante (${role.minReputation} requise).` };
    }

    this.state.legacy.postCareerRole = { id: role.id, name: role.name, since: this.state.clock.season };
    // Le revenu du nouveau métier remplace le salaire sportif.
    this.state.career.contract = {
      salary: role.income,
      signingBonus: 0,
      endSeason: this.state.clock.season + 5,
      goalBonus: 0,
      appearanceBonus: 0,
      clauses: [role.name],
    };
    this.state.player.retired = true;

    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} devient ${role.name}`,
      body: `Une nouvelle vie commence dans le football.`,
      tone: 'positif',
    });
    return { ok: true, role };
  }

  /** Construction du musée personnel — Tome XVII ch. 4, Tome XXI ch. 4. */
  buildMuseum() {
    const museum = this.state.legacy.museum;
    if (museum.built) return { ok: false, reason: 'Musée déjà inauguré.' };

    const cost = 2500000;
    if (this.economy.balance('courant') < cost && !this.state.player.retired) {
      return { ok: false, reason: `Construction : ${this.economy.format(cost)}.` };
    }
    if (!this.state.player.retired) {
      this.economy.transact({ amount: -cost, label: 'Construction du musée personnel', category: 'patrimoine' });
    }

    museum.built = true;
    museum.rating = 4.2;
    museum.exhibits = [
      ...this.state.legacy.trophies.map((t) => ({ kind: 'trophée', name: t.name, season: t.season })),
      ...this.state.legacy.awards.map((a) => ({ kind: 'récompense', name: a.category, season: a.season })),
      ...this.state.legacy.framedShirts.map((s) => ({ kind: 'maillot encadré', name: s.legend, season: s.season })),
      { kind: 'crampons', name: 'Crampons du premier but professionnel', season: this.state.career.clubHistory[0]?.from },
    ];

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'cinematic',
      title: 'Inauguration du musée',
      body: `Le musée ${this.state.player.name} ouvre ses portes. Les premiers visiteurs découvrent la collection.`,
      cinematic: 'inauguration-musee',
    });
    return { ok: true, museum };
  }

  serialize() {
    return { transferOffers: this.transferOffers };
  }

  restore(data) {
    if (data?.transferOffers) this.transferOffers = data.transferOffers;
  }
}
