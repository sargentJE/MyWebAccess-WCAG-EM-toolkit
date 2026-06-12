// @ts-check
/**
 * @file Drift guard: every config-schema field is documented in the config guide.
 * @module test/unit/docs-config-coverage
 *
 * @description
 * Walks `schemas/config.schema.json` for every property name (recursing
 * `properties`, `items`, `oneOf`/`anyOf`, schema-valued `additionalProperties`
 * and `$defs` — action fields live in `$defs.action`, `runOnly`'s shape inside
 * a `oneOf` branch) and asserts each appears in
 * `docs/guides/config-guide.md` as a BACKTICKED token. Plain substring
 * matching would pass vacuously: ~28 of the ~100 field names are ordinary
 * English words (`name`, `pattern`, `value`, `fields`, ...) that any prose
 * contains (2026-06 docs-review pressure-test finding 2). The backtick
 * requirement means the guide must actually NAME the field as a field.
 *
 * Net effect: adding a config knob without documenting it FAILS the gate with
 * the missing field named. The exceptions list below ships empty by design —
 * even deprecated fields are documented (in the guide's "Deprecated fields"
 * table) rather than excluded.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

// SECTION: Exceptions (empty by design; register deliberate omissions here)

/** @type {string[]} */
const DOCUMENTED_EXCEPTIONS = [];

// SECTION: Helpers (plain functions so the negative case below can drive them)

/**
 * Collect every property name reachable in a JSON Schema document.
 *
 * @param {any} node - Schema (sub)tree.
 * @param {Set<string>} [names]
 * @returns {Set<string>}
 */
export function collectFieldNames(node, names = new Set()) {
  if (!node || typeof node !== 'object') return names;
  if (node.properties && typeof node.properties === 'object') {
    for (const [key, child] of Object.entries(node.properties)) {
      names.add(key);
      collectFieldNames(child, names);
    }
  }
  if (node.items) collectFieldNames(node.items, names);
  for (const branchKey of ['oneOf', 'anyOf']) {
    for (const branch of Array.isArray(node[branchKey]) ? node[branchKey] : []) {
      collectFieldNames(branch, names);
    }
  }
  if (node.additionalProperties && typeof node.additionalProperties === 'object') {
    collectFieldNames(node.additionalProperties, names);
  }
  if (node.$defs && typeof node.$defs === 'object') {
    for (const def of Object.values(node.$defs)) collectFieldNames(def, names);
  }
  return names;
}

/**
 * Names from `fieldNames` that do NOT appear as a backticked token in
 * `guideText`. A match is any inline-code span containing the name as a whole
 * word (so `` `sample.randomSeed` `` documents `randomSeed`, but the prose
 * word "name" never satisfies `` `name` ``).
 *
 * @param {Iterable<string>} fieldNames
 * @param {string} guideText
 * @returns {string[]} undocumented names, sorted.
 */
export function findUndocumented(fieldNames, guideText) {
  /** @type {string[]} */
  const missing = [];
  for (const name of fieldNames) {
    if (DOCUMENTED_EXCEPTIONS.includes(name)) continue;
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const token = new RegExp('`[^`]*\\b' + escaped + '\\b[^`]*`');
    if (!token.test(guideText)) missing.push(name);
  }
  return missing.sort();
}

// SECTION: The guard

test('config guide documents every schema field as a backticked token', async () => {
  const schema = JSON.parse(
    await fs.readFile(new URL('../../schemas/config.schema.json', import.meta.url), 'utf8'),
  );
  const guide = await fs.readFile(
    new URL('../../docs/guides/config-guide.md', import.meta.url),
    'utf8',
  );
  const names = collectFieldNames(schema);
  assert.ok(names.size >= 90, `walker found a plausible field count (got ${names.size})`);
  const missing = findUndocumented(names, guide);
  assert.deepEqual(
    missing,
    [],
    `config-guide.md is missing backticked documentation for: ${missing.join(', ')}`,
  );
});

// SECTION: Negative case — proves the guard bites

test('the guard reports an undocumented field by name (fixture schema)', () => {
  const fixtureSchema = {
    properties: {
      scan: { properties: { imaginaryKnob: { type: 'string' } } },
    },
  };
  const names = collectFieldNames(fixtureSchema);
  assert.ok(names.has('imaginaryKnob'));
  const guideWithout = 'The `scan` section has many fields, none imaginary. imaginaryKnob prose.';
  assert.deepEqual(findUndocumented(names, guideWithout), ['imaginaryKnob']);
  const guideWith = 'Use `scan.imaginaryKnob` to imagine things.';
  assert.deepEqual(findUndocumented(names, guideWith), []);
});
