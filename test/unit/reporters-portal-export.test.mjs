// @ts-check
/**
 * @file Tests for the portal-export reporter.
 * @module test/unit/reporters-portal-export
 *
 * @description
 * Asserts the MyAccess Portal canonical-scan envelope: required top-level
 * keys; the compliance-vs-reported split (best-practice excluded from
 * `totalIssues`/`distribution` but present in `rawFindings` as manual-review);
 * priority mapping incl. null-impact coercion; the REAL best-practice
 * classification literal; `averageScore` derivation + omission; per-element
 * `instances` (from axe-results) with per-page fallback and
 * `occurrenceCount === instances.length`; `message` fallback; `category`
 * derivation; fail-loud on a bad `rootUrl`; and byte-stable determinism.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as portalReporter from '../../src/reporters/portal-export.mjs';

// SECTION: Helpers

/**
 * Build a ctx with a tmp reportsDir + a valid rootUrl (this reporter requires
 * one). Cleanup registered with the test context's `after`.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @param {Record<string, any>} [config]
 * @returns {Promise<{ ctx: any, reportsDir: string }>}
 */
async function makeCtx(t, config = { rootUrl: 'https://example.com/' }) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  return { ctx: { paths: { reportsDir }, config }, reportsDir };
}

/**
 * A minimal-but-complete summary; override fields per test.
 *
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function baseSummary(overrides = {}) {
  return {
    tool: { name: 'wcag-em-a11y-toolkit', version: '1.1.0', axeCore: '4.11.2' },
    site: 'example.com',
    generatedAt: '2026-05-14T12:36:52.000Z',
    inventoryCount: 80,
    finalSampleCount: 18,
    samplePagesScanned: 36,
    groupedFindingCount: 0,
    findings: [],
    wcagEmSummary: { criteriaOutcomes: [] },
    ...overrides,
  };
}

/**
 * A grouped finding with sensible defaults; override per test.
 *
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function finding(overrides = {}) {
  return {
    id: 'rule',
    impact: 'serious',
    help: 'Help text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/rule',
    tags: [],
    classification: 'primary-automated-finding',
    actRuleIds: [],
    wcagCriteria: ['1.4.3'],
    occurrences: 1,
    pages: [],
    pageCount: 0,
    targets: [],
    examples: [],
    sourceTypes: ['automated'],
    pageTypes: [],
    clusters: [],
    ...overrides,
  };
}

/**
 * Emit and parse the resulting portal-export.json.
 *
 * @param {Record<string, any>} summary
 * @param {any} ctx
 * @returns {Promise<{ result: { path: string, bytes: number }, parsed: any }>}
 */
async function emitParsed(summary, ctx) {
  const result = await portalReporter.emit(summary, ctx);
  const parsed = JSON.parse(await fs.readFile(result.path, 'utf8'));
  return { result, parsed };
}

// SECTION: Envelope shape

test('portal-export: writes portal-export.json; bytes match stat; correct filename', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const result = await portalReporter.emit(baseSummary(), ctx);
  const stat = await fs.stat(result.path);
  assert.equal(result.bytes, stat.size);
  assert.ok(result.path.endsWith('portal-export.json'));
  await fs.access(path.join(reportsDir, 'portal-export.json'));
});

test('portal-export: top-level keys are exactly scanMetadata, summary, rawFindings', async (t) => {
  const { ctx } = await makeCtx(t);
  const { parsed } = await emitParsed(baseSummary(), ctx);
  assert.deepEqual(Object.keys(parsed), ['scanMetadata', 'summary', 'rawFindings']);
  assert.ok(Array.isArray(parsed.rawFindings));
});

