// @ts-check
/**
 * @file Fallback argument parser for programmatic `loadConfig()` callers.
 * @module lib/args
 *
 * @description
 * This module persists as a fallback argument parser for programmatic
 * `loadConfig()` callers; the Commander CLI in `bin/wcag-em.mjs` is the
 * primary entry point.
 *
 * @see docs/adr/0003-commander-cli.md
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
