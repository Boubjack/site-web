/**
 * Infinity Football — Football / Tactiques
 *
 * Tome V, ch. 3 : formations personnalisées, pressing, transitions, coups de
 * pied arrêtés, consignes individuelles, rôles des joueurs — et « l'IA adverse
 * s'adapte progressivement à ton style ».
 *
 * Le modèle produit des coefficients exploités par le moteur de match, et
 * l'adaptation adverse est un véritable apprentissage : chaque équipe garde un
 * historique des tendances rencontrées et ajuste ses réglages en conséquence.
 */

import { clamp, clamp01 } from '../core/math.js';
import type { Position } from '../career/player.js';

export type PressingStyle = 'bas' | 'medium' | 'haut' | 'gegenpressing';
export type TransitionStyle = 'lente' | 'equilibree' | 'verticale' | 'contre-attaque';
export type WidthStyle = 'etroit' | 'equilibre' | 'large';
export type DefensiveLine = 'basse' | 'mediane' | 'haute';
export type PlayerRole =
  | 'gardien classique'
  | 'gardien libéro'
  | 'défenseur central de couverture'
  | 'défenseur central de duel'
  | 'latéral offensif'
  | 'latéral défensif'
  | 'sentinelle'
  | 'relayeur'
  | 'meneur avancé'
  | 'ailier axial'
  | 'ailier de débordement'
  | 'faux neuf'
  | 'avant-centre de surface'
  | 'attaquant de rupture';

export interface FormationSlot {
  readonly position: Position;
  /** Coordonnées normalisées sur le terrain : x 0..1 (largeur), y 0..1 (profondeur). */
  readonly x: number;
  readonly y: number;
  readonly role: PlayerRole;
}

export interface Formation {
  readonly id: string;
  readonly name: string;
  readonly slots: readonly FormationSlot[];
}

export interface SetPieceInstructions {
  readonly cornerTaker: 'meilleur centreur' | 'pied fort' | 'pied inversé';
  readonly cornerDelivery: 'premier poteau' | 'deuxième poteau' | 'retrait' | 'courte';
  readonly freeKickTaker: 'meilleur tireur' | 'spécialiste gauche' | 'spécialiste droit';
  readonly penaltyTaker: 'meilleur finisseur' | 'capitaine' | 'spécialiste désigné';
  readonly playersInBox: number;
  readonly defensiveMarking: 'individuelle' | 'zone' | 'mixte';
}

export interface IndividualInstruction {
  readonly playerId: string;
  readonly role: PlayerRole;
  /** Liberté offensive 0..1. */
  readonly freedom: number;
  /** Consigne de pressing individuel 0..1. */
  readonly pressing: number;
  /** Marquage individuel d'un adversaire. */
  readonly manMarkTargetId: string | null;
  readonly takeSetPieces: boolean;
}

export interface Tactics {
  readonly formation: Formation;
  readonly pressing: PressingStyle;
  readonly transition: TransitionStyle;
  readonly width: WidthStyle;
  readonly defensiveLine: DefensiveLine;
  /** Tempo global 0..1. */
  readonly tempo: number;
  /** Prise de risque à la passe 0..1. */
  readonly passRisk: number;
  /** Agressivité dans les duels 0..1 (augmente les cartons). */
  readonly aggression: number;
  /** Densité axiale 0..1 : concentration du bloc. */
  readonly compactness: number;
  readonly setPieces: SetPieceInstructions;
  readonly individual: readonly IndividualInstruction[];
}

