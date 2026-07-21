#!/usr/bin/env bash
# Lanceur tout-en-un : installe les dépendances, demande la clé API une seule
# fois (mémorisée), puis démarre l'agent. Usage : ./start.sh
set -e
cd "$(dirname "$0")"

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js est requis. Installez-le depuis https://nodejs.org puis relancez."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "Installation des dépendances (une seule fois)…"
  npm install --no-audit --no-fund
fi

ENV_FILE=".mini-agent/.env"
if [ -z "$ANTHROPIC_API_KEY" ] && ! grep -q "ANTHROPIC_API_KEY" "$ENV_FILE" 2>/dev/null; then
  echo
  echo "Collez votre clé API Claude puis Entrée."
  echo "(elle est sur https://console.anthropic.com/settings/keys, format sk-ant-...)"
  printf "Clé : "
  read -r KEY
  mkdir -p .mini-agent
  echo "ANTHROPIC_API_KEY=$KEY" >> "$ENV_FILE"
  echo "✓ Clé enregistrée (elle ne sera plus redemandée)."
  echo
fi

exec node agent.js "$@"
