/**
 * Infinity Football — Core / Event Bus
 *
 * Bus d'événements typé, synchrone et ordonné. C'est la colonne vertébrale de
 * l'intégration entre systèmes : la mémoire des IA (Tome VIII), les médias
 * (Tome XXVII), les archives (Tome XXVIII) et le Legacy (Tome XVII) écoutent
 * tous le même flux, sans que les émetteurs ne connaissent leurs consommateurs.
 *
 * Garanties :
 *  - livraison synchrone dans l'ordre d'abonnement (priorité décroissante) ;
 *  - un abonné qui lève une exception n'interrompt jamais les autres ;
 *  - les événements émis pendant une livraison sont mis en file et traités
 *    juste après (pas de récursion infinie de pile).
 */

import type { GameEvent, GameEventMap, GameEventType } from './events.js';

export type EventHandler<T extends GameEventType> = (event: GameEventMap[T]) => void;

interface Subscription {
  readonly id: number;
  readonly type: string;
  readonly priority: number;
  readonly handler: (event: unknown) => void;
  readonly once: boolean;
  active: boolean;
}

export interface EventBusOptions {
  /** Nombre maximal d'événements conservés dans l'historique de debug. */
  readonly historyLimit?: number;
  /** Callback appelé lorsqu'un abonné lève une exception. */
  readonly onHandlerError?: (error: unknown, eventType: string) => void;
}

export class EventBus {
  private readonly subscriptions = new Map<string, Subscription[]>();
  private readonly wildcard: Subscription[] = [];
  private readonly queue: GameEvent[] = [];
  private readonly history: GameEvent[] = [];
  private readonly historyLimit: number;
  private readonly onHandlerError: (error: unknown, eventType: string) => void;
  private nextId = 1;
  private dispatching = false;
  private emittedCount = 0;

  constructor(options: EventBusOptions = {}) {
    this.historyLimit = options.historyLimit ?? 512;
    this.onHandlerError =
      options.onHandlerError ??
      ((error, type) => {
        // Un abonné défaillant ne doit jamais interrompre la simulation.
        console.error(`[EventBus] handler en échec pour "${type}":`, error);
      });
  }

  /** Abonnement typé. Retourne une fonction de désabonnement. */
  on<T extends GameEventType>(
    type: T,
    handler: EventHandler<T>,
    priority = 0,
  ): () => void {
    return this.register(type, handler as (event: unknown) => void, priority, false);
  }

  /** Abonnement typé consommé après le premier événement reçu. */
  once<T extends GameEventType>(
    type: T,
    handler: EventHandler<T>,
    priority = 0,
  ): () => void {
    return this.register(type, handler as (event: unknown) => void, priority, true);
  }

  /** Abonnement à tous les événements (journalisation, archives, replays). */
  onAny(handler: (event: GameEvent) => void, priority = 0): () => void {
    return this.register('*', handler as (event: unknown) => void, priority, false);
  }

  private register(
    type: string,
    handler: (event: unknown) => void,
    priority: number,
    once: boolean,
  ): () => void {
    const subscription: Subscription = {
      id: this.nextId++,
      type,
      priority,
      handler,
      once,
      active: true,
    };
    const list = type === '*' ? this.wildcard : this.getList(type);
    list.push(subscription);
    list.sort((a, b) => b.priority - a.priority || a.id - b.id);
    return () => {
      subscription.active = false;
      const index = list.indexOf(subscription);
      if (index >= 0) list.splice(index, 1);
    };
  }

  private getList(type: string): Subscription[] {
    let list = this.subscriptions.get(type);
    if (!list) {
      list = [];
      this.subscriptions.set(type, list);
    }
    return list;
  }

  /** Émet un événement. Si une livraison est en cours, il est mis en file. */
  emit(event: GameEvent): void {
    this.queue.push(event);
    if (this.dispatching) return;
    this.drain();
  }

  private drain(): void {
    this.dispatching = true;
    try {
      while (this.queue.length > 0) {
        const event = this.queue.shift() as GameEvent;
        this.emittedCount++;
        this.record(event);
        this.deliver(event);
      }
    } finally {
      this.dispatching = false;
    }
  }

  private deliver(event: GameEvent): void {
    const specific = this.subscriptions.get(event.type);
    if (specific && specific.length > 0) {
      for (const subscription of specific.slice()) {
        if (!subscription.active) continue;
        if (subscription.once) {
          subscription.active = false;
          const index = specific.indexOf(subscription);
          if (index >= 0) specific.splice(index, 1);
        }
        this.invoke(subscription, event);
      }
    }
    for (const subscription of this.wildcard.slice()) {
      if (!subscription.active) continue;
      this.invoke(subscription, event);
    }
  }

  private invoke(subscription: Subscription, event: GameEvent): void {
    try {
      subscription.handler(event);
    } catch (error) {
      this.onHandlerError(error, event.type);
    }
  }

  private record(event: GameEvent): void {
    this.history.push(event);
    if (this.history.length > this.historyLimit) {
      this.history.splice(0, this.history.length - this.historyLimit);
    }
  }

  /** Derniers événements émis (outil de debug — Tome XXII, console développeur). */
  recentEvents(limit = 32): GameEvent[] {
    return this.history.slice(Math.max(0, this.history.length - limit));
  }

  get totalEmitted(): number {
    return this.emittedCount;
  }

  /** Nombre d'abonnés actifs, tous types confondus. */
  get listenerCount(): number {
    let count = this.wildcard.length;
    for (const list of this.subscriptions.values()) count += list.length;
    return count;
  }

  /** Supprime tous les abonnements et vide la file (rechargement de sauvegarde). */
  clear(): void {
    this.subscriptions.clear();
    this.wildcard.length = 0;
    this.queue.length = 0;
    this.history.length = 0;
  }
}
