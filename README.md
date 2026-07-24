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
      prompts.js           Identité E-Market AI + prompts spécialisés
    services/              Un service par capacité (voir tableau ci-dessous)
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
