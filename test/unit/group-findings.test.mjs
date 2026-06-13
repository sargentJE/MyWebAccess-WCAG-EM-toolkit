// @ts-check
/**
 * @file Unit tests for the extracted grouping logic.
 * @module test/unit/group-findings
 *
 * @description
 * groupFindings was lifted verbatim out of summarize.run(); these tests lock
 * its contract in isolation so the two epics that edit it next (E1 skip
 * non-auditable views, E4 group by final-URL identity) have a fast, focused
 * harness. End-to-end neutrality is additionally guarded by the existing
 * summarize-url-dedup / summarize-execution-health suites.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupFindings } from '../../src/lib/group-findings.mjs';

function deps(overrides = {}) {
  return {
    actMap: {},
    inventoryByUrl: new Map([
      [
        'https://x.com/a',
        { url: 'https://x.com/a', pageType: 'content', clusterKey: 'content::a' },
      ],
      [
        'https://x.com/b',
        { url: 'https://x.com/b', pageType: 'listing', clusterKey: 'listing::b' },
      ],
    ]),
    structuredSet: new Set(['https://x.com/a']),
    randomSet: new Set(['https://x.com/b']),
    reportingConfig: {},
    ...overrides,
  };
}

const axeResults = [
  {
    url: 'https://x.com/a',
    violations: [
      {
        id: 'color-contrast',
        impact: 'serious',
        tags: ['wcag2aa', 'wcag143'],
        nodes: [
          { target: ['.btn'], html: '<button>', failureSummary: 'fix it' },
          { target: ['.link'], html: '<a>', failureSummary: 'fix it' },
        ],
      },
    ],
  },
  {
    url: 'https://x.com/b',
    violations: [
      {
        id: 'image-alt',
        impact: 'critical',
        tags: ['wcag2a', 'wcag111'],
        nodes: [{ target: ['img'], html: '<img>', failureSummary: null }],
      },
    ],
  },
];

test('groupFindings: buckets violations by rule with occurrence + page counts', () => {
  const { groupedByRule } = groupFindings(axeResults, [], deps());
  assert.equal(groupedByRule.size, 2);
  const cc = groupedByRule.get('color-contrast');
  assert.equal(cc.occurrences, 2); // two nodes
  assert.deepEqual([...cc.pages], ['https://x.com/a']);
  assert.equal(cc.sourceTypes.has('page-scan'), true);
  assert.equal(cc.pageTypes.has('content'), true);
  assert.equal(cc.clusters.has('content::a'), true);
});

test('groupFindings: component grouping keys on ruleId::componentHint', () => {
  const { groupedByComponent } = groupFindings(axeResults, [], deps());
  const keys = [...groupedByComponent.keys()].filter((k) => k.startsWith('color-contrast::'));
  assert.equal(keys.length, 2, 'two distinct component hints (.btn, .link)');
});

test('groupFindings: tracks structured rule ids + structured/random clusters', () => {
  const { structuredRuleIds, structuredClusters, randomClusters } = groupFindings(
    axeResults,
    [],
    deps(),
  );
  assert.equal(structuredRuleIds.has('color-contrast'), true);
  assert.equal(structuredRuleIds.has('image-alt'), false);
  assert.equal(structuredClusters.has('content::a'), true);
  assert.equal(randomClusters.has('listing::b'), true);
});

test('groupFindings: process states contribute with a process sourceType', () => {
  const processResults = [
    {
      name: 'checkout',
      startUrl: 'https://x.com/a',
      states: [
        {
          state: 'after-submit',
          violations: [
            {
              id: 'label',
              impact: 'critical',
              tags: [],
              nodes: [{ target: ['input'], html: '<input>' }],
            },
          ],
        },
      ],
    },
  ];
  const { groupedByRule } = groupFindings([], processResults, deps());
  const label = groupedByRule.get('label');
  assert.equal(label.occurrences, 1);
  assert.equal([...label.sourceTypes][0], 'process:checkout:after-submit');
});

test('groupFindings: caps examples at 5 per rule while still counting all occurrences', () => {
  const many = [
    {
      url: 'https://x.com/a',
      violations: [
        {
          id: 'r',
          impact: 'minor',
          tags: [],
          nodes: Array.from({ length: 8 }, (_, i) => ({ target: [`#n${i}`], html: `<i${i}>` })),
        },
      ],
    },
  ];
  const { groupedByRule } = groupFindings(many, [], deps());
  assert.equal(groupedByRule.get('r').examples.length, 5);
  assert.equal(groupedByRule.get('r').occurrences, 8);
});

test('groupFindings (E4): redirect folds to final URL + sample-tier carve-out + dedup skip', () => {
  // A structured page /contact-us that redirects to /get-in-touch. The inventory
  // is keyed by the FINAL url (discover captures page.url()); the structured
  // sample lists the SOURCE url that was scanned.
  const d = {
    actMap: {},
    inventoryByUrl: new Map([
      [
        'https://x.com/get-in-touch',
        {
          url: 'https://x.com/get-in-touch',
          pageType: 'form-or-contact',
          clusterKey: 'form-or-contact::get-in-touch',
        },
      ],
    ]),
    structuredSet: new Set(['https://x.com/contact-us']),
    randomSet: new Set(),
    reportingConfig: {},
  };
  const axe = [
    {
      url: 'https://x.com/contact-us',
      finalUrl: 'https://x.com/get-in-touch',
      violations: [
        {
          id: 'label',
          impact: 'critical',
          tags: ['wcag2a', 'wcag412'],
          nodes: [{ target: ['input'], html: '<input>' }],
        },
      ],
    },
    // The redirect duplicate (scanned via /get-in-touch directly) — excluded.
    {
      url: 'https://x.com/get-in-touch',
      finalUrl: 'https://x.com/get-in-touch',
      redirectedToAlreadyScanned: true,
      violations: [],
    },
  ];
  const { groupedByRule, structuredRuleIds } = groupFindings(axe, [], d);
  const label = groupedByRule.get('label');
  // FH1: folds to ONE page, and the surviving URL is the FINAL (canonical) one.
  assert.equal(label.pages.size, 1, 'redirect source + target fold to one page');
  assert.deepEqual([...label.pages], ['https://x.com/get-in-touch']);
  // Inventory lookup (final-URL-keyed) resolves, so pageType is picked up.
  assert.equal(label.pageTypes.has('form-or-contact'), true);
  // H2 carve-out: the redirected STRUCTURED page is still attributed to its tier
  // (membership keyed by the original sample URL, not the folded identity).
  assert.equal(structuredRuleIds.has('label'), true);
});
