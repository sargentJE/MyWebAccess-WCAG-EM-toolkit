import fs from 'node:fs/promises';
import path from 'node:path';
import { loadConfig } from './lib/config.mjs';
import { ensureDir, readJsonMaybe, writeJson, writeText } from './lib/fs-utils.mjs';
import { selectorComponentHint } from './lib/urls.mjs';
import { classifyRule } from './lib/axe-utils.mjs';

const { config } = await loadConfig();
const inventoryDir = await ensureDir('output', 'inventory');
const resultsDir = await ensureDir('output', 'results');
const reportsDir = await ensureDir('output', 'reports');

const [inventory, sampleMetadata, axeResults, processResults] = await Promise.all([
  readJsonMaybe(path.join(inventoryDir, 'inventory.json'), []),
  readJsonMaybe(path.join(inventoryDir, 'sample-metadata.json'), {}),
  readJsonMaybe(path.join(resultsDir, 'axe-results.json'), []),
  readJsonMaybe(path.join(resultsDir, 'process-results.json'), []),
]);

const inventoryByUrl = new Map(inventory.map((item) => [item.url, item]));
const structuredSet = new Set(
  (await fs.readFile(path.join(inventoryDir, 'structured-sample.txt'), 'utf8').catch(() => ''))
    .split(/\r?\n/)
    .filter(Boolean),
);
const randomSet = new Set(
  (await fs.readFile(path.join(inventoryDir, 'random-sample.txt'), 'utf8').catch(() => ''))
    .split(/\r?\n/)
    .filter(Boolean),
);

const groupedByRule = new Map();
const groupedByComponent = new Map();
const randomOnlyRuleIds = new Set();
const structuredRuleIds = new Set();
const randomClusters = new Set();
const structuredClusters = new Set();

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
  if (randomSet.has(pageUrl)) randomOnlyRuleIds.add(rule.id);
  if (structuredSet.has(pageUrl) && inv?.clusterKey) structuredClusters.add(inv.clusterKey);
  if (randomSet.has(pageUrl) && inv?.clusterKey) randomClusters.add(inv.clusterKey);
}

function addComponentFinding({ pageUrl, rule, target }) {
  const componentHint = selectorComponentHint(target);
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

await writeJson(path.join(reportsDir, 'summary.json'), summary);
await writeJson(path.join(reportsDir, 'grouped-by-rule.json'), groupedFindings);
await writeJson(path.join(reportsDir, 'grouped-by-component.json'), groupedComponents);
await writeJson(path.join(reportsDir, 'random-vs-structured-comparison.json'), comparison);

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
await writeText(path.join(reportsDir, 'manual-backlog.md'), manualBacklog.join('\n'));

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

await writeText(path.join(reportsDir, 'summary.md'), md.join('\n'));
console.log('Saved output/reports summary files');
