/**
 * Infinity Football — Événements / Boubjack Awards
 *
 * Tome VII intégralement :
 *  - ch. 2 : la cérémonie ne se déroule jamais deux années de suite dans la même
 *    ville ; chaque édition a sa scène, sa décoration et son identité visuelle ;
 *  - ch. 3 : tapis rouge (joueurs, joueuses, entraîneurs, légendes, célébrités,
 *    interviews, photos, signatures) ;
 *  - ch. 4 : déroulé complet, 30 à 45 minutes en temps réel ;
 *  - ch. 5 : les 17 catégories officielles, trophées gravés « Boubjack Awards » ;
 *  - ch. 6 : des légendes remettent les trophées, discours renouvelés chaque année ;
 *  - ch. 7 : suspense (nominés, statistiques, vidéos, réactions, enveloppe, silence) ;
 *  - ch. 8 : final collectif, photo officielle, feux d'artifice, confettis,
 *    et le nom « Boubjack Awards » discrètement affiché en bas à droite.
 */

import { clamp01, round } from '../core/math.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { awardsHostCities, getCity } from '../data/cities.js';
import { CLUBS, STADIUMS, getClub } from '../data/clubs.js';
import { LEGEND_NAMES } from '../data/names.js';
import { DialogueEngine } from '../ai/dialogue.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';
import { SEASON_SERVICE, type SeasonSystem } from '../career/season-system.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';

export const AWARDS_SERVICE = 'awards';

export interface AwardCategory {
  readonly id: string;
  readonly name: string;
  /** Nature du lauréat. */
  readonly subject: 'joueur' | 'joueuse' | 'entraîneur' | 'club' | 'académie' | 'stade' | 'supporters' | 'arbitre' | 'équipe' | 'exploit';
  readonly trophyDesign: string;
  /** Prestige de la catégorie 0..1. */
  readonly prestige: number;
}

/** Les 17 catégories officielles du Tome VII, ch. 5. */
export const AWARD_CATEGORIES: readonly AwardCategory[] = [
  { id: 'revelation', name: 'Révélation de l’année', subject: 'joueur', trophyDesign: 'sphère d’or ouverte, gravure « Boubjack Awards »', prestige: 0.65 },
  { id: 'plus-beau-but', name: 'Plus beau but', subject: 'exploit', trophyDesign: 'ballon suspendu en cristal, gravure « Boubjack Awards »', prestige: 0.7 },
  { id: 'plus-belle-parade', name: 'Plus belle parade', subject: 'joueur', trophyDesign: 'gant stylisé en bronze poli, gravure « Boubjack Awards »', prestige: 0.65 },
  { id: 'meilleur-entraineur', name: 'Meilleur entraîneur', subject: 'entraîneur', trophyDesign: 'tableau tactique en verre gravé « Boubjack Awards »', prestige: 0.85 },
  { id: 'meilleur-jeune', name: 'Meilleur jeune', subject: 'joueur', trophyDesign: 'flamme dorée ascendante, gravure « Boubjack Awards »', prestige: 0.75 },
  { id: 'meilleur-club', name: 'Meilleur club', subject: 'club', trophyDesign: 'écusson monumental gravé « Boubjack Awards »', prestige: 0.9 },
  { id: 'meilleure-academie', name: 'Meilleure académie', subject: 'académie', trophyDesign: 'arbre de bronze aux racines dorées, gravure « Boubjack Awards »', prestige: 0.7 },
  { id: 'meilleur-stade', name: 'Meilleur stade', subject: 'stade', trophyDesign: 'maquette d’arène en cristal, gravure « Boubjack Awards »', prestige: 0.65 },
  { id: 'meilleurs-supporters', name: 'Meilleurs supporters', subject: 'supporters', trophyDesign: 'vague de tribune sculptée, gravure « Boubjack Awards »', prestige: 0.7 },
  { id: 'meilleur-arbitre', name: 'Meilleur arbitre', subject: 'arbitre', trophyDesign: 'sifflet d’argent sur socle noir, gravure « Boubjack Awards »', prestige: 0.6 },
  { id: 'meilleur-xi', name: 'Meilleur XI de l’année', subject: 'équipe', trophyDesign: 'onze silhouettes dorées alignées, gravure « Boubjack Awards »', prestige: 0.85 },
  { id: 'plus-belle-remontee', name: 'Plus belle remontée', subject: 'exploit', trophyDesign: 'spirale ascendante en or blanc, gravure « Boubjack Awards »', prestige: 0.75 },
  { id: 'meilleur-capitaine', name: 'Meilleur capitaine', subject: 'joueur', trophyDesign: 'brassard de cristal gravé « Boubjack Awards »', prestige: 0.8 },
  { id: 'fair-play', name: 'Prix Fair-Play', subject: 'joueur', trophyDesign: 'deux mains jointes en bronze, gravure « Boubjack Awards »', prestige: 0.7 },
  { id: 'prix-carriere', name: 'Prix Carrière', subject: 'joueur', trophyDesign: 'colonne de saisons empilées, gravure « Boubjack Awards »', prestige: 0.9 },
  { id: 'legende-football', name: 'Légende du Football', subject: 'joueur', trophyDesign: 'statuette monumentale en or massif, gravure « Boubjack Awards »', prestige: 0.98 },
  { id: 'icone-annee', name: 'Icône de l’année', subject: 'joueur', trophyDesign: 'globe doré en lévitation, gravure « Boubjack Awards »', prestige: 1 },
];

