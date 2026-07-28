# Couverture des tomes du Game Design Document

Ce document relie chaque tome du GDD au code qui l'implémente. Il sert à deux
choses : vérifier qu'aucune intention du document n'est restée lettre morte, et
savoir où intervenir quand un tome évolue.

Le corpus source compte **33 entrées pour 30 tomes distincts** :

- les tomes **XI** et **XII** figurent deux fois à l'identique dans le document
  transmis ; la seconde occurrence n'ajoute rien ;
- le tome **XXX** existe en deux versions, 1.0 (« L'univers complet ») et 2.0
  (« Édition ultime ») ; les deux sont couvertes par les mêmes systèmes ;
- les tomes **XIII** et **XVIII** ne figurent pas dans le corpus transmis. Leurs
  emplacements sont réservés. Rien n'est implémenté pour eux, faute de contenu
  à implémenter — ce sont les deux seules lignes vides de ce tableau.

Le corpus intégral est conservé dans `js/data/gdd.js` et consultable sur la
page `gdd.html` du site.

## Matrice de couverture

| Tome | Titre | Systèmes | Modules |
| --- | --- | --- | --- |
| I | Vision du projet | PNJ persistants | `ai/npc.ts`, `ai/memory.ts`, `ai/personality.ts` |
| II | Open World | Monde vivant, Voyages & transports | `world/generator.ts`, `world/model.ts`, `world/venues.ts`, `world/navigation.ts`, `world/world-system.ts`, `transport/travel-system.ts` |
| III | Gameplay football | Saisons & compétitions, Carrière du joueur | `football/match-engine.ts`, `football/tactics.ts`, `football/referee.ts`, `football/match-orchestrator.ts`, `career/season-system.ts` |
| IV | Mode carrière joueur | Carrière du joueur | `career/career-system.ts`, `career/player.ts` |
| V | Mode entraîneur | Mode Entraîneur | `football/manager-system.ts`, `football/tactics.ts` |
| VI | Mode président | Mode Président | `football/president-system.ts` |
| VII | Boubjack Awards | Boubjack Awards, Calendrier mondial | `events/boubjack-awards.ts`, `events/world-calendar.ts` |
| VIII | Intelligence artificielle | PNJ persistants, Médias & presse, Smartphone & vie numérique | `ai/npc.ts`, `ai/memory.ts`, `ai/personality.ts`, `ai/dialogue.ts`, `media/media-system.ts`, `phone/phone-system.ts` |
| IX | Commentateurs & univers sonore | Univers sonore | `audio/commentary.ts`, `audio/audio-system.ts`, `ai/dialogue.ts` |
| X | Multijoueur & univers social | Multijoueur & univers social | `multiplayer/multiplayer-system.ts` |
| XI | Téléphone, réseaux sociaux & vie personnelle | Vie personnelle, Smartphone & vie numérique | `phone/phone-system.ts`, `life/life-system.ts` |
| XII | Interface utilisateur (UI/UX) | Interface utilisateur, Smartphone & vie numérique | `ui/ui-system.ts`, `phone/phone-system.ts` |
| XIII | *(emplacement réservé — non transmis)* | — | — |
| XIV | Direction artistique & identité visuelle | Univers sonore, Animations & détails humains, Cinématiques & réalisation, Interface utilisateur | `animation/animation-system.ts`, `cinematics/cinematic-system.ts`, `ui/ui-system.ts`, `audio/audio-system.ts` |
| XV | Qualité, tests & production AAA | Qualité & tests, Multijoueur & univers social | `devtools/quality-system.ts`, `devtools/dev-console.ts`, `tests/` |
| XVI | Cinématiques, mise en scène & réalisation | Cinématiques & réalisation, Voyages & transports | `cinematics/cinematic-system.ts`, `transport/travel-system.ts` |
| XVII | Legacy System & histoire du monde | Legacy & archives mondiales, Saisons & compétitions, Boubjack Awards | `legacy/legacy-system.ts`, `career/season-system.ts` |
| XVIII | *(emplacement réservé — non transmis)* | — | — |
| XIX | Événements mondiaux & calendrier dynamique | Calendrier mondial, Monde vivant, Saisons & compétitions, Boubjack Awards | `events/world-calendar.ts`, `world/world-system.ts`, `career/season-system.ts` |
| XX | Immersion extrême & détails de vie | Monde vivant, PNJ persistants, Vie personnelle, Animations & détails humains | `world/world-system.ts`, `ai/npc.ts`, `life/life-system.ts`, `animation/animation-system.ts` |
| XXI | Carrière après la retraite & vie d'une légende | Carrière du joueur, Vie personnelle, Boubjack Awards, Legacy & archives mondiales | `career/career-system.ts`, `legacy/legacy-system.ts`, `life/life-system.ts` |
| XXII | Expansions, mods & écosystème | Qualité & tests | `devtools/quality-system.ts`, `devtools/dev-console.ts` |
| XXIII | Économie mondiale & patrimoine | Économie & patrimoine | `economy/economy-system.ts` |
| XXIV | Licences, marques & expérience premium | Économie & patrimoine, Commerce & livraisons | `data/brands.ts`, `commerce/commerce-system.ts`, `economy/economy-system.ts` |
| XXV | Technologies du futur & innovations | Cinématiques & réalisation, Interface utilisateur | `cinematics/cinematic-system.ts`, `ui/ui-system.ts` |
| XXVI | Le joueur au centre de l'univers | Carrière du joueur, Économie & patrimoine, Commerce & livraisons, Vie personnelle, Legacy & archives mondiales | `career/career-system.ts`, `media/media-system.ts`, `legacy/legacy-system.ts`, `life/life-system.ts` |
| XXVII | Médias, presse & diffusion mondiale | Médias & presse | `media/media-system.ts` |
| XXVIII | Records, statistiques & archives mondiales | Legacy & archives mondiales, Saisons & compétitions, Carrière du joueur, Médias & presse | `legacy/legacy-system.ts`, `career/season-system.ts`, `career/player.ts` |
| XXIX | Stades, infrastructures & villes du football | Monde vivant, Calendrier mondial, Mode Entraîneur, Mode Président | `data/clubs.ts`, `world/world-system.ts`, `football/president-system.ts` |
| XXX (1.0 & 2.0) | L'univers complet d'Infinity Football | Monde vivant, Voyages & transports, Commerce & livraisons, Vie personnelle | `world/`, `transport/travel-system.ts`, `commerce/commerce-system.ts`, `life/life-system.ts` |
| XXXI | Animations, détails humains & réalisme | Animations & détails humains, Vie personnelle, Univers sonore | `animation/animation-system.ts`, `life/life-system.ts`, `audio/audio-system.ts` |
| XXXII | L'univers sans limites | Monde vivant, PNJ persistants, Legacy & archives mondiales | `world/generator.ts`, `ai/npc.ts`, `legacy/legacy-system.ts` |

La colonne « Systèmes » est tenue à jour par le code lui-même : chaque système
déclare les tomes qu'il couvre dans `metadata.tomes`, et la console développeur
(`systemes`) comme le tableau de bord web affichent cette information en direct.

## Ce qui est implémenté, tome par tome

### I — Vision du projet
PNJ persistants avec identité, âge, métier, club de cœur, mémoire et emploi du
temps. Le monde existe indépendamment du joueur : il avance quand personne ne
regarde, y compris pendant que le tableau de bord web est fermé.

### II — Open World
64 villes géolocalisées, générées procéduralement en quartiers, rues, lieux et
intérieurs à partir de la graine. 60 modèles de lieux avec pièces, horaires
d'ouverture et densité de fréquentation. Météo saisonnière par latitude et
hémisphère, trafic horaire, occupation hôtelière, événements de rue, décorations
d'événement. Navigation A* dans la ville, Dijkstra multimodal entre les villes,
14 profils de déplacement.

### III — Gameplay football
Deux moteurs. Pour les rencontres du joueur : chaînes de possession action par
action, duels, progression par zones, tirs, arrêts, cartons, arbitre à
personnalité et mémoire, six formations et contre-plans tactiques. Pour le reste
du monde : Poisson pondéré par la force apprise, l'avantage du terrain et
l'ambiance. Les deux visent les mêmes cibles réelles, contrôlées par
`balanceReport()`.

### IV — Mode carrière joueur
26 attributs pondérés par poste, courbe d'âge, valeur marchande, contrats et
clauses, transferts en neuf étapes, contrats d'équipementier avec exclusivité,
entraînement, blessures, forme, moral, vie de star, trophées, récompenses,
sélections, retraite.

### V — Mode entraîneur
Composition, formations, consignes, gestion du vestiaire, recrutement avec
rapports de scouting bruités selon la qualité du recruteur, plans de match et
contre-plans mémorisés d'un adversaire à l'autre.

### VI — Mode président
Finances du club, billetterie, salaires, travaux de stade, votes du conseil
d'administration, politique sportive et relations avec les supporters.

### VII — Boubjack Awards
17 catégories, ville hôte choisie sans répétition, tapis rouge, design de scène
et de trophée, présentateurs, séquence de suspense, palmarès archivé.

### VIII — Intelligence artificielle
Mémoire à décroissance exponentielle avec plancher de permanence, personnalités
Big Five plus profil footballistique, moteur de dialogue à grammaire pondérée
(1 689 480 combinaisons, anti-répétition à fenêtre glissante), emplois du temps
de PNJ sensibles au niveau de détail.

### IX — Commentateurs & univers sonore
Commentaires générés en direct par la grammaire, plusieurs voix avec registres
et tons distincts, ambiances de stade, musique contextuelle.

### X — Multijoueur & univers social
Hubs, clubs de joueurs, événements communautaires, coopération, détection de
triche, synchronisation nuage.

### XI — Téléphone, réseaux sociaux & vie personnelle
21 applications, IA secrétaire qui produit un briefing quotidien, messagerie,
réseaux sociaux avec abonnés et tendances hebdomadaires, snapstreaks, banque,
commandes, batterie qui se vide le jour et se recharge la nuit.

### XII — Interface utilisateur (UI/UX)
HUD, carte, menus, options d'accessibilité, difficulté adaptative.

### XIV — Direction artistique & identité visuelle
33 familles d'animation, 486 variantes, sélection contextuelle ; identité
visuelle des cérémonies ; réalisation télévisée.

### XV — Qualité, tests & production AAA
7 suites de tests internes exécutables en jeu, scores de qualité, rapport
d'équilibrage, manifeste de mise à jour, console développeur à 10 commandes,
35 tests automatisés.

### XVI — Cinématiques, mise en scène & réalisation
Réalisation télévisée pilotée par l'IA, plans et angles d'archive, voyages
jouables en plusieurs étapes.

### XVII — Legacy System & histoire du monde
Enchaînement des saisons sans perte, palmarès mondial, ligne du temps du joueur,
archives, musée, Hall of Fame, documentaires, album.

### XIX — Événements mondiaux & calendrier dynamique
12 familles d'événements mondiaux avec fan zones et cérémonies, calendrier des
compétitions, décoration des villes hôtes.

### XX — Immersion extrême & détails de vie
Météo et saisons crédibles, lieux qui ouvrent et ferment, PNJ qui vivent leur
journée, événements de rue, détails d'ambiance.

### XXI — Carrière après la retraite & vie d'une légende
11 rôles d'après-carrière, statut de légende, hommages, monuments, musée.

### XXII — Expansions, mods & écosystème
Validation de contenu, éditeur de données en console, manifeste de mise à jour,
retours communautaires.

### XXIII — Économie mondiale & patrimoine
Comptes, transactions, investissements, biens immobiliers, employés, collections,
garage, succession.

### XXIV — Licences, marques & expérience premium
19 marques, 26 produits, 11 véhicules, contrats d'équipementier exclusifs,
commerce et livraison physique.

### XXV — Technologies du futur & innovations
Analyse d'après-match avec carte de chaleur à 12 zones, réalisation automatique,
interface adaptative.

### XXVI — Le joueur au centre de l'univers
Réputation, célébrité, influence, relation aux supporters, retentissement de
chaque décision sur les médias, l'économie et l'héritage.

### XXVII — Médias, presse & diffusion mondiale
8 rédactions avec ligne éditoriale et relation au joueur, journalistes dotés
d'une mémoire, une du jour variée, alertes en direct, grille TV, podcasts,
conférences de presse interactives.

### XXVIII — Records, statistiques & archives mondiales
Statistiques par saison et cumulées, records mondiaux, archives multi-angles,
palmarès de toutes les compétitions.

### XXIX — Stades, infrastructures & villes du football
36 stades avec capacité et ambiance, travaux d'agrandissement, villes de football
décorées les jours de match.

### XXX — L'univers complet
Le monde, les voyages, le commerce et la vie personnelle forment un tout : on
peut aller d'un appartement à un stade à l'autre bout du monde en enchaînant les
étapes réelles du trajet.

### XXXI — Animations, détails humains & réalisme
Sélection d'animation selon le contexte, la fatigue, l'humeur et le lieu.

### XXXII — L'univers sans limites
Génération procédurale illimitée, PNJ persistants en nombre, archives sans
plafond fonctionnel, monde qui continue après la carrière.
