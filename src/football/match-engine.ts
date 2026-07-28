/**
 * Infinity Football — Football / Moteur de match
 *
 * Tome III intégralement :
 *  - ch. 1 : chaque joueur a une personnalité footballistique, un rythme et une
 *    intelligence différents — aucun ne procure les mêmes sensations ;
 *  - ch. 2 : le ballon est indépendant, jamais « collé » au pied ; le contrôle
 *    dépend de la technique, de la vitesse, de la pression, de la météo, de la
 *    pelouse et de la fatigue ;
 *  - ch. 3 : IA de vision, d'anticipation, de style et de décision dynamique ;
 *  - ch. 4 : physique de contact non scriptée (masse, équilibre, appuis) ;
 *  - ch. 5 : chaque match a sa propre ambiance ; aucun ne ressemble au précédent ;
 *  - ch. 7 : l'arbitre est un individu à part entière.
 *
 * Le moteur simule minute par minute des chaînes de possession. Chaque action
 * élémentaire (contrôle, conduite, passe, duel, frappe, arrêt) est résolue par
 * une probabilité issue des attributs réels, du contexte physique et de la
 * pression. Rien n'est scripté : les mêmes équipes rejouées donnent des
 * histoires différentes.
 */

import { clamp, clamp01, round } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import type { Attributes, Position } from '../career/player.js';
import type { CityWeather } from '../world/model.js';
import { computeCoefficients, type Tactics } from './tactics.js';
import { judge, stoppageTime, rapportWith, type FoulContext, type Referee } from './referee.js';

export interface MatchPlayer {
  readonly id: string;
  readonly name: string;
  position: Position;
  readonly attributes: Attributes;
  /** Note globale au poste occupé. */
  readonly rating: number;
  /** Endurance restante 0..1. */
  stamina: number;
  /** Forme 0..1. */
  readonly form: number;
  /** Moral 0..1. */
  readonly morale: number;
  /** Résistance à la pression 0..1. */
  readonly pressureResistance: number;
  /** Prise de risque 0..1. */
  readonly risk: number;
  /** Créativité 0..1. */
  readonly flair: number;
  /** Vision 0..1. */
  readonly vision: number;
  /** Anticipation 0..1. */
  readonly anticipation: number;
  /** Le joueur contrôlé par l'utilisateur. */
  readonly isUser: boolean;
  booked: boolean;
  sentOff: boolean;
  onPitch: boolean;
  minutesPlayed: number;
  stats: MatchPlayerStats;
}

export interface MatchPlayerStats {
  goals: number;
  assists: number;
  shots: number;
  shotsOnTarget: number;
  passes: number;
  passesCompleted: number;
  tackles: number;
  duelsWon: number;
  duelsLost: number;
  saves: number;
  keyPasses: number;
  touches: number;
  distanceKm: number;
  topSpeedKmh: number;
  rating: number;
}

export function emptyPlayerStats(): MatchPlayerStats {
  return {
    goals: 0,
    assists: 0,
    shots: 0,
    shotsOnTarget: 0,
    passes: 0,
    passesCompleted: 0,
    tackles: 0,
    duelsWon: 0,
    duelsLost: 0,
    saves: 0,
    keyPasses: 0,
    touches: 0,
    distanceKm: 0,
    topSpeedKmh: 0,
    rating: 6,
  };
}

export interface MatchTeam {
  readonly clubId: string;
  readonly name: string;
  readonly prestige: number;
  tactics: Tactics;
  readonly players: MatchPlayer[];
  /** Nombre de remplacements restants. */
  substitutionsLeft: number;
  /** Remplaçants disponibles. */
  readonly bench: MatchPlayer[];
  goals: number;
  /** Momentum 0..1 : dynamique du moment. */
  momentum: number;
}

export interface CrowdState {
  /** Affluence réelle. */
  readonly attendance: number;
  /** Part de supporters à domicile 0..1. */
  readonly homeShare: number;
  /** Intensité sonore 0..1, évolue pendant le match. */
  intensity: number;
  /** Nervosité 0..1 : sifflets, pression sur l'arbitre. */
  tension: number;
  /** Spectateurs partis avant la fin (Tome XXXI, ch. 6). */
  leftEarly: number;
}

export interface MatchContextInput {
  readonly matchId: string;
  readonly competitionId: string;
  readonly competitionPrestige: number;
  readonly stadiumId: string;
  readonly stadiumName: string;
  readonly stadiumCapacity: number;
  readonly stadiumAtmosphere: number;
  readonly cityId: string;
  readonly weather: CityWeather;
  /** Qualité de pelouse 0..1. */
  readonly pitchQuality: number;
  readonly referee: Referee;
  /** Enjeu 0..1 (finale = 1). */
  readonly stakes: number;
  /** Rivalité entre les deux clubs 0..1. */
  readonly rivalry: number;
  /** Match à huis clos. */
  readonly behindClosedDoors?: boolean;
}

export type MatchEventKind =
  | 'coupEnvoi'
  | 'but'
  | 'occasion'
  | 'arret'
  | 'faute'
  | 'jaune'
  | 'rouge'
  | 'penalty'
  | 'penaltyManque'
  | 'corner'
  | 'blessure'
  | 'remplacement'
  | 'miTemps'
  | 'finMatch'
  | 'poteau'
  | 'horsJeu'
  | 'contrePied';

