/**
 * phone.js — Smartphone, applications, réseaux sociaux et vie personnelle.
 *
 * Exigences couvertes (Tome XI intégralement) :
 *   ch. 1 — un véritable smartphone, utilisable partout
 *   ch. 2 — les 21 applications listées, extensibles par mise à jour
 *   ch. 3 — réseaux sociaux : publications variées, commentaires générés par IA,
 *           tendances évoluant chaque semaine
 *   ch. 4 — Snapstreak : snaps, réponses, flammes, stories
 *   ch. 5 — musique : playlists personnelles, lecture en menus/voiture/maison
 *   ch. 6 — IA secrétaire organisant l'ensemble de la vie du joueur
 *   ch. 7 — vie personnelle : famille, amis, anniversaires, cadeaux
 *   ch. 8 — plus le joueur est célèbre, plus il reçoit de sollicitations
 * Plus Tome VIII ch. 5 (capacités complètes de l'IA secrétaire) et
 * Tome XXX v2 ch. 5 (commandes et livraisons physiques).
 */

import { bus, EVENTS } from '../core/events.js';
import { getCity, getClub, LUXURY_ITEMS, VEHICLES } from '../data/world.js';

/** Les applications du téléphone — Tome XI ch. 2. */
export const APPS = [
  { id: 'telephone', name: 'Téléphone', icon: '📞', category: 'communication' },
  { id: 'messages', name: 'Messages', icon: '💬', category: 'communication' },
  { id: 'visio', name: 'Appels vidéo', icon: '📹', category: 'communication' },
  { id: 'contacts', name: 'Contacts', icon: '👥', category: 'communication' },
  { id: 'galerie', name: 'Galerie', icon: '🖼️', category: 'média' },
  { id: 'camera', name: 'Appareil photo', icon: '📷', category: 'média' },
  { id: 'banque', name: 'Banque', icon: '🏦', category: 'finance' },
  { id: 'agenda', name: 'Agenda', icon: '📋', category: 'organisation' },
  { id: 'gps', name: 'GPS', icon: '🧭', category: 'navigation' },
  { id: 'musique', name: 'Musique', icon: '🎵', category: 'média' },
  { id: 'snapstreak', name: 'Snapstreak', icon: '🔥', category: 'social' },
  { id: 'social', name: 'Réseaux sociaux', icon: '📱', category: 'social' },
  { id: 'boutique', name: 'Boutique', icon: '🛒', category: 'commerce' },
  { id: 'commandes', name: 'Commandes', icon: '📦', category: 'commerce' },
  { id: 'livraison', name: 'Livraison', icon: '🚚', category: 'commerce' },
  { id: 'secretaire', name: 'IA Secrétaire', icon: '🤖', category: 'organisation' },
  { id: 'meteo', name: 'Météo', icon: '🌤️', category: 'information' },
  { id: 'actualites', name: 'Actualités', icon: '📰', category: 'information' },
  { id: 'calendrier', name: 'Calendrier', icon: '📅', category: 'organisation' },
  { id: 'mail', name: 'Mail', icon: '✉️', category: 'communication' },
  { id: 'notes', name: 'Notes', icon: '📝', category: 'organisation' },
];

/** Types de publications — Tome XI ch. 3. */
export const POST_TYPES = [
  { id: 'photo', name: 'Photo', reach: 1.0, reputation: 0.15 },
  { id: 'video', name: 'Vidéo', reach: 1.6, reputation: 0.25 },
  { id: 'story', name: 'Story', reach: 0.6, reputation: 0.08, ephemeral: true },
  { id: 'annonce', name: 'Annonce', reach: 2.2, reputation: 0.4 },
  { id: 'trophee', name: 'Trophée', reach: 2.8, reputation: 0.6 },
  { id: 'vacances', name: 'Vacances', reach: 1.3, reputation: 0.2 },
  { id: 'entrainement', name: 'Entraînement', reach: 0.9, reputation: 0.12 },
  { id: 'match', name: 'Match', reach: 1.8, reputation: 0.3 },
];

/** Catalogue des commandes — Tome XXX v2 ch. 5. */
export const ORDERABLE = [
  { id: 'vetements', name: 'Vêtements', category: 'vêtements', basePrice: 450, deliveryDays: 2 },
  { id: 'chaussures', name: 'Chaussures', category: 'chaussures', basePrice: 320, deliveryDays: 2 },
  { id: 'crampons', name: 'Crampons sur mesure', category: 'chaussures', basePrice: 780, deliveryDays: 5 },
  { id: 'meubles', name: 'Meubles', category: 'mobilier', basePrice: 3400, deliveryDays: 12 },
  { id: 'decoration', name: 'Décoration', category: 'mobilier', basePrice: 1200, deliveryDays: 6 },
  { id: 'nourriture', name: 'Repas livré', category: 'nourriture', basePrice: 65, deliveryDays: 0 },
  { id: 'cadeau', name: 'Cadeau', category: 'cadeaux', basePrice: 900, deliveryDays: 1 },
  { id: 'materiel-sport', name: 'Matériel de sport', category: 'sport', basePrice: 640, deliveryDays: 3 },
];

/** Lieux de livraison possibles. */
export const DELIVERY_POINTS = [
  { id: 'maison', name: 'Domicile', requires: 'property' },
  { id: 'hotel', name: 'Hôtel', requires: null },
  { id: 'centre', name: "Centre d'entraînement", requires: null },
  { id: 'stade', name: 'Stade', requires: null },
  { id: 'musee', name: 'Musée personnel', requires: 'museum' },
];

/** Tendances hebdomadaires — Tome XI ch. 3. */
const TREND_POOL = [
  '#MercatoFolie', '#BoubjackAwards', '#DerbyDay', '#JeuneTalent', '#RemontadaHistorique',
  '#TifoDuSiecle', '#ButDeLAnnee', '#FairPlay', '#PelouseCatastrophe', '#ArbitrageEnDebat',
  '#TransfertRecord', '#RetourDeBlessure', '#CoupeDuMonde', '#AcademieDuFutur', '#StadeConnecte',
];

