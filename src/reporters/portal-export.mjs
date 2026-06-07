// @ts-check
/**
 * @file Portal-export reporter — emits `portal-export.json` (internal).
 * @module reporters/portal-export
 *
 * @description
 * Reformats the run summary into the MyAccess Portal "canonical-scan"
 * envelope `{ scanMetadata, summary, rawFindings }` so audit output uploads
 * to the portal without manual transformation. Reformats
 * `summary.findings[]` (+ `incompleteFindings[]` as manual-review rows) and
 * `summary.wcagEmSummary.criteriaOutcomes`, and reads `axe-results.json` /
 * `process-results.json` to list one instance per distinct affected element.
 *
 * Compliance vs reported split (matches the portal's field semantics):
 * `summary.totalIssues` and `distribution` count COMPLIANCE-AFFECTING
 * violations only; `summary.reportedTotal` is the full count of emitted
 * rawFindings, including best-practice AND needs-review manual-review rows —
 * so the per-row `countsTowardCompliance` flags stay consistent with the
 * severity buckets.
 *
 * Determinism (ADR-0008): findings routed through `sortFindings`
 * (impact desc, ruleId asc); `instances[]` deduped by (url, selector) and
 * sorted, with `occurrenceCount === instances.length`; fixed-key
 * `distribution`; no clock/random reads — `timestamp` is `summary.generatedAt`.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeJson, readJsonMaybe } from '../lib/fs-utils.mjs';
import { normalizeUrl } from '../lib/urls.mjs';
import { sortFindings } from './_sort.mjs';

// SECTION: Module identity
export const name = 'portal-export';

// SECTION: Constants

/**
 * axe impact -> portal { priorityLabel, distribution bucket }. `null` impact
 * has no bucket (omitted from distribution) but coerces to the Low row so a
 * per-finding row stays within the portal's required enum.
 *
 * @type {Readonly<Record<string, { label: string, bucket: 'critical'|'high'|'medium'|'low' }>>}
 */
const PRIORITY_MAP = Object.freeze({
  critical: { label: 'Critical', bucket: 'critical' },
  serious: { label: 'High', bucket: 'high' },
  moderate: { label: 'Medium', bucket: 'medium' },
  minor: { label: 'Low', bucket: 'low' },
});

// SECTION: Helpers

/**
 * True when axe tagged the rule best-practice. The toolkit's literal is
 * `best-practice-or-manual-review` (see `axe-utils.mjs`); the prefix match is
 * defensive against a future sub-bucket.
 *
 * @param {{ classification?: string }} f
 * @returns {boolean}
 */
function isBestPractice(f) {
  return typeof f.classification === 'string' && f.classification.startsWith('best-practice');
}

/**
 * Strip the `cat.` axe namespace off the first category tag. `null` when no
 * `cat.*` tag exists (tags[0] is often `wcag2a`/`wcag412`, not a category).
 *
 * @param {string[]} [tags]
 * @returns {string | null}
 */
function deriveCategory(tags) {
  if (!Array.isArray(tags)) return null;
  const catTag = tags.find((t) => typeof t === 'string' && t.startsWith('cat.'));
  return catTag ? catTag.slice('cat.'.length) : null;
}

/**
 * 0-100 compliance estimate: passed / (passed + failed), rounded. Counts only
 * adjudicated verdicts — `cantTell`/`untested`/`notTested`/`inapplicable` are
 * non-decisions and excluded. Returns `null` when nothing was scored; the
 * caller OMITS the key in that case rather than emitting a null number.
 *
 * @param {Array<{ outcome?: string }>} [outcomes]
 * @returns {number | null}
 */
function computeAverageScore(outcomes) {
  if (!Array.isArray(outcomes)) return null;
  let passed = 0;
  let failed = 0;
  for (const o of outcomes) {
    if (o?.outcome === 'passed') passed += 1;
    else if (o?.outcome === 'failed') failed += 1;
  }
  const denom = passed + failed;
  return denom === 0 ? null : Math.round((passed / denom) * 100);
}

/**
 * Per-PAGE instance rows from summary data — the FALLBACK used when the scan
 * results are unavailable (e.g. a pre-existing summary with no `resultsDir`).
 * `pages` seeds one row per affected page; `examples` (capped 5,
 * `{ pageUrl, target, html }`) enriches matching rows with HTML evidence
 * (first example per URL wins). Deduped by URL, sorted for byte-stable output.
 *
 * @param {Record<string, any>} f
 * @param {string | null} selector
 * @returns {Array<{ url: string, selector: string|null, evidence?: { html: string|null } }>}
 */
