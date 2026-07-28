/**
 * Infinity Football — Core / Sauvegarde & migrations
 *
 * Tome XV, ch. 5 : « Les anciennes sauvegardes restent compatibles. »
 * Tome X, ch. 8 : protection des sauvegardes, synchronisation cloud, autosave.
 *
 * Le format est JSON pur, versionné, avec une somme de contrôle et une chaîne
 * de migrations appliquée automatiquement du numéro de version stocké jusqu'au
 * numéro courant.
 */

import { hashString } from './math.js';

export const SAVE_FORMAT_VERSION = 4;

export interface SaveEnvelope {
  readonly magic: 'INFINITY_FOOTBALL_SAVE';
  readonly version: number;
  readonly createdAt: string;
  readonly slot: string;
  readonly kind: 'manual' | 'auto' | 'cloud';
  readonly checksum: string;
  readonly meta: SaveMeta;
  readonly payload: SavePayload;
}

export interface SaveMeta {
  readonly seed: string;
  readonly playerName: string;
  readonly clubName: string;
  readonly season: number;
  readonly dateLabel: string;
  readonly playtimeMinutes: number;
  readonly reputation: number;
  readonly netWorth: number;
}

export interface SavePayload {
  readonly clock: unknown;
  readonly rngStreams: Record<string, unknown>;
  readonly systems: Record<string, unknown>;
}

export type Migration = (payload: Record<string, unknown>) => Record<string, unknown>;

/**
 * Migrations indexées par version d'origine : `migrations[n]` transforme une
 * sauvegarde de version `n` en version `n + 1`.
 *
 * Les versions 1 à 3 correspondent aux itérations internes du format :
 *  v1 → v2 : les flux aléatoires deviennent nommés ;
 *  v2 → v3 : les systèmes sont stockés dans une table dédiée ;
 *  v3 → v4 : ajout du bloc `world` unifié pour les états de villes.
 */
export const MIGRATIONS: Record<number, Migration> = {
  1: (payload) => ({
    ...payload,
    rngStreams: (payload.rngStreams as Record<string, unknown>) ?? {},
  }),
  2: (payload) => {
    if (payload.systems) return payload;
    const { clock, rngStreams, ...rest } = payload;
    return { clock, rngStreams, systems: rest };
  },
  3: (payload) => {
    const systems = (payload.systems as Record<string, unknown>) ?? {};
    if (systems.world === undefined && systems['world.state'] !== undefined) {
      const { ['world.state']: legacyWorld, ...others } = systems;
      return { ...payload, systems: { ...others, world: legacyWorld } };
    }
    return payload;
  },
};

export function computeChecksum(payload: SavePayload): string {
  return hashString(stableStringify(payload)).toString(16).padStart(8, '0');
}

/** Sérialisation stable (clés triées) : indispensable pour une somme fiable. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(',')}}`;
}

export function createEnvelope(
  slot: string,
  kind: 'manual' | 'auto' | 'cloud',
  meta: SaveMeta,
  payload: SavePayload,
): SaveEnvelope {
  return {
    magic: 'INFINITY_FOOTBALL_SAVE',
    version: SAVE_FORMAT_VERSION,
    createdAt: new Date().toISOString(),
    slot,
    kind,
    checksum: computeChecksum(payload),
    meta,
    payload,
  };
}

export class SaveCorruptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SaveCorruptionError';
  }
}

/** Valide, migre et retourne une charge utile exploitable. */
export function loadEnvelope(raw: unknown): { payload: SavePayload; meta: SaveMeta; migrated: boolean } {
  if (typeof raw !== 'object' || raw === null) {
    throw new SaveCorruptionError('sauvegarde illisible : objet attendu');
  }
  const envelope = raw as Partial<SaveEnvelope>;
  if (envelope.magic !== 'INFINITY_FOOTBALL_SAVE') {
    throw new SaveCorruptionError('signature de sauvegarde invalide');
  }
  if (typeof envelope.version !== 'number' || envelope.version < 1) {
    throw new SaveCorruptionError('version de sauvegarde invalide');
  }
  if (envelope.version > SAVE_FORMAT_VERSION) {
    throw new SaveCorruptionError(
      `sauvegarde plus récente que le jeu (v${envelope.version} > v${SAVE_FORMAT_VERSION})`,
    );
  }
  if (!envelope.payload || typeof envelope.payload !== 'object') {
    throw new SaveCorruptionError('charge utile absente');
  }
  const expected = computeChecksum(envelope.payload as SavePayload);
  if (envelope.checksum !== undefined && envelope.checksum !== expected) {
    throw new SaveCorruptionError('somme de contrôle invalide : fichier corrompu ou modifié');
  }

  let working = envelope.payload as unknown as Record<string, unknown>;
  let version = envelope.version;
  let migrated = false;
  while (version < SAVE_FORMAT_VERSION) {
    const migration = MIGRATIONS[version];
    if (!migration) {
      throw new SaveCorruptionError(`migration manquante depuis la version ${version}`);
    }
    working = migration(working);
    version++;
    migrated = true;
  }

  const payload: SavePayload = {
    clock: working.clock,
    rngStreams: (working.rngStreams as Record<string, unknown>) ?? {},
    systems: (working.systems as Record<string, unknown>) ?? {},
  };

  const meta: SaveMeta = (envelope.meta as SaveMeta) ?? {
    seed: 'inconnu',
    playerName: 'inconnu',
    clubName: 'inconnu',
    season: 0,
    dateLabel: '',
    playtimeMinutes: 0,
    reputation: 0,
    netWorth: 0,
  };

  return { payload, meta, migrated };
}

/** Adaptateur de stockage : disque local, navigateur, cloud. */
export interface SaveStorage {
  write(slot: string, envelope: SaveEnvelope): Promise<void>;
  read(slot: string): Promise<SaveEnvelope | null>;
  list(): Promise<string[]>;
  delete(slot: string): Promise<void>;
}

/** Stockage mémoire — utilisé par les tests et par le mode démo web. */
export class MemorySaveStorage implements SaveStorage {
  private readonly slots = new Map<string, SaveEnvelope>();

  async write(slot: string, envelope: SaveEnvelope): Promise<void> {
    // Copie profonde : la sauvegarde ne doit pas partager de référence vivante.
    this.slots.set(slot, JSON.parse(JSON.stringify(envelope)) as SaveEnvelope);
  }

  async read(slot: string): Promise<SaveEnvelope | null> {
    const value = this.slots.get(slot);
    return value ? (JSON.parse(JSON.stringify(value)) as SaveEnvelope) : null;
  }

  async list(): Promise<string[]> {
    return [...this.slots.keys()].sort();
  }

  async delete(slot: string): Promise<void> {
    this.slots.delete(slot);
  }
}
