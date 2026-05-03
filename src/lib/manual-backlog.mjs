// @ts-check
/**
 * @file Findings-aware manual accessibility backlog generator.
 * @module lib/manual-backlog
 *
 * @description
 * Layer 1 shipped a static markdown template for `output/reports/manual-backlog.md`.
 * Layer 3b replaces it with a pure function that adapts items to what was
 * actually found:
 *
 *   - Drops inapplicable reminders (e.g. color-contrast line when no such
 *     violations were found — the automated pass covered it).
 *   - Adds landmark-review items when `region` violations are present.
 *   - Adds a process-walkthrough item per configured process.
 *   - Header + framing paragraphs stay constant so existing reviewers
 *     recognise the output.
 *
 * Deterministic: two calls with the same inputs produce byte-identical
 * output. No timestamps, no Set-iteration (all ordering derived from
 * input array order or fixed lists).
 *
 * @see docs/adr/0007-wcag-em-summary-shape.md
 */

// SECTION: Public API

/**
 * @typedef {object} BuildManualBacklogArgs
 * @property {any[]} findings - Grouped findings from `summary.findings` (rule-level).
 * @property {any[]} [inventory] - Discovery inventory (optional; used for landmarks heuristic).
 * @property {any[]} [processes] - Configured processes; each becomes a walkthrough item.
 */

/**
 * Generate the manual-testing backlog markdown, adapted to the findings
 * present in this run.
 *
 * Pure function; no I/O. Callers (summarize.mjs R12) write the result via
 * `writeText(path, buildManualBacklog(...))`.
 *
 * @param {BuildManualBacklogArgs} args
 * @returns {string}
 */
export function buildManualBacklog({ findings, inventory = [], processes = [] }) {
  const findingIds = new Set(
    (Array.isArray(findings) ? findings : []).map((f) => (typeof f?.id === 'string' ? f.id : '')),
  );
  const hasColorContrast = findingIds.has('color-contrast');
  const hasRegion = findingIds.has('region') || findingIds.has('landmark-one-main');
  const hasLabelFindings = findingIds.has('label') || findingIds.has('aria-input-field-name');

  /** @type {string[]} */
  const lines = [
    '# Manual testing backlog',
    '',
    'Use this after the automated run. Add notes and outcomes per item.',
    '',
    '## Core manual checks',
    '',
    '- [ ] Keyboard-only path through homepage and main navigation',
    '- [ ] Skip link behaviour and focus destination',
    '- [ ] Landmark navigation with screen reader',
    '- [ ] Heading structure and page outline review',
  ];

  // Forms + labels: only if there are forms in the inventory OR label-class findings.
  const hasForms = Array.isArray(inventory)
    ? inventory.some((p) => p && (p.hasForms || p.formCount > 0))
    : false;
  if (hasForms || hasLabelFindings) {
    lines.push(
      '- [ ] Forms: visible labels, instructions, error handling, focus return, announcements',
    );
  }

  // Color contrast: ONLY if not already surfaced by the automated pass.
  // If color-contrast findings exist, the automated layer already flagged
  // specific instances; the manual item would duplicate. Drop it.
  if (!hasColorContrast) {
    lines.push(
      '- [ ] Non-text contrast spot-check (focus indicators, UI component borders, state indicators)',
    );
  }

  lines.push(
    '- [ ] Zoom/reflow at 320 CSS px equivalent',
    '- [ ] Text spacing and clipping checks',
    '- [ ] Name/role/value review for custom controls',
  );

  // Region findings → explicit landmarks review.
  if (hasRegion) {
    lines.push(
      '',
      '## Landmarks (flagged automated — manual confirmation required)',
      '',
      '- [ ] Confirm every region has an accessible name',
      '- [ ] Confirm `main` landmark exists and is unique per page',
      '- [ ] Confirm no content sits outside all landmarks',
    );
  }

  // Per-process walkthrough items.
  if (Array.isArray(processes) && processes.length > 0) {
    lines.push('', '## Process walkthroughs');
    lines.push('');
    for (const p of processes) {
      const name = typeof p?.name === 'string' ? p.name : '(unnamed)';
      lines.push(`- [ ] Complete walkthrough of process: **${name}**`);
    }
  }

  lines.push('', '## Notes', '');
  return lines.join('\n') + '\n';
}
