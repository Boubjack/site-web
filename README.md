# E-Market — marketplace intelligente propulsée par E-Market AI

E-Market est une marketplace e-commerce (contexte Afrique de l'Ouest, prix en
FCFA) dont l'intelligence artificielle — **E-Market AI** — est une
fonctionnalité centrale : elle vend, conseille, analyse, crée du contenu,
améliore les produits, aide les vendeurs et l'administration, et sécurise la
plateforme.

## Démarrage rapide

```bash
npm install
cp .env.example .env        # renseigner ANTHROPIC_API_KEY pour activer les modèles
npm start                   # http://localhost:3000
```

**Sans clé API**, E-Market AI fonctionne en *mode local* : un moteur de règles
sur le catalogue réel remplace les modèles (utile en développement — tout le
site reste fonctionnel). **Avec `ANTHROPIC_API_KEY`**, les modèles Claude
prennent le relais (conversation, vision, génération, analyse), avec streaming.

## Architecture multi-agents (orchestrateur + agents spécialisés)

E-Market AI n'est pas une IA monolithique. C'est un **orchestrateur** qui pilote
un **registre d'agents spécialisés** collaboratifs, exposés à travers **trois
assistants** conversationnels par rôle.

```
                 ┌───────────────────────────────────────────┐
   Demande  ───▶ │  ORCHESTRATEUR (server/ai/orchestrator.js) │
                 │  identifie le(s) agent(s), exécute, combine │
                 └───────────────┬───────────────────────────┘
                                 │ (permissions par rôle)
        ┌───────────────┬────────┼────────┬───────────────┬─────────────┐
        ▼               ▼        ▼        ▼               ▼             ▼
   AI Produit     AI Photo Pro  AI Video  AI Marketing  AI Modération  AI Fraude
   AI Avis        AI Stock      AI Tendances  AI Perso.  AI Traduction  AI Recommandation
        (server/ai/agents/*.js — un module par agent, ajout sans modifier les autres)
```

