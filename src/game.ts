/**
 * Infinity Football — Façade du jeu
 *
 * Assemble l'ensemble des systèmes en un monde cohérent et expose l'API que
 * consomment le moteur de rendu, le mode headless et l'interface web.
 *
 * Tome I, mission : « Chaque système doit être connecté aux autres. Le monde
 * doit continuer de vivre même lorsque le joueur n'interagit pas. »
 * Tome XXII : ajouter un système ne demande qu'un enregistrement ici.
 */

import { EventBus } from './core/event-bus.js';
import { Logger } from './core/logger.js';
import { Profiler } from './core/profiler.js';
import { SimulationContext, DEFAULT_WORLD_CONFIG, type WorldConfig } from './core/context.js';
import { SystemScheduler } from './core/system.js';
import {
  MemorySaveStorage,
  SAVE_FORMAT_VERSION,
  createEnvelope,
  loadEnvelope,
  type SaveEnvelope,
  type SaveMeta,
  type SaveStorage,
} from './core/save.js';
import { formatDateFr, formatTimeFr } from './core/clock.js';

import { WorldSystem, WORLD_SERVICE } from './world/world-system.js';
import { NpcSystem, NPC_SERVICE } from './ai/npc.js';
import { EconomySystem, ECONOMY_SERVICE } from './economy/economy-system.js';
import { SeasonSystem, SEASON_SERVICE, type Fixture } from './career/season-system.js';
import { CareerSystem, CAREER_SERVICE } from './career/career-system.js';
import { TravelSystem, TRAVEL_SERVICE } from './transport/travel-system.js';
import { CommerceSystem, COMMERCE_SERVICE } from './commerce/commerce-system.js';
import { LifeSystem, LIFE_SERVICE } from './life/life-system.js';
import { AudioSystem, AUDIO_SERVICE } from './audio/audio-system.js';
import { PhoneSystem, PHONE_SERVICE } from './phone/phone-system.js';
import { MediaSystem, MEDIA_SERVICE } from './media/media-system.js';
import { AnimationSystem, ANIMATION_SERVICE } from './animation/animation-system.js';
import { BoubjackAwardsSystem, AWARDS_SERVICE } from './events/boubjack-awards.js';
import { WorldCalendarSystem, CALENDAR_SERVICE } from './events/world-calendar.js';
import { LegacySystem, LEGACY_SERVICE } from './legacy/legacy-system.js';
import { CinematicSystem, CINEMATIC_SERVICE } from './cinematics/cinematic-system.js';
import { ManagerSystem, MANAGER_SERVICE } from './football/manager-system.js';
import { PresidentSystem, PRESIDENT_SERVICE } from './football/president-system.js';
import { UiSystem, UI_SERVICE } from './ui/ui-system.js';
import { MultiplayerSystem, MULTIPLAYER_SERVICE } from './multiplayer/multiplayer-system.js';
import { QualitySystem, QUALITY_SERVICE } from './devtools/quality-system.js';
import { DevConsole } from './devtools/dev-console.js';
import { MatchOrchestrator, type MatchReport } from './football/match-orchestrator.js';
import type { Position, Foot } from './career/player.js';
import { careerTotals, overallRating } from './career/player.js';

export interface GameOptions extends Partial<WorldConfig> {
  /** Stockage des sauvegardes ; mémoire par défaut. */
  readonly storage?: SaveStorage;
  /** Niveau de journalisation. */
  readonly logLevel?: 'trace' | 'debug' | 'info' | 'warn' | 'error';
  /** Recopie les logs dans la console du process. */
  readonly logToConsole?: boolean;
}

export interface CareerSetup {
  readonly name: string;
  readonly nationality: string;
  readonly position: Position;
  readonly foot?: Foot;
  readonly age?: number;
  readonly backstory?: string;
  readonly photoScan?: boolean;
  readonly startingClubId?: string;
  readonly potential?: number;
}

export interface WorldSnapshot {
  readonly date: string;
  readonly time: string;
  readonly season: number;
  readonly cityCount: number;
  readonly venueCount: number;
  readonly npcCount: number;
  readonly eventsEmitted: number;
  readonly player: {
    readonly name: string;
    readonly age: number;
    readonly club: string | null;
    readonly position: string;
    readonly overall: number;
    readonly reputation: number;
    readonly fame: number;
    readonly marketValue: number;
    readonly form: number;
    readonly fitness: number;
    readonly morale: number;
    readonly goals: number;
    readonly assists: number;
    readonly appearances: number;
    readonly trophies: number;
    readonly awards: number;
    readonly retired: boolean;
    readonly legend: boolean;
  } | null;
  readonly economy: {
    readonly liquidity: number;
    readonly netWorth: number;
    readonly monthlyCommitments: number;
    readonly properties: number;
    readonly vehicles: number;
    readonly investments: number;
  };
  readonly location: {
    readonly cityId: string;
    readonly cityName: string;
    readonly venue: string | null;
    readonly weather: string;
    readonly temperature: number;
    readonly traffic: number;
  };
  readonly headlines: readonly string[];
  readonly quality: {
    readonly global: number;
    readonly stabilite: number;
    readonly coherence: number;
    readonly realisme: number;
    readonly immersion: number;
  };
}

