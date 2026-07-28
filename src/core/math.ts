/**
 * Infinity Football — Core / Math
 *
 * Primitives mathématiques déterministes utilisées par l'ensemble des systèmes
 * (monde ouvert, navigation, physique du ballon, audio spatial, économie).
 *
 * Aucune dépendance externe : le moteur doit rester portable (Node, navigateur,
 * futur binding natif) conformément au Tome XXV — Compatibilité future.
 */

export interface Vec2 {
  readonly x: number;
  readonly y: number;
}

export interface Vec3 {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** Coordonnée géographique réelle (degrés décimaux). */
export interface GeoPoint {
  readonly lat: number;
  readonly lon: number;
}

export const EARTH_RADIUS_KM = 6371.0088;

export function vec2(x: number, y: number): Vec2 {
  return { x, y };
}

export function vec3(x: number, y: number, z: number): Vec3 {
  return { x, y, z };
}

export function add2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub2(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function scale2(a: Vec2, k: number): Vec2 {
  return { x: a.x * k, y: a.y * k };
}

export function length2(a: Vec2): number {
  return Math.sqrt(a.x * a.x + a.y * a.y);
}

export function normalize2(a: Vec2): Vec2 {
  const l = length2(a);
  return l === 0 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
}

export function distance2(a: Vec2, b: Vec2): number {
  return length2(sub2(a, b));
}

export function add3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function sub3(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function scale3(a: Vec3, k: number): Vec3 {
  return { x: a.x * k, y: a.y * k, z: a.z * k };
}

export function length3(a: Vec3): number {
  return Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
}

export function distance3(a: Vec3, b: Vec3): number {
  return length3(sub3(a, b));
}

export function dot3(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function normalize3(a: Vec3): Vec3 {
  const l = length3(a);
  return l === 0 ? { x: 0, y: 0, z: 0 } : { x: a.x / l, y: a.y / l, z: a.z / l };
}

export function clamp(value: number, min: number, max: number): number {
  return value < min ? min : value > max ? max : value;
}

export function clamp01(value: number): number {
  return clamp(value, 0, 1);
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function inverseLerp(a: number, b: number, value: number): number {
  return a === b ? 0 : clamp01((value - a) / (b - a));
}

/** Interpolation lissée (ease-in-out cubique) pour les transitions UI et caméra. */
export function smoothStep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

/** Rapproche `current` de `target` d'au plus `maxDelta`. */
export function moveTowards(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

/**
 * Lissage exponentiel indépendant du pas de temps.
 * `halfLife` : durée (secondes) pour parcourir la moitié de l'écart restant.
 */
export function damp(current: number, target: number, halfLife: number, dt: number): number {
  if (halfLife <= 0) return target;
  const factor = Math.pow(0.5, dt / halfLife);
  return target + (current - target) * factor;
}

export function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function radToDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

/** Distance orthodromique en kilomètres — utilisée par le réseau aérien mondial. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = degToRad(b.lat - a.lat);
  const dLon = degToRad(b.lon - a.lon);
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cap initial (degrés, 0 = Nord) entre deux points géographiques. */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const lat1 = degToRad(a.lat);
  const lat2 = degToRad(b.lat);
  const dLon = degToRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (radToDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Moyenne pondérée robuste : ignore les poids nuls ou négatifs. */
export function weightedAverage(entries: ReadonlyArray<{ value: number; weight: number }>): number {
  let sum = 0;
  let totalWeight = 0;
  for (const entry of entries) {
    if (entry.weight <= 0) continue;
    sum += entry.value * entry.weight;
    totalWeight += entry.weight;
  }
  return totalWeight === 0 ? 0 : sum / totalWeight;
}

export function sum(values: readonly number[]): number {
  let total = 0;
  for (const v of values) total += v;
  return total;
}

export function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : sum(values) / values.length;
}

export function round(value: number, decimals = 0): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/** Bruit de valeur 1D lisse et déterministe (ambiances météo, trafic, foule). */
export function valueNoise1D(x: number, seed = 0): number {
  const i = Math.floor(x);
  const f = x - i;
  const a = hashToUnit(i, seed);
  const b = hashToUnit(i + 1, seed);
  return lerp(a, b, smoothStep(f));
}

/** Bruit fractal (fBm) : superposition d'octaves de bruit de valeur. */
export function fbm1D(x: number, octaves = 4, seed = 0): number {
  let amplitude = 1;
  let frequency = 1;
  let total = 0;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    total += valueNoise1D(x * frequency, seed + o * 977) * amplitude;
    norm += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }
  return norm === 0 ? 0 : total / norm;
}

/** Hash entier → [0,1[ déterministe et bien distribué. */
export function hashToUnit(value: number, seed = 0): number {
  let h = (Math.imul(value | 0, 0x27d4eb2d) ^ Math.imul(seed | 0, 0x165667b1)) >>> 0;
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d) >>> 0;
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39) >>> 0;
  h ^= h >>> 15;
  return h / 0x100000000;
}

/** Hash de chaîne (FNV-1a 32 bits) — sert de graine stable pour les entités nommées. */
export function hashString(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}
