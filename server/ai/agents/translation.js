/**
 * AGENT — AI Traduction. Traduction automatique FR/EN, architecture prête pour
 * le bambara et d'autres langues. Public (utile à tous). Permissions : null.
 */
const i18n = require('../services/i18n');

async function run(input) {
  if (!input.text) return { error: 'text requis.' };
  return i18n.translate({ text: input.text, target: input.target || 'en' });
}

module.exports = {
  id: 'translation',
  name: 'AI Traduction',
  description: 'Traduction automatique FR/EN (bambara préparé).',
  allowedRoles: null,
  keywords: ['traduction', 'traduire', 'translate', 'anglais', 'english', 'bambara', 'langue'],
  run,
  languages: i18n.languages,
};
