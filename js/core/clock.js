/**
 * clock.js — Horloge et calendrier du monde.
 *
 * Le monde continue de vivre sans le joueur (Tome II ch. 1.2, Tome VIII ch. 8,
 * Tome XXX ch. 6). L'horloge est donc le moteur central : elle avance en
 * heures de jeu, émet des événements de jour / semaine / mois / saison, et
 * tous les autres systèmes s'y abonnent plutôt que de piloter leur propre
 * temporalité.
 *
 * Échelle par défaut : 1 seconde réelle = 1 heure de jeu en lecture accélérée.
 * Le joueur peut mettre en pause : « le monde reprend exactement où il s'était
 * arrêté » (Tome XII ch. 3).
 */

import { bus, EVENTS } from './events.js';

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];

/** Saisons météorologiques de l'hémisphère nord (Tome XXX ch. 6). */
export function saisonDe(mois) {
  if (mois === 11 || mois <= 1) return 'hiver';
  if (mois <= 4) return 'printemps';
  if (mois <= 7) return 'été';
  return 'automne';
}

/**
 * Une saison sportive court de juillet (mois 6) à juin. La saison « 2026 »
 * désigne donc l'exercice 2026-2027.
 */
export function saisonSportiveDe(annee, mois) {
  return mois >= 6 ? annee : annee - 1;
}

export class Clock {
  constructor({ startYear = 2026, startMonth = 6, startDay = 1, startHour = 8 } = {}) {
    this.year = startYear;
    this.month = startMonth; // 0-indexé
    this.day = startDay;
    this.hour = startHour;
    this.minute = 0;

    /** Heures de jeu écoulées depuis le début de la partie. */
    this.totalHours = 0;
    /** Numéro de la saison sportive en cours. */
    this.season = saisonSportiveDe(startYear, startMonth);

    this.running = false;
    this.speed = 1; // heures de jeu par tick
    this._interval = null;
    this._tickMs = 1000;
    /**
     * Objet `state.clock` tenu synchronisé à chaque heure écoulée.
     * Indispensable : les systèmes lisent `state.clock` pendant le traitement
     * des événements de jour. Sans cette liaison, ils verraient une date
     * périmée tant que la boucle d'avancement n'est pas terminée.
     */
    this._boundState = null;
  }

  /** Lie un objet `state.clock` qui sera mis à jour à chaque heure. */
  bind(stateClock) {
    this._boundState = stateClock;
    this._sync();
    return this;
  }

  _sync() {
    if (!this._boundState) return;
    const s = this._boundState;
    s.year = this.year;
    s.month = this.month;
    s.day = this.day;
    s.hour = this.hour;
    s.minute = this.minute;
    s.totalHours = this.totalHours;
    s.season = this.season;
    s.speed = this.speed;
  }

  static joursDansMois(year, month) {
    return new Date(year, month + 1, 0).getDate();
  }

  get monthName() {
    return MOIS[this.month];
  }

  get weekdayName() {
    return JOURS[new Date(this.year, this.month, this.day).getDay()];
  }

  get weekday() {
    return new Date(this.year, this.month, this.day).getDay();
  }

  get meteoSaison() {
    return saisonDe(this.month);
  }

  /** Date lisible : « lundi 1 juillet 2026 ». */
  get dateLabel() {
    return `${this.weekdayName} ${this.day} ${this.monthName} ${this.year}`;
  }

  /** Heure lisible : « 08:00 ». */
  get timeLabel() {
    return `${String(this.hour).padStart(2, '0')}:${String(this.minute).padStart(2, '0')}`;
  }

  /** Moment de la journée — pilote l'éclairage (Tome XIV ch. 2). */
  get momentDuJour() {
    const h = this.hour;
    if (h < 6) return 'nuit';
    if (h < 8) return 'lever du soleil';
    if (h < 12) return 'matin';
    if (h < 14) return 'midi';
    if (h < 18) return 'après-midi';
    if (h < 20) return 'golden hour';
    if (h < 22) return 'coucher du soleil';
    return 'nuit';
  }

  /** Clé de tri stable, utile pour l'agenda et les archives. */
  get stamp() {
    return this.year * 1000000 + (this.month + 1) * 10000 + this.day * 100 + this.hour;
  }

  /** Avance de `hours` heures de jeu en émettant tous les paliers traversés. */
  advance(hours = 1) {
    for (let i = 0; i < hours; i++) this._advanceOneHour();
  }

  _advanceOneHour() {
    this.hour++;
    this.totalHours++;

    if (this.hour < 24) {
      this._sync();
      bus.emit(EVENTS.TICK, { clock: this.snapshot() });
      return;
    }

    // Passage au jour suivant
    this.hour = 0;
    const previousMonth = this.month;
    const previousSeason = this.season;

    this.day++;
    if (this.day > Clock.joursDansMois(this.year, this.month)) {
      this.day = 1;
      this.month++;
      if (this.month > 11) {
        this.month = 0;
        this.year++;
      }
    }

    this.season = saisonSportiveDe(this.year, this.month);

    // La date est publiée dans l'état AVANT la diffusion des événements :
    // les systèmes doivent voir la nouvelle journée, pas la précédente.
    this._sync();

    bus.emit(EVENTS.TICK, { clock: this.snapshot() });
    bus.emit(EVENTS.DAY, { clock: this.snapshot() });

    if (this.weekday === 1) {
      bus.emit(EVENTS.WEEK, { clock: this.snapshot() });
    }
    if (this.month !== previousMonth) {
      bus.emit(EVENTS.MONTH, { clock: this.snapshot() });
    }
    if (this.season !== previousSeason) {
      bus.emit(EVENTS.SEASON_END, { season: previousSeason, clock: this.snapshot() });
      bus.emit(EVENTS.SEASON_START, { season: this.season, clock: this.snapshot() });
    }
  }

  /** Avance jusqu'à une heure précise du jour suivant (ou du jour même). */
  advanceTo(hour) {
    const target = ((hour - this.hour) + 24) % 24 || 24;
    this.advance(target);
  }

  advanceDays(days) {
    this.advance(days * 24);
  }

  start(tickMs = this._tickMs) {
    if (this.running) return;
    this._tickMs = tickMs;
    this.running = true;
    this._interval = setInterval(() => this.advance(this.speed), tickMs);
  }

  pause() {
    this.running = false;
    if (this._interval) {
      clearInterval(this._interval);
      this._interval = null;
    }
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
    return this.running;
  }

  setSpeed(hoursPerTick) {
    this.speed = Math.max(1, Math.min(24, Math.round(hoursPerTick)));
    return this.speed;
  }

  /** Vue en lecture seule diffusée avec chaque événement d'horloge. */
  snapshot() {
    return {
      year: this.year,
      month: this.month,
      day: this.day,
      hour: this.hour,
      season: this.season,
      dateLabel: this.dateLabel,
      timeLabel: this.timeLabel,
      moment: this.momentDuJour,
      meteoSaison: this.meteoSaison,
      totalHours: this.totalHours,
      stamp: this.stamp,
    };
  }

  serialize() {
    return {
      year: this.year, month: this.month, day: this.day,
      hour: this.hour, minute: this.minute,
      totalHours: this.totalHours, season: this.season, speed: this.speed,
    };
  }

  static deserialize(data) {
    const clock = new Clock({
      startYear: data.year, startMonth: data.month,
      startDay: data.day, startHour: data.hour,
    });
    clock.minute = data.minute || 0;
    clock.totalHours = data.totalHours || 0;
    clock.season = data.season ?? saisonSportiveDe(data.year, data.month);
    clock.speed = data.speed || 1;
    return clock;
  }
}
