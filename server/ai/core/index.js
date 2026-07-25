/**
 * Point d'entrée du AI Core Engine : instancie le Core et enregistre tous les
 * moteurs. Importer ce module renvoie le singleton `core`, prêt à l'emploi.
 *
 *   const core = require('./core');
 *   await core.run('theme', 'generate', { category: 'mode' }, { user });
 *
 * Ajouter un moteur : l'ajouter à core/engines.js. Rien d'autre à modifier.
 */
const { Core } = require('./core');
const { ENGINES } = require('./engines');

const core = new Core();
for (const engine of ENGINES) core.register(engine);

// Exemple de câblage événementiel : trace les erreurs de moteur de façon centralisée.
core.events.on('engine:run:error', (e) => core.log.warn('moteur en erreur', e));

module.exports = core;
