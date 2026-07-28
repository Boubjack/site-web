/**
 * weather.js — Météo dynamique et son impact sur le monde.
 *
 * Exigences couvertes :
 *   - Tome III ch. 2 : le contrôle du ballon dépend de la météo et de la pelouse
 *   - Tome XIV ch. 2 : éclairage dynamique (pluie, brouillard, neige, golden hour)
 *   - Tome XX ch. 3  : la météo influence vêtements des PNJ, circulation,
 *                      fréquentation des plages, activités disponibles, pelouse
 *   - Tome XXX ch. 6 : catastrophes naturelles modérées perturbant les déplacements
 *
 * Le modèle est climatique : chaque pays a un climat, chaque climat a des
 * profils saisonniers. La météo n'est donc jamais aléatoire pure — il neige à
 * Zermatt en janvier, pas à Bamako.
 */

import { bus, EVENTS } from '../core/events.js';
import { CITIES, getCity, getCountry } from '../data/world.js';

/**
 * Profils climatiques : pour chaque climat et chaque saison, la température
 * moyenne, l'amplitude et la distribution des types de temps.
 */
const CLIMATES = {
  sahélien: {
    hiver: { temp: 26, spread: 6, weights: { ensoleillé: 70, voilé: 20, vent: 8, brume: 2 } },
    printemps: { temp: 35, spread: 5, weights: { ensoleillé: 65, canicule: 20, vent: 10, voilé: 5 } },
    été: { temp: 33, spread: 5, weights: { ensoleillé: 40, orage: 25, pluie: 20, voilé: 15 } },
    automne: { temp: 31, spread: 5, weights: { ensoleillé: 55, pluie: 20, voilé: 20, orage: 5 } },
  },
  tempéré: {
    hiver: { temp: 5, spread: 5, weights: { voilé: 40, pluie: 25, brouillard: 15, ensoleillé: 15, neige: 5 } },
    printemps: { temp: 15, spread: 6, weights: { ensoleillé: 40, voilé: 30, pluie: 25, vent: 5 } },
    été: { temp: 25, spread: 6, weights: { ensoleillé: 60, voilé: 20, orage: 12, canicule: 8 } },
    automne: { temp: 13, spread: 6, weights: { voilé: 35, pluie: 30, ensoleillé: 25, vent: 10 } },
  },
  océanique: {
    hiver: { temp: 7, spread: 4, weights: { pluie: 40, voilé: 30, vent: 20, ensoleillé: 10 } },
    printemps: { temp: 13, spread: 4, weights: { voilé: 35, pluie: 30, ensoleillé: 30, vent: 5 } },
    été: { temp: 21, spread: 5, weights: { ensoleillé: 45, voilé: 30, pluie: 25 } },
    automne: { temp: 12, spread: 5, weights: { pluie: 40, vent: 25, voilé: 25, ensoleillé: 10 } },
  },
  méditerranéen: {
    hiver: { temp: 11, spread: 4, weights: { ensoleillé: 45, voilé: 30, pluie: 25 } },
    printemps: { temp: 19, spread: 5, weights: { ensoleillé: 60, voilé: 25, pluie: 15 } },
    été: { temp: 30, spread: 5, weights: { ensoleillé: 70, canicule: 20, voilé: 10 } },
    automne: { temp: 20, spread: 5, weights: { ensoleillé: 45, pluie: 30, orage: 15, voilé: 10 } },
  },
  continental: {
    hiver: { temp: 0, spread: 6, weights: { neige: 35, voilé: 30, brouillard: 15, ensoleillé: 20 } },
    printemps: { temp: 13, spread: 6, weights: { ensoleillé: 40, voilé: 30, pluie: 30 } },
    été: { temp: 24, spread: 6, weights: { ensoleillé: 55, orage: 25, voilé: 20 } },
    automne: { temp: 11, spread: 6, weights: { voilé: 40, pluie: 30, brouillard: 20, ensoleillé: 10 } },
  },
  alpin: {
    hiver: { temp: -6, spread: 5, weights: { neige: 60, voilé: 20, ensoleillé: 20 } },
    printemps: { temp: 4, spread: 5, weights: { neige: 30, ensoleillé: 35, voilé: 35 } },
    été: { temp: 16, spread: 5, weights: { ensoleillé: 55, orage: 25, voilé: 20 } },
    automne: { temp: 6, spread: 5, weights: { voilé: 35, pluie: 30, neige: 20, ensoleillé: 15 } },
  },
  tropical: {
    hiver: { temp: 27, spread: 3, weights: { ensoleillé: 55, pluie: 25, orage: 20 } },
    printemps: { temp: 28, spread: 3, weights: { ensoleillé: 50, pluie: 30, orage: 20 } },
    été: { temp: 29, spread: 3, weights: { pluie: 40, orage: 30, ensoleillé: 30 } },
    automne: { temp: 28, spread: 3, weights: { ensoleillé: 45, pluie: 35, orage: 20 } },
  },
  subtropical: {
    hiver: { temp: 17, spread: 4, weights: { ensoleillé: 50, pluie: 30, vent: 20 } },
    printemps: { temp: 20, spread: 4, weights: { ensoleillé: 60, voilé: 25, pluie: 15 } },
    été: { temp: 26, spread: 4, weights: { ensoleillé: 65, orage: 20, voilé: 15 } },
    automne: { temp: 21, spread: 4, weights: { ensoleillé: 55, vent: 25, pluie: 20 } },
  },
  désertique: {
    hiver: { temp: 22, spread: 5, weights: { ensoleillé: 80, voilé: 15, vent: 5 } },
    printemps: { temp: 33, spread: 5, weights: { ensoleillé: 70, canicule: 20, vent: 10 } },
    été: { temp: 42, spread: 4, weights: { canicule: 65, ensoleillé: 30, vent: 5 } },
    automne: { temp: 32, spread: 5, weights: { ensoleillé: 75, vent: 15, voilé: 10 } },
  },
  'tempéré humide': {
    hiver: { temp: 7, spread: 4, weights: { ensoleillé: 40, voilé: 30, pluie: 25, neige: 5 } },
    printemps: { temp: 16, spread: 5, weights: { ensoleillé: 45, pluie: 30, voilé: 25 } },
    été: { temp: 28, spread: 4, weights: { ensoleillé: 35, pluie: 35, orage: 30 } },
    automne: { temp: 18, spread: 5, weights: { ensoleillé: 40, pluie: 30, vent: 30 } },
  },
  varié: {
    hiver: { temp: 4, spread: 8, weights: { voilé: 30, neige: 25, pluie: 25, ensoleillé: 20 } },
    printemps: { temp: 16, spread: 8, weights: { ensoleillé: 40, pluie: 30, orage: 20, voilé: 10 } },
    été: { temp: 27, spread: 7, weights: { ensoleillé: 55, orage: 25, canicule: 20 } },
    automne: { temp: 15, spread: 7, weights: { voilé: 35, pluie: 30, ensoleillé: 35 } },
  },
};

