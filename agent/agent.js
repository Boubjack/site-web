#!/usr/bin/env node
// mini-code-agent — un assistant de code agentique en ligne de commande,
// propulsé par l'API Claude. Conçu pour ressembler à Claude Code : boucle
// modèle → outils → résultats, pensée adaptative, contexte projet (CLAUDE.md),
// cache de prompt, suivi du coût, todos, recherche web, persistance de session,
// mode non interactif et interruption par Ctrl+C.

import Anthropic from "@anthropic-ai/sdk";
import readline from "node:readline";
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ─── Configuration ──────────────────────────────────────────────────────────

const MODEL = process.env.AGENT_MODEL || "claude-opus-4-8";
const MAX_TOKENS = 16000;
const ROOT = process.cwd();
const THINKING = process.env.AGENT_THINKING !== "0"; // pensée adaptative (défaut ON)
const WEB = process.env.AGENT_WEB !== "0"; // outils web (défaut ON)
const CONTINUE = process.argv.includes("--continue"); // reprend la dernière session
// AUTO_APPROVE=1, --yes, ou le mode non interactif exécutent sans confirmation.
let autoApprove =
  process.env.AUTO_APPROVE === "1" || process.argv.includes("--yes");

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

// ─── Couleurs terminal ──────────────────────────────────────────────────────

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  accent: (s) => `\x1b[38;5;209m${s}\x1b[0m`,
};
const truncate = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

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

const IGNORE = new Set(["node_modules", ".git", "dist", "build", ".next", ".mini-agent"]);

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(entry.name)) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(abs);
    else if (entry.isFile()) yield abs;
  }
}

function globToRegExp(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        re += ".*";
        i++;
        if (glob[i + 1] === "/") i++;
      } else re += "[^/]*";
    } else if (ch === "?") re += "[^/]";
    else re += ch.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}

// ─── Todos (comme l'outil TodoWrite de Claude Code) ─────────────────────────

let todos = [];
function renderTodos() {
  if (!todos.length) return "(liste de tâches vide)";
  const mark = { pending: "○", in_progress: "◐", completed: "●" };
  return todos.map((t) => `${mark[t.status] || "○"} ${t.content}`).join("\n");
}

// ─── Définition des outils ──────────────────────────────────────────────────

const clientTools = [
  {
    name: "bash",
    description:
      "Exécute une commande shell dans le répertoire du projet et renvoie " +
      "stdout+stderr. À utiliser pour lister, tester, git, build, etc.",
    input_schema: {
      type: "object",
      properties: { command: { type: "string", description: "La commande." } },
      required: ["command"],
    },
  },
  {
    name: "read_file",
    description: "Lit et renvoie le contenu texte d'un fichier du projet.",
    input_schema: {
      type: "object",
      properties: { path: { type: "string", description: "Chemin du fichier." } },
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
        path: { type: "string", description: "Chemin du fichier." },
        content: { type: "string", description: "Contenu complet." },
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
        path: { type: "string", description: "Chemin du fichier." },
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
      properties: { path: { type: "string", description: "Répertoire (défaut : .)." } },
    },
  },
  {
    name: "glob",
    description:
      "Recherche les fichiers dont le chemin correspond à un motif glob " +
      "(ex. « **/*.js »). Ignore node_modules, .git, dist, build.",
    input_schema: {
      type: "object",
      properties: { pattern: { type: "string", description: "Motif glob." } },
      required: ["pattern"],
    },
  },
  {
    name: "grep",
    description:
      "Recherche une expression régulière dans le contenu des fichiers " +
      "(format fichier:ligne:texte).",
    input_schema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Expression régulière." },
        path: { type: "string", description: "Sous-répertoire (défaut : .)." },
        glob: { type: "string", description: "Filtre glob optionnel." },
      },
      required: ["pattern"],
    },
  },
  {
    name: "todo_write",
    description:
      "Gère la liste de tâches. Remplace la liste entière. À utiliser pour " +
      "planifier et suivre les étapes des tâches complexes (multi-étapes).",
    input_schema: {
      type: "object",
      properties: {
        todos: {
          type: "array",
          items: {
            type: "object",
            properties: {
              content: { type: "string" },
              status: { type: "string", enum: ["pending", "in_progress", "completed"] },
            },
            required: ["content", "status"],
          },
        },
      },
      required: ["todos"],
    },
  },
  {
    name: "multi_edit",
    description:
      "Applique plusieurs remplacements exacts (old_str→new_str) dans un même " +
      "fichier, de façon atomique et séquentielle. Chaque old_str doit être unique " +
      "au moment où il est appliqué.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Chemin du fichier." },
        edits: {
          type: "array",
          items: {
            type: "object",
            properties: {
              old_str: { type: "string" },
              new_str: { type: "string" },
            },
            required: ["old_str", "new_str"],
          },
        },
      },
      required: ["path", "edits"],
    },
  },
  {
    name: "task",
    description:
      "Délègue une sous-tâche de recherche/exploration à un sous-agent autonome " +
      "(outils en lecture seule : read_file, list_dir, glob, grep) et renvoie son " +
      "rapport. Utile pour explorer le code en parallèle sans encombrer le contexte " +
      "principal. Donne des instructions complètes et autonomes.",
    input_schema: {
      type: "object",
      properties: {
        description: { type: "string", description: "Résumé court de la sous-tâche." },
        prompt: {
          type: "string",
          description: "Instructions détaillées et autonomes pour le sous-agent.",
        },
      },
      required: ["prompt"],
    },
  },
];

