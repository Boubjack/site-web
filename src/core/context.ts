/**
 * Infinity Football — Core / Contexte de simulation
 *
 * Conteneur de services partagé par tous les systèmes. Il remplace les
 * singletons globaux : chaque partie possède son propre contexte, ce qui rend
 * possible plusieurs mondes simultanés (tests, serveur multijoueur, replays).
 */

import { EventBus } from './event-bus.js';
import { GameClock } from './clock.js';
import { Logger, type ChannelLogger } from './logger.js';
import { Profiler } from './profiler.js';
import { Rng } from './rng.js';
import type { GameEvent, GameEventMap, GameEventType } from './events.js';
import type { GameSystem, SystemScheduler } from './system.js';

export interface WorldConfig {
  /** Graine du monde : deux parties avec la même graine sont identiques. */
  readonly seed: string;
  /** Date de départ de la carrière. */
  readonly startDate: { year: number; month: number; day: number; hour?: number; minute?: number };
  /** Minutes de jeu par seconde réelle. */
  readonly timeScale: number;
  /** Langue des textes générés (commentaires, presse, dialogues). */
  readonly language: 'fr' | 'en' | 'es';
  /** Difficulté globale, influence l'IA adverse et l'économie. */
  readonly difficulty: 'casual' | 'standard' | 'realistic' | 'legendary';
  /** Active la génération procédurale étendue (villes secondaires, PNJ). */
  readonly richWorld: boolean;
}

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  seed: 'infinity-football',
  startDate: { year: 2025, month: 7, day: 1, hour: 8, minute: 0 },
  timeScale: 1,
  language: 'fr',
  difficulty: 'standard',
  richWorld: true,
};

export class SimulationContext {
  readonly config: WorldConfig;
  readonly clock: GameClock;
  readonly events: EventBus;
  readonly profiler: Profiler;
  readonly rootLogger: Logger;
  readonly logger: ChannelLogger;
  readonly rng: Rng;
  readonly scheduler: SystemScheduler;

  private readonly rngStreams = new Map<string, Rng>();
  private readonly services = new Map<string, unknown>();

  constructor(
    config: WorldConfig,
    scheduler: SystemScheduler,
    options: { logger?: Logger; profiler?: Profiler; events?: EventBus } = {},
  ) {
    this.config = config;
    this.scheduler = scheduler;
    this.rootLogger = options.logger ?? new Logger({ minLevel: 'info' });
    this.logger = this.rootLogger.channel('simulation');
    this.profiler = options.profiler ?? new Profiler();
    this.events = options.events ?? new EventBus();
    this.clock = new GameClock(config.startDate, config.timeScale);
    this.rng = new Rng(config.seed);
  }

  /**
   * Flux aléatoire dédié à un système. Deux appels avec le même nom renvoient
   * le même flux : l'aléa d'un système n'influence jamais celui d'un autre.
   */
  stream(name: string): Rng {
    let stream = this.rngStreams.get(name);
    if (!stream) {
      stream = new Rng(`${this.config.seed}::${name}`);
      this.rngStreams.set(name, stream);
    }
    return stream;
  }

  /** Enregistre un service partagé (systèmes, dépôts de données). */
  provide<T>(key: string, service: T): T {
    this.services.set(key, service);
    return service;
  }

  /** Récupère un service ; lève une erreur explicite s'il manque. */
  require<T>(key: string): T {
    const service = this.services.get(key);
    if (service === undefined) {
      throw new Error(`SimulationContext: service manquant "${key}"`);
    }
    return service as T;
  }

  /** Récupère un service optionnel. */
  optional<T>(key: string): T | undefined {
    return this.services.get(key) as T | undefined;
  }

  has(key: string): boolean {
    return this.services.has(key);
  }

  system<T extends GameSystem>(id: string): T {
    const system = this.scheduler.get(id);
    if (!system) throw new Error(`SimulationContext: système introuvable "${id}"`);
    return system as T;
  }

  /** Émet un événement horodaté automatiquement. */
  emit<K extends GameEventType>(
    event: Omit<GameEventMap[K], 'at'> & { type: K; at?: number },
  ): void {
    this.events.emit({
      ...event,
      at: event.at ?? this.clock.absoluteMinutes,
    } as unknown as GameEvent);
  }

  /** Sauvegarde l'état des flux aléatoires (déterminisme après rechargement). */
  serializeRngStreams(): Record<string, ReturnType<Rng['save']>> {
    const result: Record<string, ReturnType<Rng['save']>> = {};
    for (const [name, stream] of this.rngStreams) result[name] = stream.save();
    return result;
  }

  restoreRngStreams(data: Record<string, ReturnType<Rng['save']>> | undefined): void {
    if (!data) return;
    for (const [name, state] of Object.entries(data)) {
      this.stream(name).restore(state);
    }
  }
}
