/**
 * awards.js — Boubjack Awards, Ballon d'Or et Hall of Fame.
 *
 * Exigences couvertes (Tome VII intégralement) :
 *   ch. 2 — ville hôte différente chaque année, scène et identité visuelle propres
 *   ch. 3 — tapis rouge complet (joueurs, joueuses, entraîneurs, légendes,
 *           célébrités, interviews, photos, signatures)
 *   ch. 4 — déroulement en dix temps, durée de 30 à 45 minutes
 *   ch. 5 — les dix-sept catégories, chacune avec son trophée gravé
 *   ch. 6 — des légendes remettent les trophées, discours changeant chaque année
 *   ch. 7 — suspense : nominés, statistiques, réactions, enveloppe, silence
 *   ch. 8 — final collectif, photo officielle, feux d'artifice, confettis
 *
 * Plus Tome XVII ch. 3 (Hall of Fame) et Tome XXI ch. 3 (intronisation).
 */

import { bus, EVENTS } from '../core/events.js';
import { AWARD_CATEGORIES, CLUBS, CITIES, getCity, getClub } from '../data/world.js';

/**
 * Légendes du jeu, présentes pour remettre les trophées (Tome VII ch. 6).
 * Ce sont des personnages fictifs propres à l'univers d'Infinity Football.
 */
export const LEGENDS = [
  { id: 'okonkwo', name: 'Emeka Okonkwo', era: '1998-2016', position: 'AT', country: 'Nigeria', trait: 'buteur légendaire' },
  { id: 'ferreira', name: 'Rui Ferreira', era: '2001-2019', position: 'MO', country: 'Portugal', trait: 'meneur de génie' },
  { id: 'volkov', name: 'Anton Volkov', era: '1995-2012', position: 'GB', country: 'Russie', trait: 'gardien mythique' },
  { id: 'diallo', name: 'Aminata Diallo', era: '2004-2021', position: 'MC', country: 'Mali', trait: 'première grande capitaine' },
  { id: 'mendoza', name: 'Carlos Mendoza', era: '1992-2010', position: 'DC', country: 'Argentine', trait: 'mur infranchissable' },
  { id: 'tanaka', name: 'Hiro Tanaka', era: '2000-2018', position: 'MD', country: 'Japon', trait: 'métronome absolu' },
  { id: 'bergstrom', name: 'Lars Bergström', era: '1997-2014', position: 'AT', country: 'Suède', trait: 'recordman de buts' },
  { id: 'nkemba', name: 'Grace Nkemba', era: '2006-2023', position: 'AT', country: 'Cameroun', trait: 'ballon d\'or historique' },
];

/** Le déroulement en dix temps — Tome VII ch. 4. */
export const CEREMONY_FLOW = [
  { id: 'presentation', name: 'Présentation', minutes: 2 },
  { id: 'ouverture', name: 'Ouverture', minutes: 3 },
  { id: 'discours', name: 'Discours', minutes: 4 },
  { id: 'spectacles', name: 'Spectacles', minutes: 5 },
  { id: 'invites', name: 'Invités', minutes: 3 },
  { id: 'annonces', name: 'Annonces', minutes: 4 },
  { id: 'revelations', name: 'Révélations', minutes: 5 },
  { id: 'remise', name: 'Remise des trophées', minutes: 12 },
  { id: 'photos', name: 'Photos officielles', minutes: 3 },
  { id: 'cloture', name: 'Clôture', minutes: 4 },
];