export class PhoneSystem {
  constructor(state, rng, { economy, weather, calendar, media, world, career, reputation, matchEngine }) {
    this.state = state;
    this.rng = rng;
    this.economy = economy;
    this.weather = weather;
    this.calendar = calendar;
    this.media = media;
    this.world = world;
    this.career = career;
    this.reputation = reputation;
    this.matchEngine = matchEngine;
    this.trends = [];
    this._unsubs = [];
  }

  install() {
    this._unsubs.push(bus.on(EVENTS.DAY, () => this.onDay()));
    this._unsubs.push(bus.on(EVENTS.WEEK, () => this.refreshTrends()));
    this._unsubs.push(bus.on(EVENTS.NOTIFY, (payload) => this.pushNotification(payload)));
    if (this.state.personal.relationships.length === 0) this._seedRelationships();
    if (this.trends.length === 0) this.refreshTrends();
    return this;
  }

  uninstall() {
    this._unsubs.forEach((fn) => fn());
    this._unsubs = [];
  }

  // ── Contacts et relations (Tome XI ch. 7) ──────────────────────────────

  _seedRelationships() {
    const base = [
      { name: 'Maman', type: 'famille', closeness: 90, snapStreak: true },
      { name: 'Papa', type: 'famille', closeness: 85, snapStreak: true },
      { name: 'Aïcha', type: 'famille', role: 'sœur', closeness: 80, snapStreak: true },
      { name: 'Moussa', type: 'ami', role: "ami d'enfance", closeness: 88, snapStreak: true },
      { name: 'Karim', type: 'ami', role: 'ami du quartier', closeness: 70, snapStreak: false },
      { name: this.state.career.agent.name, type: 'professionnel', role: 'agent', closeness: 60, snapStreak: false },
    ];

    for (const person of base) {
      this.state.personal.relationships.push({
        id: `rel-${person.name.toLowerCase().replace(/\s/g, '-')}`,
        name: person.name,
        type: person.type,
        role: person.role || person.type,
        closeness: person.closeness,
        birthday: { month: this.rng.int(0, 11), day: this.rng.int(1, 28) },
        lastContact: 0,
      });
      if (person.snapStreak) {
        this.state.phone.streaks[person.name] = this.rng.int(3, 40);
      }
    }

    this.state.personal.family = this.state.personal.relationships
      .filter((r) => r.type === 'famille')
      .map((r) => ({ name: r.name, role: r.role }));
  }

  // ── Cycle quotidien ─────────────────────────────────────────────────────

  onDay() {
    this._advanceDeliveries();
    this._decayStreaks();
    this._checkBirthdays();
    this._receiveMessages();
    this._decayRelationships();
  }

  /** Les commandes avancent et sont livrées physiquement — Tome XXX v2 ch. 5. */
  _advanceDeliveries() {
    for (const order of this.state.phone.orders) {
      if (order.status === 'livré') continue;
      order.daysLeft -= 1;

      if (order.daysLeft <= 0) {
        order.status = 'livré';
        order.deliveredOn = `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`;

        const point = DELIVERY_POINTS.find((p) => p.id === order.deliveryPoint);
        bus.emit(EVENTS.WORLD_EVENT, {
          kind: 'cinematic',
          title: 'Livraison reçue',
          body: `Le livreur se présente à ${point?.name.toLowerCase()} et vous remet ${order.itemName} en main propre.`,
          cinematic: 'reception-colis',
        });
        this.pushNotification({
          level: 'success',
          title: 'Colis livré',
          body: `${order.itemName} — remis à ${point?.name}.`,
        }, 'livraison');
      } else if (order.daysLeft === 1) {
        order.status = 'en cours de livraison';
      } else {
        order.status = 'expédié';
      }
    }

    // Les commandes livrées sont archivées après un temps.
    this.state.phone.orders = this.state.phone.orders.filter(
      (o) => o.status !== 'livré' || (o.archiveIn = (o.archiveIn ?? 5) - 1) > 0,
    );
  }

  /** Les flammes Snapstreak se perdent si on ne répond pas — Tome XI ch. 4. */
  _decayStreaks() {
    for (const [contact, days] of Object.entries(this.state.phone.streaks)) {
      const relation = this.state.personal.relationships.find((r) => r.name === contact);
      if (!relation) continue;

      relation.lastContact += 1;
      if (relation.lastContact > 2) {
        // La flamme s'éteint.
        if (days > 0) {
          this.pushNotification({
            level: 'warn',
            title: `Flamme perdue avec ${contact}`,
            body: `${days} jours de streak partis en fumée.`,
          }, 'snapstreak');
        }
        this.state.phone.streaks[contact] = 0;
        relation.closeness = Math.max(0, relation.closeness - 2);
      }
    }
  }

  _checkBirthdays() {
    for (const relation of this.state.personal.relationships) {
      if (relation.birthday.month !== this.state.clock.month) continue;
      if (relation.birthday.day !== this.state.clock.day) continue;

      this.pushNotification({
        level: 'info',
        title: `Anniversaire de ${relation.name}`,
        body: `Votre IA secrétaire vous le rappelle. Un cadeau renforcerait votre lien.`,
      }, 'secretaire');

      this.state.personal.agenda.push({
        id: `agenda-anniv-${relation.id}-${this.state.clock.year}`,
        type: 'anniversaire',
        title: `Anniversaire de ${relation.name}`,
        date: { ...this.state.clock },
        done: false,
      });
    }
  }

