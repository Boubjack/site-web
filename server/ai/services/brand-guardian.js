/**
 * AI BRAND GUARDIAN — protège la cohérence de marque AVANT chaque génération.
 *
 * Vérifie qu'une création (photo, vidéo, affiche, page, publicité) respecte le
 * Brand Kit du vendeur : couleurs, logo, police, ton, identité, style. Si un
 * écart est détecté, le Guardian propose une version corrigée (alignée sur la
 * marque) — jamais de dérive silencieuse.
 */
const brandkit = require('../studio/brandkit');

function norm(s) { return String(s || '').trim().toLowerCase(); }

const TONE_BY_POSITIONING = { Luxe: 'raffiné, exclusif', Premium: 'élégant, sûr', Économique: 'accessible, direct' };

/**
 * @param {object} creation  { colors?:[], font?, tone?, style?, hasLogo? }
 * @returns rapport de conformité + corrections proposées.
 */
function check(creation = {}, sellerId) {
  const kit = brandkit.getForSeller(sellerId);
  const brandColors = (kit.primaryColors || []).concat(kit.secondaryColors || []).map(norm);
  const issues = [];
  const corrections = {};

  // Couleurs
  if (Array.isArray(creation.colors) && creation.colors.length && brandColors.length) {
    const off = creation.colors.filter((c) => !brandColors.includes(norm(c)));
    if (off.length) {
      issues.push({ field: 'couleurs', severity: 'moyenne', found: off, expected: kit.primaryColors });
      corrections.colors = kit.primaryColors;
    }
  }
  // Police
  if (creation.font && kit.font && norm(creation.font) !== norm(kit.font)) {
    issues.push({ field: 'police', severity: 'faible', found: creation.font, expected: kit.font });
    corrections.font = kit.font;
  }
  // Logo
  if (creation.hasLogo === false && kit.logo) {
    issues.push({ field: 'logo', severity: 'moyenne', found: 'absent', expected: 'logo de la marque' });
    corrections.hasLogo = true;
  }
  // Ton (dérivé du positionnement)
  const expectedTone = TONE_BY_POSITIONING[kit.positioning] || 'cohérent avec la marque';
  if (creation.tone && !norm(expectedTone).includes(norm(creation.tone)) && !norm(creation.tone).includes(norm(kit.positioning))) {
    issues.push({ field: 'ton', severity: 'faible', found: creation.tone, expected: expectedTone });
    corrections.tone = expectedTone;
  }
  // Style
  if (creation.style && kit.graphicStyle && norm(creation.style) !== norm(kit.graphicStyle)) {
    issues.push({ field: 'style', severity: 'faible', found: creation.style, expected: kit.graphicStyle });
    corrections.style = kit.graphicStyle;
  }

  const compliant = issues.length === 0;
  const score = Math.max(0, 100 - issues.reduce((s, i) => s + (i.severity === 'moyenne' ? 20 : 10), 0));
  return {
    brand: kit.brandName, compliant, score, issues,
    corrections: compliant ? null : corrections,
    guidance: brandkit.styleGuide(kit).directives,
    note: compliant ? 'Création conforme à l\'identité de la marque.' : 'Écarts détectés — version corrigée proposée (le vendeur valide).',
  };
}

/** Applique les corrections proposées à la création (version alignée marque). */
function guard(creation = {}, sellerId) {
  const report = check(creation, sellerId);
  const corrected = report.compliant ? creation : { ...creation, ...report.corrections };
  return { report, corrected };
}

module.exports = { check, guard };
