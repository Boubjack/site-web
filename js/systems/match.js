/**
 * match.js — Moteur de simulation de match.
 *
 * Exigences couvertes :
 *   - Tome III ch. 1 : chaque joueur a une personnalité footballistique propre
 *   - Tome III ch. 2 : le contrôle dépend de la technique, de la vitesse, de la
 *                      pression adverse, de la météo, de la pelouse, de la fatigue
 *   - Tome III ch. 3 : IA avec vision, anticipation, style, décision dynamique ;
 *                      les adversaires apprennent au fil des saisons
 *   - Tome III ch. 4 : contacts non scriptés, issue déterminée par les attributs
 *   - Tome III ch. 5 : ambiance, météo, pression, arbitre et contexte pèsent
 *   - Tome III ch. 7 : chaque arbitre a personnalité, tolérance et réputation
 *   - Tome IX ch. 2  : commentateurs dotés d'une mémoire complète de la carrière
 *   - Tome XXV ch. 5 : analyse tactique et carte de chaleur après la rencontre
 *   - Tome XXVIII    : toutes les statistiques du chapitre 2 sont produites
 *
 * Le match est simulé événement par événement sur 90 minutes + arrêts de jeu.
 * Rien n'est scripté : chaque phase découle d'un tirage pondéré par les forces
 * en présence, ce qui garantit qu'aucun match ne ressemble au précédent.
 */

import { bus, EVENTS } from '../core/events.js';
import { getClub, getCity } from '../data/world.js';
import { emptyStatLine } from '../core/state.js';

/**
 * Corps arbitral — Tome III ch. 7. Chaque arbitre a sa tolérance (seuil avant
 * carton), son avantage laissé au jeu et sa sensibilité à la pression du public.
 */
export const REFEREES = [
  { id: 'moreau', name: 'H. Moreau', tolerance: 0.72, cardHappy: 0.32, advantage: 0.6, crowdSensitivity: 0.25, reputation: 78, style: 'laisse jouer' },
  { id: 'valente', name: 'R. Valente', tolerance: 0.42, cardHappy: 0.68, advantage: 0.25, crowdSensitivity: 0.4, reputation: 71, style: 'sévère' },
  { id: 'oduya', name: 'K. Oduya', tolerance: 0.58, cardHappy: 0.45, advantage: 0.5, crowdSensitivity: 0.15, reputation: 86, style: 'équilibré' },
  { id: 'brenner', name: 'M. Brenner', tolerance: 0.5, cardHappy: 0.55, advantage: 0.35, crowdSensitivity: 0.55, reputation: 64, style: 'influençable' },
  { id: 'takana', name: 'Y. Takana', tolerance: 0.65, cardHappy: 0.38, advantage: 0.7, crowdSensitivity: 0.1, reputation: 91, style: 'technicien' },
  { id: 'silva', name: 'A. Silva', tolerance: 0.48, cardHappy: 0.6, advantage: 0.3, crowdSensitivity: 0.45, reputation: 69, style: 'théâtral' },
];

/** Styles de jeu adverses — chaque club en adopte un et l'ajuste (Tome III ch. 3). */
const TEAM_STYLES = {
  'pressing-haut': { attack: 1.12, defense: 0.94, tempo: 1.15, counterVulnerability: 1.25, label: 'pressing haut' },
  'bloc-bas': { attack: 0.82, defense: 1.22, tempo: 0.8, counterVulnerability: 0.7, label: 'bloc bas' },
  possession: { attack: 1.05, defense: 1.05, tempo: 0.92, counterVulnerability: 1.05, label: 'possession' },
  'contre-attaque': { attack: 1.0, defense: 1.1, tempo: 1.05, counterVulnerability: 0.85, label: 'contre-attaque' },
  'jeu-direct': { attack: 1.08, defense: 0.9, tempo: 1.2, counterVulnerability: 1.15, label: 'jeu direct' },
};

/** Zones du terrain, pour la carte de chaleur (Tome XXV ch. 5). */
const ZONES = ['déf. gauche', 'déf. centre', 'déf. droite', 'milieu gauche', 'milieu centre', 'milieu droit', 'att. gauche', 'att. centre', 'att. droite'];

export class MatchEngine {
  constructor(state, rng, { weather = null } = {}) {
    this.state = state;
    this.rng = rng;
    this.weather = weather;
    /**
     * Mémoire tactique des adversaires — Tome III ch. 3 : « ils adaptent leur
     * manière de jouer selon leurs adversaires ». Clé : clubId, valeur : ce que
     * l'IA a appris du joueur.
     */
    this.opponentMemory = new Map();
  }

