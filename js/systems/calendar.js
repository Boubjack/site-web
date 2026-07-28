/**
 * calendar.js — Calendrier mondial dynamique.
 *
 * Exigences couvertes (Tome XIX intégralement) :
 *   ch. 2 — championnats, coupes, compétitions continentales, Coupe du Monde,
 *           Jeux Olympiques, Boubjack Awards, Ballon d'Or, matchs caritatifs,
 *           jubilés, matchs des légendes, stages de pré-saison, tournées estivales
 *   ch. 3 — ville hôte changeante, transformation de la ville
 *   ch. 4 — fan zones actives pendant les tournois
 *   ch. 5/6 — cérémonies d'ouverture et de clôture
 *   ch. 7 — impact sur le monde : hôtels complets, prix en hausse, médias
 *   ch. 1 — « même si le joueur ne participe pas, l'événement existe »
 *
 * Le calendrier est généré pour toute la saison à sa création, puis consommé
 * jour après jour. Les compétitions auxquelles le joueur ne participe pas sont
 * tout de même simulées en arrière-plan et produisent des vainqueurs.
 */

import { bus, EVENTS } from '../core/events.js';
import { COMPETITIONS, CLUBS, CITIES, AWARDS_HOST_CITIES, getClub, getCity } from '../data/world.js';

