/**
 * Infinity Football — Legacy / Histoire du monde, records et archives
 *
 * Tome XVII : le temps passe, le jeu conserve tout, Hall of Fame mondial,
 * musées, documentaires générés, réputation qui perdure, héritage de légende.
 * Tome XXVIII : statistiques détaillées, records classés par échelle, archives
 * consultables, comparaisons, ligne du temps interactive, archives vidéo.
 * Tome XXVI, ch. 6 : héritage culturel (statue, rue, fresque, exposition,
 * journée commémorative).
 * Tome XXXII, ch. 6 : album photo, chronologie personnelle, bibliothèque vidéo.
 *
 * Ce système est la mémoire officielle de la sauvegarde : il écoute tout le bus
 * d'événements et n'oublie rien.
 */

import { round } from '../core/math.js';
import { dateFromAbsoluteMinutes, formatDateFr } from '../core/clock.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { GameEvent } from '../core/events.js';
import { getClub } from '../data/clubs.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';
import { careerTotals } from '../career/player.js';

export const LEGACY_SERVICE = 'legacy';

export type RecordScope = 'club' | 'championnat' | 'compétition' | 'pays' | 'continent' | 'monde';

export interface WorldRecord {
  readonly id: string;
  readonly name: string;
  readonly scope: RecordScope;
  readonly scopeId: string;
  holderId: string;
  holderName: string;
  value: number;
  readonly unit: string;
  setAt: number;
  dateLabel: string;
  /** Contexte narratif du record. */
  context: string;
  /** Séquence vidéo archivée, si disponible. */
  videoClipId: string | null;
}

export interface HallOfFameEntry {
  readonly personId: string;
  readonly personName: string;
  readonly category: 'player' | 'manager' | 'president' | 'referee';
  readonly inductedAt: number;
  readonly inductionSeason: number;
  readonly citation: string;
  /** Veste officielle remise lors de l'intronisation (Tome XXI, ch. 3). */
  readonly jacketNumber: number;
  readonly plaque: string;
}

export interface TimelineEntry {
  readonly at: number;
  readonly dateLabel: string;
  readonly category:
    | 'débuts'
    | 'transfert'
    | 'blessure'
    | 'record'
    | 'trophée'
    | 'récompense'
    | 'vie personnelle'
    | 'retraite'
    | 'héritage';
  readonly title: string;
  readonly detail: string;
  /** Renvoi vers une archive consultable. */
  readonly archiveId: string | null;
}

export interface ArchiveItem {
  readonly id: string;
  readonly kind: 'match' | 'finale' | 'cérémonie' | 'conférence' | 'présentation' | 'ralenti' | 'célébration' | 'discours';
  readonly title: string;
  readonly at: number;
  readonly dateLabel: string;
  /** Angles de caméra disponibles au replay (Tome XXVIII, ch. 7). */
  readonly cameraAngles: readonly string[];
  readonly durationSeconds: number;
  readonly tags: readonly string[];
}

export interface MuseumExhibit {
  readonly id: string;
  readonly kind:
    | 'trophée'
    | 'maillot'
    | 'ballonDor'
    | 'boubjackAward'
    | 'crampons'
    | 'photo'
    | 'video'
    | 'maillotDeLegende';
  readonly label: string;
  readonly acquiredAt: number;
  /** Salle du musée où l'objet est exposé. */
  readonly room: string;
  /** Description affichée sur le cartel. */
  readonly caption: string;
}

export interface MuseumVisitorReview {
  readonly id: string;
  readonly visitorName: string;
  readonly rating: number;
  readonly comment: string;
  readonly at: number;
}

export interface CulturalHonour {
  readonly id: string;
  readonly kind: 'statue' | 'street' | 'mural' | 'exhibition' | 'commemorationDay' | 'stand';
  readonly cityId: string;
  readonly label: string;
  readonly grantedAt: number;
}

export interface Documentary {
  readonly id: string;
  readonly title: string;
  readonly chapters: readonly { title: string; summary: string }[];
  readonly durationMinutes: number;
  readonly producedAt: number;
}

export interface PhotoAlbumEntry {
  readonly id: string;
  readonly caption: string;
  readonly at: number;
  readonly tags: readonly string[];
}