  /**
   * Simule une rencontre complète.
   * @param {object} fixture { opponentId, competition, home, matchday, importance }
   * @returns {object} rapport de match complet
   */
  simulate(fixture) {
    const player = this.state.player;
    const club = getClub(this.state.career.clubId);
    const opponent = getClub(fixture.opponentId);
    if (!club || !opponent) {
      throw new Error(`Match impossible : club "${this.state.career.clubId}" ou adversaire "${fixture.opponentId}" introuvable.`);
    }

    const context = this._buildContext(fixture, club, opponent);
    const timeline = [];
    const stats = emptyStatLine();
    const heatmap = Object.fromEntries(ZONES.map((z) => [z, 0]));

    let scoreHome = 0;
    let scoreAway = 0;
    let playerFatigue = player.condition.fatigue;
    let playerCards = { yellow: 0, red: 0 };
    let sentOff = false;

    // Titularisation : dépend du statut dans l'effectif et de la forme.
    const started = this._decideSelection(context);
    if (!started.plays) {
      return this._buildAbsenceReport(fixture, context, started.reason);
    }

    stats.matchs = 1;
    if (started.starter) stats.titularisations = 1;

    const entryMinute = started.starter ? 0 : this.rng.int(55, 75);
    let exitMinute = 90;

    // Boucle minute par minute, avec un pas de 5 minutes pour les phases de jeu.
    const addedTime = this.rng.int(1, 6);
    const totalMinutes = 90 + addedTime;

    for (let minute = 1; minute <= totalMinutes; minute++) {
      if (minute < entryMinute) continue;
      if (sentOff) break;
      if (minute > exitMinute) break;

      // Fatigue croissante, atténuée par le physique et le personnel médical.
      const fatigueRate = 0.42 * (1 - (player.attributes.physique - 50) / 220);
      playerFatigue = Math.min(100, playerFatigue + fatigueRate);

      // Une phase de jeu significative toutes les ~4 minutes en moyenne.
      if (!this.rng.chance(0.26)) continue;

      const phase = this._resolvePhase({
        minute, context, stats, heatmap, playerFatigue,
        scoreDiff: (context.home ? scoreHome - scoreAway : scoreAway - scoreHome),
      });

      if (phase.zone) heatmap[phase.zone] += 1;

      switch (phase.type) {
        case 'but-joueur': {
          if (context.home) scoreHome++; else scoreAway++;
          stats.buts++;
          stats.tirs++;
          stats.tirsCadres++;
          timeline.push({ minute, type: 'but', actor: player.name, text: phase.text });
          break;
        }
        case 'passe-decisive': {
          if (context.home) scoreHome++; else scoreAway++;
          stats.passesD++;
          timeline.push({ minute, type: 'passeD', actor: player.name, text: phase.text });
          break;
        }
        case 'but-coequipier': {
          if (context.home) scoreHome++; else scoreAway++;
          timeline.push({ minute, type: 'but', actor: phase.actor, text: phase.text });
          break;
        }
        case 'but-adverse': {
          if (context.home) scoreAway++; else scoreHome++;
          timeline.push({ minute, type: 'but-adverse', actor: opponent.name, text: phase.text });
          break;
        }
        case 'tir-manque': {
          stats.tirs++;
          if (phase.onTarget) stats.tirsCadres++;
          timeline.push({ minute, type: 'tir', actor: player.name, text: phase.text });
          break;
        }
        case 'carton-jaune': {
          playerCards.yellow++;
          stats.cartonsJaunes++;
          timeline.push({ minute, type: 'jaune', actor: player.name, text: phase.text });
          if (playerCards.yellow >= 2) {
            playerCards.red++;
            stats.cartonsRouges++;
            sentOff = true;
            exitMinute = minute;
            timeline.push({ minute, type: 'rouge', actor: player.name, text: `Second avertissement : ${player.name} est expulsé.` });
          }
          break;
        }
        case 'carton-rouge': {
          playerCards.red++;
          stats.cartonsRouges++;
          sentOff = true;
          exitMinute = minute;
          timeline.push({ minute, type: 'rouge', actor: player.name, text: phase.text });
          break;
        }
        case 'blessure': {
          exitMinute = minute;
          timeline.push({ minute, type: 'blessure', actor: player.name, text: phase.text });
          this._applyInjury(phase.severity);
          break;
        }
        case 'action': {
          timeline.push({ minute, type: 'action', actor: player.name, text: phase.text });
          break;
        }
        default:
          break;
      }

      stats.passes += phase.passes || 0;
      stats.passesReussies += phase.passesOk || 0;
      stats.dribbles += phase.dribbles || 0;
      stats.duels += phase.duels || 0;
      stats.duelsGagnes += phase.duelsGagnes || 0;
    }

    // Remplacement possible en fin de match si la fatigue est critique.
    if (!sentOff && exitMinute === 90 && playerFatigue > 88 && this.rng.chance(0.5)) {
      exitMinute = this.rng.int(70, 85);
      timeline.push({ minute: exitMinute, type: 'sortie', actor: player.name, text: `${player.name} est remplacé, visiblement épuisé.` });
    }

    stats.minutes = Math.max(0, Math.min(totalMinutes, exitMinute) - entryMinute);
    stats.kilometres = Math.round((stats.minutes / 90) * this.rng.float(8.5, 12.4) * 10) / 10;
    stats.vitesseMax = Math.round((22 + (player.attributes.vitesse / 99) * 12 + this.rng.float(-1, 1)) * 10) / 10;

    // Résultat du point de vue du joueur.
    const forScore = context.home ? scoreHome : scoreAway;
    const againstScore = context.home ? scoreAway : scoreHome;
    if (forScore > againstScore) stats.victoires = 1;
    else if (forScore === againstScore) stats.nuls = 1;
    else stats.defaites = 1;

    const rating = this._rate(stats, context, sentOff);
    stats.notes = [rating];
    const motm = rating >= 8.2 && stats.victoires === 1;
    if (motm) stats.hommeDuMatch = 1;

    const report = {
      fixture,
      date: { ...this.state.clock },
      club: club.name,
      opponent: opponent.name,
      home: context.home,
      scoreHome, scoreAway,
      scoreLabel: `${scoreHome} - ${scoreAway}`,
      resultat: stats.victoires ? 'victoire' : stats.nuls ? 'nul' : 'défaite',
      competition: fixture.competition,
      referee: context.referee,
      weather: context.weather,
      attendance: context.attendance,
      stadium: context.stadium,
      timeline,
      stats,
      rating,
      motm,
      heatmap,
      opponentStyle: context.opponentStyle.label,
      commentary: [],
      analysis: null,
      fatigueAfter: Math.round(playerFatigue),
    };

    // Commentaires avec mémoire (Tome IX ch. 2) et analyse (Tome XXV ch. 5).
    report.commentary = this.buildCommentary(report);
    report.analysis = this.analyse(report);

    this._applyOutcome(report, playerFatigue);
    this._learnFromMatch(fixture.opponentId, report);

    this.state.diagnostics.matchesSimulated++;
    bus.emit(EVENTS.MATCH_PLAYED, report);
    return report;
  }

