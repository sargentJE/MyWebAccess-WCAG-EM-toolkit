// @ts-check
/**
 * @file Authenticated-scan context builder.
 * @module lib/auth
 *
 * @description
 * `applyAuth(config)` builds the Playwright `browser.newContext` options
 * needed to restore a user session before scans run. Supports:
 *   - `storageState` (path to JSON file OR inline object — cookies +
 *     localStorage),
 *   - `httpCredentials` ({ username, password } for basic auth),
 *   - `extraHttpHeaders` (custom headers merged into every request).
 *
 * `auth.setupScript` is schema-validated but runtime execution is
 * deferred pending a security review; a one-shot `logger.warn` announces
 * the deferral. Same discipline as `override.actions` in Layer 3a.
 *
 * Synchronous by design — called once per scan run, not per URL, so
 * `fs.statSync` + `spawnSync` are trivially cheap and callers can
 * plain-spread `contextOptions` into `browser.newContext({ viewport,
 * ...contextOptions })` without await ceremony.
 *
 * Defensive: `fs.statSync` wrapped in try/catch (ENOENT / EACCES); the
 * `git check-ignore` probe is skipped cleanly when git is unavailable
 * or the cwd is not a git repo.
 *
 * @see docs/adr/0005-fail-fast-on-config.md
 * @see https://playwright.dev/docs/auth
 */

// SECTION: Imports
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

// SECTION: Public API

/**
 * @typedef {object} ContextOptions
 * @property {string | object} [storageState] - Playwright storageState (path or object).
 * @property {{ username: string, password: string }} [httpCredentials] - HTTP Basic Auth credentials.
 * @property {Record<string, string>} [extraHTTPHeaders] - Note the Playwright-specific casing.
 */

/**
 * @typedef {object} ApplyAuthResult
 * @property {ContextOptions} contextOptions - Spread into `browser.newContext({ ... })`.
 * @property {string[]} warnings - One string per detected concern; caller logs via `logger.warn`.
 */

/**
 * Build the Playwright context options for an authenticated scan.
 *
 * Pure, synchronous, deterministic for a given config + filesystem state.
 *
 * @param {Record<string, any>} config - Full resolved RunContext config.
 * @returns {ApplyAuthResult}
 */
export function applyAuth(config) {
  /** @type {ContextOptions} */
  const contextOptions = {};
  /** @type {string[]} */
  const warnings = [];

  const auth = config?.auth;
  if (!auth || typeof auth !== 'object') {
    return { contextOptions, warnings };
  }

  // ANCHOR: StorageState — path-or-object; defensive fs.statSync.
  if (auth.storageState !== undefined) {
    if (typeof auth.storageState === 'string') {
      const absPath = path.resolve(auth.storageState);
      let stat;
      try {
        stat = fs.statSync(absPath);
      } catch (err) {
        const errno = /** @type {NodeJS.ErrnoException} */ (err).code ?? 'UNKNOWN';
        warnings.push(
          `auth.storageState path unreadable: ${auth.storageState} (${errno}); proceeding without session restore`,
        );
        stat = null;
      }
      if (stat) {
        contextOptions.storageState = absPath;
        // TTL check: if configured and mtime is older, warn (non-fatal).
        if (typeof auth.ttlMinutes === 'number' && auth.ttlMinutes > 0) {
          const ageMinutes = (Date.now() - stat.mtimeMs) / 60000;
          if (ageMinutes > auth.ttlMinutes) {
            warnings.push(
              `auth.storageState at ${auth.storageState} is ${Math.round(ageMinutes)} minutes old; ` +
                `exceeds ttlMinutes=${auth.ttlMinutes}. Session may be stale.`,
            );
          }
        }
        // Safety probe: path inside cwd AND not gitignored → warn.
        const warn = probeStorageStateGitignore(absPath);
        if (warn) warnings.push(warn);
      }
    } else if (typeof auth.storageState === 'object') {
      // Inline storageState object — passed through verbatim.
      contextOptions.storageState = auth.storageState;
    }
  }

  // ANCHOR: HttpCredentials — pass-through.
  if (auth.httpCredentials && typeof auth.httpCredentials === 'object') {
    contextOptions.httpCredentials = {
      username: String(auth.httpCredentials.username ?? ''),
      password: String(auth.httpCredentials.password ?? ''),
    };
  }

  // ANCHOR: ExtraHttpHeaders — Playwright's option is `extraHTTPHeaders` (case-sensitive).
  if (auth.extraHttpHeaders && typeof auth.extraHttpHeaders === 'object') {
    contextOptions.extraHTTPHeaders = { ...auth.extraHttpHeaders };
  }

  // ANCHOR: SetupScriptDeferred — warn-only; runtime execution lands later.
  if (typeof auth.setupScript === 'string' && auth.setupScript.length > 0) {
    warnings.push(buildWarnSchemaAcceptedMessage('auth.setupScript', 'a later layer'));
  }

  return { contextOptions, warnings };
}

/**
 * Uniform warn message for "schema accepts this field but runtime ignores it
 * until layer X". Extracted so all such warnings share one phrasing — used
 * by `applyAuth` for `setupScript` and by `summarize.mjs` for
 * `reporting.reporters` (R8 swaps the inline warn to this helper).
 *
 * @param {import('pino').Logger} logger
 * @param {{ feature: string, deferralLayer: string }} args
 * @returns {void}
 */
export function warnSchemaAcceptedRuntimeIgnored(logger, { feature, deferralLayer }) {
  logger.warn({ feature }, buildWarnSchemaAcceptedMessage(feature, deferralLayer));
}

// SECTION: Internal helpers

/**
 * Build the warn message string (shared between `applyAuth`'s accumulated
 * warnings array and the `warnSchemaAcceptedRuntimeIgnored` helper).
 *
 * @param {string} feature
 * @param {string} deferralLayer
 * @returns {string}
 */
function buildWarnSchemaAcceptedMessage(feature, deferralLayer) {
  return `${feature} is schema-accepted but runtime-ignored until ${deferralLayer}`;
}

/**
 * Run `git check-ignore --quiet` against a path to test whether it would
 * be excluded from git tracking. Returns a warning string iff the path is
 * NOT gitignored and is inside the current working directory — the risky
 * case where a user might accidentally commit their storageState file.
 *
 * Returns `null` when: git not on PATH (ENOENT), non-git cwd (exit 128),
 * path outside cwd, or path IS gitignored (the safe case).
 *
 * @param {string} absPath
 * @returns {string | null}
 */
function probeStorageStateGitignore(absPath) {
  const cwd = process.cwd();
  const rel = path.relative(cwd, absPath);
  // Only probe when the storageState path is inside the working tree.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;

  let result;
  try {
    result = spawnSync('git', ['check-ignore', '--quiet', absPath], { cwd });
  } catch {
    // git not on PATH or other spawn failure — can't determine; skip safely.
    return null;
  }

  // `git check-ignore --quiet` semantics:
  //   exit 0 → path IS gitignored (safe)
  //   exit 1 → path is NOT gitignored (risky in working tree)
  //   exit 128 → not a git repo (can't determine)
  if (result.error) return null;
  if (result.status === 0) return null; // gitignored; safe
  if (result.status === 128) return null; // non-git cwd
  if (result.status === 1) {
    return (
      `auth.storageState at ${absPath} is inside the working tree and NOT gitignored. ` +
      `Risk of committing session data; add the path (or its parent directory) to .gitignore.`
    );
  }
  return null;
}
