/**
 * Infinity Football — Audio / Commentateurs
 *
 * Tome III, ch. 6 et Tome IX, ch. 2 : les commentateurs disposent d'une mémoire
 * complète de la carrière. Ils parlent des anciens clubs, des records, des
 * rivalités, des Boubjack Awards, des Ballons d'Or, du musée, de la famille,
 * des blessures et des transferts, et comparent le joueur aux légendes.
 *
 * Le duo est composé d'un commentateur principal et d'un consultant, chacun
 * avec son propre tempérament. Ils réagissent en temps réel au flux du match,
 * relancent sur la mémoire du monde et évitent la répétition grâce au moteur
 * de dialogue combinatoire.
 */

import { clamp01 } from '../core/math.js';
import type { Rng } from '../core/rng.js';
import { MemoryBank, type RecalledMemory } from '../ai/memory.js';
import { DialogueEngine, type DialogueTone, type DialogueVars } from '../ai/dialogue.js';
import type { MatchEvent, CrowdState } from '../football/match-engine.js';

export type CommentaryLanguage = 'fr' | 'en' | 'es';
export type CommentaryStyle = 'classique' | 'passionné' | 'analytique' | 'décontracté';

export interface Commentator {
  readonly id: string;
  readonly name: string;
  readonly role: 'principal' | 'consultant';
  readonly language: CommentaryLanguage;
  readonly style: CommentaryStyle;
  /** Exubérance 0..1 : volume et emphase. */
  readonly exuberance: number;
  /** Goût pour les statistiques 0..1. */
  readonly statsAffinity: number;
  /** Goût pour la nostalgie 0..1. */
  readonly nostalgia: number;
}

export interface CommentaryDuo {
  readonly primary: Commentator;
  readonly pundit: Commentator;
}

export interface CommentaryLine {
  readonly commentatorId: string;
  readonly commentatorName: string;
  readonly text: string;
  readonly minute: number;
  /** Tension du moment 0..1 — pilote le mixage audio. */
  readonly tension: number;
  readonly tone: DialogueTone;
}

export const COMMENTATOR_POOL: readonly Commentator[] = [
  { id: 'com-aubert', name: 'Vincent Aubert', role: 'principal', language: 'fr', style: 'classique', exuberance: 0.65, statsAffinity: 0.5, nostalgia: 0.6 },
  { id: 'com-ferrand', name: 'Nadia Ferrand', role: 'principal', language: 'fr', style: 'passionné', exuberance: 0.9, statsAffinity: 0.4, nostalgia: 0.5 },
  { id: 'com-delacroix', name: 'Marc Delacroix', role: 'principal', language: 'fr', style: 'analytique', exuberance: 0.35, statsAffinity: 0.9, nostalgia: 0.4 },
  { id: 'com-diarra', name: 'Aminata Diarra', role: 'consultant', language: 'fr', style: 'analytique', exuberance: 0.4, statsAffinity: 0.85, nostalgia: 0.55 },
  { id: 'com-vasseur', name: 'Thomas Vasseur', role: 'consultant', language: 'fr', style: 'décontracté', exuberance: 0.55, statsAffinity: 0.45, nostalgia: 0.8 },
  { id: 'com-bonnet', name: 'Claire Bonnet', role: 'consultant', language: 'fr', style: 'passionné', exuberance: 0.75, statsAffinity: 0.5, nostalgia: 0.65 },
  { id: 'com-hallow', name: 'Peter Hallow', role: 'principal', language: 'en', style: 'classique', exuberance: 0.7, statsAffinity: 0.55, nostalgia: 0.5 },
  { id: 'com-salinas', name: 'Diego Salinas', role: 'principal', language: 'es', style: 'passionné', exuberance: 0.95, statsAffinity: 0.35, nostalgia: 0.6 },
  { id: 'com-mendes', name: 'Sofia Mendes', role: 'consultant', language: 'es', style: 'analytique', exuberance: 0.45, statsAffinity: 0.8, nostalgia: 0.5 },
  { id: 'com-morita', name: 'Yuki Morita', role: 'consultant', language: 'en', style: 'analytique', exuberance: 0.4, statsAffinity: 0.9, nostalgia: 0.45 },
];

