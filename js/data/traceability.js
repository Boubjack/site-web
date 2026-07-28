/**
 * traceability.js — Matrice de traçabilité GDD → implémentation.
 *
 * Ce fichier est le document le plus important du dépôt sur le plan de la
 * production : il indique, chapitre par chapitre, ce qui est réellement
 * implémenté dans ce prototype web, ce qui est modélisé sous forme de données
 * et de règles, et ce qui relève d'une production moteur 3D hors de portée
 * d'une application web (rendu, animation, audio spatial, capture de
 * mouvement, réseau temps réel).
 *
 * Le Tome XV ch. 1 exige qu'« aucune fonctionnalité incomplète ne soit
 * publiée ». Le corollaire honnête est celui-ci : on ne déclare pas terminé
 * ce qui ne l'est pas. Cette matrice est donc volontairement franche.
 *
 * Statuts :
 *   'implemented' — le comportement s'exécute réellement dans le prototype
 *   'modelled'    — la règle métier et les données existent et sont exploitées,
 *                   mais la restitution finale suppose un moteur 3D
 *   'engine'      — relève exclusivement du moteur de jeu (rendu, animation,
 *                   audio spatial, physique, netcode) : hors périmètre du web
 */

export const STATUS_LABELS = {
  implemented: { label: 'Implémenté', description: "Le système s'exécute réellement dans le prototype.", color: 'ok' },
  modelled: { label: 'Modélisé', description: 'Règles et données actives ; la restitution finale suppose le moteur 3D.', color: 'warn' },
  engine: { label: 'Moteur requis', description: 'Rendu, animation, audio spatial ou netcode — hors périmètre web.', color: 'engine' },
};

/**
 * @typedef {{tome:string, chapter:string, requirement:string, status:string, module:string, note:string}} TraceEntry
 */

