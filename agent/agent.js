#!/usr/bin/env node
// mini-code-agent — un assistant de code agentique en ligne de commande,
// propulsé par l'API Claude. Il raisonne, exécute des commandes bash et
// lit/écrit des fichiers dans le répertoire courant, en bouclant jusqu'à
// ce que la tâche soit terminée — comme Claude Code, en miniature.

import Anthropic from "@anthropic-ai/sdk";
import readline from "node:readline";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

// ─── Configuration ──────────────────────────────────────────────────────────

const MODEL = process.env.AGENT_MODEL || "claude-opus-4-8";
const MAX_TOKENS = 16000;
const ROOT = process.cwd();
// AUTO_APPROVE=1 (ou --yes) exécute les actions sensibles sans confirmation.
const AUTO_APPROVE =
  process.env.AUTO_APPROVE === "1" || process.argv.includes("--yes");
// Pensée adaptative activée par défaut (AGENT_THINKING=0 pour la désactiver).
const THINKING = process.env.AGENT_THINKING !== "0";

let client;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(
      "\x1b[31mErreur : la variable d'environnement ANTHROPIC_API_KEY n'est pas définie.\x1b[0m\n" +
        "Exportez votre clé API :  export ANTHROPIC_API_KEY=sk-ant-...",
    );
    process.exit(1);
  }
  return (client ??= new Anthropic());
}

// ─── Sécurité : confiner les chemins au répertoire du projet ────────────────

function resolveInside(p) {
  const abs = path.resolve(ROOT, p);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) {
    throw new Error(
      `Accès refusé : « ${p} » sort du répertoire du projet (${ROOT}).`,
    );
  }
  return abs;
}

// Répertoires ignorés lors des parcours (glob/grep).
const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next"]);

// Parcours récursif des fichiers sous `dir`, en ignorant IGNORE.
function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else if (entry.isFile()) yield abs;
  }
}

// Convertit un motif glob (**, *, ?) en expression régulière.
function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++; // **/ = zéro ou plusieurs dossiers
      } else {
        re += "[^/]*";
      }
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

// ─── Définition des outils ──────────────────────────────────────────────────

const tools = [
  {
    name: "bash",
    description:
      "Exécute une commande shell dans le répertoire du projet et renvoie stdout+stderr. " +
      "À utiliser pour lister des fichiers, lancer des tests, git, build, etc.",
    input_schema: {
      type: "object",
      properties: {
        command: { type: "string", description: "La commande à exécuter." },
      },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Lit et renvoie le contenu texte d'un fichier du projet.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin du fichier à lire." },
      },
      required: ["path"],
    },
  },
  {
    name: "write_file",
    description:
      "Crée un fichier ou écrase son contenu. Crée les dossiers parents si besoin.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin du fichier à écrire." },
        content: { type: "string", description: "Contenu complet du fichier." },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "edit_file",
    description:
      "Remplace une occurrence exacte de old_str par new_str dans un fichier. " +
      "old_str doit apparaître exactement une fois.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin du fichier à modifier." },
        old_str: { type: "string", description: "Texte exact à remplacer." },
        new_str: { type: "string", description: "Texte de remplacement." },
      },
      required: ["path", "old_str", "new_str"],
    },
  },
  {
    name: "list_dir",
    description: "Liste les fichiers et dossiers d'un répertoire du projet.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Répertoire à lister (défaut : .)." },
      },
    },
  },
  {
    name: "glob",
    description:
      "Recherche les fichiers dont le chemin correspond à un motif glob " +
      "(ex. « **/*.js », « src/**/*.ts »). Ignore node_modules, .git, dist, build.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Motif glob (**, *, ? supportés)." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description:
      "Recherche une expression régulière dans le contenu des fichiers et " +
      "renvoie les correspondances au format fichier:ligne:texte.",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Expression régulière à chercher." },
        path: {
          type: "string",
          description: "Sous-répertoire où chercher (défaut : .).",
        },
        glob: {
          type: "string",
          description: "Filtre glob optionnel sur les fichiers (ex. « **/*.js »).",
        },
      },
      required: ["pattern"],
    },
  },
];

