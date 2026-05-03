// @ts-check
/**
 * @file Tests for `buildManualBacklog` — Layer 3b R9's findings-aware backlog.
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
