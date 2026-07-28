/**
 * Infinity Football — Football de rue
 *
 * Le chaînon manquant entre la vie d'un gamin et la carrière professionnelle.
 * Ici, personne ne tient de feuille de match : il n'y a qu'un grillage, des
 * gens sur un muret, des téléphones qui se lèvent quand un geste passe, et
 * parfois un homme qui reste une heure sans parler à personne.
 *
 * Ce que le système fait réellement :
 *  - génère des terrains de rue dans chaque quartier, avec leur légende locale ;
 *  - simule une session geste par geste : le joueur tente, réussit ou perd le
 *    ballon, et la foule réagit ;
 *  - tient une réputation de rue distincte de la réputation professionnelle ;
 *  - fait vivre des légendes locales dotées d'une mémoire et d'une rivalité ;
 *  - déclenche des vidéos virales qui font gagner des abonnés ;
 *  - envoie des recruteurs anonymes, qui se présentent seulement s'ils sont
 *    convaincus, et peuvent ouvrir une porte professionnelle ;
 *  - organise des tournois récurrents, dont deux qui ne s'annoncent jamais ;
 *  - fait progresser de vrais attributs : la rue forme le joueur.
 *
 * Tome II ch. 2 (le monde vit hors du stade), Tome III (gameplay),
 * Tome IV ch. 1-2 (les débuts), Tome XX (immersion), Tome XXIV (marques).
 */

import { clamp, clamp01, hashString, round } from '../core/math.js';
import type { GameDate } from '../core/clock.js';
import { MINUTES_PER_DAY } from '../core/clock.js';
import type { SimulationContext } from '../core/context.js';
import type { GameSystem, SystemMetadata } from '../core/system.js';
import type { Rng } from '../core/rng.js';
import { MemoryBank, MemoryFactory } from '../ai/memory.js';
import { randomFootballProfile, type FootballProfile } from '../ai/personality.js';
import { NAME_POOLS } from '../data/names.js';
import { getCity } from '../data/cities.js';
import { ALL_CLUBS, getClub } from '../data/clubs.js';
import {
  CREW_NAMES,
  CREW_NICKNAMES,
  DISCIPLINES,
  PITCH_LEGENDS,
  PITCH_PREFIXES,
  SCOUT_WHISPERS,
  STREET_BRANDS,
  STREET_MOVES,
  STREET_TOURNAMENTS,
  VIRAL_TITLES,
  crowdReaction,
  getDiscipline,
  type DisciplineDef,
  type StreetBrandDef,
  type StreetDiscipline,
  type StreetMove,
  type StreetTrainableAttribute,
} from '../data/street.js';
import { WORLD_SERVICE, type WorldSystem } from '../world/world-system.js';
import { ECONOMY_SERVICE, type EconomySystem } from '../economy/economy-system.js';
import { CAREER_SERVICE, type CareerSystem } from '../career/career-system.js';

export const STREET_SERVICE = 'street';

/** Un terrain de rue, ancré dans un quartier réel de la ville. */
export interface StreetPitch {
  readonly id: string;
  readonly name: string;
  readonly cityId: string;
  readonly districtId: string;
  readonly districtName: string;
  readonly disciplines: readonly StreetDiscipline[];
  /** Qualité du sol 0..1 : un bitume lisse pardonne, un sol défoncé non. */
  readonly surfaceQuality: number;
  /** Éclairage 0..1 : sans lumière, pas de session nocturne. */
  readonly lighting: number;
  /** Réputation du terrain 0..1 : plus il est côté, plus on y est vu. */
  reputation: number;
  readonly legend: string;
  /** Nombre de sessions que le joueur y a disputées. */
  sessionsPlayed: number;
  /** Le joueur y est reconnu : les habitués le saluent. */
  known: boolean;
}

/** Une légende locale : elle a un nom, une mémoire, et elle vieillit. */
export interface StreetLegend {
  readonly id: string;
  readonly name: string;
  readonly nickname: string;
  readonly crewName: string;
  readonly cityId: string;
  readonly homePitchId: string;
  age: number;
  /** Niveau technique 0..1. */
  skill: number;
  readonly profile: FootballProfile;
  readonly specialities: readonly StreetDiscipline[];
  /** Relation au joueur : -1 hostile, 0 indifférent, 1 respect total. */
  respect: number;
  /** Duels disputés contre le joueur. */
  duels: number;
  duelsLost: number;
  /** La légende a été repérée et a signé quelque part. */
  turnedPro: boolean;
}

export interface StreetClip {
  readonly id: string;
  readonly title: string;
  readonly moveName: string;
  readonly pitchName: string;
  views: number;
  readonly at: number;
}

export interface StreetInvitation {
  readonly id: string;
  readonly tournamentId: string;
  readonly tournamentName: string;
  readonly cityId: string;
  readonly discipline: StreetDiscipline;
  readonly startsAt: number;
  readonly prize: number;
  readonly secret: boolean;
  readonly message: string;
  accepted: boolean;
  resolved: boolean;
}

export interface StreetScout {
  readonly id: string;
  readonly clubId: string;
  /** Impression cumulée 0..1 : le recruteur revient plusieurs fois. */
  impression: number;
  /** Nombre de sessions observées. */
  sightings: number;
  /** Il s'est présenté au joueur. */
  revealed: boolean;
  /** Une porte professionnelle a été ouverte. */
  offered: boolean;
}

export interface StreetSessionReport {
  readonly pitchId: string;
  readonly pitchName: string;
  readonly discipline: StreetDiscipline;
  readonly disciplineName: string;
  readonly opponentName: string;
  readonly won: boolean;
  readonly scoreLine: string;
  /** Performance globale 0..1. */
  readonly performance: number;
  /** Spectacle 0..1. */
  readonly showmanship: number;
  readonly moves: ReadonlyArray<{
    readonly name: string;
    readonly succeeded: boolean;
    readonly finisher: boolean;
    readonly reaction: string;
  }>;
  readonly credGained: number;
  readonly attributeGains: ReadonlyArray<{ readonly attribute: string; readonly delta: number }>;
  readonly clip: StreetClip | null;
  readonly scoutWhisper: string | null;
  readonly summary: string;
}

