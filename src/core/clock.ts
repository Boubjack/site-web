/**
 * Infinity Football — Core / Horloge du monde
 *
 * Le monde tourne en permanence, avec ou sans le joueur (Tome II, ch. 1.2 ;
 * Tome VIII, ch. 8). L'horloge convertit le temps réel en temps de jeu et
 * distribue les impulsions journalières, hebdomadaires, mensuelles et
 * saisonnières dont dépendent tous les autres systèmes.
 *
 * Unité pivot : la minute de jeu. Toute la simulation est exprimée en minutes
 * absolues depuis l'époque du monde, ce qui rend les sauvegardes exactes et
 * les comparaisons temporelles triviales.
 */

export type Season = 'winter' | 'spring' | 'summer' | 'autumn';
export type Hemisphere = 'north' | 'south';

export interface GameDate {
  readonly year: number;
  /** 1 = janvier … 12 = décembre. */
  readonly month: number;
  /** 1..31 */
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  /** 0 = lundi … 6 = dimanche. */
  readonly weekday: number;
}

export interface ClockState {
  readonly absoluteMinutes: number;
  readonly timeScale: number;
  readonly paused: boolean;
}

const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
export const MINUTES_PER_DAY = MINUTES_PER_HOUR * HOURS_PER_DAY;
const EPOCH_YEAR = 2025;
/** 1er janvier 2025 est un mercredi → index 2 dans une semaine commençant lundi. */
const EPOCH_WEEKDAY = 2;

const WEEKDAY_NAMES_FR = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

const MONTH_NAMES_FR = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const;

