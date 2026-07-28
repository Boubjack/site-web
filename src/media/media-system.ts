/**
 * Infinity Football — Médias / Presse & diffusion mondiale
 *
 * Tome XXVII intégralement : chaînes TV fictives spécialisées, journaux publiés
 * chaque matin, conférences de presse interactives, documentaires, alertes en
 * temps réel et podcasts.
 * Tome VIII, ch. 4 : les journalistes adaptent leurs questions aux résultats,
 * polémiques, blessures, transferts et records — aucune interview identique.
 *
 * Le système écoute le bus d'événements du monde : tout fait notable devient
 * matière journalistique, avec un angle qui dépend de la ligne éditoriale de
 * chaque média et de sa relation avec le joueur.
 */

import { clamp, clamp01 } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Significance } from '../core/events.js';
import { MEDIA_PERSONA_NAMES } from '../data/names.js';
import { getClub } from '../data/clubs.js';
import { MemoryBank, MemoryFactory } from '../ai/memory.js';
import { DialogueEngine, type DialogueTone } from '../ai/dialogue.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';

export const MEDIA_SERVICE = 'media';

export type OutletKind = 'quotidien' | 'chaîneTV' | 'siteWeb' | 'podcast' | 'magazine';
export type EditorialLine = 'factuelle' | 'sensationnaliste' | 'analytique' | 'partisane' | 'bienveillante';

export interface Outlet {
  readonly id: string;
  readonly name: string;
  readonly kind: OutletKind;
  readonly line: EditorialLine;
  /** Audience 0..1. */
  readonly reach: number;
  /** Club soutenu, pour la presse partisane. */
  readonly affiliatedClubId: string | null;
  /** Relation avec le joueur -1..1. */
  relationship: number;
}

export interface Journalist {
  readonly id: string;
  readonly name: string;
  readonly outletId: string;
  /** Agressivité des questions 0..1. */
  readonly bite: number;
  /** Rigueur 0..1. */
  readonly rigour: number;
  readonly memory: MemoryBank;
  /** Relation avec le joueur -1..1. */
  relationship: number;
}

export interface Article {
  readonly id: string;
  readonly outletId: string;
  readonly outletName: string;
  readonly headline: string;
  readonly body: string;
  readonly significance: Significance;
  readonly publishedAt: number;
  readonly subjectIds: readonly string[];
  /** Tonalité -1 (à charge) .. +1 (élogieuse). */
  readonly tone: number;
  /** Fait brut traité, avant l'angle du média : sert à varier la une. */
  readonly storyKey: string;
}

export interface TvShow {
  readonly id: string;
  readonly channelId: string;
  readonly title: string;
  readonly format: 'actualités' | 'débat' | 'analyse tactique' | 'mercato' | 'documentaire' | 'quotidienne';
  readonly startHour: number;
  readonly durationMinutes: number;
}

export interface Podcast {
  readonly id: string;
  readonly title: string;
  readonly theme: 'analyse tactique' | 'interview' | 'histoire du football' | 'débat';
  readonly episodes: PodcastEpisode[];
}

export interface PodcastEpisode {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly durationMinutes: number;
  readonly publishedAt: number;
}

export interface PressQuestion {
  readonly id: string;
  readonly journalistId: string;
  readonly journalistName: string;
  readonly text: string;
  /** Sujet sous-jacent, utilisé pour évaluer les réponses. */
  readonly topic: 'performance' | 'transfert' | 'blessure' | 'polémique' | 'record' | 'coéquipier' | 'adversaire' | 'club';
  /** Piège potentiel : une mauvaise réponse coûte cher. */
  readonly hostility: number;
}

export type AnswerTone =
  | 'diplomate'
  | 'franc'
  | 'esquive'
  | 'humour'
  | 'défense d’un coéquipier'
  | 'attaque de l’adversaire'
  | 'silence';

