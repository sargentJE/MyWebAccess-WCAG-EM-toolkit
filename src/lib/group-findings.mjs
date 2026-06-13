// @ts-check
/**
 * @file Group raw axe/process violations into per-rule and per-component findings.
 * @module lib/group-findings
 *
 * @description
 * Extracted verbatim from `summarize.run()` (which had grown into a ~450-line
 * function that several epics edit at once). Walks every page-result's and
 * process-state's violations once, bucketing them by axe rule-id and by
 * (rule-id x component-hint), and records which buckets the structured vs random
 * sample tiers touched (the WCAG-EM Step 3c comparison signal).
 *
 * Pure: no I/O. All run-scoped context (the ACT map, the inventory lookup, the
 * structured/random sample sets, the reporting config) is passed in, so the
 * grouping is unit-testable in isolation and the two cross-cutting epics that
 * edit it — E1 (skip non-auditable views) and E4 (group by final-URL identity)
 * — touch a small focused function rather than the summarize command body.
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 */

// SECTION: Imports
import { normalizeUrl, selectorComponentHint } from './urls.mjs';
import { classifyRule, withActAndWcagMetadata } from './axe-utils.mjs';
import { isAuditableView } from './scan-results.mjs';

// SECTION: Public API

/**
 * @typedef {object} GroupFindingsDeps
 * @property {Record<string, string[]>} actMap - ACT rule-id map for metadata enrichment.
 * @property {Map<string, any>} inventoryByUrl - Inventory items keyed by normalised URL.
 * @property {Set<string>} structuredSet - Normalised URLs in the structured sample.
 * @property {Set<string>} randomSet - Normalised URLs in the random sample.
 * @property {Record<string, any>} [reportingConfig] - `config.reporting`, for classification.
 */

/**
 * @typedef {object} GroupedFindings
 * @property {Map<string, any>} groupedByRule - Findings grouped by axe rule-id.
 * @property {Map<string, any>} groupedByComponent - Findings grouped by rule-id x component-hint.
 * @property {Set<string>} structuredRuleIds - Rule-ids the structured sample touched.
 * @property {Set<string>} randomClusters - Cluster keys the random sample touched.
 * @property {Set<string>} structuredClusters - Cluster keys the structured sample touched.
 */

/**
 * Group axe + process violations by rule and by (rule x component-hint).
 *
 * @param {any[]} axeResults - Page-view results from `axe-results.json`.
 * @param {any[]} processResults - Process results from `process-results.json`.
 * @param {GroupFindingsDeps} deps
 * @returns {GroupedFindings}
 */
export function groupFindings(axeResults, processResults, deps) {
  const { actMap, inventoryByUrl, structuredSet, randomSet, reportingConfig } = deps;

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
   * @param {{ sourceType: string, pageUrl: string, rule: any, target: string | null, html: string | null, failureSummary?: string | null }} f
   */
  function addRuleFinding({ sourceType, pageUrl, rule, target, html, failureSummary = null }) {
    const key = rule.id;
    if (!groupedByRule.has(key)) {
      const meta = withActAndWcagMetadata(rule, { actMap, reportingConfig });
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
    if (entry.examples.length < 5) entry.examples.push({ pageUrl, target, html, failureSummary });

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
      const meta = withActAndWcagMetadata(rule, { actMap, reportingConfig });
      groupedByComponent.set(key, {
        key,
        actRuleIds: meta.actRuleIds,
        wcagCriteria: meta.wcagCriteria,
        ruleId: rule.id,
        componentHint,
        impact: rule.impact ?? null,
        classification: classifyRule(rule, reportingConfig).classification,
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
    // E1: a could-not-audit page-view (challenge/empty/errored/redirect-dup)
    // carries no real findings and must not enter the grouped output.
    if (!isAuditableView(pageResult)) continue;
    const pageUrl = normalizeUrl(pageResult.url);
    for (const violation of pageResult.violations || []) {
      for (const node of violation.nodes || []) {
        const target = Array.isArray(node.target) ? node.target.join(' | ') : null;
        addRuleFinding({
          sourceType: 'page-scan',
          pageUrl,
          rule: violation,
          target,
          html: node.html ?? null,
          failureSummary: typeof node.failureSummary === 'string' ? node.failureSummary : null,
        });
        addComponentFinding({ pageUrl, rule: violation, target });
      }
    }
  }

  for (const processResult of processResults) {
    if (!isAuditableView(processResult)) continue;
    const processUrl = normalizeUrl(processResult.startUrl);
    for (const state of processResult.states || []) {
      // E1: skip degraded/errored states — they reflect a broken process step,
      // not a genuine accessibility finding.
      if (!isAuditableView(state)) continue;
      for (const violation of state.violations || []) {
        for (const node of violation.nodes || []) {
          const target = Array.isArray(node.target) ? node.target.join(' | ') : null;
          addRuleFinding({
            sourceType: `process:${processResult.name}:${state.state}`,
            pageUrl: processUrl,
            rule: violation,
            target,
            html: node.html ?? null,
            failureSummary: typeof node.failureSummary === 'string' ? node.failureSummary : null,
          });
          addComponentFinding({ pageUrl: processUrl, rule: violation, target });
        }
      }
    }
  }

  return {
    groupedByRule,
    groupedByComponent,
    structuredRuleIds,
    randomClusters,
    structuredClusters,
  };
}
