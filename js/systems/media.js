/**
 * media.js — Médias, presse et diffusion mondiale.
 *
 * Exigences couvertes (Tome XXVII intégralement) :
 *   ch. 2 — chaînes TV spécialisées, consultables sur télévision ou téléphone
 *   ch. 3 — journaux publiés chaque matin, gros titres évolutifs
 *   ch. 4 — conférences de presse interactives, chaque réponse pèse
 *   ch. 5 — documentaires, dont un exclusif si le joueur devient une légende
 *   ch. 6 — alertes d'information en temps réel
 *   ch. 7 — podcasts écoutables en voiture, à la maison, en voyage
 *   ch. 8 — « le football est suivi 24h/24 »
 * Plus Tome VIII ch. 4 : les journalistes ont une mémoire et adaptent
 * leurs questions ; aucune interview n'est identique.
 */

import { bus, EVENTS } from '../core/events.js';
import { getClub } from '../data/world.js';

/** Chaînes fictives — Tome XXVII ch. 2. */
export const TV_CHANNELS = [
  { id: 'infinity-news', name: 'Infinity News', genre: 'actualités football', schedule: 'continu' },
  { id: 'le-debat', name: 'Le Débat', genre: 'débats', schedule: 'soir' },
  { id: 'tactique-tv', name: 'Tactique TV', genre: 'analyses tactiques', schedule: 'après-match' },
  { id: 'mercato-live', name: 'Mercato Live', genre: 'mercato', schedule: 'saisonnier' },
  { id: 'archives-doc', name: 'Archives & Documentaires', genre: 'documentaires', schedule: 'soir' },
  { id: 'matin-foot', name: 'Matin Foot', genre: 'émission quotidienne', schedule: 'matin' },
];

/** Podcasts — Tome XXVII ch. 7. */
export const PODCASTS = [
  { id: 'la-tactique', name: 'La Tactique', genre: 'analyses tactiques', episodes: 214 },
  { id: 'face-a-face', name: 'Face à Face', genre: 'interviews', episodes: 138 },
  { id: 'memoire-du-foot', name: 'Mémoire du Foot', genre: 'histoires du football', episodes: 96 },
  { id: 'le-grand-debat', name: 'Le Grand Débat', genre: 'débats', episodes: 302 },
];

/**
 * Archétypes de journalistes. Chacun a un angle et une mémoire propre :
 * le même événement ne donne pas la même question selon l'interlocuteur.
 */
export const JOURNALISTS = [
  { id: 'lefevre', name: 'C. Lefèvre', outlet: 'Infinity News', angle: 'bienveillant', persistence: 0.3 },
  { id: 'darrieux', name: 'S. Darrieux', outlet: 'Le Débat', angle: 'provocateur', persistence: 0.8 },
  { id: 'nakamura', name: 'T. Nakamura', outlet: 'Tactique TV', angle: 'technique', persistence: 0.5 },
  { id: 'osei', name: 'B. Osei', outlet: 'Mercato Live', angle: 'mercato', persistence: 0.7 },
  { id: 'ferrari', name: 'L. Ferrari', outlet: 'Matin Foot', angle: 'humain', persistence: 0.4 },
];

/** Réponses possibles en conférence de presse — Tome XXVII ch. 4. */
export const PRESS_ANSWERS = [
  { id: 'franc', label: 'Répondre franchement', reputation: 0.6, media: 2, risk: 0.15, tone: 'direct' },
  { id: 'esquive', label: 'Esquiver la question', reputation: -0.2, media: -1, risk: 0.05, tone: 'évasif' },
  { id: 'humour', label: 'Plaisanter', reputation: 0.4, media: 3, risk: 0.2, tone: 'léger' },
  { id: 'defendre', label: 'Défendre un coéquipier', reputation: 1.0, media: 2, risk: 0.1, tone: 'solidaire', teamMoral: 4 },
  { id: 'attaquer', label: 'Attaquer un adversaire', reputation: -0.8, media: 6, risk: 0.55, tone: 'polémique' },
  { id: 'humble', label: 'Rester humble', reputation: 0.8, media: 1, risk: 0.02, tone: 'mesuré' },
];

