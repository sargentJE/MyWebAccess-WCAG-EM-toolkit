// @ts-check
/**
 * @file Validates portal-export output against the vendored canonical-scan schema.
 * @module test/unit/portal-export-schema
 *
 * @description
 * The MyAccess Portal contract was reverse-engineered from live uploads. This
 * test pins it down: it compiles `schemas/portal-canonical-scan.schema.json`
 * (Ajv2020, mirroring `validate-config.mjs`) and asserts that `portal-export`
 * output conforms — and, critically, that the schema REJECTS the exact shape
 * the portal warns about (a critical/high finding with no `evidence.html` /
 * instance htmlSnippet). It turns "discover the contract by uploading" into a
 * checked regression.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import * as portalReporter from '../../src/reporters/portal-export.mjs';

const Ajv2020 = /** @type {any} */ (Ajv2020Module).default ?? /** @type {any} */ (Ajv2020Module);
const addFormats =
  /** @type {any} */ (addFormatsModule).default ?? /** @type {any} */ (addFormatsModule);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.resolve(__dirname, '../../schemas/portal-canonical-scan.schema.json');

// SECTION: Helpers

/** @returns {Promise<any>} compiled Ajv validator */
async function compileValidator() {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  return ajv.compile(schema);
}

/**
 * @param {Record<string, any>} summary
 * @param {{ after: (fn: () => any) => void }} t
 * @returns {Promise<any>} parsed portal-export.json
 */
async function emitParsed(summary, t) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-schema-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = { paths: { reportsDir }, config: { rootUrl: 'https://example.com/' } };
  const result = await portalReporter.emit(summary, ctx);
  return JSON.parse(await fs.readFile(result.path, 'utf8'));
}

/**
 * A hand-crafted minimal-valid envelope for direct (negative) schema tests.
 *
 * @returns {Record<string, any>}
 */
function basePayload() {
  return {
    scanMetadata: { url: 'https://example.com/', timestamp: '2026-06-04T00:00:00.000Z' },
    summary: { totalIssues: 0, reportedTotal: 0, scoreSource: 'wcag-em-criterion-outcomes' },
    rawFindings: [],
  };
}

/**
 * @param {Record<string, any>} [overrides]
 * @returns {Record<string, any>}
 */
function criticalFinding(overrides = {}) {
  return {
    ruleId: 'image-alt',
    impact: 'critical',
    priorityLabel: 'Critical',
    message: 'Images must have alt text',
    wcag: ['1.1.1'],
    evidence: { html: '<img class="x">', pageUrl: 'https://example.com/', target: 'img.x' },
    confidence: 'automated',
    occurrenceCount: 1,
    countsTowardCompliance: true,
    findingKind: 'violation',
    instances: [
      { url: 'https://example.com/', selector: 'img.x', evidence: { html: '<img class="x">' } },
    ],
    taxonomy: { actRuleIds: [], wcagTechniques: [], category: 'text-alternatives' },
    ...overrides,
  };
}

// SECTION: Positive — conforming payloads validate

test('portal schema: a well-formed payload validates', async () => {
  const validate = await compileValidator();
  const p = basePayload();
  p.rawFindings.push(criticalFinding());
  assert.ok(validate(p), JSON.stringify(validate.errors));
});

test('portal schema: emit output (critical violation with evidence) validates', async (t) => {
  const validate = await compileValidator();
  const parsed = await emitParsed(
    {
      tool: { name: 'wcag-em-a11y-toolkit', version: '1.1.0', axeCore: '4.11.2' },
      generatedAt: '2026-06-04T00:00:00.000Z',
      groupedFindingCount: 1,
      samplePagesScanned: 1,
      finalSampleCount: 1,
      inventoryCount: 1,
      findings: [
        {
          id: 'image-alt',
          impact: 'critical',
          help: 'Images must have alt text',
          classification: 'primary-automated-finding',
          wcagCriteria: ['1.1.1'],
          tags: ['cat.text-alternatives', 'wcag111'],
          actRuleIds: [],
          occurrences: 1,
          pages: ['https://example.com/'],
          targets: ['img.x'],
          examples: [{ pageUrl: 'https://example.com/', target: 'img.x', html: '<img class="x">' }],
        },
      ],
      incompleteFindings: [],
      wcagEmSummary: { criteriaOutcomes: [{ outcome: 'failed' }, { outcome: 'passed' }] },
    },
    t,
  );
  assert.ok(validate(parsed), JSON.stringify(validate.errors));
});

test('portal schema: emit output (empty scan) validates', async (t) => {
  const validate = await compileValidator();
  const parsed = await emitParsed(
    {
      tool: { name: 'x', version: '1', axeCore: '4' },
      generatedAt: '2026-06-04T00:00:00.000Z',
      findings: [],
      incompleteFindings: [],
      groupedFindingCount: 0,
      wcagEmSummary: { criteriaOutcomes: [] },
    },
    t,
  );
  assert.ok(validate(parsed), JSON.stringify(validate.errors));
});

test('portal schema: a moderate manual-review finding with empty wcag + no evidence validates', async () => {
  const validate = await compileValidator();
  const p = basePayload();
  p.rawFindings.push({
    ruleId: 'region',
    impact: 'moderate',
    priorityLabel: 'Medium',
    message: 'All page content should be contained by landmarks',
    wcag: [],
    evidence: null,
    confidence: 'manual-review',
    occurrenceCount: 1,
    countsTowardCompliance: false,
    findingKind: 'manual-review',
    instances: [{ url: 'https://example.com/', selector: '.x' }],
    taxonomy: { actRuleIds: [], wcagTechniques: [], category: null },
  });
  assert.ok(validate(p), JSON.stringify(validate.errors));
});

// SECTION: Negative — the portal-warning shape is rejected (the regression guard)

test('portal schema: REJECTS a critical finding missing evidence.html', async () => {
  const validate = await compileValidator();
  const p = basePayload();
  const f = criticalFinding({
    evidence: { html: null, pageUrl: 'https://example.com/', target: 'img.x' },
  });
  p.rawFindings.push(f);
  assert.equal(validate(p), false, 'critical finding with null evidence.html must fail');
});

test('portal schema: REJECTS a critical finding whose instances lack evidence.html', async () => {
  const validate = await compileValidator();
  const p = basePayload();
  const f = criticalFinding({ instances: [{ url: 'https://example.com/', selector: 'img.x' }] });
  p.rawFindings.push(f);
  assert.equal(validate(p), false, 'critical finding with evidence-less instances must fail');
});

test('portal schema: REJECTS an out-of-enum impact / missing required field', async () => {
  const validate = await compileValidator();
  const p = basePayload();
  p.rawFindings.push(criticalFinding({ impact: 'blocker' }));
  assert.equal(validate(p), false, 'impact outside the axe enum must fail');
});
