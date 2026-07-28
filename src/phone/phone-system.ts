/**
 * Infinity Football — Téléphone, réseaux sociaux & IA secrétaire
 *
 * Tome XI intégralement :
 *  - ch. 1 : un véritable smartphone, utilisable partout, avec des animations
 *    qui changent selon la situation ;
 *  - ch. 2 : les 21 applications listées, extensibles par mise à jour ;
 *  - ch. 3 : compte officiel, publications variées, commentaires d'IA,
 *    tendances renouvelées chaque semaine ;
 *  - ch. 4 : Snapstreak (snaps, réponses, flammes, stories, snaps reçus) ;
 *  - ch. 5 : connexion Spotify et lecture contextuelle ;
 *  - ch. 6 : IA secrétaire qui organise tout et répond aux questions ;
 *  - ch. 8 : plus la célébrité monte, plus les sollicitations affluent.
 * Tome VIII, ch. 5 : liste complète des capacités de l'IA secrétaire.
 */

import { clamp, clamp01, round } from '../core/math.js';
import {
  MINUTES_PER_DAY,
  dateFromAbsoluteMinutes,
  formatDateTimeFr,
  formatTimeFr,
} from '../core/clock.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import { DialogueEngine } from '../ai/dialogue.js';
import { NAME_POOLS } from '../data/names.js';
import { getCity } from '../data/cities.js';
import { getClub } from '../data/clubs.js';
import type { ProductCategory } from '../data/brands.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';
import { COMMERCE_SERVICE, type CommerceSystem } from '../commerce/commerce-system.js';
import { TRAVEL_SERVICE, type TravelSystem } from '../transport/travel-system.js';
import { LIFE_SERVICE, type LifeSystem } from '../life/life-system.js';
import { MEDIA_SERVICE, type MediaSystem } from '../media/media-system.js';
import { AUDIO_SERVICE, type AudioSystem } from '../audio/audio-system.js';
import { CALENDAR_SERVICE, type WorldCalendarSystem } from '../events/world-calendar.js';
import { searchVenues, routeWithinCity, MODE_PROFILES } from '../world/navigation.js';

export const PHONE_SERVICE = 'phone';

export type AppId =
  | 'telephone'
  | 'messages'
  | 'appelsVideo'
  | 'contacts'
  | 'galerie'
  | 'appareilPhoto'
  | 'banque'
  | 'agenda'
  | 'gps'
  | 'spotify'
  | 'snapstreak'
  | 'reseauxSociaux'
  | 'boutique'
  | 'commandes'
  | 'livraison'
  | 'iaSecretaire'
  | 'meteo'
  | 'actualites'
  | 'calendrier'
  | 'mail'
  | 'notes';

export interface AppDefinition {
  readonly id: AppId;
  readonly name: string;
  readonly icon: string;
  readonly category: 'communication' | 'média' | 'utilitaire' | 'finance' | 'lifestyle' | 'assistant';
  /** Ajoutée par une mise à jour de contenu. */
  readonly addedByUpdate: boolean;
}

/** Tome XI, ch. 2 — la liste officielle des applications. */
export const APPS: readonly AppDefinition[] = [
  { id: 'telephone', name: 'Téléphone', icon: '📞', category: 'communication', addedByUpdate: false },
  { id: 'messages', name: 'Messages', icon: '💬', category: 'communication', addedByUpdate: false },
  { id: 'appelsVideo', name: 'Appels vidéo', icon: '📹', category: 'communication', addedByUpdate: false },
  { id: 'contacts', name: 'Contacts', icon: '👥', category: 'communication', addedByUpdate: false },
  { id: 'galerie', name: 'Galerie', icon: '🖼️', category: 'média', addedByUpdate: false },
  { id: 'appareilPhoto', name: 'Appareil photo', icon: '📷', category: 'média', addedByUpdate: false },
  { id: 'banque', name: 'Banque', icon: '🏦', category: 'finance', addedByUpdate: false },
  { id: 'agenda', name: 'Agenda', icon: '🗓️', category: 'utilitaire', addedByUpdate: false },
  { id: 'gps', name: 'GPS', icon: '🧭', category: 'utilitaire', addedByUpdate: false },
  { id: 'spotify', name: 'Spotify', icon: '🎵', category: 'média', addedByUpdate: false },
  { id: 'snapstreak', name: 'Snapstreak', icon: '🔥', category: 'communication', addedByUpdate: false },
  { id: 'reseauxSociaux', name: 'Réseaux sociaux', icon: '🌐', category: 'lifestyle', addedByUpdate: false },
  { id: 'boutique', name: 'Boutique', icon: '🛍️', category: 'lifestyle', addedByUpdate: false },
  { id: 'commandes', name: 'Commandes', icon: '📦', category: 'lifestyle', addedByUpdate: false },
  { id: 'livraison', name: 'Livraison', icon: '🚚', category: 'lifestyle', addedByUpdate: false },
  { id: 'iaSecretaire', name: 'IA Secrétaire', icon: '🤖', category: 'assistant', addedByUpdate: false },
  { id: 'meteo', name: 'Météo', icon: '⛅', category: 'utilitaire', addedByUpdate: false },
  { id: 'actualites', name: 'Actualités', icon: '📰', category: 'média', addedByUpdate: false },
  { id: 'calendrier', name: 'Calendrier', icon: '📅', category: 'utilitaire', addedByUpdate: false },
  { id: 'mail', name: 'Mail', icon: '✉️', category: 'communication', addedByUpdate: false },
  { id: 'notes', name: 'Notes', icon: '📝', category: 'utilitaire', addedByUpdate: false },
];

/** Contexte d'usage : chaque situation possède ses animations (Tome XI, ch. 1). */
export type PhoneContext =
  | 'maison'
  | 'voiture'
  | 'avion'
  | 'hôtel'
  | 'centre d’entraînement'
  | 'rue'
  | 'vestiaire'
  | 'tribune';

/**
 * Transforme une phrase en hashtag lisible : ponctuation retirée, mots
 * capitalisés et collés. « Titre — Coupe de France pour Paris » → #TitreCoupeDeFrance.
 */
function hashtagFrom(text: string): string {
  const words = text
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1)
    .slice(0, 4)
    .map((word) => word.charAt(0).toLocaleUpperCase('fr-FR') + word.slice(1));
  return `#${words.join('')}`;
}

