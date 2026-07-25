/**
 * E-Market — serveur principal.
 * Marketplace + module E-Market AI (monté sur /api/ai).
 *
 * Importer ce module renvoie { app, start } sans ouvrir de port (utile pour les
 * tests). Le serveur n'écoute que lorsqu'il est lancé directement
 * (`node server/index.js`).
 */
const path = require('path');
const express = require('express');
const config = require('./config');
const { createLogger } = require('./utils/logger');
const { optionalAuth } = require('./middleware/auth');
const { notFoundHandler, errorHandler } = require('./middleware/errors');
const { seed } = require('./db/seed');

const log = createLogger('server');
const app = express();

app.disable('x-powered-by');

// En-têtes de sécurité minimalistes (zéro dépendance).
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('X-Frame-Options', 'SAMEORIGIN');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('X-DNS-Prefetch-Control', 'off');
  next();
});

app.use(express.json({ limit: '10mb' })); // 10mb : images base64 pour la vision IA
app.use(optionalAuth);

// Journal d'accès minimal.
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      log.info('request', { method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start });
    }
  });
  next();
});

// Sonde de santé (déploiement, load balancers, monitoring).
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    uptime: Math.round(process.uptime()),
    aiProvider: config.ai.activeProvider,
    timestamp: new Date().toISOString(),
  });
});

// API marketplace
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

// Module E-Market AI (indépendant)
app.use('/api/ai', require('./ai/router'));

// SEO technique (robots, sitemap, pages produit crawlables).
app.use(require('./routes/seo'));

// Frontend statique
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', notFoundHandler);
app.use(errorHandler);

/** Amorce les données de démonstration puis ouvre le port. */
function start(port = config.port) {
  if (seed()) log.info('base de démonstration initialisée');

  // Avertissements de configuration en production.
  if (process.env.NODE_ENV === 'production') {
    if (config.jwtSecret === 'dev-secret-non-securise') log.warn('JWT_SECRET par défaut en production — définissez une valeur secrète.');
  }

  const server = app.listen(port, () => {
    log.info(`E-Market démarré sur http://localhost:${server.address().port}`, {
      aiMode: config.ai.enabled ? 'modeles-cloud' : 'moteur-local',
    });
  });

  // Arrêt gracieux.
  const shutdown = (signal) => {
    log.info(`arrêt (${signal})…`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// N'écoute que si lancé directement (pas à l'import — tests).
if (require.main === module) start();

module.exports = { app, start };