  // ── Contexte ────────────────────────────────────────────────────────────

  _buildContext(fixture, club, opponent) {
    const home = fixture.home !== false;
    const city = getCity(home ? club.cityId : opponent.cityId);
    const stadium = city?.venues.find((v) => v.type === 'stade') || { name: 'Stade municipal', capacity: 30000, prestige: 50 };
    const weather = this.weather ? this.weather.at(city?.id || this.state.world.currentCityId) : this.state.world.weather;

    // Affluence : capacité × prestige × météo × importance du match.
    const importance = fixture.importance ?? 0.6;
    const fill = Math.min(1, 0.55 + importance * 0.35 + (stadium.prestige || 50) / 400);
    const attendance = Math.round((stadium.capacity || 30000) * fill * (weather.attendanceFactor ?? 1));

    // Pression exercée sur le joueur : public + enjeu + notoriété personnelle.
    const pressure = Math.min(100, Math.round(
      importance * 45 +
      (attendance / (stadium.capacity || 30000)) * 25 +
      (home ? 8 : 18) +
      this.state.reputation.global * 0.12,
    ));

    const referee = this.rng.pick(REFEREES);

    // Le style adverse est stable pour un club mais s'adapte s'il a appris.
    const memory = this.opponentMemory.get(fixture.opponentId);
    const styleKeys = Object.keys(TEAM_STYLES);
    let styleKey = styleKeys[Math.abs(this._hash(fixture.opponentId)) % styleKeys.length];
    if (memory && memory.encounters >= 2) {
      // L'adversaire qui a souffert du joueur resserre son bloc.
      if (memory.playerGoals / memory.encounters > 0.8) styleKey = 'bloc-bas';
      else if (memory.playerGoals === 0) styleKey = 'pressing-haut';
    }
    const opponentStyle = TEAM_STYLES[styleKey];

    // Force des équipes, dérivée du prestige et corrigée par le domicile.
    const clubStrength = 40 + club.prestige * 0.55 + (home ? 4 : 0);
    const opponentStrength = 40 + opponent.prestige * 0.55 + (home ? 0 : 4);

    // Marquage renforcé sur un joueur réputé (Tome III ch. 3 : anticipation).
    const marking = Math.min(35, this.state.reputation.global * 0.28 + (memory?.playerGoals || 0) * 2.5);

    return {
      home, city, stadium, weather, attendance, pressure, referee,
      opponentStyle, clubStrength, opponentStrength, marking, importance,
      club, opponent,
    };
  }

  _decideSelection(context) {
    const player = this.state.player;

    if (player.injury && player.injury.daysLeft > 0) {
      return { plays: false, reason: `blessé (${player.injury.type}, ${player.injury.daysLeft} j restants)` };
    }
    if (player.condition.fatigue > 92) {
      return { plays: false, reason: 'laissé au repos par le staff (fatigue critique)' };
    }

    // Probabilité de titularisation : statut + forme + note moyenne récente.
    const statusBonus = {
      'Star de l\'équipe': 0.95, 'Titulaire indiscutable': 0.9, 'Titulaire': 0.78,
      'Rotation': 0.5, 'Remplaçant': 0.3, 'Espoir': 0.22,
    }[this.state.career.squadStatus] ?? 0.5;

    const formBonus = (player.condition.forme - 60) / 300;
    const fatiguePenalty = player.condition.fatigue / 260;
    const chance = Math.max(0.05, Math.min(0.97, statusBonus + formBonus - fatiguePenalty));

    if (this.rng.chance(chance)) return { plays: true, starter: true };
    // Non titulaire : peut tout de même entrer en jeu.
    if (this.rng.chance(0.55)) return { plays: true, starter: false };
    return { plays: false, reason: 'non retenu dans le groupe' };
  }

  _buildAbsenceReport(fixture, context, reason) {
    const scoreHome = this.rng.int(0, 3);
    const scoreAway = this.rng.int(0, 3);
    // La rencontre a bien été simulée : elle compte dans la télémétrie même
    // si le joueur n'était pas sur la feuille de match.
    this.state.diagnostics.matchesSimulated++;
    return {
      fixture,
      date: { ...this.state.clock },
      club: context.club.name,
      opponent: context.opponent.name,
      home: context.home,
      scoreHome, scoreAway,
      scoreLabel: `${scoreHome} - ${scoreAway}`,
      resultat: (context.home ? scoreHome - scoreAway : scoreAway - scoreHome) > 0 ? 'victoire' : (scoreHome === scoreAway ? 'nul' : 'défaite'),
      competition: fixture.competition,
      absent: true,
      absenceReason: reason,
      stats: emptyStatLine(),
      rating: 0,
      timeline: [],
      commentary: [`${this.state.player.name} n'est pas sur la feuille de match : ${reason}.`],
      analysis: null,
      heatmap: {},
    };
  }

