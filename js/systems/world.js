/**
 * world.js — Monde ouvert vivant.
 *
 * Exigences couvertes :
 *   - Tome II ch. 1.2 : le monde fonctionne sans attendre le joueur
 *   - Tome II ch. 1.3 : aucune zone inutile, tout lieu important est visitable
 *   - Tome II ch. 1.4 : liberté totale de déplacement et de destination
 *   - Tome XX ch. 2   : gestes du quotidien contextuels
 *   - Tome XX ch. 5   : les PNJ réagissent à la célébrité, aux trophées, au club
 *   - Tome XX ch. 6   : événements dynamiques (mariages, concerts, marchés…)
 *   - Tome XXX ch. 3  : le voyage est entièrement jouable, étape par étape
 *   - Tome XXX ch. 4  : vacances, seul ou accompagné, activités exclusives
 *   - Tome XXXII ch. 2 : lieux secrets et easter eggs à découvrir
 *   - Tome XXXII ch. 3 : les PNJ vivent leur propre vie et vieillissent
 *   - Tome XXXII ch. 4 : le monde se transforme au fil des saisons
 *   - Tome XXXII ch. 5 : événements rares
 */

import { bus, EVENTS } from '../core/events.js';
import {
  CITIES, TRANSPORTS, ACTIVITIES, VENUE_TYPES,
  getCity, getCountry, distanceKm, venuesOfType,
} from '../data/world.js';

/** Étapes d'un voyage — Tome XXX v2 ch. 3 : « le voyage est entièrement jouable ». */
const TRAVEL_STAGES = {
  avion: ['Réservation du vol', 'Trajet vers l\'aéroport', 'Enregistrement', 'Embarquement', 'Décollage', 'Vol', 'Atterrissage', 'Récupération des bagages', 'Trajet jusqu\'à l\'hôtel'],
  jet: ['Confirmation au pilote', 'Arrivée au terminal privé', 'Embarquement immédiat', 'Décollage', 'Vol', 'Atterrissage', 'Voiture sur le tarmac'],
  helicoptere: ['Réservation', 'Montée sur l\'hélisurface', 'Décollage', 'Survol', 'Atterrissage'],
  train: ['Achat du billet', 'Arrivée en gare', 'Montée à bord', 'Trajet', 'Descente en gare'],
  yacht: ['Préparation du yacht', 'Appareillage', 'Navigation', 'Accostage', 'Débarquement'],
  voiture: ['Montée dans le véhicule', 'Sortie du garage', 'Route', 'Arrivée à destination', 'Stationnement'],
  default: ['Départ', 'Trajet', 'Arrivée'],
};

/** Événements dynamiques observables — Tome XX ch. 6. */
const STREET_EVENTS = [
  { id: 'mariage', name: 'Un mariage', text: 'Un cortège de mariage traverse la place, klaxons et youyous.', weight: 8, wellbeing: 2 },
  { id: 'concert', name: 'Un concert', text: 'Une scène est montée sur la place ; le concert commence dans une heure.', weight: 10, wellbeing: 4 },
  { id: 'festival', name: 'Un festival', text: 'Le quartier est en festival : stands, musique et lumières partout.', weight: 7, wellbeing: 5 },
  { id: 'marche', name: 'Un marché', text: 'Le marché bat son plein, les étals débordent.', weight: 14, wellbeing: 2 },
  { id: 'enfants-foot', name: 'Des enfants jouent au football', text: 'Des enfants improvisent un match entre deux voitures. Ils vous reconnaissent peut-être.', weight: 16, wellbeing: 4, fanEncounter: true },
  { id: 'artistes', name: 'Des artistes de rue', text: 'Un groupe de percussionnistes s\'est installé au coin de la rue.', weight: 11, wellbeing: 3 },
  { id: 'travaux', name: 'Des travaux', text: 'La rue est barrée pour travaux, la circulation est déviée.', weight: 12, wellbeing: -1, travelPenalty: 1.3 },
  { id: 'accident', name: 'Un accident', text: 'Les services de secours prennent en charge un accident de la circulation.', weight: 6, wellbeing: -2, travelPenalty: 1.5 },
  { id: 'tournage', name: 'Un tournage', text: 'Une équipe de tournage a privatisé le boulevard.', weight: 5, wellbeing: 1 },
  { id: 'manifestation-supporters', name: 'Un rassemblement de supporters', text: 'Des supporters se rassemblent avant un match, chants et fumigènes.', weight: 9, wellbeing: 3, fanEncounter: true },
];

