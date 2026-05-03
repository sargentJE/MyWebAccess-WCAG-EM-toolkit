// @ts-check
/**
 * @file Tests for `captureDiscoveryMetadata` — D2 fix's extracted helper.
 * @module test/unit/discover-evaluate
 *
 * @description
 * The helper is designed to run inside `page.evaluate` (browser context with
 * `document` global). For unit tests we stub `globalThis.document` with a
 * minimal object that mirrors the methods the helper actually calls
 * (`querySelector`, `querySelectorAll`, plus `.textContent` / `.getAttribute`
 * on returned nodes). JSDOM is intentionally NOT a project dependency.
 *
 * The four cases below cover the AU-style failure modes (missing elements
 * return null/0, never hang) plus the positive happy-path case.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { captureDiscoveryMetadata } from '../../src/commands/discover.mjs';

// SECTION: Helpers

/**
 * @param {{ h1Text?: string|null, canonicalHref?: string|null, formCount?: number, landmarkCount?: number, searchInputCount?: number }} [shape]
 * @returns {{ querySelector: (sel: string) => any, querySelectorAll: (sel: string) => any[] }}
 */
function makeDoc(shape = {}) {
  const {
    h1Text = null,
    canonicalHref = null,
    formCount = 0,
    landmarkCount = 0,
    searchInputCount = 0,
  } = shape;
  return {
    querySelector(/** @type {string} */ sel) {
      if (sel === 'h1' && h1Text !== null) return { textContent: h1Text };
      if (sel === 'link[rel="canonical"]' && canonicalHref !== null) {
        return {
          getAttribute: (/** @type {string} */ n) => (n === 'href' ? canonicalHref : null),
        };
      }
      return null;
    },
    querySelectorAll(/** @type {string} */ sel) {
      if (sel === 'form') return new Array(formCount);
      // The landmark and search-input selectors are composite (`main, nav,
      // header, ...`); match by substring so the stub doesn't have to mirror
      // the exact selector string.
      if (sel.includes('main, nav, header')) return new Array(landmarkCount);
      if (sel.includes('input[type="search"]')) return new Array(searchInputCount);
      return [];
    },
  };
}

const ALL_FLAGS_TRUE = {
  captureH1: true,
  captureCanonical: true,
  captureForms: true,
  captureLandmarks: true,
  captureSearchInputs: true,
};

/**
 * Run the helper with `globalThis.document` stubbed; restore after.
 *
 * @template T
 * @param {ReturnType<typeof makeDoc>} doc
 * @param {() => T} fn
 * @returns {T}
 */
function withDocument(doc, fn) {
  // @ts-expect-error — document is a browser global; tests inject it for SSR-style execution.
  globalThis.document = doc;
  try {
    return fn();
  } finally {
    // @ts-expect-error — same as above
    delete globalThis.document;
  }
}

// SECTION: Negative cases — missing elements (the AU-style failure modes)

test('captureDiscoveryMetadata: page with no <h1> returns h1=null cleanly (no hang)', () => {
  const out = withDocument(makeDoc({ h1Text: null }), () =>
    captureDiscoveryMetadata(ALL_FLAGS_TRUE),
  );
  assert.equal(out.h1, null);
  // Other fields default to null/0 since the mock doc has no other elements either.
  assert.equal(out.canonical, null);
  assert.equal(out.formCount, 0);
  assert.equal(out.landmarkCount, 0);
  assert.equal(out.searchInputCount, 0);
});

test('captureDiscoveryMetadata: page with no canonical returns canonical=null cleanly', () => {
  const out = withDocument(makeDoc({ canonicalHref: null, h1Text: 'A' }), () =>
    captureDiscoveryMetadata(ALL_FLAGS_TRUE),
  );
  assert.equal(out.canonical, null);
  assert.equal(out.h1, 'A');
});

test('captureDiscoveryMetadata: page with no landmarks returns landmarkCount=0', () => {
  const out = withDocument(makeDoc({ landmarkCount: 0 }), () =>
    captureDiscoveryMetadata(ALL_FLAGS_TRUE),
  );
  assert.equal(out.landmarkCount, 0);
});

// SECTION: Positive case — happy path

test('captureDiscoveryMetadata: all elements present captures all fields correctly', () => {
  const out = withDocument(
    makeDoc({
      h1Text: 'Welcome',
      canonicalHref: 'https://x.com/canonical',
      formCount: 2,
      landmarkCount: 3,
      searchInputCount: 1,
    }),
    () => captureDiscoveryMetadata(ALL_FLAGS_TRUE),
  );
  assert.equal(out.h1, 'Welcome');
  assert.equal(out.canonical, 'https://x.com/canonical');
  assert.equal(out.formCount, 2);
  assert.equal(out.landmarkCount, 3);
  assert.equal(out.searchInputCount, 1);
});

// SECTION: Flag gating — discovery.capture* flags suppress respective queries

test('captureDiscoveryMetadata: flags=false skip respective DOM queries (return null/0)', () => {
  const out = withDocument(
    makeDoc({
      h1Text: 'Welcome',
      canonicalHref: 'https://x.com/canonical',
      formCount: 5,
      landmarkCount: 4,
      searchInputCount: 2,
    }),
    () =>
      captureDiscoveryMetadata({
        captureH1: false,
        captureCanonical: false,
        captureForms: false,
        captureLandmarks: false,
        captureSearchInputs: false,
      }),
  );
  // All disabled, so all return defaults regardless of what's in the doc.
  assert.equal(out.h1, null);
  assert.equal(out.canonical, null);
  assert.equal(out.formCount, 0);
  assert.equal(out.landmarkCount, 0);
  assert.equal(out.searchInputCount, 0);
});
