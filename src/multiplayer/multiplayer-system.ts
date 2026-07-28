/**
 * Infinity Football — Multijoueur & univers social
 *
 * Tome X intégralement : hubs sociaux dans chaque grande ville, clubs de
 * joueurs avec rôles et permissions, événements mondiaux, coopération
 * (entraînement, visites, vacances, cérémonies, matchs vus des tribunes),
 * fonctionnalités communautaires et sécurité (anti-triche, signalement,
 * modération, protection des sauvegardes, synchronisation cloud, autosave).
 *
 * Le système modélise l'état social côté client et le protocole d'échange :
 * il est conçu pour être branché sur un serveur autoritatif réel, mais reste
 * pleinement fonctionnel en mode local avec des sessions simulées.
 */

import { clamp, clamp01, round } from '../core/math.js';
import { dateFromAbsoluteMinutes, formatDateTimeFr } from '../core/clock.js';
import type { GameDate, Season } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { NAME_POOLS } from '../data/names.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';

export const MULTIPLAYER_SERVICE = 'multiplayer';

export interface OnlinePlayer {
  readonly id: string;
  readonly handle: string;
  /** Réputation publique 0..100. */
  reputation: number;
  /** Ville où le joueur est connecté. */
  cityId: string;
  /** Hub fréquenté, s'il y en a un. */
  hubId: string | null;
  online: boolean;
  lastSeenAt: number;
  /** Trophées exposés dans sa vitrine publique. */
  readonly trophies: string[];
  /** Véhicules exposés au hub. */
  readonly showcaseVehicles: string[];
  /** Score de confiance anti-triche 0..1 (1 = irréprochable). */
  trustScore: number;
}

export interface SocialHub {
  readonly id: string;
  readonly cityId: string;
  readonly name: string;
  readonly venueId: string;
  readonly capacity: number;
  /** Joueurs présents. */
  readonly occupants: Set<string>;
  /** Décorations saisonnières. */
  decorations: string[];
  /** Activités proposées. */
  readonly activities: readonly string[];
}

export type ClubRole = 'président' | 'vice-président' | 'recruteur' | 'capitaine' | 'membre';

export interface ClubPermissions {
  readonly invite: boolean;
  readonly kick: boolean;
  readonly editIdentity: boolean;
  readonly manageEvents: boolean;
  readonly manageMuseum: boolean;
}

export interface OnlineClub {
  readonly id: string;
  name: string;
  tag: string;
  logo: string;
  colors: [string, string];
  /** Ville du siège social. */
  headquartersCityId: string;
  readonly foundedAt: number;
  /** Membres et rôles. */
  readonly members: Map<string, ClubRole>;
  /** Points de classement. */
  rankingPoints: number;
  /** Historique des faits marquants. */
  readonly history: Array<{ at: number; label: string }>;
  /** Trophées exposés au musée du club. */
  readonly museum: string[];
}

export type OnlineEventKind =
  | 'tournoi'
  | 'match de gala'
  | 'compétition saisonnière'
  | 'défi communautaire'
  | 'match des légendes';

export interface OnlineEvent {
  readonly id: string;
  readonly kind: OnlineEventKind;
  readonly name: string;
  readonly cityId: string;
  readonly startsAt: number;
  readonly endsAt: number;
  readonly maxParticipants: number;
  readonly participants: Set<string>;
  /** Récompenses exclusives. */
  readonly rewards: readonly string[];
  status: 'annoncé' | 'inscriptions' | 'en cours' | 'terminé';
  winnerId: string | null;
}

export type CoopActivity =
  | 's’entraîner ensemble'
  | 'visiter une maison'
  | 'visiter un garage'
  | 'partir en vacances'
  | 'assister à une cérémonie'
  | 'regarder un match en tribune';

export interface CoopSession {
  readonly id: string;
  readonly activity: CoopActivity;
  readonly hostId: string;
  readonly participants: Set<string>;
  readonly startedAt: number;
  readonly cityId: string;
  completed: boolean;
}

export interface FriendEntry {
  readonly playerId: string;
  readonly handle: string;
  favourite: boolean;
  readonly addedAt: number;
}

