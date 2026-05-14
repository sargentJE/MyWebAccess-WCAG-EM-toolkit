// @ts-check
/**
 * @file Tests for `toWcagEmSummary` — WCAG-EM per-SC inversion.
 * @module test/unit/wcag-em-summary
 *
 * @description
 * Exhaustive coverage of the EARL outcome decision tree + the F8 infra-
 * failure distinction + metadata field propagation.
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toWcagEmSummary } from '../../src/lib/wcag-em-summary.mjs';

// SECTION: Helpers

/**
 * Minimal ctx shim.
 *
 * @param {Record<string, any>} wcagEm
 * @param {any[]} [processes]
 * @returns {{ config: Record<string, any> }}
 */
function buildCtx(wcagEm = {}, processes = []) {
  return { config: { wcagEm, processes } };
}

/**
 * Build an axeResults page-result stub with the widened shape.
 *
 * @param {string} url
 * @param {{
 *   violations?: any[],
 *   passesDetail?: any[],
 *   incompleteDetail?: any[],
 *   inapplicableDetail?: any[],
 * }} arrays
 * @returns {any}
 */
function pageResult(url, arrays) {
  return {
    url,
    violations: arrays.violations ?? [],
    passesDetail: arrays.passesDetail ?? [],
    incompleteDetail: arrays.incompleteDetail ?? [],
    inapplicableDetail: arrays.inapplicableDetail ?? [],
  };
}

// SECTION: Outcome decision tree

test('toWcagEmSummary: violation → outcome failed', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.1.1');
  assert.ok(v);
  assert.equal(v.outcome, 'failed');
  assert.equal(v.level, 'A');
});

test('toWcagEmSummary: non-best-practice pass only → outcome passed', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      passesDetail: [{ id: 'image-alt', tags: ['wcag111'], impact: null, nodesCount: 3 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.1.1');
  assert.ok(v);
  assert.equal(v.outcome, 'passed');
});

test('toWcagEmSummary: best-practice rule passing does NOT count as passed', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      passesDetail: [
        {
          id: 'region',
          tags: ['wcag131', 'best-practice'],
          impact: null,
          nodesCount: 2,
        },
      ],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.3.1');
  assert.ok(v);
  assert.equal(v.outcome, 'untested');
});