// Actions modifiant l'état → confirmation demandée (sauf AUTO_APPROVE).
const SENSITIVE = new Set(["bash", "write_file", "edit_file"]);

// ─── Exécution des outils ───────────────────────────────────────────────────

function runTool(name, input) {
  switch (name) {
    case "bash": {
      try {
        const out = execSync(input.command, {
          cwd: ROOT,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
        return out.trim() || "(aucune sortie)";
      } catch (e) {
        const parts = [];
        if (e.stdout) parts.push(e.stdout.toString());
        if (e.stderr) parts.push(e.stderr.toString());
        parts.push(`(code de sortie : ${e.status ?? "?"})`);
        throw new Error(parts.join("\n").trim());
      }
    }
    case "read_file": {
      const abs = resolveInside(input.path);
      return fs.readFileSync(abs, "utf8");
    }
    case "write_file": {
      const abs = resolveInside(input.path);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, input.content);
      return `Écrit ${Buffer.byteLength(input.content)} octets dans ${input.path}.`;
    }
    case "edit_file": {
      const abs = resolveInside(input.path);
      const orig = fs.readFileSync(abs, "utf8");
      const count = orig.split(input.old_str).length - 1;
      if (count === 0) throw new Error("old_str introuvable dans le fichier.");
      if (count > 1)
        throw new Error(
          `old_str apparaît ${count} fois (doit être unique). Ajoutez du contexte.`,
        );
      fs.writeFileSync(abs, orig.replace(input.old_str, input.new_str));
      return `Modifié ${input.path}.`;
    }
    case "list_dir": {
      const abs = resolveInside(input.path || ".");
      return fs
        .readdirSync(abs, { withFileTypes: true })
        .map((d) => (d.isDirectory() ? d.name + "/" : d.name))
        .join("\n");
    }
    case "glob": {
      const re = globToRegExp(input.pattern);
      const matches = [];
      for (const abs of walk(ROOT)) {
        const rel = path.relative(ROOT, abs);
        if (re.test(rel)) matches.push(rel);
        if (matches.length >= 500) break;
      }
      matches.sort();
      return matches.length
        ? matches.join("\n")
        : "(aucun fichier ne correspond)";
    }
    case "grep": {
      let re;
      try {
        re = new RegExp(input.pattern);
      } catch (e) {
        throw new Error(`Expression régulière invalide : ${e.message}`);
      }
      const globRe = input.glob ? globToRegExp(input.glob) : null;
      const base = resolveInside(input.path || ".");
      const out = [];
      for (const abs of walk(base)) {
        const rel = path.relative(ROOT, abs);
        if (globRe && !globRe.test(rel)) continue;
        let text;
        try {
          text = fs.readFileSync(abs, "utf8");
        } catch {
          continue; // binaire / illisible
        }
        if (text.includes("\u0000")) continue; // saute les fichiers binaires
        const lines = text.split("\n");
        for (let i = 0; i < lines.length; i++) {
          if (re.test(lines[i])) {
            out.push(`${rel}:${i + 1}:${lines[i].trim().slice(0, 200)}`);
            if (out.length >= 200) break;
          }
        }
        if (out.length >= 200) break;
      }
      return out.length ? out.join("\n") : "(aucune correspondance)";
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

// ─── Interface terminal ─────────────────────────────────────────────────────

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  accent: (s) => `\x1b[38;5;209m${s}\x1b[0m`,
};

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((res) => rl.question(q, res));

async function confirm(name, input) {
  if (AUTO_APPROVE || !SENSITIVE.has(name)) return true;
  const preview =
    name === "bash"
      ? input.command
      : input.path + (name === "edit_file" ? " (edit)" : "");
  const a = (await ask(c.yellow(`  ⚠  ${name}: ${preview}  [O/n] `))).trim().toLowerCase();
  return a === "" || a === "o" || a === "y" || a === "oui";
}

const SYSTEM = `Tu es mini-code-agent, un assistant de programmation autonome qui travaille dans le répertoire ${ROOT}.
Tu disposes d'outils pour exécuter des commandes bash et lire/écrire des fichiers. Sers-t'en pour accomplir la tâche de bout en bout : explore le code avant de le modifier, fais des changements ciblés, et vérifie ton travail (tests, lint, build) quand c'est pertinent.
Sois concis. Annonce brièvement ce que tu fais, agis via les outils, puis résume le résultat. Quand tu as assez d'informations pour agir, agis.`;

// ─── Boucle agentique ───────────────────────────────────────────────────────

const messages = [];

async function runTurn(userInput) {
  messages.push({ role: "user", content: userInput });

  while (true) {
    const stream = getClient().messages.stream({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM,
      tools,
      messages,
      ...(THINKING
        ? { thinking: { type: "adaptive", display: "summarized" } }
        : {}),
    });

    let mode = null; // "thinking" | "text"
    stream.on("thinking", (delta) => {
      if (mode !== "thinking") {
        process.stdout.write(c.dim("\n  · réflexion : "));
        mode = "thinking";
      }
      process.stdout.write(c.dim(delta));
    });
    stream.on("text", (delta) => {
      if (mode !== "text") {
        process.stdout.write(mode === "thinking" ? "\n\n" : "");
        mode = "text";
      }
      process.stdout.write(delta);
    });

    const response = await stream.finalMessage();
    if (mode) process.stdout.write("\n");

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") break;

    const toolResults = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;

      const approved = await confirm(block.name, block.input);
      if (!approved) {
        console.log(c.dim("  ↳ refusé par l'utilisateur"));
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "L'utilisateur a refusé l'exécution de cet outil.",
          is_error: true,
        });
        continue;
      }

      console.log(c.dim(`  ↳ ${block.name}(${summarize(block.input)})`));
      try {
        const result = runTool(block.name, block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      } catch (e) {
        console.log(c.red(`    ✗ ${e.message.split("\n")[0]}`));
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: e.message,
          is_error: true,
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}

function summarize(input) {
  if (input.command) return truncate(input.command, 60);
  if (input.path) return input.path;
  return "";
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// ─── REPL ───────────────────────────────────────────────────────────────────

function banner() {
  console.log(
    c.accent(`
  ┌─────────────────────────────────────────────┐
  │  mini-code-agent — assistant de code agentique │
  └─────────────────────────────────────────────┘`),
  );
  console.log(
    c.dim(`  modèle : ${MODEL}   dossier : ${ROOT}`) +
      (AUTO_APPROVE ? c.yellow("   [auto-approve]") : ""),
  );
  console.log(
    c.dim("  Commandes : /help, /clear, /exit — ou décrivez une tâche.\n"),
  );
}

const HELP = `${c.bold("Commandes :")}
  /help    affiche cette aide
  /clear   réinitialise la conversation
  /exit    quitte
Tout autre texte est envoyé à l'agent comme une tâche.

${c.bold("Astuce :")} les commandes bash et les écritures de fichiers demandent
confirmation. Lancez avec --yes (ou AUTO_APPROVE=1) pour tout auto-approuver.`;

async function main() {
  banner();
  while (true) {
    const line = (await ask(c.cyan("› "))).trim();
    if (!line) continue;
    if (line === "/exit" || line === "/quit") break;
    if (line === "/help") {
      console.log(HELP);
      continue;
    }
    if (line === "/clear") {
      messages.length = 0;
      console.log(c.dim("  conversation réinitialisée."));
      continue;
    }
    try {
      await runTurn(line);
    } catch (e) {
      console.error(c.red(`\nErreur : ${e.message}`));
    }
    console.log();
  }
  rl.close();
}

// Ne lance le REPL que si le fichier est exécuté directement (pas à l'import).
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export { runTool, tools, resolveInside };
