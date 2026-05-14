// @ts-check
/**
 * @file Tests for `TOOL_IDENTITY` + `toolIdentityMarkdownHeader`.
 * @module test/unit/version
 *
 * @description
 * The module reads both package.json files at import time, so the tests
 * cross-check the exported values against disk.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL_IDENTITY, toolIdentityMarkdownHeader } from '../../src/lib/version.mjs';

// SECTION: Setup

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(__filename, '../../..');
const SELF_PKG = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
const AXE_PKG = JSON.parse(
  fs.readFileSync(
    path.join(REPO_ROOT, 'node_modules', '@axe-core', 'playwright', 'package.json'),
    'utf8',
  ),
);

// SECTION: Tests

test('TOOL_IDENTITY has the three expected keys', () => {
  assert.deepEqual(Object.keys(TOOL_IDENTITY).sort(), ['axeCore', 'name', 'version']);
});

test('TOOL_IDENTITY.name matches package.json', () => {
  assert.equal(TOOL_IDENTITY.name, SELF_PKG.name);
});

test('TOOL_IDENTITY.version matches package.json (propagates on npm version bump)', () => {
  assert.equal(TOOL_IDENTITY.version, SELF_PKG.version);
});

test('TOOL_IDENTITY.axeCore matches @axe-core/playwright/package.json', () => {
  assert.equal(TOOL_IDENTITY.axeCore, AXE_PKG.version);
});

test('TOOL_IDENTITY is frozen — cannot be mutated by consumers', () => {
  assert.ok(Object.isFrozen(TOOL_IDENTITY));
  assert.throws(
    () => {
      /** @type {any} */ (TOOL_IDENTITY).name = 'hacked';
    },
    /./,
    'frozen object should reject assignment in strict mode',
  );
});

test('TOOL_IDENTITY values are non-empty strings', () => {
  assert.ok(TOOL_IDENTITY.name.length > 0);
  assert.ok(TOOL_IDENTITY.version.length > 0);
  assert.ok(TOOL_IDENTITY.axeCore.length > 0);
});

test('toolIdentityMarkdownHeader renders as expected', () => {
  const header = toolIdentityMarkdownHeader();
  assert.match(header, /^\*\*Tool:\*\* /);
  assert.match(header, new RegExp(`${escapeRegex(SELF_PKG.name)}`));
  assert.match(header, new RegExp(`${escapeRegex(SELF_PKG.version)}`));
  assert.match(header, new RegExp(`axe-core ${escapeRegex(AXE_PKG.version)}`));
  assert.ok(header.endsWith('\n\n'), 'trailing blank line so prose starts below');
});

/**
 * @param {string} s
 * @returns {string}
 */
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
