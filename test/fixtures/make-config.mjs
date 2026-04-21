// @ts-check
/**
 * @file Materialise a test-run config from the template + dynamic baseUrl.
 * @module test/fixtures/make-config
 *
 * @description
 * The fixture server binds on an ephemeral port, so the `rootUrl` in a site
 * config can't be a committed constant. This helper reads
 * `test/fixtures/site.json.template` (which carries a `__BASE_URL__`
 * placeholder), substitutes the dynamic base URL, writes the result + a
 * temporary out-dir under `os.tmpdir()`, and hands back the paths plus a
 * cleanup function.
 *
 * Each e2e test gets its own `mkdtempSync` directory so parallel `node --test`
 * runs never collide on `output/reports/*` artefacts.
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

// SECTION: Types

/**
 * @typedef {object} TmpConfigOptions
 * @property {string} baseUrl           Typically the fixture server's baseUrl.
 * @property {string} [templatePath]    Absolute path; defaults to this module's sibling template.
 * @property {Record<string, unknown>} [overrides]  Deep-merged onto the template after substitution.
 */

/**
 * @typedef {object} TmpConfigHandle
 * @property {string} configPath    Absolute path to the materialised site.json.
 * @property {string} outDir        Absolute path to the tmp out-dir (empty, ready).
 * @property {() => Promise<void>} cleanup  Removes the tmp tree. Idempotent.
 */

// SECTION: Helpers

/**
 * Recursively substitute `__BASE_URL__` inside strings within a JSON value.
 *
 * @param {unknown} node
 * @param {string} baseUrl
 * @returns {unknown}
 */
function substitute(node, baseUrl) {
  if (typeof node === 'string') return node.replaceAll('__BASE_URL__', baseUrl);
  if (Array.isArray(node)) return node.map((item) => substitute(item, baseUrl));
  if (node && typeof node === 'object') {
    /** @type {Record<string, unknown>} */
    const out = {};
    for (const [k, v] of Object.entries(node)) out[k] = substitute(v, baseUrl);
    return out;
  }
  return node;
}

/**
 * @param {any} base
 * @param {any} override
 * @returns {any}
 */
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) return override ?? base;
  if (typeof base !== 'object' || typeof override !== 'object' || !base || !override) {
    return override ?? base;
  }
  /** @type {Record<string, any>} */
  const out = { ...base };
  for (const [key, value] of Object.entries(override)) {
    out[key] = key in base ? deepMerge(base[key], value) : value;
  }
  return out;
}

// SECTION: Public API

/**
 * Create a tmp config + out-dir for a single test run.
 *
 * @param {TmpConfigOptions} options
 * @returns {Promise<TmpConfigHandle>}
 */
export async function createTmpConfig(options) {
  const { baseUrl, overrides } = options;
  const thisDir = path.dirname(fileURLToPath(import.meta.url));
  const templatePath = options.templatePath ?? path.join(thisDir, 'site.json.template');
  const raw = await fs.readFile(templatePath, 'utf8');
  const parsed = JSON.parse(raw);
  const substituted = substitute(parsed, baseUrl);
  const final = overrides ? deepMerge(substituted, overrides) : substituted;

  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'wcag-em-e2e-'));
  const configPath = path.join(tmp, 'site.json');
  const outDir = path.join(tmp, 'out');
  await fs.writeFile(configPath, JSON.stringify(final, null, 2));
  await fs.mkdir(outDir, { recursive: true });

  return {
    configPath,
    outDir,
    cleanup: async () => {
      try {
        await fs.rm(tmp, { recursive: true, force: true });
      } catch {
        // ignore — cleanup is best-effort.
      }
    },
  };
}
