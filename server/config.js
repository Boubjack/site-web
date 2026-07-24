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
    imageProvider: process.env.IMAGE_PROVIDER || 'none',
    videoProvider: process.env.VIDEO_PROVIDER || 'none',
  },
};

module.exports = config;