// Outils du sous-agent : lecture seule uniquement (pas de bash, écriture, ni task).
const SUBAGENT_TOOLS = ["read_file", "list_dir", "glob", "grep"];

// Outils serveur (exécutés côté Anthropic, aucune implémentation locale).
const serverTools = [
  { type: "web_search_20260209", name: "web_search", max_uses: 5 },
  { type: "web_fetch_20260209", name: "web_fetch", max_uses: 5 },
];

const tools = [...clientTools, ...(WEB ? serverTools : [])];

// Actions modifiant l'état → confirmation demandée (sauf auto-approve).
const SENSITIVE = new Set(["bash", "write_file", "edit_file", "multi_edit"]);
// En mode plan, ces outils sont refusés (l'agent explore mais ne modifie rien).
const PLAN_BLOCKED = new Set(["bash", "write_file", "edit_file", "multi_edit"]);
let planMode = process.argv.includes("--plan");
function setPlanMode(v) {
  planMode = v;
}

// ─── Permissions par outil (allow / ask / deny) ─────────────────────────────
// Configurables via .mini-agent/permissions.json : { allow:[], ask:[], deny:[] }
let PERM = { allow: [], ask: [], deny: [] };
function loadPermissions() {
  try {
    const p = JSON.parse(
      fs.readFileSync(path.join(ROOT, ".mini-agent", "permissions.json"), "utf8"),
    );
    PERM = { allow: p.allow || [], ask: p.ask || [], deny: p.deny || [] };
  } catch {
    /* défauts */
  }
}
function permissionFor(name) {
  if (planMode && PLAN_BLOCKED.has(name)) return "deny";
  if (PERM.deny.includes(name)) return "deny";
  if (PERM.allow.includes(name)) return "allow";
  if (PERM.ask.includes(name)) return "ask";
  return SENSITIVE.has(name) ? "ask" : "allow";
}
loadPermissions();

// ─── Configuration avancée : commandes, hooks, MCP, mentions @fichier ───────

const CONF_DIR = path.join(ROOT, ".mini-agent");

// Commandes personnalisées : .mini-agent/commands/<nom>.md ($ARGUMENTS remplacé).
function loadCommands(dir = path.join(CONF_DIR, "commands")) {
  const map = {};
  try {
    for (const f of fs.readdirSync(dir))
      if (f.endsWith(".md"))
        map[f.slice(0, -3)] = fs.readFileSync(path.join(dir, f), "utf8");
  } catch {
    /* aucun */
  }
  return map;
}
let COMMANDS = loadCommands();