test('portal-export: scanMetadata is populated from summary + config', async (t) => {
  const { ctx } = await makeCtx(t);
  const { parsed } = await emitParsed(baseSummary(), ctx);
  assert.equal(parsed.scanMetadata.url, 'https://example.com/');
  assert.equal(parsed.scanMetadata.timestamp, '2026-05-14T12:36:52.000Z');
  assert.equal(parsed.scanMetadata.tool, 'wcag-em-a11y-toolkit 1.1.0');
  assert.equal(parsed.scanMetadata.toolVersion, '1.1.0');
  assert.deepEqual(parsed.scanMetadata.scanOptions, {
    axeVersion: '4.11.2',
    pagesScanned: 36,
    sampleSize: 18,
    inventorySize: 80,
  });
});

// SECTION: Compliance vs reported split

test('portal-export: distribution counts compliance-affecting only; reportedTotal includes best-practice', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 3,
    findings: [
      finding({ id: 'color-contrast', impact: 'serious', wcagCriteria: ['1.4.3'] }),
      finding({ id: 'image-alt', impact: 'critical', wcagCriteria: ['1.1.1'] }),
      // best-practice (excluded from totalIssues + distribution, kept in rawFindings)
      finding({
        id: 'region',
        impact: 'moderate',
        classification: 'best-practice-or-manual-review',
        wcagCriteria: [],
      }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  assert.equal(parsed.summary.totalIssues, 2, 'best-practice excluded from totalIssues');
  assert.equal(parsed.summary.reportedTotal, 3, 'reportedTotal counts all findings');
  assert.deepEqual(parsed.summary.distribution, { critical: 1, high: 1, medium: 0, low: 0 });
  const sum = Object.values(parsed.summary.distribution).reduce((a, b) => a + b, 0);
  assert.equal(sum, parsed.summary.totalIssues, 'distribution sum reconciles with totalIssues');
  assert.equal(parsed.rawFindings.length, 3, 'best-practice still emitted as a row');
});

test('portal-export: best-practice rows are manual-review and do not count toward compliance', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 3,
    findings: [
      finding({
        id: 'bp-real',
        classification: 'best-practice-or-manual-review',
        impact: 'moderate',
      }),
      // defensive: the prompt's (wrong) literal 'best-practice' must also be caught via startsWith
      finding({ id: 'bp-prefix', classification: 'best-practice', impact: 'moderate' }),
      finding({ id: 'primary', classification: 'primary-automated-finding', impact: 'serious' }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const byId = Object.fromEntries(parsed.rawFindings.map((/** @type {any} */ r) => [r.ruleId, r]));

  for (const id of ['bp-real', 'bp-prefix']) {
    assert.equal(byId[id].countsTowardCompliance, false, `${id} must not count`);
    assert.equal(byId[id].findingKind, 'manual-review', `${id} findingKind`);
    assert.equal(byId[id].confidence, 'manual-review', `${id} confidence`);
  }
  assert.equal(byId.primary.countsTowardCompliance, true);
  assert.equal(byId.primary.findingKind, 'violation');
  assert.equal(byId.primary.confidence, 'automated');
  // Only the single primary finding is compliance-affecting.
  assert.equal(parsed.summary.totalIssues, 1);
  assert.equal(parsed.summary.reportedTotal, 3);
});

// SECTION: Impact / priority mapping

test('portal-export: priorityLabel + impact map across all four severities', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 4,
    findings: [
      finding({ id: 'c', impact: 'critical' }),
      finding({ id: 's', impact: 'serious' }),
      finding({ id: 'm', impact: 'moderate' }),
      finding({ id: 'n', impact: 'minor' }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const byId = Object.fromEntries(parsed.rawFindings.map((/** @type {any} */ r) => [r.ruleId, r]));
  assert.equal(byId.c.priorityLabel, 'Critical');
  assert.equal(byId.s.priorityLabel, 'High');
  assert.equal(byId.m.priorityLabel, 'Medium');
  assert.equal(byId.n.priorityLabel, 'Low');
  assert.equal(byId.c.impact, 'critical');
  assert.deepEqual(parsed.summary.distribution, { critical: 1, high: 1, medium: 1, low: 1 });
});

test('portal-export: null impact is omitted from distribution but coerced to Low in the row', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 2,
    findings: [
      finding({ id: 'known', impact: 'minor', wcagCriteria: ['1.4.3'] }),
      finding({ id: 'unknown', impact: null, wcagCriteria: ['4.1.2'] }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const byId = Object.fromEntries(parsed.rawFindings.map((/** @type {any} */ r) => [r.ruleId, r]));
  // Row stays within the portal's required enum.
  assert.equal(byId.unknown.impact, 'minor');
  assert.equal(byId.unknown.priorityLabel, 'Low');
  // Distribution: only the genuinely-minor one is bucketed; null is not.
  assert.deepEqual(parsed.summary.distribution, { critical: 0, high: 0, medium: 0, low: 1 });
  // Both are compliance-affecting, so totalIssues exceeds the distribution sum.
  assert.equal(parsed.summary.totalIssues, 2);
});

// SECTION: averageScore

test('portal-export: averageScore = passed/(passed+failed), rounded', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    wcagEmSummary: {
      criteriaOutcomes: [{ outcome: 'passed' }, { outcome: 'passed' }, { outcome: 'failed' }],
    },
  });
  const { parsed } = await emitParsed(summary, ctx);
  assert.equal(parsed.summary.averageScore, 67); // round(2/3 * 100)
  assert.equal(parsed.summary.scoreSource, 'wcag-em-criterion-outcomes');
});

test('portal-export: averageScore key is omitted when no criteria are adjudicated', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    wcagEmSummary: {
      criteriaOutcomes: [
        { outcome: 'cantTell' },
        { outcome: 'notTested' },
        { outcome: 'inapplicable' },
      ],
    },
  });
  const { parsed } = await emitParsed(summary, ctx);
  assert.ok(!('averageScore' in parsed.summary), 'averageScore omitted, not null');
  assert.equal(parsed.summary.scoreSource, 'wcag-em-criterion-outcomes');
});

