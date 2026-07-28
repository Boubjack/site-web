/**
 * game.js — Orchestrateur du jeu.
 *
 * Assemble le noyau (horloge, RNG, état, sauvegarde) et l'ensemble des
 * systèmes, dans un ordre d'installation qui respecte leurs dépendances.
 *
 * Principe d'architecture (Tome XXII ch. 1) : chaque système est indépendant
 * et ne connaît que le bus d'événements et l'état partagé. L'orchestrateur est
 * le seul endroit du code qui connaît tous les systèmes à la fois.
 */

import { bus, EVENTS, EventBus } from './core/events.js';
import { RNG } from './core/rng.js';
import { Clock } from './core/clock.js';
import { createInitialState } from './core/state.js';
import { saveGame, loadGame, listSaves, deleteSave, exportSave, importSave } from './core/save.js';

import { WeatherSystem } from './systems/weather.js';
import { EconomySystem } from './systems/economy.js';
import { MatchEngine } from './systems/match.js';
import { CalendarSystem } from './systems/calendar.js';
import { CareerSystem } from './systems/career.js';
import { ReputationSystem } from './systems/reputation.js';
import { MediaSystem } from './systems/media.js';
import { AwardsSystem } from './systems/awards.js';
import { WorldSystem } from './systems/world.js';
import { PhoneSystem } from './systems/phone.js';

import { getClub, getCity } from './data/world.js';

export class Game {
  constructor() {
    /** @type {import('./core/events.js').EventBus} */
    this.bus = bus;
    this.state = null;
    this.clock = null;
    this.rng = null;
    this.systems = {};
    this.started = false;
    /** File des cinématiques en attente d'affichage */
    this.cinematicQueue = [];
    this._autosaveUnsub = null;
  }

  // ── Cycle de vie ────────────────────────────────────────────────────────

  /** Démarre une nouvelle partie. */
  newGame(options = {}) {
    this._teardown();

    this.state = createInitialState(options);
    this.rng = new RNG(this.state.seed);
    this.clock = new Clock({
      startYear: this.state.clock.year,
      startMonth: this.state.clock.month,
      startDay: this.state.clock.day,
      startHour: this.state.clock.hour,
    }).bind(this.state.clock);

    // La ville de départ est celle du club choisi.
    const club = getClub(this.state.career.clubId);
    if (club) this.state.world.currentCityId = club.cityId;

    this._installSystems();
    this._wireGlobalHandlers();
    this._openingSequence();

    this.started = true;
    return this;
  }

