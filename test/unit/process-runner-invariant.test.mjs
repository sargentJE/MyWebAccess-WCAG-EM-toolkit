// @ts-check
/**
 * @file Lock schema ↔ dispatch invariant for process-runner actions.
 * @module test/unit/process-runner-invariant
 *
 * @description
 * The JSON schema's action enum and the runtime `dispatch()` switch cases
 * must stay aligned — otherwise a schema-valid config can silently fall
 * into the dispatch default as `state: 'error'`, contradicting ADR-0005's
 * "fail fast on config" principle.
 *
 * Two belt-and-braces assertions:
 *   1. Schema enum set equals `DISPATCH_ACTIONS` set.
 *   2. Source-text case literals *within the dispatch function body* equal
 *      `DISPATCH_ACTIONS`.
 *
 * Aliases are explicitly disallowed: two names mapping to one handler
 * imply two authoritative spellings for a single concept, which the
 * invariant would have to be re-designed to express.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISPATCH_ACTIONS } from '../../src/lib/process-runner.mjs';

// SECTION: Paths
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const SCHEMA_PATH = path.join(REPO_ROOT, 'schemas', 'config.schema.json');
const RUNNER_PATH = path.join(REPO_ROOT, 'src', 'lib', 'process-runner.mjs');

// SECTION: Tests

test('schema action enum equals DISPATCH_ACTIONS (no drift, no aliases)', async () => {
  const schema = JSON.parse(await fs.readFile(SCHEMA_PATH, 'utf8'));
  const schemaEnum = schema.$defs?.action?.properties?.action?.enum;
  assert.ok(Array.isArray(schemaEnum), 'schema must declare $defs.action.properties.action.enum');

  const schemaSet = new Set(schemaEnum);
  const dispatchSet = new Set(DISPATCH_ACTIONS);

  assert.strictEqual(schemaSet.size, dispatchSet.size, 'enum and DISPATCH_ACTIONS sizes differ');
  for (const name of schemaSet) {
    assert.ok(dispatchSet.has(name), `schema enum "${name}" is not in DISPATCH_ACTIONS`);
  }
  for (const name of dispatchSet) {
    assert.ok(schemaSet.has(name), `DISPATCH_ACTIONS "${name}" is not in schema enum`);
  }
});

test('dispatch() switch case literals equal DISPATCH_ACTIONS', async () => {
  const source = await fs.readFile(RUNNER_PATH, 'utf8');

  // Find the `async function dispatch(...)` block and extract its body range.
  const dispatchStart = source.indexOf('async function dispatch(');
  assert.ok(dispatchStart !== -1, 'dispatch function must exist in process-runner.mjs');
  const openBrace = source.indexOf('{', dispatchStart);
  assert.ok(openBrace !== -1, 'dispatch function body must start with {');

  // Walk braces to find the matching close brace for the function body.
  let depth = 0;
  let closeBrace = -1;
  for (let i = openBrace; i < source.length; i++) {
    const ch = source[i];
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        closeBrace = i;
        break;
      }
    }
  }
  assert.ok(closeBrace !== -1, 'dispatch function body must have a matching close brace');

  const body = source.slice(openBrace, closeBrace);
  const caseLiterals = [...body.matchAll(/case\s+'([a-zA-Z]+)':/g)].map((m) => m[1]);
  const caseSet = new Set(caseLiterals);
  const dispatchSet = new Set(DISPATCH_ACTIONS);

  assert.strictEqual(
    caseSet.size,
    dispatchSet.size,
    `dispatch() has ${caseSet.size} unique case literals, DISPATCH_ACTIONS has ${dispatchSet.size}`,
  );
  for (const name of dispatchSet) {
    assert.ok(caseSet.has(name), `dispatch() is missing case for "${name}"`);
  }
  for (const name of caseSet) {
    assert.ok(
      dispatchSet.has(name),
      `dispatch() has case for "${name}" not listed in DISPATCH_ACTIONS`,
    );
  }
});