/** Événements rares — Tome XXXII ch. 5. */
const RARE_EVENTS = [
  { id: 'gala', name: 'Invitation à un gala privé', minReputation: 55, text: 'Un carton d\'invitation vous parvient : gala privé, cercle très fermé.' },
  { id: 'rencontre-legende', name: 'Rencontre avec une légende', minReputation: 40, text: 'Vous croisez une légende du football dans le hall de l\'hôtel. La discussion dure une heure.' },
  { id: 'statue-inauguration', name: 'Inauguration d\'une statue', minReputation: 30, text: 'La ville inaugure la statue d\'un ancien joueur. Vous êtes invité au premier rang.' },
  { id: 'chef-etat', name: "Visite d'un chef d'État", minReputation: 60, text: "Un chef d'État visite officiellement le stade. Poignées de main et photos protocolaires." },
  { id: 'musee-exceptionnel', name: 'Ouverture exceptionnelle d\'un musée', minReputation: 20, text: 'Un musée ouvre exceptionnellement de nuit pour une visite privée.' },
  { id: 'record-mondial', name: 'Célébration après un record mondial', minReputation: 70, text: 'Un record mondial vient de tomber. La ville entière est dans la rue.' },
];

/** Lieux secrets et easter eggs — Tome XXXII ch. 2. */
const SECRETS = [
  { id: 'terrain-fondateur', name: 'Le terrain des fondateurs', cityId: 'bamako', type: 'terrain historique', text: "Un terrain de terre battue derrière le marché : c'est ici que tout a commencé pour beaucoup." },
  { id: 'cafe-tacticiens', name: 'Le café des tacticiens', cityId: 'milan', type: 'café célèbre', text: 'Un café où trois générations d\'entraîneurs ont dessiné leurs systèmes sur des nappes en papier.' },
  { id: 'musee-cache', name: 'Le musée caché de la Tamise', cityId: 'londres', type: 'musée caché', text: 'Une collection privée d\'objets du football, accessible sur invitation seulement.' },
  { id: 'boutique-artisan', name: 'L\'atelier du bottier', cityId: 'paris', type: 'boutique exclusive', text: 'Un artisan fabrique encore des crampons sur mesure, à la main, en trois semaines.' },
  { id: 'mur-legendes', name: 'Le mur des légendes', cityId: 'rio', type: 'hommage', text: 'Une fresque de 200 mètres retraçant un siècle de football brésilien.' },
  { id: 'tunnel-oublie', name: 'Le tunnel oublié', cityId: 'madrid', type: 'easter egg', text: 'Un ancien tunnel de vestiaire muré depuis 1974, redécouvert lors de travaux.' },
  { id: 'plage-des-buts', name: 'La plage des mille buts', cityId: 'dakar', type: 'terrain historique', text: 'Une plage où se jouent chaque soir des matchs qui ont formé des générations.' },
  { id: 'observatoire', name: 'L\'observatoire du stade', cityId: 'tokyo', type: 'lieu secret', text: 'Une passerelle technique offrant la plus belle vue qui soit sur la pelouse.' },
];