export const FORMATIONS: readonly Formation[] = [
  {
    id: '4-3-3',
    name: '4-3-3',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien classique' },
      { position: 'DD', x: 0.85, y: 0.25, role: 'latéral offensif' },
      { position: 'DC', x: 0.62, y: 0.18, role: 'défenseur central de duel' },
      { position: 'DC', x: 0.38, y: 0.18, role: 'défenseur central de couverture' },
      { position: 'DG', x: 0.15, y: 0.25, role: 'latéral offensif' },
      { position: 'MDC', x: 0.5, y: 0.4, role: 'sentinelle' },
      { position: 'MC', x: 0.68, y: 0.52, role: 'relayeur' },
      { position: 'MC', x: 0.32, y: 0.52, role: 'relayeur' },
      { position: 'AD', x: 0.88, y: 0.75, role: 'ailier de débordement' },
      { position: 'BU', x: 0.5, y: 0.85, role: 'avant-centre de surface' },
      { position: 'AG', x: 0.12, y: 0.75, role: 'ailier de débordement' },
    ],
  },
  {
    id: '4-2-3-1',
    name: '4-2-3-1',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien libéro' },
      { position: 'DD', x: 0.85, y: 0.26, role: 'latéral défensif' },
      { position: 'DC', x: 0.62, y: 0.18, role: 'défenseur central de duel' },
      { position: 'DC', x: 0.38, y: 0.18, role: 'défenseur central de couverture' },
      { position: 'DG', x: 0.15, y: 0.26, role: 'latéral offensif' },
      { position: 'MDC', x: 0.6, y: 0.4, role: 'sentinelle' },
      { position: 'MDC', x: 0.4, y: 0.4, role: 'relayeur' },
      { position: 'MD', x: 0.85, y: 0.66, role: 'ailier de débordement' },
      { position: 'MOC', x: 0.5, y: 0.68, role: 'meneur avancé' },
      { position: 'MG', x: 0.15, y: 0.66, role: 'ailier axial' },
      { position: 'BU', x: 0.5, y: 0.88, role: 'avant-centre de surface' },
    ],
  },
  {
    id: '4-4-2',
    name: '4-4-2',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien classique' },
      { position: 'DD', x: 0.85, y: 0.24, role: 'latéral défensif' },
      { position: 'DC', x: 0.62, y: 0.16, role: 'défenseur central de duel' },
      { position: 'DC', x: 0.38, y: 0.16, role: 'défenseur central de duel' },
      { position: 'DG', x: 0.15, y: 0.24, role: 'latéral défensif' },
      { position: 'MD', x: 0.85, y: 0.5, role: 'ailier de débordement' },
      { position: 'MC', x: 0.6, y: 0.46, role: 'relayeur' },
      { position: 'MC', x: 0.4, y: 0.46, role: 'sentinelle' },
      { position: 'MG', x: 0.15, y: 0.5, role: 'ailier de débordement' },
      { position: 'BU', x: 0.58, y: 0.84, role: 'avant-centre de surface' },
      { position: 'BU', x: 0.42, y: 0.84, role: 'attaquant de rupture' },
    ],
  },
  {
    id: '3-5-2',
    name: '3-5-2',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien classique' },
      { position: 'DC', x: 0.7, y: 0.18, role: 'défenseur central de duel' },
      { position: 'DC', x: 0.5, y: 0.15, role: 'défenseur central de couverture' },
      { position: 'DC', x: 0.3, y: 0.18, role: 'défenseur central de duel' },
      { position: 'MD', x: 0.92, y: 0.5, role: 'latéral offensif' },
      { position: 'MC', x: 0.65, y: 0.48, role: 'relayeur' },
      { position: 'MDC', x: 0.5, y: 0.42, role: 'sentinelle' },
      { position: 'MC', x: 0.35, y: 0.48, role: 'relayeur' },
      { position: 'MG', x: 0.08, y: 0.5, role: 'latéral offensif' },
      { position: 'BU', x: 0.58, y: 0.85, role: 'avant-centre de surface' },
      { position: 'BU', x: 0.42, y: 0.85, role: 'faux neuf' },
    ],
  },
  {
    id: '4-1-4-1',
    name: '4-1-4-1',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien classique' },
      { position: 'DD', x: 0.85, y: 0.24, role: 'latéral défensif' },
      { position: 'DC', x: 0.62, y: 0.16, role: 'défenseur central de couverture' },
      { position: 'DC', x: 0.38, y: 0.16, role: 'défenseur central de duel' },
      { position: 'DG', x: 0.15, y: 0.24, role: 'latéral défensif' },
      { position: 'MDC', x: 0.5, y: 0.36, role: 'sentinelle' },
      { position: 'MD', x: 0.84, y: 0.6, role: 'ailier de débordement' },
      { position: 'MC', x: 0.62, y: 0.56, role: 'relayeur' },
      { position: 'MC', x: 0.38, y: 0.56, role: 'relayeur' },
      { position: 'MG', x: 0.16, y: 0.6, role: 'ailier de débordement' },
      { position: 'BU', x: 0.5, y: 0.86, role: 'attaquant de rupture' },
    ],
  },
  {
    id: '3-4-3',
    name: '3-4-3',
    slots: [
      { position: 'GB', x: 0.5, y: 0.05, role: 'gardien libéro' },
      { position: 'DC', x: 0.7, y: 0.18, role: 'défenseur central de duel' },
      { position: 'DC', x: 0.5, y: 0.15, role: 'défenseur central de couverture' },
      { position: 'DC', x: 0.3, y: 0.18, role: 'défenseur central de duel' },
      { position: 'MD', x: 0.9, y: 0.52, role: 'latéral offensif' },
      { position: 'MC', x: 0.6, y: 0.46, role: 'relayeur' },
      { position: 'MC', x: 0.4, y: 0.46, role: 'relayeur' },
      { position: 'MG', x: 0.1, y: 0.52, role: 'latéral offensif' },
      { position: 'AD', x: 0.78, y: 0.82, role: 'ailier axial' },
      { position: 'BU', x: 0.5, y: 0.88, role: 'faux neuf' },
      { position: 'AG', x: 0.22, y: 0.82, role: 'ailier axial' },
    ],
  },
];