// SECTION: Instances + evidence

test('portal-export: instances per-page; top-level selector aligns with the evidence node', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({
        id: 'image-alt',
        impact: 'critical',
        wcagCriteria: ['1.1.1'],
        occurrences: 7,
        pages: ['https://example.com/', 'https://example.com/about', 'https://example.com/contact'],
        targets: ['img.logo', 'img.banner'],
        examples: [
          {
            pageUrl: 'https://example.com/about',
            target: 'img.banner',
            html: '<img class="banner">',
          },
        ],
      }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const row = parsed.rawFindings[0];
  // Selector describes the evidence node (examples[0].target), NOT the sorted
  // targets[0] ('img.logo') — so selector and evidence point at the same node.
  assert.equal(row.selector, 'img.banner');
  assert.equal(row.selector, row.evidence.target, 'selector aligns with evidence node');
  assert.equal(row.evidence.html, '<img class="banner">');
  assert.equal(row.evidence.pageUrl, 'https://example.com/about');
  // No resultsDir -> per-page fallback; occurrenceCount mirrors instances.length
  // (the summary's occurrences:7 is overridden).
  assert.equal(row.instances.length, 3);
  assert.equal(row.occurrenceCount, 3);
  assert.equal(row.occurrenceCount, row.instances.length);
  assert.deepEqual(
    row.instances.map((/** @type {any} */ i) => i.url),
    ['https://example.com/', 'https://example.com/about', 'https://example.com/contact'],
    'instances sorted by url',
  );
  // page with an example -> html evidence present
  assert.equal(row.instances[1].evidence.html, '<img class="banner">');
  // page with no example -> no evidence, representative selector
  assert.equal(row.instances[0].evidence, undefined);
  assert.equal(row.instances[0].selector, 'img.banner');
});

test('portal-export: first example per URL wins for instance evidence (deterministic)', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({
        id: 'link-name',
        impact: 'serious',
        pages: ['https://example.com/'],
        targets: ['a.first', 'a.second'],
        examples: [
          { pageUrl: 'https://example.com/', target: 'a.first', html: '<a class="first">' },
          { pageUrl: 'https://example.com/', target: 'a.second', html: '<a class="second">' },
        ],
      }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const row = parsed.rawFindings[0];
  // examples[0] drives both the top-level evidence and the single instance.
  assert.equal(row.evidence.html, '<a class="first">');
  assert.equal(row.selector, 'a.first');
  assert.equal(row.instances.length, 1, 'same-URL examples collapse to one instance');
  assert.equal(row.instances[0].evidence.html, '<a class="first">', 'first example wins');
});

