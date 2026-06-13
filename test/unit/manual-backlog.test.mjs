// @ts-check
/**
 * @file Tests for `buildManualBacklog` — findings-aware manual backlog.
 * @module test/unit/manual-backlog
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildManualBacklog } from '../../src/lib/manual-backlog.mjs';

// SECTION: Tests

test('buildManualBacklog: no findings → generic core-checks template', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /# Manual testing backlog/);
  assert.match(md, /Keyboard-only path/);
  assert.match(md, /Landmark navigation/);
  assert.match(md, /Zoom\/reflow at 320/);
  // No color-contrast finding → manual spot-check item IS present.
  assert.match(md, /Non-text contrast spot-check/);
  // No region finding → landmarks section is NOT added.
  assert.doesNotMatch(md, /Landmarks \(flagged automated/);
  // No processes → walkthrough section omitted.
  assert.doesNotMatch(md, /Process walkthroughs/);
});

test('buildManualBacklog: color-contrast finding → non-text contrast item is DROPPED', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'color-contrast', impact: 'serious' }],
  });
  assert.doesNotMatch(
    md,
    /Non-text contrast spot-check/,
    'automated pass covered color-contrast; manual duplicate dropped',
  );
});

test('buildManualBacklog: region finding → landmarks review section added', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'region', impact: 'moderate' }],
  });
  assert.match(md, /## Landmarks \(flagged automated/);
  assert.match(md, /every region has an accessible name/);
  assert.match(md, /`main` landmark exists and is unique/);
});

test('buildManualBacklog: landmark-one-main finding also triggers landmarks section', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'landmark-one-main', impact: 'moderate' }],
  });
  assert.match(md, /## Landmarks \(flagged automated/);
});

test('buildManualBacklog: processes → one walkthrough item per process', () => {
  const md = buildManualBacklog({
    findings: [],
    processes: [{ name: 'signup' }, { name: 'checkout' }, { name: 'password-reset' }],
  });
  assert.match(md, /## Process walkthroughs/);
  assert.match(md, /Complete walkthrough of process: \*\*signup\*\*/);
  assert.match(md, /Complete walkthrough of process: \*\*checkout\*\*/);
  assert.match(md, /Complete walkthrough of process: \*\*password-reset\*\*/);
});

test('buildManualBacklog: forms in inventory → forms line kept', () => {
  const md = buildManualBacklog({
    findings: [],
    inventory: [{ url: 'https://example.com/contact', hasForms: true, formCount: 1 }],
  });
  assert.match(md, /Forms: visible labels, instructions/);
});

test('buildManualBacklog: no forms, no label findings → forms line omitted', () => {
  const md = buildManualBacklog({ findings: [], inventory: [{ url: 'x', hasForms: false }] });
  assert.doesNotMatch(md, /Forms: visible labels, instructions/);
});

test('buildManualBacklog: label-class finding alone triggers forms line even without inventory', () => {
  const md = buildManualBacklog({
    findings: [{ id: 'label', impact: 'critical' }],
  });
  assert.match(md, /Forms: visible labels, instructions/);
});

test('buildManualBacklog: deterministic — two calls with same inputs produce byte-identical output', () => {
  const args = {
    findings: [
      { id: 'color-contrast', impact: 'serious' },
      { id: 'region', impact: 'moderate' },
    ],
    inventory: [{ url: 'x', hasForms: true }],
    processes: [{ name: 'signup' }, { name: 'checkout' }],
  };
  const a = buildManualBacklog(args);
  const b = buildManualBacklog(args);
  assert.strictEqual(a, b);
});

test('buildManualBacklog: result ends with a trailing newline', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.ok(md.endsWith('\n'));
});

test('buildManualBacklog: handles missing/malformed optional args safely', () => {
  const md = buildManualBacklog({ findings: /** @type {any} */ (null) });
  assert.match(md, /# Manual testing backlog/);
  assert.doesNotMatch(md, /Process walkthroughs/);
});

// SECTION: AU dogfood Lane B gap closures (B2 — 2026-05-11)
//
// The five items below were identified by the AU dogfood verdict
// (output/au-run-1/AU-DOGFOOD-REPORT.md Lane B, lines 48-67) as universally-
// expected manual checks missing from the static template. All five are
// ALWAYS-INCLUDED — axe-core has partial mechanical-presence overlap with
// three of them (audio-caption/video-caption, image-alt/area-alt, focus-*
// rules) but the SEMANTIC judgment ("is this alt truly meaningful? is the
// focus indicator visible to a sighted user?") remains an auditor concern
// regardless of axe findings.

test('buildManualBacklog: static template includes alt-text-semantics item (SC 1.1.1)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /Alt text semantics.*decorative.*informative/);
});

