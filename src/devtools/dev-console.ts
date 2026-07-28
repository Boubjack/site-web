/**
 * Infinity Football — Outils développeurs
 *
 * Tome XXII, ch. 7 : console de développement, système de logs, profils de
 * performances, outils de débogage, éditeur de données et validation
 * automatique des ressources.
 *
 * La console fonctionne en production comme en développement : elle n'est
 * qu'une façade sur les systèmes déjà en place, sans état caché.
 */

import { round } from '../core/math.js';
import { formatDateTimeFr } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { LogLevel } from '../core/logger.js';
import { CITIES } from '../data/cities.js';
import { COUNTRIES } from '../data/countries.js';
import { CLUBS, COMPETITIONS, STADIUMS } from '../data/clubs.js';
import { BRANDS, PRODUCTS, VEHICLES } from '../data/brands.js';
import { ACTIVITIES } from '../data/activities.js';
import { VENUE_TEMPLATES } from '../world/venues.js';
import { auditCity } from '../world/generator.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';

export interface CommandResult {
  readonly ok: boolean;
  readonly output: string;
  readonly data?: unknown;
}

export interface CommandDefinition {
  readonly name: string;
  readonly usage: string;
  readonly description: string;
  readonly run: (args: string[]) => CommandResult;
}

export interface ValidationIssue {
  readonly severity: 'erreur' | 'avertissement';
  readonly domain: string;
  readonly subject: string;
  readonly message: string;
}

export class DevConsole {
  private readonly commands = new Map<string, CommandDefinition>();
  private readonly history: string[] = [];

  constructor(private readonly context: SimulationContext) {
    this.registerBuiltins();
  }

  /** Enregistre une commande additionnelle (extension par pack d'outils). */
  register(command: CommandDefinition): void {
    this.commands.set(command.name, command);
  }

  get available(): CommandDefinition[] {
    return [...this.commands.values()].sort((a, b) => a.name.localeCompare(b.name));
  }

  get commandHistory(): readonly string[] {
    return this.history;
  }

