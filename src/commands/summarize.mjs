// @ts-check
/**
 * @file `summarize` command — groups findings, compares samples, emits reports.
 * @module commands/summarize
 *
 * @description
 * Stage 5 of the pipeline. Reads every upstream artefact, groups axe
 * violations by rule-id and by (rule-id × component-hint), computes the
 * random-vs-structured comparison flags, and writes the full report set.
 *
 * Includes per-SC inversion (WCAG-EM Step 5 shape), findings-aware
 * manual backlog, tool-identity stamp, and pluggable reporter emission.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonMaybe, writeJson, writeText } from '../lib/fs-utils.mjs';
import { normalizeUrl } from '../lib/urls.mjs';
import { withActAndWcagMetadata } from '../lib/axe-utils.mjs';
import { groupFindings } from '../lib/group-findings.mjs';
import { isAuditableView, viewIdentity, viewStatus } from '../lib/scan-results.mjs';
import { warnLegacyAliasResolved } from '../lib/auth.mjs';
import { buildManualBacklog } from '../lib/manual-backlog.mjs';
import { toWcagEmSummary } from '../lib/wcag-em-summary.mjs';
import { TOOL_IDENTITY, toolIdentityMarkdownHeader } from '../lib/version.mjs';
import { buildContext, ensurePreflight } from '../lib/context.mjs';
import { runReporters } from '../reporters/index.mjs';

// SECTION: Pure helpers (exported for testability)

/**
 * Compute the process exit code for a summary given a `failOnFindings`
 * policy. Pa11y-compatible semantics: exit 0 when the run is clean,
 * exit 2 when at least `threshold` findings match the impact set OR
 * classification set. The bin/wcag-em.mjs Commander entry already
 * threads the returned code into `process.exitCode`.
 *
 * Guards: missing / non-object policy → 0 (feature off); threshold not
 * a positive integer → 0 (schema minimum is 0, so 0 is a valid "off"
 * signal that we must not accidentally treat as "trip on every run").
 *
 * Counts GROUPS of findings (one entry per axe rule), not occurrences.
 * This matches the canonical plan's default `threshold: 1` semantic —
 * any critical/serious finding fails. If occurrence-level counting is
 * ever wanted, the schema can grow a `mode` field later.
 *
 * @param {{ findings?: Array<{ impact?: string|null, classification?: string }> }} summary
 * @param {{ impacts?: string[], classifications?: string[], threshold?: number } | null | undefined} failOnFindings
 * @returns {number} Process exit code: 0 (clean) or 2 (threshold hit).
 */
export function computeExitCode(summary, failOnFindings) {
  if (!failOnFindings || typeof failOnFindings !== 'object') return 0;
  const threshold = Number(failOnFindings.threshold);
  if (!Number.isFinite(threshold) || threshold <= 0) return 0;
  const impacts = new Set(Array.isArray(failOnFindings.impacts) ? failOnFindings.impacts : []);
  const classifications = new Set(
    Array.isArray(failOnFindings.classifications) ? failOnFindings.classifications : [],
  );
  if (impacts.size === 0 && classifications.size === 0) return 0;
  const findings = Array.isArray(summary?.findings) ? summary.findings : [];
  let count = 0;
  for (const f of findings) {
    const impactHit = typeof f.impact === 'string' && impacts.has(f.impact);
    const classificationHit =
      typeof f.classification === 'string' && classifications.has(f.classification);
    if (impactHit || classificationHit) {
      count += 1;
      if (count >= threshold) return 2;
    }
  }
  return 0;
}

/**
 * Build the execution-health block from the raw stage artefacts.
 *
 * The scan and scan-processes stages faithfully record their own failures
 * (`error` on a page-view entry or a process result; non-ok states in
 * `_preScanStates`), but until the 2026-06 review (finding C1) nothing
 * consumed them — a WCAG-EM Step 5 report could claim a sample of N pages
 * when M never loaded. This helper inverts those records into one block plus
 * human-readable warning strings for the existing scanWarnings channel.
 *
 * Counting model: a PAGE may be scanned at several viewports (page-views).
 * A page with zero failed views is fully scanned; with some failed views it
 * is degraded (it still contributes findings); with zero successful views it
 * is failed and contributed nothing to any verdict.
 *
 * Pure; exported for testability.
 *
 * @param {{
 *   axeResults?: any[],
 *   processResults?: any[],
 *   sampleMetadata?: Record<string, any>,
 *   inventoryMetadata?: Record<string, any>,
 * }} args
 * @returns {{ executionHealth: Record<string, any>, warnings: string[] }}
 */