test('toWcagEmSummary: reviewable incomplete (nodesCount > 0) → outcome cantTell', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      incompleteDetail: [{ id: 'color-contrast', tags: ['wcag143'], impact: null, nodesCount: 2 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(v);
  assert.equal(v.outcome, 'cantTell');
});

test('toWcagEmSummary F8: infra-failure incomplete (nodesCount === 0) → scanWarnings, NOT cantTell', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      incompleteDetail: [{ id: 'color-contrast', tags: ['wcag143'], impact: null, nodesCount: 0 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(v, '1.4.3 present as notTested (infra-failure does not create a bucket)');
  assert.equal(v.outcome, 'notTested', 'infra-failure SC becomes notTested, not cantTell');
  assert.equal(out.scanWarnings.length, 1);
  assert.match(out.scanWarnings[0], /infra failure/);
  assert.match(out.scanWarnings[0], /1\.4\.3|color-contrast/);
});

test('toWcagEmSummary: inapplicable only → outcome inapplicable', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      inapplicableDetail: [{ id: 'image-alt', tags: ['wcag111'], impact: null, nodesCount: 0 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.1.1');
  assert.ok(v);
  assert.equal(v.outcome, 'inapplicable');
});

test('toWcagEmSummary: failed wins over passed + cantTell + inapplicable for same SC', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }],
      passesDetail: [{ id: 'role-img-alt', tags: ['wcag111'], impact: null, nodesCount: 1 }],
      incompleteDetail: [{ id: 'image-alt', tags: ['wcag111'], impact: null, nodesCount: 1 }],
      inapplicableDetail: [{ id: 'image-alt', tags: ['wcag111'], impact: null, nodesCount: 0 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.1.1');
  assert.ok(v);
  assert.equal(v.outcome, 'failed');
});

test('toWcagEmSummary: cantTell wins over passed + inapplicable (but not failed)', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      passesDetail: [{ id: 'color-contrast', tags: ['wcag143'], impact: null, nodesCount: 5 }],
      incompleteDetail: [{ id: 'color-contrast', tags: ['wcag143'], impact: null, nodesCount: 2 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(v);
  assert.equal(v.outcome, 'cantTell');
});

// SECTION: SC-bucket algorithm

test('toWcagEmSummary: empty scan emits notTested for all A+AA SC (AA target)', () => {
  const out = toWcagEmSummary(buildCtx(), { axeResults: [] });
  assert.ok(out.criteriaOutcomes.length > 0, 'notTested entries emitted for empty scan');
  assert.ok(
    out.criteriaOutcomes.every((o) => o.outcome === 'notTested'),
    'all outcomes are notTested',
  );
});

test('toWcagEmSummary: natural-numeric SC sort (1.2.10 after 1.2.9, not between 1 and 2)', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      passesDetail: [
        { id: 'r1', tags: ['wcag129'], impact: null, nodesCount: 1 }, // SC 1.2.9
        { id: 'r2', tags: ['wcag1210'], impact: null, nodesCount: 1 }, // SC 1.2.10
        { id: 'r3', tags: ['wcag123'], impact: null, nodesCount: 1 }, // SC 1.2.3
      ],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const scs = out.criteriaOutcomes.map((o) => o.sc);
  const idx123 = scs.indexOf('1.2.3');
  const idx129 = scs.indexOf('1.2.9');
  const idx1210 = scs.indexOf('1.2.10');
  assert.ok(idx123 < idx129, '1.2.3 before 1.2.9');
  assert.ok(idx129 < idx1210, '1.2.9 before 1.2.10');
});

test('toWcagEmSummary: relatedRules per SC is unique + sorted', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [
        { id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] },
        { id: 'role-img-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] },
        { id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }, // duplicate
      ],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  assert.deepEqual(out.criteriaOutcomes[0].relatedRules, ['image-alt', 'role-img-alt']);
});

test('toWcagEmSummary: examples capped at 5 per SC', () => {
  const axeResults = Array.from({ length: 10 }, (_, i) =>
    pageResult(`https://x.com/p${i}`, {
      violations: [{ id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }],
    }),
  );
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  assert.equal(out.criteriaOutcomes[0].examples.length, 5);
  assert.equal(out.criteriaOutcomes[0].pagesExamined, 10);
});

test('toWcagEmSummary: processResults states are ingested via virtual URL', () => {
  const processResults = [
    {
      name: 'signup',
      startUrl: 'https://x.com/signup',
      states: [
        {
          state: 'blank-submit',
          violations: [{ id: 'label', tags: ['wcag332'], impact: 'critical', nodes: [{}] }],
        },
      ],
    },
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults: [], processResults });
  const v = out.criteriaOutcomes.find((o) => o.sc === '3.3.2');
  assert.ok(v, 'process-state findings must feed the SC buckets');
  assert.equal(v.outcome, 'failed');
  assert.equal(v.examples[0].pageUrl, 'https://x.com/signup#blank-submit');
});

// SECTION: Metadata fields

test('toWcagEmSummary: wcagEm config fields propagate with sensible defaults', () => {
  const out = toWcagEmSummary(
    buildCtx({
      wcagVersion: '2.1',
      conformanceTarget: 'AAA',
      atBaseline: ['NVDA', 'JAWS'],
      technologiesReliedUpon: ['HTML'],
      samplingMethodNotes: 'notes',
      evaluator: { name: 'J', contact: 'j@x.com' },
    }),
    { axeResults: [] },
  );
  assert.equal(out.wcagVersion, '2.1');
  assert.equal(out.conformanceTarget, 'AAA');
  assert.deepEqual(out.atBaseline, ['NVDA', 'JAWS']);
  assert.deepEqual(out.technologiesReliedUpon, ['HTML']);
  assert.equal(out.samplingMethodNotes, 'notes');
  assert.deepEqual(out.evaluator, { name: 'J', contact: 'j@x.com' });
});

test('toWcagEmSummary: wcagEm defaults apply when config is empty', () => {
  const out = toWcagEmSummary(buildCtx(), { axeResults: [] });
  assert.equal(out.wcagVersion, '2.2');
  assert.equal(out.conformanceTarget, 'AA');
  assert.deepEqual(out.atBaseline, []);
  assert.deepEqual(out.technologiesReliedUpon, []);
});

