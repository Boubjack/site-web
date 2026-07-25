# AI Client · Operator 2.0 · CTO — moteurs avancés

Trois moteurs branchés sur le **AI Core Engine**, invoquables via
`POST /api/ai/core/:engine/:action`. Principe transverse : **l'IA observe,
analyse et propose ; toute action à impact est validée par un humain.**

## AI Client Engine (`client`, public)

Personal Shopping Assistant outillé et **transparent** (chaque sortie est
sourcée sur le catalogue réel). Complète l'assistant conversationnel `shopping`.

| Action | Rôle |
|---|---|
| `compare` | Compare des produits : avantages/inconvénients, prix, avis, rapport qualité/prix, livraison |
| `budget` | Panier optimisé sous un budget (meilleur rapport qualité/prix + variété) |
| `sizeGuide` | Recommande la bonne taille (coupe, taille habituelle) |
| `outfit` | Compose une tenue/look complet (produits complémentaires réels) |
| `productQA` | Répond aux questions produit (matière, dimensions, livraison, garantie, retour, entretien) |
| `alerts` | Alertes personnalisées (stock faible, rupture, nouveautés suivies) |

La recherche par texte/voix/photo/conversation et la personnalisation
progressive existent déjà (assistant `shopping`, `search`, `recommendation`,
`personalization`, mémoire, vision).

## AI Operator Engine 2.0 (`operator`, admin)

Centre de pilotage — l'IA agit comme DG/analyste assisté.

| Action | Rôle |
|---|---|
| `dashboard` | Executive dashboard : CA jour/semaine/mois/année, commissions, commandes par statut, clients/vendeurs, conversion, panier moyen |
| `health` | Indice de santé marketplace (qualité, satisfaction, fiches, livraison, support, disponibilité) + note globale |
| `alerts` | Smart alerts classées **critique / élevé / moyen / faible** (ventes, remboursements, fraude, modération, stock, commandes bloquées) |
| `missions` | Mission center : missions opérationnelles (priorité, impact, temps estimé, statut) |
| `sellerAnalysis` | Qualité boutique + conversion + suggestions (« Ajoutez une vidéo », « Refaites votre Hero »…) |
| `customerAnalysis` | Segments : VIP, fidèles, inactifs, à risque, fraude potentielle |
| `simulate` | Simulateur : commission, promotion, retrait de catégorie → impact estimé |
| `predict` | Prévisions 7 / 30 / 90 / 365 jours |
| `commandCenter` | Briefing du fondateur : priorités, urgences, alertes, opportunités, actions recommandées (à valider) |

Toute action à impact (campagnes, prix, commissions, messages) est **proposée**,
jamais appliquée automatiquement.

## AI CTO Engine (`cto`, admin)

Veille technique et amélioration continue — sous supervision humaine.

| Action | Rôle |
|---|---|
| `selfCheck` | Audit transverse (base de données, API, moteurs, tests, CI, performance, accessibilité, sécurité) |
| `qualityScore` | Scores qualité / sécurité / performance / accessibilité / UX / UI / stabilité + global |
| `roadmap` | Feuille de route de propositions (priorité, complexité, impact) |
| `changelog` | Résumé d'une évolution pour validation (approbation requise) |

Principe **Update Lab** : développer/tester hors production, puis approbation du
Fondateur avant déploiement ; rollback garanti. L'AI CTO ne déploie jamais seul.

## Rôles & modes d'accès

Le rôle le plus élevé (« Fondateur ») correspond ici au rôle **admin** (accès à
tous les moteurs). Une hiérarchie support/opérateur/administrateur/fondateur
plus fine s'ajouterait via `allowedRoles` par action, sans changer
l'architecture.

## Multilingue

FR/EN via le moteur `translation` (bambara préparé).

## Tests

`test/engines-advanced.test.js` — comparateur, budget, tailles, tenues, Q/R,
dashboard, santé, alertes, simulateur, prévisions, command center, self-check,
scores, roadmap, permissions (client bloqué sur `operator`/`cto`).