export function pickDuo(
  language: CommentaryLanguage,
  style: CommentaryStyle | null,
  rng: Rng,
): CommentaryDuo {
  const inLanguage = COMMENTATOR_POOL.filter((c) => c.language === language);
  const pool = inLanguage.length > 0 ? inLanguage : COMMENTATOR_POOL;
  const primaries = pool.filter((c) => c.role === 'principal');
  const pundits = pool.filter((c) => c.role === 'consultant');
  const filteredPrimaries = style ? primaries.filter((c) => c.style === style) : primaries;
  return {
    primary: rng.pick(filteredPrimaries.length > 0 ? filteredPrimaries : primaries),
    pundit: rng.pick(pundits.length > 0 ? pundits : pool),
  };
}

/** Contexte narratif fourni au duo avant le coup d'envoi. */
export interface CommentaryContext {
  readonly playerName: string;
  readonly clubName: string;
  readonly opponentName: string;
  readonly competitionName: string;
  readonly stadiumName: string;
  readonly cityName: string;
  readonly formerClubs: readonly string[];
  readonly trophies: readonly string[];
  readonly awards: readonly string[];
  readonly records: readonly string[];
  readonly rivals: readonly string[];
  readonly familyPresent: readonly string[];
  readonly injuries: readonly string[];
  readonly museumName: string | null;
  readonly legendComparisons: readonly string[];
  readonly careerStatline: string;
  readonly managerName: string;
}

export class CommentarySystem {
  private readonly dialogue = new DialogueEngine(500);
  private duo: CommentaryDuo;
  private readonly memory: MemoryBank;
  private lineCount = 0;
  /** Minute de la dernière relance mémoire, pour ne pas saturer. */
  private lastMemoryMinute = -20;

  constructor(duo: CommentaryDuo, memory: MemoryBank) {
    this.duo = duo;
    this.memory = memory;
  }

  get linesProduced(): number {
    return this.lineCount;
  }

  get currentDuo(): CommentaryDuo {
    return this.duo;
  }

  setDuo(duo: CommentaryDuo): void {
    this.duo = duo;
  }

  /** Volume combinatoire disponible, tous registres confondus (Tome IX, ch. 3). */
  availableVariants(): number {
    return this.dialogue.totalVariantCount();
  }

  /** Présentation d'avant-match : plante le décor et convoque la mémoire. */
  pregame(context: CommentaryContext, now: number, rng: Rng): CommentaryLine[] {
    const lines: CommentaryLine[] = [];
    const vars = this.varsFrom(context, now);

    lines.push(
      this.speak(
        this.duo.primary,
        'commentaire.contexte',
        'solennel',
        vars,
        0,
        0.4,
        rng,
      ),
    );
    lines.push(
      this.speak(this.duo.pundit, 'commentaire.memoire', 'nostalgique', vars, 0, 0.35, rng),
    );
    if (context.legendComparisons.length > 0) {
      lines.push(
        this.speak(
          this.duo.pundit,
          'commentaire.memoire',
          'admiratif',
          { ...vars, legend: context.legendComparisons[0] },
          0,
          0.4,
          rng,
        ),
      );
    }
    return lines;
  }

