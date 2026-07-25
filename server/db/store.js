/**
 * Couche de données E-Market.
 *
 * Implémentation par défaut : persistance JSON sur disque (zéro dépendance),
 * suffisante pour le développement et la démo. L'interface (get/insert/update/
 * remove/find) est volontairement minimale pour permettre de brancher
 * PostgreSQL, MongoDB ou autre sans toucher aux services.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createLogger } = require('../utils/logger');

const log = createLogger('db');
// Répertoire de données surchargeable (isolation des tests, déploiements).
const DATA_DIR = process.env.EMARKET_DATA_DIR || path.join(__dirname, 'data');
const COLLECTIONS = [
  'users', 'products', 'orders', 'reviews',
  'events', 'aiMemory', 'mediaJobs', 'supportTickets',
  'aiConversations', 'moderationFlags', 'brandKits', 'storeBlueprints',
];

const cache = {};

function fileFor(name) {
  return path.join(DATA_DIR, `${name}.json`);
}

function load(name) {
  if (cache[name]) return cache[name];
  try {
    cache[name] = JSON.parse(fs.readFileSync(fileFor(name), 'utf8'));
  } catch {
    cache[name] = [];
  }
  return cache[name];
}

let pendingFlush = new Set();
let flushTimer = null;

function scheduleFlush(name) {
  pendingFlush.add(name);
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    for (const n of pendingFlush) {
      try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(fileFor(n), JSON.stringify(cache[n] || [], null, 2));
      } catch (err) {
        log.error('flush failed', { collection: n, error: err.message });
      }
    }
    pendingFlush = new Set();
    flushTimer = null;
  }, 200);
}

const store = {
  id: () => crypto.randomUUID(),

  all(name) {
    return load(name);
  },

  find(name, predicate) {
    return load(name).filter(predicate);
  },

  findOne(name, predicate) {
    return load(name).find(predicate) || null;
  },

  getById(name, id) {
    return load(name).find((d) => d.id === id) || null;
  },

  insert(name, doc) {
    const record = { id: doc.id || store.id(), createdAt: new Date().toISOString(), ...doc };
    load(name).push(record);
    scheduleFlush(name);
    return record;
  },

  update(name, id, patch) {
    const docs = load(name);
    const idx = docs.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    docs[idx] = { ...docs[idx], ...patch, updatedAt: new Date().toISOString() };
    scheduleFlush(name);
    return docs[idx];
  },

  remove(name, id) {
    const docs = load(name);
    const idx = docs.findIndex((d) => d.id === id);
    if (idx === -1) return false;
    docs.splice(idx, 1);
    scheduleFlush(name);
    return true;
  },

  replaceAll(name, docs) {
    cache[name] = docs;
    scheduleFlush(name);
  },
};

module.exports = { store, COLLECTIONS, DATA_DIR };
