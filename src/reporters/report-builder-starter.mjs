// @ts-check
/**
 * @file Report-builder starter reporter — emits `report-builder-draft.json` (internal).
 * @module reporters/report-builder-starter
 *
 * @description
 * Emits a myweb-report-builder `DraftReportSchema`-compliant draft directly
 * from the run summary, so a client report can be authored from audit data
 * without the consumer-side evidence/draft two-step (which the 2026-06
 * review found broken on v1.1 output: empty `samplingMethodNotes` and the
 * `notTested` outcome both fail its Zod contract).
 *
 * Contract: `schemas/report-builder-draft.schema.json`, GENERATED from the
 * consumer's own Zod schema via `z.toJSONSchema` (regeneration command in the
 * schema's `_meta`). Cross-field refinements that JSON Schema cannot express
 * (finding-ID uniqueness; evidence needs content|path|observed; screenshots
 * need alt) are enforced by construction here and double-checked by the
 * consumer-side Zod parse in the sprint verification.
 *
 * Mapping decisions (mirrors the consumer's draft-from-evidence conventions):
 * - Finding IDs `<PREFIX>-NNN`, prefix derived from `config.name` initials
 *   (legacy-events -> LE, matching the consumer's historical prefix).
 * - axe impact -> severity Critical/Serious/Moderate/Minor; null -> Advisory.
 * - Violations AND needs-review incompletes become draft findings; incompletes
 *   are flagged `needsManualReview` and EXCLUDED from recommendations so a
 *   draft never auto-recommends acting on an unconfirmed item.
 * - criteriaOutcomes filtered to the consumer's four-value enum;
 *   notTested/untested coverage and scanWarnings ride in `appendices`.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import Ajv2020Module from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import { writeJson, readJsonMaybe } from '../lib/fs-utils.mjs';
import { normalizeUrl } from '../lib/urls.mjs';
import { sortFindings } from './_sort.mjs';
import { SC_LEVEL_MAP } from '../lib/wcag-em-summary.mjs';
import { buildManualBacklogItems } from '../lib/manual-backlog.mjs';

const Ajv2020 = /** @type {any} */ (Ajv2020Module).default ?? /** @type {any} */ (Ajv2020Module);
const addFormats =
  /** @type {any} */ (addFormatsModule).default ?? /** @type {any} */ (addFormatsModule);

// SECTION: Module identity
export const name = 'report-builder-starter';

// SECTION: Constants

/** axe impact -> consumer severity. `null`/unknown impact -> Advisory. */
const SEVERITY_MAP = Object.freeze({
  critical: 'Critical',
  serious: 'Serious',
  moderate: 'Moderate',
  minor: 'Minor',
});

/** Consumer's axeImpact enum — emitted only when the impact is one of these. */
const AXE_IMPACT_ENUM = Object.freeze(['critical', 'serious', 'moderate', 'minor']);

/** Outcomes the consumer's criteriaOutcomes enum accepts. */
const CONSUMER_OUTCOMES = Object.freeze(['passed', 'failed', 'cantTell', 'inapplicable']);

const GUARDRAIL_TEXT =
  'This draft was generated from the automated layer of the audit. It does not make a ' +
  'sitewide WCAG conformance claim on its own; manual testing with keyboard, assistive ' +
  'technology, zoom/reflow, and process walkthroughs is still required.';

// SECTION: Helpers

/**
 * Derive the finding-ID prefix from the site name: first character of each
 * `[-_ ]`-separated word, uppercased, non-A-Z dropped, max 4 chars.
 * `legacy-events -> LE`, `au-demo-uw -> ADU`; empty result -> 'RB'.
 *
 * @param {any} siteName
 * @returns {string}
 */
export function deriveIdPrefix(siteName) {
  if (typeof siteName !== 'string') return 'RB';
  const prefix = siteName
    .split(/[-_ ]+/)
    .map((word) => word.charAt(0).toUpperCase())
    .join('')
    .replace(/[^A-Z]/g, '')
    .slice(0, 4);
  return prefix.length > 0 ? prefix : 'RB';
}