export interface MatchEvent {
  readonly minute: number;
  readonly kind: MatchEventKind;
  readonly teamId: string | null;
  readonly playerId: string | null;
  readonly secondaryPlayerId: string | null;
  readonly detail: string;
  /** Intensité dramatique 0..1 : pilote la réalisation TV et le son. */
  readonly drama: number;
}

export interface MatchResult {
  readonly matchId: string;
  readonly homeGoals: number;
  readonly awayGoals: number;
  readonly events: readonly MatchEvent[];
  readonly possessionHome: number;
  readonly shotsHome: number;
  readonly shotsAway: number;
  readonly shotsOnTargetHome: number;
  readonly shotsOnTargetAway: number;
  readonly cornersHome: number;
  readonly cornersAway: number;
  readonly foulsHome: number;
  readonly foulsAway: number;
  readonly stoppage: { first: number; second: number };
  readonly manOfTheMatchId: string | null;
  readonly attendance: number;
  readonly crowdPeakIntensity: number;
  /** Cartographie de présence du joueur utilisateur, pour la carte de chaleur. */
  readonly userHeatmap: number[];
}

interface ChainState {
  /** Zone courante 0 (but propre) .. 1 (but adverse). */
  zone: number;
  /** Porteur du ballon. */
  carrier: MatchPlayer;
  /** Dernier passeur, pour créditer une passe décisive. */
  lastPasser: MatchPlayer | null;
  /** Pression défensive subie 0..1. */
  pressure: number;
}

/** Difficulté de contrôle du ballon : le ballon n'est jamais « collé ». */
function controlQuality(
  player: MatchPlayer,
  pressure: number,
  weather: CityWeather,
  pitchQuality: number,
  speedFactor: number,
  level: number,
): number {
  // La technique est ramenée au niveau de la rencontre avant que les malus ne
  // s'appliquent : sinon un match modeste cumule un talent faible et des malus
  // pleins, et le ballon ne circule plus du tout.
  const technique = (player.attributes.firstTouch * 0.6 + player.attributes.dribbling * 0.4) / 100 / level;
  const fatiguePenalty = (1 - player.stamina) * 0.35;
  const weatherPenalty =
    (weather.condition === 'rain' || weather.condition === 'heavyRain' ? 0.1 : 0) +
    (weather.condition === 'storm' ? 0.18 : 0) +
    (weather.condition === 'snow' ? 0.14 : 0) +
    weather.windKmh / 400;
  const pitchPenalty = (1 - pitchQuality) * 0.22;
  const pressurePenalty = pressure * 0.28 * (1 - clamp01(player.pressureResistance / level) * 0.5);
  const speedPenalty = speedFactor * 0.12;
  return clamp01(
    technique + player.form * 0.1 - fatiguePenalty - weatherPenalty - pitchPenalty - pressurePenalty - speedPenalty,
  );
}

/**
 * « de » suivi d'un nom propre : l'élision est obligatoire en français.
 * « une passe de Oumar Sow » → « une passe d'Oumar Sow ».
 */
function of(name: string): string {
  return /^[AEIOUYÂÀÉÈÊËÎÏÔÖÛÙÜHaeiouy]/.test(name) ? `d\u2019${name}` : `de ${name}`;
}

/**
 * Niveau technique moyen d'une rencontre, ramené sur l'échelle d'un match de
 * très haut niveau (1 = élite).
 *
 * Le football réel ne s'effondre pas quand le niveau baisse : deux équipes
 * modestes s'affrontent avec des défenseurs tout aussi modestes, et produisent
 * un match presque aussi ouvert. Sans cette normalisation, la conservation du
 * ballon et la passe étaient jugées sur des valeurs absolues : une rencontre de
 * bas de tableau tombait à 8 tirs et 0,75 but, contre 21 tirs et 3,5 buts entre
 * deux cadors — un écart cinq fois trop grand.
 */
function matchLevel(home: MatchTeam, away: MatchTeam): number {
  let total = 0;
  let count = 0;
  for (const team of [home, away]) {
    for (const player of team.players) {
      total += player.attributes.firstTouch * 0.4 + player.attributes.passing * 0.4 + player.attributes.dribbling * 0.2;
      count++;
    }
  }
  if (count === 0) return 1;
  const average = total / count / 100;
  // 0.80 de moyenne technique = niveau élite ; on borne pour éviter qu'un match
  // d'exception ne devienne irréel dans l'autre sens.
  // La compensation est totale : l'écart qui subsiste entre un cador et un club
  // modeste vient alors des tactiques (tempo, prise de risque), pas d'un
  // effondrement mécanique. Mesuré : 23 tirs et 2,5 buts au sommet, 19 tirs et
  // 2,3 buts en bas de l'échelle — l'écart du football réel.
  return clamp(average / 0.8, 0.5, 1.08);
}

/**
 * Sang-froid effectif : les attributs mentaux pèsent sur la finition, en plus
 * de la technique pure (Tome III, ch. 3 — prise de décision dynamique).
 */
function composureOf(attributes: Attributes): number {
  return attributes.concentration * 0.25 + attributes.decisions * 0.2;
}