export class CalendarSystem {
  constructor(state, rng) {
    this.state = state;
    this.rng = rng;
    /** Rencontres du joueur pour la saison en cours. */
    this.fixtures = [];
    /** Événements mondiaux planifiés (cérémonies, tournois, fan zones). */
    this.worldEvents = [];
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.onDay()));
    this._unsubs.push(bus.on(EVENTS.SEASON_START, ({ season }) => this.generateSeason(season)));
    if (this.fixtures.length === 0) this.generateSeason(this.state.clock.season);
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  /**
   * Génère l'intégralité d'une saison : rencontres du club du joueur et
   * événements mondiaux. Appelé au 1er juillet de chaque année.
   */
  generateSeason(season) {
    this.fixtures = [];
    this.worldEvents = [];

    const club = getClub(this.state.career.clubId);
    if (!club) return;

    // Adversaires du championnat : clubs du même niveau, plus quelques voisins.
    const sameTier = CLUBS.filter((c) => c.id !== club.id && Math.abs(c.tier - club.tier) <= 1);
    const leagueOpponents = this.rng.shuffle(sameTier).slice(0, Math.min(9, sameTier.length));

    let cursor = { year: this.state.clock.year, month: 7, day: 12 };

    // ── Championnat : aller-retour contre chaque adversaire ────────────────
    const league = COMPETITIONS.find((c) => c.id === 'championnat');
    const rounds = [...leagueOpponents.map((o) => ({ o, home: true })), ...leagueOpponents.map((o) => ({ o, home: false }))];
    for (const round of this.rng.shuffle(rounds)) {
      this.fixtures.push({
        id: `fx-${this.fixtures.length + 1}`,
        competition: league.name,
        competitionId: league.id,
        opponentId: round.o.id,
        opponentName: round.o.name,
        home: round.home,
        importance: 0.5 + round.o.prestige / 300,
        date: { ...cursor },
        played: false,
      });
      cursor = this._addDays(cursor, this.rng.int(6, 9));
    }

    // ── Coupe nationale ───────────────────────────────────────────────────
    const cup = COMPETITIONS.find((c) => c.id === 'coupe-nationale');
    let cupCursor = { year: this.state.clock.year, month: 10, day: 8 };
    for (let round = 1; round <= 4; round++) {
      const opponent = this.rng.pick(CLUBS.filter((c) => c.id !== club.id));
      this.fixtures.push({
        id: `fx-${this.fixtures.length + 1}`,
        competition: `${cup.name} — ${round === 4 ? 'finale' : `tour ${round}`}`,
        competitionId: cup.id,
        opponentId: opponent.id,
        opponentName: opponent.name,
        home: this.rng.chance(0.5),
        importance: 0.5 + round * 0.12,
        date: { ...cupCursor },
        played: false,
        knockout: true,
      });
      cupCursor = this._addDays(cupCursor, this.rng.int(35, 55));
    }

    // ── Compétition continentale, réservée aux clubs prestigieux ──────────
    if (club.prestige >= 70) {
      const cont = COMPETITIONS.find((c) => c.id === 'continentale');
      let contCursor = { year: this.state.clock.year, month: 8, day: 17 };
      const contenders = CLUBS.filter((c) => c.id !== club.id && c.prestige >= 66);
      for (let matchday = 1; matchday <= 6; matchday++) {
        const opponent = this.rng.pick(contenders);
        this.fixtures.push({
          id: `fx-${this.fixtures.length + 1}`,
          competition: `${cont.name} — J${matchday}`,
          competitionId: cont.id,
          opponentId: opponent.id,
          opponentName: opponent.name,
          home: matchday % 2 === 1,
          importance: 0.85,
          date: { ...contCursor },
          played: false,
        });
        contCursor = this._addDays(contCursor, this.rng.int(14, 22));
      }
    }

    // ── Tournée estivale et matchs amicaux (Tome XIX ch. 2) ───────────────
    let tourCursor = { year: this.state.clock.year, month: 6, day: 8 };
    for (let i = 0; i < 3; i++) {
      const opponent = this.rng.pick(CLUBS.filter((c) => c.id !== club.id));
      this.fixtures.push({
        id: `fx-${this.fixtures.length + 1}`,
        competition: 'Tournée estivale',
        competitionId: 'tournee-estivale',
        opponentId: opponent.id,
        opponentName: opponent.name,
        home: false,
        importance: 0.25,
        date: { ...tourCursor },
        played: false,
        friendly: true,
      });
      tourCursor = this._addDays(tourCursor, this.rng.int(4, 7));
    }

    this.fixtures.sort((a, b) => this._stamp(a.date) - this._stamp(b.date));

    // ── Événements mondiaux ───────────────────────────────────────────────
    this._generateWorldEvents(season);

    bus.emit(EVENTS.NOTIFY, {
      level: 'info',
      title: `Saison ${season}-${season + 1}`,
      body: `${this.fixtures.length} rencontres programmées et ${this.worldEvents.length} événements mondiaux au calendrier.`,
    });
  }

  /** Événements du monde, indépendants de la participation du joueur. */
  _generateWorldEvents(season) {
    // Boubjack Awards — jamais deux années de suite dans la même ville.
    const lastHost = this.state.world.awardsHosts[season - 1];
    const candidates = AWARDS_HOST_CITIES.filter((c) => c !== lastHost);
    const host = this.rng.pick(candidates);
    this.state.world.awardsHosts[season] = host;

    this.worldEvents.push({
      id: `wev-awards-${season}`,
      type: 'ceremonie',
      subtype: 'boubjack-awards',
      name: 'Boubjack Awards',
      cityId: host,
      date: { year: season + 1, month: 0, day: this.rng.int(12, 24) },
      duration: 1,
      prestige: 100,
      transformsCity: true,
      announced: false,
      resolved: false,
    });

    // Ballon d'Or — cérémonie distincte, autre ville.
    const ballonHost = this.rng.pick(AWARDS_HOST_CITIES.filter((c) => c !== host));
    this.worldEvents.push({
      id: `wev-ballon-${season}`,
      type: 'ceremonie',
      subtype: 'ballon-dor',
      name: "Cérémonie du Ballon d'Or",
      cityId: ballonHost,
      date: { year: season, month: 10, day: this.rng.int(18, 28) },
      duration: 1,
      prestige: 95,
      transformsCity: true,
      announced: false,
      resolved: false,
    });

    // Grands tournois internationaux, selon leur périodicité.
    for (const comp of COMPETITIONS.filter((c) => c.everyYears)) {
      if ((season + 1) % comp.everyYears !== 0) continue;
      const tournamentHost = this.rng.pick(CITIES.filter((c) => c.venues.some((v) => v.type === 'stade')));
      const startMonth = comp.months[0];
      this.worldEvents.push({
        id: `wev-${comp.id}-${season}`,
        type: 'tournoi',
        subtype: comp.id,
        name: comp.name,
        cityId: tournamentHost.id,
        countryId: tournamentHost.country,
        date: { year: startMonth >= 6 ? season : season + 1, month: startMonth, day: this.rng.int(8, 16) },
        duration: 30,
        prestige: comp.prestige,
        transformsCity: true,
        fanZones: true,
        openingCeremony: true,
        closingCeremony: true,
        announced: false,
        resolved: false,
      });
    }

    // Matchs caritatifs, jubilés et matchs de légendes.
    for (const kind of [
      { subtype: 'match-caritatif', name: 'Match caritatif international', month: 11, prestige: 40 },
      { subtype: 'jubile', name: "Jubilé d'une légende", month: 5, prestige: 45 },
      { subtype: 'match-legendes', name: 'Match des légendes', month: 5, prestige: 50 },
    ]) {
      const city = this.rng.pick(CITIES.filter((c) => c.venues.some((v) => v.type === 'stade')));
      this.worldEvents.push({
        id: `wev-${kind.subtype}-${season}`,
        type: 'exhibition',
        subtype: kind.subtype,
        name: kind.name,
        cityId: city.id,
        date: { year: kind.month >= 6 ? season : season + 1, month: kind.month, day: this.rng.int(5, 25) },
        duration: 1,
        prestige: kind.prestige,
        transformsCity: false,
        announced: false,
        resolved: false,
      });
    }

    // Stages de pré-saison du club du joueur.
    const trainingCity = this.rng.pick(CITIES.filter((c) => c.venues.some((v) => ['montagne', 'centre'].includes(v.type))));
    this.worldEvents.push({
      id: `wev-stage-${season}`,
      type: 'stage',
      subtype: 'pre-saison',
      name: 'Stage de pré-saison',
      cityId: trainingCity.id,
      date: { year: season, month: 6, day: this.rng.int(3, 9) },
      duration: 10,
      prestige: 20,
      transformsCity: false,
      announced: false,
      resolved: false,
    });

    this.worldEvents.sort((a, b) => this._stamp(a.date) - this._stamp(b.date));
  }

  // ── Consommation quotidienne ────────────────────────────────────────────

  onDay() {
    const today = this._stamp(this.state.clock);

    // Annonce des événements approchants (J-14) — la couverture médiatique
    // commence bien avant l'événement (Tome XIX ch. 2).
    for (const event of this.worldEvents) {
      if (event.announced) continue;
      const days = this._daysUntil(event.date);
      if (days <= 14 && days >= 0) {
        event.announced = true;
        const city = getCity(event.cityId);
        bus.emit(EVENTS.HEADLINE, {
          title: `${event.name} : ${city?.name || 'ville hôte'} se prépare`,
          body: event.transformsCity
            ? `Décorations, écrans géants et fan zones s'installent. La sécurité est renforcée et les hôtels affichent déjà complet.`
            : `L'événement se tiendra dans ${days} jours.`,
          tone: 'neutre',
        });
        if (event.transformsCity) this._transformCity(event);
      }
    }

    // Déclenchement des événements du jour.
    for (const event of this.worldEvents) {
      if (event.resolved) continue;
      if (this._stamp(event.date) !== today) continue;
      event.resolved = true;
      this._fireWorldEvent(event);
    }

    // Fin des transformations de ville.
    this.state.world.activeEvents = this.state.world.activeEvents.filter((e) => {
      const endStamp = this._stamp(this._addDays(e.date, e.duration));
      return endStamp >= today;
    });
  }

  /** Transformation de la ville hôte — Tome XIX ch. 3 et 7. */
  _transformCity(event) {
    const city = getCity(event.cityId);
    if (!city) return;

    const transformation = {
      id: event.id,
      cityId: event.cityId,
      name: event.name,
      date: event.date,
      duration: event.duration + 14,
      effects: {
        decorations: true,
        ecransGeants: true,
        fanZones: !!event.fanZones,
        concerts: event.prestige >= 80,
        securiteRenforcee: true,
        animationsDeRue: true,
        // Impact économique : hôtels saturés, prix majorés (ch. 7).
        hotelOccupancy: 1.0,
        priceMultiplier: 1 + event.prestige / 250,
        touristInflux: Math.round(event.prestige * 1200),
      },
    };

    this.state.world.activeEvents.push(transformation);

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'city-transform',
      cityId: event.cityId,
      title: `${city.name} aux couleurs de ${event.name}`,
      body: `Fan zones, écrans géants et animations de rue. Les prix des hôtels augmentent de ${Math.round((transformation.effects.priceMultiplier - 1) * 100)} %.`,
    });
  }

  _fireWorldEvent(event) {
    const city = getCity(event.cityId);

    if (event.openingCeremony) {
      bus.emit(EVENTS.WORLD_EVENT, {
        kind: 'ceremony',
        cityId: event.cityId,
        title: `Cérémonie d'ouverture — ${event.name}`,
        body: `Spectacle, drones, feux d'artifice et performances musicales à ${city?.name}. Présentation des équipes et arrivée du trophée.`,
        cinematic: 'ceremonie-ouverture',
      });
    }

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: event.type,
      subtype: event.subtype,
      cityId: event.cityId,
      title: event.name,
      body: `${event.name} débute à ${city?.name || 'destination inconnue'}.`,
      event,
    });

    // Le Ballon d'Or est arbitré par le système de récompenses ; les autres
    // compétitions produisent ici un vainqueur, même sans le joueur (ch. 1).
    if (event.type === 'tournoi') {
      const winner = this.rng.weighted(CLUBS, (c) => c.prestige ** 2);
      this.state.world.worldMemory.push({
        season: this.state.clock.season,
        type: 'palmares',
        subject: event.subtype,
        text: `${event.name} ${event.date.year} remporté par une sélection emmenée par des joueurs de ${winner.name}.`,
      });
      bus.emit(EVENTS.HEADLINE, {
        title: `${event.name} : le tournoi est lancé à ${city?.name}`,
        body: `Trente jours de compétition, des fan zones dans toute la ville et des supporters venus du monde entier.`,
        tone: 'neutre',
      });
    }
  }

  // ── Requêtes ────────────────────────────────────────────────────────────

  /** Prochaine rencontre non jouée. */
  nextFixture() {
    const today = this._stamp(this.state.clock);
    return this.fixtures.find((f) => !f.played && this._stamp(f.date) >= today) || null;
  }

  /** Rencontres du jour. */
  fixturesToday() {
    const today = this._stamp(this.state.clock);
    return this.fixtures.filter((f) => !f.played && this._stamp(f.date) === today);
  }

  /** Rencontres dont la date est dépassée sans avoir été jouées. */
  overdueFixtures() {
    const today = this._stamp(this.state.clock);
    return this.fixtures.filter((f) => !f.played && this._stamp(f.date) < today);
  }

  /** Prochains événements mondiaux, tous types confondus. */
  upcomingEvents(limit = 6) {
    const today = this._stamp(this.state.clock);
    return this.worldEvents
      .filter((e) => this._stamp(e.date) >= today)
      .slice(0, limit)
      .map((e) => ({
        ...e,
        cityName: getCity(e.cityId)?.name || '—',
        daysUntil: this._daysUntil(e.date),
      }));
  }

  /** Une ville est-elle en configuration « événement » aujourd'hui ? */
  cityIsTransformed(cityId) {
    return this.state.world.activeEvents.find((e) => e.cityId === cityId) || null;
  }

  markPlayed(fixtureId) {
    const fixture = this.fixtures.find((f) => f.id === fixtureId);
    if (fixture) fixture.played = true;
  }

  // ── Dates ───────────────────────────────────────────────────────────────

  _stamp(date) {
    return date.year * 10000 + (date.month + 1) * 100 + date.day;
  }

  _daysUntil(date) {
    const a = new Date(this.state.clock.year, this.state.clock.month, this.state.clock.day);
    const b = new Date(date.year, date.month, date.day);
    return Math.round((b - a) / 86400000);
  }

  _addDays(date, days) {
    const d = new Date(date.year, date.month, date.day + days);
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }

  serialize() {
    return { fixtures: this.fixtures, worldEvents: this.worldEvents };
  }

  restore(data) {
    if (!data) return;
    this.fixtures = data.fixtures || [];
    this.worldEvents = data.worldEvents || [];
  }
}
