/**
 * state.js — Conteneur d'état central du monde.
 *
 * Un seul objet décrit intégralement une partie. C'est ce qui permet :
 *   - la sauvegarde/chargement fidèles (Tome X ch. 8) ;
 *   - la compatibilité ascendante des anciennes sauvegardes
 *     (Tome XV ch. 5, Tome XXII ch. 6) via les migrations de `save.js` ;
 *   - la traçabilité : chaque système lit et écrit une branche identifiée.
 *
 * Règle d'architecture : l'état ne contient que des données sérialisables.
 * Aucune fonction, aucune référence circulaire, aucun objet DOM.
 */

import { RNG } from './rng.js';

/** Version du schéma d'état. Incrémentée à chaque changement de structure. */
export const STATE_VERSION = 3;

/**
 * Crée un état neuf.
 * @param {object} options
 */
export function createInitialState(options = {}) {
  const {
    name = 'Nouveau Joueur',
    nationality = 'Mali',
    position = 'AT',
    foot = 'droit',
    style = 'Finisseur',
    age = 17,
    clubId = 'stade-malien',
    seed = Date.now(),
  } = options;

  return {
    version: STATE_VERSION,
    createdAt: new Date().toISOString(),
    seed,

    /** Horloge sérialisée — voir core/clock.js */
    clock: {
      year: 2026, month: 6, day: 1, hour: 8, minute: 0,
      totalHours: 0, season: 2026, speed: 1,
    },

    /** Générateur maître sérialisé — voir core/rng.js */
    rng: new RNG(seed).serialize(),

    // ── Tome IV : le joueur ────────────────────────────────────────────────
    player: {
      name,
      nationality,
      position,
      foot,
      style,
      age,
      birthSeason: 2026 - age,
      /** Attributs 1-99 — Tome III ch. 1 et 3 */
      attributes: {
        vitesse: 62, technique: 60, tir: 58, passe: 57, dribble: 61,
        physique: 55, defense: 35, vision: 54, mental: 52, placement: 53,
      },
      /** Forme instantanée et fatigue — Tome III ch. 2, Tome V ch. 4 */
      condition: { forme: 70, fatigue: 10, moral: 75, confiance: 60 },
      /** Blessure en cours, ou null */
      injury: null,
      /** Traits acquis, influencent le moteur de match */
      traits: [],
      retired: false,
      retiredAt: null,
    },

    // ── Tome IV ch. 3-4 : club et contrat ──────────────────────────────────
    career: {
      clubId,
      contract: {
        salary: 24000,          // par saison, en € de jeu
        signingBonus: 0,
        endSeason: 2029,
        goalBonus: 1500,
        appearanceBonus: 500,
        clauses: ['Formation'],
      },
      marketValue: 900000,
      squadStatus: 'Espoir',
      /** Historique complet — Tome XVII ch. 2, Tome XXVIII */
      clubHistory: [{ clubId, from: 2026, to: null }],
      nationalTeam: { called: false, caps: 0, goals: 0 },
      agent: { name: 'Amadou Diarra', skill: 62, commission: 0.06 },
    },

    // ── Tome XXVIII : statistiques et records ──────────────────────────────
    stats: {
      career: emptyStatLine(),
      /** Par saison : { [season]: statLine } */
      seasons: {},
      /** Meilleures marques personnelles */
      records: {},
    },

    // ── Tome XXIII : économie et patrimoine ───────────────────────────────
    economy: {
      accounts: {
        courant: 15000,
        epargne: 0,
        professionnel: 0,
      },
      /** Portefeuille d'investissement — Tome XXIII ch. 3 */
      investments: [],
      /** Immobilier — Tome XXIII ch. 4 */
      properties: [],
      /** Employés — Tome XXIII ch. 5 */
      staff: [],
      /** Objets de luxe et collections — Tome XXIII ch. 6, Tome XXIV ch. 7 */
      collection: [],
      /** Véhicules possédés — Tome XXII ch. 3 */
      garage: [],
      /** Journal comptable complet — « toutes les transactions sont enregistrées » */
      ledger: [],
      /** Fondations et dons — Tome XXVI ch. 5, Tome XXIII ch. 7 */
      philanthropy: { foundations: [], totalDonated: 0 },
    },

    // ── Tome XXIV : contrats de marque ────────────────────────────────────
    endorsements: {
      active: [],
      /** Marques bloquées par une clause d'exclusivité en cours */
      blockedBrands: [],
      offersPending: [],
    },

    // ── Tome XXVI : réputation ────────────────────────────────────────────
    reputation: {
      global: 12,
      /** Réputation par pays — « la réputation varie selon les pays » */
      byCountry: {},
      fairplay: 70,
      mediaInfluence: 8,
      fanRelation: 50,
      loyalty: 50,
      charity: 0,
      /** Statuts culturels obtenus — Tome XXVI ch. 6 */
      honours: [],
    },

    // ── Tome II / XXX : position et monde ─────────────────────────────────
    world: {
      currentCityId: 'bamako',
      currentVenueId: null,
      weather: { type: 'ensoleillé', tempC: 32, windKph: 8, pitchQuality: 78 },
      /** Événements dynamiques actifs — Tome XIX, Tome XX ch. 6 */
      activeEvents: [],
      /** Compteur de mémoire du monde — Tome XXV ch. 3 */
      worldMemory: [],
      /** Ville hôte des Boubjack Awards par édition */
      awardsHosts: {},
      /** Découvertes faites par le joueur — Tome XXXII ch. 2 */
      discoveries: [],
    },

    // ── Tome XI : téléphone ───────────────────────────────────────────────
    phone: {
      unlockedApps: [
        'telephone', 'messages', 'contacts', 'galerie', 'banque', 'agenda',
        'gps', 'musique', 'snapstreak', 'social', 'boutique', 'commandes',
        'livraison', 'secretaire', 'meteo', 'actualites', 'calendrier', 'mail', 'notes',
      ],
      messages: [],
      notifications: [],
      /** Publications réseaux sociaux — Tome XI ch. 3 */
      posts: [],
      followers: 1200,
      /** Flammes Snapstreak par contact — Tome XI ch. 4 */
      streaks: {},
      /** Commandes en cours de livraison — Tome XXX ch. 5 */
      orders: [],
      /** Playlists — Tome IX ch. 5, Tome XI ch. 5 */
      playlists: [{ id: 'echauffement', name: 'Échauffement', tracks: 14, connected: false }],
      unread: 0,
    },

    // ── Tome XI ch. 7 : vie personnelle ───────────────────────────────────
    personal: {
      relationships: [],
      family: [],
      /** Agenda personnel — l'IA secrétaire y écrit */
      agenda: [],
      /** Vacances effectuées — Tome XXX ch. 4 */
      holidays: [],
      wellbeing: 70,
    },

    // ── Tome XXVII : médias ───────────────────────────────────────────────
    media: {
      headlines: [],
      pressConferences: [],
      documentaries: [],
      /** Mémoire des journalistes — Tome VIII ch. 4 */
      journalistMemory: [],
    },

    // ── Tome VII / XVII : palmarès et héritage ────────────────────────────
    legacy: {
      trophies: [],
      awards: [],
      hallOfFame: false,
      hallOfFameSeason: null,
      /** Musée personnel — Tome XVII ch. 4, Tome XXI ch. 4 */
      museum: { built: false, visitors: 0, revenue: 0, rating: 0, exhibits: [] },
      /** Maillots encadrés des légendes côtoyées — Tome IV ch. 6 */
      framedShirts: [],
      /** Chronologie personnelle — Tome XXVIII ch. 6 */
      timeline: [],
      /** Métier exercé après la retraite — Tome XXI ch. 2 */
      postCareerRole: null,
      statues: [],
    },

    // ── Tome XV : télémétrie qualité ──────────────────────────────────────
    diagnostics: {
      ticksProcessed: 0,
      matchesSimulated: 0,
      lastSaveAt: null,
      warnings: [],
    },

    /** Paramètres joueur — Tome XII ch. 4 et 7 */
    settings: {
      hud: { minimap: true, objectifs: true, notifications: true, heure: true, meteo: true },
      accessibility: { textScale: 1, highContrast: false, reducedMotion: false, subtitles: true },
      audio: { commentaryLang: 'fr', musicSource: 'officielle', volume: 0.8 },
      autosave: true,
    },
  };
}

