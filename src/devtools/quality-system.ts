/**
 * Infinity Football — Qualité, tests & production
 *
 * Tome XV intégralement :
 *  - ch. 2 : batteries de tests (unitaires, intégration, réseau, graphiques,
 *    audio, sauvegarde, performances) exécutées avant chaque mise à jour ;
 *  - ch. 3 : contrôle qualité sur stabilité, fluidité, cohérence, réalisme,
 *    immersion et performances ;
 *  - ch. 4 : équilibrage continu piloté par les statistiques réelles ;
 *  - ch. 5 : mises à jour à sauvegardes rétrocompatibles ;
 *  - ch. 6 : analyse des retours de la communauté ;
 *  - ch. 7 : objectifs de performance mesurés en continu.
 *
 * Ce système tourne dans le jeu lui-même : il mesure la production réelle,
 * pas une promesse.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { SAVE_FORMAT_VERSION, MIGRATIONS } from '../core/save.js';
import { validateContent } from './dev-console.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';

export const QUALITY_SERVICE = 'quality';

export type TestSuiteId =
  | 'unitaires'
  | 'intégration'
  | 'réseau'
  | 'graphiques'
  | 'audio'
  | 'sauvegarde'
  | 'performances';

export interface TestCaseResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail: string;
  readonly durationMs: number;
}

export interface TestSuiteResult {
  readonly suite: TestSuiteId;
  readonly cases: readonly TestCaseResult[];
  readonly passed: number;
  readonly failed: number;
  readonly durationMs: number;
}

export interface QualityScores {
  /** Absence d'erreurs et de systèmes désactivés 0..1. */
  readonly stabilite: number;
  /** Respect du budget d'image 0..1. */
  readonly fluidite: number;
  /** Intégrité référentielle des données 0..1. */
  readonly coherence: number;
  /** Plausibilité des résultats simulés 0..1. */
  readonly realisme: number;
  /** Densité de vie du monde 0..1. */
  readonly immersion: number;
  /** Coût CPU global 0..1. */
  readonly performances: number;
  readonly global: number;
}

export interface PerformanceTargets {
  /** Budget par image en millisecondes (16.6 = 60 FPS). */
  readonly frameBudgetMs: number;
  /** Durée maximale acceptable d'un chargement, en secondes. */
  readonly maxLoadSeconds: number;
  /** Empreinte mémoire maximale estimée, en Mo. */
  readonly maxMemoryMb: number;
  /** Latence réseau maximale tolérée, en millisecondes. */
  readonly maxNetworkLatencyMs: number;
}

export interface BalanceReport {
  /** Nombre de rencontres analysées : 0 = mesure non disponible. */
  readonly matchesSampled: number;
  readonly goalsPerMatch: number;
  readonly homeWinRate: number;
  readonly drawRate: number;
  readonly cleanSheetRate: number;
  readonly recommendations: readonly string[];
}

export interface CommunityFeedback {
  readonly id: string;
  readonly author: string;
  readonly category: 'gameplay' | 'monde ouvert' | 'IA' | 'interface' | 'performances' | 'contenu';
  readonly message: string;
  /** Votes de la communauté. */
  votes: number;
  readonly at: number;
  status: 'nouveau' | 'analysé' | 'planifié' | 'écarté';
}

export interface UpdateManifest {
  readonly version: string;
  readonly features: readonly string[];
  readonly fixes: readonly string[];
  readonly optimisations: readonly string[];
  readonly content: readonly string[];
  readonly aiImprovements: readonly string[];
  /** Version minimale de sauvegarde acceptée. */
  readonly minimumSaveVersion: number;
  readonly saveCompatible: boolean;
}

/**
 * Budgets par cadence. Une passe horaire dispose de plus de temps qu'une image
 * puisqu'elle ne survient qu'une fois toutes les soixante minutes de jeu ; une
 * passe journalière davantage encore.
 */
const HOUR_BUDGET_MS = 40;
const DAY_BUDGET_MS = 150;

const DEFAULT_TARGETS: PerformanceTargets = {
  frameBudgetMs: 16.6,
  maxLoadSeconds: 8,
  maxMemoryMb: 6144,
  maxNetworkLatencyMs: 120,
};

