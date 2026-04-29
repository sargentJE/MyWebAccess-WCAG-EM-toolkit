// @ts-check
/**
 * @file JSON reporter — emits `summary.json` (internal).
 * @module reporters/json
 *
 * @description
 * Wraps the `writeJson(reportsDir, 'summary.json', summary)` call that
 * `summarize.mjs` previously invoked inline. Routes findings through the
 * shared `sortFindings` helper for byte-stable output (the previous inline
 * sort at `summarize.mjs:265-268` only ordered by impact; this reporter adds
 * the `ruleId asc` tiebreaker the canonical contract requires).
 *
 * The `tool` (TOOL_IDENTITY) field is preserved as the first key of the
 * emitted object — JSON.stringify respects own-enumerable string-key
 * insertion order per the ES2015+ spec. Spreading `summary` after `tool`
 * would shadow it; the spread happens BEFORE `findings` is overridden.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeJson } from '../lib/fs-utils.mjs';
import { sortFindings } from './_sort.mjs';

// SECTION: Module identity
export const name = 'json';

// SECTION: Public API

/**
 * Emit `summary.json` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string } }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const out = {
    ...summary,
    findings: sortFindings(Array.isArray(summary.findings) ? summary.findings : []),
  };
  const filePath = path.join(ctx.paths.reportsDir, 'summary.json');
  await writeJson(filePath, out);
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}
