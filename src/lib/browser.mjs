// @ts-check
/**
 * @file Pluggable browser transport seam — the single place that decides HOW the
 * scanner obtains a browser and HOW each page-view is scoped and torn down.
 * @module lib/browser
 *
 * @description
 * `scan.mjs` (Stage 3) and `scan-processes.mjs` (Stage 4) both need the same
 * three things: a browser, a fresh page scoped to a viewport, and teardown.
 * This module centralises that lifecycle so the transport is one decision behind
 * one API rather than duplicated inline in both commands.
 *
 * Two transports (E8):
 *
 *   - **launch** (default; byte-identical to pre-E8): `chromium.launch({ headless })`,
 *     a fresh `newContext({ viewport, ...auth })` per page-view, `context.close()`
 *     on release, `browser.close()` at dispose.
 *   - **cdp** (opt-in via `scan.browser.cdpEndpoint` or the `WCAG_EM_CDP_ENDPOINT`
 *     env var): `chromium.connectOverCDP(endpoint)` attaches to an already-running,
 *     human-cleared browser. Each page-view REUSES the existing default context
 *     (`browser.contexts()[0]`) — a fresh `newContext` would be an isolated
 *     incognito context WITHOUT the cleared session's cookies (e.g. a Cloudflare
 *     `cf_clearance`), defeating the purpose — sets the viewport per-page via
 *     `page.setViewportSize`, and on release closes only the PAGE. At dispose it
 *     DISCONNECTS (never closes the external browser we did not launch).
 *
 * The seam is an explicit acquire/release pair (`openPageView` → `{ page, release }`),
 * not a callback, so each command keeps its own failure semantics: `scan.mjs`
 * acquires OUTSIDE its per-attempt try (allocation failure fatal); `scan-processes.mjs`
 * acquires INSIDE its try (allocation failure → `{ error }` result).
 *
 * For AUTHORIZED audits only — CDP attach rides a session a human established.
 *
 * @see docs/adr/0020-pluggable-browser-transport.md
 * @see docs/adr/0006-multi-viewport-axe-runs.md
 */

// SECTION: Imports
import { loadBrowserEngine } from './browser-engine.mjs';

// SECTION: Types

/**
 * @typedef {object} BrowserSession
 * @property {'launch' | 'cdp'} transport - The active transport.
 * @property {import('playwright').Browser} browser - Launched or connected browser.
 * @property {string[]} warnings - Transport-selection warnings for the caller to
 *   surface once via `logger.warn` (mirrors how `applyAuth` returns warnings).
 */

/**
 * @typedef {object} PageView
 * @property {import('playwright').Page} page - A page scoped to the requested viewport.
 * @property {() => Promise<void>} release - Tear down exactly this page-view.
 *   Launch: closes the page's context. CDP: closes only the page (the shared,
 *   human-cleared context and the external browser are left untouched).
 */

/**
 * @typedef {object} TransportPlan
 * @property {'launch' | 'cdp'} transport - Chosen transport.
 * @property {'playwright' | 'patchright'} engine - Chosen automation engine.
 * @property {string} [cdpEndpoint] - Present when transport is `cdp`.
 * @property {boolean} [headless] - Present when transport is `launch`.
 * @property {string} [channel] - Present (optional) when transport is `launch`.
 * @property {string[]} warnings - Transport-selection warnings to surface.
 */

// SECTION: Transport selection (pure — unit-testable without a browser)

/**
 * Decide the transport, engine and options from config + environment, and
 * collect any warnings. Pure: no I/O, no browser. `WCAG_EM_CDP_ENDPOINT` (env)
 * overrides `scan.browser.cdpEndpoint` (config) — a per-session endpoint that
 * should not have to live in a config file.
 *
 * @param {Record<string, any>} [config]
 * @param {Record<string, string | undefined>} [env]
 * @returns {TransportPlan}
 */
export function resolveTransport(config = {}, env = {}) {
  const browserCfg = config?.scan?.browser ?? {};
  const engine = browserCfg.engine === 'patchright' ? 'patchright' : 'playwright';
  /** @type {string[]} */
  const warnings = [];

  const envRaw = env.WCAG_EM_CDP_ENDPOINT;
  const envEndpoint = typeof envRaw === 'string' && envRaw.trim() ? envRaw.trim() : '';
  const cfgEndpoint =
    typeof browserCfg.cdpEndpoint === 'string' ? browserCfg.cdpEndpoint.trim() : '';
  const cdpEndpoint = envEndpoint || cfgEndpoint;

  if (cdpEndpoint) {
    if (envEndpoint && cfgEndpoint && envEndpoint !== cfgEndpoint) {
      warnings.push('WCAG_EM_CDP_ENDPOINT overrides scan.browser.cdpEndpoint for this run.');
    }
    if (config?.auth) {
      warnings.push(
        'config.auth is ignored under a CDP endpoint — the attached browser owns the session ' +
          '(cookies, storage, credentials). Clear any challenge in that browser before scanning.',
      );
    }
    if (browserCfg.channel) {
      warnings.push('scan.browser.channel is ignored under a CDP endpoint.');
    }
    if (typeof browserCfg.headless === 'boolean') {
      warnings.push(
        'scan.browser.headless is ignored under a CDP endpoint (the attached browser owns its mode).',
      );
    }
    return { transport: 'cdp', engine, cdpEndpoint, warnings };
  }

  return {
    transport: 'launch',
    engine,
    headless: browserCfg.headless !== false,
    channel: typeof browserCfg.channel === 'string' ? browserCfg.channel : undefined,
    warnings,
  };
}

