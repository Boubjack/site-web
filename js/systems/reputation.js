/**
 * reputation.js — Réputation mondiale et influence.
 *
 * Exigences couvertes (Tome XXVI) :
 *   ch. 2 — la réputation combine performances, comportement, fair-play,
 *           popularité, actions caritatives, fidélité et influence médiatique,
 *           et elle varie selon les pays
 *   ch. 3 — influence sur la popularité d'un championnat, les ventes de maillots,
 *           la fréquentation des stades, la valeur d'un club, le tourisme
 *   ch. 4 — relations avec les supporters (autographes, selfies, maillots)
 *   ch. 6 — héritage culturel : statue, rue, fresque, exposition, journée
 *   Tome VIII ch. 3 — les supporters reconnaissent le joueur et réagissent
 */

import { bus, EVENTS } from '../core/events.js';
import { CITIES, getCity, getClub, getCountry } from '../data/world.js';

/** Paliers de notoriété, qui débloquent des interactions dans le monde. */
export const FAME_TIERS = [
  { min: 0, id: 'inconnu', label: 'Inconnu', description: "Personne ne vous reconnaît dans la rue." },
  { min: 15, id: 'espoir', label: 'Espoir remarqué', description: 'Les supporters du club commencent à vous identifier.' },
  { min: 30, id: 'connu', label: 'Joueur connu', description: 'On vous arrête parfois pour un autographe.' },
  { min: 45, id: 'star-nationale', label: 'Star nationale', description: 'Les médias de votre pays suivent chacun de vos matchs.' },
  { min: 60, id: 'star-continentale', label: 'Star continentale', description: 'Les grandes marques vous approchent. Le jet privé devient accessible.' },
  { min: 75, id: 'superstar', label: 'Superstar mondiale', description: 'Vous ne sortez plus sans être reconnu, où que vous soyez.' },
  { min: 88, id: 'icone', label: 'Icône', description: "Votre nom dépasse le football. Les honneurs culturels s'ouvrent." },
  { min: 96, id: 'legende', label: 'Légende vivante', description: 'Le monde du football vous cite comme référence absolue.' },
];

/** Interactions possibles avec les supporters — Tome XXVI ch. 4. */
export const FAN_INTERACTIONS = [
  { id: 'autographe', name: 'Signer un autographe', duration: 0, fanRelation: 1.2, reputation: 0.1, cost: 0 },
  { id: 'selfie', name: 'Prendre un selfie', duration: 0, fanRelation: 1.5, reputation: 0.15, cost: 0 },
  { id: 'maillot', name: 'Offrir un maillot', duration: 1, fanRelation: 5, reputation: 0.5, cost: 120 },
  { id: 'evenement-fans', name: 'Événement avec les fans', duration: 4, fanRelation: 9, reputation: 1.6, cost: 3000 },
  { id: 'association', name: 'Rencontrer une association de supporters', duration: 3, fanRelation: 12, reputation: 2.0, cost: 1500 },
  { id: 'refuser', name: 'Refuser et passer son chemin', duration: 0, fanRelation: -4, reputation: -0.4, cost: 0 },
];

/** Honneurs culturels — Tome XXVI ch. 6. */
const CULTURAL_HONOURS = [
  { id: 'fresque', name: 'Fresque murale', minReputation: 55, requiresRetired: false, body: "Une fresque murale à votre effigie apparaît sur un immeuble du quartier." },
  { id: 'rue', name: 'Une rue à votre nom', minReputation: 70, requiresRetired: false, body: 'La municipalité rebaptise une rue en votre honneur.' },
  { id: 'exposition', name: 'Exposition permanente', minReputation: 78, requiresRetired: false, body: 'Un musée vous consacre une exposition permanente.' },
  { id: 'statue', name: 'Statue devant le stade', minReputation: 85, requiresRetired: false, body: 'Une statue est érigée devant le stade de votre club.' },
  { id: 'journee', name: 'Journée commémorative', minReputation: 90, requiresRetired: true, body: 'Votre ancien club instaure une journée commémorative annuelle.' },
];

