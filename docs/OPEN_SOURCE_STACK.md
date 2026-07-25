# E-Market — Stack open source (niveau grande marketplace)

Objectif : hisser E-Market au niveau d'Amazon / Shopify / Alibaba / Temu avec
**uniquement des solutions open source, gratuites et auto-hébergeables**, **sans
casser le design « Premium Noir »**, en additif, responsive et documenté.

Contrainte technique clé : le front est en **JavaScript natif, sans build**. On
privilégie donc des bibliothèques **sans build / vanilla** (les libs React-only
listées — React Hook Form, TanStack, React Dropzone, Framer Motion — sont
remplacées par leurs équivalents vanilla : Zod, Fabric/Konva, Uppy, GSAP/Motion
One). Choix guidé par la **performance** et la **maintenance**.

Statuts : ✅ intégré · 🔌 adaptateur prêt (activer par `.env` / lib) · 🗺️ feuille de route.

## IA
| Capacité | Solution OSS retenue | Statut |
|---|---|---|
| Descriptions produits | LLM local + OpenRouter(:free)/Ollama (`seller.generateListing`) | ✅ |
| Titres SEO optimisés | idem génération de fiche + `seoKeywords` | ✅ |
| Traduction FR/EN | lexique local + LLM (`i18n.translate`) ; Bergamot/LibreTranslate | ✅ / 🔌 |
| Amélioration photos | Real-ESRGAN (`UPSCALE_PROVIDER`, via `studio/render`) | 🔌 |
| Suppression d'arrière-plan | RMBG-2.0 / `@imgly/background-removal` (`BG_REMOVAL_PROVIDER`) | 🔌 |
| Images produits réalistes | FLUX.1 via Replicate/ComfyUI (`IMAGE_PROVIDER=flux`) | 🔌 |
| Recherche intelligente | intention NL + sémantique locale (FAISS-compatible) | ✅ |
| Recommandations perso | `recommender` (profil + affinités + mémoire) | ✅ |

## Recherche
| Capacité | Solution | Statut |
|---|---|---|
| Ultra rapide | index local en mémoire (`catalog`, `vectors`) | ✅ |
| Fautes d'orthographe | Levenshtein (`suggest.correct`) — repli dans `search` | ✅ |
| Suggestions auto | `suggest.suggest` + UI autocomplétion (`/search/suggest`) | ✅ |
| Filtres intelligents | filtres structurés (catégorie/prix/couleur/occasion) | ✅ |
| Moteur dédié | **Meilisearch** / OpenSearch auto-hébergé (adaptateur) | 🔌 |
| Recherche par image | vision (`vision.searchByImage`) + CLIP/Transformers.js | ✅ / 🔌 |
| Recherche vocale | **Web Speech API** (natif navigateur) / Vosk | 🗺️ |

## Images
| Capacité | Solution | Statut |
|---|---|---|
| Lazy loading | `loading="lazy"` sur les visuels | ✅ |
| Compression / WebP·AVIF | **Sharp** (pipeline upload) | 🗺️ |
| CDN | statiques immuables + cache SW ; reverse-proxy/CDN auto-hébergé | ✅ / 🗺️ |
| Zoom HD / galerie | **PhotoSwipe** (vanilla, léger) | 🗺️ |

## Cartographie
| Capacité | Solution | Statut |
|---|---|---|
| Carte interactive | **Leaflet** + tuiles **OpenStreetMap** (vanilla) | 🗺️ |
| Itinéraire | **OSRM** / GraphHopper (auto-hébergeable) | 🗺️ |
| Suivi livreur temps réel | Leaflet + WebSocket (position en direct) | 🗺️ |
| Géolocalisation | **Geolocation API** (natif) | 🗺️ |

## Dashboard
| Capacité | Solution | Statut |
|---|---|---|
| KPIs / analytics vendeur | `analytics` + KPIs (espace admin/vendeur) | ✅ |
| Graphiques (barres) | rendu CSS natif (léger, sans dépendance) | ✅ |
| Graphiques interactifs | **Apache ECharts** / Chart.js (vanilla, vendored) | 🗺️ |
| Temps réel | SSE (existant) → WebSocket | ✅ / 🗺️ |
| Heatmaps | ECharts heatmap / heatmap.js | 🗺️ |

## Temps réel
| Capacité | Solution | Statut |
|---|---|---|
| Notifications instantanées | SSE existant ; **Socket.IO** pour bidirectionnel | ✅ / 🗺️ |
| Chat vendeur/client | Socket.IO + fil persistant | 🗺️ |
| MAJ commandes en direct | événements commande (SSE/WS) | 🗺️ |
| Stock temps réel | `stock` + diffusion des changements | ✅ / 🗺️ |