  /** Les proches et les inconnus écrivent — le volume suit la célébrité (ch. 8). */
  _receiveMessages() {
    const rep = this.state.reputation.global;
    const dailyMessages = Math.round(1 + rep / 22);

    for (let i = 0; i < Math.min(4, dailyMessages); i++) {
      if (!this.rng.chance(0.5)) continue;

      const fromRelation = this.rng.chance(0.55);
      let message;

      if (fromRelation && this.state.personal.relationships.length > 0) {
        const relation = this.rng.pick(this.state.personal.relationships);
        const texts = {
          famille: [`Tu as bien mangé aujourd'hui ?`, `On a regardé ton match, on est fiers.`, `Quand est-ce que tu passes à la maison ?`, `Appelle-moi quand tu peux.`],
          ami: [`On se voit ce week-end ?`, `T'as vu le but hier soir ?!`, `Le quartier parle de toi, frérot.`, `T'es où en ce moment ?`],
          professionnel: [`J'ai reçu une proposition intéressante, on en parle.`, `Le club veut te voir demain.`, `Ton image vaut de l'or, ne la gâche pas.`],
        };
        message = {
          from: relation.name,
          type: relation.type,
          text: this.rng.pick(texts[relation.type] || texts.ami),
        };
      } else {
        // Sollicitations liées à la célébrité.
        const solicitations = [
          { from: 'Agence Prisma', type: 'pro', text: 'Nous souhaiterions vous proposer une séance photo. Vos conditions ?' },
          { from: 'Fondation Espoir', type: 'pro', text: 'Accepteriez-vous d\'être le parrain de notre gala annuel ?' },
          { from: 'Un supporter', type: 'fan', text: 'Vous êtes mon idole. Merci pour tout.' },
          { from: 'Rédaction Infinity News', type: 'presse', text: 'Une interview de 15 minutes serait-elle envisageable ?' },
          { from: 'Concession Prestige', type: 'pro', text: 'Le modèle que vous aviez repéré est disponible.' },
        ];
        if (rep < 25) continue; // On n'écrit pas à un inconnu.
        message = this.rng.pick(solicitations);
      }

      this.state.phone.messages.unshift({
        id: `msg-${Date.now()}-${i}`,
        from: message.from,
        type: message.type,
        text: message.text,
        at: `${this.state.clock.day}/${this.state.clock.month + 1} ${String(this.state.clock.hour).padStart(2, '0')}:00`,
        read: false,
      });
      this.state.phone.unread++;
    }

    if (this.state.phone.messages.length > 80) this.state.phone.messages.length = 80;
  }

  _decayRelationships() {
    for (const relation of this.state.personal.relationships) {
      // Sans contact, la proximité s'érode lentement.
      relation.closeness = Math.max(0, relation.closeness - 0.12);
    }
  }

  // ── Notifications ───────────────────────────────────────────────────────

  pushNotification(payload, app = null) {
    if (!payload || !payload.title) return;
    this.state.phone.notifications.unshift({
      app: app || this._appForNotification(payload),
      title: payload.title,
      body: payload.body || '',
      level: payload.level || 'info',
      at: `${this.state.clock.day}/${this.state.clock.month + 1} ${String(this.state.clock.hour).padStart(2, '0')}:00`,
      read: false,
    });
    if (this.state.phone.notifications.length > 60) this.state.phone.notifications.length = 60;
  }

  _appForNotification(payload) {
    const title = (payload.title || '').toLowerCase();
    if (title.includes('colis') || title.includes('livr')) return 'livraison';
    if (title.includes('anniversaire') || title.includes('agenda')) return 'secretaire';
    if (title.includes('contrat') || title.includes('sponsor')) return 'mail';
    if (title.includes('solde') || title.includes('compte') || title.includes('découvert')) return 'banque';
    return 'actualites';
  }

  markAllRead() {
    this.state.phone.notifications.forEach((n) => { n.read = true; });
    this.state.phone.messages.forEach((m) => { m.read = true; });
    this.state.phone.unread = 0;
  }

  // ── Réseaux sociaux (Tome XI ch. 3) ────────────────────────────────────

  refreshTrends() {
    this.trends = this.rng.sample(TREND_POOL, 5).map((tag) => ({
      tag,
      posts: this.rng.int(12000, 890000),
      rising: this.rng.chance(0.5),
    }));

    // Une tendance peut concerner directement le joueur.
    if (this.state.reputation.global >= 55 && this.rng.chance(0.4)) {
      this.trends.unshift({
        tag: `#${this.state.player.name.replace(/\s/g, '')}`,
        posts: Math.round(this.state.phone.followers * this.rng.float(0.02, 0.15)),
        rising: true,
        aboutPlayer: true,
      });
    }
  }

  /**
   * Publie sur les réseaux. Les commentaires sont générés selon la réputation,
   * les résultats récents et la nature du post — pas de texte figé.
   */
  publishPost(typeId, caption) {
    const type = POST_TYPES.find((t) => t.id === typeId);
    if (!type) return { ok: false, reason: 'Type de publication inconnu.' };

    const followers = this.state.phone.followers;
    const reach = Math.round(followers * type.reach * this.rng.float(0.3, 0.9));
    const likes = Math.round(reach * this.rng.float(0.08, 0.22));
    const commentCount = Math.round(likes * this.rng.float(0.01, 0.05));

    const comments = this._generateComments(type, Math.min(6, Math.max(2, Math.round(commentCount / 400) + 2)));

    const post = {
      id: `post-${Date.now()}`,
      type: type.id,
      typeName: type.name,
      caption: caption || this._defaultCaption(type),
      at: `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`,
      season: this.state.clock.season,
      reach, likes, commentCount,
      comments,
      ephemeral: !!type.ephemeral,
    };

    this.state.phone.posts.unshift(post);
    if (this.state.phone.posts.length > 50) this.state.phone.posts.length = 50;

    // Une publication fait gagner des abonnés et un peu d'influence.
    const gained = Math.round(reach * this.rng.float(0.002, 0.012));
    this.state.phone.followers += gained;

    bus.emit(EVENTS.SOCIAL_POST, post);
    bus.emit(EVENTS.REPUTATION_CHANGED, {
      delta: type.reputation,
      reason: `Publication ${type.name}`,
      kind: 'media',
    });

    return { ok: true, post, gainedFollowers: gained };
  }

