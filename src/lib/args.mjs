// @ts-check
/**
 * @file Minimal CLI argument parser — superseded by Commander in Layer 1.
 * @module lib/args
 *
 * @description
 * Legacy arg parser retained through Layer 0 for backward compatibility. The
 * Commander CLI introduced in Layer 1 replaces this module; the file is then
 * deleted (plan: Layer 1 step 11).
 *
 * NOTE: keep behaviour identical to the v0.3 implementation — Layer 0 must not
 * change any user-visible behaviour. Lint/type warnings are acceptable here
 * because the file is slated for removal.
 *
 * @see docs/adr/0003-commander-cli.md (forthcoming)
 */

// SECTION: Public API

/**
 * Parse `--key value` and `--flag` tokens from a process argv-style array.
 *
 * @param {string[]} [argv] - Argument list without the Node binary / script path.
 * @returns {Record<string, string | boolean>} Parsed key/value map; bare flags are `true`.
 */
export function parseArgs(argv = process.argv.slice(2)) {
  /** @type {Record<string, string | boolean>} */
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}
