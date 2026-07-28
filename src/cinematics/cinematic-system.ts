/**
 * Infinity Football — Cinématiques, mise en scène & réalisation
 *
 * Tome XVI intégralement : Match Day, transferts, vie personnelle, trophées,
 * open world, réalisation TV adaptative, cinématiques toujours passables.
 * Tome XIV, ch. 4 : caméras inspirées des grandes chaînes sportives
 * (travelling, drone, hélicoptère, tunnel, vestiaire, supporters, ralentis
 * intelligents, gros plans émotionnels).
 * Tome XXV, ch. 4 : une IA choisit automatiquement les angles, les ralentis,
 * les gros plans et les réactions du public — chaque cinématique est différente.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import type { MatchEvent } from '../football/match-engine.js';
import { ANIMATION_SERVICE, type AnimationSystem } from '../animation/animation-system.js';
import { AUDIO_SERVICE, type AudioSystem } from '../audio/audio-system.js';

export const CINEMATIC_SERVICE = 'cinematics';

export type CameraRig =
  | 'travelling'
  | 'drone'
  | 'hélicoptère'
  | 'tunnel'
  | 'vestiaire'
  | 'supporters'
  | 'caméra de but'
  | 'caméra tactique'
  | 'steadicam'
  | 'grue'
  | 'caméra épaule'
  | 'ralenti ultra'
  | 'gros plan émotionnel';

export type CinematicCategory =
  | 'match day'
  | 'transfert'
  | 'vie personnelle'
  | 'trophée'
  | 'open world'
  | 'cérémonie'
  | 'après-match';

export interface Shot {
  readonly rig: CameraRig;
  readonly durationSeconds: number;
  /** Description du cadrage, exploitée par le moteur de rendu. */
  readonly framing: string;
  /** Ralenti appliqué (1 = temps réel). */
  readonly timeScale: number;
  /** Focale en millimètres. */
  readonly focalLength: number;
  /** Le plan suit un acteur précis. */
  readonly subjectId: string | null;
}

export interface CinematicSequence {
  readonly id: string;
  readonly category: CinematicCategory;
  readonly name: string;
  readonly shots: readonly Shot[];
  readonly totalSeconds: number;
  /** Peut être passée par le joueur (Tome XVI, ch. 1). */
  readonly skippable: boolean;
  /** Intensité musicale suggérée 0..1. */
  readonly musicIntensity: number;
}

export interface DirectionContext {
  /** Importance du match ou du moment 0..1. */
  readonly stakes: number;
  readonly competitionPrestige: number;
  readonly stadiumAtmosphere: number;
  /** Sévérité météo 0..1. */
  readonly weatherSeverity: number;
  /** Écart au score. */
  readonly goalDifference: number;
  /** Minute courante. */
  readonly minute: number;
  /** Temps restant en minutes. */
  readonly minutesRemaining: number;
}

/** Séquences fixes du Tome XVI, ch. 2 à 6 — l'ordre suit le GDD. */
const MATCH_DAY_BEATS: readonly { name: string; rig: CameraRig; seconds: number; framing: string }[] = [
  { name: 'arrivée du bus', rig: 'travelling', seconds: 14, framing: 'suivi latéral du bus, supporters au premier plan' },
  { name: 'arrivée des joueurs', rig: 'steadicam', seconds: 12, framing: 'descente du bus, plan taille' },
  { name: 'entrée dans le stade', rig: 'caméra épaule', seconds: 10, framing: 'dos des joueurs, couloirs' },
  { name: 'tunnel', rig: 'tunnel', seconds: 9, framing: 'contre-plongée dans le tunnel' },
  { name: 'échauffement', rig: 'drone', seconds: 12, framing: 'survol de la pelouse' },
  { name: 'vestiaire', rig: 'vestiaire', seconds: 15, framing: 'plans serrés sur les visages' },
  { name: 'dernier discours', rig: 'gros plan émotionnel', seconds: 18, framing: 'gros plan sur le capitaine' },
  { name: 'entrée sur la pelouse', rig: 'grue', seconds: 13, framing: 'élévation depuis le tunnel vers la tribune' },
  { name: 'hymnes', rig: 'travelling', seconds: 20, framing: 'panoramique lent sur la ligne des joueurs' },
  { name: 'présentation des équipes', rig: 'caméra tactique', seconds: 11, framing: 'plan large des deux onze' },
];

