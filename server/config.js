require('dotenv').config();

/**
 * Configuration E-Market AI.
 *
 * Philosophie « gratuit d'abord » : par défaut, aucune clé n'est requise et
 * toutes les capacités IA fonctionnent en moteur local (règles sur le
 * catalogue). Quand des fournisseurs sont configurés via .env, on privilégie
 * les solutions gratuites / open source (OpenRouter modèles gratuits, Ollama
 * local, FLUX.1, Real-ESRGAN, RMBG-2.0, YOLO, LTX-Video / Wan 2.2, PaddleOCR,
 * FAISS). Les clés ne quittent jamais le serveur.
 */
const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-non-securise',

  ai: {
    // Fournisseur de texte : anthropic | openrouter | ollama | none(auto).
    // 'auto' choisit le premier fournisseur configuré, sinon moteur local.
    provider: (process.env.LLM_PROVIDER || 'auto').toLowerCase(),

    // Anthropic (Claude) — optionnel.
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.EMARKET_AI_MODEL || 'claude-opus-4-8',
    fastModel: process.env.EMARKET_AI_FAST_MODEL || 'claude-haiku-4-5',

    // OpenRouter — accès gratuit à de nombreux modèles open source.
    openrouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openrouterModel: process.env.OPENROUTER_MODEL || 'meta-llama/llama-3.1-8b-instruct:free',
    openrouterBaseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',

    // Ollama — modèles locaux (100 % gratuit, hors ligne).
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || '', // ex. http://localhost:11434
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.1',

    /** true dès qu'un fournisseur de texte est réellement configuré. */
    get enabled() {
      if (this.provider === 'none') return false;
      if (this.provider === 'anthropic') return Boolean(this.anthropicApiKey);
      if (this.provider === 'openrouter') return Boolean(this.openrouterApiKey);
      if (this.provider === 'ollama') return Boolean(this.ollamaBaseUrl);
      // auto : n'importe quel fournisseur configuré.
      return Boolean(this.anthropicApiKey || this.openrouterApiKey || this.ollamaBaseUrl);
    },

    /** Fournisseur effectivement utilisé (résolution de 'auto'). */
    get activeProvider() {
      if (this.provider !== 'auto') return this.enabled ? this.provider : 'local';
      if (this.anthropicApiKey) return 'anthropic';
      if (this.openrouterApiKey) return 'openrouter';
      if (this.ollamaBaseUrl) return 'ollama';
      return 'local';
    },
  },

  media: {
    /* ---- Génération / rendu d'images (AI Photo Pro) ----
       Moteurs OSS recommandés : flux (FLUX.1 Dev), sdxl. Commercial : replicate,
       stability. 'none' = mode spécification (aucun pixel généré). */
    imageProvider: process.env.IMAGE_PROVIDER || 'none', // none | flux | sdxl | replicate | stability | custom
    imageMaxResolution: process.env.IMAGE_MAX_RESOLUTION || '4k', // 1080p | 2k | 4k | 8k
    // Post-traitement image OSS : super-résolution, détourage, détection.
    upscaleProvider: process.env.UPSCALE_PROVIDER || 'real-esrgan', // real-esrgan | none
    bgRemovalProvider: process.env.BG_REMOVAL_PROVIDER || 'rmbg-2.0', // rmbg-2.0 | none
    detectionProvider: process.env.DETECTION_PROVIDER || 'yolo',     // yolo | none
    ocrProvider: process.env.OCR_PROVIDER || 'paddleocr',           // paddleocr | none

    /* ---- Génération / rendu vidéo (AI Video Pro) ----
       Moteurs OSS : ltx (LTX-Video), wan (Wan 2.2). */
    videoProvider: process.env.VIDEO_PROVIDER || 'none', // none | ltx | wan | runway | pika | custom
    videoMaxResolution: process.env.VIDEO_MAX_RESOLUTION || '4k', // 1080p | 2k | 4k | 8k

    // Voix-off (TTS) et musique.
    ttsProvider: process.env.TTS_PROVIDER || 'none',     // none | coqui | piper | elevenlabs | custom
    musicProvider: process.env.MUSIC_PROVIDER || 'none', // none | musicgen | suno | custom

    // Accès aux moteurs de rendu.
    // Replicate héberge de nombreux modèles OPEN SOURCE (FLUX.1, Real-ESRGAN,
    // RMBG, LTX-Video, Wan…) via une seule API.
    replicateApiToken: process.env.REPLICATE_API_TOKEN || '',
    // Réfs de modèles Replicate (surchargeable) — "owner/model" ou "...:version".
    fluxModel: process.env.FLUX_MODEL || 'black-forest-labs/flux-schnell',
    ltxModel: process.env.LTX_MODEL || 'lightricks/ltx-video',
    wanModel: process.env.WAN_MODEL || 'wan-video/wan-2.2',
    // Endpoints auto-hébergés (ComfyUI / Automatic1111 / serveur maison).
    // Reçoivent { prompt, width, height, ... } et renvoient { url } ou une image.
    imageProviderUrl: process.env.IMAGE_PROVIDER_URL || '',
    videoProviderUrl: process.env.VIDEO_PROVIDER_URL || '',

    get rendersImages() { return this.imageProvider !== 'none'; },
    get rendersVideo() { return this.videoProvider !== 'none'; },
  },

  // Recherche sémantique / mémoire vectorielle.
  vectors: {
    // local = index cosinus pur-JS (gratuit, aucune dépendance, hors ligne) ;
    // faiss = index FAISS externe si branché ; embeddings via provider LLM.
    provider: process.env.VECTOR_PROVIDER || 'local', // local | faiss
    dims: parseInt(process.env.VECTOR_DIMS || '256', 10),
  },
};

module.exports = config;