test('portal-export: per-element instances from axe-results.json; occ === instances.length', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-'));
  const resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-res-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  t.after(() => fs.rm(resultsDir, { recursive: true, force: true }));
  // Same rule on 2 distinct elements, each seen on 2 viewports (4 raw nodes -> 2 distinct).
  const axeResults = [
    {
      url: 'https://example.com/',
      viewport: 'desktop',
      violations: [
        {
          id: 'link-name',
          nodes: [
            { target: ['a.two'], html: '<a class="two">' },
            { target: ['a.one'], html: '<a class="one">' },
          ],
        },
      ],
    },
    {
      url: 'https://example.com/',
      viewport: 'reflow',
      violations: [
        {
          id: 'link-name',
          nodes: [
            { target: ['a.one'], html: '<a class="one">' },
            { target: ['a.two'], html: '<a class="two">' },
          ],
        },
      ],
    },
  ];
  await fs.writeFile(path.join(resultsDir, 'axe-results.json'), JSON.stringify(axeResults), 'utf8');
  const ctx = { paths: { reportsDir, resultsDir }, config: { rootUrl: 'https://example.com/' } };
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({
        id: 'link-name',
        impact: 'serious',
        occurrences: 99, // summary value is overridden by instances.length
        pages: ['https://example.com/'],
        targets: ['a.zzz'],
        examples: [],
      }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const row = parsed.rawFindings[0];
  // 4 raw nodes across 2 viewports -> 2 distinct (url, selector), sorted by selector.
  assert.equal(row.instances.length, 2, 'deduped across viewports');
  assert.equal(
    row.occurrenceCount,
    2,
    'occurrenceCount === instances.length (not summary.occurrences)',
  );
  assert.deepEqual(
    row.instances.map((/** @type {any} */ i) => i.selector),
    ['a.one', 'a.two'],
  );
  assert.equal(row.instances[0].evidence.html, '<a class="one">');
  assert.equal(row.instances[1].evidence.html, '<a class="two">');
});

// SECTION: Needs-review (incomplete) findings

test('portal-export: incompleteFindings become manual-review rows; reportedTotal includes them', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [finding({ id: 'image-alt', impact: 'serious', wcagCriteria: ['1.1.1'] })],
    incompleteFindings: [
      {
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must meet minimum color contrast ratio thresholds',
        helpUrl: 'https://example.org/cc',
        tags: ['cat.color', 'wcag2aa', 'wcag143'],
        classification: 'needs-review',
        actRuleIds: [],
        wcagCriteria: ['1.4.3'],
        pages: ['https://example.com/', 'https://example.com/about'],
        pageCount: 2,
        firstTarget: '.low-contrast',
      },
      {
        id: 'aria-valid-attr-value',
        impact: 'critical',
        help: 'ARIA attributes must conform to valid values',
        helpUrl: 'https://example.org/aria',
        tags: ['cat.aria', 'wcag2a', 'wcag412'],
        classification: 'needs-review',
        actRuleIds: [],
        wcagCriteria: ['4.1.2'],
        pages: ['https://example.com/'],
        pageCount: 1,
        firstTarget: '[aria-current]',
      },
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  // 1 violation + 2 needs-review = 3 reported; compliance count unaffected.
  assert.equal(parsed.summary.totalIssues, 1, 'needs-review do NOT count toward compliance');
  assert.equal(parsed.summary.reportedTotal, 3, 'reportedTotal includes needs-review rows');
  assert.deepEqual(parsed.summary.distribution, { critical: 0, high: 1, medium: 0, low: 0 });

  const byId = Object.fromEntries(parsed.rawFindings.map((/** @type {any} */ r) => [r.ruleId, r]));
  const cc = byId['color-contrast'];
  assert.equal(cc.findingKind, 'manual-review');
  assert.equal(cc.confidence, 'manual-review');
  assert.equal(cc.countsTowardCompliance, false);
  assert.equal(cc.selector, '.low-contrast', 'selector from firstTarget');
  assert.deepEqual(cc.wcag, ['1.4.3']);
  assert.equal(cc.occurrenceCount, 2, 'occurrenceCount === instances.length (pages)');
  assert.deepEqual(
    cc.instances.map((/** @type {any} */ i) => i.url),
    ['https://example.com/', 'https://example.com/about'],
  );
  assert.equal(cc.instances[0].selector, '.low-contrast');
  assert.equal(cc.taxonomy.category, 'color');
  // a critical-impact needs-review item surfaces as a Critical manual-review card
  assert.equal(byId['aria-valid-attr-value'].priorityLabel, 'Critical');
  assert.equal(byId['aria-valid-attr-value'].countsTowardCompliance, false);
});

