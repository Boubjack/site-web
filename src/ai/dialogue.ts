/**
 * Infinity Football — IA / Moteur de dialogue génératif
 *
 * Tome IX, ch. 3 : « Plus de 500 000 lignes de commentaires. Aucune phrase ne
 * doit être répétée de façon excessive. »
 * Tome XXV, ch. 2 : une IA générative produit dialogues, conférences de presse,
 * interviews, publications sociales, actualités, commentaires et réactions.
 *
 * Approche : une grammaire pondérée. Chaque réplique est une combinaison
 * d'ouvertures, de noyaux, de qualificatifs et de chutes, chacun décliné par
 * ton et par contexte, puis enrichi de variables issues de la mémoire du monde
 * (records, rivalités, trophées, famille, blessures).
 *
 * Le volume combinatoire réel est calculable : `DialogueEngine.variantCount()`
 * multiplie les alternatives de chaque emplacement pour un registre donné.
 * Un anti-répétition à fenêtre glissante interdit de reproduire une phrase déjà
 * entendue récemment.
 */

import type { Rng } from '../core/rng.js';

export type DialogueTone =
  | 'neutre'
  | 'enthousiaste'
  | 'critique'
  | 'nostalgique'
  | 'tendu'
  | 'admiratif'
  | 'ironique'
  | 'solennel';

export type DialogueRegister =
  | 'commentaire.but'
  | 'commentaire.occasion'
  | 'commentaire.arret'
  | 'commentaire.faute'
  | 'commentaire.contexte'
  | 'commentaire.memoire'
  | 'commentaire.final'
  | 'presse.question'
  | 'presse.reponse'
  | 'supporter.rue'
  | 'supporter.tribune'
  | 'social.commentaire'
  | 'pnj.quotidien'
  | 'coequipier.vestiaire'
  | 'entraineur.consigne'
  | 'legende.discours';

/** Variables injectables dans les répliques. */
export interface DialogueVars {
  readonly player?: string;
  readonly club?: string;
  readonly opponent?: string;
  readonly formerClub?: string;
  readonly competition?: string;
  readonly stadium?: string;
  readonly city?: string;
  readonly minute?: string;
  readonly score?: string;
  readonly record?: string;
  readonly trophy?: string;
  readonly award?: string;
  readonly legend?: string;
  readonly familyMember?: string;
  readonly injury?: string;
  readonly rival?: string;
  readonly museum?: string;
  readonly statistic?: string;
  readonly teammate?: string;
  readonly manager?: string;
  readonly journalist?: string;
  readonly brand?: string;
  readonly season?: string;
}

interface Slot {
  /** Alternatives disponibles ; une est tirée à chaque génération. */
  readonly options: readonly string[];
  /** Emplacement facultatif : peut être omis. */
  readonly optional?: boolean;
}

interface RegisterGrammar {
  readonly slots: readonly Slot[];
  /** Variations de ton appliquées en suffixe. */
  readonly tones: Partial<Record<DialogueTone, readonly string[]>>;
}

const OPENERS_NEUTRAL = [
  'Et voilà',
  'Attention ici',
  'On y est',
  'Regardez bien',
  'Ça se précise',
  'Nouvelle séquence',
  'Le jeu s’emballe',
  'Ça vient sur la gauche',
  'Ça repart de derrière',
];

const GOAL_CORES = [
  '{player} ouvre le pied et trouve la lucarne',
  '{player} enroule du gauche, imparable',
  '{player} conclut une action de grande classe',
  '{player} devance tout le monde au premier poteau',
  '{player} punit la moindre hésitation défensive',
  '{player} reprend de volée sans contrôle',
  '{player} élimine deux adversaires puis frappe',
  '{player} transforme sans trembler',
  '{player} coupe la trajectoire et pousse au fond',
  '{player} arme une frappe sèche à l’entrée de la surface',
  '{player} profite d’un ballon relâché',
  '{player} conclut le contre en trois passes',
];

const GOAL_TAILS = [
  'le stade explose',
  '{stadium} est debout',
  'les tribunes ne se contrôlent plus',
  'quel geste',
  'c’est superbe',
  'la défense de {opponent} est sonnée',
  'à la {minute}e minute',
  'et {club} passe devant',
  'score : {score}',
];

const CHANCE_CORES = [
  '{player} tente sa chance de loin',
  '{player} se présente seul face au gardien',
  '{player} place une tête décroisée',
  '{player} déclenche une reprise acrobatique',
  '{player} sert {teammate} dans la surface',
  '{player} déborde et centre en retrait',
  '{player} obtient un coup franc idéalement placé',
];

