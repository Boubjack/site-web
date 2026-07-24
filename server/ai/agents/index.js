/**
 * Enregistrement de tous les agents IA spécialisés.
 * Ajouter un agent = créer son module et l'enregistrer ici. Aucun agent
 * existant n'a besoin d'être modifié (architecture ouverte à l'extension).
 */
const registry = require('./registry');

registry.register(require('./product'));
registry.register(require('./photo'));
registry.register(require('./video'));
registry.register(require('./marketing'));
registry.register(require('./moderation'));
registry.register(require('./fraud'));
registry.register(require('./reviews'));
registry.register(require('./stock'));
registry.register(require('./trends'));
registry.register(require('./personalization'));
registry.register(require('./translation'));
registry.register(require('./recommendation'));

// Cerveau central + comité de direction IA (C-suite). Admin uniquement.
registry.register(require('./brain'));
registry.register(require('./ceo'));
registry.register(require('./cfo'));
registry.register(require('./cmo'));
registry.register(require('./coo'));
registry.register(require('./cto'));

module.exports = registry;
