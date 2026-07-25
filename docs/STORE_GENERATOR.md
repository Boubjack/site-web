# Générateur de boutiques IA premium

Génère, pour chaque vendeur, une **boutique complète, originale et unique**, de
qualité « agence web premium » — sans jamais copier un site existant ni un thème
protégé.

## Principe d'originalité (strict)

- Les couleurs sont **calculées** (`studio/palette.js`, HSL + harmonies), jamais
  copiées.
- Les mises en page sont **composées** à partir d'archétypes (« directions
  créatives ») et **variées par graine** : deux vendeurs, ou deux propositions,
  ne produisent pas le même rendu.
- Les agences citées en référence (Hyperflow Labs, Scalerize, Hyperstack,
  Galadrim, Digital Unicorn…) servent uniquement de **repère de qualité**. Aucun
  de leurs designs n'est reproduit.
- Chaque blueprint porte un bloc `originality` explicite.

## Brief vendeur

`POST /api/ai/studio/store` (rôle vendeur/admin) :

| Champ | Exemple |
|---|---|
| `category` | `mode-femme`, `bijoux`, `electronique`, `restaurant`… |
| `subcategory` | `robes de soirée` |
| `audience` | `femmes 20-40 ans` |
| `positioning` | `Économique` · `Premium` · `Luxe` |
| `style` | `élégant, moderne` |
| `colors` | `["#e63d6a"]` (couleur préférée) |
| `hasLogo` | `true`/`false` |
| `description` | récit / mission de la marque |

Réponse : **3 propositions** (`proposals[]`) + `previewBase` (`/shop/:sellerId`).

## Adaptation automatique par secteur

| Secteur | Adaptation |
|---|---|
| Mode | grandes images, animations élégantes, lookbook |
| Cosmétique | couleurs douces, ingrédients, design raffiné |
| High-Tech | interface moderne, effets lumineux, fiches techniques |
| Bijoux | design luxueux, zoom HD, galerie immersive |
| Restaurant | menus, réservation, photos gourmandes |
| (générique) | moderne, produit mis en avant |

## Directions créatives (rend chaque proposition différente)

1. **Éditorial** — grandes images, typographie forte, espaces généreux.
2. **Immersif** — sombre, effets lumineux, animations reveal, galerie immersive.
3. **Minimal-Lux** — épuré, lignes fines, micro-interactions subtiles.

## Contenu d'un blueprint

Design system (palette, typographie, rayon, motion, densité, effets, icônes) ·
layout (nav, hero, footer) · **pages** (accueil, catalogue, catégorie, produit,
panier, checkout, à propos, FAQ) · **composants** (carte, survol, galerie,
variantes, boutons, recherche, menu, pied de page, icônes) · **contenu**
(tagline, à-propos, FAQ, avis, bannières, sections marketing).

## Endpoints

| Méthode | Route | Rôle | Effet |
|---|---|---|---|
| GET | `/api/ai/studio/store/options` | vendeur | secteurs, directions, positionnements |
| POST | `/api/ai/studio/store` | vendeur | génère + mémorise 3 propositions |
| POST | `/api/ai/studio/store/select` | vendeur | choisit la proposition publiée |
| GET | `/shop/:sellerId?proposal=N` | public | **rend** la boutique (produits réels du vendeur) |

## Rendu

`studio/store-render.js` transforme un blueprint + les produits réels du vendeur
en une **vraie page HTML autonome** (CSS + JS inline, aucune dépendance) :
responsive, animée (reveal au scroll via IntersectionObserver), tokens de design
appliqués → chaque boutique est visuellement unique. Un clic produit renvoie
vers la fiche de la marketplace (`/?p=<id>`).

## UI vendeur

Espace vendeur → panneau **« Générateur de boutique IA »** : brief → « Générer 3
propositions » → aperçu de chaque proposition (swatch de palette + pitch) →
**Prévisualiser** (ouvre `/shop/:id?proposal=N`) ou **Choisir** (publie).

## Tests

`test/storebuilder.test.js` : variété de palette, 3 propositions distinctes,
adaptation par secteur, blueprint complet, rendu HTML, permissions (client 403),
sélection + rendu public.
