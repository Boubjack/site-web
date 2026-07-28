/**
 * Infinity Football — IA / Mémoire
 *
 * Tome VIII, ch. 2 : « Chaque IA possède une mémoire. Elle se souvient des
 * matchs, des interviews, des transferts, des rivalités, des trophées, des
 * relations. »
 * Tome XXV, ch. 3 : « Le monde garde une mémoire de tout » — et ces souvenirs
 * influencent les réactions futures.
 *
 * Modèle : chaque souvenir porte une intensité, une valence (positive ou
 * négative), des étiquettes et une date. L'intensité décroît avec le temps
 * selon une demi-vie dépendant de l'importance, mais un souvenir marquant
 * (record, trahison, titre) ne descend jamais sous un plancher : le monde s'en
 * souvient des décennies plus tard (Tome XXI, ch. 7).
 */

import { clamp, clamp01 } from '../core/math.js';

export interface Memory {
  readonly id: string;
  /** Texte narratif réutilisable par les dialogues et la presse. */
  readonly summary: string;
  /** Étiquettes de rappel : ids de personnes, clubs, compétitions, thèmes. */
  readonly tags: readonly string[];
  /** Intensité initiale 0..1. */
  readonly initialStrength: number;
  /** Valence -1 (traumatisme) .. +1 (souvenir heureux). */
  readonly valence: number;
  /** Minute absolue de l'événement. */
  readonly at: number;
  /** Plancher d'intensité : 0 pour l'anecdotique, jusqu'à 0.9 pour l'historique. */
  readonly permanence: number;
}

export interface RecalledMemory extends Memory {
  /** Intensité au moment du rappel, après décroissance. */
  readonly strength: number;
  /** Ancienneté en jours de jeu. */
  readonly ageDays: number;
}

export interface MemoryBankOptions {
  /** Nombre maximal de souvenirs conservés. */
  readonly capacity?: number;
  /** Demi-vie de base en jours de jeu. */
  readonly halfLifeDays?: number;
}

export class MemoryBank {
  private readonly memories: Memory[] = [];
  private readonly capacity: number;
  private readonly halfLifeDays: number;
  private readonly tagIndex = new Map<string, Set<string>>();

  constructor(options: MemoryBankOptions = {}) {
    this.capacity = options.capacity ?? 240;
    this.halfLifeDays = options.halfLifeDays ?? 180;
  }

  get size(): number {
    return this.memories.length;
  }

  /** Enregistre un souvenir. Les plus faibles sont oubliés en cas de saturation. */
  remember(memory: Memory): void {
    this.memories.push(memory);
    for (const tag of memory.tags) {
      let set = this.tagIndex.get(tag);
      if (!set) {
        set = new Set<string>();
        this.tagIndex.set(tag, set);
      }
      set.add(memory.id);
    }
    if (this.memories.length > this.capacity) this.forgetWeakest(memory.at);
  }

  /**
   * Intensité courante d'un souvenir : décroissance exponentielle bornée par
   * la permanence.
   */
  strengthOf(memory: Memory, now: number): number {
    const ageDays = Math.max(0, (now - memory.at) / (60 * 24));
    // Les souvenirs intenses résistent mieux au temps.
    const halfLife = this.halfLifeDays * (0.5 + memory.initialStrength * 1.5);
    const decayed = memory.initialStrength * Math.pow(0.5, ageDays / halfLife);
    return clamp01(Math.max(decayed, memory.permanence * memory.initialStrength));
  }

  /** Rappelle les souvenirs correspondant à au moins une étiquette. */
  recall(
    tags: readonly string[],
    now: number,
    options: { limit?: number; minStrength?: number } = {},
  ): RecalledMemory[] {
    const ids = new Set<string>();
    for (const tag of tags) {
      const set = this.tagIndex.get(tag);
      if (!set) continue;
      for (const id of set) ids.add(id);
    }
    const minStrength = options.minStrength ?? 0.05;
    const results: RecalledMemory[] = [];
    for (const memory of this.memories) {
      if (!ids.has(memory.id)) continue;
      const strength = this.strengthOf(memory, now);
      if (strength < minStrength) continue;
      results.push({ ...memory, strength, ageDays: (now - memory.at) / (60 * 24) });
    }
    results.sort((a, b) => b.strength - a.strength);
    return results.slice(0, options.limit ?? 8);
  }

