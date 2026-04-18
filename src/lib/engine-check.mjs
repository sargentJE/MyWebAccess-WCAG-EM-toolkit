// @ts-check
/**
 * @file Node engine version predicate.
 * @module lib/engine-check
 *
 * @description
 * Pure predicate mirroring the inline engine guard at `bin/wcag-em.mjs:22-33`.
 * The bin file keeps its own inline check because the guard must run BEFORE
 * any `import` can trigger an ES2023-requiring module load. This helper
 * exists so the version-boundary logic is unit-testable without spawning a
 * child process with a mocked `process.versions`.
 *
 * @see docs/adr/0001-project-conventions.md for the Node >=22.11.0 pin.
 */

// SECTION: Constants

// ANCHOR: MIN_MAJOR / MIN_MINOR — must match `bin/wcag-em.mjs` inline check
const MIN_MAJOR = 22;
const MIN_MINOR = 11;

// SECTION: Public API

/**
 * Is the given Node version string at or above 22.11.0?
 *
 * Accepts either the raw `process.versions.node` form (e.g. `"22.22.0"`) or
 * a user-pasted string with a leading `v` (e.g. `"v22.11.0"`). Non-numeric
 * major/minor segments return `false`.
 *
 * @param {string} [versionString] - Defaults to `process.versions.node`.
 * @returns {boolean}
 */
export function isNodeVersionSupported(versionString = process.versions.node) {
  const cleaned = versionString.startsWith('v') ? versionString.slice(1) : versionString;
  const [majorStr, minorStr] = cleaned.split('.');
  const major = Number(majorStr);
  const minor = Number(minorStr);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return false;
  if (major > MIN_MAJOR) return true;
  if (major === MIN_MAJOR && minor >= MIN_MINOR) return true;
  return false;
}
