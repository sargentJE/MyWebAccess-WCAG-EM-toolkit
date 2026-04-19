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
 * Step dispatch and per-step timeout live in `src/lib/process-runner.mjs`
 * (see ADR-0005 — fail fast on config). `runOneProcess` isolates each
 * process in its own try/catch/finally so a bad viewport or context-
 * allocation failure can't take down the outer loop.
 *
 * @see docs/adr/0005-fail-fast-on-config.md
 * @see https://www.w3.org/TR/WCAG-EM/#step3d
 */

// SECTION: Imports
import path from 'node:path';
import { chromium } from 'playwright';
import { writeJson } from '../lib/fs-utils.mjs';
import { runProcessSteps } from '../lib/process-runner.mjs';
import { resolveViewports } from '../lib/viewports.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';

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

// SECTION: Public API

/**
 * Run a single process definition against a shared browser. Allocates its
 * own context + page inside a try/catch so a failure here (bad viewport,
 * Playwright allocation refused) becomes an error field on the result,
 * not an escaped throw that aborts the outer loop.
 *
 * `context.close()` in `finally` is guarded — if `newContext` threw,
 * `context` is undefined and the close is skipped to avoid a cascade
 * `TypeError` that would mask the original error.
 *
 * @param {import('playwright').Browser} browser - Shared browser instance.
 * @param {any} processDef - Entry from `config.processes[]`.
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @param {{ id: string, width: number, height: number }} viewport
 *   - Viewport this invocation runs under. Threaded from the outer loop in
 *     `run()` so each process is executed once per resolved viewport.
 * @returns {Promise<any>} The process result (pushed into processResults).
 */
export async function runOneProcess(browser, processDef, ctx, viewport) {
  /** @type {import('playwright').BrowserContext | undefined} */
  let context;
  /** @type {any[]} */
  const states = [];
  try {
    context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const page = await context.newPage();
    const steps = expandPattern(processDef);

    if (steps.length === 0) {
      return {
        name: processDef.name,
        startUrl: processDef.startUrl,
        pattern: processDef.pattern ?? null,
        viewport: viewport.id,
        states: [{ state: 'not-run', note: 'No steps or supported pattern defined.' }],
      };
    }

    ctx.logger.info({ name: processDef.name, viewport: viewport.id }, 'process start');
    const stepResults = await runProcessSteps(processDef, steps, {
      page,
      config: ctx.config,
      logger: ctx.logger,
      paths: ctx.paths,
      processDef,
      viewport,
    });
    states.push(...stepResults);

    return {
      name: processDef.name,
      startUrl: processDef.startUrl,
      pattern: processDef.pattern ?? null,
      viewport: viewport.id,
      states,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    ctx.logger.error(
      { name: processDef.name, viewport: viewport.id, err: message },
      'process failed',
    );
    return {
      name: processDef.name,
      startUrl: processDef.startUrl,
      pattern: processDef.pattern ?? null,
      viewport: viewport.id,
      error: message,
      states,
    };
  } finally {
    if (context) {
      try {
        await context.close();
      } catch (closeErr) {
        const msg = closeErr instanceof Error ? closeErr.message : String(closeErr);
        ctx.logger.warn(
          { viewport: viewport.id, err: msg },
          'process context close failed',
        );
      }
    }
  }
}

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ processesRun: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;
  const viewports = resolveViewports(config, logger);
  logger.info({ viewports: viewports.map((vp) => vp.id) }, 'scan-processes viewports');

  const browser = await chromium.launch({ headless: true });
  /** @type {any[]} */
  const processResults = [];

  // ANCHOR: ProcessLoop — outer viewport × inner process. Mirrors scan.mjs's
  // ScanLoop ordering (ADR-0006). Each process runs once per viewport; the
  // viewport id flows into both the result object and process-runner's
  // screenshot filename via the StepContext.viewport field.
  for (const vp of viewports) {
    logger.info({ viewport: vp.id }, 'viewport start');
    for (const processDef of config.processes ?? []) {
      processResults.push(await runOneProcess(browser, processDef, ctx, vp));
    }
    logger.info({ viewport: vp.id }, 'viewport done');
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