export type CeremonyPhase =
  | 'annonce'
  | 'tapisRouge'
  | 'ouverture'
  | 'discours'
  | 'spectacle'
  | 'remises'
  | 'photoOfficielle'
  | 'cloture'
  | 'terminee';

export interface Nominee {
  readonly id: string;
  readonly name: string;
  /** Statistiques mises en avant pendant le suspense. */
  readonly statline: string;
  /** Score de mérite 0..1, sert au tirage pondéré. */
  readonly merit: number;
  /** Le joueur incarné par l'utilisateur. */
  readonly isUser: boolean;
}

export interface CategoryResult {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly nominees: readonly Nominee[];
  readonly winnerId: string;
  readonly winnerName: string;
  readonly presenterName: string;
  readonly presenterSpeech: string;
  readonly acceptanceSpeech: string;
  readonly trophyDesign: string;
}

export interface RedCarpetArrival {
  readonly name: string;
  readonly category: 'joueur' | 'joueuse' | 'entraîneur' | 'légende' | 'célébrité';
  readonly outfit: string;
  readonly interviewQuote: string;
  readonly signedAutographs: number;
  readonly photosTaken: number;
}

export interface Ceremony {
  readonly id: string;
  readonly season: number;
  readonly hostCityId: string;
  readonly hostCityName: string;
  readonly stageDesign: string;
  readonly decoration: string;
  readonly visualIdentity: string;
  phase: CeremonyPhase;
  /** Durée totale en minutes réelles (30 à 45 selon le Tome VII, ch. 4). */
  readonly durationMinutes: number;
  readonly redCarpet: RedCarpetArrival[];
  readonly results: CategoryResult[];
  /** Filigrane permanent en bas à droite (Tome VII, ch. 8). */
  readonly watermark: string;
  readonly playerInvited: boolean;
  /** Le joueur remet un trophée (légendes uniquement). */
  readonly playerPresents: boolean;
}

const STAGE_DESIGNS = [
  'scène circulaire suspendue au-dessus du public',
  'grand escalier lumineux à double volée',
  'anneau LED à 360° avec passerelle centrale',
  'scène en verre au-dessus d’un bassin réfléchissant',
  'amphithéâtre modulable à gradins mobiles',
  'dôme de projection immersive',
];

const DECORATIONS = [
  'colonnes de lumière ambrées et velours nuit',
  'fresques murales retraçant l’année footballistique',
  'jardin suspendu intérieur et éclairage doré',
  'installation de miroirs et de ballons figés dans le verre',
  'motifs textiles inspirés du pays hôte',
  'mur d’eau lumineux derrière la scène',
];

const VISUAL_IDENTITIES = [
  'or et noir profond',
  'bleu nuit et argent',
  'terre de sienne et cuivre',
  'blanc pur et laiton',
  'vert émeraude et or rose',
  'pourpre et bronze',
];

const OUTFITS = [
  'smoking noir cintré',
  'robe longue en soie',
  'costume trois-pièces bleu nuit',
  'tenue traditionnelle brodée',
  'ensemble blanc immaculé',
  'veste de velours bordeaux',
];

