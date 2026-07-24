# E-Market AI — Audit & rapport d'intégration

> Réponse au brief maître : **auditer l'IA existante sans la recréer**, compléter
> les fonctionnalités manquantes en privilégiant les solutions **gratuites /
> open source**, conserver une **architecture modulaire**, **ne jamais casser**
> l'existant, et respecter les **droits d'auteur** (jamais de récupération
> automatique d'images sur Internet — uniquement photos du vendeur, ressources
> libres compatibles ou générations IA originales).

## 1. Méthode

Audit du code existant (`server/ai/**`, `public/**`), cartographie des
capacités par rapport au brief, puis complétion **additive** : chaque nouveauté
est un module enregistré dans un registre ouvert (agents/assistants) ou un
service indépendant. Aucune classe, aucun endpoint, aucune signature existante
n'a été supprimé.

## 2. État des lieux (avant / après)

| Domaine | Avant | Ajouté | Statut |
|---|---|---|---|
| Assistants (Client / Vendeur / Admin) | ✅ | — | Conservé |
| Orchestrateur + agents spécialisés (12) | ✅ | — | Conservé |
| AI Photo Pro / AI Video Pro (direction créative) | ✅ | Types étendus, décors, ethnies, variantes | Étendu |
| Recherche NL + recommandations + perso + mémoire | ✅ | — | Conservé |
| Sécurité / fraude / modération / analytics / finance | ✅ | — | Conservé |
| **Fournisseurs gratuits/OSS** | ❌ | OpenRouter, Ollama, FLUX.1, Real-ESRGAN, RMBG-2.0, YOLO, LTX/Wan, PaddleOCR | **Nouveau** |
| **Recherche sémantique (type FAISS)** | ❌ | Index cosinus local + repli sémantique | **Nouveau** |
| **Marketplace Brain + C-suite (CEO/CFO/CMO/COO/CTO)** | ❌ | 6 agents + score de santé | **Nouveau** |
| **Stories IA / Vitrine vivante / Hover intelligent** | ❌ | `services/discovery.js` + accueil | **Nouveau** |
| **Creative Studio (Brand Kit + campagne)** | ❌ | Brand Kit, variantes, social, pub, « Créer ma campagne » | **Nouveau** |

## 3. Priorité « gratuit / open source »

Par défaut, **aucune clé n'est requise** : tout fonctionne en moteur local
(règles + index vectoriel pur-JS), gratuitement et hors ligne. Lorsqu'on
souhaite activer des modèles, la configuration privilégie l'open source :

| Besoin | Moteur OSS par défaut | Variable `.env` |
|---|---|---|
| Texte / LLM | OpenRouter (modèles `:free`) · Ollama (local) | `LLM_PROVIDER`, `OPENROUTER_*`, `OLLAMA_*` |
| Génération image | FLUX.1 Dev | `IMAGE_PROVIDER=flux` |
| Super-résolution | Real-ESRGAN | `UPSCALE_PROVIDER` |
| Détourage | RMBG-2.0 | `BG_REMOVAL_PROVIDER` |
| Détection objet | YOLO | `DETECTION_PROVIDER` |
| OCR | PaddleOCR | `OCR_PROVIDER` |
| Génération vidéo | LTX-Video / Wan 2.2 | `VIDEO_PROVIDER=ltx\|wan` |
| Voix-off / musique | Coqui/Piper · MusicGen | `TTS_PROVIDER`, `MUSIC_PROVIDER` |
| Vecteurs | Index cosinus local (→ FAISS) | `VECTOR_PROVIDER` |

Le fournisseur de texte est unifié dans `server/ai/provider/llm.js` (route vers
anthropic / openrouter / ollama, repli local). Les clés ne quittent jamais le
serveur.

## 4. Nouveaux modules

- **`provider/llm.js`** — fournisseur texte multi-backends (gratuit d'abord).
- **`services/vectors.js`** — embeddings locaux (« hashing trick ») + similarité
  cosinus ; `semanticSearch`, `similar`. Repli sémantique branché dans
  `services/search.js` (ne s'active que si la recherche lexicale ne rend rien).
- **`services/brain.js`** — instantané transverse, score de santé /100,
  opportunités & risques.
- **`agents/brain, ceo, cfo, cmo, coo, cto`** — comité de direction IA (admin),
  exposé à l'assistant Operator + endpoints `/brain`, `/exec/:role`.
- **`services/discovery.js`** — Stories IA, Vitrine vivante (`showcase`), Hover
  intelligent ; endpoints `/stories`, `/showcase`, `/hover/:id`.
- **`studio/brandkit.js`** — AI Brand Kit par vendeur (identité appliquée
  automatiquement à toutes les créations).
- **`studio/creative.js`** — Creative Studio : variantes photo, décors,
  déclinaisons réseaux sociaux, générateur de publicités, options d'export, et
  **« Créer ma campagne »** (10 photos · 5 affiches · 3 bannières · 5 Stories ·
  3 Reels · 3 TikTok · 1 pub · 1 miniature + textes/hashtags/descriptions).

## 5. Respect des droits d'auteur

Aucune récupération d'images sur Internet. Les studios travaillent sur les
**données du catalogue E-Market** (produits du vendeur) et produisent des
**spécifications de création originales**. Les garde-fous de cohérence
(`CONSISTENCY` dans `agents/photo.js`) imposent de préserver logos, textes,
motifs, textures, proportions et couleurs réelles du produit — jamais de
détail inventé ni déformé.

## 6. Rendu média — spécification **puis** rendu open source réel

Sans moteur (`*_PROVIDER=none`, défaut), le « cerveau créatif » est entièrement
fonctionnel : specs, pipelines, storyboards, plans caméra, voix-off, musique,
plans de campagne (mode spécification, aucun appel réseau).

Les **adaptateurs de rendu réel** sont implémentés (`studio/render.js`, câblés
dans `studio/jobs.js`) et s'activent par `.env`, vers des **moteurs open
source** :

- **Replicate** (`REPLICATE_API_TOKEN`) — un token unique pour FLUX.1
  (`IMAGE_PROVIDER=flux`), LTX-Video / Wan 2.2 (`VIDEO_PROVIDER=ltx|wan`),
  Real-ESRGAN, RMBG… Le prompt est construit **depuis la spec** (produit, décor,
  éclairage, mannequin, cohérence, identité de marque).
- **Serveur auto-hébergé** (`IMAGE_PROVIDER_URL` / `VIDEO_PROVIDER_URL`) —
  ComfyUI / Automatic1111 / maison : reçoit `{ prompt, width, height, … }`,
  renvoie une URL de média.

Sécurité d'exploitation : si le moteur est indisponible (réseau, quota, clé),
le job **ne tombe jamais en erreur** — il revient proprement au dossier de
production (mode spécification) avec un message explicite. Le fournisseur de
texte suit la même logique via `provider/llm.js` (OpenRouter/Ollama → repli
local).

## 7. Vérifications effectuées

- Agents C-suite : exécution 6/6 + permissions (client bloqué en 403).
- Recherche sémantique + « produits proches » : validés hors ligne.
- Découverte : `/stories`, `/showcase`, `/hover/:id` validés.
- Creative Studio : Brand Kit (GET/PUT), variantes, ad-kit, social, et
  **campagne** (31 livrables, job « campaign » terminé) validés via HTTP avec
  authentification vendeur ; garde d'appartenance produit vérifiée (403).
- Non-régression : classes/variables/endpoints existants inchangés.