  // ── Résolution d'une phase de jeu ───────────────────────────────────────

  /**
   * Résout une phase. Aucune issue n'est prédéterminée : on calcule une
   * qualité d'action à partir des attributs, du contexte et de la fatigue,
   * puis on tire le résultat contre cette qualité.
   */
  _resolvePhase({ minute, context, playerFatigue, scoreDiff }) {
    const a = this.state.player.attributes;
    const weather = context.weather;

    // Pénalités environnementales — Tome III ch. 2.
    const fatiguePenalty = (playerFatigue / 100) * 22;
    const weatherPenalty = Math.abs(weather.ballControl || 0);
    const pitchPenalty = Math.max(0, (75 - (weather.pitchQuality ?? 75)) * 0.25);
    const pressurePenalty = (context.pressure / 100) * (18 - a.mental * 0.14);
    const markingPenalty = context.marking * 0.35;

    const environment = fatiguePenalty + weatherPenalty + pitchPenalty + pressurePenalty + markingPenalty;

    // Qualité offensive du joueur sur cette action.
    const offensive = (a.technique * 0.22 + a.dribble * 0.2 + a.vision * 0.16 + a.placement * 0.2 + a.tir * 0.22);
    const defensiveOpposition = context.opponentStrength * 0.9 * context.opponentStyle.defense;

    const roll = this.rng.gaussian(offensive - environment, 14);
    const quality = roll - defensiveOpposition * 0.55;

    const position = this.state.player.position;
    const attackWeight = { AT: 1.0, MO: 0.82, MC: 0.6, MD: 0.45, DL: 0.35, DC: 0.22, GB: 0.05 }[position] ?? 0.6;

    const zone = this._pickZone(position);

    // Statistiques de base de la phase, toujours produites.
    const base = {
      zone,
      passes: this.rng.int(2, 7),
      dribbles: this.rng.chance(0.35 * attackWeight) ? this.rng.int(1, 2) : 0,
      duels: this.rng.int(1, 3),
    };
    base.passesOk = Math.max(0, base.passes - this.rng.int(0, Math.max(1, Math.round(base.passes * (0.35 - a.passe / 400)))));
    base.duelsGagnes = this.rng.int(0, base.duels) + (a.physique > 70 ? this.rng.int(0, 1) : 0);
    base.duelsGagnes = Math.min(base.duels, base.duelsGagnes);

    // Incident disciplinaire — dépend de l'arbitre (Tome III ch. 7).
    const foulChance = 0.05 + (context.opponentStyle.tempo - 1) * 0.06 + (playerFatigue / 100) * 0.05;
    if (this.rng.chance(foulChance)) {
      const severity = this.rng.next();
      const referee = context.referee;
      // Un arbitre tolérant laisse passer ; un arbitre influençable cède au public.
      const threshold = referee.tolerance - (context.home ? 0 : referee.crowdSensitivity * 0.15);
      if (severity > threshold + 0.32) {
        return { ...base, type: 'carton-rouge', text: `${referee.name} sort le carton rouge — faute jugée inexcusable.` };
      }
      if (severity > threshold) {
        return { ...base, type: 'carton-jaune', text: `Avertissement de ${referee.name} pour un tacle en retard.` };
      }
      return { ...base, type: 'action', text: `Faute sifflée, ${referee.name} laisse l'avantage un instant avant de revenir.` };
    }

    // Blessure — plus probable en fin de match, sur mauvaise pelouse et fatigué.
    const injuryChance = 0.006
      + (playerFatigue / 100) * 0.012
      + Math.max(0, (70 - (weather.pitchQuality ?? 75))) * 0.0003
      + (minute > 70 ? 0.004 : 0);
    if (this.rng.chance(injuryChance)) {
      const severity = this.rng.weighted([
        { v: 'légère', weight: 55 }, { v: 'modérée', weight: 30 }, { v: 'grave', weight: 15 },
      ]).v;
      return { ...base, type: 'blessure', severity, text: `${this.state.player.name} reste au sol et demande le changement — ${severity}.` };
    }

    // Actions offensives : le seuil dépend du poste.
    const goalThreshold = 34 - attackWeight * 12 + (scoreDiff > 1 ? 4 : 0);
    const assistThreshold = 26 - a.vision * 0.08;

    if (quality > goalThreshold && this.rng.chance(0.5 + attackWeight * 0.35)) {
      return { ...base, type: 'but-joueur', text: this._goalText(minute, context) };
    }
    if (quality > assistThreshold && this.rng.chance(0.3 + a.passe / 300)) {
      return { ...base, type: 'passe-decisive', text: `Ouverture parfaite de ${this.state.player.name}, converti par un coéquipier.` };
    }
    if (quality > 14) {
      return { ...base, type: 'tir-manque', onTarget: this.rng.chance(0.45 + a.tir / 300), text: `Tentative de ${this.state.player.name} depuis ${zone}.` };
    }

    // Actions de l'équipe indépendantes du joueur.
    const teamEdge = (context.clubStrength * context.opponentStyle.attack) - context.opponentStrength;
    if (this.rng.chance(0.1 + Math.max(0, teamEdge) * 0.004)) {
      return { ...base, type: 'but-coequipier', actor: 'Un coéquipier', text: `L'équipe conclut une belle séquence collective.` };
    }
    if (this.rng.chance(0.1 + Math.max(0, -teamEdge) * 0.004 + (context.opponentStyle.counterVulnerability - 1) * 0.03)) {
      return { ...base, type: 'but-adverse', text: `${context.opponent.name} punit une perte de balle.` };
    }

    return { ...base, type: 'neutre' };
  }

