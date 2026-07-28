/**
 * Infinity Football — Interface utilisateur (UI/UX)
 *
 * Tome XII intégralement : philosophie minimaliste, menu principal animé,
 * menu Pause complet, HUD entièrement personnalisable, inventaire premium en
 * 3D, carte interactive avec recherche et GPS, options d'accessibilité,
 * transitions cinématographiques.
 * Tome XXV, ch. 6 : commandes simplifiées, difficulté adaptative, assistance
 * IA optionnelle, tutoriels intelligents.
 *
 * Ce système décrit l'état de l'interface sous forme de modèles de vue purs :
 * la couche de rendu (moteur ou navigateur) s'y abonne sans logique métier.
 */

import { clamp, clamp01, round } from '../core/math.js';
import { dateFromAbsoluteMinutes, formatDateFr, formatTimeFr } from '../core/clock.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { getCity } from '../data/cities.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { MEDIA_SERVICE, type MediaSystem } from '../media/media-system.js';
import { TRAVEL_SERVICE, type TravelSystem } from '../transport/travel-system.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';
import { searchVenues, routeWithinCity, MODE_PROFILES, type TransportMode } from '../world/navigation.js';
import type { Venue } from '../world/model.js';

export const UI_SERVICE = 'ui';

export type ScreenId =
  | 'menuPrincipal'
  | 'monde'
  | 'pause'
  | 'inventaire'
  | 'carte'
  | 'telephone'
  | 'match'
  | 'ceremonie'
  | 'musee'
  | 'parametres';

export interface HudElementState {
  readonly id: string;
  readonly label: string;
  visible: boolean;
  /** Position d'ancrage à l'écran. */
  anchor: 'haut-gauche' | 'haut-droite' | 'bas-gauche' | 'bas-droite' | 'centre-bas';
  /** Opacité 0..1. */
  opacity: number;
  /** Échelle 0.5..1.5. */
  scale: number;
}

export interface AccessibilitySettings {
  /** Taille des textes 0.75..2. */
  textScale: number;
  subtitles: boolean;
  /** Sous-titres avec nom du locuteur. */
  speakerNames: boolean;
  highContrast: boolean;
  /** Aides visuelles : surbrillance des interactions. */
  visualAids: boolean;
  colourBlindMode: 'aucun' | 'protanopie' | 'deutéranopie' | 'tritanopie';
  /** Assistance de gameplay 0..1. */
  gameplayAssist: number;
  /** Commandes simplifiées (Tome XXV, ch. 6). */
  simplifiedControls: boolean;
  /** Difficulté adaptative. */
  adaptiveDifficulty: boolean;
  reduceMotion: boolean;
  /** Retour haptique. */
  haptics: boolean;
}

export interface ControlBinding {
  readonly action: string;
  key: string;
  gamepad: string;
}

export type InventoryCategory =
  | 'vêtements'
  | 'chaussures'
  | 'crampons'
  | 'montres'
  | 'bijoux'
  | 'sacs'
  | 'voitures'
  | 'trophées';

export interface InventoryItem {
  readonly id: string;
  readonly name: string;
  readonly category: InventoryCategory;
  readonly value: number;
  /** Modèle 3D présenté dans la vitrine de l'inventaire. */
  readonly modelId: string;
  equipped: boolean;
  /** Rareté 0..1, pilote l'éclairage de la vitrine. */
  readonly rarity: number;
}

export interface MapMarker {
  readonly id: string;
  readonly label: string;
  readonly type: string;
  readonly x: number;
  readonly y: number;
  readonly open: boolean;
  readonly distanceKm: number;
}

export interface MainMenuModel {
  readonly playerName: string;
  readonly clubName: string;
  readonly locationLabel: string;
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly weatherLabel: string;
  readonly temperature: number;
  readonly headlines: readonly string[];
  readonly backdrop: string;
  readonly transition: string;
}

export interface PauseMenuModel {
  readonly entries: readonly { id: string; label: string; enabled: boolean }[];
  readonly savedAt: string | null;
  readonly objectives: readonly string[];
  /** Le monde reprend exactement où il s'était arrêté. */
  readonly resumeAt: string;
}

export interface Objective {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  progress: number;
  completed: boolean;
}