/**
 * Whether this run needs a locally-installed Playwright browser binary — the
 * input to preflight's opt-in Chromium-binary check (`requirePlaywright`).
 * False when attaching over CDP (the browser is external) or using `patchright`
 * (it manages its own browser install), so the ms-playwright cache check is not
 * applied in those cases.
 *
 * @param {Record<string, any>} [config]
 * @param {Record<string, string | undefined>} [env]
 * @returns {boolean}
 */
export function browserNeedsLocalBinary(config = {}, env = {}) {
  const plan = resolveTransport(config, env);
  return plan.transport === 'launch' && plan.engine === 'playwright';
}

// SECTION: Public API

/**
 * Start a browser session from config + environment: pick the transport
 * (`resolveTransport`), load the engine (`loadBrowserEngine`), and either launch
 * a Chromium or connect to an external one over CDP.
 *
 * @param {Record<string, any>} config
 * @param {import('pino').Logger} [_logger]
 * @param {Record<string, string | undefined>} [env]
 * @param {typeof loadBrowserEngine} [loadEngine] - Injectable engine loader
 *   (defaults to `loadBrowserEngine`); overridden in unit tests to assert the
 *   transport dispatch without launching/connecting a real browser.
 * @returns {Promise<BrowserSession>}
 */
export async function acquireBrowserSession(
  config,
  _logger,
  env = process.env,
  loadEngine = loadBrowserEngine,
) {
  const plan = resolveTransport(config, env);
  const { chromium } = await loadEngine(plan.engine);

  if (plan.transport === 'cdp') {
    const browser = await chromium.connectOverCDP(plan.cdpEndpoint);
    if (browser.contexts().length === 0) {
      plan.warnings.push(
        'The attached browser has no existing context; a fresh isolated context will be used, ' +
          'which will NOT inherit any cleared session (e.g. cf_clearance). Open a page in that ' +
          'browser (and clear any challenge) before scanning.',
      );
    }
    return { transport: 'cdp', browser, warnings: plan.warnings };
  }

  /** @type {any} */
  const launchOptions = { headless: plan.headless };
  if (plan.channel) launchOptions.channel = plan.channel;
  const browser = await chromium.launch(launchOptions);
  return { transport: 'launch', browser, warnings: plan.warnings };
}

/**
 * Open a page-view: a fresh page scoped to `viewport`, plus a `release` that
 * tears exactly that scope down. The CALLER decides where to call `release`
 * (always in a `finally`), preserving each command's own failure handling.
 *
 * - **launch**: `newContext({ viewport, ...authContextOptions })` → `newPage()`;
 *   `release` closes the context. Byte-identical to the pre-E8 inline code.
 * - **cdp**: reuse `browser.contexts()[0]` (the human-cleared default context;
 *   fall back to a fresh context only if none exists) → `newPage()` →
 *   `page.setViewportSize(viewport)`; `release` closes ONLY the page. `authContextOptions`
 *   is intentionally NOT applied — the external browser owns the session.
 *
 * @param {BrowserSession} session
 * @param {{ id: string, width: number, height: number }} viewport
 * @param {Record<string, any>} authContextOptions - From `applyAuth()` (launch only).
 * @returns {Promise<PageView>}
 */
export async function openPageView(session, viewport, authContextOptions) {
  if (session.transport === 'cdp') {
    const contexts = session.browser.contexts();
    const context = contexts[0] ?? (await session.browser.newContext());
    const page = await context.newPage();
    // Viewport is per-context for launched contexts but the shared CDP context is
    // reused across page-views, so set it on the page instead.
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    return {
      page,
      release: async () => {
        // Close ONLY the page — never the shared, human-cleared context.
        await page.close();
      },
    };
  }

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
 * - **launch**: `browser.close()` (we launched it; close it).
 * - **cdp**: `browser.close()` on a `connectOverCDP` browser DISCONNECTS the
 *   client and leaves the external browser running — we never launched it, so we
 *   must not terminate it. Guarded so a disconnect hiccup can't mask a scan
 *   result. (The CDP e2e asserts the external browser survives a run.)
 *
 * @param {BrowserSession} session
 * @param {import('pino').Logger} [_logger]
 * @returns {Promise<void>}
 */
export async function disposeBrowserSession(session, _logger) {
  if (session.transport === 'cdp') {
    try {
      await session.browser.close();
    } catch {
      /* best-effort disconnect — must not fail the run */
    }
    return;
  }
  await session.browser.close();
}
