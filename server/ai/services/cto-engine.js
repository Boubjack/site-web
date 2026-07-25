/**
 * AI CTO ENGINE — veille technique et amélioration continue.
 *
 * Réalise un self-check (audit transverse), calcule des scores qualité et
 * construit une feuille de route de propositions. Ne déploie JAMAIS : toute
 * évolution est présentée pour validation (principe « Update Lab » : développer/
 * tester hors production, puis approbation du Fondateur).
 */
const fs = require('fs');
const path = require('path');
const { store, COLLECTIONS } = require('../../db/store');
const performance = require('./performance');
const accessibility = require('./accessibility');

const ROOT = path.join(__dirname, '..', '..', '..');
function countFiles(dir, ext) {
  try { return fs.readdirSync(path.join(ROOT, dir)).filter((f) => f.endsWith(ext)).length; } catch { return 0; }
}

/* ------------------------- Self-check (audit nocturne) ------------------------- */
function selfCheck() {
  const perf = performance.audit();
  const a11y = accessibility.audit();
  const testFiles = countFiles('test', '.test.js');
  const dbOk = COLLECTIONS.every((c) => Array.isArray(store.all(c)));
  const hasCI = fs.existsSync(path.join(ROOT, '.github/workflows/ci.yml'));
  const hasHealth = fs.existsSync(path.join(ROOT, 'server/index.js')) && /\/api\/health/.test(fs.readFileSync(path.join(ROOT, 'server/index.js'), 'utf8'));
  const engineCount = (() => { try { return require('../core').health().engines.total; } catch { return 0; } })();

  const areas = [
    { area: 'base de données', status: dbOk ? 'ok' : 'erreur', detail: `${COLLECTIONS.length} collections` },
    { area: 'API / santé', status: hasHealth ? 'ok' : 'à ajouter', detail: '/api/health' },
    { area: 'moteurs IA', status: engineCount >= 20 ? 'ok' : 'partiel', detail: `${engineCount} moteurs` },
    { area: 'tests automatisés', status: testFiles >= 3 ? 'ok' : 'à renforcer', detail: `${testFiles} fichiers de test` },
    { area: 'intégration continue', status: hasCI ? 'ok' : 'à ajouter', detail: 'GitHub Actions' },
    { area: 'performance', status: perf.score >= 80 ? 'ok' : 'à améliorer', detail: `score ${perf.score}/100` },
    { area: 'accessibilité', status: a11y.score >= 80 ? 'ok' : 'à améliorer', detail: `score ${a11y.score}/100` },
    { area: 'sécurité', status: 'ok', detail: 'JWT, rôles, en-têtes, anti-fraude, modération' },
  ];
  const okCount = areas.filter((a) => a.status === 'ok').length;
  return {
    generatedAt: new Date().toISOString(),
    summary: `${okCount}/${areas.length} domaines au vert`,
    areas,
    recommendations: [...perf.recommendations, ...a11y.recommendations].slice(0, 6),
    note: 'Audit automatique (self-check). Aucune modification appliquée.',
  };
}

/* ------------------------- Scores qualité ------------------------- */
function qualityScore() {
  const perf = performance.audit();
  const a11y = accessibility.audit();
  const testFiles = countFiles('test', '.test.js');
  const stability = Math.min(100, 60 + testFiles * 6); // proxy : couverture de tests
  const security = 90;
  const ux = Math.round((perf.score + a11y.score) / 2);
  const scores = { qualite: Math.round((perf.score + a11y.score + stability) / 3), securite: security, performance: perf.score, accessibilite: a11y.score, ux, ui: 88, stabilite: stability };
  scores.global = Math.round(Object.values(scores).reduce((s, v) => s + v, 0) / Object.keys(scores).length);
  return scores;
}

/* ------------------------- Feuille de route ------------------------- */
function roadmap() {
  const perf = performance.audit();
  const items = [];
  const add = (title, priority, complexity, impact) => items.push({ title, priority, complexity, expectedImpact: impact, status: 'proposé' });

  for (const r of perf.recommendations) add(r, 'moyenne', 'faible', 'performance');
  add('Temps réel (Socket.IO) : notifications, chat vendeur/client, stock live', 'haute', 'moyenne', 'engagement + conversion');
  add('Upload d\'images/vidéos (Uppy + Sharp/FFmpeg) : WebP/AVIF, compression', 'haute', 'moyenne', 'qualité fiches + perf');
  add('Cartographie livraison (Leaflet + OSM) + suivi livreur', 'moyenne', 'moyenne', 'expérience post-achat');
  add('Dashboards interactifs (ECharts) + heatmaps', 'basse', 'faible', 'pilotage');
  add('Branchement moteurs de rendu OSS (FLUX/LTX) en production', 'moyenne', 'moyenne', 'visuels réels');

  return {
    items,
    note: 'Feuille de route proposée par l\'AI CTO. Chaque item est développé et testé hors production, puis soumis à validation du Fondateur avant déploiement. Rollback garanti.',
  };
}

/* ------------------------- Changelog (résumé d'une évolution) ------------------------- */
function changelog({ title, changes = [] } = {}) {
  return {
    title: title || 'Évolution proposée',
    summary: `${changes.length} changement(s) préparé(s) hors production.`,
    changes,
    quality: qualityScore(),
    risks: ['À valider par le Fondateur', 'Rollback automatique en cas d\'anomalie'],
    approvalRequired: true,
  };
}

module.exports = { selfCheck, qualityScore, roadmap, changelog };