/**
 * Effets de chaque type de temps.
 *   pitch       : modificateur de qualité de pelouse (Tome III ch. 2)
 *   travel      : modificateur de temps de trajet (Tome XX ch. 3 : circulation)
 *   beach       : fréquentation des plages
 *   attendance  : affluence au stade
 *   ballControl : difficulté supplémentaire de contrôle du ballon
 */
export const WEATHER_EFFECTS = {
  ensoleillé: { icon: '☀️', pitch: 4, travel: 1.0, beach: 1.4, attendance: 1.08, ballControl: 0, light: 'plein soleil' },
  voilé: { icon: '⛅', pitch: 1, travel: 1.0, beach: 0.9, attendance: 1.0, ballControl: 0, light: 'diffus' },
  pluie: { icon: '🌧️', pitch: -12, travel: 1.25, beach: 0.15, attendance: 0.88, ballControl: -6, light: 'gris' },
  orage: { icon: '⛈️', pitch: -20, travel: 1.5, beach: 0.05, attendance: 0.72, ballControl: -10, light: 'sombre' },
  neige: { icon: '❄️', pitch: -25, travel: 1.8, beach: 0, attendance: 0.65, ballControl: -14, light: 'blanc' },
  brouillard: { icon: '🌫️', pitch: -4, travel: 1.6, beach: 0.1, attendance: 0.8, ballControl: -8, light: 'voilé' },
  brume: { icon: '🌁', pitch: -2, travel: 1.15, beach: 0.5, attendance: 0.95, ballControl: -3, light: 'laiteux' },
  vent: { icon: '💨', pitch: -3, travel: 1.1, beach: 0.4, attendance: 0.94, ballControl: -9, light: 'clair' },
  canicule: { icon: '🔥', pitch: -8, travel: 1.05, beach: 1.6, attendance: 0.82, ballControl: -2, light: 'écrasant' },
};