function buildInstances(f, selector) {
  /** @type {Map<string, { url: string, selector: string|null, evidence?: { html: string|null } }>} */
  const byUrl = new Map();
  for (const url of Array.isArray(f.pages) ? f.pages : []) {
    if (typeof url === 'string') byUrl.set(url, { url, selector });
  }
  for (const ex of Array.isArray(f.examples) ? f.examples : []) {
    const url = ex?.pageUrl;
    if (typeof url !== 'string') continue;
    // First example per URL wins, matching the top-level evidence (examples[0]).
    if (byUrl.get(url)?.evidence) continue;
    byUrl.set(url, { url, selector: ex.target ?? selector, evidence: { html: ex.html ?? null } });
  }
  return [...byUrl.values()].sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
}

/**
 * Build ruleId -> per-element instance rows from the scan results
 * (`axe-results.json` + `process-results.json`): one row per distinct affected
 * element `{ url, selector, evidence: { html } }`, deduped across viewports by
 * (url, selector) and sorted. Empty Map when `resultsDir` is absent or the
 * files are missing/unreadable — callers then fall back to per-page rows.
 *
 * @param {{ paths?: { resultsDir?: string } }} ctx
 * @returns {Promise<{ violations: Map<string, any[]>, incompletes: Map<string, any[]> }>}
 */