const DEFAULT_HUD: readonly Omit<HudElementState, 'visible'>[] = [
  { id: 'minimap', label: 'Mini-carte', anchor: 'bas-gauche', opacity: 0.9, scale: 1 },
  { id: 'objectives', label: 'Objectifs', anchor: 'haut-droite', opacity: 0.85, scale: 1 },
  { id: 'notifications', label: 'Notifications', anchor: 'haut-droite', opacity: 0.95, scale: 1 },
  { id: 'indicators', label: 'Indicateurs', anchor: 'bas-droite', opacity: 0.85, scale: 1 },
  { id: 'speed', label: 'Vitesse', anchor: 'bas-droite', opacity: 0.9, scale: 1 },
  { id: 'clock', label: 'Heure', anchor: 'haut-gauche', opacity: 0.8, scale: 1 },
  { id: 'weather', label: 'Météo', anchor: 'haut-gauche', opacity: 0.8, scale: 1 },
  { id: 'compass', label: 'Boussole', anchor: 'centre-bas', opacity: 0.7, scale: 1 },
];

const DEFAULT_BINDINGS: readonly ControlBinding[] = [
  { action: 'interagir', key: 'E', gamepad: 'A' },
  { action: 'courir', key: 'Shift', gamepad: 'L3' },
  { action: 'téléphone', key: 'T', gamepad: 'Bas' },
  { action: 'carte', key: 'M', gamepad: 'Select' },
  { action: 'inventaire', key: 'I', gamepad: 'Haut' },
  { action: 'pause', key: 'Échap', gamepad: 'Start' },
  { action: 'véhicule', key: 'F', gamepad: 'Y' },
  { action: 'caméra', key: 'C', gamepad: 'R3' },
  { action: 'passer la cinématique', key: 'Espace', gamepad: 'B' },
  { action: 'capture', key: 'F12', gamepad: 'Share' },
];

