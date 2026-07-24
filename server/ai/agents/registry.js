/**
 * Registre des AGENTS IA spécialisés d'E-Market.
 *
 * Un agent est un travailleur mono-responsabilité (Photo, Vidéo, Marketing,
 * Modération, Fraude, Avis, Stock, Tendances, Personnalisation, Traduction,
 * Produit, Recommandation). Il est modulaire, permissionné par rôle, et
 * découvrable par mots-clés (routage de l'orchestrateur).
 *
 * Contrat d'un agent :
 *   {
 *     id, name, description,
 *     allowedRoles: ['seller','admin'] | null,   // permissions (null = public)
 *     keywords: [...],                            // routage par l'orchestrateur
 *     tool?: { name, description, input_schema }, // exposé dans un assistant (facultatif)
 *     async run(input, ctx) => result             // ctx = { user }
 *   }
 *
 * Ajouter un agent = déposer un module et l'enregistrer dans index.js.
 * Aucun agent existant n'a besoin d'être modifié.
 */
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:agents');
const agents = new Map();

function register(agent) {
  for (const f of ['id', 'name', 'run']) {
    if (!agent[f]) throw new Error(`Agent invalide : "${f}" manquant.`);
  }
  agents.set(agent.id, agent);
  log.info('agent enregistré', { id: agent.id });
}

function get(id) {
  return agents.get(id) || null;
}

function all() {
  return [...agents.values()];
}

/** Permissions : allowedRoles=null → tous ; sinon le rôle doit figurer. */
function canUse(agent, user) {
  if (!agent.allowedRoles) return true;
  const role = user ? user.role : 'guest';
  return agent.allowedRoles.includes('*') || agent.allowedRoles.includes(role);
}

function listForRole(user) {
  return all()
    .filter((a) => canUse(a, user))
    .map((a) => ({ id: a.id, name: a.name, description: a.description || '', keywords: a.keywords || [] }));
}

/** Exécute un agent en garantissant la permission (données limitées au rôle). */
async function run(id, input, ctx) {
  const agent = get(id);
  if (!agent) throw Object.assign(new Error(`Agent introuvable : ${id}`), { status: 404 });
  if (!canUse(agent, ctx && ctx.user)) throw Object.assign(new Error(`Accès refusé à l'agent ${id}.`), { status: 403 });
  return agent.run(input || {}, ctx || {});
}

/** Agents pertinents pour un texte + rôle (scoring par mots-clés). */
function match(text, user, limit = 4) {
  const q = String(text || '').toLowerCase();
  return all()
    .filter((a) => canUse(a, user))
    .map((a) => ({ agent: a, score: (a.keywords || []).reduce((s, k) => s + (q.includes(k) ? 1 : 0), 0) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.agent);
}

module.exports = { register, get, all, canUse, listForRole, run, match };