// SECTION: Field fallbacks + taxonomy

test('portal-export: message falls back to ruleId when help is null', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [finding({ id: 'no-help-rule', help: null })],
  });
  const { parsed } = await emitParsed(summary, ctx);
  assert.equal(parsed.rawFindings[0].message, 'no-help-rule');
  assert.equal(parsed.rawFindings[0].description, null);
});

test('portal-export: category strips cat. prefix (skipping wcag tags); wcag:[] preserved', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = baseSummary({
    groupedFindingCount: 3,
    findings: [
      finding({
        id: 'with-cat',
        tags: ['wcag2a', 'cat.name-role-value', 'wcag412'],
        wcagCriteria: ['4.1.2'],
        actRuleIds: ['abc123'],
      }),
      finding({ id: 'no-cat', impact: 'minor', tags: ['wcag2a', 'wcag111'] }),
      finding({
        id: 'bp-empty-wcag',
        impact: 'moderate',
        classification: 'best-practice-or-manual-review',
        tags: ['cat.semantics', 'best-practice'],
        wcagCriteria: [],
      }),
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const byId = Object.fromEntries(parsed.rawFindings.map((/** @type {any} */ r) => [r.ruleId, r]));
  assert.equal(byId['with-cat'].taxonomy.category, 'name-role-value');
  assert.deepEqual(byId['with-cat'].taxonomy.actRuleIds, ['abc123']);
  assert.deepEqual(byId['with-cat'].taxonomy.wcagTechniques, []);
  assert.equal(byId['no-cat'].taxonomy.category, null);
  assert.deepEqual(byId['bp-empty-wcag'].wcag, [], 'best-practice with no SC -> valid empty array');
});

// SECTION: Fail-loud + determinism + registry

test('portal-export: emit throws when rootUrl is missing or not http(s)', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  await assert.rejects(
    () => portalReporter.emit(baseSummary(), { paths: { reportsDir }, config: {} }),
    /rootUrl/,
  );
  await assert.rejects(
    () =>
      portalReporter.emit(baseSummary(), { paths: { reportsDir }, config: { rootUrl: 'ftp://x' } }),
    /rootUrl/,
  );
  await assert.rejects(
    () => portalReporter.emit(baseSummary(), { paths: { reportsDir } }),
    /rootUrl/,
  );
  // Nothing should have been written on the failure path.
  await assert.rejects(() => fs.access(path.join(reportsDir, 'portal-export.json')), /ENOENT/);
});

test('portal-export: output is byte-stable and rawFindings follow sortFindings order', async (t) => {
  const findings = [
    finding({ id: 'zebra', impact: 'serious' }),
    finding({ id: 'alpha', impact: 'serious' }),
    finding({ id: 'b', impact: 'critical' }),
  ];
  const { ctx: ctx1 } = await makeCtx(t);
  const { ctx: ctx2 } = await makeCtx(t);
  const { result: r1, parsed } = await emitParsed(
    baseSummary({ groupedFindingCount: 3, findings }),
    ctx1,
  );
  const { result: r2 } = await emitParsed(baseSummary({ groupedFindingCount: 3, findings }), ctx2);
  const [a, b] = await Promise.all([fs.readFile(r1.path, 'utf8'), fs.readFile(r2.path, 'utf8')]);
  assert.equal(a, b, 'two runs of the same input produce byte-identical output');
  assert.deepEqual(
    parsed.rawFindings.map((/** @type {any} */ r) => r.ruleId),
    ['b', 'alpha', 'zebra'],
    'impact desc, then ruleId asc',
  );
});

test('portal-export: registered + dispatched by runReporters', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const { runReporters, listReporters } = await import('../../src/reporters/index.mjs');
  assert.ok(listReporters().includes('portal-export'), 'present in the registry');
  const outcome = await runReporters(['portal-export'], baseSummary(), ctx);
  assert.equal(outcome.errors.length, 0);
  assert.equal(outcome.results[0].name, 'portal-export');
  await fs.access(path.join(reportsDir, 'portal-export.json'));
});