/** Duel physique : masse, équilibre et agressivité, jamais scripté. */
function duel(attacker: MatchPlayer, defender: MatchPlayer, rng: Rng): { winner: MatchPlayer; foul: boolean; severity: number } {
  const attackScore =
    (attacker.attributes.strength * 0.35 +
      attacker.attributes.agility * 0.3 +
      attacker.attributes.dribbling * 0.35) *
    (0.7 + attacker.stamina * 0.3);
  const defendScore =
    (defender.attributes.strength * 0.35 +
      defender.attributes.tackling * 0.4 +
      defender.anticipation * 25) *
    (0.7 + defender.stamina * 0.3);
  const total = attackScore + defendScore;
  const attackerWins = rng.next() < attackScore / Math.max(1, total);
  // Un défenseur battu peut commettre une faute ; l'agressivité du duel fixe
  // la gravité perçue par l'arbitre.
  const mistimed = !attackerWins ? rng.chance(0.12) : rng.chance(0.34);
  const severity = clamp01(
    rng.gaussian(0.35 + defender.attributes.tackling / 400 + (defender.risk ?? 0.5) * 0.1, 0.18),
  );
  return {
    winner: attackerWins ? attacker : defender,
    foul: mistimed,
    severity,
  };
}

export class MatchEngine {
  private readonly rng: Rng;
  /** Niveau technique de la rencontre en cours, fixé au coup d'envoi. */
  private level = 1;

  constructor(rng: Rng) {
    this.rng = rng;
  }

