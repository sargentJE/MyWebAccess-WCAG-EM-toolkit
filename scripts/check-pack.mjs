// @ts-check
/**
 * @file Fail when the npm package would ship anything that is not committed at HEAD.
 * @module scripts/check-pack
 *
 * @description
 * `package.json` `files` is an allowlist that overrides `.gitignore`, so a
 * directory entry silently ships whatever local files sit in that directory —
 * for this toolkit, per-engagement client configs that can hold auth secrets
 * (2026-09 review SEC-08). A committed example edited locally (a real client
 * URL pasted in) leaks the same way. This guard closes that class however
 * `files` evolves: it lists what `npm pack` would publish and fails if any
 * packed path is not committed at HEAD, or differs from HEAD.
 *
 * Where it runs:
 * - `prepublishOnly`. npm skips it under `npm publish --ignore-scripts`,
 *   `ignore-scripts=true` in an npmrc, or when publishing a tarball, so it is
 *   ALSO an explicit step of ADR-0015's publish flow.
 * - CI (`npm run check:pack`), after planting untracked canary configs, so a
 *   regression of the `files` allowlist is visible on a clean checkout.
 *
 * NOTE: npm 10 runs the `prepare` lifecycle on `npm pack` even with
 * `--ignore-scripts` (verified on npm 10.9.2), and this package's `prepare` is
 * `husky`, which rewrites `core.hooksPath` in the git config. `HUSKY=0` is
 * husky's documented off-switch, so the dry run is side-effect free.
 *
 * Safe to run by hand:  `npm run check:pack`
 *
 * @see docs/reviews/2026-09-toolkit-gap-review.md (SEC-08, OPS-13)
 * @see docs/adr/0014-packaging-decisions.md
 * @see docs/adr/0015-publish-and-deprecation-policy.md
 */

// SECTION: Imports
import { execFileSync } from 'node:child_process';
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitDiscoveryEnv } from '../src/lib/git-env.mjs';

// SECTION: Pure logic

/**
 * Extract the packed file paths from `npm pack --dry-run --json` stdout.
 * Lifecycle scripts share npm's stdout (husky prints "HUSKY=0 skip install"
 * with no trailing newline), so locate the array of pack results itself.
 *
 * @param {string} stdout
 * @returns {string[]}
 */
export function parsePackOutput(stdout) {
  const start = stdout.search(/\[\s*\{/);
  if (start === -1) {
    throw new Error(`check-pack: npm pack produced no JSON document:\n${stdout}`);
  }
  /** @type {Array<{ files: Array<{ path: string }> }>} */
  const packInfo = JSON.parse(stdout.slice(start));
  return packInfo[0].files.map((f) => f.path);
}

/**
 * Classify packed paths that must not ship: not committed at HEAD, or
 * committed but carrying uncommitted changes. Results are sorted and
 * de-duplicated; separators are normalised so a Windows-built list compares
 * equal.
 *
 * @param {{ packed: string[], committed: string[], modified: string[] }} sets
 * @returns {{ uncommitted: string[], modified: string[] }}
 */
export function findUnshippable({ packed, committed, modified }) {
  const norm = (/** @type {string} */ p) => p.replaceAll('\\', '/');
  const committedSet = new Set(committed.map(norm));
  const modifiedSet = new Set(modified.map(norm));
  const uniquePacked = [...new Set(packed.map(norm))].sort();
  return {
    uncommitted: uniquePacked.filter((p) => !committedSet.has(p)),
    modified: uniquePacked.filter((p) => committedSet.has(p) && modifiedSet.has(p)),
  };
}

// SECTION: Process helpers

/**
 * How to invoke npm: the very npm running this script when available
 * (`npm_execpath`, set by `npm run` and lifecycle scripts), else the `npm`
 * on PATH (`npm.cmd` through a shell on Windows).
 *
 * @returns {{ cmd: string, prefix: string[], shell: boolean }}
 */
function resolveNpm() {
  const execPath = process.env.npm_execpath;
  if (execPath && /\.c?js$/.test(execPath)) {
    return { cmd: process.execPath, prefix: [execPath], shell: false };
  }
  return process.platform === 'win32'
    ? { cmd: 'npm.cmd', prefix: [], shell: true }
    : { cmd: 'npm', prefix: [], shell: false };
}

/**
 * Parse `git status --porcelain -z` output into the paths it reports.
 * Rename and copy entries carry a second (source) path, which is skipped.
 *
 * @param {string} porcelainZ
 * @returns {string[]}
 */
function parsePorcelainZ(porcelainZ) {
  const entries = porcelainZ.split('\0').filter(Boolean);
  /** @type {string[]} */
  const paths = [];
  for (let i = 0; i < entries.length; i += 1) {
    const status = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    if (/[RC]/.test(status)) i += 1;
  }
  return paths;
}

// SECTION: Main

/**
 * @param {string} repoRoot
 * @returns {void}
 */
function main(repoRoot) {
  const npm = resolveNpm();
  const packed = parsePackOutput(
    execFileSync(npm.cmd, [...npm.prefix, 'pack', '--dry-run', '--json', '--ignore-scripts'], {
      cwd: repoRoot,
      encoding: 'utf8',
      env: { ...gitDiscoveryEnv(), HUSKY: '0' },
      shell: npm.shell,
      maxBuffer: 64 * 1024 * 1024,
      // stderr carries npm's lifecycle banners; keep it out of CI logs unless npm fails.
      stdio: ['ignore', 'pipe', 'pipe'],
    }),
  );

  /** @type {{ committed: string[], modified: string[] }} */
  let git;
  try {
    /** @type {import('node:child_process').ExecFileSyncOptionsWithStringEncoding} */
    const opts = {
      cwd: repoRoot,
      encoding: 'utf8',
      env: gitDiscoveryEnv(),
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    };
    git = {
      committed: execFileSync('git', ['ls-tree', '-r', '-z', '--name-only', 'HEAD'], opts)
        .split('\0')
        .filter(Boolean),
      modified: parsePorcelainZ(
        execFileSync(
          'git',
          ['--no-optional-locks', 'status', '--porcelain', '-z', '--untracked-files=no'],
          opts,
        ),
      ),
    };
  } catch {
    // NOTE: without git there is no committed set to compare against, so the
    // guard cannot prove the package is clean. Fail rather than pass blind.
    console.error('check-pack: not a git checkout with a HEAD; cannot verify package contents');
    process.exitCode = 1;
    return;
  }

  const { uncommitted, modified } = findUnshippable({ packed, ...git });
  if (uncommitted.length > 0 || modified.length > 0) {
    const list = (/** @type {string[]} */ ps) => ps.map((p) => `  - ${p}`).join('\n');
    if (uncommitted.length > 0) {
      console.error(`check-pack: packed but not committed at HEAD:\n${list(uncommitted)}`);
    }
    if (modified.length > 0) {
      console.error(`check-pack: packed with uncommitted changes:\n${list(modified)}`);
    }
    console.error('check-pack: publish only from a clean, committed tree.');
    process.exitCode = 1;
    return;
  }
  console.log(`check-pack: ${packed.length} packed files, all committed and unmodified`);
}

// ANCHOR: MainGuard — run only when invoked directly (not when imported by tests).
const thisFile = fileURLToPath(import.meta.url);
if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(thisFile)) {
  main(path.resolve(path.dirname(thisFile), '..'));
}
