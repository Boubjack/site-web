require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-non-securise',
  ai: {
    // Clé lue uniquement côté serveur — jamais transmise au client.
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.EMARKET_AI_MODEL || 'claude-opus-4-8',
    fastModel: process.env.EMARKET_AI_FAST_MODEL || 'claude-haiku-4-5',
    get enabled() {
      return Boolean(this.anthropicApiKey);
    },
  },
  media: {
    // Moteur de génération/rendu d'images (AI Photo Pro).
    imageProvider: process.env.IMAGE_PROVIDER || 'none', // none | replicate | stability | custom
    imageMaxResolution: process.env.IMAGE_MAX_RESOLUTION || '4k', // 1080p | 2k | 4k | 8k
    // Moteur de génération/rendu vidéo (AI Video Pro).
    videoProvider: process.env.VIDEO_PROVIDER || 'none', // none | runway | pika | sora | custom
    videoMaxResolution: process.env.VIDEO_MAX_RESOLUTION || '4k', // 1080p | 2k | 4k | 8k
    // Synthèse voix-off (TTS) et musique.
    ttsProvider: process.env.TTS_PROVIDER || 'none',     // none | elevenlabs | azure | custom
    musicProvider: process.env.MUSIC_PROVIDER || 'none', // none | suno | custom
    get rendersImages() { return this.imageProvider !== 'none'; },
    get rendersVideo() { return this.videoProvider !== 'none'; },
  },
};

module.exports = config;
