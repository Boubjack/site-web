# Architecture du moteur Infinity Football

Ce document décrit le moteur de simulation qui vit dans `src/`. Il s'adresse à
quelqu'un qui doit modifier le code, y brancher un nouveau système, ou porter
la simulation dans un moteur 3D.

## 1. Ce que le dépôt contient — et ce qu'il ne contient pas

Le dépôt contient **la couche simulation complète** d'Infinity Football :
le monde, le temps, l'IA, la carrière, le football, l'économie, les médias,
l'héritage, le smartphone, le multijoueur, l'outillage et les tests. Tout est
exécutable : `npm test`, `npm run simulate`, `npm run web`.

Il ne contient pas le rendu 3D, les maillages, les textures, l'audio échantillonné
ni la couche réseau temps réel. Ces éléments appartiennent au moteur hôte
(Unreal, Unity, moteur maison). La frontière est nette : le moteur de simulation
ne connaît que des données et des événements, jamais un pixel. C'est ce qui rend
le portage possible sans réécrire la logique de jeu.

Volume actuel : 55 fichiers TypeScript, ~27 400 lignes dans `src/`, ~800 lignes
de tests, 35 tests, zéro dépendance d'exécution.

## 2. Principes structurants

### 2.1 Aucune dépendance d'exécution

`package.json` ne déclare que `typescript` et `@types/node` en développement. Le
moteur tourne sur Node ≥ 20, dans un navigateur moderne, ou derrière un binding
natif. Aucun paquet tiers ne peut casser une compilation ou introduire une
divergence de comportement entre plateformes.

### 2.2 Déterminisme intégral

Toute la simulation dérive d'une graine unique. `src/core/rng.ts` implémente
sfc32 et expose `derive(label)` : chaque système tire dans **son propre flux**,
nommé (`world.weather`, `career.creation`, `phone.trends`…). Deux conséquences :

- une même graine reproduit le même monde, la même saison, les mêmes titres ;
- ajouter un tirage dans un système ne décale pas les tirages des autres.

`Rng.save()` / `restore()` sérialisent l'état des flux, ce qui rend une partie
rechargée strictement identique à la partie sauvegardée.

### 2.3 Génération procédurale, sauvegarde différentielle

`WorldGenerator` produit quartiers, rues, lieux, intérieurs, accessoires, secrets
et réseaux (air, rail, mer) à partir de la graine. Cette géométrie n'est **jamais
sauvegardée** : elle est régénérée à l'identique au chargement. Seuls les deltas
vivants — météo, trafic, occupation, PNJ, mémoire, carrière, patrimoine — entrent
dans la sauvegarde. Un monde de 64 villes et 20 000 lieux tient donc dans une
sauvegarde de quelques centaines de kilo-octets.

### 2.4 Événements typés plutôt qu'appels croisés

`src/core/events.ts` déclare un catalogue de ~63 types d'événements et la table
`GameEventMap` qui associe chaque nom à sa charge utile. `EventBus`
(`src/core/event-bus.ts`) diffuse avec priorités, isole les erreurs de chaque
abonné, et met en file d'attente les émissions réentrantes pour qu'un abonné
puisse émettre sans corrompre l'itération en cours.

Résultat : la mémoire des PNJ, la presse, les archives et l'héritage s'abonnent
tous à `match.ended` sans que le moteur de match ne les connaisse.

**Règle de conception apprise à l'usage :** un événement doit désigner un seul
fait. `career.trophyWon` a longtemps servi à la fois aux titres du joueur et aux
titres de tous les clubs du monde ; le musée du joueur absorbait alors les
43 palmarès décernés chaque saison. La séparation en `career.trophyWon` (le
joueur) et `competition.decided` (le monde) a corrigé le problème à la racine.

### 2.5 Services, pas de singletons

`SimulationContext` porte un registre : `provide(clé, instance)`,
`require(clé)` (obligatoire), `optional(clé)` (facultatif). Un système déclare
ses dépendances dans `init()`. Si une dépendance manque, l'initialisation lève,
le système est désactivé et l'ordonnanceur le journalise — au lieu d'une panne
silencieuse.

C'est ce mécanisme qui a révélé un défaut d'ordre : `PhoneSystem` (ordre 85)
s'initialisait avant `MediaSystem` (90) et `WorldCalendar` (105) dont il dépend.
Son ordre est passé à 140.

### 2.6 Ordonnanceur à cadences

`src/core/system.ts` définit l'interface `GameSystem` : `metadata` (id, nom,
ordre, tomes couverts) plus des crochets optionnels
`onTick / onHour / onDay / onWeek / onMonth / onSeason / onYear`. L'ordonnanceur
initialise et exécute par `order` croissant, mesure chaque phase via le profileur,
et désactive un système après cinq échecs consécutifs plutôt que de laisser une
exception répétée noyer la partie.

L'horloge (`src/core/clock.ts`) travaille en minutes absolues depuis le
2025-01-01 et **avance jusqu'à chaque frontière horaire exactement**. Une avance
rapide de 400 heures déclenche 400 passages `onHour`, jamais moins : sans cela,
la météo, l'ouverture des lieux et les emplois du temps des PNJ se figeaient
pendant les sauts de temps.

