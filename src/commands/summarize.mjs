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
 * Layer 3b adds per-SC inversion (WCAG-EM Step 5 shape) + findings-aware
 * manual backlog + tool-identity stamp.
 * Layer 4 replaces the inline Markdown emission with pluggable reporters.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';
import { readJsonMaybe, writeJson, writeText } from '../lib/fs-utils.mjs';
import { selectorComponentHint } from '../lib/urls.mjs';
import { classifyRule, withActAndWcagMetadata } from '../lib/axe-utils.mjs';
import { warnSchemaAcceptedRuntimeIgnored, warnLegacyAliasResolved } from '../lib/auth.mjs';
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

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ exitCode: number, summary: any }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;

  // ANCHOR: ReportersWarn — uses the shared warnSchemaAcceptedRuntimeIgnored
  // helper (Layer 3b R3) for discipline symmetry with auth.setupScript. The
  // schema accepts `reporting.reporters` (Layer 4's pluggable-reporter
  // surface) but the runtime hard-codes JSON + Markdown today.
  if (Array.isArray(config.reporting?.reporters) && config.reporting.reporters.length > 0) {
    warnSchemaAcceptedRuntimeIgnored(logger, {
      feature: 'reporting.reporters',
      deferralLayer: 'Layer 4',
    });
  }

  // ANCHOR: MarkdownReportDeprecated — Layer 4 R2. DEFAULTS no longer injects
  // `reporting.markdownReport`, so the only way this field is truthy post-
  // merge is if the user explicitly set it in their config. Fire once per
  // run; the field is silently ignored either way (it never gated anything
  // at runtime — see Layer 4 plan adversarial finding #1 + Layer 4 R2 body).
  if (config.reporting?.markdownReport !== undefined) {
    warnLegacyAliasResolved(logger, {
      oldField: 'reporting.markdownReport',
      newField: 'reporting.reporters',
      guidance:
        "Omit the field to keep the default ['json','markdown'] set; or set reporters: ['json'] to disable markdown.",
    });
  }

  /** @type {[any[], Record<string, any>, any[], any[], Record<string, string[]>]} */
  const [inventory, sampleMetadata, axeResults, processResults, actMap] = await Promise.all([
    readJsonMaybe(path.join(paths.inventoryDir, 'inventory.json'), /** @type {any[]} */ ([])),
    readJsonMaybe(
      path.join(paths.inventoryDir, 'sample-metadata.json'),
      /** @type {Record<string, any>} */ ({}),
    ),
    readJsonMaybe(path.join(paths.resultsDir, 'axe-results.json'), /** @type {any[]} */ ([])),
    readJsonMaybe(path.join(paths.resultsDir, 'process-results.json'), /** @type {any[]} */ ([])),
    readJsonMaybe(
      new URL('../data/act-rule-map.json', import.meta.url).pathname,
      /** @type {Record<string, string[]>} */ ({}),
    ),
  ]);

  // ANCHOR: ActMapFallback — announce degraded enrichment once if map is empty.
  // R12 wires R2's withActAndWcagMetadata at every classifyRule call site; if
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
  /** @type {Map<string, any>} */
  const groupedByRule = new Map();
  /** @type {Map<string, any>} */
  const groupedByComponent = new Map();
  /** @type {Set<string>} */
  const structuredRuleIds = new Set();
  /** @type {Set<string>} */
  const randomClusters = new Set();
  /** @type {Set<string>} */
  const structuredClusters = new Set();

  /**
   * @param {{ sourceType: string, pageUrl: string, rule: any, target: string | null, html: string | null }} f
   */
  function addRuleFinding({ sourceType, pageUrl, rule, target, html }) {
    const key = rule.id;
    if (!groupedByRule.has(key)) {
      const meta = withActAndWcagMetadata(rule, { actMap, reportingConfig: config.reporting });
      groupedByRule.set(key, {
        id: rule.id,
        impact: rule.impact ?? null,
        help: rule.help ?? null,
        helpUrl: rule.helpUrl ?? null,
        tags: rule.tags ?? [],
        classification: meta.classification,
        actRuleIds: meta.actRuleIds,
        wcagCriteria: meta.wcagCriteria,
        occurrences: 0,
        pages: new Set(),
        targets: new Set(),
        examples: [],
        sourceTypes: new Set(),
        pageTypes: new Set(),
        clusters: new Set(),
      });
    }
    const entry = groupedByRule.get(key);
    entry.occurrences += 1;
    entry.pages.add(pageUrl);
    entry.sourceTypes.add(sourceType);
    if (target) entry.targets.add(target);
    const inv = inventoryByUrl.get(pageUrl);
    if (inv?.pageType) entry.pageTypes.add(inv.pageType);
    if (inv?.clusterKey) entry.clusters.add(inv.clusterKey);
    if (entry.examples.length < 5) entry.examples.push({ pageUrl, target, html });

    if (structuredSet.has(pageUrl)) structuredRuleIds.add(rule.id);
    if (structuredSet.has(pageUrl) && inv?.clusterKey) structuredClusters.add(inv.clusterKey);
    if (randomSet.has(pageUrl) && inv?.clusterKey) randomClusters.add(inv.clusterKey);
  }

  /**
   * @param {{ pageUrl: string, rule: any, target: string | null }} f
   */
  function addComponentFinding({ pageUrl, rule, target }) {
    const componentHint = selectorComponentHint(target ?? '');
    const key = `${rule.id}::${componentHint}`;
    if (!groupedByComponent.has(key)) {
      const meta = withActAndWcagMetadata(rule, { actMap, reportingConfig: config.reporting });
      groupedByComponent.set(key, {
        key,
        actRuleIds: meta.actRuleIds,
        wcagCriteria: meta.wcagCriteria,
        ruleId: rule.id,
        componentHint,
        impact: rule.impact ?? null,
        classification: classifyRule(rule, config.reporting).classification,
        pages: new Set(),
        targets: new Set(),
        occurrences: 0,
      });
    }
    const entry = groupedByComponent.get(key);
    entry.occurrences += 1;
    entry.pages.add(pageUrl);
    if (target) entry.targets.add(target);
  }

  for (const pageResult of axeResults) {
    for (const violation of pageResult.violations || []) {
      for (const node of violation.nodes || []) {
        const target = Array.isArray(node.target) ? node.target.join(' | ') : null;
        addRuleFinding({
          sourceType: 'page-scan',
          pageUrl: pageResult.url,
          rule: violation,
          target,
          html: node.html ?? null,
        });
        addComponentFinding({ pageUrl: pageResult.url, rule: violation, target });
      }
    }
  }

  for (const processResult of processResults) {
    for (const state of processResult.states || []) {
      for (const violation of state.violations || []) {
        for (const node of violation.nodes || []) {
          const target = Array.isArray(node.target) ? node.target.join(' | ') : null;
          addRuleFinding({
            sourceType: `process:${processResult.name}:${state.state}`,
            pageUrl: processResult.startUrl,
            rule: violation,
            target,
            html: node.html ?? null,
          });
          addComponentFinding({ pageUrl: processResult.startUrl, rule: violation, target });
        }
      }
    }
  }

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
  for (const pageResult of axeResults.filter((item) => randomSet.has(item.url))) {
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

  // ANCHOR: WcagEmSummary — Layer 3b R12 per-SC inversion.
  // toWcagEmSummary ingests the widened axe artefact (passesDetail etc from R6)
  // and emits EARL-aligned criteriaOutcomes. scanWarnings surfaces infra
  // failures (F8) that did not elevate to SC verdicts.
  const wcagEmSummary = toWcagEmSummary(ctx, { axeResults, processResults });

  const summary = {
    tool: TOOL_IDENTITY,
    site: config.name,
    generatedAt: new Date().toISOString(),
    inventoryCount: sampleMetadata.inventoryCount ?? inventory.length,
    finalSampleCount: sampleMetadata.finalSampleCount ?? axeResults.length,
    samplePagesScanned: axeResults.length,
    processRuns: processResults.length,
    groupedFindingCount: groupedFindings.length,
    groupedComponentCount: groupedComponents.length,
    comparison,
    findings: groupedFindings,
    // Layer 3b R12: surface infra-failure incompletes in the top-level
    // summary too, not just the WCAG-EM artefact (cross-consumer visibility).
    scanWarnings: wcagEmSummary.scanWarnings,
  };

  // SECTION: Persist artefacts
  // Layer 4 R3-R4: report emission delegated to the registry. The four
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
  // Layer 3b R12 — new WCAG-EM Step 5 artefact. Stamped with tool-identity
  // as the first property.
  await writeJson(path.join(paths.reportsDir, 'wcag-em-summary.json'), {
    tool: TOOL_IDENTITY,
    ...wcagEmSummary,
  });

  // ANCHOR: ManualBacklog — findings-aware (R9). Replaces the Layer 1 static
  // template. Prepend the markdown tool-identity header per R13 spec.
  await writeText(
    path.join(paths.reportsDir, 'manual-backlog.md'),
    toolIdentityMarkdownHeader() +
      buildManualBacklog({
        findings: groupedFindings,
        inventory,
        processes: config.processes ?? [],
      }),
  );

  // ANCHOR: MarkdownReport — Layer 4 R4 absorbed the inline string-assembly
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
