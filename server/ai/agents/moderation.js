/**
 * AGENT — AI Modération. Vérifie automatiquement images, descriptions, titres,
 * commentaires et avis. Détecte : contenu interdit, faux produits,
 * contrefaçons, spam, contenu offensant. Signale automatiquement (file de
 * modération consultable par l'admin). Permissions : admin (revue),
 * mais l'analyse est utilisée en interne à la création de contenu.
 */
const provider = require('../provider/anthropic');
const { store } = require('../../db/store');
const catalog = require('../services/catalog');

const BANNED = ['contrefacon', 'contrefaçon', 'replique', 'réplique', 'faux', 'copie conforme', 'arme', 'drogue', 'stupefiant', 'ivoire', 'écaille de tortue'];
const OFFENSIVE = ['insulte', 'arnaque', 'escroc', 'voleur', 'connard', 'idiot'];
const COUNTERFEIT_BRANDS = ['nike', 'adidas', 'gucci', 'rolex', 'louis vuitton', 'apple', 'samsung'];

/** Analyse un texte (titre, description, avis, commentaire). */
function moderateText(text) {
  const q = catalog.normalize(text || '');
  const reasons = [];
  let score = 0;

  for (const w of BANNED) if (q.includes(catalog.normalize(w))) { score += 60; reasons.push(`terme interdit: "${w}"`); }
  for (const w of OFFENSIVE) if (q.includes(catalog.normalize(w))) { score += 30; reasons.push(`propos offensant: "${w}"`); }

  // Contrefaçon probable : marque connue + prix cassé / "pas cher" / "original garanti".
  const brand = COUNTERFEIT_BRANDS.find((b) => q.includes(b));
  if (brand && /(pas cher|imitation|premiere copie|1ere copie|aaa|replica)/.test(q)) {
    score += 50; reasons.push(`contrefaçon probable (${brand})`);
  }

  // Spam : majuscules excessives, répétitions, liens, numéros.
  const caps = (String(text || '').match(/[A-Z]/g) || []).length;
  if (text && caps / text.length > 0.6 && text.length > 12) { score += 15; reasons.push('excès de majuscules'); }
  if (/(.)\1{5,}/.test(q)) { score += 15; reasons.push('caractères répétés'); }
  if (/(https?:\/\/|www\.|t\.me\/|wa\.me\/)/.test(q)) { score += 20; reasons.push('lien externe suspect'); }
  if (/\b\d{8,}\b/.test(q.replace(/\s/g, ''))) { score += 10; reasons.push('numéro de contact (hors plateforme)'); }

  const level = score >= 60 ? 'blocked' : score >= 25 ? 'review' : 'ok';
  return { level, status: level === 'ok' ? 'ok' : 'flag', score, reasons };
}

/** Modération d'image : architecture prête (vision quand un moteur est branché). */
async function moderateImage({ imageBase64, mediaType }) {
  if (!provider.enabled()) {
    return { level: 'review', status: 'flag', reasons: ['analyse d\'image indisponible en mode local — revue manuelle recommandée'], available: false };
  }
  try {
    const schema = {
      type: 'object',
      properties: {
        allowed: { type: 'boolean' },
        issues: { type: 'array', items: { type: 'string' } },
        category: { type: 'string' },
      },
      required: ['allowed', 'issues', 'category'],
      additionalProperties: false,
    };
    const r = await provider.visionJson({
      imageBase64, mediaType,
      system: 'Tu es modérateur e-commerce. Détecte contenu interdit, contrefaçon, contenu offensant ou trompeur sur une image produit.',
      prompt: 'Cette image respecte-t-elle les règles d\'une marketplace grand public ?',
      schema,
    });
    return { level: r.allowed ? 'ok' : 'blocked', status: r.allowed ? 'ok' : 'flag', reasons: r.issues || [], available: true };
  } catch {
    return { level: 'review', status: 'flag', reasons: ['erreur d\'analyse image'], available: true };
  }
}

/** Signale automatiquement (file de modération admin). */
function flag({ entityType, entityId, ownerId, verdict, excerpt }) {
  if (verdict.status !== 'flag') return null;
  return store.insert('moderationFlags', {
    entityType, entityId: entityId || null, ownerId: ownerId || null,
    level: verdict.level, reasons: verdict.reasons, excerpt: (excerpt || '').slice(0, 200),
    status: 'ouvert',
  });
}

async function run(input, ctx) {
  if (input.imageBase64) {
    const verdict = await moderateImage(input);
    if (input.autoFlag) flag({ entityType: input.entityType || 'image', entityId: input.entityId, ownerId: ctx.user && ctx.user.id, verdict, excerpt: '[image]' });
    return { verdict };
  }
  const verdict = moderateText(input.text);
  if (input.autoFlag) flag({ entityType: input.entityType || 'text', entityId: input.entityId, ownerId: ctx.user && ctx.user.id, verdict, excerpt: input.text });
  return { verdict };
}

module.exports = {
  id: 'moderation',
  name: 'AI Modération',
  description: 'Vérifie titres, descriptions, avis, commentaires et images ; détecte contenu interdit, contrefaçons, spam, contenu offensant.',
  allowedRoles: ['admin'],
  keywords: ['modération', 'moderation', 'signaler', 'interdit', 'contrefaçon', 'spam', 'offensant', 'vérifier contenu'],
  run,
  // API interne (utilisée à la création de contenu, hors permission agent)
  moderateText,
  moderateImage,
  flag,
};