/**
 * Combien de terrains par ville selon sa taille. Les populations du jeu sont
 * exprimées en milliers d'habitants (Paris = 2 160).
 */
function pitchCountFor(populationThousands: number): number {
  if (populationThousands > 5_000) return 6;
  if (populationThousands > 1_500) return 5;
  if (populationThousands > 500) return 4;
  if (populationThousands > 150) return 3;
  return 2;
}

export class StreetFootballSystem implements GameSystem {
  readonly metadata: SystemMetadata = {
    id: 'street',
    name: 'Football de rue',
    order: 68,
    tomes: ['II', 'III', 'IV', 'XX', 'XXIV', 'XXX'],
  };

  private context!: SimulationContext;
  private world!: WorldSystem;
  private economy!: EconomySystem;
  private career: CareerSystem | null = null;

  private readonly pitches = new Map<string, StreetPitch>();
  private readonly legends = new Map<string, StreetLegend>();
  private readonly clips: StreetClip[] = [];
  private readonly invitations: StreetInvitation[] = [];
  private readonly scouts = new Map<string, StreetScout>();
  private readonly memory = new MemoryBank({ capacity: 300, halfLifeDays: 1200 });
  private readonly signedBrands: string[] = [];
  private readonly wonTournaments: string[] = [];

  /** Réputation de rue 0..100, indépendante de la réputation professionnelle. */
  private cred = 0;
  private sessionCount = 0;
  private counter = 0;
  /** Minute de la dernière session : la rue fatigue aussi. */
  private lastSessionAt = -10_000;

  init(context: SimulationContext): void {
    this.context = context;
    this.world = context.require<WorldSystem>(WORLD_SERVICE);
    this.economy = context.require<EconomySystem>(ECONOMY_SERVICE);
    this.career = context.optional<CareerSystem>(CAREER_SERVICE) ?? null;
    context.provide(STREET_SERVICE, this);

    this.generatePitches();
    this.generateLegends();
  }

  // ── Génération du monde de la rue ────────────────────────────────────────

  /**
   * Les terrains naissent des quartiers réels : un city stadium existe parce
   * qu'il y a des immeubles autour, pas parce qu'un designer l'a posé là.
   */
  private generatePitches(): void {
    const rng = this.context.stream('street.pitches');
    for (const city of this.world.cities()) {
      const def = getCity(city.id);
      const count = Math.min(pitchCountFor(def.population), Math.max(1, city.districts.length));
      const coastal = def.coastal;
      for (let index = 0; index < count; index++) {
        const district = city.districts[index % city.districts.length];
        if (!district) continue;
        const id = `pitch:${city.id}:${index}`;
        const prefix = PITCH_PREFIXES[hashString(id) % PITCH_PREFIXES.length] as string;
        const legend = PITCH_LEGENDS[hashString(`${id}:legend`) % PITCH_LEGENDS.length] as string;

        // Chaque terrain a sa spécialité : une cage grillagée n'accueille pas
        // un beach soccer, et seuls les terrains éclairés jouent la nuit.
        const lighting = clamp01(rng.range(0.2, 1));
        const disciplines: StreetDiscipline[] = ['cinqContreCinq', 'panna', 'tekkers'];
        if (rng.chance(0.55)) disciplines.push('cage');
        if (rng.chance(0.4)) disciplines.push('futsal');
        if (rng.chance(0.5)) disciplines.push('freestyle');
        if (coastal && index % 2 === 0) disciplines.push('beachSoccer');
        if (lighting > 0.6) disciplines.push('nocturne');

        this.pitches.set(id, {
          id,
          name: `${prefix} de ${district.name}`,
          cityId: city.id,
          districtId: district.id,
          districtName: district.name,
          disciplines,
          surfaceQuality: clamp01(rng.range(0.3, 0.95)),
          lighting,
          reputation: clamp01(rng.range(0.15, 0.7) + (def.population > 2_000_000 ? 0.15 : 0)),
          legend,
          sessionsPlayed: 0,
          known: false,
        });
      }
    }
    this.context.logger.info('terrains de rue générés', { terrains: this.pitches.size });
  }

  /**
   * Chaque ville a ses légendes locales. Certaines finiront professionnelles,
   * la plupart resteront le meilleur joueur d'un quartier — et c'est déjà
   * quelque chose.
   */
  private generateLegends(): void {
    const rng = this.context.stream('street.legends');
    // Un surnom est un identifiant dans un quartier : il ne se partage pas.
    const takenNicknames = new Map<string, Set<string>>();
    for (const pitch of this.pitches.values()) {
      const taken = takenNicknames.get(pitch.cityId) ?? new Set<string>();
      takenNicknames.set(pitch.cityId, taken);
      const count = pitch.reputation > 0.55 ? 2 : 1;
      for (let index = 0; index < count; index++) {
        const id = `legend:${pitch.id}:${index}`;
        const country = getCity(pitch.cityId).countryId;
        const pool =
          NAME_POOLS.find((entry) => entry.countryIds.includes(country)) ??
          (NAME_POOLS[0] as (typeof NAME_POOLS)[number]);
        const first = rng.pick(pool.given);
        const last = rng.pick(pool.family);
        const skill = clamp01(rng.gaussian(0.45 + pitch.reputation * 0.3, 0.14));
        const free = CREW_NICKNAMES.filter((nickname) => !taken.has(nickname));
        const nickname = free.length > 0 ? rng.pick(free) : `${rng.pick(CREW_NICKNAMES)} II`;
        taken.add(nickname);
        this.legends.set(id, {
          id,
          name: `${first} ${last}`,
          nickname,
          crewName: rng.pick(CREW_NAMES),
          cityId: pitch.cityId,
          homePitchId: pitch.id,
          age: rng.int(15, 34),
          skill,
          profile: randomFootballProfile(rng, skill),
          specialities: rng.pickMany(pitch.disciplines, Math.min(2, pitch.disciplines.length)),
          respect: 0,
          duels: 0,
          duelsLost: 0,
          turnedPro: false,
        });
      }
    }
  }

