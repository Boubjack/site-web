/**
 * Fournisseur de texte UNIFIÉ E-Market AI.
 *
 * Route les complétions vers le backend configuré, en privilégiant les
 * solutions gratuites / open source :
 *   - anthropic  : Claude (si ANTHROPIC_API_KEY)
 *   - openrouter : modèles open source gratuits (si OPENROUTER_API_KEY)
 *   - ollama     : modèles locaux, 100 % hors-ligne (si OLLAMA_BASE_URL)
 *   - local      : aucun modèle → l'appelant bascule sur son moteur de règles.
 *
 * Aucune clé ne quitte le serveur. Les modules existants qui importent
 * provider/anthropic continuent de fonctionner à l'identique ; ce module est
 * l'entrée « multi-fournisseurs » utilisée par les nouvelles capacités.
 */
const config = require('../../config');
const anthropic = require('./anthropic');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:llm');

function activeProvider() {
  return config.ai.activeProvider; // 'anthropic' | 'openrouter' | 'ollama' | 'local'
}

function enabled() {
  return activeProvider() !== 'local';
}

/** Extrait le premier bloc JSON valide d'un texte de modèle. */
function extractJson(text) {
  if (!text) return {};
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1) return {};
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return {}; }
}

/* ------------------------------------------------------------------ */
/* OpenRouter (API compatible OpenAI)                                  */
/* ------------------------------------------------------------------ */
async function openrouterChat({ system, messages, maxTokens, json }) {
  const body = {
    model: config.ai.openrouterModel,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      ...messages,
    ],
    ...(json ? { response_format: { type: 'json_object' } } : {}),
  };
  const res = await fetch(`${config.ai.openrouterBaseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${config.ai.openrouterApiKey}`,
      'X-Title': 'E-Market AI',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

/* ------------------------------------------------------------------ */
/* Ollama (local)                                                      */
/* ------------------------------------------------------------------ */
async function ollamaChat({ system, messages, json }) {
  const res = await fetch(`${config.ai.ollamaBaseUrl.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ai.ollamaModel,
      stream: false,
      ...(json ? { format: 'json' } : {}),
      messages: [
        ...(system ? [{ role: 'system', content: system }] : []),
        ...messages,
      ],
    }),
  });
  if (!res.ok) throw new Error(`Ollama ${res.status}`);
  const data = await res.json();
  return data.message?.content || '';
}

/* ------------------------------------------------------------------ */
/* API publique                                                        */
/* ------------------------------------------------------------------ */
async function complete({ system, messages, maxTokens = 1024, fast = false }) {
  const p = activeProvider();
  if (p === 'anthropic') return anthropic.complete({ system, messages, maxTokens, fast });
  if (p === 'openrouter') return openrouterChat({ system, messages, maxTokens, json: false });
  if (p === 'ollama') return ollamaChat({ system, messages, json: false });
  throw new Error('E-Market AI : aucun fournisseur de texte configuré.');
}

async function completeJson({ system, messages, schema, maxTokens = 1024, fast = false }) {
  const p = activeProvider();
  if (p === 'anthropic') return anthropic.completeJson({ system, messages, schema, maxTokens, fast });
  const jsonSystem = `${system || ''}\n\nRéponds UNIQUEMENT avec un objet JSON valide conforme à ce schéma : ${JSON.stringify(schema)}. Aucun texte hors du JSON.`;
  const text = p === 'openrouter'
    ? await openrouterChat({ system: jsonSystem, messages, maxTokens, json: true })
    : p === 'ollama'
      ? await ollamaChat({ system: jsonSystem, messages, json: true })
      : (() => { throw new Error('E-Market AI : aucun fournisseur de texte configuré.'); })();
  return extractJson(await text);
}

module.exports = { enabled, activeProvider, complete, completeJson, extractJson, log };
