// @ts-check
/**
 * @file Unit tests for classifyPageOutcome (page-guard).
 * @module test/unit/scan-page-guard
 *
 * @description
 * Covers the §5.6 contract cases plus the false-positive guards: header/status
 * are primary, title/content corroborate only, and the weaker heuristic is
 * host-allowlisted. The "just a moment in a real article" case is the one that
 * would re-introduce the original defect if a future edit simplified the
 * classifier to a body-substring check.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPageOutcome, challengeCleared } from '../../src/lib/page-guard.mjs';

const HOST = 'www.myvision.org.uk';
const allow = [HOST];

test('classifyPageOutcome: real 200 content is ok', () => {
  const r = classifyPageOutcome({
    status: 200,
    headers: { 'content-type': 'text/html' },
    title: 'Home',
    bodyText: 'Welcome to our charity',
    url: `https://${HOST}/`,
    challengeHosts: allow,
  });
  assert.equal(r.outcome, 'ok');
});

test('classifyPageOutcome: cf-mitigated header is challenge (authoritative, no allowlist needed)', () => {
  const r = classifyPageOutcome({
    status: 403,
    headers: { 'cf-mitigated': 'challenge', 'cf-ray': 'abc123' },
    title: 'Just a moment...',
    bodyText: 'Checking your browser before accessing',
    url: 'https://anything.example/event/x',
    challengeHosts: [],
  });
  assert.equal(r.outcome, 'challenge');
});

test('classifyPageOutcome: headers are matched case-insensitively', () => {
  const r = classifyPageOutcome({
    status: 403,
    headers: { 'CF-Mitigated': 'challenge' },
    bodyText: 'x',
    url: `https://${HOST}/e`,
  });
  assert.equal(r.outcome, 'challenge');
});

test('classifyPageOutcome: about:blank is empty', () => {
  const r = classifyPageOutcome({ status: 200, url: 'about:blank', bodyText: '' });
  assert.equal(r.outcome, 'empty');
});

test('classifyPageOutcome: a whitespace-only body is empty', () => {
  const r = classifyPageOutcome({
    status: 200,
    title: 'x',
    bodyText: '   \n  ',
    url: `https://${HOST}/thin`,
    challengeHosts: allow,
  });
  assert.equal(r.outcome, 'empty');
});

test('classifyPageOutcome: "just a moment" in a real article body stays ok (title never alone)', () => {
  const r = classifyPageOutcome({
    status: 200,
    headers: {},
    title: 'Just a moment with our trustees',
    bodyText: 'A long article reflecting on a moment in our charity history...',
    url: `https://${HOST}/latest/just-a-moment-with-our-trustees`,
    challengeHosts: allow,
  });
  assert.equal(r.outcome, 'ok');
});

test('classifyPageOutcome: interstitial title + challenge status on an allowlisted host is challenge', () => {
  const r = classifyPageOutcome({
    status: 503,
    headers: { 'cf-ray': 'deadbeef' },
    title: 'Just a moment...',
    bodyText: 'Enable JavaScript and cookies to continue',
    url: `https://${HOST}/events/`,
    challengeHosts: allow,
  });
  assert.equal(r.outcome, 'challenge');
});

test('classifyPageOutcome: the corroborated heuristic does not fire off the host allowlist', () => {
  const r = classifyPageOutcome({
    status: 503,
    headers: { 'cf-ray': 'deadbeef' },
    title: 'Just a moment...',
    bodyText: 'Enable JavaScript and cookies to continue',
    url: 'https://other.example/events/',
    challengeHosts: allow, // host not in the list
  });
  assert.equal(r.outcome, 'ok');
});

test('classifyPageOutcome: a thin-but-nonempty 404 without challenge signals stays ok', () => {
  const r = classifyPageOutcome({
    status: 404,
    headers: {},
    title: 'Not found',
    bodyText: 'Page not found',
    url: `https://${HOST}/missing`,
    challengeHosts: allow,
  });
  assert.equal(r.outcome, 'ok');
});

// SECTION: challengeCleared (§0a auto-solve re-check)

test('challengeCleared: real content (non-interstitial title + body) is cleared', () => {
  assert.equal(
    challengeCleared({ title: 'Our events', bodyText: 'Full programme of events this autumn...' }),
    true,
  );
});

test('challengeCleared: a persistent interstitial title is NOT cleared', () => {
  assert.equal(
    challengeCleared({
      title: 'Just a moment...',
      bodyText: 'Checking your browser before access',
    }),
    false,
  );
});

test('challengeCleared: an empty body is NOT cleared', () => {
  assert.equal(challengeCleared({ title: 'Loading', bodyText: '   \n ' }), false);
});