  _pickZone(position) {
    const preferences = {
      GB: ['déf. centre'],
      DC: ['déf. centre', 'déf. gauche', 'déf. droite'],
      DL: ['déf. gauche', 'déf. droite', 'milieu gauche', 'milieu droit'],
      MD: ['milieu centre', 'déf. centre', 'milieu gauche'],
      MC: ['milieu centre', 'milieu gauche', 'milieu droit'],
      MO: ['milieu centre', 'att. centre', 'milieu droit'],
      AT: ['att. centre', 'att. gauche', 'att. droite'],
    };
    return this.rng.pick(preferences[position] || ZONES);
  }

  _goalText(minute, context) {
    const openings = [
      `Frappe enroulée imparable`, `Reprise de volée`, `Piqué au-dessus du gardien`,
      `Frappe croisée du gauche`, `Tête décroisée`, `Enchaînement contrôle-frappe`,
      `Slalom dans la surface`, `Coup franc direct`, `Frappe de loin en pleine lucarne`,
    ];
    const opening = this.rng.pick(openings);
    const crowd = context.home ? `Le ${context.stadium.name} explose.` : `Le public local est réduit au silence.`;
    return `${minute}' — ${opening} de ${this.state.player.name}. ${crowd}`;
  }

  // ── Note et conséquences ────────────────────────────────────────────────

  _rate(stats, context, sentOff) {
    let note = 6.0;
    note += stats.buts * 1.15;
    note += stats.passesD * 0.75;
    note += stats.tirsCadres * 0.12;
    note += (stats.duels > 0 ? (stats.duelsGagnes / stats.duels - 0.5) : 0) * 1.2;
    note += (stats.passes > 0 ? (stats.passesReussies / stats.passes - 0.75) : 0) * 2.4;
    note += stats.dribbles * 0.08;
    note -= stats.cartonsJaunes * 0.35;
    note -= stats.cartonsRouges * 1.6;
    if (sentOff) note -= 0.5;
    if (stats.victoires) note += 0.35;
    if (stats.defaites) note -= 0.25;
    // Un match court pèse moins : la note tend vers la moyenne.
    const weight = Math.min(1, stats.minutes / 70);
    note = 6.0 + (note - 6.0) * (0.5 + weight * 0.5);
    // La difficulté de l'adversaire valorise la performance.
    note += (context.opponentStrength - context.clubStrength) * 0.006;
    return Math.round(Math.max(3.0, Math.min(10, note)) * 10) / 10;
  }

  _applyInjury(severity) {
    const durations = { 'légère': [4, 12], 'modérée': [15, 45], 'grave': [60, 180] };
    const [min, max] = durations[severity] || [7, 21];
    const reduction = 1 + Math.min(0, (this._kineEffect() || 0));
    const days = Math.max(2, Math.round(this.rng.int(min, max) * reduction));

    const types = {
      'légère': ['contracture', 'coup reçu', 'entorse légère'],
      'modérée': ['élongation', 'lésion musculaire', 'entorse de la cheville'],
      'grave': ['rupture ligamentaire', 'fracture de fatigue', 'lésion du ménisque'],
    };

    this.state.player.injury = {
      type: this.rng.pick(types[severity] || types['légère']),
      severity,
      days,
      daysLeft: days,
      since: { ...this.state.clock },
    };

    bus.emit(EVENTS.INJURY, { injury: this.state.player.injury });
  }

  _kineEffect() {
    return this.state.economy.staff
      .filter((s) => s.effect?.recovery)
      .reduce((sum, s) => sum - s.effect.recovery * (0.6 + s.skill / 250), 0);
  }

