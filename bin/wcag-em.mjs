#!/usr/bin/env node
// @ts-check
/**
 * @file wcag-em CLI entry — Commander-based.
 * @module bin/wcag-em
 *
 * @description
 * Single binary with six subcommands matching the WCAG-EM-aligned pipeline:
 *   discover | sample | scan | scan-processes | summarize | audit
 *
 * Exit-code policy (ADR-0001):
 *   0  clean — no findings above threshold
 *   1  runtime error (bad config, preflight failure, crash)
 *   2  findings exceeded `reporting.failOnFindings` threshold
 *
 * Engine guard: refuses to run on Node <22.11.0 with an actionable message
 * rather than a cryptic runtime error from (e.g.) `Object.groupBy`.
 *
 * @see docs/adr/0003-commander-cli.md
 */

// SECTION: Engine guard — before ANY other import
// NOTE: process.exit is intentional here — we must abort before any
// ES2023-requiring module is even loaded.
// LINK: src/lib/engine-check.mjs mirrors this predicate for unit tests.
//   The inline version stays canonical here so the guard runs before the
//   import machinery touches any ES2023 feature.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 11)) {
  process.stderr.write(
    `wcag-em requires Node >= 22.11.0; you're on ${process.versions.node}.\n` +
      `Install Node 22 LTS (see .nvmrc) and re-run.\n`,
  );
  // eslint-disable-next-line n/no-process-exit
  process.exit(1);
}

// SECTION: Imports
import { Command } from 'commander';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildContext } from '../src/lib/context.mjs';
import { createLogger } from '../src/lib/logger.mjs';

// SECTION: Metadata
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.resolve(__dirname, '../package.json');
const pkg = JSON.parse(await fs.readFile(pkgPath, 'utf8'));

// SECTION: Commander setup
const program = new Command();
program
  .name('wcag-em')
  .description('WCAG-EM-aligned automated accessibility testing toolkit (Playwright + axe-core).')
  .version(pkg.version)
  .option('-c, --config <path>', 'path to site config JSON', 'configs/example-site.json')
  .option('-o, --out-dir <path>', 'output root directory', 'output')
  .option('-l, --log-level <level>', 'pino log level (trace|debug|info|warn|error|fatal)', 'info')
  .option('--quiet', 'alias for --log-level=warn')
  .option('--verbose', 'alias for --log-level=debug');

// SECTION: Helpers

/**
 * Build a RunContext from global options and a per-subcommand Playwright
 * requirement flag.
 *
 * @param {import('commander').Command} cmd
 * @param {{ requirePlaywright?: boolean }} [subOpts]
 */
async function buildCtxFromProgram(cmd, subOpts = {}) {
  const opts = cmd.optsWithGlobals();
  const logLevel = opts.verbose ? 'debug' : opts.quiet ? 'warn' : opts.logLevel;
  return buildContext({
    configPath: opts.config,
    outDir: opts.outDir,
    logLevel,
    requirePlaywright: subOpts.requirePlaywright,
  });
}

/**
 * Wrap a command handler so errors exit 1 with a clean message instead of a
 * raw stack trace.
 *
 * @param {(cmd: import('commander').Command) => Promise<void | number>} fn
 */
function asHandler(fn) {
  return async function handler(/** @type {unknown} */ _arg, /** @type {any} */ cmd) {
    try {
      const exitCode = await fn(cmd);
      if (typeof exitCode === 'number') process.exitCode = exitCode;
    } catch (err) {
      const logger = createLogger({ level: 'error' });
      if (
        err instanceof Error &&
        (err.name === 'PreflightError' || err.name === 'ConfigValidationError')
      ) {
        // Already formatted for humans.
        process.stderr.write(err.message + '\n');
      } else {
        logger.error(
          {
            err:
              err instanceof Error
                ? { name: err.name, message: err.message, stack: err.stack }
                : err,
          },
          'command failed',
        );
      }
      process.exitCode = 1;
    }
  };
}

// SECTION: Subcommands

program
  .command('discover')
  .description('Build the inventory of URLs from the site root + sitemap.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const { run } = await import('../src/commands/discover.mjs');
      await run(ctx);
    }),
  );

program
  .command('sample')
  .description('Build the structured + random + process-expansion sample.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: false });
      const { run } = await import('../src/commands/sample.mjs');
      await run(ctx);
    }),
  );

program
  .command('scan')
  .description('Run axe-core over every page in the sample.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const { run } = await import('../src/commands/scan.mjs');
      await run(ctx);
    }),
  );

program
  .command('scan-processes')
  .description('Run axe-core over each configured process/state.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const { run } = await import('../src/commands/scan-processes.mjs');
      await run(ctx);
    }),
  );

program
  .command('summarize')
  .description('Group findings, compare samples, emit reports.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: false });
      const { run } = await import('../src/commands/summarize.mjs');
      const result = await run(ctx);
      // NOTE: exit-code policy lands in Layer 3; for now any run is treated as 0.
      if (result && typeof result.exitCode === 'number') return result.exitCode;
    }),
  );

program
  .command('audit')
  .description('Run the full pipeline: discover -> sample -> scan -> scan-processes -> summarize.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const stages = ['discover', 'sample', 'scan', 'scan-processes', 'summarize'];
      let exitCode = 0;
      for (const stage of stages) {
        ctx.logger.info({ stage }, 'stage start');
        const { run } = await import(`../src/commands/${stage}.mjs`);
        const result = await run(ctx);
        ctx.logger.info({ stage }, 'stage done');
        if (result && typeof result.exitCode === 'number' && result.exitCode > exitCode) {
          exitCode = result.exitCode;
        }
      }
      return exitCode;
    }),
  );

// SECTION: Lifecycle — SIGINT / unhandled rejections
// NOTE: process.exit is intentional here — SIGINT/SIGTERM handlers must not
// allow Playwright's event loop to swallow the signal.
process.on('SIGINT', () => {
  process.stderr.write('\nwcag-em: SIGINT received — exiting\n');
  // eslint-disable-next-line n/no-process-exit
  process.exit(130);
});
process.on('SIGTERM', () => {
  process.stderr.write('\nwcag-em: SIGTERM received — exiting\n');
  // eslint-disable-next-line n/no-process-exit
  process.exit(143);
});
process.on('unhandledRejection', (reason) => {
  const logger = createLogger({ level: 'error' });
  logger.error({ reason }, 'unhandled rejection');
  process.exitCode = 1;
});

// SECTION: Parse and dispatch
await program.parseAsync(process.argv);
