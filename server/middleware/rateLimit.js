/**
 * Limiteur de débit en mémoire (fenêtre glissante simplifiée).
 * Protège les endpoints IA — les appels aux modèles ont un coût.
 */
const buckets = new Map();

function rateLimit({ windowMs = 60000, max = 30, keyFn } = {}) {
  return (req, res, next) => {
    const key = (keyFn ? keyFn(req) : null) || (req.user && req.user.id) || req.ip || 'anon';
    const now = Date.now();
    let bucket = buckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      bucket = { start: now, count: 0 };
      buckets.set(key, bucket);
    }
    bucket.count += 1;
    if (bucket.count > max) {
      res.set('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
      return res.status(429).json({ error: 'Trop de requêtes. Réessayez dans un instant.' });
    }
    next();
  };
}

// Nettoyage périodique pour éviter la croissance mémoire.
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > 300000) buckets.delete(key);
  }
}, 300000).unref();

module.exports = { rateLimit };
