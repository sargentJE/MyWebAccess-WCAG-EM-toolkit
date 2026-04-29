// @ts-check
/**
 * @file Markdown reporter — emits `summary.md` (internal).
 * @module reporters/markdown
 *
 * @description
 * Migrated from the inline `// ANCHOR: MarkdownReport` block in
 * `summarize.mjs` (Layer 3b HEAD `abd7339`). Body sections preserved
 * verbatim:
 *   - tool-identity HTML comment header (via `toolIdentityMarkdownHeader`).
 *   - Site/Generated metadata.
 *   - Method guardrails (the v0.3 honesty disclaimer).
 *   - Run summary counts.
 *   - Random vs structured comparison.
 *   - Grouped findings by rule, ordered by `sortFindings`.
 *
 * Findings are routed through `sortFindings` so the markdown reporter
 * agrees with the JSON reporter on row order — a small byte-shift from
 * HEAD for findings with the same impact, but cross-reporter consistency
 * is more useful to auditors diffing artefacts than byte-perfect history
 * compat.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeText } from '../lib/fs-utils.mjs';
import { toolIdentityMarkdownHeader } from '../lib/version.mjs';
import { sortFindings } from './_sort.mjs';

// SECTION: Module identity
export const name = 'markdown';

// SECTION: Public API

/**
 * Emit `summary.md` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string } }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
  const comparison = summary.comparison ?? {
    randomSampleIntroducedNewRuleIds: [],
    randomSampleIntroducedNewClusters: [],
    expandStructuredSampleRecommended: false,
  };

  const lines = [
    toolIdentityMarkdownHeader().trimEnd(),
    '',
    '# Accessibility scan summary',
    '',
    `Site: **${summary.site}**`,
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

  for (const item of findings) {
    lines.push(`### ${item.id}`);
    lines.push(`- Impact: ${item.impact ?? 'n/a'}`);
    lines.push(`- Classification: ${item.classification}`);
    lines.push(`- Pages affected: ${item.pageCount}`);
    if (Array.isArray(item.pageTypes) && item.pageTypes.length) {
      lines.push(`- Page types: ${item.pageTypes.join(', ')}`);
    }
    if (item.help) lines.push(`- Help: ${item.help}`);
    if (item.helpUrl) lines.push(`- Rule URL: ${item.helpUrl}`);
    if (Array.isArray(item.targets) && item.targets.length) {
      lines.push(`- Example target: \`${item.targets[0]}\``);
    }
    lines.push('');
  }

  const filePath = path.join(ctx.paths.reportsDir, 'summary.md');
  await writeText(filePath, lines.join('\n'));
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}