## 3. Le noyau, fichier par fichier

| Fichier | Rôle |
| --- | --- |
| `core/math.ts` | Vec2/Vec3, `clamp`, `lerp`, `damp`, `smoothStep`, `haversineKm`, `bearingDeg`, bruit `fbm1D`, hachage FNV-1a |
| `core/rng.ts` | sfc32, flux dérivés nommés, `range/int/chance/pick/weighted/shuffle/gaussian` |
| `core/clock.ts` | Temps absolu, calendrier, frontières horaires garanties |
| `core/events.ts` | Catalogue typé des événements du monde |
| `core/event-bus.ts` | Diffusion priorisée, isolation d'erreurs, file de réentrance, historique |
| `core/context.ts` | Contexte partagé : horloge, bus, flux aléatoires, journal, profileur, registre de services |
| `core/system.ts` | Interface `GameSystem`, ordonnanceur, cadences |
| `core/logger.ts` | Journal hiérarchique avec compteurs par niveau |
| `core/profiler.ts` | Mesure par étiquette, moyennes, budgets par cadence |
| `core/save.ts` | Enveloppe versionnée (v4), chaîne de migrations, JSON stable, somme FNV-1a |

## 4. Les données du monde

`src/data/` contient le contenu écrit à la main, pas de la génération :
36 pays, 64 villes géolocalisées, 200 clubs, 36 stades, 43 compétitions,
19 marques, 26 produits, 11 véhicules, 34 activités, 14 répertoires de prénoms
et noms par culture.

Les clubs méritent une précision. 39 clubs sont écrits à la main ; les autres
sont **complétés de façon déterministe** par `buildFillerClubs()` pour qu'aucun
championnat ne descende sous huit clubs. Sans ce complément, certaines ligues
comptaient un seul club, ne produisaient aucune rencontre, et une saison entière
se déroulait sans match. Les clubs de complément dérivent des villes réelles du
pays via `hashString`, donc ils sont stables d'une exécution à l'autre.

## 5. Les 21 systèmes

Ordre d'initialisation et tomes couverts :

| Ordre | Système | Tomes |
| --- | --- | --- |
| 10 | Monde vivant | II, XIX, XX, XXIX, XXX, XXXII |
| 30 | PNJ persistants | I, VIII, XX, XXXII |
| 40 | Économie & patrimoine | XXIII, XXIV, XXVI |
| 50 | Saisons & compétitions | XVII, XIX, XXVIII |
| 60 | Carrière du joueur | IV, XXI, XXVI, XXVIII |
| 65 | Voyages & transports | XVI, XXX |
| 70 | Commerce & livraisons | XXII, XXIV, XXX |
| 75 | Vie personnelle | XI, XVI, XX, XXVI, XXX, XXXI |
| 80 | Univers sonore | IX, XIV, XXXI |
| 90 | Médias & presse | VIII, XXVII, XXVIII |
| 95 | Animations & détails humains | XIV, XX, XXXI |
| 100 | Boubjack Awards | VII, XVII, XIX, XXI |
| 105 | Calendrier mondial | XIX, VII, XXIX |
| 110 | Legacy & archives mondiales | XVII, XXI, XXVI, XXVIII, XXXII |
| 115 | Cinématiques & réalisation | XIV, XVI, XXV |
| 120 | Mode Entraîneur | V, XXIX |
| 125 | Mode Président | VI, XXIX |
| 130 | Interface utilisateur | XII, XIV, XXV |
| 135 | Multijoueur & univers social | X, XV |
| 140 | Smartphone & vie numérique | VIII, XI, XII |
| 200 | Qualité & tests | XV, XXII |

Le détail tome par tome est dans [`tomes.md`](tomes.md).

## 6. Points d'implémentation notables

### 6.1 Niveau de détail de simulation

Simuler 64 villes à l'heure coûtait plus de dix minutes par saison. `WorldSystem`
distingue désormais les villes **détaillées** — celle où se trouve le joueur, plus
celles dont la festivité dépasse 0,3 — des autres :

- villes détaillées : ouverture des lieux et occupation recalculées chaque heure ;
- autres villes : météo, trafic et événements de rue à l'heure, rattrapage
  d'ouverture et d'occupation une fois par jour.

`TravelSystem` appelle `setFocusCity` à chaque déplacement. Une saison complète
est passée de plus de 600 s à environ 14 s, sans que le joueur perçoive de
différence : ce qu'il regarde est toujours simulé finement.

### 6.2 Moteur de match

Deux moteurs coexistent :

- **rencontres du joueur** : moteur à chaînes de possession, action par action,
  avec duels, progression par zones, tirs, arrêts du gardien, arbitre doté d'une
  personnalité et d'une mémoire, tactiques et contre-plans ;
- **rencontres du monde** : modèle de Poisson pondéré par la force relative
  apprise, l'avantage du terrain et l'ambiance du stade.