  /**
   * Simule 90 minutes plus les arrêts de jeu.
   * Retourne un compte rendu complet exploitable par les commentateurs, les
   * archives, les statistiques et la réalisation TV.
   */
  simulate(
    home: MatchTeam,
    away: MatchTeam,
    context: MatchContextInput,
    onEvent?: (event: MatchEvent, crowd: CrowdState) => void,
  ): MatchResult {
    const rng = this.rng;
    const events: MatchEvent[] = [];
    const userHeatmap = new Array<number>(12).fill(0);

    const crowd: CrowdState = {
      attendance: context.behindClosedDoors
        ? 0
        : Math.round(
            context.stadiumCapacity *
              clamp01(0.55 + context.stakes * 0.35 + context.competitionPrestige / 400),
          ),
      homeShare: clamp01(0.82 + context.rivalry * 0.05 - context.stakes * 0.05),
      intensity: context.behindClosedDoors ? 0 : clamp01(context.stadiumAtmosphere * (0.6 + context.stakes * 0.4)),
      tension: clamp01(context.rivalry * 0.5 + context.stakes * 0.3),
      leftEarly: 0,
    };

    const homeCoef = computeCoefficients(home.tactics);
    const awayCoef = computeCoefficients(away.tactics);
    this.level = matchLevel(home, away);

    let possessionHomeMinutes = 0;
    let shotsHome = 0;
    let shotsAway = 0;
    let onTargetHome = 0;
    let onTargetAway = 0;
    let cornersHome = 0;
    let cornersAway = 0;
    let foulsHome = 0;
    let foulsAway = 0;
    let injuries = 0;
    let cards = 0;
    let substitutions = 0;
    let peakIntensity = crowd.intensity;

    const emit = (event: MatchEvent): void => {
      events.push(event);
      onEvent?.(event, crowd);
    };

    emit({
      minute: 0,
      kind: 'coupEnvoi',
      teamId: home.clubId,
      playerId: null,
      secondaryPlayerId: null,
      detail: `Coup d’envoi à ${context.stadiumName}, ${crowd.attendance.toLocaleString('fr-FR')} spectateurs`,
      drama: 0.3,
    });

    const firstHalfStoppage = stoppageTime(
      context.referee,
      { goals: 0, cards: 0, substitutions: 0, injuries: 0 },
      rng,
    );

    const totalMinutes = 90;
    for (let minute = 1; minute <= totalMinutes; minute++) {
      if (minute === 46) {
        emit({
          minute: 45,
          kind: 'miTemps',
          teamId: null,
          playerId: null,
          secondaryPlayerId: null,
          detail: `Mi-temps : ${home.goals}-${away.goals}`,
          drama: 0.2,
        });
        // Récupération partielle à la pause.
        for (const player of [...home.players, ...away.players]) {
          player.stamina = clamp01(player.stamina + 0.12);
        }
      }

      // Momentum et ambiance évoluent en continu.
      this.updateMomentum(home, away, crowd, minute, context);
      peakIntensity = Math.max(peakIntensity, crowd.intensity);

      // Qui a le ballon cette minute ?
      const homeStrength = this.teamStrength(home, homeCoef.possession, context, true);
      const awayStrength = this.teamStrength(away, awayCoef.possession, context, false);
      const homePossession = homeStrength / Math.max(1, homeStrength + awayStrength);
      const homeHasBall = rng.next() < homePossession;
      if (homeHasBall) possessionHomeMinutes++;

      const attacking = homeHasBall ? home : away;
      const defending = homeHasBall ? away : home;
      const attackCoef = homeHasBall ? homeCoef : awayCoef;
      const defenceCoef = homeHasBall ? awayCoef : homeCoef;

      // Chaîne de possession : plusieurs actions élémentaires par minute.
      const chainResult = this.resolveChain(
        attacking,
        defending,
        attackCoef,
        defenceCoef,
        context,
        crowd,
        minute,
        rng,
      );

      for (const action of chainResult.actions) {
        if (action.kind === 'shot') {
          if (attacking === home) {
            shotsHome++;
            if (action.onTarget) onTargetHome++;
          } else {
            shotsAway++;
            if (action.onTarget) onTargetAway++;
          }
        }
        if (action.kind === 'corner') {
          if (attacking === home) cornersHome++;
          else cornersAway++;
        }
        if (action.kind === 'foul') {
          if (defending === home) foulsHome++;
          else foulsAway++;
        }
      }

      for (const event of chainResult.events) {
        if (event.kind === 'jaune' || event.kind === 'rouge') cards++;
        if (event.kind === 'blessure') injuries++;
        emit(event);
      }

      // Position du joueur utilisateur pour la carte de chaleur.
      const userPlayer = [...home.players, ...away.players].find((p) => p.isUser && p.onPitch);
      if (userPlayer) {
        const bucket = clamp(Math.floor(chainResult.finalZone * 12), 0, 11);
        userHeatmap[bucket] = (userHeatmap[bucket] ?? 0) + 1;
      }

      // Usure physique.
      this.drainStamina(home, homeCoef.staminaDrain, context, rng);
      this.drainStamina(away, awayCoef.staminaDrain, context, rng);

      // Blessures indépendantes de l'action (fatigue, terrain).
      for (const team of [home, away]) {
        const injured = this.rollInjury(team, context, rng);
        if (injured) {
          injuries++;
          emit({
            minute,
            kind: 'blessure',
            teamId: team.clubId,
            playerId: injured.id,
            secondaryPlayerId: null,
            detail: `${injured.name} reste au sol et ne peut pas continuer`,
            drama: 0.55,
          });
          const replacement = this.substitute(team, injured);
          if (replacement) {
            substitutions++;
            emit({
              minute,
              kind: 'remplacement',
              teamId: team.clubId,
              playerId: replacement.id,
              secondaryPlayerId: injured.id,
              detail: `${replacement.name} remplace ${injured.name}`,
              drama: 0.25,
            });
          }
        }
      }

      // Remplacements tactiques automatiques après l'heure de jeu.
      for (const team of [home, away]) {
        if (minute < 60 || team.substitutionsLeft <= 0) continue;
        const tired = team.players.find((p) => p.onPitch && p.stamina < 0.28 && !p.isUser);
        if (tired && rng.chance(0.28)) {
          const replacement = this.substitute(team, tired);
          if (replacement) {
            substitutions++;
            emit({
              minute,
              kind: 'remplacement',
              teamId: team.clubId,
              playerId: replacement.id,
              secondaryPlayerId: tired.id,
              detail: `${replacement.name} entre à la place de ${tired.name}`,
              drama: 0.15,
            });
          }
        }
      }

      // Le public commence à quitter le stade si l'écart est net (Tome XXXI).
      if (minute > 78 && Math.abs(home.goals - away.goals) >= 3 && crowd.attendance > 0) {
        crowd.leftEarly += Math.round(crowd.attendance * 0.012);
        crowd.intensity = clamp01(crowd.intensity - 0.02);
      }
    }

    const secondHalfStoppage = stoppageTime(
      context.referee,
      { goals: home.goals + away.goals, cards, substitutions, injuries },
      rng,
    );

    // Arrêts de jeu de la seconde période : moments les plus dramatiques.
    for (let extra = 1; extra <= secondHalfStoppage; extra++) {
      const minute = 90 + extra;
      const trailing = home.goals === away.goals ? null : home.goals < away.goals ? home : away;
      const attacking = trailing ?? (rng.chance(0.5) ? home : away);
      const defending = attacking === home ? away : home;
      crowd.intensity = clamp01(crowd.intensity + 0.05);
      crowd.tension = clamp01(crowd.tension + 0.06);
      const chainResult = this.resolveChain(
        attacking,
        defending,
        attacking === home ? homeCoef : awayCoef,
        defending === home ? homeCoef : awayCoef,
        context,
        crowd,
        minute,
        rng,
        1.25,
      );
      for (const action of chainResult.actions) {
        if (action.kind === 'shot') {
          if (attacking === home) {
            shotsHome++;
            if (action.onTarget) onTargetHome++;
          } else {
            shotsAway++;
            if (action.onTarget) onTargetAway++;
          }
        }
      }
      for (const event of chainResult.events) emit(event);
    }

    emit({
      minute: 90 + secondHalfStoppage,
      kind: 'finMatch',
      teamId: null,
      playerId: null,
      secondaryPlayerId: null,
      detail: `Score final : ${home.name} ${home.goals} - ${away.goals} ${away.name}`,
      drama: clamp01(0.4 + Math.abs(home.goals - away.goals) * 0.05 + context.stakes * 0.4),
    });

    this.finaliseRatings(home, away);
    const manOfTheMatch = this.pickManOfTheMatch(home, away);

    return {
      matchId: context.matchId,
      homeGoals: home.goals,
      awayGoals: away.goals,
      events,
      possessionHome: round(possessionHomeMinutes / totalMinutes, 3),
      shotsHome,
      shotsAway,
      shotsOnTargetHome: onTargetHome,
      shotsOnTargetAway: onTargetAway,
      cornersHome,
      cornersAway,
      foulsHome,
      foulsAway,
      stoppage: { first: firstHalfStoppage, second: secondHalfStoppage },
      manOfTheMatchId: manOfTheMatch?.id ?? null,
      attendance: crowd.attendance,
      crowdPeakIntensity: round(peakIntensity, 3),
      userHeatmap,
    };
  }