  // ── Lecture ──────────────────────────────────────────────────────────────

  /** Réputation de rue 0..100. */
  get streetCred(): number {
    return round(this.cred, 1);
  }

  /** Palier symbolique atteint, tel que la rue le nomme. */
  get standing(): string {
    if (this.cred >= 85) return 'légende du bitume';
    if (this.cred >= 65) return 'nom connu dans toute la ville';
    if (this.cred >= 45) return 'référence du quartier';
    if (this.cred >= 25) return 'on commence à te connaître';
    if (this.cred >= 10) return 'un habitué';
    return 'un inconnu de plus';
  }

  get allPitches(): readonly StreetPitch[] {
    return [...this.pitches.values()];
  }

  pitchesIn(cityId: string): StreetPitch[] {
    return [...this.pitches.values()].filter((pitch) => pitch.cityId === cityId);
  }

  pitch(pitchId: string): StreetPitch | undefined {
    return this.pitches.get(pitchId);
  }

  get allLegends(): readonly StreetLegend[] {
    return [...this.legends.values()];
  }

  legendsIn(cityId: string): StreetLegend[] {
    return [...this.legends.values()].filter((legend) => legend.cityId === cityId);
  }

  get viralClips(): readonly StreetClip[] {
    return [...this.clips].sort((a, b) => b.views - a.views);
  }

  get pendingInvitations(): StreetInvitation[] {
    const now = this.context.clock.absoluteMinutes;
    return this.invitations.filter((invitation) => !invitation.resolved && invitation.startsAt > now);
  }

  get streetBrands(): readonly string[] {
    return this.signedBrands;
  }

  get palmares(): readonly string[] {
    return this.wonTournaments;
  }

  /** Les recruteurs qui se sont fait connaître ; les autres restent invisibles. */
  get knownScouts(): StreetScout[] {
    return [...this.scouts.values()].filter((scout) => scout.revealed);
  }

  get sessionsPlayed(): number {
    return this.sessionCount;
  }

  /** Ce que le joueur voit en arrivant sur un terrain, avant de jouer. */
  describePitch(pitchId: string): string | null {
    const pitch = this.pitches.get(pitchId);
    if (!pitch) return null;
    const locals = this.legendsIn(pitch.cityId).filter((legend) => legend.homePitchId === pitchId);
    const who = locals.length > 0
      ? `${locals.map((l) => `${l.name} « ${l.nickname} »`).join(' et ')} ${locals.length > 1 ? 'traînent' : 'traîne'} par là`
      : 'personne de connu ce soir';
    const greeting = pitch.known ? 'On te salue en arrivant.' : 'Personne ne lève la tête quand tu arrives.';
    return `${pitch.name}, ${pitch.districtName} — ${pitch.legend}. ${who}. ${greeting}`;
  }

  // ── Jouer une session ────────────────────────────────────────────────────