/**
 * `color-contrast` -> `Color Contrast` (the consumer's titleFromRule shape).
 *
 * @param {string} ruleId
 * @returns {string}
 */
function titleFromRule(ruleId) {
  return ruleId
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * @param {string | null} impact
 * @returns {'Critical'|'Serious'|'Moderate'|'Minor'|'Advisory'}
 */
function severityFromImpact(impact) {
  return /** @type {any} */ (SEVERITY_MAP)[impact ?? ''] ?? 'Advisory';
}

/**
 * @param {string} severity
 * @returns {'Tier 1'|'Tier 2'|'Tier 3'|'Advisory'}
 */
function tierFromSeverity(severity) {
  if (severity === 'Critical' || severity === 'Serious') return 'Tier 1';
  if (severity === 'Moderate') return 'Tier 2';
  if (severity === 'Minor') return 'Tier 3';
  return 'Advisory';
}

/** @type {Record<string, string> | null} */
let scNamesCache = null;

/** @returns {Promise<Record<string, string>>} SC id -> handle map (sans _meta). */
async function loadScNames() {
  if (!scNamesCache) {
    /** @type {Record<string, any>} */
    const raw = JSON.parse(
      await fs.readFile(new URL('../data/wcag-sc-names.json', import.meta.url), 'utf8'),
    );
    const { _meta, ...names } = raw;
    scNamesCache = names;
  }
  return scNamesCache;
}

/**
 * Map SC ids to the consumer's `{ criterion, name, level }` references. An
 * empty list synthesizes the consumer's own best-practice convention so the
 * schema's `wcag.min(1)` holds.
 *
 * @param {string[] | undefined} criteria
 * @param {Record<string, string>} scNames
 * @returns {Array<{ criterion: string, name: string, level: string }>}
 */
function wcagRefs(criteria, scNames) {
  const list = Array.isArray(criteria) ? criteria.filter((c) => typeof c === 'string') : [];
  if (list.length === 0) {
    return [{ criterion: 'Best practice', name: 'Manual review required', level: 'Best practice' }];
  }
  return list.map((sc) => ({
    criterion: sc,
    name: scNames[sc] ?? 'Manual review required',
    level: /** @type {Record<string, string>} */ (SC_LEVEL_MAP)[sc] ?? 'A',
  }));
}

/**
 * Read per-page screenshot paths + successfully-scanned page URLs from
 * `axe-results.json` (one read serves both; mirrors html.mjs's screenshot
 * map). Paths are made outDir-relative so the draft travels with the run.
 *
 * @param {{ paths?: { resultsDir?: string, outDir?: string }, logger?: any }} ctx
 * @returns {Promise<{ screenshotsByUrl: Map<string, string>, scannedUrls: string[] }>}
 */
async function loadRunFacts(ctx) {
  /** @type {Map<string, string>} */
  const screenshotsByUrl = new Map();
  /** @type {Set<string>} */
  const scanned = new Set();
  const resultsDir = ctx?.paths?.resultsDir;
  if (typeof resultsDir !== 'string') return { screenshotsByUrl, scannedUrls: [] };
  /** @type {any[]} */
  const axeResults = await readJsonMaybe(
    path.join(resultsDir, 'axe-results.json'),
    [],
    /** @type {any} */ (ctx?.logger),
  );
  for (const entry of Array.isArray(axeResults) ? axeResults : []) {
    const url = typeof entry?.url === 'string' ? normalizeUrl(entry.url) : null;
    if (!url || typeof entry?.error === 'string') continue;
    scanned.add(url);
    if (typeof entry?.screenshot === 'string' && !screenshotsByUrl.has(url)) {
      const outDir = ctx?.paths?.outDir;
      const rel =
        typeof outDir === 'string' ? path.relative(outDir, entry.screenshot) : entry.screenshot;
      screenshotsByUrl.set(url, rel);
    }
  }
  return { screenshotsByUrl, scannedUrls: [...scanned].sort() };
}

/**
 * Build the evidence list for one grouped finding (violation or incomplete).
 * Always includes the axe summary entry (content satisfies the consumer's
 * content|path|observed rule); adds a code entry when example HTML exists and
 * a screenshot entry (path + alt, both required for the type) when the first
 * affected page has one.
 *
 * @param {Record<string, any>} f - Grouped finding row.
 * @param {string} sourceFile - Provenance for SourceReference.
 * @param {Map<string, string>} screenshotsByUrl
 * @returns {Array<Record<string, any>>}
 */
function buildEvidence(f, sourceFile, screenshotsByUrl) {
  const pages = Array.isArray(f.pages) ? f.pages : [];
  const ex = Array.isArray(f.examples) && f.examples.length ? f.examples[0] : null;
  const sourceRef = {
    sourceType: 'automated',
    sourceId: String(f.id ?? ''),
    sourceFile,
    ruleId: String(f.id ?? ''),
    ...(typeof f.classification === 'string' ? { classification: f.classification } : {}),
    pageUrls: pages,
    targets: (Array.isArray(f.targets) ? f.targets : []).slice(0, 10),
    ...(typeof f.occurrences === 'number' ? { occurrenceCount: f.occurrences } : {}),
  };
  const axeContent = [
    `${f.occurrences ?? 0} occurrence(s) across ${pages.length} page(s).`,
    `Classification: ${f.classification ?? 'unclassified'}.`,
    ...(ex?.failureSummary ? [`Axe: ${ex.failureSummary}`] : []),
  ].join(' ');

  /** @type {Array<Record<string, any>>} */
  const evidence = [
    {
      type: 'axe',
      label: `${f.id} automated evidence`,
      tool: 'axe-core',
      content: axeContent,
      ...(typeof ex?.pageUrl === 'string'
        ? { pageUrl: ex.pageUrl }
        : typeof pages[0] === 'string'
          ? { pageUrl: pages[0] }
          : {}),
      ...(typeof ex?.target === 'string' ? { target: ex.target } : {}),
      source: sourceRef,
    },
  ];
  if (typeof ex?.html === 'string' && ex.html.length > 0) {
    evidence.push({
      type: 'code',
      label: 'Example markup',
      language: 'html',
      content: ex.html,
      ...(typeof ex?.pageUrl === 'string' ? { pageUrl: ex.pageUrl } : {}),
      ...(typeof ex?.target === 'string' ? { target: ex.target } : {}),
    });
  }
  const shotUrl = pages.find((/** @type {any} */ p) => screenshotsByUrl.has(p));
  if (shotUrl) {
    evidence.push({
      type: 'screenshot',
      label: `Full-page screenshot — ${shotUrl}`,
      path: /** @type {string} */ (screenshotsByUrl.get(shotUrl)),
      alt: `Full-page screenshot of ${shotUrl} at scan time`,
      pageUrl: shotUrl,
    });
  }
  return evidence;
}

// SECTION: Contract validation

/** @type {any} */
let draftValidator = null;

/** @returns {Promise<any>} compiled Ajv validate fn for the vendored contract */
async function getDraftValidator() {
  if (!draftValidator) {
    const ajv = new Ajv2020({ allErrors: true, strict: false });
    addFormats(ajv);
    const schema = JSON.parse(
      await fs.readFile(
        new URL('../../schemas/report-builder-draft.schema.json', import.meta.url),
        'utf8',
      ),
    );
    delete schema._meta;
    draftValidator = ajv.compile(schema);
  }
  return draftValidator;
}

// SECTION: Public API

/**
 * Emit `report-builder-draft.json` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string, resultsDir?: string, outDir?: string }, config?: Record<string, any>, logger?: { warn?: Function } }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const config = ctx?.config ?? {};
  const wcagEm = summary.wcagEmSummary ?? {};
  const site = typeof summary.site === 'string' && summary.site ? summary.site : 'site';
  const generatedAt =
    typeof summary.generatedAt === 'string' ? summary.generatedAt : new Date(0).toISOString();
  const issueDate = generatedAt.slice(0, 10);
  const tool = summary.tool ?? {};
  const scNames = await loadScNames();
  const { screenshotsByUrl, scannedUrls } = await loadRunFacts(ctx);

  const prefix = deriveIdPrefix(config.name ?? site);
  let idCounter = 0;
  const nextId = () => `${prefix}-${String(++idCounter).padStart(3, '0')}`;

  const violations = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
  const incompletes = sortFindings(
    Array.isArray(summary.incompleteFindings) ? summary.incompleteFindings : [],
  );

  /**
   * @param {Record<string, any>} f
   * @param {{ needsReview: boolean }} opts
   * @returns {Record<string, any>}
   */
  const toDraftFinding = (f, { needsReview }) => {
    const severity = severityFromImpact(f.impact ?? null);
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const targets = Array.isArray(f.targets) ? f.targets : [];
    const sourceFile = needsReview
      ? 'reports/summary.json#incompleteFindings'
      : 'reports/summary.json#findings';
    return {
      id: nextId(),
      title: titleFromRule(String(f.id ?? 'finding')),
      severity,
      status: 'Not retested',
      priorityTier: tierFromSeverity(severity),
      affectedArea:
        Array.isArray(f.pageTypes) && f.pageTypes.length
          ? String(f.pageTypes[0])
          : 'Multiple pages',
      affectedPages: pages,
      wcag: wcagRefs(f.wcagCriteria, scNames),
      userImpact: needsReview
        ? 'Axe could not decide this automatically (needs review). Confirm the user impact manually before including it in the report.'
        : 'This automated result needs human review before it is turned into a client-facing finding.',
      technicalIssue: `${f.help ?? f.id}.${targets.length ? ` Affected targets: ${targets.slice(0, 3).join(', ')}.` : ''}`,
      recommendation: needsReview
        ? 'Manually verify whether this needs-review result is a genuine barrier; record the outcome, then write a specific remediation recommendation or discard the draft finding.'
        : 'Review the affected pages and targets manually, confirm user impact, then write a specific remediation recommendation.',
      evidence: buildEvidence(f, sourceFile, screenshotsByUrl),
      sourceReferences: [
        {
          sourceType: 'automated',
          sourceId: String(f.id ?? ''),
          sourceFile,
          ruleId: String(f.id ?? ''),
          ...(typeof f.classification === 'string' ? { classification: f.classification } : {}),
          pageUrls: pages,
          targets: targets.slice(0, 10),
          ...(typeof f.occurrences === 'number' ? { occurrenceCount: f.occurrences } : {}),
        },
      ],
      relatedJourneyIds: [],
      draftStatus: 'generated',
      includeInReport: true,
      needsManualReview: true,
      reviewNotes: needsReview
        ? 'Generated from an axe needs-review (incomplete) result — NOT a confirmed violation. Confirm manually; set draftStatus to discarded if it does not hold.'
        : 'Generated from automated evidence. Confirm manually before using in the authored report.',
      sourceRuleId: String(f.id ?? ''),
      ...(AXE_IMPACT_ENUM.includes(f.impact) ? { axeImpact: f.impact } : {}),
    };
  };

  const violationFindings = violations.map((f) => toDraftFinding(f, { needsReview: false }));
  const incompleteFindings = incompletes.map((f) => toDraftFinding(f, { needsReview: true }));
  const findings = [...violationFindings, ...incompleteFindings];

  // criteriaOutcomes: consumer enum only; coverage gaps ride the appendices.
  const allOutcomes = Array.isArray(wcagEm.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
  const criteriaOutcomes = allOutcomes
    .filter((/** @type {any} */ c) => CONSUMER_OUTCOMES.includes(c?.outcome))
    .map((/** @type {any} */ c) => ({
      criterion: String(c.sc ?? ''),
      level: typeof c.level === 'string' ? c.level : 'A',
      outcome: c.outcome,
      notes: `Automated outcome across ${c.pagesExamined ?? 0} examined page(s).`,
      relatedFindingIds: findings
        .filter((f) =>
          f.wcag.some((/** @type {any} */ ref) => ref.criterion === String(c.sc ?? '')),
        )
        .map((f) => f.id),
    }));
  const untestedScs = allOutcomes.filter(
    (/** @type {any} */ c) => c?.outcome === 'notTested' || c?.outcome === 'untested',
  );

  const backlogItems = buildManualBacklogItems({
    findings: violations,
    inventory: [],
    processes: Array.isArray(config.processes) ? config.processes : [],
  });

  const recommendationTiers = ['Tier 1', 'Tier 2', 'Tier 3', 'Advisory'];
  const TIER_TIMEFRAMES = /** @type {Record<string, string>} */ ({
    'Tier 1': 'Immediate (blockers and high-impact barriers)',
    'Tier 2': 'Next development cycle',
    'Tier 3': 'Scheduled maintenance',
    Advisory: 'As capacity allows',
  });
  const recommendations = recommendationTiers
    .map((tier) => {
      // Confirmed violations only — needs-review drafts must not drive
      // recommendations until a human confirms them.
      const tierFindings = violationFindings.filter((f) => f.priorityTier === tier);
      if (tierFindings.length === 0) return null;
      return {
        tier,
        title: `${tier} remediation (draft)`,
        timeframe: TIER_TIMEFRAMES[tier],
        summary: `Auto-grouped from ${tierFindings.length} confirmed automated finding(s). Rewrite for the client after manual review.`,
        items: tierFindings.map((f) => ({
          findingId: f.id,
          action: `Review and remediate: ${f.title}`,
        })),
      };
    })
    .filter(Boolean);

  /** @type {Array<{ title: string, content: string }>} */
  const appendices = [];
  if (untestedScs.length > 0) {
    appendices.push({
      title: 'Automated coverage limits',
      content:
        `${untestedScs.length} success criteria at or below the conformance target were not ` +
        `touched by any automated rule and remain to be evaluated manually: ` +
        untestedScs
          .map((/** @type {any} */ c) => `${c.sc} ${scNames[String(c.sc)] ?? ''}`.trim())
          .join('; ') +
        '.',
    });
  }
  const scanWarnings = Array.isArray(summary.scanWarnings) ? summary.scanWarnings : [];
  if (scanWarnings.length > 0) {
    appendices.push({
      title: 'Scan warnings',
      content: scanWarnings.join(' | '),
    });
  }

  const draft = {
    schemaVersion: '1.0',
    reportType: 'technical-audit',
    meta: {
      title: `Accessibility audit draft — ${site}`,
      subtitle: 'Draft generated from wcag-em-a11y-toolkit output',
      client: 'Client name required',
      project: site,
      issueDate,
      standard: `WCAG ${wcagEm.wcagVersion ?? '2.2'} Level ${wcagEm.conformanceTarget ?? 'AA'}`,
      version: '0.1.0-draft',
      status: 'Draft',
      preparedBy:
        typeof wcagEm.evaluator?.name === 'string' && wcagEm.evaluator.name
          ? wcagEm.evaluator.name
          : 'MyWeb Access',
      ...(typeof config.rootUrl === 'string' ? { websiteUrl: config.rootUrl } : {}),
    },
    executiveSummary: {
      summary:
        'This draft was generated from automated toolkit evidence. Findings need manual ' +
        'confirmation; the executive narrative must be written by the auditor.',
      overallStatus: 'Draft',
      keyMetrics: [
        { label: 'Automated findings', value: String(violationFindings.length) },
        { label: 'Needs-review findings', value: String(incompleteFindings.length) },
        { label: 'Pages scanned', value: String(summary.samplePagesScanned ?? 0) },
        { label: 'Process runs', value: String(summary.processRuns ?? 0) },
      ],
      actionPriorities: backlogItems.slice(0, 5).map((item) => item.label),
      guardrail: GUARDRAIL_TEXT,
    },
    scope: {
      websiteOrProduct: site,
      pagesTested: scannedUrls,
      journeysTested: (Array.isArray(config.processes) ? config.processes : [])
        .map((/** @type {any} */ p) => (typeof p?.name === 'string' ? p.name : ''))
        .filter(Boolean),
      standard: `WCAG ${wcagEm.wcagVersion ?? '2.2'} Level ${wcagEm.conformanceTarget ?? 'AA'}`,
      samplingMethod:
        typeof wcagEm.samplingMethodNotes === 'string' && wcagEm.samplingMethodNotes
          ? wcagEm.samplingMethodNotes
          : 'Sampling method not recorded for this run.',
      technologiesReliedUpon: Array.isArray(wcagEm.technologiesReliedUpon)
        ? wcagEm.technologiesReliedUpon
        : [],
    },
    methodology: {
      summary:
        'Automated WCAG-EM-aligned pipeline: crawl-based inventory, structured + random ' +
        'sampling, axe-core scans per page and viewport, interactive process scans, and ' +
        'per-criterion outcome inversion. Manual checks listed below are pending.',
      automatedTools: [
        `${tool.name ?? 'wcag-em-a11y-toolkit'} ${tool.version ?? ''}`.trim(),
        `axe-core ${tool.axeCore ?? ''}`.trim(),
      ],
      manualChecks: backlogItems.map((item) => item.label),
      conformanceCaveat: GUARDRAIL_TEXT,
    },
    sourceRun: {
      ...(typeof ctx?.paths?.outDir === 'string' ? { sourceFolder: ctx.paths.outDir } : {}),
      toolName: String(tool.name ?? 'wcag-em-a11y-toolkit'),
      toolVersion: String(tool.version ?? '0.0.0'),
      ...(tool.axeCore ? { axeCoreVersion: String(tool.axeCore) } : {}),
      generatedAt: issueDate,
      sourceFiles: [
        'reports/summary.json',
        'reports/wcag-em-summary.json',
        'results/axe-results.json',
      ],
    },
    criteriaOutcomes,
    userTesting: {
      summary:
        'User testing has not yet been conducted for this draft. Plan journeys with ' +
        'assistive-technology users before finalising the report.',
      testers: [],
      journeys: (Array.isArray(config.processes) ? config.processes : []).map(
        (/** @type {any} */ p, /** @type {number} */ i) => ({
          id: `J-${String(i + 1).padStart(2, '0')}`,
          label: typeof p?.name === 'string' ? p.name : `process-${i + 1}`,
          outcome: 'Not tested',
          notes: 'Pending manual walkthrough.',
          relatedFindingIds: [],
        }),
      ),
    },
    manualChecks: backlogItems.map((item) => ({
      label: item.label,
      outcome: 'Not tested',
    })),
    findings,
    recommendations,
    standardsContext: {
      summary:
        'Outcomes reference the W3C Web Content Accessibility Guidelines and were produced ' +
        'following the WCAG-EM evaluation methodology (automated layer).',
      references: [
        { label: 'WCAG 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
        { label: 'WCAG-EM 1.0', url: 'https://www.w3.org/TR/WCAG-EM/' },
        { label: 'axe-core rules', url: 'https://dequeuniversity.com/rules/axe/' },
      ],
    },
    nextSteps: [
      'Review every draft finding; confirm, rewrite, or discard (draftStatus).',
      'Work the manual checks list and record outcomes.',
      'Evaluate the not-tested success criteria listed in the appendices.',
      'Replace placeholder client/meta fields and author the executive summary.',
    ],
    ...(appendices.length > 0 ? { appendices } : {}),
    draftMeta: {
      generatedAt: issueDate,
      generatedFrom:
        typeof ctx?.paths?.outDir === 'string' ? ctx.paths.outDir : 'toolkit output directory',
      instructions:
        'Machine-generated starter draft. Every finding carries draftStatus/needsManualReview; ' +
        'nothing here is client-ready until a human confirms it.',
    },
  };

  // ANCHOR: ValidateExports — same gate as portal-export (2026-06 review C4).
  const validateMode = config?.reporting?.validateExports ?? 'warn';
  if (validateMode !== 'off') {
    const validate = await getDraftValidator();
    if (!validate(draft)) {
      const issues = (validate.errors ?? [])
        .map((/** @type {any} */ e) => `${e.instancePath || '/'} ${e.message}`)
        .join('; ');
      if (validateMode === 'error') {
        throw new Error(`report-builder-starter: draft fails the vendored contract: ${issues}`);
      }
      ctx?.logger?.warn?.(
        { reporter: 'report-builder-starter', issues },
        'report-builder-starter: draft fails the vendored contract; writing anyway (reporting.validateExports=warn)',
      );
    }
  }

  const filePath = path.join(ctx.paths.reportsDir, 'report-builder-draft.json');
  await writeJson(filePath, draft);
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}