// Hooks : .mini-agent/hooks.json { PreToolUse:[{matcher,command}], PostToolUse, Stop }
function loadHooks() {
  try {
    return JSON.parse(fs.readFileSync(path.join(CONF_DIR, "hooks.json"), "utf8"));
  } catch {
    return {};
  }
}
let HOOKS = loadHooks();
function matchHook(matcher, name) {
  if (!matcher || matcher === "*") return true;
  try {
    return new RegExp("^" + matcher + "$").test(name);
  } catch {
    return matcher === name;
  }
}
// Exécute les hooks d'un évènement. Sur PreToolUse, un hook en échec bloque l'outil.
function runHooks(event, name, input) {
  for (const h of HOOKS[event] || []) {
    if (!matchHook(h.matcher, name)) continue;
    try {
      const out = execSync(h.command, {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 30000,
        env: { ...process.env, TOOL_NAME: name || "", TOOL_INPUT: JSON.stringify(input || {}) },
      });
      if (out.trim()) console.log(c.dim("  ⓗ " + out.trim().split("\n")[0]));
    } catch (e) {
      const msg = (e.stdout?.toString() || "") + (e.stderr?.toString() || "");
      if (event === "PreToolUse")
        return { blocked: true, message: msg.trim() || "hook a bloqué l'outil" };
      console.log(c.dim(`  ⓗ hook ${event} en échec`));
    }
  }
  return { blocked: false };
}

// MCP : .mini-agent/mcp.json { servers:[{name,url,authorization_token?}] }
function loadMcp() {
  try {
    const j = JSON.parse(fs.readFileSync(path.join(CONF_DIR, "mcp.json"), "utf8"));
    return Array.isArray(j.servers) ? j.servers : [];
  } catch {
    return [];
  }
}
let MCP_SERVERS = loadMcp();

// Mentions @fichier : injecte le contenu (ou l'image) des fichiers cités.
const IMG_EXT = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};
function expandMentions(input) {
  const mentions = [...input.matchAll(/@([^\s]+)/g)].map((m) => m[1]);
  if (!mentions.length) return input;
  const blocks = [{ type: "text", text: input }];
  for (const rel of mentions) {
    let abs;
    try {
      abs = resolveInside(rel);
    } catch {
      continue;
    }
    if (!fs.existsSync(abs) || !fs.statSync(abs).isFile()) continue;
    const ext = path.extname(rel).toLowerCase();
    if (IMG_EXT[ext]) {
      blocks.push({
        type: "image",
        source: { type: "base64", media_type: IMG_EXT[ext], data: fs.readFileSync(abs).toString("base64") },
      });
    } else {
      const txt = fs.readFileSync(abs, "utf8").slice(0, 20000);
      blocks.push({ type: "text", text: `\n\nContenu de ${rel} :\n\`\`\`\n${txt}\n\`\`\`` });
    }
  }
  return blocks.length > 1 ? blocks : input;
}

// ─── Exécution des outils clients ───────────────────────────────────────────

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
    case "read_file":
      return fs.readFileSync(resolveInside(input.path), "utf8");
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
        throw new Error(`old_str apparaît ${count} fois (doit être unique).`);
      fs.writeFileSync(abs, orig.replace(input.old_str, input.new_str));
      return `Modifié ${input.path}.`;
    }
    case "multi_edit": {
      const abs = resolveInside(input.path);
      let text = fs.readFileSync(abs, "utf8");
      const edits = Array.isArray(input.edits) ? input.edits : [];
      if (!edits.length) throw new Error("Aucune édition fournie.");
      edits.forEach((e, i) => {
        const count = text.split(e.old_str).length - 1;
        if (count === 0)
          throw new Error(`Édition ${i + 1} : old_str introuvable.`);
        if (count > 1)
          throw new Error(`Édition ${i + 1} : old_str apparaît ${count} fois.`);
        text = text.replace(e.old_str, e.new_str);
      });
      fs.writeFileSync(abs, text);
      return `Appliqué ${edits.length} édition(s) à ${input.path}.`;
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
      return matches.length ? matches.join("\n") : "(aucun fichier ne correspond)";
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
          continue;
        }
        if (text.includes("\u0000")) continue; // saute les binaires
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
    case "todo_write": {
      todos = Array.isArray(input.todos) ? input.todos : [];
      return "Liste de tâches mise à jour :\n" + renderTodos();
    }
    default:
      throw new Error(`Outil inconnu : ${name}`);
  }
}

// ─── Suivi de l'usage et du coût ────────────────────────────────────────────