  /**
   * Dispute une session sur un terrain. C'est le cœur du mode : une suite de
   * gestes tentés contre un adversaire réel, jugée par une foule qui filme.
   */
  playSession(
    pitchId: string,
    discipline: StreetDiscipline,
    options: { showboat?: number } = {},
  ): StreetSessionReport | null {
    const pitch = this.pitches.get(pitchId);
    if (!pitch) return null;
    if (!pitch.disciplines.includes(discipline)) return null;
    if (!this.career?.hasCareer) return null;

    const player = this.career.player;
    if (player.retired) return null;

    const def = getDiscipline(discipline);
    const rng = this.context.stream(`street.session.${this.sessionCount}`);
    const now = this.context.clock.absoluteMinutes;

    // La rue fatigue : enchaîner les sessions dégrade la performance et use
    // physiquement, exactement comme une séance de trop.
    const restMinutes = now - this.lastSessionAt;
    const freshness = clamp01(0.78 + Math.min(restMinutes, 2 * MINUTES_PER_DAY) / (2 * MINUTES_PER_DAY) * 0.22);
    this.lastSessionAt = now;

    const opponent = this.pickOpponent(pitch, discipline, rng);
    const showboat = clamp01(options.showboat ?? 0.5);

    // Maîtrise technique du joueur pour cette discipline, entre 0 et 1.
    const technique =
      (player.attributes.dribbling * 0.4 + player.attributes.firstTouch * 0.35 + player.attributes.agility * 0.25) / 100;
    const nerve = clamp01(player.profile.football.composure * 0.6 + player.morale * 0.4);
    const mastery = clamp01(
      technique * 0.72 +
        player.profile.football.flair * 0.16 +
        nerve * 0.1 +
        pitch.surfaceQuality * 0.08,
    ) * freshness;

    const attempts = Math.max(3, Math.round(def.durationMinutes / 5));
    const available = STREET_MOVES.filter((move) => move.disciplines.includes(discipline));
    const moves: Array<{ name: string; succeeded: boolean; finisher: boolean; reaction: string }> = [];

    let successes = 0;
    let show = 0;
    // Le sommet de la soirée : c'est ce geste-là qui part en vidéo et dont un
    // recruteur se souvient, pas la moyenne des trente minutes.
    let peak = 0;
    let opponentScore = 0;
    let pannaLanded = false;

    for (let attempt = 0; attempt < attempts; attempt++) {
      // On tente ce qu'on sait faire, plus une marge. Un gamin ne se lance pas
      // dans un double petit pont parce qu'il est ambitieux : il se lance dans
      // ce qu'il maîtrise presque. L'ambition est donc relative au niveau, pas
      // absolue — sinon cabotiner condamnait mécaniquement à tout rater.
      const ambition = clamp01(mastery * (0.6 + showboat * 0.85) + rng.range(-0.08, 0.08));
      const move = this.pickMove(available, ambition, rng);
      const margin = mastery - move.difficulty;
      const chance = clamp01(0.58 + margin * 1.15 - opponent.skill * 0.2);
      const succeeded = rng.next() < chance;

      if (succeeded) {
        successes++;
        // Un geste difficile réussi vaut plus qu'un geste facile réussi : c'est
        // la seule raison rationnelle de prendre le risque de cabotiner.
        const impact = move.showmanship * (0.6 + pitch.reputation * 0.4) * (1 + move.difficulty * 0.55);
        show += impact;
        // Note propre du geste, indépendante de l'échelle utilisée pour la
        // réputation : rarement au-dessus de 0,6, jamais saturée à 1.
        const moment = move.showmanship * (0.5 + move.difficulty * 0.5) * (0.4 + pitch.reputation * 0.6);
        peak = Math.max(peak, clamp01(moment));
        const finisher = move.canPanna && def.teamSize === 1 && rng.chance(0.35 + margin);
        if (finisher) pannaLanded = true;
        const reaction = crowdReaction(clamp01(impact));
        moves.push({ name: move.name, succeeded: true, finisher, reaction });
        this.context.emit({
          type: 'street.move',
          moveId: move.id,
          moveName: move.name,
          succeeded: true,
          finisher,
          crowdReaction: reaction,
        });
        if (finisher) break;
      } else {
        opponentScore += 1;
        const reaction = ambition > 0.7
          ? 'ça rigole derrière le grillage, quelqu’un imite le geste raté'
          : 'le ballon file en touche, personne ne commente';
        moves.push({ name: move.name, succeeded: false, finisher: false, reaction });
        this.context.emit({
          type: 'street.move',
          moveId: move.id,
          moveName: move.name,
          succeeded: false,
          finisher: false,
          crowdReaction: reaction,
        });
      }
    }

    const performance = clamp01(successes / Math.max(1, moves.length));
    const showmanship = clamp01(show / Math.max(1, moves.length));

    // Résultat : en duel, le petit pont tranche ; en collectif, la performance
    // relative décide.
    const won = def.teamSize === 1
      ? pannaLanded || performance > 0.55 + opponent.skill * 0.2
      : performance * (1 + showmanship * 0.2) > 0.45 + opponent.skill * 0.3;
    const scoreLine = def.teamSize === 1
      ? pannaLanded
        ? 'petit pont — duel terminé'
        : `${successes} gestes passés contre ${opponentScore} perdus`
      : `${successes + (won ? 2 : 0)} - ${opponentScore + (won ? 0 : 2)}`;

    // Conséquences réelles.
    const credGained = this.applyCred(def, pitch, performance, showmanship, won);
    const attributeGains = this.applyTraining(def, performance, showmanship);
    this.applyFatigue(def, freshness);

    pitch.sessionsPlayed++;
    if (pitch.sessionsPlayed >= 3) pitch.known = true;
    pitch.reputation = clamp01(pitch.reputation + (won ? 0.012 : 0.004));
    this.sessionCount++;

    const clip = this.maybeViral(moves, pitch, peak, rng);
    const scoutWhisper = this.observeByScouts(pitch, performance, peak, won, rng);
    this.updateRivalry(opponent, won, performance, rng);

    const summary =
      `${def.name} ${pitch.name} — ${won ? 'gagné' : 'perdu'} contre ${opponent.name} « ${opponent.nickname} », ` +
      `${successes}/${moves.length} gestes passés, ${Math.round(showmanship * 100)} % de spectacle.`;

    this.memory.remember(
      MemoryFactory.match(
        `street:${pitch.id}:${this.sessionCount}`,
        summary,
        ['rue', discipline, pitch.districtName],
        now,
        won ? 0.6 : -0.3,
      ),
    );

    this.context.emit({
      type: 'street.session',
      pitchId: pitch.id,
      pitchName: pitch.name,
      cityId: pitch.cityId,
      discipline,
      performance: round(performance, 3),
      showmanship: round(showmanship, 3),
      won,
      summary,
    });

    return {
      pitchId: pitch.id,
      pitchName: pitch.name,
      discipline,
      disciplineName: def.name,
      opponentName: `${opponent.name} « ${opponent.nickname} »`,
      won,
      scoreLine,
      performance: round(performance, 3),
      showmanship: round(showmanship, 3),
      moves,
      credGained: round(credGained, 2),
      attributeGains,
      clip,
      scoutWhisper,
      summary,
    };
  }

  /** L'adversaire est un vrai personnage du quartier, pas un mannequin. */
  private pickOpponent(pitch: StreetPitch, discipline: StreetDiscipline, rng: Rng): StreetLegend {
    const locals = [...this.legends.values()].filter(
      (legend) => legend.homePitchId === pitch.id && !legend.turnedPro,
    );
    const specialists = locals.filter((legend) => legend.specialities.includes(discipline));
    const pool = specialists.length > 0 ? specialists : locals;
    if (pool.length > 0) {
      // Celui qu'on a déjà affronté revient plus souvent : c'est comme ça
      // qu'un nom devient un rival, puis un ami.
      const weighted = pool.map((legend) => ({ item: legend, weight: 1 + legend.duels * 1.5 }));
      return rng.weighted(weighted);
    }

    // Terrain sans habitué : quelqu'un se présente quand même.
    const cityLegends = this.legendsIn(pitch.cityId).filter((legend) => !legend.turnedPro);
    if (cityLegends.length > 0) return rng.pick(cityLegends);
    return {
      id: 'legend:passant',
      name: 'un type de passage',
      nickname: 'Inconnu',
      crewName: 'aucun',
      cityId: pitch.cityId,
      homePitchId: pitch.id,
      age: 22,
      skill: 0.4,
      profile: randomFootballProfile(rng, 0.4),
      specialities: [discipline],
      respect: 0,
      duels: 0,
      duelsLost: 0,
      turnedPro: false,
    };
  }