export class LegacySystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'legacy',
    name: 'Legacy & archives mondiales',
    order: 110,
    tomes: ['XVII', 'XXI', 'XXVI', 'XXVIII', 'XXXII'],
  };

  private context!: SimulationContext;
  private career: CareerSystem | null = null;
  private seasons!: SeasonSystem;

  private readonly records = new Map<string, WorldRecord>();
  private readonly hallOfFame: HallOfFameEntry[] = [];
  private readonly timeline: TimelineEntry[] = [];
  private readonly archives: ArchiveItem[] = [];
  private readonly exhibits: MuseumExhibit[] = [];
  private readonly reviews: MuseumVisitorReview[] = [];
  private readonly honours: CulturalHonour[] = [];
  private readonly documentaries: Documentary[] = [];
  private readonly album: PhotoAlbumEntry[] = [];
  /** Recettes cumulées du musée personnel (Tome XXI, ch. 4). */
  private museumRevenue = 0;
  private museumVisitorsTotal = 0;
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(LEGACY_SERVICE, this);

    this.seedGlobalRecords();
    context.events.onAny((event) => this.absorb(event));
  }

  /** Records du monde préexistants : le joueur entre dans une histoire déjà écrite. */
  private seedGlobalRecords(): void {
    const rng = this.context.stream('legacy.seed');
    const seeds: Array<{ id: string; name: string; unit: string; value: number; scope: RecordScope }> = [
      { id: 'goals-season', name: 'Buts sur une saison', unit: 'buts', value: rng.int(44, 52), scope: 'monde' },
      { id: 'goals-career', name: 'Buts en carrière', unit: 'buts', value: rng.int(680, 780), scope: 'monde' },
      { id: 'assists-season', name: 'Passes décisives sur une saison', unit: 'passes', value: rng.int(21, 28), scope: 'monde' },
      { id: 'appearances-career', name: 'Matchs disputés en carrière', unit: 'matchs', value: rng.int(940, 1080), scope: 'monde' },
      { id: 'top-speed', name: 'Vitesse maximale relevée', unit: 'km/h', value: round(rng.range(35.2, 36.9), 1), scope: 'monde' },
      { id: 'clean-sheets', name: 'Clean sheets sur une saison', unit: 'clean sheets', value: rng.int(21, 27), scope: 'monde' },
      { id: 'distance-match', name: 'Distance parcourue sur un match', unit: 'km', value: round(rng.range(13.6, 14.6), 2), scope: 'monde' },
    ];
    for (const seed of seeds) {
      const at = this.context.clock.absoluteMinutes - rng.int(2000, 9000) * 24 * 60;
      this.records.set(seed.id, {
        id: seed.id,
        name: seed.name,
        scope: seed.scope,
        scopeId: 'monde',
        holderId: `legend:${seed.id}`,
        holderName: 'détenteur historique',
        value: seed.value,
        unit: seed.unit,
        setAt: at,
        dateLabel: formatDateFr(dateFromAbsoluteMinutes(at)),
        context: 'record établi avant le début de cette sauvegarde',
        videoClipId: null,
      });
    }
  }

  // ── Absorption du flux d'événements ──────────────────────────────────────

  private absorb(event: GameEvent): void {
    switch (event.type) {
      case 'career.transfer':
        if (event.stage === 'signed') {
          this.addTimeline('transfert', `Transfert vers ${this.clubName(event.toClubId)}`,
            `Indemnité : ${(event.fee / 1_000_000).toFixed(1)} M€`);
        }
        break;
      case 'career.injury':
        this.addTimeline('blessure', `Blessure — ${event.severity}`, `${event.daysOut} jours d'indisponibilité`);
        break;
      case 'career.trophyWon':
        this.addTimeline('trophée', event.trophyName, `Saison ${event.season}`);
        this.addExhibit('trophée', event.trophyName, 'galerie des trophées',
          `Remporté lors de la saison ${event.season}`);
        this.addArchive('finale', `Finale — ${event.trophyName}`, ['trophée', event.competitionId]);
        this.addAlbumEntry(`Soulèvement du trophée ${event.trophyName}`, ['trophée', 'célébration']);
        break;
      // Les palmarès du monde entrent aux archives, jamais dans le musée du
      // joueur : seul ce qu'il a gagné lui-même y est exposé (Tome XXV, ch. 2).
      case 'competition.decided':
        this.addArchive(
          'finale',
          `${event.competitionName} ${event.season} — ${event.championName} champion`,
          ['palmarès', event.competitionId],
        );
        break;
      case 'awards.won':
        if (this.career?.hasCareer && event.winnerId === this.career.player.identity.id) {
          this.addTimeline('récompense', event.categoryName, `Boubjack Awards ${event.season} — ${event.hostCityId}`);
          this.addExhibit('boubjackAward', event.categoryName, 'galerie des récompenses',
            `Boubjack Awards ${event.season}, remis à ${event.hostCityId}`);
          this.addArchive('cérémonie', `Boubjack Awards ${event.season}`, ['cérémonie', 'award']);
        }
        break;
      case 'career.retired':
        this.addTimeline('retraite', 'Fin de carrière', `${event.seasonsPlayed} saisons professionnelles`);
        this.generateCareerDocumentary();
        break;
      case 'legacy.hallOfFame':
        this.induct(event.personId, event.personName, event.category);
        break;
      case 'match.ended':
        this.addArchive('match', `${this.clubName(event.homeClubId)} ${event.homeGoals}-${event.awayGoals} ${this.clubName(event.awayClubId)}`,
          ['match', event.competitionId]);
        break;
      case 'media.pressConference':
        this.addArchive('conférence', `Conférence de presse — ${event.answerTone}`, ['conférence']);
        break;
      case 'life.milestone':
        this.addTimeline('vie personnelle', event.milestone, event.detail);
        this.addAlbumEntry(`${event.milestone} — ${event.detail}`, ['vie personnelle']);
        break;
      default:
        break;
    }
  }

  // ── Records (Tome XXVIII, ch. 3) ─────────────────────────────────────────

  /** Tente d'inscrire une nouvelle marque. Retourne vrai si le record tombe. */
  submitRecord(options: {
    recordId: string;
    name: string;
    scope: RecordScope;
    scopeId: string;
    holderId: string;
    holderName: string;
    value: number;
    unit: string;
    context: string;
    videoClipId?: string | null;
  }): boolean {
    const existing = this.records.get(options.recordId);
    if (existing && options.value <= existing.value) return false;

    const now = this.context.clock.absoluteMinutes;
    const record: WorldRecord = {
      id: options.recordId,
      name: options.name,
      scope: options.scope,
      scopeId: options.scopeId,
      holderId: options.holderId,
      holderName: options.holderName,
      value: options.value,
      unit: options.unit,
      setAt: now,
      dateLabel: formatDateFr(dateFromAbsoluteMinutes(now)),
      context: options.context,
      videoClipId: options.videoClipId ?? null,
    };
    this.records.set(options.recordId, record);

    this.context.emit({
      type: 'legacy.recordBroken',
      recordId: record.id,
      recordName: record.name,
      holderId: record.holderId,
      value: record.value,
      scope: record.scope,
    });
    this.addTimeline('record', record.name, `${record.value} ${record.unit} — ${record.context}`);
    this.addArchive('ralenti', `Record : ${record.name}`, ['record']);
    return true;
  }

  /** Vérifie les records du joueur à partir de ses statistiques agrégées. */
  auditPlayerRecords(): number {
    if (!this.career?.hasCareer) return 0;
    const player = this.career.player;
    const totals = careerTotals(player);
    const seasonStats = player.seasons[player.seasons.length - 1];
    let broken = 0;

    if (seasonStats) {
      if (this.submitRecord({
        recordId: 'goals-season',
        name: 'Buts sur une saison',
        scope: 'monde',
        scopeId: 'monde',
        holderId: player.identity.id,
        holderName: player.identity.name,
        value: seasonStats.goals,
        unit: 'buts',
        context: `saison ${seasonStats.season} avec ${this.clubName(seasonStats.clubId)}`,
      })) broken++;
      if (this.submitRecord({
        recordId: 'assists-season',
        name: 'Passes décisives sur une saison',
        scope: 'monde',
        scopeId: 'monde',
        holderId: player.identity.id,
        holderName: player.identity.name,
        value: seasonStats.assists,
        unit: 'passes',
        context: `saison ${seasonStats.season}`,
      })) broken++;
      if (this.submitRecord({
        recordId: 'top-speed',
        name: 'Vitesse maximale relevée',
        scope: 'monde',
        scopeId: 'monde',
        holderId: player.identity.id,
        holderName: player.identity.name,
        value: seasonStats.topSpeedKmh,
        unit: 'km/h',
        context: 'relevé lors d’une rencontre officielle',
      })) broken++;
    }

    if (this.submitRecord({
      recordId: 'goals-career',
      name: 'Buts en carrière',
      scope: 'monde',
      scopeId: 'monde',
      holderId: player.identity.id,
      holderName: player.identity.name,
      value: totals.goals,
      unit: 'buts',
      context: 'cumul sur toute la carrière',
    })) broken++;
    if (this.submitRecord({
      recordId: 'appearances-career',
      name: 'Matchs disputés en carrière',
      scope: 'monde',
      scopeId: 'monde',
      holderId: player.identity.id,
      holderName: player.identity.name,
      value: totals.appearances,
      unit: 'matchs',
      context: 'cumul sur toute la carrière',
    })) broken++;

    return broken;
  }

  recordsByScope(scope: RecordScope): WorldRecord[] {
    return [...this.records.values()].filter((r) => r.scope === scope);
  }

  record(id: string): WorldRecord | undefined {
    return this.records.get(id);
  }

  get allRecords(): WorldRecord[] {
    return [...this.records.values()];
  }

  // ── Hall of Fame (Tome XVII, ch. 3 ; Tome XXI, ch. 3) ────────────────────

  induct(
    personId: string,
    personName: string,
    category: 'player' | 'manager' | 'president' | 'referee',
  ): HallOfFameEntry | null {
    if (this.hallOfFame.some((entry) => entry.personId === personId)) return null;
    const now = this.context.clock.absoluteMinutes;
    const entry: HallOfFameEntry = {
      personId,
      personName,
      category,
      inductedAt: now,
      inductionSeason: this.seasons.season,
      citation: this.buildCitation(personName, category),
      jacketNumber: this.hallOfFame.length + 1,
      plaque: `${personName} — intronisé en ${dateFromAbsoluteMinutes(now).year}`,
    };
    this.hallOfFame.push(entry);
    this.addTimeline('héritage', 'Intronisation au Hall of Fame', entry.citation);
    this.addArchive('cérémonie', `Intronisation de ${personName} au Hall of Fame`, ['hall of fame', 'discours']);
    return entry;
  }

  private buildCitation(name: string, category: string): string {
    const totals = this.career?.hasCareer ? careerTotals(this.career.player) : null;
    if (category === 'player' && totals) {
      return `${name} — ${totals.appearances} matchs, ${totals.goals} buts, ${totals.assists} passes décisives.`;
    }
    return `${name} — pour l’ensemble de son apport au football.`;
  }

  get hallOfFameEntries(): readonly HallOfFameEntry[] {
    return this.hallOfFame;
  }

  // ── Archives & ligne du temps ────────────────────────────────────────────

  private addArchive(
    kind: ArchiveItem['kind'],
    title: string,
    tags: readonly string[],
  ): ArchiveItem {
    const now = this.context.clock.absoluteMinutes;
    const item: ArchiveItem = {
      id: `archive:${this.counter++}`,
      kind,
      title,
      at: now,
      dateLabel: formatDateFr(dateFromAbsoluteMinutes(now)),
      cameraAngles: ['principale', 'tribune', 'but', 'tunnel', 'drone', 'ralenti émotion'],
      durationSeconds: kind === 'match' ? 5400 : kind === 'cérémonie' ? 2400 : 180,
      tags,
    };
    this.archives.push(item);
    if (this.archives.length > 4000) this.archives.splice(0, this.archives.length - 4000);
    return item;
  }

  private addTimeline(
    category: TimelineEntry['category'],
    title: string,
    detail: string,
    archiveId: string | null = null,
  ): void {
    const now = this.context.clock.absoluteMinutes;
    this.timeline.push({
      at: now,
      dateLabel: formatDateFr(dateFromAbsoluteMinutes(now)),
      category,
      title,
      detail,
      archiveId,
    });
  }

  /** Ligne du temps interactive complète (Tome XXVIII, ch. 6). */
  get playerTimeline(): readonly TimelineEntry[] {
    return this.timeline;
  }

  timelineOf(category: TimelineEntry['category']): TimelineEntry[] {
    return this.timeline.filter((entry) => entry.category === category);
  }

  searchArchives(query: string, limit = 30): ArchiveItem[] {
    const needle = query.trim().toLowerCase();
    return this.archives
      .filter(
        (item) =>
          needle.length === 0 ||
          item.title.toLowerCase().includes(needle) ||
          item.tags.some((tag) => tag.toLowerCase().includes(needle)),
      )
      .slice(-limit)
      .reverse();
  }

  archivesOfKind(kind: ArchiveItem['kind'], limit = 30): ArchiveItem[] {
    return this.archives.filter((item) => item.kind === kind).slice(-limit).reverse();
  }

  /** Compilation exportable (Tome XXVIII, ch. 7). */
  buildCompilation(tag: string, maxItems = 12): { title: string; items: ArchiveItem[]; durationSeconds: number } {
    const items = this.archives.filter((item) => item.tags.includes(tag)).slice(-maxItems);
    return {
      title: `Compilation — ${tag}`,
      items,
      durationSeconds: items.reduce((sum, item) => sum + Math.min(item.durationSeconds, 45), 0),
    };
  }

  // ── Musée personnel (Tome XVII ch. 4 ; Tome XXI ch. 4) ───────────────────

  addExhibit(
    kind: MuseumExhibit['kind'],
    label: string,
    room: string,
    caption: string,
  ): MuseumExhibit {
    const exhibit: MuseumExhibit = {
      id: `exhibit:${this.counter++}`,
      kind,
      label,
      acquiredAt: this.context.clock.absoluteMinutes,
      room,
      caption,
    };
    this.exhibits.push(exhibit);
    return exhibit;
  }

  /** Maillot encadré d'une légende côtoyée (Tome IV ch. 6 ; Tome XX ch. 4). */
  frameLegendShirt(legendName: string, clubName: string): MuseumExhibit {
    return this.addExhibit(
      'maillotDeLegende',
      `Maillot de ${legendName}`,
      'galerie des maillots',
      `Échangé après une rencontre avec ${clubName}`,
    );
  }

  get museum(): { exhibits: readonly MuseumExhibit[]; rooms: string[]; revenue: number; visitors: number } {
    const rooms = [...new Set(this.exhibits.map((e) => e.room))];
    return {
      exhibits: this.exhibits,
      rooms,
      revenue: round(this.museumRevenue, 2),
      visitors: this.museumVisitorsTotal,
    };
  }

  get museumReviews(): readonly MuseumVisitorReview[] {
    return this.reviews;
  }

  /** Le musée vit : visiteurs quotidiens, avis et recettes. */
  private tickMuseum(context: SimulationContext): void {
    if (this.exhibits.length === 0) return;
    const rng = context.stream('legacy.museum');
    const reputation = this.career?.hasCareer ? this.career.player.reputation : 0;
    const visitors = Math.round(
      (10 + reputation * 4 + this.exhibits.length * 1.6) * rng.range(0.7, 1.35),
    );
    const ticketPrice = 12 + Math.round(reputation / 12);
    const revenue = visitors * ticketPrice;
    this.museumVisitorsTotal += visitors;
    this.museumRevenue = round(this.museumRevenue + revenue, 2);

    if (rng.chance(0.35)) {
      const rating = Math.min(5, Math.max(1, Math.round(rng.gaussian(4.3, 0.7))));
      const comments = [
        'La galerie des trophées vaut le déplacement.',
        'Émouvant de voir les crampons des grandes finales.',
        'Les maillots encadrés des légendes sont impressionnants.',
        'Un peu cher, mais la salle vidéo est magnifique.',
        'On ressort avec l’impression d’avoir vécu la carrière.',
        'Manque un peu d’explications sur les débuts.',
      ];
      this.reviews.push({
        id: `review:${this.counter++}`,
        visitorName: `Visiteur ${this.reviews.length + 1}`,
        rating,
        comment: rng.pick(comments),
        at: context.clock.absoluteMinutes,
      });
      if (this.reviews.length > 300) this.reviews.splice(0, this.reviews.length - 300);
    }
  }

  /** Note moyenne du musée, affichée à l'entrée. */
  museumRating(): number {
    if (this.reviews.length === 0) return 0;
    return round(this.reviews.reduce((sum, r) => sum + r.rating, 0) / this.reviews.length, 2);
  }

  /** Encaisse les recettes du musée sur le compte professionnel. */
  collectMuseumRevenue(): number {
    const amount = this.museumRevenue;
    this.museumRevenue = 0;
    return round(amount, 2);
  }

  // ── Héritage culturel (Tome XXVI, ch. 6) ─────────────────────────────────

  grantHonour(
    kind: CulturalHonour['kind'],
    cityId: string,
    label: string,
  ): CulturalHonour {
    const honour: CulturalHonour = {
      id: `honour:${this.counter++}`,
      kind,
      cityId,
      label,
      grantedAt: this.context.clock.absoluteMinutes,
    };
    this.honours.push(honour);
    this.addTimeline('héritage', label, `Hommage rendu à ${cityId}`);
    this.context.emit({
      type: 'legacy.monument',
      kind,
      personId: this.career?.hasCareer ? this.career.player.identity.id : 'inconnu',
      cityId,
    });
    return honour;
  }

  get culturalHonours(): readonly CulturalHonour[] {
    return this.honours;
  }

  // ── Documentaires (Tome XVII, ch. 5) ─────────────────────────────────────

  /** Génère automatiquement le documentaire de fin de carrière. */
  generateCareerDocumentary(): Documentary | null {
    if (!this.career?.hasCareer) return null;
    const player = this.career.player;
    const totals = careerTotals(player);
    const chapters = [
      {
        title: 'Les débuts',
        summary: `${player.identity.backstory}. Premier contrat professionnel à ${player.identity.birthYear + 17} ans.`,
      },
      {
        title: 'Les grands matchs',
        summary: `${this.archives.filter((a) => a.kind === 'finale').length} finales disputées, archivées sous tous les angles.`,
      },
      {
        title: 'Les blessures',
        summary: `${this.timeline.filter((t) => t.category === 'blessure').length} coups d’arrêt traversés.`,
      },
      {
        title: 'Les records',
        summary: `${[...this.records.values()].filter((r) => r.holderId === player.identity.id).length} records mondiaux détenus.`,
      },
      {
        title: 'Les trophées',
        summary: `${this.career.trophyList.length} titres et ${this.career.awardList.length} récompenses individuelles.`,
      },
      {
        title: 'Les moments forts',
        summary: `${totals.goals} buts, ${totals.assists} passes décisives, ${totals.appearances} matchs.`,
      },
    ];
    const documentary: Documentary = {
      id: `doc:${this.counter++}`,
      title: `${player.identity.name} — une vie de football`,
      chapters,
      durationMinutes: 96,
      producedAt: this.context.clock.absoluteMinutes,
    };
    this.documentaries.push(documentary);
    this.addArchive('cérémonie', documentary.title, ['documentaire']);
    return documentary;
  }

  get allDocumentaries(): readonly Documentary[] {
    return this.documentaries;
  }

  // ── Album photo & bibliothèque (Tome XXXII, ch. 6) ───────────────────────

  addAlbumEntry(caption: string, tags: readonly string[]): PhotoAlbumEntry {
    const entry: PhotoAlbumEntry = {
      id: `photo:${this.counter++}`,
      caption,
      at: this.context.clock.absoluteMinutes,
      tags,
    };
    this.album.push(entry);
    if (this.album.length > 2000) this.album.splice(0, this.album.length - 2000);
    return entry;
  }

  get photoAlbum(): readonly PhotoAlbumEntry[] {
    return this.album;
  }

  // ── Comparaisons (Tome XXVIII, ch. 5) ────────────────────────────────────

  /** Compare deux ensembles de statistiques sur un axe donné. */
  compare(
    left: { name: string; stats: Record<string, number> },
    right: { name: string; stats: Record<string, number> },
  ): Array<{ metric: string; left: number; right: number; advantage: string }> {
    const metrics = new Set([...Object.keys(left.stats), ...Object.keys(right.stats)]);
    const rows: Array<{ metric: string; left: number; right: number; advantage: string }> = [];
    for (const metric of metrics) {
      const l = left.stats[metric] ?? 0;
      const r = right.stats[metric] ?? 0;
      rows.push({
        metric,
        left: l,
        right: r,
        advantage: l === r ? 'égalité' : l > r ? left.name : right.name,
      });
    }
    return rows.sort((a, b) => a.metric.localeCompare(b.metric));
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    this.tickMuseum(context);
  }

  onMonth(_context: SimulationContext, _date: GameDate): void {
    this.auditPlayerRecords();
  }

  onYear(context: SimulationContext, date: GameDate): void {
    if (!this.career?.hasCareer) return;
    const player = this.career.player;
    // Hommages culturels décernés aux légendes, y compris après la retraite.
    if (this.career.isLegend && player.clubId) {
      const rng = context.stream('legacy.honours');
      const clubCity = getClub(player.clubId).cityId;
      const candidates: CulturalHonour['kind'][] = ['statue', 'street', 'mural', 'exhibition', 'commemorationDay', 'stand'];
      const already = new Set(this.honours.map((h) => h.kind));
      const remaining = candidates.filter((kind) => !already.has(kind));
      if (remaining.length > 0 && rng.chance(0.45)) {
        const kind = rng.pick(remaining);
        const labels: Record<CulturalHonour['kind'], string> = {
          statue: `Statue de ${player.identity.name} devant le stade`,
          street: `Rue ${player.identity.name}`,
          mural: `Fresque murale à l’effigie de ${player.identity.name}`,
          exhibition: `Exposition permanente consacrée à ${player.identity.name}`,
          commemorationDay: `Journée commémorative ${player.identity.name}`,
          stand: `Tribune ${player.identity.name}`,
        };
        this.grantHonour(kind, clubCity, labels[kind]);
      }
    }
    void date;
  }

  private clubName(clubId: string): string {
    try {
      return getClub(clubId).name;
    } catch {
      return clubId;
    }
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      records: [...this.records.values()],
      hallOfFame: this.hallOfFame,
      timeline: this.timeline,
      archives: this.archives.slice(-1500),
      exhibits: this.exhibits,
      reviews: this.reviews.slice(-200),
      honours: this.honours,
      documentaries: this.documentaries,
      album: this.album.slice(-800),
      museumRevenue: this.museumRevenue,
      museumVisitorsTotal: this.museumVisitorsTotal,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.records.clear();
    for (const record of (state.records as WorldRecord[]) ?? []) this.records.set(record.id, record);
    this.hallOfFame.length = 0;
    this.hallOfFame.push(...(((state.hallOfFame as HallOfFameEntry[]) ?? [])));
    this.timeline.length = 0;
    this.timeline.push(...(((state.timeline as TimelineEntry[]) ?? [])));
    this.archives.length = 0;
    this.archives.push(...(((state.archives as ArchiveItem[]) ?? [])));
    this.exhibits.length = 0;
    this.exhibits.push(...(((state.exhibits as MuseumExhibit[]) ?? [])));
    this.reviews.length = 0;
    this.reviews.push(...(((state.reviews as MuseumVisitorReview[]) ?? [])));
    this.honours.length = 0;
    this.honours.push(...(((state.honours as CulturalHonour[]) ?? [])));
    this.documentaries.length = 0;
    this.documentaries.push(...(((state.documentaries as Documentary[]) ?? [])));
    this.album.length = 0;
    this.album.push(...(((state.album as PhotoAlbumEntry[]) ?? [])));
    this.museumRevenue = (state.museumRevenue as number) ?? 0;
    this.museumVisitorsTotal = (state.museumVisitorsTotal as number) ?? 0;
    this.counter = (state.counter as number) ?? 0;
  }
}