export interface CommunityGroup {
  readonly id: string;
  readonly name: string;
  readonly members: Set<string>;
  readonly createdAt: number;
  /** Discussion textuelle du groupe. */
  readonly messages: Array<{ authorId: string; text: string; at: number }>;
  voiceEnabled: boolean;
}

export interface SharedMedia {
  readonly id: string;
  readonly authorId: string;
  readonly kind: 'capture' | 'ralenti';
  readonly caption: string;
  readonly at: number;
  likes: number;
}

export interface ModerationReport {
  readonly id: string;
  readonly reporterId: string;
  readonly targetId: string;
  readonly reason: 'triche' | 'comportement toxique' | 'contenu inapproprié' | 'spam';
  readonly detail: string;
  readonly at: number;
  status: 'ouvert' | 'examiné' | 'sanctionné' | 'classé';
}

export interface CheatSignal {
  readonly playerId: string;
  readonly kind: 'statistiques impossibles' | 'progression anormale' | 'économie incohérente' | 'latence manipulée';
  readonly severity: number;
  readonly at: number;
  readonly evidence: string;
}

export interface CloudSaveState {
  lastSyncAt: number | null;
  /** Somme de contrôle du dernier envoi. */
  checksum: string | null;
  /** Sauvegardes automatiques conservées. */
  readonly autosaves: Array<{ slot: string; at: number; checksum: string }>;
  conflict: boolean;
}

const HUB_ACTIVITIES = [
  'discuter',
  'comparer les trophées',
  'exposer sa voiture',
  'visiter le musée d’un joueur',
  'organiser un match',
  'lancer un défi',
  'regarder un match sur écran géant',
];

const CLUB_PERMISSIONS: Record<ClubRole, ClubPermissions> = {
  président: { invite: true, kick: true, editIdentity: true, manageEvents: true, manageMuseum: true },
  'vice-président': { invite: true, kick: true, editIdentity: false, manageEvents: true, manageMuseum: true },
  recruteur: { invite: true, kick: false, editIdentity: false, manageEvents: false, manageMuseum: false },
  capitaine: { invite: true, kick: false, editIdentity: false, manageEvents: true, manageMuseum: false },
  membre: { invite: false, kick: false, editIdentity: false, manageEvents: false, manageMuseum: false },
};

