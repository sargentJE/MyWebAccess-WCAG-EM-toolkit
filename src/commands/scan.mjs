// @ts-check
/**
 * @file `scan` command — runs axe-core over every page in the sample.
 * @module commands/scan
 *
 * @description
 * Stage 3 of the pipeline. Reads `sample.json`, launches Chromium via Playwright,
 * and scans each URL with the AxeBuilder chain configured in `config.scan.axe`.
 * Supports retries (default 1) and per-page full-page screenshots.
 *
 * Adds multi-viewport support (`config.scan.viewports`) and per-URL
 * axe overrides (`config.scan.axe.overrides[]`). Integrates
 * `applyAuth()` for storageState + httpCredentials.
 *
 * @see docs/adr/0006-multi-viewport-axe-runs.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
// NOTE: TypeScript's checkJs with NodeNext module resolution doesn't always pick
// up the .d.mts default-export shape; cast via any to match the runtime
// behaviour documented in @axe-core/playwright's README.
import AxeBuilderImport from '@axe-core/playwright';
const AxeBuilder = /** @type {any} */ (AxeBuilderImport);
import { writeJson } from '../lib/fs-utils.mjs';
import { fileSafeFromUrl } from '../lib/urls.mjs';
import { isValidRunOnly, findMatchingOverride, applyAxeOverride } from '../lib/axe-utils.mjs';
import { liftRuleSummaries, liftIncompleteSummaries } from '../lib/axe-artifact.mjs';
import { resolveViewports } from '../lib/viewports.mjs';
import { applyAuth } from '../lib/auth.mjs';
import { runProcessSteps } from '../lib/process-runner.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';

// SECTION: Pure helpers (exported for testability)

/**
 * Build the screenshot filename for a URL × viewport combination.
 *
 * The `__${vp.id}` suffix separates scans of the same URL at different
 * viewports. ADR-0006 documents the low-likelihood collision risk when a
 * URL path itself contains the substring `__<vp.id>`.
 *
 * The optional `format` parameter allows the file extension to
 * match `config.reporting.screenshotFormat`. Default `'png'` preserves
 * call-site compatibility for callers that don't care about format.
 *
 * @param {string} screenshotsDir
 * @param {string} url
 * @param {{ id: string }} viewport
 * @param {'png' | 'jpeg'} [format]
 * @returns {string}
 */
export function buildScreenshotPath(screenshotsDir, url, viewport, format = 'png') {
  const ext = format === 'jpeg' ? 'jpg' : 'png';
  return path.join(screenshotsDir, `${fileSafeFromUrl(url)}__${viewport.id}.${ext}`);
}

/**
 * `liftRuleSummaries` and `liftIncompleteSummaries` now live in
 * `lib/axe-artifact.mjs` (shared with `process-runner.mjs` so both scan paths
 * emit one artefact contract). Re-exported here for the widening tests that
 * import `liftRuleSummaries` from this module.
 */
export { liftRuleSummaries };

/**
 * Filter action objects by their compiled `regex` against a URL. Actions
 * with no `regex` attached (i.e. no `urlPattern` in schema) run
 * unconditionally; actions with `regex` only run when the URL matches.
 *
 * Pure; exported for testability.
 *
 * @param {string} url
 * @param {any[]} actions - Each entry is an action object from the schema-validated config.
 * @returns {any[]}
 */
export function filterActionsForUrl(url, actions) {
  if (!Array.isArray(actions)) return [];
  return actions.filter((action) => {
    if (!action || typeof action !== 'object') return false;
    // Non-enumerable `regex` attached by R7's compileActionUrlPatterns.
    if (action.regex instanceof RegExp) return action.regex.test(url);
    return true;
  });
}

/**
 * Run the global + per-URL pre-scan actions for a single (URL × viewport)
 * pair. Filters actions by compiled URL pattern, synthesizes a processDef
 * (`{ name: 'before-scan' }`), and delegates to `runProcessSteps`'s existing
 * per-step timeout + error-capture infrastructure. No new dispatcher.
 *
 * Pre-scan step errors do NOT abort the scan — they surface as
 * `state: 'error'` / `state: 'step-timeout'` entries in the returned array,
 * which is then stored as `_preScanStates` on the scan result (debug-only,
 * underscore-prefix signals not part of stable artefact contract).
 *
 * @param {object} args
 * @param {import('playwright').Page} args.page
 * @param {string} args.url
 * @param {{ id: string, width: number, height: number }} args.viewport
 * @param {Record<string, any>} args.config
 * @param {import('pino').Logger} args.logger
 * @param {import('../lib/context.mjs').RunContextPaths} args.paths
 * @param {Array<{ regex?: RegExp, action: string }>} args.globalActions
 * @param {Array<{ regex?: RegExp, action: string }>} args.overrideActions
 * @returns {Promise<import('../lib/process-runner.mjs').StepResult[]>}
 */
