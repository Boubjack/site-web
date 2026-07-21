# mini-code-agent

Un assistant de code **agentique** en ligne de commande, propulsé par l'API Claude — conçu pour ressembler à Claude Code, en version compacte et lisible (une seule dépendance : le SDK Anthropic).

Il ne se contente pas de discuter : il **raisonne, exécute des commandes, lit/écrit des fichiers et cherche sur le web**, en bouclant automatiquement (appel du modèle → exécution d'outils → renvoi des résultats → …) jusqu'à ce que la tâche soit terminée.

## Fonctionnalités (à la Claude Code)

- **Boucle agentique** : le modèle enchaîne les appels d'outils jusqu'à la fin de la tâche (`stop_reason` géré manuellement, y compris `pause_turn` pour les outils serveur).
- **Pensée adaptative** : le modèle réfléchit avant d'agir ; le résumé de son raisonnement s'affiche en grisé au fil de l'eau (`AGENT_THINKING=0` pour couper).
- **Contexte projet** : lit automatiquement `CLAUDE.md` (ou `AGENTS.md`) et l'injecte dans le prompt système.
- **Cache de prompt** : le prompt système et les outils sont mis en cache (`cache_control`) pour réduire le coût des tours suivants.
- **Suivi du coût** : compteur de tokens (entrée / sortie / cache) et estimation en dollars, via `/cost`.
- **Todos** : outil `todo_write` pour planifier et suivre les tâches multi-étapes (comme le TodoWrite de Claude Code).
- **Sous-agents** : outil `task` qui délègue de l'exploration à un sous-agent autonome en lecture seule ; plusieurs sous-agents s'exécutent **en parallèle**.
- **Édition multiple** : outil `multi_edit` pour appliquer plusieurs remplacements atomiques dans un même fichier.
- **Permissions par outil** : politique `allow`/`ask`/`deny` par outil, personnalisable via `.mini-agent/permissions.json` ; visible avec `/permissions`.
- **Recherche web** : outils serveur `web_search` et `web_fetch` (`AGENT_WEB=0` pour couper).
- **Persistance de session** : chaque tour est sauvegardé ; `--continue` reprend la dernière session.
- **Mode non interactif** : `-p "tâche"` ou entrée redirigée (`echo "…" | agent`), pour scripts et CI.
- **Interruption** : `Ctrl+C` interrompt la réponse en cours ; au repos, il quitte.
- **Diffs** : les éditions et écritures affichent un aperçu des lignes changées.
- **Garde-fous** : les actions sensibles (`bash`, `write_file`, `edit_file`) demandent confirmation ; tous les accès fichiers sont confinés au répertoire du projet.

## Les 12 outils

| Outil | Rôle | Exécution | Permission par défaut |
|-------|------|-----------|-----------------------|
| `bash` | Exécute une commande shell | client | ask |
| `read_file` | Lit un fichier | client | allow |
| `write_file` | Crée ou écrase un fichier | client | ask |
| `edit_file` | Remplace une portion de texte | client | ask |
| `multi_edit` | Plusieurs remplacements atomiques dans un fichier | client | ask |
| `list_dir` | Liste un répertoire | client | allow |
| `glob` | Recherche de fichiers par motif (`**/*.js`) | client | allow |
| `grep` | Recherche regex dans le contenu (`fichier:ligne:texte`) | client | allow |
| `todo_write` | Gère la liste de tâches | client | allow |
| `task` | Délègue de l'exploration à un sous-agent (lecture seule, parallèle) | client | allow |
| `web_search` | Recherche sur le web | serveur (Anthropic) | allow |
| `web_fetch` | Récupère le contenu d'une URL | serveur (Anthropic) | allow |

Personnalisez les permissions dans `.mini-agent/permissions.json` :

```json
{ "deny": ["bash"], "ask": ["web_fetch"], "allow": ["edit_file"] }
```

## Installation

```bash
cd agent
npm install
```

## Utilisation

```bash
export ANTHROPIC_API_KEY=sk-ant-...
node agent.js
```

Décrivez une tâche à l'invite `›` :

```
› ajoute un endpoint /health qui renvoie 200 OK dans server.js, puis lance les tests
```

L'agent planifie (todos), explore le code, propose ses commandes (que vous approuvez), modifie les fichiers et vérifie son travail.

### Mode non interactif

```bash
node agent.js -p "corrige le lint et commit"      # une seule tâche puis sort
echo "résume le README" | node agent.js           # entrée redirigée
node agent.js --continue -p "continue la tâche"   # reprend la session précédente
```

### Commandes du REPL

| Commande | Effet |
|----------|-------|
| `/help` | Aide |
| `/clear` | Réinitialise la conversation |
| `/compact` | Résume et allège l'historique |
| `/cost` | Usage de tokens + coût estimé |
| `/todos` | Affiche la liste de tâches |
| `/model <id>` | Indique comment changer de modèle |
| `/tools` | Liste les outils |
| `/permissions` | Affiche la permission (allow/ask/deny) de chaque outil |
| `/init` | Demande à l'agent de générer un `CLAUDE.md` |
| `/exit` | Quitte |

### Options

| Variable / drapeau | Effet |
|--------------------|-------|
| `--yes` / `AUTO_APPROVE=1` | Auto-approuve les actions sensibles |
| `--continue` | Reprend la dernière session (`.mini-agent/session.json`) |
| `-p "tâche"` | Mode non interactif (implique l'auto-approbation) |
| `AGENT_MODEL=…` | Modèle (défaut : `claude-opus-4-8`) |
| `AGENT_THINKING=0` | Désactive la pensée adaptative |
| `AGENT_WEB=0` | Désactive les outils web |

## Comment ça marche

Le cœur tient dans `runTurn()` :

1. On ajoute le message de l'utilisateur à l'historique.
2. On appelle `client.messages.stream({ model, tools, system, messages, thinking })` (le prompt système + les outils sont mis en cache).
3. Selon `stop_reason` : `tool_use` → on exécute les outils clients et on renvoie les `tool_result` ; `pause_turn` → on relance (outil serveur en cours) ; sinon → le tour est fini.
4. À chaque étape on cumule l'usage et on sauvegarde la session.

C'est exactement le schéma d'un agent Claude Code : un modèle + des outils + une boucle. Tout le reste (pensée, cache, todos, web, coût, persistance, mode non interactif, garde-fous) est du confort et de la robustesse autour de cette boucle.