/** Ligne de statistiques vide — Tome XXVIII ch. 2. */
export function emptyStatLine() {
  return {
    matchs: 0, titularisations: 0, minutes: 0,
    buts: 0, passesD: 0, tirs: 0, tirsCadres: 0,
    passes: 0, passesReussies: 0, dribbles: 0, duels: 0, duelsGagnes: 0,
    cartonsJaunes: 0, cartonsRouges: 0,
    kilometres: 0, vitesseMax: 0,
    notes: [], hommeDuMatch: 0,
    victoires: 0, nuls: 0, defaites: 0,
  };
}

/** Agrège deux lignes de statistiques (cumul carrière). */
export function mergeStatLine(target, delta) {
  for (const key of Object.keys(delta)) {
    const value = delta[key];
    if (Array.isArray(value)) {
      target[key] = (target[key] || []).concat(value);
    } else if (key === 'vitesseMax') {
      target[key] = Math.max(target[key] || 0, value);
    } else if (typeof value === 'number') {
      target[key] = (target[key] || 0) + value;
    }
  }
  return target;
}

/** Note moyenne sur une ligne de statistiques. */
export function averageRating(statLine) {
  const notes = statLine.notes || [];
  if (notes.length === 0) return 0;
  return notes.reduce((a, b) => a + b, 0) / notes.length;
}