export class ReputationSystem {
  constructor(state, rng) {
    this.state = state;
    this.rng = rng;
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.REPUTATION_CHANGED, (payload) => this.apply(payload)));
    this._unsubs.push(bus.on(EVENTS.WEEK, () => this.weeklyDecay()));
    this._unsubs.push(bus.on(EVENTS.SEASON_END, () => this.checkHonours()));
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  /**
   * Applique une variation de réputation. La réputation globale est bornée
   * 0-100 ; la réputation nationale du pays concerné progresse plus vite.
   */
  apply({ delta, reason, country = null, kind = 'sport' }) {
    if (typeof delta !== 'number' || Number.isNaN(delta)) return;

    const before = this.state.reputation.global;
    // Progression à rendement décroissant : passer de 90 à 91 est bien plus dur.
    const resistance = 1 - (before / 118);
    const applied = delta > 0 ? delta * Math.max(0.12, resistance) : delta;

    this.state.reputation.global = Math.max(0, Math.min(100, Math.round((before + applied) * 100) / 100));

    // Réputation par pays — « la réputation varie selon les pays ».
    const targetCountry = country || this._currentCountry();
    if (targetCountry) {
      const current = this.state.reputation.byCountry[targetCountry] ?? this.state.reputation.global * 0.6;
      // Dans le pays concerné, l'effet est amplifié.
      this.state.reputation.byCountry[targetCountry] = Math.max(0, Math.min(100, current + applied * 1.6));
    }

    // Le pays d'origine suit toujours, plus lentement mais sûrement.
    const home = this._nationalityCountryId();
    if (home && home !== targetCountry) {
      const current = this.state.reputation.byCountry[home] ?? this.state.reputation.global;
      this.state.reputation.byCountry[home] = Math.max(0, Math.min(100, current + applied * 0.8));
    }

    if (kind === 'charity') {
      this.state.reputation.charity = Math.min(100, this.state.reputation.charity + Math.abs(delta) * 0.6);
    }
    if (kind === 'media') {
      this.state.reputation.mediaInfluence = Math.min(100, this.state.reputation.mediaInfluence + Math.abs(delta) * 0.5);
    }

    // Franchissement de palier : événement notable.
    const tierBefore = this.tierOf(before);
    const tierAfter = this.tier();
    if (tierAfter.id !== tierBefore.id && this.state.reputation.global > before) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'success',
        title: `Nouveau statut : ${tierAfter.label}`,
        body: tierAfter.description,
      });
      bus.emit(EVENTS.HEADLINE, {
        title: `${this.state.player.name} atteint le statut de ${tierAfter.label.toLowerCase()}`,
        body: tierAfter.description,
        tone: 'positif',
      });
      // Les followers suivent la notoriété (Tome XI ch. 8).
      this.state.phone.followers = Math.round(this.state.phone.followers * 1.8 + 50000);
    }

    void reason;
  }

  /** Érosion lente : rester inactif fait retomber la notoriété. */
  weeklyDecay() {
    const player = this.state.player;
    // Un joueur retraité conserve sa réputation bien plus longtemps (Tome XVII ch. 6).
    const rate = player.retired ? 0.02 : 0.08;
    this.state.reputation.global = Math.max(0, this.state.reputation.global - rate);

    for (const key of Object.keys(this.state.reputation.byCountry)) {
      this.state.reputation.byCountry[key] = Math.max(0, this.state.reputation.byCountry[key] - rate * 0.6);
    }

    // La relation avec les supporters se dégrade si on ne les fréquente jamais.
    this.state.reputation.fanRelation = Math.max(0, this.state.reputation.fanRelation - 0.3);
  }

  // ── Paliers ─────────────────────────────────────────────────────────────

  tier() {
    return this.tierOf(this.state.reputation.global);
  }

  tierOf(value) {
    let result = FAME_TIERS[0];
    for (const tier of FAME_TIERS) {
      if (value >= tier.min) result = tier;
    }
    return result;
  }

  /** Probabilité d'être reconnu dans une ville donnée — Tome VIII ch. 3. */
  recognitionChance(cityId = this.state.world.currentCityId) {
    const city = getCity(cityId);
    if (!city) return 0;
    const country = getCountry(city.country);
    const local = this.state.reputation.byCountry[city.country] ?? this.state.reputation.global * 0.5;
    // La passion locale pour le football amplifie la reconnaissance.
    const passion = (country?.footballPassion || 70) / 100;
    return Math.max(0, Math.min(0.95, (local / 110) * passion));
  }

  /** Génère une rencontre avec un supporter, s'il y en a une. */
  rollFanEncounter(cityId = this.state.world.currentCityId) {
    const chance = this.recognitionChance(cityId);
    if (!this.rng.chance(chance)) return null;

    const city = getCity(cityId);
    const club = getClub(this.state.career.clubId);
    const flavours = [
      `Un supporter vous reconnaît devant un café de ${city?.name} et demande un autographe.`,
      `Un groupe de jeunes portant le maillot de ${club?.name || 'votre club'} vous interpelle.`,
      `Une famille en vacances à ${city?.name} vous demande une photo.`,
      `Un supporter chante votre nom en vous croisant dans la rue.`,
      `Un enfant vous tend un maillot et un marqueur, les yeux brillants.`,
    ];

    return {
      id: `fan-${Date.now()}`,
      cityId,
      text: this.rng.pick(flavours),
      options: FAN_INTERACTIONS,
    };
  }

  /** Applique le choix du joueur face à un supporter. */
  respondToFan(interactionId, economy) {
    const interaction = FAN_INTERACTIONS.find((i) => i.id === interactionId);
    if (!interaction) return { ok: false, reason: 'Interaction inconnue.' };

    if (interaction.cost > 0) {
      const paid = economy.transact({
        amount: -interaction.cost,
        label: interaction.name,
        category: 'image',
      });
      if (!paid) return { ok: false, reason: 'Fonds insuffisants.' };
    }

    this.state.reputation.fanRelation = Math.max(0, Math.min(100, this.state.reputation.fanRelation + interaction.fanRelation));
    this.apply({ delta: interaction.reputation, reason: interaction.name, kind: 'media' });

    if (interaction.id === 'refuser') {
      bus.emit(EVENTS.HEADLINE, {
        title: 'Un refus qui fait jaser',
        body: `${this.state.player.name} a refusé une photo à un jeune supporter. Les réseaux s'enflamment.`,
        tone: 'negatif',
      });
    }

    return { ok: true, interaction };
  }

  // ── Influence sur le monde (Tome XXVI ch. 3) ───────────────────────────

  /**
   * Calcule l'influence mesurable du joueur sur son écosystème.
   * Ces valeurs sont réellement utilisées : ventes de maillots et affluence
   * alimentent les revenus du club et la fréquentation des stades.
   */
  influence() {
    const rep = this.state.reputation;
    const club = getClub(this.state.career.clubId);
    const factor = rep.global / 100;

    const shirtSales = Math.round(factor ** 1.8 * 1400000 * (1 + rep.fanRelation / 200));
    const attendanceBoost = Math.round(factor * 14 * (1 + rep.fanRelation / 300) * 10) / 10;
    const leaguePopularity = Math.round(factor * 22 * 10) / 10;
    const clubValueBoost = Math.round(factor ** 1.6 * (club?.budget || 1000000) * 0.28);
    const tourismBoost = Math.round(factor * 180000);

    return {
      shirtSales,
      attendanceBoost,
      leaguePopularity,
      clubValueBoost,
      tourismBoost,
      leagueName: club?.league || '—',
      clubName: club?.name || '—',
    };
  }

  /** Classement des pays où le joueur est le plus apprécié. */
  topCountries(limit = 6) {
    return Object.entries(this.state.reputation.byCountry)
      .map(([id, value]) => ({
        id,
        name: getCountry(id)?.name || id,
        value: Math.round(value * 10) / 10,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  // ── Honneurs culturels (Tome XXVI ch. 6) ───────────────────────────────

  checkHonours() {
    const rep = this.state.reputation;
    const obtained = new Set(rep.honours.map((h) => h.id));

    for (const honour of CULTURAL_HONOURS) {
      if (obtained.has(honour.id)) continue;
      if (rep.global < honour.minReputation) continue;
      if (honour.requiresRetired && !this.state.player.retired) continue;

      const club = getClub(this.state.career.clubId);
      const city = getCity(club?.cityId || this.state.world.currentCityId);

      rep.honours.push({
        id: honour.id,
        name: honour.name,
        season: this.state.clock.season,
        cityId: city?.id,
        cityName: city?.name,
      });

      if (honour.id === 'statue') {
        this.state.legacy.statues.push({
          season: this.state.clock.season,
          cityId: city?.id,
          location: `Devant ${city?.venues.find((v) => v.type === 'stade')?.name || 'le stade'}`,
        });
      }

      bus.emit(EVENTS.WORLD_EVENT, {
        kind: 'honour',
        title: honour.name,
        body: `${honour.body} — ${city?.name}.`,
        cinematic: 'inauguration-honneur',
      });
      bus.emit(EVENTS.HEADLINE, {
        title: `${honour.name} pour ${this.state.player.name}`,
        body: honour.body,
        tone: 'majeur',
      });

      this.state.legacy.timeline.push({
        season: this.state.clock.season,
        type: 'honneur',
        title: honour.name,
        detail: `${city?.name} — ${honour.body}`,
      });
    }
  }

  _currentCountry() {
    return getCity(this.state.world.currentCityId)?.country || null;
  }

  _nationalityCountryId() {
    const nationality = this.state.player.nationality;
    const country = CITIES
      .map((c) => getCountry(c.country))
      .find((c) => c && c.name === nationality);
    return country?.id || null;
  }
}