async function runPreScanActions({
  page,
  url,
  viewport,
  config,
  logger,
  paths,
  globalActions,
  overrideActions,
}) {
  const filtered = [
    ...filterActionsForUrl(url, globalActions),
    ...filterActionsForUrl(url, overrideActions),
  ];
  if (filtered.length === 0) return [];

  const synthProcessDef = { name: 'before-scan', startUrl: url };
  return runProcessSteps(synthProcessDef, filtered, {
    page,
    config,
    logger,
    paths,
    processDef: synthProcessDef,
    viewport,
  });
}

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ pagesScanned: number, pagesFailed: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;
  const sampleUrls = JSON.parse(await fs.readFile(paths.sampleJsonPath, 'utf8'));

  // ANCHOR: PreScanActionsReady — beforeScan.actions[] and override.actions[]
  // are executed per-URL (URL-matching via compiled action.regex).
  // The companion `reporting.reporters` warn in summarize.mjs was retired
  // when the reporter pipeline shipped; only `auth.setupScript`
  // still uses warnSchemaAcceptedRuntimeIgnored today.

  const viewports = resolveViewports(config, logger);
  logger.info({ viewports: viewports.map((vp) => vp.id) }, 'scan viewports');

  // ANCHOR: AuthContextOptions — Playwright newContext options derived from
  // config.auth (storageState, httpCredentials, extraHTTPHeaders). Synchronous
  // one-shot call at run-entry; warnings emitted immediately, not per URL.
  const { contextOptions: authContextOptions, warnings: authWarnings } = applyAuth(config);
  for (const w of authWarnings) logger.warn(w);

  const browser = await chromium.launch({ headless: true });
  /** @type {any[]} */
  const allResults = [];
  let pagesFailed = 0;
  // One-shot warn flag — fires the first time a (png + quality)
  // mismatch is observed, then stays quiet for the rest of the scan.
  let pngQualityWarnFired = false;

  /**
   * @param {import('playwright').Page} page
   * @param {string} url
   * @param {{ id: string, width: number, height: number }} viewport
   * @returns {Promise<any>}
   */
  async function runForPage(page, url, viewport) {
    await page.goto(url, {
      waitUntil: config.scan.waitUntil,
      timeout: config.scan.timeoutMs,
    });

    // Honour reporting.screenshotFormat + screenshotQuality.
    // Playwright's page.screenshot rejects `quality` when type is png, so
    // we conditionally include it. The schema permits both fields
    // independently, so we also warn (once per process) when a user sets
    // quality with png — that combination has no effect.
    const screenshotFormat = config.reporting?.screenshotFormat === 'jpeg' ? 'jpeg' : 'png';
    const rawQuality = config.reporting?.screenshotQuality;
    const screenshotQuality =
      typeof rawQuality === 'number' && rawQuality >= 1 && rawQuality <= 100 ? rawQuality : 80;
    if (screenshotFormat === 'png' && typeof rawQuality === 'number' && !pngQualityWarnFired) {
      logger.warn(
        { screenshotFormat, screenshotQuality: rawQuality },
        'reporting.screenshotQuality has no effect when screenshotFormat is png; ignoring',
      );
      pngQualityWarnFired = true;
    }
    const screenshotPath = buildScreenshotPath(
      paths.screenshotsDir,
      url,
      viewport,
      screenshotFormat,
    );
    if (config.scan.fullPageScreenshots !== false) {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: screenshotFormat,
        ...(screenshotFormat === 'jpeg' ? { quality: screenshotQuality } : {}),
      });
    }

    // ANCHOR: AxeBuilderChain — apply config.scan.axe settings.
    // Per-URL overrides land here: find the first matching override by
    // compiled regex (first-match-wins per Pa11y precedent), then merge
    // with replace-if-defined semantics (hasOwnProperty predicate, so
    // `runOnly: null` clears rather than inheriting).
    // NOTE: Overrides affect AxeBuilder chain construction only — viewport
    // concurrency is orthogonal (ADR-0006 keeps the two concerns separate).
    const baseAxeConfig = config.scan.axe ?? {};
    const matchedOverride = findMatchingOverride(url, baseAxeConfig.overridesCompiled ?? []);
    const axeConfig = applyAxeOverride(baseAxeConfig, matchedOverride);

    // ANCHOR: PreScanActions — run beforeScan.actions[] + matched override's
    // actions[] before axe analyzes the page. Actions are filtered by their
    // compiled `regex` (from R7): if `action.regex` is present AND does not
    // match the URL, skip. If `action.regex` is absent, run unconditionally.
    // Errors during pre-scan steps are absorbed by `runProcessSteps`'s
    // per-step try/catch (state: 'error' / 'step-timeout') — they do NOT
    // abort the scan.
    const preScanStates = await runPreScanActions({
      page,
      url,
      viewport,
      config,
      logger,
      paths,
      globalActions: config.scan?.beforeScan?.actions ?? [],
      overrideActions: Array.isArray(matchedOverride?.actions) ? matchedOverride.actions : [],
    });

    let builder = new AxeBuilder({ page });

    for (const selector of axeConfig.exclude || []) builder = builder.exclude(selector);
    for (const selector of axeConfig.include || []) builder = builder.include(selector);
    if (Array.isArray(axeConfig.withRules) && axeConfig.withRules.length > 0)
      builder = builder.withRules(axeConfig.withRules);
    if (Array.isArray(axeConfig.withTags) && axeConfig.withTags.length > 0)
      builder = builder.withTags(axeConfig.withTags);
    if (isValidRunOnly(axeConfig.runOnly)) {
      // NOTE: schema enforces the { type, values } shape; this runtime guard
      // protects against stale configs produced before the CLI migration AND against
      // an override whose runOnly is malformed.
      // LINK: src/lib/axe-utils.mjs → isValidRunOnly
      builder = builder.options({ runOnly: axeConfig.runOnly });
    }

    const axeResults = await builder.analyze();
    return {
      title: await page.title().catch(() => ''),
      screenshot: config.scan.fullPageScreenshots !== false ? screenshotPath : null,
      violations: axeResults.violations,
      // Count keys preserved for backward compatibility with v0.3 consumers.
      passes: axeResults.passes.length,
      incomplete: axeResults.incomplete.length,
      inapplicable: axeResults.inapplicable.length,
      // Detail arrays: light shape for the per-SC WCAG-EM
      // inversion. Omits `nodes` bulk to keep artefact size bounded —
      // nodesCount retains the reviewable-vs-infra-failure signal.
      passesDetail: liftRuleSummaries(axeResults.passes),
      incompleteDetail: liftIncompleteSummaries(
        axeResults.incomplete,
        config.reporting?.maxIncompleteExamplesPerRule,
      ),
      inapplicableDetail: liftRuleSummaries(axeResults.inapplicable),
      // _preScanStates: underscore-prefix signals debug-only;
      // not part of the stable artefact contract. Empty array when no pre-scan
      // actions are configured (or when none match the URL).
      _preScanStates: preScanStates,
    };
  }

  // ANCHOR: ScanLoop — outer viewport × inner URL. Sequential viewports per
  // ADR-0006. Each URL is scanned N times (N = viewport count); findings
  // are tagged with `viewport: vp.id` and screenshots use a `__${vp.id}`
  // filename suffix so desktop/reflow artefacts do not collide. Per-URL
  // try/catch is preserved so one bad page can't kill the scan for
  // subsequent URLs or subsequent viewports.
  for (const vp of viewports) {
    logger.info({ viewport: vp.id }, 'viewport start');
    for (const url of sampleUrls) {
      let attempt = 0;
      let success = false;
      /** @type {Error | null} */
      let lastError = null;

      while (attempt <= config.scan.retries && !success) {
        // NOTE: applyAuth's ContextOptions type is intentionally looser than
        // Playwright's BrowserContextOptions (storageState accepts `object`
        // for the inline form). Cast to any at the spread site so checkJs
        // accepts the union without narrowing every field.
        const context = await browser.newContext(
          /** @type {any} */ ({
            viewport: { width: vp.width, height: vp.height },
            ...authContextOptions,
          }),
        );
        const page = await context.newPage();
        try {
          attempt += 1;
          logger.info({ url, viewport: vp.id, attempt }, 'scanning');
          const result = await runForPage(page, url, vp);
          allResults.push({ url, viewport: vp.id, attempts: attempt, ...result });
          logger.info({ url, viewport: vp.id, violations: result.violations.length }, 'scanned');
          success = true;
        } catch (error) {
          lastError = /** @type {Error} */ (error);
          logger.warn(
            { url, viewport: vp.id, attempt, err: lastError.message },
            'scan attempt failed',
          );
        } finally {
          await context.close();
        }
      }

      if (!success) {
        pagesFailed += 1;
        allResults.push({
          url,
          viewport: vp.id,
          attempts: attempt,
          error: lastError?.message ?? 'Unknown error',
          violations: [],
        });
        logger.error({ url, viewport: vp.id, attempts: attempt }, 'scan failed after retries');
      }
    }
    logger.info({ viewport: vp.id }, 'viewport done');
  }

  await browser.close();
  await writeJson(path.join(paths.resultsDir, 'axe-results.json'), allResults);
  logger.info(
    {
      pagesScanned: allResults.length,
      pagesFailed,
      out: path.join(paths.resultsDir, 'axe-results.json'),
    },
    'scan done',
  );
  return { pagesScanned: allResults.length, pagesFailed };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: true });
  await run(ctx);
}
