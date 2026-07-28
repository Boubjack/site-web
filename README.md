# Infinity Football

Moteur de simulation complet d'un « Football Life Simulator » : monde ouvert
vivant, carrière de joueur, modes Entraîneur et Président, IA à mémoire,
économie et patrimoine, médias, Boubjack Awards, héritage — plus le Game Design
Document intégral dont il découle.

Écrit en TypeScript strict, **sans aucune dépendance d'exécution**.

## Ce que contient ce dépôt

| Dossier | Contenu |
| --- | --- |
| `src/` | Le moteur de simulation complet : 22 systèmes, ~29 000 lignes |
| `tests/` | 37 tests moteur (`node --test`) + 75 tests du prototype navigateur |
| `web/` | Le tableau de bord du monde vivant, servi par `npm run web` |
| `docs/` | [Architecture](docs/architecture.md) et [couverture des tomes](docs/tomes.md) |
| `js/`, `*.html`, `css/` | Le site : GDD intégral, prototype jouable, traçabilité, tests |

Le rendu 3D, les maillages, les textures, l'audio échantillonné et le réseau
temps réel n'y sont pas : ils appartiennent au moteur hôte. Ce dépôt contient la
couche simulation — la logique de jeu, entièrement exécutable et testée.

## Démarrer

Node 20 ou plus récent.

```bash
npm install          # typescript et @types/node uniquement
npm test             # compile puis exécute les 37 tests
npm run simulate     # démonstration headless : deux saisons, cérémonie, rapports
npm run web          # tableau de bord sur http://localhost:8080
```

Le site statique (GDD, prototype navigateur, traçabilité) ne demande aucune
installation :

```bash
python3 -m http.server 8000   # puis http://localhost:8000
node tests/run.js             # 75 tests du prototype
```

## Le tableau de bord

`npm run web` crée un monde unique côté serveur qui **avance en continu** — 20
minutes de jeu par seconde réelle — que quelqu'un regarde la page ou non. Le
tableau de bord affiche en direct la carrière, la ville et sa météo, la une de la
presse, le patrimoine, le dernier match avec sa carte de chaleur et ses
commentaires, le smartphone, les habitants alentour, les scores de qualité, et
donne accès à la console développeur ainsi qu'aux Boubjack Awards.

| Route | Méthode | Effet |
| --- | --- | --- |
| `/api/state` | GET | État complet du monde |
| `/api/advance?days=N` | POST | Avance de N jours (1 à 90) |
| `/api/match` | POST | Joue la prochaine rencontre du joueur |
| `/api/console?c=…` | POST | Exécute une commande de la console développeur |
| `/api/street?showboat=…` | POST | Dispute une session de football de rue |
| `/api/ceremony` | POST | Déroule une édition des Boubjack Awards |

## Utiliser le moteur depuis du code

```ts
import { InfinityFootball } from './src/index.js';

const game = new InfinityFootball({ seed: 'ma-graine', richWorld: true }).start();

game.createCareer({
  name: 'Amadou Traoré',
  nationality: 'ml',
  position: 'MOC',
  age: 18,
  potential: 90,
});

game.simulateSeason({ playMatches: true });

console.log(game.career.trophyList);
console.log(game.media.frontPage(5));
console.log(game.quality.balanceReport());

await game.save('slot-1', 'manual');
```

Une même graine reproduit exactement le même monde, la même saison et les mêmes
titres décernés.

## Repères techniques

- **Déterminisme** — sfc32 avec un flux dérivé nommé par système ; ajouter un
  tirage quelque part ne décale rien ailleurs.
- **Génération procédurale** — la géométrie du monde n'est jamais sauvegardée,
  elle est régénérée depuis la graine. Seuls les deltas vivants sont persistés.
- **Événements typés** — ~63 types d'événements, bus priorisé, erreurs isolées
  par abonné.
- **Niveau de détail** — la ville où se trouve le joueur est simulée à l'heure,
  les autres rattrapent une fois par jour. Une saison complète : ~14 s.
- **Sauvegardes** — version 4, chaîne de migrations, somme de contrôle FNV-1a,
  refus explicite d'une sauvegarde corrompue.
- **Équilibrage** — ≈ 2,5 buts par match, ≈ 45 % de victoires à domicile,
  ≈ 25 % de nuls, vérifié en continu par `balanceReport()`.
- **Dialogue** — 1 689 480 répliques distinctes, anti-répétition à fenêtre
  glissante.
- **Football de rue** — 273 terrains dans les quartiers, 8 disciplines, 16
  gestes, légendes locales à mémoire, vidéos virales, recruteurs anonymes,
  8 tournois dont 2 secrets. La rue fait progresser de vrais attributs et peut
  ouvrir une porte professionnelle.

Le détail est dans [`docs/architecture.md`](docs/architecture.md).

## Licence et contenu

Univers, clubs, marques, stades, arbitres et personnages entièrement fictifs.
Dépôt privé, non distribué.
