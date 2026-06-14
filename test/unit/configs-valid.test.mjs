// @ts-check
/**
 * @file Validation guard for every COMMITTED example/site config.
 * @module test/unit/configs-valid
 *
 * @description
 * Loads each committed config in `configs/` through the full `loadConfig`
 * path (defaults merge + Ajv validation + regex/action compilation), so a
 * shipped example can never drift from the schema. The list is EXPLICIT
 * rather than a directory glob: local working trees carry untracked scratch
 * configs that CI never sees, and a glob would make local runs diverge from
 * CI (2026-06 docs-review pressure-test finding 4). Adding a new committed
 * config means registering it here — by design.
 *
 * Complements test/unit/config-defaults.test.mjs, which loads two of these
 * configs to assert specific default-resolution behaviours; THIS test is the
 * completeness guard across the whole committed set.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../../src/lib/config.mjs';

// SECTION: The committed set (register new examples here)

const COMMITTED_CONFIGS = [
  'configs/example-site.json',
  'configs/example-site-best-practice.json',
  'configs/example-site-with-auth.json',
  'configs/example-site-with-cdp.json',
  'configs/example-site-with-processes.json',
  'configs/legacy-events.json',
];

// SECTION: Tests

for (const configPath of COMMITTED_CONFIGS) {
  test(`committed config loads + validates: ${configPath}`, async () => {
    const { config } = await loadConfig(configPath);
    assert.ok(config.name, `${configPath} resolved a name`);
    assert.ok(config.rootUrl, `${configPath} resolved a rootUrl`);
  });
}

test('the example-with-processes config exercises the DSL surface the guide documents', async () => {
  const { config } = await loadConfig('configs/example-site-with-processes.json');
  const processes = config.processes ?? [];
  const patterns = processes.map((/** @type {any} */ p) => p.pattern ?? 'custom-steps');
  assert.ok(patterns.includes('blank-submit'), 'blank-submit pattern present');
  assert.ok(patterns.includes('partial-submit'), 'partial-submit pattern present');
  const custom = processes.find((/** @type {any} */ p) => Array.isArray(p.steps));
  assert.ok(custom, 'a custom-steps process is present');
  const actions = custom.steps.map((/** @type {any} */ s) => s.action);
  for (const required of ['goto', 'fill', 'press', 'waitFor', 'screenshot', 'axe']) {
    assert.ok(actions.includes(required), `custom steps exercise "${required}"`);
  }
  const beforeScan = config.scan?.beforeScan?.actions ?? [];
  assert.ok(
    beforeScan.some((/** @type {any} */ a) => typeof a.urlPattern === 'string'),
    'a beforeScan action carries a urlPattern conditional',
  );
});