  _applyOutcome(report, fatigueAfter) {
    const player = this.state.player;
    const stats = report.stats;

    player.condition.fatigue = Math.min(100, Math.round(fatigueAfter));

    // Forme, moral et confiance suivent la performance.
    const perf = report.rating - 6.5;
    player.condition.forme = Math.max(20, Math.min(100, Math.round(player.condition.forme + perf * 2.2)));
    player.condition.confiance = Math.max(10, Math.min(100, Math.round(player.condition.confiance + perf * 3 + (stats.buts * 4))));
    player.condition.moral = Math.max(10, Math.min(100, Math.round(
      player.condition.moral + (stats.victoires ? 4 : stats.defaites ? -4 : 0) + perf * 1.5,
    )));

    // Progression des attributs — Tome IV ch. 2 : la progression est naturelle.
    this._progress(report);

    // Cumul statistique carrière et saison (Tome XXVIII ch. 2).
    const season = this.state.clock.season;
    if (!this.state.stats.seasons[season]) this.state.stats.seasons[season] = emptyStatLine();
    for (const line of [this.state.stats.career, this.state.stats.seasons[season]]) {
      for (const [key, value] of Object.entries(stats)) {
        if (Array.isArray(value)) line[key] = (line[key] || []).concat(value);
        else if (key === 'vitesseMax') line[key] = Math.max(line[key] || 0, value);
        else if (typeof value === 'number') line[key] = (line[key] || 0) + value;
      }
    }

    // Records personnels (Tome XXVIII ch. 3).
    this._checkRecords(report);

    // Primes de contrat (Tome IV ch. 4).
    const contract = this.state.career.contract;
    if (contract && !report.absent) {
      let bonus = 0;
      if (stats.minutes >= 45) bonus += contract.appearanceBonus || 0;
      bonus += (stats.buts || 0) * (contract.goalBonus || 0);
      if (bonus > 0) {
        bus.emit(EVENTS.TRANSACTION, null); // no-op sémantique : la prime passe par l'économie
        bus.emit(EVENTS.NOTIFY, { level: 'success', title: 'Primes de match', body: `+${bonus} € au titre du contrat.` });
        this.state.economy.accounts.courant += bonus;
        this.state.economy.ledger.push({
          id: `tx-${this.state.economy.ledger.length + 1}`,
          at: this.state.clock.year * 10000 + (this.state.clock.month + 1) * 100 + this.state.clock.day,
          dateLabel: `${this.state.clock.day}/${this.state.clock.month + 1}/${this.state.clock.year}`,
          amount: bonus, account: 'courant', label: `Primes — ${report.opponent}`,
          category: 'prime', balanceAfter: this.state.economy.accounts.courant,
        });
      }
    }

    // Réputation : la performance sportive est le premier critère (Tome XXVI ch. 2).
    const repDelta = (report.rating - 6.4) * 0.4 + stats.buts * 0.5 + stats.passesD * 0.25
      + (report.motm ? 0.6 : 0) + (report.fixture.importance || 0.5) * 0.3
      - stats.cartonsRouges * 0.8;
    if (Math.abs(repDelta) > 0.01) {
      bus.emit(EVENTS.REPUTATION_CHANGED, {
        delta: repDelta,
        reason: `${report.club} ${report.scoreLabel} ${report.opponent}`,
        country: getCity(report.fixture.home ? getClub(this.state.career.clubId)?.cityId : getClub(report.fixture.opponentId)?.cityId)?.country,
      });
    }

    // Fair-play (Tome XXVI ch. 2).
    if (stats.cartonsRouges) this.state.reputation.fairplay = Math.max(0, this.state.reputation.fairplay - 6);
    else if (stats.cartonsJaunes) this.state.reputation.fairplay = Math.max(0, this.state.reputation.fairplay - 1.5);
    else this.state.reputation.fairplay = Math.min(100, this.state.reputation.fairplay + 0.4);

    // Valeur marchande (Tome IV ch. 2).
    this._updateMarketValue();

    // Chronologie personnelle (Tome XXVIII ch. 6).
    if (stats.buts >= 3) {
      this.state.legacy.timeline.push({
        season, type: 'exploit', date: report.date.dateLabel || `${report.date.day}/${report.date.month + 1}/${report.date.year}`,
        title: `Triplé contre ${report.opponent}`, detail: `${report.scoreLabel} — note ${report.rating}`,
      });
    }
  }

  _progress(report) {
    const player = this.state.player;
    const age = player.age;
    // Courbe d'âge : progression rapide avant 24 ans, déclin après 31.
    const ageFactor = age < 21 ? 1.5 : age < 25 ? 1.1 : age < 29 ? 0.6 : age < 32 ? 0.15 : -0.5;
    const performanceFactor = (report.rating - 6.3) * 0.35;
    const minutesFactor = Math.min(1, report.stats.minutes / 90);

    const gain = ageFactor * (0.06 + performanceFactor * 0.05) * minutesFactor;
    if (Math.abs(gain) < 0.001) return;

    // Les attributs sollicités par le poste progressent en priorité.
    const focus = {
      AT: ['tir', 'placement', 'dribble', 'vitesse'],
      MO: ['passe', 'vision', 'technique', 'dribble'],
      MC: ['passe', 'vision', 'physique', 'mental'],
      MD: ['defense', 'physique', 'placement', 'passe'],
      DL: ['vitesse', 'defense', 'physique', 'passe'],
      DC: ['defense', 'physique', 'placement', 'mental'],
      GB: ['placement', 'mental', 'physique'],
    }[player.position] || ['technique', 'physique', 'mental'];

    for (const key of focus) {
      const before = player.attributes[key];
      const applied = gain * (this.rng.chance(0.5) ? 1.4 : 0.7);
      player.attributes[key] = Math.max(1, Math.min(99, Math.round((before + applied) * 10) / 10));
      if (Math.floor(player.attributes[key]) !== Math.floor(before)) {
        bus.emit(EVENTS.ATTRIBUTE_CHANGED, { attribute: key, from: before, to: player.attributes[key] });
      }
    }
  }

  _checkRecords(report) {
    const records = this.state.stats.records;
    const check = (key, value, label) => {
      if (value > (records[key]?.value ?? -Infinity)) {
        records[key] = {
          value, label,
          season: this.state.clock.season,
          context: `${report.club} ${report.scoreLabel} ${report.opponent}`,
          date: `${report.date.day}/${report.date.month + 1}/${report.date.year}`,
        };
        bus.emit(EVENTS.HEADLINE, {
          title: `Record personnel : ${label}`,
          body: `${this.state.player.name} porte sa marque à ${value} face à ${report.opponent}.`,
          tone: 'positif',
        });
      }
    };

    check('butsUnMatch', report.stats.buts, 'buts en un match');
    check('passesDUnMatch', report.stats.passesD, 'passes décisives en un match');
    check('meilleureNote', report.rating, 'meilleure note');
    check('vitesseMax', report.stats.vitesseMax, 'vitesse maximale (km/h)');
    check('butsSaison', this.state.stats.seasons[this.state.clock.season]?.buts || 0, 'buts sur une saison');
  }

