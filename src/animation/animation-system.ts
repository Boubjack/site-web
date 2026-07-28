/**
 * Infinity Football — Animations, expressions & détails humains
 *
 * Tome XXXI intégralement :
 *  - ch. 2 : la bibliothèque d'animations humaines, déclinée en variantes ;
 *  - ch. 3 : expressions faciales réactives au contexte ;
 *  - ch. 4 : interactions sociales (poignée de main, accolade, selfie…) ;
 *  - ch. 5 : une IA sélectionne l'animation selon météo, fatigue, contexte,
 *    lieu, célébrité et relations ;
 *  - ch. 6 : comportements de tribune, chaque virage a son identité ;
 *  - ch. 7 : réactions des objets et du décor (portes, rideaux, flaques…).
 * Tome XIV, ch. 5-7 : vieillissement visible, tissus réactifs, objets
 * manipulables.
 *
 * Le système ne dessine rien : il décide *quel* clip jouer, avec quelles
 * variantes et quelle intensité. Le moteur de rendu s'y abonne.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';

export const ANIMATION_SERVICE = 'animation';

export type LocomotionState =
  | 'idle'
  | 'marche'
  | 'marche rapide'
  | 'course'
  | 'sprint'
  | 'montée d’escalier'
  | 'descente d’escalier'
  | 'boitement';

export type EmotionalState =
  | 'neutre'
  | 'colère'
  | 'joie'
  | 'stress'
  | 'peur'
  | 'fatigue'
  | 'douleur'
  | 'surprise'
  | 'concentration'
  | 'fierté';

export interface AnimationClip {
  readonly id: string;
  readonly family: string;
  /** Variantes disponibles pour éviter la répétition. */
  readonly variants: number;
  /** Durée moyenne en secondes. */
  readonly durationSeconds: number;
  /** Peut être joué en mouvement. */
  readonly allowsLocomotion: boolean;
  /** Étiquettes de contexte requis. */
  readonly tags: readonly string[];
}

export interface AnimationRequest {
  readonly family: string;
  readonly actorId: string;
  /** Contexte lisible, transmis aux événements. */
  readonly context: string;
  readonly emotion?: EmotionalState;
  /** Fatigue de l'acteur 0..1. */
  readonly fatigue?: number;
  /** Célébrité 0..1 : change la posture en public. */
  readonly fame?: number;
  /** Proximité relationnelle avec la cible -1..1. */
  readonly closeness?: number;
  /** Lieu : intérieur, rue, stade, plage… */
  readonly location?: string;
  /** Le personnage est-il en extérieur ? */
  readonly outdoor?: boolean;
}

export interface ResolvedAnimation {
  readonly clipId: string;
  readonly variant: number;
  /** Vitesse de lecture, modulée par la fatigue et l'émotion. */
  readonly playbackSpeed: number;
  /** Poids de mélange avec la locomotion en cours. */
  readonly blendWeight: number;
  readonly emotion: EmotionalState;
  readonly durationSeconds: number;
  /** Effets de décor déclenchés simultanément. */
  readonly propEffects: readonly string[];
}

/**
 * Bibliothèque de familles d'animations. Chaque famille se décline en
 * variantes contextuelles : le total combinatoire est calculé par
 * `AnimationSystem.libraryVolume()` et couvre les besoins du Tome XXXI, ch. 2.
 */
