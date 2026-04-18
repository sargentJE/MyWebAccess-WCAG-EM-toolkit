// @ts-check
/**
 * @file `scan-processes` command — runs axe per configured process/state.
 * @module commands/scan-processes
 *
 * @description
 * Stage 4 of the pipeline. Executes each `config.processes[]` entry via a
 * minimal DSL (`goto`, `click`, `fill`, `press`, `waitFor`, `screenshot`,
 * `axe`) against a fresh Playwright context. Built-in `blank-submit` and
 * `partial-submit` patterns expand into step sequences; custom `steps[]`
 * arrays override the pattern.
 *
 * Layer 2 extracts the step-dispatch switch into `src/lib/process-runner.mjs`
 * with per-step timeout + respect for `config.scan.fullPageScreenshots`.
 *
 * @see https://www.w3.org/TR/WCAG-EM/#step3d
 */

// SECTION: Imports
import path from 'node:path';
import { chromium } from 'playwright';
// NOTE: see scan.mjs for rationale on the AxeBuilder type cast.
import AxeBuilderImport from '@axe-core/playwright';
const AxeBuilder = /** @type {any} */ (AxeBuilderImport);
import { writeJson } from '../lib/fs-utils.mjs';
import { fileSafeFromUrl } from '../lib/urls.mjs';
import { buildContext } from '../lib/context.mjs';

// SECTION: Internal helpers

/**
 * Expand a process definition into a flat step list. Uses `processDef.steps`
 * when provided; otherwise falls back to the `pattern` shortcuts.
 *
 * @param {any} processDef
 * @returns {any[]}
 */
function expandPattern(processDef) {
  if (Array.isArray(processDef.steps) && processDef.steps.length > 0) return processDef.steps;

  if (processDef.pattern === 'blank-submit') {
    return [
      { action: 'goto', url: processDef.startUrl },
      {
        action: 'click',
        selector: processDef.selectors?.submit ?? "button[type='submit'], input[type='submit']",
      },
      { action: 'screenshot', name: 'blank-submit' },
      { action: 'axe', state: 'blank-submit' },
    ];
  }

  if (processDef.pattern === 'partial-submit') {
    const fills = (processDef.fields || []).map(
      /** @param {any} field */ (field) => ({
        action: 'fill',
        selector: field.selector,
        value: field.value ?? '',
      }),
    );
    return [
      { action: 'goto', url: processDef.startUrl },
      ...fills,
      {
        action: 'click',
        selector: processDef.selectors?.submit ?? "button[type='submit'], input[type='submit']",
      },
      { action: 'screenshot', name: 'partial-submit' },
      { action: 'axe', state: 'partial-submit' },
    ];
  }

  return [];
}

/**
 * @param {import('playwright').Page} page
 */
async function runAxe(page) {
  const result = await new AxeBuilder({ page }).analyze();
  return {
    violations: result.violations,
    passes: result.passes.length,
    incomplete: result.incomplete.length,
    inapplicable: result.inapplicable.length,
  };
}

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ processesRun: number }>}
 */
export async function run(ctx) {
  const { config, logger, paths } = ctx;
  const browser = await chromium.launch({ headless: true });
  /** @type {any[]} */
  const processResults = [];

  for (const processDef of config.processes ?? []) {
    const context = await browser.newContext({ viewport: config.scan.viewport });
    const page = await context.newPage();
    const steps = expandPattern(processDef);
    /** @type {any[]} */
    const states = [];

    try {
      logger.info({ name: processDef.name }, 'process start');

      if (steps.length === 0) {
        processResults.push({
          name: processDef.name,
          startUrl: processDef.startUrl,
          pattern: processDef.pattern ?? null,
          states: [{ state: 'not-run', note: 'No steps or supported pattern defined.' }],
        });
        continue;
      }

      // ANCHOR: StepDispatch — tiny DSL; extended in Layer 2
      for (const step of steps) {
        if (step.action === 'goto') {
          await page.goto(step.url, {
            waitUntil: config.scan.waitUntil,
            timeout: config.scan.timeoutMs,
          });
        } else if (step.action === 'click') {
          await page.locator(step.selector).first().click();
        } else if (step.action === 'fill') {
          await page
            .locator(step.selector)
            .first()
            .fill(step.value ?? '');
        } else if (step.action === 'press') {
          await page.keyboard.press(step.key);
        } else if (step.action === 'waitFor') {
          await page.waitForTimeout(step.timeoutMs ?? 500);
        } else if (step.action === 'screenshot') {
          const screenshot = path.join(
            paths.screenshotsDir,
            `${fileSafeFromUrl(processDef.startUrl)}__${processDef.name}__${step.name ?? 'state'}.png`,
          );
          // FIXME(Layer 2): respect config.scan.fullPageScreenshots here.
          await page.screenshot({ path: screenshot, fullPage: true });
          states.push({ state: `screenshot:${step.name ?? 'state'}`, screenshot });
        } else if (step.action === 'axe') {
          const axe = await runAxe(page);
          states.push({ state: step.state ?? 'state', ...axe });
        }
      }

      processResults.push({
        name: processDef.name,
        startUrl: processDef.startUrl,
        pattern: processDef.pattern ?? null,
        states,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      processResults.push({
        name: processDef.name,
        startUrl: processDef.startUrl,
        pattern: processDef.pattern ?? null,
        error: message,
        states,
      });
      logger.error({ name: processDef.name, err: message }, 'process failed');
    } finally {
      await context.close();
    }
  }

  await browser.close();
  await writeJson(path.join(paths.resultsDir, 'process-results.json'), processResults);
  logger.info({ processesRun: processResults.length }, 'scan-processes done');
  return { processesRun: processResults.length };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: true });
  await run(ctx);
}