const CONTEXT_ANIMATIONS: Record<PhoneContext, string> = {
  maison: 'phone.hold.relaxed',
  voiture: 'phone.hold.seated.oneHand',
  avion: 'phone.hold.traytable',
  hôtel: 'phone.hold.lounging',
  'centre d’entraînement': 'phone.hold.standing.quick',
  rue: 'phone.hold.walking',
  vestiaire: 'phone.hold.bench',
  tribune: 'phone.hold.raised',
};

export interface Contact {
  readonly id: string;
  name: string;
  readonly relationId: string | null;
  readonly category: 'famille' | 'ami' | 'club' | 'agent' | 'marque' | 'média' | 'coéquipier';
  favourite: boolean;
}

export interface Message {
  readonly id: string;
  readonly contactId: string;
  readonly from: 'joueur' | 'contact';
  readonly text: string;
  readonly at: number;
  read: boolean;
}

export interface Photo {
  readonly id: string;
  readonly caption: string;
  readonly at: number;
  readonly location: string;
  readonly tags: readonly string[];
  /** Publiée sur les réseaux. */
  published: boolean;
}

export type PostKind = 'photo' | 'vidéo' | 'story' | 'annonce' | 'trophée' | 'vacances' | 'entraînement' | 'match';

export interface SocialPost {
  readonly id: string;
  readonly kind: PostKind;
  readonly text: string;
  readonly at: number;
  likes: number;
  shares: number;
  readonly comments: SocialComment[];
  /** Portée estimée. */
  reach: number;
}

export interface SocialComment {
  readonly id: string;
  readonly author: string;
  readonly text: string;
  /** Sentiment -1..1. */
  readonly sentiment: number;
  readonly at: number;
}

export interface Snap {
  readonly id: string;
  readonly contactId: string;
  readonly direction: 'envoyé' | 'reçu';
  readonly caption: string;
  readonly at: number;
}

export interface Streak {
  readonly contactId: string;
  days: number;
  lastExchangeAt: number;
  /** Le streak s'éteint sans échange sous 24 h. */
  alive: boolean;
}

export interface AgendaEntry {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly at: number;
  readonly kind: 'entraînement' | 'match' | 'conférence' | 'voyage' | 'événement' | 'personnel' | 'commande';
  done: boolean;
}

export interface MailItem {
  readonly id: string;
  readonly from: string;
  readonly subject: string;
  readonly body: string;
  readonly at: number;
  read: boolean;
  readonly requiresAction: boolean;
}

export interface Note {
  readonly id: string;
  title: string;
  body: string;
  readonly createdAt: number;
  updatedAt: number;
}