// SECTION: Needs-review evidence flow (the root fix)

test('portal-export: needs-review evidence flows from incompleteDetail examples', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-'));
  const resultsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-res-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  t.after(() => fs.rm(resultsDir, { recursive: true, force: true }));
  // axe-results.json with an INCOMPLETE rule carrying per-node examples (scan-stage fix).
  const axeResults = [
    {
      url: 'https://example.com/',
      viewport: 'desktop',
      violations: [],
      incompleteDetail: [
        {
          id: 'color-contrast',
          impact: 'serious',
          nodesCount: 2,
          firstTarget: '.low',
          examples: [
            { target: '.low', html: '<span class="low">a</span>' },
            { target: '.dim', html: '<span class="dim">b</span>' },
          ],
        },
      ],
    },
  ];
  await fs.writeFile(path.join(resultsDir, 'axe-results.json'), JSON.stringify(axeResults), 'utf8');
  const ctx = { paths: { reportsDir, resultsDir }, config: { rootUrl: 'https://example.com/' } };
  const summary = baseSummary({
    groupedFindingCount: 0,
    findings: [],
    incompleteFindings: [
      {
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must meet minimum color contrast ratio thresholds',
        classification: 'needs-review',
        actRuleIds: [],
        wcagCriteria: ['1.4.3'],
        tags: ['cat.color', 'wcag2aa', 'wcag143'],
        occurrences: 2,
        pages: ['https://example.com/'],
        pageCount: 1,
        targets: ['.dim', '.low'],
        firstTarget: '.low',
        examples: [
          { pageUrl: 'https://example.com/', target: '.low', html: '<span class="low">a</span>' },
        ],
      },
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const cc = parsed.rawFindings.find((/** @type {any} */ r) => r.ruleId === 'color-contrast');
  // High-severity needs-review now carries evidence.html (top-level + every instance).
  assert.equal(cc.findingKind, 'manual-review');
  assert.equal(cc.countsTowardCompliance, false);
  assert.ok(
    typeof cc.evidence.html === 'string' && cc.evidence.html.length > 0,
    'top-level evidence.html present',
  );
  assert.equal(cc.instances.length, 2, 'per-element instances from incompleteDetail examples');
  assert.equal(cc.occurrenceCount, cc.instances.length);
  assert.ok(
    cc.instances.every(
      (/** @type {any} */ i) => typeof i.evidence.html === 'string' && i.evidence.html.length > 0,
    ),
    'every instance carries an htmlSnippet',
  );
});

// SECTION: Report-time self-validation (C1 guard)

test('portal-export: warns when a critical/high finding lacks HTML evidence (stale-data guard)', async (t) => {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-portal-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  /** @type {any[]} */
  const warnings = [];
  const ctx = {
    paths: { reportsDir },
    config: { rootUrl: 'https://example.com/' },
    logger: {
      warn: (/** @type {any} */ obj, /** @type {any} */ msg) => warnings.push({ obj, msg }),
    },
  };
  // Critical needs-review with NO examples (pre-fix axe-results shape) + no resultsDir.
  const summary = baseSummary({
    incompleteFindings: [
      {
        id: 'aria-valid-attr-value',
        impact: 'critical',
        help: 'ARIA attributes must conform to valid values',
        classification: 'needs-review',
        actRuleIds: [],
        wcagCriteria: ['4.1.2'],
        tags: ['cat.aria'],
        occurrences: 1,
        pages: ['https://example.com/'],
        pageCount: 1,
        firstTarget: '[aria-current]',
      },
    ],
  });
  const { parsed } = await emitParsed(summary, ctx);
  const f = parsed.rawFindings.find((/** @type {any} */ r) => r.ruleId === 'aria-valid-attr-value');
  assert.equal(f.evidence?.html ?? null, null, 'no html evidence available from stale data');
  // Two guards fire on this payload since the validateExports gate landed:
  // the evidence guard (asserted here) and the vendored-contract warning.
  const evidenceWarnings = warnings.filter(({ obj }) => Array.isArray(obj?.findings));
  assert.equal(evidenceWarnings.length, 1, 'self-validation warned at report time');
  assert.ok(evidenceWarnings[0].obj.findings.includes('aria-valid-attr-value'));
});

test('portal-export: does NOT warn when critical/high findings carry evidence', async (t) => {
  const { ctx } = await makeCtx(t);
  /** @type {any[]} */
  const warnings = [];
  ctx.logger = { warn: (/** @type {any} */ o, /** @type {any} */ m) => warnings.push({ o, m }) };
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({
        id: 'image-alt',
        impact: 'critical',
        pages: ['https://example.com/'],
        targets: ['img.x'],
        examples: [{ pageUrl: 'https://example.com/', target: 'img.x', html: '<img class="x">' }],
      }),
    ],
  });
  await emitParsed(summary, ctx);
  assert.equal(warnings.length, 0, 'no warning when evidence is present');
});

