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
 * Layer 3a adds multi-viewport support (`config.scan.viewports`) and per-URL
 * axe overrides (`config.scan.axe.overrides[]`). Layer 3b integrates
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
import { resolveViewports } from '../lib/viewports.mjs';
import { applyAuth } from '../lib/auth.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';

// SECTION: Pure helpers (exported for testability)

/**
 * Build the screenshot filename for a URL × viewport combination.
 *
 * The `__${vp.id}` suffix separates scans of the same URL at different
 * viewports. ADR-0006 documents the low-likelihood collision risk when a
 * URL path itself contains the substring `__<vp.id>`.
 *
 * @param {string} screenshotsDir
 * @param {string} url
 * @param {{ id: string }} viewport
 * @returns {string}
 */
export function buildScreenshotPath(screenshotsDir, url, viewport) {
  return path.join(screenshotsDir, `${fileSafeFromUrl(url)}__${viewport.id}.png`);
}

/**
 * Project an axe rule result array into a light summary shape for the
 * widened artefact contract introduced in Layer 3b R6. Keeps only the
 * fields `toWcagEmSummary` (R10) needs — id, tags, impact, nodesCount —
 * and drops the `nodes` bulk that would blow up `axe-results.json` on
 * large sites. Pure function.
 *
 * @param {Array<{ id?: string, tags?: string[], impact?: string|null, nodes?: any[] }>} rules
 * @returns {Array<{ id: string, tags: string[], impact: string|null, nodesCount: number }>}
 */
export function liftRuleSummaries(rules) {
  if (!Array.isArray(rules)) return [];
  return rules.map((r) => ({
    id: String(r.id ?? ''),
    tags: Array.isArray(r.tags) ? [...r.tags] : [],
    impact: typeof r.impact === 'string' ? r.impact : null,
    nodesCount: Array.isArray(r.nodes) ? r.nodes.length : 0,
  }));
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

  // ANCHOR: OverrideActionsWarn — per-pattern once; Layer 3b will wire actions.
  // Consistency precedent for the `reporters` warn emitted by summarize.mjs.
  for (const override of config.scan?.axe?.overridesCompiled ?? []) {
    if (Array.isArray(override.actions) && override.actions.length > 0) {
      logger.warn(
        { urlPattern: override.urlPattern },
        'override.actions is schema-accepted but runtime-ignored in Layer 3a; wires in Layer 3b',
      );
    }
  }

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

  /**
   * @param {import('playwright').Page} page
   * @param {string} url
   * @param {{ id: string, width: number, height: number }} viewport
   */
  async function runForPage(page, url, viewport) {
    await page.goto(url, {
      waitUntil: config.scan.waitUntil,
      timeout: config.scan.timeoutMs,
    });

    const screenshotPath = buildScreenshotPath(paths.screenshotsDir, url, viewport);
    if (config.scan.fullPageScreenshots !== false) {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    // ANCHOR: AxeBuilderChain — apply config.scan.axe settings.
    // Per-URL overrides land here: find the first matching override by
    // compiled regex (first-match-wins per Pa11y precedent), then merge
    // with replace-if-defined semantics (hasOwnProperty predicate, so
    // `runOnly: null` clears rather than inheriting).
    // NOTE: Overrides affect AxeBuilder chain construction only — viewport
    // concurrency is orthogonal (ADR-0006 keeps the two concerns separate).
    const baseAxeConfig = config.scan.axe ?? {};
    const matchedOverride = findMatchingOverride(
      url,
      baseAxeConfig.overridesCompiled ?? [],
    );
    const axeConfig = applyAxeOverride(baseAxeConfig, matchedOverride);

    let builder = new AxeBuilder({ page });

    for (const selector of axeConfig.exclude || []) builder = builder.exclude(selector);
    for (const selector of axeConfig.include || []) builder = builder.include(selector);
    if (Array.isArray(axeConfig.withRules) && axeConfig.withRules.length > 0)
      builder = builder.withRules(axeConfig.withRules);
    if (Array.isArray(axeConfig.withTags) && axeConfig.withTags.length > 0)
      builder = builder.withTags(axeConfig.withTags);
    if (isValidRunOnly(axeConfig.runOnly)) {
      // NOTE: schema enforces the { type, values } shape; this runtime guard
      // protects against stale configs produced before Layer 1 AND against
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
      // Detail arrays (Layer 3b R6): light shape for Layer 3b R10's per-SC
      // inversion. Omits `nodes` bulk to keep artefact size bounded —
      // nodesCount retains the reviewable-vs-infra-failure signal R10 needs.
      passesDetail: liftRuleSummaries(axeResults.passes),
      incompleteDetail: liftRuleSummaries(axeResults.incomplete),
      inapplicableDetail: liftRuleSummaries(axeResults.inapplicable),
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
          logger.info(
            { url, viewport: vp.id, violations: result.violations.length },
            'scanned',
          );
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
