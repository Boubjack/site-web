/**
 * Infinity Football — Serveur du tableau de bord
 *
 * Fait tourner un monde réel côté serveur et expose son état par une petite
 * API JSON, consommée par `web/index.html`. Le monde continue d'avancer même
 * lorsque personne ne regarde la page : c'est exactement le principe du
 * Tome II, ch. 1.2.
 *
 * Utilisation : npm run web  (puis http://localhost:8080)
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { InfinityFootball } from '../game.js';
import { MatchOrchestrator } from '../football/match-orchestrator.js';
import { qualityGrade } from './quality-system.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = join(HERE, '..', '..', '..', 'web');

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

/** Monde partagé par toutes les requêtes : un seul univers, comme dans le jeu. */
class LiveWorld {
  readonly game: InfinityFootball;
  private timer: NodeJS.Timeout | null = null;
  private lastMatch: ReturnType<MatchOrchestrator['play']> | null = null;
  private lastStreet: ReturnType<InfinityFootball['street']['playSession']> = null;

  constructor(seed: string) {
    this.game = new InfinityFootball({
      seed,
      startDate: { year: 2025, month: 7, day: 1, hour: 8, minute: 0 },
      richWorld: true,
      logLevel: 'warn',
    }).start();

    this.game.createCareer({
      name: 'Amadou Traoré',
      nationality: 'ml',
      position: 'MOC',
      age: 18,
      potential: 90,
    });
    this.game.phone.connectSpotify('compte-demo');
  }

  /** Le monde avance en continu, indépendamment des visiteurs. */
  start(minutesPerTick = 20, intervalMs = 1000): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      this.game.advanceMinutes(minutesPerTick);
    }, intervalMs);
    this.timer.unref?.();
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  playMatch(): void {
    const report = this.game.playNextMatch({ cinematics: false });
    if (report) this.lastMatch = report;
  }

  /** Dispute une session de rue sur un terrain de la ville courante. */
  playStreet(pitchId?: string, showboat = 0.5): void {
    const street = this.game.street;
    const pitches = street.pitchesIn(this.game.travel.cityId);
    const pitch = pitchId ? street.pitch(pitchId) : pitches[0];
    if (!pitch) return;
    const discipline = pitch.disciplines[0];
    if (!discipline) return;
    const report = street.playSession(pitch.id, discipline, { showboat });
    if (report) this.lastStreet = report;
  }

  state(): unknown {
    const game = this.game;
    const snapshot = game.snapshot();
    const city = game.world.city(game.travel.cityId);
    const scores = game.quality.qualityScores();
    const balance = game.quality.balanceReport();
    const briefing = game.phone.secretaryBriefing();

    return {
      snapshot,
      grade: qualityGrade(scores.global),
      city: {
        name: city.def.name,
        districts: city.districts.length,
        venues: city.venues.size,
        streets: city.streets.size,
        weather: city.weather,
        traffic: city.traffic,
        hotelOccupancy: city.hotelOccupancy,
        streetEvents: city.activeStreetEvents.map((event) => event.label),
        decorations: city.decorations,
      },
      openVenues: [...city.venues.values()]
        .filter((venue) => venue.open)
        .slice(0, 14)
        .map((venue) => ({
          name: venue.name,
          type: venue.type,
          occupancy: venue.occupancy,
          capacity: venue.capacity,
        })),
      npcs: game.npcs
        .inCity(city.id)
        .slice(0, 10)
        .map((npc) => ({
          name: npc.name,
          age: npc.age,
          occupation: npc.occupation,
          activity: npc.currentActivity,
          club: npc.fanOfClubId,
        })),
      press: game.media.frontPage(6).map((article) => ({
        outlet: article.outletName,
        headline: article.headline,
        tone: article.tone,
      })),
      alerts: game.media.liveAlerts(5).map((alert) => alert.text),
      calendar: game.calendar.upcoming(5).map((event) => ({
        name: event.name,
        magnitude: event.magnitude,
        fanZones: event.fanZones.length,
      })),
      secretary: {
        salutation: briefing.salutation,
        finances: briefing.finances,
        performance: briefing.performance,
        agenda: briefing.agenda.slice(0, 4),
        recommendations: briefing.recommendations.slice(0, 3),
      },
      phone: {
        apps: game.phone.apps.map((app) => ({ id: app.id, name: app.name, icon: app.icon })),
        badges: game.phone.badges(),
        followers: game.phone.followerCount,
        trends: game.phone.trends,
        battery: game.phone.batteryLevel,
      },
      street: {
        cred: game.street.streetCred,
        standing: game.street.standing,
        sessions: game.street.sessionsPlayed,
        pitches: game.street.pitchesIn(city.id).map((pitch) => ({
          id: pitch.id,
          name: pitch.name,
          district: pitch.districtName,
          disciplines: pitch.disciplines,
          reputation: pitch.reputation,
          known: pitch.known,
          description: game.street.describePitch(pitch.id),
        })),
        legends: game.street.legendsIn(city.id).slice(0, 6).map((legend) => ({
          name: legend.name,
          nickname: legend.nickname,
          crew: legend.crewName,
          age: legend.age,
          respect: legend.respect,
          duels: legend.duels,
        })),
        clips: game.street.viralClips.slice(0, 5).map((clip) => ({
          title: clip.title,
          views: clip.views,
          pitch: clip.pitchName,
        })),
        invitations: game.street.pendingInvitations.map((invitation) => ({
          id: invitation.id,
          name: invitation.tournamentName,
          message: invitation.message,
          secret: invitation.secret,
          prize: invitation.prize,
        })),
        brands: game.street.availableStreetBrands().map((brand) => brand.name),
        palmares: game.street.palmares,
        scouts: game.street.knownScouts.map((scout) => ({
          club: scout.clubId,
          impression: scout.impression,
          offered: scout.offered,
        })),
      },
      quality: { ...scores, balance },
      lastMatch: this.lastMatch
        ? {
            home: this.lastMatch.homeName,
            away: this.lastMatch.awayName,
            score: `${this.lastMatch.result.homeGoals}-${this.lastMatch.result.awayGoals}`,
            competition: this.lastMatch.competitionName,
            stadium: this.lastMatch.stadiumName,
            referee: this.lastMatch.refereeName,
            attendance: this.lastMatch.result.attendance,
            rating: this.lastMatch.playerRating,
            analysis: this.lastMatch.analysis.summary,
            advice: this.lastMatch.analysis.advice,
            heatmap: this.lastMatch.analysis.heatmap,
            commentary: this.lastMatch.commentary.slice(-6).map((line) => ({
              who: line.commentatorName,
              text: line.text,
            })),
            highlights: MatchOrchestrator.highlights(this.lastMatch.result, 6).map((event) => ({
              minute: event.minute,
              kind: event.kind,
              detail: event.detail,
            })),
          }
        : null,
      lastStreet: this.lastStreet
        ? {
            pitch: this.lastStreet.pitchName,
            discipline: this.lastStreet.disciplineName,
            opponent: this.lastStreet.opponentName,
            won: this.lastStreet.won,
            score: this.lastStreet.scoreLine,
            summary: this.lastStreet.summary,
            moves: this.lastStreet.moves,
            gains: this.lastStreet.attributeGains,
            clip: this.lastStreet.clip,
            whisper: this.lastStreet.scoutWhisper,
          }
        : null,
      systems: game.scheduler.all.map((system) => ({
        id: system.metadata.id,
        name: system.metadata.name,
        tomes: system.metadata.tomes,
        enabled: game.scheduler.isEnabled(system.metadata.id),
      })),
    };
  }
}

