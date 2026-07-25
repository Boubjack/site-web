/**
 * AI ACCESSIBILITY ENGINE — audit statique d'accessibilité.
 *
 * Vérifie les fondamentaux a11y présents dans le CSS/HTML (focus clavier,
 * thèmes clair/sombre, contraste élevé, mouvement réduit, lien d'évitement,
 * langue) et renvoie un score /100 + recommandations.
 */
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', '..', '..', 'public');
function read(rel) { try { return fs.readFileSync(path.join(PUBLIC, rel), 'utf8'); } catch { return ''; } }

function audit() {
  const css = read('css/emarket.css');
  const index = read('index.html');
  const checks = [
    { id: 'focus-visible', label: 'Anneau de focus clavier (:focus-visible)', ok: /:focus-visible/.test(css), weight: 16 },
    { id: 'skip-link', label: 'Lien d\'évitement (skip-link)', ok: /skip-link/.test(css), weight: 12 },
    { id: 'dark-light', label: 'Modes clair et sombre', ok: /data-theme="light"/.test(css), weight: 14 },
    { id: 'contrast', label: 'Contraste élevé (prefers-contrast)', ok: /prefers-contrast/.test(css), weight: 12 },
    { id: 'reduced-motion', label: 'Mouvement réduit (prefers-reduced-motion)', ok: /prefers-reduced-motion/.test(css), weight: 12 },
    { id: 'lang', label: 'Langue de la page déclarée', ok: /<html[^>]*lang=/.test(index), weight: 8 },
    { id: 'viewport', label: 'Meta viewport responsive', ok: /name="viewport"/.test(index), weight: 6 },
    { id: 'labels', label: 'Champs de formulaire étiquetés', ok: /<label/.test(index), weight: 10 },
    { id: 'aria-toggle', label: 'Contrôles avec aria-label', ok: /aria-label/.test(read('js/app.js')), weight: 10 },
  ];
  const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
  const score = Math.round((checks.filter((c) => c.ok).reduce((s, c) => s + c.weight, 0) / (totalWeight || 1)) * 100);
  const recommendations = checks.filter((c) => !c.ok).map((c) => `À renforcer : ${c.label}.`);
  return { score, checks, recommendations, level: score >= 90 ? 'excellent' : score >= 70 ? 'bon' : 'à améliorer' };
}

module.exports = { audit };