  /** Charge une sauvegarde existante. */
  load(slot) {
    const result = loadGame(slot);
    if (!result.ok) return result;

    this._teardown();

    this.state = result.state;
    this.rng = RNG.deserialize(this.state.rng);
    this.clock = Clock.deserialize(this.state.clock).bind(this.state.clock);

    this._installSystems();

    // Restauration des états internes des systèmes.
    const runtime = this.state._runtime || {};
    this.systems.weather.restore(runtime.weather);
    this.systems.calendar.restore(runtime.calendar);
    this.systems.match.restore(runtime.match);
    this.systems.world.restore(runtime.world);
    this.systems.career.restore(runtime.career);
    this.systems.phone.restore(runtime.phone);

    this._wireGlobalHandlers();
    this.started = true;

    if (result.migratedFrom) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'info',
        title: 'Sauvegarde migrée',
        body: `Sauvegarde v${result.migratedFrom} convertie vers la version ${this.state.version}. Aucune donnée perdue.`,
      });
    }

    return { ok: true, migratedFrom: result.migratedFrom };
  }

  /** Sauvegarde la partie en cours. */
  save(slot = 'auto') {
    if (!this.started) return false;

    // Sérialisation de l'horloge, du RNG et des états internes des systèmes.
    // L'horloge est copiée dans l'objet lié, jamais remplacée : remplacer
    // `state.clock` romprait la liaison établie par Clock.bind().
    Object.assign(this.state.clock, this.clock.serialize());
    this.state.rng = this.rng.serialize();
    this.state._runtime = {
      weather: this.systems.weather.serialize(),
      calendar: this.systems.calendar.serialize(),
      match: this.systems.match.serialize(),
      world: this.systems.world.serialize(),
      career: this.systems.career.serialize(),
      phone: this.systems.phone.serialize(),
    };

    const club = getClub(this.state.career.clubId);
    return saveGame(slot, this.state, {
      label: slot === 'auto' ? 'Sauvegarde automatique' : `Sauvegarde ${slot}`,
      playerName: this.state.player.name,
      season: this.state.clock.season,
      club: club?.name || '—',
    });
  }

  listSaves() { return listSaves(); }
  deleteSave(slot) { return deleteSave(slot); }
  exportSave() { this.save('auto'); return exportSave(this.state); }

  importSave(json) {
    const result = importSave(json);
    if (!result.ok) return result;

    this._teardown();
    this.state = result.state;
    this.rng = RNG.deserialize(this.state.rng);
    this.clock = Clock.deserialize(this.state.clock).bind(this.state.clock);
    this._installSystems();

    const runtime = this.state._runtime || {};
    this.systems.weather.restore(runtime.weather);
    this.systems.calendar.restore(runtime.calendar);
    this.systems.match.restore(runtime.match);
    this.systems.world.restore(runtime.world);
    this.systems.career.restore(runtime.career);
    this.systems.phone.restore(runtime.phone);

    this._wireGlobalHandlers();
    this.started = true;
    return { ok: true };
  }

  // ── Installation des systèmes ───────────────────────────────────────────

  /**
   * L'ordre compte : un système ne peut être installé qu'après ceux dont il
   * dépend. Les dépendances sont injectées explicitement, jamais importées
   * en dur d'un système vers un autre.
   */
  _installSystems() {
    const s = this.state;
    const rng = this.rng;

    // 1. Météo — ne dépend de rien.
    const weather = new WeatherSystem(s, rng.fork('weather'));

    // 2. Économie — indépendante, mais consommée par presque tout le monde.
    const economy = new EconomySystem(s, rng.fork('economy'));

    // 3. Moteur de match — a besoin de la météo.
    const match = new MatchEngine(s, rng.fork('match'), { weather });

    // 4. Calendrier — a besoin du club, pas des autres systèmes.
    const calendar = new CalendarSystem(s, rng.fork('calendar'));

    // 5. Réputation — écoute les événements de tous les autres.
    const reputation = new ReputationSystem(s, rng.fork('reputation'));

    // 6. Carrière — orchestre entraînement, transferts, contrats.
    const career = new CareerSystem(s, rng.fork('career'), { economy, matchEngine: match, calendar });

    // 7. Médias — réagit aux matchs, transferts et blessures.
    const media = new MediaSystem(s, rng.fork('media'), { reputation });

    // 8. Récompenses — a besoin du moteur de match pour évaluer le niveau.
    const awards = new AwardsSystem(s, rng.fork('awards'), { matchEngine: match, reputation });

    // 9. Monde ouvert — a besoin de l'économie, de la météo, du calendrier.
    const world = new WorldSystem(s, rng.fork('world'), { economy, weather, calendar, reputation });

    // 10. Téléphone — agrège tout le reste.
    const phone = new PhoneSystem(s, rng.fork('phone'), {
      economy, weather, calendar, media, world, career, reputation, matchEngine: match,
    });

    this.systems = { weather, economy, match, calendar, reputation, career, media, awards, world, phone };

    // Installation dans l'ordre : la météo d'abord (les autres la consultent).
    weather.install();
    economy.install();
    calendar.install();
    reputation.install();
    career.install();
    media.install();
    awards.install();
    world.install();
    phone.install();
  }

  _wireGlobalHandlers() {
    // Les cinématiques sont mises en file pour être jouées par l'interface.
    this._cinematicUnsub = bus.on(EVENTS.WORLD_EVENT, (payload) => {
      if (payload.cinematic || payload.kind === 'ceremony' || payload.kind === 'rare') {
        this.cinematicQueue.push({
          title: payload.title,
          body: payload.body,
          kind: payload.cinematic || payload.kind,
          at: this.clock.dateLabel,
        });
        if (this.cinematicQueue.length > 12) this.cinematicQueue.shift();
      }
    });

    // Sauvegarde automatique hebdomadaire — Tome X ch. 8.
    this._autosaveUnsub = bus.on(EVENTS.WEEK, () => {
      if (this.state.settings.autosave) this.save('auto');
    });

    // Trophées collectifs : une compétition gagnée est enregistrée.
    this._trophyUnsub = bus.on(EVENTS.SEASON_END, () => this._resolveSeasonTrophies());
  }

  _teardown() {
    for (const system of Object.values(this.systems)) {
      if (typeof system.uninstall === 'function') system.uninstall();
    }
    this.systems = {};
    if (this._autosaveUnsub) this._autosaveUnsub();
    if (this._cinematicUnsub) this._cinematicUnsub();
    if (this._trophyUnsub) this._trophyUnsub();
    if (this.clock) this.clock.pause();
    this.cinematicQueue = [];
    // Volontairement : pas de bus.clear() ici. Les systèmes se désabonnent
    // eux-mêmes via uninstall() ; l'interface conserve ses propres écoutes
    // à travers un changement de partie.
  }

  /**
   * Détermine si le club du joueur a remporté quelque chose cette saison.
   * Le résultat dépend des performances réelles en compétition.
   */
  _resolveSeasonTrophies() {
    const season = this.state.clock.season;
    const fixtures = this.systems.calendar.fixtures.filter((f) => f.played);
    if (fixtures.length === 0) return;

    const club = getClub(this.state.career.clubId);
    if (!club) return;

    // Bilan du championnat.
    const seasonStats = this.state.stats.seasons[season];
    if (!seasonStats || seasonStats.matchs === 0) return;

    const winRate = seasonStats.victoires / Math.max(1, seasonStats.matchs);
    // La force du club et les performances du joueur pèsent tous les deux.
    const titleChance = Math.max(0, Math.min(0.85,
      winRate * 0.7 + (club.prestige - 60) / 200,
    ));

    if (this.rng.chance(titleChance)) {
      this.systems.awards.awardTrophy(club.league, 'championnat');
    }
    if (this.rng.chance(titleChance * 0.5)) {
      this.systems.awards.awardTrophy('Coupe nationale', 'coupe-nationale');
    }
    if (club.prestige >= 70 && this.rng.chance(titleChance * 0.3)) {
      this.systems.awards.awardTrophy('Ligue Continentale', 'continentale');
    }

    // Maillots des légendes côtoyées — Tome IV ch. 6, Tome XX ch. 4.
    if (this.rng.chance(0.35)) {
      this.state.legacy.framedShirts.push({
        legend: this._legendName(),
        season,
        inscription: 'À mon coéquipier, avec respect.',
      });
    }
  }

  _legendName() {
    const names = ['Emeka Okonkwo', 'Rui Ferreira', 'Anton Volkov', 'Aminata Diallo', 'Carlos Mendoza', 'Hiro Tanaka', 'Lars Bergström', 'Grace Nkemba'];
    return this.rng.pick(names);
  }

  /** Séquence d'ouverture d'une nouvelle carrière. */
  _openingSequence() {
    const club = getClub(this.state.career.clubId);
    const city = getCity(this.state.world.currentCityId);

    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} signe son premier contrat professionnel`,
      body: `Le jeune ${this._positionLabel()} de ${this.state.player.age} ans s'engage avec ${club?.name} à ${city?.name}.`,
      tone: 'positif',
    });

    this.state.legacy.timeline.push({
      season: this.state.clock.season,
      type: 'debut',
      title: 'Premier contrat professionnel',
      detail: `${club?.name} — ${city?.name}.`,
    });

    bus.emit(EVENTS.NOTIFY, {
      level: 'success',
      title: `Bienvenue à ${club?.name}`,
      body: `Votre carrière commence à ${city?.name}. Consultez votre IA secrétaire pour connaître votre programme.`,
    });
  }

  _positionLabel() {
    return {
      GB: 'gardien', DC: 'défenseur central', DL: 'latéral', MD: 'milieu défensif',
      MC: 'milieu central', MO: 'meneur de jeu', AT: 'attaquant',
    }[this.state.player.position] || 'joueur';
  }

  // ── Contrôle du temps ───────────────────────────────────────────────────

  /** Avance le temps de `hours` heures de jeu. */
  advance(hours = 1) {
    if (!this.started) return;
    this.clock.advance(hours);
    Object.assign(this.state.clock, this.clock.serialize());
  }

  advanceDays(days) { this.advance(days * 24); }

  /** Avance jusqu'au prochain match, sans le dépasser. */
  advanceToNextMatch() {
    const fixture = this.systems.calendar.nextFixture();
    if (!fixture) {
      this.advanceDays(7);
      return { ok: false, reason: 'Aucun match programmé — une semaine s\'écoule.' };
    }

    const target = new Date(fixture.date.year, fixture.date.month, fixture.date.day);
    const now = new Date(this.clock.year, this.clock.month, this.clock.day);
    const days = Math.max(0, Math.round((target - now) / 86400000));

    if (days === 0) return { ok: true, fixture, daysAdvanced: 0 };
    this.advanceDays(days);
    return { ok: true, fixture, daysAdvanced: days };
  }

  togglePause() {
    const running = this.clock.toggle();
    Object.assign(this.state.clock, this.clock.serialize());
    return running;
  }

  // ── Vue agrégée pour l'interface ────────────────────────────────────────

  /** Instantané complet de l'état du jeu, consommé par l'interface. */
  snapshot() {
    if (!this.started) return null;

    const s = this.state;
    const club = getClub(s.career.clubId);
    const city = getCity(s.world.currentCityId);
    const nextFixture = this.systems.calendar.nextFixture();

    return {
      clock: this.clock.snapshot(),
      player: {
        ...s.player,
        overall: this.systems.match.overall(),
        positionLabel: this._positionLabel(),
      },
      club: club ? { ...club } : null,
      city: city ? { id: city.id, name: city.name, country: city.country } : null,
      contract: s.career.contract,
      marketValue: s.career.marketValue,
      squadStatus: s.career.squadStatus,
      reputation: {
        ...s.reputation,
        tier: this.systems.reputation.tier(),
        recognition: Math.round(this.systems.reputation.recognitionChance() * 100),
      },
      finance: {
        courant: s.economy.accounts.courant,
        epargne: s.economy.accounts.epargne,
        professionnel: s.economy.accounts.professionnel,
        netWorth: this.systems.economy.netWorth(),
        monthlyIncome: this.systems.economy.monthlyIncome(),
        monthlyBurn: this.systems.economy.monthlyBurn(),
      },
      weather: this.systems.weather.at(s.world.currentCityId),
      weatherText: this.systems.weather.describe(),
      nextFixture,
      stats: {
        career: s.stats.career,
        season: s.stats.seasons[this.clock.season] || null,
      },
      legacy: {
        trophies: s.legacy.trophies.length,
        awards: s.legacy.awards.length,
        hallOfFame: s.legacy.hallOfFame,
        museum: s.legacy.museum,
      },
      phone: {
        unread: s.phone.unread,
        followers: s.phone.followers,
        orders: s.phone.orders.filter((o) => o.status !== 'livré').length,
      },
      cinematics: this.cinematicQueue.slice(),
      settings: s.settings,
    };
  }

  /** Vide la file des cinématiques après affichage. */
  consumeCinematics() {
    const queue = this.cinematicQueue.slice();
    this.cinematicQueue = [];
    return queue;
  }

  /** Diagnostic complet — Tome XXII ch. 7 : outils développeurs. */
  diagnostics() {
    const s = this.state;
    return {
      version: s.version,
      seed: s.seed,
      season: this.clock.season,
      totalHours: this.clock.totalHours,
      ticksProcessed: s.diagnostics.ticksProcessed,
      matchesSimulated: s.diagnostics.matchesSimulated,
      lastSaveAt: s.diagnostics.lastSaveAt,
      systems: Object.keys(this.systems),
      ledgerEntries: s.economy.ledger.length,
      headlines: s.media.headlines.length,
      worldMemory: s.world.worldMemory.length,
      npcs: this.systems.world.npcs.length,
      fixtures: this.systems.calendar.fixtures.length,
      worldEvents: this.systems.calendar.worldEvents.length,
      stateSizeKb: Math.round(JSON.stringify(s).length / 1024),
      busJournal: bus.journal(20).map((e) => e.type),
      warnings: s.diagnostics.warnings,
    };
  }

  /**
   * Validation automatique des données — Tome XXII ch. 7.
   * Vérifie la cohérence référentielle de l'état et signale toute anomalie.
   */
  validate() {
    const problems = [];
    const s = this.state;

    if (!getClub(s.career.clubId)) problems.push(`Club inconnu : ${s.career.clubId}`);
    if (!getCity(s.world.currentCityId)) problems.push(`Ville inconnue : ${s.world.currentCityId}`);

    for (const entry of s.career.clubHistory) {
      if (!getClub(entry.clubId)) problems.push(`Historique : club inconnu ${entry.clubId}`);
    }

    for (const [key, value] of Object.entries(s.player.attributes)) {
      if (typeof value !== 'number' || value < 1 || value > 99) {
        problems.push(`Attribut hors bornes : ${key} = ${value}`);
      }
    }

    if (s.reputation.global < 0 || s.reputation.global > 100) {
      problems.push(`Réputation hors bornes : ${s.reputation.global}`);
    }

    // Cohérence comptable : le dernier solde du journal doit correspondre.
    const lastByAccount = {};
    for (const entry of s.economy.ledger) lastByAccount[entry.account] = entry.balanceAfter;
    for (const [account, balance] of Object.entries(lastByAccount)) {
      const actual = s.economy.accounts[account];
      if (Math.abs(actual - balance) > 1) {
        problems.push(`Écart comptable sur ${account} : journal ${balance}, solde ${actual}`);
      }
    }

    for (const property of s.economy.properties) {
      if (!getCity(property.cityId)) problems.push(`Bien immobilier dans une ville inconnue : ${property.cityId}`);
    }

    s.diagnostics.warnings = problems;
    return { ok: problems.length === 0, problems };
  }
}

/** Instance unique exposée à l'interface. */
export const game = new Game();

// Exposition pour la console développeur intégrée.
if (typeof window !== 'undefined') {
  window.InfinityFootball = { game, bus, EVENTS, EventBus };
}
