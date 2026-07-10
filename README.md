# VIPER — site web

Homepage brutaliste pour la marque streetwear **VIPER** (noir / blanc / vert néon `#39FF14`).

Ouvrir `index.html` dans un navigateur, aucun build nécessaire.

## Structure

- `index.html` — page d'accueil (hero, drop de 4 produits, newsletter "The Pit")
- `styles.css` — styles
- `assets/logo.svg` — logo tête de vipère
- `assets/snake.svg` — motif serpent
- `assets/products/` — visuels produits (illustrations SVG)

## Galerie produit multi-angles

Chaque carte produit affiche plusieurs visuels (face, dos, porté) :

- **survol** de la carte → passe automatiquement au 2ᵉ visuel
- **flèches ← →** (visibles au survol) → fait défiler tous les angles
- **points** sous l'image → indiquent l'angle affiché

## Remplacer par les vraies photos produits

Les visuels sont des illustrations SVG recréées d'après les photos de la
marque. Pour utiliser les vraies photos, dépose-les dans `assets/products/`
et remplace les chemins `src` des balises `<img>` dans `index.html`
(un `<img>` par angle, dans chaque `.media-frame`) :

| Fichier actuel | Photo à mettre |
| --- | --- |
| `jacket-black.svg` / `-back.svg` / `-model.svg` | Viper Jacket noire : face / dos / portée |
| `jacket-sky.svg` / `-back.svg` / `-model.svg` | Sk's Viper Jacket bleu ciel : face / dos / portée |
| `jacket-army.svg` / `-back.svg` / `-model.svg` | Viper Jacket vert armée : face / dos / portée |
| `beanie-sand.svg` / `-model.svg` | Venom Beanie : face / porté |

Tu peux ajouter autant d'angles que tu veux : il suffit d'ajouter des
`<img>` dans le `.media-frame` du produit, les points et les flèches
s'adaptent automatiquement. Idem pour `assets/logo.svg` si tu préfères
le logo original en PNG.