  /** Un geste ambitieux est tiré parmi les plus difficiles disponibles. */
  private pickMove(available: readonly StreetMove[], ambition: number, rng: Rng): StreetMove {
    const weighted = available.map((move) => ({
      item: move,
      // Plus l'ambition est haute, plus les gestes difficiles pèsent lourd.
      weight: 1 + Math.max(0, 1 - Math.abs(move.difficulty - ambition) * 2.5) * 4,
    }));
    return rng.weighted(weighted);
  }

  /** La réputation de rue monte lentement et ne redescend jamais toute seule. */
  private applyCred(
    def: DisciplineDef,
    pitch: StreetPitch,
    performance: number,
    showmanship: number,
    won: boolean,
  ): number {
    // Un exploit sur un terrain côté vaut dix victoires sur un terrain vide.
    const base = (performance * 0.5 + showmanship * 0.5) * def.prestige * (0.6 + pitch.reputation * 0.8);
    const bonus = won ? 1.35 : 0.55;
    // Rendements décroissants : à 80 de cred, plus rien n'impressionne.
    const saturation = 1 - clamp01(this.cred / 110);
    const delta = base * bonus * 1.9 * saturation;
    if (delta <= 0) return 0;

    this.cred = clamp(this.cred + delta, 0, 100);
    this.context.emit({
      type: 'street.reputation',
      delta: round(delta, 2),
      value: round(this.cred, 1),
      reason: `${def.name} à ${pitch.name}`,
    });
    return delta;
  }

  /**
   * La rue forme réellement. Un joueur qui passe ses soirées en cage gagne du
   * dribble et du contrôle — pas de la vitesse ni du jeu de tête.
   */
  private applyTraining(
    def: DisciplineDef,
    performance: number,
    showmanship: number,
  ): Array<{ attribute: string; delta: number }> {
    if (!this.career?.hasCareer) return [];
    const player = this.career.player;
    const gains: Array<{ attribute: string; delta: number }> = [];

    // Un jeune progresse vite, un joueur mûr n'apprend presque plus rien.
    const youth = player.age < 20 ? 1.5 : player.age < 24 ? 1 : player.age < 29 ? 0.45 : 0.15;
    const quality = performance * 0.6 + showmanship * 0.4;

    for (const attribute of def.trains) {
      const key = attribute as StreetTrainableAttribute;
      const current = player.attributes[key];
      // On ne dépasse jamais le potentiel : la rue affûte, elle ne crée pas.
      const ceiling = player.potential;
      if (current >= ceiling) continue;
      const delta = round(quality * 0.28 * youth * def.prestige, 3);
      if (delta <= 0) continue;
      player.attributes[key] = clamp(current + delta, 1, 99);
      gains.push({ attribute: key, delta });
    }

    if (gains.length > 0) {
      // Le geste travaillé au grillage se voit sur le terrain. Le profil est
      // immuable : on le remplace au lieu d'écrire dedans.
      player.profile = {
        ...player.profile,
        football: {
          ...player.profile.football,
          flair: clamp01(player.profile.football.flair + showmanship * 0.004 * youth),
        },
      };
      player.sharpness = clamp01(player.sharpness + quality * 0.03);
    }
    return gains;
  }

  /** Deux heures sur le bitume coûtent autant qu'une séance au club. */
  private applyFatigue(def: DisciplineDef, freshness: number): void {
    if (!this.career?.hasCareer) return;
    const player = this.career.player;
    const cost = (def.durationMinutes / 40) * 0.05 * (2 - freshness);
    player.fitness = clamp01(player.fitness - cost);
    player.morale = clamp01(player.morale + 0.015);
  }

  /**
   * Une vidéo ne devient virale que si le geste est exceptionnel ET si le
   * terrain est suffisamment fréquenté pour qu'on filme.
   */
  private maybeViral(
    moves: ReadonlyArray<{ name: string; succeeded: boolean; finisher: boolean }>,
    pitch: StreetPitch,
    peak: number,
    rng: Rng,
  ): StreetClip | null {
    const best = moves.filter((move) => move.succeeded).sort((a, b) => (b.finisher ? 1 : 0) - (a.finisher ? 1 : 0))[0];
    if (!best) return null;

    const probability = clamp01((peak - 0.5) * 2.2) * (0.35 + pitch.reputation * 0.65);
    if (!rng.chance(probability)) return null;

    const playerName = this.career?.hasCareer ? this.career.player.identity.name : 'le gamin du quartier';
    const template = rng.pick(VIRAL_TITLES);
    const title = template
      .replace('{player}', playerName)
      .replace('{move}', best.name)
      .replace('{district}', pitch.districtName);

    // L'audience dépend de la réputation de rue déjà acquise : une vidéo d'un
    // inconnu ne part pas de la même base.
    const reach = 4_000 + this.cred * 900 + pitch.reputation * 6_000;
    const views = Math.round(reach * rng.range(0.6, 3.4) * (0.5 + peak));

    const clip: StreetClip = {
      id: `clip:${this.counter++}`,
      title,
      moveName: best.name,
      pitchName: pitch.name,
      views,
      at: this.context.clock.absoluteMinutes,
    };
    this.clips.push(clip);
    if (this.clips.length > 200) this.clips.shift();

    this.cred = clamp(this.cred + Math.min(6, views / 40_000), 0, 100);
    this.context.emit({
      type: 'street.viral',
      clipId: clip.id,
      title,
      views,
      moveName: best.name,
      pitchName: pitch.name,
    });
    return clip;
  }