/** @type {TraceEntry[]} */
export const TRACE = [
  // ── Tome I — Vision ────────────────────────────────────────────────────
  { tome: 'I', chapter: '1.2 Mission', requirement: 'Chaque système est connecté aux autres', status: 'implemented', module: 'core/events.js', note: 'Tous les systèmes communiquent par bus d\'événements ; aucun import direct entre systèmes.' },
  { tome: 'I', chapter: '1.2 Mission', requirement: 'Le monde continue de vivre sans le joueur', status: 'implemented', module: 'core/clock.js, systems/world.js', note: 'Horloge autonome : PNJ, météo, commerces et événements évoluent à chaque jour simulé.' },
  { tome: 'I', chapter: '1.3 Piliers', requirement: 'Cinq piliers : football, open world, vie, IA, héritage', status: 'implemented', module: 'systems/*', note: 'Un système dédié par pilier, tous actifs simultanément.' },
  { tome: 'I', chapter: '1.6 Objectif', requirement: 'Chaque saison doit sembler différente', status: 'implemented', module: 'systems/calendar.js', note: 'Calendrier, adversaires, villes hôtes et évolutions du monde régénérés chaque saison.' },

  // ── Tome II — Open World ───────────────────────────────────────────────
  { tome: 'II', chapter: '1.2 Monde vivant', requirement: 'Habitants, magasins, avions, supporters, routes, hôtels', status: 'implemented', module: 'systems/world.js', note: '40 PNJ suivis dans la durée, commerces qui ouvrent et ferment, hôtels saturables.' },
  { tome: 'II', chapter: '1.3 Aucune zone inutile', requirement: 'Tous les types de lieux sont visitables', status: 'implemented', module: 'data/world.js, systems/world.js', note: '24 types de lieux, chacun avec ses interactions propres ; entrée effective par enterVenue().' },
  { tome: 'II', chapter: '1.4 Liberté', requirement: 'Choix libre de destination, transport, achats, logement', status: 'implemented', module: 'systems/world.js, systems/economy.js', note: 'Voyage vers 20 villes, 14 transports, immobilier et garage réels.' },
  { tome: 'II', chapter: '1.5 Immersion', requirement: 'Ouvrir une porte, monter en voiture, prendre un avion', status: 'modelled', module: 'systems/world.js', note: 'Les étapes existent et se déroulent séquentiellement ; le rendu à la première personne suppose le moteur 3D.' },

  // ── Tome III — Gameplay football ───────────────────────────────────────
  { tome: 'III', chapter: '1 Philosophie', requirement: 'Personnalité, gestuelle, rythme et intelligence propres', status: 'modelled', module: 'systems/match.js', note: 'Attributs, style et poste modulent chaque phase ; la gestuelle relève de l\'animation.' },
  { tome: 'III', chapter: '2 Contrôle du ballon', requirement: 'Dépend de technique, vitesse, pression, météo, pelouse, fatigue', status: 'implemented', module: 'systems/match.js', note: 'Les six facteurs sont des termes explicites du calcul de qualité d\'action.' },
  { tome: 'III', chapter: '3 IA des joueurs', requirement: "L'adversaire apprend et s'adapte au fil des saisons", status: 'implemented', module: 'systems/match.js', note: 'opponentMemory : un adversaire souvent battu resserre son bloc, un adversaire dominant presse haut.' },
  { tome: 'III', chapter: '4 Physique', requirement: 'Contacts non scriptés', status: 'engine', module: '—', note: 'La physique de collision suppose un moteur temps réel. Les issues de duel sont calculées, non scriptées.' },
  { tome: 'III', chapter: '5 Matchs', requirement: 'Ambiance, météo, pression, arbitre, contexte influencent', status: 'implemented', module: 'systems/match.js', note: 'Les cinq entrent dans le contexte de match et modifient le résultat.' },
  { tome: 'III', chapter: '6 Commentateurs', requirement: 'Mémoire complète de la carrière', status: 'implemented', module: 'systems/match.js', note: 'buildCommentary() puise dans anciens clubs, records, trophées, musée, famille, blessures.' },
  { tome: 'III', chapter: '7 Arbitres', requirement: 'Personnalité, tolérance, gestion, réputation distinctes', status: 'implemented', module: 'systems/match.js', note: 'Six arbitres avec seuils de tolérance et sensibilité au public réellement appliqués.' },

  // ── Tome IV — Carrière joueur ──────────────────────────────────────────
  { tome: 'IV', chapter: '1 Début de carrière', requirement: 'Choix du poste, pied, style, nationalité, histoire', status: 'implemented', module: 'ui/creation.js', note: 'Éditeur complet à la création de partie. Génération de visage par photo : moteur requis.' },
  { tome: 'IV', chapter: '2 Évolution', requirement: 'Performances → réputation, valeur, salaire, sponsors, sélection', status: 'implemented', module: 'systems/career.js, systems/match.js', note: 'Les cinq conséquences sont calculées après chaque rencontre.' },
  { tome: 'IV', chapter: '3 Transferts', requirement: 'Négociation, dirigeants, agent, presse, visite, signature', status: 'implemented', module: 'systems/career.js', note: 'Séquence en neuf étapes ; négociation réelle avec l\'agent, offres retirables.' },
  { tome: 'IV', chapter: '4 Contrats', requirement: 'Salaire, primes, bonus, durée, clauses', status: 'implemented', module: 'systems/career.js', note: 'Les cinq composantes existent et les primes sont versées après chaque match.' },
  { tome: 'IV', chapter: '5 Vie de star', requirement: 'Interviews, photos, publicités, caritatif, inaugurations', status: 'implemented', module: 'systems/career.js', note: 'Sept activités avec cachet, effet réputation et coût en bien-être.' },
  { tome: 'IV', chapter: '6 Héritage', requirement: 'Musée, matchs historiques, statistiques, trophées, maillots', status: 'implemented', module: 'systems/career.js, systems/awards.js', note: 'Musée alimenté automatiquement ; archives et palmarès consultables.' },

  // ── Tome V — Mode entraîneur ───────────────────────────────────────────
  { tome: 'V', chapter: '4 Entraînements', requirement: 'Séances physiques, techniques, tactiques, mentales', status: 'implemented', module: 'systems/career.js', note: 'Six séances agissant sur progression, fatigue, moral et risque de blessure.' },
  { tome: 'V', chapter: '2-3, 5-8', requirement: 'Recrutement, tactiques, staff, objectifs, héritage manager', status: 'modelled', module: 'data/world.js', note: 'Données présentes (clubs, prestige, budgets, staff) ; le mode entraîneur jouable reste à construire.' },

  // ── Tome VI — Mode président ───────────────────────────────────────────
  { tome: 'VI', chapter: '2-8', requirement: 'Finances, stade, centre, académie, marketing, conseil', status: 'modelled', module: 'data/world.js, systems/world.js', note: 'Budgets, prestige et évolution des stades simulés ; le tableau de bord présidentiel reste à construire.' },

  // ── Tome VII — Boubjack Awards ─────────────────────────────────────────
  { tome: 'VII', chapter: '2 Organisation', requirement: 'Jamais deux ans de suite dans la même ville', status: 'implemented', module: 'systems/calendar.js', note: 'La ville hôte de l\'année précédente est explicitement exclue du tirage.' },
  { tome: 'VII', chapter: '2 Organisation', requirement: 'Scène, décoration et identité visuelle uniques', status: 'implemented', module: 'systems/awards.js', note: 'Six identités visuelles avec palette et scénographie propres.' },
  { tome: 'VII', chapter: '3 Tapis rouge', requirement: 'Arrivées, interviews, photos, signatures', status: 'implemented', module: 'systems/awards.js', note: 'Tapis rouge généré : joueurs, joueuses, entraîneurs, légendes, célébrités.' },
  { tome: 'VII', chapter: '4 Déroulement', requirement: 'Dix temps, 30 à 45 minutes', status: 'implemented', module: 'systems/awards.js', note: 'CEREMONY_FLOW : dix séquences totalisant 45 minutes.' },
  { tome: 'VII', chapter: '5 Catégories', requirement: 'Les dix-sept catégories avec trophée gravé', status: 'implemented', module: 'data/world.js, systems/awards.js', note: 'Les 17 catégories sont disputées ; le joueur y concourt selon ses statistiques.' },
  { tome: 'VII', chapter: '6 Légendes', requirement: 'Discours changeant chaque année', status: 'implemented', module: 'systems/awards.js', note: 'Discours recomposé à chaque édition à partir du profil de la légende.' },
  { tome: 'VII', chapter: '7 Suspense', requirement: 'Nominés, statistiques, enveloppe, silence, annonce', status: 'implemented', module: 'systems/awards.js, ui/ceremony.js', note: 'Séquence de suspense jouée pas à pas dans l\'interface.' },
  { tome: 'VII', chapter: '8 Fin', requirement: 'Photo, feux d\'artifice, confettis, filigrane permanent', status: 'implemented', module: 'ui/ceremony.js', note: 'Filigrane « Boubjack Awards » en bas à droite pendant toute la cérémonie.' },

  // ── Tome VIII — IA ─────────────────────────────────────────────────────
  { tome: 'VIII', chapter: '2 Mémoire', requirement: 'Chaque IA se souvient des matchs, transferts, rivalités', status: 'implemented', module: 'systems/match.js, systems/media.js', note: 'worldMemory, journalistMemory et opponentMemory persistent en sauvegarde.' },
  { tome: 'VIII', chapter: '3 Supporters', requirement: 'Reconnaissance, selfies, autographes, chants', status: 'implemented', module: 'systems/reputation.js', note: 'Probabilité de reconnaissance calculée par pays et par passion locale.' },
  { tome: 'VIII', chapter: '4 Journalistes', requirement: 'Questions adaptées ; aucune interview identique', status: 'implemented', module: 'systems/media.js', note: 'Cinq archétypes, questions composées depuis le contexte et la mémoire.' },
  { tome: 'VIII', chapter: '5 IA secrétaire', requirement: 'Les treize capacités listées', status: 'implemented', module: 'systems/phone.js', note: 'secretaryBriefing() et ask() couvrent agenda, vols, commandes, finances, actualités, anniversaires, analyse.' },
  { tome: 'VIII', chapter: '6-7', requirement: 'IA des coéquipiers et des entraîneurs', status: 'modelled', module: 'systems/career.js', note: 'Moral, statut dans l\'effectif et sanctions modélisés ; relations individuelles à approfondir.' },
  { tome: 'VIII', chapter: '8 IA du monde', requirement: 'Le monde ne s\'arrête jamais', status: 'implemented', module: 'systems/world.js', note: 'Vie des PNJ, événements de rue et évolution urbaine simulés chaque jour.' },

  // ── Tome IX — Audio ────────────────────────────────────────────────────
  { tome: 'IX', chapter: '2 Commentateurs', requirement: 'Mémoire complète, comparaison aux légendes', status: 'implemented', module: 'systems/match.js', note: 'Texte de commentaire généré ; la voix suppose un enregistrement studio.' },
  { tome: 'IX', chapter: '3 Dialogues', requirement: '500 000 lignes non répétitives', status: 'modelled', module: 'systems/match.js', note: 'Génération combinatoire au lieu de lignes pré-écrites : la répétition est évitée par construction.' },
  { tome: 'IX', chapter: '4 Ambiance', requirement: 'Chants, tambours, tifos, hymne, identité sonore', status: 'engine', module: '—', note: 'Production audio et mixage : hors périmètre web.' },
  { tome: 'IX', chapter: '5 Menus', requirement: 'Musique officielle ou playlists personnelles', status: 'implemented', module: 'systems/phone.js', note: 'Connexion de compte, playlists contextuelles (menus, voiture, maison, entraînement).' },
  { tome: 'IX', chapter: '6 Audio 3D', requirement: 'Audio spatial sur tous les sons', status: 'engine', module: '—', note: 'Nécessite un moteur audio spatialisé.' },
  { tome: 'IX', chapter: '7 Langues', requirement: 'Choix de langue, duo et style de commentaires', status: 'implemented', module: 'core/state.js', note: 'Paramètre persistant ; les enregistrements multilingues relèvent de la production.' },

  // ── Tome X — Multijoueur ───────────────────────────────────────────────
  { tome: 'X', chapter: '2 Hubs sociaux', requirement: 'Hubs dans chaque grande ville', status: 'implemented', module: 'data/world.js', note: 'Hubs présents et visitables dans les huit villes majeures.' },
  { tome: 'X', chapter: '3-6', requirement: 'Clubs, événements, coopération, communauté', status: 'engine', module: '—', note: 'Suppose un serveur de jeu et un netcode : hors périmètre d\'un prototype local.' },
  { tome: 'X', chapter: '8 Sécurité', requirement: 'Protection et sauvegardes automatiques', status: 'implemented', module: 'core/save.js', note: 'Somme de contrôle, versionnage, migrations et sauvegarde automatique.' },

  // ── Tome XI — Téléphone ────────────────────────────────────────────────
  { tome: 'XI', chapter: '2 Applications', requirement: 'Les vingt-et-une applications listées', status: 'implemented', module: 'systems/phone.js, ui/phone.js', note: 'Les 21 apps existent ; les principales sont pleinement fonctionnelles.' },
  { tome: 'XI', chapter: '3 Réseaux sociaux', requirement: 'Commentaires générés par IA, tendances hebdomadaires', status: 'implemented', module: 'systems/phone.js', note: 'Tonalité des commentaires dérivée de la forme et de la relation aux supporters.' },
  { tome: 'XI', chapter: '4 Snapstreak', requirement: 'Snaps, réponses, flammes, stories', status: 'implemented', module: 'systems/phone.js', note: 'Les flammes se perdent réellement après deux jours sans contact.' },
  { tome: 'XI', chapter: '5 Musique', requirement: 'Playlists en menus, voiture, maison, entraînement', status: 'implemented', module: 'systems/phone.js', note: 'nowPlaying(context) sélectionne la playlist adaptée.' },
  { tome: 'XI', chapter: '7 Vie personnelle', requirement: 'Famille, sorties, anniversaires, cadeaux', status: 'implemented', module: 'systems/phone.js', note: 'Proximité évolutive, anniversaires rappelés, cadeaux à rendement décroissant.' },
  { tome: 'XI', chapter: '8 Célébrité', requirement: 'Plus de messages et d\'invitations avec la notoriété', status: 'implemented', module: 'systems/phone.js', note: 'Volume de messages indexé sur la réputation.' },

  // ── Tome XII — UI/UX ───────────────────────────────────────────────────
  { tome: 'XII', chapter: '3 Pause', requirement: 'Menu pause : reprendre, sauvegarder, charger, quitter', status: 'implemented', module: 'ui/app.js', note: 'Le monde reprend exactement où il s\'était arrêté.' },
  { tome: 'XII', chapter: '4 HUD', requirement: 'HUD personnalisable', status: 'implemented', module: 'ui/app.js', note: 'Mini-carte, objectifs, notifications, heure et météo activables séparément.' },
  { tome: 'XII', chapter: '6 Cartes', requirement: 'Carte interactive, recherche, itinéraire', status: 'implemented', module: 'ui/map.js', note: 'Carte du monde, recherche par ville et lieu, calcul de trajet réel.' },
  { tome: 'XII', chapter: '7 Accessibilité', requirement: 'Taille de texte, contraste, animations réduites', status: 'implemented', module: 'ui/app.js, css/main.css', note: 'Trois réglages appliqués immédiatement à toute l\'interface.' },
  { tome: 'XII', chapter: '5 Inventaire', requirement: 'Objets affichés en 3D', status: 'engine', module: '—', note: 'Inventaire fonctionnel en 2D ; le rendu 3D suppose le moteur.' },

  // ── Tome XIV — Direction artistique ────────────────────────────────────
  { tome: 'XIV', chapter: '2 Lumières', requirement: 'Lever, coucher, golden hour, nuit, pluie, brouillard, neige', status: 'implemented', module: 'core/clock.js, systems/weather.js', note: 'Moment du jour et type de temps calculés et exposés à l\'interface.' },
  { tome: 'XIV', chapter: '3-7', requirement: 'Stades vivants, cinématographie, vieillissement, tissus', status: 'engine', module: '—', note: 'Rendu, caméras et simulation de tissu : moteur 3D requis.' },

  // ── Tome XV — Qualité ──────────────────────────────────────────────────
  { tome: 'XV', chapter: '2 Tests', requirement: 'Tests unitaires et d\'intégration avant mise à jour', status: 'implemented', module: 'tests/run.js', note: 'Suite de tests exécutable en navigateur et en ligne de commande.' },
  { tome: 'XV', chapter: '5 Mises à jour', requirement: 'Les anciennes sauvegardes restent compatibles', status: 'implemented', module: 'core/save.js', note: 'Migrations versionnées et réconciliation de schéma automatique.' },
  { tome: 'XV', chapter: '7 Performance', requirement: 'Chargements rapides, faible consommation mémoire', status: 'implemented', module: 'core/*', note: 'Journaux bornés, aucune dépendance externe, modules ES natifs.' },

  // ── Tome XVI — Cinématiques ────────────────────────────────────────────
  { tome: 'XVI', chapter: '2-6', requirement: 'Match day, transferts, vie personnelle, trophées, open world', status: 'modelled', module: 'systems/*, ui/cinematic.js', note: 'Chaque moment déclenche une séquence scénarisée et jouable ; la réalisation 3D relève du moteur.' },

  // ── Tome XVII — Legacy ─────────────────────────────────────────────────
  { tome: 'XVII', chapter: '1 Le temps passe', requirement: 'Saisons, vieillissement, nouvelles générations', status: 'implemented', module: 'core/clock.js, systems/career.js, systems/world.js', note: 'Le joueur et les PNJ vieillissent ; le déclin physique est réel après 30 ans.' },
  { tome: 'XVII', chapter: '2 Histoire', requirement: 'Encyclopédie conservant tout', status: 'implemented', module: 'ui/legacy.js', note: 'Palmarès, records, chronologie et mémoire du monde consultables.' },
  { tome: 'XVII', chapter: '3 Hall of Fame', requirement: 'Joueurs, entraîneurs, présidents, arbitres', status: 'implemented', module: 'systems/awards.js', note: 'Éligibilité calculée sur un score de carrière, pas sur un simple seuil.' },
  { tome: 'XVII', chapter: '4 Musées', requirement: 'Musée personnel évolutif générant des revenus', status: 'implemented', module: 'systems/world.js, systems/career.js', note: 'Visiteurs, recettes et notes des visiteurs simulés quotidiennement.' },
  { tome: 'XVII', chapter: '5 Documentaires', requirement: 'Documentaire personnalisé généré en fin de carrière', status: 'implemented', module: 'systems/media.js', note: 'Chapitres composés depuis les données réelles de la sauvegarde.' },
  { tome: 'XVII', chapter: '7 Héritage', requirement: 'Invitations aux cérémonies pour les légendes', status: 'implemented', module: 'systems/awards.js', note: 'Sept invitations, dont la Coupe du Monde dans le pays d\'origine.' },

  // ── Tome XIX — Événements mondiaux ─────────────────────────────────────
  { tome: 'XIX', chapter: '2 Calendrier', requirement: 'Douze types d\'événements au calendrier mondial', status: 'implemented', module: 'systems/calendar.js', note: 'Championnats, coupes, tournois, cérémonies, jubilés, stages et tournées.' },
  { tome: 'XIX', chapter: '3 Ville hôte', requirement: 'Transformation de la ville hôte', status: 'implemented', module: 'systems/calendar.js', note: 'Décorations, écrans, fan zones, sécurité et hausse des prix effectivement appliquées.' },
  { tome: 'XIX', chapter: '7 Impact', requirement: 'Hôtels complets, prix en hausse, afflux touristique', status: 'implemented', module: 'systems/world.js', note: 'Une réservation peut réellement échouer pendant un tournoi.' },
  { tome: 'XIX', chapter: '5-6', requirement: 'Cérémonies d\'ouverture et de clôture', status: 'modelled', module: 'systems/calendar.js', note: 'Déclenchées et décrites ; le spectacle relève du moteur.' },

  // ── Tome XX — Immersion ────────────────────────────────────────────────
  { tome: 'XX', chapter: '3 Météo', requirement: 'Influence sur PNJ, circulation, plages, activités, pelouse', status: 'implemented', module: 'systems/weather.js', note: 'Les cinq influences sont calculées et bloquent réellement certaines activités.' },
  { tome: 'XX', chapter: '5 Réactions PNJ', requirement: 'Réactions selon célébrité, trophées, club, réputation', status: 'implemented', module: 'systems/world.js', note: 'Six paliers de réaction citant les trophées et récompenses réels.' },
  { tome: 'XX', chapter: '6 Détails', requirement: 'Mariages, concerts, festivals, marchés, travaux, accidents', status: 'implemented', module: 'systems/world.js', note: 'Dix événements de rue dynamiques, certains affectant les temps de trajet.' },
  { tome: 'XX', chapter: '2 Gestes', requirement: 'Gestes du quotidien contextuels', status: 'modelled', module: 'systems/world.js', note: 'Interactions listées par type de lieu ; les animations relèvent du moteur.' },

  // ── Tome XXI — Après-carrière ──────────────────────────────────────────
  { tome: 'XXI', chapter: '2 Professions', requirement: 'Onze métiers d\'après-carrière', status: 'implemented', module: 'systems/career.js', note: 'Les onze rôles avec seuil de réputation et revenu propres.' },
  { tome: 'XXI', chapter: '3 Hall of Fame', requirement: 'Intronisation : discours, veste, plaque, vidéo', status: 'implemented', module: 'systems/awards.js', note: 'Cérémonie complète générée à l\'éligibilité.' },
  { tome: 'XXI', chapter: '4 Musée', requirement: 'Musée évolutif, avis des visiteurs, revenus', status: 'implemented', module: 'systems/world.js', note: 'Notes et fréquentation évoluent avec la réputation.' },

  // ── Tome XXII — Écosystème ─────────────────────────────────────────────
  { tome: 'XXII', chapter: '2 Ajout de contenu', requirement: 'Ajouter villes, pays, stades, clubs sans reconstruire', status: 'implemented', module: 'data/world.js', note: 'Toutes les entités sont des données ; ajouter une ville ne demande aucune modification de code.' },
  { tome: 'XXII', chapter: '4 Vêtements', requirement: 'Un contrat exclusif bloque réellement les marques concurrentes', status: 'implemented', module: 'systems/economy.js', note: 'Intercepteur sur le bus : l\'achat est refusé, pas seulement masqué dans l\'interface.' },
  { tome: 'XXII', chapter: '6 IA évolutive', requirement: 'Anciennes sauvegardes compatibles après enrichissement', status: 'implemented', module: 'core/save.js', note: 'Migrations et réconciliation de schéma testées.' },
  { tome: 'XXII', chapter: '7 Outils', requirement: 'Console, logs, profils, débogage, validation des ressources', status: 'implemented', module: 'ui/devtools.js', note: 'Console développeur intégrée : journal du bus, validation des données, profilage.' },

  // ── Tome XXIII — Économie ──────────────────────────────────────────────
  { tome: 'XXIII', chapter: '2 Comptes', requirement: 'Quatre comptes, toutes transactions enregistrées', status: 'implemented', module: 'systems/economy.js', note: 'Aucune variation d\'argent ne contourne le journal comptable.' },
  { tome: 'XXIII', chapter: '3 Investissements', requirement: 'Neuf types, avec revenus et risques réels', status: 'implemented', module: 'systems/economy.js', note: 'Volatilité mensuelle : un investissement peut réellement faire faillite.' },
  { tome: 'XXIII', chapter: '4 Immobilier', requirement: 'Décorer, rénover, agrandir, revendre, louer', status: 'implemented', module: 'systems/economy.js', note: 'Sept types de biens, travaux, mise en location et revente avec frais.' },
  { tome: 'XXIII', chapter: '5 Employés', requirement: 'Dix postes avec compétences et salaires', status: 'implemented', module: 'systems/economy.js', note: 'Les effets du personnel modifient réellement fatigue, blessures et coûts.' },
  { tome: 'XXIII', chapter: '6 Luxe', requirement: 'Objets prenant ou perdant de la valeur', status: 'implemented', module: 'systems/economy.js', note: 'Réévaluation mensuelle, volatilité propre aux œuvres d\'art.' },
  { tome: 'XXIII', chapter: '7 Succession', requirement: 'Fondation, dons, legs', status: 'implemented', module: 'systems/economy.js', note: 'Fondations dotées, budget annuel et effet durable sur la réputation.' },

  // ── Tome XXIV — Licences ───────────────────────────────────────────────
  { tome: 'XXIV', chapter: '2 Marques', requirement: 'Six catégories de partenaires', status: 'implemented', module: 'data/world.js', note: 'Marques fictives, structure prête à accueillir de vraies licences (champ licensed).' },
  { tome: 'XXIV', chapter: '3 Contrats', requirement: 'Obligations et exclusivité effectives', status: 'implemented', module: 'systems/career.js, systems/economy.js', note: 'Obligations générées par palier de marque ; exclusivité appliquée à l\'achat.' },
  { tome: 'XXIV', chapter: '5 Voitures', requirement: 'Essai, configuration, options, livraison mise en scène', status: 'implemented', module: 'systems/economy.js, systems/phone.js', note: 'Commande, délai de 21 jours et cinématique de livraison.' },

  // ── Tome XXV — Technologies ────────────────────────────────────────────
  { tome: 'XXV', chapter: '2 IA générative', requirement: 'Dialogues, interviews, publications, actualités uniques', status: 'implemented', module: 'systems/media.js, systems/phone.js', note: 'Génération combinatoire contextuelle, sans texte figé répété.' },
  { tome: 'XXV', chapter: '3 Mémoire mondiale', requirement: 'Le monde se souvient des rivalités et des grands matchs', status: 'implemented', module: 'core/state.js', note: 'worldMemory persistée et citée par commentateurs et journalistes.' },
  { tome: 'XXV', chapter: '5 IA d\'analyse', requirement: 'Analyse tactique, carte de chaleur, conseils', status: 'implemented', module: 'systems/match.js', note: 'Carte de chaleur par zone et conseils personnalisés après chaque match.' },
  { tome: 'XXV', chapter: '4 IA cinématique', requirement: 'Choix automatique des angles et ralentis', status: 'engine', module: '—', note: 'Suppose un système de caméras temps réel.' },

  // ── Tome XXVI — Le joueur au centre ────────────────────────────────────
  { tome: 'XXVI', chapter: '2 Réputation', requirement: 'Sept critères, variation par pays', status: 'implemented', module: 'systems/reputation.js', note: 'Réputation par pays, pondérée par la passion footballistique locale.' },
  { tome: 'XXVI', chapter: '3 Influence', requirement: 'Ventes de maillots, affluence, valeur du club, tourisme', status: 'implemented', module: 'systems/reputation.js', note: 'influence() produit cinq indicateurs chiffrés.' },
  { tome: 'XXVI', chapter: '4 Supporters', requirement: 'Autographes, selfies, maillots, associations', status: 'implemented', module: 'systems/reputation.js', note: 'Six interactions, y compris le refus et son coût d\'image.' },
  { tome: 'XXVI', chapter: '5 Caritatif', requirement: 'Fondations, écoles, académies, hôpitaux', status: 'implemented', module: 'systems/economy.js', note: 'Dons et fondations à impact durable et visible.' },
  { tome: 'XXVI', chapter: '6 Héritage culturel', requirement: 'Statue, rue, fresque, exposition, journée', status: 'implemented', module: 'systems/reputation.js', note: 'Cinq honneurs débloqués par palier de réputation.' },

  // ── Tome XXVII — Médias ────────────────────────────────────────────────
  { tome: 'XXVII', chapter: '2 Chaînes TV', requirement: 'Six chaînes spécialisées avec programmes', status: 'implemented', module: 'systems/media.js', note: 'Programme calculé selon l\'heure et l\'actualité réelle.' },
  { tome: 'XXVII', chapter: '3 Journaux', requirement: 'Nouveaux articles chaque matin', status: 'implemented', module: 'systems/media.js', note: 'Édition matinale générée depuis l\'état réel du monde et de la carrière.' },
  { tome: 'XXVII', chapter: '4 Conférences', requirement: 'Répondre, esquiver, plaisanter, défendre, attaquer', status: 'implemented', module: 'systems/media.js', note: 'Six postures, risque de dérapage modulé par le mental du joueur.' },
  { tome: 'XXVII', chapter: '5 Documentaires', requirement: 'Documentaire exclusif pour les légendes', status: 'implemented', module: 'systems/media.js', note: 'Généré à la retraite, marqué exclusif au-delà de 75 de réputation.' },
  { tome: 'XXVII', chapter: '7 Podcasts', requirement: 'Podcasts disponibles en voiture, maison, voyage', status: 'implemented', module: 'systems/media.js', note: 'Quatre podcasts avec épisode contextualisé.' },

  // ── Tome XXVIII — Records ──────────────────────────────────────────────
  { tome: 'XXVIII', chapter: '2 Statistiques', requirement: 'Les dix statistiques listées, par saison et carrière', status: 'implemented', module: 'core/state.js, systems/match.js', note: 'Y compris kilomètres parcourus et vitesse maximale.' },
  { tome: 'XXVIII', chapter: '3 Records', requirement: 'Détenteur, date, contexte', status: 'implemented', module: 'systems/match.js', note: 'Records personnels enregistrés avec leur contexte de match.' },
  { tome: 'XXVIII', chapter: '5 Comparaisons', requirement: 'Comparer selon saison, carrière, club, âge', status: 'implemented', module: 'ui/stats.js', note: 'Comparateur de saisons avec graphique.' },
  { tome: 'XXVIII', chapter: '6 Ligne du temps', requirement: 'Frise interactive de la carrière', status: 'implemented', module: 'ui/legacy.js', note: 'Débuts, transferts, blessures, records, trophées et retraite.' },

  // ── Tome XXIX — Stades ─────────────────────────────────────────────────
  { tome: 'XXIX', chapter: '2 Visite', requirement: 'Tribunes, vestiaires, tunnel, salle de presse, boutiques', status: 'implemented', module: 'systems/world.js', note: 'Dix zones visitables même hors jour de match.' },
  { tome: 'XXIX', chapter: '3 Évolution', requirement: 'Agrandissement visible pendant les travaux', status: 'implemented', module: 'systems/world.js', note: 'Capacité et prestige des stades augmentent réellement entre les saisons.' },
  { tome: 'XXIX', chapter: '5 Jours de match', requirement: 'Embouteillages, chants, vendeurs, fan zones', status: 'implemented', module: 'systems/world.js, systems/calendar.js', note: 'Événements de rue et transformation de ville les jours d\'événement.' },

  // ── Tome XXX — Univers complet ─────────────────────────────────────────
  { tome: 'XXX', chapter: '2 Le monde', requirement: 'Pays avec villes, culture, monnaie, climat, architecture', status: 'implemented', module: 'data/world.js', note: '20 pays, 20 villes, 200+ lieux. Extensible par simple ajout de données.' },
  { tome: 'XXX', chapter: '3 Voyages', requirement: 'Réservation, embarquement, décollage, vol, bagages', status: 'implemented', module: 'systems/world.js', note: 'Étapes propres à chaque transport, jouées séquentiellement.' },
  { tome: 'XXX', chapter: '4 Vacances', requirement: 'Seul, en couple, en famille, entre amis, avec activités', status: 'implemented', module: 'systems/world.js', note: 'Coût, hôtel, durée et effet sur les relations réellement calculés.' },
  { tome: 'XXX', chapter: '5 Commandes', requirement: 'Huit catégories, cinq points de livraison, livreur physique', status: 'implemented', module: 'systems/phone.js', note: 'Suivi jour par jour jusqu\'à la remise en main propre.' },
  { tome: 'XXX', chapter: '6 Monde vivant', requirement: 'Avions, commerces, touristes, embouteillages, saisons', status: 'implemented', module: 'systems/world.js, systems/weather.js', note: 'Simulé quotidiennement dans toutes les villes, pas seulement celle du joueur.' },

  // ── Tome XXXI — Animations ─────────────────────────────────────────────
  { tome: 'XXXI', chapter: '2-7', requirement: '100 000 animations, expressions, tissus, traces', status: 'engine', module: '—', note: 'Capture de mouvement et rendu temps réel : hors périmètre web par nature.' },
  { tome: 'XXXI', chapter: '5 IA d\'animation', requirement: 'Sélection selon météo, fatigue, contexte, célébrité', status: 'modelled', module: 'systems/world.js', note: 'Les variables de sélection existent et sont exposées ; le choix d\'animation appartient au moteur.' },

  // ── Tome XXXII — Sans limites ──────────────────────────────────────────
  { tome: 'XXXII', chapter: '2 Découvertes', requirement: 'Lieux secrets, terrains historiques, easter eggs', status: 'implemented', module: 'systems/world.js', note: 'Huit secrets à découvrir, réellement dissimulés jusqu\'à leur trouvaille.' },
  { tome: 'XXXII', chapter: '3 Vie du monde', requirement: 'Les PNJ changent d\'emploi, déménagent, vieillissent', status: 'implemented', module: 'systems/world.js', note: 'Les sept évolutions de vie listées sont simulées.' },
  { tome: 'XXXII', chapter: '4 Monde en évolution', requirement: 'Bâtiments, commerces et quartiers évoluent', status: 'implemented', module: 'systems/world.js', note: 'Ouvertures, fermetures, modernisations et agrandissements chaque saison.' },
  { tome: 'XXXII', chapter: '5 Expériences rares', requirement: 'Six événements rares', status: 'implemented', module: 'systems/world.js', note: 'Probabilité faible et conditions de réputation, comme spécifié.' },
  { tome: 'XXXII', chapter: '6 Mémoire', requirement: 'Album, chronologie, bibliothèque, célébrations', status: 'implemented', module: 'ui/legacy.js', note: 'Chronologie personnelle et archives consultables à tout moment.' },
  { tome: 'XXXII', chapter: '7 Sans fin', requirement: 'Le jeu ne donne jamais l\'impression d\'être terminé', status: 'implemented', module: 'systems/*', note: 'Aucune condition de fin : la simulation continue après la retraite.' },
];

/** Statistiques de couverture, calculées à la volée. */
export function coverage() {
  const total = TRACE.length;
  const counts = { implemented: 0, modelled: 0, engine: 0 };
  for (const entry of TRACE) counts[entry.status] = (counts[entry.status] || 0) + 1;

  return {
    total,
    ...counts,
    implementedPct: Math.round((counts.implemented / total) * 100),
    modelledPct: Math.round((counts.modelled / total) * 100),
    enginePct: Math.round((counts.engine / total) * 100),
  };
}

/** Entrées d'un tome donné. */
export function traceForTome(numeral) {
  return TRACE.filter((t) => t.tome === numeral);
}