const TRANSFER_BEATS: readonly { name: string; rig: CameraRig; seconds: number; framing: string }[] = [
  { name: 'arrivée en avion', rig: 'hélicoptère', seconds: 12, framing: 'suivi aérien de l’appareil' },
  { name: 'accueil à l’aéroport', rig: 'caméra épaule', seconds: 14, framing: 'foule et écharpes brandies' },
  { name: 'visite du stade', rig: 'steadicam', seconds: 16, framing: 'traversée des tribunes vides' },
  { name: 'visite des installations', rig: 'travelling', seconds: 13, framing: 'centre d’entraînement, salle de musculation' },
  { name: 'examens médicaux', rig: 'caméra épaule', seconds: 10, framing: 'plans techniques, matériel médical' },
  { name: 'signature', rig: 'gros plan émotionnel', seconds: 12, framing: 'gros plan sur le stylo et la main' },
  { name: 'présentation avec le maillot', rig: 'grue', seconds: 15, framing: 'montée sur la pelouse, maillot brandi' },
  { name: 'conférence de presse', rig: 'caméra tactique', seconds: 14, framing: 'pupitre, mur de sponsors' },
  { name: 'première rencontre avec les supporters', rig: 'supporters', seconds: 16, framing: 'contre-champ tribune' },
];

const PERSONAL_LIFE_SEQUENCES: Record<string, { rigs: CameraRig[]; seconds: number; framing: string }> = {
  'achat d’une maison': { rigs: ['drone', 'steadicam', 'travelling'], seconds: 42, framing: 'survol puis traversée des pièces' },
  'achat d’une voiture': { rigs: ['travelling', 'gros plan émotionnel', 'drone'], seconds: 38, framing: 'tour du véhicule, remise des clés' },
  'naissance d’un enfant': { rigs: ['gros plan émotionnel', 'steadicam'], seconds: 46, framing: 'plans serrés, lumière douce' },
  mariage: { rigs: ['grue', 'steadicam', 'gros plan émotionnel', 'drone'], seconds: 62, framing: 'cérémonie, échange, sortie' },
  anniversaire: { rigs: ['steadicam', 'gros plan émotionnel'], seconds: 34, framing: 'table, bougies, réactions' },
  vacances: { rigs: ['drone', 'travelling'], seconds: 40, framing: 'côte, plage, activités' },
  'inauguration du musée': { rigs: ['grue', 'steadicam', 'travelling'], seconds: 55, framing: 'ruban, galeries, vitrines' },
  'remise des clés d’une villa': { rigs: ['drone', 'gros plan émotionnel'], seconds: 36, framing: 'portail, clés, intérieur' },
};

const OPEN_WORLD_SEQUENCES: Record<string, { rigs: CameraRig[]; seconds: number; framing: string }> = {
  'monter dans un avion': { rigs: ['travelling', 'steadicam'], seconds: 18, framing: 'passerelle, cabine' },
  embarquement: { rigs: ['caméra épaule'], seconds: 14, framing: 'porte d’embarquement, carte scannée' },
  décollage: { rigs: ['hélicoptère', 'travelling'], seconds: 16, framing: 'roulage puis rotation' },
  atterrissage: { rigs: ['hélicoptère'], seconds: 15, framing: 'approche finale, toucher des roues' },
  'arrivée à l’hôtel': { rigs: ['steadicam', 'travelling'], seconds: 17, framing: 'hall, réception, ascenseur' },
  'livraison d’une voiture': { rigs: ['drone', 'gros plan émotionnel'], seconds: 22, framing: 'camion, bâche retirée, clés' },
  'réception d’un colis': { rigs: ['caméra épaule'], seconds: 9, framing: 'porte, signature, colis' },
  déménagement: { rigs: ['travelling', 'drone'], seconds: 26, framing: 'cartons, camion, nouvelle adresse' },
  'ouverture d’un garage': { rigs: ['travelling', 'drone'], seconds: 19, framing: 'porte qui se lève, véhicules alignés' },
};

