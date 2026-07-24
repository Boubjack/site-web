/**
 * Registre des assistants IA E-Market.
 *
 * Chaque assistant est un module indépendant qui déclare :
 *   - id, name, description, style
 *   - allowedRoles      → permissions (qui peut lui parler)
 *   - systemPrompt      → son propre prompt système
 *   - buildTools(ctx)   → ses propres outils, avec exécuteurs dont l'accès
 *                          aux données est limité par le contexte (ex : un
 *                          vendeur ne voit que ses propres données)
 *   - directives        → marqueurs de fin de message (PRODUCTS, CHART…)
 *   - finalize(text,ctx)→ résout les directives en payload structuré
 *   - localFallback     → réponse sans clé API (moteur de règles)
 *   - quickActions / suggestions → configuration d'interface
 *
 * Le moteur (provider.agentLoop) est commun, mais TOUT le reste est propre à
 * chaque assistant : prompt, permissions, outils, données, historique, style,
 * interface. Ajouter un assistant = déposer un module et l'enregistrer ici.
 */
const provider = require('../provider/anthropic');
const { store } = require('../../db/store');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:assistants');
const registry = new Map();

function register(def) {
  for (const field of ['id', 'name', 'systemPrompt']) {
    if (!def[field]) throw new Error(`Assistant invalide : "${field}" manquant.`);
  }
  registry.set(def.id, def);
  log.info('assistant enregistré', { id: def.id });
}

function get(id) {
  return registry.get(id) || null;
}

/** Permissions : allowedRoles=null → public (invités inclus). */
function canAccess(def, user) {
  if (!def.allowedRoles) return true;
  if (!user) return def.allowedRoles.includes('guest');
  return def.allowedRoles.includes('*') || def.allowedRoles.includes(user.role);
}

/** Liste des assistants accessibles à l'utilisateur (pour l'UI). */
function listFor(user) {
  return [...registry.values()]
    .filter((d) => canAccess(d, user))
    .map((d) => ({
      id: d.id,
      name: d.name,
      description: d.description || '',
      style: d.style || '',
      avatar: d.avatar || '✨',
      accent: d.accent || '#1a8cff',
      greeting: d.greeting || '',
      features: d.features || {},
      quickActions: d.quickActions || [],
      suggestions: d.suggestions || [],
    }));
}

/* ---------- Historique propre à chaque assistant, par utilisateur ---------- */

function historyRecord(assistantId, userId) {
  return store.findOne('aiConversations', (c) => c.assistantId === assistantId && c.userId === userId);
}

function loadHistory(assistantId, userId) {
  if (!userId) return [];
  const rec = historyRecord(assistantId, userId);
  return rec ? rec.messages : [];
}

function saveHistory(assistantId, userId, messages) {
  if (!userId) return;
  const trimmed = messages.slice(-40);
  const rec = historyRecord(assistantId, userId);
  if (rec) store.update('aiConversations', rec.id, { messages: trimmed });
  else store.insert('aiConversations', { assistantId, userId, messages: trimmed });
}

function clearHistory(assistantId, userId) {
  if (!userId) return;
  const rec = historyRecord(assistantId, userId);
  if (rec) store.remove('aiConversations', rec.id);
}

/* ---------- Directives de fin de message (PRODUCTS:[...], CHART:[...]) ---------- */

const DIRECTIVE_RE = /\n?[A-Z_]+:\s*\[[^\]]*\]\s*/g;
const DIRECTIVE_START = /[A-Z_]+:\s*\[/;

function stripDirectives(text) {
  return text.replace(DIRECTIVE_RE, '').trim();
}

function parseDirective(text, name) {
  const m = text.match(new RegExp(`${name}:\\s*\\[([^\\]]*)\\]`));
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim().replace(/["']/g, '')).filter(Boolean);
}

/* ---------- Exécution d'une conversation (streaming SSE) ---------- */

async function run(assistantId, { user, messages, sse }) {
  const def = get(assistantId);
  if (!def) throw Object.assign(new Error('Assistant introuvable.'), { status: 404 });
  if (!canAccess(def, user)) throw Object.assign(new Error('Accès refusé à cet assistant.'), { status: 403 });

  const ctx = { user, assistant: def };
  const tools = typeof def.buildTools === 'function' ? def.buildTools(ctx) : [];
  const toolDefs = tools.map((t) => t.def);

  const executeTool = async (name, input) => {
    const tool = tools.find((t) => t.def.name === name);
    // Garde-fou : le modèle ne peut appeler qu'un outil déclaré par CET assistant.
    if (!tool) return { error: `Outil non autorisé pour cet assistant : ${name}` };
    return tool.run(input || {}, ctx);
  };

  if (user) saveHistory(assistantId, user.id, messages);

  // Mode local (sans clé API) : moteur de règles propre à l'assistant.
  if (!provider.enabled()) {
    const result = def.localFallback ? await def.localFallback(ctx, messages) : { text: 'Assistant indisponible en mode local.' };
    if (result.text) sse('text', { delta: result.text });
    sse('done', { ...result, local: true });
    if (user) saveHistory(assistantId, user.id, [...messages, { role: 'assistant', content: result.text || '' }]);
    return;
  }

  const hasDirectives = Array.isArray(def.directives) && def.directives.length > 0;
  let buffered = '';

  const { text } = await provider.agentLoop({
    system: def.systemPrompt,
    messages,
    tools: toolDefs,
    executeTool,
    onToolUse: (name) => sse('status', { tool: name }),
    onText: (delta) => {
      buffered += delta;
      // Ne pas streamer les lignes techniques de directives au client.
      if (hasDirectives && DIRECTIVE_START.test(buffered)) return;
      sse('text', { delta });
    },
    maxTokens: def.maxTokens || 4096,
  });

  const cleanText = hasDirectives ? stripDirectives(text) : text;
  const extra = def.finalize ? await def.finalize(text, ctx) : {};
  if (user) saveHistory(assistantId, user.id, [...messages, { role: 'assistant', content: cleanText }]);
  sse('done', { text: cleanText, ...extra });
}

module.exports = {
  register,
  get,
  canAccess,
  listFor,
  run,
  loadHistory,
  clearHistory,
  parseDirective,
  stripDirectives,
};
