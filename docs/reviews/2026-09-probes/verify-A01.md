# Probe record: verify:A01

Role: packet verifier. Findings: CAP-01, VERD-02, CAP-21, REPA-04, VERD-15, CAP-03

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" CAP-01,VERD-02,CAP-21,REPA-04,VERD-15,CAP-03
````

Output (truncated):

````text
[
 {
  "dimension": "VERD",
  "id": "VERD-02",
  "title": "Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable verdicts",
  "category": "docs-drift",
  "severity": "medium",
  "status": "new",
  "claim": "The user manual calls wcag-em-summary.json 'the conformance record' and says 'The notTested list is your manual-testing completeness checklist'. The config guide repeats this. The report-builder draft's appendix says only the notTested SCs 'remain to be evaluated manually', and its nextSteps tell the author to 'Evaluate the not-tested success criteria'. Taken together, an operator following the documented workflow never re-evaluates the SCs that VERD-01 shows are falsely passed or inapplicable.",
  "evi ...
````

## 2. Bash

````bash
wc -l src/lib/wcag-em-summary.mjs && sed -n 280,540p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
     532 src/lib/wcag-em-summary.mjs
        );
        continue;
      }
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyReviewableIncomplete = true;
        b.relatedRules.add(inc.id);
        b.pages.add(pageUrl);
        if (b.incompleteExamples.length < 5) {
          b.incompleteExamples.push({ pageUrl, ruleId: inc.id, impact: inc.impact ?? null });
        }
      }
    }
    for (const ina of inapplicableDetail ?? []) {
      const meta = withActAndWcagMetadata(ina);
      for (const sc of meta.wcagCriteria) {
        const b = bucketFor(sc);
        b.anyInapplicable = true;
        b.relatedRules.add(ina.id);
        b.pages.add(pageUrl);
      }
    }
  }

  for (const page of axeResults) {
    // E1: a could-not-audit page-view must not ...
````

## 3. Bash

````bash
cat docs/adr/0007-wcag-em-summary-shape.md; ls docs/adr
````

Output (truncated):

````text
# 0007. WCAG-EM Step 5 summary shape

- Status: accepted
- Date: 2026-04-19
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; symbol-first citation rule),
  ADR-0005 (fail fast on config; shares the `defineHidden` mechanism),
  ADR-0006 (multi-viewport axe runs; the scan loop widens artefacts
  for this)

## Context and Problem Statement

Up to v0.3 this toolkit produced rule-grouped output: findings
keyed by axe rule id (`image-alt`, `color-contrast`, …) with per-rule
tallies. That is useful for axe-familiar engineers but not
well-matched to the WCAG-EM Step 5 workflow, which demands per-**SC**
outcomes. The WCAG Evaluation Methodology (W3C, _WCAG-EM 1.0_) Step 5
asks evaluators to record, for every SC in scope, whether the target
conforms — `passed`, `failed`, needs m ...
````

## 4. Bash

