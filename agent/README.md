# mini-code-agent

Un assistant de code **agentique** en ligne de commande, propulsé par l'API Claude — le même principe que Claude Code, en version compacte et lisible (~300 lignes, une seule dépendance).

Il ne se contente pas de discuter : il **raisonne, exécute des commandes bash et lit/écrit des fichiers** dans votre projet, en bouclant automatiquement (appel du modèle → exécution d'outils → renvoi des résultats → …) jusqu'à ce que la tâche soit terminée.

## Ce qu'il sait faire

L'agent dispose de 5 outils, que Claude décide d'appeler lui-même :

| Outil | Rôle |
|-------|------|
| `bash` | Exécute une commande shell (lister, tester, git, build…) |
| `read_file` | Lit un fichier |
| `write_file` | Crée ou écrase un fichier |
| `edit_file` | Remplace une portion de texte dans un fichier |
| `list_dir` | Liste un répertoire |

- **Boucle agentique** : le modèle enchaîne les appels d'outils jusqu'à la fin de la tâche (`stop_reason` géré manuellement).
- **Streaming** : les réponses s'affichent au fil de l'eau.
- **Garde-fous** : les actions sensibles (`bash`, `write_file`, `edit_file`) demandent une confirmation, et tous les accès fichiers sont confinés au répertoire du projet (pas de `../../etc/passwd`).

## Installation

```bash
cd agent
npm install
```

## Utilisation

```bash
export ANTHROPIC_API_KEY=sk-ant-...   # votre clé API Claude
node agent.js
```

Puis décrivez une tâche à l'invite `›`, par exemple :

```
› ajoute un endpoint /health qui renvoie 200 OK dans server.js, puis lance les tests
```

L'agent va explorer le code, proposer ses commandes (que vous approuvez), modifier les fichiers et vérifier son travail.

### Commandes du REPL

- `/help` — aide
- `/clear` — réinitialise la conversation
- `/exit` — quitte

### Options

- `--yes` (ou `AUTO_APPROVE=1`) : auto-approuve toutes les actions sensibles (mode non interactif).
- `AGENT_MODEL=claude-opus-4-8` : choisit le modèle (défaut : `claude-opus-4-8`).

## Comment ça marche

Le cœur tient dans `runTurn()` (`agent.js`) :

1. On ajoute le message de l'utilisateur à l'historique.
2. On appelle `client.messages.stream({ model, tools, messages, system })`.
3. Si `stop_reason === "tool_use"`, on exécute chaque outil demandé, on renvoie les résultats dans un message `user` (blocs `tool_result`), et on recommence.
4. Sinon, le tour est terminé.

C'est exactement le schéma d'un agent Claude Code : un modèle + des outils + une boucle. Tout le reste (streaming, confirmations, confinement des chemins) est du confort et de la sécurité autour de cette boucle.
