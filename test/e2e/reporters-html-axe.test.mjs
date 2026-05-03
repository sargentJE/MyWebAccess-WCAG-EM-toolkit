// @ts-check
/**
 * @file Self-axe regression guard for the HTML reporter — Layer 4 v2 audit.
 * @module test/e2e/reporters-html-axe
 *
 * @description
 * Renders `summary.html` via the actual reporter against a fixture summary,
 * then drives `@axe-core/playwright` over the file:// URL in BOTH
 * `prefers-color-scheme` modes. The test asserts zero `color-contrast`
 * violations — the v2 audit identified that 5 of 10 (impact-color ×
 * color-scheme) combinations failed WCAG 2.1 AA 4.5:1 before the C2 fix
 * (.impact-{critical,serious,moderate,minor} on #121212; .impact-null on
 * #ffffff). For an a11y toolkit's own report this is the highest-impact
 * class of bug; the e2e test locks the fix as a permanent regression
 * guard.
 *
 * Why e2e (not unit)? `color-contrast` is computed by axe-core at runtime
 * from the rendered DOM + computed style — it requires a browser context.
 * Playwright + @axe-core/playwright are already project dependencies; the
 * cost is a single browser launch shared across the test cases.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { chromium } from 'playwright';
import AxeBuilderImport from '@axe-core/playwright';
import * as htmlReporter from '../../src/reporters/html.mjs';
import { TOOL_IDENTITY } from '../../src/lib/version.mjs';

// Project convention (cf. src/commands/scan.mjs:25-27): the @axe-core/
// playwright default export is a class but lacks first-class TS typings,
// so we cast to `any` once at import time.
const AxeBuilder = /** @type {any} */ (AxeBuilderImport);

// SECTION: Helpers

/**
 * Build a representative summary that exercises every impact-color class
 * the HTML reporter renders. Each finding gets a distinct impact value so
 * axe-core sees `<span class="impact-${impact}">` text in every variant.
 *
 * @returns {Record<string, any>}
 */
function fixtureSummary() {
  /** @type {Array<{ impact: string|null }>} */
  const impacts = [
    { impact: 'critical' },
    { impact: 'serious' },
    { impact: 'moderate' },
    { impact: 'minor' },
    { impact: null },
  ];
  return {
    tool: TOOL_IDENTITY,
    site: 'reporters-html-axe-fixture',
    generatedAt: '2026-04-30T00:00:00.000Z',
    inventoryCount: impacts.length,
    finalSampleCount: impacts.length,
    samplePagesScanned: impacts.length,
    processRuns: 0,
    groupedFindingCount: impacts.length,
    findings: impacts.map((it, idx) => ({
      id: `axe-rule-${it.impact ?? 'null'}-${idx}`,
      impact: it.impact,
      classification: 'primary-automated-finding',
      pageCount: 1,
      pageTypes: ['content'],
      help: `Help text for ${it.impact ?? 'null'}-impact rule.`,
      helpUrl: 'https://example.com/rule',
      targets: [`#elem-${idx}`],
      pages: [`https://example.com/${idx}`],
    })),
    comparison: {
      randomSampleIntroducedNewRuleIds: [],
      randomSampleIntroducedNewClusters: [],
      expandStructuredSampleRecommended: false,
    },
  };
}

/**
 * Render the HTML reporter against a fixture summary and return the absolute
 * path to the emitted file. Cleanup registered via the test context.
 *
 * @param {{ after: (fn: () => any) => any }} t
 * @returns {Promise<string>}
 */
async function renderToFile(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-html-axe-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  const ctx = { paths: { reportsDir }, config: {} };
  const result = await htmlReporter.emit(fixtureSummary(), ctx);
  return result.path;
}

/**
 * Run @axe-core/playwright against a rendered file in a given color scheme
 * and return the list of `color-contrast` violation IDs (empty array means
 * zero violations).
 *
 * @param {import('playwright').Browser} browser
 * @param {string} filePath
 * @param {'light' | 'dark'} colorScheme
 * @returns {Promise<Array<{ id: string, nodes: number }>>}
 */
async function axeContrast(browser, filePath, colorScheme) {
  const ctx = await browser.newContext({ colorScheme });
  try {
    const page = await ctx.newPage();
    await page.goto(`file://${filePath}`);
    // Wait for the body to be present — file:// loads are synchronous but
    // axe needs the DOM ready.
    await page.waitForSelector('body');
    const result = await new AxeBuilder({ page }).withTags(['wcag2aa']).analyze();
    /** @type {Array<{ id: string, nodes: any[] }>} */
    const violations = result.violations;
    return violations
      .filter((v) => v.id === 'color-contrast' || v.id === 'color-contrast-enhanced')
      .map((v) => ({ id: v.id, nodes: v.nodes.length }));
  } finally {
    await ctx.close();
  }
}

// SECTION: Tests

test(
  'html reporter self-axe: zero color-contrast violations in light + dark color schemes',
  { timeout: 60_000 },
  async (t) => {
    const filePath = await renderToFile(t);
    const browser = await chromium.launch({ headless: true });
    t.after(() => browser.close());

    const lightViolations = await axeContrast(browser, filePath, 'light');
    assert.deepEqual(
      lightViolations,
      [],
      `light-mode color-contrast violations: ${JSON.stringify(lightViolations)}`,
    );

    const darkViolations = await axeContrast(browser, filePath, 'dark');
    assert.deepEqual(
      darkViolations,
      [],
      `dark-mode color-contrast violations: ${JSON.stringify(darkViolations)}`,
    );
  },
);
