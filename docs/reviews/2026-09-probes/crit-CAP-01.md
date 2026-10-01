# Probe record: crit:CAP-01

Role: critical second opinion. Findings: CAP-01

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" CAP-01
````

Output (truncated):

````text
[
 {
  "dimension": "CAP",
  "id": "CAP-01",
  "title": "Partially-automatable SCs get 'passed' or 'inapplicable' from axe alone, drop off the manual checklist, and push the portal score to 100",
  "category": "methodology",
  "severity": "critical",
  "status": "new",
  "claim": "toWcagEmSummary marks an SC 'passed' when any non-best-practice axe rule tagged with it passes, and 'inapplicable' when every such rule is inapplicable. Every SC axe touches is only partly automatable: ACT's requirement mapping says a passed outcome from a partial rule means 'All passed outcomes: further testing is needed'. So every run asserts verdicts automation cannot make. Examples: 2.1.1 Keyboard is 'inapplicable' whenever a page has no iframes, scrollable regions or server-side image maps. 2.2.2 is 'inappli ...
````

## 2. Bash

````bash
sed -n 430,620p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
    scopeExclusions,
  };

  return {
    automatedCoverage,
    criteriaOutcomes,
    evaluationDate: new Date().toISOString(),
    processesEvaluated: Array.isArray(ctx?.config?.processes)
      ? ctx.config.processes.map((p) => (typeof p?.name === 'string' ? p.name : '')).filter(Boolean)
      : [],
    scanWarnings,
    wcagVersion: wcagEmConfig.wcagVersion ?? '2.2',
    conformanceTarget: wcagEmConfig.conformanceTarget ?? 'AA',
    atBaseline: Array.isArray(wcagEmConfig.atBaseline) ? [...wcagEmConfig.atBaseline] : [],
    technologiesReliedUpon: Array.isArray(wcagEmConfig.technologiesReliedUpon)
      ? [...wcagEmConfig.technologiesReliedUpon]
      : [],
    // NOTE: synthesized from sample-metadata when the config leaves it blank
    // (2026-06 review C4): the toolkit KNOWS the sam ...
````

## 3. Bash

````bash
grep -n -i "manual\|partial\|automat\|requires\|caveat\|cannot\|guardrail\|disclaimer" src/lib/wcag-em-summary.mjs | head -80
````

Output (truncated):

````text
175: *   automatedCoverage: { status: 'complete'|'partial'|'none', adequate: boolean, pagesSelected: number|null, pagesAudited: number, pagesExcluded: number, scopeExclusions: Array<{ outcome: string, count: number, examples: string[] }> },
386:  // would have failed it was skipped. Record what the automated layer actually
418:  /** @type {'complete' | 'partial' | 'none'} */
422:    coverageStatus = 'partial';
424:  const automatedCoverage = {
434:    automatedCoverage,
482:    // No sample-metadata available (e.g. summarize over a partial out-dir):
````

## 4. Bash

````bash
sed -n 150,200p src/lib/wcag-em-summary.mjs && sed -n 330,430p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
/**
 * @typedef {object} CriterionOutcome
 * @property {string} sc - Success Criterion number, e.g. "1.4.3".
 * @property {string | null} level - Conformance level "A" / "AA" / "AAA" / null (if unknown).
 * @property {'passed' | 'failed' | 'cantTell' | 'inapplicable' | 'untested' | 'notTested'} outcome - EARL outcome verdict.
 * @property {Array<{ pageUrl: string, ruleId: string, impact: string | null }>} examples - Up to 5 example offenders.
 * @property {number} pagesExamined - Number of unique page URLs that contributed to this verdict.
 * @property {string[]} relatedRules - Unique axe rule IDs that reference this SC in the run.
 */

/**
 * Produce the WCAG-EM Step 5 per-SC summary.
 *
 * Note on naming: the second parameter is a *bundle of raw results*, not a
 * draft of the returned s ...
````

## 5. Bash

````bash
cat docs/adr/0007-wcag-em-summary-shape.md | head -120
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

## 6. Bash

````bash
sed -n 120,260p docs/adr/0007-wcag-em-summary-shape.md
````

Output (truncated):

````text
  "scanWarnings": [
    "axe rule color-contrast reported incomplete with zero reviewable nodes on https://…/admin; infra failure (script timeout / cross-origin / engine snag). Does not affect SC verdicts.",
  ],
  "wcagVersion": "2.2",
  "conformanceTarget": "AA",
  "atBaseline": [],
  "technologiesReliedUpon": ["HTML", "CSS", "JavaScript", "WAI-ARIA"],
  "samplingMethodNotes": "",
  "evaluator": { "name": "", "contact": "" },
}
```

### 6. Algorithm — bucket-first, verdict-once

The implementation sweeps every page's rule arrays once, feeding
entries into per-SC buckets keyed by `withActAndWcagMetadata.wcagCriteria`.
After the sweep, one verdict is emitted per populated bucket in natural-
numeric SC order (so `1.2.10` appears after `1.2.9`, not between `1`
and `2`). This is O(N + K) wher ...
````

## 7. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json
d=json.load(open('round1-experiments.json'))
print(type(d), len(d))
items = d if isinstance(d,list) else d.get('experiments', d)
for e in (items if isinstance(items,list) else []):
    s=json.dumps(e)
    if 'CAP' in s[:400] or 'CAP-01' in s:
        print(s[:1500]); print('====')
" | head -60
````

Output (truncated):

````text
<class 'list'> 145
{"dimension": "SEC", "what": "Process screenshot step-name traversal", "command": "node scratch/wf/sec/probe-stepname.mjs (runStep with a real Playwright page)", "result": "name '../../escaped/../../ESCAPED' wrote out/ESCAPED__desktop.png outside screenshots/, and 'Step 2 / after submit' created nested directories."}
====
{"dimension": "CAP", "what": "Enumerate axe-core 4.11.3 rules by WCAG SC tag (which SCs axe can touch; profile/experimental/best-practice flags)", "command": "node scratchpad/wf/cap/probes/axe-sc-map.cjs", "result": "104 rules, 56 with actIds. SCs touched by the default profile: 1.1.1, 1.2.1, 1.2.2, 1.3.1, 1.3.5, 1.4.1-1.4.4, 1.4.12, 2.1.1 (frame-focusable-content, scrollable-region-focusable, server-side-image-map), 2.1.3, 2.2.1 (meta-refresh), 2.2.2 ( ...
````

## 8. Bash

````bash
S=$SCRATCH; ls $S; ls $S/wf 2>/dev/null; ls $S/wf/cap 2>/dev/null; ls $S/wf/cap/runs/run1 2>/dev/null
````

Output (truncated):

````text
gate
review
wf
wf2
cap
cli
disc
docs
empa
empb
empc
proc
repa
repb
samp
scan
sec
test
verd
probes
run-audit.mjs
runs
site
cli.log
config.json
crawlee-storage
out
````

## 9. Bash

````bash
S=$SCRATCH/wf/cap; cat $S/runs/run1/config.json; echo; cat $S/run-audit.mjs | head -80; ls $S/site
````

Output (truncated):

````text
{
  "name": "cap-probe-site",
  "rootUrl": "http://127.0.0.1:60949/",
  "scope": {
    "mode": "same-origin",
    "allowedHosts": []
  },
  "crawl": {
    "maxPages": 10,
    "maxConcurrency": 2,
    "requestTimeoutSecs": 30,
    "requestDelayMs": 0,
    "excludeUrlPatterns": [],
    "sitemapSeeding": {
      "enabled": true,
      "urls": [],
      "commonPaths": [
        "/sitemap.xml"
      ],
      "maxUrls": 50
    }
  },
  "sample": {
    "structuredManual": [
      "http://127.0.0.1:60949/",
      "http://127.0.0.1:60949/about.html"
    ],
    "autoSuggest": {
      "enabled": true,
      "perCluster": 1,
      "preferTypes": [
        "homepage",
        "form-or-contact",
        "policy",
        "content"
      ]
    },
    "randomPercentOfStructured": 0.1,
    "minRandomPages" ...
````

## 10. Bash

````bash
D=$SCRATCH/wf2/crit-CAP-01; mkdir -p $D/site && cd $D && cat > site/index.html <<'EOF'
<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Page</title>
<style>.fake{background:#005a9c;color:#fff;padding:8px;display:inline-block;cursor:pointer}</style></head>
<body>
<header><nav><a href="/about.html">About</a></nav></header>
<main>
<h1>Shop</h1>
<p>Welcome to the shop.</p>
<p>Bienvenue dans notre boutique, veuillez choisir un produit ci-dessous.</p>
<div class="fake" onclick="alert('ordered')">Submit order</div>
<p><a href="/about.html">Click here</a></p>
</main>
</body></html>
EOF
cat > site/about.html <<'EOF'
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>About</title></head>
<body><main><h1>About us</h1><p>We sell things.</p><p><a href="/">Home</a></p></main></body></html>
EOF
cat > run.mjs <<'EOF'
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';
const S = path.dirname(new URL(import.meta.url).pathname);
const REPO = '$REPO';
const server = createServer(async (req, res) => {
  res.setHeader('Connection', 'close');
  const p = (req.url ?? '/').split('?')[0];
  const file = p === '/' ? 'index.html' : path.basename(p);
  try { const body = await fs.readFile(path.join(S, 'site', file)); res.setHeader('content-type', 'text/html; charset=utf-8'); res.end(body); }
  catch { res.statusCode = 404; res.setHeader('content-type','text/html'); res.end('<!doctype html><html lang="en"><title>404</title><h1>Not found</h1></html>'); }
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;
const cfg = {
  name: 'crit-cap01', rootUrl: `${base}/`, scope: { mode: 'same-origin', allowedHosts: [] },
  crawl: { maxPages: 5, maxConcurrency: 2, requestTimeoutSecs: 30, requestDelayMs: 0, excludeUrlPatterns: [], sitemapSeeding: { enabled: false, urls: [], commonPaths: [], maxUrls: 10 } },
  sample: { structuredManual: [`${base}/`, `${base}/about.html`], autoSuggest: { enabled: false, perCluster: 1, preferTypes: ['homepage'] }, randomPercentOfStructured: 0, minRandomPages: 0, randomSeed: 1, smallSiteSupplementaryScanThreshold: 0 },
  scan: { viewports: [{ id: 'desktop', width: 1280, height: 800 }], waitUntil: 'domcontentloaded', timeoutMs: 30000, retries: 0, fullPageScreenshots: false,
    axe: { include: [], exclude: [], withRules: [], withTags: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'], runOnly: null } },
  processes: [],
  reporting: { reporters: ['json','markdown','html','earl-jsonld','junit','portal-export','report-builder-starter'], includePasses: true, groupBestPracticeSeparately: true, failOnFindings: { impacts: ['critical','serious'], classifications: [], threshold: 0 } },
  wcagEm: { wcagVersion: '2.2', conformanceTarget: 'AA', atBaseline: [], technologiesReliedUpon: ['HTML','CSS','JavaScript'], evaluator: { name: 'Probe', contact: 'probe@example.test' } },
};
const runDir = path.join(S, 'run');
await fs.rm(runDir, { recursive: true, force: true }); await fs.mkdir(runDir, { recursive: true });
const cfgPath = path.join(runDir, 'config.json'); await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2));
const child = spawn(process.execPath, [path.join(REPO, 'bin/wcag-em.mjs'), 'audit', '--config', cfgPath, '--out-dir', path.join(runDir, 'out'), '--log-level', 'warn'], { cwd: runDir, env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(runDir, 'crawlee-storage') }, stdio: ['ignore', 'pipe', 'pipe'] });
let out = ''; child.stdout.on('data', d => out += d); child.stderr.on('data', d => out += d);
const t = setTimeout(() => child.kill('SIGKILL'), 240000);
const [code] = await once(child, 'exit'); clearTimeout(t);
await fs.writeFile(path.join(runDir, 'cli.log'), out);
server.close(); server.closeAllConnections?.();
console.log(JSON.stringify({ base, exitCode: code, tail: out.split('\n').slice(-12).join('\n') }, null, 1));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node run.mjs
````

Output (truncated):

````text
{
 "base": "http://127.0.0.1:56937",
 "exitCode": 0,
 "tail": "\u001b[32mINFO\u001b[39m \u001b[33m PlaywrightCrawler:\u001b[39m Starting the crawler.\n\u001b[32mINFO\u001b[39m \u001b[33m PlaywrightCrawler:\u001b[39m All requests from the queue have been processed, the crawler will shut down.\n\u001b[32mINFO\u001b[39m \u001b[33m PlaywrightCrawler:\u001b[39m Final request statistics:\u001b[90m {\"requestsFinished\":2,\"requestsFailed\":0,\"retryHistogram\":[2],\"requestAvgFailedDurationMillis\":null,\"requestAvgFinishedDurationMillis\":229,\"requestsFinishedPerMinute\":184,\"requestsFailedPerMinute\":0,\"requestTotalDurationMillis\":457,\"requestsTotal\":2,\"crawlerRuntimeMillis\":652}\u001b[39m\n\u001b[32mINFO\u001b[39m \u001b[33m PlaywrightCrawler:\u001b[39m Finished! Total 2 requests: 2 s ...
````

## 11. Bash

````bash
D=$SCRATCH/wf2/crit-CAP-01/run/out/reports; ls $D; python3 - <<EOF
import json,re
d='$D'
w=json.load(open(d+'/wcag-em-summary.json'))
from collections import Counter
print('coverage', w['automatedCoverage'])
print(Counter(c['outcome'] for c in w['criteriaOutcomes']))
for c in w['criteriaOutcomes']:
    if c['outcome']!='notTested': print(c['sc'], c['outcome'], c['relatedRules'], c['pagesExamined'])
p=json.load(open(d+'/portal-export.json'))
s=p.get('summary',{})
print('portal', s.get('averageScore'), s.get('scoreBasis'), s.get('totalIssues'))
r=json.load(open(d+'/report-builder-draft.json'))
for c in r['criteriaOutcomes']:
    if c['criterion'] in ('2.1.1','3.1.2','2.4.2','2.4.4','1.3.1','4.1.2'): print('draft', c)
print('caveat', r['methodology']['conformanceCaveat'])
print('manualChecks', r['methodology']['manualChecks'])
print('appendix', [a['title'] for a in r.get('appendices',[])])
e=json.load(open(d+'/earl.jsonld'))
print('earl', [(g['earl:test'], g['earl:result']['earl:outcome'], g['earl:mode'], g['earl:result']['earl:info']) for g in e['@graph']][:20])
h=open(d+'/summary.html').read()
for sc in ['2.1.1','3.1.2','2.4.2']:
    m=re.search(r'<tr><td>'+re.escape(sc)+r'</td>.*?</tr>', h); print('html', m.group(0) if m else None)
print('passing section' , 'Passing criteria' in h)
EOF
cat $D/manual-backlog.md | head -40
````

Output (truncated):

````text
earl.jsonld
grouped-by-component.json
grouped-by-rule.json
junit.xml
manual-backlog.md
portal-export.json
random-vs-structured-comparison.json
report-builder-draft.json
summary.html
summary.json
summary.md
wcag-em-summary.json
coverage {'status': 'complete', 'adequate': True, 'pagesSelected': 2, 'pagesAudited': 2, 'pagesExcluded': 0, 'scopeExclusions': []}
Counter({'notTested': 36, 'inapplicable': 13, 'passed': 8})
1.1.1 inapplicable ['aria-meter-name', 'aria-progressbar-name', 'image-alt', 'input-image-alt', 'object-alt', 'role-img-alt', 'svg-img-alt'] 2
1.2.2 inapplicable ['video-caption'] 2
1.3.1 passed ['aria-hidden-body', 'aria-required-children', 'aria-required-parent', 'definition-list', 'dlitem', 'list', 'listitem', 'td-headers-attr', 'th-has-data-cells'] 2
1.3.5 inapplicable ['aut ...
````