export class WorldSystem {
  constructor(state, rng, { economy, weather, calendar, reputation }) {
    this.state = state;
    this.rng = rng;
    this.economy = economy;
    this.weather = weather;
    this.calendar = calendar;
    this.reputation = reputation;
    /** Population de PNJ suivis dans la durée — Tome XXXII ch. 3. */
    this.npcs = [];
    /** Événements de rue actifs dans la ville courante */
    this.streetEvents = [];
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.onDay()));
    this._unsubs.push(bus.on(EVENTS.SEASON_END, () => this.evolveWorld()));
    if (this.npcs.length === 0) this._seedNpcs();
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Cycle quotidien du monde ────────────────────────────────────────────

  onDay() {
    // Le monde tourne partout, pas seulement là où se trouve le joueur.
    this._simulateNpcLives();
    this._rollStreetEvents();
    this._rollRareEvent();
    this._rollDiscovery();

    // Revenus du musée personnel — Tome XXI ch. 4.
    if (this.state.legacy.museum.built) {
      const base = 40 + this.state.reputation.global * 6;
      const visitors = Math.round(base * this.rng.float(0.7, 1.4));
      const revenue = visitors * 14;
      this.state.legacy.museum.visitors += visitors;
      this.state.legacy.museum.revenue += revenue;
      if (this.state.clock.day === 1) {
        this.economy.transact({
          amount: Math.round(this.state.legacy.museum.revenue * 0.3),
          account: 'professionnel',
          label: 'Recettes du musée personnel',
          category: 'patrimoine',
        });
        this.state.legacy.museum.revenue = Math.round(this.state.legacy.museum.revenue * 0.7);
        // Les visiteurs laissent des avis.
        this.state.legacy.museum.rating = Math.max(1, Math.min(5,
          this.state.legacy.museum.rating + this.rng.float(-0.15, 0.2),
        ));
      }
    }
  }

  // ── PNJ vivants (Tome XXXII ch. 3, Tome VIII ch. 8) ────────────────────

  _seedNpcs() {
    const jobs = ['commerçant', 'chauffeur de taxi', 'serveur', 'vendeuse', 'agent d\'entretien', 'kiosquier', 'coiffeur', 'gardien', 'professeur', 'infirmière', 'boulanger', 'guide touristique'];
    const count = 40;

    for (let i = 0; i < count; i++) {
      const city = this.rng.pick(CITIES);
      this.npcs.push({
        id: `npc-${i}`,
        name: this._generateName(),
        age: this.rng.int(19, 64),
        cityId: city.id,
        job: this.rng.pick(jobs),
        married: this.rng.chance(0.35),
        children: this.rng.int(0, 3),
        retired: false,
        /** Le PNJ se souvient du joueur — Tome VIII ch. 2. */
        metPlayer: 0,
        opinion: 50,
        lastSeenSeason: null,
      });
    }
  }

  /** Chaque jour, quelques PNJ voient leur vie évoluer. */
  _simulateNpcLives() {
    const sample = this.rng.sample(this.npcs, 3);
    for (const npc of sample) {
      const roll = this.rng.next();

      if (roll < 0.02 && !npc.retired && npc.age >= 62) {
        npc.retired = true;
        npc.job = 'retraité';
        this._logNpcLife(npc, 'a pris sa retraite');
      } else if (roll < 0.05 && !npc.retired) {
        const jobs = ['commerçant', 'chauffeur', 'serveur', 'gérant', 'artisan', 'technicien'];
        npc.job = this.rng.pick(jobs);
        this._logNpcLife(npc, `a changé d'emploi : désormais ${npc.job}`);
      } else if (roll < 0.07) {
        const newCity = this.rng.pick(CITIES.filter((c) => c.id !== npc.cityId));
        npc.cityId = newCity.id;
        this._logNpcLife(npc, `a déménagé à ${newCity.name}`);
      } else if (roll < 0.085 && !npc.married && npc.age >= 24) {
        npc.married = true;
        this._logNpcLife(npc, 's\'est marié');
      } else if (roll < 0.095 && npc.married && npc.children < 4) {
        npc.children++;
        this._logNpcLife(npc, `a eu un enfant (${npc.children} au total)`);
      } else if (roll < 0.11) {
        const destination = this.rng.pick(CITIES.filter((c) => c.id !== npc.cityId));
        this._logNpcLife(npc, `voyage à ${destination.name}`);
      }
    }

    // Vieillissement au 1er janvier.
    if (this.state.clock.month === 0 && this.state.clock.day === 1) {
      for (const npc of this.npcs) npc.age++;
    }
  }

  _logNpcLife(npc, action) {
    bus.emit(EVENTS.NPC_LIFE, { npc: npc.name, action, cityId: npc.cityId });
  }

  /** PNJ présents dans la ville courante, avec leur réaction au joueur. */
  npcsHere(cityId = this.state.world.currentCityId) {
    return this.npcs
      .filter((n) => n.cityId === cityId)
      .map((npc) => ({ ...npc, reaction: this._npcReaction(npc) }));
  }

  /** Réaction d'un PNJ — Tome XX ch. 5 : dépend de la célébrité et du palmarès. */
  _npcReaction(npc) {
    const city = getCity(npc.cityId);
    const localRep = this.state.reputation.byCountry[city?.country] ?? this.state.reputation.global * 0.5;
    const trophies = this.state.legacy.trophies.length;
    const awards = this.state.legacy.awards.length;

    if (localRep < 12) return `${npc.name} ne vous prête aucune attention.`;
    if (localRep < 30) return `${npc.name} vous jette un regard, hésite, puis retourne à son travail.`;
    if (localRep < 50) {
      return npc.metPlayer > 0
        ? `${npc.name} vous salue : « Content de vous revoir ! »`
        : `${npc.name} vous reconnaît et vous adresse un signe de la tête.`;
    }
    if (localRep < 70) {
      const detail = trophies > 0
        ? ` Il évoque votre ${this.state.legacy.trophies[trophies - 1].name}.`
        : ` Il suit vos matchs chaque week-end.`;
      return `${npc.name} vous aborde franchement.${detail}`;
    }
    if (localRep < 88) {
      return `${npc.name} sort son téléphone pour un selfie. Une petite foule commence à se former.`;
    }
    return `${npc.name} n'ose presque pas vous parler.${awards > 0 ? ` Il cite votre ${this.state.legacy.awards[0].category}.` : ''} Vous êtes une légende ici.`;
  }

  // ── Événements de rue (Tome XX ch. 6) ──────────────────────────────────

  _rollStreetEvents() {
    // Les événements de la veille disparaissent, de nouveaux apparaissent.
    this.streetEvents = [];
    const cityId = this.state.world.currentCityId;
    const city = getCity(cityId);
    if (!city) return;

    const weather = this.weather.at(cityId);
    const count = this.rng.int(1, 3);

    for (let i = 0; i < count; i++) {
      // Les événements extérieurs sont improbables sous la pluie battante.
      const pool = STREET_EVENTS.filter((e) => {
        if (['concert', 'festival', 'marche', 'enfants-foot', 'artistes'].includes(e.id)) {
          return !['orage', 'neige'].includes(weather.type);
        }
        return true;
      });
      const event = this.rng.weighted(pool);
      if (this.streetEvents.some((e) => e.id === event.id)) continue;
      this.streetEvents.push({ ...event, cityId });
    }

    // Une ville en configuration événement grouille davantage (Tome XIX ch. 3).
    const transformed = this.calendar.cityIsTransformed(cityId);
    if (transformed) {
      this.streetEvents.push({
        id: 'fanzone-active',
        name: `Fan zone — ${transformed.name}`,
        text: `Écran géant, concerts et stands de souvenirs. ${transformed.effects.touristInflux.toLocaleString('fr-FR')} visiteurs supplémentaires en ville.`,
        wellbeing: 5,
        cityId,
      });
    }
  }

  _rollRareEvent() {
    if (!this.rng.chance(0.012)) return;
    const rep = this.state.reputation.global;
    const eligible = RARE_EVENTS.filter((e) => rep >= e.minReputation);
    if (eligible.length === 0) return;

    const event = this.rng.pick(eligible);
    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'rare',
      title: event.name,
      body: event.text,
      cityId: this.state.world.currentCityId,
    });
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + 6);
  }

  _rollDiscovery() {
    const cityId = this.state.world.currentCityId;
    const available = SECRETS.filter(
      (s) => s.cityId === cityId && !this.state.world.discoveries.includes(s.id),
    );
    if (available.length === 0) return;
    if (!this.rng.chance(0.05)) return;

    const secret = this.rng.pick(available);
    this.state.world.discoveries.push(secret.id);

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'discovery',
      title: `Découverte : ${secret.name}`,
      body: secret.text,
      cityId,
    });
    bus.emit(EVENTS.NOTIFY, {
      level: 'success',
      title: `Lieu secret découvert`,
      body: `${secret.name} (${secret.type}) — ${this.state.world.discoveries.length}/${SECRETS.length} découvertes.`,
    });
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + 3);
  }

  /** Découvertes du joueur, pour l'interface. */
  discoveries() {
    return SECRETS.map((s) => ({
      ...s,
      cityName: getCity(s.cityId)?.name,
      found: this.state.world.discoveries.includes(s.id),
    }));
  }

  // ── Voyage (Tome XXX ch. 3) ─────────────────────────────────────────────

  /** Moyens de transport utilisables pour un trajet donné. */
  availableTransports(toCityId) {
    const fromCityId = this.state.world.currentCityId;
    const km = distanceKm(fromCityId, toCityId);
    const rep = this.state.reputation.global;
    const hasVehicle = this.state.economy.garage.length > 0;
    const hasYacht = this.state.economy.garage.some((v) => v.category === 'yacht');

    return TRANSPORTS
      .filter((t) => km <= t.maxKm)
      .filter((t) => {
        if (!t.requires) return true;
        if (t.requires === 'vehicule') return hasVehicle;
        if (t.requires === 'yacht') return hasYacht;
        if (t.requires.startsWith('notoriete:')) return rep >= Number(t.requires.split(':')[1]);
        return true;
      })
      .map((t) => {
        const weatherFactor = this.weather.travelFactor(fromCityId);
        const streetPenalty = this.streetEvents.reduce((f, e) => f * (e.travelPenalty || 1), 1);
        // Les vols sont moins sensibles aux embouteillages qu'aux tempêtes.
        const airborne = ['avion', 'jet', 'helicoptere'].includes(t.id);
        const factor = airborne ? Math.max(1, weatherFactor * 0.8) : weatherFactor * streetPenalty;

        const hours = Math.max(1, Math.round((km / t.kmh) * factor));
        let cost = Math.round(km * t.costPerKm);
        // Le concierge négocie les réservations, le pilote réduit le coût du jet.
        cost = Math.round(cost * (1 - Math.max(0, this.economy.staffEffect('bookingDiscount'))));
        if (t.id === 'jet') cost = Math.round(cost * (1 + Math.min(0, this.economy.staffEffect('jetCost'))));

        return { ...t, km, hours, cost, delayed: factor > 1.3 };
      })
      .sort((a, b) => a.hours - b.hours);
  }

  /**
   * Effectue un voyage. Retourne la séquence des étapes pour que l'interface
   * la joue réellement, conformément au Tome XXX v2 ch. 3.
   */
  travel(toCityId, transportId) {
    const destination = getCity(toCityId);
    if (!destination) return { ok: false, reason: 'Destination inconnue.' };
    if (toCityId === this.state.world.currentCityId) return { ok: false, reason: 'Vous y êtes déjà.' };

    const option = this.availableTransports(toCityId).find((t) => t.id === transportId);
    if (!option) return { ok: false, reason: 'Ce moyen de transport n\'est pas disponible pour ce trajet.' };

    if (option.cost > 0 && !this.economy.transact({
      amount: -option.cost,
      label: `Trajet ${getCity(this.state.world.currentCityId)?.name} → ${destination.name} (${option.name})`,
      category: 'voyage',
    })) {
      return { ok: false, reason: 'Fonds insuffisants pour ce trajet.' };
    }

    const fromName = getCity(this.state.world.currentCityId)?.name;
    const stages = (TRAVEL_STAGES[transportId] || TRAVEL_STAGES.default).map((label, index, all) => ({
      label,
      progress: Math.round(((index + 1) / all.length) * 100),
    }));

    // Fatigue du déplacement, atténuée par le confort et le chauffeur.
    const comfortFactor = (100 - option.comfort) / 100;
    const driverEffect = 1 + Math.min(0, this.economy.staffEffect('fatigueTravel'));
    const fatigue = Math.round(option.hours * 0.55 * comfortFactor * driverEffect);
    this.state.player.condition.fatigue = Math.min(100, this.state.player.condition.fatigue + fatigue);

    // Déplacement effectif dans le monde et avancée de l'horloge.
    this.state.world.currentCityId = toCityId;
    this.state.world.currentVenueId = null;

    bus.emit(EVENTS.TRAVEL, {
      from: fromName,
      to: destination.name,
      transport: option.name,
      hours: option.hours,
      cost: option.cost,
      stages,
      delayed: option.delayed,
    });

    if (option.delayed) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'warn',
        title: 'Trajet retardé',
        body: `Conditions dégradées : ${this.weather.describe(toCityId)}.`,
      });
    }

    return {
      ok: true,
      stages,
      hours: option.hours,
      cost: option.cost,
      destination,
      arrivalText: `Arrivée à ${destination.name}. ${destination.description}`,
    };
  }

  // ── Lieux et interactions (Tome II ch. 1.3, Tome XX ch. 2) ─────────────

  /** Tous les lieux visitables de la ville courante. */
  venuesHere(cityId = this.state.world.currentCityId) {
    const city = getCity(cityId);
    if (!city) return [];
    return city.venues.map((v) => ({
      ...v,
      typeLabel: VENUE_TYPES[v.type]?.label || v.type,
      icon: VENUE_TYPES[v.type]?.icon || '📍',
      enterable: VENUE_TYPES[v.type]?.enterable !== false,
    }));
  }

  /** Entrer dans un lieu — chaque lieu a une fonction réelle. */
  enterVenue(venueId) {
    const city = getCity(this.state.world.currentCityId);
    const venue = city?.venues.find((v) => v.id === venueId);
    if (!venue) return { ok: false, reason: 'Lieu introuvable.' };

    this.state.world.currentVenueId = venueId;

    // Gestes contextuels du quotidien — Tome XX ch. 2.
    const gestures = ['Vous poussez la porte', 'Vous entrez', 'Vous franchissez le seuil'];
    const interactions = this._venueInteractions(venue);

    // Rencontre possible avec un supporter à l'entrée.
    const encounter = this.reputation.rollFanEncounter(city.id);

    return {
      ok: true,
      venue,
      typeLabel: VENUE_TYPES[venue.type]?.label,
      entryText: `${this.rng.pick(gestures)} de ${venue.name}.`,
      interactions,
      encounter,
      npcs: this.rng.sample(this.npcsHere(city.id), 2),
    };
  }

  /** Actions disponibles selon le type de lieu. */
  _venueInteractions(venue) {
    const map = {
      stade: ['Visiter les tribunes', 'Descendre dans les vestiaires', 'Parcourir le tunnel', 'Voir la salle des trophées', 'Entrer en salle de presse', 'Passer par la boutique'],
      centre: ['S\'entraîner', 'Salle de musculation', 'Voir le staff médical', 'Analyser des vidéos'],
      academie: ['Observer les jeunes', 'Rencontrer les éducateurs', 'Signer des autographes'],
      boutique: ['Essayer des vêtements', 'Personnaliser un article', 'Commander avec livraison'],
      centreCommercial: ['Faire du shopping', 'Manger un morceau', 'Aller au cinéma'],
      restaurant: ['Réserver une table', 'Dîner', 'Inviter un proche'],
      cafe: ['Prendre un café', 'Lire le journal', 'Jouer au billard'],
      hotel: ['Réserver une nuit', 'Monter en chambre', 'Accéder au spa'],
      musee: ['Visiter les collections', 'Voir les trophées exposés', 'Acheter au comptoir'],
      cinema: ['Voir un film', 'Séance privée'],
      aeroport: ['Consulter les départs', 'Réserver un vol', 'Salon VIP'],
      gare: ['Consulter les horaires', 'Acheter un billet'],
      port: ['Voir les yachts', 'Sortir en mer'],
      concession: ['Essayer un véhicule', 'Configurer un modèle', 'Commander une livraison'],
      garage: ['Voir sa collection', 'Entretenir un véhicule', 'Sortir une voiture'],
      residence: ['Rentrer chez soi', 'Regarder la télévision', 'Écouter de la musique', 'Lire son courrier', 'Voir ses trophées'],
      plage: ['Nager', 'Football de plage', 'Se reposer au soleil'],
      parc: ['Courir', 'Se promener', 'Regarder un match amateur'],
      montagne: ['Skier', 'Randonner', 'Prendre le téléphérique'],
      hub: ['Rencontrer d\'autres joueurs', 'Comparer les trophées', 'Organiser un match'],
      fanzone: ['Regarder le match sur écran géant', 'Acheter des souvenirs', 'Mini-jeux'],
      salle: ['Séance de musculation', 'Récupération'],
      clinique: ['Bilan médical', 'Soins de récupération'],
      studio: ['Donner une interview', 'Participer à une émission'],
    };
    return map[venue.type] || ['Observer les lieux'];
  }

  /** Activités praticables ici aujourd'hui, météo comprise. */
  activitiesHere(cityId = this.state.world.currentCityId) {
    const city = getCity(cityId);
    if (!city) return [];
    const types = new Set(city.venues.map((v) => v.type));

    return ACTIVITIES
      .filter((a) => types.has(a.venueType))
      .map((a) => {
        const check = this.weather.activityAvailable(a, cityId);
        return { ...a, available: check.available, reason: check.reason || null };
      });
  }

  /** Pratiquer une activité. */
  doActivity(activityId) {
    const activity = ACTIVITIES.find((a) => a.id === activityId);
    if (!activity) return { ok: false, reason: 'Activité inconnue.' };

    const check = this.weather.activityAvailable(activity, this.state.world.currentCityId);
    if (!check.available) return { ok: false, reason: check.reason };

    if (this.state.player.injury) {
      return { ok: false, reason: `Blessé (${this.state.player.injury.type}) — repos obligatoire.` };
    }

    const city = getCity(this.state.world.currentCityId);
    const country = getCountry(city?.country);
    const cost = Math.round(activity.cost * (country?.costIndex || 1));

    if (cost > 0 && !this.economy.transact({ amount: -cost, label: activity.name, category: 'loisirs' })) {
      return { ok: false, reason: 'Fonds insuffisants.' };
    }

    // Risque des activités extrêmes — le parachutisme n'est pas sans danger.
    if (activity.risk && this.rng.chance(activity.risk)) {
      const days = this.rng.int(7, 30);
      this.state.player.injury = {
        type: 'blessure de loisir', severity: 'modérée',
        days, daysLeft: days, since: { ...this.state.clock },
      };
      bus.emit(EVENTS.INJURY, { injury: this.state.player.injury, context: activity.name });
      return { ok: false, injured: true, reason: `Incident pendant ${activity.name} : ${days} jours d'arrêt.` };
    }

    // Effets sur la condition et le bien-être.
    this.state.player.condition.fatigue = Math.max(0, Math.min(100,
      this.state.player.condition.fatigue + activity.fatigue,
    ));
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + activity.wellbeing);
    this.state.player.condition.moral = Math.min(100, this.state.player.condition.moral + activity.wellbeing * 0.4);

    const gains = {};
    for (const [attribute, amount] of Object.entries(activity.skill || {})) {
      const before = this.state.player.attributes[attribute];
      this.state.player.attributes[attribute] = Math.min(99, Math.round((before + amount) * 10) / 10);
      gains[attribute] = amount;
    }

    return { ok: true, activity, cost, gains, duration: activity.duration };
  }

  // ── Vacances (Tome XXX ch. 4) ──────────────────────────────────────────

  /**
   * Organise un séjour. Le coût dépend de la destination, de la durée, de
   * l'hôtel choisi et du nombre d'accompagnants.
   */
  planHoliday({ cityId, days, companions = 'seul', hotelStars = 4 }) {
    const city = getCity(cityId);
    if (!city) return { ok: false, reason: 'Destination inconnue.' };

    const country = getCountry(city.country);
    const hotel = city.venues.find((v) => v.type === 'hotel');
    const nightly = (hotel?.nightly || 200) * (hotelStars / (hotel?.stars || 4));

    const groupSizes = { seul: 1, couple: 2, famille: 4, enfants: 3, amis: 5, coequipiers: 8 };
    const size = groupSizes[companions] || 1;

    // Une ville en plein tournoi coûte plus cher (Tome XIX ch. 7).
    const transformed = this.calendar.cityIsTransformed(cityId);
    const eventMultiplier = transformed ? transformed.effects.priceMultiplier : 1;

    const lodging = Math.round(nightly * days * Math.ceil(size / 2) * eventMultiplier);
    const living = Math.round(days * size * 120 * (country?.costIndex || 1) * eventMultiplier);
    const total = lodging + living;

    if (this.economy.balance('courant') < total) {
      return { ok: false, reason: `Budget nécessaire : ${this.economy.format(total)}.` };
    }

    if (transformed && this.rng.chance(0.4)) {
      return { ok: false, reason: `${city.name} affiche complet : ${transformed.name} monopolise tous les hôtels.` };
    }

    this.economy.transact({
      amount: -total,
      label: `Vacances à ${city.name} (${days} jours, ${companions})`,
      category: 'vacances',
    });

    // Activités exclusives de la destination.
    const exclusive = this.activitiesHere(cityId).filter((a) => a.available).slice(0, 5);

    // Effets : récupération importante, bien-être, relations renforcées.
    const recovery = Math.min(60, days * 5);
    this.state.player.condition.fatigue = Math.max(0, this.state.player.condition.fatigue - recovery);
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + days * 2.5);
    this.state.player.condition.moral = Math.min(100, this.state.player.condition.moral + days * 1.5);

    if (companions !== 'seul') {
      for (const relation of this.state.personal.relationships) {
        relation.closeness = Math.min(100, relation.closeness + days * 1.2);
      }
    }

    const holiday = {
      id: `hol-${Date.now()}`,
      cityId,
      cityName: city.name,
      countryName: country?.name,
      days,
      companions,
      hotelStars,
      cost: total,
      season: this.state.clock.season,
      activities: exclusive.map((a) => a.name),
      eventOngoing: transformed?.name || null,
    };
    this.state.personal.holidays.push(holiday);

    // Le joueur se rend physiquement sur place.
    this.state.world.currentCityId = cityId;

    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'cinematic',
      title: `Vacances à ${city.name}`,
      body: `${days} jours ${companions === 'seul' ? 'en solo' : `en ${companions}`}, hôtel ${hotelStars}★. ${exclusive.map((a) => a.name).join(', ')}.`,
      cinematic: 'vacances',
    });

    // Une publication réseaux sociaux est proposée automatiquement.
    this.state.phone.notifications.unshift({
      app: 'social',
      title: 'Story de vacances',
      body: `Partagez votre séjour à ${city.name} avec vos ${this.state.phone.followers.toLocaleString('fr-FR')} abonnés.`,
      at: `${this.state.clock.day}/${this.state.clock.month + 1}`,
      read: false,
    });
    this.state.phone.unread++;

    return { ok: true, holiday };
  }

  // ── Évolution du monde (Tome XXXII ch. 4) ──────────────────────────────

  /**
   * À chaque fin de saison, les villes changent : des commerces ouvrent,
   * d'autres ferment, des quartiers se modernisent.
   */
  evolveWorld() {
    const changes = [];
    const cities = this.rng.sample(CITIES, 4);

    for (const city of cities) {
      const roll = this.rng.next();

      if (roll < 0.35) {
        // Ouverture d'un nouveau commerce.
        const types = ['boutique', 'restaurant', 'cafe', 'salle', 'cinema'];
        const type = this.rng.pick(types);
        const names = {
          boutique: ['Concept Store', 'Flagship', 'Atelier'],
          restaurant: ['Table', 'Brasserie', 'Comptoir'],
          cafe: ['Torréfaction', 'Coffee House', 'Salon'],
          salle: ['Performance Lab', 'Fitness Club'],
          cinema: ['Multiplexe', 'Cinéma d\'art'],
        };
        const newVenue = {
          id: `${type}-${city.id}-${this.state.clock.season}`,
          name: `${this.rng.pick(names[type])} ${city.name}`,
          type,
          openedSeason: this.state.clock.season,
        };
        city.venues.push(newVenue);
        changes.push({ cityId: city.id, kind: 'ouverture', text: `${newVenue.name} ouvre ses portes à ${city.name}.` });
      } else if (roll < 0.5) {
        // Fermeture d'un commerce non essentiel.
        const closable = city.venues.filter((v) => ['boutique', 'cafe', 'restaurant', 'cinema'].includes(v.type));
        if (closable.length > 2) {
          const victim = this.rng.pick(closable);
          city.venues = city.venues.filter((v) => v.id !== victim.id);
          changes.push({ cityId: city.id, kind: 'fermeture', text: `${victim.name} ferme définitivement ses portes.` });
        }
      } else if (roll < 0.65) {
        changes.push({ cityId: city.id, kind: 'modernisation', text: `Le quartier central de ${city.name} est entièrement rénové.` });
      } else if (roll < 0.75) {
        // Agrandissement d'un stade — Tome XXIX ch. 3.
        const stadium = city.venues.find((v) => v.type === 'stade');
        if (stadium && stadium.capacity) {
          const added = this.rng.int(2000, 9000);
          stadium.capacity += added;
          stadium.prestige = Math.min(99, (stadium.prestige || 50) + 2);
          changes.push({
            cityId: city.id, kind: 'travaux',
            text: `${stadium.name} s'agrandit de ${added.toLocaleString('fr-FR')} places. Les travaux sont visibles depuis la rue.`,
          });
        }
      }
    }

    for (const change of changes) {
      this.state.world.worldMemory.push({
        season: this.state.clock.season,
        type: 'evolution',
        subject: change.cityId,
        text: change.text,
      });
    }
    if (this.state.world.worldMemory.length > 200) {
      this.state.world.worldMemory.splice(0, this.state.world.worldMemory.length - 200);
    }

    if (changes.length > 0) {
      bus.emit(EVENTS.NOTIFY, {
        level: 'info',
        title: 'Le monde évolue',
        body: `${changes.length} changement(s) dans les villes cette saison. ${changes[0].text}`,
      });
    }

    return changes;
  }

  /** Résumé de la ville courante pour l'interface. */
  currentCitySummary() {
    const city = getCity(this.state.world.currentCityId);
    if (!city) return null;
    const country = getCountry(city.country);
    const weather = this.weather.at(city.id);
    const transformed = this.calendar.cityIsTransformed(city.id);

    return {
      city,
      country,
      weather,
      weatherText: this.weather.describe(city.id),
      hazard: this.weather.hazardAt(city.id),
      transformed,
      venueCount: city.venues.length,
      streetEvents: this.streetEvents,
      npcCount: this.npcs.filter((n) => n.cityId === city.id).length,
      recognitionChance: Math.round(this.reputation.recognitionChance(city.id) * 100),
      hub: city.hub,
      discoveries: SECRETS.filter((s) => s.cityId === city.id).map((s) => ({
        ...s, found: this.state.world.discoveries.includes(s.id),
      })),
    };
  }

  /** Hôtels disponibles dans une ville — Tome XIX ch. 7 : ils peuvent être pleins. */
  hotelsIn(cityId) {
    const transformed = this.calendar.cityIsTransformed(cityId);
    return venuesOfType(cityId, 'hotel').map((hotel) => ({
      ...hotel,
      priceTonight: Math.round((hotel.nightly || 200) * (transformed ? transformed.effects.priceMultiplier : 1)),
      full: !!transformed && this.rng.chance(0.5),
    }));
  }

  _generateName() {
    const first = ['Awa', 'Marco', 'Elena', 'Kofi', 'Sofia', 'Hugo', 'Léa', 'Ibrahim', 'Nina', 'Paulo', 'Yara', 'Tom', 'Fatou', 'Jonas', 'Mei', 'Sam'];
    const last = ['Coulibaly', 'Rossi', 'Garcia', 'Mensah', 'Silva', 'Dupont', 'Keita', 'Müller', 'Tanaka', 'Ali', 'Novak', 'Larsson', 'Okafor', 'Costa'];
    return `${this.rng.pick(first)} ${this.rng.pick(last)}`;
  }

  serialize() {
    return { npcs: this.npcs, streetEvents: this.streetEvents };
  }

  restore(data) {
    if (!data) return;
    if (data.npcs?.length) this.npcs = data.npcs;
    this.streetEvents = data.streetEvents || [];
  }
}
