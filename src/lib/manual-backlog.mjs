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
 * @property {Array<{ url: string, viewport?: string, screenshot?: string }>} [screenshots]
 *   - E7: per-view screenshots; pages captured at multiple viewports become
 *     "screenshots to eyeball" (responsive overlap/clipping candidates).
 * @property {{ challengePages?: string[], documents?: Array<{ url: string, type?: string }> }} [manualReview]
 *   - E7: the could-not-auto-audit hand-off — challenge/blocked pages (after §0a)
 *     and documents (PDFs) a browser cannot axe-scan.
 */

/**
 * Build the backlog as STRUCTURED items, grouped by section. The markdown
 * renderer (`buildManualBacklog`) and the report-builder-starter reporter
 * both consume this list, so the checklist exists in exactly one place
 * (2026-06 review: the consumer previously re-parsed the rendered markdown).
 *
 * Pure function; no I/O.
 *
 * @param {BuildManualBacklogArgs} args
 * @returns {Array<{ section: string, label: string }>}
 */
export function buildManualBacklogItems({
  findings,
  inventory = [],
  processes = [],
  screenshots = [],
  manualReview = {},
}) {
  const findingIds = new Set(
    (Array.isArray(findings) ? findings : []).map((f) => (typeof f?.id === 'string' ? f.id : '')),
  );
  const hasColorContrast = findingIds.has('color-contrast');
  const hasRegion = findingIds.has('region') || findingIds.has('landmark-one-main');
  const hasLabelFindings = findingIds.has('label') || findingIds.has('aria-input-field-name');

  const CORE = 'Core manual checks';
  /** @type {Array<{ section: string, label: string }>} */
  const items = [
    { section: CORE, label: 'Keyboard-only path through homepage and main navigation' },
    { section: CORE, label: 'Skip link behaviour and focus destination' },
    { section: CORE, label: 'Landmark navigation with screen reader' },
    { section: CORE, label: 'Heading structure and page outline review' },
  ];

  // Forms + labels: only if there are forms in the inventory OR label-class findings.
  const hasForms = Array.isArray(inventory)
    ? inventory.some((p) => p && (p.hasForms || p.formCount > 0))
    : false;
  if (hasForms || hasLabelFindings) {
    items.push({
      section: CORE,
      label: 'Forms: visible labels, instructions, error handling, focus return, announcements',
    });
  }

  // Color contrast: ONLY if not already surfaced by the automated pass.
  // If color-contrast findings exist, the automated layer already flagged
  // specific instances; the manual item would duplicate. Drop it.
  if (!hasColorContrast) {
    items.push({
      section: CORE,
      label:
        'Non-text contrast spot-check (focus indicators, UI component borders, state indicators)',
    });
  }

  items.push(
    { section: CORE, label: 'Zoom/reflow at 320 CSS px equivalent' },
    { section: CORE, label: 'Text spacing and clipping checks' },
    { section: CORE, label: 'Name/role/value review for custom controls' },
    // Items below close 5 gaps surfaced by the AU dogfood Lane B verdict
    // (output/au-run-1/AU-DOGFOOD-REPORT.md). All five are ALWAYS-INCLUDED
    // — axe-core has partial mechanical-presence overlap with three of them
    // (audio-caption/video-caption, image-alt/area-alt, focus-* rules)
    // but the SEMANTIC judgment ("is this alt truly meaningful? is the focus
    // indicator visible to a sighted user?") remains an auditor responsibility.
    // Multi-SC coverage is folded into a single line where wording permits.
    {
      section: CORE,
      label:
        'Alt text semantics: decorative images use empty alt; informative images have meaningful descriptions',
    },
    {
      section: CORE,
      label: 'Captions and transcripts: audio/video has synchronized captions or full transcript',
    },
    {
      section: CORE,
      label: 'Color-only information: confirm no information is conveyed by color alone',
    },
    {
      section: CORE,
      label:
        'Focus indicator visibility: every interactive element has a visible focus indicator that is not obscured by overlapping content',
    },
    {
      section: CORE,
      label:
        'CAPTCHA alternative: if CAPTCHA is present, verify an accessible alternative (text, audio) is available AND keyboard-operable',
    },
  );

  // Region findings → explicit landmarks review.
  if (hasRegion) {
    const LANDMARKS = 'Landmarks (flagged automated — manual confirmation required)';
    items.push(
      { section: LANDMARKS, label: 'Confirm every region has an accessible name' },
      { section: LANDMARKS, label: 'Confirm `main` landmark exists and is unique per page' },
      { section: LANDMARKS, label: 'Confirm no content sits outside all landmarks' },
    );
  }

  // Per-process walkthrough items.
  if (Array.isArray(processes) && processes.length > 0) {
    for (const p of processes) {
      const name = typeof p?.name === 'string' ? p.name : '(unnamed)';
      items.push({
        section: 'Process walkthroughs',
        label: `Complete walkthrough of process: **${name}**`,
      });
    }
  }

  // E7: screenshots to eyeball — pages captured at MORE THAN ONE viewport are
  // responsive-overlap / clipping candidates (compare desktop vs reflow).
  /** @type {Map<string, Set<string>>} */
  const viewportsByUrl = new Map();
  for (const s of Array.isArray(screenshots) ? screenshots : []) {
    if (!s?.url || !s?.screenshot) continue;
    const set = viewportsByUrl.get(s.url) ?? new Set();
    set.add(typeof s.viewport === 'string' ? s.viewport : 'default');
    viewportsByUrl.set(s.url, set);
  }
  const multiViewport = [...viewportsByUrl.entries()]
    .filter(([, vps]) => vps.size > 1)
    .map(([url]) => url)
    .sort();
  if (multiViewport.length > 0) {
    const SHOTS = 'Screenshots to eyeball (responsive overlap / clipping)';
    for (const url of multiViewport) {
      items.push({
        section: SHOTS,
        label: `Compare desktop vs reflow captures for overlap/clipping: ${url}`,
      });
    }
  }

  // E7: manual-review queue — the could-not-auto-audit hand-off. Challenge/blocked
  // pages (after the §0a strategy) + documents (PDFs) a browser cannot
  // meaningfully axe-scan. Makes "could not auto-audit" an explicit, actionable
  // list rather than an absence.
  const challengePages = Array.isArray(manualReview?.challengePages)
    ? manualReview.challengePages
    : [];
  const documents = Array.isArray(manualReview?.documents) ? manualReview.documents : [];
  if (challengePages.length > 0 || documents.length > 0) {
    const QUEUE = 'Manual-review queue (could not auto-audit)';
    for (const url of [...challengePages].sort()) {
      items.push({ section: QUEUE, label: `Review by hand — automated audit was blocked: ${url}` });
    }
    for (const doc of documents) {
      const type = typeof doc?.type === 'string' ? doc.type.toUpperCase() : 'document';
      items.push({
        section: QUEUE,
        label: `Review ${type} by hand (not browser-auditable): ${doc?.url ?? ''}`,
      });
    }
  }

  return items;
}

/**
 * Generate the manual-testing backlog markdown, adapted to the findings
 * present in this run. Renders `buildManualBacklogItems` — byte-identical to
 * the pre-refactor inline assembly.
 *
 * Pure function; no I/O. Callers (summarize.mjs) write the result via
 * `writeText(path, buildManualBacklog(...))`.
 *
 * @param {BuildManualBacklogArgs} args
 * @returns {string}
 */
export function buildManualBacklog(args) {
  const items = buildManualBacklogItems(args);

  /** @type {string[]} */
  const lines = [
    '# Manual testing backlog',
    '',
    'Use this after the automated run. Add notes and outcomes per item.',
  ];

  // Group by section, preserving first-appearance order.
  /** @type {Map<string, string[]>} */
  const sections = new Map();
  for (const item of items) {
    if (!sections.has(item.section)) sections.set(item.section, []);
    /** @type {string[]} */ (sections.get(item.section)).push(item.label);
  }
  for (const [section, labels] of sections) {
    lines.push('', `## ${section}`, '');
    for (const label of labels) lines.push(`- [ ] ${label}`);
  }

  lines.push('', '## Notes', '');
  return lines.join('\n') + '\n';
}