async function loadInstanceMap(ctx) {
  /** @type {Map<string, any[]>} */
  const violations = new Map();
  /** @type {Map<string, any[]>} */
  const incompletes = new Map();
  const dir = ctx?.paths?.resultsDir;
  if (typeof dir !== 'string') return { violations, incompletes };
  /** @type {(map: Map<string, any[]>, id: any, url: string, selector: string|null, html: any) => void} */
  const push = (map, id, url, selector, html) => {
    if (typeof id !== 'string') return;
    if (!map.has(id)) map.set(id, []);
    /** @type {any[]} */ (map.get(id)).push({
      url,
      selector,
      evidence: { html: typeof html === 'string' ? html : null },
    });
  };
  /** @type {(id: any, url: string, node: any) => void} */
  const addViolationNode = (id, url, node) => {
    const target = Array.isArray(node?.target) ? node.target : [];
    push(violations, id, url, target.length ? target.join(' | ') : null, node?.html);
  };
  /** @type {(id: any, url: string, ex: any) => void} */
  const addIncompleteExample = (id, url, ex) => {
    push(incompletes, id, url, typeof ex?.target === 'string' ? ex.target : null, ex?.html);
  };
  /** @type {(entry: any, url: string) => void} */
  const ingest = (entry, url) => {
    for (const v of Array.isArray(entry?.violations) ? entry.violations : []) {
      for (const node of Array.isArray(v?.nodes) ? v.nodes : []) addViolationNode(v?.id, url, node);
    }
    for (const inc of Array.isArray(entry?.incompleteDetail) ? entry.incompleteDetail : []) {
      for (const ex of Array.isArray(inc?.examples) ? inc.examples : [])
        addIncompleteExample(inc?.id, url, ex);
    }
  };
  /** @type {any[]} */
  const axe = await readJsonMaybe(path.join(dir, 'axe-results.json'), []);
  for (const entry of Array.isArray(axe) ? axe : []) {
    const url = typeof entry?.url === 'string' ? normalizeUrl(entry.url) : null;
    if (url) ingest(entry, url);
  }
  /** @type {any[]} */
  const proc = await readJsonMaybe(path.join(dir, 'process-results.json'), []);
  for (const entry of Array.isArray(proc) ? proc : []) {
    const url = typeof entry?.startUrl === 'string' ? normalizeUrl(entry.startUrl) : null;
    if (!url) continue;
    for (const state of Array.isArray(entry.states) ? entry.states : []) ingest(state, url);
  }
  // Dedupe by (url, selector) — collapses viewport repeats — then sort.
  for (const map of [violations, incompletes]) {
    for (const [id, rows] of map) {
      const seen = new Set();
      const deduped = rows.filter((r) => {
        const k = `${r.url} ${r.selector}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
      deduped.sort((a, b) => {
        if (a.url !== b.url) return a.url < b.url ? -1 : 1;
        const as = a.selector ?? '';
        const bs = b.selector ?? '';
        return as < bs ? -1 : as > bs ? 1 : 0;
      });
      map.set(id, deduped);
    }
  }
  return { violations, incompletes };
}

/**
 * Map one grouped finding to a portal rawFinding. Best-practice findings
 * become non-compliance manual-review rows.
 *
 * @param {Record<string, any>} f
 * @param {Map<string, Array<{ url: string, selector: string|null, evidence: { html: string|null } }>>} instanceMap
 * @returns {Record<string, any>}
 */
function toRawFinding(f, instanceMap) {
  const prio = PRIORITY_MAP[f.impact] ?? PRIORITY_MAP.minor; // null impact -> Low
  const ex = Array.isArray(f.examples) && f.examples.length ? f.examples[0] : null;
  // Selector describes the SAME node as the evidence (examples[0]) so the
  // top-level selector/evidence pair are consistent; fall back to the sorted
  // representative target when no example exists.
  const selector = ex?.target ?? (Array.isArray(f.targets) ? (f.targets[0] ?? null) : null);
  const bestPractice = isBestPractice(f);
  // Per-element instances from the scan results when available (one row per
  // distinct affected element); else per-page from the summary. The portal
  // treats the instance list as authoritative — occurrenceCount mirrors it.
  const elementInstances = instanceMap.get(f.id);
  const instances =
    elementInstances && elementInstances.length ? elementInstances : buildInstances(f, selector);
  return {
    ruleId: f.id,
    impact: f.impact ?? 'minor',
    priorityLabel: prio.label,
    message: f.help ?? f.id ?? 'Accessibility issue',
    description: f.help ?? null,
    selector,
    wcag: Array.isArray(f.wcagCriteria) ? f.wcagCriteria : [],
    evidence: ex
      ? { html: ex.html ?? null, pageUrl: ex.pageUrl ?? null, target: ex.target ?? null }
      : null,
    confidence: bestPractice ? 'manual-review' : 'automated',
    occurrenceCount: instances.length,
    countsTowardCompliance: !bestPractice,
    findingKind: bestPractice ? 'manual-review' : 'violation',
    instances,
    taxonomy: {
      actRuleIds: Array.isArray(f.actRuleIds) ? f.actRuleIds : [],
      wcagTechniques: [],
      category: deriveCategory(f.tags),
    },
  };
}

/**
 * Map one axe "incomplete" (needs-review) finding to a manual-review
 * rawFinding. These are NOT confirmed violations — axe could not decide them
 * automatically — so they never count toward compliance. They carry a
 * `examples`/`occurrences`/`targets` (per-node HTML evidence) just like
 * violations, but never count toward compliance; a human still confirms each.
 * Per-element instances come from the incomplete map (or the per-page fallback).
 *
 * @param {Record<string, any>} f
 * @param {Map<string, any[]>} incompleteMap
 * @returns {Record<string, any>}
 */
function toIncompleteRawFinding(f, incompleteMap) {
  const prio = PRIORITY_MAP[f.impact] ?? PRIORITY_MAP.minor; // null impact -> Low
  const ex = Array.isArray(f.examples) && f.examples.length ? f.examples[0] : null;
  const selector = ex?.target ?? (typeof f.firstTarget === 'string' ? f.firstTarget : null);
  const elementInstances = incompleteMap.get(f.id);
  const instances =
    elementInstances && elementInstances.length ? elementInstances : buildInstances(f, selector);
  return {
    ruleId: f.id,
    impact: f.impact ?? 'minor',
    priorityLabel: prio.label,
    message: f.help ?? f.id ?? 'Accessibility issue',
    description: f.help ?? null,
    selector,
    wcag: Array.isArray(f.wcagCriteria) ? f.wcagCriteria : [],
    evidence: ex
      ? { html: ex.html ?? null, pageUrl: ex.pageUrl ?? null, target: ex.target ?? null }
      : selector
        ? {
            html: null,
            pageUrl: Array.isArray(f.pages) ? (f.pages[0] ?? null) : null,
            target: selector,
          }
        : null,
    confidence: 'manual-review',
    occurrenceCount: instances.length,
    countsTowardCompliance: false,
    findingKind: 'manual-review',
    instances,
    taxonomy: {
      actRuleIds: Array.isArray(f.actRuleIds) ? f.actRuleIds : [],
      wcagTechniques: [],
      category: deriveCategory(f.tags),
    },
  };
}

/**
 * Loud, NON-BLOCKING report-time guard. The portal flags any critical/high
 * finding lacking `evidence.html` (top-level) plus an instance htmlSnippet.
 * Surfacing it here catches a stale `axe-results.json` (re-summarised without a
 * fresh scan, so `incompleteDetail` has no `examples`) at REPORT time rather
 * than at upload time. The file is still written — the warning is the signal,
 * and the fix is to re-run the scan so node evidence is captured.
 *
 * @param {Array<Record<string, any>>} rawFindings
 * @param {{ warn?: Function } | undefined} [logger]
 */
function warnOnMissingCriticalEvidence(rawFindings, logger) {
  if (typeof logger?.warn !== 'function') return;
  const offenders = rawFindings.filter((r) => {
    if (r.impact !== 'critical' && r.impact !== 'serious') return false;
    const topHtml = r.evidence && typeof r.evidence.html === 'string' && r.evidence.html.length > 0;
    const instHtml =
      Array.isArray(r.instances) &&
      r.instances.some(
        (i) => i?.evidence && typeof i.evidence.html === 'string' && i.evidence.html.length > 0,
      );
    return !(topHtml && instHtml);
  });
  if (offenders.length) {
    logger.warn(
      { reporter: 'portal-export', findings: offenders.map((r) => r.ruleId) },
      `portal-export: ${offenders.length} critical/high finding(s) lack HTML evidence; the portal will flag these as "missing evidence.html". Re-run the scan to capture node evidence.`,
    );
  }
}

// SECTION: Public API

/**
 * Emit `portal-export.json` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string, resultsDir?: string }, config?: Record<string, any>, logger?: { warn?: Function } }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const rootUrl = ctx?.config?.rootUrl;
  if (typeof rootUrl !== 'string' || !/^https?:\/\//.test(rootUrl)) {
    // Fail loud rather than emit a payload the portal will reject; runReporters
    // isolates this per-reporter so the other reporters still run.
    throw new Error('portal-export: ctx.config.rootUrl must be an http(s) URL');
  }

  const tool = summary.tool || {};
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
  const incompletes = sortFindings(
    Array.isArray(summary.incompleteFindings) ? summary.incompleteFindings : [],
  );
  const compliance = findings.filter((f) => !isBestPractice(f));

  // distribution + totalIssues: compliance-affecting only; null-impact omitted.
  const distribution = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const f of compliance) {
    const entry = PRIORITY_MAP[f.impact];
    if (entry) distribution[entry.bucket] += 1;
  }
  const totalIssues = compliance.length;
  const averageScore = computeAverageScore(summary.wcagEmSummary?.criteriaOutcomes);

  // Confirmed violations + best-practice (manual-review) + needs-review
  // (manual-review). Only `compliance` feeds totalIssues/distribution.
  const instanceMap = await loadInstanceMap(ctx);
  const rawFindings = [
    ...findings.map((f) => toRawFinding(f, instanceMap.violations)),
    ...incompletes.map((f) => toIncompleteRawFinding(f, instanceMap.incompletes)),
  ];
  warnOnMissingCriticalEvidence(rawFindings, ctx?.logger);

  const out = {
    scanMetadata: {
      url: rootUrl,
      timestamp: summary.generatedAt ?? null,
      tool: `${tool.name ?? 'unknown'} ${tool.version ?? ''}`.trim(),
      toolVersion: tool.version ?? null,
      scanOptions: {
        axeVersion: tool.axeCore ?? null,
        pagesScanned: summary.samplePagesScanned ?? null,
        sampleSize: summary.finalSampleCount ?? null,
        inventorySize: summary.inventoryCount ?? null,
      },
    },
    summary: {
      totalIssues,
      reportedTotal: rawFindings.length,
      ...(totalIssues > 0 ? { distribution } : {}),
      ...(averageScore !== null ? { averageScore } : {}),
      scoreSource: 'wcag-em-criterion-outcomes',
    },
    rawFindings,
  };

  const filePath = path.join(ctx.paths.reportsDir, 'portal-export.json');
  await writeJson(filePath, out);
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}