test('portal-export: pageViewsScanned + executionHealth ride scanOptions only when present', async (t) => {
  const { ctx } = await makeCtx(t);
  // Absent on the summary -> absent from the envelope (historical shape).
  const { parsed: bare } = await emitParsed(baseSummary(), ctx);
  assert.ok(!('pageViewsScanned' in bare.scanMetadata.scanOptions));
  assert.ok(!('executionHealth' in bare.scanMetadata.scanOptions));

  // Present on the summary -> forwarded verbatim.
  const health = {
    sampleListedCount: 18,
    pagesInSample: 18,
    pagesFullyScanned: 17,
    pagesDegraded: [],
    pagesFailed: [
      { url: 'https://example.com/slow', failures: [{ viewport: 'desktop', error: 'timeout' }] },
    ],
    pageViewsScanned: 35,
    pageViewsFailed: 1,
    processFailures: [],
    preScanFailures: [],
    maxPagesConfigured: 80,
    reachedMaxPages: false,
  };
  const { parsed } = await emitParsed(
    baseSummary({ samplePagesScanned: 17, pageViewsScanned: 35, executionHealth: health }),
    ctx,
  );
  assert.equal(parsed.scanMetadata.scanOptions.pagesScanned, 17);
  assert.equal(parsed.scanMetadata.scanOptions.pageViewsScanned, 35);
  assert.deepEqual(parsed.scanMetadata.scanOptions.executionHealth, health);
});

test('portal-export: scoreBasis ships with averageScore and folds untested into notTested', async (t) => {
  const { ctx } = await makeCtx(t);
  const { parsed } = await emitParsed(
    baseSummary({
      wcagEmSummary: {
        criteriaOutcomes: [
          { sc: '1.1.1', outcome: 'passed' },
          { sc: '1.4.3', outcome: 'failed' },
          { sc: '2.4.1', outcome: 'cantTell' },
          { sc: '1.2.1', outcome: 'inapplicable' },
          { sc: '3.1.2', outcome: 'notTested' },
          { sc: '9.9.9', outcome: 'untested' },
        ],
      },
    }),
    ctx,
  );
  assert.equal(parsed.summary.averageScore, 50, 'one passed of two adjudicated');
  assert.deepEqual(parsed.summary.scoreBasis, {
    passed: 1,
    failed: 1,
    cantTell: 1,
    inapplicable: 1,
    notTested: 2,
  });
});