  /**
   * Les recruteurs ne se présentent pas. Ils reviennent, ils regardent, ils
   * notent — et un jour quelqu'un t'attend à la sortie du terrain.
   */
  private observeByScouts(
    pitch: StreetPitch,
    performance: number,
    peak: number,
    won: boolean,
    rng: Rng,
  ): string | null {
    // Plus le terrain est côté et la réputation haute, plus on est observé.
    const attention = clamp01(pitch.reputation * 0.5 + this.cred / 160 + (won ? 0.12 : 0));
    if (!rng.chance(attention * 0.45)) return null;

    // Le recruteur vient d'un club plausible : proche géographiquement, et pas
    // le Real Madrid pour un cinq contre cinq de quartier.
    const cityId = pitch.cityId;
    const countryId = getCity(cityId).countryId;
    const candidates = ALL_CLUBS.filter((club) => {
      const prestigeCeiling = 35 + this.cred * 0.65;
      return club.countryId === countryId && club.prestige <= prestigeCeiling;
    });

    // Un recruteur qui t'a repéré revient te voir : c'est ainsi qu'un dossier
    // se construit. Sans cette fidélité, l'attention se dispersait sur quarante
    // clubs et aucun n'atteignait jamais le seuil de conviction.
    const returning = [...this.scouts.values()].filter((scout) => !scout.offered);
    const club =
      returning.length > 0 && rng.chance(0.65)
        ? getClub(rng.pick(returning).clubId)
        : candidates.length > 0
          ? rng.pick(candidates)
          : rng.pick(ALL_CLUBS);

    const scoutId = `scout:${club.id}`;
    const scout = this.scouts.get(scoutId) ?? {
      id: scoutId,
      clubId: club.id,
      impression: 0,
      sightings: 0,
      revealed: false,
      offered: false,
    };
    const quality = performance * 0.42 + peak * 0.48 + (won ? 0.1 : 0);
    // On se souvient du soir où il a fait ce geste, pas de la moyenne de ses
    // soirs. L'impression monte vite sur un exploit et ne redescend que
    // lentement — c'est ainsi qu'un recruteur parle d'un joueur.
    scout.impression = clamp01(
      Math.max(scout.impression * 0.985, scout.impression * 0.6 + quality * 0.62),
    );
    scout.sightings++;
    this.scouts.set(scoutId, scout);

    const whisper = rng.pick(SCOUT_WHISPERS);
    this.context.emit({
      type: 'street.scout',
      scoutId,
      clubId: club.id,
      anonymous: !scout.revealed,
      impression: round(scout.impression, 3),
      whisper,
    });

    // Il se présente seulement après plusieurs visites concluantes.
    if (!scout.revealed && scout.sightings >= 3 && scout.impression > 0.55) {
      scout.revealed = true;
      this.context.emit({
        type: 'street.scout',
        scoutId,
        clubId: club.id,
        anonymous: false,
        impression: round(scout.impression, 3),
        whisper: `l’homme au carnet s’est présenté : recruteur pour ${club.name}`,
      });
    }
    return whisper;
  }

  /** Une rivalité de quartier se construit duel après duel, dans les deux sens. */
  private updateRivalry(opponent: StreetLegend, won: boolean, performance: number, rng: Rng): void {
    if (opponent.id === 'legend:passant') return;
    opponent.duels++;
    if (won) opponent.duelsLost++;

    // Perdre proprement contre quelqu'un de fort force le respect ; gagner en
    // humiliant le crée aussi, mais plus lentement.
    const before = opponent.respect;
    const delta = won ? 0.03 + performance * 0.03 : 0.012 + (1 - performance) * 0.02;
    opponent.respect = clamp(opponent.respect + delta, -1, 1);

    const firstMeeting = opponent.duels === 1;
    // On ne raconte que ce qui change : la première rencontre, le passage du
    // seuil de respect, et une confrontation sur deux ensuite. Le reste, c'est
    // du bruit — deux gamins qui jouent au ballon.
    const crossedRespect = before <= 0.7 && opponent.respect > 0.7;
    const notable = firstMeeting || crossedRespect || opponent.duels % 5 === 0;
    if (!notable) {
      if (opponent.duels >= 6 && opponent.duelsLost / opponent.duels > 0.75 && rng.chance(0.2)) {
        opponent.skill = clamp01(opponent.skill - 0.05);
      }
      return;
    }

    const stage = firstMeeting
      ? 'rencontre'
      : opponent.respect > 0.7
        ? 'respect'
        : won
          ? 'victoire'
          : 'défaite';

    const detail = firstMeeting
      ? `${opponent.name} te regarde de haut en bas et met un pied sur le ballon.`
      : opponent.respect > 0.7
        ? `${opponent.name} te tape dans la main avant même de commencer. « Tu joues bien, toi. »`
        : won
          ? `${opponent.name} ne dit rien, ramasse son sweat et s’en va.`
          : `${opponent.name} sourit sans méchanceté. « Reviens quand tu veux. »`;

    this.context.emit({
      type: 'street.rival',
      rivalId: opponent.id,
      rivalName: `${opponent.name} « ${opponent.nickname} »`,
      crewName: opponent.crewName,
      stage,
      detail,
    });

    // Une légende qui perd trop souvent finit par disparaître du terrain, et
    // parfois par signer ailleurs : la rue se renouvelle.
    if (opponent.duels >= 6 && opponent.duelsLost / opponent.duels > 0.75 && rng.chance(0.2)) {
      opponent.skill = clamp01(opponent.skill - 0.05);
    }
  }

  // ── Tournois ─────────────────────────────────────────────────────────────

  /**
   * Les invitations arrivent selon la réputation de rue. Les deux tournois
   * secrets n'apparaissent nulle part : ni affiche, ni annonce, seulement un
   * message pour ceux qui ont franchi le seuil.
   */
  private issueInvitations(date: GameDate): void {
    if (!this.career?.hasCareer || this.career.player.retired) return;
    const rng = this.context.stream('street.invitations');
    const cityId = this.playerCityId();
    const now = this.context.clock.absoluteMinutes;

    for (const tournament of STREET_TOURNAMENTS) {
      if (tournament.month !== date.month) continue;
      if (this.cred < tournament.minStreetCred) continue;
      if (this.invitations.some((invitation) => invitation.tournamentId === tournament.id && !invitation.resolved)) {
        continue;
      }
      // Une seule édition par an et par tournoi.
      const seasonKey = `${tournament.id}:${date.year}`;
      if (this.invitations.some((invitation) => invitation.id.endsWith(seasonKey))) continue;

      const startsAt = now + rng.int(3, 12) * MINUTES_PER_DAY;
      const message = tournament.secret
        ? `Un numéro inconnu : « ${tournament.flavour} Tu es sur la liste. Ne réponds pas. »`
        : `${tournament.name} — ${tournament.flavour} Dotation : ${tournament.prize.toLocaleString('fr-FR')} €.`;

      const invitation: StreetInvitation = {
        id: `invit:${this.counter++}:${seasonKey}`,
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        cityId,
        discipline: tournament.discipline,
        startsAt,
        prize: tournament.prize,
        secret: tournament.secret,
        message,
        accepted: false,
        resolved: false,
      };
      this.invitations.push(invitation);

      this.context.emit({
        type: 'street.tournament',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        stage: 'invitation',
        cityId,
        detail: message,
        prize: tournament.prize,
      });
    }
  }

