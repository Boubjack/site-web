/**
 * Adaptateurs de RENDU pour moteurs open source.
 *
 * Deux voies, toutes deux vers des modèles OPEN SOURCE :
 *   - Replicate : héberge FLUX.1, Real-ESRGAN, RMBG, LTX-Video, Wan 2.2… via une
 *     seule API (REPLICATE_API_TOKEN). Réfs de modèles surchargeables en .env.
 *   - HTTP auto-hébergé : ComfyUI / Automatic1111 / serveur maison
 *     (IMAGE_PROVIDER_URL / VIDEO_PROVIDER_URL) — reçoit un prompt, renvoie une
 *     URL de média.
 *
 * Ces adaptateurs ne sont appelés que si un moteur est configuré ; sinon le
 * studio reste en mode spécification (aucun appel réseau).
 */
const config = require('../../config');
const { createLogger } = require('../../utils/logger');

const log = createLogger('ai:render');
const RESOLUTION_PX = { '1080p': [1920, 1080], '2k': [2560, 1440], '4k': [3840, 2160], '8k': [7680, 4320] };

/* ---------------- Construction des prompts depuis les specs ---------------- */
function buildImagePrompt(spec = {}) {
  const p = spec.product || {};
  const bg = spec.backgrounds ? spec.backgrounds.recommended : spec.background;
  const parts = [
    `photographie produit professionnelle de ${p.name || 'produit'}`,
    spec.photoTypeLabel && `style ${spec.photoTypeLabel}`,
    bg && `décor : ${bg}`,
    spec.lighting && `éclairage : ${spec.lighting}`,
    spec.mannequin && `porté par un mannequin ${spec.mannequin.ethnicity} ${spec.mannequin.gender}`,
    'photoréaliste, haute résolution, net, sans bruit, couleurs fidèles, logos et textures préservés',
  ].filter(Boolean);
  if (spec.brandKit) parts.push(`identité de marque « ${spec.brandKit.brand} », palette ${(spec.brandKit.palette && spec.brandKit.palette.primary || []).join(' ')}`);
  return parts.join(', ');
}

function buildVideoPrompt(plan = {}) {
  const p = plan.product || {};
  return [
    `publicité vidéo cinématographique de ${p.name || 'produit'}`,
    plan.style && `style ${plan.style}`,
    plan.cameraMoves && `mouvements caméra : ${(plan.cameraMoves || []).slice(0, 3).join(', ')}`,
    plan.lighting && `éclairage : ${(plan.lighting || []).slice(0, 2).join(', ')}`,
    'qualité premium, fluide, stabilisé, HDR',
  ].filter(Boolean).join(', ');
}

/* ---------------- Replicate ---------------- */
async function replicatePredict(modelRef, input) {
  if (!config.media.replicateApiToken) throw new Error('REPLICATE_API_TOKEN manquant.');
  const headers = {
    Authorization: `Token ${config.media.replicateApiToken}`,
    'Content-Type': 'application/json',
    Prefer: 'wait', // Replicate patiente jusqu'à ~60s côté serveur si possible
  };
  // "owner/model:version" → endpoint predictions ; "owner/model" → endpoint modèle.
  const [ref, version] = modelRef.split(':');
  const url = version
    ? 'https://api.replicate.com/v1/predictions'
    : `https://api.replicate.com/v1/models/${ref}/predictions`;
  const body = version ? { version, input } : { input };

  let res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`Replicate ${res.status}`);
  let pred = await res.json();

  // Poll jusqu'à complétion (au cas où "wait" ne suffit pas).
  const started = Date.now();
  while (['starting', 'processing'].includes(pred.status) && Date.now() - started < 120000) {
    await new Promise((r) => setTimeout(r, 1500));
    res = await fetch(pred.urls.get, { headers });
    pred = await res.json();
  }
  if (pred.status !== 'succeeded') throw new Error(`Replicate: statut ${pred.status}`);
  const out = pred.output;
  return Array.isArray(out) ? out[0] : out; // URL du média généré
}

/* ---------------- HTTP auto-hébergé ---------------- */
async function httpRender(baseUrl, payload) {
  const res = await fetch(baseUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  if (!res.ok) throw new Error(`Moteur ${res.status}`);
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    return data.url || data.output || data.image || null;
  }
  return null; // (un moteur renvoyant des octets bruts serait géré par un stockage dédié)
}

/* ---------------- Points d'entrée ---------------- */
async function renderImage(spec) {
  const prompt = buildImagePrompt(spec);
  const [width, height] = RESOLUTION_PX[spec.resolution] || RESOLUTION_PX['4k'];
  const provider = config.media.imageProvider;

  if (config.media.imageProviderUrl) {
    const url = await httpRender(config.media.imageProviderUrl, { prompt, width, height, consistency: spec.consistency });
    return { rendered: Boolean(url), mode: 'render', engine: `http:${provider}`, prompt, outputUrl: url };
  }
  // flux | sdxl | replicate → via Replicate (modèles open source).
  const model = provider === 'sdxl' ? (process.env.SDXL_MODEL || 'stability-ai/sdxl') : config.media.fluxModel;
  const url = await replicatePredict(model, { prompt, aspect_ratio: spec.aspectRatio || '1:1' });
  return { rendered: Boolean(url), mode: 'render', engine: `replicate:${model}`, prompt, outputUrl: url };
}

async function renderVideo(plan) {
  const prompt = buildVideoPrompt(plan);
  const provider = config.media.videoProvider;

  if (config.media.videoProviderUrl) {
    const url = await httpRender(config.media.videoProviderUrl, { prompt, duration: plan.duration, fps: plan.fps });
    return { rendered: Boolean(url), mode: 'render', engine: `http:${provider}`, prompt, outputUrl: url };
  }
  const model = provider === 'wan' ? config.media.wanModel : config.media.ltxModel;
  const url = await replicatePredict(model, { prompt });
  return { rendered: Boolean(url), mode: 'render', engine: `replicate:${model}`, prompt, outputUrl: url };
}

module.exports = { renderImage, renderVideo, buildImagePrompt, buildVideoPrompt };
