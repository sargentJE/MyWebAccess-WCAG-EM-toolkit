// @ts-check
/**
 * @file Unit tests for `src/lib/urls.mjs`.
 * @module test/unit/urls
 *
 * @description
 * Covers the full urls.mjs surface: normalisation, filesystem-safe name
 * derivation, path-segment extraction, scope enforcement, and the
 * `RegExp[]` shape of `urlExcludedByPatterns`.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeUrl,
  fileSafeFromUrl,
  firstPathSegment,
  urlAllowedByScope,
  urlExcludedByPatterns,
  urlSkippedByExtension,
} from '../../src/lib/urls.mjs';

// SECTION: normalizeUrl

test('normalizeUrl strips the fragment', () => {
  assert.strictEqual(normalizeUrl('https://example.com/#section'), 'https://example.com/');
});

test('normalizeUrl drops the default https port', () => {
  assert.strictEqual(normalizeUrl('https://example.com:443/page'), 'https://example.com/page');
});

test('normalizeUrl drops the default http port', () => {
  assert.strictEqual(normalizeUrl('http://example.com:80/page'), 'http://example.com/page');
});

test('normalizeUrl removes tracking params (utm_*, fbclid, gclid, mc_*)', () => {
  const input = 'https://example.com/page?utm_source=google&fbclid=abc&keep=1';
  assert.strictEqual(normalizeUrl(input), 'https://example.com/page?keep=1');
});

test('normalizeUrl sorts remaining params alphabetically', () => {
  assert.strictEqual(
    normalizeUrl('https://example.com/page?z=1&a=2'),
    'https://example.com/page?a=2&z=1',
  );
});

test('normalizeUrl trims trailing slash except on root', () => {
  assert.strictEqual(normalizeUrl('https://example.com/about/'), 'https://example.com/about');
  assert.strictEqual(normalizeUrl('https://example.com/'), 'https://example.com/');
});

// SECTION: fileSafeFromUrl

test('fileSafeFromUrl replaces unsafe characters with underscore', () => {
  assert.strictEqual(fileSafeFromUrl('https://example.com/a/b?c=1'), 'example.com_a_b_c_1');
});

// SECTION: firstPathSegment

test('firstPathSegment returns (root) for "/"', () => {
  assert.strictEqual(firstPathSegment('https://example.com/'), '(root)');
});

test('firstPathSegment returns the first segment for deeper paths', () => {
  assert.strictEqual(firstPathSegment('https://example.com/blog/post-1'), 'blog');
});

// SECTION: urlAllowedByScope

test('urlAllowedByScope same-hostname accepts same host', () => {
  assert.strictEqual(
    urlAllowedByScope('https://example.com/page', 'https://example.com/', {
      mode: 'same-hostname',
    }),
    true,
  );
});

test('urlAllowedByScope same-hostname rejects different host', () => {
  assert.strictEqual(
    urlAllowedByScope('https://evil.example.com/page', 'https://example.com/', {
      mode: 'same-hostname',
    }),
    false,
  );
});

test('urlAllowedByScope same-origin rejects different port', () => {
  assert.strictEqual(
    urlAllowedByScope('https://example.com:8080/page', 'https://example.com/', {
      mode: 'same-origin',
    }),
    false,
  );
});

test('urlAllowedByScope allowed-hosts permits listed host', () => {
  assert.strictEqual(
    urlAllowedByScope('https://partner.example.com/page', 'https://example.com/', {
      mode: 'allowed-hosts',
      allowedHosts: ['partner.example.com'],
    }),
    true,
  );
});

test('urlAllowedByScope allowed-hosts rejects unlisted host', () => {
  assert.strictEqual(
    urlAllowedByScope('https://evil.example.com/page', 'https://example.com/', {
      mode: 'allowed-hosts',
      allowedHosts: ['partner.example.com'],
    }),
    false,
  );
});

// SECTION: urlExcludedByPatterns (Layer-2 RegExp[] shape)

test('urlExcludedByPatterns returns false for empty pattern list', () => {
  assert.strictEqual(urlExcludedByPatterns('https://example.com/page', []), false);
});

test('urlExcludedByPatterns matches against a compiled RegExp', () => {
  assert.strictEqual(
    urlExcludedByPatterns('https://example.com/admin/dashboard', [/^https?:\/\/[^/]+\/admin/]),
    true,
  );
});

test('urlExcludedByPatterns ORs multiple patterns', () => {
  const patterns = [/\/admin/, /\?debug=1/];
  assert.strictEqual(urlExcludedByPatterns('https://example.com/page?debug=1', patterns), true);
  assert.strictEqual(urlExcludedByPatterns('https://example.com/public', patterns), false);
});

// SECTION: urlSkippedByExtension (P2 — pathname-only extension predicate)

test('urlSkippedByExtension returns false when pathname has no recognised extension', () => {
  assert.strictEqual(urlSkippedByExtension('https://x.com/page', [/\.pdf$/]), false);
});

test('urlSkippedByExtension returns true when pathname matches a compiled pattern', () => {
  assert.strictEqual(urlSkippedByExtension('https://x.com/file.pdf', [/\.pdf$/]), true);
});

test('urlSkippedByExtension ignores querystring after the extension', () => {
  assert.strictEqual(urlSkippedByExtension('https://x.com/file.pdf?download=1', [/\.pdf$/]), true);
});

test('urlSkippedByExtension ignores fragment after the extension', () => {
  assert.strictEqual(urlSkippedByExtension('https://x.com/file.pdf#section', [/\.pdf$/]), true);
});

test('urlSkippedByExtension returns false on malformed URLs (defensive)', () => {
  assert.strictEqual(urlSkippedByExtension('not-a-url', [/\.pdf$/]), false);
});

test('urlSkippedByExtension returns false when compiledPatterns is empty (short-circuit)', () => {
  assert.strictEqual(urlSkippedByExtension('https://x.com/file.pdf', []), false);
});
