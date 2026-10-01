# Probe record: verify:A03

Role: packet verifier. Findings: VERD-06, PROC-02, PROC-04, PROC-05, PROC-17, PROC-19

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" VERD-06,PROC-02,PROC-04,PROC-05,PROC-17,PROC-19
````

Output (truncated):

````text
[
 {
  "dimension": "VERD",
  "id": "VERD-06",
  "title": "Process failures do not reach the WCAG-EM layer: states captured after a failed step feed SC verdicts unflagged, and processesEvaluated lists processes that failed",
  "category": "correctness",
  "severity": "high",
  "status": "new",
  "claim": "runProcessSteps sets degraded=true on every state after a failed step, with the comment 'so reporters can flag findings of uncertain provenance', but nothing in src reads it. isAuditableView ignores it, so toWcagEmSummary and groupFindings treat an axe run on the wrong page (the click never happened, or the process landed on a 404) as the intended state. In the probe, a 'checkout' process whose click timed out scanned a 404 page as state 'payment'. That flipped SC 2.4.2 and 3.1.1 from pas ...
````

## 2. Bash

````bash
wc -l src/lib/process-runner.mjs src/lib/wcag-em-summary.mjs src/lib/scan-results.mjs src/commands/summarize.mjs src/commands/scan-processes.mjs src/lib/group-findings.mjs src/reporters/portal-export.mjs src/reporters/report-builder-starter.mjs src/reporters/markdown.mjs src/reporters/html.mjs && grep -rn "degraded" src/ docs/ CHANGELOG.md TODO.md test/ | head -50
````

Output (truncated):

````text
     364 src/lib/process-runner.mjs
     532 src/lib/wcag-em-summary.mjs
      96 src/lib/scan-results.mjs
     715 src/commands/summarize.mjs
     217 src/commands/scan-processes.mjs
     208 src/lib/group-findings.mjs
     571 src/reporters/portal-export.mjs
     596 src/reporters/report-builder-starter.mjs
     240 src/reporters/markdown.mjs
     420 src/reporters/html.mjs
    3959 total
src/lib/process-runner.mjs:86: * @property {boolean} [degraded] - E1: a prior step errored, so this state's page
src/lib/process-runner.mjs:90: * @property {string} [degradedReason] - E1: human-readable reason for pageOutcome.
src/lib/process-runner.mjs:131:  // whose intended setup did not complete — tag it `degraded` so reporters can
src/lib/process-runner.mjs:138:      if (priorStepErrored) result.de ...
````

## 3. Bash

````bash
sed -n 1,60p src/lib/wcag-em-summary.mjs && echo ---- && sed -n 160,200p src/lib/wcag-em-summary.mjs && echo ---- && sed -n 290,460p src/lib/wcag-em-summary.mjs
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

## 4. Bash

````bash
python3 -c "
import json;s=json.load(open('schemas/config.schema.json'))
def find(o,path=''):
  if isinstance(o,dict):
    for k,v in o.items():
      if k=='processes': print(path+'/'+k, json.dumps(v)[:1500])
      find(v,path+'/'+k)
  elif isinstance(o,list):
    for i,v in enumerate(o): find(v,path+'/'+str(i))
find(s)
" ; python3 -c "
import json;s=json.load(open('schemas/config.schema.json'));d=s.get('\$defs',{});print(list(d.keys())); print(json.dumps(d.get('process',{}),indent=0)[:2500])"
````

Output (truncated):

````text
/properties/processes {"type": "array", "items": {"type": "object", "additionalProperties": false, "required": ["name", "startUrl"], "properties": {"name": {"type": "string", "pattern": "^[a-z0-9-]+$"}, "startUrl": {"type": "string", "format": "uri"}, "pattern": {"oneOf": [{"enum": ["blank-submit", "partial-submit"]}, {"type": "null"}]}, "forceInclude": {"type": "boolean"}, "relatedUrls": {"type": "array", "items": {"type": "string", "format": "uri"}}, "steps": {"type": "array", "items": {"$ref": "#/$defs/action"}}, "selectors": {"type": "object", "additionalProperties": {"type": "string"}}, "fields": {"type": "array", "items": {"type": "object", "required": ["selector"], "properties": {"selector": {"type": "string"}, "value": {"type": "string"}}}}, "stepTimeoutMs": {"type": "integer", "mi ...
````

## 5. Bash

````bash
grep -n -i "process" docs/adr/0007-wcag-em-summary-shape.md docs/adr/0017-page-outcome-could-not-audit.md | head -40; sed -n 55,90p docs/adr/0017-page-outcome-could-not-audit.md
````

Output (truncated):

````text
docs/adr/0007-wcag-em-summary-shape.md:119:  "processesEvaluated": ["signup", "checkout"],
docs/adr/0007-wcag-em-summary-shape.md:171:  rationale for marking `guessPageType`/`guessProcessTypes`/
docs/adr/0017-page-outcome-could-not-audit.md:23:  `process-results.json`** independently of `summary.json`, so a fix applied
docs/adr/0017-page-outcome-could-not-audit.md:40:   page as `pagesFailed`. The process path threads the navigation Response via
docs/adr/0017-page-outcome-could-not-audit.md:42:   so a process step that lands on a challenge is classified the same way.
docs/adr/0017-page-outcome-could-not-audit.md:63:   `pagesUnauditable`/`challengePages` + per-state `processStepFailures`. A
docs/adr/0017-page-outcome-could-not-audit.md:75:- `axe-results.json` / `process-results.json` entries ...
````

## 6. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A03 && cd $REPO && grep -n "audit" bin/wcag-em.mjs | head -10 && grep -n "stepTimeoutMs\|urlPattern" src/lib/process-runner.mjs src/commands/scan-processes.mjs src/commands/scan.mjs | head
````

Output (truncated):

````text
9: *   discover | sample | scan | scan-processes | summarize | audit
191:  .command('audit')
src/lib/process-runner.mjs:94: * Thrown internally when a step exceeds its `stepTimeoutMs`. Caught by
src/lib/process-runner.mjs:108:    super(`step "${action}" exceeded stepTimeoutMs=${timeoutMs}`);
src/lib/process-runner.mjs:155:  const stepTimeoutMs = Number(ctx.config?.scan?.timeoutMs ?? DEFAULT_STEP_TIMEOUT_MS);
src/lib/process-runner.mjs:156:  const timeout = rejectAfter(step.action, stepTimeoutMs);
src/commands/scan.mjs:63: * with no `regex` attached (i.e. no `urlPattern` in schema) run
````

## 7. Bash

````bash
grep -i -E "stepTimeoutMs|urlPattern" $SCRATCH/review/round1-index.txt | cut -c1-200
````

Output (truncated):

````text
VERD-18 | low | new | contract | processes[].stepTimeoutMs is documented and schema-valid but ignored; every step uses scan.timeoutMs (observed while probing VERD-06; outside this dimension) | src/lib
PROC-09 | medium | new | docs-drift | processes[].stepTimeoutMs is in the schema, the docs and the example but never read; per-step timeouts are otherwise inconsistent | schemas/config.schema.json:517
PROC-10 | medium | new | docs-drift | `urlPattern` on process steps is compiled but ignored, so steps documented as URL-gated always run | src/lib/context.mjs:101, docs/guides/config-guide.md:259, doc
DISC-02 | high | new | correctness | Post-redirect URL is never re-checked against scope or exclusions: off-site pages get inventoried, excludeUrlPatterns can be bypassed, and a root redirect to ww ...
````

## 8. Write `$SCRATCH/wf2/verify-A03/probe.mjs`

````text
// Probe for packet A03: one fixture, one audit run, all six claims.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO =
  '$REPO';
const OUT = path.join(HERE, 'out');
await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

const page = (title, body, lang = 'en') =>
  `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head>${
    title ? `<title>${title}</title>` : ''
  }<meta name="viewport" content="width=device-width"></head><body><main><h1>${title || 'x'}</h1>${body}</main></body></html>`;

const routes = {
  '/': () => [200, {}, page('Home', '<p>Home</p><a href="/start.html">Start</a> <a href="/contact.html">Contact</a>')],
  '/index.html': () => [200, {}, page('Home', '<p>Home</p><a href="/start.html">Start</a> <a href="/contact.html">Contact</a>')],
  // wizard step 1: next is JS-only so the crawler never discovers step2
  '/start.html': () => [200, {}, page('Start', '<p>Step one</p><button id="next" type="button" onclick="location.href=\'/step2.html\'">Next</button>')],
  // wizard step 2: two violations that exist ONLY here
  '/step2.html': () => [200, {}, page('Step two', '<p>Step two</p><img src="/x.png"><button id="finish" type="button"></button>')],
  // 404 page, no title, no lang
  '/gone.html': () => [404, {}, '<!doctype html><html><head></head><body><p>Not found</p></body></html>'],
  // challenged page
  '/blocked.html': () => [403, { 'cf-mitigated': 'challenge' }, page('Just a moment...', '<p>Checking</p>')],
  // form whose error message (low contrast) appears only after submit
  '/contact.html': () => [200, {}, page('Contact', '<label for="e">Email</label><input id="e"><button id="send" type="button" onclick="document.getElementById(\'err\').hidden=false">Send</button><p id="err" hidden style="color:#bbb;background:#fff">Please enter a valid email</p>')],
};

const server = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  const r = routes[p];
  if (!r) {
    res.writeHead(404, { 'content-type': 'text/html' });
    res.end('<!doctype html><html><body>nf</body></html>');
    return;
  }
  const [status, headers, body] = r();
  res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
  res.end(body);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const base = `http://127.0.0.1:${server.address().port}`;

const tpl = JSON.parse(await fs.readFile(path.join(REPO, 'test/fixtures/site.json.template'), 'utf8').then((s) => s.replaceAll('__BASE_URL__', base)));
tpl.name = 'a03-probe';
tpl.sample.structuredManual = [`${base}/index.html`, `${base}/contact.html`];
tpl.sample.autoSuggest.enabled = false;
tpl.sample.randomPercentOfStructured = 0;
tpl.sample.minRandomPages = 0;
tpl.scan.timeoutMs = 6000;
tpl.scan.viewports = [
  { id: 'desktop', width: 1280, height: 800 },
  { id: 'reflow', width: 320, height: 800 },
];
tpl.reporting.failOnFindings.threshold = 0;
tpl.reporting.reporters = ['json', 'markdown', 'html', 'earl-jsonld', 'junit', 'portal-export', 'report-builder-starter'];
tpl.processes = [
  {
    name: 'wizard',
    startUrl: `${base}/start.html`,
    steps: [
      { action: 'goto', url: `${base}/start.html` },
      { action: 'click', selector: '#next' },
      { action: 'waitFor', selector: '#finish' },
      { action: 'screenshot', name: 'step2' },
      { action: 'axe', state: 'step2' },
    ],
  },
  {
    name: 'checkout',
    startUrl: `${base}/start.html`,
    steps: [
      { action: 'goto', url: `${base}/gone.html` },
      { action: 'waitFor', selector: '#pay' },
      { action: 'axe', state: 'payment' },
    ],
  },
  {
    name: 'events',
    startUrl: `${base}/blocked.html`,
    steps: [
      { action: 'goto', url: `${base}/blocked.html` },
      { action: 'axe', state: 'events' },
    ],
  },
  { name: 'no-steps', startUrl: `${base}/start.html` },
  {
    name: 'contact-errors',
    startUrl: `${base}/contact.html`,
    steps: [
      { action: 'goto', url: `${base}/contact.html` },
      { action: 'click', selector: '#send' },
      { action: 'screenshot', name: 'errors' },
      { action: 'axe', state: 'errors' },
    ],
  },
];
const cfgPath = path.join(HERE, 'cfg.json');
await fs.writeFile(cfgPath, JSON.stringify(tpl, null, 2));

const child = spawn(
  process.execPath,
  [path.join(REPO, 'bin/wcag-em.mjs'), 'audit', '--config', cfgPath, '--out-dir', OUT],
  { cwd: HERE, env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(HERE, 'crawlee-storage') }, stdio: ['ignore', 'pipe', 'pipe'] },
);
let log = '';
child.stdout.on('data', (d) => (log += d));
child.stderr.on('data', (d) => (log += d));
const [code] = await once(child, 'exit');
await fs.writeFile(path.join(HERE, 'run.log'), log);
server.close();
console.log('exit', code, 'base', base);

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A03/probe.mjs (file state is current in your context — no need to Read it back)
````

## 9. Bash

````bash
cd $SCRATCH/wf2/verify-A03 && ln -sfn $REPO/node_modules node_modules && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs; tail -5 run.log | cut -c1-300; ls out out/*
````

Output (truncated):

````text
exit 0 base http://127.0.0.1:55912
{"level":30,"time":"2026-09-30T18:47:35.424Z","pid":80239,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","processesRun":10,"msg":"scan-processes done"}
{"level":30,"time":"2026-09-30T18:47:35.425Z","pid":80239,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","stage":"scan-processes","msg":"stage done"}
{"level":30,"time":"2026-09-30T18:47:35.425Z","pid":80239,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","stage":"summarize","msg":"stage start"}
{"level":30,"time":"2026-09-30T18:47:35.502Z","pid":80239,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","findings":8,"reportsDir":"$TMP
{"level":30,"tim ...
````

## 10. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && python3 - <<'EOF'
import json
pr=json.load(open('results/process-results.json'))
for p in pr:
  print(p['name'],p['viewport'],'startUrl=',p['startUrl'][-12:],'err=',p.get('error'))
  for s in p['states']:
    print('   ',{k:(v if not isinstance(v,list) else [x.get('id') if isinstance(x,dict) else x for x in v][:6]) for k,v in s.items() if k not in ('passesDetail','inapplicableDetail','incompleteDetail')} if True else '')
ax=json.load(open('results/axe-results.json'))
print('axe pages:',[(a['url'][-14:],a['viewport'],[v['id'] for v in a['violations']]) for a in ax])
EOF
````

Output (truncated):

````text
wizard desktop startUrl= 2/start.html err= None
    {'state': 'screenshot:step2', 'screenshot': '$SCRATCH/wf2/verify-A03/out/screenshots/127.0.0.1_55912_start.html__wizard__step2__desktop.png'}
    {'state': 'step2', 'violations': ['button-name', 'image-alt'], 'passes': 17, 'incomplete': 0, 'inapplicable': 70}
checkout desktop startUrl= 2/start.html err= None
    {'state': 'error', 'name': 'waitFor', 'error': "page.waitForSelector: Timeout 5950ms exceeded.\nCall log:\n  - waiting for locator('#pay') to be visible\n"}
    {'state': 'payment', 'violations': ['document-title', 'html-has-lang', 'landmark-one-main', 'page-has-heading-one', 'region'], 'passes': 2, 'incomplete': 0, 'inapplicable': 82, 'degraded': True}
events desktop startUrl= blocked.html err= None
    {'state': 'events', 'pageO ...
````

## 11. Bash

````bash
grep -i -E "withTags|axe config|scan.axe|runOnly|AxeBuilder" $SCRATCH/review/round1-index.txt | cut -c1-220
````

Output (truncated):

````text
VERD-07 | medium | new | correctness | Process-state axe runs ignore scan.axe (withTags/runOnly/withRules/include/exclude/overrides), so verdict inputs differ from the configured rule profile | src/lib/process-runner.mjs
PROC-03 | high | new | correctness | Process-state axe runs ignore scan.axe config (exclude/include/withTags/withRules/runOnly/overrides) and other scan setup (beforeScan, challenge wait, screenshotFormat) | src/lib/proc
SCAN-04 | high | new | correctness | axe tag and rule ids are never validated: a mistyped withTags runs zero rules and reports '0 findings, automated coverage complete'; unknown rule ids fail every page at runtime | sche
SCAN-05 | medium | new | correctness | withRules is silently discarded whenever withTags is non-empty (true by default), including per-UR ...
````

## 12. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && python3 - <<'EOF'
import json
w=json.load(open('reports/wcag-em-summary.json'))
print('processesEvaluated',w['processesEvaluated'])
print('automatedCoverage',w['automatedCoverage'])
print('wcag-em scanWarnings',w['scanWarnings'])
for c in w['criteriaOutcomes']:
  if c['outcome'] in ('failed','passed','cantTell'):
    print(' ',c['sc'],c['outcome'],'pagesExamined',c['pagesExamined'],[ (e.get('pageUrl','')[-28:],e.get('ruleId') or e.get('rule')) for e in c['examples']][:3], c['relatedRules'][:4])
s=json.load(open('reports/summary.json'))
print('processRuns',s['processRuns'],'samplePagesScanned',s['samplePagesScanned'])
eh=s['executionHealth']
print('processFailures',eh['processFailures'])
print('processStepFailures',json.dumps(eh['processStepFailures'])[:600])
print('pagesUnauditable',eh['pagesUnauditable'],'challengePages',eh['challengePages'])
print('summary.scanWarnings',json.dumps(s['scanWarnings'])[:1200])
for f in s['findings']:
  print('F',f['id'],f['impact'],f['pages'],f['sourceTypes'])
EOF
````

Output (truncated):

````text
processesEvaluated ['wizard', 'checkout', 'events', 'no-steps', 'contact-errors']
automatedCoverage {'status': 'complete', 'adequate': True, 'pagesSelected': 2, 'pagesAudited': 2, 'pagesExcluded': 0, 'scopeExclusions': []}
wcag-em scanWarnings []
  1.1.1 failed pagesExamined 5 [('0.0.1:55912/start.html#step2', 'image-alt'), ('0.0.1:55912/start.html#step2', 'image-alt')] ['aria-meter-name', 'aria-progressbar-name', 'image-alt', 'input-image-alt']
  1.3.1 passed pagesExamined 5 [] ['aria-hidden-body', 'aria-required-children', 'aria-required-parent', 'definition-list']
  1.4.3 failed pagesExamined 5 [('.1:55912/contact.html#errors', 'color-contrast'), ('.1:55912/contact.html#errors', 'color-contrast')] ['color-contrast']
  1.4.4 passed pagesExamined 5 [] ['meta-viewport']
  1.4.12 passed pag ...
````

## 13. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && python3 - <<'EOF'
import json
p=json.load(open('reports/portal-export.json'))
def walk(o):
  if isinstance(o,dict):
    if 'ruleId' in o and 'instances' in o:
      print('PORTAL',o['ruleId'],[(i.get('url','')[-16:],i.get('selector')) for i in o['instances']], {k:o[k] for k in o if k in ('source','sourceType','pageUrl','url','occurrenceCount')})
    for v in o.values(): walk(v)
  elif isinstance(o,list):
    for v in o: walk(v)
walk(p)
print('portal keys', list(p.keys()))
d=json.load(open('reports/report-builder-draft.json'))
print('journeysTested',d['scope']['journeysTested'],'pagesTested',d['scope']['pagesTested'])
print('sourceFiles',d['sourceRun']['sourceFiles'])
for f in d.get('findings',[]):
  ev=f.get('evidence',[])
  print('RB',f.get('id'),f.get('title','')[:40],[ (e.get('type'),e.get('path') or e.get('label','')[:60]) for e in ev])
print([a['title'] for a in d.get('appendices',[])])
EOF
grep -c -E "wizard|checkout|events|no-steps|contact-errors|step2|payment" reports/summary.md reports/summary.html reports/portal-export.json reports/report-builder-draft.json reports/manual-backlog.md reports/earl.jsonld reports/junit.xml
````

Output (truncated):

````text
PORTAL button-name [('55912/start.html', '#finish')] {'occurrenceCount': 1}
PORTAL image-alt [('55912/start.html', 'img')] {'occurrenceCount': 1}
PORTAL color-contrast [('912/contact.html', '#err')] {'occurrenceCount': 1}
PORTAL document-title [('55912/start.html', 'html')] {'occurrenceCount': 1}
PORTAL html-has-lang [('55912/start.html', 'html')] {'occurrenceCount': 1}
PORTAL landmark-one-main [('55912/start.html', 'html')] {'occurrenceCount': 1}
PORTAL page-has-heading-one [('55912/start.html', 'html')] {'occurrenceCount': 1}
PORTAL region [('55912/start.html', 'p')] {'occurrenceCount': 1}
portal keys ['scanMetadata', 'summary', 'rawFindings']
journeysTested ['wizard', 'checkout', 'events', 'no-steps', 'contact-errors'] pagesTested ['http://127.0.0.1:55912/contact.html', 'http://127.0.0. ...
````

## 14. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && grep -n -E "wizard|checkout|events|no-steps|contact-errors|step2|payment" reports/portal-export.json reports/manual-backlog.md reports/summary.html | cut -c1-250; echo ----; sed -n '/## Scan health/,/^## [A-RT-Z]/p' reports/summary.md | head -30; echo ----; grep -n -o 'src="[^"]*png"' reports/summary.html; grep -n -i "color-contrast" reports/summary.md | head -5
````

Output (truncated):

````text
reports/manual-backlog.md:30:- [ ] Complete walkthrough of process: **wizard**
reports/manual-backlog.md:31:- [ ] Complete walkthrough of process: **checkout**
reports/manual-backlog.md:32:- [ ] Complete walkthrough of process: **events**
reports/manual-backlog.md:33:- [ ] Complete walkthrough of process: **no-steps**
reports/manual-backlog.md:34:- [ ] Complete walkthrough of process: **contact-errors**
reports/portal-export.json:33:            "name": "checkout",
reports/portal-export.json:39:            "name": "checkout",
reports/summary.html:78:<li>Process "checkout" step "error" failed at <code>http://127.0.0.1:55912/start.html</code>: page.waitForSelector: Timeout 5950ms exceeded.
reports/summary.html:82:<li>Process "checkout" step "error" failed at <code>http://127.0.0.1:55912/start ...
````

## 15. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && sed -n 1,60p reports/portal-export.json | cut -c1-160; python3 -c "
import json;d=json.load(open('reports/report-builder-draft.json'));print([a for a in d['appendices']][:3])" | cut -c1-900
````

Output (truncated):

````text
{
  "scanMetadata": {
    "url": "http://127.0.0.1:55912/",
    "timestamp": "2026-09-30T18:47:35.436Z",
    "tool": "wcag-em-a11y-toolkit 1.1.0",
    "toolVersion": "1.1.0",
    "scanOptions": {
      "axeVersion": "4.11.2",
      "pagesScanned": 2,
      "sampleSize": 2,
      "inventorySize": 3,
      "pageViewsScanned": 4,
      "executionHealth": {
        "sampleListedCount": 2,
        "pagesInSample": 2,
        "pagesFullyScanned": 2,
        "pagesDegraded": [],
        "pagesFailed": [],
        "pagesUnauditable": [],
        "challengePages": 0,
        "structuredMissingFromInventory": [
          {
            "url": "http://127.0.0.1:55912/index.html",
            "reason": "not-in-inventory"
          }
        ],
        "pageViewsScanned": 4,
        "pageViewsFailed": 0 ...
````

## 16. Bash

````bash
cd $SCRATCH/wf2/verify-A03/out && grep -l "contact-errors__errors\|wizard__step2" reports/* ; echo "(none above = unreferenced)"; grep -n "sourceTypes\|process:" reports/summary.md reports/summary.html reports/report-builder-draft.json reports/portal-export.json | head; grep -rn "process:" reports/grouped-by-rule.json | head -3
````

Output (truncated):

````text
(none above = unreferenced)
reports/report-builder-draft.json:90:      "Complete walkthrough of process: **wizard**",
reports/report-builder-draft.json:91:      "Complete walkthrough of process: **checkout**",
reports/report-builder-draft.json:92:      "Complete walkthrough of process: **events**",
reports/report-builder-draft.json:93:      "Complete walkthrough of process: **no-steps**",
reports/report-builder-draft.json:94:      "Complete walkthrough of process: **contact-errors**"
reports/report-builder-draft.json:365:      "label": "Complete walkthrough of process: **wizard**",
reports/report-builder-draft.json:369:      "label": "Complete walkthrough of process: **checkout**",
reports/report-builder-draft.json:373:      "label": "Complete walkthrough of process: **events**",
reports/r ...
````

## 17. Bash

````bash
sed -n 100,135p docs/adr/0007-wcag-em-summary-shape.md; sed -n 148,160p src/lib/config.mjs
````

Output (truncated):

````text
### 5. Output shape

```jsonc
{
  "tool": { "name": "…", "version": "…", "axeCore": "…" },
  "criteriaOutcomes": [
    {
      "sc": "1.4.3",
      "level": "AA",
      "outcome": "failed",
      "examples": [
        { "pageUrl": "https://…/admin", "ruleId": "color-contrast", "impact": "serious" },
      ],
      "pagesExamined": 12,
      "relatedRules": ["color-contrast"],
    },
  ],
  "evaluationDate": "2026-04-19T12:00:00.000Z",
  "processesEvaluated": ["signup", "checkout"],
  "scanWarnings": [
    "axe rule color-contrast reported incomplete with zero reviewable nodes on https://…/admin; infra failure (script timeout / cross-origin / engine snag). Does not affect SC verdicts.",
  ],
  "wcagVersion": "2.2",
  "conformanceTarget": "AA",
  "atBaseline": [],
  "technologiesReliedUpon": ...
````

## 18. Bash

````bash
sed -n 160,185p docs/adr/0007-wcag-em-summary-shape.md; sed -n 140,160p src/lib/urls.mjs
````

Output (truncated):

````text
  so reviewers see them, but they do not contribute to per-SC
  conformance verdicts. Separation of concerns.

## More Information

- [ADR-0001 — Project conventions](./0001-project-conventions.md)
- [ADR-0005 — Fail fast on config](./0005-fail-fast-on-config.md) —
  shares `defineHidden`.
- [ADR-0006 — Multi-viewport axe runs](./0006-multi-viewport-axe-runs.md) —
  the scan loop whose widened artefact feeds this inversion.
- [ADR-0012 — Extensibility is internal for v1.0](./0012-extensibility-is-internal.md) —
  rationale for marking `guessPageType`/`guessProcessTypes`/
  `selectorComponentHint`/`clusterKeyFor` `@internal`.
- `src/lib/wcag-em-summary.mjs` — `toWcagEmSummary` implementation.
- `src/lib/axe-utils.mjs` — `withActAndWcagMetadata` (the SC-tag parser
  the bucket pass leans on) ...
````
