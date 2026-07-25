/**
 * Monitoring du AI Core Engine — compteurs d'appels, erreurs et latences par
 * moteur/action. Alimente /api/ai/core/health. Sans dépendance.
 */
class Metrics {
  constructor() { this.started = Date.now(); this.byKey = new Map(); }

  record(engine, action, ms, isError) {
    const key = `${engine}.${action}`;
    let m = this.byKey.get(key);
    if (!m) { m = { engine, action, calls: 0, errors: 0, totalMs: 0, maxMs: 0 }; this.byKey.set(key, m); }
    m.calls += 1;
    if (isError) m.errors += 1;
    m.totalMs += ms;
    if (ms > m.maxMs) m.maxMs = ms;
  }

  snapshot() {
    const engines = [...this.byKey.values()].map((m) => ({
      engine: m.engine, action: m.action, calls: m.calls, errors: m.errors,
      avgMs: m.calls ? Math.round(m.totalMs / m.calls) : 0, maxMs: m.maxMs,
    })).sort((a, b) => b.calls - a.calls);
    const totalCalls = engines.reduce((s, e) => s + e.calls, 0);
    const totalErrors = engines.reduce((s, e) => s + e.errors, 0);
    return {
      uptimeSec: Math.round((Date.now() - this.started) / 1000),
      totalCalls, totalErrors,
      errorRatePct: totalCalls ? Math.round((totalErrors / totalCalls) * 1000) / 10 : 0,
      actions: engines,
    };
  }
}

module.exports = { Metrics };