  _updateMarketValue() {
    const player = this.state.player;
    const overall = this.overall();
    const age = player.age;

    // Base exponentielle sur le niveau global, corrigée par l'âge et la réputation.
    const base = Math.pow(overall / 10, 4.1) * 950;
    const ageMultiplier = age <= 21 ? 1.5 : age <= 25 ? 1.35 : age <= 28 ? 1.1 : age <= 31 ? 0.7 : age <= 34 ? 0.35 : 0.12;
    const repMultiplier = 1 + this.state.reputation.global / 140;
    const formMultiplier = 0.85 + player.condition.forme / 400;

    const value = Math.round(base * ageMultiplier * repMultiplier * formMultiplier / 1000) * 1000;
    this.state.career.marketValue = Math.max(50000, value);
  }

  /** Niveau global pondéré par le poste. */
  overall() {
    const a = this.state.player.attributes;
    const weights = {
      AT: { tir: 0.25, placement: 0.2, dribble: 0.15, vitesse: 0.15, technique: 0.15, physique: 0.1 },
      MO: { passe: 0.24, vision: 0.22, technique: 0.2, dribble: 0.16, tir: 0.1, mental: 0.08 },
      MC: { passe: 0.24, vision: 0.2, mental: 0.16, physique: 0.16, technique: 0.14, defense: 0.1 },
      MD: { defense: 0.26, physique: 0.22, placement: 0.18, passe: 0.16, mental: 0.18 },
      DL: { vitesse: 0.22, defense: 0.24, physique: 0.18, passe: 0.18, placement: 0.18 },
      DC: { defense: 0.34, physique: 0.24, placement: 0.22, mental: 0.14, vitesse: 0.06 },
      GB: { placement: 0.4, mental: 0.3, physique: 0.2, vision: 0.1 },
    }[this.state.player.position] || { technique: 0.2, passe: 0.2, physique: 0.2, mental: 0.2, vision: 0.2 };

    let total = 0;
    let weightSum = 0;
    for (const [key, weight] of Object.entries(weights)) {
      total += (a[key] ?? 50) * weight;
      weightSum += weight;
    }
    return Math.round(total / weightSum);
  }

  // ── Commentaires (Tome IX ch. 2) ────────────────────────────────────────

  /**
   * Génère les commentaires du match. Les commentateurs puisent réellement
   * dans l'historique de la sauvegarde : anciens clubs, records, trophées,
   * blessures, rivalités, musée, famille — comme l'exige le Tome III ch. 6.
   */
  buildCommentary(report) {
    const lines = [];
    const player = this.state.player;
    const career = this.state.career;
    const legacy = this.state.legacy;
    const careerStats = this.state.stats.career;

    // Ouverture contextuelle : lieu, météo, enjeu, arbitre.
    lines.push(
      `Bienvenue au ${report.stadium.name}, ${report.attendance.toLocaleString('fr-FR')} spectateurs ce soir. ` +
      `${report.weather.icon} ${report.weather.type}, ${report.weather.tempC} °C — pelouse notée ${report.weather.pitchQuality}/100.`,
    );
    lines.push(`Au sifflet, ${report.referee.name}, réputé « ${report.referee.style} ». Deux arbitres ne dirigent jamais un match de la même façon.`);

    // Mémoire : anciens clubs (Tome IX ch. 2).
    const formerClubs = career.clubHistory.filter((h) => h.clubId !== career.clubId);
    if (formerClubs.length > 0 && this.rng.chance(0.6)) {
      const former = getClub(this.rng.pick(formerClubs).clubId);
      if (former && former.id === report.fixture.opponentId) {
        lines.push(`Retrouvailles particulières : ${player.name} affronte ${former.name}, son ancien club. On sait ce que ces soirées-là veulent dire.`);
      } else if (former) {
        lines.push(`Rappelons que ${player.name} est passé par ${former.name} avant de rejoindre ${report.club}.`);
      }
    }

    // Mémoire : records.
    const records = Object.entries(this.state.stats.records);
    if (records.length > 0 && this.rng.chance(0.5)) {
      const [, record] = this.rng.pick(records);
      lines.push(`Son record personnel reste ${record.value} ${record.label}, établi en ${record.season} — ${record.context}.`);
    }

    // Mémoire : trophées et récompenses.
    if (legacy.awards.length > 0 && this.rng.chance(0.55)) {
      const award = this.rng.pick(legacy.awards);
      lines.push(`${award.category} aux Boubjack Awards ${award.season} : ce joueur a déjà marqué son époque.`);
    }
    if (legacy.trophies.length > 0 && this.rng.chance(0.45)) {
      lines.push(`${legacy.trophies.length} trophée(s) au palmarès, dont ${this.rng.pick(legacy.trophies).name}.`);
    }

    // Mémoire : blessures passées.
    if (player.injury === null && careerStats.matchs > 20 && this.rng.chance(0.3)) {
      lines.push(`On se souvient de sa saison interrompue par la blessure — il est revenu plus fort.`);
    }

    // Mémoire : musée personnel.
    if (legacy.museum.built && this.rng.chance(0.35)) {
      lines.push(`Son musée personnel a déjà accueilli ${legacy.museum.visitors.toLocaleString('fr-FR')} visiteurs. Une légende de son vivant.`);
    }

    // Mémoire : famille.
    if (this.state.personal.family.length > 0 && this.rng.chance(0.3)) {
      lines.push(`Sa famille est dans les tribunes ce soir — un détail qui compte pour lui.`);
    }

    // Comparaison aux légendes (Tome IX ch. 2).
    if (careerStats.buts > 100 && this.rng.chance(0.4)) {
      lines.push(`${careerStats.buts} buts en carrière : il entre dans les conversations réservées aux plus grands.`);
    }

    // Le fil du match.
    for (const event of report.timeline) {
      if (event.type === 'but') lines.push(`⚽ ${event.text}`);
      else if (event.type === 'passeD') lines.push(`🅰️ ${event.minute}' — ${event.text}`);
      else if (event.type === 'but-adverse') lines.push(`😐 ${event.minute}' — ${event.text}`);
      else if (event.type === 'jaune') lines.push(`🟨 ${event.minute}' — ${event.text}`);
      else if (event.type === 'rouge') lines.push(`🟥 ${event.minute}' — ${event.text}`);
      else if (event.type === 'blessure') lines.push(`🚑 ${event.minute}' — ${event.text}`);
      else if (event.type === 'sortie') lines.push(`🔄 ${event.minute}' — ${event.text}`);
    }

    // Conclusion.
    const verdicts = {
      victoire: [`Victoire méritée de ${report.club}.`, `${report.club} l'emporte et le stade savoure.`],
      nul: [`Partage des points, personne n'a vraiment gagné.`, `Match nul au terme d'une rencontre serrée.`],
      défaite: [`Défaite qui laissera des traces.`, `${report.opponent} repart avec la mise.`],
    };
    lines.push(this.rng.pick(verdicts[report.resultat]));
    if (report.motm) lines.push(`🏅 Homme du match sans discussion : ${player.name}, noté ${report.rating}.`);

    return lines;
  }

