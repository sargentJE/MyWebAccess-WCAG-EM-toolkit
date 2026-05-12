// @ts-check
/**
 * @file EARL JSON-LD reporter — emits `earl.jsonld` (internal).
 * @module reporters/earl-jsonld
 *
 * @description
 * Per-violation Assertion model (Alfa convention): each axe rule
 * violation, on each page, becomes one `earl:Assertion`. The reporter
 * is a pure REFORMAT of `summary.findings[]` + optional
 * `summary.wcagEmSummary.criteriaOutcomes` — no new fields are
 * synthesised that aren't already on the input summary.
 *
 * `@context` is the single-vocab EARL namespace
 * (`http://www.w3.org/ns/earl#`). `earl:pointer` carries the CSS
 * selector as a plain string for v1.0 pragmatism — strict
 * `{ @type: ptr:CSSSelector, rdf:value: ... }` typing is reserved
 * for a follow-up if validator feedback demands it; ADR-0009
 * captures the deferral.
 *
 * Outcome mapping:
 *   failed       -> earl:failed
 *   incomplete   -> earl:cantTell
 *   inapplicable -> earl:inapplicable
 *   passed       -> earl:passed   (only when reporting.includePasses)
 *
 * @see docs/adr/0009-earl-jsonld-output.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeText } from '../lib/fs-utils.mjs';
import { TOOL_IDENTITY } from '../lib/version.mjs';
import { sortFindings } from './_sort.mjs';

// SECTION: Module identity
export const name = 'earl-jsonld';

// SECTION: Constants

const EARL_CONTEXT = 'http://www.w3.org/ns/earl#';

/**
 * Outcome mapping table. Keyed by axe-style outcome strings; values are
 * the EARL ontology individuals. Missing/unknown axe outcomes fall back
 * to `earl:cantTell` — the safest "we don't know" answer for an audit.
 *
 * @type {Readonly<Record<string, string>>}
 */
const OUTCOME_MAP = Object.freeze({
  failed: 'earl:failed',
  passed: 'earl:passed',
  incomplete: 'earl:cantTell',
  inapplicable: 'earl:inapplicable',
});

// SECTION: Public API

/**
 * Emit `earl.jsonld` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const includePasses = Boolean(ctx?.config?.reporting?.includePasses);
  const evaluator = ctx?.config?.wcagEm?.evaluator;
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);

  /** @type {Array<Record<string, any>>} */
  const graph = [];

  // Per-violation Assertions — one per (rule × URL) pair.
  for (const f of findings) {
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const ruleId = String(f.id ?? '');
    const pointer = Array.isArray(f.targets) && f.targets.length ? String(f.targets[0]) : '';
    // Treat axe `failed` (the only impact-bearing finding state in
    // summary.findings[]) as the outcome unless the finding row carries
    // a different state. For the current Layer 3b shape, every grouped
    // finding represents a violation -> earl:failed.
    const outcomeKey = typeof f.outcome === 'string' ? f.outcome : 'failed';
    for (const url of pages) {
      graph.push(
        buildAssertion({
          subject: String(url),
          test: ruleId,
          outcomeKey,
          info: buildInfo(f),
          pointer,
          evaluator,
        }),
      );
    }
  }

  // Per-SC Assertions for passed criteria (only when includePasses is on).
  if (includePasses) {
    const outcomes = Array.isArray(summary?.wcagEmSummary?.criteriaOutcomes)
      ? summary.wcagEmSummary.criteriaOutcomes
      : [];
    const siteSubject = String(summary?.site ?? 'site');
    for (const c of outcomes) {
      if (c?.outcome !== 'passed') continue;
      graph.push(
        buildAssertion({
          subject: siteSubject,
          test: String(c.sc ?? ''),
          outcomeKey: 'passed',
          info: 'No violations recorded for this success criterion.',
          pointer: '',
          evaluator,
        }),
      );
    }
  }

  const doc = {
    '@context': EARL_CONTEXT,
    '@graph': graph,
  };

  const filePath = path.join(ctx.paths.reportsDir, 'earl.jsonld');
  await writeText(filePath, JSON.stringify(doc, null, 2) + '\n');
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}

// SECTION: Internal helpers

/**
 * Build a single `earl:Assertion` JSON-LD node.
 *
 * @param {{ subject: string, test: string, outcomeKey: string, info: string, pointer: string, evaluator?: { name?: string, contact?: string } }} args
 * @returns {Record<string, any>}
 */
function buildAssertion({ subject, test, outcomeKey, info, pointer, evaluator }) {
  /** @type {Record<string, any>} */
  const result = {
    '@type': 'earl:Result',
    'earl:outcome': OUTCOME_MAP[outcomeKey] ?? 'earl:cantTell',
    'earl:info': info,
  };
  if (pointer) result['earl:pointer'] = pointer;
  return {
    '@type': 'earl:Assertion',
    'earl:assertedBy': buildAssertor(evaluator),
    'earl:subject': subject,
    'earl:test': test,
    'earl:result': result,
    'earl:mode': 'earl:automatic',
  };
}

/**
 * Build the EARL `earl:Assertor` stamped from TOOL_IDENTITY, with
 * optional evaluator identity from `wcagEm.evaluator` config.
 *
 * @param {{ name?: string, contact?: string }} [evaluator]
 * @returns {Record<string, any>}
 */
function buildAssertor(evaluator) {
  /** @type {Record<string, any>} */
  const assertor = {
    '@type': 'earl:Assertor',
    'doap:name': TOOL_IDENTITY.name,
    'doap:release': TOOL_IDENTITY.version,
  };
  if (evaluator?.name) assertor['foaf:name'] = evaluator.name;
  if (evaluator?.contact) assertor['foaf:mbox'] = evaluator.contact;
  return assertor;
}

/**
 * Compose the `earl:info` freeform string for a finding. Includes
 * impact, classification, help text — enough for an auditor reading
 * the EARL document to triage without round-tripping to summary.json.
 *
 * @param {Record<string, any>} f
 * @returns {string}
 */
function buildInfo(f) {
  const parts = [];
  if (f.impact) parts.push(`impact: ${f.impact}`);
  if (f.classification) parts.push(`classification: ${f.classification}`);
  if (f.help) parts.push(String(f.help));
  if (f.helpUrl) parts.push(String(f.helpUrl));
  return parts.join(' | ');
}
