// @ts-check
/**
 * @file Tests for the HTML reporter — Layer 4 R5.
 * @module test/unit/reporters-html
 *
 * @description
 * Asserts:
 *   - Structural shape: tool banner, run summary table, findings sections.
 *   - XSS hardening: 4 fixtures cover text/attr/URL/control-char contexts.
 *   - Static-CSS invariant: no template-string interpolation inside the
 *     `<style>` block.
 *   - `includePasses` toggles the passes section.
 *   - Reporter output matches the registry (`html` is registered).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as htmlReporter from '../../src/reporters/html.mjs';
import { listReporters } from '../../src/reporters/index.mjs';
import { TOOL_IDENTITY } from '../../src/lib/version.mjs';

// SECTION: Helpers

/**
 * Build a minimal ctx-shape with tmp reportsDir + resultsDir for one test
 * run. Registers cleanup via the test context.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @param {{ includePasses?: boolean, axeResults?: any[] }} [opts]
 * @returns {Promise<{ ctx: any, reportsDir: string, resultsDir: string }>}
 */
async function makeCtx(t, opts = {}) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-html-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  const resultsDir = path.join(tmp, 'results');
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  if (Array.isArray(opts.axeResults)) {
    await fs.writeFile(
      path.join(resultsDir, 'axe-results.json'),
      JSON.stringify(opts.axeResults),
    );
  }
  const ctx = {
    paths: { reportsDir, resultsDir },
    config: { reporting: { includePasses: Boolean(opts.includePasses) } },
  };
  return { ctx, reportsDir, resultsDir };
}

/**
 * @returns {Record<string, any>}
 */
function baseSummary() {
  return {
    tool: TOOL_IDENTITY,
    site: 'fixture-site',
    generatedAt: '2026-04-29T12:00:00.000Z',
    inventoryCount: 5,
    finalSampleCount: 3,
    samplePagesScanned: 3,
    processRuns: 0,
    groupedFindingCount: 0,
    findings: [],
    comparison: {
      randomSampleIntroducedNewRuleIds: [],
      randomSampleIntroducedNewClusters: [],
      expandStructuredSampleRecommended: false,
    },
  };
}

// SECTION: Structural

test('html reporter: emits tool banner + heading + run summary table', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  await htmlReporter.emit(baseSummary(), ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  assert.match(got, /<!DOCTYPE html>/);
  assert.match(got, new RegExp(`Tool: ${TOOL_IDENTITY.name}`));
  assert.match(got, /<h1>Accessibility scan summary<\/h1>/);
  assert.match(got, /<h2>Run summary<\/h2>/);
  assert.match(got, /<th>Inventory count<\/th><td>5<\/td>/);
});

test('html reporter: empty findings still produces a "No findings." line', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  await htmlReporter.emit(baseSummary(), ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  assert.match(got, /<p>No findings\.<\/p>/);
});

test('html reporter: registry now lists html', () => {
  const names = listReporters();
  assert.ok(names.includes('html'), 'html registered after R5');
  assert.ok(names.includes('json'));
  assert.ok(names.includes('markdown'));
  assert.deepEqual(names, [...names].sort(), 'list remains sorted');
});

test('html reporter: bytes match on-disk file size', async (t) => {
  const { ctx } = await makeCtx(t);
  const result = await htmlReporter.emit(baseSummary(), ctx);
  const stat = await fs.stat(result.path);
  assert.equal(result.bytes, stat.size);
  assert.ok(result.path.endsWith('summary.html'));
});

// SECTION: XSS hardening — the security-critical guarantees

test('XSS: text context — script tag in finding.help is neutralised', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    ...baseSummary(),
    findings: [
      {
        id: 'malicious-rule',
        impact: 'critical',
        classification: 'primary-automated-finding',
        pageCount: 1,
        pageTypes: [],
        help: '<script>alert(1)</script>',
        helpUrl: 'https://example.com',
        targets: [],
      },
    ],
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  assert.ok(!got.includes('<script>alert(1)</script>'), 'no literal script in output');
  assert.ok(got.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'escaped form present');
});

test('XSS: attribute context — selector breakout `">` is neutralised', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    ...baseSummary(),
    findings: [
      {
        id: 'attr-rule',
        impact: 'serious',
        classification: 'primary-automated-finding',
        pageCount: 1,
        pageTypes: [],
        help: 'help',
        helpUrl: 'https://example.com',
        targets: ['"><script>alert(1)</script>'],
      },
    ],
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  // The attribute-breakout sequence MUST NOT appear unescaped.
  assert.ok(!got.includes('"><script>'), 'attribute breakout neutralised');
});

