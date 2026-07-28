/**
 * save.js — Sauvegarde, chargement et migration.
 *
 * Exigences couvertes :
 *   - Tome X ch. 8   : protection des sauvegardes, sauvegardes automatiques
 *   - Tome XII ch. 3 : sauvegarder / charger depuis le menu Pause
 *   - Tome XV ch. 5  : « les anciennes sauvegardes restent compatibles »
 *   - Tome XXII ch.6 : compatibilité maintenue après enrichissement de l'IA
 *
 * Stratégie de compatibilité : chaque sauvegarde porte un numéro de version.
 * Au chargement, les migrations sont appliquées dans l'ordre jusqu'à atteindre
 * STATE_VERSION. Une sauvegarde plus récente que le moteur est refusée
 * explicitement plutôt que chargée de travers.
 */

import { STATE_VERSION, createInitialState, emptyStatLine } from './state.js';
import { bus, EVENTS } from './events.js';

const PREFIX = 'infinity-football:save:';
const INDEX_KEY = 'infinity-football:index';

/**
 * Migrations successives. Chaque fonction prend un état à la version N et
 * retourne un état à la version N+1. Elles ne doivent jamais supprimer de
 * données : une migration ajoute ou renomme, elle ne régresse pas.
 */
const MIGRATIONS = {
  1: (state) => {
    // v1 → v2 : ajout du patrimoine (Tome XXIII) et des contrats de marque.
    state.economy = state.economy || {};
    state.economy.properties = state.economy.properties || [];
    state.economy.staff = state.economy.staff || [];
    state.economy.collection = state.economy.collection || [];
    state.economy.garage = state.economy.garage || [];
    state.economy.philanthropy = state.economy.philanthropy || { foundations: [], totalDonated: 0 };
    state.endorsements = state.endorsements || { active: [], blockedBrands: [], offersPending: [] };
    state.version = 2;
    return state;
  },
  2: (state) => {
    // v2 → v3 : héritage détaillé (Tome XVII / XXI) et diagnostics qualité.
    state.legacy = state.legacy || {};
    state.legacy.museum = state.legacy.museum || {
      built: false, visitors: 0, revenue: 0, rating: 0, exhibits: [],
    };
    state.legacy.framedShirts = state.legacy.framedShirts || [];
    state.legacy.timeline = state.legacy.timeline || [];
    state.legacy.statues = state.legacy.statues || [];
    state.legacy.postCareerRole = state.legacy.postCareerRole ?? null;
    state.diagnostics = state.diagnostics || {
      ticksProcessed: 0, matchesSimulated: 0, lastSaveAt: null, warnings: [],
    };
    state.version = 3;
    return state;
  },
};

/** Vérifie la présence du stockage et retourne un backend utilisable. */
function storage() {
  try {
    const probe = '__if_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    // Mode privé ou stockage désactivé : bascule mémoire, la partie reste jouable.
    if (!storage._memory) {
      storage._memory = new Map();
      storage._shim = {
        getItem: (k) => (storage._memory.has(k) ? storage._memory.get(k) : null),
        setItem: (k, v) => storage._memory.set(k, String(v)),
        removeItem: (k) => storage._memory.delete(k),
      };
    }
    return storage._shim;
  }
}

/** Somme de contrôle légère pour détecter une sauvegarde corrompue. */
function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

