# eMarket — plateforme de vente en ligne malienne

Boutique e-commerce (React + Vite + Tailwind + Framer Motion) avec un espace
client, un espace vendeur et un Control Center admin caché. Le frontend est
connecté à une vraie base de données Postgres (Neon) via des fonctions
serverless Vercel dans `api/`.

## Fonctionnalités

- Comptes clients et vendeurs réels (inscription/connexion, mot de passe
  hashé, session par cookie httpOnly).
- Catalogue de produits persistant : les vendeurs publient un produit (avec
  photo, tailles, couleurs, prix), il passe en attente de validation, puis
  apparaît dans la boutique publique une fois validé par l'admin.
- Espace admin (« Control Center », accessible en cliquant 5 fois sur le
  logo « E Market ») avec authentification côté serveur (email + mot de
  passe + clé secrète, aucun identifiant n'est présent dans le code client).
- Panier, favoris et historique de commandes persistants.
- Paiement réel via Stripe Checkout (mode test). Le FCFA (XOF) n'étant pas
  supporté par Stripe, le montant est converti en euros au taux fixe UEMOA
  (1 EUR = 655,957 FCFA) au moment du paiement.
- Recherche de produits, menu « Personal Center » fonctionnel (profil,
  commandes, favoris, déconnexion, changement de compte).
- Assistant ChatGPT opérateur dans le Control Center (`api/admin-ai.js`,
  optionnel, nécessite `OPENAI_API_KEY` sinon fonctionne en mode démo).

## Stack

- Frontend : React 18, Vite, Tailwind CSS, Framer Motion, lucide-react.
- Backend : fonctions serverless Vercel (dossier `api/`), Postgres via
  [Neon](https://neon.tech) (`@neondatabase/serverless`).
- Auth : JWT signé (cookie httpOnly), mots de passe hashés avec bcryptjs.
- Paiement : Stripe Checkout.

## Configuration

1. Créez un projet gratuit sur [neon.tech](https://neon.tech) et récupérez la
   connection string (pooled).
2. Copiez `.env.example` vers `.env` et remplissez les variables :

```
DATABASE_URL=...        # connection string Neon
JWT_SECRET=...           # longue chaîne aléatoire
ADMIN_EMAIL=...          # identifiants du Control Center
ADMIN_PASSWORD=...
ADMIN_SECRET_KEY=...
STRIPE_SECRET_KEY=...    # clés de test Stripe
STRIPE_WEBHOOK_SECRET=...
BASE_URL=http://localhost:5173
OPENAI_API_KEY=...       # optionnel, pour l'IA opérateur
```

3. Créez les tables :

```
npm install
npm run db:migrate
```

## Développement local

```
npm run dev
```

Le frontend (Vite) tourne sur `http://localhost:5173`. Les fonctions dans
`api/` sont conçues pour Vercel ; pour les tester en local avec le frontend,
utilisez la CLI Vercel (`npm i -g vercel && vercel dev`) après avoir renseigné
les mêmes variables d'environnement dans le dashboard Vercel ou un fichier
`.env` local.

## Déploiement

Le projet est prêt pour Vercel (`vercel.json` inclus) :

1. Poussez le dépôt sur GitHub et importez-le dans Vercel.
2. Renseignez les variables d'environnement listées ci-dessus dans les
   paramètres du projet Vercel.
3. Configurez un webhook Stripe pointant vers
   `https://<votre-domaine>/api/webhook` pour l'événement
   `checkout.session.completed`, et copiez le secret de signature dans
   `STRIPE_WEBHOOK_SECRET`.

## Limites connues

- Les images produit sont stockées en base64 directement dans Postgres
  (simple à démarrer, à migrer vers un stockage objet si le volume grandit).
- Le chat « Support vendeur/opérateur » dans les tableaux de bord est une
  démonstration visuelle statique (pas de messagerie temps réel).
- « Mes Points Bonus » et « Plus de services » affichent un message
  « bientôt disponible » : aucune logique métier n'était définie pour ces
  fonctionnalités.
