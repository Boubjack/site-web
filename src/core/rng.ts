/**
 * Infinity Football — Core / RNG
 *
 * Générateur pseudo-aléatoire déterministe et sérialisable.
 *
 * Chaque système possède son propre flux dérivé de la graine de la sauvegarde
 * (`Rng.derive`), ce qui garantit qu'une sauvegarde rechargée reproduit
 * exactement le même monde (Tome XXVI — « chaque sauvegarde devient une
 * histoire unique »), sans qu'un système n'influence l'aléa d'un autre.
 */

import { hashString } from './math.js';

export interface RngState {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
}

/** Implémentation sfc32 : rapide, 128 bits d'état, qualité statistique élevée. */
export class Rng {
  private a: number;
  private b: number;
  private c: number;
  private d: number;

  constructor(seed: number | string) {
    const numeric = typeof seed === 'string' ? hashString(seed) : seed >>> 0;
    this.a = (numeric ^ 0x9e3779b9) >>> 0;
    this.b = (numeric ^ 0x243f6a88) >>> 0;
    this.c = (numeric ^ 0xb7e15162) >>> 0;
    this.d = (numeric ^ 0x85ebca6b) >>> 0;
    // Échauffement : évite les corrélations sur les premières valeurs.
    for (let i = 0; i < 16; i++) this.next();
  }

  /** Crée un flux enfant indépendant, stable pour un même label. */
  derive(label: string): Rng {
    const child = new Rng(((this.a ^ hashString(label)) >>> 0) + (this.d >>> 3));
    return child;
  }

  /** Prochain flottant dans [0, 1[. */
  next(): number {
    const t = (((this.a + this.b) >>> 0) + this.d) >>> 0;
    this.d = (this.d + 1) >>> 0;
    this.a = (this.b ^ (this.b >>> 9)) >>> 0;
    this.b = (this.c + (this.c << 3)) >>> 0;
    this.c = ((this.c << 21) | (this.c >>> 11)) >>> 0;
    this.c = (this.c + t) >>> 0;
    return t / 4294967296;
  }

  /** Flottant dans [min, max[. */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] (bornes incluses). */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Vrai avec une probabilité `probability` (0..1). */
  chance(probability: number): boolean {
    return this.next() < probability;
  }

  /** Élément aléatoire d'un tableau non vide. */
  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: tableau vide');
    return items[Math.floor(this.next() * items.length)] as T;
  }

  /** N éléments distincts (au plus `items.length`). */
  pickMany<T>(items: readonly T[], count: number): T[] {
    const shuffled = this.shuffle(items);
    return shuffled.slice(0, Math.max(0, Math.min(count, shuffled.length)));
  }

  /** Tirage pondéré ; les poids négatifs sont ignorés. */
  weighted<T>(entries: ReadonlyArray<{ item: T; weight: number }>): T {
    let total = 0;
    for (const entry of entries) if (entry.weight > 0) total += entry.weight;
    if (total <= 0) throw new Error('Rng.weighted: aucun poids positif');
    let roll = this.next() * total;
    for (const entry of entries) {
      if (entry.weight <= 0) continue;
      roll -= entry.weight;
      if (roll <= 0) return entry.item;
    }
    return (entries[entries.length - 1] as { item: T }).item;
  }

  /** Copie mélangée (Fisher-Yates). */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = items.slice();
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = copy[i] as T;
      copy[i] = copy[j] as T;
      copy[j] = tmp;
    }
    return copy;
  }

  /** Loi normale (Box-Muller), tronquée à ±4 écarts-types. */
  gaussian(mean = 0, stdDev = 1): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    const clamped = Math.max(-4, Math.min(4, z));
    return mean + clamped * stdDev;
  }

  save(): RngState {
    return { a: this.a, b: this.b, c: this.c, d: this.d };
  }

  restore(state: RngState): void {
    this.a = state.a >>> 0;
    this.b = state.b >>> 0;
    this.c = state.c >>> 0;
    this.d = state.d >>> 0;
  }

  static fromState(state: RngState): Rng {
    const rng = new Rng(0);
    rng.restore(state);
    return rng;
  }
}