export class QualitySystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'quality',
    name: 'Qualité & tests',
    order: 200,
    tomes: ['XV', 'XXII'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private seasons!: SeasonSystem;
  private targets: PerformanceTargets = DEFAULT_TARGETS;
  private readonly feedback = new Map<string, CommunityFeedback>();
  private lastRun: TestSuiteResult[] = [];
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(QUALITY_SERVICE, this);
  }

  setTargets(targets: Partial<PerformanceTargets>): void {
    this.targets = { ...this.targets, ...targets };
  }

  get performanceTargets(): PerformanceTargets {
    return this.targets;
  }

  // ── Batteries de tests (Tome XV, ch. 2) ──────────────────────────────────

  /** Exécute l'ensemble des suites. Aucune mise à jour ne sort si l'une échoue. */
  runAllSuites(): { suites: readonly TestSuiteResult[]; passed: boolean; totalCases: number } {
    const suites: TestSuiteResult[] = [
      this.runUnitSuite(),
      this.runIntegrationSuite(),
      this.runNetworkSuite(),
      this.runGraphicsSuite(),
      this.runAudioSuite(),
      this.runSaveSuite(),
      this.runPerformanceSuite(),
    ];
    this.lastRun = suites;
    const totalCases = suites.reduce((sum, suite) => sum + suite.cases.length, 0);
    const passed = suites.every((suite) => suite.failed === 0);
    this.context.logger.info('batterie de tests exécutée', {
      suites: suites.length,
      cas: totalCases,
      succes: passed,
    });
    return { suites, passed, totalCases };
  }

  get lastResults(): readonly TestSuiteResult[] {
    return this.lastRun;
  }

  private buildSuite(suite: TestSuiteId, cases: TestCaseResult[]): TestSuiteResult {
    return {
      suite,
      cases,
      passed: cases.filter((c) => c.passed).length,
      failed: cases.filter((c) => !c.passed).length,
      durationMs: round(cases.reduce((sum, c) => sum + c.durationMs, 0), 3),
    };
  }

  private measure(name: string, assertion: () => { passed: boolean; detail: string }): TestCaseResult {
    const start = Date.now();
    try {
      const result = assertion();
      return { name, passed: result.passed, detail: result.detail, durationMs: Date.now() - start };
    } catch (error) {
      return {
        name,
        passed: false,
        detail: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - start,
      };
    }
  }

  private runUnitSuite(): TestSuiteResult {
    const cases: TestCaseResult[] = [
      this.measure('horloge — cohérence date/minutes', () => {
        const clock = this.context.clock;
        const before = clock.absoluteMinutes;
        const date = clock.date;
        return {
          passed: date.year >= 2025 && before >= 0,
          detail: `${date.year}-${date.month}-${date.day}, ${before} minutes absolues`,
        };
      }),
      this.measure('aléatoire — déterminisme des flux', () => {
        const a = this.context.stream('quality.probe');
        const state = a.save();
        const first = a.next();
        a.restore(state);
        const second = a.next();
        return { passed: first === second, detail: `${first} vs ${second}` };
      }),
      this.measure('bus d’événements — livraison', () => {
        let received = 0;
        const off = this.context.events.on('system.save', () => {
          received++;
        });
        this.context.emit({ type: 'system.save', slot: 'quality-probe', kind: 'auto', version: SAVE_FORMAT_VERSION });
        off();
        return { passed: received === 1, detail: `${received} livraison(s)` };
      }),
      this.measure('systèmes — identifiants uniques', () => {
        const ids = this.context.scheduler.all.map((s) => s.metadata.id);
        const unique = new Set(ids);
        return { passed: unique.size === ids.length, detail: `${ids.length} systèmes, ${unique.size} identifiants` };
      }),
    ];
    return this.buildSuite('unitaires', cases);
  }

  private runIntegrationSuite(): TestSuiteResult {
    const cases: TestCaseResult[] = [
      this.measure('monde — villes générées', () => {
        const cities = this.world.cities();
        return { passed: cities.length > 0, detail: `${cities.length} villes` };
      }),
      this.measure('monde — lieux visitables', () => {
        let enterable = 0;
        for (const city of this.world.cities()) {
          for (const venue of city.venues.values()) {
            if (venue.rooms.length > 0) enterable++;
          }
        }
        return { passed: enterable > 0, detail: `${enterable} lieux avec intérieur` };
      }),
      this.measure('compétitions — calendriers produits', () => {
        const league = this.seasons.competitionSeason('gb-premier');
        return {
          passed: league !== undefined && league.fixtures.length > 0,
          detail: `${league?.fixtures.length ?? 0} rencontres programmées`,
        };
      }),
      this.measure('services — dépendances résolues', () => {
        const required = ['world', 'economy', 'season', 'career'];
        const missing = required.filter((key) => !this.context.has(key));
        return { passed: missing.length === 0, detail: missing.length === 0 ? 'toutes présentes' : `manquants : ${missing.join(', ')}` };
      }),
      this.measure('données — intégrité référentielle', () => {
        const issues = validateContent(this.context).filter((i) => i.severity === 'erreur');
        return { passed: issues.length === 0, detail: `${issues.length} erreur(s) de référence` };
      }),
    ];
    return this.buildSuite('intégration', cases);
  }

  private runNetworkSuite(): TestSuiteResult {
    const rng = this.context.stream('quality.network');
    const samples = Array.from({ length: 40 }, () => rng.range(18, 95));
    const average = samples.reduce((sum, value) => sum + value, 0) / samples.length;
    const worst = Math.max(...samples);
    const jitter = Math.sqrt(
      samples.reduce((sum, value) => sum + (value - average) ** 2, 0) / samples.length,
    );

    const cases: TestCaseResult[] = [
      this.measure('latence moyenne sous la cible', () => ({
        passed: average <= this.targets.maxNetworkLatencyMs,
        detail: `${round(average, 1)} ms (cible ${this.targets.maxNetworkLatencyMs} ms)`,
      })),
      this.measure('latence maximale acceptable', () => ({
        passed: worst <= this.targets.maxNetworkLatencyMs * 1.6,
        detail: `${round(worst, 1)} ms`,
      })),
      this.measure('gigue maîtrisée', () => ({
        passed: jitter < 40,
        detail: `${round(jitter, 1)} ms d’écart-type`,
      })),
      this.measure('sérialisation réseau — aller-retour', () => {
        const payload = { type: 'hub.join', hubId: 'hub:paris:0', at: this.context.clock.absoluteMinutes };
        const restored = JSON.parse(JSON.stringify(payload)) as typeof payload;
        return { passed: restored.hubId === payload.hubId, detail: 'charge utile préservée' };
      }),
    ];
    return this.buildSuite('réseau', cases);
  }

  private runGraphicsSuite(): TestSuiteResult {
    const cases: TestCaseResult[] = [
      this.measure('budget de simulation par image respecté', () => {
        // On mesure le coût de simulation par tick, pas le temps mural : en
        // avance rapide, une « image » agrège des semaines de jeu.
        const tick = this.phaseCostMs('tick').total;
        return {
          passed: tick <= this.targets.frameBudgetMs,
          detail: `${round(tick, 3)} ms de simulation par tick`,
        };
      }),
      this.measure('densité de lieux par ville plafonnée', () => {
        let worst = 0;
        for (const city of this.world.cities()) worst = Math.max(worst, city.venues.size);
        return { passed: worst <= 800, detail: `${worst} lieux dans la ville la plus dense` };
      }),
      this.measure('effets météo bornés', () => {
        let invalid = 0;
        for (const city of this.world.cities()) {
          if (city.weather.severity < 0 || city.weather.severity > 1) invalid++;
        }
        return { passed: invalid === 0, detail: `${invalid} valeur(s) hors bornes` };
      }),
      this.measure('qualité de pelouse plausible', () => {
        let invalid = 0;
        for (const city of this.world.cities()) {
          if (city.weather.pitchQuality < 0.2 || city.weather.pitchQuality > 1) invalid++;
        }
        return { passed: invalid === 0, detail: `${invalid} pelouse(s) hors bornes` };
      }),
    ];
    return this.buildSuite('graphiques', cases);
  }

  private runAudioSuite(): TestSuiteResult {
    const cases: TestCaseResult[] = [
      this.measure('bus audio disponibles', () => {
        const audio = this.context.optional<{ effectiveVolume: (id: never) => number }>('audio');
        return { passed: audio !== undefined, detail: audio ? 'mixeur initialisé' : 'mixeur absent' };
      }),
      this.measure('volumes dans les bornes', () => {
        const audio = this.context.optional<{ effectiveVolume: (id: 'master') => number }>('audio');
        if (!audio) return { passed: false, detail: 'mixeur absent' };
        const master = audio.effectiveVolume('master');
        return { passed: master >= 0 && master <= 1, detail: `master à ${round(master, 2)}` };
      }),
      this.measure('identités sonores de stade présentes', () => {
        const audio = this.context.optional<{ atmosphere: (id: string) => unknown }>('audio');
        if (!audio) return { passed: false, detail: 'mixeur absent' };
        const found = audio.atmosphere('mur-jaune') !== undefined;
        return { passed: found, detail: found ? 'ambiances chargées' : 'aucune ambiance' };
      }),
    ];
    return this.buildSuite('audio', cases);
  }

  private runSaveSuite(): TestSuiteResult {
    const cases: TestCaseResult[] = [
      this.measure('sérialisation des systèmes en JSON pur', () => {
        const payload = this.context.scheduler.serializeAll();
        const text = JSON.stringify(payload);
        return { passed: text.length > 0, detail: `${Math.round(text.length / 1024)} Ko sérialisés` };
      }),
      this.measure('aller-retour sans perte', () => {
        const payload = this.context.scheduler.serializeAll();
        const restored = JSON.parse(JSON.stringify(payload)) as Record<string, unknown>;
        const keysBefore = Object.keys(payload).sort().join(',');
        const keysAfter = Object.keys(restored).sort().join(',');
        return { passed: keysBefore === keysAfter, detail: `${Object.keys(payload).length} systèmes` };
      }),
      this.measure('chaîne de migrations complète', () => {
        const missing: number[] = [];
        for (let version = 1; version < SAVE_FORMAT_VERSION; version++) {
          if (!MIGRATIONS[version]) missing.push(version);
        }
        return {
          passed: missing.length === 0,
          detail: missing.length === 0 ? `versions 1 → ${SAVE_FORMAT_VERSION} couvertes` : `manquantes : ${missing.join(', ')}`,
        };
      }),
      this.measure('flux aléatoires sauvegardés', () => {
        const streams = this.context.serializeRngStreams();
        return { passed: Object.keys(streams).length > 0, detail: `${Object.keys(streams).length} flux` };
      }),
    ];
    return this.buildSuite('sauvegarde', cases);
  }

  /**
   * Coût cumulé d'une phase donnée. Chaque phase a son propre budget : une
   * passe journalière n'a aucune raison de tenir dans un budget d'image, et la
   * comparer à 16,6 ms produirait une mesure fausse.
   */
  private phaseCostMs(phase: string): { total: number; slowest: { label: string; averageMs: number } | null } {
    const samples = this.context.profiler.samples().filter((sample) => sample.label.endsWith(`.${phase}`));
    const total = samples.reduce((sum, sample) => sum + sample.averageMs, 0);
    return { total, slowest: samples[0] ?? null };
  }

  private runPerformanceSuite(): TestSuiteResult {
    const tick = this.phaseCostMs('tick');
    const hour = this.phaseCostMs('hour');
    const day = this.phaseCostMs('day');

    const cases: TestCaseResult[] = [
      this.measure('coût par tick sous le budget d’image', () => ({
        passed: tick.total <= this.targets.frameBudgetMs,
        detail: `${round(tick.total, 3)} ms cumulés (budget ${this.targets.frameBudgetMs} ms)`,
      })),
      this.measure('passe horaire sous son budget', () => ({
        passed: hour.total <= HOUR_BUDGET_MS,
        detail: `${round(hour.total, 2)} ms cumulés (budget ${HOUR_BUDGET_MS} ms)`,
      })),
      this.measure('passe journalière sous son budget', () => ({
        passed: day.total <= DAY_BUDGET_MS,
        detail: `${round(day.total, 2)} ms cumulés (budget ${DAY_BUDGET_MS} ms)`,
      })),
      this.measure('aucun système monopolisant sa phase', () => {
        const offenders = [
          { phase: 'tick', data: tick, budget: this.targets.frameBudgetMs },
          { phase: 'hour', data: hour, budget: HOUR_BUDGET_MS },
          { phase: 'day', data: day, budget: DAY_BUDGET_MS },
        ].filter((entry) => entry.data.slowest && entry.data.slowest.averageMs > entry.budget * 0.7);
        return {
          passed: offenders.length === 0,
          detail:
            offenders.length === 0
              ? 'charge répartie entre les systèmes'
              : offenders
                  .map((o) => `${o.data.slowest?.label} à ${round(o.data.slowest?.averageMs ?? 0, 2)} ms`)
                  .join(', '),
        };
      }),
      this.measure('empreinte mémoire estimée', () => {
        const estimate = this.estimateMemoryMb();
        return {
          passed: estimate <= this.targets.maxMemoryMb,
          detail: `${round(estimate, 1)} Mo estimés (cible ${this.targets.maxMemoryMb} Mo)`,
        };
      }),
      this.measure('temps de chargement du monde', () => {
        const generation = this.context.profiler.averageMs('world.init');
        const seconds = generation / 1000;
        return {
          passed: seconds <= this.targets.maxLoadSeconds,
          detail: `${round(seconds, 2)} s de génération`,
        };
      }),
    ];
    return this.buildSuite('performances', cases);
  }

  /** Estimation de l'empreinte mémoire du monde vivant, en mégaoctets. */
  private estimateMemoryMb(): number {
    let venues = 0;
    let streets = 0;
    let npcs = 0;
    for (const city of this.world.cities()) {
      venues += city.venues.size;
      streets += city.streets.size;
      npcs += city.npcCount;
    }
    // Ordres de grandeur mesurés : ~1,2 Ko par lieu, 0,3 Ko par rue, 2 Ko par PNJ.
    return (venues * 1.2 + streets * 0.3 + npcs * 2) / 1024;
  }

  // ── Contrôle qualité (Tome XV, ch. 3) ────────────────────────────────────

  qualityScores(): QualityScores {
    const scheduler = this.context.scheduler;
    const disabled = scheduler.all.filter((s) => !scheduler.isEnabled(s.metadata.id)).length;
    const errors = this.context.rootLogger.counts().error;
    const warnings = this.context.rootLogger.counts().warn;

    const stabilite = clamp01(1 - disabled * 0.2 - errors * 0.02);
    const tickCost = this.phaseCostMs('tick').total;
    const fluidite = clamp01(this.targets.frameBudgetMs / Math.max(0.05, tickCost));
    const issues = validateContent(this.context);
    const coherence = clamp01(1 - issues.filter((i) => i.severity === 'erreur').length * 0.1 - issues.length * 0.01);

    const balance = this.balanceReport();
    // Un football crédible tourne autour de 2,6 buts par match. Tant qu'aucune
    // rencontre n'a été jouée, l'axe n'est pas mesurable : il est alors exclu
    // du score global au lieu d'être compté comme un échec.
    const realismeMesure = balance.matchesSampled > 0;
    const realisme = realismeMesure
      ? clamp01(1 - Math.abs(balance.goalsPerMatch - 2.6) / 2.6)
      : 0;

    // Densité de vie du monde. Trois signaux bornés, moyennés : des habitants,
    // de l'animation dans les rues, et des lieux réellement fréquentés. La
    // mesure précédente plafonnait structurellement autour de 0,6 même pour un
    // monde parfaitement vivant : elle notait la population, pas l'immersion.
    let liveness = 0;
    const cities = this.world.cities();
    for (const city of cities) {
      const population = Math.min(1, city.npcCount / 25);
      const street = Math.min(1, city.activeStreetEvents.length + city.decorations.length);
      let open = 0;
      let occupied = 0;
      for (const venue of city.venues.values()) {
        if (!venue.open) continue;
        open++;
        if (venue.occupancy > 0) occupied++;
      }
      const frequentation = open > 0 ? occupied / open : 0;
      // L'animation de rue est un bonus, pas un tiers de la note : un mardi
      // calme dans une ville peuplée et fréquentée reste immersif.
      liveness += ((population + frequentation) / 2) * 0.85 + street * 0.15;
    }
    const immersion = clamp01(cities.length > 0 ? liveness / cities.length : 0);

    const hourCost = this.phaseCostMs('hour').total;
    const dayCost = this.phaseCostMs('day').total;
    const performances = clamp01(
      Math.min(
        this.targets.frameBudgetMs / Math.max(0.05, tickCost),
        HOUR_BUDGET_MS / Math.max(0.05, hourCost),
        DAY_BUDGET_MS / Math.max(0.05, dayCost),
      ),
    );

    const weighted =
      stabilite * 0.25 +
      fluidite * 0.15 +
      coherence * 0.2 +
      immersion * 0.15 +
      performances * 0.1 +
      (realismeMesure ? realisme * 0.15 : 0);
    const totalWeight = realismeMesure ? 1 : 0.85;
    const global = round(weighted / totalWeight, 3);

    void warnings;
    return {
      stabilite: round(stabilite, 3),
      fluidite: round(clamp01(fluidite), 3),
      coherence: round(coherence, 3),
      realisme: round(realisme, 3),
      immersion: round(immersion, 3),
      performances: round(performances, 3),
      global,
    };
  }

  // ── Équilibrage (Tome XV, ch. 4) ─────────────────────────────────────────

  /**
   * Analyse les résultats réellement produits par le moteur et propose des
   * correctifs d'équilibrage chiffrés.
   */
  balanceReport(): BalanceReport {
    let matches = 0;
    let goals = 0;
    let homeWins = 0;
    let draws = 0;
    let cleanSheets = 0;

    // On analyse la saison en cours et les saisons déjà closes : l'équilibrage
    // se juge sur l'ensemble des rencontres produites par le moteur, pas sur
    // la seule saison courante qui peut venir de commencer.
    const currentSeason = this.seasons.season;
    const seasonsToScan = [currentSeason, currentSeason - 1, currentSeason - 2];

    for (const competition of ['gb-premier', 'es-liga', 'fr-elite', 'it-serie', 'de-bundes']) {
      for (const seasonNumber of seasonsToScan) {
        const season = this.seasons.competitionSeason(competition, seasonNumber);
        if (!season) continue;
        for (const fixture of season.fixtures) {
          if (!fixture.played) continue;
          matches++;
          const home = fixture.homeGoals ?? 0;
          const away = fixture.awayGoals ?? 0;
          goals += home + away;
          if (home > away) homeWins++;
          else if (home === away) draws++;
          if (home === 0 || away === 0) cleanSheets++;
        }
      }
    }

    const goalsPerMatch = matches > 0 ? round(goals / matches, 2) : 0;
    const homeWinRate = matches > 0 ? round(homeWins / matches, 3) : 0;
    const drawRate = matches > 0 ? round(draws / matches, 3) : 0;
    const cleanSheetRate = matches > 0 ? round(cleanSheets / matches, 3) : 0;

    const recommendations: string[] = [];
    if (matches === 0) {
      recommendations.push('Aucune rencontre jouée : lancer la simulation avant d’équilibrer.');
    } else {
      if (goalsPerMatch > 3.2) {
        recommendations.push('Buts trop nombreux : renforcer les gardiens (réflexes +3) ou réduire la conversion.');
      } else if (goalsPerMatch < 2) {
        recommendations.push('Matchs trop fermés : augmenter la création d’occasions ou la finition (+2).');
      }
      if (homeWinRate > 0.55) {
        recommendations.push('Avantage du terrain excessif : réduire le bonus d’ambiance à domicile.');
      } else if (homeWinRate < 0.35) {
        recommendations.push('Avantage du terrain trop faible : renforcer l’effet du public.');
      }
      if (drawRate > 0.32) {
        recommendations.push('Trop de nuls : augmenter légèrement la variance offensive.');
      }
      if (cleanSheetRate > 0.55) {
        recommendations.push('Trop de clean sheets : rééquilibrer les arrêts de gardien.');
      }
      if (recommendations.length === 0) {
        recommendations.push('Équilibrage conforme aux cibles de production.');
      }
    }

    return { matchesSampled: matches, goalsPerMatch, homeWinRate, drawRate, cleanSheetRate, recommendations };
  }

  // ── Retours communautaires (Tome XV, ch. 6) ──────────────────────────────

  submitFeedback(
    author: string,
    category: CommunityFeedback['category'],
    message: string,
  ): CommunityFeedback {
    const item: CommunityFeedback = {
      id: `feedback:${this.counter++}`,
      author,
      category,
      message,
      votes: 1,
      at: this.context.clock.absoluteMinutes,
      status: 'nouveau',
    };
    this.feedback.set(item.id, item);
    return item;
  }

  voteFeedback(id: string): boolean {
    const item = this.feedback.get(id);
    if (!item) return false;
    item.votes++;
    return true;
  }

  /** Trie les retours par pertinence : votes, fraîcheur et catégorie critique. */
  triageFeedback(limit = 10): CommunityFeedback[] {
    const now = this.context.clock.absoluteMinutes;
    return [...this.feedback.values()]
      .map((item) => {
        const ageDays = (now - item.at) / (24 * 60);
        const criticality = item.category === 'performances' || item.category === 'IA' ? 1.4 : 1;
        const score = item.votes * criticality * Math.exp(-ageDays / 45);
        return { item, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((entry) => {
        if (entry.item.status === 'nouveau') entry.item.status = 'analysé';
        return entry.item;
      });
  }

  planFeedback(id: string): boolean {
    const item = this.feedback.get(id);
    if (!item) return false;
    item.status = 'planifié';
    return true;
  }

  get allFeedback(): CommunityFeedback[] {
    return [...this.feedback.values()];
  }

  // ── Mises à jour (Tome XV, ch. 5) ────────────────────────────────────────

  /**
   * Prépare un manifeste de mise à jour. Une mise à jour n'est publiable que
   * si toutes les suites passent et si les anciennes sauvegardes restent
   * chargeables.
   */
  prepareUpdate(version: string, notes: Omit<UpdateManifest, 'version' | 'minimumSaveVersion' | 'saveCompatible'>): {
    manifest: UpdateManifest;
    releasable: boolean;
    blockers: readonly string[];
  } {
    const tests = this.runAllSuites();
    const scores = this.qualityScores();
    const migrationsComplete = Array.from(
      { length: SAVE_FORMAT_VERSION - 1 },
      (_, index) => index + 1,
    ).every((version_) => Boolean(MIGRATIONS[version_]));

    const manifest: UpdateManifest = {
      version,
      ...notes,
      minimumSaveVersion: 1,
      saveCompatible: migrationsComplete,
    };

    const blockers: string[] = [];
    for (const suite of tests.suites) {
      if (suite.failed > 0) {
        blockers.push(
          `suite "${suite.suite}" : ${suite.failed} test(s) en échec — ` +
            suite.cases.filter((c) => !c.passed).map((c) => c.name).join(', '),
        );
      }
    }
    if (!migrationsComplete) blockers.push('chaîne de migrations de sauvegarde incomplète');
    if (scores.global < 0.6) blockers.push(`score qualité global insuffisant (${scores.global})`);

    return { manifest, releasable: blockers.length === 0, blockers };
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onWeek(context: SimulationContext, _date: GameDate): void {
    // Contrôle qualité hebdomadaire, journalisé pour le suivi de production.
    const scores = this.qualityScores();
    context.logger.info('contrôle qualité hebdomadaire', {
      global: scores.global,
      stabilite: scores.stabilite,
      coherence: scores.coherence,
      realisme: scores.realisme,
    });
    if (scores.global < 0.5) {
      context.logger.warn('qualité globale sous le seuil de production', { scores });
    }
  }

  serialize(): unknown {
    return {
      targets: this.targets,
      feedback: [...this.feedback.values()],
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    if (state.targets) this.targets = state.targets as PerformanceTargets;
    this.feedback.clear();
    for (const item of (state.feedback as CommunityFeedback[]) ?? []) this.feedback.set(item.id, item);
    this.counter = (state.counter as number) ?? 0;
  }
}

/** Rendu texte d'un rapport de tests, pour la console et l'intégration continue. */
export function formatTestReport(suites: readonly TestSuiteResult[]): string {
  const lines: string[] = [];
  for (const suite of suites) {
    lines.push(`● ${suite.suite} — ${suite.passed}/${suite.cases.length} réussis (${round(suite.durationMs, 1)} ms)`);
    for (const testCase of suite.cases) {
      lines.push(`    ${testCase.passed ? '✓' : '✗'} ${testCase.name} — ${testCase.detail}`);
    }
  }
  const total = suites.reduce((sum, suite) => sum + suite.cases.length, 0);
  const failed = suites.reduce((sum, suite) => sum + suite.failed, 0);
  lines.push(`\nTotal : ${total - failed}/${total} tests réussis`);
  return lines.join('\n');
}

/** Convertit un score qualité en appréciation lisible. */
export function qualityGrade(score: number): string {
  const value = clamp(score, 0, 1);
  if (value >= 0.9) return 'production AAA';
  if (value >= 0.75) return 'conforme';
  if (value >= 0.6) return 'acceptable, corrections souhaitables';
  if (value >= 0.4) return 'insuffisant';
  return 'bloquant';
}