export class MediaSystem {
  constructor(state, rng, { reputation }) {
    this.state = state;
    this.rng = rng;
    this.reputation = reputation;
    /** Conférence en attente de réponse du joueur */
    this.pendingConference = null;
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.HEADLINE, (payload) => this.publish(payload)));
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.morningEdition()));
    this._unsubs.push(bus.on(EVENTS.MATCH_PLAYED, (report) => this.onMatch(report)));
    this._unsubs.push(bus.on(EVENTS.TRANSFER, (payload) => this.rememberEvent('transfert', payload)));
    this._unsubs.push(bus.on(EVENTS.INJURY, (payload) => this.rememberEvent('blessure', payload)));
    this._unsubs.push(bus.on(EVENTS.RETIREMENT, (payload) => this.produceCareerDocumentary(payload)));
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Journaux et alertes ─────────────────────────────────────────────────

  /** Publie un titre. Tome XXVII ch. 6 : les alertes apparaissent en temps réel. */
  publish({ title, body, tone = 'neutre', outlet = null }) {
    const headline = {
      id: `hl-${this.state.media.headlines.length + 1}`,
      title,
      body,
      tone,
      outlet: outlet || this.rng.pick(TV_CHANNELS).name,
      date: `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`,
      season: this.state.clock.season,
      stamp: this.state.clock.year * 10000 + (this.state.clock.month + 1) * 100 + this.state.clock.day,
    };

    this.state.media.headlines.unshift(headline);
    if (this.state.media.headlines.length > 120) this.state.media.headlines.length = 120;

    // Alerte poussée sur le téléphone (Tome XI ch. 2 : app Actualités).
    if (tone === 'majeur' || tone === 'negatif') {
      this.state.phone.notifications.unshift({
        app: 'actualites',
        title,
        body,
        at: headline.date,
        read: false,
      });
      this.state.phone.unread++;
    }

    return headline;
  }

  /** Chaque matin, la presse publie de nouveaux articles — Tome XXVII ch. 3. */
  morningEdition() {
    if (this.state.clock.hour !== 0) return;
    // Une à trois brèves par jour, tirées du monde et de la carrière.
    const count = this.rng.int(1, 3);
    for (let i = 0; i < count; i++) {
      const article = this._generateArticle();
      if (article) this.publish(article);
    }
  }

  _generateArticle() {
    const player = this.state.player;
    const club = getClub(this.state.career.clubId);
    const stats = this.state.stats.seasons[this.state.clock.season];
    const rep = this.state.reputation.global;

    const pool = [];

    // Articles liés aux performances récentes.
    if (stats && stats.matchs > 0) {
      const average = stats.notes.length ? stats.notes.reduce((a, b) => a + b, 0) / stats.notes.length : 0;
      if (average >= 7.5) {
        pool.push({
          weight: 30,
          title: `${player.name} porte ${club?.name}`,
          body: `Note moyenne de ${average.toFixed(2)} sur ${stats.matchs} matchs. La presse s'enflamme.`,
          tone: 'positif',
        });
      } else if (average > 0 && average < 6.0) {
        pool.push({
          weight: 25,
          title: `Passage à vide pour ${player.name}`,
          body: `Note moyenne de ${average.toFixed(2)}. Les observateurs s'interrogent sur sa forme.`,
          tone: 'negatif',
        });
      }
      if (stats.buts >= 10) {
        pool.push({
          weight: 20,
          title: `${stats.buts} buts : la saison référence de ${player.name}`,
          body: `Le compteur s'emballe et les comparaisons historiques commencent.`,
          tone: 'positif',
        });
      }
    }

    // Articles de mercato.
    if (this.state.clock.month === 0 || this.state.clock.month === 6) {
      pool.push({
        weight: 22,
        title: `Mercato : ${player.name} dans le viseur de plusieurs clubs`,
        body: `Sa valeur est estimée à ${(this.state.career.marketValue / 1000000).toFixed(1)} M€. Son agent reste silencieux.`,
        tone: 'neutre',
        outlet: 'Mercato Live',
      });
    }

    // Blessures.
    if (player.injury) {
      pool.push({
        weight: 35,
        title: `${player.name} indisponible : ${player.injury.type}`,
        body: `${player.injury.daysLeft} jours d'absence estimés. Le staff médical se veut rassurant.`,
        tone: 'negatif',
      });
    }

    // Vie extra-sportive.
    if (this.state.economy.philanthropy.foundations.length > 0 && this.rng.chance(0.4)) {
      const foundation = this.rng.pick(this.state.economy.philanthropy.foundations);
      pool.push({
        weight: 12,
        title: `La fondation ${foundation.name} étend son action`,
        body: `Budget annuel de ${foundation.annualBudget.toLocaleString('fr-FR')} €. Un engagement salué.`,
        tone: 'positif',
      });
    }

    // Le monde vit sans le joueur — Tome XIX ch. 1.
    pool.push({
      weight: 18,
      title: this.rng.pick([
        'Une équipe renverse la vapeur en huit minutes',
        'Un entraîneur limogé après quatre défaites de rang',
        'Un jeune de 17 ans crève l\'écran pour ses débuts',
        'Un stade historique annonce sa rénovation complète',
        'Record d\'affluence battu ce week-end',
      ]),
      body: 'Le football continue de vivre, avec ou sans vous.',
      tone: 'neutre',
    });

    // Réputation élevée : les médias en parlent davantage.
    if (rep > 60) {
      pool.push({
        weight: 15,
        title: `${player.name}, l'homme dont tout le monde parle`,
        body: `Réputation mondiale : ${rep.toFixed(0)}/100. Sa moindre déclaration fait la une.`,
        tone: 'positif',
      });
    }

    if (pool.length === 0) return null;
    return this.rng.weighted(pool);
  }

  // ── Mémoire des journalistes (Tome VIII ch. 4) ─────────────────────────

  rememberEvent(kind, payload) {
    this.state.media.journalistMemory.unshift({
      kind,
      season: this.state.clock.season,
      date: `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`,
      summary: this._summarize(kind, payload),
    });
    if (this.state.media.journalistMemory.length > 60) this.state.media.journalistMemory.length = 60;
  }

  _summarize(kind, payload) {
    switch (kind) {
      case 'transfert':
        return `Transfert vers ${getClub(payload.to)?.name || 'un nouveau club'} pour ${(payload.fee / 1000000).toFixed(1)} M€.`;
      case 'blessure':
        return `Blessure : ${payload.injury?.type} (${payload.injury?.days} jours).`;
      case 'polemique':
        return payload.text || 'Déclaration controversée.';
      default:
        return kind;
    }
  }

  onMatch(report) {
    if (report.absent) return;

    // Titre automatique sur les matchs marquants.
    if (report.stats.buts >= 2) {
      this.publish({
        title: `${this.state.player.name} : ${report.stats.buts} buts contre ${report.opponent}`,
        body: `${report.club} ${report.scoreLabel} ${report.opponent}. Note de ${report.rating}.`,
        tone: 'positif',
        outlet: 'Infinity News',
      });
    } else if (report.stats.cartonsRouges > 0) {
      this.publish({
        title: `Expulsion : ${this.state.player.name} quitte le terrain`,
        body: `Un carton rouge qui coûte cher à ${report.club}. L'arbitre ${report.referee.name} au centre des débats.`,
        tone: 'negatif',
        outlet: 'Le Débat',
      });
      this.rememberEvent('polemique', { text: `Expulsé contre ${report.opponent}.` });
    }

    // Une conférence de presse suit les rencontres importantes.
    if ((report.fixture.importance || 0) > 0.7 || report.stats.buts >= 2 || report.stats.cartonsRouges > 0) {
      this.pendingConference = this.buildConference(report);
      bus.emit(EVENTS.NOTIFY, {
        level: 'info',
        title: 'Conférence de presse',
        body: `${this.pendingConference.journalist.name} (${this.pendingConference.journalist.outlet}) vous attend en salle de presse.`,
      });
    }

    this.rememberEvent('match', {
      text: `${report.club} ${report.scoreLabel} ${report.opponent} — note ${report.rating}.`,
    });
  }

  // ── Conférences de presse (Tome XXVII ch. 4) ───────────────────────────

  /**
   * Construit une conférence dont les questions dépendent réellement du
   * contexte et de la mémoire du journaliste : « aucune interview ne doit
   * être identique » (Tome VIII ch. 4).
   */
  buildConference(report = null) {
    const journalist = this.rng.pick(JOURNALISTS);
    const player = this.state.player;
    const club = getClub(this.state.career.clubId);
    const memory = this.state.media.journalistMemory;

    const questions = [];

    // Question liée au dernier match.
    if (report) {
      if (report.resultat === 'victoire') {
        questions.push(`Victoire ${report.scoreLabel} contre ${report.opponent}. Cette équipe peut-elle viser le titre ?`);
      } else if (report.resultat === 'défaite') {
        questions.push(`Défaite ${report.scoreLabel}. Qu'est-ce qui n'a pas fonctionné ce soir ?`);
      } else {
        questions.push(`Un nul frustrant contre ${report.opponent}. Deux points perdus ?`);
      }
      if (report.stats.cartonsRouges > 0) {
        questions.push(`Vous avez été expulsé. Regrettez-vous ce geste ?`);
      }
      if (report.stats.buts >= 2) {
        questions.push(`${report.stats.buts} buts ce soir : où placez-vous cette performance dans votre carrière ?`);
      }
    }

    // Questions issues de la mémoire — le journaliste revient sur le passé.
    if (memory.length > 0 && this.rng.chance(journalist.persistence)) {
      const past = this.rng.pick(memory.slice(0, 8));
      questions.push(`Vous souvenez-vous de ${past.date} ? ${past.summary} Avec le recul, qu'en retenez-vous ?`);
    }

    // Questions selon l'angle du journaliste.
    const byAngle = {
      bienveillant: [
        `Comment vivez-vous cette période sur le plan personnel ?`,
        `Qu'est-ce qui vous motive au quotidien ?`,
      ],
      provocateur: [
        `Certains disent que vous êtes surcoté. Que leur répondez-vous ?`,
        `Votre salaire fait débat. Le méritez-vous vraiment ?`,
        `Un adversaire a déclaré que vous disparaissiez dans les grands matchs.`,
      ],
      technique: [
        `Votre positionnement a changé ces derniers mois. Est-ce une consigne du staff ?`,
        `Face à un bloc bas, quelle est votre solution préférentielle ?`,
      ],
      mercato: [
        `Plusieurs clubs vous suivent. Votre avenir est-il à ${club?.name} ?`,
        `Votre valeur est estimée à ${(this.state.career.marketValue / 1000000).toFixed(1)} M€. Cela vous flatte ?`,
      ],
      humain: [
        `Votre famille vous suit-elle dans cette aventure ?`,
        `Que faites-vous quand vous ne jouez pas au football ?`,
      ],
    };
    questions.push(...this.rng.sample(byAngle[journalist.angle] || byAngle.bienveillant, 1));

    // Blessure en cours.
    if (player.injury) {
      questions.push(`Votre blessure (${player.injury.type}) inquiète les supporters. Où en êtes-vous ?`);
    }

    return {
      id: `conf-${Date.now()}`,
      journalist,
      questions: this.rng.shuffle(questions).slice(0, 3),
      answers: PRESS_ANSWERS,
      report: report ? { opponent: report.opponent, scoreLabel: report.scoreLabel, rating: report.rating } : null,
      season: this.state.clock.season,
    };
  }

  /**
   * Traite les réponses du joueur. Chaque réponse influence la réputation,
   * l'influence médiatique et peut déclencher une polémique.
   */
  answerConference(conference, answerIds) {
    const outcomes = [];
    let totalReputation = 0;
    let totalMedia = 0;
    let controversy = false;

    for (let i = 0; i < answerIds.length; i++) {
      const answer = PRESS_ANSWERS.find((a) => a.id === answerIds[i]);
      if (!answer) continue;

      // Le mental du joueur atténue le risque de dérapage.
      const risk = answer.risk * (1 - this.state.player.attributes.mental / 220);
      const backfired = this.rng.chance(risk);

      totalReputation += backfired ? -Math.abs(answer.reputation) * 1.6 : answer.reputation;
      totalMedia += answer.media;

      if (backfired) {
        controversy = true;
        outcomes.push({
          question: conference.questions[i],
          answer: answer.label,
          result: 'La réponse est mal reprise par la presse et provoque une polémique.',
          negative: true,
        });
      } else {
        outcomes.push({
          question: conference.questions[i],
          answer: answer.label,
          result: this._successText(answer),
          negative: false,
        });
      }

      if (answer.teamMoral) {
        this.state.player.condition.moral = Math.min(100, this.state.player.condition.moral + answer.teamMoral);
      }
    }

    bus.emit(EVENTS.REPUTATION_CHANGED, {
      delta: totalReputation,
      reason: `Conférence de presse — ${conference.journalist.outlet}`,
      kind: 'media',
    });
    this.state.reputation.mediaInfluence = Math.min(100, this.state.reputation.mediaInfluence + totalMedia * 0.3);

    if (controversy) {
      this.publish({
        title: `Polémique après les propos de ${this.state.player.name}`,
        body: `Les déclarations en conférence de presse font réagir. ${conference.journalist.outlet} y consacre son édition du soir.`,
        tone: 'negatif',
        outlet: conference.journalist.outlet,
      });
      this.rememberEvent('polemique', { text: `Propos controversés en conférence (${conference.journalist.outlet}).` });
    }

    const record = {
      id: conference.id,
      season: conference.season,
      journalist: conference.journalist.name,
      outlet: conference.journalist.outlet,
      outcomes,
      reputationDelta: Math.round(totalReputation * 100) / 100,
      controversy,
    };
    this.state.media.pressConferences.unshift(record);
    if (this.state.media.pressConferences.length > 40) this.state.media.pressConferences.length = 40;

    this.pendingConference = null;
    bus.emit(EVENTS.PRESS_CONFERENCE, record);
    return record;
  }

  _successText(answer) {
    const texts = {
      direct: 'Votre franchise est saluée par la salle.',
      évasif: 'Le journaliste insiste, mais vous ne cédez rien.',
      léger: 'La salle rit, la séquence tourne en boucle sur les réseaux.',
      solidaire: 'Le vestiaire apprécie que vous ayez pris la défense de votre coéquipier.',
      polémique: 'La déclaration fait le tour des rédactions et vous place au centre du jeu.',
      mesuré: 'Votre humilité est relevée par les observateurs.',
    };
    return texts[answer.tone] || 'La réponse passe bien.';
  }

  // ── Documentaires (Tome XXVII ch. 5, Tome XVII ch. 5) ──────────────────

  /**
   * Génère un documentaire personnalisé retraçant la carrière au moment de la
   * retraite. Le contenu est construit à partir des données réelles de la
   * sauvegarde — chaque documentaire est donc unique.
   */
  produceCareerDocumentary(payload) {
    const stats = this.state.stats.career;
    const legacy = this.state.legacy;
    const player = this.state.player;

    const chapters = [];

    // Les débuts.
    const firstClub = getClub(this.state.career.clubHistory[0]?.clubId);
    chapters.push({
      title: 'Les débuts',
      body: `Tout commence à ${firstClub?.name || 'un club modeste'}, où un jeune de 17 ans signe son premier contrat professionnel.`,
    });

    // Le parcours : toujours présent, il structure le récit.
    const clubNames = this.state.career.clubHistory
      .map((h) => getClub(h.clubId)?.name)
      .filter(Boolean);
    chapters.push({
      title: 'Le parcours',
      body: clubNames.length > 1
        ? `${clubNames.length} clubs traversés : ${clubNames.join(', ')}. ${stats.matchs} matchs disputés au total.`
        : `Une carrière d'un seul club : ${clubNames[0] || '—'}, ${stats.matchs} matchs. Une fidélité devenue rare.`,
    });

    // Les grands matchs — extraits de la mémoire du monde.
    const greatMatches = this.state.world.worldMemory.filter((m) => m.type === 'performance').slice(0, 4);
    if (greatMatches.length > 0) {
      chapters.push({
        title: 'Les soirs de gloire',
        body: greatMatches.map((m) => m.text).join(' '),
      });
    }

    // Les blessures.
    const injuries = this.state.media.journalistMemory.filter((m) => m.kind === 'blessure');
    if (injuries.length > 0) {
      chapters.push({
        title: 'Les épreuves',
        body: `${injuries.length} blessure(s) ont jalonné le parcours. ${injuries[0].summary} À chaque fois, le retour.`,
      });
    }

    // Les records.
    const records = Object.entries(this.state.stats.records);
    if (records.length > 0) {
      chapters.push({
        title: 'Les records',
        body: records.map(([, r]) => `${r.value} ${r.label} (${r.season})`).join(' · '),
      });
    }

    // Les trophées.
    if (legacy.trophies.length > 0 || legacy.awards.length > 0) {
      chapters.push({
        title: 'Le palmarès',
        body: `${legacy.trophies.length} trophée(s) et ${legacy.awards.length} récompense(s) individuelle(s), dont ${legacy.awards.slice(0, 3).map((a) => a.category).join(', ') || '—'}.`,
      });
    }

    // Les moments forts et la fin.
    chapters.push({
      title: 'L\'héritage',
      body: `${stats.matchs} matchs, ${stats.buts} buts, ${stats.passesD} passes décisives. ` +
        `${legacy.statues.length > 0 ? 'Une statue veille désormais devant le stade. ' : ''}` +
        `Le nom de ${player.name} restera attaché à cette époque.`,
    });

    const documentary = {
      id: `doc-${this.state.clock.season}`,
      title: `${player.name} — une vie de football`,
      season: this.state.clock.season,
      exclusive: this.state.reputation.global >= 75,
      duration: 78,
      chapters,
      platform: 'Archives & Documentaires',
    };

    this.state.media.documentaries.unshift(documentary);

    this.publish({
      title: `Documentaire exclusif : « ${documentary.title} »`,
      body: `${documentary.chapters.length} chapitres retraçant ${stats.matchs} matchs de carrière. Diffusion ce soir.`,
      tone: 'majeur',
      outlet: 'Archives & Documentaires',
    });

    void payload;
    return documentary;
  }

  /** Programme TV du moment — Tome XXVII ch. 2. */
  tvSchedule() {
    const hour = this.state.clock.hour;
    const period = hour < 11 ? 'matin' : hour < 18 ? 'journée' : 'soir';

    return TV_CHANNELS.map((channel) => {
      let programme;
      if (channel.id === 'infinity-news') {
        programme = this.state.media.headlines[0]?.title || 'Le journal du football';
      } else if (channel.id === 'mercato-live') {
        programme = [0, 6, 7].includes(this.state.clock.month) ? 'Spéciale mercato en direct' : 'Rediffusion : les transferts de l\'été';
      } else if (channel.id === 'archives-doc') {
        programme = this.state.media.documentaries[0]?.title || 'Les grandes Coupes du Monde';
      } else if (channel.id === 'tactique-tv') {
        programme = 'Décryptage : comment battre un bloc bas';
      } else if (channel.id === 'le-debat') {
        programme = this.state.media.headlines.find((h) => h.tone === 'negatif')?.title || 'Le débat du soir';
      } else {
        programme = period === 'matin' ? 'Le réveil football' : 'Rediffusion';
      }
      return { ...channel, programme, live: channel.schedule === 'continu' || channel.schedule === period };
    });
  }

  /** Podcasts disponibles, avec un épisode contextuel. */
  podcastEpisodes() {
    const player = this.state.player;
    return PODCASTS.map((podcast) => {
      let episode;
      switch (podcast.id) {
        case 'la-tactique':
          episode = `Épisode ${podcast.episodes} — Le rôle du ${this._positionLabel()} moderne`;
          break;
        case 'face-a-face':
          episode = this.state.reputation.global >= 50
            ? `Épisode ${podcast.episodes} — ${player.name} se raconte`
            : `Épisode ${podcast.episodes} — Un entraîneur sans filtre`;
          break;
        case 'memoire-du-foot':
          episode = `Épisode ${podcast.episodes} — Les légendes oubliées`;
          break;
        default:
          episode = `Épisode ${podcast.episodes} — ${this.state.media.headlines[0]?.title || 'Le sujet du jour'}`;
      }
      return { ...podcast, episode };
    });
  }

  _positionLabel() {
    return {
      GB: 'gardien', DC: 'défenseur central', DL: 'latéral', MD: 'milieu défensif',
      MC: 'milieu central', MO: 'meneur de jeu', AT: 'attaquant',
    }[this.state.player.position] || 'joueur';
  }
}
