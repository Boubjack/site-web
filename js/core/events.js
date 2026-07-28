/**
 * events.js — Bus d'événements du moteur.
 *
 * Tous les systèmes communiquent exclusivement via ce bus : aucun système
 * n'importe directement un autre système. C'est ce qui rend l'architecture
 * modulaire (Tome XXII, ch. 1) — un système peut être remplacé ou étendu
 * sans casser les autres.
 *
 * Deux canaux existent :
 *   - `on` / `emit`      : diffusion classique, asynchrone du point de vue métier
 *   - `intercept`        : filtres synchrones capables de modifier ou d'annuler
 *                          un événement avant sa diffusion (utilisé par exemple
 *                          par les clauses de contrat d'équipementier qui
 *                          bloquent un achat — Tome XXII ch. 4, Tome XXIV ch. 3)
 */

export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
    /** @type {Map<string, Set<Function>>} */
    this._interceptors = new Map();
    /** @type {Array<{type:string, payload:any, at:number}>} */
    this._journal = [];
    this.journalLimit = 500;
    this.debug = false;
  }

  /**
   * Abonne un handler à un type d'événement.
   * @returns {Function} fonction de désabonnement
   */
  on(type, handler) {
    if (typeof handler !== 'function') {
      throw new TypeError(`EventBus.on("${type}") attend une fonction.`);
    }
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(handler);
    return () => this.off(type, handler);
  }

  /** Abonne un handler qui se retire après le premier déclenchement. */
  once(type, handler) {
    const wrapper = (payload) => {
      this.off(type, wrapper);
      handler(payload);
    };
    return this.on(type, wrapper);
  }

  off(type, handler) {
    const set = this._listeners.get(type);
    if (set) {
      set.delete(handler);
      if (set.size === 0) this._listeners.delete(type);
    }
  }

  /**
   * Enregistre un intercepteur synchrone.
   * L'intercepteur reçoit le payload et retourne :
   *   - `false`            → l'événement est annulé
   *   - un objet           → remplace le payload
   *   - `undefined`/`true` → laisse passer inchangé
   */
  intercept(type, filter) {
    if (!this._interceptors.has(type)) this._interceptors.set(type, new Set());
    this._interceptors.get(type).add(filter);
    return () => {
      const set = this._interceptors.get(type);
      if (set) set.delete(filter);
    };
  }

  /**
   * Diffuse un événement.
   * @returns {boolean} false si un intercepteur a annulé l'événement
   */
  emit(type, payload = {}) {
    let current = payload;

    const filters = this._interceptors.get(type);
    if (filters) {
      for (const filter of filters) {
        const result = filter(current, type);
        if (result === false) {
          if (this.debug) console.info(`[bus] ✖ ${type} annulé par un intercepteur`);
          return false;
        }
        if (result && typeof result === 'object') current = result;
      }
    }

    this._journal.push({ type, payload: current, at: Date.now() });
    if (this._journal.length > this.journalLimit) {
      this._journal.splice(0, this._journal.length - this.journalLimit);
    }
    if (this.debug) console.info(`[bus] → ${type}`, current);

    const listeners = this._listeners.get(type);
    if (listeners) {
      // Copie défensive : un handler peut se désabonner pendant la diffusion.
      for (const handler of Array.from(listeners)) {
        try {
          handler(current, type);
        } catch (err) {
          console.error(`[bus] handler "${type}" a échoué :`, err);
          // Un handler défaillant ne doit jamais interrompre la boucle de jeu.
        }
      }
    }

    const wildcard = this._listeners.get('*');
    if (wildcard) {
      for (const handler of Array.from(wildcard)) {
        try {
          handler(current, type);
        } catch (err) {
          console.error('[bus] handler wildcard a échoué :', err);
        }
      }
    }
    return true;
  }

  /** Derniers événements diffusés, du plus ancien au plus récent. */
  journal(limit = 50) {
    return this._journal.slice(-limit);
  }

  /** Retire tous les abonnements — utilisé au chargement d'une sauvegarde. */
  clear() {
    this._listeners.clear();
    this._interceptors.clear();
    this._journal.length = 0;
  }
}

/** Catalogue central des types d'événements, pour éviter les chaînes libres. */
export const EVENTS = {
  // Horloge
  TICK: 'clock:tick',
  DAY: 'clock:day',
  WEEK: 'clock:week',
  MONTH: 'clock:month',
  SEASON_START: 'clock:season-start',
  SEASON_END: 'clock:season-end',

  // Économie
  TRANSACTION: 'economy:transaction',
  PURCHASE_REQUEST: 'economy:purchase-request',
  PURCHASE_DONE: 'economy:purchase-done',
  PURCHASE_BLOCKED: 'economy:purchase-blocked',
  INVESTMENT_RETURN: 'economy:investment-return',
  SALARY_PAID: 'economy:salary-paid',

  // Carrière
  MATCH_PLAYED: 'career:match-played',
  TRAINING_DONE: 'career:training-done',
  INJURY: 'career:injury',
  RECOVERY: 'career:recovery',
  TRANSFER: 'career:transfer',
  CONTRACT_SIGNED: 'career:contract-signed',
  RETIREMENT: 'career:retirement',
  ATTRIBUTE_CHANGED: 'career:attribute-changed',

  // Monde
  WORLD_EVENT: 'world:event',
  TRAVEL: 'world:travel',
  WEATHER_CHANGED: 'world:weather',
  NPC_LIFE: 'world:npc-life',

  // Médias & réputation
  HEADLINE: 'media:headline',
  PRESS_CONFERENCE: 'media:press-conference',
  REPUTATION_CHANGED: 'media:reputation',
  SOCIAL_POST: 'media:social-post',

  // Cérémonies
  AWARDS_HELD: 'awards:held',
  TROPHY_WON: 'awards:trophy',
  HALL_OF_FAME: 'awards:hall-of-fame',

  // Système
  NOTIFY: 'ui:notify',
  SAVE: 'system:save',
  LOAD: 'system:load',
  LOG: 'system:log',
};

export const bus = new EventBus();