export class PhoneSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'phone',
    // Le téléphone agrège médias, calendrier, commerce et voyages : il doit
    // donc s'initialiser après eux (l'ordonnanceur initialise par `order`).
    name: 'Smartphone & vie numérique',
    order: 140,
    tomes: ['VIII', 'XI', 'XII'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private commerce!: CommerceSystem;
  private travel!: TravelSystem;
  private life!: LifeSystem;
  private media!: MediaSystem;
  private audio!: AudioSystem;
  private calendar!: WorldCalendarSystem;
  private career: CareerSystem | null = null;
  private readonly dialogue = new DialogueEngine(800);

  private phoneContext: PhoneContext = 'maison';
  private battery = 1;
  private openApp: AppId | null = null;
  private readonly installedApps = new Set<AppId>(APPS.map((a) => a.id));

  private readonly contacts = new Map<string, Contact>();
  private readonly messages: Message[] = [];
  private readonly photos: Photo[] = [];
  private readonly posts: SocialPost[] = [];
  private readonly snaps: Snap[] = [];
  private readonly streaks = new Map<string, Streak>();
  private readonly agenda: AgendaEntry[] = [];
  private readonly mailbox: MailItem[] = [];
  private readonly notes = new Map<string, Note>();
  private seasons!: SeasonSystem;
  private weeklyTrends: string[] = [];
  private followers = 12_000;
  private counter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.commerce = context.require<CommerceSystem>(COMMERCE_SERVICE);
    this.travel = context.require<TravelSystem>(TRAVEL_SERVICE);
    this.life = context.require<LifeSystem>(LIFE_SERVICE);
    this.media = context.require<MediaSystem>(MEDIA_SERVICE);
    this.audio = context.require<AudioSystem>(AUDIO_SERVICE);
    this.calendar = context.require<WorldCalendarSystem>(CALENDAR_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    context.provide(PHONE_SERVICE, this);

    this.syncContactsFromLife();
    this.refreshTrends();

    // L'IA secrétaire écoute le monde pour alimenter l'agenda et les rappels.
    context.events.on('commerce.orderPlaced', (event) => {
      this.addAgendaEntry(
        'commande',
        'Livraison attendue',
        `Commande ${event.orderId} — ${event.deliveryTarget}`,
        this.commerce.order(event.orderId)?.expectedAt ?? context.clock.absoluteMinutes,
      );
    });
    context.events.on('travel.booked', (event) => {
      this.addAgendaEntry('voyage', 'Départ', `Vers ${event.toCityId} en ${event.mode}`, context.clock.absoluteMinutes + 60);
    });
    context.events.on('assistant.reminder', (event) => {
      this.addMail('IA Secrétaire', event.subject, event.detail, false);
    });
    context.events.on('career.trophyWon', (event) => {
      this.publish('trophée', `${event.trophyName} — saison ${event.season}`);
    });
    // Les titres du reste du monde restent dans l'appli Actualités, alimentée
    // par les alertes de la presse : le joueur ne publie que ses propres titres.

    // Le football de rue vit sur le téléphone avant de vivre dans la presse :
    // c'est là que la vidéo tourne et que l'invitation arrive (Tome XI, ch. 3).
    context.events.on('street.viral', (event) => {
      const gained = Math.round(event.views / 55);
      this.followers += gained;
      this.publish('vidéo', `${event.title} — ${event.pitchName}`);
      this.addMail(
        'Réseaux sociaux',
        'Votre vidéo décolle',
        `« ${event.title} » — ${event.views.toLocaleString('fr-FR')} vues, ${gained.toLocaleString('fr-FR')} nouveaux abonnés.`,
        false,
      );
    });

    context.events.on('street.tournament', (event) => {
      if (event.stage === 'invitation') {
        this.addMail('Inconnu', event.tournamentName, event.detail, true);
        return;
      }
      if (event.stage === 'won') {
        this.publish('trophée', `${event.tournamentName} — ${event.detail}`);
      }
    });
  }

  // ── État du téléphone ────────────────────────────────────────────────────

  setContext(phoneContext: PhoneContext): void {
    this.phoneContext = phoneContext;
    this.context.emit({
      type: 'animation.played',
      clipId: CONTEXT_ANIMATIONS[phoneContext],
      actorId: 'player',
      context: `téléphone — ${phoneContext}`,
    });
  }

  get currentContext(): PhoneContext {
    return this.phoneContext;
  }

  get animationClip(): string {
    return CONTEXT_ANIMATIONS[this.phoneContext];
  }

  get batteryLevel(): number {
    return round(this.battery, 3);
  }

  charge(amount = 1): void {
    this.battery = clamp01(this.battery + amount);
  }

  /** Ouvre une application ; consomme un peu de batterie. */
  open(appId: AppId): boolean {
    if (!this.installedApps.has(appId)) return false;
    this.openApp = appId;
    this.battery = clamp01(this.battery - 0.004);
    return true;
  }

  get currentApp(): AppId | null {
    return this.openApp;
  }

  close(): void {
    this.openApp = null;
  }

  get apps(): AppDefinition[] {
    return APPS.filter((app) => this.installedApps.has(app.id));
  }

  /** Une mise à jour peut ajouter une application (Tome XI, ch. 2). */
  installApp(app: AppDefinition): void {
    this.installedApps.add(app.id);
  }

  /** Badge de notifications par application, affiché sur l'écran d'accueil. */
  badges(): Record<string, number> {
    return {
      messages: this.messages.filter((m) => !m.read && m.from === 'contact').length,
      mail: this.mailbox.filter((m) => !m.read).length,
      commandes: this.commerce.pendingOrders.length,
      snapstreak: this.snaps.filter(
        (s) => s.direction === 'reçu' && s.at > this.context.clock.absoluteMinutes - 24 * 60,
      ).length,
      actualites: this.media.liveAlerts(5).length,
      agenda: this.agenda.filter((e) => !e.done && e.at > this.context.clock.absoluteMinutes).length,
      reseauxSociaux: this.posts.slice(-3).reduce((sum, p) => sum + p.comments.length, 0),
    };
  }

  // ── Contacts, messages, appels ───────────────────────────────────────────

  private syncContactsFromLife(): void {
    for (const relation of this.life.allRelations) {
      const category: Contact['category'] =
        relation.kind === 'ami' ? 'ami' :
        relation.kind === 'agent' ? 'agent' :
        relation.kind === 'coéquipier' ? 'coéquipier' : 'famille';
      const contact: Contact = {
        id: `contact:${relation.id}`,
        name: relation.name,
        relationId: relation.id,
        category,
        favourite: relation.closeness > 0.7,
      };
      this.contacts.set(contact.id, contact);
    }
    // Contacts professionnels systématiques.
    for (const [name, category] of [
      ['Secrétariat du club', 'club'],
      ['Service médical', 'club'],
      ['Attaché de presse', 'média'],
      ['Responsable équipementier', 'marque'],
    ] as const) {
      const contact: Contact = {
        id: `contact:pro:${name}`,
        name,
        relationId: null,
        category,
        favourite: false,
      };
      this.contacts.set(contact.id, contact);
    }
  }

  get contactList(): Contact[] {
    return [...this.contacts.values()].sort(
      (a, b) => Number(b.favourite) - Number(a.favourite) || a.name.localeCompare(b.name),
    );
  }

  sendMessage(contactId: string, text: string): Message | null {
    const contact = this.contacts.get(contactId);
    if (!contact) return null;
    const now = this.context.clock.absoluteMinutes;
    const message: Message = {
      id: `msg:${this.counter++}`,
      contactId,
      from: 'joueur',
      text,
      at: now,
      read: true,
    };
    this.messages.push(message);

    // Réponse générée par l'IA du contact.
    const rng = this.context.stream('phone.messages');
    const reply: Message = {
      id: `msg:${this.counter++}`,
      contactId,
      from: 'contact',
      text: this.dialogue.generate(
        contact.category === 'coéquipier' ? 'coequipier.vestiaire' : 'pnj.quotidien',
        'neutre',
        { player: this.playerName(), city: this.cityName() },
        rng,
      ).text,
      at: now + rng.int(2, 45),
      read: false,
    };
    this.messages.push(reply);

    if (contact.relationId) {
      const relation = this.life.relation(contact.relationId);
      if (relation) relation.lastContact = now;
    }
    return message;
  }

  conversation(contactId: string, limit = 30): Message[] {
    return this.messages
      .filter((m) => m.contactId === contactId)
      .slice(-limit);
  }

  markConversationRead(contactId: string): void {
    for (const message of this.messages) {
      if (message.contactId === contactId) message.read = true;
    }
  }

  /** Appel vocal ou vidéo : renforce la relation davantage qu'un message. */
  call(contactId: string, video: boolean): { connected: boolean; minutes: number } {
    const contact = this.contacts.get(contactId);
    if (!contact) return { connected: false, minutes: 0 };
    const rng = this.context.stream('phone.calls');
    const connected = rng.chance(0.85);
    if (!connected) return { connected: false, minutes: 0 };
    const minutes = rng.int(3, video ? 35 : 20);
    this.context.clock.advanceMinutes(minutes);
    this.battery = clamp01(this.battery - minutes * (video ? 0.004 : 0.0015));
    if (contact.relationId) {
      const relation = this.life.relation(contact.relationId);
      if (relation) {
        relation.closeness = clamp(relation.closeness + (video ? 0.05 : 0.03), -1, 1);
        relation.lastContact = this.context.clock.absoluteMinutes;
      }
    }
    return { connected: true, minutes };
  }

  // ── Appareil photo & galerie ─────────────────────────────────────────────

  takePhoto(caption: string, tags: readonly string[] = []): Photo {
    const photo: Photo = {
      id: `photo:${this.counter++}`,
      caption,
      at: this.context.clock.absoluteMinutes,
      location: this.currentLocationLabel(),
      tags,
      published: false,
    };
    this.photos.push(photo);
    if (this.photos.length > 500) this.photos.splice(0, this.photos.length - 500);
    this.battery = clamp01(this.battery - 0.002);
    return photo;
  }

  get gallery(): readonly Photo[] {
    return this.photos;
  }

  // ── Réseaux sociaux (Tome XI, ch. 3) ─────────────────────────────────────

  publish(kind: PostKind, text: string, photoId?: string): SocialPost {
    const rng = this.context.stream('phone.social');
    const fame = this.career?.hasCareer ? this.career.player.fame : 10;
    const reputation = this.career?.hasCareer ? this.career.player.reputation : 10;
    const now = this.context.clock.absoluteMinutes;

    const baseReach = this.followers * (0.18 + fame / 260);
    const kindBoost =
      kind === 'trophée' ? 2.6 : kind === 'annonce' ? 1.9 : kind === 'match' ? 1.4 : kind === 'story' ? 0.6 : 1;
    const reach = Math.round(baseReach * kindBoost * rng.range(0.8, 1.4));

    const post: SocialPost = {
      id: `post:${this.counter++}`,
      kind,
      text,
      at: now,
      likes: Math.round(reach * rng.range(0.06, 0.16)),
      shares: Math.round(reach * rng.range(0.004, 0.02)),
      comments: [],
      reach,
    };

    // Commentaires générés par de véritables IA (Tome XI, ch. 3).
    const commentCount = clamp(Math.round(reach / 4000), 2, 14);
    const pool = NAME_POOLS[rng.int(0, NAME_POOLS.length - 1)] as (typeof NAME_POOLS)[number];
    for (let i = 0; i < commentCount; i++) {
      const sentiment = clamp(rng.gaussian(reputation > 60 ? 0.45 : 0.15, 0.45), -1, 1);
      post.comments.push({
        id: `comment:${this.counter++}`,
        author: `${rng.pick(pool.given)} ${rng.pick(pool.family).charAt(0)}.`,
        text: this.dialogue.generate(
          'social.commentaire',
          sentiment > 0.35 ? 'enthousiaste' : sentiment < -0.2 ? 'critique' : 'neutre',
          { player: this.playerName(), award: 'Boubjack Award', formerClub: this.formerClubName() },
          rng,
        ).text,
        sentiment,
        at: now + rng.int(1, 240),
      });
    }

    this.posts.push(post);
    if (this.posts.length > 300) this.posts.splice(0, this.posts.length - 300);

    // La publication fait gagner des abonnés et un peu de notoriété.
    const gained = Math.round(reach * rng.range(0.004, 0.02) * (kind === 'trophée' ? 3 : 1));
    this.followers += gained;
    this.career?.adjustReputation(kind === 'trophée' ? 0.4 : 0.12, 'publication sociale');

    if (photoId) {
      const photo = this.photos.find((p) => p.id === photoId);
      if (photo) photo.published = true;
    }

    const averageSentiment =
      post.comments.length > 0
        ? post.comments.reduce((sum, c) => sum + c.sentiment, 0) / post.comments.length
        : 0;

    this.context.emit({
      type: 'social.post',
      postId: post.id,
      authorId: this.career?.hasCareer ? this.career.player.identity.id : 'player',
      kind,
      reach,
      sentiment: round(averageSentiment, 3),
    });
    return post;
  }

  get feed(): readonly SocialPost[] {
    return this.posts;
  }

  get followerCount(): number {
    return this.followers;
  }

  get trends(): readonly string[] {
    return this.weeklyTrends;
  }

  /** Les tendances évoluent chaque semaine (Tome XI, ch. 3). */
  private refreshTrends(): void {
    const rng = this.context.stream('phone.trends');
    const alerts = this.media
      .liveAlerts(6)
      .map((a) => hashtagFrom(a.text))
      .filter((tag) => tag.length > 2);
    const evergreen = [
      '#MercatoDuJour',
      '#XIDeLaSemaine',
      '#DébatFoot',
      '#BoubjackAwards',
      '#ButDeLaSemaine',
      '#JeunesTalents',
      '#AmbianceStade',
      '#RetourDeBlessure',
    ];
    this.weeklyTrends = [...alerts.slice(0, 4), ...rng.pickMany(evergreen, 4)].slice(0, 8);
  }

  // ── Snapstreak (Tome XI, ch. 4) ──────────────────────────────────────────

  sendSnap(contactId: string, caption: string): Snap | null {
    const contact = this.contacts.get(contactId);
    if (!contact) return null;
    const now = this.context.clock.absoluteMinutes;
    const snap: Snap = {
      id: `snap:${this.counter++}`,
      contactId,
      direction: 'envoyé',
      caption,
      at: now,
    };
    this.snaps.push(snap);

    const streak = this.streaks.get(contactId) ?? {
      contactId,
      days: 0,
      lastExchangeAt: now,
      alive: true,
    };
    const hoursSince = (now - streak.lastExchangeAt) / 60;
    if (!streak.alive || hoursSince > 24) {
      streak.days = 1;
      streak.alive = true;
      this.context.emit({ type: 'social.snapstreak', contactId, streak: 1, action: 'started' });
    } else if (hoursSince >= 20) {
      streak.days += 1;
      this.context.emit({ type: 'social.snapstreak', contactId, streak: streak.days, action: 'kept' });
    }
    streak.lastExchangeAt = now;
    this.streaks.set(contactId, streak);

    // Le proche répond souvent dans la foulée.
    const rng = this.context.stream('phone.snaps');
    if (rng.chance(0.7)) {
      this.snaps.push({
        id: `snap:${this.counter++}`,
        contactId,
        direction: 'reçu',
        caption: rng.pick(['💪', 'à ce soir !', 'bien joué hier', 'tu passes ?', '🔥', 'trop fort']),
        at: now + rng.int(2, 90),
      });
    }
    return snap;
  }

  postStory(caption: string): SocialPost {
    return this.publish('story', caption);
  }

  get activeStreaks(): Streak[] {
    return [...this.streaks.values()].filter((s) => s.alive).sort((a, b) => b.days - a.days);
  }

  get snapInbox(): Snap[] {
    return this.snaps.filter((s) => s.direction === 'reçu').slice(-40).reverse();
  }

  // ── Banque, boutique, commandes, livraison ───────────────────────────────

  bankOverview(): {
    accounts: Array<{ label: string; balance: number }>;
    netWorth: number;
    monthlyCommitments: number;
    lastTransactions: Array<{ label: string; amount: number; at: string }>;
  } {
    return {
      accounts: this.economy.allAccounts.map((a) => ({ label: a.label, balance: a.balance })),
      netWorth: this.economy.netWorth,
      monthlyCommitments: this.economy.monthlyCommitments,
      lastTransactions: this.economy.history({ limit: 12 }).map((t) => ({
        label: t.label,
        amount: t.amount,
        at: formatDateTimeFr(dateFromAbsoluteMinutes(t.at)),
      })),
    };
  }

  shopCatalogue(category?: ProductCategory) {
    return this.commerce.catalogue({ category, cityId: this.travel.cityId });
  }

  orderTracking() {
    return this.commerce.allOrders.map((order) => ({
      id: order.id,
      status: order.status,
      total: order.total,
      target: order.target,
      expected: formatDateTimeFr(dateFromAbsoluteMinutes(order.expectedAt)),
      courier: order.courierName,
      tracking: order.tracking.map((step) => ({
        label: step.label,
        at: formatTimeFr(dateFromAbsoluteMinutes(step.at)),
      })),
    }));
  }

  // ── GPS ──────────────────────────────────────────────────────────────────

  navigate(query: string): Array<{ name: string; type: string; minutes: number; mode: string; distanceKm: number }> {
    const city = this.world.city(this.travel.cityId);
    const results = searchVenues(city, query, { openOnly: false, limit: 6 });
    const from = this.travel.venueId ?? city.districts[0]?.id ?? '';
    return results.map((venue) => {
      const route = routeWithinCity(city, from, venue.id, 'car');
      return {
        name: venue.name,
        type: venue.type,
        minutes: Math.round(route.durationMinutes),
        mode: MODE_PROFILES.car.label,
        distanceKm: round(route.distanceKm, 2),
      };
    });
  }

  // ── Météo, actualités, calendrier ────────────────────────────────────────

  weather(cityId = this.travel.cityId): {
    city: string;
    condition: string;
    temperature: number;
    wind: number;
    severity: number;
    advice: string;
  } {
    const city = this.world.city(cityId);
    const advice =
      city.weather.severity > 0.6
        ? 'déplacements perturbés, prévoyez du temps supplémentaire'
        : city.weather.condition === 'clear'
          ? 'conditions idéales pour les activités extérieures'
          : 'rien de particulier à signaler';
    return {
      city: city.def.name,
      condition: city.weather.condition,
      temperature: city.weather.temperatureC,
      wind: city.weather.windKmh,
      severity: city.weather.severity,
      advice,
    };
  }

  news(limit = 8) {
    return this.media.frontPage(limit).map((article) => ({
      headline: article.headline,
      outlet: article.outletName,
      tone: article.tone,
      at: formatDateTimeFr(dateFromAbsoluteMinutes(article.publishedAt)),
    }));
  }

  worldCalendar(limit = 6) {
    return this.calendar.upcoming(limit).map((event) => ({
      name: event.name,
      city: this.cityNameOf(event.hostCityId),
      startsAt: formatDateTimeFr(dateFromAbsoluteMinutes(event.startsAt)),
      magnitude: event.magnitude,
    }));
  }

  // ── Agenda, mail, notes ──────────────────────────────────────────────────

  addAgendaEntry(
    kind: AgendaEntry['kind'],
    title: string,
    detail: string,
    at: number,
  ): AgendaEntry {
    const entry: AgendaEntry = { id: `agenda:${this.counter++}`, title, detail, at, kind, done: false };
    this.agenda.push(entry);
    this.agenda.sort((a, b) => a.at - b.at);
    return entry;
  }

  get upcomingAgenda(): AgendaEntry[] {
    const now = this.context.clock.absoluteMinutes;
    return this.agenda.filter((e) => !e.done && e.at >= now - 60).slice(0, 20);
  }

  completeAgendaEntry(id: string): boolean {
    const entry = this.agenda.find((e) => e.id === id);
    if (!entry) return false;
    entry.done = true;
    return true;
  }

  addMail(from: string, subject: string, body: string, requiresAction: boolean): MailItem {
    const mail: MailItem = {
      id: `mail:${this.counter++}`,
      from,
      subject,
      body,
      at: this.context.clock.absoluteMinutes,
      read: false,
      requiresAction,
    };
    this.mailbox.push(mail);
    if (this.mailbox.length > 300) this.mailbox.splice(0, this.mailbox.length - 300);
    return mail;
  }

  get inbox(): MailItem[] {
    return [...this.mailbox].reverse();
  }

  readMail(id: string): MailItem | null {
    const mail = this.mailbox.find((m) => m.id === id);
    if (!mail) return null;
    mail.read = true;
    return mail;
  }

  writeNote(title: string, body: string): Note {
    const now = this.context.clock.absoluteMinutes;
    const note: Note = { id: `note:${this.counter++}`, title, body, createdAt: now, updatedAt: now };
    this.notes.set(note.id, note);
    return note;
  }

  updateNote(id: string, body: string): boolean {
    const note = this.notes.get(id);
    if (!note) return false;
    note.body = body;
    note.updatedAt = this.context.clock.absoluteMinutes;
    return true;
  }

  get allNotes(): Note[] {
    return [...this.notes.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // ── IA Secrétaire (Tome VIII, ch. 5 ; Tome XI, ch. 6) ────────────────────

  /** Briefing quotidien complet, disponible 24 h/24. */
  secretaryBriefing(): {
    salutation: string;
    agenda: string[];
    finances: string;
    orders: string[];
    news: string[];
    invitations: string[];
    birthdays: string[];
    recommendations: string[];
    performance: string;
  } {
    const date = this.context.clock.date;
    const hour = date.hour;
    const salutation =
      hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
    const summary = this.economy.summary(30);

    // L'heure seule suffit pour aujourd'hui ; au-delà, la date évite de lire
    // « 02:00 » sans savoir de quel jour il s'agit.
    const today = Math.floor(this.context.clock.absoluteMinutes / MINUTES_PER_DAY);
    const agenda = this.upcomingAgenda.slice(0, 6).map((entry) => {
      const entryDate = dateFromAbsoluteMinutes(entry.at);
      const when =
        Math.floor(entry.at / MINUTES_PER_DAY) === today
          ? formatTimeFr(entryDate)
          : formatDateTimeFr(entryDate);
      return `${when} — ${entry.title} (${entry.detail})`;
    });
    const orders = this.commerce.pendingOrders.map(
      (order) => `${order.id} : ${order.status}, livraison ${formatDateTimeFr(dateFromAbsoluteMinutes(order.expectedAt))}`,
    );
    const news = this.media.frontPage(3).map((a) => `${a.outletName} — ${a.headline}`);
    const invitations = this.career?.hasCareer
      ? this.career.starOpportunities().slice(0, 3).map((o) => `${o.label} (${o.fee.toLocaleString('fr-FR')} €)`)
      : [];
    const birthdays = this.life.allRelations
      .filter((r) => r.birthday.month === date.month && Math.abs(r.birthday.day - date.day) <= 3)
      .map((r) => `${r.name} — ${r.birthday.day}/${r.birthday.month}`);

    const recommendations = [...this.investmentAdvice(), ...this.careerAdvice()];
    const performance = this.career?.hasCareer
      ? `${this.career.statline()} — réputation ${Math.round(this.career.player.reputation)}/100, forme ${Math.round(this.career.player.form * 100)}%`
      : 'aucune carrière active';

    return {
      salutation: `${salutation} ${this.playerName()}.`,
      agenda,
      finances: `Solde courant : ${this.economy.account('courant').balance.toLocaleString('fr-FR')} € — revenus 30 j : ${summary.income.toLocaleString('fr-FR')} €, dépenses : ${summary.expenses.toLocaleString('fr-FR')} €`,
      orders,
      news,
      invitations,
      birthdays,
      recommendations,
      performance,
    };
  }

  /** Recommandations d'investissement, fondées sur le patrimoine réel. */
  investmentAdvice(): string[] {
    const advice: string[] = [];
    const liquidity = this.economy.account('courant').balance;
    const commitments = this.economy.monthlyCommitments;

    if (liquidity < commitments * 3) {
      advice.push('Trésorerie faible au regard des charges mensuelles : évitez tout nouvel engagement.');
    }
    if (liquidity > 2_000_000) {
      advice.push('Liquidités élevées : un placement immobilier stabiliserait le patrimoine.');
    }
    if (liquidity > 8_000_000) {
      advice.push('Un investissement dans une académie renforcerait aussi votre image publique.');
    }
    const risky = this.economy.activeInvestments.filter((i) => i.risk > 0.5);
    if (risky.length >= 3) {
      advice.push(`${risky.length} investissements à risque élevé : envisagez un rééquilibrage.`);
    }
    if (this.economy.activeInvestments.length === 0 && liquidity > 500_000) {
      advice.push('Aucun investissement en cours : le portefeuille dort.');
    }
    return advice;
  }

  /**
   * Conseils sportifs, fondés sur l'état réel du joueur : la secrétaire ne se
   * limite pas au patrimoine (Tome VIII, ch. 5).
   */
  careerAdvice(): string[] {
    const advice: string[] = [];
    if (!this.career?.hasCareer) return advice;
    const player = this.career.player;
    if (player.retired) {
      advice.push('Carrière terminée : votre agenda peut accueillir un rôle d’après-carrière.');
      return advice;
    }

    if (player.fitness < 0.7) {
      advice.push(`Condition physique à ${Math.round(player.fitness * 100)} % : allégez la charge cette semaine.`);
    }
    if (player.morale < 0.45) {
      advice.push('Moral bas : un temps avec vos proches ou une victoire relanceraient la dynamique.');
    }
    if (player.form < 0.45) {
      advice.push('Forme en baisse : privilégiez les séances techniques aux sollicitations médiatiques.');
    }
    const contract = this.career.currentContract;
    if (contract && contract.expiresSeason - this.seasons.season <= 1) {
      advice.push('Contrat à échéance proche : ouvrez les discussions avant le mercato.');
    }
    if (advice.length === 0) {
      advice.push(`Tout est au vert : ${this.career.statline()}, continuez sur cette base.`);
    }
    return advice;
  }

  /** L'IA secrétaire organise un voyage complet de bout en bout. */
  arrangeTrip(
    destinationCityId: string,
    options: { nights: number; withRestaurant: boolean; companions?: readonly string[] },
  ): { booked: boolean; summary: string } {
    const journey = this.travel.book(destinationCityId, {
      prefer: 'comfort',
      companions: options.companions,
    });
    if (!journey) return { booked: false, summary: 'aucun itinéraire disponible ou budget insuffisant' };
    const hotel = this.travel.bookHotel(destinationCityId, options.nights, 'suite');
    const restaurant = options.withRestaurant
      ? this.travel.bookRestaurant(destinationCityId, (options.companions?.length ?? 0) + 1)
      : null;

    this.addAgendaEntry(
      'voyage',
      `Départ pour ${this.cityNameOf(destinationCityId)}`,
      `${journey.route.legs.length} segment(s), ${Math.round(journey.route.totalMinutes)} min`,
      journey.departsAt,
    );

    const parts = [
      `Voyage réservé (${journey.cost.toLocaleString('fr-FR')} €)`,
      hotel ? `hôtel ${options.nights} nuit(s) en ${hotel.roomType}` : 'aucun hôtel disponible',
    ];
    if (restaurant) parts.push('table réservée au restaurant');
    return { booked: true, summary: parts.join(', ') };
  }

  /** Réponse en langage naturel de l'IA secrétaire. */
  ask(question: string): string {
    const normalised = question.toLowerCase();
    if (normalised.includes('solde') || normalised.includes('argent') || normalised.includes('compte')) {
      return `Votre compte courant affiche ${this.economy.account('courant').balance.toLocaleString('fr-FR')} €, pour un patrimoine total de ${this.economy.netWorth.toLocaleString('fr-FR')} €.`;
    }
    if (normalised.includes('météo') || normalised.includes('temps')) {
      const w = this.weather();
      return `À ${w.city} : ${w.condition}, ${w.temperature} °C, vent ${w.wind} km/h. ${w.advice}.`;
    }
    if (normalised.includes('agenda') || normalised.includes('rendez-vous') || normalised.includes('programme')) {
      const entries = this.upcomingAgenda.slice(0, 3);
      return entries.length === 0
        ? 'Votre agenda est vide pour les prochaines heures.'
        : `Prochainement : ${entries.map((e) => `${e.title} à ${formatTimeFr(dateFromAbsoluteMinutes(e.at))}`).join(', ')}.`;
    }
    if (normalised.includes('commande') || normalised.includes('livraison') || normalised.includes('colis')) {
      const pending = this.commerce.pendingOrders;
      return pending.length === 0
        ? 'Aucune commande en cours.'
        : `${pending.length} commande(s) en cours, la plus proche arrive le ${formatDateTimeFr(dateFromAbsoluteMinutes(pending[0]?.expectedAt ?? 0))}.`;
    }
    if (normalised.includes('entraînement') || normalised.includes('entrainement')) {
      const next = this.agenda.find((e) => e.kind === 'entraînement' && !e.done);
      return next
        ? `Prochain entraînement : ${formatDateTimeFr(dateFromAbsoluteMinutes(next.at))}.`
        : 'Aucun entraînement planifié pour le moment.';
    }
    if (normalised.includes('vol') || normalised.includes('voyage') || normalised.includes('avion')) {
      const journey = this.travel.activeJourney;
      return journey
        ? `Voyage en cours vers ${this.cityNameOf(journey.toCityId)}, étape : ${journey.stage}.`
        : 'Aucun voyage en cours.';
    }
    if (normalised.includes('investis') || normalised.includes('placement')) {
      const advice = this.investmentAdvice();
      return advice.length > 0 ? advice.join(' ') : 'Votre portefeuille est équilibré.';
    }
    if (normalised.includes('anniversaire')) {
      const date = this.context.clock.date;
      const upcoming = this.life.allRelations.filter(
        (r) => r.birthday.month === date.month && r.birthday.day >= date.day,
      );
      return upcoming.length === 0
        ? 'Aucun anniversaire proche ce mois-ci.'
        : `À venir : ${upcoming.map((r) => `${r.name} le ${r.birthday.day}`).join(', ')}.`;
    }
    if (normalised.includes('performance') || normalised.includes('statistique') || normalised.includes('carrière')) {
      return this.career?.hasCareer
        ? `${this.career.statline()}. Réputation ${Math.round(this.career.player.reputation)}/100, valeur marchande ${this.career.player.marketValue.toLocaleString('fr-FR')} €.`
        : 'Aucune carrière active à analyser.';
    }
    if (normalised.includes('actualité') || normalised.includes('news') || normalised.includes('presse')) {
      return this.news(3).map((n) => `${n.outlet} : ${n.headline}`).join(' — ');
    }
    if (normalised.includes('musique') || normalised.includes('spotify')) {
      const now = this.audio.nowPlaying;
      return now.track
        ? `En lecture : ${now.track.title} — ${now.track.artist} (contexte ${now.context}).`
        : 'Aucune lecture en cours.';
    }
    return 'Je peux gérer votre agenda, vos finances, vos voyages, vos commandes, vos invitations et vos anniversaires. Que souhaitez-vous ?';
  }

  // ── Spotify ──────────────────────────────────────────────────────────────

  connectSpotify(account: string): void {
    const rng = this.context.stream('phone.spotify');
    this.audio.connectSpotify(account, [
      {
        id: 'spotify:matchday',
        name: 'Matchday',
        source: 'spotify',
        tracks: Array.from({ length: 12 }, (_, i) => ({
          id: `sp:matchday:${i}`,
          title: `Matchday Track ${i + 1}`,
          artist: 'Playlist personnelle',
          durationSeconds: rng.int(150, 260),
          source: 'spotify' as const,
          mood: 'énergique' as const,
        })),
      },
      {
        id: 'spotify:drive',
        name: 'Night Drive',
        source: 'spotify',
        tracks: Array.from({ length: 10 }, (_, i) => ({
          id: `sp:drive:${i}`,
          title: `Drive ${i + 1}`,
          artist: 'Playlist personnelle',
          durationSeconds: rng.int(160, 280),
          source: 'spotify' as const,
          mood: 'urbain' as const,
        })),
      },
      {
        id: 'spotify:chill',
        name: 'Maison',
        source: 'spotify',
        tracks: Array.from({ length: 14 }, (_, i) => ({
          id: `sp:chill:${i}`,
          title: `Chill ${i + 1}`,
          artist: 'Playlist personnelle',
          durationSeconds: rng.int(140, 300),
          source: 'spotify' as const,
          mood: 'calme' as const,
        })),
      },
    ]);
  }

  play(musicContext: Parameters<AudioSystem['playFor']>[0]) {
    const rng = this.context.stream('phone.play');
    return this.audio.playFor(musicContext, (items) => rng.pick(items));
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onHour(context: SimulationContext, date: GameDate): void {
    // Le téléphone se branche pour la nuit là où il y a une prise, et se vide
    // pendant la journée (Tome XI, ch. 1). Sans cela il restait à plat à vie.
    const plugged =
      this.phoneContext === 'maison' || this.phoneContext === 'hôtel' || this.phoneContext === 'voiture';
    const night = date.hour >= 23 || date.hour < 7;
    if (plugged && night) this.battery = clamp01(this.battery + 0.3);
    else this.battery = clamp01(this.battery - 0.012);

    // Les streaks meurent après 24 h sans échange.
    const now = context.clock.absoluteMinutes;
    for (const streak of this.streaks.values()) {
      if (!streak.alive) continue;
      if (now - streak.lastExchangeAt > 24 * 60) {
        streak.alive = false;
        context.emit({
          type: 'social.snapstreak',
          contactId: streak.contactId,
          streak: streak.days,
          action: 'lost',
        });
      }
    }

    // Sollicitations proportionnelles à la célébrité (Tome XI, ch. 8).
    const fame = this.career?.hasCareer ? this.career.player.fame : 0;
    const rng = context.stream('phone.solicitations');
    if (rng.chance(clamp01(fame / 400))) {
      const senders = ['Agence de communication', 'Marque partenaire', 'Association caritative', 'Chaîne TV'];
      this.addMail(
        rng.pick(senders),
        'Proposition de collaboration',
        'Nous souhaitons vous associer à un projet. Merci de nous répondre.',
        true,
      );
    }
  }

  onDay(context: SimulationContext, date: GameDate): void {
    // Les proches envoient des snaps (Tome XI, ch. 4).
    const rng = context.stream('phone.incoming');
    for (const contact of this.contacts.values()) {
      if (!contact.relationId) continue;
      const relation = this.life.relation(contact.relationId);
      if (!relation) continue;
      if (rng.chance(clamp01(relation.closeness * 0.35))) {
        this.snaps.push({
          id: `snap:${this.counter++}`,
          contactId: contact.id,
          direction: 'reçu',
          caption: rng.pick(['bonne journée !', 'regarde ça 😄', 'on se voit bientôt ?', '🔥', 'félicitations !']),
          at: context.clock.absoluteMinutes + rng.int(0, 600),
        });
      }
    }

    this.scheduleFootballAgenda();

    // Rappel matinal de l'IA secrétaire.
    if (date.hour <= 9) {
      const briefing = this.secretaryBriefing();
      if (briefing.agenda.length > 0) {
        context.emit({
          type: 'assistant.reminder',
          subject: 'programme du jour',
          detail: briefing.agenda[0] ?? '',
          dueAt: context.clock.absoluteMinutes,
        });
      }
    }
  }

  /**
   * L'agenda de l'IA secrétaire suit le vrai calendrier sportif : rencontres à
   * venir et séance de veille de match (Tome XI, ch. 6). Sans cela, l'agenda ne
   * contenait que les commandes et les voyages, et restait vide la plupart du
   * temps.
   */
  private scheduleFootballAgenda(): void {
    if (!this.career?.hasCareer || this.career.player.retired) return;
    const clubId = this.career.player.clubId;
    if (!clubId) return;

    for (const fixture of this.seasons.upcomingFor(clubId, 3)) {
      const home = getClub(fixture.homeClubId).name;
      const away = getClub(fixture.awayClubId).name;
      const label = `${home} — ${away}`;
      // Le crochet quotidien repasse sur les mêmes rencontres : on ne réinscrit
      // pas ce qui est déjà à l'agenda.
      this.addAgendaEntryOnce('match', label, 'rencontre officielle', fixture.kickoff);
      // Mise en place tactique la veille à 10 h, pas à une heure arbitraire.
      const eveOfMatch =
        (Math.floor(fixture.kickoff / MINUTES_PER_DAY) - 1) * MINUTES_PER_DAY + 10 * 60;
      this.addAgendaEntryOnce('entraînement', 'Séance de veille de match', `préparation de ${label}`, eveOfMatch);
    }
  }

  /** Ajoute une entrée d'agenda sauf si la même figure déjà au même horaire. */
  private addAgendaEntryOnce(
    kind: AgendaEntry['kind'],
    title: string,
    detail: string,
    at: number,
  ): void {
    if (this.agenda.some((entry) => entry.at === at && entry.title === title && entry.kind === kind)) return;
    this.addAgendaEntry(kind, title, detail, at);
  }

  onWeek(_context: SimulationContext, _date: GameDate): void {
    this.refreshTrends();
    // Croissance organique de l'audience selon la notoriété.
    const fame = this.career?.hasCareer ? this.career.player.fame : 5;
    this.followers = Math.round(this.followers * (1 + fame / 4000) + fame * 90);
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  private playerName(): string {
    return this.career?.hasCareer ? this.career.player.identity.name : 'Joueur';
  }

  private formerClubName(): string | undefined {
    const clubs = this.career?.formerClubs ?? [];
    return clubs[clubs.length - 1];
  }

  private cityName(): string {
    return this.cityNameOf(this.travel.cityId);
  }

  private cityNameOf(cityId: string): string {
    try {
      return getCity(cityId).name;
    } catch {
      return cityId;
    }
  }

  private currentLocationLabel(): string {
    const venueId = this.travel.venueId;
    if (!venueId) return this.cityName();
    const city = this.world.city(this.travel.cityId);
    return city.venues.get(venueId)?.name ?? this.cityName();
  }

  serialize(): unknown {
    return {
      phoneContext: this.phoneContext,
      battery: this.battery,
      installedApps: [...this.installedApps],
      contacts: [...this.contacts.values()],
      messages: this.messages.slice(-400),
      photos: this.photos.slice(-200),
      posts: this.posts.slice(-150),
      snaps: this.snaps.slice(-200),
      streaks: [...this.streaks.values()],
      agenda: this.agenda.slice(-200),
      mailbox: this.mailbox.slice(-150),
      notes: [...this.notes.values()],
      weeklyTrends: this.weeklyTrends,
      followers: this.followers,
      counter: this.counter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.phoneContext = (state.phoneContext as PhoneContext) ?? 'maison';
    this.battery = (state.battery as number) ?? 1;
    this.installedApps.clear();
    for (const id of (state.installedApps as AppId[]) ?? APPS.map((a) => a.id)) this.installedApps.add(id);
    this.contacts.clear();
    for (const contact of (state.contacts as Contact[]) ?? []) this.contacts.set(contact.id, contact);
    this.messages.length = 0;
    this.messages.push(...(((state.messages as Message[]) ?? [])));
    this.photos.length = 0;
    this.photos.push(...(((state.photos as Photo[]) ?? [])));
    this.posts.length = 0;
    this.posts.push(...(((state.posts as SocialPost[]) ?? [])));
    this.snaps.length = 0;
    this.snaps.push(...(((state.snaps as Snap[]) ?? [])));
    this.streaks.clear();
    for (const streak of (state.streaks as Streak[]) ?? []) this.streaks.set(streak.contactId, streak);
    this.agenda.length = 0;
    this.agenda.push(...(((state.agenda as AgendaEntry[]) ?? [])));
    this.mailbox.length = 0;
    this.mailbox.push(...(((state.mailbox as MailItem[]) ?? [])));
    this.notes.clear();
    for (const note of (state.notes as Note[]) ?? []) this.notes.set(note.id, note);
    this.weeklyTrends = (state.weeklyTrends as string[]) ?? [];
    this.followers = (state.followers as number) ?? 12_000;
    this.counter = (state.counter as number) ?? 0;
  }
}