test('portal-export: manualReviewIssues counts non-compliance rows; scoreBasis omitted without outcomes', async (t) => {
  const { ctx } = await makeCtx(t);
  const { parsed } = await emitParsed(
    baseSummary({
      groupedFindingCount: 1,
      findings: [
        finding({ id: 'image-alt', impact: 'critical', pages: ['https://example.com/'] }),
        finding({
          id: 'region',
          impact: 'moderate',
          classification: 'best-practice-or-manual-review',
          pages: ['https://example.com/'],
        }),
      ],
      incompleteFindings: [
        {
          id: 'video-caption',
          impact: 'critical',
          help: 'Check captions',
          helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/video-caption',
          tags: [],
          classification: 'needs-review',
          actRuleIds: [],
          wcagCriteria: ['1.2.2'],
          occurrences: 1,
          pages: ['https://example.com/'],
          pageCount: 1,
          targets: [],
          examples: [],
        },
      ],
    }),
    ctx,
  );
  // best-practice + needs-review rows are countsTowardCompliance: false.
  assert.equal(parsed.summary.manualReviewIssues, 2);
  assert.ok(!('scoreBasis' in parsed.summary), 'no outcomes -> no basis');
});

test('portal-export: failureSummary flows from finding examples into evidence and is trimmed', async (t) => {
  const { ctx } = await makeCtx(t);
  const longSummary = 'Fix any of the following: '.repeat(200); // > 2000 chars
  const { parsed } = await emitParsed(
    baseSummary({
      groupedFindingCount: 1,
      findings: [
        finding({
          id: 'color-contrast',
          pages: ['https://example.com/'],
          targets: ['p.low'],
          examples: [
            {
              pageUrl: 'https://example.com/',
              target: 'p.low',
              html: '<p class="low">x</p>',
              failureSummary: longSummary,
            },
          ],
        }),
      ],
    }),
    ctx,
  );
  const row = parsed.rawFindings.find((/** @type {any} */ r) => r.ruleId === 'color-contrast');
  assert.equal(typeof row.evidence.failureSummary, 'string');
  assert.equal(row.evidence.failureSummary.length, 2000, 'pre-trimmed to the portal limit');
});

test('portal-export: validateExports=error rejects a contract-breaking payload before writing', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  ctx.config.reporting = { validateExports: 'error' };
  // critical finding with NO evidence.html anywhere -> vendored schema rejects.
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({ id: 'image-alt', impact: 'critical', pages: ['https://example.com/'], examples: [] }),
    ],
  });
  await assert.rejects(
    () => portalReporter.emit(summary, ctx),
    /fails the vendored contract/,
    'error mode must throw',
  );
  await assert.rejects(
    () => fs.access(path.join(reportsDir, 'portal-export.json')),
    'no file may be written in error mode',
  );
});

test('portal-export: validateExports=warn logs and still writes (default behaviour)', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  /** @type {any[]} */
  const warnings = [];
  ctx.logger = { warn: (/** @type {any} */ o, /** @type {any} */ m) => warnings.push({ o, m }) };
  const summary = baseSummary({
    groupedFindingCount: 1,
    findings: [
      finding({ id: 'image-alt', impact: 'critical', pages: ['https://example.com/'], examples: [] }),
    ],
  });
  await portalReporter.emit(summary, ctx);
  await fs.access(path.join(reportsDir, 'portal-export.json'));
  assert.ok(
    warnings.some(({ m }) => String(m).includes('vendored contract')),
    'warn mode surfaces the violation',
  );
});