const CHANCE_TAILS = [
  'ça passe à côté',
  'le gardien veille',
  'quel sang-froid il aurait fallu',
  'le poteau repousse',
  'c’était l’occasion du match',
  'la défense de {opponent} s’en sort bien',
  'il va s’en vouloir',
];

const SAVE_CORES = [
  'le gardien de {opponent} sort une parade réflexe',
  'détente extraordinaire du portier',
  'main ferme sur la frappe de {player}',
  'le gardien claque le ballon en corner',
  'sortie autoritaire dans les pieds de {player}',
];

const FOUL_CORES = [
  'faute évidente sur {player}',
  'l’arbitre siffle et sort le carton',
  'accrochage entre {player} et un défenseur de {opponent}',
  'tacle en retard, l’arbitre laisse jouer un instant',
  'la faute est logique, le tempo devenait dangereux',
];

const CONTEXT_CORES = [
  '{club} domine la possession dans ce {competition}',
  'la pelouse de {stadium} est difficile ce soir',
  '{opponent} a reculé d’un cran',
  'l’ambiance à {city} est électrique',
  'le rythme est retombé après la {minute}e minute',
  '{manager} donne des consignes très offensives',
];

const MEMORY_CORES = [
  'on se souvient de son passage à {formerClub}',
  'ça rappelle son {trophy} — un moment qui a marqué l’histoire',
  '{record} : c’est écrit dans les livres désormais',
  'son {award} avait déjà dit l’essentiel',
  'après cette {injury}, beaucoup le donnaient fini',
  'son musée à {museum} raconte déjà tout ça',
  'la rivalité avec {rival} reprend ce soir',
  '{legend} disait de lui qu’il changerait les grands rendez-vous',
  '{familyMember} est dans les tribunes ce soir',
  'ses statistiques parlent : {statistic}',
];

const FINAL_CORES = [
  'c’est terminé à {stadium}',
  'coup de sifflet final, score de {score}',
  '{club} tient son résultat',
  'les joueurs saluent le virage',
  'une soirée dont on reparlera',
];

const PRESS_QUESTION_CORES = [
  'Comment jugez-vous votre performance ce soir',
  'Le vestiaire a-t-il senti la pression du {competition}',
  'Un mot sur votre relation avec {manager}',
  'Les rumeurs vous envoient loin de {club}, qu’en dites-vous',
  'Votre {record} change-t-il votre approche',
  'Après votre {injury}, êtes-vous revenu au niveau attendu',
  'Le duel avec {rival} vous motive-t-il particulièrement',
  'Que répondez-vous aux critiques après ce {score}',
  'Vos {award} pèsent-ils sur vos épaules',
  'La rencontre avec {opponent} était-elle un tournant',
];

const PRESS_ANSWER_CORES = [
  'Je reste concentré sur le collectif',
  'On avance match après match, rien d’autre ne compte',
  'Le club m’a tout donné, je lui rends sur le terrain',
  'Il faudra demander ça à {manager}',
  'Les chiffres ne racontent jamais toute l’histoire',
  'Je préfère parler du travail de {teammate}',
  'Ce genre de question ne m’atteint plus',
  'On me jugera au bout de la saison',
  'Je n’oublie pas d’où je viens',
];

const FAN_STREET_CORES = [
  '{player} ! Une photo s’il vous plaît',
  'Vous avez changé ma saison, merci',
  'Mon fils porte votre maillot tous les jours',
  'Signez ici, je vous suis depuis {formerClub}',
  'On compte sur vous contre {rival}',
  'Vous êtes la fierté de {city}',
  'Ce but contre {opponent}, je le revois encore',
];

const FAN_STAND_CORES = [
  'le virage entonne le nom de {player}',
  'les écharpes se lèvent dans tout {stadium}',
  'une bâche géante déployée pour {club}',
  'le kop réclame un changement',
  'les tambours accélèrent le tempo',
];

const SOCIAL_COMMENT_CORES = [
  'Monstrueux ce soir 🔥',
  'On n’a pas assez parlé de sa passe décisive',
  'Meilleur joueur du championnat, débat clos',
  'Je préfère quand il joue plus haut',
  'Un vrai leader, ça se voit',
  'Le prochain {award} lui tend les bras',
  'Sa saison à {formerClub} reste ma préférée',
  'Trop de matchs, il va se blesser',
];