export function buildExecutionHealth({
  axeResults,
  processResults,
  sampleMetadata,
  inventoryMetadata,
}) {
  /** @type {Map<string, { ok: any[], failed: Array<{ viewport: any, error: string, attempts: any }> }>} */
  const byUrl = new Map();
  /** @type {Array<{ url: string, viewport: any, action: any, state: string, error: any }>} */
  const preScanFailures = [];
  let pageViewsScanned = 0;
  let pageViewsFailed = 0;
  let pageViewsUnauditable = 0;
  /** @type {Map<string, Array<{ viewport: any, outcome: string, reason: any }>>} */
  const unauditableByUrl = new Map();

  for (const entry of Array.isArray(axeResults) ? axeResults : []) {
    // NOTE: never crash health accounting on a malformed entry — a failed
    // page-view with a missing/invalid url still counts under a sentinel
    // rather than throwing (normalizeUrl rejects non-URLs) or vanishing.
    const status = viewStatus(entry);
    // E4: a redirect-duplicate was already audited under its canonical (final)
    // URL — fold it (don't double-count or mis-bucket it as unauditable).
    if (status === 'redirect-duplicate') continue;

    // E4: key by the redirect-folded identity (finalUrl ?? url) so a redirect
    // source + target fold to one page, consistent with the grouped findings.
    // NOTE: never crash health accounting on a malformed entry — fall back to a
    // sentinel (viewIdentity already try/catches normalization).
    const rawId = entry?.finalUrl ?? entry?.url;
    const url = typeof rawId === 'string' && rawId ? viewIdentity(entry) : '(unknown-url)';

    // E1: three-way split. A could-not-audit view (challenge / empty) is neither
    // scanned nor failed — it goes in a distinct bucket so coverage counters and
    // the fully-scanned/degraded/failed page classification never see it (and so
    // an all-challenge page is NOT counted as "fully scanned"). An execution
    // error keeps its existing failed-path.
    if (status !== 'auditable' && status !== 'errored') {
      pageViewsUnauditable += 1;
      const views = unauditableByUrl.get(url) ?? [];
      views.push({
        viewport: entry.viewport ?? null,
        outcome: typeof entry?.pageOutcome === 'string' ? entry.pageOutcome : status,
        reason: entry?.degradedReason ?? null,
      });
      unauditableByUrl.set(url, views);
      continue;
    }

    let rec = byUrl.get(url);
    if (!rec) {
      rec = { ok: [], failed: [] };
      byUrl.set(url, rec);
    }
    if (status === 'errored') {
      pageViewsFailed += 1;
      rec.failed.push({
        viewport: entry.viewport ?? null,
        error: typeof entry?.error === 'string' ? entry.error : 'could not audit',
        attempts: entry.attempts ?? null,
      });
    } else {
      pageViewsScanned += 1;
      rec.ok.push(entry.viewport ?? null);
    }
    for (const s of Array.isArray(entry?._preScanStates) ? entry._preScanStates : []) {
      if (s?.state === 'error' || s?.state === 'step-timeout') {
        preScanFailures.push({
          url,
          viewport: entry.viewport ?? null,
          action: s.name ?? null,
          state: s.state,
          error: s.error ?? null,
        });
      }
    }
  }

  /** @type {Array<{ url: string, failures: any[] }>} */
  const pagesFailed = [];
  /** @type {Array<{ url: string, failures: any[] }>} */
  const pagesDegraded = [];
  let pagesFullyScanned = 0;
  for (const [url, rec] of byUrl) {
    if (rec.failed.length === 0) pagesFullyScanned += 1;
    else if (rec.ok.length === 0) pagesFailed.push({ url, failures: rec.failed });
    else pagesDegraded.push({ url, failures: rec.failed });
  }
  const byUrlAsc = (/** @type {{ url: string }} */ a, /** @type {{ url: string }} */ b) =>
    a.url < b.url ? -1 : a.url > b.url ? 1 : 0;
  pagesFailed.sort(byUrlAsc);
  pagesDegraded.sort(byUrlAsc);
  preScanFailures.sort(byUrlAsc);

  /** @type {Array<{ url: string, views: any[] }>} */
  const pagesUnauditable = [...unauditableByUrl.entries()]
    .map(([url, views]) => ({ url, views }))
    .sort(byUrlAsc);

  /** @type {Array<{ name: any, startUrl: any, error: string }>} */
  const processFailures = [];
  for (const proc of Array.isArray(processResults) ? processResults : []) {
    if (typeof proc?.error === 'string') {
      processFailures.push({
        name: proc.name ?? null,
        startUrl: proc.startUrl ?? null,
        error: proc.error,
      });
    }
  }

  // E1: per-state step failures (mirrors preScanFailures). The pre-existing
  // processFailures only catches a process-level `error`; a process whose goto
  // or an interior step errored records it as a degraded STATE, which a clean
  // executionHealth previously hid (the 12-step-failure defect).
  /** @type {Array<{ name: any, startUrl: any, state: string, error: any }>} */
  const processStepFailures = [];
  for (const proc of Array.isArray(processResults) ? processResults : []) {
    for (const state of Array.isArray(proc?.states) ? proc.states : []) {
      if (state?.state === 'error' || state?.state === 'step-timeout') {
        processStepFailures.push({
          name: proc.name ?? null,
          startUrl: proc.startUrl ?? null,
          state: state.state,
          error: state.error ?? null,
        });
      }
    }
  }
  processStepFailures.sort((a, b) =>
    String(a.startUrl) < String(b.startUrl) ? -1 : String(a.startUrl) > String(b.startUrl) ? 1 : 0,
  );

  const maxPagesConfigured = inventoryMetadata?.maxPagesConfigured ?? null;
  const reachedMaxPages = inventoryMetadata?.reachedMaxPages === true;

  // E5: surface force-included structured URLs that never made it into the
  // inventory (override visibility — R3). Annotate WHY: a URL that landed on a
  // challenge is `blocked`; otherwise the crawl simply did not reach it
  // (`not-in-inventory`) — opposite treatments (re-scan vs widen the crawl).
  const challengeUrlSet = new Set(
    pagesUnauditable
      .filter((p) => p.views.some((v) => v.outcome === 'challenge'))
      .map((p) => p.url),
  );
  const structuredMissingFromInventory = (
    Array.isArray(sampleMetadata?.structuredMissingFromInventory)
      ? sampleMetadata.structuredMissingFromInventory
      : []
  ).map((u) => {
    let key;
    try {
      key = normalizeUrl(u);
    } catch {
      key = u;
    }
    return { url: u, reason: challengeUrlSet.has(key) ? 'blocked' : 'not-in-inventory' };
  });

  const executionHealth = {
    sampleListedCount: sampleMetadata?.finalSampleCount ?? null,
    pagesInSample: byUrl.size,
    pagesFullyScanned,
    pagesDegraded,
    pagesFailed,
    // E1: pages that could not be audited (challenge/empty/redirect-duplicate)
    // — distinct from pagesFailed (execution faults), mirroring junit's
    // error-vs-failure split. challengePages is the count routed to manual review.
    pagesUnauditable,
    challengePages: pagesUnauditable.filter((p) => p.views.some((v) => v.outcome === 'challenge'))
      .length,
    // E5: force-included structured URLs missing from the inventory, annotated.
    structuredMissingFromInventory,
    pageViewsScanned,
    pageViewsFailed,
    pageViewsUnauditable,
    processFailures,
    processStepFailures,
    preScanFailures,
    maxPagesConfigured,
    reachedMaxPages,
  };

  /** @type {string[]} */
  const warnings = [];
  for (const p of pagesFailed) {
    warnings.push(
      `page failed to scan on all viewports: ${p.url} (${p.failures[0]?.error ?? 'unknown error'})`,
    );
  }
  for (const p of pagesDegraded) {
    warnings.push(
      `page failed on viewport(s) ${p.failures.map((f) => f.viewport).join(', ')}: ${p.url}`,
    );
  }
  for (const p of processFailures) {
    warnings.push(`process "${p.name}" failed at ${p.startUrl}: ${p.error}`);
  }
  for (const p of preScanFailures) {
    warnings.push(
      `pre-scan action "${p.action}" ${p.state} on ${p.url} [${p.viewport}] — axe scanned the page without the intended setup`,
    );
  }
  for (const p of pagesUnauditable) {
    const outcomes = [...new Set(p.views.map((v) => v.outcome))].join(', ');
    warnings.push(
      `could not audit (${outcomes}): ${p.url} — excluded from findings and SC verdicts, routed to manual review`,
    );
  }
  for (const p of processStepFailures) {
    warnings.push(
      `process "${p.name}" step "${p.state}" failed at ${p.startUrl}: ${p.error ?? 'unknown error'}`,
    );
  }
  for (const m of structuredMissingFromInventory) {
    warnings.push(
      m.reason === 'blocked'
        ? `force-included sample URL was blocked (challenge), not audited: ${m.url}`
        : `force-included sample URL is not in the crawl inventory: ${m.url} — verify it is reachable / in scope`,
    );
  }
  if (reachedMaxPages) {
    warnings.push(
      `crawl stopped at maxPages=${maxPagesConfigured}; the inventory (and therefore the sample) may be truncated`,
    );
  }

  return { executionHealth, warnings };
}

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ exitCode: number, summary: any }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;

  // ANCHOR: MarkdownReportDeprecated — DEFAULTS no longer inject
  // `reporting.markdownReport`, so the only way this field is truthy post-
  // merge is if the user explicitly set it in their config. Fire once per
  // run; the field is silently ignored either way (it never gated anything
  // at runtime).
  if (config.reporting?.markdownReport !== undefined) {
    warnLegacyAliasResolved(logger, {
      oldField: 'reporting.markdownReport',
      newField: 'reporting.reporters',
      guidance:
        "Omit the field to keep the default ['json','markdown'] set; or set reporters: ['json'] to disable markdown.",
    });
  }

  /** @type {[any[], Record<string, any>, any[], any[], Record<string, string[]>, Record<string, any>]} */
  const [inventory, sampleMetadata, axeResults, processResults, actMap, inventoryMetadata] =
    await Promise.all([
      readJsonMaybe(
        path.join(paths.inventoryDir, 'inventory.json'),
        /** @type {any[]} */ ([]),
        logger,
      ),
      readJsonMaybe(
        path.join(paths.inventoryDir, 'sample-metadata.json'),
        /** @type {Record<string, any>} */ ({}),
        logger,
      ),
      readJsonMaybe(
        path.join(paths.resultsDir, 'axe-results.json'),
        /** @type {any[]} */ ([]),
        logger,
      ),
      readJsonMaybe(
        path.join(paths.resultsDir, 'process-results.json'),
        /** @type {any[]} */ ([]),
        logger,
      ),
      readJsonMaybe(
        new URL('../data/act-rule-map.json', import.meta.url).pathname,
        /** @type {Record<string, string[]>} */ ({}),
        logger,
      ),
      readJsonMaybe(
        path.join(paths.inventoryDir, 'inventory-metadata.json'),
        /** @type {Record<string, any>} */ ({}),
        logger,
      ),
    ]);

  // ANCHOR: ActMapFallback — announce degraded enrichment once if map is empty.
  // withActAndWcagMetadata is called at every classifyRule call site; if
  // the map is missing/empty, findings carry `actRuleIds: []`. Debug-only —
  // not an error, since the scan is still useful without ACT enrichment.
  const actMapKeys = Object.keys(actMap);
  if (actMapKeys.length === 0) {
    logger.debug(
      { source: 'src/data/act-rule-map.json' },
      'act-rule-map.json missing or empty; actRuleIds will be [] on all findings',
    );
  }

  /** @type {Map<string, any>} */
  const inventoryByUrl = new Map(inventory.map((item) => [item.url, item]));
  const structuredSet = new Set(
    (
      await fs
        .readFile(path.join(paths.inventoryDir, 'structured-sample.txt'), 'utf8')
        .catch(() => '')
    )
      .split(/\r?\n/)
      .filter(Boolean),
  );
  const randomSet = new Set(
    (await fs.readFile(path.join(paths.inventoryDir, 'random-sample.txt'), 'utf8').catch(() => ''))
      .split(/\r?\n/)
      .filter(Boolean),
  );

  // SECTION: Grouping
  // Extracted to lib/group-findings.mjs so the two cross-cutting epics that edit
  // it (E1 skip non-auditable views; E4 group by final-URL identity) touch a
  // small, unit-testable function rather than this command body.
  const {
    groupedByRule,
    groupedByComponent,
    structuredRuleIds,
    randomClusters,
    structuredClusters,
  } = groupFindings(axeResults, processResults, {
    actMap,
    inventoryByUrl,
    structuredSet,
    randomSet,
    reportingConfig: config.reporting,
  });

  // SECTION: Incomplete grouping (needs-review items for reporters)
  /**
   * Accumulate one page/state's incomplete-rule detail into its grouped entry,
   * mirroring `addRuleFinding`: count every reviewable node (`nodesCount`),
   * collect distinct selectors, and keep up to 5 HTML examples for evidence.
   *
   * @param {any} entry
   * @param {{ nodesCount?: number, examples?: Array<{ target?: string|null, html?: string|null, failureSummary?: string|null }> }} inc
   * @param {string} pageUrl
   */
  const accumulateIncomplete = (entry, inc, pageUrl) => {
    entry.pages.add(pageUrl);
    entry.occurrences += typeof inc.nodesCount === 'number' ? inc.nodesCount : 0;
    for (const ex of Array.isArray(inc.examples) ? inc.examples : []) {
      if (ex.target) entry.targets.add(ex.target);
      if (entry.examples.length < 5) {
        entry.examples.push({
          pageUrl,
          target: ex.target ?? null,
          html: ex.html ?? null,
          failureSummary: ex.failureSummary ?? null,
        });
      }
    }
  };
  /** @type {Map<string, any>} */
  const incompletesByRule = new Map();
  for (const pageResult of axeResults) {
    if (!isAuditableView(pageResult)) continue;
    const pageUrl = viewIdentity(pageResult);
    for (const inc of pageResult.incompleteDetail ?? []) {
      if (inc.nodesCount === 0) continue;
      const key = inc.id;
      if (!incompletesByRule.has(key)) {
        const meta = withActAndWcagMetadata(inc, { actMap, reportingConfig: config.reporting });
        incompletesByRule.set(key, {
          id: inc.id,
          impact: inc.impact ?? null,
          help: inc.help ?? null,
          helpUrl: inc.helpUrl ?? null,
          tags: inc.tags ?? [],
          classification: 'needs-review',
          actRuleIds: meta.actRuleIds,
          wcagCriteria: meta.wcagCriteria,
          occurrences: 0,
          pages: new Set(),
          targets: new Set(),
          examples: [],
          firstTarget: inc.firstTarget ?? null,
        });
      }
      accumulateIncomplete(incompletesByRule.get(key), inc, pageUrl);
    }
  }
  for (const processResult of processResults) {
    if (!isAuditableView(processResult)) continue;
    const processUrl = normalizeUrl(processResult.startUrl);
    for (const state of processResult.states || []) {
      if (!isAuditableView(state)) continue;
      for (const inc of state.incompleteDetail ?? []) {
        if (inc.nodesCount === 0) continue;
        const key = inc.id;
        if (!incompletesByRule.has(key)) {
          const meta = withActAndWcagMetadata(inc, { actMap, reportingConfig: config.reporting });
          incompletesByRule.set(key, {
            id: inc.id,
            impact: inc.impact ?? null,
            help: inc.help ?? null,
            helpUrl: inc.helpUrl ?? null,
            tags: inc.tags ?? [],
            classification: 'needs-review',
            actRuleIds: meta.actRuleIds,
            wcagCriteria: meta.wcagCriteria,
            occurrences: 0,
            pages: new Set(),
            targets: new Set(),
            examples: [],
            firstTarget: inc.firstTarget ?? null,
          });
        }
        accumulateIncomplete(incompletesByRule.get(key), inc, processUrl);
      }
    }
  }
  const incompleteFindings = [...incompletesByRule.values()]
    .map((item) => ({
      ...item,
      pages: [...item.pages].sort(),
      pageCount: item.pages.size,
      targets: [...item.targets].sort(),
    }))
    .sort((a, b) => {
      /** @type {Record<string, number>} */
      const impactOrder = { critical: 4, serious: 3, moderate: 2, minor: 1, null: 0 };
      const delta = (impactOrder[b.impact ?? 'null'] ?? 0) - (impactOrder[a.impact ?? 'null'] ?? 0);
      if (delta !== 0) return delta;
      // ruleId asc tiebreak — matches `sortFindings` so html/markdown/junit order
      // needs-review consistently (they consume this list without re-sorting).
      const aId = typeof a.id === 'string' ? a.id : '';
      const bId = typeof b.id === 'string' ? b.id : '';
      return aId < bId ? -1 : aId > bId ? 1 : 0;
    });

  // SECTION: Sort + flatten for emit
  const groupedFindings = [...groupedByRule.values()]
    .map((item) => ({
      ...item,
      pages: [...item.pages].sort(),
      pageCount: item.pages.size,
      targets: [...item.targets].sort(),
      sourceTypes: [...item.sourceTypes].sort(),
      pageTypes: [...item.pageTypes].sort(),
      clusters: [...item.clusters].sort(),
    }))
    .sort((a, b) => {
      /** @type {Record<string, number>} */
      const impactOrder = { critical: 4, serious: 3, moderate: 2, minor: 1, null: 0 };
      return (impactOrder[b.impact ?? 'null'] ?? 0) - (impactOrder[a.impact ?? 'null'] ?? 0);
    });

  const groupedComponents = [...groupedByComponent.values()]
    .map((item) => ({
      ...item,
      pages: [...item.pages].sort(),
      pageCount: item.pages.size,
      targets: [...item.targets].sort(),
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.key.localeCompare(b.key));

  /** @type {Set<string>} */
  const ruleIdsSeenInRandom = new Set();
  for (const pageResult of axeResults.filter(
    (item) => isAuditableView(item) && randomSet.has(normalizeUrl(item.url)),
  )) {
    for (const violation of pageResult.violations || []) ruleIdsSeenInRandom.add(violation.id);
  }
  const newRuleIdsOnlyInRandom = [...ruleIdsSeenInRandom]
    .filter((id) => !structuredRuleIds.has(id))
    .sort();
  const newClustersOnlyInRandom = [...randomClusters]
    .filter((key) => !structuredClusters.has(key))
    .sort();

  const comparison = {
    randomSampleIntroducedNewRuleIds: newRuleIdsOnlyInRandom,
    randomSampleIntroducedNewClusters: newClustersOnlyInRandom,
    expandStructuredSampleRecommended:
      newRuleIdsOnlyInRandom.length > 0 || newClustersOnlyInRandom.length > 0,
  };

  // ANCHOR: WcagEmSummary — per-SC inversion.
  // toWcagEmSummary ingests the widened axe artefact (passesDetail etc.)
  // and emits EARL-aligned criteriaOutcomes. scanWarnings surfaces infra
  // failures that did not elevate to SC verdicts.
  const wcagEmSummary = toWcagEmSummary(ctx, { axeResults, processResults, sampleMetadata });

  // ANCHOR: ExecutionHealth — invert stage-recorded failures into the summary
  // (2026-06 review C1). samplePagesScanned counts PAGES with at least one
  // successful view (fully scanned + degraded); page-views and failures are
  // carried separately so coverage claims stop conflating the three.
  const { executionHealth, warnings: executionWarnings } = buildExecutionHealth({
    axeResults,
    processResults,
    sampleMetadata,
    inventoryMetadata,
  });

  const summary = {
    tool: TOOL_IDENTITY,
    site: config.name,
    generatedAt: new Date().toISOString(),
    inventoryCount: sampleMetadata.inventoryCount ?? inventory.length,
    finalSampleCount: sampleMetadata.finalSampleCount ?? axeResults.length,
    samplePagesScanned: executionHealth.pagesFullyScanned + executionHealth.pagesDegraded.length,
    pageViewsScanned: executionHealth.pageViewsScanned,
    processRuns: processResults.length,
    groupedFindingCount: groupedFindings.length,
    groupedComponentCount: groupedComponents.length,
    comparison,
    findings: groupedFindings,
    incompleteFindings,
    executionHealth,
    // Surface infra-failure incompletes AND execution failures in the
    // top-level summary too, not just the WCAG-EM artefact (cross-consumer
    // visibility).
    scanWarnings: [...wcagEmSummary.scanWarnings, ...executionWarnings],
    wcagEmSummary,
  };

  // SECTION: Persist artefacts
  // Report emission delegated to the reporter registry. The four
  // `writeJson` calls + `manual-backlog.md` writeText below stay inline —
  // they are analytical side-artefacts that always write regardless of
  // `reporting.reporters` config (per ADR-0008's reporter-vs-side-artefact
  // split).
  const resolvedReporters = Array.isArray(config.reporting?.reporters)
    ? config.reporting.reporters
    : ['json', 'markdown'];
  const reporterOutcome = await runReporters(resolvedReporters, summary, ctx);
  for (const failure of reporterOutcome.errors) {
    logger.error(
      { reporter: failure.name, err: { name: failure.error.name, message: failure.error.message } },
      'reporter failed',
    );
  }
  await writeJson(path.join(paths.reportsDir, 'grouped-by-rule.json'), groupedFindings);
  await writeJson(path.join(paths.reportsDir, 'grouped-by-component.json'), groupedComponents);
  await writeJson(path.join(paths.reportsDir, 'random-vs-structured-comparison.json'), {
    tool: TOOL_IDENTITY,
    ...comparison,
  });
  // WCAG-EM Step 5 artefact. Stamped with tool-identity as the first property.
  await writeJson(path.join(paths.reportsDir, 'wcag-em-summary.json'), {
    tool: TOOL_IDENTITY,
    ...wcagEmSummary,
  });

  // ANCHOR: ManualBacklog — findings-aware + evidence-driven (E7). Prepend the
  // markdown tool-identity header.
  const documentInventory = await readJsonMaybe(
    path.join(paths.inventoryDir, 'document-inventory.json'),
    /** @type {Record<string, any>} */ ({}),
    logger,
  );
  await writeText(
    path.join(paths.reportsDir, 'manual-backlog.md'),
    toolIdentityMarkdownHeader() +
      buildManualBacklog({
        findings: groupedFindings,
        inventory,
        processes: config.processes ?? [],
        // E7: multi-viewport screenshots → "screenshots to eyeball" (responsive
        // overlap candidates); keyed by the redirect-folded identity.
        screenshots: axeResults
          .filter((r) => isAuditableView(r) && typeof r.screenshot === 'string')
          .map((r) => ({ url: viewIdentity(r), viewport: r.viewport, screenshot: r.screenshot })),
        // E7: the could-not-auto-audit hand-off — challenge/blocked pages (after
        // §0a) + the PDF document inventory.
        manualReview: {
          challengePages: (executionHealth.pagesUnauditable ?? []).map(
            (/** @type {any} */ p) => p.url,
          ),
          documents: Array.isArray(documentInventory?.documents) ? documentInventory.documents : [],
        },
      }),
  );

  // ANCHOR: MarkdownReport — the reporter pipeline absorbed the inline string-assembly
  // block into `src/reporters/markdown.mjs`; the `runReporters` call above
  // now writes `summary.md` via the registry when 'markdown' is in the
  // resolved reporter list (default ['json','markdown']).

  // Compose the exit code: `computeExitCode` returns 0 (clean) or 2
  // (failOnFindings threshold hit). Reporter errors bump to 1, but never
  // override 2 — the threshold-hit signal is the stronger CI signal and
  // wins when both are present.
  const baseExitCode = computeExitCode(summary, config.reporting?.failOnFindings);
  const exitCode = Math.max(baseExitCode, reporterOutcome.errors.length > 0 ? 1 : 0);
  logger.info(
    {
      findings: summary.groupedFindingCount,
      reportsDir: paths.reportsDir,
      exitCode,
      reporters: reporterOutcome.results.map((r) => r.name),
      reporterErrors: reporterOutcome.errors.length,
    },
    'summarize done',
  );

  return { exitCode, summary };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: false });
  await run(ctx);
}
