// @ts-check
/**
 * @file Environment for git subprocesses that must discover the repository from their cwd.
 * @module lib/git-env
 *
 * @description
 * git exports absolute location variables (`GIT_DIR`, `GIT_INDEX_FILE`,
 * `GIT_WORK_TREE`, ...) to hooks and to `git rebase -x` commands — always in a
 * linked worktree. A child git process that inherits them ignores its `cwd`
 * and operates on THAT repository instead. Verified on git 2.48.1:
 * - a `git init` meant for a temp directory rewrites the inherited repository's
 *   config (`core.bare = true`), breaking its main checkout;
 * - provenance lookup for a package installed under another repository's
 *   `node_modules` reports that repository's HEAD as the package's build.
 *
 * Every toolkit git call that relies on cwd-based discovery passes
 * `gitDiscoveryEnv()` so the inherited location variables never apply.
 *
 * @see docs/reviews/2026-09-toolkit-gap-review.md (TEST-06; E9 pre-push review B1)
 */

// SECTION: Constants

/**
 * Variables that pin git to a specific repository or index, overriding
 * discovery from the working directory.
 */
const GIT_LOCATION_VARS = Object.freeze([
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_INDEX_FILE',
  'GIT_COMMON_DIR',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_PREFIX',
]);

// SECTION: Public API

/**
 * Copy an environment with git's location variables removed, so a child git
 * process discovers the repository from its own working directory.
 *
 * NOTE: keys are deleted, not set to `undefined` — Node's child_process
 * passes `undefined` values through as the literal string "undefined".
 *
 * @param {NodeJS.ProcessEnv} [base] - Environment to copy (default: `process.env`).
 * @returns {NodeJS.ProcessEnv}
 */
export function gitDiscoveryEnv(base = process.env) {
  const env = { ...base };
  for (const key of GIT_LOCATION_VARS) delete env[key];
  return env;
}