/** Identités visuelles possibles — chaque édition est unique (ch. 2). */
const STAGE_DESIGNS = [
  { id: 'or-nuit', name: 'Or et nuit', palette: ['#0d1b2a', '#c9a227'], set: 'scène circulaire suspendue' },
  { id: 'cristal', name: 'Cristal', palette: ['#e8f1f2', '#4361ee'], set: 'colonnes de verre et lumière froide' },
  { id: 'savane', name: 'Savane', palette: ['#3d2914', '#e09f3e'], set: 'bois sculpté et tissus tissés main' },
  { id: 'neon', name: 'Néon', palette: ['#10002b', '#ff006e'], set: 'écrans LED enveloppants' },
  { id: 'marbre', name: 'Marbre', palette: ['#f8f9fa', '#8d99ae'], set: 'amphithéâtre de marbre blanc' },
  { id: 'oceanique', name: 'Océanique', palette: ['#03045e', '#00b4d8'], set: 'bassin réfléchissant et brume' },
];

export class AwardsSystem {
  constructor(state, rng, { matchEngine, reputation }) {
    this.state = state;
    this.rng = rng;
    this.matchEngine = matchEngine;
    this.reputation = reputation;
    /** Cérémonie en cours de déroulement, ou null. */
    this.currentCeremony = null;
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.WORLD_EVENT, (payload) => {
      if (payload.subtype === 'boubjack-awards') this.holdBoubjackAwards(payload.event);
      if (payload.subtype === 'ballon-dor') this.holdBallonDor(payload.event);
    }));
    this._unsubs.push(bus.on(EVENTS.SEASON_END, () => this.checkHallOfFame()));
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Boubjack Awards ─────────────────────────────────────────────────────

  /**
   * Organise l'édition annuelle. Produit un objet cérémonie complet que
   * l'interface déroule séquence par séquence.
   */
  holdBoubjackAwards(event) {
    const season = this.state.clock.season;
    const cityId = event?.cityId || this.state.world.awardsHosts[season] || 'paris';
    const city = getCity(cityId);
    const design = this.rng.pick(STAGE_DESIGNS);

    // Tapis rouge — Tome VII ch. 3.
    const redCarpet = this._buildRedCarpet(city);

    // Catégories, chacune avec nominés, statistiques et vainqueur.
    const categories = AWARD_CATEGORIES.map((category) => this._resolveCategory(category, season));

    const playerWins = categories.filter((c) => c.playerWon);

    const ceremony = {
      id: `awards-${season}`,
      season,
      cityId,
      cityName: city?.name || 'Ville hôte',
      venue: city?.venues.find((v) => ['musee', 'stade', 'hotel'].includes(v.type))?.name || 'Palais des congrès',
      design,
      durationMinutes: CEREMONY_FLOW.reduce((sum, s) => sum + s.minutes, 0),
      flow: CEREMONY_FLOW,
      redCarpet,
      categories,
      playerWins,
      host: this.rng.pick(LEGENDS),
      watermark: 'Boubjack Awards',
      finale: {
        groupPhoto: true,
        fireworks: true,
        confetti: true,
        music: true,
        text: 'Tous les vainqueurs montent ensemble sur scène pour la photo officielle. Feux d\'artifice, confettis et musique closent la soirée.',
      },
      invited: this._isInvited(),
    };

    this.currentCeremony = ceremony;

    // Enregistrement des victoires du joueur.
    for (const win of playerWins) {
      const award = {
        category: win.name,
        categoryId: win.id,
        season,
        cityId,
        cityName: city?.name,
        presenter: win.presenter.name,
        engraving: `Boubjack Awards ${season + 1} — ${win.name}`,
      };
      this.state.legacy.awards.push(award);

      bus.emit(EVENTS.TROPHY_WON, { kind: 'award', award });
      bus.emit(EVENTS.REPUTATION_CHANGED, {
        delta: win.id === 'legende' ? 12 : win.id === 'icone' ? 9 : 5,
        reason: `${win.name} — Boubjack Awards ${season + 1}`,
        kind: 'media',
      });

      this.state.legacy.timeline.push({
        season,
        type: 'recompense',
        title: `${win.name} — Boubjack Awards`,
        detail: `Trophée remis par ${win.presenter.name} à ${city?.name}.`,
      });

      // Le musée s'enrichit automatiquement (Tome XXI ch. 4).
      if (this.state.legacy.museum.built) {
        this.state.legacy.museum.exhibits.push({ kind: 'récompense', name: win.name, season });
      }
    }

    bus.emit(EVENTS.AWARDS_HELD, ceremony);
    bus.emit(EVENTS.HEADLINE, {
      title: `Boubjack Awards ${season + 1} : la soirée de ${city?.name}`,
      body: playerWins.length > 0
        ? `${this.state.player.name} repart avec ${playerWins.length} trophée(s), dont ${playerWins[0].name}.`
        : `Une cérémonie somptueuse sur une scène « ${design.name} ». ${categories[0].winner.name} ouvre le palmarès.`,
      tone: playerWins.length > 0 ? 'majeur' : 'neutre',
    });

    return ceremony;
  }

  /** Tapis rouge : arrivées, interviews, photos, signatures (ch. 3). */
  _buildRedCarpet(city) {
    const arrivals = [];
    const categories = [
      { group: 'joueurs', count: 6 },
      { group: 'joueuses', count: 5 },
      { group: 'entraîneurs', count: 4 },
      { group: 'légendes', count: 4 },
      { group: 'célébrités', count: 3 },
    ];

    for (const { group, count } of categories) {
      for (let i = 0; i < count; i++) {
        const name = group === 'légendes'
          ? this.rng.pick(LEGENDS).name
          : this._generateName();
        arrivals.push({
          group,
          name,
          outfit: this.rng.pick(['costume trois-pièces', 'smoking noir', 'tenue traditionnelle', 'ensemble sur mesure', 'robe de créateur', 'veste brodée']),
          interviewed: this.rng.chance(0.55),
          photographed: true,
          signedAutographs: this.rng.chance(0.7),
        });
      }
    }

    // Le joueur figure sur le tapis rouge s'il est invité.
    if (this._isInvited()) {
      arrivals.unshift({
        group: 'joueurs',
        name: this.state.player.name,
        outfit: 'tenue sur mesure',
        interviewed: true,
        photographed: true,
        signedAutographs: true,
        isPlayer: true,
      });
    }

    return {
      cityName: city?.name,
      arrivals: this.rng.shuffle(arrivals),
      crowdSize: this.rng.int(3000, 14000),
      photographers: this.rng.int(120, 400),
    };
  }

  /**
   * Détermine nominés et vainqueur d'une catégorie. Le joueur concourt
   * réellement selon ses statistiques de la saison.
   */
  _resolveCategory(category, season) {
    const stats = this.state.stats.seasons[season] || {};
    const presenter = this.rng.pick(LEGENDS);
    const nominees = [];
    let playerScore = 0;

    // Score du joueur selon la catégorie.
    const overall = this.matchEngine.overall();
    const avgRating = (stats.notes && stats.notes.length)
      ? stats.notes.reduce((a, b) => a + b, 0) / stats.notes.length
      : 0;

    switch (category.id) {
      case 'revelation':
        playerScore = this.state.player.age <= 22 ? avgRating * 10 + (stats.buts || 0) * 2 : 0;
        break;
      case 'meilleur-jeune':
        playerScore = this.state.player.age <= 21 ? avgRating * 11 + (stats.buts || 0) * 2.5 : 0;
        break;
      case 'plus-beau-but':
        playerScore = (this.state.stats.records.butsUnMatch?.value || 0) * 12 + (stats.buts || 0) * 1.5;
        break;
      case 'plus-belle-parade':
        playerScore = this.state.player.position === 'GB' ? avgRating * 10 : 0;
        break;
      case 'meilleur-capitaine':
        playerScore = this.state.career.squadStatus === "Star de l'équipe" ? avgRating * 9 + this.state.reputation.global * 0.3 : 0;
        break;
      case 'fair-play':
        playerScore = this.state.reputation.fairplay * 0.8 - (stats.cartonsRouges || 0) * 40;
        break;
      case 'prix-carriere':
        playerScore = this.state.player.age >= 33 ? this.state.stats.career.buts * 0.4 + this.state.legacy.trophies.length * 8 : 0;
        break;
      case 'legende':
        playerScore = this.state.reputation.global >= 88
          ? this.state.reputation.global + this.state.legacy.awards.length * 4 + this.state.legacy.trophies.length * 3
          : 0;
        break;
      case 'icone':
        playerScore = this.state.reputation.global * 0.9 + this.state.reputation.mediaInfluence * 0.4 + this.state.phone.followers / 200000;
        break;
      case 'meilleur-xi':
        playerScore = avgRating * 11 + overall * 0.4;
        break;
      default:
        // Catégories qui ne concernent pas un joueur individuel.
        playerScore = 0;
    }

    // Concurrents générés : leur niveau dépend du prestige du football mondial.
    const competitorCount = 4;
    for (let i = 0; i < competitorCount; i++) {
      let name;
      let detail;

      if (category.scope === 'club' || category.scope === 'lieu') {
        const club = this.rng.pick(CLUBS);
        name = category.scope === 'lieu'
          ? (getCity(club.cityId)?.venues.find((v) => v.type === 'stade')?.name || `${club.name} Arena`)
          : club.name;
        detail = `${club.league} — prestige ${club.prestige}`;
      } else if (category.scope === 'staff') {
        name = this._generateName();
        detail = this.rng.pick(['33 victoires cette saison', 'invaincu à domicile', 'promu champion', 'meilleure défense']);
      } else if (category.scope === 'equipe') {
        name = `XI de ${this.rng.pick(CITIES).name}`;
        detail = 'sélection des meilleurs à chaque poste';
      } else {
        name = this._generateName();
        detail = `${this.rng.int(8, 34)} buts · ${this.rng.int(3, 18)} passes décisives`;
      }

      nominees.push({
        name,
        detail,
        score: this.rng.gaussian(72, 16),
        isPlayer: false,
      });
    }

    // Le joueur est nominé s'il est crédible dans la catégorie.
    const playerEligible = playerScore > 45;
    if (playerEligible) {
      nominees.push({
        name: this.state.player.name,
        detail: `${stats.buts || 0} buts · ${stats.passesD || 0} passes décisives · note ${avgRating.toFixed(2)}`,
        score: playerScore,
        isPlayer: true,
      });
    }

    nominees.sort((a, b) => b.score - a.score);
    const shortlist = nominees.slice(0, 5);
    const winner = shortlist[0];

    // Suspense — Tome VII ch. 7.
    const suspense = {
      nomineesPresented: shortlist.map((n) => n.name),
      statisticsShown: true,
      videoMontage: true,
      crowdReaction: this.rng.pick(['applaudissements nourris', 'murmures d\'approbation', 'silence attentif', 'ovation debout']),
      cameraOnFavourite: shortlist[0].name,
      envelopeOpened: true,
      silence: true,
    };

    return {
      id: category.id,
      name: category.name,
      scope: category.scope,
      nominees: shortlist,
      winner,
      playerWon: !!winner.isPlayer,
      presenter,
      speech: this._legendSpeech(presenter, category, winner),
      suspense,
      trophy: {
        design: `${this.rng.pick(['sphère', 'aile', 'colonne', 'flamme', 'orbe'])} de ${this.rng.pick(['bronze poli', 'cristal taillé', 'or brossé', 'obsidienne'])}`,
        engraving: 'Boubjack Awards',
      },
    };
  }

  /** Les discours changent chaque année — Tome VII ch. 6. */
  _legendSpeech(legend, category, winner) {
    const openings = [
      `J'ai joué pendant ${legend.era.split('-').reduce((a, b) => b - a)} ans, et je n'ai jamais rien vu de tel.`,
      `Quand j'étais ${legend.trait}, on rêvait de soirées comme celle-ci.`,
      `On m'a demandé de dire quelques mots. Je vais essayer de faire court.`,
      `Le football change, mais l'émotion reste la même.`,
      `J'ai vu passer beaucoup de talents. Certains marquent leur époque.`,
    ];
    const closings = [
      `Le trophée de ${category.name} revient à ${winner.name}.`,
      `Et le gagnant est... ${winner.name}.`,
      `${winner.name}, montez sur cette scène.`,
      `Sans surprise pour certains, sans discussion pour tous : ${winner.name}.`,
    ];
    return `${this.rng.pick(openings)} ${this.rng.pick(closings)}`;
  }

  /** Le joueur est-il invité ? — Tome XVII ch. 7, Tome XXI ch. 5. */
  _isInvited() {
    if (this.state.reputation.global >= 45) return true;
    if (this.state.legacy.hallOfFame) return true;
    if (this.state.legacy.awards.length > 0) return true;
    return false;
  }

  // ── Ballon d'Or ─────────────────────────────────────────────────────────

  holdBallonDor(event) {
    const season = this.state.clock.season;
    const city = getCity(event?.cityId || 'paris');
    const stats = this.state.stats.seasons[season] || {};
    const avgRating = (stats.notes && stats.notes.length)
      ? stats.notes.reduce((a, b) => a + b, 0) / stats.notes.length
      : 0;

    // Score du joueur : buts, passes, notes, trophées collectifs, réputation.
    const playerScore =
      (stats.buts || 0) * 3.2 +
      (stats.passesD || 0) * 1.8 +
      avgRating * 12 +
      this.state.legacy.trophies.filter((t) => t.season === season).length * 25 +
      this.state.reputation.global * 0.6;

    const contenders = [];
    for (let i = 0; i < 9; i++) {
      contenders.push({ name: this._generateName(), score: this.rng.gaussian(190, 45), isPlayer: false });
    }
    contenders.push({ name: this.state.player.name, score: playerScore, isPlayer: true });
    contenders.sort((a, b) => b.score - a.score);

    const top = contenders.slice(0, 10);
    const winner = top[0];
    const playerRank = top.findIndex((c) => c.isPlayer) + 1;

    if (winner.isPlayer) {
      const award = {
        category: "Ballon d'Or",
        categoryId: 'ballon-dor',
        season,
        cityId: city?.id,
        cityName: city?.name,
        presenter: this.rng.pick(LEGENDS).name,
        engraving: `Ballon d'Or ${season + 1}`,
      };
      this.state.legacy.awards.push(award);
      bus.emit(EVENTS.TROPHY_WON, { kind: 'ballon-dor', award });
      bus.emit(EVENTS.REPUTATION_CHANGED, { delta: 14, reason: "Ballon d'Or", kind: 'media' });
      this.state.legacy.timeline.push({
        season, type: 'recompense',
        title: `Ballon d'Or ${season + 1}`,
        detail: `Sacré à ${city?.name}.`,
      });
      bus.emit(EVENTS.HEADLINE, {
        title: `${this.state.player.name} remporte le Ballon d'Or`,
        body: `Une consécration individuelle au terme d'une saison exceptionnelle.`,
        tone: 'majeur',
      });
    } else if (playerRank > 0 && playerRank <= 10) {
      bus.emit(EVENTS.HEADLINE, {
        title: `Ballon d'Or : ${this.state.player.name} termine ${playerRank}e`,
        body: `${winner.name} est sacré. Une place dans le top 10 qui confirme la progression.`,
        tone: 'neutre',
      });
      bus.emit(EVENTS.REPUTATION_CHANGED, { delta: (11 - playerRank) * 0.5, reason: `Top 10 du Ballon d'Or` });
    }

    return { season, cityName: city?.name, ranking: top, winner, playerRank: playerRank || null };
  }

  // ── Trophées collectifs ─────────────────────────────────────────────────

  /**
   * Enregistre un trophée collectif remporté avec le club.
   * Chaque trophée a sa cinématique (Tome XVI ch. 5).
   */
  awardTrophy(name, competitionId) {
    const club = getClub(this.state.career.clubId);
    const trophy = {
      name,
      competitionId,
      season: this.state.clock.season,
      clubId: this.state.career.clubId,
      clubName: club?.name,
    };
    this.state.legacy.trophies.push(trophy);

    if (this.state.legacy.museum.built) {
      this.state.legacy.museum.exhibits.push({ kind: 'trophée', name, season: trophy.season });
    }

    this.state.legacy.timeline.push({
      season: trophy.season,
      type: 'trophee',
      title: name,
      detail: `Remporté avec ${club?.name}.`,
    });

    bus.emit(EVENTS.TROPHY_WON, { kind: 'collectif', trophy });
    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'cinematic',
      title: `${name} remporté !`,
      body: `Remise des médailles, tour d'honneur, confettis et conférence de presse d'après-match.`,
      cinematic: 'remise-trophee',
    });
    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: 6, reason: name });

    return trophy;
  }

  // ── Hall of Fame (Tome XVII ch. 3, Tome XXI ch. 3) ─────────────────────

  checkHallOfFame() {
    if (this.state.legacy.hallOfFame) return;

    const stats = this.state.stats.career;
    const legacy = this.state.legacy;

    // Critères d'éligibilité : une carrière qui compte, pas un simple seuil.
    const score =
      stats.buts * 0.8 +
      stats.passesD * 0.5 +
      stats.matchs * 0.15 +
      legacy.trophies.length * 12 +
      legacy.awards.length * 18 +
      this.state.reputation.global * 1.2;

    if (score < 320) return;

    legacy.hallOfFame = true;
    legacy.hallOfFameSeason = this.state.clock.season;

    const induction = {
      ceremony: "Cérémonie d'intronisation",
      speech: `${this.state.player.name}, ${stats.matchs} matchs, ${stats.buts} buts. Le Hall of Fame vous accueille.`,
      jacket: 'Veste officielle du Hall of Fame remise sur scène',
      plaque: `Plaque gravée : « ${this.state.player.name} — ${legacy.hallOfFameSeason} »`,
      video: 'Vidéo rétrospective retraçant toute la carrière',
      presenter: this.rng.pick(LEGENDS).name,
    };

    legacy.timeline.push({
      season: this.state.clock.season,
      type: 'hall-of-fame',
      title: 'Intronisation au Hall of Fame',
      detail: induction.plaque,
    });

    bus.emit(EVENTS.HALL_OF_FAME, induction);
    bus.emit(EVENTS.HEADLINE, {
      title: `${this.state.player.name} entre au Hall of Fame`,
      body: `Intronisation officielle : discours, veste remise sur scène et plaque gravée.`,
      tone: 'majeur',
    });
    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: 10, reason: 'Hall of Fame' });

    return induction;
  }

  /** Classement mondial du Hall of Fame — Tome XVII ch. 3. */
  hallOfFameRoster() {
    const roster = LEGENDS.map((legend) => ({
      name: legend.name,
      category: 'joueur',
      era: legend.era,
      note: legend.trait,
      isPlayer: false,
    }));

    if (this.state.legacy.hallOfFame) {
      const stats = this.state.stats.career;
      roster.unshift({
        name: this.state.player.name,
        category: this.state.legacy.postCareerRole ? this.state.legacy.postCareerRole.name.toLowerCase() : 'joueur',
        era: `${this.state.career.clubHistory[0]?.from || '—'}-${this.state.player.retiredAt?.season || 'en cours'}`,
        note: `${stats.buts} buts en ${stats.matchs} matchs`,
        isPlayer: true,
      });
    }

    // Le Hall of Fame accueille aussi entraîneurs, présidents et arbitres.
    roster.push(
      { name: 'D. Marchetti', category: 'entraîneur', era: '1994-2018', note: '6 titres continentaux', isPlayer: false },
      { name: 'P. Nordström', category: 'président', era: '1988-2011', note: 'a bâti un club en dynastie', isPlayer: false },
      { name: 'K. Oduya', category: 'arbitre', era: '2002-2024', note: 'trois finales de Coupe du Monde', isPlayer: false },
    );

    return roster;
  }

  /** Invitations reçues par une légende — Tome XVII ch. 7, Tome XXI ch. 5. */
  legendInvitations() {
    const rep = this.state.reputation.global;
    const isLegend = this.state.legacy.hallOfFame || rep >= 85;
    if (!isLegend) return [];

    const season = this.state.clock.season;
    const host = getCity(this.state.world.awardsHosts[season] || 'paris');

    const invitations = [
      { id: 'awards', name: 'Boubjack Awards', role: 'Remettre un trophée', cityName: host?.name, prestige: 100 },
      { id: 'ballon', name: "Cérémonie du Ballon d'Or", role: "Invité d'honneur", cityName: 'Paris', prestige: 95 },
      { id: 'tirage', name: 'Tirage au sort continental', role: 'Procéder au tirage', cityName: 'Genève', prestige: 78 },
      { id: 'finale', name: 'Finale internationale', role: "Donner le coup d'envoi", cityName: this.rng.pick(CITIES).name, prestige: 92 },
      { id: 'inauguration', name: 'Inauguration de stade', role: 'Couper le ruban', cityName: this.rng.pick(CITIES).name, prestige: 70 },
      { id: 'legendes', name: 'Match des légendes', role: 'Jouer une mi-temps', cityName: this.rng.pick(CITIES).name, prestige: 65 },
    ];

    // Une Coupe du Monde dans le pays d'origine est une invitation certaine.
    if (rep >= 90) {
      invitations.push({
        id: 'coupe-du-monde',
        name: 'Coupe du Monde',
        role: `Ambassadeur — accueil au ${this.state.player.nationality}`,
        cityName: this.state.player.nationality,
        prestige: 100,
      });
    }

    return invitations;
  }

  /** Le joueur accepte une invitation de légende. */
  acceptInvitation(invitationId, economy) {
    const invitation = this.legendInvitations().find((i) => i.id === invitationId);
    if (!invitation) return { ok: false, reason: 'Invitation indisponible.' };

    const fee = Math.round(invitation.prestige * 1800);
    economy.transact({ amount: fee, label: `Cachet — ${invitation.name}`, category: 'image' });

    bus.emit(EVENTS.REPUTATION_CHANGED, { delta: invitation.prestige * 0.03, reason: invitation.name, kind: 'media' });
    bus.emit(EVENTS.WORLD_EVENT, {
      kind: 'ceremony',
      title: invitation.name,
      body: `${invitation.role} à ${invitation.cityName}. Le public se lève à votre entrée.`,
      cinematic: 'invitation-legende',
    });

    return { ok: true, invitation, fee };
  }

  _generateName() {
    const first = ['Adama', 'Luca', 'Kwame', 'Diego', 'Yuki', 'Omar', 'Nils', 'Rafael', 'Tomás', 'Idrissa', 'Mateo', 'Kai', 'Anders', 'Youssef', 'Nikola', 'Enzo', 'Malik', 'Joaquín'];
    const last = ['Traoré', 'Bianchi', 'Mensah', 'Ríos', 'Sato', 'Haddad', 'Lindqvist', 'Moreira', 'Vidal', 'Camara', 'Duarte', 'Nakano', 'Berg', 'Bennani', 'Petrović', 'Rossi', 'Diakité', 'Ferrer'];
    return `${this.rng.pick(first)} ${this.rng.pick(last)}`;
  }
}