````bash
sed -n 1,60p src/lib/wcag-em-summary.mjs; sed -n 180,280p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
// @ts-check
/**
 * @file WCAG-EM Step 5 per-SC inversion of axe findings.
 * @module lib/wcag-em-summary
 *
 * @description
 * Inverts axe's rule-grouped output into WCAG-EM Step 5's criterion-grouped
 * shape. One verdict per Success Criterion the run actually touched, using
 * EARL's outcome vocabulary (`passed`, `failed`, `inapplicable`, `cantTell`,
 * `untested`). Industry-standard per Alfa / Accessibility Insights / VPAT.
 *
 * Input shape is the widened `axe-results.json` and `process-results.json`
 * from the scan stage: each page-result carries
 *   - `violations`: full rule objects with tags.
 *   - `passesDetail`: light `{id, tags, impact, nodesCount}` per pass.
 *   - `incompleteDetail`: same, per incomplete.
 *   - `inapplicableDetail`: same, per inapplicable.
 *
 * Output sha ...
````

## 5. Bash

````bash
grep -rn "pagesExamined" src docs README.md CHANGELOG.md | grep -v "^src/lib/wcag-em-summary.mjs"
````

Output (truncated):

````text
src/reporters/report-builder-starter.mjs:389:      notes: `Automated outcome across ${c.pagesExamined ?? 0} examined page(s).`,
docs/adr/0007-wcag-em-summary-shape.md:114:      "pagesExamined": 12,
docs/reviews/2026-06-toolkit-review.md:111:| `pagesExamined` counts every bucket contributor (passes/inapplicable included) — over-reads as "pages tested"                                                                        | `[source]` wcag-em-summary.mjs:344                                                                |
````

## 6. Bash

````bash
ls schemas; grep -n "\"reporters\"\|\"formats\"\|includePasses\|\"processes\"" -A3 schemas/*.json | head -40; ls $SCRATCH/
````

Output (truncated):

````text
config.schema.json
portal-canonical-scan.schema.json
report-builder-draft.schema.json
schemas/config.schema.json:455:    "processes": {
schemas/config.schema.json-456-      "type": "array",
schemas/config.schema.json-457-      "items": {
schemas/config.schema.json-458-        "type": "object",
--
schemas/config.schema.json:529:        "reporters": {
schemas/config.schema.json-530-          "type": "array",
schemas/config.schema.json-531-          "items": {
schemas/config.schema.json-532-            "enum": [
--
schemas/config.schema.json:544:        "includePasses": {
schemas/config.schema.json-545-          "type": "boolean"
schemas/config.schema.json-546-        },
schemas/config.schema.json-547-        "groupBestPracticeSeparately": {
gate
review
wf
wf2
````

## 7. Bash

````bash
grep -n "export async function\|export function\|@param\|@returns" test/fixtures/server.mjs | head; grep -n "audit" bin/wcag-em.mjs | head
````

Output (truncated):

````text
76: * @param {string} staticDir
77: * @param {string} urlPath
78: * @returns {string | null}
94: * @param {import('node:http').IncomingMessage} req
95: * @returns {Promise<string>}
121: * @param {FixtureServerOptions} [options]
122: * @returns {Promise<FixtureServerHandle>}
124:export async function startFixtureServer(options = {}) {
263:/** @returns {string} */
9: *   discover | sample | scan | scan-processes | summarize | audit
191:  .command('audit')
````

## 8. Bash

````bash
S=$SCRATCH/wf2/verify-A01
mkdir -p $S/site && cd $S
cat > site/index.html <<'EOF'
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Page</title>
<style>*:focus{outline:none}</style></head>
<body>
<header><nav aria-label="Main"><ul><li><a href="/index.html">Home</a></li><li><a href="/about.html">About</a></li></ul></nav></header>
<main>
<h1>Shop</h1>
<div id="carousel"><p id="slide">Slide 1: Summer sale</p></div>
<script>let i=1;setInterval(()=>{i=i%3+1;document.getElementById('slide').textContent='Slide '+i+': Promo '+i;},1500);</script>
<p>Bienvenue sur notre boutique, nous livrons partout en France avec plaisir.</p>
<p><a href="/a.html">Click here</a> for deliveries. <a href="/b.html">Click here</a> for returns.</p>
<form><label for="em">Email</label> <input id="em" type="email" name="email">
<label for="trap">Promo code</label> <input id="trap" type="text">
</form>
<script>document.getElementById('trap').addEventListener('keydown',e=>{if(e.key==='Tab'){e.preventDefault();}});</script>
<div onclick="alert('ordered')" style="background:#036;color:#fff;padding:4px;display:inline-block">Submit order</div>
<table><tr><td>Plan</td><td>Price</td></tr><tr><td>Basic</td><td>5</td></tr></table>
</main>
</body></html>
EOF
cat > site/about.html <<'EOF'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>About us</title></head>
<body><main><h1>About</h1><p>Plain page.</p><a href="/index.html">Home</a></main></body></html>
EOF
cat > run.mjs <<'EOF'
import { startFixtureServer } from 'file://$REPO/test/fixtures/server.mjs';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
const S = process.cwd();
const srv = await startFixtureServer({ staticDir: S + '/site' });
const tpl = JSON.parse(await fs.readFile('$REPO/test/fixtures/site.json.template','utf8'));
const cfg = JSON.parse(JSON.stringify(tpl).replaceAll('__BASE_URL__', srv.baseUrl));
cfg.name = 'verify-a01';
cfg.crawl.sitemapSeeding.enabled = false;
cfg.scan.axe.withTags = ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'];
cfg.scan.fullPageScreenshots = false;
cfg.reporting.reporters = ['json','markdown','html','earl-jsonld','junit','portal-export','report-builder-starter'];
cfg.reporting.includePasses = true;
cfg.reporting.failOnFindings.threshold = 9999;
await fs.writeFile(S + '/config.json', JSON.stringify(cfg, null, 2));
const child = spawn(process.execPath, ['$REPO/bin/wcag-em.mjs','audit','--config',S+'/config.json','--out-dir',S+'/out'], { cwd: S, env: { ...process.env, CRAWLEE_STORAGE_DIR: S + '/crawlee-storage' }, stdio: ['ignore','pipe','pipe'] });
let log=''; child.stdout.on('data',d=>log+=d); child.stderr.on('data',d=>log+=d);
const code = await new Promise(r=>child.on('close',r));
await fs.writeFile(S+'/audit.log', log);
await srv.stop();
console.log('exit', code, 'base', srv.baseUrl);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node run.mjs; tail -5 audit.log; ls out/reports 2>/dev/null
````

