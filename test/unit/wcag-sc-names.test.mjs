// @ts-check
/**
 * @file Consistency lock between wcag-sc-names.json and SC_LEVEL_MAP.
 * @module test/unit/wcag-sc-names
 *
 * @description
 * The report-builder-starter reporter pairs names from
 * `src/data/wcag-sc-names.json` with levels from `SC_LEVEL_MAP`
 * (wcag-em-summary.mjs). Two sources can drift; this lock keeps their key
 * sets identical so a criterion can never resolve a name without a level or
 * vice versa.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { SC_LEVEL_MAP } from '../../src/lib/wcag-em-summary.mjs';

// SECTION: Tests

test('wcag-sc-names keys exactly match SC_LEVEL_MAP keys', async () => {
  /** @type {Record<string, any>} */
  const raw = JSON.parse(
    await fs.readFile(new URL('../../src/data/wcag-sc-names.json', import.meta.url), 'utf8'),
  );
  const { _meta, ...names } = raw;
  assert.ok(_meta?.source?.includes('w3.org'), 'data file carries its W3C provenance');
  const nameKeys = Object.keys(names).sort();
  const levelKeys = Object.keys(SC_LEVEL_MAP).sort();
  assert.deepEqual(nameKeys, levelKeys, 'name map and level map must cover the same SCs');
  for (const [sc, scName] of Object.entries(names)) {
    assert.ok(typeof scName === 'string' && scName.length > 0, `${sc} carries a non-empty handle`);
  }
});