export function listSaves() {
  try {
    const raw = storage().getItem(INDEX_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeIndex(entries) {
  storage().setItem(INDEX_KEY, JSON.stringify(entries));
}

/**
 * Écrit une sauvegarde.
 * @param {string} slot identifiant de l'emplacement
 * @param {object} state état complet du monde
 * @param {object} meta  métadonnées affichées dans la liste des sauvegardes
 */
export function saveGame(slot, state, meta = {}) {
  const payload = JSON.stringify(state);
  const envelope = {
    version: state.version ?? STATE_VERSION,
    savedAt: new Date().toISOString(),
    checksum: checksum(payload),
    state: payload,
  };

  try {
    storage().setItem(PREFIX + slot, JSON.stringify(envelope));
  } catch (err) {
    // Quota dépassé : on prévient plutôt que d'échouer en silence.
    bus.emit(EVENTS.NOTIFY, {
      level: 'error',
      title: 'Sauvegarde impossible',
      body: "L'espace de stockage du navigateur est saturé. Supprimez une sauvegarde existante.",
    });
    console.error('[save] écriture refusée :', err);
    return false;
  }

  const index = listSaves().filter((e) => e.slot !== slot);
  index.push({
    slot,
    savedAt: envelope.savedAt,
    version: envelope.version,
    label: meta.label || slot,
    playerName: meta.playerName || state.player?.name || '—',
    season: meta.season ?? state.clock?.season,
    club: meta.club || '—',
  });
  index.sort((a, b) => b.savedAt.localeCompare(a.savedAt));
  writeIndex(index);

  state.diagnostics.lastSaveAt = envelope.savedAt;
  bus.emit(EVENTS.SAVE, { slot, savedAt: envelope.savedAt });
  return true;
}

/**
 * Charge une sauvegarde, en appliquant les migrations nécessaires.
 * @returns {{ok:true, state:object, migratedFrom:number|null}|{ok:false, reason:string}}
 */
export function loadGame(slot) {
  const raw = storage().getItem(PREFIX + slot);
  if (!raw) return { ok: false, reason: "Aucune sauvegarde à cet emplacement." };

  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'Fichier de sauvegarde illisible.' };
  }

  if (envelope.checksum && checksum(envelope.state) !== envelope.checksum) {
    return { ok: false, reason: 'Sauvegarde corrompue : la somme de contrôle ne correspond pas.' };
  }

  let state;
  try {
    state = JSON.parse(envelope.state);
  } catch {
    return { ok: false, reason: "Contenu de sauvegarde invalide." };
  }

  const originalVersion = state.version ?? 1;
  if (originalVersion > STATE_VERSION) {
    return {
      ok: false,
      reason: `Cette sauvegarde (v${originalVersion}) provient d'une version plus récente du jeu.`,
    };
  }

  let version = originalVersion;
  while (version < STATE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) {
      return { ok: false, reason: `Migration manquante depuis la version ${version}.` };
    }
    state = migrate(state);
    version = state.version;
  }

  state = reconcile(state);
  bus.emit(EVENTS.LOAD, { slot, version: state.version });
  return {
    ok: true,
    state,
    migratedFrom: originalVersion === STATE_VERSION ? null : originalVersion,
  };
}

/**
 * Réconcilie un état chargé avec le schéma courant : toute branche absente
 * est restaurée depuis l'état initial. Une sauvegarde ancienne reste donc
 * jouable même si le moteur a gagné de nouveaux systèmes entre-temps.
 */
export function reconcile(state) {
  const reference = createInitialState({ seed: state.seed || 1 });

  const walk = (target, model, path = '') => {
    for (const key of Object.keys(model)) {
      const modelValue = model[key];
      if (target[key] === undefined || target[key] === null) {
        target[key] = Array.isArray(modelValue)
          ? []
          : typeof modelValue === 'object'
            ? JSON.parse(JSON.stringify(modelValue))
            : modelValue;
        continue;
      }
      if (
        modelValue && typeof modelValue === 'object' && !Array.isArray(modelValue) &&
        target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
      ) {
        walk(target[key], modelValue, `${path}${key}.`);
      }
    }
  };

  walk(state, reference);

  if (!state.stats.career) state.stats.career = emptyStatLine();
  state.version = STATE_VERSION;
  return state;
}

export function deleteSave(slot) {
  storage().removeItem(PREFIX + slot);
  writeIndex(listSaves().filter((e) => e.slot !== slot));
  return true;
}

/** Export d'une sauvegarde en JSON téléchargeable (Tome X ch. 8 : portabilité). */
export function exportSave(state) {
  return JSON.stringify(
    { format: 'infinity-football-save', version: state.version, exportedAt: new Date().toISOString(), state },
    null,
    2,
  );
}

/** Import d'une sauvegarde exportée. */
export function importSave(json) {
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: 'JSON invalide.' };
  }
  if (parsed.format !== 'infinity-football-save' || !parsed.state) {
    return { ok: false, reason: "Ce fichier n'est pas une sauvegarde Infinity Football." };
  }
  let state = parsed.state;
  let version = state.version ?? 1;
  if (version > STATE_VERSION) {
    return { ok: false, reason: 'Sauvegarde issue d\'une version plus récente du jeu.' };
  }
  while (version < STATE_VERSION) {
    const migrate = MIGRATIONS[version];
    if (!migrate) return { ok: false, reason: `Migration manquante depuis la version ${version}.` };
    state = migrate(state);
    version = state.version;
  }
  return { ok: true, state: reconcile(state) };
}
