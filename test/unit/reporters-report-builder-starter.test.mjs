// @ts-check
/**
 * @file Unit tests for the report-builder-starter reporter.
 * @module test/unit/reporters-report-builder-starter
 *
 * @description
 * Locks the DraftReportSchema mapping decisions: site-derived finding-ID
 * prefix, severity/tier maps, incompletes-as-flagged-drafts (excluded from
 * recommendations), consumer-enum filtering of criteriaOutcomes with coverage
 * gaps riding the appendices, and the vendored-contract validation gate. The
 * full-schema conformance check lives in report-builder-schema.test.mjs.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as starter from '../../src/reporters/report-builder-starter.mjs';
import { deriveIdPrefix } from '../../src/reporters/report-builder-starter.mjs';

// SECTION: Helpers

/**
 * @param {import('node:test').TestContext} t
 * @returns {Promise<{ ctx: any, reportsDir: string }>}
 */
async function makeCtx(t) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rb-starter-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });
  return {
    ctx: {
      paths: { reportsDir, outDir: tmp },
      config: { name: 'legacy-events', rootUrl: 'https://example.com/' },
    },
    reportsDir,
  };
}

/**
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function baseSummary(overrides = {}) {
  return {
    tool: { name: 'wcag-em-a11y-toolkit', version: '1.1.0', axeCore: '4.11.3' },
    site: 'legacy-events',
    generatedAt: '2026-06-10T12:00:00.000Z',
    samplePagesScanned: 4,
    processRuns: 0,
    findings: [],
    incompleteFindings: [],
    scanWarnings: [],
    wcagEmSummary: {
      wcagVersion: '2.2',
      conformanceTarget: 'AA',
      samplingMethodNotes: 'Structured sample of 3 page(s) plus 1 random page(s), per WCAG-EM Step 3.',
      technologiesReliedUpon: ['HTML', 'CSS'],
      evaluator: { name: 'Jamie Sargent', contact: 'jamie@example.com' },
      criteriaOutcomes: [],
    },
    ...overrides,
  };
}

/** @returns {Record<string, any>} */
function violationFinding() {
  return {
    id: 'image-alt',
    impact: 'critical',
    help: 'Images must have alternative text',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
    tags: ['cat.text-alternatives', 'wcag2a', 'wcag111'],
    classification: 'primary-automated-finding',
    actRuleIds: ['23a2a8'],
    wcagCriteria: ['1.1.1'],
    occurrences: 2,
    pages: ['https://example.com/'],
    pageCount: 1,
    targets: ['img.hero'],
    examples: [
      {
        pageUrl: 'https://example.com/',
        target: 'img.hero',
        html: '<img class="hero" src="x.jpg">',
        failureSummary: 'Fix any of the following: Element does not have an alt attribute',
      },
    ],
    pageTypes: ['homepage'],
    clusters: [],
    sourceTypes: ['page-scan'],
  };
}

/** @returns {Record<string, any>} */
function incompleteFinding() {
  return {
    id: 'video-caption',
    impact: 'critical',
    help: 'Video elements must have captions',
    helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/video-caption',
    tags: ['cat.time-and-media', 'wcag2a', 'wcag122'],
    classification: 'needs-review',
    actRuleIds: [],
    wcagCriteria: ['1.2.2'],
    occurrences: 1,
    pages: ['https://example.com/'],
    pageCount: 1,
    targets: ['video'],
    examples: [{ pageUrl: 'https://example.com/', target: 'video', html: '<video src="v.mp4">' }],
    firstTarget: 'video',
  };
}

/**
 * @param {Record<string, any>} summary
 * @param {any} ctx
 * @returns {Promise<any>}
 */
async function emitParsed(summary, ctx) {
  const result = await starter.emit(summary, ctx);
  return JSON.parse(await fs.readFile(result.path, 'utf8'));
}

// SECTION: ID prefix derivation

test('deriveIdPrefix: site-name initials, A-Z only, capped at 4, RB fallback', () => {
  assert.equal(deriveIdPrefix('legacy-events'), 'LE');
  assert.equal(deriveIdPrefix('au-demo-uw'), 'ADU');
  assert.equal(deriveIdPrefix('myvision-org-uk'), 'MOU');
  assert.equal(deriveIdPrefix('one two three four five'), 'OTTF');
  assert.equal(deriveIdPrefix('123-456'), 'RB');
  assert.equal(deriveIdPrefix(undefined), 'RB');
});

// SECTION: Draft shape

