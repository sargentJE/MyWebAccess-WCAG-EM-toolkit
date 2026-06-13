// @ts-check
/**
 * @file E1 §5 contract-safety: a could-not-audit page leaks NOWHERE.
 * @module test/unit/page-outcome-contract
 *
 * @description
 * The keystone guarantee. A synthetic `axe-results.json` carries one real page
 * plus one `pageOutcome:'challenge'` page bearing FAKE violations whose rule-id
 * (`color-contrast`) is deliberately ABSENT from `summary.findings`. That way a
 * consumer that re-reads the raw artefact (and forgets the skip) cannot have its
 * leak masked by the summary-derived path — the only way `color-contrast` stays
 * out of portal-export.json / report-builder-draft.json, and the only way the
 * challenge URL stays out of `pagesTested`, is the isAuditableView guard at the
 * raw read sites. Also asserts the SC inversion does not flip a criterion the
 * challenge page alone "found".
 *
 * @see docs/reviews/2026-06-epics-E1-E7.md §5
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as portalReporter from '../../src/reporters/portal-export.mjs';
import * as starter from '../../src/reporters/report-builder-starter.mjs';
import { toWcagEmSummary } from '../../src/lib/wcag-em-summary.mjs';

const REAL_URL = 'https://example.com/real';
const CHALLENGE_URL = 'https://example.com/event/blocked';

/** Raw axe-results.json: one real page + one challenge page with FAKE violations. */
const axeResults = [
  {
    url: REAL_URL,
    viewport: 'desktop',
    title: 'Real page',
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        tags: ['wcag2a', 'wcag111'],
        nodes: [{ target: ['img'], html: '<img>', failureSummary: 'add alt' }],
      },
    ],
    passes: 1,
    incomplete: 0,
    inapplicable: 0,
    passesDetail: [],
    incompleteDetail: [],
    inapplicableDetail: [],
  },
  {
    url: CHALLENGE_URL,
    viewport: 'desktop',
    title: 'Just a moment...',
    pageOutcome: 'challenge',
    degradedReason: 'cf-mitigated response header present',
    // FAKE violations that would poison the portal upload + client draft + SC
    // verdicts if the challenge page were not skipped:
    //   - image-alt SHARES a rule with the real page's summary finding, so an
    //     unguarded portal loadInstanceMap would attach the challenge URL to the
    //     real finding's instances (the H1 leak we must catch).
    //   - color-contrast is NOT on the real page, so an unguarded SC inversion
    //     would flip 1.4.3 to failed off the challenge page alone.
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        tags: ['wcag2a', 'wcag111'],
        nodes: [{ target: ['img.cf'], html: '<img class="cf">', failureSummary: 'fake' }],
      },
      {
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must meet contrast',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
        tags: ['wcag2aa', 'wcag143'],
        nodes: [{ target: ['.cf'], html: '<div class="cf">', failureSummary: 'fake' }],
      },
    ],
    passes: 0,
    incomplete: 0,
    inapplicable: 0,
    passesDetail: [],
    incompleteDetail: [],
    inapplicableDetail: [],
  },
];

/**
 * A post-skip grouped summary: only the real finding survives (no color-contrast).
 *
 * @returns {Record<string, any>}
 */
function summary() {
  return {
    tool: { name: 'wcag-em-a11y-toolkit', version: '1.1.0', axeCore: '4.11.3' },
    site: 'example.com',
    generatedAt: '2026-06-13T12:00:00.000Z',
    inventoryCount: 2,
    finalSampleCount: 2,
    samplePagesScanned: 1,
    processRuns: 0,
    groupedFindingCount: 1,
    findings: [
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alternative text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        tags: ['wcag2a', 'wcag111'],
        classification: 'primary-automated-finding',
        actRuleIds: [],
        wcagCriteria: ['1.1.1'],
        occurrences: 1,
        pages: [REAL_URL],
        pageCount: 1,
        targets: ['img'],
        examples: [{ pageUrl: REAL_URL, target: 'img', html: '<img>', failureSummary: 'add alt' }],
        sourceTypes: ['page-scan'],
        pageTypes: [],
        clusters: [],
      },
    ],
    incompleteFindings: [],
    scanWarnings: [],
    wcagEmSummary: { wcagVersion: '2.2', conformanceTarget: 'AA', criteriaOutcomes: [] },
  };
}

/**
 * Build a tmp out-dir whose resultsDir holds the synthetic raw artefact.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @returns {Promise<{ tmp: string, reportsDir: string, resultsDir: string }>}
 */
async function makeOutDir(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'page-outcome-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  const resultsDir = path.join(tmp, 'results');
  await fs.mkdir(reportsDir, { recursive: true });
  await fs.mkdir(resultsDir, { recursive: true });
  await fs.writeFile(path.join(resultsDir, 'axe-results.json'), JSON.stringify(axeResults));
  await fs.writeFile(path.join(resultsDir, 'process-results.json'), JSON.stringify([]));
  return { tmp, reportsDir, resultsDir };
}

test('§5: portal-export ingests ZERO challenge findings/instances from the raw artefact', async (t) => {
  const { tmp, reportsDir, resultsDir } = await makeOutDir(t);
  const ctx = {
    paths: { reportsDir, resultsDir, outDir: tmp },
    config: { rootUrl: 'https://example.com/' },
  };
  await portalReporter.emit(summary(), ctx);
  const out = JSON.parse(await fs.readFile(path.join(reportsDir, 'portal-export.json'), 'utf8'));
  const serialized = JSON.stringify(out);
  assert.ok(!serialized.includes('color-contrast'), 'fake challenge rule must not appear anywhere');
  assert.ok(!serialized.includes(CHALLENGE_URL), 'challenge URL must not appear in any instance');
  const ruleIds = (out.rawFindings ?? []).map((/** @type {any} */ f) => f.ruleId);
  assert.deepEqual(ruleIds, ['image-alt'], 'only the real finding is exported');
});

test('§5: report-builder excludes the challenge URL from pagesTested and findings', async (t) => {
  const { tmp, reportsDir, resultsDir } = await makeOutDir(t);
  const ctx = {
    paths: { reportsDir, resultsDir, outDir: tmp },
    config: { name: 'example', rootUrl: 'https://example.com/' },
  };
  await starter.emit(summary(), ctx);
  const draft = JSON.parse(
    await fs.readFile(path.join(reportsDir, 'report-builder-draft.json'), 'utf8'),
  );
  const serialized = JSON.stringify(draft);
  assert.ok(!serialized.includes('color-contrast'), 'fake challenge rule must not reach the draft');
  const pagesTested = draft?.scope?.pagesTested ?? [];
  assert.ok(
    !pagesTested.includes(CHALLENGE_URL),
    'challenge URL must NOT be counted as a tested page',
  );
  assert.ok(pagesTested.includes(REAL_URL), 'the real page is still tested');
});

test('§5: WCAG-EM inversion does not let a challenge page flip an SC verdict', async () => {
  const wcag = toWcagEmSummary(
    { config: { wcagEm: { conformanceTarget: 'AA' } } },
    { axeResults, processResults: [], sampleMetadata: {} },
  );
  const byScOutcome = new Map(wcag.criteriaOutcomes.map((c) => [c.sc, c.outcome]));
  // The real page's image-alt fails 1.1.1...
  assert.equal(byScOutcome.get('1.1.1'), 'failed', '1.1.1 fails from the real page');
  // ...but the challenge page's fake color-contrast must NOT fail 1.4.3.
  assert.notEqual(
    byScOutcome.get('1.4.3'),
    'failed',
    '1.4.3 must not be failed by a skipped challenge page',
  );
});