test('buildManualBacklog: static template includes captions/transcripts item (SC 1.2.1-1.2.5)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /Captions and transcripts.*audio.*video/);
});

test('buildManualBacklog: static template includes color-only-information item (SC 1.4.1)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /Color-only information/);
});

test('buildManualBacklog: static template includes focus-indicator-visibility item (covers SC 2.4.7 + 2.4.11)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /Focus indicator visibility.*not obscured/);
});

test('buildManualBacklog: static template includes CAPTCHA-alternative item (covers SC 1.1.1 + 2.1.1)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.match(md, /CAPTCHA alternative.*keyboard-operable/);
});

test('buildManualBacklog: AU Lane B items present even when axe findings have partial overlap', () => {
  // Verifies the always-included contract: axe firing audio-caption or
  // image-alt or focus-order-semantics findings does NOT drop the manual
  // items, because axe checks mechanical presence not semantic correctness.
  const md = buildManualBacklog({
    findings: [
      { id: 'audio-caption', impact: 'serious' },
      { id: 'image-alt', impact: 'critical' },
      { id: 'focus-order-semantics', impact: 'moderate' },
    ],
  });
  assert.match(md, /Alt text semantics/);
  assert.match(md, /Captions and transcripts/);
  assert.match(md, /Focus indicator visibility/);
});

// SECTION: E7 — evidence-driven sections

test('buildManualBacklog (E7): multi-viewport pages become screenshots-to-eyeball items', () => {
  const md = buildManualBacklog({
    findings: [],
    screenshots: [
      { url: 'https://x.com/a', viewport: 'desktop', screenshot: '/s/a-desktop.png' },
      { url: 'https://x.com/a', viewport: 'reflow', screenshot: '/s/a-reflow.png' },
      { url: 'https://x.com/b', viewport: 'desktop', screenshot: '/s/b-desktop.png' },
    ],
  });
  assert.match(md, /## Screenshots to eyeball/);
  assert.match(md, /overlap\/clipping: https:\/\/x\.com\/a/);
  assert.doesNotMatch(
    md,
    /https:\/\/x\.com\/b/,
    'a single-viewport page is not a responsive-overlap candidate',
  );
});

test('buildManualBacklog (E7): challenge pages + documents form the manual-review queue', () => {
  const md = buildManualBacklog({
    findings: [],
    manualReview: {
      challengePages: ['https://x.com/event/2', 'https://x.com/event/1'],
      documents: [{ url: 'https://x.com/newsletter.pdf', type: 'pdf' }],
    },
  });
  assert.match(md, /## Manual-review queue \(could not auto-audit\)/);
  const idx1 = md.indexOf('/event/1');
  const idx2 = md.indexOf('/event/2');
  assert.ok(idx1 > 0 && idx2 > idx1, 'challenge pages listed in sorted order');
  assert.match(md, /Review PDF by hand .*newsletter\.pdf/);
});

test('buildManualBacklog (E7): no evidence args → new sections omitted (not empty)', () => {
  const md = buildManualBacklog({ findings: [] });
  assert.doesNotMatch(md, /Screenshots to eyeball/);
  assert.doesNotMatch(md, /Manual-review queue/);
});

test('buildManualBacklog (E7): deterministic + trailing newline with the evidence args', () => {
  const args = {
    findings: [{ id: 'region', impact: 'moderate' }],
    screenshots: [
      { url: 'https://x.com/a', viewport: 'desktop', screenshot: '/s/1.png' },
      { url: 'https://x.com/a', viewport: 'reflow', screenshot: '/s/2.png' },
    ],
    manualReview: {
      challengePages: ['https://x.com/c'],
      documents: [{ url: 'https://x.com/d.pdf', type: 'pdf' }],
    },
  };
  assert.strictEqual(buildManualBacklog(args), buildManualBacklog(args));
  assert.ok(buildManualBacklog(args).endsWith('\n'));
});
