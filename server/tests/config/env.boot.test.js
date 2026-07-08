// ============================================
// Tests — Environment Boot Posture (integration)
// ============================================
// Boots the real config module in isolated child processes to assert the
// secure-by-default startup contract.
//   - production without secrets  -> process exits non-zero        (P0-AC-001)
//   - production + insecure flag   -> process exits non-zero        (P0-AC-002)
//   - development + insecure flag  -> boots (exit 0)                 (P0-AC-002)
//   - all secrets present          -> boots (exit 0)                 (P0-AC-001)
// ============================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENV_MODULE = resolve(__dirname, '../../src/config/env.js');
const ENV_URL = pathToFileURL(ENV_MODULE).href;

// Run config/env.js in a child with a fully controlled environment and a cwd
// with no .env file, so real root secrets never leak into the assertions.
function bootWith(vars) {
  const cwd = mkdtempSync(resolve(tmpdir(), 'nexora-env-'));
  const child = spawnSync(
    process.execPath,
    [
      '-e',
      `import(${JSON.stringify(ENV_URL)}).then(() => process.exit(0)).catch(() => process.exit(1));`,
    ],
    {
      cwd,
      env: { PATH: process.env.PATH, ...vars },
      encoding: 'utf8',
    }
  );
  return child;
}

const VALID_SECRETS = {
  JOIN_TOKEN_SECRET: 'a'.repeat(32),
  AGENT_API_KEY: 'b'.repeat(32),
  TEACHER_PASSCODE: 'passcode123',
};

test('P0-AC-001: production without secrets refuses to boot', () => {
  const child = bootWith({ NODE_ENV: 'production' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /JOIN_TOKEN_SECRET/);
});

test('P0-AC-002: production + NEXORA_DEV_INSECURE is hard-blocked', () => {
  const child = bootWith({ NODE_ENV: 'production', NEXORA_DEV_INSECURE: 'true' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /NEXORA_DEV_INSECURE cannot be enabled/);
});

test('P0-AC-002: development + NEXORA_DEV_INSECURE boots without secrets', () => {
  const child = bootWith({ NODE_ENV: 'development', NEXORA_DEV_INSECURE: 'true' });
  assert.equal(child.status, 0, child.stderr);
});

test('P0-AC-001: production with all secrets boots', () => {
  const child = bootWith({ NODE_ENV: 'production', ...VALID_SECRETS });
  assert.equal(child.status, 0, child.stderr);
});

test('P0-AC-001/003: a too-short secret refuses to boot without echoing the value', () => {
  const child = bootWith({
    NODE_ENV: 'production',
    ...VALID_SECRETS,
    JOIN_TOKEN_SECRET: 'sekret-value-42', // present but < 16 chars
  });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /JOIN_TOKEN_SECRET must be at least 16/);
  // The offending secret value must never be echoed in the error output.
  assert.ok(!child.stderr.includes('sekret-value-42'), 'secret value leaked into stderr');
});
