// @ts-check
/**
 * @file Unit tests for E5 document detection.
 * @module test/unit/discover-document-inventory
 *
 * @description
 * documentTypeOf drives the manual-review document inventory INDEPENDENTLY of the
 * documentLinkPatterns skip-config, so PDFs are listed for review whether or not
 * the config skips them. Only accessibility-reviewable document families (PDF +
 * office docs) are inventoried — media/archives are skip-only, not review items.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { documentTypeOf } from '../../src/commands/discover.mjs';

test('documentTypeOf: detects PDF + office documents', () => {
  assert.equal(documentTypeOf('https://x.com/newsletter.pdf'), 'pdf');
  assert.equal(documentTypeOf('https://x.com/report.docx'), 'docx');
  assert.equal(documentTypeOf('https://x.com/accounts.xlsx'), 'xlsx');
  assert.equal(documentTypeOf('https://x.com/a/b/deck.pptx'), 'pptx');
  assert.equal(documentTypeOf('https://x.com/notes.rtf'), 'rtf');
});

test('documentTypeOf: ignores the query string and is case-insensitive', () => {
  assert.equal(documentTypeOf('https://x.com/file.PDF?download=1'), 'pdf');
});

test('documentTypeOf: returns null for HTML pages and skip-only families', () => {
  assert.equal(documentTypeOf('https://x.com/about'), null);
  assert.equal(documentTypeOf('https://x.com/page.html'), null);
  // media + archives are skipped from crawling but are not review-inventoried.
  assert.equal(documentTypeOf('https://x.com/video.mp4'), null);
  assert.equal(documentTypeOf('https://x.com/archive.zip'), null);
});

test('documentTypeOf: returns null for malformed URLs', () => {
  assert.equal(documentTypeOf('not a url'), null);
});