export function getFormation(id: string): Formation {
  const formation = FORMATIONS.find((f) => f.id === id);
  if (!formation) throw new Error(`Formation inconnue : "${id}"`);
  return formation;
}

export const DEFAULT_SET_PIECES: SetPieceInstructions = {
  cornerTaker: 'meilleur centreur',
  cornerDelivery: 'deuxième poteau',
  freeKickTaker: 'meilleur tireur',
  penaltyTaker: 'meilleur finisseur',
  playersInBox: 4,
  defensiveMarking: 'mixte',
};

export function defaultTactics(formationId = '4-3-3'): Tactics {
  return {
    formation: getFormation(formationId),
    pressing: 'medium',
    transition: 'equilibree',
    width: 'equilibre',
    defensiveLine: 'mediane',
    tempo: 0.55,
    passRisk: 0.45,
    aggression: 0.5,
    compactness: 0.55,
    setPieces: DEFAULT_SET_PIECES,
    individual: [],
  };
}

/** Coefficients dérivés, consommés par le moteur de match. */
export interface TacticalCoefficients {
  /** Gain de possession attendu. */
  readonly possession: number;
  /** Création d'occasions. */
  readonly chanceCreation: number;
  /** Solidité défensive. */
  readonly defensiveSolidity: number;
  /** Vulnérabilité aux contres. */
  readonly counterVulnerability: number;
  /** Coût énergétique par minute. */
  readonly staminaDrain: number;
  /** Risque de carton. */
  readonly cardRisk: number;
  /** Efficacité sur coups de pied arrêtés. */
  readonly setPieceThreat: number;
}

const PRESSING_TABLE: Record<PressingStyle, { possession: number; solidity: number; counter: number; drain: number; card: number }> = {
  bas: { possession: -0.06, solidity: 0.12, counter: -0.08, drain: 0.8, card: 0.9 },
  medium: { possession: 0, solidity: 0.04, counter: 0, drain: 1, card: 1 },
  haut: { possession: 0.06, solidity: -0.04, counter: 0.1, drain: 1.2, card: 1.15 },
  gegenpressing: { possession: 0.11, solidity: -0.08, counter: 0.2, drain: 1.45, card: 1.3 },
};

const TRANSITION_TABLE: Record<TransitionStyle, { possession: number; creation: number; counter: number }> = {
  lente: { possession: 0.08, creation: -0.03, counter: -0.05 },
  equilibree: { possession: 0.02, creation: 0.02, counter: 0 },
  verticale: { possession: -0.04, creation: 0.09, counter: 0.05 },
  'contre-attaque': { possession: -0.12, creation: 0.12, counter: -0.02 },
};

export function computeCoefficients(tactics: Tactics): TacticalCoefficients {
  const pressing = PRESSING_TABLE[tactics.pressing];
  const transition = TRANSITION_TABLE[tactics.transition];
  const lineBonus =
    tactics.defensiveLine === 'haute' ? { solidity: -0.05, counter: 0.12 } :
    tactics.defensiveLine === 'basse' ? { solidity: 0.09, counter: -0.07 } :
    { solidity: 0.02, counter: 0 };
  const widthBonus =
    tactics.width === 'large' ? { creation: 0.05, solidity: -0.03 } :
    tactics.width === 'etroit' ? { creation: -0.02, solidity: 0.04 } :
    { creation: 0.01, solidity: 0.01 };

  return {
    possession: clamp(0.5 + pressing.possession + transition.possession + (tactics.tempo - 0.5) * -0.1, 0.2, 0.85),
    chanceCreation: clamp01(
      0.45 + transition.creation + widthBonus.creation + tactics.passRisk * 0.18 + tactics.tempo * 0.1,
    ),
    defensiveSolidity: clamp01(
      0.5 + pressing.solidity + lineBonus.solidity + widthBonus.solidity + tactics.compactness * 0.18,
    ),
    counterVulnerability: clamp01(
      0.35 + pressing.counter + transition.counter + lineBonus.counter + tactics.passRisk * 0.12,
    ),
    staminaDrain: clamp(pressing.drain * (0.8 + tactics.tempo * 0.5), 0.6, 2),
    cardRisk: clamp(pressing.card * (0.6 + tactics.aggression), 0.3, 2.4),
    setPieceThreat: clamp01(0.35 + tactics.setPieces.playersInBox * 0.06),
  };
}

