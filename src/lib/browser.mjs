// @ts-check
/**
 * @file Pluggable browser transport seam — the single place that decides HOW the
 * scanner obtains a browser and HOW each page-view is scoped and torn down.
 * @module lib/browser
 *
 * @description
 * `scan.mjs` (Stage 3) and `scan-processes.mjs` (Stage 4) both need the same
 * three things: a browser, a fresh page scoped to a viewport, and teardown.
 * They used to DUPLICATE `chromium.launch({ headless: true })` +
 * `browser.newContext({ viewport, ...auth })` + `context.close()` inline. This
 * module centralises that lifecycle so a future transport (e.g. attaching to an
 * already-running external browser over the Chrome DevTools Protocol) becomes a
 * single change behind one API rather than a parallel rewrite of both commands.
 *
 * **This commit (the seam PREP) is behaviour-neutral.** The only transport is
 * `launch`. The seam is an explicit acquire/release pair (`openPageView` returns
 * a `{ page, release }`), NOT a callback, precisely so each command keeps its
 * own failure semantics unchanged: `scan.mjs` acquires OUTSIDE its per-attempt
 * `try` (a context/page allocation failure stays fatal, as before) while
 * `scan-processes.mjs` acquires INSIDE its `try` (an allocation failure becomes
 * an `{ error }` result, as before). Launch acquisition is
 * `newContext({ viewport, ...auth })` + `newPage()`; `release` is
 * `context.close()` — byte-identical to the prior inline code.
 *
 * @see docs/adr/0006-multi-viewport-axe-runs.md
 */

// SECTION: Imports
import { chromium } from 'playwright';

// SECTION: Types

/**
 * @typedef {object} BrowserSession
 * @property {'launch'} transport - The active transport. Only `launch` exists in
 *   the seam PREP; later transports (e.g. `cdp`) widen this union.
 * @property {import('playwright').Browser} browser - The launched browser.
 * @property {string[]} warnings - Transport-selection warnings for the caller to
 *   surface once via `logger.warn` (mirrors how `applyAuth` returns warnings).
 */

/**
 * @typedef {object} PageView
 * @property {import('playwright').Page} page - A page scoped to the requested viewport.
 * @property {() => Promise<void>} release - Tear down exactly this page-view.
 *   Launch transport: closes the context the page lives in. (A later attach
 *   transport will close only the page and leave the shared context + external
 *   browser untouched.)
 */

// SECTION: Public API

/**
 * Start a browser session from config.
 *
 * Seam PREP: always launches a headless Chromium — byte-identical to the prior
 * `const browser = await chromium.launch({ headless: true })` at both call
 * sites. `config` and `logger` are accepted now so the signature is stable when
 * transport selection (and its warnings) land.
 *
 * @param {Record<string, any>} _config - Reserved for transport selection.
 * @param {import('pino').Logger} [_logger]
 * @returns {Promise<BrowserSession>}
 */
export async function acquireBrowserSession(_config, _logger) {
  /** @type {string[]} */
  const warnings = [];
  const browser = await chromium.launch({ headless: true });
  return { transport: 'launch', browser, warnings };
}

/**
 * Open a page-view: a fresh page scoped to `viewport`, plus a `release` that
 * tears exactly that scope down. The CALLER decides where to call `release`
 * (always in a `finally`), which is what lets each command preserve its own
 * failure handling — see the module description.
 *
 * Seam PREP (launch): `newContext({ viewport, ...authContextOptions })` →
 * `newPage()`; `release` is `context.close()`. This reproduces, unchanged, the
 * inline allocation + teardown in both commands. (As in the prior code, if
 * `newPage()` rejects after `newContext()` resolves the context is not closed —
 * the same behaviour both commands had, since `newPage` was outside their
 * teardown too.)
 *
 * @param {BrowserSession} session
 * @param {{ id: string, width: number, height: number }} viewport
 * @param {Record<string, any>} authContextOptions - From `applyAuth()`; spread
 *   into `newContext` (storageState / httpCredentials / extraHTTPHeaders).
 * @returns {Promise<PageView>}
 */
export async function openPageView(session, viewport, authContextOptions) {
  // NOTE: applyAuth's ContextOptions type is intentionally looser than
  // Playwright's BrowserContextOptions (storageState accepts `object` for the
  // inline form). Cast at the spread site, matching the prior inline call sites.
  const context = await session.browser.newContext(
    /** @type {any} */ ({
      viewport: { width: viewport.width, height: viewport.height },
      ...authContextOptions,
    }),
  );
  const page = await context.newPage();
  return {
    page,
    release: async () => {
      await context.close();
    },
  };
}

/**
 * Dispose the session once all page-views are done.
 *
 * Seam PREP (launch): `browser.close()`.
 *
 * @param {BrowserSession} session
 * @param {import('pino').Logger} [_logger]
 * @returns {Promise<void>}
 */
export async function disposeBrowserSession(session, _logger) {
  await session.browser.close();
}