export class UiSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'ui',
    name: 'Interface utilisateur',
    order: 130,
    tomes: ['XII', 'XIV', 'XXV'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private media!: MediaSystem;
  private travel!: TravelSystem;
  private seasons!: SeasonSystem;
  private career: CareerSystem | null = null;

  private screen: ScreenId = 'menuPrincipal';
  private readonly screenStack: ScreenId[] = [];
  private readonly hud = new Map<string, HudElementState>();
  private readonly bindings = new Map<string, ControlBinding>();
  private readonly objectives = new Map<string, Objective>();
  private readonly notifications: Array<{ id: string; text: string; at: number; kind: string }> = [];
  private accessibility: AccessibilitySettings = {
    textScale: 1,
    subtitles: true,
    speakerNames: true,
    highContrast: false,
    visualAids: false,
    colourBlindMode: 'aucun',
    gameplayAssist: 0.2,
    simplifiedControls: false,
    adaptiveDifficulty: false,
    reduceMotion: false,
    haptics: true,
  };
  private lastSaveLabel: string | null = null;
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.media = context.require<MediaSystem>(MEDIA_SERVICE);
    this.travel = context.require<TravelSystem>(TRAVEL_SERVICE);
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(UI_SERVICE, this);

    for (const element of DEFAULT_HUD) {
      this.hud.set(element.id, { ...element, visible: true });
    }
    for (const binding of DEFAULT_BINDINGS) {
      this.bindings.set(binding.action, { ...binding });
    }

    // Les événements marquants deviennent des notifications discrètes.
    context.events.on('media.newsPublished', (event) => {
      if (event.significance === 'routine') return;
      this.notify(event.headline, 'presse');
    });
    context.events.on('commerce.orderDelivered', (event) => {
      this.notify(`Colis remis par ${event.courierName}`, 'livraison');
    });
    context.events.on('assistant.reminder', (event) => {
      this.notify(`${event.subject} — ${event.detail}`, 'assistant');
    });
    context.events.on('system.save', (event) => {
      this.lastSaveLabel = `${event.kind} — ${formatDateFr(context.clock.date)} ${formatTimeFr(context.clock.date)}`;
    });
  }

  // ── Navigation entre écrans ──────────────────────────────────────────────

  get currentScreen(): ScreenId {
    return this.screen;
  }

  /** Transition cinématographique entre deux écrans (Tome XII, ch. 2 et 8). */
  goTo(screen: ScreenId): { from: ScreenId; to: ScreenId; transition: string; durationMs: number } {
    const from = this.screen;
    this.screenStack.push(from);
    this.screen = screen;
    const transition = this.transitionFor(from, screen);
    const durationMs = this.accessibility.reduceMotion ? 90 : this.transitionDuration(from, screen);
    return { from, to: screen, transition, durationMs };
  }

  back(): ScreenId {
    const previous = this.screenStack.pop();
    if (previous) this.screen = previous;
    return this.screen;
  }

  private transitionFor(from: ScreenId, to: ScreenId): string {
    if (this.accessibility.reduceMotion) return 'fondu court';
    if (to === 'match') return 'plongée caméra vers la pelouse';
    if (to === 'ceremonie') return 'ouverture au noir puis projecteurs';
    if (to === 'carte') return 'zoom arrière satellite';
    if (to === 'inventaire') return 'travelling latéral vers la vitrine';
    if (to === 'telephone') return 'remontée du téléphone en main';
    if (from === 'menuPrincipal') return 'fondu enchaîné cinématographique';
    return 'glissement fluide';
  }

  private transitionDuration(from: ScreenId, to: ScreenId): number {
    if (to === 'match' || to === 'ceremonie') return 1400;
    if (to === 'carte' || to === 'inventaire') return 650;
    if (from === 'menuPrincipal') return 1100;
    return 380;
  }

  // ── Menu principal (Tome XII, ch. 2) ─────────────────────────────────────

  mainMenu(): MainMenuModel {
    const date = this.context.clock.date;
    const cityId = this.travel.cityId;
    const city = this.world.city(cityId);
    const venue = this.travel.venueId ? city.venues.get(this.travel.venueId) : undefined;
    const headlines = this.media.frontPage(3).map((article) => `${article.outletName} — ${article.headline}`);

    return {
      playerName: this.career?.hasCareer ? this.career.player.identity.name : 'Nouvelle carrière',
      clubName: this.clubLabel(),
      locationLabel: venue ? `${venue.name}, ${city.def.name}` : city.def.name,
      dateLabel: formatDateFr(date),
      timeLabel: formatTimeFr(date),
      weatherLabel: city.weather.condition,
      temperature: city.weather.temperatureC,
      headlines,
      // Le décor du menu est le lieu réel où se trouve le joueur.
      backdrop: venue ? `intérieur — ${venue.name}` : `extérieur — ${city.def.name}`,
      transition: this.transitionFor('menuPrincipal', 'monde'),
    };
  }

  // ── Menu Pause (Tome XII, ch. 3) ─────────────────────────────────────────

  pauseMenu(): PauseMenuModel {
    const date = this.context.clock.date;
    return {
      entries: [
        { id: 'reprendre', label: 'Reprendre la partie', enabled: true },
        { id: 'sauvegarder', label: 'Sauvegarder', enabled: true },
        { id: 'charger', label: 'Charger', enabled: true },
        { id: 'parametres', label: 'Paramètres', enabled: true },
        { id: 'musique', label: 'Musique', enabled: true },
        { id: 'commandes', label: 'Commandes', enabled: true },
        { id: 'objectifs', label: 'Objectifs', enabled: this.objectives.size > 0 },
        { id: 'quitter', label: 'Quitter', enabled: true },
      ],
      savedAt: this.lastSaveLabel,
      objectives: [...this.objectives.values()].filter((o) => !o.completed).map((o) => o.label),
      resumeAt: `${formatDateFr(date)} — ${formatTimeFr(date)}`,
    };
  }

  /** Met le monde en pause : il reprendra exactement où il s'était arrêté. */
  pause(): void {
    this.context.clock.pause();
    this.goTo('pause');
  }

  resume(): void {
    this.context.clock.resume();
    this.back();
  }

  // ── HUD personnalisable (Tome XII, ch. 4) ────────────────────────────────

  get hudElements(): HudElementState[] {
    return [...this.hud.values()];
  }

  setHudVisible(id: string, visible: boolean): boolean {
    const element = this.hud.get(id);
    if (!element) return false;
    element.visible = visible;
    return true;
  }

  setHudLayout(id: string, layout: Partial<Pick<HudElementState, 'anchor' | 'opacity' | 'scale'>>): boolean {
    const element = this.hud.get(id);
    if (!element) return false;
    if (layout.anchor) element.anchor = layout.anchor;
    if (layout.opacity !== undefined) element.opacity = clamp01(layout.opacity);
    if (layout.scale !== undefined) element.scale = clamp(layout.scale, 0.5, 1.5);
    return true;
  }

  /** Masque tout le HUD : mode immersion totale (Tome XII, ch. 8). */
  hideAllHud(): void {
    for (const element of this.hud.values()) element.visible = false;
  }

  showAllHud(): void {
    for (const element of this.hud.values()) element.visible = true;
  }

  /** Données courantes affichées par le HUD. */
  hudData(): Record<string, string | number> {
    const date = this.context.clock.date;
    const city = this.world.city(this.travel.cityId);
    return {
      heure: formatTimeFr(date),
      date: formatDateFr(date),
      meteo: city.weather.condition,
      temperature: city.weather.temperatureC,
      ville: city.def.name,
      trafic: round(city.traffic, 2),
      notifications: this.notifications.length,
      objectifs: [...this.objectives.values()].filter((o) => !o.completed).length,
      solde: this.economy.account('courant').balance,
    };
  }

  // ── Inventaire premium (Tome XII, ch. 5) ─────────────────────────────────

  /**
   * Construit l'inventaire à partir du patrimoine réel : vêtements achetés,
   * véhicules du garage, trophées de la collection. Chaque objet expose un
   * modèle 3D pour la vitrine.
   */
  inventory(category?: InventoryCategory): InventoryItem[] {
    const items: InventoryItem[] = [];

    for (const vehicle of this.economy.garage) {
      items.push({
        id: vehicle.id,
        name: vehicle.label,
        category: 'voitures',
        value: round(vehicle.value * vehicle.condition, 2),
        modelId: `model.vehicle.${vehicle.definitionId}`,
        equipped: false,
        rarity: clamp01(vehicle.purchasePrice / 2_000_000),
      });
    }

    for (const collectible of this.economy.collection) {
      const mapped: InventoryCategory =
        collectible.kind === 'montre' ? 'montres' :
        collectible.kind === 'bijou' ? 'bijoux' :
        collectible.kind === 'trophee' ? 'trophées' :
        collectible.kind === 'voitureCollection' ? 'voitures' : 'bijoux';
      items.push({
        id: collectible.id,
        name: collectible.label,
        category: mapped,
        value: collectible.value,
        modelId: `model.collectible.${collectible.kind}`,
        equipped: collectible.displayedAt !== null,
        rarity: clamp01(collectible.purchasePrice / 100_000),
      });
    }

    return category ? items.filter((item) => item.category === category) : items;
  }

  /** Valeur totale de l'inventaire, affichée en en-tête de la vitrine. */
  inventoryValue(): number {
    return round(this.inventory().reduce((sum, item) => sum + item.value, 0), 2);
  }

  // ── Carte interactive & GPS (Tome XII, ch. 6) ────────────────────────────

  /** Recherche sur la carte, par nom ou par type de lieu. */
  searchMap(query: string, options: { openOnly?: boolean; limit?: number } = {}): MapMarker[] {
    const city = this.world.city(this.travel.cityId);
    const origin = this.travel.venueId ? city.venues.get(this.travel.venueId) : undefined;
    const results = searchVenues(city, query, options);
    return results.map((venue) => this.toMarker(venue, origin));
  }

  /** Marqueurs de la carte pour une catégorie donnée. */
  mapMarkers(types: readonly string[] = []): MapMarker[] {
    const city = this.world.city(this.travel.cityId);
    const origin = this.travel.venueId ? city.venues.get(this.travel.venueId) : undefined;
    const markers: MapMarker[] = [];
    for (const venue of city.venues.values()) {
      if (venue.hidden && !venue.discovered) continue;
      if (types.length > 0 && !types.includes(venue.type)) continue;
      markers.push(this.toMarker(venue, origin));
    }
    return markers.sort((a, b) => a.distanceKm - b.distanceKm);
  }

  private toMarker(venue: Venue, origin: Venue | undefined): MapMarker {
    const distanceKm = origin
      ? Math.hypot(venue.position.x - origin.position.x, venue.position.y - origin.position.y)
      : Math.hypot(venue.position.x, venue.position.y);
    return {
      id: venue.id,
      label: venue.name,
      type: venue.type,
      x: round(venue.position.x, 3),
      y: round(venue.position.y, 3),
      open: venue.open,
      distanceKm: round(distanceKm, 2),
    };
  }

  /** Itinéraire GPS : le meilleur trajet est calculé automatiquement. */
  route(
    destinationVenueId: string,
    mode: TransportMode = 'car',
  ): { steps: string[]; minutes: number; distanceKm: number; cost: number; modeLabel: string } | null {
    const city = this.world.city(this.travel.cityId);
    const from = this.travel.venueId ?? city.districts[0]?.id;
    if (!from) return null;
    const result = routeWithinCity(city, from, destinationVenueId, mode);
    if (!result.found) return null;
    return {
      steps: result.steps.map((step) => step.name),
      minutes: Math.round(result.durationMinutes),
      distanceKm: round(result.distanceKm, 2),
      cost: round(result.costEur, 2),
      modeLabel: MODE_PROFILES[mode].label,
    };
  }

  /** Carte mondiale : villes accessibles depuis la position courante. */
  worldMap(): Array<{ cityId: string; name: string; country: string; distanceKm: number; visited: boolean }> {
    const current = this.travel.cityId;
    return this.world.cities().map((city) => ({
      cityId: city.id,
      name: city.def.name,
      country: city.def.countryId,
      distanceKm: this.travel.distanceTo(city.id),
      visited: city.id === current || city.discoveredVenueIds.size > 0,
    })).sort((a, b) => a.distanceKm - b.distanceKm);
  }

  // ── Accessibilité (Tome XII, ch. 7 ; Tome XXV, ch. 6) ────────────────────

  get accessibilitySettings(): AccessibilitySettings {
    return { ...this.accessibility };
  }

  updateAccessibility(settings: Partial<AccessibilitySettings>): AccessibilitySettings {
    this.accessibility = {
      ...this.accessibility,
      ...settings,
      textScale: clamp(settings.textScale ?? this.accessibility.textScale, 0.75, 2),
      gameplayAssist: clamp01(settings.gameplayAssist ?? this.accessibility.gameplayAssist),
    };
    return this.accessibilitySettings;
  }

  /**
   * Difficulté effective appliquée au gameplay : la difficulté adaptative
   * corrige l'écart entre le niveau attendu et les résultats réels.
   */
  effectiveDifficulty(recentPerformance: number): number {
    const base =
      this.context.config.difficulty === 'casual' ? 0.35 :
      this.context.config.difficulty === 'standard' ? 0.55 :
      this.context.config.difficulty === 'realistic' ? 0.75 : 0.92;
    const assisted = base * (1 - this.accessibility.gameplayAssist * 0.4);
    if (!this.accessibility.adaptiveDifficulty) return round(assisted, 3);
    // Le joueur domine : on resserre. Il souffre : on relâche.
    const correction = clamp((recentPerformance - 0.5) * 0.3, -0.2, 0.2);
    return round(clamp(assisted + correction, 0.2, 1), 3);
  }

  get controlBindings(): ControlBinding[] {
    return [...this.bindings.values()];
  }

  rebind(action: string, key: string, gamepad: string): boolean {
    const binding = this.bindings.get(action);
    if (!binding) return false;
    binding.key = key;
    binding.gamepad = gamepad;
    return true;
  }

  resetBindings(): void {
    for (const binding of DEFAULT_BINDINGS) this.bindings.set(binding.action, { ...binding });
  }

  // ── Objectifs & notifications ────────────────────────────────────────────

  addObjective(id: string, label: string, detail: string): Objective {
    const objective: Objective = { id, label, detail, progress: 0, completed: false };
    this.objectives.set(id, objective);
    return objective;
  }

  updateObjective(id: string, progress: number): boolean {
    const objective = this.objectives.get(id);
    if (!objective) return false;
    objective.progress = clamp01(progress);
    if (objective.progress >= 1 && !objective.completed) {
      objective.completed = true;
      this.notify(`Objectif accompli : ${objective.label}`, 'objectif');
    }
    return true;
  }

  get activeObjectives(): Objective[] {
    return [...this.objectives.values()].filter((o) => !o.completed);
  }

  notify(text: string, kind: string): void {
    this.notifications.push({
      id: `notif:${this.counter++}`,
      text,
      at: this.context.clock.absoluteMinutes,
      kind,
    });
    if (this.notifications.length > 60) this.notifications.splice(0, this.notifications.length - 60);
  }

  recentNotifications(limit = 8): Array<{ id: string; text: string; kind: string; at: string }> {
    return this.notifications
      .slice(Math.max(0, this.notifications.length - limit))
      .reverse()
      .map((n) => ({
        id: n.id,
        text: n.text,
        kind: n.kind,
        at: formatTimeFr(dateFromAbsoluteMinutes(n.at)),
      }));
  }

  clearNotifications(): void {
    this.notifications.length = 0;
  }

  // ── Tutoriels intelligents (Tome XXV, ch. 6) ─────────────────────────────

  /**
   * Suggère un tutoriel contextuel : uniquement ce dont le joueur a besoin,
   * au moment où il en a besoin.
   */
  suggestTutorial(): { id: string; title: string; body: string } | null {
    if (!this.career?.hasCareer) {
      return {
        id: 'tuto.creation',
        title: 'Créer votre joueur',
        body: 'Choisissez poste, pied fort, style de jeu, nationalité et histoire personnelle.',
      };
    }
    const player = this.career.player;
    if (this.economy.garage.length === 0 && this.economy.account('courant').balance > 60_000) {
      return {
        id: 'tuto.vehicule',
        title: 'Votre premier véhicule',
        body: 'Rendez-vous chez un concessionnaire pour réserver un essai, configurer et commander.',
      };
    }
    if (this.economy.activeInvestments.length === 0 && this.economy.account('courant').balance > 400_000) {
      return {
        id: 'tuto.investissement',
        title: 'Faire fructifier vos revenus',
        body: 'L’IA secrétaire peut recommander un premier placement adapté à votre trésorerie.',
      };
    }
    if (!this.career.boots && player.fame > 20) {
      return {
        id: 'tuto.equipementier',
        title: 'Signer avec un équipementier',
        body: 'Votre notoriété attire des marques. Attention aux clauses d’exclusivité.',
      };
    }
    if (player.fitness < 0.4) {
      return {
        id: 'tuto.recuperation',
        title: 'Gérer la fatigue',
        body: 'Un passage au spa, une nuit complète ou des vacances restaurent votre fraîcheur.',
      };
    }
    return null;
  }

  // ── Écran de match & classement ──────────────────────────────────────────

  matchHud(state: {
    homeName: string;
    awayName: string;
    homeGoals: number;
    awayGoals: number;
    minute: number;
    possessionHome: number;
    lastCommentary: string | null;
  }): Record<string, string | number> {
    return {
      score: `${state.homeName} ${state.homeGoals} - ${state.awayGoals} ${state.awayName}`,
      minute: `${state.minute}′`,
      possession: `${Math.round(state.possessionHome * 100)}% / ${Math.round((1 - state.possessionHome) * 100)}%`,
      commentaire: state.lastCommentary ?? '',
      assistance: round(this.accessibility.gameplayAssist, 2),
    };
  }

  standingsView(competitionId: string): Array<{ position: number; club: string; played: number; points: number; diff: number }> {
    return this.seasons.standings(competitionId).map((row, index) => ({
      position: index + 1,
      club: row.clubId,
      played: row.played,
      points: row.points,
      diff: row.goalsFor - row.goalsAgainst,
    }));
  }

  private clubLabel(): string {
    if (!this.career?.hasCareer || !this.career.player.clubId) return 'Sans club';
    return this.career.player.clubId;
  }

  onDay(_context: SimulationContext, _date: GameDate): void {
    // Les notifications trop anciennes disparaissent d'elles-mêmes.
    const cutoff = this.context.clock.absoluteMinutes - 3 * 24 * 60;
    while (this.notifications.length > 0 && (this.notifications[0]?.at ?? 0) < cutoff) {
      this.notifications.shift();
    }
  }

  serialize(): unknown {
    return {
      screen: this.screen,
      hud: [...this.hud.values()],
      bindings: [...this.bindings.values()],
      objectives: [...this.objectives.values()],
      accessibility: this.accessibility,
      lastSaveLabel: this.lastSaveLabel,
      notifications: this.notifications.slice(-30),
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.screen = (state.screen as ScreenId) ?? 'menuPrincipal';
    for (const element of (state.hud as HudElementState[]) ?? []) this.hud.set(element.id, element);
    for (const binding of (state.bindings as ControlBinding[]) ?? []) this.bindings.set(binding.action, binding);
    this.objectives.clear();
    for (const objective of (state.objectives as Objective[]) ?? []) this.objectives.set(objective.id, objective);
    if (state.accessibility) this.accessibility = state.accessibility as AccessibilitySettings;
    this.lastSaveLabel = (state.lastSaveLabel as string | null) ?? null;
    this.notifications.length = 0;
    this.notifications.push(...(((state.notifications as typeof this.notifications) ?? [])));
    this.counter = (state.counter as number) ?? 0;
  }
}

/** Libellé lisible d'une ville, pour les vues qui n'ont que l'identifiant. */
export function cityLabel(cityId: string): string {
  try {
    return getCity(cityId).name;
  } catch {
    return cityId;
  }
}
