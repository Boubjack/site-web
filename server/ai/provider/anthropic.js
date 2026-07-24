/**
 * Fournisseur de modèles E-Market AI — Anthropic (Claude).
 *
 * Règles :
 *  - La clé API est lue uniquement depuis l'environnement serveur ;
 *    elle n'est jamais transmise au client.
 *  - Sans clé configurée, `enabled` vaut false et chaque service bascule
 *    sur son moteur local (règles sur le catalogue) — le site reste
 *    fonctionnel en développement.
 *  - Architecture prête pour d'autres familles de modèles (vision incluse ;
 *    génération image/vidéo via server/ai/services/photoStudio et videoStudio).
 */
const Anthropic = require('@anthropic-ai/sdk');
const config = require('../../config');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:provider');

const client = config.ai.enabled ? new Anthropic({ apiKey: config.ai.anthropicApiKey }) : null;

function enabled() {
  return Boolean(client);
}

/**
 * Complétion texte simple (non streamée).
 * @returns {Promise<string>}
 */
async function complete({ system, messages, maxTokens = 2048, fast = false }) {
  if (!client) throw new Error('E-Market AI: aucun fournisseur configuré.');
  const response = await client.messages.create({
    model: fast ? config.ai.fastModel : config.ai.model,
    max_tokens: maxTokens,
    ...(fast ? {} : { thinking: { type: 'adaptive' } }),
    system,
    messages,
  });
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

/**
 * Complétion contrainte à un schéma JSON (sorties structurées).
 * @returns {Promise<object>}
 */
async function completeJson({ system, messages, schema, maxTokens = 2048, fast = false }) {
  if (!client) throw new Error('E-Market AI: aucun fournisseur configuré.');
  const response = await client.messages.create({
    model: fast ? config.ai.fastModel : config.ai.model,
    max_tokens: maxTokens,
    system,
    messages,
    output_config: { format: { type: 'json_schema', schema } },
  });
  const text = response.content.find((b) => b.type === 'text');
  return JSON.parse(text ? text.text : '{}');
}

/**
 * Boucle agentique streamée : outils exécutés côté serveur, texte streamé
 * au fil de l'eau via onText. Utilisée par l'assistant client, l'assistant
 * admin et le service client.
 *
 * @param {object} opts
 * @param {string} opts.system
 * @param {Array}  opts.messages        Historique au format Messages API.
 * @param {Array}  opts.tools           Définitions d'outils (JSON Schema).
 * @param {Function} opts.executeTool   async (name, input) => string
 * @param {Function} opts.onText        (delta) => void
 * @param {Function} [opts.onToolUse]   (name, input) => void
 * @returns {Promise<{text: string, toolCalls: Array}>}
 */
async function agentLoop({ system, messages, tools = [], executeTool, onText, onToolUse, maxTokens = 4096 }) {
  if (!client) throw new Error('E-Market AI: aucun fournisseur configuré.');
  const history = [...messages];
  const toolCalls = [];
  let fullText = '';
  let rounds = 0;
  const MAX_ROUNDS = 8;

  while (rounds < MAX_ROUNDS) {
    rounds += 1;
    const stream = client.messages.stream({
      model: config.ai.model,
      max_tokens: maxTokens,
      thinking: { type: 'adaptive' },
      system,
      messages: history,
      ...(tools.length ? { tools } : {}),
    });

    stream.on('text', (delta) => {
      fullText += delta;
      if (onText) onText(delta);
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'pause_turn') {
      history.push({ role: 'assistant', content: message.content });
      continue;
    }

    if (message.stop_reason !== 'tool_use') break;

    const toolUseBlocks = message.content.filter((b) => b.type === 'tool_use');
    history.push({ role: 'assistant', content: message.content });

    const results = [];
    for (const block of toolUseBlocks) {
      if (onToolUse) onToolUse(block.name, block.input);
      toolCalls.push({ name: block.name, input: block.input });
      let result;
      try {
        result = await executeTool(block.name, block.input);
      } catch (err) {
        log.warn('tool execution failed', { tool: block.name, error: err.message });
        results.push({
          type: 'tool_result', tool_use_id: block.id,
          content: `Erreur outil: ${err.message}`, is_error: true,
        });
        continue;
      }
      results.push({
        type: 'tool_result', tool_use_id: block.id,
        content: typeof result === 'string' ? result : JSON.stringify(result),
      });
    }
    history.push({ role: 'user', content: results });
  }

  return { text: fullText, toolCalls };
}

/**
 * Analyse d'image (vision) avec sortie JSON structurée.
 * @param {object} opts
 * @param {string} opts.imageBase64  Image encodée base64 (sans préfixe data:).
 * @param {string} opts.mediaType    ex. "image/jpeg"
 */
async function visionJson({ imageBase64, mediaType, system, prompt, schema, maxTokens = 2048 }) {
  if (!client) throw new Error('E-Market AI: aucun fournisseur configuré.');
  const response = await client.messages.create({
    model: config.ai.model,
    max_tokens: maxTokens,
    system,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: prompt },
      ],
    }],
    output_config: { format: { type: 'json_schema', schema } },
  });
  const text = response.content.find((b) => b.type === 'text');
  return JSON.parse(text ? text.text : '{}');
}

module.exports = { enabled, complete, completeJson, agentLoop, visionJson };