  /** Accepte une invitation. Le tournoi se jouera à sa date. */
  acceptInvitation(invitationId: string): boolean {
    const invitation = this.invitations.find((entry) => entry.id === invitationId && !entry.resolved);
    if (!invitation) return false;
    invitation.accepted = true;
    return true;
  }

  /**
   * Dispute un tournoi : plusieurs tours, chacun contre un adversaire plus
   * fort. Perdre un tour élimine — comme sur un vrai terrain.
   */
  private runTournament(invitation: StreetInvitation): void {
    if (!this.career?.hasCareer) return;
    const tournament = STREET_TOURNAMENTS.find((entry) => entry.id === invitation.tournamentId);
    if (!tournament) return;

    const rng = this.context.stream(`street.tournament.${invitation.id}`);
    const pitches = this.pitchesIn(invitation.cityId).filter((pitch) =>
      pitch.disciplines.includes(invitation.discipline),
    );
    const pitch = pitches.length > 0 ? rng.pick(pitches) : this.pitchesIn(invitation.cityId)[0];
    if (!pitch) {
      invitation.resolved = true;
      return;
    }

    this.context.emit({
      type: 'street.tournament',
      tournamentId: tournament.id,
      tournamentName: tournament.name,
      stage: 'started',
      cityId: invitation.cityId,
      detail: `${tournament.flavour} Terrain : ${pitch.name}.`,
      prize: tournament.prize,
    });

    const rounds = tournament.prestige > 0.8 ? 5 : tournament.prestige > 0.5 ? 4 : 3;
    let survived = true;

    for (let round = 1; round <= rounds && survived; round++) {
      // Chaque tour est une vraie session, avec ses gestes et sa foule.
      const report = this.playSession(pitch.id, invitation.discipline, {
        showboat: 0.45 + tournament.prestige * 0.3,
      });
      if (!report) break;

      // La difficulté monte : au dernier tour, il faut être exceptionnel.
      const bar = 0.4 + (round / rounds) * tournament.prestige * 0.45;
      survived = report.performance * (1 + report.showmanship * 0.25) >= bar;

      const label = round === rounds ? 'finale' : `tour ${round}`;
      this.context.emit({
        type: 'street.tournament',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        stage: survived ? 'round' : 'eliminated',
        cityId: invitation.cityId,
        detail: survived
          ? `${label} passée — ${report.scoreLine}`
          : `éliminé en ${label} : ${report.scoreLine}`,
        prize: 0,
      });
    }

    if (survived) {
      this.wonTournaments.push(`${tournament.name} ${this.context.clock.date.year}`);
      this.economy.record('courant', tournament.prize, 'primes', `${tournament.name} — vainqueur`);
      this.cred = clamp(this.cred + 8 + tournament.prestige * 14, 0, 100);
      this.career.adjustReputation(tournament.prestige * 5, `vainqueur ${tournament.name}`);

      this.memory.remember(
        MemoryFactory.trophy(
          `street:tournament:${tournament.id}:${this.context.clock.date.year}`,
          tournament.name,
          ['rue', 'tournoi', tournament.discipline],
          this.context.clock.absoluteMinutes,
        ),
      );

      this.context.emit({
        type: 'street.tournament',
        tournamentId: tournament.id,
        tournamentName: tournament.name,
        stage: 'won',
        cityId: invitation.cityId,
        detail: `${tournament.name} remporté — ${tournament.prize.toLocaleString('fr-FR')} € et le respect de la ville.`,
        prize: tournament.prize,
      });
    }

    invitation.resolved = true;
  }

  // ── Marques de rue ───────────────────────────────────────────────────────

  /** Les marques disponibles à ce niveau de réputation, non encore signées. */
  availableStreetBrands(): StreetBrandDef[] {
    return STREET_BRANDS.filter(
      (brand) => this.cred >= brand.minStreetCred && !this.signedBrands.includes(brand.id),
    );
  }

  /**
   * Signe avec une marque de rue. Elles paient peu, mais elles arrivent des
   * années avant les équipementiers — et elles s'en souviennent.
   */
  signStreetBrand(brandId: string): StreetBrandDef | null {
    const brand = STREET_BRANDS.find((entry) => entry.id === brandId);
    if (!brand) return null;
    if (this.cred < brand.minStreetCred) return null;
    if (this.signedBrands.includes(brandId)) return null;

    this.signedBrands.push(brandId);
    this.economy.record('courant', brand.annualValue, 'sponsors', `contrat de rue — ${brand.name}`);
    this.context.emit({
      type: 'street.brand',
      brandId: brand.id,
      brandName: brand.name,
      annualValue: brand.annualValue,
      obligation: brand.obligation,
    });
    return brand;
  }

  /**
   * Un recruteur convaincu ouvre une porte. Ce n'est pas un contrat : c'est un
   * essai, et il faut encore le mériter.
   */
  private offerTrials(): void {
    if (!this.career?.hasCareer || this.career.player.retired) return;
    for (const scout of this.scouts.values()) {
      if (!scout.revealed || scout.offered) continue;
      if (scout.impression < 0.72) continue;
      scout.offered = true;
      const club = getClub(scout.clubId);
      this.career.adjustReputation(3, `essai proposé par ${club.name}`);
      this.context.emit({
        type: 'street.scout',
        scoutId: scout.id,
        clubId: scout.clubId,
        anonymous: false,
        impression: round(scout.impression, 3),
        whisper:
          `${club.name} propose un essai. « On t’a vu jouer trois fois. On ne vient pas trois fois pour rien. »`,
      });
    }
  }