const PRICES = {
  "claude-opus-4-8": [5, 25],
  "claude-opus-4-7": [5, 25],
  "claude-opus-4-6": [5, 25],
  "claude-sonnet-5": [3, 15],
  "claude-sonnet-4-6": [3, 15],
  "claude-haiku-4-5": [1, 5],
  "claude-fable-5": [10, 50],
};
let usage = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
function addUsage(u) {
  if (!u) return;
  usage.input += u.input_tokens || 0;
  usage.output += u.output_tokens || 0;
  usage.cacheRead += u.cache_read_input_tokens || 0;
  usage.cacheWrite += u.cache_creation_input_tokens || 0;
}
function estimateCost() {
  const [pin, pout] = PRICES[MODEL] || [5, 25];
  return (
    (usage.input * pin +
      usage.cacheRead * pin * 0.1 +
      usage.cacheWrite * pin * 1.25 +
      usage.output * pout) /
    1e6
  );
}
function costLine() {
  return c.dim(
    `  tokens — entrée ${usage.input} · sortie ${usage.output} · ` +
      `cache(lu ${usage.cacheRead}/écrit ${usage.cacheWrite}) · ` +
      `≈ $${estimateCost().toFixed(4)}`,
  );
}

// ─── Contexte projet (CLAUDE.md) ────────────────────────────────────────────

function loadProjectContext() {
  for (const name of ["CLAUDE.md", "AGENTS.md"]) {
    const p = path.join(ROOT, name);
    if (fs.existsSync(p)) {
      try {
        return `\n\n# Contexte du projet (${name})\n${fs.readFileSync(p, "utf8").slice(0, 8000)}`;
      } catch {
        /* ignore */
      }
    }
  }
  return "";
}
const PROJECT_CONTEXT = loadProjectContext();

const SYSTEM = [
  {
    type: "text",
    text:
      `Tu es mini-code-agent, un assistant de programmation autonome qui travaille dans ${ROOT}.\n` +
      `Tu disposes d'outils pour exécuter des commandes bash, lire/écrire/éditer des fichiers ` +
      `(write_file, edit_file, multi_edit), chercher (glob, grep)` +
      `${WEB ? ", chercher sur le web (web_search, web_fetch)" : ""}, déléguer de l'exploration ` +
      `à un sous-agent (task), et suivre des tâches (todo_write).\n` +
      `Accomplis la tâche de bout en bout : explore avant de modifier, fais des changements ciblés, ` +
      `et vérifie ton travail (tests, lint, build) quand c'est pertinent. Pour toute tâche à ` +
      `plusieurs étapes, planifie-la avec todo_write et tiens la liste à jour.\n` +
      `Sois concis : annonce brièvement ce que tu fais, agis via les outils, puis résume. ` +
      `Quand tu as assez d'informations pour agir, agis.` +
      PROJECT_CONTEXT,
    cache_control: { type: "ephemeral" }, // cache le prompt système + les outils
  },
];

// ─── Persistance de session ─────────────────────────────────────────────────

const SESSION_DIR = path.join(ROOT, ".mini-agent");
const SESSION_FILE = path.join(SESSION_DIR, "session.json");
function saveSession() {
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(
      SESSION_FILE,
      JSON.stringify({ model: MODEL, messages, usage, todos }),
    );
  } catch {
    /* ignore */
  }
}
function loadSession() {
  try {
    const s = JSON.parse(fs.readFileSync(SESSION_FILE, "utf8"));
    if (Array.isArray(s.messages)) messages.push(...s.messages);
    if (s.usage) usage = s.usage;
    if (Array.isArray(s.todos)) todos = s.todos;
    return messages.length;
  } catch {
    return 0;
  }
}

// ─── Interface terminal ─────────────────────────────────────────────────────

let rl = null;
const ask = (q) =>
  new Promise((res) => (rl ? rl.question(q, res) : res("")));

async function confirm(name, input) {
  const perm = permissionFor(name);
  if (perm === "deny") {
    console.log(c.red(`  ⛔ ${name} refusé par la politique de permissions`));
    return false;
  }
  if (perm === "allow" || autoApprove) return true;
  const preview =
    name === "bash"
      ? input.command
      : (input.path || "") + (name === "edit_file" || name === "multi_edit" ? " (edit)" : "");
  const a = (await ask(c.yellow(`  ⚠  ${name}: ${truncate(preview, 70)}  [O/n] `)))
    .trim()
    .toLowerCase();
  return a === "" || a === "o" || a === "y" || a === "oui";
}