function sendJson(response: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(body);
}

async function serveStatic(response: ServerResponse, path: string): Promise<void> {
  try {
    const file = await readFile(join(WEB_ROOT, path));
    response.writeHead(200, { 'content-type': MIME[extname(path)] ?? 'application/octet-stream' });
    response.end(file);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('introuvable');
  }
}

export function startServer(port = 8080, seed = 'infinity-web'): void {
  const world = new LiveWorld(seed);
  world.start();

  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);

    if (url.pathname === '/api/state') {
      sendJson(response, 200, world.state());
      return;
    }
    if (url.pathname === '/api/advance' && request.method === 'POST') {
      const days = Math.max(1, Math.min(90, Number(url.searchParams.get('days') ?? 1)));
      world.game.advanceDays(days);
      sendJson(response, 200, { ok: true, days });
      return;
    }
    if (url.pathname === '/api/street' && request.method === 'POST') {
      const showboat = Number(url.searchParams.get('showboat') ?? 0.5);
      world.playStreet(url.searchParams.get('pitch') ?? undefined, showboat);
      sendJson(response, 200, { ok: true });
      return;
    }
    if (url.pathname === '/api/match' && request.method === 'POST') {
      world.playMatch();
      sendJson(response, 200, { ok: true });
      return;
    }
    if (url.pathname === '/api/console' && request.method === 'POST') {
      const command = url.searchParams.get('c') ?? 'aide';
      sendJson(response, 200, world.game.console.execute(command));
      return;
    }
    if (url.pathname === '/api/ceremony' && request.method === 'POST') {
      const ceremony = world.game.awards.runCeremony();
      sendJson(response, 200, {
        city: ceremony.hostCityName,
        season: ceremony.season,
        stage: ceremony.stageDesign,
        results: ceremony.results.map((r) => ({
          category: r.categoryName,
          winner: r.winnerName,
          presenter: r.presenterName,
          trophy: r.trophyDesign,
        })),
      });
      return;
    }

    const path = url.pathname === '/' ? 'index.html' : url.pathname.replace(/^\/+/, '');
    void serveStatic(response, path);
  });

  server.listen(port, () => {
    console.log(`Infinity Football — tableau de bord sur http://localhost:${port}`);
    console.log('Le monde avance en continu, même sans visiteur.');
  });
}

const isDirectRun =
  typeof process !== 'undefined' &&
  process.argv[1] !== undefined &&
  process.argv[1].endsWith('web-server.js');

if (isDirectRun) {
  startServer(Number(process.env.PORT ?? 8080));
}