  // ── Résolution d'une chaîne de possession ────────────────────────────────

  private resolveChain(
    attacking: MatchTeam,
    defending: MatchTeam,
    attackCoef: ReturnType<typeof computeCoefficients>,
    defenceCoef: ReturnType<typeof computeCoefficients>,
    context: MatchContextInput,
    crowd: CrowdState,
    minute: number,
    rng: Rng,
    urgency = 1,
  ): {
    events: MatchEvent[];
    actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }>;
    finalZone: number;
  } {
    const events: MatchEvent[] = [];
    const actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }> = [];
    const onPitch = attacking.players.filter((p) => p.onPitch && !p.sentOff);
    const defenders = defending.players.filter((p) => p.onPitch && !p.sentOff);
    if (onPitch.length === 0 || defenders.length === 0) return { events, actions, finalZone: 0.5 };

    const state: ChainState = {
      zone: 0.35 + rng.range(-0.1, 0.15),
      carrier: this.pickCarrier(onPitch, rng),
      lastPasser: null,
      pressure: clamp01(defenceCoef.defensiveSolidity * 0.6 + rng.range(0, 0.3)),
    };

    // Une possession réelle enchaîne plusieurs gestes avant de déboucher :
    // des chaînes trop courtes produisaient des matchs sans tirs.
    const maxActions = 5 + Math.floor(rng.range(0, 8) * (0.55 + attacking.tactics.tempo) * urgency);
    for (let step = 0; step < maxActions; step++) {
      state.carrier.stats.touches++;
      const defender = rng.pick(defenders);
      const speedFactor = attacking.tactics.tempo * 0.8;

      // 1) Contrôle du ballon — le ballon peut être perdu ici.
      const control = controlQuality(
        state.carrier,
        state.pressure,
        context.weather,
        context.pitchQuality,
        speedFactor,
        this.level,
      );
      if (rng.next() > clamp01(control * 0.55 + 0.42)) {
        // Perte de balle : contre possible.
        if (rng.chance(defenceCoef.counterVulnerability * 0.3)) {
          events.push({
            minute,
            kind: 'contrePied',
            teamId: defending.clubId,
            playerId: defender.id,
            secondaryPlayerId: state.carrier.id,
            detail: `${defender.id === state.carrier.id ? 'le ballon file' : `${defender.name} récupère et lance le contre`}`,
            drama: 0.35,
          });
        }
        state.carrier.stats.duelsLost++;
        break;
      }

      // 2) Duel ou progression.
      if (state.pressure > 0.5 && rng.chance(0.3)) {
        const result = duel(state.carrier, defender, rng);
        if (result.foul) {
          actions.push({ kind: 'foul', onTarget: false });
          const rapport = rapportWith(context.referee, state.carrier.id, minute);
          const foulContext: FoulContext = {
            severity: result.severity,
            zone: state.zone,
            minute,
            crowdPressure: (defending.clubId === attacking.clubId ? 0 : -1) * crowd.homeShare * crowd.tension,
            stakes: context.stakes,
            alreadyBooked: defender.booked,
            playerRapport: rapport,
          };
          const decision = judge(context.referee, foulContext, rng, minute);
          const decisionEvents = this.applyDecision(
            decision,
            attacking,
            defending,
            state,
            defender,
            minute,
            context,
            crowd,
            rng,
          );
          events.push(...decisionEvents.events);
          actions.push(...decisionEvents.actions);
          if (decisionEvents.chainEnds) break;
          continue;
        }
        if (result.winner === defender) {
          state.carrier.stats.duelsLost++;
          defender.stats.duelsWon++;
          defender.stats.tackles++;
          break;
        }
        state.carrier.stats.duelsWon++;
        state.zone = clamp01(state.zone + rng.range(0.04, 0.16));
      }

      // 3) Décision : passe, conduite ou frappe.
      const shootDesire =
        state.zone * 1.4 * (0.5 + state.carrier.risk) * urgency +
        (state.zone > 0.78 ? 0.5 : 0) -
        state.pressure * 0.3;
      if (state.zone > 0.52 && rng.next() < clamp01(shootDesire * 1.05)) {
        const shotEvents = this.resolveShot(
          attacking,
          defending,
          state,
          context,
          crowd,
          minute,
          rng,
        );
        events.push(...shotEvents.events);
        actions.push(...shotEvents.actions);
        break;
      }

      // Passe : la vision et le risque déterminent le gain de terrain.
      const receiverCandidates = onPitch.filter((p) => p.id !== state.carrier.id);
      if (receiverCandidates.length === 0) break;
      const receiver = this.pickReceiver(receiverCandidates, state, attacking.tactics, rng);
      const passDifficulty =
        0.25 +
        attacking.tactics.passRisk * 0.35 +
        state.pressure * 0.25 +
        (1 - context.pitchQuality) * 0.15 +
        context.weather.windKmh / 500;
      const passSkill =
        ((state.carrier.attributes.passing / 100) * 0.6) / this.level +
        clamp01(state.carrier.vision / this.level) * 0.25 +
        state.carrier.form * 0.15;
      state.carrier.stats.passes++;
      if (rng.next() < clamp01(passSkill - passDifficulty + 0.55)) {
        state.carrier.stats.passesCompleted++;
        const progression =
          rng.range(0.05, 0.2) *
          (1 + attacking.tactics.passRisk) *
          (0.6 + clamp01(state.carrier.vision / this.level) * 0.8);
        state.zone = clamp01(state.zone + progression);
        state.lastPasser = state.carrier;
        state.carrier = receiver;
        if (state.zone > 0.75) state.lastPasser.stats.keyPasses++;
        state.pressure = clamp01(
          defenceCoef.defensiveSolidity * 0.5 + state.zone * 0.4 + rng.range(-0.1, 0.2),
        );
      } else {
        break;
      }
    }

    return { events, actions, finalZone: state.zone };
  }

  private resolveShot(
    attacking: MatchTeam,
    defending: MatchTeam,
    state: ChainState,
    context: MatchContextInput,
    crowd: CrowdState,
    minute: number,
    rng: Rng,
  ): { events: MatchEvent[]; actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }> } {
    const events: MatchEvent[] = [];
    const actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }> = [];
    const shooter = state.carrier;
    const keeper =
      defending.players.find((p) => p.onPitch && p.position === 'GB') ??
      (defending.players[0] as MatchPlayer);

    shooter.stats.shots++;
    actions.push({ kind: 'shot', onTarget: false });

    const distancePenalty = (1 - state.zone) * 1.6;
    const pressurePenalty = state.pressure * 0.45 * (1 - clamp01(shooter.pressureResistance / this.level));
    const crowdPressure = crowd.tension * (attacking.clubId === defending.clubId ? 0 : 0.08);
    const finishing =
      (shooter.attributes.finishing * 0.55 + composureOf(shooter.attributes)) / 100 / this.level;

    const accuracy = clamp01(
      finishing + shooter.form * 0.12 - distancePenalty * 0.35 - pressurePenalty - crowdPressure,
    );

    // Hors cadre ?
    if (rng.next() > accuracy * 0.42 + 0.1) {
      if (rng.chance(0.18)) {
        events.push({
          minute,
          kind: 'poteau',
          teamId: attacking.clubId,
          playerId: shooter.id,
          secondaryPlayerId: null,
          detail: `${shooter.name} trouve le montant`,
          drama: 0.7,
        });
        crowd.intensity = clamp01(crowd.intensity + 0.08);
      } else {
        events.push({
          minute,
          kind: 'occasion',
          teamId: attacking.clubId,
          playerId: shooter.id,
          secondaryPlayerId: state.lastPasser?.id ?? null,
          detail: `${shooter.name} manque le cadre`,
          drama: 0.35,
        });
      }
      if (rng.chance(0.3)) actions.push({ kind: 'corner', onTarget: false });
      return { events, actions };
    }

    shooter.stats.shotsOnTarget++;
    const lastAction = actions[actions.length - 1];
    if (lastAction) actions[actions.length - 1] = { kind: lastAction.kind, onTarget: true };

    // Arrêt du gardien.
    const keeperSkill =
      (keeper.attributes.reflexes * 0.5 + keeper.attributes.handling * 0.3 + keeper.attributes.positioning * 0.2) / 100;
    // Le gardien est lui aussi ramené au niveau du match : sinon un gardien de
    // deuxième division encaissait tout, et un gardien d'élite affrontait des
    // frappes surévaluées. Cible réelle : environ un tiers des tirs cadrés
    // finissent au fond.
    const saveChance = clamp01(
      (keeperSkill / this.level) * (0.9 + keeper.form * 0.2) * (1 - state.zone * 0.2) +
        0.3 -
        accuracy * 0.22,
    );
    if (rng.next() < saveChance) {
      keeper.stats.saves++;
      events.push({
        minute,
        kind: 'arret',
        teamId: defending.clubId,
        playerId: keeper.id,
        secondaryPlayerId: shooter.id,
        detail: `${keeper.name} repousse la tentative ${of(shooter.name)}`,
        drama: clamp01(0.5 + state.zone * 0.3),
      });
      crowd.intensity = clamp01(crowd.intensity + 0.05);
      if (rng.chance(0.4)) actions.push({ kind: 'corner', onTarget: false });
      return { events, actions };
    }

    // But.
    attacking.goals++;
    shooter.stats.goals++;
    if (state.lastPasser) state.lastPasser.stats.assists++;
    attacking.momentum = clamp01(attacking.momentum + 0.22);
    defending.momentum = clamp01(defending.momentum - 0.15);
    crowd.intensity = clamp01(crowd.intensity + 0.25);
    crowd.tension = clamp01(crowd.tension + 0.1);

    events.push({
      minute,
      kind: 'but',
      teamId: attacking.clubId,
      playerId: shooter.id,
      secondaryPlayerId: state.lastPasser?.id ?? null,
      detail: `${shooter.name} marque${state.lastPasser ? ` sur une passe ${of(state.lastPasser.name)}` : ''}`,
      drama: clamp01(0.7 + context.stakes * 0.3 + (minute > 85 ? 0.2 : 0)),
    });
    return { events, actions };
  }

  private applyDecision(
    decision: ReturnType<typeof judge>,
    attacking: MatchTeam,
    defending: MatchTeam,
    state: ChainState,
    defender: MatchPlayer,
    minute: number,
    context: MatchContextInput,
    crowd: CrowdState,
    rng: Rng,
  ): {
    events: MatchEvent[];
    actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }>;
    chainEnds: boolean;
  } {
    const events: MatchEvent[] = [];
    const actions: Array<{ kind: 'shot' | 'corner' | 'foul'; onTarget: boolean }> = [];

    const bookDefender = (): void => {
      defender.booked = true;
      events.push({
        minute,
        kind: 'jaune',
        teamId: defending.clubId,
        playerId: defender.id,
        secondaryPlayerId: state.carrier.id,
        detail: `Carton jaune pour ${defender.name}`,
        drama: 0.4,
      });
      crowd.tension = clamp01(crowd.tension + 0.05);
    };

    const sendOff = (): void => {
      defender.sentOff = true;
      defender.onPitch = false;
      events.push({
        minute,
        kind: 'rouge',
        teamId: defending.clubId,
        playerId: defender.id,
        secondaryPlayerId: state.carrier.id,
        detail: `Carton rouge pour ${defender.name} — ${defending.name} à dix`,
        drama: 0.85,
      });
      crowd.tension = clamp01(crowd.tension + 0.18);
      crowd.intensity = clamp01(crowd.intensity + 0.12);
    };

    const takePenalty = (): void => {
      const taker = this.pickPenaltyTaker(attacking);
      taker.stats.shots++;
      const keeper =
        defending.players.find((p) => p.onPitch && p.position === 'GB') ??
        (defending.players[0] as MatchPlayer);
      const conversion = clamp01(
        0.62 + taker.attributes.finishing / 320 + taker.pressureResistance * 0.15 - crowd.tension * 0.08,
      );
      if (rng.next() < conversion) {
        attacking.goals++;
        taker.stats.goals++;
        taker.stats.shotsOnTarget++;
        crowd.intensity = clamp01(crowd.intensity + 0.2);
        events.push({
          minute,
          kind: 'penalty',
          teamId: attacking.clubId,
          playerId: taker.id,
          secondaryPlayerId: null,
          detail: `Penalty transformé par ${taker.name}`,
          drama: clamp01(0.75 + context.stakes * 0.25),
        });
        actions.push({ kind: 'shot', onTarget: true });
      } else {
        keeper.stats.saves++;
        events.push({
          minute,
          kind: 'penaltyManque',
          teamId: attacking.clubId,
          playerId: taker.id,
          secondaryPlayerId: keeper.id,
          detail: `${taker.name} manque le penalty — ${keeper.name} devine le côté`,
          drama: 0.9,
        });
        actions.push({ kind: 'shot', onTarget: true });
      }
    };

    switch (decision.kind) {
      case 'avantage':
        return { events, actions, chainEnds: false };
      case 'faute':
        events.push({
          minute,
          kind: 'faute',
          teamId: defending.clubId,
          playerId: defender.id,
          secondaryPlayerId: state.carrier.id,
          detail: `Faute de ${defender.name} sur ${state.carrier.name}`,
          drama: 0.2,
        });
        return { events, actions, chainEnds: true };
      case 'jaune':
        bookDefender();
        return { events, actions, chainEnds: true };
      case 'rouge':
        sendOff();
        return { events, actions, chainEnds: true };
      case 'penalty':
        takePenalty();
        return { events, actions, chainEnds: true };
      case 'penalty+jaune':
        bookDefender();
        takePenalty();
        return { events, actions, chainEnds: true };
      case 'penalty+rouge':
        sendOff();
        takePenalty();
        return { events, actions, chainEnds: true };
      default:
        return { events, actions, chainEnds: true };
    }
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  private teamStrength(
    team: MatchTeam,
    possessionCoefficient: number,
    context: MatchContextInput,
    isHome: boolean,
  ): number {
    let total = 0;
    let count = 0;
    for (const player of team.players) {
      if (!player.onPitch || player.sentOff) continue;
      total += player.rating * (0.65 + player.stamina * 0.35) * (0.85 + player.form * 0.3);
      count++;
    }
    if (count === 0) return 1;
    const average = total / count;
    const numericalAdvantage = count / 11;
    const homeBonus = isHome && !context.behindClosedDoors ? 1 + context.stadiumAtmosphere * 0.08 : 1;
    const momentumBonus = 0.9 + team.momentum * 0.2;
    return average * possessionCoefficient * numericalAdvantage * homeBonus * momentumBonus;
  }

  private updateMomentum(
    home: MatchTeam,
    away: MatchTeam,
    crowd: CrowdState,
    minute: number,
    context: MatchContextInput,
  ): void {
    // Le momentum revient naturellement vers l'équilibre.
    home.momentum = clamp01(home.momentum * 0.97 + 0.5 * 0.03);
    away.momentum = clamp01(away.momentum * 0.97 + 0.5 * 0.03);

    const diff = home.goals - away.goals;
    const closing = minute > 75;
    const baseline = context.behindClosedDoors ? 0 : context.stadiumAtmosphere * 0.6;
    const excitement = closing && Math.abs(diff) <= 1 ? 0.25 : 0;
    crowd.intensity = clamp01(crowd.intensity * 0.94 + (baseline + excitement) * 0.06 + (diff > 0 ? 0.01 : 0));
    crowd.tension = clamp01(crowd.tension * 0.97 + (closing && diff <= 0 ? 0.02 : 0));
  }

  private drainStamina(team: MatchTeam, drain: number, context: MatchContextInput, rng: Rng): void {
    const heat = context.weather.condition === 'heatwave' ? 1.35 : 1;
    const pitch = 1 + (1 - context.pitchQuality) * 0.25;
    for (const player of team.players) {
      if (!player.onPitch || player.sentOff) continue;
      player.minutesPlayed++;
      const enduranceFactor = 1 - player.attributes.stamina / 260;
      const loss = 0.0055 * drain * heat * pitch * enduranceFactor * rng.range(0.85, 1.15);
      player.stamina = clamp01(player.stamina - loss);
      player.stats.distanceKm = round(
        player.stats.distanceKm + 0.105 * (0.7 + player.attributes.stamina / 200) * drain,
        3,
      );
      const speed = 24 + (player.attributes.pace / 100) * 12 * (0.7 + player.stamina * 0.3);
      player.stats.topSpeedKmh = Math.max(player.stats.topSpeedKmh, round(speed, 1));
    }
  }

  private rollInjury(team: MatchTeam, context: MatchContextInput, rng: Rng): MatchPlayer | null {
    for (const player of team.players) {
      if (!player.onPitch || player.sentOff) continue;
      const fatigueRisk = (1 - player.stamina) * 0.0009;
      const pitchRisk = (1 - context.pitchQuality) * 0.0006;
      const weatherRisk = context.weather.severity * 0.0004;
      if (rng.chance(fatigueRisk + pitchRisk + weatherRisk + 0.00012)) {
        player.onPitch = false;
        return player;
      }
    }
    return null;
  }

  private substitute(team: MatchTeam, out: MatchPlayer): MatchPlayer | null {
    if (team.substitutionsLeft <= 0) return null;
    const replacement = team.bench.find((p) => !p.onPitch && !p.sentOff);
    if (!replacement) return null;
    out.onPitch = false;
    replacement.onPitch = true;
    replacement.position = out.position;
    team.players.push(replacement);
    team.substitutionsLeft--;
    return replacement;
  }

  private pickCarrier(players: MatchPlayer[], rng: Rng): MatchPlayer {
    return rng.weighted(
      players.map((player) => ({
        item: player,
        weight: Math.max(0.2, player.rating / 20 + player.vision * 2),
      })),
    );
  }

  private pickReceiver(
    candidates: MatchPlayer[],
    state: ChainState,
    tactics: Tactics,
    rng: Rng,
  ): MatchPlayer {
    return rng.weighted(
      candidates.map((player) => {
        // Plus la zone est avancée, plus le porteur cherche les joueurs offensifs.
        const offensive =
          player.position === 'BU' || player.position === 'AD' || player.position === 'AG' || player.position === 'MOC'
            ? 1
            : player.position === 'GB' || player.position === 'DC'
              ? 0.15
              : 0.5;
        const weight = 0.4 + offensive * (0.5 + state.zone) + tactics.passRisk * offensive;
        return { item: player, weight };
      }),
    );
  }

  private pickPenaltyTaker(team: MatchTeam): MatchPlayer {
    const onPitch = team.players.filter((p) => p.onPitch && !p.sentOff && p.position !== 'GB');
    if (onPitch.length === 0) return team.players[0] as MatchPlayer;
    return onPitch.reduce((best, player) =>
      player.attributes.finishing + player.pressureResistance * 20 >
      best.attributes.finishing + best.pressureResistance * 20
        ? player
        : best,
    );
  }

  private finaliseRatings(home: MatchTeam, away: MatchTeam): void {
    for (const team of [home, away]) {
      const conceded = team === home ? away.goals : home.goals;
      for (const player of [...team.players, ...team.bench]) {
        if (player.minutesPlayed === 0) continue;
        let rating = 6;
        rating += player.stats.goals * 1.15;
        rating += player.stats.assists * 0.75;
        rating += player.stats.keyPasses * 0.16;
        rating += player.stats.saves * 0.22;
        rating += player.stats.tackles * 0.12;
        rating += player.stats.duelsWon * 0.05;
        rating -= player.stats.duelsLost * 0.04;
        const passAccuracy =
          player.stats.passes > 0 ? player.stats.passesCompleted / player.stats.passes : 0.8;
        rating += (passAccuracy - 0.78) * 2.2;
        if (player.position === 'GB' && conceded === 0) rating += 0.8;
        if (player.booked) rating -= 0.3;
        if (player.sentOff) rating -= 1.6;
        player.stats.rating = round(clamp(rating, 3, 10), 1);
      }
    }
  }

  private pickManOfTheMatch(home: MatchTeam, away: MatchTeam): MatchPlayer | null {
    const all = [...home.players, ...home.bench, ...away.players, ...away.bench].filter(
      (p) => p.minutesPlayed > 0,
    );
    if (all.length === 0) return null;
    return all.reduce((best, player) => (player.stats.rating > best.stats.rating ? player : best));
  }
}