function printDiff(name, input) {
  if (name === "edit_file") {
    const del = String(input.old_str).split("\n").slice(0, 6);
    const add = String(input.new_str).split("\n").slice(0, 6);
    for (const l of del) console.log(c.red("    - " + truncate(l, 80)));
    for (const l of add) console.log(c.green("    + " + truncate(l, 80)));
  } else if (name === "multi_edit") {
    const n = Array.isArray(input.edits) ? input.edits.length : 0;
    console.log(c.green(`    ~ ${n} édition(s) → ${input.path}`));
  } else if (name === "write_file") {
    const lines = String(input.content).split("\n").length;
    console.log(c.green(`    + ${lines} ligne(s) → ${input.path}`));
  }
}

// ─── Sous-agent (délégation autonome, lecture seule) ────────────────────────

async function runTask(input) {
  const subTools = clientTools.filter((t) => SUBAGENT_TOOLS.includes(t.name));
  const subMessages = [{ role: "user", content: input.prompt }];
  const subSystem =
    "Tu es un sous-agent de recherche autonome. Tu explores le code en lecture " +
    "seule (read_file, list_dir, glob, grep) et tu renvoies un rapport clair et " +
    "concis répondant précisément à la demande. Tu ne peux rien modifier.";
  for (let i = 0; i < 12; i++) {
    const r = await getClient().messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: subSystem,
      tools: subTools,
      messages: subMessages,
    });
    addUsage(r.usage);
    subMessages.push({ role: "assistant", content: r.content });
    if (r.stop_reason !== "tool_use") {
      return (
        r.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n") || "(le sous-agent n'a rien renvoyé)"
      );
    }
    const results = [];
    for (const b of r.content) {
      if (b.type !== "tool_use") continue;
      try {
        results.push({ type: "tool_result", tool_use_id: b.id, content: runTool(b.name, b.input) });
      } catch (e) {
        results.push({ type: "tool_result", tool_use_id: b.id, content: e.message, is_error: true });
      }
    }
    subMessages.push({ role: "user", content: results });
  }
  return "(sous-agent : limite d'itérations atteinte)";
}

// ─── Boucle agentique ───────────────────────────────────────────────────────

const messages = [];
let currentAbort = null;

async function runTurn(userInput) {
  messages.push({ role: "user", content: expandMentions(userInput) });

  while (true) {
    const ac = new AbortController();
    currentAbort = ac;
    let response;
    try {
      const useBeta = MCP_SERVERS.length > 0;
      const reqTools = [
        ...tools,
        ...MCP_SERVERS.map((s) => ({ type: "mcp_toolset", mcp_server_name: s.name })),
      ];
      const api = useBeta ? getClient().beta.messages : getClient().messages;
      const stream = api.stream(
        {
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM,
          tools: reqTools,
          messages,
          ...(THINKING ? { thinking: { type: "adaptive", display: "summarized" } } : {}),
          ...(useBeta
            ? {
                mcp_servers: MCP_SERVERS.map(({ name, url, authorization_token }) => ({
                  type: "url",
                  name,
                  url,
                  ...(authorization_token ? { authorization_token } : {}),
                })),
                betas: ["mcp-client-2025-11-20"],
              }
            : {}),
        },
        { signal: ac.signal },
      );

      let mode = null;
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

      response = await stream.finalMessage();
      if (mode) process.stdout.write("\n");
    } catch (e) {
      if (ac.signal.aborted) {
        console.log(c.dim("\n  ⏹ interrompu."));
        return;
      }
      throw e;
    } finally {
      currentAbort = null;
    }

    addUsage(response.usage);
    messages.push({ role: "assistant", content: response.content });
    saveSession();

    // pause_turn : un outil serveur a atteint sa limite d'itérations → on relance.
    if (response.stop_reason === "pause_turn") continue;
    if (response.stop_reason !== "tool_use") {
      runHooks("Stop");
      break;
    }

    const blocks = response.content.filter((b) => b.type === "tool_use");

    // Passe 1 — confirmations (séquentielles, car interactives).
    const decisions = [];
    for (const block of blocks) {
      decisions.push({ block, approved: await confirm(block.name, block.input) });
    }

    // Passe 2 — exécution (en parallèle : les sous-agents et outils s'exécutent
    // concurremment, l'ordre des résultats est préservé).
    const toolResults = await Promise.all(
      decisions.map(async ({ block, approved }) => {
        if (!approved) {
          console.log(c.dim(`  ↳ ${block.name} refusé`));
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: "Refusé (utilisateur ou politique de permissions).",
            is_error: true,
          };
        }
        // Hook PreToolUse : un hook en échec bloque l'outil.
        const pre = runHooks("PreToolUse", block.name, block.input);
        if (pre.blocked) {
          console.log(c.dim(`  ↳ ${block.name} bloqué par un hook`));
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: "Bloqué par un hook PreToolUse : " + pre.message,
            is_error: true,
          };
        }
        console.log(c.dim(`  ↳ ${block.name}(${summarize(block.input)})`));
        try {
          const result =
            block.name === "task"
              ? await runTask(block.input)
              : runTool(block.name, block.input);
          printDiff(block.name, block.input);
          if (block.name === "todo_write") console.log(c.dim(indent(renderTodos())));
          runHooks("PostToolUse", block.name, block.input);
          return { type: "tool_result", tool_use_id: block.id, content: result };
        } catch (e) {
          console.log(c.red(`    ✗ ${e.message.split("\n")[0]}`));
          return {
            type: "tool_result",
            tool_use_id: block.id,
            content: e.message,
            is_error: true,
          };
        }
      }),
    );

    messages.push({ role: "user", content: toolResults });
    saveSession();
  }
}

