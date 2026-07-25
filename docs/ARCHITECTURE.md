# E-Market — AI Core Engine (architecture)

Plateforme e-commerce de nouvelle génération : plusieurs **moteurs IA
indépendants** coordonnés par une couche centrale, le **AI Core Engine**.

## Vue d'ensemble

```
                        ┌───────────────────────────────────────────┐
   req.user  ─────────▶ │             AI CORE ENGINE                 │
   (rôle)               │  server/ai/core/core.js                    │
                        │  • registre de moteurs                     │
                        │  • run(engine, action, input, ctx)         │
                        │  • permissions · cache · métriques ·       │
                        │    événements · logs (transverses)         │
                        └───────────────┬───────────────────────────┘
                                        │ interface uniforme
   ┌──────────┬──────────┬─────────────┼───────────┬──────────┬───────────┐
   ▼          ▼          ▼             ▼           ▼          ▼           ▼
 Theme     Layout    Component     Animation    Commerce   Marketing   Pricing …
 (design)  (design)  (design)      (design)     (commerce) (commerce)  (commerce)
        server/ai/core/engines.js — un moteur = un objet, ajout sans rien casser
```

## Le Core

`server/ai/core/` :

- **`events.js`** — bus d'événements (pub/sub) : les moteurs communiquent sans se
  connaître (`engine:registered`, `engine:run:start|done|error`, `engine:cache:hit`).
- **`cache.js`** — cache mémoire TTL + LRU borné (`wrap(key, ttl, fn)`).
- **`metrics.js`** — monitoring : appels, erreurs, latence moyenne/max par moteur.
- **`core.js`** — registre + coordinateur : `register`, `list(user)`, `run(...)`,
  `health()`. Permissions, cache, métriques, événements et logs sont appliqués
  **de façon transverse** — les moteurs n'ont pas à s'en préoccuper.
- **`engines.js`** — définition et enregistrement des moteurs.
- **`index.js`** — singleton prêt à l'emploi (`require('./core')`).

## Contrat d'un moteur (indépendant, extensible)

```js
{
  id, name, description,
  category: 'design'|'commerce'|'media'|'intelligence'|'platform',
  allowedRoles: ['seller','admin'] | null,   // null = public
  actions: {
    [name]: {
      description,
      allowedRoles?,          // surclasse celui du moteur
      cacheTtlMs?,            // active la mise en cache
      handler(input, ctx, core) => result,
    }
  },
  init?(core)                 // câblage d'événements au démarrage (facultatif)
}
```

**Ajouter un moteur** = pousser un objet dans `engines.js`. Aucun moteur existant
n'est modifié → architecture **extensible** et **non cassante**.

## Moteurs enregistrés (23)

> S'ajoutent aux 20 ci-dessous trois moteurs avancés — `client` (Personal
> Shopping Assistant), `operator` (Command Center 2.0) et `cto` (veille
> technique) — détaillés dans [`ENGINES_CLIENT_OPERATOR_CTO.md`](ENGINES_CLIENT_OPERATOR_CTO.md).


| Moteur | Catégorie | Rôle |
|---|---|---|
| `theme` | design | Palettes originales, thèmes par secteur |
| `layout` | design | Structure des pages / parcours (indépendant du thème) |
| `component` | design | Bibliothèque de composants + rendu boutique |
| `animation` | design | Bibliothèque d'animations premium |
| `branding` | design | Brand Kit du vendeur |
| `commerce` | commerce | Analyse comportementale + propositions (validées par le vendeur) |
| `marketing` | commerce | Kits pub + campagne complète |
| `pricing` | commerce | Recommandation de prix |
| `inventory` | commerce | Alertes de stock |
| `photo` | media | Studio photo (types, décors, mannequins, 360°, retouche, export) |
| `video` | media | Studio vidéo (caméra, effets, voix, musique, MP4/MOV) |
| `brand-guardian` | media | Vérifie/corrige la cohérence de marque avant génération |
| `search` | intelligence | Recherche NL + fautes + suggestions + sémantique |
| `recommendation` | intelligence | Recommandations + cross-sell |
| `analytics` | intelligence | Rapports, prévisions, score de santé |
| `fraud` | intelligence | Détection de fraude |
| `seo` | platform | Métadonnées / JSON-LD |
| `performance` | platform | Audit de performance |
| `accessibility` | platform | Audit d'accessibilité |
| `translation` | platform | Traduction FR/EN |

## API

| Méthode | Route | Effet |
|---|---|---|
| GET | `/api/ai/core/engines` | Moteurs accessibles au rôle courant |
| GET | `/api/ai/core/health` | Monitoring (admin) : moteurs, métriques, cache |
| POST | `/api/ai/core/:engine/:action` | Invocation uniforme (permission via le Core) |

Exemple :
```bash
POST /api/ai/core/pricing/suggest   { "productId": "p-003" }
POST /api/ai/core/theme/generate    { "category": "bijoux" }
POST /api/ai/core/brand-guardian/check { "colors": ["#123456"], "font": "Arial" }
```

## Choix d'architecture : pas de React (build-free)

Le brief mentionne à la fois « ne jamais générer une application React / construire
depuis une bibliothèque de composants » **et** « créer des contextes/hooks/providers
React ». La plateforme est **délibérément sans build (JavaScript natif)** : pas de
bundler, chargement ultra rapide, design « Premium Noir » servi tel quel.
Introduire React casserait l'architecture et le design existants.

Les concepts demandés sont donc réalisés par leurs **équivalents architecturaux** :

| Concept React | Équivalent ici |
|---|---|
| Providers / injection de dépendances | Registre de moteurs du Core |
| Hooks (composition) | `core.run(engine, action, …)` composable |
| Context | Objet `ctx` partagé (user, …) transmis à chaque action |
| Système d'événements | `EventBus` (`core.events`) |
| Cache | `Cache` (`core.cache`) |
| Logs / monitoring | logger structuré + `Metrics` (`core.health()`) |

## Qualité

Propre, modulaire, réutilisable, **testable** (`test/core.test.js` — infra,
registre, permissions, invocation HTTP), **documenté**. Extensible : un nouveau
moteur s'ajoute sans toucher aux autres.
