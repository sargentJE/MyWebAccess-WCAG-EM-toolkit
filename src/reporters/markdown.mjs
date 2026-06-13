// @ts-check
/**
 * @file Markdown reporter — emits `summary.md` (internal).
 * @module reporters/markdown
 *
 * @description
 * Migrated from the inline `// ANCHOR: MarkdownReport` block in
 * `summarize.mjs` (pre-reporter-pipeline implementation). Body sections preserved
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

// SECTION: Inline-code escaping

/**
 * Normalise a value for safe embedding in a markdown inline-code span:
 * neutralise backticks (which would otherwise break the span), collapse
 * whitespace runs to single spaces (axe selectors/outerHTML can be multi-line),
 * and trim. Markdown was the only reporter interpolating selectors raw, so a
 * backtick in a selector or snippet could break the rendered span; this brings
 * it to parity with the HTML/JUnit reporters' escaping. Backslashes are kept
 * verbatim — they are real data and the HTML reporter keeps them too.
 *
 * @param {unknown} value - Raw selector or HTML snippet.
 * @returns {string} A single-line, backtick-free string.
 */
function mdInlineCode(value) {
  return String(value).replace(/`/g, "'").replace(/\s+/g, ' ').trim();
}

// SECTION: Scan health

/**
 * Render the scan-health section lines, or nothing when the run was clean.
 * Failed pages contributed NOTHING to any verdict — without this section a
 * reader of the Step 5 summary cannot tell attempted coverage from achieved
 * coverage (2026-06 review C1).
 *
 * @param {Record<string, any> | undefined} health - `summary.executionHealth`.
 * @returns {string[]} Markdown lines (empty array when there is nothing to report).
 */
function renderScanHealth(health) {
  if (!health || typeof health !== 'object') return [];
  const failed = Array.isArray(health.pagesFailed) ? health.pagesFailed : [];
  const degraded = Array.isArray(health.pagesDegraded) ? health.pagesDegraded : [];
  const processFailures = Array.isArray(health.processFailures) ? health.processFailures : [];
  const preScanFailures = Array.isArray(health.preScanFailures) ? health.preScanFailures : [];
  const unauditable = Array.isArray(health.pagesUnauditable) ? health.pagesUnauditable : [];
  const stepFailures = Array.isArray(health.processStepFailures) ? health.processStepFailures : [];
  const truncated = health.reachedMaxPages === true;
  if (
    failed.length === 0 &&
    degraded.length === 0 &&
    processFailures.length === 0 &&
    preScanFailures.length === 0 &&
    unauditable.length === 0 &&
    stepFailures.length === 0 &&
    !truncated
  ) {
    return [];
  }
  const lines = ['## Scan health', ''];
  if (truncated) {
    lines.push(
      `- Crawl stopped at maxPages=${health.maxPagesConfigured}; the inventory (and sample) may be truncated.`,
    );
  }
  for (const p of failed) {
    lines.push(
      `- NOT SCANNED (all viewports failed): ${p.url} — ${p.failures?.[0]?.error ?? 'unknown error'}`,
    );
  }
  for (const p of degraded) {
    const vps = (p.failures ?? []).map((/** @type {any} */ f) => f.viewport).join(', ');
    lines.push(`- Partially scanned (failed on ${vps}): ${p.url}`);
  }
  for (const p of processFailures) {
    lines.push(`- Process "${p.name}" failed at ${p.startUrl}: ${p.error}`);
  }
  for (const p of preScanFailures) {
    lines.push(
      `- Pre-scan action "${p.action}" ${p.state} on ${p.url} [${p.viewport}] — page scanned without intended setup.`,
    );
  }
  for (const p of unauditable) {
    const outcomes = [...new Set((p.views ?? []).map((/** @type {any} */ v) => v.outcome))].join(
      ', ',
    );
    lines.push(`- Could not audit (${outcomes}) — review by hand: ${p.url}`);
  }
  for (const p of stepFailures) {
    lines.push(
      `- Process "${p.name}" step "${p.state}" failed at ${p.startUrl}: ${p.error ?? 'unknown error'}`,
    );
  }
  lines.push('');
  return lines;
}

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
  // E1 DISCLOSE: automated-coverage honesty line (so a clean result is never
  // read as complete coverage when pages were excluded).
  const cov = summary.wcagEmSummary?.automatedCoverage;

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
    ...(typeof summary.pageViewsScanned === 'number'
      ? [`- Page views scanned (pages x viewports): ${summary.pageViewsScanned}`]
      : []),
    `- Process runs: ${summary.processRuns}`,
    `- Grouped findings: ${summary.groupedFindingCount}`,
    ...(cov
      ? [
          `- Automated coverage: ${cov.status}${cov.adequate ? '' : ' — PARTIAL'} (${cov.pagesAudited}${
            cov.pagesSelected != null ? `/${cov.pagesSelected}` : ''
          } selected pages audited${cov.pagesExcluded ? `; ${cov.pagesExcluded} excluded — see Scan health` : ''})`,
        ]
      : []),
    '',
    ...renderScanHealth(summary.executionHealth),
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
      lines.push(`- Example target: \`${mdInlineCode(item.targets[0])}\``);
    }
    lines.push('');
  }

  const incompleteFindings = Array.isArray(summary.incompleteFindings)
    ? summary.incompleteFindings
    : [];
  if (incompleteFindings.length > 0) {
    lines.push('## Incomplete results (needs review)');
    lines.push('');
    for (const item of incompleteFindings) {
      lines.push(`### ${item.id}`);
      lines.push(`- Impact: ${item.impact ?? 'n/a'}`);
      lines.push(`- Classification: needs-review`);
      lines.push(`- Pages affected: ${item.pageCount}`);
      if (item.help) lines.push(`- Help: ${item.help}`);
      if (item.helpUrl) lines.push(`- Rule URL: ${item.helpUrl}`);
      const ex = Array.isArray(item.examples) && item.examples.length ? item.examples[0] : null;
      const exTarget = ex?.target ?? item.firstTarget;
      if (exTarget) lines.push(`- Example target: \`${mdInlineCode(exTarget)}\``);
      if (ex?.html) {
        lines.push(`- Example HTML: \`${mdInlineCode(ex.html)}\``);
      }
      lines.push('');
    }
  }

  const filePath = path.join(ctx.paths.reportsDir, 'summary.md');
  await writeText(filePath, lines.join('\n'));
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}