test('starter: violations and incompletes both become draft findings; IDs sequential with site prefix', async (t) => {
  const { ctx } = await makeCtx(t);
  const draft = await emitParsed(
    baseSummary({ findings: [violationFinding()], incompleteFindings: [incompleteFinding()] }),
    ctx,
  );
  assert.equal(draft.findings.length, 2);
  assert.deepEqual(
    draft.findings.map((/** @type {any} */ f) => f.id),
    ['LE-001', 'LE-002'],
  );
  const [v, inc] = draft.findings;
  assert.equal(v.severity, 'Critical');
  assert.equal(v.priorityTier, 'Tier 1');
  assert.equal(v.status, 'Not retested');
  assert.equal(v.draftStatus, 'generated');
  assert.equal(v.includeInReport, true);
  assert.equal(v.needsManualReview, true);
  assert.equal(v.sourceRuleId, 'image-alt');
  assert.equal(v.axeImpact, 'critical');
  assert.deepEqual(v.wcag, [{ criterion: '1.1.1', name: 'Non-text Content', level: 'A' }]);
  // The incomplete is flagged as needs-review provenance.
  assert.match(inc.reviewNotes, /needs-review \(incomplete\)/);
  assert.match(inc.userImpact, /could not decide/i);
});

test('starter: evidence carries axe content (with failureSummary) and code markup; content|path|observed rule holds', async (t) => {
  const { ctx } = await makeCtx(t);
  const draft = await emitParsed(baseSummary({ findings: [violationFinding()] }), ctx);
  const evidence = draft.findings[0].evidence;
  const axe = evidence.find((/** @type {any} */ e) => e.type === 'axe');
  const code = evidence.find((/** @type {any} */ e) => e.type === 'code');
  assert.ok(axe.content.includes('2 occurrence(s)'));
  assert.ok(axe.content.includes('Element does not have an alt attribute'));
  assert.equal(code.language, 'html');
  assert.equal(code.content, '<img class="hero" src="x.jpg">');
  for (const e of evidence) {
    assert.ok(e.content || e.path || e.observed, `evidence "${e.label}" satisfies content|path|observed`);
    if (e.type === 'screenshot') assert.ok(e.alt, 'screenshot evidence carries alt');
  }
});

test('starter: recommendations come from confirmed violations only — never from needs-review drafts', async (t) => {
  const { ctx } = await makeCtx(t);
  const draft = await emitParsed(
    baseSummary({ findings: [violationFinding()], incompleteFindings: [incompleteFinding()] }),
    ctx,
  );
  const allItems = draft.recommendations.flatMap((/** @type {any} */ r) => r.items);
  assert.ok(allItems.some((/** @type {any} */ i) => i.findingId === 'LE-001'));
  assert.ok(
    !allItems.some((/** @type {any} */ i) => i.findingId === 'LE-002'),
    'needs-review draft LE-002 must not drive a recommendation',
  );
});

test('starter: criteriaOutcomes filtered to the consumer enum; coverage gaps ride the appendices', async (t) => {
  const { ctx } = await makeCtx(t);
  const draft = await emitParsed(
    baseSummary({
      findings: [violationFinding()],
      wcagEmSummary: {
        ...baseSummary().wcagEmSummary,
        criteriaOutcomes: [
          { sc: '1.1.1', level: 'A', outcome: 'failed', pagesExamined: 1 },
          { sc: '1.4.3', level: 'AA', outcome: 'passed', pagesExamined: 4 },
          { sc: '2.4.7', level: 'AA', outcome: 'notTested', pagesExamined: 0 },
          { sc: '3.1.2', level: 'AA', outcome: 'untested', pagesExamined: 0 },
        ],
      },
    }),
    ctx,
  );
  assert.deepEqual(
    draft.criteriaOutcomes.map((/** @type {any} */ c) => c.outcome).sort(),
    ['failed', 'passed'],
    'only consumer-enum outcomes emitted',
  );
  const failed = draft.criteriaOutcomes.find((/** @type {any} */ c) => c.criterion === '1.1.1');
  assert.deepEqual(failed.relatedFindingIds, ['LE-001'], 'findings linked by SC');
  const coverage = draft.appendices.find(
    (/** @type {any} */ a) => a.title === 'Automated coverage limits',
  );
  assert.ok(coverage.content.includes('2.4.7 Focus Visible'));
  assert.ok(coverage.content.includes('3.1.2 Language of Parts'));
});

test('starter: rules without WCAG criteria synthesize the consumer best-practice reference', async (t) => {
  const { ctx } = await makeCtx(t);
  const bp = { ...violationFinding(), id: 'region', impact: 'moderate', wcagCriteria: [] };
  const draft = await emitParsed(baseSummary({ findings: [bp] }), ctx);
  assert.deepEqual(draft.findings[0].wcag, [
    { criterion: 'Best practice', name: 'Manual review required', level: 'Best practice' },
  ]);
});

test('starter: validateExports=error rejects a contract-breaking draft before writing', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  ctx.config.reporting = { validateExports: 'error' };
  // A finding whose rule id is empty produces title: '' — the contract's
  // NonEmptyString min(1) is representable in the generated JSON Schema, so
  // the gate must catch it before any file is written.
  const broken = { ...violationFinding(), id: '', help: null };
  await assert.rejects(
    () => starter.emit(/** @type {any} */ (baseSummary({ findings: [broken] })), ctx),
    /fails the vendored contract/,
  );
  await assert.rejects(() => fs.access(path.join(reportsDir, 'report-builder-draft.json')));
});
