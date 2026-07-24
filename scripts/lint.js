#!/usr/bin/env node
/**
 * Lint minimaliste ZÉRO DÉPENDANCE : vérifie la syntaxe de tous les fichiers
 * .js du serveur, des tests et des scripts via `node --check`. Attrape les
 * erreurs de syntaxe avant l'exécution / le déploiement.
 */
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOTS = ['server', 'test', 'scripts', 'public/js'];
const root = path.join(__dirname, '..');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.js')) out.push(full);
  }
  return out;
}

let files = [];
for (const r of ROOTS) {
  const dir = path.join(root, r);
  if (fs.existsSync(dir)) files = files.concat(walk(dir));
}

let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    failed += 1;
    process.stderr.write(`✘ ${path.relative(root, file)}\n${err.stderr || err.message}\n`);
  }
}

if (failed) {
  console.error(`\nLint : ${failed} fichier(s) en erreur sur ${files.length}.`);
  process.exit(1);
}
console.log(`Lint OK : ${files.length} fichiers vérifiés.`);
