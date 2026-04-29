// @ts-check
/**
 * @file Zero-dep XSS-safe HTML template helpers (internal).
 * @module reporters/_template
 *
 * @description
 * Three exports cover the contexts the HTML reporter actually emits into:
 *
 *   - `text(s)` — escapes the five "danger characters" (& < > " ') for HTML
 *     element text content. Every interpolation that lands between tags
 *     uses this.
 *
 *   - `attr(s)` — same five plus backtick + ASCII control characters, for
 *     HTML attribute values. Slightly stricter than `text()`; the backtick
 *     defends against IE-era attribute-quote-degradation.
 *
 *   - the `html` tagged template — applies `attr()` to every interpolation.
 *     Use this for the bulk of HTML rendering; the attribute-context
 *     escape is a STRICT SUPERSET of text-context (always defensive), so
 *     reusing one helper is sound and avoids the "did the author pick the
 *     right context?" footgun.
 *
 * `safeUrl(s)` is a fourth helper for URL-context — `text()` and `attr()`
 * cannot prevent the `<a href="javascript:alert(1)">` vector because `:`
 * and the scheme literal pass through escape unchanged. `safeUrl` returns
 * the URL if its protocol is `http:` or `https:` (or relative), otherwise
 * `'#'`.
 *
 * No `raw()` export — minimal attack surface.
 *
 * @see docs/adr/0008-pluggable-reporters.md
 */

// SECTION: Constants

/** @type {Readonly<Record<string, string>>} */
const TEXT_ESCAPES = Object.freeze({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
});

/** @type {Readonly<Record<string, string>>} */
const ATTR_ESCAPES = Object.freeze({
  ...TEXT_ESCAPES,
  '`': '&#96;',
});

/**
 * Build the attribute-pattern regex programmatically. We deliberately
 * avoid baking literal control bytes into source. Covers the five HTML
 * danger characters, the backtick, and ASCII control characters
 * 0x00-0x08, 0x0b-0x0c, 0x0e-0x1f, 0x7f. (0x09/0x0a/0x0d are valid
 * whitespace and pass through.)
 *
 * @returns {RegExp}
 */
function buildAttrPattern() {
  const dangerChars = ['&', '<', '>', '"', "'", '`'];
  const ranges = [
    [0x00, 0x08],
    [0x0b, 0x0c],
    [0x0e, 0x1f],
    [0x7f, 0x7f],
  ];
  let body = dangerChars.map((c) => escapeForCharClass(c)).join('');
  for (const [lo, hi] of ranges) {
    body += `\\u${lo.toString(16).padStart(4, '0')}`;
    if (hi !== lo) body += `-\\u${hi.toString(16).padStart(4, '0')}`;
  }
  return new RegExp(`[${body}]`, 'g');
}

/**
 * Escape a single character for safe inclusion inside a regex character
 * class.
 *
 * @param {string} ch
 * @returns {string}
 */
function escapeForCharClass(ch) {
  return ch.replace(/[\\^\]-]/g, (m) => `\\${m}`);
}

const TEXT_PATTERN = /[&<>"']/g;
const ATTR_PATTERN = buildAttrPattern();

// SECTION: Public API

/**
 * Escape `s` for HTML element text content (between tags).
 *
 * @param {unknown} s
 * @returns {string}
 */
export function text(s) {
  return String(s ?? '').replace(TEXT_PATTERN, (ch) => TEXT_ESCAPES[ch] ?? ch);
}

/**
 * Escape `s` for HTML attribute value context. Stricter than `text` —
 * also escapes backtick and ASCII control characters that could degrade
 * attribute parsing in older browsers / form-data exfiltration tricks.
 *
 * @param {unknown} s
 * @returns {string}
 */
export function attr(s) {
  return String(s ?? '').replace(ATTR_PATTERN, (ch) => {
    if (ATTR_ESCAPES[ch]) return ATTR_ESCAPES[ch];
    // Control characters — emit as numeric entity.
    return `&#${ch.charCodeAt(0)};`;
  });
}

/**
 * Validate a URL for `<a href>` / `<img src>` rendering. Returns the URL
 * if its protocol is `http:` or `https:` (or relative — no protocol),
 * otherwise returns `#` so the link renders harmlessly. The caller still
 * passes the result through `attr()` for context-correct escaping.
 *
 * @param {unknown} s
 * @returns {string}
 */
export function safeUrl(s) {
  const str = String(s ?? '').trim();
  if (str === '') return '#';
  // Relative URLs lack a `:` before the first `/`, `?`, or `#`. Treat as safe.
  const colonIdx = str.indexOf(':');
  if (colonIdx === -1) return str;
  const slashIdx = str.indexOf('/');
  const questionIdx = str.indexOf('?');
  const hashIdx = str.indexOf('#');
  let firstDelim = Infinity;
  for (const idx of [slashIdx, questionIdx, hashIdx]) {
    if (idx >= 0 && idx < firstDelim) firstDelim = idx;
  }
  if (colonIdx > firstDelim) return str; // colon appears after a path delimiter — relative
  const protocol = str.slice(0, colonIdx).toLowerCase();
  if (protocol === 'http' || protocol === 'https') return str;
  return '#';
}

/**
 * Tagged-template for safe HTML construction. Every interpolation passes
 * through `attr()` — the strict-superset escape — so authors don't need
 * to pick text vs attribute context. Reads as plain backticks-with-vars
 * at call sites.
 *
 * @example
 *   html`<a href="${safeUrl(url)}" data-foo="${target}">${help}</a>`
 *
 * @param {TemplateStringsArray} strings
 * @param {...unknown} values
 * @returns {string}
 */
export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) {
    out += attr(values[i]) + strings[i + 1];
  }
  return out;
}
