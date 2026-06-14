// @ts-check
/**
 * @file Browser engine loader — selects the Playwright-API-compatible automation
 * engine (E8).
 * @module lib/browser-engine
 *
 * @description
 * `playwright` is the bundled default. `patchright` is a stealth-patched,
 * API-compatible drop-in (same `chromium.launch` / `connectOverCDP` surface)
 * for sites with aggressive bot detection during AUTHORIZED audits. It is an
 * OPTIONAL dependency, loaded ONLY when `scan.browser.engine === 'patchright'`,
 * with an actionable install hint when it is absent — so a normal install of the
 * toolkit never requires it. The dynamic `import()` mirrors the existing
 * late-binding stage loader in `src/index.mjs`.
 *
 * @see docs/adr/0020-pluggable-browser-transport.md
 */

/**
 * @typedef {object} BrowserEngine
 * @property {any} chromium - A Playwright-compatible `chromium` namespace
 *   exposing at least `launch` and `connectOverCDP`.
 */

/**
 * Load the automation engine for the given name.
 *
 * @param {'playwright' | 'patchright'} [engine] - Engine id (schema-enumerated).
 * @returns {Promise<BrowserEngine>}
 * @throws {Error} When `patchright` is requested but not installed (actionable
 *   install hint), or the name is unknown.
 */
export async function loadBrowserEngine(engine = 'playwright') {
  if (engine === 'patchright') {
    /** @type {any} */
    let mod;
    try {
      // Indirection through a variable specifier so tsc/checkJs does not try to
      // resolve the optional, often-absent 'patchright' module at build time —
      // it is installed on demand by the operator, not a declared dependency.
      const pkg = 'patchright';
      mod = await import(pkg);
    } catch (err) {
      const code = /** @type {any} */ (err)?.code;
      if (code === 'ERR_MODULE_NOT_FOUND' || code === 'MODULE_NOT_FOUND') {
        throw new Error(
          "scan.browser.engine is 'patchright' but the optional 'patchright' package is not " +
            'installed. Install it: npm install patchright && npx patchright install chromium',
        );
      }
      throw err;
    }
    const chromium = mod.chromium ?? mod.default?.chromium;
    if (!chromium) {
      throw new Error("'patchright' loaded but did not expose a `chromium` namespace.");
    }
    return { chromium };
  }

  if (engine !== 'playwright') {
    throw new Error(`Unknown scan.browser.engine: ${String(engine)}`);
  }

  /** @type {any} */
  const playwright = await import('playwright');
  return { chromium: playwright.chromium };
}
