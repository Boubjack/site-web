/**
 * rng.js — Générateur pseudo-aléatoire déterministe.
 *
 * Le monde d'Infinity Football doit être reproductible : une même graine
 * produit exactement la même carrière, ce qui rend les sauvegardes fiables
 * (Tome X ch. 8 « protection des sauvegardes ») et permet de rejouer un bug
 * à l'identique lors du contrôle qualité (Tome XV ch. 2).
 *
 * Implémentation : mulberry32 — rapide, période 2^32, distribution correcte
 * pour du gameplay. Ce n'est pas un CSPRNG et ne doit jamais servir à de la
 * cryptographie.
 */

export class RNG {
  /** @param {number|string} seed */
  constructor(seed = Date.now()) {
    this.seed = typeof seed === 'string' ? RNG.hashString(seed) : seed >>> 0;
    this._state = this.seed >>> 0;
    this._calls = 0;
  }

  /** Hash déterministe (FNV-1a 32 bits) pour transformer une chaîne en graine. */
  static hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  /** Flottant uniforme dans [0, 1). */
  next() {
    this._calls++;
    this._state = (this._state + 0x6d2b79f5) >>> 0;
    let t = this._state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Flottant dans [min, max). */
  float(min, max) {
    return min + this.next() * (max - min);
  }

  /** Entier dans [min, max] inclus. */
  int(min, max) {
    return Math.floor(this.float(min, max + 1));
  }

  /** Vrai avec la probabilité `p` (0..1). */
  chance(p) {
    return this.next() < p;
  }

  /** Élément uniforme d'un tableau. */
  pick(array) {
    if (!array || array.length === 0) return undefined;
    return array[Math.floor(this.next() * array.length)];
  }

  /**
   * Tirage pondéré.
   * @param {Array<{weight:number}>|Array} items
   * @param {Function} [weightOf] extracteur de poids (défaut : item.weight)
   */
  weighted(items, weightOf = (it) => it.weight ?? 1) {
    let total = 0;
    for (const it of items) total += Math.max(0, weightOf(it));
    if (total <= 0) return this.pick(items);
    let roll = this.next() * total;
    for (const it of items) {
      roll -= Math.max(0, weightOf(it));
      if (roll <= 0) return it;
    }
    return items[items.length - 1];
  }

  /** Mélange de Fisher-Yates, en place, sur une copie. */
  shuffle(array) {
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  /** `n` éléments distincts tirés au hasard. */
  sample(array, n) {
    return this.shuffle(array).slice(0, Math.min(n, array.length));
  }

  /**
   * Loi normale approchée (somme de 3 uniformes — Irwin-Hall normalisé).
   * Utilisée pour les performances de match : les résultats extrêmes doivent
   * rester rares mais possibles.
   */
  gaussian(mean = 0, stdDev = 1) {
    const u = (this.next() + this.next() + this.next()) / 3; // moyenne .5, var 1/36
    return mean + (u - 0.5) * 6 * stdDev * 0.5774;
  }

  /** Valeur bornée issue d'une gaussienne — jamais hors [min, max]. */
  gaussianClamped(mean, stdDev, min, max) {
    return Math.max(min, Math.min(max, this.gaussian(mean, stdDev)));
  }

  /** État sérialisable, pour que la sauvegarde reprenne la séquence exacte. */
  serialize() {
    return { seed: this.seed, state: this._state, calls: this._calls };
  }

  static deserialize(data) {
    const rng = new RNG(data.seed);
    rng._state = data.state >>> 0;
    rng._calls = data.calls || 0;
    return rng;
  }

  /** Sous-générateur indépendant, dérivé de manière déterministe. */
  fork(label) {
    return new RNG(RNG.hashString(`${this.seed}:${label}:${this._calls}`));
  }
}
