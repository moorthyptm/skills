#!/usr/bin/env node
/**
 * Zero-dependency validator for this skills repo.
 * Checks .claude-plugin/plugin.json and every skills/.../SKILL.md against
 * the rules from https://agentskills.io/specification.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, basename, relative, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

// --- 1. plugin.json ---------------------------------------------------------
const pluginPath = join(root, '.claude-plugin/plugin.json');
let plugin = null;
try {
  plugin = JSON.parse(readFileSync(pluginPath, 'utf8'));
} catch (e) {
  err(`.claude-plugin/plugin.json: invalid JSON — ${e.message}`);
}

// --- 2. walk skills/ for SKILL.md ------------------------------------------
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
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

for (const file of skillFiles) {
  const rel = relative(root, file);
  const content = readFileSync(file, 'utf8');
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) {
    err(`${rel}: missing YAML frontmatter delimited by '---'`);
    continue;
  }

  const fm = {};
  for (const raw of m[1].split(/\r?\n/)) {
    const line = raw.replace(/\s+#.*$/, '');
    const kv = line.match(/^([a-zA-Z][a-zA-Z0-9_-]*):\s*(.*)$/);
    if (kv) fm[kv[1]] = kv[2].trim().replace(/^["']|["']$/g, '');
  }

  if (!fm.name) err(`${rel}: missing required field 'name'`);
  if (!fm.description) err(`${rel}: missing required field 'description'`);

  if (fm.name) {
    if (fm.name.length > 64) err(`${rel}: name "${fm.name}" exceeds 64 characters`);
    if (!NAME_RE.test(fm.name)) {
      err(`${rel}: name "${fm.name}" must match [a-z0-9-] with no leading/trailing/consecutive hyphens`);
    }
    const parent = basename(dirname(file));
    if (fm.name !== parent) {
      err(`${rel}: name "${fm.name}" does not match parent directory "${parent}"`);
    }
  }

  if (fm.description && fm.description.length > 1024) {
    err(`${rel}: description exceeds 1024 characters (${fm.description.length})`);
  }
  if (fm.compatibility && fm.compatibility.length > 500) {
    err(`${rel}: compatibility exceeds 500 characters`);
  }
}

// --- 3. plugin.json declared paths must exist -------------------------------
if (plugin) {
  if (typeof plugin.name !== 'string') err(`plugin.json: missing string field 'name'`);
  if (plugin.skills !== undefined && !Array.isArray(plugin.skills)) {
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
      const d = dirname(f);
      if (!declared.has(d)) {
        warn(`${relative(root, d)}: skill exists on disk but is not listed in plugin.json (won't be published)`);
      }
    }
  }
}

// --- output -----------------------------------------------------------------
for (const w of warnings) console.warn(`⚠  ${w}`);
if (errors.length) {
  console.error('Skill validation failed:');
  for (const e of errors) console.error(`  ✗ ${e}`);
  process.exit(1);
}
const n = skillFiles.length;
console.log(`✓ skill validation passed (${n} skill${n === 1 ? '' : 's'} found)`);