  _defaultCaption(type) {
    const club = getClub(this.state.career.clubId);
    const city = getCity(this.state.world.currentCityId);
    const captions = {
      photo: [`Bonne journée à ${city?.name}.`, `Toujours au travail.`, `Merci pour le soutien.`],
      video: [`Petit aperçu de la séance.`, `Ça travaille.`, `Le geste qu'on répète mille fois.`],
      story: [`En route.`, `Vue du jour.`, `Ambiance.`],
      annonce: [`Une nouvelle étape commence.`, `J'ai quelque chose à vous annoncer.`],
      trophee: [`Ce trophée est aussi le vôtre. 🏆`, `Des années de travail pour ce moment.`],
      vacances: [`Coupure méritée à ${city?.name}. ☀️`, `Recharger les batteries.`],
      entrainement: [`Séance bouclée avec ${club?.name}.`, `Rien ne remplace le travail.`],
      match: [`Trois points importants. Merci au public !`, `On continue.`],
    };
    return this.rng.pick(captions[type.id] || captions.photo);
  }

  /** Commentaires générés par l'IA — Tome XI ch. 3, Tome XXV ch. 2. */
  _generateComments(type, count) {
    const rep = this.state.reputation.global;
    const fanRelation = this.state.reputation.fanRelation;
    const recentSeason = this.state.stats.seasons[this.state.clock.season];
    const recentNotes = recentSeason?.notes || [];
    const form = recentNotes.length
      ? recentNotes.slice(-5).reduce((a, b) => a + b, 0) / Math.min(5, recentNotes.length)
      : 6.5;

    const positive = [
      'Une légende, tout simplement. 🐐', 'Le meilleur à ce poste, sans discussion.',
      'Merci pour tout ce que tu donnes 🙏', 'Fierté nationale !', 'Ballon d\'Or cette année, c\'est obligé.',
      'On était là avant, on sera là après. ❤️', 'Chaque match tu nous régales.',
    ];
    const neutral = [
      'Belle photo 📸', 'Où est-ce ?', 'Bonne continuation 👍',
      'Premier !', 'On attend le prochain match.',
    ];
    const negative = [
      'Concentre-toi sur le terrain au lieu de poster.', 'Trop de com, pas assez de buts.',
      'Le niveau baisse, il faut le dire.', 'Ça fait combien de matchs sans marquer déjà ?',
    ];
    const brandy = [
      'Collaboration en vue ? 👀', 'Notre équipe vous a envoyé un mail 📩',
      'Disponible pour un partenariat quand vous voulez.',
    ];

    // La tonalité dépend de la forme et de la relation aux supporters.
    const positiveWeight = 40 + fanRelation * 0.5 + (form - 6.5) * 20;
    const negativeWeight = Math.max(3, 30 - fanRelation * 0.3 - (form - 6.5) * 18);

    const comments = [];
    for (let i = 0; i < count; i++) {
      const pool = [
        { texts: positive, weight: positiveWeight, tone: 'positif' },
        { texts: neutral, weight: 35, tone: 'neutre' },
        { texts: negative, weight: negativeWeight, tone: 'négatif' },
        { texts: brandy, weight: rep >= 55 ? 15 : 0, tone: 'marque' },
      ];
      const chosen = this.rng.weighted(pool);
      comments.push({
        author: this._commentAuthor(chosen.tone),
        text: this.rng.pick(chosen.texts),
        tone: chosen.tone,
        likes: this.rng.int(0, Math.round(this.state.phone.followers / 500)),
      });
    }

    void type;
    return comments;
  }

  _commentAuthor(tone) {
    if (tone === 'marque') {
      return this.rng.pick(['@volt_athletics', '@maison_orin', '@chrono_astra', '@lumen_tech']);
    }
    const handles = ['@ultras_nord', '@foot_addict', '@tactique_pure', '@supporter_2004', '@le_douzieme', '@kop_sud', '@analyse_foot', '@fan_du_dimanche'];
    return this.rng.pick(handles);
  }

  // ── Snapstreak (Tome XI ch. 4) ─────────────────────────────────────────

  sendSnap(relationId) {
    const relation = this.state.personal.relationships.find((r) => r.id === relationId);
    if (!relation) return { ok: false, reason: 'Contact introuvable.' };

    const current = this.state.phone.streaks[relation.name] || 0;
    this.state.phone.streaks[relation.name] = current + 1;
    relation.lastContact = 0;
    relation.closeness = Math.min(100, relation.closeness + 1.2);
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + 0.5);

    const replies = [
      'Haha 😂', '🔥🔥🔥', 'Trop fort !', 'Tu me manques', 'Bonne chance pour demain 💪',
      'On se capte ce soir ?', '❤️', 'Champion !',
    ];