/** Point d'entrée unique du moteur de simulation. */
export class InfinityFootball {
  readonly context: SimulationContext;
  readonly scheduler: SystemScheduler;
  readonly console: DevConsole;
  readonly matches: MatchOrchestrator;

  private readonly storage: SaveStorage;
  private started = false;
  private playtimeMinutes = 0;

  constructor(options: GameOptions = {}) {
    const config: WorldConfig = {
      ...DEFAULT_WORLD_CONFIG,
      ...options,
    };
    this.storage = options.storage ?? new MemorySaveStorage();

    const logger = new Logger({
      minLevel: options.logLevel ?? 'info',
      mirrorToConsole: options.logToConsole ?? false,
    });
    const profiler = new Profiler();
    const events = new EventBus({
      onHandlerError: (error, type) => {
        logger.log('error', 'events', `abonné en échec pour "${type}"`, {
          error: error instanceof Error ? error.message : String(error),
        });
      },
    });

    this.scheduler = new SystemScheduler();
    this.context = new SimulationContext(config, this.scheduler, { logger, profiler, events });

    // Enregistrement dans l'ordre de dépendance ; l'ordonnanceur trie ensuite
    // par `order` pour l'exécution.
    this.scheduler.register(new WorldSystem());
    this.scheduler.register(new NpcSystem());
    this.scheduler.register(new EconomySystem());
    this.scheduler.register(new SeasonSystem());
    this.scheduler.register(new CareerSystem());
    this.scheduler.register(new TravelSystem());
    this.scheduler.register(new CommerceSystem());
    this.scheduler.register(new LifeSystem());
    this.scheduler.register(new AudioSystem());
    this.scheduler.register(new MediaSystem());
    this.scheduler.register(new WorldCalendarSystem());
    this.scheduler.register(new PhoneSystem());
    this.scheduler.register(new AnimationSystem());
    this.scheduler.register(new BoubjackAwardsSystem());
    this.scheduler.register(new LegacySystem());
    this.scheduler.register(new CinematicSystem());
    this.scheduler.register(new ManagerSystem());
    this.scheduler.register(new PresidentSystem());
    this.scheduler.register(new UiSystem());
    this.scheduler.register(new MultiplayerSystem());
    this.scheduler.register(new QualitySystem());

    this.console = new DevConsole(this.context);
    this.matches = new MatchOrchestrator(this.context);
  }

  /** Initialise tous les systèmes : le monde est généré et prêt à vivre. */
  start(): this {
    if (this.started) return this;
    this.context.profiler.measure('world.init', () => {
      this.scheduler.init(this.context);
    });
    this.started = true;
    this.context.logger.info('Infinity Football démarré', {
      graine: this.context.config.seed,
      systemes: this.scheduler.all.length,
    });
    return this;
  }

  // ── Accès typés aux systèmes ─────────────────────────────────────────────

  get world(): WorldSystem {
    return this.context.require<WorldSystem>(WORLD_SERVICE);
  }
  get npcs(): NpcSystem {
    return this.context.require<NpcSystem>(NPC_SERVICE);
  }
  get economy(): EconomySystem {
    return this.context.require<EconomySystem>(ECONOMY_SERVICE);
  }
  get seasons(): SeasonSystem {
    return this.context.require<SeasonSystem>(SEASON_SERVICE);
  }
  get career(): CareerSystem {
    return this.context.require<CareerSystem>(CAREER_SERVICE);
  }
  get travel(): TravelSystem {
    return this.context.require<TravelSystem>(TRAVEL_SERVICE);
  }
  get commerce(): CommerceSystem {
    return this.context.require<CommerceSystem>(COMMERCE_SERVICE);
  }
  get life(): LifeSystem {
    return this.context.require<LifeSystem>(LIFE_SERVICE);
  }
  get audio(): AudioSystem {
    return this.context.require<AudioSystem>(AUDIO_SERVICE);
  }
  get phone(): PhoneSystem {
    return this.context.require<PhoneSystem>(PHONE_SERVICE);
  }
  get media(): MediaSystem {
    return this.context.require<MediaSystem>(MEDIA_SERVICE);
  }
  get animation(): AnimationSystem {
    return this.context.require<AnimationSystem>(ANIMATION_SERVICE);
  }
  get awards(): BoubjackAwardsSystem {
    return this.context.require<BoubjackAwardsSystem>(AWARDS_SERVICE);
  }
  get calendar(): WorldCalendarSystem {
    return this.context.require<WorldCalendarSystem>(CALENDAR_SERVICE);
  }
  get legacy(): LegacySystem {
    return this.context.require<LegacySystem>(LEGACY_SERVICE);
  }
  get cinematics(): CinematicSystem {
    return this.context.require<CinematicSystem>(CINEMATIC_SERVICE);
  }
  get manager(): ManagerSystem {
    return this.context.require<ManagerSystem>(MANAGER_SERVICE);
  }
  get president(): PresidentSystem {
    return this.context.require<PresidentSystem>(PRESIDENT_SERVICE);
  }
  get ui(): UiSystem {
    return this.context.require<UiSystem>(UI_SERVICE);
  }
  get multiplayer(): MultiplayerSystem {
    return this.context.require<MultiplayerSystem>(MULTIPLAYER_SERVICE);
  }
  get quality(): QualitySystem {
    return this.context.require<QualitySystem>(QUALITY_SERVICE);
  }

