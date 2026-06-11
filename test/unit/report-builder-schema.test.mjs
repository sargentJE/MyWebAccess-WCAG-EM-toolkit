// @ts-check
/**
 * @file Validates report-builder-starter output against the vendored contract.
 * @module test/unit/report-builder-schema
 *
 * @description
 * The myweb-report-builder DraftReportSchema contract is vendored at
 * `schemas/report-builder-draft.schema.json`, GENERATED from the consumer's
 * own Zod schema (see `_meta.regenerate`). This test mirrors the
 * portal-export-schema gate: a representative emitted draft must conform.
 * JSON Schema cannot express the consumer's cross-field refinements
 * (finding-ID uniqueness, evidence content|path|observed, screenshot alt) —
 * those are asserted structurally in reporters-report-builder-starter.test.mjs
 * and proven end-to-end by the consumer-side Zod parse in the sprint
 * verification.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import * as starter from '../../src/reporters/report-builder-starter.mjs';

const Ajv2020 = /** @type {any} */ (Ajv2020Module).default ?? /** @type {any} */ (Ajv2020Module);
const addFormats =
  /** @type {any} */ (addFormatsModule).default ?? /** @type {any} */ (addFormatsModule);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../schemas/report-builder-draft.schema.json');

// SECTION: Helpers

/** @returns {Promise<any>} compiled validator */
async function compileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  delete schema._meta;
  return ajv.compile(schema);
}

// SECTION: Tests

test('vendored contract carries its provenance metadata', async () => {
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  assert.equal(schema._meta.contractVersion, '1.0');
  assert.match(schema._meta.sourceRepo, /myweb-report-builder/);
  assert.ok(schema._meta.zodVersion, 'generation zod version recorded');
  assert.ok(schema._meta.regenerate, 'regeneration command recorded');
});

test('a representative emitted draft conforms to the vendored DraftReportSchema', async (t) => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'rb-schema-'));
  t.after(() => fs.rm(tmp, { recursive: true, force: true }));
  const reportsDir = path.join(tmp, 'reports');
  await fs.mkdir(reportsDir, { recursive: true });

  const summary = {
    tool: { name: 'wcag-em-a11y-toolkit', version: '1.1.0', axeCore: '4.11.3' },
    site: 'au-demo-uw',
    generatedAt: '2026-06-10T12:00:00.000Z',
    samplePagesScanned: 4,
    processRuns: 1,
    scanWarnings: ['page failed to scan on all viewports: https://example.com/slow (timeout)'],
    findings: [
      {
        id: 'label',
        impact: 'critical',
        help: 'Form elements must have labels',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/label',
        tags: ['cat.forms', 'wcag2a', 'wcag412'],
        classification: 'primary-automated-finding',
        actRuleIds: [],
        wcagCriteria: ['4.1.2'],
        occurrences: 10,
        pages: ['https://example.com/form'],
        pageCount: 1,
        targets: ['input[name=q]'],
        examples: [
          {
            pageUrl: 'https://example.com/form',
            target: 'input[name=q]',
            html: '<input name="q">',
            failureSummary: 'Fix any of the following: Element has no label',
          },
        ],
        pageTypes: ['form-or-contact'],
        clusters: [],
        sourceTypes: ['page-scan'],
      },
    ],
    incompleteFindings: [
      {
        id: 'color-contrast',
        impact: 'serious',
        help: 'Elements must meet contrast ratio thresholds',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/color-contrast',
        tags: ['cat.color', 'wcag2aa', 'wcag143'],
        classification: 'needs-review',
        actRuleIds: [],
        wcagCriteria: ['1.4.3'],
        occurrences: 32,
        pages: ['https://example.com/'],
        pageCount: 1,
        targets: ['p.gradient'],
        examples: [
          {
            pageUrl: 'https://example.com/',
            target: 'p.gradient',
            html: '<p class="gradient">x</p>',
            failureSummary: 'Element has a background image, contrast cannot be determined',
          },
        ],
        firstTarget: 'p.gradient',
      },
    ],
    executionHealth: {
      pagesFailed: [
        { url: 'https://example.com/slow', failures: [{ viewport: 'desktop', error: 'timeout' }] },
      ],
      pagesDegraded: [],
      processFailures: [],
      preScanFailures: [],
      reachedMaxPages: false,
    },
    wcagEmSummary: {
      wcagVersion: '2.2',
      conformanceTarget: 'AA',
      samplingMethodNotes:
        'Structured sample of 3 page(s) plus 1 random page(s) (20% pool, seed 1) from a 22-page crawl inventory, per WCAG-EM Step 3.',
      technologiesReliedUpon: ['HTML', 'CSS', 'JavaScript'],
      evaluator: { name: 'Jamie Sargent', contact: 'jamie@example.com' },
      criteriaOutcomes: [
        { sc: '4.1.2', level: 'A', outcome: 'failed', pagesExamined: 1 },
        { sc: '1.4.3', level: 'AA', outcome: 'cantTell', pagesExamined: 2 },
        { sc: '1.1.1', level: 'A', outcome: 'passed', pagesExamined: 4 },
        { sc: '1.2.1', level: 'A', outcome: 'inapplicable', pagesExamined: 4 },
        { sc: '2.4.7', level: 'AA', outcome: 'notTested', pagesExamined: 0 },
      ],
    },
  };

  const ctx = {
    paths: { reportsDir, outDir: tmp },
    config: {
      name: 'au-demo-uw',
      rootUrl: 'https://example.com/',
      processes: [{ name: 'site-search' }],
    },
  };
  const result = await starter.emit(/** @type {any} */ (summary), /** @type {any} */ (ctx));
  const draft = JSON.parse(await fs.readFile(result.path, 'utf8'));

  const validate = await compileValidator();
  const valid = validate(draft);
  assert.ok(
    valid,
    `draft must conform to the vendored contract:\n${JSON.stringify(validate.errors, null, 2)}`,
  );

  // Structural spot-checks the schema cannot see (refinements):
  const ids = draft.findings.map((/** @type {any} */ f) => f.id);
  assert.equal(new Set(ids).size, ids.length, 'finding IDs unique');
  for (const f of draft.findings) {
    assert.match(f.id, /^[A-Z]{1,4}-?\d{1,4}$/);
    for (const e of f.evidence) {
      assert.ok(e.content || e.path || e.observed, 'evidence content|path|observed');
      if (e.type === 'screenshot') assert.ok(e.alt);
    }
  }
});