test('XSS: URL context — javascript: helpUrl is quarantined to #', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    ...baseSummary(),
    findings: [
      {
        id: 'url-rule',
        impact: 'moderate',
        classification: 'primary-automated-finding',
        pageCount: 1,
        pageTypes: [],
        help: 'help',
        helpUrl: 'javascript:alert(1)',
        targets: [],
      },
    ],
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  // The href must point at '#', NOT at the javascript: URL.
  assert.match(got, /<a href="#">/);
  assert.ok(!got.includes('href="javascript:'), 'no javascript: href emitted');
  // The URL string itself can appear escaped as the link text — that's fine.
});

test('XSS: control characters in target string emit as numeric entities', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    ...baseSummary(),
    findings: [
      {
        id: 'ctrl-rule',
        impact: 'minor',
        classification: 'best-practice-or-manual-review',
        pageCount: 1,
        pageTypes: [],
        help: 'help',
        helpUrl: 'https://example.com',
        targets: [`a${String.fromCharCode(0x00)}b${String.fromCharCode(0x1f)}c`],
      },
    ],
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  // Raw control bytes must NOT appear in the document.
  assert.ok(!got.includes(String.fromCharCode(0x00)), 'no raw NUL in output');
  assert.ok(!got.includes(String.fromCharCode(0x1f)), 'no raw US in output');
  assert.ok(got.includes('&#0;') && got.includes('&#31;'), 'numeric entities emitted');
});

// SECTION: Static-CSS invariant

test('XSS: <style> block contains no template-literal placeholders', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  await htmlReporter.emit(baseSummary(), ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  const styleMatch = got.match(/<style>([\s\S]*?)<\/style>/);
  assert.ok(styleMatch, 'expected a <style> block');
  const css = styleMatch[1];
  // If interpolation EVER leaks, a `${` would survive in the output.
  assert.ok(!css.includes('${'), 'no template placeholder leakage in <style>');
  // Also assert no </style> mid-block (would break out of the CSS context).
  assert.equal((css.match(/<\/style>/g) ?? []).length, 0);
});

// SECTION: includePasses

test('includePasses=false: passes section absent', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t, { includePasses: false });
  const summary = {
    ...baseSummary(),
    wcagEmSummary: {
      criteriaOutcomes: [{ criterion: '1.1.1 Non-text Content', outcome: 'passed' }],
    },
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  assert.ok(!got.includes('<h2>Passing criteria</h2>'), 'no passes section by default');
});

test('html reporter: screenshot src uses forward slashes (Windows path safety)', async (t) => {
  // Even on POSIX the test runs against forward slashes; the explicit
  // assertion guards against a future regression that re-introduces
  // path.relative without normalisation. On Windows the same code path
  // would break <img src=> rendering otherwise.
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-html-win-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  const resultsDir = path.join(tmp, 'results');
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  // Synthesize axe-results.json with a screenshot path the reporter will
  // try to render. The path lives one level up from reportsDir under
  // a sibling 'screenshots' directory.
  const screenshotAbs = path.join(tmp, 'screenshots', 'page__desktop.png');
  await fs.writeFile(
    path.join(resultsDir, 'axe-results.json'),
    JSON.stringify([{ url: 'https://example.com/', screenshot: screenshotAbs }]),
  );
  const ctx = { paths: { reportsDir, resultsDir }, config: {} };
  const summary = {
    ...baseSummary(),
    findings: [
      {
        id: 'rule-with-screenshot',
        impact: 'serious',
        classification: 'primary-automated-finding',
        pageCount: 1,
        pageTypes: [],
        help: 'help',
        helpUrl: 'https://example.com',
        targets: [],
        pages: ['https://example.com/'],
      },
    ],
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  // <img src> must not contain backslashes; it must use forward slashes.
  const imgMatch = got.match(/<img class="screenshot"[^>]*src="([^"]+)"/);
  assert.ok(imgMatch, 'expected screenshot <img> tag');
  assert.ok(!imgMatch[1].includes('\\'), `src must not contain backslashes: ${imgMatch[1]}`);
  assert.match(imgMatch[1], /\/screenshots\/page__desktop\.png$/);
});

test('includePasses=true: passes section present with passing criteria', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t, { includePasses: true });
  const summary = {
    ...baseSummary(),
    wcagEmSummary: {
      criteriaOutcomes: [
        { criterion: '1.1.1 Non-text Content', outcome: 'passed' },
        { criterion: '1.4.3 Contrast (Minimum)', outcome: 'failed' },
      ],
    },
  };
  await htmlReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.html'), 'utf8');
  assert.match(got, /<h2>Passing criteria<\/h2>/);
  assert.match(got, /<li>1\.1\.1 Non-text Content<\/li>/);
  assert.ok(!got.includes('<li>1.4.3 Contrast (Minimum)</li>'));
});