  // ── Boucle de simulation ─────────────────────────────────────────────────

  /**
   * Avance la simulation d'un pas de temps réel.
   * Retourne le nombre de minutes de jeu écoulées.
   */
  tick(realSeconds: number): number {
    if (!this.started) this.start();
    this.context.profiler.beginFrame();

    const minutes = this.context.clock.advanceRealSeconds(realSeconds, {
      onHour: (date) => this.scheduler.fireHour(this.context, date),
      onDay: (date) => {
        this.scheduler.fireDay(this.context, date);
        this.context.emit({
          type: 'world.dayStarted',
          year: date.year,
          month: date.month,
          day: date.day,
          weekday: date.weekday,
        });
      },
      onWeek: (date) => this.scheduler.fireWeek(this.context, date),
      onMonth: (date) => this.scheduler.fireMonth(this.context, date),
      onSeason: (season, date) => {
        this.scheduler.fireSeason(this.context, season, date);
        this.context.emit({
          type: 'world.seasonChanged',
          season,
          hemisphere: 'north',
        });
      },
      onYear: (date) => this.scheduler.fireYear(this.context, date),
    });

    if (minutes > 0) {
      this.scheduler.tick(this.context, minutes);
      this.playtimeMinutes += minutes;
      this.context.emit({ type: 'world.tick', deltaMinutes: minutes });
    }

    this.context.profiler.endFrame();
    return minutes;
  }

  /** Avance d'un nombre exact de minutes de jeu (avance rapide, sommeil). */
  advanceMinutes(minutes: number): void {
    if (!this.started) this.start();
    const previousScale = this.context.clock.timeScale;
    const wasPaused = this.context.clock.paused;
    this.context.clock.resume();
    this.context.clock.timeScale = 1;
    // On repasse par `tick` afin que tous les paliers soient bien émis.
    this.tick(minutes);
    this.context.clock.timeScale = previousScale;
    if (wasPaused) this.context.clock.pause();
  }

  advanceDays(days: number): void {
    this.advanceMinutes(days * 24 * 60);
  }

  /** Avance jusqu'au prochain match du joueur, sans le jouer. */
  advanceToNextFixture(): Fixture | null {
    const fixture = this.seasons.nextPlayerFixture();
    if (!fixture) return null;
    const delta = fixture.kickoff - this.context.clock.absoluteMinutes;
    if (delta > 0) this.advanceMinutes(delta);
    return fixture;
  }

  // ── Carrière ─────────────────────────────────────────────────────────────

  createCareer(setup: CareerSetup): void {
    if (!this.started) this.start();
    this.career.createCareer(setup);
    this.ui.addObjective('obj:debut', 'Percer en équipe première', 'Disputer dix matchs officiels');
    this.phone.setContext('maison');
  }

  /** Joue le prochain match du joueur et retourne le compte rendu complet. */
  playNextMatch(options: { cinematics?: boolean } = {}): MatchReport | null {
    const fixture = this.advanceToNextFixture();
    if (!fixture) return null;
    return this.matches.play(fixture, {
      cinematics: options.cinematics ?? false,
      ...(this.manager.inCharge ? { playerTactics: this.manager.currentTactics } : {}),
    });
  }

