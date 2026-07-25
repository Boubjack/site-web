/**
 * Bus d'événements interne du AI Core Engine.
 *
 * Permet aux moteurs de communiquer de façon découplée (publication /
 * abonnement) sans se connaître directement. Un moteur peut réagir aux
 * événements d'un autre (ex. « produit publié » → réindexation recherche) sans
 * dépendance dure. Ajout de moteurs sans casser l'existant.
 */
class EventBus {
  constructor() { this.handlers = new Map(); }

  /** Abonne un handler à un type d'événement. Retourne une fonction de désabonnement. */
  on(type, handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    const set = this.handlers.get(type);
    if (set) set.delete(handler);
  }

  /** Publie un événement. Les erreurs d'un handler n'affectent pas les autres. */
  emit(type, payload) {
    const listeners = [...(this.handlers.get(type) || []), ...(this.handlers.get('*') || [])];
    for (const h of listeners) {
      try { h(payload, type); } catch { /* un handler défaillant n'interrompt pas le bus */ }
    }
    return listeners.length;
  }

  listenerCount(type) { return (this.handlers.get(type) || new Set()).size; }
}

module.exports = { EventBus };