**Orchestrateur** — reçoit toute demande, identifie le bon agent, et combine les
réponses quand plusieurs agents sont nécessaires. Pipelines composites, ex. une
**publicité vidéo complète** = `AI Produit → AI Photo Pro → AI Video Pro → AI
Marketing` (les agents collaborent, l'orchestrateur assemble). Endpoint :
`POST /api/ai/orchestrator`.

**Agents spécialisés** (`server/ai/agents/`) — chacun mono-responsabilité,
permissionné par rôle, découvrable par mots-clés :

| Agent | Rôles | Rôle |
|---|---|---|
| `product` | vendeur/admin | Fiches produit (titre, desc, SEO, tags, hashtags, prix) |
| `photo` | vendeur/admin | **AI Photo Pro** — 14 types, mannequins, multi-angles, mise en scène, pipeline 4K/8K |
| `video` | vendeur/admin | **AI Video Pro** — storyboard cinématographique, caméra, éclairage, voix-off, musique, montage |
| `marketing` | vendeur/admin | Slogans, posts FB/IG/TikTok, campagnes, emails, SMS, push |
| `moderation` | admin | Vérifie titres/descriptions/avis/images ; contenu interdit, contrefaçon, spam |
| `fraud` | admin | Faux comptes/avis, paiements/commandes suspects, score de risque |
| `reviews` | vendeur/admin | Points positifs/négatifs, problèmes récurrents, satisfaction |
| `stock` | vendeur/admin | Prévision de rupture (vitesse de vente, saison) |
| `trends` | admin | Produits/catégories/recherches populaires + recommandations |
| `personalization` | public | Page d'accueil différente par client |
| `translation` | public | FR/EN (bambara préparé) |
| `recommendation` | public | Recommandations, produits complémentaires, paniers complets |
| `brain` | admin | **Marketplace Brain** — score de santé /100, opportunités & risques |
| `ceo` `cfo` `cmo` `coo` `cto` | admin | **Comité de direction IA** — synthèse exécutive, finance, marketing, opérations, système |

**Ajouter un agent** = créer `agents/<nom>.js` (contrat : `id, name, allowedRoles,
keywords, run, tool?`) et l'enregistrer dans `agents/index.js`. L'orchestrateur,
les permissions et les assistants le prennent automatiquement en charge —
**aucun agent existant n'est modifié**.

### AI Photo Pro / AI Video Pro — qualité cinématographique

Le cerveau créatif est entièrement implémenté (direction artistique, pipeline de
traitement, storyboard, plans caméra, voix-off, musique, cohérence visuelle). Le
**rendu des pixels 4K/8K** est délégué à un moteur externe branché via `.env`
(`IMAGE_PROVIDER`, `VIDEO_PROVIDER`, `TTS_PROVIDER`, `MUSIC_PROVIDER`). Sans
moteur, les studios livrent le **dossier de production complet** (mode
spécification) + un job de rendu ; brancher un moteur **open source** (FLUX.1,
LTX-Video/Wan 2.2, Real-ESRGAN, RMBG-2.0, YOLO, PaddleOCR…) active le rendu réel
**sans changer le reste du code** (adaptateurs dans `server/ai/studio/jobs.js`).

### AI Creative Studio (espace vendeur)

Studio créatif complet piloté par l'identité de marque du vendeur :

- **AI Brand Kit** — nom, logo, couleurs, police, style, slogan, positionnement.
  Toutes les créations respectent automatiquement cette identité.
- **Photo Studio** — types étendus (catalogue, premium, studio, lifestyle, luxe,
  Instagram/Facebook/TikTok, bannière, pub, couverture), **« Générer 5
  variantes »** (angle/lumière/scène/décor différents), générateur
  d'arrière-plans adaptatif, mannequins virtuels (ethnie, âge, morphologie).
- **Video Studio** — formats réseaux (Stories, TikTok, Shorts, Snapchat,
  WhatsApp, pub, présentation), caméra, effets, voix-off FR/EN (bambara préparé),
  musique par style, montage calé sur le rythme.
- **Ad Generator + réseaux sociaux** — affiches, flyers, bannières, carrousels,
  miniatures + slogans/hashtags/CTA ; déclinaisons par plateforme
  (dimensions/durée/résolution) ; export PNG/JPG/WEBP, MP4/MOV.
- **« Créer ma campagne »** (Smart Workflow) — un clic produit tout le pack
  marketing (10 photos, 5 affiches, 3 bannières, 5 Stories, 3 Reels, 3 TikTok,
  1 pub, 1 miniature + textes), 100 % cohérent avec le Brand Kit.

Endpoints : `/api/ai/studio/{brandkit,photo,video,photo/variants,backgrounds,
social,ad-kit,campaign,options}`.

### Découverte & pilotage

- **Stories IA / Vitrine vivante / Hover intelligent** (`/api/ai/{stories,
  showcase,hover/:id}`) — mise en avant auto (nouveautés, tendances, bons plans),
  sections d'accueil ré-ordonnées en direct, info-bulle IA au survol des cartes.
- **Recherche sémantique compatible FAISS** — index cosinus local (pur-JS,
  gratuit) ; repli de compréhension quand la recherche par mots-clés échoue.
- **Marketplace Brain + comité de direction IA** (`/api/ai/{brain,exec/:role}`).

### Fournisseurs gratuits / open source

Fournisseur de texte unifié (`LLM_PROVIDER=auto`) : **OpenRouter** (modèles
`:free`), **Ollama** (local), ou Anthropic — sinon **moteur local** gratuit et
hors ligne. Détails et audit complet dans [`docs/AUDIT_IA.md`](docs/AUDIT_IA.md).

## Trois assistants IA distincts

E-Market AI n'est **pas** une IA unique réutilisée partout : ce sont trois
assistants **complètement séparés**, chacun avec son propre prompt système, ses
permissions, ses outils, ses données accessibles, son historique, son interface
et son style. Ils partagent le même moteur, mais rien d'autre.

| Assistant | Fichier | Qui | Données accessibles | Interface | Accent |
|---|---|---|---|---|---|
| **E-Market Shopping Assistant** | `assistants/shopping.js` | public (invités + clients) | catalogue public + commandes du client connecté | widget flottant (boutique) | bleu |
| **E-Market Seller Assistant** | `assistants/seller.js` | vendeurs | **uniquement les données du vendeur connecté** | panneau intégré (`/seller.html`) | vert |
| **E-Market Operator AI** | `assistants/operator.js` | admin | toute la plateforme + prévisions | panneau intégré + graphiques (`/admin.html`) | violet |

**Isolation garantie :** le Shopping Assistant ne voit jamais les données des
vendeurs ni l'administration ; le Seller Assistant vérifie la propriété de
chaque produit et ne peut accéder à aucun autre vendeur ; l'Operator AI est le
seul à avoir les autorisations globales. Le registre (`assistants/registry.js`)
applique les permissions et empêche tout appel d'outil non déclaré par
l'assistant. Le contrôle d'accès est vérifié côté serveur (403 sinon).

**Ajouter un assistant** = créer un module `assistants/<nom>.js` (prompt,
`allowedRoles`, `buildTools`, style…) et l'enregistrer dans `assistants/index.js`.
Les routes, l'historique, les permissions et le widget frontend le prennent
automatiquement en charge.

Endpoints : `GET /api/ai/assistants` (liste selon le rôle),
`POST /api/ai/assistants/:id/chat` (conversation SSE),
`GET|DELETE /api/ai/assistants/:id/history` (historique propre à chaque
assistant/utilisateur).

### Comptes de démonstration

| Rôle | Email | Mot de passe | Accès |
|---|---|---|---|
| Client | `client@emarket.ml` | `client123` | Boutique, chat IA, mémoire IA |
| Vendeur | `vendeur@emarket.ml` | `vendeur123` | `/seller.html` — studios IA |
| Admin | `admin@emarket.ml` | `admin123` | `/admin.html` — emarket.admin |

## Architecture

```
server/
  index.js                 Serveur Express (API + frontend statique)
  config.js                Variables d'environnement (clés côté serveur uniquement)
  middleware/              JWT (rôles), erreurs, rate-limit
  db/                      Couche de données (JSON par défaut, interface
                           remplaçable par PostgreSQL/MongoDB) + seed démo
  routes/                  API marketplace (auth, produits, commandes)
  ai/                      ★ MODULE E-MARKET AI (indépendant)
    router.js              Toutes les routes /api/ai/* (auth par rôle + rate-limit)
    provider/
      anthropic.js         Fournisseur de modèles (Claude) : complétion,
                           sorties structurées JSON, boucle agentique streamée
                           (SSE + outils), vision. Repli local sans clé.
    assistants/            ★ Les trois assistants distincts + registre modulaire
      registry.js          Contrat, permissions, exécution SSE, historiques
      shopping.js          Assistant CLIENT (public)
      seller.js            Assistant VENDEUR (données du vendeur connecté)
      operator.js          Assistant ADMIN (plateforme complète)
      index.js             Enregistrement des assistants
    services/              Données/outils partagés (catalogue, analytics,
                           fraude, studios, marketing, vision, prévisions…)
public/
  index.html               Boutique : recherche IA, recommandations, chat flottant
  seller.html              Dashboard vendeur : annonce IA, studios photo/vidéo, marketing
  admin.html               emarket.admin : analyste IA, sécurité, finance
  css/emarket.css          Design system noir/blanc/bleu, glassmorphism, animations
  js/app.js, js/chat.js    Client API + lecteur SSE + widget de chat
```

### Les 15 capacités E-Market AI

| # | Capacité | Service | Endpoint principal |
|---|---|---|---|
| 1 | Assistant IA client (chat) | `assistant.js` | `POST /api/ai/chat` (SSE) |
| 2 | Conseiller shopping (recommandations) | `recommender.js` | `GET /api/ai/recommendations` |
| 3 | Recherche IA en langage naturel | `search.js` | `POST /api/ai/search` |
| 4 | Assistant vendeur (annonce IA) | `seller.js` | `POST /api/ai/seller/listing` |
| 5 | IA photo / vision (analyse + recherche par image) | `vision.js` | `POST /api/ai/vision/{analyze,search}` |
| 6 | Studio photo IA (pipeline de retouche) | `photoStudio.js` | `POST /api/ai/studio/photo` |
| 7 | Studio vidéo IA (storyboards pub) | `videoStudio.js` | `POST /api/ai/studio/video` |
| 8 | Créateur publicitaire (kits marketing) | `marketing.js` | `POST /api/ai/marketing/kit` |
| 9 | Assistant administrateur | `adminAnalyst.js` | `POST /api/ai/admin/chat` (SSE) |
| 10 | Service client IA (+ escalade humaine) | `assistant.js` mode `support` | `POST /api/ai/chat` |
| 11 | IA sécurité / fraude (vert-orange-rouge) | `fraud.js` | `GET /api/ai/security/overview` |
| 12 | Analyse financière (rapports) | `analytics.js` | `GET /api/ai/finance/report` |
| 13 | Multilingue (fr/en, bambara préparé) | `i18n.js` | `POST /api/ai/translate` |
| 14 | Mémoire IA (préférences, effaçable) | `memory.js` | `GET/DELETE /api/ai/memory` |
| 15 | Design premium (noir/blanc/bleu, glass) | frontend | — |

### Choix techniques

- **Sécurité des clés** : `ANTHROPIC_API_KEY` n'est lue que côté serveur
  (`server/config.js`) et n'apparaît dans aucune réponse HTTP.
- **Modèles** : `claude-opus-4-8` (conversation/vision/génération, thinking
  adaptatif) et `claude-haiku-4-5` (tâches rapides : intention de recherche,
  traduction). Configurables via `.env`.
- **Boucle agentique** : les chats (client, support, admin) utilisent des
  outils serveur (recherche catalogue, commandes, analytique, sécurité) — le
  modèle ne peut pas inventer un produit, un prix ou un chiffre.
- **Streaming** : les réponses de chat arrivent en SSE, token par token.
- **Studios photo/vidéo** : architecture en file de jobs avec adaptateurs de
  fournisseurs (`IMAGE_PROVIDER`, `VIDEO_PROVIDER`). Sans fournisseur branché,
  brief de retouche et storyboard complets sont générés (mode simulation) ;
  brancher un moteur de rendu ne change pas l'interface.
- **Fraude** : moteur de règles explicables (chaque alerte est motivée),
  appliqué en temps réel à la création de commande (statut
  `verification-securite` si risque rouge).
- **Mémoire IA** : agrégats de préférences uniquement (catégories, styles,
  couleurs, budget) — consultable (`GET /api/ai/memory`) et effaçable
  (`DELETE /api/ai/memory`) par l'utilisateur.
- **Évolutivité** : module IA indépendant, services séparés, logs JSON
  structurés, rate-limit par utilisateur, gestion d'erreurs centralisée,
  couche de données remplaçable.

## Exemples

```bash
# Recherche en langage naturel
curl -X POST localhost:3000/api/ai/search -H 'content-type: application/json' \
  -d '{"query":"Je veux un téléphone puissant pour jouer à moins de 200 000 FCFA"}'

# Chat client (SSE)
curl -N -X POST localhost:3000/api/ai/chat -H 'content-type: application/json' \
  -d '{"messages":[{"role":"user","content":"Je cherche une tenue pour un mariage à Bamako avec un budget de 50 000 FCFA"}]}'

# Génération d'annonce vendeur (token vendeur requis)
curl -X POST localhost:3000/api/ai/seller/listing \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"name":"chemise en wax faite main","hints":"coton wax, tailles M à XL"}'
```