const NPC_DAILY_CORES = [
  'belle journée pour marcher dans {city}',
  'le marché ouvre tôt aujourd’hui',
  'la circulation est impossible avec le match ce soir',
  'la nouvelle boutique du centre vaut le détour',
  'il paraît que {club} recrute cet été',
  'les travaux avenue principale n’en finissent pas',
];

const TEAMMATE_CORES = [
  'on te suit sur ce coup, {player}',
  'concentre-toi, on a besoin de toi devant',
  'ce que tu as fait la saison dernière, refais-le',
  'garde ton calme avec l’arbitre',
  'le coach compte sur nous deux en transition',
];

const MANAGER_CORES = [
  'presse haut dès la perte de balle',
  'garde ta position, ne sors pas de ton couloir',
  'on ralentit, on garde le ballon',
  'plus de mouvement entre les lignes',
  'on ferme les intervalles, ils passent par là',
];

const LEGEND_SPEECH_CORES = [
  'j’ai connu des grands, mais celui-là a quelque chose de rare',
  'remettre ce trophée à {player} me remplit de fierté',
  'ce jeu appartient à ceux qui font rêver',
  'quand j’ai raccroché, je pensais avoir tout vu',
  'les records passent, la manière reste',
];

const TONE_SUFFIXES: Record<DialogueTone, readonly string[]> = {
  neutre: ['', '.'],
  enthousiaste: [' !', ' — magnifique !', ' quel bonheur !', ' incroyable !'],
  critique: [' ...c’est insuffisant.', ' il faudra faire mieux.', ' très décevant.'],
  nostalgique: [' comme au bon vieux temps.', ' ça rappelle une autre époque.', ' souvenirs...'],
  tendu: [' l’air devient irrespirable.', ' la tension monte d’un cran.', ' ça peut basculer.'],
  admiratif: [' du très grand art.', ' un geste de patron.', ' chapeau bas.'],
  ironique: [' on a connu plus inspiré.', ' voilà qui va faire jaser.', ' magnifique... ou presque.'],
  solennel: [' l’histoire retiendra ce moment.', ' un instant qui restera.', ' pour toujours.'],
};

