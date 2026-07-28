/**
 * Infinity Football — Core / Profileur
 *
 * Mesure du coût de chaque système par frame (Tome XV, ch. 7 — performances ;
 * Tome XXII, ch. 7 — profils de performances).
 *
 * Le profileur alimente aussi l'ordonnanceur adaptatif : un système trop
 * coûteux voit sa fréquence réduite automatiquement plutôt que de faire chuter
 * la fluidité globale.
 */

export interface ProfileSample {
  readonly label: string;
  readonly lastMs: number;
  readonly averageMs: number;
  readonly peakMs: number;
  readonly calls: number;
  readonly totalMs: number;
}

interface Accumulator {
  lastMs: number;
  peakMs: number;
  calls: number;
  totalMs: number;
  /** Moyenne glissante exponentielle. */
  emaMs: number;
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

export class Profiler {
  private readonly accumulators = new Map<string, Accumulator>();
  private readonly openScopes = new Map<string, number>();
  private frameCount = 0;
  private frameStart = 0;
  private lastFrameMs = 0;
  private frameEmaMs = 16.6;
  private enabled = true;

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  beginFrame(): void {
    if (!this.enabled) return;
    this.frameStart = now();
  }

  endFrame(): void {
    if (!this.enabled) return;
    this.lastFrameMs = now() - this.frameStart;
    this.frameEmaMs = this.frameEmaMs * 0.9 + this.lastFrameMs * 0.1;
    this.frameCount++;
  }

  begin(label: string): void {
    if (!this.enabled) return;
    this.openScopes.set(label, now());
  }

  end(label: string): number {
    if (!this.enabled) return 0;
    const start = this.openScopes.get(label);
    if (start === undefined) return 0;
    this.openScopes.delete(label);
    const elapsed = now() - start;
    this.record(label, elapsed);
    return elapsed;
  }

  /** Mesure une fonction synchrone et retourne son résultat. */
  measure<T>(label: string, fn: () => T): T {
    if (!this.enabled) return fn();
    const start = now();
    try {
      return fn();
    } finally {
      this.record(label, now() - start);
    }
  }

  private record(label: string, elapsedMs: number): void {
    let accumulator = this.accumulators.get(label);
    if (!accumulator) {
      accumulator = { lastMs: 0, peakMs: 0, calls: 0, totalMs: 0, emaMs: elapsedMs };
      this.accumulators.set(label, accumulator);
    }
    accumulator.lastMs = elapsedMs;
    accumulator.peakMs = Math.max(accumulator.peakMs, elapsedMs);
    accumulator.calls++;
    accumulator.totalMs += elapsedMs;
    accumulator.emaMs = accumulator.emaMs * 0.85 + elapsedMs * 0.15;
  }

  /** Coût moyen lissé d'un système, en millisecondes. */
  averageMs(label: string): number {
    return this.accumulators.get(label)?.emaMs ?? 0;
  }

  samples(): ProfileSample[] {
    const result: ProfileSample[] = [];
    for (const [label, acc] of this.accumulators) {
      result.push({
        label,
        lastMs: acc.lastMs,
        averageMs: acc.emaMs,
        peakMs: acc.peakMs,
        calls: acc.calls,
        totalMs: acc.totalMs,
      });
    }
    return result.sort((a, b) => b.averageMs - a.averageMs);
  }

  get frameTimeMs(): number {
    return this.lastFrameMs;
  }

  get smoothedFrameTimeMs(): number {
    return this.frameEmaMs;
  }

  get fps(): number {
    return this.frameEmaMs > 0 ? 1000 / this.frameEmaMs : 0;
  }

  get frames(): number {
    return this.frameCount;
  }

  reset(): void {
    this.accumulators.clear();
    this.openScopes.clear();
    this.frameCount = 0;
    this.lastFrameMs = 0;
    this.frameEmaMs = 16.6;
  }
}