  /** Simule une saison entière : matchs, cérémonie, records, presse. */
  simulateSeason(options: { playMatches?: boolean } = {}): { matchesPlayed: number; reports: MatchReport[] } {
    const reports: MatchReport[] = [];
    const endSeason = this.seasons.season + 1;
    let guard = 0;

    while (this.context.clock.footballSeason < endSeason && guard < 400) {
      guard++;
      if (options.playMatches !== false) {
        const report = this.playNextMatch({ cinematics: false });
        if (report) {
          reports.push(report);
          continue;
        }
      }
      this.advanceDays(7);
    }
    return { matchesPlayed: reports.length, reports };
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────

  private buildMeta(): SaveMeta {
    const hasCareer = this.career.hasCareer;
    const player = hasCareer ? this.career.player : null;
    return {
      seed: this.context.config.seed,
      playerName: player?.identity.name ?? 'sans carrière',
      clubName: player?.clubId ?? 'aucun',
      season: this.seasons.season,
      dateLabel: `${formatDateFr(this.context.clock.date)} — ${formatTimeFr(this.context.clock.date)}`,
      playtimeMinutes: this.playtimeMinutes,
      reputation: player?.reputation ?? 0,
      netWorth: this.economy.netWorth,
    };
  }

  /** Sauvegarde complète : horloge, flux aléatoires et état de chaque système. */
  async save(slot = 'auto', kind: 'manual' | 'auto' | 'cloud' = 'manual'): Promise<SaveEnvelope> {
    const envelope = createEnvelope(slot, kind, this.buildMeta(), {
      clock: this.context.clock.save(),
      rngStreams: this.context.serializeRngStreams(),
      systems: this.scheduler.serializeAll(),
    });
    await this.storage.write(slot, envelope);
    this.multiplayer.registerAutosave(slot, envelope.checksum);
    this.context.emit({ type: 'system.save', slot, kind, version: SAVE_FORMAT_VERSION });
    return envelope;
  }

  /** Charge une sauvegarde, migrations comprises. */
  async load(slot = 'auto'): Promise<boolean> {
    const envelope = await this.storage.read(slot);
    if (!envelope) return false;
    const { payload, migrated } = loadEnvelope(envelope);

    if (!this.started) this.start();
    this.context.clock.restore(payload.clock as ReturnType<SimulationContext['clock']['save']>);
    this.context.restoreRngStreams(payload.rngStreams as never);
    this.scheduler.deserializeAll(payload.systems);

    this.context.logger.info('sauvegarde chargée', { slot, migrée: migrated });
    return true;
  }

  async listSaves(): Promise<string[]> {
    return this.storage.list();
  }

  async deleteSave(slot: string): Promise<void> {
    await this.storage.delete(slot);
  }

  // ── Instantané pour l'interface ──────────────────────────────────────────

  snapshot(): WorldSnapshot {
    const date = this.context.clock.date;
    const cities = this.world.cities();
    let venueCount = 0;
    for (const city of cities) venueCount += city.venues.size;

    const cityId = this.travel.cityId;
    const city = this.world.city(cityId);
    const venueId = this.travel.venueId;
    const venue = venueId ? city.venues.get(venueId) : undefined;

    const hasCareer = this.career.hasCareer;
    const player = hasCareer ? this.career.player : null;
    const totals = player ? careerTotals(player) : null;
    const scores = this.quality.qualityScores();

    return {
      date: formatDateFr(date),
      time: formatTimeFr(date),
      season: this.seasons.season,
      cityCount: cities.length,
      venueCount,
      npcCount: this.npcs.count,
      eventsEmitted: this.context.events.totalEmitted,
      player: player
        ? {
            name: player.identity.name,
            age: player.age,
            club: player.clubId,
            position: player.identity.position,
            overall: Math.round(overallRating(player)),
            reputation: Math.round(player.reputation),
            fame: Math.round(player.fame),
            marketValue: player.marketValue,
            form: Math.round(player.form * 100) / 100,
            fitness: Math.round(player.fitness * 100) / 100,
            morale: Math.round(player.morale * 100) / 100,
            goals: totals?.goals ?? 0,
            assists: totals?.assists ?? 0,
            appearances: totals?.appearances ?? 0,
            trophies: this.career.trophyList.length,
            awards: this.career.awardList.length,
            retired: player.retired,
            legend: this.career.isLegend,
          }
        : null,
      economy: {
        liquidity: this.economy.liquidity,
        netWorth: this.economy.netWorth,
        monthlyCommitments: this.economy.monthlyCommitments,
        properties: this.economy.allProperties.length,
        vehicles: this.economy.garage.length,
        investments: this.economy.activeInvestments.length,
      },
      location: {
        cityId,
        cityName: city.def.name,
        venue: venue?.name ?? null,
        weather: city.weather.condition,
        temperature: city.weather.temperatureC,
        traffic: Math.round(city.traffic * 100) / 100,
      },
      headlines: this.media.frontPage(5).map((article) => `${article.outletName} — ${article.headline}`),
      quality: {
        global: scores.global,
        stabilite: scores.stabilite,
        coherence: scores.coherence,
        realisme: scores.realisme,
        immersion: scores.immersion,
      },
    };
  }

  /** Libère les ressources et arrête la simulation. */
  dispose(): void {
    this.scheduler.dispose();
    this.context.events.clear();
    this.started = false;
  }
}

export { SAVE_FORMAT_VERSION };
export type { MatchReport };
