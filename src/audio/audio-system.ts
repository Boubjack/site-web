/**
 * Infinity Football — Audio / Univers sonore
 *
 * Tome IX intégralement :
 *  - ch. 4 : chaque stade a ses chants, tambours, tifos, annonces, hymne et
 *    identité sonore ; les supporters réagissent en temps réel ;
 *  - ch. 5 : musique officielle, connexion Spotify, playlists dans les menus,
 *    en voiture, à la maison, musique dynamique pendant les chargements ;
 *  - ch. 6 : audio spatial pour public, arbitre, ballon, pluie, vent, voitures,
 *    avions et commerces — le son change selon la position du joueur ;
 *  - ch. 7 : plusieurs langues, duo de commentateurs et style au choix ;
 *  - ch. 8 : le son seul doit suffire à comprendre où l'on est et ce qui se joue.
 *
 * Ce système est le mixeur logique : il maintient les bus, les émetteurs 3D
 * actifs et l'état d'ambiance. Le moteur de rendu audio de la plateforme cible
 * s'y abonne pour déclencher les banques de sons réelles.
 */

import { clamp, clamp01, distance3, type Vec3 } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { getStadium } from '../data/clubs.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';

export const AUDIO_SERVICE = 'audio';

export type AudioBus =
  | 'master'
  | 'musique'
  | 'commentaire'
  | 'ambiance'
  | 'foule'
  | 'effets'
  | 'dialogues'
  | 'interface'
  | 'vehicules'
  | 'meteo';

export interface BusState {
  readonly id: AudioBus;
  /** Volume 0..1. */
  volume: number;
  /** Atténuation temporaire (ducking) appliquée par le mixeur. */
  duck: number;
  muted: boolean;
}

export interface SpatialEmitter {
  readonly id: string;
  readonly bus: AudioBus;
  readonly label: string;
  position: Vec3;
  /** Volume de base 0..1. */
  gain: number;
  /** Distance au-delà de laquelle l'émetteur est inaudible (mètres). */
  readonly maxDistance: number;
  /** Émetteur en boucle (ambiance) ou ponctuel. */
  readonly looping: boolean;
  active: boolean;
}

export interface StadiumAtmosphere {
  readonly stadiumId: string;
  /** Chants disponibles. */
  readonly chants: readonly string[];
  readonly anthem: string;
  readonly drums: boolean;
  /** Intensité courante 0..1. */
  intensity: number;
  /** Nervosité 0..1 : sifflets. */
  tension: number;
  /** Annonces stade en cours. */
  announcement: string | null;
}

export interface MusicTrack {
  readonly id: string;
  readonly title: string;
  readonly artist: string;
  readonly durationSeconds: number;
  readonly source: 'officiel' | 'spotify';
  readonly mood: 'calme' | 'énergique' | 'épique' | 'urbain' | 'nostalgique';
}

export interface Playlist {
  readonly id: string;
  readonly name: string;
  readonly source: 'officiel' | 'spotify';
  readonly tracks: MusicTrack[];
}

export type MusicContext = 'menu' | 'chargement' | 'voiture' | 'maison' | 'entrainement' | 'ceremonie';

/** Bande-son officielle du jeu, disponible sans compte externe. */
const OFFICIAL_TRACKS: readonly MusicTrack[] = [
  { id: 'off-1', title: 'Infinity Anthem', artist: 'Studio Infinity', durationSeconds: 212, source: 'officiel', mood: 'épique' },
  { id: 'off-2', title: 'Night Drive', artist: 'Studio Infinity', durationSeconds: 187, source: 'officiel', mood: 'urbain' },
  { id: 'off-3', title: 'Golden Hour', artist: 'Studio Infinity', durationSeconds: 245, source: 'officiel', mood: 'calme' },
  { id: 'off-4', title: 'Matchday', artist: 'Studio Infinity', durationSeconds: 168, source: 'officiel', mood: 'énergique' },
  { id: 'off-5', title: 'Legacy', artist: 'Studio Infinity', durationSeconds: 298, source: 'officiel', mood: 'nostalgique' },
  { id: 'off-6', title: 'Red Carpet', artist: 'Studio Infinity', durationSeconds: 201, source: 'officiel', mood: 'épique' },
  { id: 'off-7', title: 'Home Ground', artist: 'Studio Infinity', durationSeconds: 176, source: 'officiel', mood: 'calme' },
  { id: 'off-8', title: 'Transfer Window', artist: 'Studio Infinity', durationSeconds: 194, source: 'officiel', mood: 'urbain' },
];

