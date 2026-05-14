// @ts-check
/**
 * @file HTML reporter — emits `summary.html` (internal).
 * @module reporters/html
 *
 * @description
 * Zero-dep template-literal renderer per ADR-0008. Every interpolation
 * passes through the `_template.mjs` helpers; the `<style>` block is a
 * module-level literal with NO interpolation (a unit test enforces this).
 *
 * Sections:
 *   1. Tool-identity banner.
 *   2. Site / generated metadata.
 *   3. Run-summary table.
 *   4. Findings-by-SC (when `summary.wcagEmSummary?.criteriaOutcomes`).
 *   5. Findings-by-rule accordion (sortFindings-ordered).
 *   6. Optional passes section when `config.reporting.includePasses === true`.
 *
 * Screenshots embed when `axe-results.json` provides them. The path stored
 * on disk is absolute; the reporter relativises it via
 * `path.relative(ctx.paths.reportsDir, absolutePath)` so the `<img src>`
 * resolves correctly when the report is opened in a browser.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Imports
import path from 'node:path';
import fs from 'node:fs/promises';
import { readJsonMaybe, writeText } from '../lib/fs-utils.mjs';
import { normalizeUrl } from '../lib/urls.mjs';
import { TOOL_IDENTITY } from '../lib/version.mjs';
import { sortFindings } from './_sort.mjs';
import { safeUrl, html } from './_template.mjs';

// SECTION: Module identity
export const name = 'html';

// SECTION: Static CSS — NO interpolation, EVER. Unit test enforces.

const STATIC_CSS = `
  :root { color-scheme: light dark; }
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    line-height: 1.5;
    max-width: 60rem;
    margin: 1rem auto;
    padding: 0 1rem;
    color: #1a1a1a;
    background: #ffffff;
  }
  @media (prefers-color-scheme: dark) {
    body { color: #e8e8e8; background: #121212; }
    a { color: #6db4ff; }
    table { border-color: #444; }
    th, td { border-color: #444; }
    details { border-color: #444; }
  }
  h1 { font-size: 1.6rem; }
  h2 { font-size: 1.25rem; margin-top: 2rem; }
  h3 { font-size: 1.05rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; }
  th, td { border: 1px solid #ddd; padding: 0.4rem 0.6rem; text-align: left; }
  details { border: 1px solid #ddd; padding: 0.5rem 0.75rem; margin: 0.5rem 0; border-radius: 4px; }
  summary { cursor: pointer; font-weight: 600; }
  .impact-critical { color: #b30000; font-weight: 700; }
  .impact-serious  { color: #c43d00; }
  .impact-moderate { color: #806000; }
  .impact-minor    { color: #555; }
  .impact-null     { color: #767676; }
  code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
  pre { white-space: pre-wrap; overflow-wrap: anywhere; background: #f5f5f5; padding: 0.4rem; }
  @media (prefers-color-scheme: dark) { pre { background: #1e1e1e; } }
  .tool-banner { font-size: 0.85rem; color: #555; margin-bottom: 1rem; }
  .screenshot { max-width: 100%; border: 1px solid #ddd; margin-top: 0.5rem; }
  /* Dark-mode content-layer overrides. Source-order AFTER the light rules
     so they win on equal specificity when the @media query matches. Hand-
     calculated against #121212 for WCAG 2.1 AA 4.5:1 and locked by the
     e2e axe-core self-check at test/e2e/reporters-html-axe.test.mjs.
     .tool-banner inherits the same #555 problem as .impact-minor — both
     are too dark on #121212 (2.5 : 1). */
  @media (prefers-color-scheme: dark) {
    .impact-critical { color: #ff5b5b; }
    .impact-serious  { color: #ff8c5b; }
    .impact-moderate { color: #d6a44a; }
    .impact-minor    { color: #c8c8c8; }
    .impact-null     { color: #888; }
    .tool-banner     { color: #aaa; }
  }
`;

// SECTION: Public API

/**
 * Emit `summary.html` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string, resultsDir?: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
  const includePasses = Boolean(ctx?.config?.reporting?.includePasses);
  const screenshotsByUrl = await loadScreenshotMap(ctx);

  const out =
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
    `<meta charset="utf-8">\n` +
    html`<title>Accessibility scan summary — ${summary.site ?? ''}</title>\n` +
    `<style>${STATIC_CSS}</style>\n` +
    `</head>\n<body>\n` +
    renderToolBanner() +
    renderHeader(summary) +
    renderRunSummary(summary) +
    renderCriteriaOutcomes(summary) +
    renderFindings(findings, ctx, screenshotsByUrl) +
    (includePasses ? renderPasses(summary) : '') +
    `\n</body>\n</html>\n`;

  const filePath = path.join(ctx.paths.reportsDir, 'summary.html');
  await writeText(filePath, out);
  const stat = await fs.stat(filePath);
  return { path: filePath, bytes: stat.size };
}

// SECTION: Section renderers

/** @returns {string} */
function renderToolBanner() {
  return html`<div class="tool-banner">Tool: ${TOOL_IDENTITY.name} ${TOOL_IDENTITY.version} (axe-core ${TOOL_IDENTITY.axeCore})</div>\n`;
}

/**
 * @param {Record<string, any>} summary
 * @returns {string}
 */
function renderHeader(summary) {
  return (
    html`<h1>Accessibility scan summary</h1>\n` +
    html`<p>Site: <strong>${summary.site ?? ''}</strong></p>\n` +
    html`<p>Generated: ${summary.generatedAt ?? ''}</p>\n` +
    `<aside><strong>Method guardrails:</strong> ` +
    `This is the automated layer of the audit workflow. ` +
    `It does not make a sitewide WCAG conformance claim on its own. ` +
    `Complete processes and manual checks still need separate review.</aside>\n`
  );
}

/**
 * @param {Record<string, any>} summary
 * @returns {string}
 */
function renderRunSummary(summary) {
  return (
    `<h2>Run summary</h2>\n` +
    `<table>\n<tbody>\n` +
    html`<tr><th>Inventory count</th><td>${summary.inventoryCount ?? 0}</td></tr>\n` +
    html`<tr><th>Final selected sample</th><td>${summary.finalSampleCount ?? 0}</td></tr>\n` +
    html`<tr><th>Sample pages scanned</th><td>${summary.samplePagesScanned ?? 0}</td></tr>\n` +
    html`<tr><th>Process runs</th><td>${summary.processRuns ?? 0}</td></tr>\n` +
    html`<tr><th>Grouped findings</th><td>${summary.groupedFindingCount ?? 0}</td></tr>\n` +
    `</tbody>\n</table>\n`
  );
}

/**
 * @param {Record<string, any>} summary
 * @returns {string}
 */
function renderCriteriaOutcomes(summary) {
  const wcagEm = summary.wcagEmSummary;
  const outcomes = Array.isArray(wcagEm?.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
  if (outcomes.length === 0) return '';
  let out = `<h2>Findings by WCAG success criterion</h2>\n<table>\n<thead>\n`;
  out += `<tr><th>Criterion</th><th>Outcome</th><th>Related rules</th></tr>\n`;
  out += `</thead>\n<tbody>\n`;
  for (const c of outcomes) {
    out += html`<tr><td>${c.sc ?? ''}</td><td>${c.outcome ?? ''}</td><td>${(Array.isArray(c.relatedRules) ? c.relatedRules : []).join(', ')}</td></tr>\n`;
  }
  out += `</tbody>\n</table>\n`;
  return out;
}

/**
 * @param {ReadonlyArray<Record<string, any>>} findings
 * @param {{ paths: { reportsDir: string } }} ctx
 * @param {Map<string, string[]>} screenshotsByUrl
 * @returns {string}
 */
function renderFindings(findings, ctx, screenshotsByUrl) {
  if (findings.length === 0) {
    return `<h2>Grouped findings by rule</h2>\n<p>No findings.</p>\n`;
  }
  let out = `<h2>Grouped findings by rule</h2>\n`;
  for (const f of findings) {
    const impactClass = `impact-${typeof f.impact === 'string' ? f.impact : 'null'}`;
    out += `<details>\n`;
    out += html`<summary><code>${f.id ?? ''}</code> · <span class="${impactClass}">${f.impact ?? 'n/a'}</span> · ${f.pageCount ?? 0} pages</summary>\n`;
    out += `<dl>\n`;
    if (f.classification) out += html`<dt>Classification</dt><dd>${f.classification}</dd>\n`;
    if (f.help) out += html`<dt>Help</dt><dd>${f.help}</dd>\n`;
    if (f.helpUrl) {
      const href = safeUrl(f.helpUrl);
      out += `<dt>Rule URL</dt><dd>` + html`<a href="${href}">${f.helpUrl}</a></dd>\n`;
    }
    if (Array.isArray(f.pageTypes) && f.pageTypes.length) {
      out += html`<dt>Page types</dt><dd>${f.pageTypes.join(', ')}</dd>\n`;
    }
    if (Array.isArray(f.targets) && f.targets.length) {
      out += html`<dt>Example target</dt><dd><code>${f.targets[0]}</code></dd>\n`;
    }
    out += `</dl>\n`;

    // First screenshot from any page that has one.
    const pages = Array.isArray(f.pages) ? f.pages : [];
    for (const url of pages) {
      const shots = screenshotsByUrl.get(url);
      if (shots && shots.length > 0) {
        // path.relative emits OS-native separators — backslashes on
        // Windows. HTML `src=` attribute requires forward slashes per the
        // URL standard, so normalise unconditionally. Same logic as
        // upstream URL-encoding libraries; we have no consumer that
        // wants Windows paths in HTML output.
        const rel = path.relative(ctx.paths.reportsDir, shots[0]).split(path.sep).join('/');
        out += html`<img class="screenshot" alt="Page screenshot" src="${rel}">\n`;
        break;
      }
    }
    out += `</details>\n`;
  }
  return out;
}

/**
 * @param {Record<string, any>} summary
 * @returns {string}
 */
function renderPasses(summary) {
  const wcagEm = summary.wcagEmSummary;
  /** @type {Array<{ sc?: string, outcome?: string }>} */
  const outcomes = Array.isArray(wcagEm?.criteriaOutcomes) ? wcagEm.criteriaOutcomes : [];
  const passed = outcomes.filter((c) => c?.outcome === 'passed');
  if (passed.length === 0) return '';
  let out = `<h2>Passing criteria</h2>\n<ul>\n`;
  for (const c of passed) {
    out += html`<li>${c.sc ?? ''}</li>\n`;
  }
  out += `</ul>\n`;
  return out;
}

// SECTION: Internal helpers

/**
 * Read `axe-results.json` and build a Map of page-url → screenshot
 * absolute paths. Empty Map if the file is missing or unreadable —
 * the reporter degrades gracefully rather than failing the whole run.
 *
 * @param {{ paths: { resultsDir?: string } }} ctx
 * @returns {Promise<Map<string, string[]>>}
 */
async function loadScreenshotMap(ctx) {
  /** @type {Map<string, string[]>} */
  const map = new Map();
  if (!ctx?.paths?.resultsDir) return map;
  /** @type {any[]} */
  const axeResults = await readJsonMaybe(
    path.join(ctx.paths.resultsDir, 'axe-results.json'),
    [],
  );
  for (const entry of axeResults) {
    const url = typeof entry?.url === 'string' ? normalizeUrl(entry.url) : null;
    const shot = entry?.screenshot;
    if (typeof url !== 'string' || typeof shot !== 'string') continue;
    if (!map.has(url)) map.set(url, []);
    /** @type {string[]} */ (map.get(url)).push(shot);
  }
  return map;
}