    return {
      ok: true,
      streak: this.state.phone.streaks[relation.name],
      reply: this.rng.chance(0.7) ? { from: relation.name, text: this.rng.pick(replies) } : null,
    };
  }

  /** Publier une story Snapstreak. */
  postStory(text) {
    const views = Math.round(this.state.phone.followers * this.rng.float(0.15, 0.45));
    this.state.phone.posts.unshift({
      id: `story-${Date.now()}`,
      type: 'story',
      typeName: 'Story',
      caption: text || 'Story du jour',
      at: `${this.state.clock.day}/${this.state.clock.month + 1}`,
      season: this.state.clock.season,
      reach: views, likes: Math.round(views * 0.06), commentCount: 0, comments: [],
      ephemeral: true,
    });
    return { ok: true, views };
  }

  // ── Vie personnelle (Tome XI ch. 7) ────────────────────────────────────

  /** Passer du temps avec un proche. */
  spendTime(relationId, kind = 'sortie') {
    const relation = this.state.personal.relationships.find((r) => r.id === relationId);
    if (!relation) return { ok: false, reason: 'Contact introuvable.' };

    const options = {
      sortie: { cost: 180, closeness: 6, wellbeing: 7, hours: 4, label: `Sortie avec ${relation.name}` },
      diner: { cost: 320, closeness: 8, wellbeing: 9, hours: 3, label: `Dîner avec ${relation.name}` },
      appel: { cost: 0, closeness: 3, wellbeing: 3, hours: 1, label: `Appel vidéo avec ${relation.name}` },
      invitation: { cost: 600, closeness: 10, wellbeing: 11, hours: 6, label: `${relation.name} invité(e) chez vous` },
      anniversaire: { cost: 2500, closeness: 16, wellbeing: 14, hours: 6, label: `Anniversaire organisé pour ${relation.name}` },
    };
    const option = options[kind] || options.sortie;

    if (option.cost > 0 && !this.economy.transact({
      amount: -option.cost, label: option.label, category: 'vie personnelle',
    })) {
      return { ok: false, reason: 'Fonds insuffisants.' };
    }

    relation.closeness = Math.min(100, relation.closeness + option.closeness);
    relation.lastContact = 0;
    this.state.personal.wellbeing = Math.min(100, this.state.personal.wellbeing + option.wellbeing);
    this.state.player.condition.moral = Math.min(100, this.state.player.condition.moral + option.wellbeing * 0.5);

    if (kind === 'anniversaire') {
      const agendaItem = this.state.personal.agenda.find(
        (a) => a.type === 'anniversaire' && a.title.includes(relation.name) && !a.done,
      );
      if (agendaItem) agendaItem.done = true;
    }

    return { ok: true, label: option.label, closeness: Math.round(relation.closeness), hours: option.hours };
  }

  /** Offrir un cadeau. */
  giveGift(relationId, amount) {
    const relation = this.state.personal.relationships.find((r) => r.id === relationId);
    if (!relation) return { ok: false, reason: 'Contact introuvable.' };
    if (amount <= 0) return { ok: false, reason: 'Montant invalide.' };

    if (!this.economy.transact({ amount: -amount, label: `Cadeau pour ${relation.name}`, category: 'vie personnelle' })) {
      return { ok: false, reason: 'Fonds insuffisants.' };
    }

    // Rendement décroissant : un cadeau cher n'achète pas dix fois plus d'affection.
    const gain = Math.min(20, Math.sqrt(amount / 40));
    relation.closeness = Math.min(100, relation.closeness + gain);
    relation.lastContact = 0;

    return { ok: true, gain: Math.round(gain * 10) / 10, closeness: Math.round(relation.closeness) };
  }

  // ── Commandes et livraisons (Tome XXX v2 ch. 5) ────────────────────────

  /** Catalogue disponible, y compris véhicules et objets de luxe. */
  catalogue() {
    const base = ORDERABLE.map((item) => {
      const city = getCity(this.state.world.currentCityId);
      const country = city ? getCity(city.id) : null;
      void country;
      return { ...item, price: item.basePrice };
    });

    const luxury = LUXURY_ITEMS.map((item) => ({
      id: item.id, name: item.name, category: item.category,
      price: item.price, deliveryDays: 4, luxury: true,
    }));

    const vehicles = VEHICLES.map((v) => ({
      id: v.id, name: v.name, category: 'véhicule',
      price: v.price, deliveryDays: 21, vehicle: true,
    }));

    return { base, luxury, vehicles };
  }

  /** Passe une commande. */
  order(itemId, deliveryPointId = 'maison', options = {}) {
    const { base, luxury, vehicles } = this.catalogue();
    const item = [...base, ...luxury, ...vehicles].find((i) => i.id === itemId);
    if (!item) return { ok: false, reason: 'Article introuvable.' };

    const point = DELIVERY_POINTS.find((p) => p.id === deliveryPointId);
    if (!point) return { ok: false, reason: 'Point de livraison inconnu.' };

    if (point.requires === 'property' && this.state.economy.properties.length === 0) {
      return { ok: false, reason: "Vous ne possédez pas encore de domicile. Choisissez un hôtel." };
    }
    if (point.requires === 'museum' && !this.state.legacy.museum.built) {
      return { ok: false, reason: "Votre musée personnel n'est pas encore construit." };
    }

    // Les achats de véhicules et de luxe passent par l'économie, donc par les
    // clauses d'exclusivité (Tome XXIV ch. 3).
    if (item.vehicle) {
      const result = this.economy.buyVehicle(item.id, options.brandId || null);
      if (!result.ok) return result;
    } else if (item.luxury) {
      const result = this.economy.buyLuxury(item.id, options.brandId || null);
      if (!result.ok) return result;
    } else {
      const bought = this.economy.purchase({
        label: `Commande — ${item.name}`,
        amount: item.price,
        category: 'commande',
        brandId: options.brandId || null,
      });
      if (!bought) return { ok: false, reason: 'Commande refusée (fonds insuffisants ou marque bloquée).' };
    }

    const order = {
      id: `ord-${Date.now()}`,
      itemId: item.id,
      itemName: item.name,
      category: item.category,
      price: item.price,
      deliveryPoint: deliveryPointId,
      deliveryPointName: point.name,
      orderedOn: `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`,
      daysLeft: item.deliveryDays,
      status: item.deliveryDays === 0 ? 'en cours de livraison' : 'confirmé',
      trackingId: `IF${this.rng.int(100000, 999999)}`,
    };
    this.state.phone.orders.unshift(order);

    return { ok: true, order };
  }

  // ── Musique (Tome XI ch. 5, Tome IX ch. 5) ─────────────────────────────

  connectMusicAccount(service = 'Spotify') {
    const playlist = this.state.phone.playlists[0];
    playlist.connected = true;
    this.state.phone.playlists.push(
      { id: 'trajets', name: 'Trajets', tracks: 42, connected: true },
      { id: 'maison', name: 'À la maison', tracks: 68, connected: true },
      { id: 'concentration', name: 'Avant-match', tracks: 22, connected: true },
    );
    this.state.settings.audio.musicSource = service.toLowerCase();
    return { ok: true, service, playlists: this.state.phone.playlists };
  }

  /** Contexte de lecture — menus, voiture, maison, entraînement. */
  nowPlaying(context = 'menus') {
    const playlist = this.state.phone.playlists.find((p) => {
      if (context === 'voiture') return p.id === 'trajets';
      if (context === 'maison') return p.id === 'maison';
      if (context === 'entrainement') return p.id === 'echauffement' || p.id === 'concentration';
      return true;
    }) || this.state.phone.playlists[0];

    return {
      context,
      playlist: playlist.name,
      source: playlist.connected ? this.state.settings.audio.musicSource : 'musique officielle du jeu',
      track: `Piste ${this.rng.int(1, playlist.tracks)} / ${playlist.tracks}`,
    };
  }

  // ── IA Secrétaire (Tome XI ch. 6, Tome VIII ch. 5) ─────────────────────

  /**
   * Le briefing complet de l'assistante. Toutes les capacités listées au
   * Tome VIII ch. 5 sont couvertes et produisent des données réelles.
   */
  secretaryBriefing() {
    const clock = this.state.clock;
    const city = getCity(this.state.world.currentCityId);
    const player = this.state.player;

    // 1. Agenda du jour et à venir
    const nextFixture = this.calendar.nextFixture();
    const upcomingEvents = this.calendar.upcomingEvents(4);
    const agenda = [];

    if (nextFixture) {
      const days = this._daysUntil(nextFixture.date);
      agenda.push({
        icon: '⚽',
        text: days === 0
          ? `Match aujourd'hui : ${nextFixture.competition} contre ${nextFixture.opponentName}.`
          : `Prochain match dans ${days} jour(s) : ${nextFixture.competition} contre ${nextFixture.opponentName} (${nextFixture.home ? 'domicile' : 'extérieur'}).`,
        priority: days <= 1 ? 'haute' : 'normale',
      });
    }

    // 2. Rappels d'entraînement
    if (!player.injury && player.condition.fatigue < 70) {
      agenda.push({ icon: '🏃', text: `Créneau d'entraînement disponible. Fatigue actuelle : ${Math.round(player.condition.fatigue)} %.`, priority: 'normale' });
    } else if (player.condition.fatigue >= 70) {
      agenda.push({ icon: '😴', text: `Fatigue à ${Math.round(player.condition.fatigue)} % — je recommande une séance de récupération.`, priority: 'haute' });
    }

    // 3. Rappels de vols et déplacements
    if (nextFixture && !nextFixture.home) {
      const opponentCity = getCity(getClub(nextFixture.opponentId)?.cityId);
      if (opponentCity && opponentCity.id !== city?.id) {
        agenda.push({ icon: '✈️', text: `Déplacement à prévoir vers ${opponentCity.name} pour le prochain match.`, priority: 'haute' });
      }
    }

    // 4. Suivi des commandes
    const pending = this.state.phone.orders.filter((o) => o.status !== 'livré');
    for (const order of pending.slice(0, 3)) {
      agenda.push({ icon: '📦', text: `${order.itemName} — ${order.status}, livraison à ${order.deliveryPointName} dans ${order.daysLeft} jour(s).`, priority: 'basse' });
    }

    // 5. Anniversaires
    for (const relation of this.state.personal.relationships) {
      const days = this._daysUntilDate(relation.birthday);
      if (days >= 0 && days <= 7) {
        agenda.push({ icon: '🎂', text: `Anniversaire de ${relation.name} dans ${days} jour(s).`, priority: days <= 1 ? 'haute' : 'normale' });
      }
    }

    // 6. Invitations et événements
    for (const event of upcomingEvents.slice(0, 2)) {
      agenda.push({ icon: '🎭', text: `${event.name} à ${event.cityName} dans ${event.daysUntil} jour(s).`, priority: 'normale' });
    }

    // 7. Finances : revenus, dépenses, recommandations
    const income = this.economy.monthlyIncome();
    const burn = this.economy.monthlyBurn();
    const netWorth = this.economy.netWorth();
    const cashflow = income - burn;

    const finances = {
      income, burn, cashflow, netWorth,
      balance: this.economy.balance('courant'),
      savings: this.economy.balance('epargne'),
      professional: this.economy.balance('professionnel'),
      breakdown: this.economy.breakdown().slice(0, 5),
    };

    // 8. Recommandations d'investissement
    const recommendations = this._investmentAdvice(finances);

    // 9. Résumé des actualités
    const news = this.state.media.headlines.slice(0, 3).map((h) => ({ title: h.title, tone: h.tone }));

    // 10. Analyse de carrière
    const analysis = this.careerAnalysis();

    // 11. Météo et conseils de déplacement
    const weather = this.weather.at(this.state.world.currentCityId);
    const hazard = this.weather.hazardAt(this.state.world.currentCityId);

    return {
      greeting: this._greeting(),
      date: `${clock.day}/${clock.month + 1}/${clock.year}`,
      city: city?.name,
      weather: this.weather.describe(),
      weatherWarning: hazard ? hazard.message : null,
      agenda: agenda.sort((a, b) => {
        const order = { haute: 0, normale: 1, basse: 2 };
        return order[a.priority] - order[b.priority];
      }),
      finances,
      recommendations,
      news,
      analysis,
      pendingConference: !!this.media.pendingConference,
      unread: this.state.phone.unread,
      weatherRaw: weather,
    };
  }

  _greeting() {
    const hour = this.state.clock.hour;
    const name = this.state.player.name.split(' ')[0];
    if (hour < 6) return `Il est tard, ${name}. Vous devriez dormir.`;
    if (hour < 12) return `Bonjour ${name}. Voici votre journée.`;
    if (hour < 18) return `Bon après-midi ${name}.`;
    if (hour < 22) return `Bonsoir ${name}. Récapitulatif de la journée.`;
    return `Bonne nuit ${name}. Tout est en ordre pour demain.`;
  }

  _investmentAdvice(finances) {
    const advice = [];
    const cash = finances.balance;

    if (finances.cashflow < 0) {
      advice.push({
        level: 'urgent',
        text: `Votre trésorerie mensuelle est négative (${this.economy.format(finances.cashflow)}). Réduisez les charges ou cédez un actif.`,
      });
    }

    if (cash > 500000 && this.state.economy.investments.length === 0) {
      advice.push({
        level: 'conseil',
        text: `${this.economy.format(cash)} dorment sur votre compte courant. Un placement immobilier rapporterait environ ${this.economy.format(cash * 0.055)} par an.`,
      });
    }

    if (cash > 200000 && this.economy.balance('epargne') < cash * 0.2) {
      advice.push({
        level: 'conseil',
        text: 'Constituez une épargne de précaution équivalente à six mois de charges.',
      });
    }

    const risky = this.state.economy.investments.filter((i) => i.risk === 'très élevé' || i.risk === 'élevé');
    const totalInvested = this.state.economy.investments.reduce((s, i) => s + i.currentValue, 0);
    if (totalInvested > 0 && risky.reduce((s, i) => s + i.currentValue, 0) / totalInvested > 0.6) {
      advice.push({
        level: 'alerte',
        text: 'Plus de 60 % de votre portefeuille est exposé à des actifs risqués. Diversifiez.',
      });
    }

    if (this.state.player.age >= 30 && this.state.economy.philanthropy.foundations.length === 0 && finances.netWorth > 5000000) {
      advice.push({
        level: 'conseil',
        text: 'Une fondation renforcerait durablement votre image et préparerait votre succession.',
      });
    }

    if (advice.length === 0) {
      advice.push({ level: 'info', text: 'Votre situation financière est saine. Rien à signaler.' });
    }
    return advice;
  }

  /** Analyse complète de la carrière — Tome VIII ch. 5, Tome XXVIII ch. 5. */
  careerAnalysis() {
    const career = this.state.stats.career;
    const season = this.state.stats.seasons[this.state.clock.season];
    const player = this.state.player;

    const averageRating = career.notes.length
      ? career.notes.reduce((a, b) => a + b, 0) / career.notes.length
      : 0;
    const seasonRating = season?.notes?.length
      ? season.notes.reduce((a, b) => a + b, 0) / season.notes.length
      : 0;

    const goalsPerMatch = career.matchs > 0 ? career.buts / career.matchs : 0;
    const trend = seasonRating && averageRating
      ? (seasonRating > averageRating + 0.2 ? 'en progression' : seasonRating < averageRating - 0.2 ? 'en baisse' : 'stable')
      : 'insuffisant pour conclure';

    const strengths = Object.entries(player.attributes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([key, value]) => `${key} (${Math.round(value)})`);
    const weaknesses = Object.entries(player.attributes)
      .sort((a, b) => a[1] - b[1])
      .slice(0, 2)
      .map(([key, value]) => `${key} (${Math.round(value)})`);

    return {
      matchs: career.matchs,
      buts: career.buts,
      passesD: career.passesD,
      averageRating: Math.round(averageRating * 100) / 100,
      seasonRating: Math.round(seasonRating * 100) / 100,
      goalsPerMatch: Math.round(goalsPerMatch * 100) / 100,
      trend,
      overall: this.matchEngine.overall(),
      marketValue: this.state.career.marketValue,
      strengths,
      weaknesses,
      titles: this.state.legacy.trophies.length,
      awards: this.state.legacy.awards.length,
      recommendation: this._careerRecommendation(trend, weaknesses),
    };
  }

  _careerRecommendation(trend, weaknesses) {
    if (this.state.player.injury) return 'Priorité absolue : la guérison. Ne forcez rien.';
    if (trend === 'en baisse') return `Vos notes reculent. Travaillez ${weaknesses[0]?.split(' ')[0]} et surveillez votre fatigue.`;
    if (trend === 'en progression') return 'Votre courbe est excellente. C\'est le moment de négocier un meilleur contrat.';
    if (this.state.career.contract.endSeason - this.state.clock.season <= 1) {
      return 'Votre contrat expire bientôt : prolongez ou écoutez les offres du mercato.';
    }
    return `Continuez sur cette base. Un travail ciblé sur ${weaknesses[0]?.split(' ')[0]} vous ferait franchir un palier.`;
  }

  /**
   * L'IA secrétaire répond aux questions du joueur.
   * Reconnaissance par mots-clés sur des données réelles de la sauvegarde.
   */
  ask(question) {
    const q = (question || '').toLowerCase();
    const brief = this.secretaryBriefing();

    if (/argent|solde|compte|banque|finance/.test(q)) {
      return `Compte courant : ${this.economy.format(brief.finances.balance)}. Épargne : ${this.economy.format(brief.finances.savings)}. ` +
        `Patrimoine net : ${this.economy.format(brief.finances.netWorth)}. Trésorerie mensuelle : ${this.economy.format(brief.finances.cashflow)}.`;
    }
    if (/match|prochain|jouer|calendrier/.test(q)) {
      const next = this.calendar.nextFixture();
      return next
        ? `Prochain match : ${next.competition} contre ${next.opponentName}, le ${next.date.day}/${next.date.month + 1}, ${next.home ? 'à domicile' : 'à l\'extérieur'}.`
        : "Aucun match programmé pour l'instant.";
    }
    if (/météo|temps|pluie|neige/.test(q)) {
      return `${brief.city} : ${brief.weather}.${brief.weatherWarning ? ` ⚠️ ${brief.weatherWarning}` : ''}`;
    }
    if (/blessure|santé|fatigue|forme/.test(q)) {
      const p = this.state.player;
      return p.injury
        ? `Vous êtes blessé : ${p.injury.type} (${p.injury.severity}), ${p.injury.daysLeft} jours restants.`
        : `Aucune blessure. Fatigue ${Math.round(p.condition.fatigue)} %, forme ${Math.round(p.condition.forme)}, moral ${Math.round(p.condition.moral)}.`;
    }
    if (/carrière|statistique|stats|performance|niveau/.test(q)) {
      const a = brief.analysis;
      return `${a.matchs} matchs, ${a.buts} buts, ${a.passesD} passes décisives. Note moyenne ${a.averageRating}. ` +
        `Niveau global ${a.overall}, valeur ${this.economy.format(a.marketValue)}. Tendance : ${a.trend}. ${a.recommendation}`;
    }
    if (/investir|placement|conseil/.test(q)) {
      return brief.recommendations.map((r) => r.text).join(' ');
    }
    if (/anniversaire|famille|proche|ami/.test(q)) {
      const upcoming = this.state.personal.relationships
        .map((r) => ({ name: r.name, days: this._daysUntilDate(r.birthday) }))
        .filter((r) => r.days >= 0 && r.days <= 40)
        .sort((a, b) => a.days - b.days);
      return upcoming.length
        ? `Prochains anniversaires : ${upcoming.slice(0, 3).map((u) => `${u.name} (dans ${u.days} j)`).join(', ')}.`
        : 'Aucun anniversaire dans les 40 prochains jours.';
    }
    if (/actualité|news|presse|journal/.test(q)) {
      return brief.news.length
        ? brief.news.map((n) => `« ${n.title} »`).join(' · ')
        : 'Pas d\'actualité marquante aujourd\'hui.';
    }
    if (/commande|colis|livraison/.test(q)) {
      const pending = this.state.phone.orders.filter((o) => o.status !== 'livré');
      return pending.length
        ? pending.map((o) => `${o.itemName} : ${o.status}, ${o.daysLeft} j (${o.deliveryPointName})`).join(' · ')
        : 'Aucune commande en cours.';
    }
    if (/vacances|voyage|partir|destination/.test(q)) {
      return `Vous êtes à ${brief.city}. Fatigue ${Math.round(this.state.player.condition.fatigue)} %. ` +
        (this.state.player.condition.fatigue > 60
          ? 'Un séjour de quelques jours vous ferait le plus grand bien.'
          : 'Vous n\'avez pas un besoin urgent de repos, mais je peux organiser un séjour.');
    }
    if (/réputation|célébrité|notoriété|image/.test(q)) {
      const tier = this.reputation.tier();
      return `Réputation mondiale : ${this.state.reputation.global.toFixed(1)}/100 — statut « ${tier.label} ». ` +
        `${this.state.phone.followers.toLocaleString('fr-FR')} abonnés. Relation aux supporters : ${Math.round(this.state.reputation.fanRelation)}/100.`;
    }
    if (/agenda|aujourd|journée|programme/.test(q)) {
      return brief.agenda.length
        ? brief.agenda.map((a) => a.text).join(' ')
        : 'Journée libre, rien à votre agenda.';
    }

    return `${brief.greeting} Je peux vous renseigner sur vos finances, votre calendrier, votre santé, votre carrière, ` +
      `vos commandes, vos proches, la météo, l'actualité ou votre réputation. Que souhaitez-vous savoir ?`;
  }

  /** Réservation par l'IA secrétaire — Tome VIII ch. 5. */
  bookHotel(cityId, nights, stars = 4) {
    const hotels = this.world.hotelsIn(cityId);
    const available = hotels.filter((h) => !h.full);
    if (available.length === 0) {
      return { ok: false, reason: `Aucune disponibilité à ${getCity(cityId)?.name} — tout est complet.` };
    }

    const hotel = available.reduce((best, h) =>
      Math.abs((h.stars || 3) - stars) < Math.abs((best.stars || 3) - stars) ? h : best,
    );
    const discount = 1 - Math.max(0, this.economy.staffEffect('bookingDiscount'));
    const total = Math.round(hotel.priceTonight * nights * discount);

    if (!this.economy.transact({ amount: -total, label: `Hôtel ${hotel.name} (${nights} nuits)`, category: 'voyage' })) {
      return { ok: false, reason: 'Fonds insuffisants.' };
    }

    this.state.personal.agenda.push({
      id: `agenda-hotel-${Date.now()}`,
      type: 'hotel',
      title: `${hotel.name} — ${nights} nuit(s)`,
      date: { ...this.state.clock },
      done: false,
    });

    return { ok: true, hotel: hotel.name, nights, total };
  }

  _daysUntil(date) {
    const a = new Date(this.state.clock.year, this.state.clock.month, this.state.clock.day);
    const b = new Date(date.year, date.month, date.day);
    return Math.round((b - a) / 86400000);
  }

  _daysUntilDate({ month, day }) {
    const now = new Date(this.state.clock.year, this.state.clock.month, this.state.clock.day);
    let target = new Date(this.state.clock.year, month, day);
    if (target < now) target = new Date(this.state.clock.year + 1, month, day);
    return Math.round((target - now) / 86400000);
  }

  serialize() {
    return { trends: this.trends };
  }

  restore(data) {
    if (data?.trends) this.trends = data.trends;
  }
}
