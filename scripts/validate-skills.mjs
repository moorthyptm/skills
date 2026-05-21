#!/usr/bin/env node
/**
 * Validator for this skills repo, enforcing the Agent Skills specification
 * at https://agentskills.io/specification and surfacing warnings from
 * https://agentskills.io/skill-creation/best-practices.
 *
 * Validates:
 *   .claude-plugin/plugin.json  — JSON syntax, schema, declared paths exist
 *   skills/<cat>/<name>/SKILL.md — frontmatter against full spec
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// --- spec constants --------------------------------------------------------
const KNOWN_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
]);
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NAME_MAX = 64;
const DESC_MAX = 1024;
const COMPAT_MAX = 500;
const BODY_LINE_SOFT_CAP = 500;
const BODY_TOKEN_SOFT_CAP = 5000;

// --- 1. .claude-plugin/plugin.json -----------------------------------------
const pluginPath = join(root, '.claude-plugin/plugin.json');
let plugin = null;
try {
  plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
} catch (e) {
  err(`.claude-plugin/plugin.json: invalid JSON — ${e.message}`);
}

// --- 2. Walk skills/ for every SKILL.md ------------------------------------
function findSkillMd(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = join(dir, e.name);
    if (e.isDirectory()) findSkillMd(full, out);
    else if (e.isFile() && e.name === 'SKILL.md') out.push(full);
  }
  return out;
}

const skillFiles = findSkillMd(join(root, 'skills'));

// --- 3. validate every SKILL.md against the spec ---------------------------
for (const file of skillFiles) {
  const rel = relative(root, file);
  const raw = readFileSync(file, 'utf8');

  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) {
    err(`${rel}: missing YAML frontmatter delimited by '---'`);
    continue;
  }

  let fm;
  try {
    fm = yaml.load(m[1]);
  } catch (e) {
    err(`${rel}: frontmatter is not valid YAML — ${e.message}`);
    continue;
  }
  if (fm === null || typeof fm !== 'object' || Array.isArray(fm)) {
    err(`${rel}: frontmatter must be a YAML mapping`);
    continue;
  }

  const body = m[2] || '';

  // unknown fields
  for (const key of Object.keys(fm)) {
    if (!KNOWN_FIELDS.has(key)) {
      warn(`${rel}: unknown frontmatter field "${key}" (spec defines: ${[...KNOWN_FIELDS].join(', ')})`);
    }
  }

  // -- name (required) --
  if (!('name' in fm)) {
    err(`${rel}: missing required field 'name'`);
  } else if (typeof fm.name !== 'string') {
    err(`${rel}: 'name' must be a string (got ${typeof fm.name})`);
  } else {
    const n = fm.name;
    if (n.length < 1) err(`${rel}: 'name' must be non-empty`);
    else if (n.length > NAME_MAX) err(`${rel}: 'name' exceeds ${NAME_MAX} characters (${n.length})`);
    if (!NAME_RE.test(n)) {
      err(`${rel}: 'name' "${n}" must match [a-z0-9-] with no leading/trailing/consecutive hyphens`);
    }
    const parent = basename(dirname(file));
    if (n !== parent) err(`${rel}: 'name' "${n}" does not match parent directory "${parent}"`);
  }

  // -- description (required) --
  if (!('description' in fm)) {
    err(`${rel}: missing required field 'description'`);
  } else if (typeof fm.description !== 'string') {
    err(`${rel}: 'description' must be a string (got ${typeof fm.description})`);
  } else {
    const d = fm.description.trim();
    if (d.length < 1) err(`${rel}: 'description' must be non-empty`);
    if (fm.description.length > DESC_MAX) {
      err(`${rel}: 'description' exceeds ${DESC_MAX} characters (${fm.description.length})`);
    }
  }

  // -- license (optional) --
  if ('license' in fm && typeof fm.license !== 'string') {
    err(`${rel}: 'license' must be a string`);
  }

  // -- compatibility (optional) --
  if ('compatibility' in fm) {
    if (typeof fm.compatibility !== 'string') {
      err(`${rel}: 'compatibility' must be a string`);
    } else {
      const c = fm.compatibility;
      if (c.length < 1) err(`${rel}: 'compatibility' must be non-empty if provided`);
      if (c.length > COMPAT_MAX) err(`${rel}: 'compatibility' exceeds ${COMPAT_MAX} characters (${c.length})`);
    }
  }

  // -- metadata (optional) — map of string→string --
  if ('metadata' in fm) {
    const md = fm.metadata;
    if (md === null || typeof md !== 'object' || Array.isArray(md)) {
      err(`${rel}: 'metadata' must be a mapping of string keys to string values`);
    } else {
      for (const [k, v] of Object.entries(md)) {
        if (typeof v !== 'string') {
          err(`${rel}: 'metadata.${k}' must be a string (got ${typeof v} — quote numeric values, e.g. version: "1.0")`);
        }
      }
    }
  }

  // -- allowed-tools (optional, experimental) --
  if ('allowed-tools' in fm && typeof fm['allowed-tools'] !== 'string') {
    err(`${rel}: 'allowed-tools' must be a space-separated string`);
  }

  // -- body length (best-practices soft caps) --
  const lines = body.split(/\r?\n/).length;
  const approxTokens = Math.ceil(body.length / 4);
  if (lines > BODY_LINE_SOFT_CAP) {
    warn(`${rel}: body is ${lines} lines (>${BODY_LINE_SOFT_CAP} recommended — split into references/)`);
  }
  if (approxTokens > BODY_TOKEN_SOFT_CAP) {
    warn(`${rel}: body is ~${approxTokens} tokens (>${BODY_TOKEN_SOFT_CAP} recommended — split into references/)`);
  }
  if (body.trim().length === 0) {
    warn(`${rel}: body is empty (skill has frontmatter but no instructions)`);
  }
}

// --- 4. plugin.json schema + declared paths --------------------------------
if (plugin) {
  if (typeof plugin.name !== 'string') err(`plugin.json: missing string field 'name'`);
  if ('skills' in plugin && !Array.isArray(plugin.skills)) {
    err(`plugin.json: 'skills' must be an array`);
  }
  if (Array.isArray(plugin.skills)) {
    for (const p of plugin.skills) {
      if (typeof p !== 'string' || !p.startsWith('./')) {
        err(`plugin.json: skill path "${p}" must be a string starting with "./"`);
        continue;
      }
      const skillMd = resolve(root, p, 'SKILL.md');
      try { statSync(skillMd); }
      catch { err(`plugin.json: declared skill "${p}" has no SKILL.md`); }
    }
    const declared = new Set(plugin.skills.map((p) => resolve(root, p)));
    for (const f of skillFiles) {
      if (!declared.has(dirname(f))) {
        warn(`${relative(root, dirname(f))}: skill exists on disk but is not listed in plugin.json (won't be published)`);
      }
    }
  }
}

// --- output ----------------------------------------------------------------
for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  console.error('Skill validation failed:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
const n = skillFiles.length;
console.log(`✓ skill validation passed (${n} skill${n === 1 ? '' : 's'} found)`);