export class AudioSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'audio',
    name: 'Univers sonore',
    order: 80,
    tomes: ['IX', 'XIV', 'XXXI'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private readonly buses = new Map<AudioBus, BusState>();
  private readonly emitters = new Map<string, SpatialEmitter>();
  private readonly playlists = new Map<string, Playlist>();
  private readonly atmospheres = new Map<string, StadiumAtmosphere>();
  private listenerPosition: Vec3 = { x: 0, y: 0, z: 0 };
  private currentTrack: MusicTrack | null = null;
  private currentPlaylistId: string | null = null;
  private spotifyConnected = false;
  private spotifyAccount: string | null = null;
  private musicContext: MusicContext = 'menu';

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    context.provide(AUDIO_SERVICE, this);

    const busIds: AudioBus[] = [
      'master', 'musique', 'commentaire', 'ambiance', 'foule',
      'effets', 'dialogues', 'interface', 'vehicules', 'meteo',
    ];
    for (const id of busIds) {
      this.buses.set(id, { id, volume: id === 'master' ? 0.9 : 0.8, duck: 1, muted: false });
    }

    this.playlists.set('officiel', {
      id: 'officiel',
      name: 'Bande-son officielle',
      source: 'officiel',
      tracks: [...OFFICIAL_TRACKS],
    });
    this.currentPlaylistId = 'officiel';

    // Une identité sonore par stade.
    for (const city of this.world.cities()) {
      for (const venue of city.venues.values()) {
        if (venue.type !== 'stadium' || !venue.id.startsWith('stadium:')) continue;
        const stadiumId = venue.id.slice('stadium:'.length);
        try {
          const def = getStadium(stadiumId);
          this.atmospheres.set(stadiumId, {
            stadiumId,
            chants: def.traditions,
            anthem: def.anthem,
            drums: def.traditions.some((t) => t.includes('tambour') || t.includes('djembé')),
            intensity: 0,
            tension: 0,
            announcement: null,
          });
        } catch {
          // Stade généré sans définition dédiée : ambiance neutre.
          this.atmospheres.set(stadiumId, {
            stadiumId,
            chants: ['chant générique du kop'],
            anthem: 'hymne du club',
            drums: false,
            intensity: 0,
            tension: 0,
            announcement: null,
          });
        }
      }
    }

    context.events.on('audio.cue', (event) => {
      const bus = this.buses.get(event.bus as AudioBus);
      if (bus) bus.duck = clamp01(1 - event.intensity * 0.4);
    });
  }

  // ── Bus & mixage ─────────────────────────────────────────────────────────

  bus(id: AudioBus): BusState {
    const bus = this.buses.get(id);
    if (!bus) throw new Error(`Bus audio inconnu : ${id}`);
    return bus;
  }

  setVolume(id: AudioBus, volume: number): void {
    this.bus(id).volume = clamp01(volume);
  }

  setMuted(id: AudioBus, muted: boolean): void {
    this.bus(id).muted = muted;
  }

  /** Volume effectif d'un bus, master et ducking compris. */
  effectiveVolume(id: AudioBus): number {
    const bus = this.bus(id);
    if (bus.muted) return 0;
    const master = this.bus('master');
    if (master.muted) return 0;
    return clamp01(bus.volume * bus.duck * (id === 'master' ? 1 : master.volume));
  }

  /** Atténue temporairement un bus (le commentaire prend le dessus sur la foule). */
  duck(id: AudioBus, amount: number): void {
    this.bus(id).duck = clamp01(1 - amount);
  }

  releaseDuck(id: AudioBus): void {
    this.bus(id).duck = 1;
  }

  // ── Audio spatial ────────────────────────────────────────────────────────

  setListener(position: Vec3): void {
    this.listenerPosition = position;
  }

  addEmitter(emitter: Omit<SpatialEmitter, 'active'>): SpatialEmitter {
    const full: SpatialEmitter = { ...emitter, active: true };
    this.emitters.set(full.id, full);
    return full;
  }

  removeEmitter(id: string): void {
    this.emitters.delete(id);
  }

  moveEmitter(id: string, position: Vec3): void {
    const emitter = this.emitters.get(id);
    if (emitter) emitter.position = position;
  }

  /**
   * Volume perçu d'un émetteur : atténuation en 1/d bornée, pondérée par le bus.
   * C'est la valeur que le moteur audio de la plateforme applique réellement.
   */
  perceivedGain(emitterId: string): number {
    const emitter = this.emitters.get(emitterId);
    if (!emitter || !emitter.active) return 0;
    const distance = distance3(this.listenerPosition, emitter.position);
    if (distance >= emitter.maxDistance) return 0;
    const attenuation = 1 - distance / emitter.maxDistance;
    return clamp01(emitter.gain * attenuation * attenuation * this.effectiveVolume(emitter.bus));
  }

  /** Émetteurs actuellement audibles, triés du plus fort au plus faible. */
  audibleEmitters(threshold = 0.02): Array<{ emitter: SpatialEmitter; gain: number }> {
    const result: Array<{ emitter: SpatialEmitter; gain: number }> = [];
    for (const emitter of this.emitters.values()) {
      const gain = this.perceivedGain(emitter.id);
      if (gain >= threshold) result.push({ emitter, gain });
    }
    return result.sort((a, b) => b.gain - a.gain);
  }

  /**
   * Peuple le paysage sonore d'une ville : commerces, circulation, météo,
   * avions. Appelé à chaque changement de lieu du joueur.
   */
  buildCitySoundscape(cityId: string, listener: Vec3): void {
    for (const emitter of [...this.emitters.values()]) {
      if (emitter.id.startsWith('city:')) this.emitters.delete(emitter.id);
    }
    const city = this.world.city(cityId);
    this.setListener(listener);

    this.addEmitter({
      id: `city:${cityId}:traffic`,
      bus: 'ambiance',
      label: 'circulation',
      position: { x: listener.x + 12, y: 0, z: listener.z + 8 },
      gain: clamp01(city.traffic * 0.6),
      maxDistance: 180,
      looping: true,
    });

    const weatherGain =
      city.weather.condition === 'storm' ? 0.9 :
      city.weather.condition === 'heavyRain' ? 0.7 :
      city.weather.condition === 'rain' ? 0.45 :
      city.weather.condition === 'snow' ? 0.25 : 0.1;
    this.addEmitter({
      id: `city:${cityId}:weather`,
      bus: 'meteo',
      label: `météo — ${city.weather.condition}`,
      position: listener,
      gain: weatherGain,
      maxDistance: 400,
      looping: true,
    });

    this.addEmitter({
      id: `city:${cityId}:wind`,
      bus: 'meteo',
      label: 'vent',
      position: listener,
      gain: clamp01(city.weather.windKmh / 90),
      maxDistance: 300,
      looping: true,
    });

    // Commerces ouverts proches : chaque enseigne a sa nappe sonore.
    let index = 0;
    for (const venue of city.venues.values()) {
      if (!venue.open || index >= 12) continue;
      if (venue.occupancy < 3) continue;
      this.addEmitter({
        id: `city:${cityId}:venue:${venue.id}`,
        bus: 'ambiance',
        label: venue.name,
        position: { x: venue.position.x * 1000, y: 0, z: venue.position.y * 1000 },
        gain: clamp01(venue.occupancy / Math.max(1, venue.capacity)) * 0.5,
        maxDistance: 90,
        looping: true,
      });
      index++;
    }

    if (city.def.hasAirport) {
      this.addEmitter({
        id: `city:${cityId}:aircraft`,
        bus: 'ambiance',
        label: 'avion au décollage',
        position: { x: listener.x, y: 400, z: listener.z + 900 },
        gain: 0.4,
        maxDistance: 2500,
        looping: false,
      });
    }
  }

  // ── Ambiance de stade ────────────────────────────────────────────────────

  atmosphere(stadiumId: string): StadiumAtmosphere | undefined {
    return this.atmospheres.get(stadiumId);
  }

  /** Met à jour l'ambiance du stade selon le déroulement du match. */
  updateStadium(
    stadiumId: string,
    state: { intensity: number; tension: number; homeScoring: boolean | null },
  ): void {
    const atmosphere = this.atmospheres.get(stadiumId);
    if (!atmosphere) return;
    atmosphere.intensity = clamp01(state.intensity);
    atmosphere.tension = clamp01(state.tension);
    this.setVolume('foule', clamp01(0.4 + atmosphere.intensity * 0.6));

    if (state.homeScoring === true) {
      atmosphere.announcement = 'annonce du buteur par le speaker';
      this.context.emit({ type: 'audio.cue', cueId: 'stade.but.domicile', bus: 'foule', intensity: 1 });
    } else if (state.homeScoring === false) {
      atmosphere.announcement = 'silence, puis sifflets épars';
      this.context.emit({ type: 'audio.cue', cueId: 'stade.but.exterieur', bus: 'foule', intensity: 0.35 });
    }
  }

  playAnthem(stadiumId: string): void {
    const atmosphere = this.atmospheres.get(stadiumId);
    if (!atmosphere) return;
    this.duck('foule', 0.4);
    this.context.emit({ type: 'audio.cue', cueId: `hymne:${atmosphere.anthem}`, bus: 'musique', intensity: 0.9 });
  }

  playChant(stadiumId: string, rngPick: (chants: readonly string[]) => string): void {
    const atmosphere = this.atmospheres.get(stadiumId);
    if (!atmosphere || atmosphere.chants.length === 0) return;
    const chant = rngPick(atmosphere.chants);
    this.context.emit({ type: 'audio.cue', cueId: `chant:${chant}`, bus: 'foule', intensity: atmosphere.intensity });
  }

  // ── Musique & Spotify ────────────────────────────────────────────────────

  connectSpotify(accountName: string, playlists: readonly Playlist[]): void {
    this.spotifyConnected = true;
    this.spotifyAccount = accountName;
    for (const playlist of playlists) {
      this.playlists.set(playlist.id, { ...playlist, source: 'spotify' });
    }
    this.context.logger.info('compte Spotify connecté', {
      compte: accountName,
      playlists: playlists.length,
    });
  }

  disconnectSpotify(): void {
    this.spotifyConnected = false;
    this.spotifyAccount = null;
    for (const [id, playlist] of [...this.playlists]) {
      if (playlist.source === 'spotify') this.playlists.delete(id);
    }
    if (this.currentPlaylistId && !this.playlists.has(this.currentPlaylistId)) {
      this.currentPlaylistId = 'officiel';
    }
  }

  get spotify(): { connected: boolean; account: string | null } {
    return { connected: this.spotifyConnected, account: this.spotifyAccount };
  }

  get availablePlaylists(): Playlist[] {
    return [...this.playlists.values()];
  }

  selectPlaylist(playlistId: string): boolean {
    if (!this.playlists.has(playlistId)) return false;
    this.currentPlaylistId = playlistId;
    return true;
  }

  /**
   * Choisit la musique adaptée au contexte. En voiture et à la maison, les
   * playlists personnelles sont privilégiées si elles existent.
   */
  playFor(musicContext: MusicContext, pick: <T>(items: readonly T[]) => T): MusicTrack | null {
    this.musicContext = musicContext;
    const playlist =
      (this.currentPlaylistId ? this.playlists.get(this.currentPlaylistId) : undefined) ??
      this.playlists.get('officiel');
    if (!playlist || playlist.tracks.length === 0) return null;

    const preferredMood: MusicTrack['mood'] =
      musicContext === 'ceremonie' ? 'épique' :
      musicContext === 'voiture' ? 'urbain' :
      musicContext === 'maison' ? 'calme' :
      musicContext === 'entrainement' ? 'énergique' :
      musicContext === 'chargement' ? 'énergique' : 'calme';

    const matching = playlist.tracks.filter((t) => t.mood === preferredMood);
    const track = pick(matching.length > 0 ? matching : playlist.tracks);
    this.currentTrack = track;
    this.context.emit({ type: 'audio.cue', cueId: `musique:${track.id}`, bus: 'musique', intensity: 0.5 });
    return track;
  }

  get nowPlaying(): { track: MusicTrack | null; context: MusicContext } {
    return { track: this.currentTrack, context: this.musicContext };
  }

  stopMusic(): void {
    this.currentTrack = null;
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onHour(_context: SimulationContext, date: GameDate): void {
    // Ambiance nocturne : la ville se calme, les commerces ferment.
    const nightFactor = date.hour >= 23 || date.hour < 6 ? 0.45 : 1;
    this.setVolume('ambiance', clamp(0.8 * nightFactor, 0.2, 1));
  }

  // ── Sérialisation ────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      buses: [...this.buses.values()],
      spotifyConnected: this.spotifyConnected,
      spotifyAccount: this.spotifyAccount,
      currentPlaylistId: this.currentPlaylistId,
      playlists: [...this.playlists.values()].filter((p) => p.source === 'spotify'),
      musicContext: this.musicContext,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    for (const bus of (state.buses as BusState[]) ?? []) this.buses.set(bus.id, bus);
    this.spotifyConnected = Boolean(state.spotifyConnected);
    this.spotifyAccount = (state.spotifyAccount as string | null) ?? null;
    for (const playlist of (state.playlists as Playlist[]) ?? []) {
      this.playlists.set(playlist.id, playlist);
    }
    this.currentPlaylistId = (state.currentPlaylistId as string | null) ?? 'officiel';
    this.musicContext = (state.musicContext as MusicContext) ?? 'menu';
  }
}