const GRAMMARS: Record<DialogueRegister, RegisterGrammar> = {
  'commentaire.but': {
    slots: [{ options: OPENERS_NEUTRAL, optional: true }, { options: GOAL_CORES }, { options: GOAL_TAILS }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.occasion': {
    slots: [{ options: OPENERS_NEUTRAL, optional: true }, { options: CHANCE_CORES }, { options: CHANCE_TAILS }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.arret': {
    slots: [{ options: SAVE_CORES }, { options: CHANCE_TAILS, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.faute': {
    slots: [{ options: FOUL_CORES }, { options: CONTEXT_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.contexte': {
    slots: [{ options: CONTEXT_CORES }, { options: MEMORY_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.memoire': {
    slots: [{ options: MEMORY_CORES }, { options: CONTEXT_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'commentaire.final': {
    slots: [{ options: FINAL_CORES }, { options: MEMORY_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'presse.question': {
    slots: [{ options: PRESS_QUESTION_CORES }],
    tones: TONE_SUFFIXES,
  },
  'presse.reponse': {
    slots: [{ options: PRESS_ANSWER_CORES }, { options: MEMORY_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
  'supporter.rue': { slots: [{ options: FAN_STREET_CORES }], tones: TONE_SUFFIXES },
  'supporter.tribune': { slots: [{ options: FAN_STAND_CORES }], tones: TONE_SUFFIXES },
  'social.commentaire': { slots: [{ options: SOCIAL_COMMENT_CORES }], tones: TONE_SUFFIXES },
  'pnj.quotidien': { slots: [{ options: NPC_DAILY_CORES }], tones: TONE_SUFFIXES },
  'coequipier.vestiaire': { slots: [{ options: TEAMMATE_CORES }], tones: TONE_SUFFIXES },
  'entraineur.consigne': { slots: [{ options: MANAGER_CORES }], tones: TONE_SUFFIXES },
  'legende.discours': {
    slots: [{ options: LEGEND_SPEECH_CORES }, { options: MEMORY_CORES, optional: true }],
    tones: TONE_SUFFIXES,
  },
};

const FALLBACKS: Record<keyof DialogueVars, string> = {
  player: 'le joueur',
  club: 'son club',
  opponent: 'l’adversaire',
  formerClub: 'son ancien club',
  competition: 'la compétition',
  stadium: 'le stade',
  city: 'la ville',
  minute: '45',
  score: '1-0',
  record: 'un record marquant',
  trophy: 'un trophée majeur',
  award: 'une récompense individuelle',
  legend: 'une légende du jeu',
  familyMember: 'un proche',
  injury: 'une blessure',
  rival: 'son grand rival',
  museum: 'son musée',
  statistic: 'des statistiques remarquables',
  teammate: 'un coéquipier',
  manager: 'l’entraîneur',
  journalist: 'un journaliste',
  brand: 'son équipementier',
  season: 'la saison',
};

export interface GeneratedLine {
  readonly text: string;
  readonly register: DialogueRegister;
  readonly tone: DialogueTone;
  /** Empreinte de la combinaison, pour l'anti-répétition. */
  readonly signature: string;
}

export class DialogueEngine {
  /** Fenêtre glissante des signatures récemment produites. */
  private readonly recent: string[] = [];
  private readonly recentSet = new Set<string>();
  private readonly windowSize: number;
  private generated = 0;

  constructor(windowSize = 400) {
    this.windowSize = windowSize;
  }

  get linesGenerated(): number {
    return this.generated;
  }

  /**
   * Génère une réplique. Si la combinaison tirée a déjà été entendue
   * récemment, jusqu'à `attempts` nouveaux tirages sont effectués.
   */
  generate(
    register: DialogueRegister,
    tone: DialogueTone,
    vars: DialogueVars,
    rng: Rng,
    attempts = 6,
  ): GeneratedLine {
    const grammar = GRAMMARS[register];
    let best: GeneratedLine | null = null;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const parts: string[] = [];
      const signatureParts: string[] = [register, tone];
      for (const slot of grammar.slots) {
        if (slot.optional && rng.chance(0.45)) {
          signatureParts.push('-');
          continue;
        }
        const index = rng.int(0, slot.options.length - 1);
        signatureParts.push(String(index));
        parts.push(slot.options[index] as string);
      }
      const suffixes = grammar.tones[tone] ?? TONE_SUFFIXES.neutre;
      const suffixIndex = rng.int(0, suffixes.length - 1);
      signatureParts.push(`s${suffixIndex}`);

      const signature = signatureParts.join('|');
      const raw = `${parts.join(', ')}${suffixes[suffixIndex] ?? ''}`;
      const line: GeneratedLine = {
        text: capitalise(this.interpolate(raw, vars)),
        register,
        tone,
        signature,
      };
      if (!this.recentSet.has(signature)) {
        this.markUsed(signature);
        this.generated++;
        return line;
      }
      best = line;
    }
    // Toutes les tentatives sont déjà connues : on accepte la dernière.
    const fallback = best as GeneratedLine;
    this.markUsed(fallback.signature);
    this.generated++;
    return fallback;
  }

  /** Remplace les variables ; celles absentes reçoivent une valeur générique. */
  private interpolate(template: string, vars: DialogueVars): string {
    return template.replace(/\{(\w+)\}/g, (_match, key: string) => {
      const typedKey = key as keyof DialogueVars;
      return vars[typedKey] ?? FALLBACKS[typedKey] ?? key;
    });
  }

  private markUsed(signature: string): void {
    this.recent.push(signature);
    this.recentSet.add(signature);
    while (this.recent.length > this.windowSize) {
      const removed = this.recent.shift();
      if (removed) this.recentSet.delete(removed);
    }
  }

  /** Nombre de combinaisons distinctes possibles pour un registre et un ton. */
  variantCount(register: DialogueRegister, tone: DialogueTone): number {
    const grammar = GRAMMARS[register];
    let total = 1;
    for (const slot of grammar.slots) {
      total *= slot.optional ? slot.options.length + 1 : slot.options.length;
    }
    const suffixes = grammar.tones[tone] ?? TONE_SUFFIXES.neutre;
    return total * suffixes.length;
  }

  /** Volume combinatoire total, tous registres et tous tons confondus. */
  totalVariantCount(): number {
    let total = 0;
    for (const register of Object.keys(GRAMMARS) as DialogueRegister[]) {
      for (const tone of Object.keys(TONE_SUFFIXES) as DialogueTone[]) {
        total += this.variantCount(register, tone);
      }
    }
    return total;
  }

  reset(): void {
    this.recent.length = 0;
    this.recentSet.clear();
  }
}

function capitalise(text: string): string {
  if (text.length === 0) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export const DIALOGUE_REGISTERS = Object.keys(GRAMMARS) as DialogueRegister[];
export const DIALOGUE_TONES = Object.keys(TONE_SUFFIXES) as DialogueTone[];