/**
 * Mémoire tactique adverse : l'IA observe les tendances d'un opposant et
 * ajuste ses réglages match après match (Tome V, ch. 3).
 */
export interface OpponentProfile {
  readonly opponentId: string;
  /** Nombre de rencontres analysées. */
  samples: number;
  /** Moyennes observées. */
  avgTempo: number;
  avgPressing: number;
  avgWidth: number;
  avgPassRisk: number;
  preferredFormation: string;
  /** Efficacité offensive constatée de l'adversaire. */
  observedThreat: number;
}

export class TacticalMemory {
  private readonly profiles = new Map<string, OpponentProfile>();

  observe(
    opponentId: string,
    tactics: Tactics,
    observedThreat: number,
  ): void {
    const existing = this.profiles.get(opponentId);
    const pressingValue = { bas: 0.2, medium: 0.5, haut: 0.75, gegenpressing: 1 }[tactics.pressing];
    const widthValue = { etroit: 0.2, equilibre: 0.5, large: 0.85 }[tactics.width];
    if (!existing) {
      this.profiles.set(opponentId, {
        opponentId,
        samples: 1,
        avgTempo: tactics.tempo,
        avgPressing: pressingValue,
        avgWidth: widthValue,
        avgPassRisk: tactics.passRisk,
        preferredFormation: tactics.formation.id,
        observedThreat,
      });
      return;
    }
    const n = existing.samples + 1;
    existing.samples = n;
    existing.avgTempo = existing.avgTempo + (tactics.tempo - existing.avgTempo) / n;
    existing.avgPressing = existing.avgPressing + (pressingValue - existing.avgPressing) / n;
    existing.avgWidth = existing.avgWidth + (widthValue - existing.avgWidth) / n;
    existing.avgPassRisk = existing.avgPassRisk + (tactics.passRisk - existing.avgPassRisk) / n;
    existing.observedThreat = existing.observedThreat + (observedThreat - existing.observedThreat) / n;
    existing.preferredFormation = tactics.formation.id;
  }

  profile(opponentId: string): OpponentProfile | undefined {
    return this.profiles.get(opponentId);
  }

  /**
   * Produit un plan de match adapté à l'adversaire observé.
   * Plus l'IA a de données, plus la contre-mesure est fine.
   */
  counterPlan(opponentId: string, base: Tactics): Tactics {
    const profile = this.profiles.get(opponentId);
    if (!profile || profile.samples < 2) return base;
    const confidence = clamp01(profile.samples / 6);

    // Adversaire qui presse très haut → jeu plus direct, bloc plus bas.
    const pressing: PressingStyle =
      profile.avgPressing > 0.7 ? 'medium' : profile.avgPressing < 0.35 ? 'haut' : base.pressing;
    const transition: TransitionStyle =
      profile.avgPressing > 0.7 ? 'verticale' : profile.avgTempo < 0.4 ? 'contre-attaque' : base.transition;
    const defensiveLine: DefensiveLine =
      profile.observedThreat > 0.6 ? 'basse' : profile.avgTempo < 0.4 ? 'haute' : base.defensiveLine;
    const width: WidthStyle = profile.avgWidth > 0.7 ? 'etroit' : base.width;

    return {
      ...base,
      pressing,
      transition,
      defensiveLine,
      width,
      compactness: clamp01(base.compactness + confidence * 0.15 * (profile.observedThreat - 0.5) * 2),
      passRisk: clamp01(base.passRisk + confidence * (profile.avgPressing > 0.7 ? 0.12 : -0.05)),
    };
  }

  serialize(): OpponentProfile[] {
    return [...this.profiles.values()];
  }

  restore(profiles: readonly OpponentProfile[]): void {
    this.profiles.clear();
    for (const profile of profiles) this.profiles.set(profile.opponentId, { ...profile });
  }
}