  private playerCityId(): string {
    const cities = this.world.cities();
    const first = cities[0];
    return first ? first.id : 'paris';
  }

  // ── Cycles ───────────────────────────────────────────────────────────────

  onDay(context: SimulationContext, _date: GameDate): void {
    const now = context.clock.absoluteMinutes;
    // Les tournois acceptés se jouent le jour venu.
    for (const invitation of this.invitations) {
      if (invitation.resolved || !invitation.accepted) continue;
      if (invitation.startsAt > now) continue;
      this.runTournament(invitation);
    }
    // Une invitation ignorée expire : la rue n'attend pas.
    for (const invitation of this.invitations) {
      if (!invitation.resolved && !invitation.accepted && invitation.startsAt + MINUTES_PER_DAY < now) {
        invitation.resolved = true;
      }
    }

    // Les vidéos continuent de tourner quelques jours, puis retombent.
    for (const clip of this.clips) {
      const ageDays = (now - clip.at) / MINUTES_PER_DAY;
      if (ageDays < 6) clip.views = Math.round(clip.views * 1.12);
    }

    this.offerTrials();
  }

  onWeek(context: SimulationContext, date: GameDate): void {
    void date;
    const rng = context.stream('street.week');
    // Le monde de la rue vit sans le joueur : les terrains montent et
    // descendent en cote, les légendes vieillissent, certaines signent.
    for (const pitch of this.pitches.values()) {
      pitch.reputation = clamp01(pitch.reputation + rng.range(-0.02, 0.02));
    }
    for (const legend of this.legends.values()) {
      if (legend.turnedPro) continue;
      // Un jeune très fort finit par être repéré, joueur ou pas.
      if (legend.age < 21 && legend.skill > 0.78 && rng.chance(0.02)) {
        legend.turnedPro = true;
        context.emit({
          type: 'street.rival',
          rivalId: legend.id,
          rivalName: `${legend.name} « ${legend.nickname} »`,
          crewName: legend.crewName,
          stage: 'respect',
          detail: `${legend.name} a signé quelque part. Il ne reviendra plus sur le terrain.`,
        });
      }
    }
  }

  onMonth(context: SimulationContext, date: GameDate): void {
    void context;
    this.issueInvitations(date);
  }

  onYear(_context: SimulationContext, _date: GameDate): void {
    for (const legend of this.legends.values()) {
      legend.age++;
      // Après trente ans, le bitume reprend ce qu'il a donné.
      if (legend.age > 30) legend.skill = clamp01(legend.skill - 0.03);
    }
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────

  serialize(): unknown {
    return {
      cred: this.cred,
      sessionCount: this.sessionCount,
      counter: this.counter,
      lastSessionAt: this.lastSessionAt,
      signedBrands: [...this.signedBrands],
      wonTournaments: [...this.wonTournaments],
      clips: this.clips.map((clip) => ({ ...clip })),
      invitations: this.invitations.map((invitation) => ({ ...invitation })),
      scouts: [...this.scouts.values()].map((scout) => ({ ...scout })),
      // La géométrie des terrains est régénérée depuis la graine : on ne
      // sauvegarde que ce qui a vécu.
      pitchDeltas: [...this.pitches.values()].map((pitch) => ({
        id: pitch.id,
        reputation: pitch.reputation,
        sessionsPlayed: pitch.sessionsPlayed,
        known: pitch.known,
      })),
      legendDeltas: [...this.legends.values()].map((legend) => ({
        id: legend.id,
        age: legend.age,
        skill: legend.skill,
        respect: legend.respect,
        duels: legend.duels,
        duelsLost: legend.duelsLost,
        turnedPro: legend.turnedPro,
      })),
      memory: this.memory.serialize(),
    };
  }

  deserialize(data: unknown): void {
    if (!data || typeof data !== 'object') return;
    const state = data as Record<string, unknown>;

    this.cred = (state.cred as number) ?? 0;
    this.sessionCount = (state.sessionCount as number) ?? 0;
    this.counter = (state.counter as number) ?? 0;
    this.lastSessionAt = (state.lastSessionAt as number) ?? -10_000;

    this.signedBrands.length = 0;
    this.signedBrands.push(...(((state.signedBrands as string[]) ?? [])));
    this.wonTournaments.length = 0;
    this.wonTournaments.push(...(((state.wonTournaments as string[]) ?? [])));

    this.clips.length = 0;
    this.clips.push(...(((state.clips as StreetClip[]) ?? [])));
    this.invitations.length = 0;
    this.invitations.push(...(((state.invitations as StreetInvitation[]) ?? [])));

    this.scouts.clear();
    for (const scout of ((state.scouts as StreetScout[]) ?? [])) {
      this.scouts.set(scout.id, { ...scout });
    }

    for (const delta of ((state.pitchDeltas as Array<Record<string, unknown>>) ?? [])) {
      const pitch = this.pitches.get(delta.id as string);
      if (!pitch) continue;
      pitch.reputation = (delta.reputation as number) ?? pitch.reputation;
      pitch.sessionsPlayed = (delta.sessionsPlayed as number) ?? 0;
      pitch.known = (delta.known as boolean) ?? false;
    }

    for (const delta of ((state.legendDeltas as Array<Record<string, unknown>>) ?? [])) {
      const legend = this.legends.get(delta.id as string);
      if (!legend) continue;
      legend.age = (delta.age as number) ?? legend.age;
      legend.skill = (delta.skill as number) ?? legend.skill;
      legend.respect = (delta.respect as number) ?? 0;
      legend.duels = (delta.duels as number) ?? 0;
      legend.duelsLost = (delta.duelsLost as number) ?? 0;
      legend.turnedPro = (delta.turnedPro as boolean) ?? false;
    }

    if (Array.isArray(state.memory)) this.memory.restore(state.memory as never[]);
  }
}