  /** Souvenirs les plus marquants, toutes étiquettes confondues. */
  strongest(now: number, limit = 10): RecalledMemory[] {
    return this.memories
      .map((memory) => ({
        ...memory,
        strength: this.strengthOf(memory, now),
        ageDays: (now - memory.at) / (60 * 24),
      }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, limit);
  }

  /**
   * Sentiment global envers une étiquette : moyenne des valences pondérées par
   * l'intensité. C'est ce qui fait qu'un club « n'a pas oublié » une trahison.
   */
  sentimentTowards(tag: string, now: number): number {
    const memories = this.recall([tag], now, { limit: 64, minStrength: 0.02 });
    if (memories.length === 0) return 0;
    let weighted = 0;
    let total = 0;
    for (const memory of memories) {
      weighted += memory.valence * memory.strength;
      total += memory.strength;
    }
    return total === 0 ? 0 : clamp(weighted / total, -1, 1);
  }

  /** Le souvenir le plus fort lié à une étiquette (accroche de commentaire). */
  highlightFor(tag: string, now: number): RecalledMemory | null {
    return this.recall([tag], now, { limit: 1 })[0] ?? null;
  }

  has(memoryId: string): boolean {
    return this.memories.some((m) => m.id === memoryId);
  }

  private forgetWeakest(now: number): void {
    let weakestIndex = 0;
    let weakestStrength = Infinity;
    for (let i = 0; i < this.memories.length; i++) {
      const memory = this.memories[i] as Memory;
      const strength = this.strengthOf(memory, now) + memory.permanence;
      if (strength < weakestStrength) {
        weakestStrength = strength;
        weakestIndex = i;
      }
    }
    const [removed] = this.memories.splice(weakestIndex, 1);
    if (!removed) return;
    for (const tag of removed.tags) {
      const set = this.tagIndex.get(tag);
      set?.delete(removed.id);
      if (set && set.size === 0) this.tagIndex.delete(tag);
    }
  }

  serialize(): Memory[] {
    return this.memories.slice();
  }

  restore(memories: readonly Memory[]): void {
    this.memories.length = 0;
    this.tagIndex.clear();
    for (const memory of memories) this.remember(memory);
  }
}

/** Fabrique de souvenirs : uniformise les intensités par type d'événement. */
export const MemoryFactory = {
  match(id: string, summary: string, tags: readonly string[], at: number, importance: number): Memory {
    return {
      id,
      summary,
      tags,
      at,
      initialStrength: clamp01(0.3 + importance * 0.6),
      valence: 0,
      permanence: importance > 0.8 ? 0.35 : 0.05,
    };
  },
  trophy(id: string, summary: string, tags: readonly string[], at: number): Memory {
    return { id, summary, tags, at, initialStrength: 1, valence: 0.95, permanence: 0.9 };
  },
  betrayal(id: string, summary: string, tags: readonly string[], at: number): Memory {
    return { id, summary, tags, at, initialStrength: 0.95, valence: -0.9, permanence: 0.85 };
  },
  fairplay(id: string, summary: string, tags: readonly string[], at: number): Memory {
    return { id, summary, tags, at, initialStrength: 0.7, valence: 0.75, permanence: 0.55 };
  },
  record(id: string, summary: string, tags: readonly string[], at: number): Memory {
    return { id, summary, tags, at, initialStrength: 1, valence: 0.85, permanence: 0.95 };
  },
  injury(id: string, summary: string, tags: readonly string[], at: number, severity: number): Memory {
    return {
      id,
      summary,
      tags,
      at,
      initialStrength: clamp01(0.4 + severity * 0.5),
      valence: -0.7,
      permanence: severity > 0.7 ? 0.5 : 0.15,
    };
  },
  interaction(id: string, summary: string, tags: readonly string[], at: number, valence: number): Memory {
    return {
      id,
      summary,
      tags,
      at,
      initialStrength: clamp01(0.2 + Math.abs(valence) * 0.4),
      valence: clamp(valence, -1, 1),
      permanence: 0.05,
    };
  },
  transfer(id: string, summary: string, tags: readonly string[], at: number, valence: number): Memory {
    return {
      id,
      summary,
      tags,
      at,
      initialStrength: 0.85,
      valence: clamp(valence, -1, 1),
      permanence: 0.6,
    };
  },
} as const;
