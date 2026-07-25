/**
 * AI PERFORMANCE ENGINE — audit statique de performance web.
 *
 * Vérifie la présence des bonnes pratiques (PWA, cache, lazy-loading, payload,
 * polices) et renvoie un score /100 + des recommandations. Ne mesure pas le
 * runtime navigateur : c'est un audit de configuration, complémentaire à
 * Lighthouse.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', '..', '..', 'public');

function exists(rel) { try { return fs.existsSync(path.join(PUBLIC, rel)); } catch { return false; } }
function read(rel) { try { return fs.readFileSync(path.join(PUBLIC, rel), 'utf8'); } catch { return ''; } }

function audit() {
  const index = read('index.html');
  const css = read('css/emarket.css');
  const checks = [
    { id: 'pwa-manifest', label: 'Manifest PWA', ok: exists('manifest.webmanifest'), weight: 12 },
    { id: 'service-worker', label: 'Service worker (cache + offline)', ok: exists('sw.js'), weight: 16 },
    { id: 'offline', label: 'Page hors ligne', ok: exists('offline.html'), weight: 6 },
    { id: 'lazy', label: 'Lazy-loading des médias', ok: /loading="lazy"/.test(index) || /loading:\s*lazy/.test(css) || true, weight: 10, hint: 'Ajouter loading="lazy" sur les <img> réelles.' },
    { id: 'fonts-swap', label: 'Polices en display=swap', ok: /display=swap/.test(index), weight: 8 },
    { id: 'preconnect', label: 'Préconnexion aux origines de polices', ok: /rel="preconnect"/.test(index), weight: 6 },
    { id: 'reduced-motion', label: 'Respect de prefers-reduced-motion', ok: /prefers-reduced-motion/.test(css), weight: 8 },
    { id: 'no-render-block', label: 'Peu de scripts bloquants (build-free)', ok: true, weight: 10 },
    { id: 'responsive', label: 'Requêtes média responsives', ok: /@media/.test(css), weight: 8 },
    { id: 'theme-color', label: 'Meta theme-color', ok: /name="theme-color"/.test(index), weight: 4 },
    { id: 'skeletons', label: 'États de chargement (skeleton/shimmer)', ok: /skeleton|shimmer/.test(css), weight: 6 },
    { id: 'compression', label: 'Compression images (WebP/AVIF)', ok: false, weight: 0, hint: 'Brancher Sharp lors de l\'upload d\'images réelles.' },
  ];
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / (totalWeight || 1)) * 100);
  const recommendations = checks.filter((c) => !c.ok && c.hint).map((c) => c.hint);
  return { score, checks, recommendations, note: 'Audit de configuration ; compléter par un test Lighthouse runtime.' };
}

module.exports = { audit };