Output (truncated):

````text
exit 0 base http://127.0.0.1:55629
{"level":30,"time":"2026-09-30T18:42:11.508Z","pid":57573,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","processesRun":0,"msg":"scan-processes done"}
{"level":30,"time":"2026-09-30T18:42:11.508Z","pid":57573,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","stage":"scan-processes","msg":"stage done"}
{"level":30,"time":"2026-09-30T18:42:11.508Z","pid":57573,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","stage":"summarize","msg":"stage start"}
{"level":30,"time":"2026-09-30T18:42:11.576Z","pid":57573,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","findings":3,"reportsDir":"$SCRATCH/wf2/verify-A0 ...
````

## 9. Bash

````bash
cd $SCRATCH/wf2/verify-A01/out/reports && python3 - <<'EOF'
import json
w=json.load(open('wcag-em-summary.json'))
from collections import Counter
print(Counter(c['outcome'] for c in w['criteriaOutcomes']))
print('coverage',w['automatedCoverage'])
for c in w['criteriaOutcomes']:
    if c['outcome']!='notTested': print(c['sc'],c['level'],c['outcome'],c['pagesExamined'],c['relatedRules'])
s=json.load(open('summary.json'))
print('findings',[ (f['id'],f.get('pageCount')) for f in s['findings']])
p=json.load(open('portal-export.json'))
print('portal', p['summary'].get('averageScore'), p['summary'].get('scoreBasis'))
EOF
````

Output (truncated):

````text
Counter({'notTested': 36, 'inapplicable': 10, 'passed': 8, 'failed': 3})
coverage {'status': 'complete', 'adequate': True, 'pagesSelected': 5, 'pagesAudited': 5, 'pagesExcluded': 0, 'scopeExclusions': []}
1.1.1 A inapplicable 5 ['aria-meter-name', 'aria-progressbar-name', 'image-alt', 'input-image-alt', 'object-alt', 'role-img-alt', 'svg-img-alt']
1.2.2 A inapplicable 5 ['video-caption']
1.3.1 A passed 5 ['aria-hidden-body', 'aria-required-children', 'aria-required-parent', 'definition-list', 'dlitem', 'list', 'listitem', 'td-headers-attr', 'th-has-data-cells']
1.3.5 AA inapplicable 5 ['autocomplete-valid']
1.4.1 A passed 5 ['link-in-text-block']
1.4.2 A inapplicable 5 ['no-autoplay-audio']
1.4.3 AA passed 5 ['color-contrast']
1.4.4 AA inapplicable 5 ['meta-viewport']
1.4.12 AA passed 5 [' ...
````

## 10. Bash

````bash
cd $SCRATCH/wf2/verify-A01/out/reports && python3 -c "
import json;s=json.load(open('summary.json'))
for f in s['findings']: print(f['id'],f['pages'])
"; grep -c "" ../../audit.log; grep -i "404\|status" ../../audit.log | head -5
````

Output (truncated):

````text
document-title ['http://127.0.0.1:55629/a.html', 'http://127.0.0.1:55629/b.html']
html-has-lang ['http://127.0.0.1:55629/a.html', 'http://127.0.0.1:55629/b.html']
target-size ['http://127.0.0.1:55629/', 'http://127.0.0.1:55629/index.html']
35
````

## 11. Bash

````bash
S=$SCRATCH/wf2/verify-A01
cd $S && for n in a b; do printf '<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Page %s info</title></head><body><main><h1>%s</h1><p>Info.</p></main></body></html>\n' $n $n > site/$n.html; done
sed -i '' 's#<style>\*:focus{outline:none}</style>#<style>*:focus{outline:none} nav a{display:inline-block;padding:12px 16px;margin:4px}</style>#' site/index.html
rm -rf out crawlee-storage
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node run.mjs && cd out/reports && python3 - <<'EOF'
import json
from collections import Counter
w=json.load(open('wcag-em-summary.json'))
print(Counter(c['outcome'] for c in w['criteriaOutcomes']))
print('coverage',w['automatedCoverage']['status'],w['automatedCoverage']['adequate'],w['automatedCoverage']['pagesAudited'])
for c in w['criteriaOutcomes']:
    if c['outcome']!='notTested': print(c['sc'],c['level'],c['outcome'],c['pagesExamined'],len(c['relatedRules']))
s=json.load(open('summary.json'))
print('findings',[ (f['id'],f['pages']) for f in s['findings']])
p=json.load(open('portal-export.json'))
print('portal', p['summary'].get('averageScore'), p['summary'].get('scoreBasis'))
EOF
````

Output (truncated):

````text
exit 0 base http://127.0.0.1:55701
Counter({'notTested': 36, 'passed': 11, 'inapplicable': 10})
coverage complete True 5
1.1.1 A inapplicable 5 7
1.2.2 A inapplicable 5 1
1.3.1 A passed 5 9
1.3.5 AA inapplicable 5 1
1.4.1 A passed 5 1
1.4.2 A inapplicable 5 1
1.4.3 AA passed 5 1
1.4.4 AA inapplicable 5 1
1.4.12 AA passed 5 1
2.1.1 A inapplicable 5 3
2.1.3 AAA inapplicable 5 1
2.2.1 A inapplicable 5 1
2.2.2 A inapplicable 5 2
2.4.1 A passed 5 1
2.4.2 A passed 5 1
2.4.4 A passed 5 2
2.5.8 AA passed 5 1
3.1.1 A passed 5 3
3.1.2 AA inapplicable 5 1
3.3.2 A passed 5 1
4.1.2 A passed 5 27
findings []
portal 100 {'passed': 11, 'failed': 0, 'cantTell': 0, 'inapplicable': 10, 'notTested': 36}
````

## 12. Bash

````bash
cd $SCRATCH/wf2/verify-A01/out/reports && grep -o "<aside>.*</aside>" summary.html; grep -o "<h2>[^<]*</h2>" summary.html; grep -o "<tr><td>2\.1\.[13]</td>[^\n]*</tr>" summary.html | head; grep -A14 "<h2>Passing criteria" summary.html | tr -d '\n'; echo; python3 - <<'EOF'
import json
d=json.load(open('report-builder-draft.json'))
for c in d['criteriaOutcomes']:
    if c['criterion'] in ('2.1.1','2.2.2','3.1.2','2.4.2','2.4.4','1.3.1','2.1.3'): print(c)
for a in d.get('appendices',[]): print(a['title'], '|', a['content'][:160], '...', 'has 2.2.2?', '2.2.2' in a['content'], 'has 2.1.1?','2.1.1 ' in a['content'])
print(d['nextSteps'])
e=json.load(open('earl.jsonld'))
g=e.get('@graph',e)
import collections
txt=json.dumps(e)
print('earl passed count', txt.count('earl:passed'), 'inapplicable', txt.count('earl:inapplicable'), 'mode', set(__import__('re').findall(r'"(earl:(?:automatic|semiAuto|manual))"',txt)))
EOF
````

Output (truncated):

````text
<aside><strong>Method guardrails:</strong> This is the automated layer of the audit workflow. It does not make a sitewide WCAG conformance claim on its own. Complete processes and manual checks still need separate review.</aside>
<h2>Run summary</h2>
<h2>Findings by WCAG success criterion</h2>
<h2>Grouped findings by rule</h2>
<h2>Passing criteria</h2>
<tr><td>2.1.1</td><td>inapplicable</td><td>frame-focusable-content, scrollable-region-focusable, server-side-image-map</td></tr>
<tr><td>2.1.3</td><td>inapplicable</td><td>scrollable-region-focusable</td></tr>
<h2>Passing criteria</h2><ul><li>1.3.1</li><li>1.4.1</li><li>1.4.3</li><li>1.4.12</li><li>2.4.1</li><li>2.4.2</li><li>2.4.4</li><li>2.5.8</li><li>3.1.1</li><li>3.3.2</li><li>4.1.2</li></ul>
{'criterion': '1.3.1', 'level': 'A', 'outcome ...
````

## 13. Bash

````bash
cd $SCRATCH/wf2/verify-A01/out/reports && python3 -c "
import json;e=json.load(open('earl.jsonld'));g=e['@graph'] if '@graph' in e else e
s=json.dumps(e);i=s.find('earl:passed');print(s[max(0,i-700):i+150])"; cat manual-backlog.md
````

Output (truncated):

````text
c/terms/", "wcag-em": "http://www.w3.org/TR/WCAG-EM/#", "doap": "http://usefulinc.com/ns/doap#", "foaf": "http://xmlns.com/foaf/0.1/"}, "@type": "earl:Evaluation", "dct:date": "2026-09-30T18:42:41.084Z", "dct:description": "WCAG-EM automated evaluation of verify-a01", "wcag-em:conformanceTarget": "AA", "wcag-em:wcagVersion": "2.2", "earl:assertedBy": {"@type": "earl:Assertor", "doap:name": "wcag-em-a11y-toolkit", "doap:release": "1.1.0"}, "@graph": [{"@type": "earl:Assertion", "earl:assertedBy": {"@type": "earl:Assertor", "doap:name": "wcag-em-a11y-toolkit", "doap:release": "1.1.0"}, "earl:subject": "verify-a01", "earl:test": "1.3.1", "earl:result": {"@type": "earl:Result", "earl:outcome": "earl:passed", "earl:info": "No violations recorded for this success criterion."}, "earl:mode": "earl ...
````

## 14. Bash

````bash
grep -n "export function isAuditableView" -A25 src/lib/scan-results.mjs | head -40; ls $SCRATCH/wf2/verify-A01/out/
````

Output (truncated):

````text
76:export function isAuditableView(entry) {
77-  return viewStatus(entry) === 'auditable';
78-}
79-
80-/**
81- * The canonical URL identifying a page-view: the post-redirect `finalUrl` when
82- * present, else the requested `url`. Normalised so redirect source + target
83- * fold to one identity and so the (final-URL-keyed) inventory lookup resolves.
84- * Falls back to the raw string if normalization throws (e.g. `about:blank`).
85- *
86- * @param {any} entry
87- * @returns {string}
88- */
89-export function viewIdentity(entry) {
90-  const raw = entry?.finalUrl ?? entry?.url ?? '';
91-  try {
92-    return normalizeUrl(raw);
93-  } catch {
94-    return String(raw);
95-  }
96-}
inventory
reports
results
sample.json
screenshots
````

## 15. Bash

````bash
S=$SCRATCH/wf2/verify-A01
cd $S && cat > probe-pages.mjs <<'EOF'
import fs from 'node:fs/promises';
import { toWcagEmSummary } from 'file://$REPO/src/lib/wcag-em-summary.mjs';
const axeResults = JSON.parse(await fs.readFile('out/results/axe-results.json','utf8'));
const about = axeResults.find(r => String(r.url).endsWith('/about.html'));
// one audited page (about) + one process with 4 states cloned from the same page's real axe output
const proc = { name: 'p', startUrl: about.url, states: ['s1','s2','s3','s4'].map(s => ({ ...about, state: s })) };
const base = toWcagEmSummary({ config: { wcagEm: {} } }, { axeResults: [about], processResults: [] });
const withProc = toWcagEmSummary({ config: { wcagEm: {} } }, { axeResults: [about], processResults: [proc] });
const pick = (w, sc) => w.criteriaOutcomes.find(c => c.sc === sc);
for (const sc of ['2.4.2','2.2.2','2.1.1']) console.log(sc, pick(base, sc).outcome, 'pagesExamined page-only=', pick(base, sc).pagesExamined, 'with 4-state process=', pick(withProc, sc).pagesExamined, 'pagesAudited=', withProc.automatedCoverage.pagesAudited);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe-pages.mjs
````

Output (truncated):

````text
2.4.2 passed pagesExamined page-only= 1 with 4-state process= 5 pagesAudited= 1
2.2.2 inapplicable pagesExamined page-only= 1 with 4-state process= 5 pagesAudited= 1
2.1.1 inapplicable pagesExamined page-only= 1 with 4-state process= 5 pagesAudited= 1
````

## 16. Bash

````bash
grep -n "it(\|test(" test/unit/wcag-em-summary.test.mjs | head -40; git log --oneline -3 -- src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
53:test('toWcagEmSummary: violation → outcome failed', () => {
66:test('toWcagEmSummary: non-best-practice pass only → outcome passed', () => {
78:test('toWcagEmSummary: best-practice rule passing does NOT count as passed', () => {
97:test('toWcagEmSummary: reviewable incomplete (nodesCount > 0) → outcome cantTell', () => {
109:test('toWcagEmSummary F8: infra-failure incomplete (nodesCount === 0) → scanWarnings, NOT cantTell', () => {
124:test('toWcagEmSummary: inapplicable only → outcome inapplicable', () => {
136:test('toWcagEmSummary: failed wins over passed + cantTell + inapplicable for same SC', () => {
151:test('toWcagEmSummary: cantTell wins over passed + inapplicable (but not failed)', () => {
166:test('toWcagEmSummary: empty scan emits notTested for all A+AA SC (AA target)', () => ...
````

## 17. Bash

````bash
sed -n 219,240p test/unit/wcag-em-summary.test.mjs
````

Output (truncated):

````text
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
````

## 18. Bash

````bash
grep -i "404\|http status\|error page\|non-text contrast\|1\.4\.11" $SCRATCH/review/round1-index.txt | head
````

Output (truncated):

````text
VERD-17 | low | new | methodology | The manual backlog drops the non-text contrast (1.4.11) check whenever color-contrast (1.4.3) violations exist | src/lib/manual-backlog.mjs:60, src/lib/manual-backlog.mjs:87
SAMP-02 | medium | new | accuracy-coverage | The random-tier population includes HTTP 404/500 and soft-404 pages. The inventory records no HTTP status, so the sampler cannot filter them | src/commands/discover.mjs:266, src/commands/sample.mjs:50, src/lib/page-guard.mjs:99
DISC-03 | high | new | accuracy-coverage | Inventory accepts any navigated document regardless of HTTP status or content type; RSS/JSON links produced false 'failed' verdicts for SC 2.4.2 and 3.1.1 | src/commands/discover.mjs:236, src/lib/config.mjs:42, src/lib/page-guard.mjs:24
DISC-09 | medium | new | correctness  ...
````

## 19. Bash

````bash
grep -E "^(VERD-01|VERD-0[3-9]|REPB|CAP-0[2-9]|CAP-2)" $SCRATCH/review/round1-index.txt | grep -i -E "passed|inapplicable|score|verdict|notTested|checklist|pagesExamined|criteria" | head -15
````

Output (truncated):

````text
VERD-01 | high | new | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This gives false passes and false 'not present' verdicts on every surface | src/lib/wcag-em-summary.mjs:269, src/lib/wcag-em-summary.mjs:297, src/lib/wcag-em-summary.mjs:513, docs/adr/0007-wcag-em-summary-shape.md:18, src/reporters/html.mjs:362, src/reporters/earl-jsonld.mjs:128, src/reporters/r
VERD-03 | high | new | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary.mjs:371, src/lib/wcag-em-summary.mjs:441, src/lib/config.mjs:124, schemas/config.schema.json:662
VERD-04 | medium | new | correctness | 4.1. ...
````

## 20. Bash

````bash
ls $SCRATCH/wf2/ $SCRATCH/review/ 2>/dev/null; grep -l "VERD-01" -r $SCRATCH/review/ 2>/dev/null | head
````

Output (truncated):

````text
$SCRATCH/review/:
round1-coverage.json
round1-experiments.json
round1-findings.json
round1-index.txt
round1-strengths.json

$SCRATCH/wf2/:
e2e
ops
stress
test
verify-A01
verify-A02
$SCRATCH/review/round1-coverage.json
$SCRATCH/review/round1-index.txt
$SCRATCH/review/round1-findings.json
````

## 21. Bash

````bash
grep -i -E "pagesExamined|examined|Passing criteria|relatedRules|Level column|backlog|averageScore|score" $SCRATCH/review/round1-index.txt | cut -c1-220
````

Output (truncated):

````text
VERD-05 | medium | new | correctness | SCs above the conformance target that a rule touched are emitted and scored: 2.1.3 (AAA) appears in every default AA run | src/lib/wcag-em-summary.mjs:338, src/lib/wcag-em-summary.m
VERD-15 | low | new | correctness | pagesExamined counts process states as pages and includes pages where the SC's rules were only inapplicable; the client draft calls this 'examined page(s)' | src/lib/wcag-em-summary.mj
VERD-17 | low | new | methodology | The manual backlog drops the non-text contrast (1.4.11) check whenever color-contrast (1.4.3) violations exist | src/lib/manual-backlog.mjs:60, src/lib/manual-backlog.mjs:87
VERD-19 | low | tracked-open | correctness | SC examples and pagesExamined in wcag-em-summary are keyed on the pre-redirect source URL while finding ...
````
