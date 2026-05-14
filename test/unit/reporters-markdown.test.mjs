// @ts-check
/**
 * @file Tests for the markdown reporter.
 * @module test/unit/reporters-markdown
 *
 * @description
 * Locks the markdown reporter's output shape after the extraction from
 * `summarize.mjs`'s inline ANCHOR block. The golden body is the WCAG-EM summary
 * `abd7339` markdown shape with one deliberate change: findings are now
 * routed through `sortFindings` so cross-reporter ordering is consistent
 * (see ADR-0008's sort contract).
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as markdownReporter from '../../src/reporters/markdown.mjs';
import { TOOL_IDENTITY } from '../../src/lib/version.mjs';

// SECTION: Helpers

/**
 * Build a minimal ctx-shape with a tmp reportsDir for one test run.
 * Registers cleanup with the test context's `after` so any failure mid-test
 * still tidies up.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @returns {Promise<{ ctx: any, reportsDir: string }>}
 */
async function makeCtx(t) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-md-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  return { ctx: { paths: { reportsDir } }, reportsDir };
}

// SECTION: Tests

test('markdown reporter: emits expected layout for a golden summary', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    tool: TOOL_IDENTITY,
    site: 'fixture-site',
    generatedAt: '2026-04-29T12:00:00.000Z',
    inventoryCount: 5,
    finalSampleCount: 3,
    samplePagesScanned: 3,
    processRuns: 0,
    groupedFindingCount: 2,
    comparison: {
      randomSampleIntroducedNewRuleIds: [],
      randomSampleIntroducedNewClusters: [],
      expandStructuredSampleRecommended: false,
    },
    findings: [
      {
        id: 'image-alt',
        impact: 'critical',
        classification: 'primary-automated-finding',
        pageCount: 2,
        pageTypes: ['homepage'],
        help: 'Images must have alternate text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        targets: ['img'],
      },
      {
        id: 'label',
        impact: 'critical',
        classification: 'primary-automated-finding',
        pageCount: 1,
        pageTypes: [],
        help: 'Form elements must have labels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/label',
        targets: ['input[name="email"]'],
      },
    ],
  };

  await markdownReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.md'), 'utf8');

  // Header line is the markdown bold tool stamp from toolIdentityMarkdownHeader().
  assert.match(got, /^\*\*Tool:\*\* /);
  assert.match(got, new RegExp(`\\*\\*Tool:\\*\\* ${TOOL_IDENTITY.name} ${TOOL_IDENTITY.version}`));
  // Top-level heading.
  assert.match(got, /^# Accessibility scan summary$/m);
  // Site + Generated lines.
  assert.match(got, /Site: \*\*fixture-site\*\*/);
  assert.match(got, /Generated: 2026-04-29T12:00:00\.000Z/);
  // Method guardrails preserved.
  assert.match(got, /## Method guardrails/);
  assert.match(got, /This is the automated layer of the audit workflow\./);
  // Run summary numbers reflect the input.
  assert.match(got, /- Inventory count: 5/);
  assert.match(got, /- Final selected sample: 3/);
  assert.match(got, /- Grouped findings: 2/);
  // Findings appear in [impact desc, ruleId asc] order — same impact, so
  // ruleId 'image-alt' comes before 'label' (i < l).
  const imgIdx = got.indexOf('### image-alt');
  const lblIdx = got.indexOf('### label');
  assert.ok(imgIdx > 0 && lblIdx > imgIdx, 'image-alt must precede label (ruleId asc)');
});

test('markdown reporter: empty findings array still produces the heading scaffold', async (t) => {
  const { ctx, reportsDir } = await makeCtx(t);
  const summary = {
    tool: TOOL_IDENTITY,
    site: 'empty-site',
    generatedAt: '2026-04-29T00:00:00.000Z',
    inventoryCount: 0,
    finalSampleCount: 0,
    samplePagesScanned: 0,
    processRuns: 0,
    groupedFindingCount: 0,
    comparison: {
      randomSampleIntroducedNewRuleIds: [],
      randomSampleIntroducedNewClusters: [],
      expandStructuredSampleRecommended: false,
    },
    findings: [],
  };
  await markdownReporter.emit(summary, ctx);
  const got = await fs.readFile(path.join(reportsDir, 'summary.md'), 'utf8');
  assert.match(got, /## Grouped findings by rule/);
  // No '### ' lines (no rule sections rendered).
  assert.equal((got.match(/^### /gm) ?? []).length, 0);
});

test('markdown reporter: returned bytes match on-disk file size', async (t) => {
  const { ctx } = await makeCtx(t);
  const summary = {
    tool: TOOL_IDENTITY,
    site: 'sized',
    generatedAt: '2026-04-29T00:00:00.000Z',
    inventoryCount: 0,
    finalSampleCount: 0,
    samplePagesScanned: 0,
    processRuns: 0,
    groupedFindingCount: 0,
    comparison: {
      randomSampleIntroducedNewRuleIds: [],
      randomSampleIntroducedNewClusters: [],
      expandStructuredSampleRecommended: false,
    },
    findings: [],
  };
  const result = await markdownReporter.emit(summary, ctx);
  const stat = await fs.stat(result.path);
  assert.equal(result.bytes, stat.size);
  assert.ok(result.path.endsWith('summary.md'));
});

test('markdown reporter: registry now lists json + markdown', async () => {
  const { listReporters } = await import('../../src/reporters/index.mjs');
  const names = listReporters();
  assert.ok(names.includes('json'), 'json still registered');
  assert.ok(names.includes('markdown'), 'markdown registered in the registry');
  assert.deepEqual(names, [...names].sort(), 'list remains sorted');
});