test('toWcagEmSummary: processesEvaluated derived from config.processes[].name', () => {
  const out = toWcagEmSummary(
    buildCtx({}, [{ name: 'signup' }, { name: 'checkout' }, { foo: 'bar' }]),
    { axeResults: [] },
  );
  assert.deepEqual(out.processesEvaluated, ['signup', 'checkout']);
});

test('toWcagEmSummary: evaluationDate is ISO-8601', () => {
  const out = toWcagEmSummary(buildCtx(), { axeResults: [] });
  assert.match(out.evaluationDate, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

// SECTION: examples by outcome (D3 regression — partition violation/incomplete)

test('failed SC: examples contains only violation entries, excludes cantTell from other pages', () => {
  // Reproduction of the AU-dogfood bug: SC 1.4.3 has a real color-contrast
  // violation on before.html and a cantTell (incomplete with reviewable
  // nodes) on after.html. Pre-fix, examples mixed both; post-fix, only the
  // violation entry surfaces in the failed SC's examples.
  const axeResults = [
    pageResult('https://x.com/before.html', {
      violations: [{ id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodes: [{}] }],
    }),
    pageResult('https://x.com/after.html', {
      incompleteDetail: [
        { id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodesCount: 31 },
      ],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const sc143 = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(sc143, '1.4.3 bucket must exist');
  assert.equal(sc143.outcome, 'failed', 'violation wins over cantTell');
  assert.ok(
    sc143.examples.every((e) => e.pageUrl === 'https://x.com/before.html'),
    `failed-SC examples must contain only violation entries; got ${JSON.stringify(sc143.examples)}`,
  );
  assert.equal(sc143.examples.length, 1);
});

test('cantTell SC: examples contains incomplete entries (preserves visibility)', () => {
  // Naive "filter out incompletes" fix would drop these; the partition
  // approach preserves them so auditors can see what needs manual review.
  const axeResults = [
    pageResult('https://x.com/page.html', {
      incompleteDetail: [
        { id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodesCount: 4 },
      ],
    }),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const sc143 = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(sc143);
  assert.equal(sc143.outcome, 'cantTell');
  assert.equal(sc143.examples.length, 1);
  assert.equal(sc143.examples[0].pageUrl, 'https://x.com/page.html');
  assert.equal(sc143.examples[0].ruleId, 'color-contrast');
});

test('failed SC: violation examples capped at 5; subsequent incomplete entries do NOT contaminate', () => {
  // 6 pages with the same violation (cap is 5); 3 additional pages with a
  // reviewable incomplete for the same SC. Pre-fix, the incompletes could
  // crowd out violations OR appear alongside them in the examples array.
  // Post-fix, examples is pure violations capped at 5.
  const axeResults = [
    ...Array.from({ length: 6 }, (_, i) =>
      pageResult(`https://x.com/violation-${i}`, {
        violations: [{ id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodes: [{}] }],
      }),
    ),
    ...Array.from({ length: 3 }, (_, i) =>
      pageResult(`https://x.com/incomplete-${i}`, {
        incompleteDetail: [
          { id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodesCount: 2 },
        ],
      }),
    ),
  ];
  const out = toWcagEmSummary(buildCtx(), { axeResults });
  const sc143 = out.criteriaOutcomes.find((o) => o.sc === '1.4.3');
  assert.ok(sc143);
  assert.equal(sc143.outcome, 'failed');
  assert.equal(sc143.examples.length, 5, 'cap is 5');
  assert.ok(
    sc143.examples.every((e) => e.pageUrl.startsWith('https://x.com/violation-')),
    `every example must be from a violation page; got ${JSON.stringify(sc143.examples)}`,
  );
  // Sanity: pages set still includes ALL contributing pages (incomplete pages
  // were ingested into the bucket; they just don't surface in examples).
  assert.equal(sc143.pagesExamined, 9, 'all 9 pages contributed to the bucket');
});

// SECTION: notTested emission for uncovered SC

test('toWcagEmSummary: emits notTested for all A+AA SC not touched by a rule (AA target)', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }],
      passesDetail: [{ id: 'html-lang', tags: ['wcag311'], impact: null, nodesCount: 1 }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx({ conformanceTarget: 'AA' }), { axeResults });

  const touched = out.criteriaOutcomes.filter((o) => o.outcome !== 'notTested');
  assert.equal(touched.length, 2, 'two SC touched: 1.1.1 + 3.1.1');

  const notTested = out.criteriaOutcomes.filter((o) => o.outcome === 'notTested');
  assert.ok(notTested.length > 0, 'notTested entries emitted');
  for (const nt of notTested) {
    assert.ok(nt.level === 'A' || nt.level === 'AA', `level must be A or AA, got ${nt.level}`);
    assert.deepEqual(nt.examples, []);
    assert.equal(nt.pagesExamined, 0);
    assert.deepEqual(nt.relatedRules, []);
  }

  const allA_AA_count = Object.entries(
    /** @type {Record<string, string>} */ ({
      '1.1.1': 'A',
      '1.2.1': 'A',
      '1.2.2': 'A',
      '1.2.3': 'A',
      '1.2.4': 'AA',
      '1.2.5': 'AA',
      '1.3.1': 'A',
      '1.3.2': 'A',
      '1.3.3': 'A',
      '1.3.4': 'AA',
      '1.3.5': 'AA',
      '1.4.1': 'A',
      '1.4.2': 'A',
      '1.4.3': 'AA',
      '1.4.4': 'AA',
      '1.4.5': 'AA',
      '1.4.10': 'AA',
      '1.4.11': 'AA',
      '1.4.12': 'AA',
      '1.4.13': 'AA',
      '2.1.1': 'A',
      '2.1.2': 'A',
      '2.1.4': 'A',
      '2.2.1': 'A',
      '2.2.2': 'A',
      '2.3.1': 'A',
      '2.4.1': 'A',
      '2.4.2': 'A',
      '2.4.3': 'A',
      '2.4.4': 'A',
      '2.4.5': 'AA',
      '2.4.6': 'AA',
      '2.4.7': 'AA',
      '2.4.11': 'AA',
      '2.5.1': 'A',
      '2.5.2': 'A',
      '2.5.3': 'A',
      '2.5.4': 'A',
      '2.5.7': 'AA',
      '2.5.8': 'AA',
      '3.1.1': 'A',
      '3.1.2': 'AA',
      '3.2.1': 'A',
      '3.2.2': 'A',
      '3.2.3': 'AA',
      '3.2.4': 'AA',
      '3.2.6': 'A',
      '3.3.1': 'A',
      '3.3.2': 'A',
      '3.3.3': 'AA',
      '3.3.4': 'AA',
      '3.3.7': 'A',
      '3.3.8': 'AA',
      '4.1.1': 'A',
      '4.1.2': 'A',
      '4.1.3': 'AA',
    }),
  ).length;
  assert.equal(
    out.criteriaOutcomes.length,
    allA_AA_count,
    `total outcomes = all A+AA SC (${allA_AA_count})`,
  );

  assert.ok(
    !out.criteriaOutcomes.some((o) => o.level === 'AAA'),
    'no AAA SC emitted for AA target',
  );
});

test('toWcagEmSummary: notTested entries are sorted with touched SC', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'color-contrast', tags: ['wcag143'], impact: 'serious', nodes: [{}] }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx({ conformanceTarget: 'AA' }), { axeResults });
  const scs = out.criteriaOutcomes.map((o) => o.sc);
  const idx143 = scs.indexOf('1.4.3');
  const idx111 = scs.indexOf('1.1.1');
  assert.ok(idx111 < idx143, '1.1.1 sorts before 1.4.3');
});

test('toWcagEmSummary: A target only emits level-A SC as notTested', () => {
  const axeResults = [
    pageResult('https://x.com/', {
      violations: [{ id: 'image-alt', tags: ['wcag111'], impact: 'critical', nodes: [{}] }],
    }),
  ];
  const out = toWcagEmSummary(buildCtx({ conformanceTarget: 'A' }), { axeResults });
  const notTested = out.criteriaOutcomes.filter((o) => o.outcome === 'notTested');
  assert.ok(
    notTested.every((o) => o.level === 'A'),
    'only A-level SC for A target',
  );
  assert.ok(!out.criteriaOutcomes.some((o) => o.level === 'AA'), 'no AA SC for A target');
});
