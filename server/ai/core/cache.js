/**
 * Cache mémoire du AI Core Engine — TTL + éviction LRU-ish bornée.
 *
 * Sert à ne pas recalculer des résultats coûteux (génération de thème, rapports
 * analytiques…) à chaque appel. 100 % local, sans dépendance.
 */
class Cache {
  constructor({ max = 500, defaultTtlMs = 60000 } = {}) {
    this.max = max;
    this.defaultTtl = defaultTtlMs;
    this.map = new Map(); // clé → { value, expires }
    this.hits = 0; this.misses = 0;
  }

  get(key) {
    const e = this.map.get(key);
    if (!e) { this.misses += 1; return undefined; }
    if (e.expires && e.expires < Date.now()) { this.map.delete(key); this.misses += 1; return undefined; }
    // rafraîchit l'ordre d'accès (LRU)
    this.map.delete(key); this.map.set(key, e);
    this.hits += 1;
    return e.value;
  }

  set(key, value, ttlMs = this.defaultTtl) {
    if (this.map.size >= this.max) { const first = this.map.keys().next().value; this.map.delete(first); }
    this.map.set(key, { value, expires: ttlMs ? Date.now() + ttlMs : 0 });
    return value;
  }

  /** Récupère depuis le cache ou calcule via fn() puis mémorise. */
  async wrap(key, ttlMs, fn) {
    const hit = this.get(key);
    if (hit !== undefined) return hit;
    const value = await fn();
    return this.set(key, value, ttlMs);
  }

  clear() { this.map.clear(); }

  stats() {
    const total = this.hits + this.misses;
    return { size: this.map.size, max: this.max, hits: this.hits, misses: this.misses, hitRate: total ? Math.round((this.hits / total) * 100) : null };
  }
}

module.exports = { Cache };
