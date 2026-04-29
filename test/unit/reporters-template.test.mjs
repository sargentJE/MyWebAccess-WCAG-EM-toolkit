// @ts-check
/**
 * @file Tests for the XSS-safe HTML template helpers — Layer 4 R5.
 * @module test/unit/reporters-template
 *
 * @description
 * Locks the escape-context contracts:
 *   - `text()` escapes the five HTML danger characters.
 *   - `attr()` is a strict superset, also escaping backtick + ASCII
 *     control characters.
 *   - `safeUrl()` admits http/https/relative URLs and quarantines
 *     javascript:, data:, file:, etc to '#'.
 *   - The `html` tagged template runs every interpolation through
 *     `attr()` so authors can't accidentally pick the wrong context.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { text, attr, safeUrl, html } from '../../src/reporters/_template.mjs';

// SECTION: text()

test('text(): escapes the five HTML danger characters', () => {
  assert.equal(text('a & b'), 'a &amp; b');
  assert.equal(text('<x>'), '&lt;x&gt;');
  assert.equal(text('"q"'), '&quot;q&quot;');
  assert.equal(text("o'reilly"), 'o&#39;reilly');
});

test('text(): leaves safe characters alone', () => {
  assert.equal(text('hello world 123'), 'hello world 123');
  assert.equal(text('emoji: 🎉'), 'emoji: 🎉');
  assert.equal(text('backtick `unchanged`'), 'backtick `unchanged`');
});

test('text(): coerces non-string inputs', () => {
  assert.equal(text(null), '');
  assert.equal(text(undefined), '');
  assert.equal(text(42), '42');
  assert.equal(text(true), 'true');
});

// SECTION: attr()

test('attr(): escapes the five HTML danger characters PLUS backtick', () => {
  assert.equal(attr('a & b'), 'a &amp; b');
  assert.equal(attr('with `tick`'), 'with &#96;tick&#96;');
  assert.equal(attr('"break out"'), '&quot;break out&quot;');
});

test('attr(): escapes ASCII control characters as numeric entities', () => {
  // 0x00 NUL, 0x01 SOH, 0x1f US, 0x7f DEL — all should escape.
  assert.equal(attr(String.fromCharCode(0x00)), '&#0;');
  assert.equal(attr(String.fromCharCode(0x01)), '&#1;');
  assert.equal(attr(String.fromCharCode(0x1f)), '&#31;');
  assert.equal(attr(String.fromCharCode(0x7f)), '&#127;');
});

test('attr(): preserves valid whitespace (tab, LF, CR)', () => {
  // 0x09 TAB, 0x0a LF, 0x0d CR — these are legitimate in attribute
  // values and should pass through untouched.
  assert.equal(attr('a\tb'), 'a\tb');
  assert.equal(attr('a\nb'), 'a\nb');
  assert.equal(attr('a\rb'), 'a\rb');
});

// SECTION: safeUrl()

test('safeUrl(): admits http and https schemes', () => {
  assert.equal(safeUrl('http://example.com/path'), 'http://example.com/path');
  assert.equal(safeUrl('https://example.com/path?q=1#h'), 'https://example.com/path?q=1#h');
  assert.equal(safeUrl('HTTPS://example.com'), 'HTTPS://example.com'); // case-insensitive scheme check
});

test('safeUrl(): admits relative URLs (no protocol)', () => {
  assert.equal(safeUrl('/absolute/path'), '/absolute/path');
  assert.equal(safeUrl('relative/path'), 'relative/path');
  assert.equal(safeUrl('../up.html'), '../up.html');
  assert.equal(safeUrl('?just=query'), '?just=query');
  assert.equal(safeUrl('#anchor'), '#anchor');
});

test('safeUrl(): quarantines javascript:, data:, file: schemes to #', () => {
  assert.equal(safeUrl('javascript:alert(1)'), '#');
  assert.equal(safeUrl('JAVASCRIPT:alert(1)'), '#');
  assert.equal(safeUrl('  javascript:alert(1)  '), '#'); // whitespace not a hiding place
  assert.equal(safeUrl('data:text/html,<script>alert(1)</script>'), '#');
  assert.equal(safeUrl('file:///etc/passwd'), '#');
  assert.equal(safeUrl('vbscript:msgbox(1)'), '#');
});

test('safeUrl(): empty / nullish input returns #', () => {
  assert.equal(safeUrl(''), '#');
  assert.equal(safeUrl('   '), '#');
  assert.equal(safeUrl(null), '#');
  assert.equal(safeUrl(undefined), '#');
});

// SECTION: html`...` tagged template

test('html: applies attr() to every interpolation', () => {
  const target = '"><script>alert(1)</script>';
  const out = html`<div data-target="${target}">x</div>`;
  // The attribute breakout `">` must be escaped.
  assert.ok(!out.includes('"><script>'), 'unescaped breakout must not appear');
  assert.ok(out.includes('&quot;&gt;&lt;script&gt;'), 'escaped form must appear');
});

test('html: handles empty interpolations and edge cases', () => {
  assert.equal(html`hello`, 'hello');
  assert.equal(html`a${''}b`, 'ab');
  assert.equal(html`${null}`, '');
  assert.equal(html`${undefined}`, '');
  assert.equal(html`<p>${1 + 1}</p>`, '<p>2</p>');
});

test('html: full XSS payload chain — element + attribute + URL contexts', () => {
  const findingHtml = '<img src=x onerror=alert(1)>';
  const findingTarget = '"><script>alert(1)</script>';
  const findingUrl = 'javascript:alert(1)';
  const out =
    html`<code>${findingHtml}</code>` +
    html`<small data-selector="${findingTarget}">x</small>` +
    html`<a href="${safeUrl(findingUrl)}">link</a>`;
  // 1. Text-context: literal `<img` and `<script>` must not appear in output.
  assert.ok(!out.match(/<img\s+src=x/i), 'text-context img injection neutralised');
  // 2. Attr-context: literal `"><script>` must not appear (would break the attribute).
  assert.ok(!out.includes('"><script>'), 'attr-context breakout neutralised');
  // 3. URL-context: javascript: scheme must be quarantined to '#'.
  assert.ok(out.includes('href="#"'), 'javascript: URL must be quarantined to #');
  assert.ok(!out.includes('href="javascript:'), 'no javascript: URL in output');
});