export class MultiplayerSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'multiplayer',
    name: 'Multijoueur & univers social',
    order: 135,
    tomes: ['X', 'XV'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private career: CareerSystem | null = null;

  private localPlayerId = 'player:1';
  private connected = false;
  private readonly players = new Map<string, OnlinePlayer>();
  private readonly hubs = new Map<string, SocialHub>();
  private readonly clubs = new Map<string, OnlineClub>();
  private readonly events = new Map<string, OnlineEvent>();
  private readonly coopSessions = new Map<string, CoopSession>();
  private readonly friends = new Map<string, FriendEntry>();
  private readonly groups = new Map<string, CommunityGroup>();
  private readonly media: SharedMedia[] = [];
  private readonly reports = new Map<string, ModerationReport>();
  private readonly cheatSignals: CheatSignal[] = [];
  private cloud: CloudSaveState = { lastSyncAt: null, checksum: null, autosaves: [], conflict: false };
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(MULTIPLAYER_SERVICE, this);

    this.buildHubs();
  }

  /** Chaque grande ville possède ses hubs (Tome X, ch. 2). */
  private buildHubs(): void {
    for (const city of this.world.cities()) {
      if (city.def.tier > 2) continue;
      const venues = [...city.venues.values()].filter((v) => v.type === 'socialHub');
      const fallback = [...city.venues.values()].filter((v) => v.type === 'square' || v.type === 'mall');
      const hosts = venues.length > 0 ? venues : fallback.slice(0, 1);
      hosts.forEach((venue, index) => {
        const hub: SocialHub = {
          id: `hub:${city.id}:${index}`,
          cityId: city.id,
          name: `Hub ${city.def.name}${index > 0 ? ` #${index + 1}` : ''}`,
          venueId: venue.id,
          capacity: 64,
          occupants: new Set<string>(),
          decorations: [],
          activities: HUB_ACTIVITIES,
        };
        this.hubs.set(hub.id, hub);
      });
    }
  }

  // ── Connexion & présence ─────────────────────────────────────────────────

  /** Connexion au monde partagé. La carrière solo reste la sienne. */
  connect(handle: string): OnlinePlayer {
    this.connected = true;
    const cityId = this.world.cities()[0]?.id ?? 'paris';
    const player: OnlinePlayer = {
      id: this.localPlayerId,
      handle,
      reputation: this.career?.hasCareer ? this.career.player.reputation : 10,
      cityId,
      hubId: null,
      online: true,
      lastSeenAt: this.context.clock.absoluteMinutes,
      trophies: this.career?.trophyList.map((t) => t.name) ?? [],
      showcaseVehicles: this.economy.garage.slice(0, 3).map((v) => v.label),
      trustScore: 1,
    };
    this.players.set(player.id, player);
    this.populateNeighbours();
    this.context.emit({
      type: 'multiplayer.event',
      action: 'connexion',
      actorId: player.id,
      detail: handle,
    });
    return player;
  }

  disconnect(): void {
    const local = this.players.get(this.localPlayerId);
    if (local) {
      local.online = false;
      local.lastSeenAt = this.context.clock.absoluteMinutes;
      if (local.hubId) this.hubs.get(local.hubId)?.occupants.delete(local.id);
      local.hubId = null;
    }
    this.connected = false;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get localPlayer(): OnlinePlayer | undefined {
    return this.players.get(this.localPlayerId);
  }

  /** Peuple le monde partagé avec d'autres joueurs, pour un hub jamais vide. */
  private populateNeighbours(): void {
    const rng = this.context.stream('multiplayer.players');
    const pool = NAME_POOLS[rng.int(0, NAME_POOLS.length - 1)] as (typeof NAME_POOLS)[number];
    const cities = this.world.cities().filter((c) => c.def.tier <= 2);
    for (let i = 0; i < 48; i++) {
      const city = rng.pick(cities);
      const id = `online:${i}`;
      if (this.players.has(id)) continue;
      this.players.set(id, {
        id,
        handle: `${rng.pick(pool.given)}${rng.int(10, 99)}`,
        reputation: round(rng.range(5, 95), 1),
        cityId: city.id,
        hubId: null,
        online: rng.chance(0.6),
        lastSeenAt: this.context.clock.absoluteMinutes - rng.int(0, 4000),
        trophies: [],
        showcaseVehicles: [],
        trustScore: clamp01(rng.gaussian(0.95, 0.08)),
      });
    }
  }

  get onlinePlayers(): OnlinePlayer[] {
    return [...this.players.values()].filter((p) => p.online);
  }

  // ── Hubs sociaux (Tome X, ch. 2) ─────────────────────────────────────────

  get allHubs(): SocialHub[] {
    return [...this.hubs.values()];
  }

  hubsInCity(cityId: string): SocialHub[] {
    return [...this.hubs.values()].filter((hub) => hub.cityId === cityId);
  }

  joinHub(hubId: string, playerId = this.localPlayerId): boolean {
    const hub = this.hubs.get(hubId);
    const player = this.players.get(playerId);
    if (!hub || !player || hub.occupants.size >= hub.capacity) return false;
    if (player.hubId) this.hubs.get(player.hubId)?.occupants.delete(playerId);
    hub.occupants.add(playerId);
    player.hubId = hubId;
    player.cityId = hub.cityId;
    this.context.emit({
      type: 'multiplayer.event',
      action: 'hub rejoint',
      actorId: playerId,
      detail: hub.name,
    });
    return true;
  }

  leaveHub(playerId = this.localPlayerId): void {
    const player = this.players.get(playerId);
    if (!player?.hubId) return;
    this.hubs.get(player.hubId)?.occupants.delete(playerId);
    player.hubId = null;
  }

  /** Vitrine publique d'un joueur : trophées, voitures, musée. */
  showcaseOf(playerId: string): { trophies: string[]; vehicles: string[]; museumOpen: boolean } | null {
    const player = this.players.get(playerId);
    if (!player) return null;
    return {
      trophies: [...player.trophies],
      vehicles: [...player.showcaseVehicles],
      museumOpen: player.trophies.length > 0,
    };
  }

  // ── Clubs de joueurs (Tome X, ch. 3) ─────────────────────────────────────

  createClub(name: string, tag: string, colors: [string, string], cityId: string): OnlineClub {
    const club: OnlineClub = {
      id: `oclub:${this.counter++}`,
      name,
      tag: tag.slice(0, 4).toUpperCase(),
      logo: `logo.${tag.toLowerCase()}`,
      colors,
      headquartersCityId: cityId,
      foundedAt: this.context.clock.absoluteMinutes,
      members: new Map([[this.localPlayerId, 'président']]),
      rankingPoints: 0,
      history: [{ at: this.context.clock.absoluteMinutes, label: `Fondation du club ${name}` }],
      museum: [],
    };
    this.clubs.set(club.id, club);
    this.context.emit({
      type: 'multiplayer.event',
      action: 'club créé',
      actorId: this.localPlayerId,
      detail: name,
    });
    return club;
  }

  joinClub(clubId: string, playerId = this.localPlayerId, role: ClubRole = 'membre'): boolean {
    const club = this.clubs.get(clubId);
    if (!club || club.members.has(playerId)) return false;
    club.members.set(playerId, role);
    club.history.push({ at: this.context.clock.absoluteMinutes, label: `${playerId} rejoint le club` });
    return true;
  }

  setClubRole(clubId: string, playerId: string, role: ClubRole, actorId = this.localPlayerId): boolean {
    const club = this.clubs.get(clubId);
    if (!club) return false;
    const actorRole = club.members.get(actorId);
    if (!actorRole || !CLUB_PERMISSIONS[actorRole].kick) return false;
    if (!club.members.has(playerId)) return false;
    club.members.set(playerId, role);
    return true;
  }

  permissionsOf(clubId: string, playerId: string): ClubPermissions | null {
    const role = this.clubs.get(clubId)?.members.get(playerId);
    return role ? CLUB_PERMISSIONS[role] : null;
  }

  addToClubMuseum(clubId: string, item: string, actorId = this.localPlayerId): boolean {
    const club = this.clubs.get(clubId);
    const permissions = this.permissionsOf(clubId, actorId);
    if (!club || !permissions?.manageMuseum) return false;
    club.museum.push(item);
    club.history.push({ at: this.context.clock.absoluteMinutes, label: `Ajout au musée : ${item}` });
    return true;
  }

  get clubRanking(): Array<{ club: OnlineClub; position: number }> {
    return [...this.clubs.values()]
      .sort((a, b) => b.rankingPoints - a.rankingPoints)
      .map((club, index) => ({ club, position: index + 1 }));
  }

  // ── Événements mondiaux (Tome X, ch. 4) ──────────────────────────────────

  scheduleEvent(
    kind: OnlineEventKind,
    name: string,
    cityId: string,
    inHours: number,
    durationHours: number,
    maxParticipants: number,
    rewards: readonly string[],
  ): OnlineEvent {
    const startsAt = this.context.clock.absoluteMinutes + inHours * 60;
    const event: OnlineEvent = {
      id: `oevent:${this.counter++}`,
      kind,
      name,
      cityId,
      startsAt,
      endsAt: startsAt + durationHours * 60,
      maxParticipants,
      participants: new Set<string>(),
      rewards,
      status: 'annoncé',
      winnerId: null,
    };
    this.events.set(event.id, event);
    return event;
  }

  registerForEvent(eventId: string, playerId = this.localPlayerId): boolean {
    const event = this.events.get(eventId);
    if (!event || event.status === 'terminé') return false;
    if (event.participants.size >= event.maxParticipants) return false;
    event.participants.add(playerId);
    event.status = 'inscriptions';
    return true;
  }

  get upcomingEvents(): OnlineEvent[] {
    const now = this.context.clock.absoluteMinutes;
    return [...this.events.values()]
      .filter((e) => e.endsAt > now)
      .sort((a, b) => a.startsAt - b.startsAt);
  }

  // ── Coopération (Tome X, ch. 5) ──────────────────────────────────────────

  startCoop(activity: CoopActivity, participantIds: readonly string[]): CoopSession {
    const session: CoopSession = {
      id: `coop:${this.counter++}`,
      activity,
      hostId: this.localPlayerId,
      participants: new Set([this.localPlayerId, ...participantIds]),
      startedAt: this.context.clock.absoluteMinutes,
      cityId: this.localPlayer?.cityId ?? 'paris',
      completed: false,
    };
    this.coopSessions.set(session.id, session);
    this.context.emit({
      type: 'multiplayer.event',
      action: 'session coopérative',
      actorId: this.localPlayerId,
      detail: activity,
    });
    return session;
  }

  completeCoop(sessionId: string): CoopSession | null {
    const session = this.coopSessions.get(sessionId);
    if (!session || session.completed) return null;
    session.completed = true;
    // Une session partagée renforce la réputation en ligne.
    for (const participantId of session.participants) {
      const player = this.players.get(participantId);
      if (player) player.reputation = clamp(player.reputation + 0.4, 0, 100);
    }
    return session;
  }

  get activeCoopSessions(): CoopSession[] {
    return [...this.coopSessions.values()].filter((s) => !s.completed);
  }

  // ── Communauté (Tome X, ch. 6) ───────────────────────────────────────────

  addFriend(playerId: string): FriendEntry | null {
    const player = this.players.get(playerId);
    if (!player || this.friends.has(playerId)) return null;
    const entry: FriendEntry = {
      playerId,
      handle: player.handle,
      favourite: false,
      addedAt: this.context.clock.absoluteMinutes,
    };
    this.friends.set(playerId, entry);
    return entry;
  }

  removeFriend(playerId: string): boolean {
    return this.friends.delete(playerId);
  }

  get friendList(): Array<FriendEntry & { online: boolean }> {
    return [...this.friends.values()].map((entry) => ({
      ...entry,
      online: this.players.get(entry.playerId)?.online ?? false,
    }));
  }

  createGroup(name: string, memberIds: readonly string[], voiceEnabled = false): CommunityGroup {
    const group: CommunityGroup = {
      id: `group:${this.counter++}`,
      name,
      members: new Set([this.localPlayerId, ...memberIds]),
      createdAt: this.context.clock.absoluteMinutes,
      messages: [],
      voiceEnabled,
    };
    this.groups.set(group.id, group);
    return group;
  }

  sendGroupMessage(groupId: string, text: string, authorId = this.localPlayerId): boolean {
    const group = this.groups.get(groupId);
    if (!group || !group.members.has(authorId)) return false;
    group.messages.push({ authorId, text, at: this.context.clock.absoluteMinutes });
    if (group.messages.length > 300) group.messages.splice(0, group.messages.length - 300);
    return true;
  }

  /** Les appels vocaux ne s'activent que sur consentement explicite. */
  setVoiceEnabled(groupId: string, enabled: boolean): boolean {
    const group = this.groups.get(groupId);
    if (!group) return false;
    group.voiceEnabled = enabled;
    return true;
  }

  get groupList(): CommunityGroup[] {
    return [...this.groups.values()];
  }

  invite(playerId: string, purpose: string): boolean {
    if (!this.players.has(playerId)) return false;
    this.context.emit({
      type: 'multiplayer.event',
      action: 'invitation',
      actorId: this.localPlayerId,
      detail: `${playerId} — ${purpose}`,
    });
    return true;
  }

  share(kind: 'capture' | 'ralenti', caption: string): SharedMedia {
    const item: SharedMedia = {
      id: `media:${this.counter++}`,
      authorId: this.localPlayerId,
      kind,
      caption,
      at: this.context.clock.absoluteMinutes,
      likes: 0,
    };
    this.media.push(item);
    if (this.media.length > 200) this.media.splice(0, this.media.length - 200);
    return item;
  }

  get sharedMedia(): SharedMedia[] {
    return [...this.media].reverse();
  }

  // ── Évolution du monde en ligne (Tome X, ch. 7) ──────────────────────────

  onSeason(context: SimulationContext, season: Season): void {
    const decorations: Record<Season, string[]> = {
      winter: ['guirlandes lumineuses', 'patinoire éphémère'],
      spring: ['végétalisation des hubs', 'tournoi de printemps'],
      summer: ['terrasse extérieure', 'écran géant plein air'],
      autumn: ['ambiance chaleureuse', 'exposition des trophées de la saison'],
    };
    for (const hub of this.hubs.values()) {
      hub.decorations = [...(decorations[season] ?? [])];
    }
    // Chaque saison apporte de nouveaux défis communautaires.
    const rng = context.stream('multiplayer.season');
    const city = rng.pick(this.world.cities().filter((c) => c.def.tier === 1));
    this.scheduleEvent(
      'compétition saisonnière',
      `Circuit ${season} — ${city.def.name}`,
      city.id,
      24,
      24 * 21,
      256,
      ['maillot exclusif de saison', 'peinture de véhicule unique', 'badge de hub'],
    );
    this.scheduleEvent(
      'défi communautaire',
      `Défi mondial ${season}`,
      city.id,
      2,
      24 * 14,
      100_000,
      ['trophée communautaire', 'décoration de musée'],
    );
  }

  // ── Sécurité (Tome X, ch. 8) ─────────────────────────────────────────────

  /**
   * Détection de triche : compare les valeurs déclarées aux bornes plausibles
   * du moteur. Toute anomalie produit un signal horodaté et documenté.
   */
  runCheatDetection(sample: {
    playerId: string;
    goalsThisSeason: number;
    matchesThisSeason: number;
    netWorth: number;
    careerYears: number;
    averagePing: number;
    pingVariance: number;
  }): CheatSignal[] {
    const signals: CheatSignal[] = [];
    const now = this.context.clock.absoluteMinutes;

    const goalsPerMatch = sample.matchesThisSeason > 0 ? sample.goalsThisSeason / sample.matchesThisSeason : 0;
    if (goalsPerMatch > 4) {
      signals.push({
        playerId: sample.playerId,
        kind: 'statistiques impossibles',
        severity: clamp01((goalsPerMatch - 4) / 6),
        at: now,
        evidence: `${round(goalsPerMatch, 2)} buts par match sur ${sample.matchesThisSeason} rencontres`,
      });
    }
    if (sample.matchesThisSeason > 90) {
      signals.push({
        playerId: sample.playerId,
        kind: 'progression anormale',
        severity: clamp01((sample.matchesThisSeason - 90) / 60),
        at: now,
        evidence: `${sample.matchesThisSeason} matchs déclarés sur une saison`,
      });
    }
    const plausibleMax = 25_000_000 * Math.max(1, sample.careerYears) * 3;
    if (sample.netWorth > plausibleMax) {
      signals.push({
        playerId: sample.playerId,
        kind: 'économie incohérente',
        severity: clamp01(sample.netWorth / (plausibleMax * 4)),
        at: now,
        evidence: `patrimoine de ${Math.round(sample.netWorth).toLocaleString('fr-FR')} € après ${sample.careerYears} an(s)`,
      });
    }
    if (sample.pingVariance > 120 && sample.averagePing < 30) {
      signals.push({
        playerId: sample.playerId,
        kind: 'latence manipulée',
        severity: clamp01(sample.pingVariance / 400),
        at: now,
        evidence: `ping moyen ${sample.averagePing} ms, variance ${sample.pingVariance} ms`,
      });
    }

    for (const signal of signals) {
      this.cheatSignals.push(signal);
      const player = this.players.get(signal.playerId);
      if (player) player.trustScore = clamp01(player.trustScore - signal.severity * 0.35);
    }
    if (this.cheatSignals.length > 500) {
      this.cheatSignals.splice(0, this.cheatSignals.length - 500);
    }
    return signals;
  }

  get cheatLog(): readonly CheatSignal[] {
    return this.cheatSignals;
  }

  report(targetId: string, reason: ModerationReport['reason'], detail: string): ModerationReport {
    const report: ModerationReport = {
      id: `report:${this.counter++}`,
      reporterId: this.localPlayerId,
      targetId,
      reason,
      detail,
      at: this.context.clock.absoluteMinutes,
      status: 'ouvert',
    };
    this.reports.set(report.id, report);
    return report;
  }

  /** Traitement de modération : les signaux de triche pèsent sur la décision. */
  moderate(reportId: string): ModerationReport | null {
    const report = this.reports.get(reportId);
    if (!report || report.status !== 'ouvert') return null;
    const target = this.players.get(report.targetId);
    const signals = this.cheatSignals.filter((s) => s.playerId === report.targetId);
    const severity = signals.reduce((sum, s) => sum + s.severity, 0);

    if (report.reason === 'triche' && severity > 0.6) {
      report.status = 'sanctionné';
      if (target) target.trustScore = clamp01(target.trustScore - 0.5);
    } else if (severity > 0.2 || report.reason === 'comportement toxique') {
      report.status = 'examiné';
      if (target) target.trustScore = clamp01(target.trustScore - 0.1);
    } else {
      report.status = 'classé';
    }
    return report;
  }

  get moderationQueue(): ModerationReport[] {
    return [...this.reports.values()].filter((r) => r.status === 'ouvert');
  }

  /** Synchronisation cloud de la sauvegarde, avec détection de conflit. */
  syncCloud(checksum: string): { synced: boolean; conflict: boolean } {
    const now = this.context.clock.absoluteMinutes;
    // Un checksum différent alors qu'aucune écriture locale n'a eu lieu depuis
    // la dernière synchro indique une partie jouée sur un autre appareil.
    const conflict = this.cloud.checksum !== null && this.cloud.checksum !== checksum && this.cloud.lastSyncAt === now;
    this.cloud = {
      lastSyncAt: now,
      checksum,
      autosaves: this.cloud.autosaves,
      conflict,
    };
    this.context.emit({
      type: 'multiplayer.event',
      action: 'synchronisation cloud',
      actorId: this.localPlayerId,
      detail: conflict ? 'conflit détecté' : 'sauvegarde synchronisée',
    });
    return { synced: !conflict, conflict };
  }

  /** Enregistre une sauvegarde automatique protégée. */
  registerAutosave(slot: string, checksum: string): void {
    this.cloud.autosaves.push({ slot, at: this.context.clock.absoluteMinutes, checksum });
    // On conserve les cinq dernières sauvegardes automatiques.
    while (this.cloud.autosaves.length > 5) this.cloud.autosaves.shift();
  }

  get cloudState(): CloudSaveState & { lastSyncLabel: string | null } {
    return {
      ...this.cloud,
      lastSyncLabel: this.cloud.lastSyncAt
        ? formatDateTimeFr(dateFromAbsoluteMinutes(this.cloud.lastSyncAt))
        : null,
    };
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onHour(context: SimulationContext, _date: GameDate): void {
    if (!this.connected) return;
    const now = context.clock.absoluteMinutes;
    const rng = context.stream('multiplayer.presence');

    // Les autres joueurs se connectent et se déconnectent.
    for (const player of this.players.values()) {
      if (player.id === this.localPlayerId) continue;
      if (rng.chance(0.18)) {
        player.online = !player.online;
        player.lastSeenAt = now;
        if (!player.online && player.hubId) {
          this.hubs.get(player.hubId)?.occupants.delete(player.id);
          player.hubId = null;
        }
      }
      if (player.online && !player.hubId && rng.chance(0.25)) {
        const hubs = this.hubsInCity(player.cityId);
        if (hubs.length > 0) this.joinHub(rng.pick(hubs).id, player.id);
      }
    }

    // Cycle de vie des événements en ligne.
    for (const event of this.events.values()) {
      if (event.status === 'terminé') continue;
      if (event.startsAt <= now && event.endsAt > now && event.status !== 'en cours') {
        event.status = 'en cours';
      } else if (event.endsAt <= now) {
        event.status = 'terminé';
        const entrants = [...event.participants];
        if (entrants.length > 0) {
          event.winnerId = rng.pick(entrants);
          const club = [...this.clubs.values()].find((c) => c.members.has(event.winnerId as string));
          if (club) {
            club.rankingPoints += event.kind === 'tournoi' ? 120 : 50;
            club.history.push({ at: now, label: `Victoire — ${event.name}` });
          }
        }
      }
    }
  }

  onDay(context: SimulationContext, _date: GameDate): void {
    if (!this.connected) return;
    // Sauvegarde automatique quotidienne protégée (Tome X, ch. 8).
    this.registerAutosave('auto:quotidien', `auto-${context.clock.absoluteMinutes.toString(16)}`);

    // La réputation en ligne du joueur suit sa réputation sportive.
    const local = this.players.get(this.localPlayerId);
    if (local && this.career?.hasCareer) {
      local.reputation = this.career.player.reputation;
      local.trophies.length = 0;
      local.trophies.push(...this.career.trophyList.map((t) => t.name));
      local.showcaseVehicles.length = 0;
      local.showcaseVehicles.push(...this.economy.garage.slice(0, 3).map((v) => v.label));
    }
  }

  serialize(): unknown {
    return {
      localPlayerId: this.localPlayerId,
      connected: this.connected,
      players: [...this.players.values()].map((p) => ({ ...p })),
      hubs: [...this.hubs.values()].map((h) => ({ ...h, occupants: [...h.occupants] })),
      clubs: [...this.clubs.values()].map((c) => ({ ...c, members: [...c.members.entries()] })),
      events: [...this.events.values()].map((e) => ({ ...e, participants: [...e.participants] })),
      coopSessions: [...this.coopSessions.values()].map((s) => ({ ...s, participants: [...s.participants] })),
      friends: [...this.friends.values()],
      groups: [...this.groups.values()].map((g) => ({ ...g, members: [...g.members] })),
      media: this.media.slice(-100),
      reports: [...this.reports.values()],
      cheatSignals: this.cheatSignals.slice(-100),
      cloud: this.cloud,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.localPlayerId = (state.localPlayerId as string) ?? 'player:1';
    this.connected = Boolean(state.connected);

    this.players.clear();
    for (const player of (state.players as OnlinePlayer[]) ?? []) this.players.set(player.id, player);

    this.hubs.clear();
    for (const raw of (state.hubs as Array<Omit<SocialHub, 'occupants'> & { occupants: string[] }>) ?? []) {
      this.hubs.set(raw.id, { ...raw, occupants: new Set(raw.occupants) });
    }

    this.clubs.clear();
    for (const raw of (state.clubs as Array<Omit<OnlineClub, 'members'> & { members: [string, ClubRole][] }>) ?? []) {
      this.clubs.set(raw.id, { ...raw, members: new Map(raw.members) });
    }

    this.events.clear();
    for (const raw of (state.events as Array<Omit<OnlineEvent, 'participants'> & { participants: string[] }>) ?? []) {
      this.events.set(raw.id, { ...raw, participants: new Set(raw.participants) });
    }

    this.coopSessions.clear();
    for (const raw of (state.coopSessions as Array<Omit<CoopSession, 'participants'> & { participants: string[] }>) ?? []) {
      this.coopSessions.set(raw.id, { ...raw, participants: new Set(raw.participants) });
    }

    this.friends.clear();
    for (const friend of (state.friends as FriendEntry[]) ?? []) this.friends.set(friend.playerId, friend);

    this.groups.clear();
    for (const raw of (state.groups as Array<Omit<CommunityGroup, 'members'> & { members: string[] }>) ?? []) {
      this.groups.set(raw.id, { ...raw, members: new Set(raw.members) });
    }

    this.media.length = 0;
    this.media.push(...(((state.media as SharedMedia[]) ?? [])));
    this.reports.clear();
    for (const report of (state.reports as ModerationReport[]) ?? []) this.reports.set(report.id, report);
    this.cheatSignals.length = 0;
    this.cheatSignals.push(...(((state.cheatSignals as CheatSignal[]) ?? [])));
    if (state.cloud) this.cloud = state.cloud as CloudSaveState;
    this.counter = (state.counter as number) ?? 0;

    if (this.hubs.size === 0) this.buildHubs();
  }
}
