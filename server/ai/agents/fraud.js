/**
 * AGENT — AI Fraude. Détecte faux comptes, faux avis, paiements suspects,
 * commandes inhabituelles, vendeurs frauduleux. Score de risque :
 * Normal / À vérifier / Risque élevé. Permissions : admin.
 */
const fraud = require('../services/fraud');

async function run(input) {
  if (input.orderCheck) return { order: fraud.checkOrder(input.orderCheck) };
  return fraud.overview();
}

module.exports = {
  id: 'fraud',
  name: 'AI Fraude',
  description: 'Détection de fraude : faux comptes, faux avis, paiements/commandes suspects, vendeurs frauduleux, score de risque.',
  allowedRoles: ['admin'],
  keywords: ['fraude', 'fraud', 'suspect', 'faux compte', 'faux avis', 'risque', 'sécurité', 'paiement suspect'],
  tool: {
    name: 'fraud_overview',
    description: 'Vue de sécurité : scores de risque (vert/orange/rouge) et signaux suspects sur les utilisateurs et vendeurs.',
    input_schema: { type: 'object', properties: {} },
  },
  run,
};
