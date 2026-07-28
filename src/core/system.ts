/**
 * Infinity Football — Core / Contrat des systèmes & ordonnanceur
 *
 * Chaque système du jeu (monde, IA, économie, médias, carrière…) est
 * indépendant et s'enregistre auprès de l'ordonnanceur. Il expose des points
 * d'entrée optionnels selon sa cadence naturelle : la météo change à l'heure,
 * la presse publie chaque matin, les investissements se calculent chaque mois.
 *
 * Cette structure répond au Tome XXII : ajouter un système ne doit jamais
 * casser les autres, et une sauvegarde ancienne doit rester chargeable.
 */

import type { GameDate, Season } from './clock.js';
import type { SimulationContext } from './context.js';

export type SystemCadence = 'realtime' | 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year';

export interface SystemMetadata {
  /** Identifiant stable, utilisé comme clé de sauvegarde. */
  readonly id: string;
  /** Nom lisible affiché dans la console de développement. */
  readonly name: string;
  /** Ordre d'exécution croissant à cadence égale (déterminisme). */
  readonly order: number;
  /** Tomes du GDD couverts par ce système. */
  readonly tomes: readonly string[];
}

export interface GameSystem {
  readonly metadata: SystemMetadata;
  /** Appelé une fois, après enregistrement de tous les systèmes. */
  init?(context: SimulationContext): void;
  /** Appelé à chaque frame de simulation avec le delta en minutes de jeu. */
  onTick?(context: SimulationContext, deltaMinutes: number): void;
  onHour?(context: SimulationContext, date: GameDate): void;
  onDay?(context: SimulationContext, date: GameDate): void;
  onWeek?(context: SimulationContext, date: GameDate): void;
  onMonth?(context: SimulationContext, date: GameDate): void;
  onSeason?(context: SimulationContext, season: Season, date: GameDate): void;
  onYear?(context: SimulationContext, date: GameDate): void;
  /** État sérialisable du système (doit être du JSON pur). */
  serialize?(): unknown;
  /** Restaure l'état ; reçoit `undefined` si la sauvegarde est antérieure. */
  deserialize?(data: unknown): void;
  /** Libère les ressources (rechargement de partie). */
  dispose?(): void;
}

/** Base pratique : fournit les métadonnées et des hooks vides supprimables. */
export abstract class BaseSystem implements GameSystem {
  abstract readonly metadata: SystemMetadata;
}

export interface SchedulerStats {
  readonly systemCount: number;
  readonly ticks: number;
  readonly slowestSystem: string | null;
  readonly slowestMs: number;
}

/**
 * Ordonnanceur déterministe.
 *
 * - trie les systèmes par `order` ;
 * - propage les paliers temporels de l'horloge ;
 * - mesure chaque système via le profileur ;
 * - isole les exceptions : un système en erreur est désactivé plutôt que de
 *   faire tomber la simulation entière (Tome XV — stabilité).
 */
export class SystemScheduler {
  private readonly systems: GameSystem[] = [];
  private readonly disabled = new Set<string>();
  private readonly failures = new Map<string, number>();
  private tickCount = 0;
  private initialised = false;

  register(system: GameSystem): void {
    if (this.systems.some((s) => s.metadata.id === system.metadata.id)) {
      throw new Error(`SystemScheduler: système déjà enregistré "${system.metadata.id}"`);
    }
    this.systems.push(system);
    this.systems.sort((a, b) => a.metadata.order - b.metadata.order);
  }

  get all(): readonly GameSystem[] {
    return this.systems;
  }

  get(id: string): GameSystem | undefined {
    return this.systems.find((s) => s.metadata.id === id);
  }

  isEnabled(id: string): boolean {
    return !this.disabled.has(id);
  }

  setEnabled(id: string, enabled: boolean): void {
    if (enabled) this.disabled.delete(id);
    else this.disabled.add(id);
  }

  init(context: SimulationContext): void {
    if (this.initialised) return;
    this.initialised = true;
    for (const system of this.systems) {
      this.run(context, system, 'init', () => system.init?.(context));
    }
  }

  tick(context: SimulationContext, deltaMinutes: number): void {
    this.tickCount++;
    for (const system of this.systems) {
      if (!system.onTick) continue;
      this.run(context, system, 'tick', () => system.onTick?.(context, deltaMinutes));
    }
  }

  fireHour(context: SimulationContext, date: GameDate): void {
    this.dispatch(context, 'hour', (system) => system.onHour?.(context, date));
  }

  fireDay(context: SimulationContext, date: GameDate): void {
    this.dispatch(context, 'day', (system) => system.onDay?.(context, date));
  }

  fireWeek(context: SimulationContext, date: GameDate): void {
    this.dispatch(context, 'week', (system) => system.onWeek?.(context, date));
  }

  fireMonth(context: SimulationContext, date: GameDate): void {
    this.dispatch(context, 'month', (system) => system.onMonth?.(context, date));
  }

  fireSeason(context: SimulationContext, season: Season, date: GameDate): void {
    this.dispatch(context, 'season', (system) => system.onSeason?.(context, season, date));
  }

  fireYear(context: SimulationContext, date: GameDate): void {
    this.dispatch(context, 'year', (system) => system.onYear?.(context, date));
  }

  private dispatch(
    context: SimulationContext,
    phase: string,
    invoke: (system: GameSystem) => void,
  ): void {
    for (const system of this.systems) {
      this.run(context, system, phase, () => invoke(system));
    }
  }

  private run(
    context: SimulationContext,
    system: GameSystem,
    phase: string,
    fn: () => void,
  ): void {
    if (this.disabled.has(system.metadata.id)) return;
    const label = `${system.metadata.id}.${phase}`;
    try {
      context.profiler.measure(label, fn);
    } catch (error) {
      const count = (this.failures.get(system.metadata.id) ?? 0) + 1;
      this.failures.set(system.metadata.id, count);
      context.logger.error(`système "${system.metadata.id}" en échec (${phase})`, {
        error: error instanceof Error ? error.message : String(error),
        occurrences: count,
      });
      if (count >= 5) {
        this.disabled.add(system.metadata.id);
        context.logger.error(
          `système "${system.metadata.id}" désactivé après ${count} erreurs consécutives`,
        );
      }
    }
  }

  /** Collecte l'état sérialisable de tous les systèmes. */
  serializeAll(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const system of this.systems) {
      if (!system.serialize) continue;
      result[system.metadata.id] = system.serialize();
    }
    return result;
  }

  /** Restaure l'état ; les systèmes absents de la sauvegarde gardent leur état neuf. */
  deserializeAll(data: Record<string, unknown>): void {
    for (const system of this.systems) {
      if (!system.deserialize) continue;
      system.deserialize(data[system.metadata.id]);
    }
  }

  dispose(): void {
    for (const system of this.systems) system.dispose?.();
    this.systems.length = 0;
    this.disabled.clear();
    this.failures.clear();
    this.initialised = false;
  }

  stats(context: SimulationContext): SchedulerStats {
    const samples = context.profiler.samples();
    const slowest = samples[0];
    return {
      systemCount: this.systems.length,
      ticks: this.tickCount,
      slowestSystem: slowest?.label ?? null,
      slowestMs: slowest?.averageMs ?? 0,
    };
  }
}
