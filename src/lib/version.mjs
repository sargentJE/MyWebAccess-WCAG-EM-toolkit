// @ts-check
/**
 * @file Tool-identity provenance.
 * @module lib/version
 *
 * @description
 * Reads this package's `name` + `version` from its own `package.json` and
 * axe-core's `version` from `@axe-core/playwright/package.json`. Consumed
 * by Layer 3b R13's artefact stamping — every emitted JSON/markdown file
 * carries a `tool: { name, version, axeCore }` header so downstream
 * consumers (CI dashboards, compliance audits) can trace provenance.
 *
 * Reading at import time means Layer 5's `npm version 1.0.0` bump flows
 * through mechanically — no hardcoded constants to update.
 *
 * The `@axe-core/playwright` package's `exports` map does NOT publish
 * `./package.json` as a subpath, so
 * `import pkg from '@axe-core/playwright/package.json'` is blocked on
 * Node 22. Instead, `import.meta.resolve` locates the module entry,
 * `path.dirname` walks up to the package root. Defensive fallback via
 * `fs.existsSync` handles pnpm / yarn berry layouts.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md (tool-identity in every artefact)
 */

// SECTION: Imports
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// SECTION: Constants

// Read this package's package.json (own). `new URL('../../package.json', ...)`
// from src/lib/version.mjs resolves to the repo root.
const selfPkgUrl = new URL('../../package.json', import.meta.url);
const selfPkg = JSON.parse(fs.readFileSync(selfPkgUrl, 'utf8'));

// Resolve @axe-core/playwright's entry, then walk up to find its package.json.
const axePkgPath = findAxeCorePackageJson();
const axePkg = JSON.parse(fs.readFileSync(axePkgPath, 'utf8'));

// SECTION: Public API

/**
 * Tool identity stamped on every emitted artefact.
 *
 * Frozen so callers can't mutate the shared reference. Spread into artefact
 * object literals as `{ tool: TOOL_IDENTITY, ...rest }` so the stamp appears
 * as the first property of each JSON file.
 *
 * @type {Readonly<{ name: string, version: string, axeCore: string }>}
 */
export const TOOL_IDENTITY = Object.freeze({
  name: String(selfPkg.name ?? 'wcag-em-a11y-toolkit'),
  version: String(selfPkg.version ?? '0.0.0'),
  axeCore: String(axePkg.version ?? '0.0.0'),
});

/**
 * Compose the markdown-style tool-identity header used at the top of
 * markdown artefacts (`summary.md`, `manual-backlog.md`). Kept separate
 * from TOOL_IDENTITY so the markdown formatting can evolve without
 * affecting JSON consumers.
 *
 * @returns {string} e.g. `**Tool:** wcag-em-a11y-toolkit 0.3.0 (axe-core 4.11.2)\n\n`
 */
export function toolIdentityMarkdownHeader() {
  return `**Tool:** ${TOOL_IDENTITY.name} ${TOOL_IDENTITY.version} (axe-core ${TOOL_IDENTITY.axeCore})\n\n`;
}

// SECTION: Internal helpers

/**
 * Locate `@axe-core/playwright/package.json` by resolving the module entry
 * and walking up the directory tree. Handles flat + pnpm-hoisted +
 * yarn-berry-virtual layouts. Throws with a clear error if unfound.
 *
 * @returns {string} Absolute path to the package.json.
 */
function findAxeCorePackageJson() {
  // import.meta.resolve is stable on Node 22.
  // @axe-core/playwright's exports map only publishes "." → ./dist/index.mjs
  // so this resolves to something like /node_modules/@axe-core/playwright/dist/index.mjs
  // (or similar under pnpm's virtual store).
  const entryUrl = import.meta.resolve('@axe-core/playwright');
  let dir = path.dirname(fileURLToPath(entryUrl));

  // Walk up looking for a package.json. Stop at filesystem root.
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'package.json');
    if (fs.existsSync(candidate)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(candidate, 'utf8'));
        if (pkg.name === '@axe-core/playwright') return candidate;
      } catch {
        // Not JSON or not the package we expect; keep walking.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break; // hit filesystem root
    dir = parent;
  }

  throw new Error(
    "Could not locate @axe-core/playwright's package.json. " +
      'Expected to find it by walking up from the resolved module entry. ' +
      'Report this as an issue — unusual node_modules layout detected.',
  );
}
