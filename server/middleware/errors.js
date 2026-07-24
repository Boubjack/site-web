const { createLogger } = require('../utils/logger');
const log = createLogger('http');

class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

/** Enveloppe async → propagation propre vers le handler d'erreurs. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function notFoundHandler(_req, res) {
  res.status(404).json({ error: 'Ressource introuvable.' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  if (status >= 500) {
    log.error('unhandled error', { path: req.path, error: err.message, stack: err.stack });
  } else {
    log.warn('client error', { path: req.path, status, error: err.message });
  }
  res.status(status).json({
    error: status >= 500 ? 'Erreur interne du serveur.' : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
}

module.exports = { ApiError, asyncHandler, notFoundHandler, errorHandler };