Les deux sont calibrés sur les mêmes cibles réelles : ≈ 2,7 buts par match,
≈ 45 % de victoires à domicile, ≈ 25 % de nuls, ≈ 17 tirs dont ≈ 7 cadrés.
`QualitySystem.balanceReport()` mesure ces valeurs sur la saison en cours et les
deux précédentes, et recommande un ajustement quand elles dérivent.

### 6.3 Dialogue

`DialogueEngine` est une grammaire pondérée : 16 registres × 8 tons, avec des
créneaux obligatoires et optionnels. Le volume combinatoire total est de
**1 689 480** répliques distinctes. Une fenêtre glissante anti-répétition
empêche de réentendre une combinaison déjà servie récemment. Le seuil du Tome IX
(500 000) est un test automatisé, pas une intention : `tests/core.test.ts` échoue
si le volume redescend en dessous.

### 6.4 Mémoire des personnages

`MemoryBank` applique une décroissance exponentielle avec **plancher de
permanence** : un souvenir marqué historique ne s'efface jamais. Un supporter se
souviendra toujours du but qui a donné le titre, mais oubliera une rencontre
anodine de novembre.

### 6.5 Navigation

`CityNavGraph` fait de l'A* local sur le graphe des rues, avec 14 profils de
déplacement (marche, course, vélo, trottinette, voiture, taxi, bus, métro,
tram, train, bateau, avion…). `routeBetweenCities` fait du Dijkstra multimodal
sur les réseaux aérien, ferroviaire et maritime.

## 7. Sauvegarde

`SAVE_FORMAT_VERSION = 4`. Une enveloppe porte un nombre magique, la version, une
somme de contrôle FNV-1a calculée sur un JSON à clés triées, et les métadonnées
d'affichage. `loadEnvelope` valide le nombre magique, applique la chaîne de
migrations 1 → 2 → 3 → 4, puis vérifie la somme : une sauvegarde corrompue est
refusée explicitement au lieu de produire une partie incohérente.

Chaque système implémente `saveState()` / `loadState()`. Les champs ajoutés après
coup sont rétro-compatibles par défaut côté système (voir le `storyKey` des
articles de presse, reconstruit depuis le titre au chargement d'une sauvegarde
antérieure).

## 8. Qualité et outillage

`src/devtools/` contient :

- **`quality-system.ts`** — 7 suites de tests internes exécutables en jeu,
  scores de stabilité, fluidité, cohérence, réalisme, immersion et performances,
  rapport d'équilibrage, manifeste de mise à jour ;
- **`dev-console.ts`** — 10 commandes (`aide`, `temps`, `systemes`, `perf`,
  `logs`, `evenements`, `monde`, `donnees`, `valider`, `graine`) ;
- **`headless-runner.ts`** — démonstration exécutable de bout en bout ;
- **`web-server.ts`** — serveur du tableau de bord.

Le budget de performance est mesuré **par cadence** : `HOUR_BUDGET_MS = 40`,
`DAY_BUDGET_MS = 150`. Une première version sommait toutes les étiquettes du
profileur — initialisation et phases quotidiennes comprises — contre un budget
de trame de 16,6 ms, et déclarait donc le moteur perpétuellement trop lent.
La métrique était fausse, pas le moteur ; `phaseCostMs()` ne retient plus que
les étiquettes de la phase concernée.

## 9. Tableau de bord web

`npm run web` démarre `src/devtools/web-server.ts` sur le port 8080. Un monde
unique est créé au démarrage et **avance en continu** (20 minutes de jeu par
seconde réelle), que quelqu'un regarde la page ou non — le principe du Tome II.

| Route | Méthode | Effet |
| --- | --- | --- |
| `/` | GET | `web/index.html`, le tableau de bord |
| `/api/state` | GET | État complet du monde en JSON |
| `/api/advance?days=N` | POST | Avance de N jours (1 à 90) |
| `/api/match` | POST | Joue la prochaine rencontre du joueur |
| `/api/console?c=…` | POST | Exécute une commande de la console développeur |
| `/api/ceremony` | POST | Déroule une édition des Boubjack Awards |

Le client est un unique fichier HTML sans dépendance : il interroge `/api/state`
toutes les trois secondes et redessine carrière, monde, presse, patrimoine,
match, smartphone, lieux, secrétaire, qualité et systèmes.

## 10. Étendre le moteur

Ajouter un système se fait en quatre gestes :

1. écrire une classe qui implémente `GameSystem`, avec `metadata` (id, nom,
   `order`, tomes couverts) ;
2. déclarer ses dépendances dans `init()` via `context.require` / `optional`,
   et se publier avec `context.provide` si d'autres en dépendront ;
3. s'abonner aux événements utiles, et émettre les siens — en ajoutant leur type
   à `GameEventMap` plutôt qu'en réutilisant un type voisin ;
4. l'enregistrer dans `src/game.ts` et exporter son API depuis `src/index.ts`.

Un système qui ne sauvegarde rien n'a pas besoin de `saveState`. Un système qui
en a besoin doit tolérer l'absence des champs récents : les sauvegardes
existantes ne les portent pas.
