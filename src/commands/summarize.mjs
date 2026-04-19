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
import { classifyRule } from '../lib/axe-utils.mjs';
import { buildContext } from '../lib/context.mjs';

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ exitCode: number, summary: any }>}
 */
export async function run(ctx) {
  const { config, logger, paths } = ctx;

  /** @type {[any[], Record<string, any>, any[], any[]]} */
  const [inventory, sampleMetadata, axeResults, processResults] = await Promise.all([
    readJsonMaybe(path.join(paths.inventoryDir, 'inventory.json'), /** @type {any[]} */ ([])),
    readJsonMaybe(
      path.join(paths.inventoryDir, 'sample-metadata.json'),
      /** @type {Record<string, any>} */ ({}),
    ),
    readJsonMaybe(path.join(paths.resultsDir, 'axe-results.json'), /** @type {any[]} */ ([])),
    readJsonMaybe(path.join(paths.resultsDir, 'process-results.json'), /** @type {any[]} */ ([])),
  ]);

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
      groupedByRule.set(key, {
        id: rule.id,
        impact: rule.impact ?? null,
        help: rule.help ?? null,
        helpUrl: rule.helpUrl ?? null,
        tags: rule.tags ?? [],
        classification: classifyRule(rule, config.reporting).classification,
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
      groupedByComponent.set(key, {
        key,
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

  const summary = {
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
  };

  // SECTION: Persist artefacts
  await writeJson(path.join(paths.reportsDir, 'summary.json'), summary);
  await writeJson(path.join(paths.reportsDir, 'grouped-by-rule.json'), groupedFindings);
  await writeJson(path.join(paths.reportsDir, 'grouped-by-component.json'), groupedComponents);
  await writeJson(path.join(paths.reportsDir, 'random-vs-structured-comparison.json'), comparison);

  // ANCHOR: ManualBacklog — static template in Layer 1; findings-aware in Layer 3b
  const manualBacklog = [
    '# Manual testing backlog',
    '',
    'Use this after the automated run. Add notes and outcomes per item.',
    '',
    '- [ ] Keyboard-only path through homepage and main navigation',
    '- [ ] Skip link behaviour and focus destination',
    '- [ ] Landmark navigation with screen reader',
    '- [ ] Heading structure and page outline review',
    '- [ ] Forms: visible labels, instructions, error handling, focus return, announcements',
    '- [ ] Zoom/reflow at 320 CSS px equivalent',
    '- [ ] Text spacing and clipping checks',
    '- [ ] Name/role/value review for custom controls',
    '- [ ] Complete-process walkthroughs for all configured processes',
    '',
    '## Notes',
    '',
  ];
  await writeText(path.join(paths.reportsDir, 'manual-backlog.md'), manualBacklog.join('\n'));

  // ANCHOR: MarkdownReport — replaced by pluggable reporter in Layer 4
  const md = [
    '# Accessibility scan summary',
    '',
    `Site: **${config.name}**`,
    `Generated: ${summary.generatedAt}`,
    '',
    '## Method guardrails',
    '',
    '- This is the automated layer of the audit workflow.',
    '- It does not make a sitewide WCAG conformance claim on its own.',
    '- Complete processes and manual checks still need separate review.',
    '',
    '## Run summary',
    '',
    `- Inventory count: ${summary.inventoryCount}`,
    `- Final selected sample: ${summary.finalSampleCount}`,
    `- Sample pages scanned: ${summary.samplePagesScanned}`,
    `- Process runs: ${summary.processRuns}`,
    `- Grouped findings: ${summary.groupedFindingCount}`,
    '',
    '## Random vs structured sample comparison',
    '',
    `- New rule IDs found only in random sample: ${comparison.randomSampleIntroducedNewRuleIds.length}`,
    `- New clusters found only in random sample: ${comparison.randomSampleIntroducedNewClusters.length}`,
    `- Expand structured sample recommended: ${comparison.expandStructuredSampleRecommended ? 'yes' : 'no'}`,
    '',
    '## Grouped findings by rule',
    '',
  ];

  for (const item of groupedFindings) {
    md.push(`### ${item.id}`);
    md.push(`- Impact: ${item.impact ?? 'n/a'}`);
    md.push(`- Classification: ${item.classification}`);
    md.push(`- Pages affected: ${item.pageCount}`);
    if (item.pageTypes.length) md.push(`- Page types: ${item.pageTypes.join(', ')}`);
    if (item.help) md.push(`- Help: ${item.help}`);
    if (item.helpUrl) md.push(`- Rule URL: ${item.helpUrl}`);
    if (item.targets.length) md.push(`- Example target: \`${item.targets[0]}\``);
    md.push('');
  }

  await writeText(path.join(paths.reportsDir, 'summary.md'), md.join('\n'));
  logger.info(
    { findings: summary.groupedFindingCount, reportsDir: paths.reportsDir },
    'summarize done',
  );

  // NOTE: exit code policy lands in Layer 3. For Layer 1 transition, any run is 0.
  return { exitCode: 0, summary };
}

// SECTION: Standalone runner
if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx = await buildContext({ requirePlaywright: false });
  await run(ctx);
}
