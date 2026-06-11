// @ts-check
/**
 * @file Process-step dispatcher with per-step timeout.
 * @module lib/process-runner
 *
 * @description
 * Stage-4 process walkthroughs (sign-up, checkout, search, etc.) run as a
 * flat sequence of small action steps against a Playwright `Page`. v0.3
 * inlined the dispatch as a big if-else chain inside `scan-processes.mjs`
 * with no per-step safety net — a hanging `click` or `waitFor` would stall
 * the whole process indefinitely.
 *
 * This module pulls the dispatch into a dedicated file, wraps every step in a
 * `Promise.race` against `config.scan.timeoutMs`, and surfaces a timeout
 * as `{ state: 'step-timeout', ... }` in the returned state array so the
 * process continues to its next step rather than aborting. The screenshot
 * step also finally honours `config.scan.fullPageScreenshots` (the v0.3
 * previously hard-coded `fullPage: true`).
 *
 * @see docs/adr/0005-fail-fast-on-config.md
 */

// SECTION: Imports
import path from 'node:path';
// NOTE: see scan.mjs for rationale on the AxeBuilder type cast.
import AxeBuilderImport from '@axe-core/playwright';
const AxeBuilder = /** @type {any} */ (AxeBuilderImport);
import { fileSafeFromUrl } from './urls.mjs';
import { liftRuleSummaries, liftIncompleteSummaries } from './axe-artifact.mjs';

// SECTION: Constants

// ANCHOR: DEFAULT_STEP_TIMEOUT_MS — used when config.scan.timeoutMs is unset.
const DEFAULT_STEP_TIMEOUT_MS = 60000;

// ANCHOR: DISPATCH_ACTIONS — authoritative list of actions `runStep` handles.
// The schema's `$defs.action.properties.action.enum` in
// `schemas/config.schema.json` MUST equal this set. The invariant is locked
// by `test/unit/process-runner-invariant.test.mjs`. Aliases are not permitted.
// LINK: docs/adr/0005-fail-fast-on-config.md
export const DISPATCH_ACTIONS = Object.freeze([
  'goto',
  'click',
  'fill',
  'press',
  'waitFor',
  'screenshot',
  'axe',
]);

// SECTION: Public API

/**
 * @typedef {object} StepContext
 * @property {import('playwright').Page} page - Active Playwright page.
 * @property {Record<string, any>} config - Resolved RunContext config.
 * @property {import('pino').Logger} logger - Run logger for step-level events.
 * @property {import('./context.mjs').RunContextPaths} paths - Output dir layout.
 * @property {any} processDef - The process definition the step belongs to.
 * @property {{ id: string, width: number, height: number }} viewport
 *   - Viewport the process is being executed under. Threaded from
 *     `scan-processes.mjs`'s outer viewport loop so screenshot filenames
 *     can disambiguate desktop vs reflow captures of the same state.
 */

/**
 * @typedef {object} StepResult
 * @property {string} state - e.g. `'ok'`, `'error'`, `'step-timeout'`,
 *   `'screenshot:<name>'`, or the user-supplied `axe` state label.
 * @property {string} [name] - Step name or action (for screenshot/axe states).
 * @property {string} [screenshot] - Path written when state is `screenshot:*`.
 * @property {any[]} [violations] - axe violations when state is an axe run.
 * @property {number} [passes] - axe passes count when state is an axe run.
 * @property {number} [incomplete] - axe incomplete count when state is axe.
 * @property {number} [inapplicable] - axe inapplicable count when state is axe.
 * @property {string} [error] - Error message when state is `error` or timeout.
 */

/**
 * Thrown internally when a step exceeds its `stepTimeoutMs`. Caught by
 * `runStep` and surfaced as `state: 'step-timeout'` in the result array;
 * never propagates out of the module.
 *
 * ANCHOR: StepTimeoutError — carries step action + timeout for logging.
 */