function summarize(input) {
  if (input.command) return truncate(input.command, 60);
  if (input.edits) return `${input.path} (${input.edits.length} édits)`;
  if (input.path) return input.path;
  if (input.pattern) return truncate(input.pattern, 40);
  if (input.todos) return `${input.todos.length} tâche(s)`;
  if (input.prompt) return truncate(input.description || input.prompt, 50);
  return "";
}
const indent = (s) => s.split("\n").map((l) => "    " + l).join("\n");

// ─── Compaction de l'historique ─────────────────────────────────────────────

async function compact() {
  if (!messages.length) return console.log(c.dim("  rien à compacter."));
  const r = await getClient().messages.create({
    model: MODEL,
    max_tokens: 2048,
    system:
      "Résume la conversation en conservant les décisions prises, les fichiers " +
      "modifiés et l'état actuel de la tâche, pour reprendre le travail.",
    messages: [
      ...messages,
      { role: "user", content: "Résume tout ce qui précède en un mémo concis." },
    ],
  });
  addUsage(r.usage);
  const summary = r.content.find((b) => b.type === "text")?.text || "";
  messages.length = 0;
  messages.push({ role: "user", content: `Résumé de la session précédente :\n${summary}` });
  saveSession();
  console.log(c.dim("  historique compacté."));
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
    c.dim(`  modèle : ${MODEL}   dossier : ${ROOT}   outils : ${tools.length}`) +
      (autoApprove ? c.yellow("   [auto-approve]") : "") +
      (planMode ? c.yellow("   [plan]") : "") +
      (PROJECT_CONTEXT ? c.dim("   [CLAUDE.md]") : "") +
      (MCP_SERVERS.length ? c.dim(`   [MCP:${MCP_SERVERS.length}]`) : "") +
      (Object.keys(COMMANDS).length ? c.dim(`   [cmds:${Object.keys(COMMANDS).length}]`) : ""),
  );
  console.log(c.dim("  /help pour les commandes — ou décrivez une tâche.\n"));
}

const HELP = `${c.bold("Commandes :")}
  /help          affiche cette aide
  /clear         réinitialise la conversation
  /compact       résume et allège l'historique
  /cost          affiche l'usage de tokens et le coût estimé
  /todos         affiche la liste de tâches
  /model <id>    change de modèle (relance requise pour l'effet complet)
  /tools         liste les outils disponibles
  /permissions   affiche la permission (allow/ask/deny) de chaque outil
  /plan          bascule le mode plan (lecture seule : aucune modification)
  /commands      liste les commandes personnalisées (.mini-agent/commands/*.md)
  /init          demande à l'agent de générer un CLAUDE.md
  /exit          quitte
Tout autre texte est envoyé à l'agent comme une tâche.
Astuce : citez un fichier avec @chemin (ex. @src/app.js, @capture.png) pour
l'injecter dans le message.

${c.bold("Options CLI :")} --yes (auto-approuve), --continue (reprend la session),
  --plan (démarre en lecture seule), -p "tâche" (mode non interactif).
  Env : AGENT_MODEL, AGENT_THINKING=0, AGENT_WEB=0, AUTO_APPROVE=1.

${c.bold("Astuce :")} Ctrl+C interrompt la réponse en cours ; au repos, il quitte.`;

