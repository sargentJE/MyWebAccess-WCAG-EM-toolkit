// @ts-check
/**
 * @file Thin filesystem helpers used across every pipeline stage.
 * @module lib/fs-utils
 *
 * @description
 * Four small async helpers that hide `node:fs/promises` boilerplate:
 * `ensureDir` (recursive mkdir), `writeJson` (pretty-printed + trailing newline),
 * `writeText` (UTF-8 write), `readJsonMaybe` (read-or-fallback).
 *
 * Every pipeline stage writes artefacts via these helpers so output formatting
 * stays consistent (2-space indent, trailing newline) for stable diffs across
 * runs — supporting the determinism contract in ADR-0008.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';

// SECTION: Public API

/**
 * Recursively ensure a directory exists and return its resolved path.
 *
 * @param {...string} parts - Path segments joined with `path.join`.
 * @returns {Promise<string>} The joined path (after mkdir succeeds).
 */
export async function ensureDir(...parts) {
  const dir = path.join(...parts);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Write an arbitrary value as pretty-printed JSON (2-space indent, trailing newline).
 *
 * @param {string} filePath - Destination path.
 * @param {unknown} data - Anything `JSON.stringify` can serialise.
 * @returns {Promise<void>}
 */
export async function writeJson(filePath, data) {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/**
 * Write a UTF-8 string unchanged.
 *
 * @param {string} filePath - Destination path.
 * @param {string} text - Contents to write verbatim.
 * @returns {Promise<void>}
 */
export async function writeText(filePath, text) {
  await fs.writeFile(filePath, text, 'utf8');
}

/**
 * Read and JSON-parse a file, returning `fallback` on any error.
 *
 * Used by `summarize` to tolerate missing upstream artefacts (e.g. no
 * process-results.json when `config.processes` is empty).
 *
 * @template T
 * @param {string} filePath - Source path.
 * @param {T} [fallback] - Returned when the file is missing or invalid JSON.
 * @returns {Promise<T>}
 */
export async function readJsonMaybe(filePath, fallback = /** @type {any} */ (null)) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return fallback;
  }
}
