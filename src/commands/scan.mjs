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
import { buildContext, ensurePreflight } from '../lib/context.mjs';

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

  const browser = await chromium.launch({ headless: true });
  /** @type {any[]} */
  const allResults = [];
  let pagesFailed = 0;

  /**
   * @param {import('playwright').Page} page
   * @param {string} url
   */
  async function runForPage(page, url) {
    await page.goto(url, {
      waitUntil: config.scan.waitUntil,
      timeout: config.scan.timeoutMs,
    });

    const screenshotPath = path.join(paths.screenshotsDir, `${fileSafeFromUrl(url)}.png`);
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
      passes: axeResults.passes.length,
      incomplete: axeResults.incomplete.length,
      inapplicable: axeResults.inapplicable.length,
    };
  }

  // ANCHOR: ScanLoop — per-URL try/catch so one bad page doesn't kill the scan
  for (const url of sampleUrls) {
    let attempt = 0;
    let success = false;
    /** @type {Error | null} */
    let lastError = null;

    while (attempt <= config.scan.retries && !success) {
      const context = await browser.newContext({ viewport: config.scan.viewport });
      const page = await context.newPage();
      try {
        attempt += 1;
        logger.info({ url, attempt }, 'scanning');
        const result = await runForPage(page, url);
        allResults.push({ url, attempts: attempt, ...result });
        logger.info({ url, violations: result.violations.length }, 'scanned');
        success = true;
      } catch (error) {
        lastError = /** @type {Error} */ (error);
        logger.warn({ url, attempt, err: lastError.message }, 'scan attempt failed');
      } finally {
        await context.close();
      }
    }

    if (!success) {
      pagesFailed += 1;
      allResults.push({
        url,
        attempts: attempt,
        error: lastError?.message ?? 'Unknown error',
        violations: [],
      });
      logger.error({ url, attempts: attempt }, 'scan failed after retries');
    }
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
