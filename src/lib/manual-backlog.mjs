// @ts-check
/**
 * @file Findings-aware manual accessibility backlog generator.
 * @module lib/manual-backlog
 *
 * @description
 * Generates a findings-aware markdown backlog for `output/reports/manual-backlog.md`.
 * A pure function that adapts items to what was actually found:
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
 * Pure function; no I/O. Callers (summarize.mjs) write the result via
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
    // Items below close 5 gaps surfaced by the AU dogfood Lane B verdict
    // (output/au-run-1/AU-DOGFOOD-REPORT.md). All five are ALWAYS-INCLUDED
    // — axe-core has partial mechanical-presence overlap with three of them
    // (audio-caption/video-caption, image-alt/area-alt, focus-* rules)
    // but the SEMANTIC judgment ("is this alt truly meaningful? is the focus
    // indicator visible to a sighted user?") remains an auditor responsibility.
    // Multi-SC coverage is folded into a single line where wording permits.
    '- [ ] Alt text semantics: decorative images use empty alt; informative images have meaningful descriptions',
    '- [ ] Captions and transcripts: audio/video has synchronized captions or full transcript',
    '- [ ] Color-only information: confirm no information is conveyed by color alone',
    '- [ ] Focus indicator visibility: every interactive element has a visible focus indicator that is not obscured by overlapping content',
    '- [ ] CAPTCHA alternative: if CAPTCHA is present, verify an accessible alternative (text, audio) is available AND keyboard-operable',
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