export class StepTimeoutError extends Error {
  /**
   * Build a timeout error for a named step.
   *
   * @param {string} action - The step action that timed out (e.g. `'click'`).
   * @param {number} timeoutMs - The configured step timeout in milliseconds.
   */
  constructor(action, timeoutMs) {
    super(`step "${action}" exceeded stepTimeoutMs=${timeoutMs}`);
    this.name = 'StepTimeoutError';
    this.action = action;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Run every step in a process and return the accumulated state array.
 *
 * A timed-out or errored step is recorded in the result array and the loop
 * continues — one bad step does not abort the whole process. Consumers
 * (`summarize.mjs`) read `state.state` for reporting.
 *
 * @param {any} processDef
 * @param {any[]} steps
 * @param {StepContext} ctx
 * @returns {Promise<StepResult[]>}
 */
export async function runProcessSteps(processDef, steps, ctx) {
  /** @type {StepResult[]} */
  const states = [];
  for (const step of steps) {
    const result = await runStep(step, ctx);
    if (result) states.push(result);
  }
  return states;
}

/**
 * Run a single step. Returns the state entry to append (or `null` when the
 * action produces no state — e.g. bare navigation).
 *
 * @param {any} step
 * @param {StepContext} ctx
 * @returns {Promise<StepResult | null>}
 */
export async function runStep(step, ctx) {
  const stepTimeoutMs = Number(ctx.config?.scan?.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS);
  const timeout = rejectAfter(step.action, stepTimeoutMs);
  try {
    return await Promise.race([dispatch(step, ctx), timeout.promise]);
  } catch (err) {
    if (err instanceof StepTimeoutError) {
      ctx.logger.warn({ action: err.action, timeoutMs: err.timeoutMs }, 'process step timed out');
      return { state: 'step-timeout', name: err.action, error: err.message };
    }
    const message = err instanceof Error ? err.message : String(err);
    ctx.logger.error({ action: step.action, err: message }, 'process step failed');
    return { state: 'error', name: step.action, error: message };
  } finally {
    timeout.cancel();
  }
}

// SECTION: Internal helpers

/**
 * Schedule a timer that rejects with `StepTimeoutError` after `timeoutMs` ms,
 * returning the promise together with a `cancel()` that clears the handle.
 *
 * Callers MUST invoke `cancel()` in a `finally` around `Promise.race` so the
 * timer doesn't linger on the event loop once the race is settled — otherwise
 * a fast-resolving step with a 60 s default timeout keeps Node alive for up
 * to 60 s after the step finished.
 *
 * @param {string} action
 * @param {number} timeoutMs
 * @returns {{ promise: Promise<never>, cancel: () => void }}
 */
function rejectAfter(action, timeoutMs) {
  /** @type {NodeJS.Timeout | undefined} */
  let handle;
  const promise = /** @type {Promise<never>} */ (
    new Promise((_, reject) => {
      handle = setTimeout(() => reject(new StepTimeoutError(action, timeoutMs)), timeoutMs);
    })
  );
  return {
    promise,
    cancel: () => {
      if (handle !== undefined) clearTimeout(handle);
    },
  };
}

/**
 * Route a step to its Playwright action. Returns the state entry to append
 * (or `null` when no state needs recording for this action).
 *
 * @param {any} step
 * @param {StepContext} ctx
 * @returns {Promise<StepResult | null>}
 */
async function dispatch(step, ctx) {
  const { page, config, paths, processDef, viewport } = ctx;
  switch (step.action) {
    case 'goto':
      await page.goto(step.url, {
        waitUntil: config.scan.waitUntil,
        timeout: config.scan.timeoutMs,
      });
      return null;

    case 'click':
      await page.locator(step.selector).first().click();
      return null;

    case 'fill':
      await page
        .locator(step.selector)
        .first()
        .fill(step.value ?? '');
      return null;

    case 'press':
      await page.keyboard.press(step.key);
      return null;

    case 'waitFor':
      // NOTE: selector-aware since the 2026-06 review (finding C5): with a
      // selector, poll the DOM for it — the hydration-marker behaviour the
      // README's SPA guidance documents; without one, fall back to the fixed
      // sleep. An explicit step.timeoutMs wins; otherwise the shared step
      // budget applies so the rejectAfter race in runStep stays the single
      // outer bound.
      // LINK: README.md → "Configuring for SPAs"
      if (typeof step.selector === 'string' && step.selector.length > 0) {
        // When falling back to the shared step budget, undercut it slightly so
        // Playwright's TimeoutError (which names the selector) deterministically
        // wins the race against runStep's rejectAfter at the same budget —
        // otherwise the recorded state flips between 'error' and 'step-timeout'
        // depending on which timer fires first.
        const budget = Number(config?.scan?.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS);
        await page.waitForSelector(step.selector, {
          timeout: step.timeoutMs ?? Math.max(budget - 50, 1),
        });
        return null;
      }
      await page.waitForTimeout(step.timeoutMs ?? 500);
      return null;

    case 'screenshot': {
      const screenshotPath = path.join(
        paths.screenshotsDir,
        `${fileSafeFromUrl(processDef.startUrl)}__${processDef.name}__${step.name ?? 'state'}__${viewport.id}.png`,
      );
      await page.screenshot({
        path: screenshotPath,
        fullPage: config.scan.fullPageScreenshots !== false,
      });
      return { state: `screenshot:${step.name ?? 'state'}`, screenshot: screenshotPath };
    }

    case 'axe': {
      const axe = await runAxe(page, config?.reporting?.maxIncompleteExamplesPerRule);
      return { state: step.state ?? 'state', ...axe };
    }

    default:
      return { state: 'error', name: step.action, error: `unknown action: ${step.action}` };
  }
}

/**
 * @param {import('playwright').Page} page
 * @param {number} [maxIncompleteExamples] - Per-rule incomplete-example cap
 *   (`reporting.maxIncompleteExamplesPerRule`).
 * @returns {Promise<{
 *   violations: any[],
 *   passes: number,
 *   incomplete: number,
 *   inapplicable: number,
 *   passesDetail: Array<{ id: string, tags: string[], impact: string|null, nodesCount: number, help: string, helpUrl: string, firstTarget: string|null }>,
 *   incompleteDetail: Array<{ id: string, tags: string[], impact: string|null, nodesCount: number, help: string, helpUrl: string, firstTarget: string|null, examples: Array<{ target: string|null, html: string|null }> }>,
 *   inapplicableDetail: Array<{ id: string, tags: string[], impact: string|null, nodesCount: number, help: string, helpUrl: string, firstTarget: string|null }>,
 * }>}
 */
async function runAxe(page, maxIncompleteExamples) {
  const result = await new AxeBuilder({ page }).analyze();
  return {
    violations: result.violations,
    passes: result.passes.length,
    incomplete: result.incomplete.length,
    inapplicable: result.inapplicable.length,
    passesDetail: liftRuleSummaries(result.passes),
    incompleteDetail: liftIncompleteSummaries(result.incomplete, maxIncompleteExamples),
    inapplicableDetail: liftRuleSummaries(result.inapplicable),
  };
}

// `liftRuleSummaries` / `liftIncompleteSummaries` are imported from
// `./axe-artifact.mjs` — the single source of truth shared with `scan.mjs`
// (this path previously kept a diverged 4-key copy).