export interface PressConference {
  readonly id: string;
  readonly context: string;
  readonly questions: PressQuestion[];
  readonly answers: Array<{ questionId: string; tone: AnswerTone; reputationDelta: number; text: string }>;
  finished: boolean;
}

const OUTLETS: readonly Omit<Outlet, 'relationship'>[] = [
  { id: 'out-quotidien-sport', name: 'Le Quotidien du Sport', kind: 'quotidien', line: 'factuelle', reach: 0.9, affiliatedClubId: null },
  { id: 'out-tribune', name: 'La Tribune du Football', kind: 'quotidien', line: 'analytique', reach: 0.7, affiliatedClubId: null },
  { id: 'out-flash', name: 'Flash Mercato', kind: 'siteWeb', line: 'sensationnaliste', reach: 0.85, affiliatedClubId: null },
  { id: 'out-canal-foot', name: 'Canal Foot 24', kind: 'chaîneTV', line: 'factuelle', reach: 0.95, affiliatedClubId: null },
  { id: 'out-tactique-tv', name: 'Tactique TV', kind: 'chaîneTV', line: 'analytique', reach: 0.55, affiliatedClubId: null },
  { id: 'out-debat-plus', name: 'Débat +', kind: 'chaîneTV', line: 'sensationnaliste', reach: 0.75, affiliatedClubId: null },
  { id: 'out-mag-onze', name: 'Onze Magazine', kind: 'magazine', line: 'bienveillante', reach: 0.5, affiliatedClubId: null },
  { id: 'out-podcast-tempo', name: 'Tempo — le podcast', kind: 'podcast', line: 'analytique', reach: 0.4, affiliatedClubId: null },
];

const TV_SHOWS: readonly TvShow[] = [
  { id: 'show-matin', channelId: 'out-canal-foot', title: 'Le Réveil Football', format: 'quotidienne', startHour: 7, durationMinutes: 120 },
  { id: 'show-midi', channelId: 'out-canal-foot', title: 'Midi Transferts', format: 'mercato', startHour: 12, durationMinutes: 90 },
  { id: 'show-analyse', channelId: 'out-tactique-tv', title: 'Le Tableau Noir', format: 'analyse tactique', startHour: 18, durationMinutes: 60 },
  { id: 'show-debat', channelId: 'out-debat-plus', title: 'Le Grand Débat', format: 'débat', startHour: 21, durationMinutes: 110 },
  { id: 'show-doc', channelId: 'out-canal-foot', title: 'Légendes — la collection', format: 'documentaire', startHour: 23, durationMinutes: 75 },
  { id: 'show-news', channelId: 'out-canal-foot', title: 'Info Foot en continu', format: 'actualités', startHour: 0, durationMinutes: 1440 },
];

