/**
 * E-Market — serveur principal.
 * Marketplace + module E-Market AI (monté sur /api/ai).
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

// API marketplace
app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/orders', require('./routes/orders'));

// Module E-Market AI (indépendant)
app.use('/api/ai', require('./ai/router'));

// Frontend statique
app.use(express.static(path.join(__dirname, '..', 'public')));

app.use('/api', notFoundHandler);
app.use(errorHandler);

// Données de démonstration au premier démarrage.
if (seed()) log.info('base de démonstration initialisée');

app.listen(config.port, () => {
  log.info(`E-Market démarré sur http://localhost:${config.port}`, {
    aiMode: config.ai.enabled ? 'modeles-cloud' : 'moteur-local',
  });
});

module.exports = app;