export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  switch (month) {
    case 2:
      return isLeapYear(year) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

export function daysInYear(year: number): number {
  return isLeapYear(year) ? 366 : 365;
}

/** Nombre de jours écoulés entre le 1er janvier de l'époque et la date donnée. */
export function daysSinceEpoch(year: number, month: number, day: number): number {
  let days = 0;
  if (year >= EPOCH_YEAR) {
    for (let y = EPOCH_YEAR; y < year; y++) days += daysInYear(y);
  } else {
    for (let y = year; y < EPOCH_YEAR; y++) days -= daysInYear(y);
  }
  for (let m = 1; m < month; m++) days += daysInMonth(year, m);
  return days + (day - 1);
}

/** Convertit un nombre de minutes absolues en date calendaire complète. */
export function dateFromAbsoluteMinutes(absoluteMinutes: number): GameDate {
  const totalDays = Math.floor(absoluteMinutes / MINUTES_PER_DAY);
  const minuteOfDay = absoluteMinutes - totalDays * MINUTES_PER_DAY;

  let year = EPOCH_YEAR;
  let remaining = totalDays;
  while (remaining >= daysInYear(year)) {
    remaining -= daysInYear(year);
    year++;
  }
  while (remaining < 0) {
    year--;
    remaining += daysInYear(year);
  }

  let month = 1;
  while (remaining >= daysInMonth(year, month)) {
    remaining -= daysInMonth(year, month);
    month++;
  }

  const weekday = (((totalDays + EPOCH_WEEKDAY) % 7) + 7) % 7;

  return {
    year,
    month,
    day: remaining + 1,
    hour: Math.floor(minuteOfDay / MINUTES_PER_HOUR),
    minute: minuteOfDay % MINUTES_PER_HOUR,
    weekday,
  };
}

export function absoluteMinutesFromDate(date: {
  year: number;
  month: number;
  day: number;
  hour?: number;
  minute?: number;
}): number {
  return (
    daysSinceEpoch(date.year, date.month, date.day) * MINUTES_PER_DAY +
    (date.hour ?? 0) * MINUTES_PER_HOUR +
    (date.minute ?? 0)
  );
}

/** Saison météorologique, inversée dans l'hémisphère sud. */
export function seasonFor(month: number, hemisphere: Hemisphere = 'north'): Season {
  const northern: Season =
    month === 12 || month <= 2
      ? 'winter'
      : month <= 5
        ? 'spring'
        : month <= 8
          ? 'summer'
          : 'autumn';
  if (hemisphere === 'north') return northern;
  switch (northern) {
    case 'winter':
      return 'summer';
    case 'spring':
      return 'autumn';
    case 'summer':
      return 'winter';
    default:
      return 'spring';
  }
}

export function formatDateFr(date: GameDate): string {
  const weekday = WEEKDAY_NAMES_FR[date.weekday] ?? 'lundi';
  const month = MONTH_NAMES_FR[date.month - 1] ?? 'janvier';
  return `${weekday} ${date.day} ${month} ${date.year}`;
}

export function formatTimeFr(date: GameDate): string {
  return `${String(date.hour).padStart(2, '0')}:${String(date.minute).padStart(2, '0')}`;
}

export function formatDateTimeFr(date: GameDate): string {
  return `${formatDateFr(date)} — ${formatTimeFr(date)}`;
}

/** Saison sportive : commence en juillet. 2025 → saison « 2025/2026 ». */
export function footballSeasonOf(date: GameDate): number {
  return date.month >= 7 ? date.year : date.year - 1;
}

export interface ClockCallbacks {
  readonly onMinute?: (minutes: number, date: GameDate) => void;
  readonly onHour?: (date: GameDate) => void;
  readonly onDay?: (date: GameDate) => void;
  readonly onWeek?: (date: GameDate) => void;
  readonly onMonth?: (date: GameDate) => void;
  readonly onSeason?: (season: Season, date: GameDate) => void;
  readonly onYear?: (date: GameDate) => void;
}

export class GameClock {
  private absolute: number;
  private scale: number;
  private isPaused = false;
  private accumulatorRealSeconds = 0;
  private lastDay: number;
  private lastHour: number;
  private lastWeekIndex: number;
  private lastMonth: number;
  private lastSeason: Season;
  private lastYear: number;

  /**
   * @param startDate date de départ du monde
   * @param minutesPerRealSecond vitesse par défaut (1 min de jeu / s réelle)
   */
  constructor(
    startDate: { year: number; month: number; day: number; hour?: number; minute?: number } = {
      year: 2025,
      month: 7,
      day: 1,
      hour: 8,
      minute: 0,
    },
    minutesPerRealSecond = 1,
  ) {
    this.absolute = absoluteMinutesFromDate(startDate);
    this.scale = minutesPerRealSecond;
    const date = this.date;
    this.lastDay = date.day;
    this.lastHour = date.hour;
    this.lastWeekIndex = this.weekIndex;
    this.lastMonth = date.month;
    this.lastSeason = seasonFor(date.month);
    this.lastYear = date.year;
  }

  get absoluteMinutes(): number {
    return this.absolute;
  }

  get date(): GameDate {
    return dateFromAbsoluteMinutes(this.absolute);
  }

  get season(): Season {
    return seasonFor(this.date.month);
  }

  get footballSeason(): number {
    return footballSeasonOf(this.date);
  }

  /** Index de semaine absolu depuis l'époque (utile pour les tendances hebdo). */
  get weekIndex(): number {
    return Math.floor(this.absolute / (MINUTES_PER_DAY * 7));
  }

  /** Progression du jour dans [0,1[ — pilote le cycle jour/nuit et l'éclairage. */
  get dayProgress(): number {
    const minuteOfDay = ((this.absolute % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
    return minuteOfDay / MINUTES_PER_DAY;
  }

  get timeScale(): number {
    return this.scale;
  }

  set timeScale(value: number) {
    this.scale = Math.max(0, value);
  }

  get paused(): boolean {
    return this.isPaused;
  }

  /** Menu Pause : le monde reprend exactement où il s'était arrêté (Tome XII, ch. 3). */
  pause(): void {
    this.isPaused = true;
  }

  resume(): void {
    this.isPaused = false;
  }

  /**
   * Avance l'horloge à partir d'un pas de temps réel.
   * Retourne le nombre entier de minutes de jeu écoulées.
   */
  advanceRealSeconds(realSeconds: number, callbacks: ClockCallbacks = {}): number {
    if (this.isPaused || realSeconds <= 0) return 0;
    this.accumulatorRealSeconds += realSeconds * this.scale;
    const minutes = Math.floor(this.accumulatorRealSeconds);
    if (minutes <= 0) return 0;
    this.accumulatorRealSeconds -= minutes;
    return this.advanceMinutes(minutes, callbacks);
  }

  /** Avance d'un nombre exact de minutes de jeu en déclenchant les paliers. */
  advanceMinutes(minutes: number, callbacks: ClockCallbacks = {}): number {
    if (minutes <= 0) return 0;
    // On s'arrête exactement sur chaque frontière horaire : aucun palier ne
    // peut être sauté lors des grands sauts (voyages, vacances, avance
    // rapide sur plusieurs saisons), ce qui garantit que la météo, les
    // ouvertures de commerces et les emplois du temps restent cohérents.
    let remaining = Math.floor(minutes);
    while (remaining > 0) {
      const minutesIntoHour = ((this.absolute % MINUTES_PER_HOUR) + MINUTES_PER_HOUR) % MINUTES_PER_HOUR;
      const untilNextHour = MINUTES_PER_HOUR - minutesIntoHour;
      const step = Math.min(remaining, untilNextHour);
      this.absolute += step;
      remaining -= step;
      this.fireBoundaries(callbacks);
    }
    callbacks.onMinute?.(minutes, this.date);
    return Math.floor(minutes);
  }

  /** Saute directement à une date future (avance rapide, sommeil, vacances). */
  skipTo(target: {
    year: number;
    month: number;
    day: number;
    hour?: number;
    minute?: number;
  }, callbacks: ClockCallbacks = {}): number {
    const targetMinutes = absoluteMinutesFromDate(target);
    const delta = targetMinutes - this.absolute;
    if (delta <= 0) return 0;
    return this.advanceMinutes(delta, callbacks);
  }

  private fireBoundaries(callbacks: ClockCallbacks): void {
    const date = this.date;
    if (date.hour !== this.lastHour) {
      this.lastHour = date.hour;
      callbacks.onHour?.(date);
    }
    if (date.day !== this.lastDay) {
      this.lastDay = date.day;
      callbacks.onDay?.(date);
    }
    const week = this.weekIndex;
    if (week !== this.lastWeekIndex) {
      this.lastWeekIndex = week;
      callbacks.onWeek?.(date);
    }
    if (date.month !== this.lastMonth) {
      this.lastMonth = date.month;
      callbacks.onMonth?.(date);
      const season = seasonFor(date.month);
      if (season !== this.lastSeason) {
        this.lastSeason = season;
        callbacks.onSeason?.(season, date);
      }
    }
    if (date.year !== this.lastYear) {
      this.lastYear = date.year;
      callbacks.onYear?.(date);
    }
  }

  save(): ClockState {
    return { absoluteMinutes: this.absolute, timeScale: this.scale, paused: this.isPaused };
  }

  restore(state: ClockState): void {
    this.absolute = state.absoluteMinutes;
    this.scale = state.timeScale;
    this.isPaused = state.paused;
    const date = this.date;
    this.lastDay = date.day;
    this.lastHour = date.hour;
    this.lastWeekIndex = this.weekIndex;
    this.lastMonth = date.month;
    this.lastSeason = seasonFor(date.month);
    this.lastYear = date.year;
    this.accumulatorRealSeconds = 0;
  }
}
