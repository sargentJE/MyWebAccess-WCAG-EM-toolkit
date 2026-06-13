// @ts-check
/**
 * @file Unit tests for crawl-failure reason bucketing (E1).
 * @module test/unit/discover-failed-request
 *
 * @description
 * classifyCrawlFailure turns Crawlee's per-request failures into the
 * low-cardinality reason buckets that land in inventory-metadata.json, so crawl
 * loss is visible in every report instead of living only in warn logs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrawlFailure } from '../../src/commands/discover.mjs';

test('classifyCrawlFailure: navigation timeouts bucket as timeout', () => {
  assert.equal(
    classifyCrawlFailure(new Error('Navigation timeout of 60000 ms exceeded')),
    'timeout',
  );
});

test('classifyCrawlFailure: DNS/connection errors bucket as network', () => {
  assert.equal(classifyCrawlFailure(new Error('net::ERR_NAME_NOT_RESOLVED')), 'network');
  assert.equal(classifyCrawlFailure(new Error('getaddrinfo ENOTFOUND example.com')), 'network');
});

test('classifyCrawlFailure: 4xx/5xx statuses bucket as http-error', () => {
  assert.equal(classifyCrawlFailure(new Error('Request failed with status 503')), 'http-error');
  assert.equal(classifyCrawlFailure(new Error('server returned 404')), 'http-error');
});

test('classifyCrawlFailure: goto/navigation failures without a status bucket as navigation', () => {
  assert.equal(
    classifyCrawlFailure(new Error('page.goto failed to load the document')),
    'navigation',
  );
});

test('classifyCrawlFailure: anything else buckets as other', () => {
  assert.equal(classifyCrawlFailure(new Error('something unexpected happened')), 'other');
  assert.equal(classifyCrawlFailure(undefined), 'other');
});

test('classifyCrawlFailure: falls back to request.errorMessages when error is absent', () => {
  assert.equal(
    classifyCrawlFailure(undefined, { errorMessages: ['first', 'Timeout exceeded'] }),
    'timeout',
  );
});
