// @ts-check
/**
 * @file Tool-identity provenance.
 * @module lib/version
 *
 * @description
 * Reads this package's `name` + `version` from its own `package.json` and
 * axe-core's `version` from `@axe-core/playwright/package.json`. Consumed
 * by artefact stamping — every emitted JSON/markdown file
 * carries a `tool: { name, version, axeCore }` header so downstream
 * consumers (CI dashboards, compliance audits) can trace provenance.
 *
 * Reading at import time means the `npm version` bump flows
 * through mechanically — no hardcoded constants to update.
 *
 * Build provenance: `version` alone cannot distinguish a tagged release from
 * an untagged checkout with behaviour-changing commits on top (the 2026-09
 * review found main stamping 1.1.0 after 55 such commits, TEST-06). When the
 * package root IS a git checkout, `gitSha` + `dirty` record the exact build;
 * otherwise both are `null`. The shape is the same in every install mode so
 * artefact consumers never see keys appear and disappear.
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
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gitDiscoveryEnv } from './git-env.mjs';

// SECTION: Constants

// Read this package's package.json (own). `new URL('../../package.json', ...)`
// from src/lib/version.mjs resolves to the repo root.
const selfPkgUrl = new URL('../../package.json', import.meta.url);
const selfPkg = JSON.parse(fs.readFileSync(selfPkgUrl, 'utf8'));

// Resolve @axe-core/playwright's entry, then walk up to find its package.json.
const axePkgPath = findAxeCorePackageJson();
const axePkg = JSON.parse(fs.readFileSync(axePkgPath, 'utf8'));

// This package's root directory (where package.json lives).
const PACKAGE_ROOT = fileURLToPath(new URL('../../', import.meta.url));
const provenance = readGitProvenance(PACKAGE_ROOT);

// SECTION: Public API

/**
 * Tool identity stamped on every emitted artefact.
 *
 * Frozen so callers can't mutate the shared reference. Spread into artefact
 * object literals as `{ tool: TOOL_IDENTITY, ...rest }` so the stamp appears
 * as the first property of each JSON file.
 *
 * @type {Readonly<{ name: string, version: string, axeCore: string, gitSha: string | null, dirty: boolean | null }>}
 */
export const TOOL_IDENTITY = Object.freeze({
  name: String(selfPkg.name ?? 'wcag-em-a11y-toolkit'),
  version: String(selfPkg.version ?? '0.0.0'),
  axeCore: String(axePkg.version ?? '0.0.0'),
  gitSha: provenance.gitSha,
  dirty: provenance.dirty,
});

/**
 * Human-facing version label: the package version, plus SemVer build
 * metadata identifying the exact checkout when there is one
 * (`1.2.0+42bb6b9`, `1.2.0+42bb6b9.dirty`). Pure, for tests and reporters.
 *
 * @param {{ version: string, gitSha: string | null, dirty: boolean | null }} identity
 * @returns {string}
 */
export function formatVersionLabel(identity) {
  if (!identity.gitSha) return identity.version;
  return `${identity.version}+${identity.gitSha.slice(0, 7)}${identity.dirty ? '.dirty' : ''}`;
}

/**
 * Compose the markdown-style tool-identity header used at the top of
 * markdown artefacts (`summary.md`, `manual-backlog.md`). Kept separate
 * from TOOL_IDENTITY so the markdown formatting can evolve without
 * affecting JSON consumers.
 *
 * @returns {string} e.g. `**Tool:** wcag-em-a11y-toolkit 1.0.0 (axe-core 4.11.2)\n\n`
 */
export function toolIdentityMarkdownHeader() {
  return `**Tool:** ${TOOL_IDENTITY.name} ${formatVersionLabel(TOOL_IDENTITY)} (axe-core ${TOOL_IDENTITY.axeCore})\n\n`;
}

/**
 * Read the git commit of the package root, only if the package root is
 * itself the top level of a git checkout. A toolkit installed as a
 * dependency inside another repository must NOT stamp that repository's
 * HEAD, so the top-level path is compared with the package root first.
 *
 * Hardening (E9 pre-push review):
 * - every git call runs with `gitDiscoveryEnv()`, so an inherited `GIT_DIR`
 *   (exported by git to hooks and `rebase -x`) cannot redirect discovery to
 *   another repository and defeat the top-level guard;
 * - dirtiness comes from `git --no-optional-locks status`, which never writes
 *   `.git/index` (`git diff` refreshes the index on stat-dirty files and takes
 *   `index.lock`, which a concurrent user git command could then fail on);
 * - an unreadable status yields `dirty: null`, never a guessed `true`.
 *
 * Any failure to resolve the checkout (no git binary, not a repository,
 * unborn HEAD) yields nulls for both fields.
 *
 * @param {string} packageRoot - Absolute path of the directory holding package.json.
 * @returns {{ gitSha: string | null, dirty: boolean | null }}
 */
export function readGitProvenance(packageRoot) {
  const none = { gitSha: null, dirty: null };
  /** @type {import('node:child_process').ExecFileSyncOptionsWithStringEncoding} */
  const opts = {
    cwd: packageRoot,
    encoding: 'utf8',
    env: gitDiscoveryEnv(),
    stdio: ['ignore', 'pipe', 'ignore'],
    timeout: 5000,
  };
  /** @type {string} */
  let head;
  try {
    const [topLevel, sha] = execFileSync('git', ['rev-parse', '--show-toplevel', 'HEAD'], opts)
      .trim()
      .split('\n');
    if (!topLevel || !sha) return none;
    if (fs.realpathSync.native(topLevel) !== fs.realpathSync.native(packageRoot)) return none;
    head = sha;
  } catch {
    return none;
  }
  /** @type {boolean | null} */
  let dirty;
  try {
    // Tracked changes only (staged or unstaged); untracked run output does not count.
    const status = execFileSync(
      'git',
      ['--no-optional-locks', 'status', '--porcelain', '--untracked-files=no'],
      opts,
    );
    dirty = status.trim() !== '';
  } catch {
    dirty = null;
  }
  return { gitSha: head, dirty };
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