/** Aléas modérés — Tome XXX ch. 6 : perturbent sans détruire le monde. */
const HAZARDS = [
  { id: 'tempete', name: 'Tempête', from: ['orage', 'vent'], travelPenalty: 2.2, days: 1, message: 'Une tempête perturbe les liaisons aériennes.' },
  { id: 'pluies-diluviennes', name: 'Pluies diluviennes', from: ['pluie', 'orage'], travelPenalty: 1.9, days: 2, message: 'Des pluies diluviennes ralentissent la circulation.' },
  { id: 'canicule-severe', name: 'Canicule sévère', from: ['canicule'], travelPenalty: 1.1, days: 3, message: 'Une canicule sévère impose des pauses fraîcheur pendant les matchs.' },
  { id: 'neige-abondante', name: 'Neige abondante', from: ['neige'], travelPenalty: 2.4, days: 2, message: 'De fortes chutes de neige bloquent une partie des routes.' },
];

export class WeatherSystem {
  /**
   * @param {object} state état global
   * @param {import('../core/rng.js').RNG} rng
   */
  constructor(state, rng) {
    this.state = state;
    this.rng = rng;
    /** Météo courante par ville — le monde a une météo partout, pas seulement là où est le joueur. */
    this.byCity = new Map();
    /** Aléas actifs par ville */
    this.hazards = new Map();
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.advanceDay()));
    // Météo initiale de la ville courante pour que l'interface ait une valeur dès l'ouverture.
    this.advanceDay();
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  /** Profil climatique applicable à une ville pour la saison en cours. */
  _profile(cityId, saison) {
    const city = getCity(cityId);
    const country = city ? getCountry(city.country) : null;
    const climate = CLIMATES[country?.climate] || CLIMATES.tempéré;
    return climate[saison] || climate.tempéré || Object.values(climate)[0];
  }

  /** Tire une météo pour une ville donnée. */
  roll(cityId, saison) {
    const profile = this._profile(cityId, saison);
    const entries = Object.entries(profile.weights).map(([type, weight]) => ({ type, weight }));
    const chosen = this.rng.weighted(entries);
    const type = chosen.type;

    const tempC = Math.round(this.rng.gaussianClamped(profile.temp, profile.spread, profile.temp - profile.spread * 2, profile.temp + profile.spread * 2));
    const effects = WEATHER_EFFECTS[type];
    const windKph = type === 'vent'
      ? this.rng.int(35, 70)
      : type === 'orage' || type === 'tempete'
        ? this.rng.int(25, 55)
        : this.rng.int(2, 22);

    // La pelouse s'use avec la répétition du mauvais temps ; elle se régénère au sec.
    const previous = this.byCity.get(cityId);
    const basePitch = previous ? previous.pitchQuality : 80;
    const pitchQuality = Math.max(25, Math.min(99, Math.round(basePitch + effects.pitch * 0.5 + (effects.pitch > 0 ? 2 : 0))));

    return {
      type,
      icon: effects.icon,
      tempC,
      windKph,
      pitchQuality,
      light: effects.light,
      travelFactor: effects.travel,
      beachFactor: effects.beach,
      attendanceFactor: effects.attendance,
      ballControl: effects.ballControl,
    };
  }

  /** Fait avancer la météo d'un jour dans toutes les villes. */
  advanceDay() {
    const saison = this._currentSaison();

    for (const city of this._allCityIds()) {
      const weather = this.roll(city, saison);
      this.byCity.set(city, weather);
      this._rollHazard(city, weather);
    }

    const current = this.byCity.get(this.state.world.currentCityId);
    if (current) {
      const previousType = this.state.world.weather?.type;
      this.state.world.weather = { ...current };
      if (previousType !== current.type) {
        bus.emit(EVENTS.WEATHER_CHANGED, { cityId: this.state.world.currentCityId, weather: current });
      }
    }

    // Décompte des aléas actifs.
    for (const [cityId, hazard] of this.hazards.entries()) {
      hazard.daysLeft -= 1;
      if (hazard.daysLeft <= 0) this.hazards.delete(cityId);
    }
  }

  _rollHazard(cityId, weather) {
    if (this.hazards.has(cityId)) return;
    const candidates = HAZARDS.filter((h) => h.from.includes(weather.type));
    if (candidates.length === 0) return;
    // Les aléas restent rares : 6 % par jour quand le temps s'y prête.
    if (!this.rng.chance(0.06)) return;

    const hazard = this.rng.pick(candidates);
    this.hazards.set(cityId, { ...hazard, daysLeft: hazard.days });

    if (cityId === this.state.world.currentCityId) {
      bus.emit(EVENTS.WORLD_EVENT, {
        kind: 'hazard',
        cityId,
        title: hazard.name,
        body: hazard.message,
        severity: 'moderate',
      });
    }
  }

  _currentSaison() {
    const month = this.state.clock.month;
    if (month === 11 || month <= 1) return 'hiver';
    if (month <= 4) return 'printemps';
    if (month <= 7) return 'été';
    return 'automne';
  }

  _allCityIds() {
    if (!this._cityIds) this._cityIds = CITIES.map((c) => c.id);
    return this._cityIds;
  }

  /** Météo d'une ville, calculée à la demande si elle n'existe pas encore. */
  at(cityId) {
    if (!this.byCity.has(cityId)) {
      this.byCity.set(cityId, this.roll(cityId, this._currentSaison()));
    }
    return this.byCity.get(cityId);
  }

  /** Facteur multiplicatif appliqué à la durée d'un trajet. */
  travelFactor(cityId) {
    const hazard = this.hazards.get(cityId);
    const base = this.at(cityId).travelFactor;
    return hazard ? base * hazard.travelPenalty : base;
  }

  /** Aléa actif dans une ville, ou null. */
  hazardAt(cityId) {
    return this.hazards.get(cityId) || null;
  }

  /** Une activité est-elle praticable aujourd'hui ? — Tome XX ch. 3. */
  activityAvailable(activity, cityId) {
    const weather = this.at(cityId);
    const outdoor = ['plage', 'parc', 'montagne'].includes(activity.venueType);
    if (!outdoor) return { available: true };

    if (activity.venueType === 'plage' && weather.beachFactor < 0.2) {
      return { available: false, reason: `Plage fermée : ${weather.type}.` };
    }
    if (activity.venueType === 'montagne' && activity.id.includes('ski') && weather.tempC > 12) {
      return { available: false, reason: 'Pas assez de neige à cette température.' };
    }
    if (['parachutisme', 'elastique', 'montgolfiere'].includes(activity.id) && weather.windKph > 30) {
      return { available: false, reason: `Vent trop fort (${weather.windKph} km/h).` };
    }
    if (weather.type === 'orage' && outdoor) {
      return { available: false, reason: 'Activité extérieure suspendue pendant l\'orage.' };
    }
    return { available: true };
  }

  /** Description textuelle pour l'interface et les commentateurs. */
  describe(cityId = this.state.world.currentCityId) {
    const w = this.at(cityId);
    const hazard = this.hazardAt(cityId);
    let text = `${w.icon} ${w.type}, ${w.tempC} °C, vent ${w.windKph} km/h`;
    if (hazard) text += ` — ${hazard.name} en cours`;
    return text;
  }

  serialize() {
    return {
      byCity: Array.from(this.byCity.entries()),
      hazards: Array.from(this.hazards.entries()),
    };
  }

  restore(data) {
    if (!data) return;
    this.byCity = new Map(data.byCity || []);
    this.hazards = new Map(data.hazards || []);
  }
}
