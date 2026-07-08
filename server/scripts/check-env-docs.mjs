// ============================================
// Synaptic Room — env documentation check (P0-R-008)
// ============================================
// Fails if a configuration key the server reads (declared in the env SCHEMA or
// referenced via process.env in src/) is NOT documented in .env.example. Keeps
// docs synchronized with the code (verifies P0-AC-008).
//
// Run: node scripts/check-env-docs.mjs   (exit 0 = ok, 1 = undocumented keys)
// ============================================

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = resolve(__dirname, '..');

// Runtime-only keys that are handled outside the schema but are (and must stay)
// documented in .env.example.
const EXTRA_KEYS = ['NEXORA_DEV_INSECURE'];

// Keys that legitimately need no .env.example entry (framework/runtime globals).
const IGNORE_KEYS = new Set(['NODE_ENV']);

function readFile(rel) {
  return readFileSync(join(SERVER_ROOT, rel), 'utf8');
}

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (full.endsWith('.js')) acc.push(full);
  }
  return acc;
}

// 1. Keys declared in the SCHEMA object of config/env.js (regex over source).
const envSource = readFile('src/config/env.js');
const schemaBlock = envSource.slice(envSource.indexOf('const SCHEMA'));
const schemaKeys = [...schemaBlock.matchAll(/^\s{2}([A-Z][A-Z0-9_]+):\s*\{/gm)].map((m) => m[1]);

// 2. Keys accessed via process.env.X across the source tree.
const usedKeys = new Set();
for (const file of walk(join(SERVER_ROOT, 'src'))) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) usedKeys.add(m[1]);
}

// 3. Keys documented in .env.example.
const documented = new Set(
  [...readFile('.env.example').matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1])
);

const required = new Set([...schemaKeys, ...usedKeys, ...EXTRA_KEYS]);
const missing = [...required].filter((k) => !documented.has(k) && !IGNORE_KEYS.has(k));

if (schemaKeys.length === 0) {
  console.error('[env-doc] Could not parse SCHEMA keys from config/env.js — check the regex.');
  process.exit(1);
}

if (missing.length > 0) {
  console.error('[env-doc] Undocumented env keys (add them to server/.env.example):');
  for (const k of missing) console.error(`  • ${k}`);
  process.exit(1);
}

console.log(`[env-doc] OK — ${required.size} config keys are all documented in .env.example.`);
