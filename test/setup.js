/**
 * Amorçage commun des tests : répertoire de données ISOLÉ (temporaire) + seed.
 * À requérir en TOUT PREMIER dans chaque fichier de test, avant tout module
 * qui touche au store (l'isolation dépend de EMARKET_DATA_DIR défini avant que
 * le store ne soit chargé).
 */
const os = require('os');
const path = require('path');
const fs = require('fs');

if (!process.env.EMARKET_DATA_DIR) {
  process.env.EMARKET_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'emarket-test-'));
}
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
process.env.LLM_PROVIDER = 'none'; // tests déterministes : moteur local

require('../server/db/seed').seed({ force: true });

/** Démarre le serveur sur un port éphémère et renvoie { url, close }. */
function startServer() {
  const { start } = require('../server/index');
  const server = start(0);
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}

/** Petit client HTTP JSON. */
async function api(url, path, { method = 'GET', token, body } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(url + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function login(url, email, password) {
  const { data } = await api(url, '/api/auth/login', { method: 'POST', body: { email, password } });
  return data.token;
}

module.exports = { startServer, api, login };
