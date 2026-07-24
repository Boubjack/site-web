/**
 * Point d'entrée du module assistants : enregistre les trois assistants
 * distincts dans le registre. Pour en ajouter un, créer un module et
 * l'enregistrer ici — le reste (routes, UI, permissions) le prend en charge.
 */
const registry = require('./registry');

registry.register(require('./shopping'));
registry.register(require('./seller'));
registry.register(require('./operator'));

module.exports = registry;