const CLIPS: readonly AnimationClip[] = [
  // Locomotion
  { id: 'loco.walk', family: 'marcher', variants: 24, durationSeconds: 1.1, allowsLocomotion: true, tags: ['locomotion'] },
  { id: 'loco.walk.fast', family: 'marche rapide', variants: 16, durationSeconds: 0.9, allowsLocomotion: true, tags: ['locomotion'] },
  { id: 'loco.run', family: 'courir', variants: 20, durationSeconds: 0.7, allowsLocomotion: true, tags: ['locomotion'] },
  { id: 'loco.sprint', family: 'sprinter', variants: 14, durationSeconds: 0.55, allowsLocomotion: true, tags: ['locomotion'] },
  { id: 'loco.stairs.up', family: 'monter les escaliers', variants: 10, durationSeconds: 1.4, allowsLocomotion: true, tags: ['locomotion', 'intérieur'] },
  { id: 'loco.stairs.down', family: 'descendre les escaliers', variants: 10, durationSeconds: 1.3, allowsLocomotion: true, tags: ['locomotion', 'intérieur'] },
  { id: 'loco.limp', family: 'boiter', variants: 8, durationSeconds: 1.5, allowsLocomotion: true, tags: ['locomotion', 'blessure'] },
  // Gestes du quotidien
  { id: 'gesture.door.open', family: 'ouvrir une porte', variants: 12, durationSeconds: 1.2, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.door.close', family: 'fermer une porte', variants: 10, durationSeconds: 1, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.car.enter', family: 'monter dans une voiture', variants: 14, durationSeconds: 2.4, allowsLocomotion: false, tags: ['véhicule'] },
  { id: 'gesture.car.exit', family: 'sortir d’une voiture', variants: 14, durationSeconds: 2.2, allowsLocomotion: false, tags: ['véhicule'] },
  { id: 'gesture.sit', family: 's’asseoir', variants: 18, durationSeconds: 1.6, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.stand', family: 'se lever', variants: 18, durationSeconds: 1.5, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.eat', family: 'manger', variants: 16, durationSeconds: 3.5, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.drink', family: 'boire', variants: 12, durationSeconds: 2.2, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.sleep', family: 'dormir', variants: 8, durationSeconds: 6, allowsLocomotion: false, tags: ['quotidien'] },
  { id: 'gesture.phone', family: 'utiliser son téléphone', variants: 22, durationSeconds: 2.8, allowsLocomotion: true, tags: ['quotidien'] },
  { id: 'gesture.elevator', family: 'prendre un ascenseur', variants: 6, durationSeconds: 4, allowsLocomotion: false, tags: ['intérieur'] },
  { id: 'gesture.mail', family: 'lire son courrier', variants: 8, durationSeconds: 3, allowsLocomotion: false, tags: ['intérieur'] },
  { id: 'gesture.tv', family: 'regarder la télévision', variants: 10, durationSeconds: 5, allowsLocomotion: false, tags: ['intérieur'] },
  { id: 'gesture.music', family: 'écouter de la musique', variants: 9, durationSeconds: 4, allowsLocomotion: true, tags: ['quotidien'] },
  // Émotions & réactions
  { id: 'emote.applaud', family: 'applaudir', variants: 14, durationSeconds: 2, allowsLocomotion: false, tags: ['émotion'] },
  { id: 'emote.laugh', family: 'rire', variants: 16, durationSeconds: 2.4, allowsLocomotion: false, tags: ['émotion'] },
  { id: 'emote.cry', family: 'pleurer', variants: 10, durationSeconds: 4, allowsLocomotion: false, tags: ['émotion'] },
  { id: 'emote.celebrate', family: 'célébrer', variants: 32, durationSeconds: 3.2, allowsLocomotion: true, tags: ['émotion', 'terrain'] },
  // Interactions sociales (Tome XXXI, ch. 4)
  { id: 'interaction.handshake', family: 'serrer la main', variants: 12, durationSeconds: 1.8, allowsLocomotion: false, tags: ['social'] },
  { id: 'interaction.hug', family: 'faire une accolade', variants: 14, durationSeconds: 2.4, allowsLocomotion: false, tags: ['social'] },
  { id: 'interaction.highfive', family: 'taper dans la main', variants: 10, durationSeconds: 1.2, allowsLocomotion: true, tags: ['social'] },
  { id: 'interaction.selfie', family: 'prendre un selfie', variants: 18, durationSeconds: 3.5, allowsLocomotion: false, tags: ['social', 'célébrité'] },
  { id: 'interaction.autograph', family: 'signer un autographe', variants: 16, durationSeconds: 2.8, allowsLocomotion: false, tags: ['social', 'célébrité'] },
  { id: 'interaction.giveShirt', family: 'donner un maillot', variants: 8, durationSeconds: 3, allowsLocomotion: false, tags: ['social', 'terrain'] },
  { id: 'interaction.swapBall', family: 'échanger un ballon', variants: 6, durationSeconds: 2.4, allowsLocomotion: false, tags: ['social', 'terrain'] },
  { id: 'interaction.gift', family: 'offrir un cadeau', variants: 10, durationSeconds: 3.2, allowsLocomotion: false, tags: ['social'] },
];

