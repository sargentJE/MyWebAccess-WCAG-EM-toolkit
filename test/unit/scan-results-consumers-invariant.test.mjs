// @ts-check
/**
 * @file Source-text invariant: every raw-artefact consumer routes through the
 *       shared scan-results predicate.
 * @module test/unit/scan-results-consumers-invariant
 *
 * @description
 * The E1 keystone relies on EVERY consumer of `axe-results.json` /
 * `process-results.json` skipping could-not-audit page-views via
 * `isAuditableView` / `viewStatus`. The current four direct readers + two
 * param-fed consumers all do — but the failure mode is *fail-open*: a future
 * reporter that re-reads the raw artefacts and forgets the guard would silently
 * leak challenge pages into the portal upload / client draft, exactly as
 * portal-export and wcag-em-summary did before E1.
 *
 * This guard (modelled on discover-no-locator-invariant) makes that mistake a
 * build failure instead of a silent data-quality regression.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = fileURLToPath(new URL('../../src/', import.meta.url));

/** References either shared predicate (both come from lib/scan-results.mjs). */
const PREDICATE = /\b(?:isAuditableView|viewStatus)\b/;
/** A readJsonMaybe call against one of the raw scan artefacts. */
const RAW_READ = /readJsonMaybe\([^)]*?(?:axe-results|process-results)\.json/;

/**
 * @param {string} dir
 * @returns {Promise<string[]>} absolute paths of every .mjs under dir.
 */
async function listMjs(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await listMjs(full)));
    else if (entry.name.endsWith('.mjs')) out.push(full);
  }
  return out;
}

test('every raw-artefact READER routes entries through the scan-results predicate', async () => {
  const files = await listMjs(SRC_DIR);
  /** @type {string[]} */
  const offenders = [];
  for (const file of files) {
    const src = await readFile(file, 'utf8');
    if (RAW_READ.test(src) && !PREDICATE.test(src)) {
      offenders.push(path.relative(SRC_DIR, file));
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these files read axe-results.json/process-results.json but never reference ` +
      `isAuditableView/viewStatus — a could-not-audit page could leak: ${offenders.join(', ')}`,
  );
});

test('param-fed raw-entry consumers also route through the predicate', async () => {
  // group-findings and wcag-em-summary iterate axeResults/processResults that
  // summarize passes IN (so they carry no artefact filename literal for the
  // RAW_READ check above) — but they still ingest raw entries and must guard.
  for (const name of ['group-findings.mjs', 'wcag-em-summary.mjs']) {
    const src = await readFile(path.join(SRC_DIR, 'lib', name), 'utf8');
    assert.ok(PREDICATE.test(src), `${name} must reference isAuditableView/viewStatus`);
  }
});