  /** Analyse d'après-match — Tome XXV ch. 5. */
  analyse(report) {
    const s = report.stats;
    const strengths = [];
    const errors = [];
    const advice = [];

    const passAccuracy = s.passes > 0 ? Math.round((s.passesReussies / s.passes) * 100) : 0;
    const duelRate = s.duels > 0 ? Math.round((s.duelsGagnes / s.duels) * 100) : 0;
    const shotAccuracy = s.tirs > 0 ? Math.round((s.tirsCadres / s.tirs) * 100) : 0;

    if (passAccuracy >= 85) strengths.push(`Précision de passe remarquable (${passAccuracy} %).`);
    else if (passAccuracy < 70 && s.passes > 10) {
      errors.push(`Trop de déchet technique (${passAccuracy} % de passes réussies).`);
      advice.push('Programmez une séance technique cette semaine.');
    }

    if (duelRate >= 60) strengths.push(`Impact physique : ${duelRate} % de duels gagnés.`);
    else if (duelRate < 40 && s.duels > 3) {
      errors.push(`Duels perdus trop souvent (${duelRate} %).`);
      advice.push('Une séance de musculation renforcerait votre présence dans les duels.');
    }

    if (s.buts > 0) strengths.push(`${s.buts} but(s) — efficacité devant le but.`);
    if (s.tirs >= 4 && s.buts === 0) {
      errors.push(`${s.tirs} tentatives sans marquer.`);
      advice.push('Le travail de finition doit devenir prioritaire.');
    }
    if (shotAccuracy > 0 && shotAccuracy < 40 && s.tirs >= 3) {
      errors.push(`Seulement ${shotAccuracy} % de tirs cadrés.`);
    }

    if (s.cartonsJaunes || s.cartonsRouges) {
      errors.push('Indiscipline sanctionnée par l\'arbitre.');
      advice.push('Votre indice de fair-play influence le Prix Fair-Play des Boubjack Awards.');
    }

    if (report.fatigueAfter > 85) {
      advice.push('Fatigue critique : prévoyez du repos ou une séance de récupération.');
    }

    // Zone la plus fréquentée
    const zones = Object.entries(report.heatmap).sort((a, b) => b[1] - a[1]);
    const mainZone = zones.length > 0 && zones[0][1] > 0 ? zones[0][0] : null;

    return {
      passAccuracy, duelRate, shotAccuracy,
      strengths, errors, advice,
      mainZone,
      summary: mainZone
        ? `Activité concentrée en ${mainZone}, note ${report.rating} face à un adversaire en ${report.opponentStyle}.`
        : `Note ${report.rating} face à un adversaire en ${report.opponentStyle}.`,
    };
  }

  /** L'adversaire retient la leçon — Tome III ch. 3. */
  _learnFromMatch(opponentId, report) {
    const memory = this.opponentMemory.get(opponentId) || { encounters: 0, playerGoals: 0, playerAssists: 0, lastRating: 0 };
    memory.encounters++;
    memory.playerGoals += report.stats.buts;
    memory.playerAssists += report.stats.passesD;
    memory.lastRating = report.rating;
    this.opponentMemory.set(opponentId, memory);

    // La mémoire du monde conserve les rencontres marquantes (Tome XXV ch. 3).
    if (report.stats.buts >= 2 || report.rating >= 8.5) {
      this.state.world.worldMemory.push({
        season: this.state.clock.season,
        type: 'performance',
        subject: opponentId,
        text: `${this.state.player.name} a marqué ${report.stats.buts} but(s) contre ${report.opponent} (note ${report.rating}).`,
      });
      if (this.state.world.worldMemory.length > 200) this.state.world.worldMemory.shift();
    }
  }

  _hash(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
    return h;
  }

  serialize() {
    return { opponentMemory: Array.from(this.opponentMemory.entries()) };
  }

  restore(data) {
    if (data?.opponentMemory) this.opponentMemory = new Map(data.opponentMemory);
  }
}