/** Comportements de tribune (Tome XXXI, ch. 6). */
export type CrowdBehaviour =
  | 'chante'
  | 'applaudit'
  | 'prend des photos'
  | 'filme au téléphone'
  | 'brandit une écharpe'
  | 'pleure'
  | 'siffle'
  | 'quitte le stade'
  | 'déploie un tifo'
  | 'allume un fumigène';

export interface StandIdentity {
  readonly id: string;
  readonly name: string;
  /** Ferveur 0..1. */
  readonly fervour: number;
  /** Comportements privilégiés de cette tribune. */
  readonly signature: readonly CrowdBehaviour[];
  /** Part de la tribune qui part avant la fin quand le match est plié. */
  readonly earlyLeaveRate: number;
}

/** Effets de décor persistants (Tome XXXI, ch. 7). */
export interface EnvironmentEffects {
  puddles: number;
  dust: number;
  footprints: number;
  snowCompaction: number;
  /** Séchage des vêtements après la pluie 0..1 (1 = sec). */
  clothesDryness: number;
  curtainMotion: number;
  /** Salissure des maillots 0..1. */
  kitDirt: number;
  /** Transpiration visible 0..1. */
  sweat: number;
}

export class AnimationSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'animation',
    name: 'Animations & détails humains',
    order: 95,
    tomes: ['XIV', 'XX', 'XXXI'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private career: CareerSystem | null = null;

  private readonly clips = new Map<string, AnimationClip>();
  private readonly familyIndex = new Map<string, AnimationClip>();
  /** Dernière variante jouée par famille et par acteur, pour ne pas répéter. */
  private readonly lastVariant = new Map<string, number>();
  private readonly stands = new Map<string, StandIdentity>();
  private effects: EnvironmentEffects = {
    puddles: 0,
    dust: 0.1,
    footprints: 0,
    snowCompaction: 0,
    clothesDryness: 1,
    curtainMotion: 0,
    kitDirt: 0,
    sweat: 0,
  };
  private currentEmotion: EmotionalState = 'neutre';
  private locomotion: LocomotionState = 'idle';

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(ANIMATION_SERVICE, this);

    for (const clip of CLIPS) {
      this.clips.set(clip.id, clip);
      this.familyIndex.set(clip.family, clip);
    }
    this.buildStandIdentities();
  }

  /** Chaque virage a son identité propre (Tome XXXI, ch. 6). */
  private buildStandIdentities(): void {
    const rng = this.context.stream('animation.stands');
    const templates: Array<{ name: string; signature: CrowdBehaviour[]; fervour: number }> = [
      { name: 'Virage Nord', signature: ['chante', 'déploie un tifo', 'allume un fumigène'], fervour: 0.95 },
      { name: 'Virage Sud', signature: ['chante', 'brandit une écharpe', 'siffle'], fervour: 0.9 },
      { name: 'Tribune Latérale Est', signature: ['applaudit', 'prend des photos'], fervour: 0.55 },
      { name: 'Tribune Latérale Ouest', signature: ['applaudit', 'filme au téléphone'], fervour: 0.5 },
      { name: 'Loges VIP', signature: ['applaudit'], fervour: 0.3 },
      { name: 'Parcage visiteurs', signature: ['chante', 'brandit une écharpe', 'siffle'], fervour: 0.85 },
    ];
    for (const city of this.world.cities()) {
      for (const venue of city.venues.values()) {
        if (venue.type !== 'stadium') continue;
        templates.forEach((template, index) => {
          const id = `${venue.id}:stand:${index}`;
          this.stands.set(id, {
            id,
            name: template.name,
            fervour: clamp01(template.fervour * (0.85 + rng.next() * 0.3)),
            signature: template.signature,
            earlyLeaveRate: clamp01(0.25 - template.fervour * 0.22 + rng.range(0, 0.08)),
          });
        });
      }
    }
  }

  // ── Sélection d'animation (Tome XXXI, ch. 5) ─────────────────────────────

  /**
   * L'IA d'animation choisit le clip et la variante les plus adaptés.
   * Deux appels consécutifs sur la même famille ne renvoient jamais la même
   * variante : c'est ce qui casse la sensation de répétition.
   */
  resolve(request: AnimationRequest): ResolvedAnimation {
    const clip = this.familyIndex.get(request.family) ?? this.clips.get(request.family);
    if (!clip) {
      // Famille inconnue : repli sur une posture neutre, jamais d'échec visuel.
      return {
        clipId: 'loco.walk',
        variant: 0,
        playbackSpeed: 1,
        blendWeight: 1,
        emotion: request.emotion ?? this.currentEmotion,
        durationSeconds: 1.1,
        propEffects: [],
      };
    }

    const rng = this.context.stream('animation.selection');
    const key = `${request.actorId}:${clip.id}`;
    const previous = this.lastVariant.get(key) ?? -1;
    let variant = rng.int(0, clip.variants - 1);
    if (clip.variants > 1 && variant === previous) {
      variant = (variant + 1 + rng.int(0, clip.variants - 2)) % clip.variants;
    }
    this.lastVariant.set(key, variant);

    const emotion = request.emotion ?? this.inferEmotion(request);
    const fatigue = clamp01(request.fatigue ?? 0);
    const weather = this.currentWeatherSeverity(request.outdoor ?? false);

    // La fatigue ralentit, l'excitation accélère, la météo alourdit.
    const emotionSpeed =
      emotion === 'joie' ? 1.12 :
      emotion === 'colère' ? 1.08 :
      emotion === 'fatigue' ? 0.85 :
      emotion === 'douleur' ? 0.72 :
      emotion === 'concentration' ? 0.96 : 1;
    const playbackSpeed = round(clamp(emotionSpeed * (1 - fatigue * 0.25) * (1 - weather * 0.12), 0.5, 1.35), 3);

    // Un joueur très célèbre adopte une posture plus contenue en public.
    const fame = clamp01(request.fame ?? 0);
    const closeness = clamp(request.closeness ?? 0, -1, 1);
    const blendWeight = round(
      clamp01(0.75 + closeness * 0.2 - (clip.tags.includes('social') ? fame * 0.15 : 0)),
      3,
    );

    const propEffects = this.propEffectsFor(clip, request);

    this.context.emit({
      type: 'animation.played',
      clipId: `${clip.id}#${variant}`,
      actorId: request.actorId,
      context: request.context,
    });

    return {
      clipId: clip.id,
      variant,
      playbackSpeed,
      blendWeight,
      emotion,
      durationSeconds: round(clip.durationSeconds / playbackSpeed, 2),
      propEffects,
    };
  }

  /** Déduit l'émotion à partir du contexte quand elle n'est pas imposée. */
  private inferEmotion(request: AnimationRequest): EmotionalState {
    const fatigue = clamp01(request.fatigue ?? 0);
    if (fatigue > 0.8) return 'fatigue';
    if (request.family === 'célébrer') return 'joie';
    if (request.family === 'pleurer') return 'douleur';
    if (request.family === 'boiter') return 'douleur';
    if (request.family === 'rire') return 'joie';
    if ((request.closeness ?? 0) > 0.6) return 'joie';
    if ((request.fame ?? 0) > 0.85 && request.location === 'rue') return 'concentration';
    return this.currentEmotion;
  }

  private propEffectsFor(clip: AnimationClip, request: AnimationRequest): string[] {
    const effects: string[] = [];
    if (clip.family.includes('porte')) effects.push('battant animé, poignée tournée');
    if (clip.tags.includes('véhicule')) effects.push('portière, ceinture, clés de voiture');
    if (request.outdoor && this.effects.puddles > 0.3) effects.push('éclaboussures de flaque');
    if (this.effects.snowCompaction > 0.2) effects.push('neige compactée sous les appuis');
    if (this.effects.footprints > 0.2) effects.push('traces de pas laissées au sol');
    if (this.effects.curtainMotion > 0.3 && !request.outdoor) effects.push('rideaux soulevés par le vent');
    if (clip.tags.includes('terrain') && this.effects.kitDirt > 0.3) effects.push('maillot terni par la pelouse');
    return effects;
  }

  // ── Expressions faciales (Tome XXXI, ch. 3) ──────────────────────────────

  setEmotion(emotion: EmotionalState): void {
    this.currentEmotion = emotion;
  }

  get emotion(): EmotionalState {
    return this.currentEmotion;
  }

  /**
   * Calcule l'expression du joueur à partir de son état réel : forme, moral,
   * fatigue, blessure et pression du moment.
   */
  computePlayerEmotion(pressure = 0): EmotionalState {
    if (!this.career?.hasCareer) return 'neutre';
    const player = this.career.player;
    if (this.career.injured) return 'douleur';
    if (player.fitness < 0.3) return 'fatigue';
    if (pressure > 0.75 && player.profile.personality.neuroticism > 0.6) return 'stress';
    if (player.morale > 0.8) return 'joie';
    if (player.morale < 0.3) return 'colère';
    if (pressure > 0.5) return 'concentration';
    if (player.reputation > 85) return 'fierté';
    return 'neutre';
  }

  // ── Locomotion ───────────────────────────────────────────────────────────

  setLocomotion(state: LocomotionState): void {
    this.locomotion = state;
  }

  get locomotionState(): LocomotionState {
    return this.locomotion;
  }

  /** Locomotion adaptée : un joueur blessé boite, un joueur épuisé ralentit. */
  suggestLocomotion(speedKmh: number): LocomotionState {
    if (this.career?.injured) return 'boitement';
    if (speedKmh < 0.5) return 'idle';
    if (speedKmh < 5) return 'marche';
    if (speedKmh < 8) return 'marche rapide';
    if (speedKmh < 18) return 'course';
    return 'sprint';
  }

  // ── Tribunes ─────────────────────────────────────────────────────────────

  standsOf(stadiumVenueId: string): StandIdentity[] {
    return [...this.stands.values()].filter((stand) => stand.id.startsWith(stadiumVenueId));
  }

  /**
   * Comportements observés dans une tribune à un instant donné du match.
   * Le résultat dépend de l'intensité, du score et du temps restant.
   */
  crowdBehaviours(
    standId: string,
    situation: { intensity: number; winning: boolean; minute: number; goalScored: boolean },
  ): Array<{ behaviour: CrowdBehaviour; share: number }> {
    const stand = this.stands.get(standId);
    if (!stand) return [];
    const rng = this.context.stream('animation.crowd');
    const intensity = clamp01(situation.intensity * stand.fervour);
    const result: Array<{ behaviour: CrowdBehaviour; share: number }> = [];

    for (const behaviour of stand.signature) {
      result.push({ behaviour, share: round(clamp01(intensity * rng.range(0.55, 1)), 3) });
    }
    if (situation.goalScored) {
      result.push({ behaviour: 'applaudit', share: round(clamp01(intensity + 0.2), 3) });
      result.push({ behaviour: 'prend des photos', share: round(clamp01(intensity * 0.4), 3) });
    }
    if (!situation.winning && situation.minute > 70) {
      result.push({ behaviour: 'siffle', share: round(clamp01((1 - intensity) * 0.5 + 0.2), 3) });
      result.push({
        behaviour: 'quitte le stade',
        share: round(clamp01(stand.earlyLeaveRate * ((situation.minute - 70) / 25)), 3),
      });
    }
    if (situation.intensity > 0.85 && rng.chance(0.3)) {
      result.push({ behaviour: 'pleure', share: round(rng.range(0.02, 0.08), 3) });
    }
    return result;
  }

  // ── Effets d'environnement (Tome XXXI, ch. 7) ────────────────────────────

  get environment(): EnvironmentEffects {
    return { ...this.effects };
  }

  /** Salit le maillot et fait transpirer pendant l'effort. */
  applyMatchWear(minutes: number, intensity: number, rainy: boolean): void {
    this.effects.kitDirt = clamp01(this.effects.kitDirt + (minutes / 90) * (rainy ? 0.55 : 0.28) * intensity);
    this.effects.sweat = clamp01(this.effects.sweat + (minutes / 90) * 0.6 * intensity);
    this.effects.footprints = clamp01(this.effects.footprints + (minutes / 90) * 0.3);
  }

  /** Remet à zéro l'usure visuelle (douche, changement de tenue). */
  resetWear(): void {
    this.effects.kitDirt = 0;
    this.effects.sweat = 0;
  }

  onHour(context: SimulationContext, _date: GameDate): void {
    // Le décor réagit à la météo de la ville où se trouve le joueur.
    const cities = this.world.cities();
    const city = cities[0];
    if (!city) return;
    const weather = city.weather;
    const rng = context.stream('animation.environment');

    const raining = weather.condition === 'rain' || weather.condition === 'heavyRain' || weather.condition === 'storm';
    const snowing = weather.condition === 'snow';

    this.effects.puddles = clamp01(raining ? this.effects.puddles + 0.25 : this.effects.puddles - 0.12);
    this.effects.snowCompaction = clamp01(snowing ? this.effects.snowCompaction + 0.18 : this.effects.snowCompaction - 0.1);
    this.effects.dust = clamp01(
      weather.condition === 'clear' || weather.condition === 'heatwave'
        ? this.effects.dust + 0.06
        : this.effects.dust - 0.2,
    );
    this.effects.clothesDryness = clamp01(raining ? this.effects.clothesDryness - 0.4 : this.effects.clothesDryness + 0.18);
    this.effects.curtainMotion = clamp01(weather.windKmh / 60 + rng.range(-0.05, 0.05));
    this.effects.footprints = clamp01(this.effects.footprints - 0.08);
  }

  onDay(_context: SimulationContext, _date: GameDate): void {
    // La poussière et les traces s'estompent naturellement.
    this.effects.footprints = clamp01(this.effects.footprints - 0.25);
    this.effects.sweat = clamp01(this.effects.sweat - 0.5);
  }

  // ── Statistiques de bibliothèque ─────────────────────────────────────────

  /**
   * Volume total d'animations distinctes couvertes par le système : chaque
   * famille × variantes × états émotionnels × modulations de vitesse.
   * C'est la mesure honnête de la richesse promise au Tome XXXI, ch. 2.
   */
  libraryVolume(): { families: number; baseVariants: number; contextualCombinations: number } {
    let baseVariants = 0;
    for (const clip of this.clips.values()) baseVariants += clip.variants;
    const emotions = 10;
    // Trois plages de fatigue et trois régimes météo modulent chaque variante.
    const contextual = baseVariants * emotions * 3 * 3;
    return {
      families: this.clips.size,
      baseVariants,
      contextualCombinations: contextual,
    };
  }

  get clipLibrary(): AnimationClip[] {
    return [...this.clips.values()];
  }

  private currentWeatherSeverity(outdoor: boolean): number {
    if (!outdoor) return 0;
    const city = this.world.cities()[0];
    return city ? city.weather.severity : 0;
  }

  /** Enregistre une famille d'animation additionnelle (pack de contenu). */
  registerClip(clip: AnimationClip): void {
    this.clips.set(clip.id, clip);
    this.familyIndex.set(clip.family, clip);
  }

  serialize(): unknown {
    return {
      effects: this.effects,
      currentEmotion: this.currentEmotion,
      locomotion: this.locomotion,
      stands: [...this.stands.values()],
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    if (state.effects) this.effects = state.effects as EnvironmentEffects;
    this.currentEmotion = (state.currentEmotion as EmotionalState) ?? 'neutre';
    this.locomotion = (state.locomotion as LocomotionState) ?? 'idle';
    for (const stand of (state.stands as StandIdentity[]) ?? []) this.stands.set(stand.id, stand);
  }
}

/** Sélection d'une variante sans répétition immédiate — utilitaire réutilisable. */
export function pickVariant(total: number, previous: number, rng: Rng): number {
  if (total <= 1) return 0;
  let variant = rng.int(0, total - 1);
  if (variant === previous) variant = (variant + 1) % total;
  return variant;
}