export class CinematicSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'cinematics',
    name: 'Cinématiques & réalisation',
    order: 115,
    tomes: ['XIV', 'XVI', 'XXV'],
  };

  private context!: SimulationContext;
  private animation!: AnimationSystem;
  private audio!: AudioSystem;
  private readonly history: CinematicSequence[] = [];
  private skipAll = false;
  private counter = 0;
  /** Rigs récemment utilisés, pour ne pas enchaîner deux fois le même plan. */
  private readonly recentRigs: CameraRig[] = [];

  init(context: SimulationContext): void {
    this.context = context;
    this.animation = context.require<AnimationSystem>(ANIMATION_SERVICE);
    this.audio = context.require<AudioSystem>(AUDIO_SERVICE);
    context.provide(CINEMATIC_SERVICE, this);
  }

  /** Le joueur choisit de regarder ou de passer (Tome XVI, ch. 1). */
  setSkipAll(skip: boolean): void {
    this.skipAll = skip;
  }

  get skippingAll(): boolean {
    return this.skipAll;
  }

  get played(): readonly CinematicSequence[] {
    return this.history;
  }

  // ── Match Day (Tome XVI, ch. 2) ──────────────────────────────────────────

  buildMatchDay(direction: DirectionContext, subjectId: string | null = null): CinematicSequence {
    const rng = this.context.stream('cinematics.matchday');
    // Un match sans enjeu ne mérite pas la séquence complète.
    const beats = direction.stakes > 0.55 ? MATCH_DAY_BEATS : MATCH_DAY_BEATS.slice(4);
    const shots: Shot[] = beats.map((beat) => ({
      rig: beat.rig,
      durationSeconds: round(beat.seconds * (0.85 + direction.stakes * 0.4), 1),
      framing: beat.framing,
      timeScale: 1,
      focalLength: this.focalFor(beat.rig, rng),
      subjectId,
    }));
    return this.finalise('match day', 'Match Day', shots, clamp01(0.5 + direction.stakes * 0.5));
  }

  // ── Transfert (Tome XVI, ch. 3) ──────────────────────────────────────────

  buildTransfer(playerId: string, spectacular: boolean): CinematicSequence {
    const rng = this.context.stream('cinematics.transfer');
    const beats = spectacular ? TRANSFER_BEATS : TRANSFER_BEATS.slice(2);
    const shots: Shot[] = beats.map((beat) => ({
      rig: beat.rig,
      durationSeconds: beat.seconds,
      framing: beat.framing,
      timeScale: 1,
      focalLength: this.focalFor(beat.rig, rng),
      subjectId: playerId,
    }));
    return this.finalise('transfert', 'Présentation officielle', shots, spectacular ? 0.9 : 0.6);
  }

  /** Départ d'un club : réactions des supporters et adieux des coéquipiers. */
  buildDeparture(playerId: string, fanSentiment: number): CinematicSequence {
    const rng = this.context.stream('cinematics.departure');
    const shots: Shot[] = [
      { rig: 'vestiaire', durationSeconds: 14, framing: 'adieux aux coéquipiers', timeScale: 1, focalLength: this.focalFor('vestiaire', rng), subjectId: playerId },
      { rig: 'supporters', durationSeconds: 16, framing: fanSentiment > 0 ? 'tribune reconnaissante, écharpes levées' : 'tribune silencieuse, quelques sifflets', timeScale: 1, focalLength: this.focalFor('supporters', rng), subjectId: null },
      { rig: 'gros plan émotionnel', durationSeconds: 12, framing: 'dernier regard vers la pelouse', timeScale: 0.85, focalLength: 135, subjectId: playerId },
      { rig: 'travelling', durationSeconds: 10, framing: 'sortie par le parking, voiture qui s’éloigne', timeScale: 1, focalLength: this.focalFor('travelling', rng), subjectId: playerId },
    ];
    return this.finalise('transfert', 'Départ du club', shots, clamp01(0.55 + Math.abs(fanSentiment) * 0.35));
  }

  // ── Vie personnelle (Tome XVI, ch. 4) ────────────────────────────────────

  buildPersonalLife(moment: keyof typeof PERSONAL_LIFE_SEQUENCES | string, subjectId: string): CinematicSequence {
    const rng = this.context.stream('cinematics.life');
    const preset = PERSONAL_LIFE_SEQUENCES[moment] ?? {
      rigs: ['steadicam', 'gros plan émotionnel'] as CameraRig[],
      seconds: 30,
      framing: 'plans d’ambiance',
    };
    const perShot = preset.seconds / Math.max(1, preset.rigs.length);
    const shots: Shot[] = preset.rigs.map((rig) => ({
      rig,
      durationSeconds: round(perShot, 1),
      framing: preset.framing,
      timeScale: rig === 'gros plan émotionnel' ? 0.9 : 1,
      focalLength: this.focalFor(rig, rng),
      subjectId,
    }));
    return this.finalise('vie personnelle', String(moment), shots, 0.6);
  }

  // ── Trophées (Tome XVI, ch. 5) ───────────────────────────────────────────

  buildTrophy(trophyName: string, subjectId: string, familyPresent: readonly string[]): CinematicSequence {
    const rng = this.context.stream('cinematics.trophy');
    const shots: Shot[] = [
      { rig: 'grue', durationSeconds: 12, framing: 'montée vers le podium', timeScale: 1, focalLength: this.focalFor('grue', rng), subjectId },
      { rig: 'gros plan émotionnel', durationSeconds: 9, framing: `mains sur le ${trophyName}`, timeScale: 0.75, focalLength: 180, subjectId },
      { rig: 'ralenti ultra', durationSeconds: 8, framing: 'trophée soulevé, confettis figés', timeScale: 0.25, focalLength: 85, subjectId },
      { rig: 'supporters', durationSeconds: 11, framing: 'tribune en fusion', timeScale: 1, focalLength: this.focalFor('supporters', rng), subjectId: null },
      ...(familyPresent.length > 0
        ? [{
            rig: 'gros plan émotionnel' as CameraRig,
            durationSeconds: 10,
            framing: `réactions de ${familyPresent.slice(0, 2).join(' et ')}`,
            timeScale: 1,
            focalLength: 135,
            subjectId: null,
          }]
        : []),
      { rig: 'drone', durationSeconds: 13, framing: 'survol du tour d’honneur', timeScale: 1, focalLength: this.focalFor('drone', rng), subjectId: null },
      { rig: 'caméra tactique', durationSeconds: 12, framing: 'conférence de presse d’après-victoire', timeScale: 1, focalLength: 50, subjectId },
    ];
    return this.finalise('trophée', `Sacre — ${trophyName}`, shots, 1);
  }

  // ── Open world (Tome XVI, ch. 6) ─────────────────────────────────────────

  buildOpenWorld(moment: keyof typeof OPEN_WORLD_SEQUENCES | string, subjectId: string | null): CinematicSequence {
    const rng = this.context.stream('cinematics.openworld');
    const preset = OPEN_WORLD_SEQUENCES[moment] ?? {
      rigs: ['steadicam'] as CameraRig[],
      seconds: 12,
      framing: 'plan d’ambiance',
    };
    const perShot = preset.seconds / Math.max(1, preset.rigs.length);
    const shots: Shot[] = preset.rigs.map((rig) => ({
      rig,
      durationSeconds: round(perShot, 1),
      framing: preset.framing,
      timeScale: 1,
      focalLength: this.focalFor(rig, rng),
      subjectId,
    }));
    return this.finalise('open world', String(moment), shots, 0.4);
  }

  // ── Réalisation TV adaptative (Tome XVI, ch. 7 ; Tome XXV, ch. 4) ────────

  /**
   * L'IA de réalisation choisit le plan à diffuser pour un événement de match.
   * Le choix dépend de l'enjeu, du stade, de la météo, du score et du temps
   * restant : deux buts identiques ne sont jamais filmés pareil.
   */
  directMatchEvent(event: MatchEvent, direction: DirectionContext): CinematicSequence {
    const rng = this.context.stream('cinematics.direction');
    const shots: Shot[] = [];

    const tension = clamp01(
      event.drama * 0.5 +
        direction.stakes * 0.25 +
        (Math.abs(direction.goalDifference) <= 1 && direction.minutesRemaining < 15 ? 0.25 : 0),
    );

    switch (event.kind) {
      case 'but': {
        shots.push({
          rig: 'caméra de but',
          durationSeconds: 4,
          framing: 'action en direct depuis l’axe',
          timeScale: 1,
          focalLength: this.focalFor('caméra de but', rng),
          subjectId: event.playerId,
        });
        // Ralenti intelligent : plus le but est important, plus il est étiré.
        shots.push({
          rig: 'ralenti ultra',
          durationSeconds: round(4 + tension * 5, 1),
          framing: 'ralenti du geste, angle latéral',
          timeScale: round(0.5 - tension * 0.28, 2),
          focalLength: 120,
          subjectId: event.playerId,
        });
        shots.push({
          rig: 'gros plan émotionnel',
          durationSeconds: round(3 + tension * 3, 1),
          framing: 'célébration, visage du buteur',
          timeScale: 1,
          focalLength: 180,
          subjectId: event.playerId,
        });
        if (direction.stadiumAtmosphere > 0.7) {
          shots.push({
            rig: 'supporters',
            durationSeconds: 4,
            framing: 'réaction du virage',
            timeScale: 1,
            focalLength: this.focalFor('supporters', rng),
            subjectId: null,
          });
        }
        if (tension > 0.75) {
          shots.push({
            rig: 'drone',
            durationSeconds: 5,
            framing: 'survol du stade en liesse',
            timeScale: 1,
            focalLength: 24,
            subjectId: null,
          });
        }
        break;
      }
      case 'arret':
        shots.push({
          rig: 'ralenti ultra',
          durationSeconds: 5,
          framing: 'ralenti de la parade, plan rapproché',
          timeScale: 0.35,
          focalLength: 200,
          subjectId: event.playerId,
        });
        shots.push({
          rig: 'gros plan émotionnel',
          durationSeconds: 3,
          framing: 'visage du gardien',
          timeScale: 1,
          focalLength: 180,
          subjectId: event.playerId,
        });
        break;
      case 'rouge':
        shots.push({
          rig: 'caméra épaule',
          durationSeconds: 6,
          framing: 'protestations autour de l’arbitre',
          timeScale: 1,
          focalLength: 35,
          subjectId: event.playerId,
        });
        shots.push({
          rig: 'ralenti ultra',
          durationSeconds: 6,
          framing: 'ralenti du contact, trois angles',
          timeScale: 0.3,
          focalLength: 135,
          subjectId: event.playerId,
        });
        shots.push({
          rig: 'gros plan émotionnel',
          durationSeconds: 4,
          framing: 'sortie du joueur, tête basse',
          timeScale: 1,
          focalLength: 180,
          subjectId: event.playerId,
        });
        break;
      case 'blessure':
        shots.push({
          rig: 'caméra épaule',
          durationSeconds: 6,
          framing: 'staff médical sur la pelouse',
          timeScale: 1,
          focalLength: 50,
          subjectId: event.playerId,
        });
        shots.push({
          rig: 'gros plan émotionnel',
          durationSeconds: 5,
          framing: 'visage marqué par la douleur',
          timeScale: 1,
          focalLength: 200,
          subjectId: event.playerId,
        });
        break;
      case 'finMatch':
        shots.push({
          rig: 'grue',
          durationSeconds: 8,
          framing: 'plan large sur le coup de sifflet final',
          timeScale: 1,
          focalLength: 24,
          subjectId: null,
        });
        shots.push({
          rig: 'supporters',
          durationSeconds: 7,
          framing: 'tribunes, écharpes, réactions',
          timeScale: 1,
          focalLength: 85,
          subjectId: null,
        });
        break;
      default:
        shots.push({
          rig: this.pickFreshRig(['travelling', 'caméra tactique', 'steadicam'], rng),
          durationSeconds: 4,
          framing: 'suivi de l’action',
          timeScale: 1,
          focalLength: 50,
          subjectId: event.playerId,
        });
        break;
    }

    // La météo impose ses contraintes : pas de drone dans la tempête.
    const filtered =
      direction.weatherSeverity > 0.6
        ? shots.filter((shot) => shot.rig !== 'drone' && shot.rig !== 'hélicoptère')
        : shots;

    return this.finalise(
      'après-match',
      `Réalisation — ${event.kind} (${event.minute}′)`,
      filtered.length > 0 ? filtered : shots,
      tension,
    );
  }

  /** Plan d'ouverture de retransmission, adapté au contexte du match. */
  broadcastOpening(direction: DirectionContext, stadiumName: string, cityName: string): CinematicSequence {
    const rng = this.context.stream('cinematics.opening');
    const aerial: CameraRig = direction.weatherSeverity > 0.5 ? 'grue' : 'hélicoptère';
    const shots: Shot[] = [
      { rig: aerial, durationSeconds: 9, framing: `survol de ${cityName}`, timeScale: 1, focalLength: 24, subjectId: null },
      { rig: 'drone', durationSeconds: 7, framing: `approche de ${stadiumName}`, timeScale: 1, focalLength: 20, subjectId: null },
      { rig: 'supporters', durationSeconds: 6, framing: 'abords du stade, vendeurs et chants', timeScale: 1, focalLength: 35, subjectId: null },
      { rig: 'travelling', durationSeconds: 6, framing: 'panoramique sur les tribunes qui se remplissent', timeScale: 1, focalLength: this.focalFor('travelling', rng), subjectId: null },
    ];
    const filtered = direction.weatherSeverity > 0.6 ? shots.filter((s) => s.rig !== 'drone') : shots;
    return this.finalise('match day', 'Ouverture de retransmission', filtered, clamp01(0.4 + direction.stakes * 0.5));
  }

  // ── Lecture ──────────────────────────────────────────────────────────────

  /**
   * Joue une séquence : avance l'horloge, déclenche l'audio et les animations.
   * Retourne la durée réellement écoulée (0 si passée).
   */
  play(sequence: CinematicSequence, options: { skip?: boolean } = {}): number {
    const skipped = options.skip ?? this.skipAll;
    if (!skipped) {
      this.audio.duck('ambiance', 0.35);
      this.audio.duck('foule', 0.2);
      for (const shot of sequence.shots) {
        if (shot.subjectId) {
          this.animation.resolve({
            family: sequence.category === 'trophée' ? 'célébrer' : 'marcher',
            actorId: shot.subjectId,
            context: `cinématique — ${sequence.name}`,
          });
        }
      }
      this.context.emit({
        type: 'audio.cue',
        cueId: `cinematic:${sequence.id}`,
        bus: 'musique',
        intensity: sequence.musicIntensity,
      });
      // La cinématique consomme du temps de jeu.
      this.context.clock.advanceMinutes(Math.max(1, Math.round(sequence.totalSeconds / 60)));
      this.audio.releaseDuck('ambiance');
      this.audio.releaseDuck('foule');
    }

    this.context.emit({
      type: 'cinematic.played',
      cinematicId: sequence.id,
      category: sequence.category,
      durationSeconds: sequence.totalSeconds,
      skipped,
    });
    return skipped ? 0 : sequence.totalSeconds;
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  private finalise(
    category: CinematicCategory,
    name: string,
    shots: readonly Shot[],
    musicIntensity: number,
  ): CinematicSequence {
    const totalSeconds = round(shots.reduce((sum, shot) => sum + shot.durationSeconds, 0), 1);
    const sequence: CinematicSequence = {
      id: `cine:${this.counter++}`,
      category,
      name,
      shots,
      totalSeconds,
      skippable: true,
      musicIntensity: clamp01(musicIntensity),
    };
    this.history.push(sequence);
    if (this.history.length > 200) this.history.splice(0, this.history.length - 200);
    for (const shot of shots) this.noteRig(shot.rig);
    return sequence;
  }

  private focalFor(rig: CameraRig, rng: Rng): number {
    const table: Partial<Record<CameraRig, [number, number]>> = {
      drone: [16, 28],
      hélicoptère: [20, 50],
      grue: [24, 50],
      travelling: [35, 85],
      steadicam: [28, 50],
      'caméra épaule': [24, 50],
      tunnel: [18, 35],
      vestiaire: [24, 50],
      supporters: [70, 200],
      'caméra de but': [50, 135],
      'caméra tactique': [24, 35],
      'ralenti ultra': [85, 300],
      'gros plan émotionnel': [135, 300],
    };
    const range = table[rig] ?? [35, 85];
    return Math.round(rng.range(range[0], range[1]));
  }

  /** Évite de réutiliser un rig employé dans les trois derniers plans. */
  private pickFreshRig(candidates: readonly CameraRig[], rng: Rng): CameraRig {
    const fresh = candidates.filter((rig) => !this.recentRigs.includes(rig));
    return rng.pick(fresh.length > 0 ? fresh : candidates);
  }

  private noteRig(rig: CameraRig): void {
    this.recentRigs.push(rig);
    while (this.recentRigs.length > 3) this.recentRigs.shift();
  }

  /** Nombre de combinaisons de réalisation distinctes disponibles. */
  directionVolume(): number {
    const rigs = 13;
    const framings = 9;
    const timeScales = 5;
    const focalBuckets = 6;
    return rigs * framings * timeScales * focalBuckets;
  }

  serialize(): unknown {
    return { history: this.history.slice(-60), skipAll: this.skipAll, counter: this.counter };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.history.length = 0;
    this.history.push(...(((state.history as CinematicSequence[]) ?? [])));
    this.skipAll = Boolean(state.skipAll);
    this.counter = (state.counter as number) ?? 0;
  }
}

/** Durée totale d'un enchaînement de séquences, en secondes. */
export function totalDuration(sequences: readonly CinematicSequence[]): number {
  return round(sequences.reduce((sum, sequence) => sum + sequence.totalSeconds, 0), 1);
}

/** Intensité dramatique moyenne, exploitée par le mixage musical. */
export function averageIntensity(sequences: readonly CinematicSequence[]): number {
  if (sequences.length === 0) return 0;
  return round(
    clamp(sequences.reduce((sum, s) => sum + s.musicIntensity, 0) / sequences.length, 0, 1),
    3,
  );
}
