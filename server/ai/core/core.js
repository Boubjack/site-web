/**
 * AI CORE ENGINE — couche centrale de coordination.
 *
 * Tous les moteurs IA (Theme, Layout, Component, Animation, Commerce, Branding,
 * Marketing, Photo, Video, SEO, Search, Recommendation, Analytics, Fraud,
 * Performance, Accessibility, Translation, Pricing, Inventory…) s'enregistrent
 * ici et sont invoqués via UNE interface uniforme : `core.run(engine, action,
 * input, ctx)`.
 *
 * Chaque moteur est INDÉPENDANT et expose des `actions` documentées. Le Core
 * ajoute, de façon transverse : permissions par rôle, cache, métriques,
 * événements et logs — sans que les moteurs aient à s'en soucier.
 *
 * Extensibilité : ajouter un moteur = créer un module au contrat `Engine` et
 * l'enregistrer. Aucun moteur existant n'est modifié.
 *
 * Contrat d'un moteur :
 *   {
 *     id, name, description,
 *     category: 'design'|'commerce'|'media'|'intelligence'|'platform',
 *     allowedRoles: ['seller','admin'] | null,     // null = public
 *     actions: {
 *       [name]: {
 *         description,
 *         allowedRoles?,                            // surclasse celui du moteur
 *         cacheTtlMs?,                              // si défini → mise en cache
 *         cacheKey?(input, ctx) => string,          // clé de cache (déf: JSON)
 *         handler(input, ctx, core) => result,
 *       }
 *     },
 *     init?(core)                                    // au démarrage (facultatif)
 *   }
 */
const { createLogger } = require('../../utils/logger');
const { EventBus } = require('./events');
const { Cache } = require('./cache');
const { Metrics } = require('./metrics');

class CoreError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

class Core {
  constructor() {
    this.engines = new Map();
    this.events = new EventBus();
    this.cache = new Cache();
    this.metrics = new Metrics();
    this.log = createLogger('ai:core');
  }

  register(engine) {
    for (const f of ['id', 'name', 'actions']) {
      if (!engine[f]) throw new Error(`Moteur invalide : « ${f} » manquant.`);
    }
    if (this.engines.has(engine.id)) throw new Error(`Moteur déjà enregistré : ${engine.id}`);
    this.engines.set(engine.id, engine);
    if (typeof engine.init === 'function') { try { engine.init(this); } catch (e) { this.log.warn('init moteur échouée', { id: engine.id, error: e.message }); } }
    this.log.info('moteur enregistré', { id: engine.id, category: engine.category || 'autre' });
    this.events.emit('engine:registered', { id: engine.id });
    return this;
  }

  get(id) { return this.engines.get(id) || null; }

  /** Permission : rôles de l'action, sinon du moteur ; null = public. */
  canUse(engine, action, user) {
    const roles = (action && action.allowedRoles) || engine.allowedRoles || null;
    if (!roles) return true;
    const role = user ? user.role : 'guest';
    return roles.includes('*') || roles.includes(role);
  }

  /** Liste des moteurs accessibles à l'utilisateur (avec leurs actions autorisées). */
  list(user) {
    const out = [];
    for (const e of this.engines.values()) {
      const actions = Object.entries(e.actions)
        .filter(([, a]) => this.canUse(e, a, user))
        .map(([name, a]) => ({ name, description: a.description || '' }));
      if (!e.allowedRoles || this.canUse(e, null, user) || actions.length) {
        out.push({ id: e.id, name: e.name, description: e.description || '', category: e.category || 'autre', actions });
      }
    }
    return out;
  }

  /** Invocation uniforme : permission → cache → exécution → métriques → événements. */
  async run(engineId, actionName, input = {}, ctx = {}) {
    const engine = this.get(engineId);
    if (!engine) throw new CoreError(404, `Moteur introuvable : ${engineId}`);
    const action = engine.actions[actionName];
    if (!action) throw new CoreError(404, `Action introuvable : ${engineId}.${actionName}`);
    if (!this.canUse(engine, action, ctx.user)) throw new CoreError(403, `Accès refusé : ${engineId}.${actionName}`);

    const cacheable = Boolean(action.cacheTtlMs);
    const cacheKey = cacheable
      ? `${engineId}.${actionName}:${(action.cacheKey ? action.cacheKey(input, ctx) : JSON.stringify(input))}`
      : null;
    if (cacheable) {
      const hit = this.cache.get(cacheKey);
      if (hit !== undefined) { this.events.emit('engine:cache:hit', { engine: engineId, action: actionName }); return hit; }
    }

    const t = Date.now();
    this.events.emit('engine:run:start', { engine: engineId, action: actionName });
    try {
      const result = await action.handler(input || {}, ctx || {}, this);
      const ms = Date.now() - t;
      this.metrics.record(engineId, actionName, ms, false);
      this.events.emit('engine:run:done', { engine: engineId, action: actionName, ms });
      if (cacheable && result !== undefined) this.cache.set(cacheKey, result, action.cacheTtlMs);
      return result;
    } catch (err) {
      this.metrics.record(engineId, actionName, Date.now() - t, true);
      this.events.emit('engine:run:error', { engine: engineId, action: actionName, error: err.message });
      throw err;
    }
  }

  /** État de santé + monitoring (pilotage admin). */
  health() {
    const byCategory = {};
    for (const e of this.engines.values()) byCategory[e.category || 'autre'] = (byCategory[e.category || 'autre'] || 0) + 1;
    return {
      status: 'ok',
      engines: { total: this.engines.size, byCategory, ids: [...this.engines.keys()] },
      events: { types: this.events.handlers.size },
      cache: this.cache.stats(),
      metrics: this.metrics.snapshot(),
    };
  }
}

module.exports = { Core, CoreError };
