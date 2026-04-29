// @ts-check
/**
 * @file JUnit XML reporter — emits `junit.xml` (internal).
 * @module reporters/junit
 *
 * @description
 * Hand-rolled XML, zero deps. Pa11y-compatible single-`<testsuite>` shape:
 * one `<testcase>` per (rule × url × first-target), with `<failure>` for
 * both `failed` and `incomplete` results so CI fails on cantTell rather
 * than silently passing.
 *
 * Truncation is character-based (`Array.from(s).slice(...).join('')`) so
 * UTF-8 multi-byte sequences are never split — invalid UTF-8 in CDATA
 * would break strict XML parsers. `]]>` is defused via the canonical
 * replacement `]]]]><![CDATA[>` (close + reopen the CDATA section so the
 * literal substring survives without terminating the wrapping block).
 *
 * `inapplicable` axe results are NEVER emitted (volume drowns the report).
 * `passed` results emit `<testcase>` with no failure child only when
 * `reporting.includePasses === true`.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { writeText } from '../lib/fs-utils.mjs';
import { sortFindings } from './_sort.mjs';

// SECTION: Module identity
export const name = 'junit';

// SECTION: Constants

/** Maximum chars for the embedded violation HTML in CDATA. */
const HTML_TRUNCATE = 400;

// SECTION: Public API

/**
 * Emit `junit.xml` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const includePasses = Boolean(ctx?.config?.reporting?.includePasses);
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);

  /** @type {string[]} */
  const cases = [];
  let testsCount = 0;
  let failuresCount = 0;

  for (const f of findings) {
    const ruleId = String(f.id ?? '');
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const firstTarget = Array.isArray(f.targets) && f.targets.length ? String(f.targets[0]) : '';
    const exampleHtml = Array.isArray(f.examples) && f.examples[0]?.html
      ? String(f.examples[0].html)
      : '';
    // Treat findings as failures unless they declare otherwise. Layer 3b's
    // grouped findings are violation-only by construction; future layers
    // may extend.
    const outcome = typeof f.outcome === 'string' ? f.outcome : 'failed';
    if (outcome === 'inapplicable') continue;
    if (outcome === 'passed' && !includePasses) continue;

    for (const url of pages) {
      const caseName = firstTarget ? `${url}#${firstTarget}` : url;
      testsCount += 1;
      const failureType =
        outcome === 'incomplete' ? 'incomplete' : (typeof f.impact === 'string' ? f.impact : 'failed');
      if (outcome === 'passed') {
        // No failure child for clean passes (only emitted when includePasses=true).
        cases.push(
          `  <testcase classname="${escapeXmlAttr(ruleId)}" name="${escapeXmlAttr(caseName)}"/>`,
        );
      } else {
        failuresCount += 1;
        const body = buildFailureBody({
          help: typeof f.help === 'string' ? f.help : '',
          helpUrl: typeof f.helpUrl === 'string' ? f.helpUrl : '',
          selector: firstTarget,
          html: exampleHtml,
        });
        cases.push(
          `  <testcase classname="${escapeXmlAttr(ruleId)}" name="${escapeXmlAttr(caseName)}">\n` +
            `    <failure type="${escapeXmlAttr(failureType)}"><![CDATA[${defuseCdata(body)}]]></failure>\n` +
            `  </testcase>`,
        );
      }
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<testsuite name="WCAG-EM Audit" tests="${testsCount}" failures="${failuresCount}" time="0">\n` +
    cases.join('\n') +
    (cases.length > 0 ? '\n' : '') +
    `</testsuite>\n`;

  const filePath = path.join(ctx.paths.reportsDir, 'junit.xml');
  await writeText(filePath, xml);
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}

// SECTION: Internal helpers

/**
 * Escape a string for XML attribute value context. Covers the five XML
 * predefined entities; control characters are stripped (XML 1.0 forbids
 * most of them in any context, even via numeric reference).
 *
 * @param {string} s
 * @returns {string}
 */
function escapeXmlAttr(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(stripControlPattern(), '');
}

/**
 * Defuse `]]>` inside CDATA content. The canonical replacement closes
 * the current CDATA, emits the literal `>`, then reopens — net effect
 * is the substring `]]>` survives but never terminates the wrapping
 * CDATA section.
 *
 * @param {string} s
 * @returns {string}
 */
function defuseCdata(s) {
  return String(s ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>');
}

/**
 * Char-based truncation that preserves UTF-8 multi-byte boundaries.
 * `Array.from(str)` iterates by code point so surrogate pairs (4-byte
 * emoji etc) are treated as one logical char, not two halves.
 *
 * @param {string} s
 * @param {number} maxChars
 * @returns {string}
 */
function truncateChars(s, maxChars) {
  if (typeof s !== 'string' || s.length <= maxChars) return s ?? '';
  const chars = Array.from(s);
  if (chars.length <= maxChars) return s;
  return chars.slice(0, maxChars).join('') + '…';
}

/**
 * Compose the failure body — the CDATA payload that goes inside
 * `<failure>...</failure>`. Lines: help, helpUrl, selector, truncated
 * outerHTML.
 *
 * @param {{ help: string, helpUrl: string, selector: string, html: string }} args
 * @returns {string}
 */
function buildFailureBody({ help, helpUrl, selector, html }) {
  const parts = [];
  if (help) parts.push(help);
  if (helpUrl) parts.push(helpUrl);
  if (selector) parts.push(`Selector: ${selector}`);
  if (html) parts.push(`HTML: ${truncateChars(html, HTML_TRUNCATE)}`);
  return parts.join('\n');
}

/**
 * Build the regex stripping XML 1.0-illegal control characters. Built
 * programmatically to keep the source readable (no literal control bytes
 * in the file). XML 1.0 admits 0x09 (tab), 0x0a (LF), 0x0d (CR); every
 * other byte 0x00-0x1f is illegal and we strip rather than escape.
 *
 * @returns {RegExp}
 */
function stripControlPattern() {
  const ranges = [
    [0x00, 0x08],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
  ];
  let body = '';
  for (const [lo, hi] of ranges) {
    body += `\\u${lo.toString(16).padStart(4, '0')}-\\u${hi.toString(16).padStart(4, '0')}`;
  }
  return new RegExp(`[${body}]`, 'g');
}