async function handleCommand(line) {
  if (line === "/exit" || line === "/quit") return "exit";
  if (line === "/help") return void console.log(HELP);
  if (line === "/clear") {
    messages.length = 0;
    todos = [];
    try {
      fs.rmSync(SESSION_FILE, { force: true });
    } catch {}
    return void console.log(c.dim("  conversation réinitialisée."));
  }
  if (line === "/compact") return void (await compact());
  if (line === "/cost") return void console.log(costLine());
  if (line === "/todos") return void console.log(c.dim(indent(renderTodos())));
  if (line === "/tools")
    return void console.log(c.dim("  " + tools.map((t) => t.name).join(", ")));
  if (line === "/permissions") {
    return void console.log(
      c.dim(
        "  " +
          tools
            .map((t) => `${t.name}:${permissionFor(t.name)}`)
            .join("  "),
      ),
    );
  }
  if (line.startsWith("/model ")) {
    console.log(c.dim("  Relancez avec AGENT_MODEL=" + line.slice(7).trim()));
    return;
  }
  if (line === "/plan") {
    planMode = !planMode;
    return void console.log(
      c.dim("  mode plan " + (planMode ? "activé (lecture seule)" : "désactivé")),
    );
  }
  if (line === "/commands")
    return void console.log(
      c.dim("  " + (Object.keys(COMMANDS).join(", ") || "(aucune commande personnalisée)")),
    );
  if (line === "/init")
    return "Analyse ce dépôt (structure, langages, commandes de build/test/lint, " +
      "conventions) et écris un fichier CLAUDE.md concis pour de futurs agents.";
  // Commande personnalisée : .mini-agent/commands/<nom>.md ($ARGUMENTS remplacé).
  const cmdName = line.slice(1).split(/\s+/)[0];
  if (COMMANDS[cmdName]) {
    const args = line.slice(1 + cmdName.length).trim();
    return COMMANDS[cmdName].replace(/\$ARGUMENTS/g, args);
  }
  return null; // pas une commande
}

async function main() {
  // Mode non interactif : -p "tâche" ou entrée redirigée (pipe).
  let oneShot = null;
  const pi = process.argv.indexOf("-p");
  if (pi !== -1) oneShot = process.argv[pi + 1] ?? "";
  else if (!process.stdin.isTTY) oneShot = (await readAllStdin()).trim();

  if (CONTINUE) {
    const n = loadSession();
    if (n) console.log(c.dim(`  session reprise (${n} messages).`));
  }

  if (oneShot != null && oneShot !== "") {
    autoApprove = true; // non interactif → pas de confirmation possible
    await safeTurn(oneShot);
    return;
  }

  banner();
  rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on("SIGINT", () => {
    if (currentAbort) currentAbort.abort();
    else {
      console.log();
      rl.close();
      process.exit(0);
    }
  });

  while (true) {
    const line = (await ask(c.cyan("› "))).trim();
    if (!line) continue;
    if (line.startsWith("/")) {
      const r = await handleCommand(line);
      if (r === "exit") break;
      if (typeof r === "string") {
        await safeTurn(r);
        console.log(costLine());
      }
      console.log();
      continue;
    }
    await safeTurn(line);
    console.log(costLine() + "\n");
  }
  rl.close();
}

async function safeTurn(line) {
  try {
    await runTurn(line);
  } catch (e) {
    console.error(c.red(`\nErreur : ${e.message}`));
  }
}

function readAllStdin() {
  return new Promise((res) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (d) => (data += d));
    process.stdin.on("end", () => res(data));
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

export {
  runTool,
  tools,
  resolveInside,
  globToRegExp,
  renderTodos,
  estimateCost,
  loadProjectContext,
  permissionFor,
  SUBAGENT_TOOLS,
  expandMentions,
  loadCommands,
  matchHook,
  runHooks,
  setPlanMode,
};
