// @ts-check
/**
 * @file Programmatic API entry — unstable until v2.0.
 * @module wcag-em-a11y-toolkit
 *
 * @description
 * Re-exports the public surface so embedders can run audits in-process:
 *   ```js
 *   import { runAudit } from 'wcag-em-a11y-toolkit';
 *   ```
 *
 * STABILITY: the programmatic API is exposed but not stability-guaranteed
 * until v2.0 (ADR-0012). The CLI at `bin/wcag-em.mjs` is the blessed
 * surface for end-users.
 */

// SECTION: Re-exports
export { buildContext } from './lib/context.mjs';
export { createLogger, getLogger } from './lib/logger.mjs';
export { validateConfig, assertValidConfig } from './lib/validate-config.mjs';
export { runPreflight } from './lib/preflight.mjs';

// SECTION: Convenience aggregate

/**
 * Run the full audit pipeline in a single call. For embedders who don't
 * need step-level control.
 *
 * @param {import('./lib/context.mjs').BuildContextOptions} [options]
 * @returns {Promise<{ exitCode: number, stages: Record<string, unknown> }>}
 */
export async function runAudit(options = {}) {
  const { buildContext } = await import('./lib/context.mjs');
  const ctx = await buildContext({ requirePlaywright: true, ...options });

  /** @type {Record<string, unknown>} */
  const stages = {};
  let exitCode = 0;

  const stageNames = /** @type {const} */ ([
    'discover',
    'sample',
    'scan',
    'scan-processes',
    'summarize',
  ]);
  for (const name of stageNames) {
    ctx.logger.info({ stage: name }, 'stage start');
    const mod = await import(`./commands/${name}.mjs`);
    const result = await mod.run(ctx);
    stages[name] = result;
    ctx.logger.info({ stage: name }, 'stage done');
    if (
      result &&
      typeof result === 'object' &&
      'exitCode' in result &&
      typeof result.exitCode === 'number' &&
      result.exitCode > exitCode
    ) {
      exitCode = result.exitCode;
    }
  }

  return { exitCode, stages };
}
