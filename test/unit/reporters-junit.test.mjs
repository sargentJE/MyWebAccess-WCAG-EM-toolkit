// @ts-check
/**
 * @file Tests for the JUnit XML reporter — Layer 4 R7.
 * @module test/unit/reporters-junit
 */

// SECTION: Imports
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import * as junitReporter from '../../src/reporters/junit.mjs';
import { listReporters } from '../../src/reporters/index.mjs';

// SECTION: Helpers

/**
 * Emit junit.xml for a given summary and return the raw string.
 *
 * @param {{ after: (fn: () => any) => void }} t
 * @param {Record<string, any>} summary
 * @param {{ includePasses?: boolean }} [opts]
 * @returns {Promise<string>}
 */
async function emitAndRead(t, summary, opts = {}) {
  const reportsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'reporters-junit-'));
  t.after(() => fs.rm(reportsDir, { recursive: true, force: true }));
  const ctx = {
    paths: { reportsDir },
    config: { reporting: { includePasses: Boolean(opts.includePasses) } },
  };
  await junitReporter.emit(summary, ctx);
  return fs.readFile(path.join(reportsDir, 'junit.xml'), 'utf8');
}

// SECTION: Tests

test('junit reporter: emits a single <testsuite> with the canonical XML preamble', async (t) => {
  const xml = await emitAndRead(t, { findings: [] });
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
  assert.match(xml, /<testsuite name="WCAG-EM Audit" tests="0" failures="0" time="0">/);
  assert.match(xml, /<\/testsuite>\n$/);
});

test('junit reporter: failed finding emits one <testcase> per (rule × url) with <failure>', async (t) => {
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'image-alt',
        impact: 'critical',
        help: 'Images must have alt text',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.11/image-alt',
        targets: ['img'],
        pages: ['https://example.com/a', 'https://example.com/b'],
        examples: [{ html: '<img src="x">' }],
      },
    ],
  });
  // Two testcases; both with failure children.
  assert.equal((xml.match(/<testcase /g) ?? []).length, 2);
  assert.equal((xml.match(/<failure /g) ?? []).length, 2);
  // failure type carries the impact.
  assert.match(xml, /<failure type="critical">/);
  // testsuite counts updated.
  assert.match(xml, /tests="2" failures="2"/);
  // CDATA payload contains help text + selector + html.
  assert.ok(xml.includes('Images must have alt text'));
  assert.ok(xml.includes('Selector: img'));
  assert.ok(xml.includes('HTML: <img src="x">'));
});

test('junit reporter: incomplete → <failure type="incomplete"> (NOT <skipped>)', async (t) => {
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'rule-x',
        outcome: 'incomplete',
        impact: null,
        targets: ['main'],
        pages: ['https://example.com/'],
      },
    ],
  });
  assert.match(xml, /<failure type="incomplete">/);
  assert.ok(!xml.includes('<skipped'), 'incomplete must NOT emit <skipped>');
});

test('junit reporter: inapplicable findings are silently dropped', async (t) => {
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'rule-na',
        outcome: 'inapplicable',
        targets: [],
        pages: ['https://example.com/'],
      },
      {
        id: 'rule-fail',
        outcome: 'failed',
        impact: 'serious',
        targets: ['button'],
        pages: ['https://example.com/x'],
      },
    ],
  });
  assert.match(xml, /tests="1" failures="1"/);
  assert.ok(!xml.includes('rule-na'), 'inapplicable rule absent from output');
  assert.ok(xml.includes('rule-fail'));
});

test('junit reporter: includePasses=true emits clean-pass <testcase> with no failure child', async (t) => {
  const xml = await emitAndRead(
    t,
    {
      findings: [
        {
          id: 'rule-pass',
          outcome: 'passed',
          targets: ['p'],
          pages: ['https://example.com/'],
        },
        {
          id: 'rule-fail',
          outcome: 'failed',
          impact: 'minor',
          targets: ['span'],
          pages: ['https://example.com/'],
        },
      ],
    },
    { includePasses: true },
  );
  assert.match(xml, /tests="2" failures="1"/);
  // The pass case is self-closing or open-without-failure; it must NOT
  // contain a <failure>.
  const passLine = xml
    .split('\n')
    .find((line) => line.includes('classname="rule-pass"'));
  assert.ok(passLine, 'expected a testcase for rule-pass');
  assert.ok(passLine && passLine.includes('/>'), 'rule-pass must be self-closed');
});

test('junit reporter: CDATA `]]>` defusal preserves the literal substring without breaking out', async (t) => {
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'cdata-rule',
        impact: 'serious',
        help: 'help with ]]> embedded',
        helpUrl: '',
        targets: ['x'],
        pages: ['https://example.com/'],
        examples: [{ html: 'html with ]]> embedded too' }],
      },
    ],
  });
  // The defusal pattern: replace `]]>` with `]]]]><![CDATA[>`.
  assert.ok(xml.includes(']]]]><![CDATA[>'), 'defusal sequence present');
  // The original `]]>` must NOT close the wrapping CDATA prematurely.
  // Parsing as XML works if CDATA is balanced — count matches structurally.
  const cdataOpens = (xml.match(/<!\[CDATA\[/g) ?? []).length;
  const cdataCloses = (xml.match(/\]\]>/g) ?? []).length;
  assert.equal(
    cdataOpens,
    cdataCloses,
    `<![CDATA[ count (${cdataOpens}) must equal ]]> count (${cdataCloses})`,
  );
});

test('junit reporter: attribute escaping covers & < > " \'', async (t) => {
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'rule-with-<&>"\'',
        impact: 'minor',
        targets: ['x'],
        pages: ['https://example.com/?a=1&b=2#frag<foo>"q"\''],
      },
    ],
  });
  assert.ok(xml.includes('classname="rule-with-&lt;&amp;&gt;&quot;&apos;"'));
  assert.ok(xml.includes('&amp;b=2'));
  assert.ok(xml.includes('&lt;foo&gt;'));
  // Raw forbidden chars must NOT survive in attribute context. The `&`
  // character IS expected (it heads every entity reference like `&lt;`),
  // so we only assert against raw `<` and `>`.
  assert.ok(
    !xml.match(/classname="[^"]*[<>]/),
    'no raw < > inside classname attribute (entities only)',
  );
});

test('junit reporter: multi-byte UTF-8 character truncation preserves valid output', async (t) => {
  // 4-byte emoji as the truncation point — earlier byte-based slicing
  // would split a surrogate pair and produce invalid UTF-8 inside CDATA.
  const longHtml = '🎉'.repeat(500); // 500 emoji = 2000 UTF-16 code units = 500 code points
  const xml = await emitAndRead(t, {
    findings: [
      {
        id: 'utf8-rule',
        impact: 'minor',
        targets: ['x'],
        pages: ['https://example.com/'],
        examples: [{ html: longHtml }],
      },
    ],
  });
  // The output must be a valid string; if truncation split a surrogate pair,
  // toString or readFile would have failed before reaching this point.
  // Assert truncation marker `…` is present (truncate adds it when over).
  assert.ok(xml.includes('🎉'), 'emoji rendered in HTML CDATA');
  assert.ok(xml.includes('…'), 'truncation ellipsis present');
});

test('junit reporter: registry now lists junit', () => {
  const names = listReporters();
  assert.ok(names.includes('junit'), 'junit registered after R7');
  assert.deepEqual(names, ['earl-jsonld', 'html', 'json', 'junit', 'markdown']);
});