export class MediaSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'media',
    name: 'Médias & presse',
    order: 90,
    tomes: ['VIII', 'XXVII', 'XXVIII'],
  };

  private context!: SimulationContext;
  private career: CareerSystem | null = null;
  private readonly outlets = new Map<string, Outlet>();
  private readonly journalists = new Map<string, Journalist>();
  private readonly articles: Article[] = [];
  private readonly alerts: Array<{ id: string; text: string; at: number; significance: Significance }> = [];
  private readonly podcasts = new Map<string, Podcast>();
  private readonly conferences = new Map<string, PressConference>();
  private readonly dialogue = new DialogueEngine(600);
  /** File des faits du jour, transformés en articles le lendemain matin. */
  private pendingStories: Array<{ headline: string; significance: Significance; subjects: string[]; tone: number }> = [];
  private articleCounter = 0;
  private conferenceCounter = 0;

  init(context: SimulationContext): void {
    this.context = context;
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(MEDIA_SERVICE, this);

    const rng = context.stream('media.setup');
    for (const outlet of OUTLETS) {
      this.outlets.set(outlet.id, { ...outlet, relationship: rng.range(-0.1, 0.25) });
    }
    MEDIA_PERSONA_NAMES.forEach((name, index) => {
      const outlet = [...this.outlets.values()][index % this.outlets.size] as Outlet;
      const journalist: Journalist = {
        id: `journalist:${index}`,
        name,
        outletId: outlet.id,
        bite: clamp01(rng.gaussian(outlet.line === 'sensationnaliste' ? 0.75 : 0.45, 0.18)),
        rigour: clamp01(rng.gaussian(outlet.line === 'analytique' ? 0.85 : 0.6, 0.15)),
        memory: new MemoryBank({ capacity: 120, halfLifeDays: 500 }),
        relationship: rng.range(-0.15, 0.2),
      };
      this.journalists.set(journalist.id, journalist);
    });

    this.podcasts.set('pod-tempo', {
      id: 'pod-tempo',
      title: 'Tempo',
      theme: 'analyse tactique',
      episodes: [],
    });
    this.podcasts.set('pod-vestiaire', {
      id: 'pod-vestiaire',
      title: 'Vestiaire — les confidences',
      theme: 'interview',
      episodes: [],
    });
    this.podcasts.set('pod-archives', {
      id: 'pod-archives',
      title: 'Archives du Football',
      theme: 'histoire du football',
      episodes: [],
    });
    this.podcasts.set('pod-clash', {
      id: 'pod-clash',
      title: 'Clash du Dimanche',
      theme: 'débat',
      episodes: [],
    });

    this.subscribeToWorld(context);
  }

  /** Le monde alimente la rédaction : chaque événement notable devient un sujet. */
  private subscribeToWorld(context: SimulationContext): void {
    context.events.on('match.ended', (event) => {
      const tone = event.playerRating !== null ? clamp((event.playerRating - 6.4) / 2.5, -1, 1) : 0;
      this.queueStory(
        `${this.clubName(event.homeClubId)} ${event.homeGoals}-${event.awayGoals} ${this.clubName(event.awayClubId)}`,
        Math.abs(event.homeGoals - event.awayGoals) >= 3 ? 'major' : 'notable',
        [event.homeClubId, event.awayClubId],
        tone,
      );
    });

    context.events.on('career.transfer', (event) => {
      if (event.stage !== 'signed' && event.stage !== 'presented') return;
      this.queueStory(
        `Officiel : ${this.playerName()} rejoint ${this.clubName(event.toClubId)} pour ${(event.fee / 1_000_000).toFixed(1)} M€`,
        'major',
        [event.playerId, event.toClubId],
        0.5,
      );
      this.pushAlert(`Transfert officiel — ${this.playerName()} à ${this.clubName(event.toClubId)}`, 'major');
    });

    context.events.on('career.injury', (event) => {
      this.queueStory(
        `${this.playerName()} absent ${event.daysOut} jours`,
        event.severity === 'serious' ? 'major' : 'notable',
        [event.playerId],
        -0.6,
      );
      if (event.severity === 'serious') {
        this.pushAlert(`Blessure grave — ${this.playerName()} out ${event.daysOut} jours`, 'major');
      }
    });

    context.events.on('career.trophyWon', (event) => {
      const winner = this.playerName();
      this.queueStory(`${event.trophyName} : ${winner} soulève le trophée`, 'historic', [event.playerId], 1);
      this.pushAlert(`Titre — ${event.trophyName} pour ${winner}`, 'historic');
    });

    // La presse finit toujours par découvrir la rue — souvent trop tard, et en
    // reprenant une vidéo que la ville connaît depuis un mois (Tome XXVII).
    context.events.on('street.viral', (event) => {
      if (event.views < 60_000) return;
      this.queueStory(
        `Le geste de ${this.playerName()} sur un terrain de quartier fait le tour du pays`,
        event.views > 400_000 ? 'major' : 'notable',
        ['player:1'],
        0.7,
      );
      this.pushAlert(`Vidéo virale — ${event.moveName} à ${event.pitchName}`, 'notable');
    });

    context.events.on('street.tournament', (event) => {
      if (event.stage !== 'won') return;
      this.queueStory(
        `${event.tournamentName} : ${this.playerName()} s'impose loin des stades`,
        'notable',
        ['player:1'],
        0.8,
      );
      this.pushAlert(`${event.tournamentName} remporté par ${this.playerName()}`, 'major');
    });

    context.events.on('competition.decided', (event) => {
      this.queueStory(
        `${event.competitionName} : ${event.championName} champion`,
        'notable',
        [event.championClubId],
        0.5,
      );
      this.pushAlert(`${event.trophyName} — ${event.championName} sacré`, 'major');
    });

    context.events.on('awards.won', (event) => {
      this.queueStory(
        `${event.categoryName} : ${event.winnerName} sacré à ${event.hostCityId}`,
        'historic',
        [event.winnerId],
        1,
      );
      this.pushAlert(`Boubjack Awards — ${event.categoryName} pour ${event.winnerName}`, 'historic');
    });

    context.events.on('legacy.recordBroken', (event) => {
      this.queueStory(`Record battu : ${event.recordName}`, 'historic', [event.holderId], 1);
      this.pushAlert(`Record battu — ${event.recordName}`, 'historic');
    });

    context.events.on('club.board', (event) => {
      if (event.approved) return;
      this.queueStory(
        `Tensions au conseil d'administration de ${this.clubName(event.clubId)}`,
        'notable',
        [event.clubId],
        -0.4,
      );
    });
  }

  private queueStory(headline: string, significance: Significance, subjects: string[], tone: number): void {
    this.pendingStories.push({ headline, significance, subjects, tone });
  }

  private pushAlert(text: string, significance: Significance): void {
    this.alerts.push({
      id: `alert:${this.alerts.length}`,
      text,
      at: this.context.clock.absoluteMinutes,
      significance,
    });
    if (this.alerts.length > 200) this.alerts.splice(0, this.alerts.length - 200);
  }

  // ── Publication quotidienne ──────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    const rng = context.stream('media.publication');
    const stories = this.pendingStories;
    this.pendingStories = [];

    // Tome XXVII, ch. 3 : « Chaque matin, de nouveaux articles sont publiés. »
    // Hors actualité chaude, la rédaction produit ses marronniers : mercato,
    // analyses, portraits, avant-matchs. Le journal ne sort jamais vide.
    if (stories.length < 2) {
      for (const filler of this.buildEditorialFillers(rng)) stories.push(filler);
    }

    // Chaque matin, les journaux paraissent (Tome XXVII, ch. 3).
    for (const story of stories) {
      const outletCount = story.significance === 'historic' ? 4 : story.significance === 'major' ? 3 : 1;
      const outlets = rng.pickMany([...this.outlets.values()], outletCount);
      for (const outlet of outlets) {
        const article = this.writeArticle(outlet, story, rng);
        this.articles.push(article);
        context.emit({
          type: 'media.newsPublished',
          articleId: article.id,
          headline: article.headline,
          outletId: outlet.id,
          significance: article.significance,
          subjectIds: article.subjectIds,
        });
      }
    }
    if (this.articles.length > 800) this.articles.splice(0, this.articles.length - 800);

    // Programmation TV du jour.
    for (const show of TV_SHOWS) {
      context.emit({
        type: 'media.broadcast',
        channelId: show.channelId,
        showId: show.id,
        title: show.title,
      });
    }

    // Un épisode de podcast par jour, thème tournant.
    const podcast = rng.pick([...this.podcasts.values()]);
    const episode: PodcastEpisode = {
      id: `${podcast.id}:ep:${podcast.episodes.length + 1}`,
      title: `${podcast.title} #${podcast.episodes.length + 1}`,
      summary: stories[0]?.headline ?? 'Retour sur la semaine du football mondial',
      durationMinutes: rng.int(28, 62),
      publishedAt: context.clock.absoluteMinutes,
    };
    podcast.episodes.push(episode);
    if (podcast.episodes.length > 60) podcast.episodes.splice(0, podcast.episodes.length - 60);
  }

  /**
   * Sujets de fond publiés lorsqu'aucun fait marquant ne domine l'actualité.
   * Ils s'appuient sur l'état réel du monde (club du joueur, forme, saison)
   * afin de rester crédibles plutôt que décoratifs.
   */
  private buildEditorialFillers(
    rng: ReturnType<SimulationContext['stream']>,
  ): Array<{ headline: string; significance: Significance; subjects: string[]; tone: number }> {
    const player = this.career?.hasCareer ? this.career.player : null;
    const clubId = player?.clubId ?? null;
    const clubName = clubId ? this.clubName(clubId) : 'les grands clubs';
    const angles: Array<{ headline: string; tone: number }> = [
      { headline: `Mercato : les pistes chaudes de ${clubName}`, tone: 0.1 },
      { headline: `Analyse tactique : ce qui a changé chez ${clubName}`, tone: 0 },
      { headline: 'Le point médical des effectifs européens', tone: -0.1 },
      { headline: 'Les jeunes à suivre cette saison', tone: 0.3 },
      { headline: 'Billetterie et affluences : le baromètre du week-end', tone: 0 },
      { headline: 'Débat : quel onze type pour la saison ?', tone: 0.1 },
      { headline: 'Les coulisses des centres de formation', tone: 0.2 },
    ];
    if (player) {
      angles.push({
        headline:
          player.form > 0.7
            ? `${player.identity.name}, la forme des grands jours`
            : `${player.identity.name} cherche encore son rythme`,
        tone: player.form > 0.7 ? 0.6 : -0.3,
      });
    }

    const picked = rng.pickMany(angles, 2);
    return picked.map((angle) => ({
      headline: angle.headline,
      significance: 'routine' as Significance,
      subjects: clubId ? [clubId] : [],
      tone: angle.tone,
    }));
  }

  private writeArticle(
    outlet: Outlet,
    story: { headline: string; significance: Significance; subjects: string[]; tone: number },
    rng: ReturnType<SimulationContext['stream']>,
  ): Article {
    // La ligne éditoriale déforme le ton du fait brut.
    const bias =
      outlet.line === 'sensationnaliste' ? -0.25 :
      outlet.line === 'bienveillante' ? 0.3 :
      outlet.line === 'partisane' ? (outlet.affiliatedClubId && story.subjects.includes(outlet.affiliatedClubId) ? 0.5 : -0.4) :
      0;
    const tone = clamp(story.tone + bias + outlet.relationship * 0.3, -1, 1);
    const dialogueTone: DialogueTone =
      tone > 0.4 ? 'admiratif' : tone < -0.4 ? 'critique' : outlet.line === 'analytique' ? 'neutre' : 'ironique';

    const headline =
      outlet.line === 'sensationnaliste'
        ? `${story.headline} — le vestiaire s'interroge`
        : outlet.line === 'analytique'
          ? `${story.headline} : ce que disent les chiffres`
          : story.headline;

    const body = this.dialogue.generate(
      'commentaire.contexte',
      dialogueTone,
      {
        player: this.playerName(),
        club: this.playerClubName(),
        statistic: this.playerStatline(),
      },
      rng,
    ).text;

    return {
      id: `article:${this.articleCounter++}`,
      outletId: outlet.id,
      outletName: outlet.name,
      headline,
      body,
      significance: story.significance,
      publishedAt: this.context.clock.absoluteMinutes,
      subjectIds: story.subjects,
      tone,
      storyKey: story.headline,
    };
  }

  // ── Conférences de presse (Tome XXVII, ch. 4) ────────────────────────────

  /**
   * Génère une conférence dont les questions dépendent réellement du contexte :
   * résultats récents, blessures, transferts en cours, records, polémiques.
   */
  openPressConference(contextLabel: string, situation: {
    recentRating?: number;
    lostHeavily?: boolean;
    injuryDays?: number;
    transferRumours?: boolean;
    recordBroken?: string;
    teammateCriticised?: string;
    upcomingRival?: string;
  }): PressConference {
    const rng = this.context.stream('media.press');
    const questions: PressQuestion[] = [];
    const pool = [...this.journalists.values()];

    const addQuestion = (topic: PressQuestion['topic'], hostility: number): void => {
      const journalist = rng.pick(pool);
      const tone: DialogueTone = hostility > 0.6 ? 'critique' : hostility > 0.3 ? 'ironique' : 'neutre';
      questions.push({
        id: `q:${questions.length}`,
        journalistId: journalist.id,
        journalistName: journalist.name,
        text: this.dialogue.generate(
          'presse.question',
          tone,
          {
            player: this.playerName(),
            club: this.playerClubName(),
            rival: situation.upcomingRival,
            record: situation.recordBroken,
            teammate: situation.teammateCriticised,
            injury: situation.injuryDays ? `absence de ${situation.injuryDays} jours` : undefined,
            score: situation.lostHeavily ? 'lourde défaite' : undefined,
          },
          rng,
        ).text,
        topic,
        hostility: clamp01(hostility * (0.6 + journalist.bite * 0.8)),
      });
    };

    addQuestion('performance', situation.lostHeavily ? 0.75 : situation.recentRating && situation.recentRating > 7.5 ? 0.15 : 0.4);
    if (situation.transferRumours) addQuestion('transfert', 0.6);
    if (situation.injuryDays) addQuestion('blessure', 0.35);
    if (situation.recordBroken) addQuestion('record', 0.1);
    if (situation.teammateCriticised) addQuestion('coéquipier', 0.55);
    if (situation.upcomingRival) addQuestion('adversaire', 0.5);
    if (situation.lostHeavily) addQuestion('polémique', 0.85);
    addQuestion('club', 0.3);

    const conference: PressConference = {
      id: `press:${this.conferenceCounter++}`,
      context: contextLabel,
      questions,
      answers: [],
      finished: false,
    };
    this.conferences.set(conference.id, conference);
    return conference;
  }

  /** Le joueur répond : chaque réponse influence réputation et relations. */
  answer(conferenceId: string, questionId: string, tone: AnswerTone): { text: string; reputationDelta: number } | null {
    const conference = this.conferences.get(conferenceId);
    if (!conference || conference.finished) return null;
    const question = conference.questions.find((q) => q.id === questionId);
    if (!question) return null;
    const journalist = this.journalists.get(question.journalistId);
    const rng = this.context.stream('media.answers');

    // Barème : la sincérité paie sur les sujets faciles, l'esquive protège des
    // pièges mais irrite les journalistes.
    const table: Record<AnswerTone, { base: number; hostilityFactor: number; journalistDelta: number }> = {
      diplomate: { base: 0.35, hostilityFactor: 0.2, journalistDelta: 0.05 },
      franc: { base: 0.6, hostilityFactor: -0.7, journalistDelta: 0.18 },
      esquive: { base: 0.05, hostilityFactor: 0.45, journalistDelta: -0.22 },
      humour: { base: 0.5, hostilityFactor: 0.15, journalistDelta: 0.2 },
      'défense d’un coéquipier': { base: 0.7, hostilityFactor: 0.1, journalistDelta: 0.08 },
      'attaque de l’adversaire': { base: 0.2, hostilityFactor: -0.5, journalistDelta: 0.3 },
      silence: { base: -0.4, hostilityFactor: 0.3, journalistDelta: -0.4 },
    };
    const entry = table[tone];
    const reputationDelta = clamp(
      entry.base + entry.hostilityFactor * question.hostility + rng.range(-0.15, 0.15),
      -2,
      2,
    );

    const dialogueTone: DialogueTone =
      tone === 'humour' ? 'ironique' :
      tone === 'franc' ? 'critique' :
      tone === 'attaque de l’adversaire' ? 'tendu' :
      tone === 'silence' ? 'neutre' : 'neutre';

    const text =
      tone === 'silence'
        ? '(le joueur reste silencieux)'
        : this.dialogue.generate(
            'presse.reponse',
            dialogueTone,
            {
              player: this.playerName(),
              club: this.playerClubName(),
              teammate: undefined,
              statistic: this.playerStatline(),
            },
            rng,
          ).text;

    conference.answers.push({ questionId, tone, reputationDelta, text });

    if (journalist) {
      journalist.relationship = clamp(journalist.relationship + entry.journalistDelta, -1, 1);
      journalist.memory.remember(
        MemoryFactory.interaction(
          `journ:${journalist.id}:${conferenceId}:${questionId}`,
          `réponse "${tone}" sur ${question.topic}`,
          ['conférence', question.topic],
          this.context.clock.absoluteMinutes,
          entry.journalistDelta,
        ),
      );
      const outlet = this.outlets.get(journalist.outletId);
      if (outlet) outlet.relationship = clamp(outlet.relationship + entry.journalistDelta * 0.5, -1, 1);
    }

    this.career?.adjustReputation(reputationDelta, `conférence de presse (${tone})`);
    this.context.emit({
      type: 'media.pressConference',
      conferenceId,
      questionId,
      answerTone: tone,
      reputationDelta,
    });

    if (conference.answers.length >= conference.questions.length) conference.finished = true;
    return { text, reputationDelta };
  }

  conference(id: string): PressConference | undefined {
    return this.conferences.get(id);
  }

  // ── Consultation ─────────────────────────────────────────────────────────

  /** Une du jour, triée par importance puis par audience du média. */
  /**
   * La une du jour : d'abord l'importance et la fraîcheur, ensuite l'audience.
   * Un même média et un même titre n'occupent qu'une place tant qu'il reste
   * d'autres sujets — sinon la rédaction la plus puissante monopolisait la une.
   */
  frontPage(limit = 8): Article[] {
    const order: Record<Significance, number> = { historic: 3, major: 2, notable: 1, routine: 0 };
    const ranked = [...this.articles].sort((a, b) => {
      const bySignificance = order[b.significance] - order[a.significance];
      if (bySignificance !== 0) return bySignificance;
      const byDate = b.publishedAt - a.publishedAt;
      if (byDate !== 0) return byDate;
      return (this.outlets.get(b.outletId)?.reach ?? 0) - (this.outlets.get(a.outletId)?.reach ?? 0);
    });

    const page: Article[] = [];
    const usedOutlets = new Set<string>();
    const usedStories = new Set<string>();
    for (const article of ranked) {
      if (page.length >= limit) break;
      if (usedOutlets.has(article.outletId) || usedStories.has(article.storyKey)) continue;
      page.push(article);
      usedOutlets.add(article.outletId);
      usedStories.add(article.storyKey);
    }
    // Pas assez de sujets distincts : on complète avec le reste du classement.
    for (const article of ranked) {
      if (page.length >= limit) break;
      if (page.includes(article)) continue;
      page.push(article);
    }
    return page;
  }

  latestArticles(limit = 20): Article[] {
    return this.articles.slice(Math.max(0, this.articles.length - limit)).reverse();
  }

  articlesAbout(subjectId: string, limit = 20): Article[] {
    return this.articles
      .filter((a) => a.subjectIds.includes(subjectId))
      .slice(-limit)
      .reverse();
  }

  liveAlerts(limit = 10): Array<{ id: string; text: string; at: number; significance: Significance }> {
    return this.alerts.slice(Math.max(0, this.alerts.length - limit)).reverse();
  }

  get channels(): TvShow[] {
    return [...TV_SHOWS];
  }

  /** Émission diffusée à l'heure donnée sur une chaîne. */
  nowOnAir(channelId: string, hour: number): TvShow | null {
    const shows = TV_SHOWS.filter((s) => s.channelId === channelId);
    for (const show of shows) {
      const end = show.startHour + show.durationMinutes / 60;
      if (hour >= show.startHour && hour < end) return show;
    }
    return shows.find((s) => s.format === 'actualités') ?? null;
  }

  get allPodcasts(): Podcast[] {
    return [...this.podcasts.values()];
  }

  get allOutlets(): Outlet[] {
    return [...this.outlets.values()];
  }

  outletRelationship(outletId: string): number {
    return this.outlets.get(outletId)?.relationship ?? 0;
  }

  /** Produit un documentaire personnalisé (Tome XXVII, ch. 5 ; Tome XVII, ch. 5). */
  produceDocumentary(title: string, chapters: readonly string[]): { id: string; title: string; chapters: readonly string[] } {
    const id = `doc:${this.articleCounter++}`;
    this.pushAlert(`Documentaire exclusif : ${title}`, 'historic');
    this.context.emit({ type: 'media.broadcast', channelId: 'out-canal-foot', showId: id, title });
    return { id, title, chapters };
  }

  private playerName(): string {
    return this.career?.hasCareer ? this.career.player.identity.name : 'le joueur';
  }

  /**
   * Nom du club du joueur, sûr même sans carrière active : l'accesseur
   * `career.player` lève une exception dans ce cas, et la rédaction doit
   * continuer de tourner quoi qu'il arrive.
   */
  private playerClubName(): string | undefined {
    if (!this.career?.hasCareer) return undefined;
    const clubId = this.career.player.clubId;
    return clubId ? this.clubName(clubId) : undefined;
  }

  /** Ligne statistique du joueur, sûre sans carrière active. */
  private playerStatline(): string | undefined {
    return this.career?.hasCareer ? this.career.statline() : undefined;
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
      outlets: [...this.outlets.values()],
      journalists: [...this.journalists.values()].map((j) => ({
        id: j.id,
        name: j.name,
        outletId: j.outletId,
        bite: j.bite,
        rigour: j.rigour,
        relationship: j.relationship,
        memories: j.memory.serialize(),
      })),
      articles: this.articles.slice(-300),
      alerts: this.alerts.slice(-100),
      podcasts: [...this.podcasts.values()],
      articleCounter: this.articleCounter,
      conferenceCounter: this.conferenceCounter,
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;
    for (const outlet of (state.outlets as Outlet[]) ?? []) this.outlets.set(outlet.id, outlet);
    for (const raw of (state.journalists as Array<Record<string, unknown>>) ?? []) {
      const memory = new MemoryBank({ capacity: 120, halfLifeDays: 500 });
      memory.restore((raw.memories as never[]) ?? []);
      this.journalists.set(raw.id as string, {
        id: raw.id as string,
        name: raw.name as string,
        outletId: raw.outletId as string,
        bite: raw.bite as number,
        rigour: raw.rigour as number,
        memory,
        relationship: raw.relationship as number,
      });
    }
    this.articles.length = 0;
    // Les sauvegardes antérieures ne portent pas de storyKey : on le reconstruit
    // depuis le titre pour que la une reste variée après un chargement.
    for (const article of (state.articles as Article[]) ?? []) {
      this.articles.push(article.storyKey ? article : { ...article, storyKey: article.headline });
    }
    this.alerts.length = 0;
    this.alerts.push(...(((state.alerts as typeof this.alerts) ?? [])));
    for (const podcast of (state.podcasts as Podcast[]) ?? []) this.podcasts.set(podcast.id, podcast);
    this.articleCounter = (state.articleCounter as number) ?? 0;
    this.conferenceCounter = (state.conferenceCounter as number) ?? 0;
  }
}
