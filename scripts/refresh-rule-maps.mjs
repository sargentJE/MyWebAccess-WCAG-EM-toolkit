// @ts-check
/**
 * @file Dev utility that regenerates `src/data/act-rule-map.json`.
 * @module scripts/refresh-rule-maps
 *
 * @description
 * Reads the installed `@axe-core/playwright` package version, fetches the
 * W3C ACT Rules CG implementation report, and rewrites the static
 * `src/data/act-rule-map.json` with a fresh `_meta.generatedAt` + the
 * current axe-core version pin.
 *
 * NOT shipped in `bin/` — developer tooling only. Run manually whenever
 * `package-lock.json`'s `@axe-core/playwright` entry changes.
 *
 * The implementation report is HTML, not JSON, so this script parses the
 * document structure. If the ACT Rules CG changes their page layout, the
 * parser here breaks visibly (a clear error rather than silent drift).
 *
 * @see https://act-rules.github.io/implementation/axe-core/
 * @see src/data/README.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SECTION: Paths
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../..');
const AXE_PKG_PATH = path.join(
  REPO_ROOT,
  'node_modules',
  '@axe-core',
  'playwright',
  'package.json',
);
const MAP_PATH = path.join(REPO_ROOT, 'src', 'data', 'act-rule-map.json');
const REPORT_URL = 'https://act-rules.github.io/implementation/axe-core/';

// SECTION: Public API

/**
 * Regenerate `src/data/act-rule-map.json`.
 *
 * @returns {Promise<void>}
 */
export async function refresh() {
  const axePkg = JSON.parse(await fs.readFile(AXE_PKG_PATH, 'utf8'));
  const axeVersion = axePkg.version;

  process.stdout.write(
    `Regenerating act-rule-map.json against @axe-core/playwright@${axeVersion}\n`,
  );
  process.stdout.write(`Fetching ${REPORT_URL}…\n`);

  const res = await fetch(REPORT_URL);
  if (!res.ok) {
    throw new Error(`ACT implementation report fetch failed: ${res.status} ${res.statusText}`);
  }
  const html = await res.text();

  const parsed = parseImplementationReport(html);
  if (parsed.length === 0) {
    throw new Error(
      'ACT implementation report parser produced zero entries; page layout likely changed. ' +
        'Update this script or seed manually.',
    );
  }

  const byAxeRule = invertToAxeIndex(parsed);
  const map = {
    _meta: {
      generatedAt: new Date().toISOString().slice(0, 10),
      axeCoreVersion: axeVersion,
      source: REPORT_URL,
      coverage: parsed.length < 50 ? 'partial' : 'full',
      ruleCount: parsed.length,
      note:
        `Regenerated from ${REPORT_URL}. Expanding to full coverage is tracked as a Layer 3b ` +
        `follow-up in CHANGELOG.md [Unreleased].`,
    },
    ...byAxeRule,
  };

  await fs.writeFile(MAP_PATH, JSON.stringify(map, null, 2) + '\n', 'utf8');
  process.stdout.write(
    `Wrote ${MAP_PATH} with ${parsed.length} ACT rules and ${Object.keys(byAxeRule).length} axe rules.\n`,
  );
}

// SECTION: Internal helpers

/**
 * @typedef {object} ActEntry
 * @property {string} actId - ACT Rules CG rule identifier (e.g. `"4b1c6c"`).
 * @property {string} title - Human-readable ACT rule title.
 * @property {string[]} axeRules - axe-core rule IDs implementing the ACT rule.
 */

/**
 * Parse the ACT implementation report HTML into `ActEntry[]`. Best-effort
 * heuristic extraction; throws if the page shape is unrecognisable so the
 * caller doesn't silently write an empty map.
 *
 * @param {string} _html - The raw HTML body of the ACT implementation report.
 * @throws {Error} Always — this function is a stub; see module-level comment
 *   for the current manual refresh workflow.
 */
function parseImplementationReport(_html) {
  // STUB: the ACT Rules CG publishes HTML tables that change layout
  // occasionally. A production implementation parses rows via a DOM
  // library (e.g. cheerio or linkedom); that dependency is NOT pulled
  // into this project just for a dev script. The maintainer running this
  // script should either:
  //   1. Install a DOM parser temporarily and implement this function, OR
  //   2. Download the page, convert it via a one-shot tool (pandoc, a
  //      headless browser), and paste the JSON into `src/data/act-rule-map.json`
  //      by hand.
  //
  // The current seed at `src/data/act-rule-map.json` was produced via
  // WebFetch + LLM assistance during Layer 3b R1. Re-running this script
  // today will surface the clear error below.
  throw new Error(
    'ACT implementation report parser is a stub. See scripts/refresh-rule-maps.mjs ' +
      'source comment for refresh workflow options.',
  );
}

/**
 * Invert the `ActEntry[]` (keyed by ACT ID) into the runtime-consumed
 * shape (keyed by axe rule ID).
 *
 * @param {ActEntry[]} entries
 * @returns {Record<string, string[]>}
 */
function invertToAxeIndex(entries) {
  /** @type {Record<string, Set<string>>} */
  const index = {};
  for (const entry of entries) {
    for (const axeRule of entry.axeRules) {
      if (!index[axeRule]) index[axeRule] = new Set();
      index[axeRule].add(entry.actId);
    }
  }
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const axeRule of Object.keys(index).sort()) {
    out[axeRule] = [...index[axeRule]].sort();
  }
  return out;
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  refresh().catch((err) => {
    process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
    process.exitCode = 1;
  });
}