## Sécurité
| Capacité | Solution | Statut |
|---|---|---|
| Authentification | JWT (`jsonwebtoken`), rôles, hash | ✅ |
| Anti-fraude IA | `fraud` (comptes/avis/commandes suspects) | ✅ |
| Anti-spam / modération | `moderation` (contenu interdit, contrefaçon) | ✅ |
| Anti-bot | rate limiting ; **Altcha**/**Friendly Captcha** (OSS) | ✅ / 🗺️ |
| Scan images inappropriées | **NSFWJS** (ONNX) / CompreFace | 🗺️ |
| En-têtes de sécurité | middleware (nosniff, frame, referrer) | ✅ |

## Performance
| Capacité | Solution | Statut |
|---|---|---|
| PWA / mode hors ligne | `manifest.webmanifest` + service worker + `offline.html` | ✅ |
| Cache intelligent | SW stale-while-revalidate + précache app-shell | ✅ |
| Chargement ultra rapide | zéro build, statiques cachés, SSR meta produit | ✅ |
| Lighthouse 95+ | PWA + SEO + a11y + perfs (base posée) | ✅ (base) |

## SEO
| Capacité | Solution | Statut |
|---|---|---|
| Sitemap auto | `/sitemap.xml` (produits) | ✅ |
| Robots.txt | `/robots.txt` + lien sitemap | ✅ |
| Meta / Open Graph | pages `/p/:id` (OG + Twitter Card) | ✅ |
| Schema.org | JSON-LD Product + WebSite + Organization | ✅ |
| URLs optimisées | `/p/<id>` propres + liens profonds `/?p=` `/?q=` | ✅ |

## Paiement (uniquement local)
| Moyen | Statut |
|---|---|
| Orange Money · Moov Money · Wave · Paiement à la livraison | ✅ (sélection + validation ; passerelle réelle à brancher) |

## Notifications
| Canal | Solution | Statut |
|---|---|---|
| In-app | toasts (Sonner-like) | ✅ |
| Push Web | **Web Push API** + VAPID (service worker prêt) | 🗺️ |
| Email | **Nodemailer** (SMTP auto-hébergé) | 🗺️ |
| SMS | passerelle locale (Orange/Twilio-like) | 🗺️ |

## Upload / Vidéo
| Capacité | Solution | Statut |
|---|---|---|
| Drag & drop, multiple, reprise | **Uppy** (+ tus, vanilla) | 🗺️ |
| Barre de progression | Uppy / `fetch` + `ProgressEvent` | 🗺️ |
| Compression vidéo | **FFmpeg** (serveur) / ffmpeg.wasm | 🔌 |
| Aperçu vidéo | `<video>` natif + poster | 🗺️ |

## Boutiques vendeurs / IA Boutique
| Capacité | Solution | Statut |
|---|---|---|
| Brand Kit (couleurs, police, logo, slogan) | `studio/brandkit` | ✅ |
| Thème auto par catégorie | `studio/theme` (mode, luxe, cosmétique, auto, électro, alim.) | ✅ |
| Personnalisation complète (bannière, sections, collections) | thème + rendu boutique dédiée | ✅ (spéc.) / 🗺️ |
| Éditeur riche (fiches) | **TipTap** (vanilla ProseMirror) | 🗺️ |
| Éditeur visuel (cartes/bannières) | **Fabric.js** / **Konva.js** | 🗺️ |

## Animations / Accessibilité
| Capacité | Solution | Statut |
|---|---|---|
| Micro-interactions premium | CSS + courbes signature (Emil Kowalski) | ✅ |
| Moteur d'animation | **GSAP** / **Motion One** (vanilla) | ✅ (CSS) / 🗺️ |
| Skeleton loading | shimmer CSS | ✅ |
| Mode clair / sombre | thème `data-theme` + bascule persistée | ✅ |
| Contraste élevé | `prefers-contrast` | ✅ |
| Navigation clavier / lecteur d'écran | skip-link, `:focus-visible`, ARIA | ✅ |

## Bibliothèques citées → rôle retenu
Meilisearch/OpenSearch (recherche serveur 🔌) · OpenStreetMap/Leaflet (cartes
🗺️) · TipTap (éditeur riche 🗺️) · Fabric.js/Konva.js (éditeur visuel 🗺️) ·
Chart.js/Apache ECharts (graphiques 🗺️) · Socket.IO (temps réel 🗺️) · Zod
(validation — remplace React Hook Form) · Uppy (upload 🗺️) · Sharp (images
serveur 🗺️) · FFmpeg (vidéo 🔌) · Tesseract/PaddleOCR (OCR 🔌) ·
OpenCV/ONNX Runtime/Transformers.js/Hugging Face (vision & embeddings 🔌) ·
CompreFace/NSFWJS (modération image 🗺️) · Excalidraw/Mermaid (schémas — docs) ·
Three.js (3D produit 🗺️) · GSAP/Motion (animations 🗺️).

## Principes respectés
- Design « Premium Noir » inchangé ; le mode clair et les thèmes boutique sont
  **opt-in** et n'altèrent pas le thème global.
- Ajouts **additifs**, **responsives**, **modulaires**, **testés** (`npm test`).
- Aucune donnée externe imposée ; tout fonctionne **hors ligne / gratuitement**
  par défaut, les moteurs plus lourds s'activent par `.env` (auto-hébergeables).
