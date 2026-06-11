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
 * Writes are atomic (temp file + same-directory rename) so a crash mid-write
 * can never leave a truncated artefact for a later stage to half-read; reads
 * distinguish "missing" (expected — e.g. no process-results.json when
 * `config.processes` is empty) from "present but unreadable" (corruption —
 * surfaced loudly via the optional logger before falling back).
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import fs from 'node:fs/promises';
import path from 'node:path';

// SECTION: Internal helpers

/**
 * Atomic write: write to a sibling temp file, then rename over the target.
 * Same-directory rename is atomic on POSIX same-volume filesystems, which
 * out-dir writes are by construction.
 *
 * @param {string} filePath - Destination path.
 * @param {string} contents - UTF-8 payload.
 * @returns {Promise<void>}
 */
async function writeAtomic(filePath, contents) {
  const tmpPath = `${filePath}.tmp-${process.pid}`;
  try {
    await fs.writeFile(tmpPath, contents, 'utf8');
    await fs.rename(tmpPath, filePath);
  } catch (err) {
    // Best-effort cleanup so a failed write never strands a .tmp sibling.
    await fs.rm(tmpPath, { force: true }).catch(() => {});
    throw err;
  }
}

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
 * Write an arbitrary value as pretty-printed JSON (2-space indent, trailing
 * newline). Atomic: a crash mid-write leaves the previous file (or nothing),
 * never a truncated one.
 *
 * @param {string} filePath - Destination path.
 * @param {unknown} data - Anything `JSON.stringify` can serialise.
 * @returns {Promise<void>}
 */
export async function writeJson(filePath, data) {
  await writeAtomic(filePath, JSON.stringify(data, null, 2) + '\n');
}

/**
 * Write a UTF-8 string unchanged. Atomic (see `writeJson`).
 *
 * @param {string} filePath - Destination path.
 * @param {string} text - Contents to write verbatim.
 * @returns {Promise<void>}
 */
export async function writeText(filePath, text) {
  await writeAtomic(filePath, text);
}

/**
 * Read and JSON-parse a file, returning `fallback` when it cannot be used.
 *
 * A missing file (ENOENT) is an EXPECTED condition and stays silent. Any
 * other failure — unreadable file, corrupt/truncated JSON — is a signal the
 * pipeline state is damaged, so it is reported through `logger.warn` (when a
 * logger is provided) before the fallback is returned; a corrupt artefact
 * must never silently masquerade as an empty-but-healthy one
 * (2026-06 review, finding C2).
 *
 * @template T
 * @param {string} filePath - Source path.
 * @param {T} [fallback] - Returned when the file is missing or invalid JSON.
 * @param {{ warn: (obj: object, msg: string) => void } | undefined} [logger]
 *   Optional pino-style logger for the corrupt/unreadable case.
 * @returns {Promise<T>}
 */
export async function readJsonMaybe(filePath, fallback = /** @type {any} */ (null), logger) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch (err) {
    const code = /** @type {NodeJS.ErrnoException} */ (err)?.code;
    if (code !== 'ENOENT' && typeof logger?.warn === 'function') {
      logger.warn(
        { file: filePath, err: err instanceof Error ? err.message : String(err) },
        'artefact present but unreadable; using fallback — pipeline state may be corrupt',
      );
    }
    return fallback;
  }
}