  /** Réaction en direct à un événement du match. */
  react(
    event: MatchEvent,
    crowd: CrowdState,
    context: CommentaryContext,
    now: number,
    rng: Rng,
  ): CommentaryLine[] {
    const lines: CommentaryLine[] = [];
    const tension = clamp01(event.drama * 0.6 + crowd.intensity * 0.4);
    const vars = this.varsFrom(context, now, event);

    switch (event.kind) {
      case 'but':
        lines.push(this.speak(this.duo.primary, 'commentaire.but', 'enthousiaste', vars, event.minute, tension, rng));
        lines.push(
          this.speak(
            this.duo.pundit,
            rng.chance(0.5) ? 'commentaire.memoire' : 'commentaire.contexte',
            this.duo.pundit.nostalgia > 0.6 ? 'nostalgique' : 'admiratif',
            vars,
            event.minute,
            tension * 0.8,
            rng,
          ),
        );
        break;
      case 'occasion':
      case 'poteau':
        lines.push(
          this.speak(this.duo.primary, 'commentaire.occasion', event.kind === 'poteau' ? 'tendu' : 'neutre', vars, event.minute, tension, rng),
        );
        break;
      case 'arret':
        lines.push(this.speak(this.duo.primary, 'commentaire.arret', 'admiratif', vars, event.minute, tension, rng));
        break;
      case 'faute':
      case 'jaune':
      case 'rouge':
        lines.push(
          this.speak(
            this.duo.primary,
            'commentaire.faute',
            event.kind === 'rouge' ? 'tendu' : 'neutre',
            vars,
            event.minute,
            tension,
            rng,
          ),
        );
        if (event.kind === 'rouge') {
          lines.push(this.speak(this.duo.pundit, 'commentaire.contexte', 'critique', vars, event.minute, tension, rng));
        }
        break;
      case 'penalty':
      case 'penaltyManque':
        lines.push(this.speak(this.duo.primary, 'commentaire.but', 'tendu', vars, event.minute, 1, rng));
        break;
      case 'miTemps':
        lines.push(this.speak(this.duo.pundit, 'commentaire.contexte', 'neutre', vars, event.minute, 0.3, rng));
        break;
      case 'finMatch':
        lines.push(this.speak(this.duo.primary, 'commentaire.final', 'solennel', vars, event.minute, tension, rng));
        lines.push(this.speak(this.duo.pundit, 'commentaire.memoire', 'nostalgique', vars, event.minute, 0.5, rng));
        break;
      default:
        // Relance de contexte occasionnelle, pour ne jamais laisser le silence.
        if (event.minute - this.lastMemoryMinute > 12 && rng.chance(0.35)) {
          this.lastMemoryMinute = event.minute;
          lines.push(
            this.speak(
              this.duo.pundit,
              this.duo.pundit.statsAffinity > 0.7 ? 'commentaire.memoire' : 'commentaire.contexte',
              'neutre',
              vars,
              event.minute,
              tension * 0.5,
              rng,
            ),
          );
        }
        break;
    }
    return lines;
  }

  /** Relance libre entre deux actions (meublage intelligent). */
  filler(context: CommentaryContext, minute: number, now: number, rng: Rng): CommentaryLine | null {
    if (minute - this.lastMemoryMinute < 8) return null;
    this.lastMemoryMinute = minute;
    const vars = this.varsFrom(context, now);
    const speaker = rng.chance(0.5) ? this.duo.primary : this.duo.pundit;
    const register = speaker.statsAffinity > 0.65 ? 'commentaire.memoire' : 'commentaire.contexte';
    const tone: DialogueTone = speaker.nostalgia > 0.65 ? 'nostalgique' : 'neutre';
    return this.speak(speaker, register, tone, vars, minute, 0.25, rng);
  }

  private speak(
    commentator: Commentator,
    register: Parameters<DialogueEngine['generate']>[0],
    tone: DialogueTone,
    vars: DialogueVars,
    minute: number,
    tension: number,
    rng: Rng,
  ): CommentaryLine {
    // L'exubérance module le ton effectif.
    const effectiveTone: DialogueTone =
      tone === 'neutre' && commentator.exuberance > 0.8
        ? 'enthousiaste'
        : tone === 'enthousiaste' && commentator.exuberance < 0.4
          ? 'neutre'
          : tone;
    const line = this.dialogue.generate(register, effectiveTone, vars, rng);
    this.lineCount++;
    return {
      commentatorId: commentator.id,
      commentatorName: commentator.name,
      text: line.text,
      minute,
      tension: clamp01(tension * (0.7 + commentator.exuberance * 0.5)),
      tone: effectiveTone,
    };
  }

  /** Construit les variables de dialogue à partir du contexte et de la mémoire. */
  private varsFrom(context: CommentaryContext, now: number, event?: MatchEvent): DialogueVars {
    const highlights: RecalledMemory[] = this.memory.strongest(now, 5);
    const memoryRecord = highlights.find((m) => m.tags.includes('record'));
    const memoryTrophy = highlights.find((m) => m.tags.includes('trophée'));
    return {
      player: context.playerName,
      club: context.clubName,
      opponent: context.opponentName,
      competition: context.competitionName,
      stadium: context.stadiumName,
      city: context.cityName,
      formerClub: context.formerClubs[0],
      trophy: memoryTrophy?.summary ?? context.trophies[0],
      award: context.awards[0],
      record: memoryRecord?.summary ?? context.records[0],
      rival: context.rivals[0],
      familyMember: context.familyPresent[0],
      injury: context.injuries[0],
      museum: context.museumName ?? undefined,
      legend: context.legendComparisons[0],
      statistic: context.careerStatline,
      manager: context.managerName,
      minute: event ? String(event.minute) : undefined,
      teammate: event?.secondaryPlayerId ?? undefined,
    };
  }
}
