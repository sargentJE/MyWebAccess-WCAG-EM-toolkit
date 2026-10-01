# Probe record: verify:A16

Role: packet verifier. Findings: REPA-01, REPA-02, REPA-03, REPA-06, REPA-07, REPA-09, REPA-13, REPA-14, REPA-15, REPA-17, VERD-14, CAP-09

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" REPA-01,REPA-02,REPA-03,REPA-06,REPA-07,REPA-09,REPA-13,REPA-14,REPA-15,REPA-17,VERD-14,CAP-09
````

Output (truncated):

````text
[
 {
  "dimension": "VERD",
  "id": "VERD-14",
  "title": "The default reporter set produces no human-readable per-SC outcome table; summary.md omits criteriaOutcomes although the docs call it the HTML report's sibling",
  "category": "capability-gap",
  "severity": "low",
  "status": "new",
  "claim": "The default reporters are ['json','markdown']. The markdown reporter renders run summary, comparison, findings and needs-review, but no WCAG-EM per-SC outcomes or notTested list. Only summary.html has the SC table, and html is not in the default set. The user manual tells users to start with reports/summary.html and describes summary.md as 'The HTML report's markdown sibling'.",
  "evidence": [
   {
    "file": "src/commands/summarize.mjs",
    "line": 634,
    "excerpt": "const resolvedRep ...
````

## 2. Bash

````bash
cd $REPO; R=src/reporters; sed -n 40,60p $R/markdown.mjs; echo ----; grep -n "help\|error\|automatedCoverage\|comparison\|criteria\|examples\|pages\|bestPractice\|classification" $R/markdown.mjs | head -60; echo ----HTML; grep -n "automatedCoverage\|comparison\|criteriaOutcomes\|examples\|failureSummary\|overflow-wrap\|<main\|viewport\|screenshot\|normalizeUrl\|viewIdentity\|classification\|bestPractice" $R/html.mjs | head -60
````

Output (truncated):

````text
 * neutralise backticks (which would otherwise break the span), collapse
 * whitespace runs to single spaces (axe selectors/outerHTML can be multi-line),
 * and trim. Markdown was the only reporter interpolating selectors raw, so a
 * backtick in a selector or snippet could break the rendered span; this brings
 * it to parity with the HTML/JUnit reporters' escaping. Backslashes are kept
 * verbatim — they are real data and the HTML reporter keeps them too.
 *
 * @param {unknown} value - Raw selector or HTML snippet.
 * @returns {string} A single-line, backtick-free string.
 */
function mdInlineCode(value) {
  return String(value).replace(/`/g, "'").replace(/\s+/g, ' ').trim();
}

// SECTION: Scan health

/**
 * Render the scan-health section lines, or nothing when the run was clean.
 * Fai ...
````

## 3. Bash

````bash
cd $REPO; sed -n 100,125p src/reporters/html.mjs; sed -n 270,320p src/reporters/html.mjs; sed -n 395,430p src/reporters/html.mjs; grep -n "summary.md\|summary.html\|embedded\|Standalone\|standalone" docs/guides/*.md | head -20; grep -n "reports\b\|path: output" docs/guides/integrations.md | head; grep -rn "best-practice\|advisory\|bestPractice" TODO.md CHANGELOG.md | head -15
````

Output (truncated):

````text
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string, resultsDir?: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
  const incompleteFindings = Array.isArray(summary.incompleteFindings)
    ? summary.incompleteFindings
    : [];
  const includePasses = Boolean(ctx?.config?.reporting?.includePasses);
  const screenshotsByUrl = await loadScreenshotMap(ctx);

  const out =
    `<!DOCTYPE html>\n<html lang="en">\n<head>\n` +
    `<meta charset="utf-8">\n` +
    html`<title>Accessibility scan summary — ${summary.site ?? ''}</title>\n` +
    `<style>${STATIC_CSS}</style>\n` +
    `</head>\n<body>\ ...
````

## 4. Bash

````bash
cd $REPO; sed -n 44,54p TODO.md; grep -n -i "reflow\|landmark\|screenshot\|markdown\|summary.md\|parity\|evidence\|element screenshot\|ariaSnapshot\|escap" TODO.md CHANGELOG.md | head -40; grep -n "throw\|catch\|failing\|reporter failed" test/unit/reporters-*.test.mjs test/unit/*summar*.test.mjs 2>/dev/null | grep -i "reporter\|emit" | head
````

Output (truncated):

````text
      [docs/plans/2026-06-web-bot-auth-registration.md](docs/plans/2026-06-web-bot-auth-registration.md)
      — ops Phases 0–1 (keypair, signed JWKS directory, Cloudflare application,
      decisive `/event*` verified-bot test on our own zone) can start without
      code; the signing build (Phase 2) is held for review per Jamie.
- [ ] **Report distinct-node counts, not raw occurrences, in summaries.** The
      live validation re-confirmed `region` shows 664 occurrences across 33
      pages; surface the 6 best-practice rules as advisory rather than fail-framed.
      Overlaps the open `occurrenceCount` P1 item below.
- [ ] **E4 final-URL re-key in `portal-export` / `report-builder`** — deferred
      companion-coordinated follow-up (export labels still key on the source URL).

TODO.md:1 ...
````

## 5. Bash

````bash
cd $REPO; sed -n 100,135p src/reporters/index.mjs; grep -rln "runReporters" test/ ; sed -n 110,130p test/e2e/reporters-html-axe.test.mjs; sed -n 628,640p src/commands/summarize.mjs; grep -n "reporters" docs/guides/config-guide.md | head -5; sed -n 64,72p docs/guides/user-manual.md
````

Output (truncated):

````text
  }
  // Fail fast on unknown names BEFORE running any reporter — partial outputs
  // from a config typo are worse than no output.
  for (const n of names) {
    if (!registry.has(n)) {
      const known = [...registry.keys()].sort().join(', ');
      throw new Error(`unknown reporter '${n}'; known reporters at this layer: [${known}]`);
    }
  }
  /** @type {ReporterResult[]} */
  const results = [];
  /** @type {ReporterError[]} */
  const errors = [];
  for (const n of names) {
    const reporter = /** @type {ReporterModule} */ (registry.get(n));
    try {
      const out = await reporter.emit(summary, ctx);
      results.push({ name: n, path: out.path, bytes: out.bytes });
    } catch (err) {
      errors.push({
        name: n,
        error: err instanceof Error ? err : new Error(St ...
````

## 6. Bash

````bash
cd $REPO; grep -n "reporters" src/lib/config.mjs schemas/*.json 2>/dev/null | head; grep -rn "reporters" test/fixtures/site.json.template configs/*.json 2>/dev/null | head; grep -n "tagfilter\|marked\|render" docs/guides/*.md | grep -i markdown | head
````

Output (truncated):

````text
src/lib/config.mjs:57:// pipeline added `reporting.reporters`.
src/lib/config.mjs:131:    // never read at runtime). `reporters` intentionally absent
schemas/config.schema.json:529:        "reporters": {
schemas/config.schema.json:552:          "description": "Legacy alias for `reporters: [markdown]`; ignored when `reporters` is set."
configs/example-site-best-practice.json:59:    "reporters": ["json", "markdown", "html", "earl-jsonld", "junit"],
configs/example-site-with-processes.json:73:    "reporters": ["json", "markdown", "html"],
configs/legacy-events.json:85:    "reporters": ["json", "markdown", "html", "earl-jsonld", "junit"],
docs/guides/user-manual.md:120:appears in `scanWarnings`, and the html/markdown reports render a
````

## 7. Bash

````bash
S=$SCRATCH/wf2/verify-A16; mkdir -p $S; cd $S; R=$REPO; cat > p.mjs <<EOF
import axe from '$R/node_modules/axe-core/axe.js';
import * as md from '$R/src/reporters/markdown.mjs';
import * as h from '$R/src/reporters/html.mjs';
import fs from 'node:fs/promises';
const rules=axe.getRules(); const tagged=rules.filter(r=>/<[a-z]/i.test(r.help));
console.log('rules',rules.length,'withTags',tagged.length, tagged.slice(0,4).map(r=>r.ruleId+': '+r.help));
await fs.mkdir('$S/rep',{recursive:true}); await fs.mkdir('$S/res',{recursive:true});
await fs.writeFile('$S/res/axe-results.json', JSON.stringify([{url:'https://x.test/old',finalUrl:'https://x.test/new',viewport:'desktop',screenshot:'$S/shots/a.png',violations:[],incomplete:[],passes:[]}]));
const summary={site:'x',findings:[{id:'document-title',impact:'serious',classification:'best-practice',pageCount:1,pages:['https://x.test/new'],help:'Documents must have <title> element to aid in navigation',targets:['#q\`w'],examples:[{failureSummary:'FS-MARK'}]},{id:'image-alt',impact:'minor',classification:'wcag-failure',pageCount:1,pages:['https://x.test/new'],help:'x'}],incompleteFindings:[],executionHealth:{pagesFailed:[{url:'u',failures:[{error:'Element is not an <input>, <textarea>\ncall log'}]}]},wcagEmSummary:{automatedCoverage:{status:'partial',adequate:false,pagesAudited:1,pagesSelected:2,pagesExcluded:1},criteriaOutcomes:[{id:'1.1.1',outcome:'failed'}]}};
const ctx={paths:{reportsDir:'$S/rep',resultsDir:'$S/res'},config:{}};
await md.emit(summary,ctx); await h.emit(summary,ctx);
const m=await fs.readFile('$S/rep/summary.md','utf8'); const x=await fs.readFile('$S/rep/summary.html','utf8');
console.log(m.split('\n').filter(l=>/title>|textarea|Example target|1\.1\.1|Coverage|coverage|FS-MARK/.test(l)).join('\n'));
console.log('HTML: img',/<img/.test(x),'coverage',/overage/.test(x),'FS',/FS-MARK/.test(x),'main',/<main/.test(x),'viewport',/name="viewport"/.test(x),'SC', /1\.1\.1/.test(x));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs 2>&1 | tail -20
````

Output (truncated):

````text
rules 104 withTags 18 [
  'area-alt: Active <area> elements must have alternative text',
  'audio-caption: <audio> elements must have a captions track',
  'blink: <blink> elements are deprecated and must not be used',
  'definition-list: <dl> elements must only directly contain properly-ordered <dt> and <dd> groups, <script>, <template> or <div> elements'
]
- Automated coverage: partial — PARTIAL (1/2 selected pages audited; 1 excluded — see Scan health)
- NOT SCANNED (all viewports failed): u — Element is not an <input>, <textarea>
- Help: Documents must have <title> element to aid in navigation
- Example target: `#q'w`
HTML: img false coverage false FS false main false viewport false SC false
````

## 8. Bash

````bash
cd $REPO; grep -rn "ariaSnapshot\|boundingBox\|locator(.*screenshot\|highlight" src | head; sed -n 55,69p $RB/docs/MyWebAccess-docs/Methodology/05-report.md 2>/dev/null | cut -c1-200
````

Output (truncated):

````text
### Evidence Standards

Each finding in the Detailed Technical Findings section must include:

1. **Severity badge** -- visual indicator (Critical/Serious/Moderate/Minor)
2. **WCAG SC reference** -- success criterion number, name, and level
3. **Impact tag** -- which user groups affected (screen reader users, keyboard users, low vision users, cognitive, etc.)
4. **Description** -- clear explanation of the issue in plain language
5. **Steps to reproduce** -- environment/configuration ID, numbered steps, and expected vs actual behaviour
6. **Evidence** -- at minimum ONE of:
   - Screenshot showing the issue (annotated where helpful)
   - Code snippet of the problematic markup
   - Accessibility tree output showing the computed name/role/state
   - Screen reader announcement text
7. **Remedia ...
````

## 9. Bash

````bash
cd $REPO; grep -n "runReporters" test/unit/reporters-portal-export.test.mjs test/unit/reporters-json.test.mjs; grep -n "overflow-wrap\|word-break" src/reporters/html.mjs
````

Output (truncated):

````text
test/unit/reporters-json.test.mjs:20:import { runReporters, listReporters } from '../../src/reporters/index.mjs';
test/unit/reporters-json.test.mjs:120:test('runReporters: unknown reporter name throws BEFORE any reporter runs', async (t) => {
test/unit/reporters-json.test.mjs:127:    () => runReporters(['json', 'no-such-reporter'], summary, ctx),
test/unit/reporters-json.test.mjs:135:test('runReporters: success path returns { results, errors:[] } and writes the file', async (t) => {
test/unit/reporters-json.test.mjs:143:  const outcome = await runReporters(['json'], summary, ctx);
test/unit/reporters-json.test.mjs:150:test('runReporters: non-array names throws TypeError', async () => {
test/unit/reporters-json.test.mjs:151:  await assert.rejects(() => runReporters(/** @type {any} */ (null) ...
````
