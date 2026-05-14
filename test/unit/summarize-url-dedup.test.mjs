// @ts-check
/**
 * @file Tests that URL normalisation in the grouping stage deduplicates
 *   trailing-slash variants into a single finding entry.
 * @module test/unit/summarize-url-dedup
 *
 * @description
 * Regression guard for commit `05bd04c`: `summarize.mjs` wraps every URL
 * in `normalizeUrl()` before grouping, so `/page` and `/page/` collapse
 * to one canonical key. This test synthesises axe + process results that
 * differ only by trailing slash and asserts the summary merges them.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import pino from 'pino';
import { run } from '../../src/commands/summarize.mjs';
import { defineHidden } from '../../src/lib/context.mjs';

// SECTION: Helpers

/**
 * Build a minimal RunContext backed by real temp directories.
 * Populates the fixture files that `run()` reads, then returns
 * a cleanup-wired context.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @param {{ axeResults?: any[], processResults?: any[] }} [opts]
 * @returns {Promise<{ ctx: any, reportsDir: string }>}
 */
async function makeCtx(t, opts = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'summarize-dedup-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));

  const inventoryDir = path.join(tmp, 'inventory');
  const resultsDir = path.join(tmp, 'results');
  const reportsDir = path.join(tmp, 'reports');
  const screenshotsDir = path.join(tmp, 'screenshots');
  await fs.mkdir(inventoryDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });

  // Minimal fixture files expected by run()
  await fs.writeFile(path.join(inventoryDir, 'inventory.json'), JSON.stringify([]));
  await fs.writeFile(path.join(inventoryDir, 'sample-metadata.json'), JSON.stringify({}));
  await fs.writeFile(
    path.join(resultsDir, 'axe-results.json'),
    JSON.stringify(opts.axeResults ?? []),
  );
  await fs.writeFile(
    path.join(resultsDir, 'process-results.json'),
    JSON.stringify(opts.processResults ?? []),
  );
  await fs.writeFile(path.join(inventoryDir, 'structured-sample.txt'), '');
  await fs.writeFile(path.join(inventoryDir, 'random-sample.txt'), '');

  const ctx = /** @type {any} */ ({
    config: {
      name: 'dedup-test',
      reporting: { reporters: ['json'] },
    },
    configPath: path.join(tmp, 'config.json'),
    logger: pino({ level: 'silent' }),
    paths: {
      outDir: tmp,
      inventoryDir,
      resultsDir,
      reportsDir,
      screenshotsDir,
      sampleJsonPath: path.join(tmp, 'sample.json'),
    },
    args: {},
  });
  defineHidden(ctx, 'preflightRan', true);
  return { ctx, reportsDir };
}

/**
 * Build a minimal axe violation node.
 *
 * @param {string} target
 * @returns {{ target: string[], html: string }}
 */
function violationNode(target) {
  return { target: [target], html: `<div class="${target}">test</div>` };
}

// SECTION: Tests

test('page-scan URLs with and without trailing slash group into one finding', async (t) => {
  const { ctx } = await makeCtx(t, {
    axeResults: [
      {
        url: 'https://example.com/page',
        violations: [
          {
            id: 'image-alt',
            impact: 'critical',
            tags: ['wcag2a', 'wcag111'],
            nodes: [violationNode('img.photo')],
          },
        ],
        passesDetail: [],
        incompleteDetail: [],
        inapplicableDetail: [],
      },
      {
        url: 'https://example.com/page/',
        violations: [
          {
            id: 'image-alt',
            impact: 'critical',
            tags: ['wcag2a', 'wcag111'],
            nodes: [violationNode('img.banner')],
          },
        ],
        passesDetail: [],
        incompleteDetail: [],
        inapplicableDetail: [],
      },
    ],
  });

  const { summary } = await run(ctx);

  const imageAlt = summary.findings.find((/** @type {any} */ f) => f.id === 'image-alt');
  assert.ok(imageAlt, 'image-alt finding should exist');
  assert.equal(imageAlt.pageCount, 1, 'trailing-slash variant should collapse to one page');
  assert.equal(imageAlt.pages.length, 1);
  assert.equal(imageAlt.occurrences, 2, 'both nodes still count as separate occurrences');
});

test('process-scan trailing-slash URL merges with page-scan canonical URL', async (t) => {
  const { ctx } = await makeCtx(t, {
    axeResults: [
      {
        url: 'https://example.com/contact',
        violations: [
          {
            id: 'label',
            impact: 'serious',
            tags: ['wcag2a', 'wcag412'],
            nodes: [violationNode('input.name')],
          },
        ],
        passesDetail: [],
        incompleteDetail: [],
        inapplicableDetail: [],
      },
    ],
    processResults: [
      {
        name: 'contact-form',
        startUrl: 'https://example.com/contact/',
        states: [
          {
            state: 'blank-submit',
            violations: [
              {
                id: 'label',
                impact: 'serious',
                tags: ['wcag2a', 'wcag412'],
                nodes: [violationNode('input.email')],
              },
            ],
            incompleteDetail: [],
          },
        ],
      },
    ],
  });

  const { summary } = await run(ctx);

  const label = summary.findings.find((/** @type {any} */ f) => f.id === 'label');
  assert.ok(label, 'label finding should exist');
  assert.equal(label.pageCount, 1, 'process trailing-slash should merge with page-scan canonical');
  assert.equal(label.occurrences, 2);
  assert.deepEqual(label.sourceTypes, ['page-scan', 'process:contact-form:blank-submit']);
});

test('incomplete findings also deduplicate trailing-slash URLs', async (t) => {
  const { ctx } = await makeCtx(t, {
    axeResults: [
      {
        url: 'https://example.com/form',
        violations: [],
        passesDetail: [],
        incompleteDetail: [
          {
            id: 'color-contrast',
            impact: 'serious',
            tags: ['wcag2aa', 'wcag143'],
            nodesCount: 2,
            help: 'Elements must meet contrast ratio',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
            firstTarget: 'span.label',
          },
        ],
        inapplicableDetail: [],
      },
      {
        url: 'https://example.com/form/',
        violations: [],
        passesDetail: [],
        incompleteDetail: [
          {
            id: 'color-contrast',
            impact: 'serious',
            tags: ['wcag2aa', 'wcag143'],
            nodesCount: 1,
            help: 'Elements must meet contrast ratio',
            helpUrl: 'https://dequeuniversity.com/rules/axe/4.10/color-contrast',
            firstTarget: 'span.label',
          },
        ],
        inapplicableDetail: [],
      },
    ],
  });

  const { summary } = await run(ctx);

  const cc = summary.incompleteFindings.find((/** @type {any} */ f) => f.id === 'color-contrast');
  assert.ok(cc, 'color-contrast incomplete should exist');
  assert.equal(cc.pageCount, 1, 'incomplete trailing-slash variant should collapse to one page');
});