  /** Exécute une ligne de commande complète. */
  execute(line: string): CommandResult {
    const trimmed = line.trim();
    if (trimmed.length === 0) return { ok: false, output: 'commande vide' };
    this.history.push(trimmed);
    if (this.history.length > 200) this.history.shift();

    const [name, ...args] = trimmed.split(/\s+/);
    const command = name ? this.commands.get(name) : undefined;
    if (!command) {
      return { ok: false, output: `commande inconnue : "${name}" — tapez "aide"` };
    }
    try {
      return command.run(args);
    } catch (error) {
      return {
        ok: false,
        output: `erreur d'exécution : ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  private registerBuiltins(): void {
    this.register({
      name: 'aide',
      usage: 'aide [commande]',
      description: 'liste les commandes disponibles ou détaille une commande',
      run: (args) => {
        const target = args[0];
        if (target) {
          const command = this.commands.get(target);
          if (!command) return { ok: false, output: `commande inconnue : "${target}"` };
          return { ok: true, output: `${command.usage}\n  ${command.description}` };
        }
        const lines = this.available.map((c) => `  ${c.usage.padEnd(38)} ${c.description}`);
        return { ok: true, output: `Commandes disponibles :\n${lines.join('\n')}` };
      },
    });

    this.register({
      name: 'temps',
      usage: 'temps [avance <minutes>|vitesse <x>|pause|reprendre]',
      description: 'inspecte et pilote l’horloge du monde',
      run: (args) => {
        const [action, value] = args;
        const clock = this.context.clock;
        if (!action) {
          return {
            ok: true,
            output: `${formatDateTimeFr(clock.date)} — vitesse ×${clock.timeScale}${clock.paused ? ' (en pause)' : ''}`,
            data: clock.save(),
          };
        }
        if (action === 'avance') {
          const minutes = Number(value);
          if (!Number.isFinite(minutes) || minutes <= 0) {
            return { ok: false, output: 'usage : temps avance <minutes>' };
          }
          clock.advanceMinutes(Math.floor(minutes));
          return { ok: true, output: `horloge avancée à ${formatDateTimeFr(clock.date)}` };
        }
        if (action === 'vitesse') {
          const scale = Number(value);
          if (!Number.isFinite(scale) || scale < 0) return { ok: false, output: 'usage : temps vitesse <x>' };
          clock.timeScale = scale;
          return { ok: true, output: `vitesse de simulation : ×${scale}` };
        }
        if (action === 'pause') {
          clock.pause();
          return { ok: true, output: 'monde en pause' };
        }
        if (action === 'reprendre') {
          clock.resume();
          return { ok: true, output: 'monde relancé' };
        }
        return { ok: false, output: `action inconnue : "${action}"` };
      },
    });

    this.register({
      name: 'systemes',
      usage: 'systemes [activer|desactiver <id>]',
      description: 'liste les systèmes enregistrés et leur état',
      run: (args) => {
        const [action, id] = args;
        const scheduler = this.context.scheduler;
        if (action && id) {
          if (action !== 'activer' && action !== 'desactiver') {
            return { ok: false, output: 'usage : systemes [activer|desactiver <id>]' };
          }
          if (!scheduler.get(id)) return { ok: false, output: `système inconnu : "${id}"` };
          scheduler.setEnabled(id, action === 'activer');
          return { ok: true, output: `système "${id}" ${action === 'activer' ? 'activé' : 'désactivé'}` };
        }
        const lines = scheduler.all.map(
          (system) =>
            `  ${system.metadata.id.padEnd(14)} ${scheduler.isEnabled(system.metadata.id) ? 'actif  ' : 'inactif'} ` +
            `ordre ${String(system.metadata.order).padStart(3)}  tomes ${system.metadata.tomes.join(', ')}`,
        );
        return { ok: true, output: `${scheduler.all.length} systèmes :\n${lines.join('\n')}` };
      },
    });

    this.register({
      name: 'perf',
      usage: 'perf [reset]',
      description: 'affiche le profil de performances par système',
      run: (args) => {
        const profiler = this.context.profiler;
        if (args[0] === 'reset') {
          profiler.reset();
          return { ok: true, output: 'profileur réinitialisé' };
        }
        const samples = profiler.samples().slice(0, 15);
        const lines = samples.map(
          (sample) =>
            `  ${sample.label.padEnd(28)} moy ${round(sample.averageMs, 3).toString().padStart(8)} ms  ` +
            `pic ${round(sample.peakMs, 3).toString().padStart(8)} ms  appels ${sample.calls}`,
        );
        return {
          ok: true,
          output: `Images : ${profiler.frames} — ${round(profiler.fps, 1)} FPS moyen\n${lines.join('\n')}`,
          data: samples,
        };
      },
    });

    this.register({
      name: 'logs',
      usage: 'logs [niveau <trace|debug|info|warn|error>] [canal <nom>] [limite <n>]',
      description: 'consulte le journal structuré',
      run: (args) => {
        const options: { minLevel?: LogLevel; channel?: string; limit?: number } = {};
        for (let i = 0; i < args.length; i += 2) {
          const key = args[i];
          const value = args[i + 1];
          if (!key || !value) continue;
          if (key === 'niveau') options.minLevel = value as LogLevel;
          if (key === 'canal') options.channel = value;
          if (key === 'limite') options.limit = Number(value);
        }
        const entries = this.context.rootLogger.entries({ ...options, limit: options.limit ?? 20 });
        if (entries.length === 0) return { ok: true, output: 'aucune entrée correspondante' };
        const lines = entries.map(
          (entry) =>
            `  ${entry.level.toUpperCase().padEnd(5)} [${entry.channel}] ${entry.message}` +
            (entry.data ? ` ${JSON.stringify(entry.data)}` : ''),
        );
        return { ok: true, output: lines.join('\n'), data: entries };
      },
    });

    this.register({
      name: 'evenements',
      usage: 'evenements [limite]',
      description: 'affiche les derniers événements du bus',
      run: (args) => {
        const limit = Number(args[0] ?? 20);
        const events = this.context.events.recentEvents(Number.isFinite(limit) ? limit : 20);
        const lines = events.map((event) => `  ${String(event.at).padStart(9)}  ${event.type}`);
        return {
          ok: true,
          output: `${this.context.events.totalEmitted} événements émis au total\n${lines.join('\n')}`,
          data: events,
        };
      },
    });

    this.register({
      name: 'monde',
      usage: 'monde [ville]',
      description: 'inspecte l’état du monde ou d’une ville',
      run: (args) => {
        const world = this.context.optional<WorldSystem>(WORLD_SERVICE);
        if (!world) return { ok: false, output: 'système monde indisponible' };
        const cityId = args[0];
        if (!cityId) {
          const cities = world.cities();
          let venues = 0;
          for (const city of cities) venues += city.venues.size;
          return {
            ok: true,
            output: `${cities.length} villes générées, ${venues} lieux, ${cities.reduce((s, c) => s + c.npcCount, 0)} PNJ persistants`,
          };
        }
        const city = world.world.cities.get(cityId);
        if (!city) return { ok: false, output: `ville inconnue : "${cityId}"` };
        const audit = auditCity(city);
        return {
          ok: true,
          output:
            `${city.def.name} — ${city.districts.length} quartiers, ${city.venues.size} lieux, ` +
            `${city.streets.size} rues\n  météo ${city.weather.condition} ${city.weather.temperatureC} °C, ` +
            `trafic ${round(city.traffic, 2)}, hôtels ${Math.round(city.hotelOccupancy * 100)} %\n` +
            `  lieux structurants manquants : ${audit.missing.length === 0 ? 'aucun' : audit.missing.join(', ')}`,
          data: { audit, weather: city.weather },
        };
      },
    });

    this.register({
      name: 'donnees',
      usage: 'donnees [pays|villes|clubs|stades|competitions|marques|produits|vehicules|activites|lieux]',
      description: 'éditeur de données : inspecte les tables de contenu',
      run: (args) => {
        const table = args[0];
        const tables: Record<string, { count: number; sample: string[] }> = {
          pays: { count: COUNTRIES.length, sample: COUNTRIES.slice(0, 8).map((c) => `${c.id} — ${c.name}`) },
          villes: { count: CITIES.length, sample: CITIES.slice(0, 8).map((c) => `${c.id} — ${c.name} (palier ${c.tier})`) },
          clubs: { count: CLUBS.length, sample: CLUBS.slice(0, 8).map((c) => `${c.id} — ${c.name}`) },
          stades: { count: STADIUMS.length, sample: STADIUMS.slice(0, 8).map((s) => `${s.id} — ${s.name} (${s.capacity})`) },
          competitions: { count: COMPETITIONS.length, sample: COMPETITIONS.slice(0, 8).map((c) => `${c.id} — ${c.name}`) },
          marques: { count: BRANDS.length, sample: BRANDS.slice(0, 8).map((b) => `${b.id} — ${b.name}`) },
          produits: { count: PRODUCTS.length, sample: PRODUCTS.slice(0, 8).map((p) => `${p.id} — ${p.name}`) },
          vehicules: { count: VEHICLES.length, sample: VEHICLES.slice(0, 8).map((v) => `${v.id} — ${v.name}`) },
          activites: { count: ACTIVITIES.length, sample: ACTIVITIES.slice(0, 8).map((a) => `${a.id} — ${a.name}`) },
          lieux: { count: VENUE_TEMPLATES.length, sample: VENUE_TEMPLATES.slice(0, 8).map((v) => `${v.type} — ${v.label}`) },
        };
        if (!table) {
          const lines = Object.entries(tables).map(([name, info]) => `  ${name.padEnd(14)} ${info.count} entrées`);
          return { ok: true, output: `Tables de données :\n${lines.join('\n')}` };
        }
        const info = tables[table];
        if (!info) return { ok: false, output: `table inconnue : "${table}"` };
        return {
          ok: true,
          output: `${table} — ${info.count} entrées\n${info.sample.map((s) => `  ${s}`).join('\n')}`,
          data: info,
        };
      },
    });

    this.register({
      name: 'valider',
      usage: 'valider',
      description: 'valide automatiquement l’intégrité des ressources et des données',
      run: () => {
        const issues = validateContent(this.context);
        if (issues.length === 0) {
          return { ok: true, output: 'validation réussie : aucune anomalie détectée', data: [] };
        }
        const lines = issues.map(
          (issue) => `  [${issue.severity}] ${issue.domain}/${issue.subject} — ${issue.message}`,
        );
        const errors = issues.filter((i) => i.severity === 'erreur').length;
        return {
          ok: errors === 0,
          output: `${issues.length} anomalie(s), dont ${errors} erreur(s) :\n${lines.join('\n')}`,
          data: issues,
        };
      },
    });

    this.register({
      name: 'graine',
      usage: 'graine',
      description: 'affiche la graine du monde et l’état des flux aléatoires',
      run: () => {
        const streams = this.context.serializeRngStreams();
        return {
          ok: true,
          output: `graine : ${this.context.config.seed} — ${Object.keys(streams).length} flux aléatoires actifs`,
          data: streams,
        };
      },
    });
  }
}

/**
 * Validation automatique des ressources (Tome XXII, ch. 7).
 * Vérifie l'intégrité référentielle des tables de contenu et la cohérence du
 * monde généré : c'est le filet de sécurité des packs de contenu.
 */
export function validateContent(context: SimulationContext): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const countryIds = new Set(COUNTRIES.map((c) => c.id));
  const cityIds = new Set(CITIES.map((c) => c.id));
  const stadiumIds = new Set(STADIUMS.map((s) => s.id));
  const competitionIds = new Set(COMPETITIONS.map((c) => c.id));
  const brandIds = new Set(BRANDS.map((b) => b.id));

  for (const city of CITIES) {
    if (!countryIds.has(city.countryId)) {
      issues.push({
        severity: 'erreur',
        domain: 'villes',
        subject: city.id,
        message: `pays inconnu "${city.countryId}"`,
      });
    }
    if (Math.abs(city.geo.lat) > 90 || Math.abs(city.geo.lon) > 180) {
      issues.push({
        severity: 'erreur',
        domain: 'villes',
        subject: city.id,
        message: 'coordonnées géographiques hors bornes',
      });
    }
    if (city.districts.length === 0) {
      issues.push({
        severity: 'erreur',
        domain: 'villes',
        subject: city.id,
        message: 'aucun quartier déclaré',
      });
    }
  }

  for (const club of CLUBS) {
    if (!cityIds.has(club.cityId)) {
      issues.push({ severity: 'erreur', domain: 'clubs', subject: club.id, message: `ville inconnue "${club.cityId}"` });
    }
    if (!countryIds.has(club.countryId)) {
      issues.push({ severity: 'erreur', domain: 'clubs', subject: club.id, message: `pays inconnu "${club.countryId}"` });
    }
    if (!stadiumIds.has(club.stadiumId)) {
      issues.push({ severity: 'erreur', domain: 'clubs', subject: club.id, message: `stade inconnu "${club.stadiumId}"` });
    }
    if (!competitionIds.has(club.leagueId)) {
      issues.push({ severity: 'erreur', domain: 'clubs', subject: club.id, message: `championnat inconnu "${club.leagueId}"` });
    }
    for (const rivalId of club.rivalIds) {
      if (!CLUBS.some((c) => c.id === rivalId)) {
        issues.push({ severity: 'avertissement', domain: 'clubs', subject: club.id, message: `rival inconnu "${rivalId}"` });
      }
    }
  }

  for (const stadium of STADIUMS) {
    if (!cityIds.has(stadium.cityId)) {
      issues.push({ severity: 'erreur', domain: 'stades', subject: stadium.id, message: `ville inconnue "${stadium.cityId}"` });
    }
    if (stadium.capacity < 1000) {
      issues.push({ severity: 'avertissement', domain: 'stades', subject: stadium.id, message: 'capacité anormalement faible' });
    }
  }

  for (const product of PRODUCTS) {
    if (!brandIds.has(product.brandId)) {
      issues.push({ severity: 'erreur', domain: 'produits', subject: product.id, message: `marque inconnue "${product.brandId}"` });
    }
    if (product.priceEur <= 0) {
      issues.push({ severity: 'erreur', domain: 'produits', subject: product.id, message: 'prix nul ou négatif' });
    }
  }

  for (const vehicle of VEHICLES) {
    if (!brandIds.has(vehicle.brandId)) {
      issues.push({ severity: 'erreur', domain: 'vehicules', subject: vehicle.id, message: `marque inconnue "${vehicle.brandId}"` });
    }
  }

  for (const brand of BRANDS) {
    for (const competitorId of brand.competitorIds) {
      if (!brandIds.has(competitorId)) {
        issues.push({
          severity: 'avertissement',
          domain: 'marques',
          subject: brand.id,
          message: `concurrent inconnu "${competitorId}"`,
        });
      }
    }
  }

  for (const activity of ACTIVITIES) {
    if (!VENUE_TEMPLATES.some((template) => template.type === activity.venueType)) {
      issues.push({
        severity: 'erreur',
        domain: 'activites',
        subject: activity.id,
        message: `type de lieu inconnu "${activity.venueType}"`,
      });
    }
  }

  // Cohérence du monde généré : chaque ville doit rester praticable.
  const world = context.optional<WorldSystem>(WORLD_SERVICE);
  if (world) {
    for (const city of world.cities()) {
      const audit = auditCity(city);
      if (audit.missing.length > 0) {
        issues.push({
          severity: 'avertissement',
          domain: 'monde',
          subject: city.id,
          message: `lieux structurants absents : ${audit.missing.join(', ')}`,
        });
      }
      if (audit.venueCount === 0) {
        issues.push({ severity: 'erreur', domain: 'monde', subject: city.id, message: 'aucun lieu généré' });
      }
    }
  }

  return issues;
}
