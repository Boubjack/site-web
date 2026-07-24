/**
 * ORCHESTRATEUR IA E-Market.
 *
 * Reçoit toutes les demandes, identifie le bon agent, envoie la requête à
 * l'agent spécialisé, et combine les réponses lorsque plusieurs agents sont
 * nécessaires. Respecte strictement les permissions : il ne route que vers des
 * agents autorisés pour le rôle de l'utilisateur.
 *
 * Deux modes :
 *  - PIPELINE composite : pour les tâches multi-agents connues (ex. une pub
 *    vidéo = Produit → Photo → Vidéo → Marketing). Chaque agent collabore et
 *    ses résultats alimentent le suivant / sont rassemblés.
 *  - ROUTAGE simple : classe la demande (LLM si dispo, sinon mots-clés) vers
 *    le(s) agent(s) pertinent(s) et rassemble.
 */
const provider = require('./provider/anthropic');
const agents = require('./agents');
const catalog = require('./services/catalog');

/* ---------------- Pipelines composites ---------------- */
// Chaque pipeline liste les agents à enchaîner. Le contexte (produit) circule.
const PIPELINES = [
  {
    id: 'video-ad',
    label: 'Publicité vidéo complète',
    match: /(pub|publicit|clip|spot|video|vidéo).*(produit|nouveau|complet|marketing)|cr[ée]e.*(pub|vid[ée]o)|video ad/i,
    steps: ['product', 'photo', 'video', 'marketing'],
    roles: ['seller', 'admin'],
  },
  {
    id: 'launch-kit',
    label: 'Kit de lancement produit',
    match: /(lance|lancement|mettre en ligne|nouveau produit|kit).*(produit)?/i,
    steps: ['product', 'photo', 'marketing'],
    roles: ['seller', 'admin'],
  },
  {
    id: 'visual-pack',
    label: 'Pack visuel (photos + vidéo)',
    match: /(visuel|photos?|images?).*(vid[ée]o)|pack (visuel|média)/i,
    steps: ['photo', 'video'],
    roles: ['seller', 'admin'],
  },
];

function detectPipeline(text, user) {
  const role = user ? user.role : 'guest';
  return PIPELINES.find((p) => p.match.test(text || '') && p.roles.includes(role)) || null;
}

/* ---------------- Exécution d'un pipeline ---------------- */
async function runPipeline(pipeline, { user, text, productId }) {
  const ctx = { user };
  const steps = [];
  const shared = { productId: productId || null, productName: null };

  // Si un produit est nommé mais sans id, tenter de le retrouver dans le catalogue.
  if (!shared.productId && text) {
    const found = catalog.searchProducts({ query: text, limit: 1 })[0];
    if (found) { shared.productId = found.id; shared.productName = found.name; }
  }

  for (const agentId of pipeline.steps) {
    if (!agents.canUse(agents.get(agentId), user)) continue; // sécurité
    const input = buildStepInput(agentId, shared, text);
    try {
      const result = await agents.run(agentId, input, ctx);
      steps.push({ agent: agentId, name: agents.get(agentId).name, result });
    } catch (err) {
      steps.push({ agent: agentId, name: agents.get(agentId).name, error: err.message });
    }
  }

  return {
    mode: 'pipeline',
    pipeline: pipeline.id,
    label: pipeline.label,
    agents: pipeline.steps,
    steps,
    summary: summarize(pipeline, steps),
  };
}

function buildStepInput(agentId, shared, text) {
  switch (agentId) {
    case 'product': return { name: shared.productName || text || 'produit', hints: '' };
    case 'photo': return { productId: shared.productId, productName: shared.productName, photoType: 'publicitaire', resolution: '4k' };
    case 'video': return { productId: shared.productId, productName: shared.productName, style: 'premium', duration: 20, format: 'tiktok' };
    case 'marketing': return { productId: shared.productId, campaign: 'standard' };
    default: return { productId: shared.productId };
  }
}

function summarize(pipeline, steps) {
  const done = steps.filter((s) => !s.error).map((s) => s.name);
  return `${pipeline.label} : ${done.length}/${pipeline.steps.length} agents ont collaboré (${done.join(' → ')}).`;
}

/* ---------------- Routage simple (agents pertinents) ---------------- */
async function routeSimple({ user, text }) {
  const matched = agents.match(text, user, 3);
  if (!matched.length) {
    return { mode: 'route', agents: [], steps: [], summary: "Aucun agent spécialisé identifié pour cette demande." };
  }
  const ctx = { user };
  const steps = [];
  for (const agent of matched) {
    try {
      const input = defaultInputFor(agent.id, text, user);
      steps.push({ agent: agent.id, name: agent.name, result: await agent.run(input, ctx) });
    } catch (err) {
      steps.push({ agent: agent.id, name: agent.name, error: err.message });
    }
  }
  return { mode: 'route', agents: matched.map((a) => a.id), steps, summary: `${matched.length} agent(s) mobilisé(s) : ${matched.map((a) => a.name).join(', ')}.` };
}

function defaultInputFor(agentId, text, user) {
  switch (agentId) {
    case 'translation': return { text, target: /english|anglais/i.test(text) ? 'en' : 'en' };
    case 'stock': return { sellerId: user && user.role === 'seller' ? user.id : undefined };
    case 'reviews': return { sellerId: user && user.role === 'seller' ? user.id : undefined };
    case 'personalization': return {};
    case 'recommendation': return {};
    default: return { query: text, text };
  }
}

/* ---------------- Point d'entrée ---------------- */
/**
 * @returns {Promise<object>} { mode, agents, steps, summary, ... }
 */
async function handle({ user, text, productId }) {
  const pipeline = detectPipeline(text, user);
  if (pipeline) return runPipeline(pipeline, { user, text, productId });
  return routeSimple({ user, text });
}

/** Liste des pipelines disponibles pour un rôle (UI). */
function pipelinesFor(user) {
  const role = user ? user.role : 'guest';
  return PIPELINES.filter((p) => p.roles.includes(role)).map((p) => ({ id: p.id, label: p.label, agents: p.steps }));
}

module.exports = { handle, runPipeline, detectPipeline, pipelinesFor, PIPELINES };