export class BoubjackAwardsSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'awards',
    name: 'Boubjack Awards',
    order: 100,
    tomes: ['VII', 'XVII', 'XIX', 'XXI'],
  };

  private context!: SimulationContext;
  private career: CareerSystem | null = null;
  private seasons!: SeasonSystem;
  private world!: WorldSystem;
  private readonly dialogue = new DialogueEngine(200);
  private readonly history: Ceremony[] = [];
  private current: Ceremony | null = null;
  /** Villes hôtes des éditions passées, pour ne jamais répéter deux ans de suite. */
  private lastHostCityId: string | null = null;

  init(context: SimulationContext): void {
    this.context = context;
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    this.seasons = context.require<SeasonSystem>(SEASON_SERVICE);
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    context.provide(AWARDS_SERVICE, this);
  }

  get ceremonies(): readonly Ceremony[] {
    return this.history;
  }

  get activeCeremony(): Ceremony | null {
    return this.current;
  }

  /** Palmarès complet d'une personne ou d'un club, toutes éditions confondues. */
  honoursOf(subjectId: string): CategoryResult[] {
    const results: CategoryResult[] = [];
    for (const ceremony of this.history) {
      for (const result of ceremony.results) {
        if (result.winnerId === subjectId) results.push(result);
      }
    }
    return results;
  }

  onMonth(context: SimulationContext, date: { month: number; year: number }): void {
    // La cérémonie se tient chaque année en décembre.
    if (date.month !== 12) return;
    if (this.history.some((c) => c.season === this.seasons.season)) return;
    this.prepareCeremony(context);
  }

  /** Prépare l'édition : ville hôte, scénographie, nominations, tapis rouge. */
  prepareCeremony(context: SimulationContext): Ceremony {
    const rng = context.stream('awards.ceremony');
    const hosts = awardsHostCities().filter((c) => c.id !== this.lastHostCityId);
    const host = rng.pick(hosts.length > 0 ? hosts : awardsHostCities());
    this.lastHostCityId = host.id;

    const playerIsLegend = this.career?.isLegend ?? false;
    const playerReputation = this.career?.hasCareer ? this.career.player.reputation : 0;
    const playerRetired = this.career?.hasCareer ? this.career.player.retired : false;

    const ceremony: Ceremony = {
      id: `boubjack:${this.seasons.season}`,
      season: this.seasons.season,
      hostCityId: host.id,
      hostCityName: host.name,
      stageDesign: rng.pick(STAGE_DESIGNS),
      decoration: rng.pick(DECORATIONS),
      visualIdentity: rng.pick(VISUAL_IDENTITIES),
      phase: 'annonce',
      durationMinutes: rng.int(30, 45),
      redCarpet: [],
      results: [],
      watermark: 'Boubjack Awards — bas de l’écran, à droite',
      playerInvited: playerReputation > 55 || playerIsLegend,
      playerPresents: playerIsLegend && playerRetired,
    };
    this.current = ceremony;

    // La ville hôte se transforme (Tome XIX, ch. 3).
    this.world.decorateForEvent(
      host.id,
      [
        'tapis rouge et arches lumineuses',
        'écrans géants sur les places',
        'projections sur les façades',
        'sécurité renforcée autour du site',
      ],
      0.85,
    );

    context.emit({
      type: 'awards.stage',
      ceremonyId: ceremony.id,
      stage: 'annonce',
      detail: `Édition ${ceremony.season} annoncée à ${host.name} — identité visuelle ${ceremony.visualIdentity}`,
    });
    context.logger.info('Boubjack Awards annoncés', {
      saison: ceremony.season,
      ville: host.name,
      scene: ceremony.stageDesign,
    });
    return ceremony;
  }

  /** Tome VII, ch. 3 — le tapis rouge, avant la cérémonie. */
  runRedCarpet(): RedCarpetArrival[] {
    const ceremony = this.requireCeremony();
    const rng = this.context.stream('awards.redCarpet');
    ceremony.redCarpet.length = 0;

    const topClubs = [...CLUBS].sort((a, b) => b.prestige - a.prestige).slice(0, 10);
    const guests: Array<{ name: string; category: RedCarpetArrival['category'] }> = [];

    for (const club of topClubs.slice(0, 6)) {
      guests.push({ name: `Capitaine de ${club.shortName}`, category: 'joueur' });
    }
    for (const club of topClubs.slice(0, 4)) {
      guests.push({ name: `Capitaine féminine de ${club.shortName}`, category: 'joueuse' });
    }
    for (const club of topClubs.slice(0, 4)) {
      guests.push({ name: `Entraîneur de ${club.shortName}`, category: 'entraîneur' });
    }
    for (const legend of rng.pickMany(LEGEND_NAMES, 5)) {
      guests.push({ name: legend, category: 'légende' });
    }
    for (let i = 0; i < 4; i++) {
      guests.push({ name: `Invité d’honneur ${i + 1}`, category: 'célébrité' });
    }
    if (ceremony.playerInvited && this.career?.hasCareer) {
      guests.unshift({ name: this.career.player.identity.name, category: ceremony.playerPresents ? 'légende' : 'joueur' });
    }

    for (const guest of guests) {
      ceremony.redCarpet.push({
        name: guest.name,
        category: guest.category,
        outfit: rng.pick(OUTFITS),
        interviewQuote: this.dialogue.generate(
          'presse.reponse',
          rng.chance(0.3) ? 'enthousiaste' : 'neutre',
          { player: guest.name, city: ceremony.hostCityName },
          rng,
        ).text,
        signedAutographs: rng.int(4, 60),
        photosTaken: rng.int(20, 300),
      });
    }

    ceremony.phase = 'tapisRouge';
    this.context.emit({
      type: 'awards.stage',
      ceremonyId: ceremony.id,
      stage: 'tapisRouge',
      detail: `${ceremony.redCarpet.length} arrivées sur le tapis rouge`,
    });
    return ceremony.redCarpet;
  }

  /**
   * Déroule la cérémonie complète, dans l'ordre du Tome VII, ch. 4 :
   * présentation, ouverture, discours, spectacles, invités, annonces,
   * révélations, remise des trophées, photos officielles, clôture.
   */
  runCeremony(): Ceremony {
    const ceremony = this.requireCeremony();
    const rng = this.context.stream('awards.run');

    if (ceremony.phase === 'annonce') this.runRedCarpet();

    ceremony.phase = 'ouverture';
    this.emitStage(ceremony, 'ouverture', `Ouverture sur ${ceremony.stageDesign}`);

    ceremony.phase = 'discours';
    this.emitStage(ceremony, 'discours', 'Discours d’ouverture du président de la cérémonie');

    ceremony.phase = 'spectacle';
    this.emitStage(
      ceremony,
      'spectacle',
      `Spectacle d’ouverture — décor : ${ceremony.decoration}`,
    );

    ceremony.phase = 'remises';
    for (const category of AWARD_CATEGORIES) {
      const result = this.awardCategory(ceremony, category, rng);
      ceremony.results.push(result);
    }

    ceremony.phase = 'photoOfficielle';
    this.emitStage(
      ceremony,
      'photoOfficielle',
      `Tous les vainqueurs réunis sur scène — ${ceremony.results.length} trophées remis`,
    );

    ceremony.phase = 'cloture';
    this.emitStage(ceremony, 'cloture', 'Feux d’artifice, confettis et musique de clôture');

    ceremony.phase = 'terminee';
    this.history.push(ceremony);
    this.current = null;
    this.world.clearEventDecorations(ceremony.hostCityId);

    this.context.emit({
      type: 'cinematic.played',
      cinematicId: 'boubjack.finale',
      category: 'cérémonie',
      durationSeconds: ceremony.durationMinutes * 60,
      skipped: false,
    });
    return ceremony;
  }

  /** Tome VII, ch. 7 — suspense complet avant chaque annonce. */
  private awardCategory(ceremony: Ceremony, category: AwardCategory, rng: Rng): CategoryResult {
    const nominees = this.buildNominees(category, rng);
    const presenter = rng.pick(LEGEND_NAMES);

    // Séquence de suspense : nominés, statistiques, vidéos, réactions du public,
    // caméra sur les favoris, ouverture de l'enveloppe, silence, annonce.
    for (const step of [
      `présentation des ${nominees.length} nominés`,
      'diffusion des statistiques',
      'diffusion des vidéos',
      'réactions du public',
      'caméra sur les favoris',
      'ouverture de l’enveloppe',
      'silence dans la salle',
    ]) {
      this.emitStage(ceremony, `suspense:${category.id}`, step);
    }

    const winner = rng.weighted(
      nominees.map((nominee) => ({ item: nominee, weight: Math.max(0.05, nominee.merit ** 2.2) })),
    );

    const presenterSpeech = this.dialogue.generate(
      'legende.discours',
      'solennel',
      { legend: presenter, player: winner.name, award: category.name },
      rng,
    ).text;
    const acceptanceSpeech = this.dialogue.generate(
      'presse.reponse',
      'enthousiaste',
      { player: winner.name, award: category.name, city: ceremony.hostCityName },
      rng,
    ).text;

    this.context.emit({
      type: 'awards.won',
      ceremonyId: ceremony.id,
      categoryId: category.id,
      categoryName: category.name,
      winnerId: winner.id,
      winnerName: winner.name,
      season: ceremony.season,
      hostCityId: ceremony.hostCityId,
    });

    if (winner.isUser && this.career?.hasCareer) {
      this.career.awardIndividual(`${ceremony.id}:${category.id}`, category.name);
    }

    return {
      categoryId: category.id,
      categoryName: category.name,
      nominees,
      winnerId: winner.id,
      winnerName: winner.name,
      presenterName: presenter,
      presenterSpeech,
      acceptanceSpeech,
      trophyDesign: category.trophyDesign,
    };
  }

  /** Construit une liste de nominés cohérente avec la saison écoulée. */
  private buildNominees(category: AwardCategory, rng: Rng): Nominee[] {
    const nominees: Nominee[] = [];
    const player = this.career?.hasCareer ? this.career.player : null;
    const playerStats = player?.seasons[player.seasons.length - 1];

    const pushClubNominees = (count: number, statline: (club: (typeof CLUBS)[number]) => string): void => {
      const ranked = [...CLUBS].sort((a, b) => this.seasons.strengthOf(b.id) - this.seasons.strengthOf(a.id));
      for (const club of ranked.slice(0, count)) {
        nominees.push({
          id: club.id,
          name: club.name,
          statline: statline(club),
          merit: clamp01(this.seasons.strengthOf(club.id) / 100),
          isUser: false,
        });
      }
    };

    switch (category.subject) {
      case 'club':
        pushClubNominees(5, (club) => `${club.nickname} — force estimée ${round(this.seasons.strengthOf(club.id), 1)}`);
        break;
      case 'académie':
        for (const club of [...CLUBS].sort((a, b) => b.academy - a.academy).slice(0, 5)) {
          nominees.push({
            id: `${club.id}:academy`,
            name: `Académie de ${club.shortName}`,
            statline: `note d’académie ${club.academy}/100`,
            merit: club.academy / 100,
            isUser: false,
          });
        }
        break;
      case 'stade':
        for (const stadium of [...STADIUMS].sort((a, b) => b.atmosphere - a.atmosphere).slice(0, 5)) {
          nominees.push({
            id: stadium.id,
            name: stadium.name,
            statline: `${stadium.capacity.toLocaleString('fr-FR')} places — ambiance ${Math.round(stadium.atmosphere * 100)}/100`,
            merit: stadium.atmosphere,
            isUser: false,
          });
        }
        break;
      case 'supporters':
        for (const stadium of rng.pickMany([...STADIUMS], 5)) {
          nominees.push({
            id: `${stadium.id}:fans`,
            name: `Supporters de ${stadium.name}`,
            statline: stadium.traditions[0] ?? 'ferveur constante',
            merit: stadium.atmosphere,
            isUser: false,
          });
        }
        break;
      case 'arbitre':
        for (let i = 0; i < 5; i++) {
          nominees.push({
            id: `referee:nominee:${i}`,
            name: `Arbitre international ${i + 1}`,
            statline: `${rng.int(28, 52)} matchs dirigés`,
            merit: rng.range(0.4, 0.95),
            isUser: false,
          });
        }
        break;
      case 'entraîneur':
        for (const club of [...CLUBS].sort((a, b) => this.seasons.strengthOf(b.id) - this.seasons.strengthOf(a.id)).slice(0, 5)) {
          nominees.push({
            id: `${club.id}:manager`,
            name: `Entraîneur de ${club.shortName}`,
            statline: `${round(this.seasons.strengthOf(club.id), 1)} de force d’équipe`,
            merit: clamp01(this.seasons.strengthOf(club.id) / 100),
            isUser: false,
          });
        }
        break;
      case 'équipe':
        nominees.push({
          id: 'xi-of-the-year',
          name: 'XI de l’année',
          statline: 'onze titulaires élus par les votants',
          merit: 1,
          isUser: player !== null && (player.reputation > 85),
        });
        for (let i = 0; i < 3; i++) {
          nominees.push({
            id: `xi-alt:${i}`,
            name: `Onze alternatif ${i + 1}`,
            statline: 'sélection alternative des votants',
            merit: rng.range(0.3, 0.7),
            isUser: false,
          });
        }
        break;
      case 'exploit':
        for (let i = 0; i < 5; i++) {
          nominees.push({
            id: `exploit:${category.id}:${i}`,
            name:
              category.id === 'plus-beau-but'
                ? `But de la ${rng.int(3, 89)}e minute — ${rng.pick(CLUBS).shortName}`
                : `Remontée de ${rng.int(2, 4)} buts — ${rng.pick(CLUBS).shortName}`,
            statline: `${rng.int(120, 980)} milliers de votes`,
            merit: rng.range(0.3, 1),
            isUser: false,
          });
        }
        break;
      default: {
        // Catégories individuelles : le joueur peut être nominé selon son niveau.
        const merits: Array<{ id: string; name: string; statline: string; merit: number; isUser: boolean }> = [];
        if (player && !player.retired) {
          const eligible =
            category.id === 'meilleur-jeune'
              ? player.age <= 21
              : category.id === 'revelation'
                ? player.age <= 23
                : category.id === 'prix-carriere'
                  ? player.age >= 33
                  : category.id === 'legende-football'
                    ? (this.career?.isLegend ?? false)
                    : true;
          if (eligible && player.reputation > 55) {
            merits.push({
              id: player.identity.id,
              name: player.identity.name,
              statline: playerStats
                ? `${playerStats.appearances} matchs, ${playerStats.goals} buts, ${playerStats.assists} passes, note ${playerStats.averageRating}`
                : 'saison en cours',
              merit: clamp01(player.reputation / 100),
              isUser: true,
            });
          }
        }
        const topClubs = [...CLUBS].sort((a, b) => b.prestige - a.prestige);
        for (let i = merits.length; i < 5; i++) {
          const club = topClubs[i % topClubs.length] as (typeof CLUBS)[number];
          merits.push({
            id: `nominee:${category.id}:${i}`,
            name: `Star de ${club.shortName}`,
            statline: `${rng.int(18, 46)} buts, ${rng.int(4, 20)} passes décisives`,
            merit: rng.range(0.45, 0.95),
            isUser: false,
          });
        }
        nominees.push(...merits);
        break;
      }
    }

    return nominees;
  }

  private emitStage(ceremony: Ceremony, stage: string, detail: string): void {
    this.context.emit({ type: 'awards.stage', ceremonyId: ceremony.id, stage, detail });
  }

  private requireCeremony(): Ceremony {
    if (!this.current) return this.prepareCeremony(this.context);
    return this.current;
  }

  /** Invitation adressée à une légende retraitée (Tome XXI, ch. 5). */
  inviteLegend(role: 'remise de trophée' | 'coup d’envoi' | 'tirage au sort' | 'invité d’honneur'): boolean {
    if (!this.career?.isLegend) return false;
    this.context.emit({
      type: 'life.milestone',
      milestone: 'invitation Boubjack Awards',
      detail: role,
    });
    return true;
  }

  /** Ville hôte de la prochaine édition, connue à l'avance par les médias. */
  nextHostCityName(): string | null {
    if (this.current) return this.current.hostCityName;
    if (!this.lastHostCityId) return null;
    try {
      return getCity(this.lastHostCityId).name;
    } catch {
      return null;
    }
  }

  serialize(): unknown {
    return {
      history: this.history,
      current: this.current,
      lastHostCityId: this.lastHostCityId,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    this.history.length = 0;
    this.history.push(...(((state.history as Ceremony[]) ?? [])));
    this.current = (state.current as Ceremony | null) ?? null;
    this.lastHostCityId = (state.lastHostCityId as string | null) ?? null;
  }
}

/** Club le plus titré aux Boubjack Awards, pour les classements historiques. */
export function mostAwardedClub(ceremonies: readonly Ceremony[]): { clubId: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const ceremony of ceremonies) {
    for (const result of ceremony.results) {
      try {
        getClub(result.winnerId);
        counts.set(result.winnerId, (counts.get(result.winnerId) ?? 0) + 1);
      } catch {
        // Le lauréat n'est pas un club : catégorie individuelle.
      }
    }
  }
  let best: { clubId: string; count: number } | null = null;
  for (const [clubId, count] of counts) {
    if (!best || count > best.count) best = { clubId, count };
  }
  return best;
}
