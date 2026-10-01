# Probe record: verify:A04

Role: packet verifier. Findings: PROC-01, PROC-03, PROC-06, PROC-07, PROC-12, PROC-13

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" PROC-01,PROC-03,PROC-06,PROC-07,PROC-12,PROC-13
````

Output (truncated):

````text
[
 {
  "dimension": "PROC",
  "id": "PROC-01",
  "title": "Process axe step classifies a WAF challenge reached by click/submit navigation as 'ok' (stale goto Response) and emits false findings",
  "category": "correctness",
  "severity": "high",
  "status": "tracked-stale",
  "trackedRef": "CLOSED 2026-06: pageOutcome could-not-audit (challenge/empty); ADR-0017 Decision 1 says the process path 'is classified the same way'",
  "claim": "classifyProcessPage reads ctx.lastResponse, which only the `goto` step sets. If a click, press or form submit starts the navigation, the previous goto's 200 response is still in place. That hides the authoritative cf-mitigated header and the challenge status, so the interstitial is axe-scanned as real content.",
  "evidence": [
   {
    "file": "src/lib/proc ...
````

## 2. Bash

````bash
python3 -c "
import json;s=json.load(open('schemas/config.schema.json'))
p=s['properties']['processes'];print(json.dumps(p,indent=1)[:3000])
print(json.dumps(s.get('\$defs',{}).get('action'),indent=1)[:2000])
"; grep -rn "stepTimeoutMs" src | head
````

Output (truncated):

````text
{
 "type": "array",
 "items": {
  "type": "object",
  "additionalProperties": false,
  "required": [
   "name",
   "startUrl"
  ],
  "properties": {
   "name": {
    "type": "string",
    "pattern": "^[a-z0-9-]+$"
   },
   "startUrl": {
    "type": "string",
    "format": "uri"
   },
   "pattern": {
    "oneOf": [
     {
      "enum": [
       "blank-submit",
       "partial-submit"
      ]
     },
     {
      "type": "null"
     }
    ]
   },
   "forceInclude": {
    "type": "boolean"
   },
   "relatedUrls": {
    "type": "array",
    "items": {
     "type": "string",
     "format": "uri"
    }
   },
   "steps": {
    "type": "array",
    "items": {
     "$ref": "#/$defs/action"
    }
   },
   "selectors": {
    "type": "object",
    "additionalProperties": {
     "type": "string"
    }
 ...
````

## 3. Bash

````bash
cd $SCRATCH/review && grep -i "stepTimeout\|urlPattern\|PROC-" round1-index.txt | cut -c1-260
````

Output (truncated):

````text
VERD-18 | low | new | contract | processes[].stepTimeoutMs is documented and schema-valid but ignored; every step uses scan.timeoutMs (observed while probing VERD-06; outside this dimension) | src/lib/process-runner.mjs:155, docs/guides/config-guide.md:228
PROC-01 | high | tracked-stale | correctness | Process axe step classifies a WAF challenge reached by click/submit navigation as 'ok' (stale goto Response) and emits false findings | src/lib/process-runner.mjs:217, src/lib/process-runner.mjs:322, docs/adr/0017
PROC-02 | high | tracked-stale | accuracy-coverage | Process coverage claims come from config: challenge, empty and not-run process states are dropped silently yet listed as evaluated or tested | src/lib/wcag-em-summary.mjs:437, src/lib/wcag-em-summary.mjs:396
PROC-03 | high | new  ...
````

## 4. Bash

````bash
grep -n -i "conformanceTarget\|targetLevel\|withTags\|process" src/lib/wcag-em-summary.mjs | head -40; echo ---; grep -n -i "process" src/lib/group-findings.mjs | head -20
````

Output (truncated):

````text
12: * Input shape is the widened `axe-results.json` and `process-results.json`
23: *     processesEvaluated: string[],
164: * draft of the returned summary. `rawResults = { axeResults, processResults,
171: *   processResults?: any[],
173: * }} rawResults - Bundle of raw axe + process results. Not a draft summary.
178: *   processesEvaluated: string[],
181: *   conformanceTarget: string,
191:  const processResults = Array.isArray(rawResults?.processResults) ? rawResults.processResults : [];
319:  for (const proc of processResults) {
366:  const conformanceTarget = wcagEmConfig.conformanceTarget ?? 'AA';
369:  const targetLevels = new Set(LEVEL_INCLUDES[conformanceTarget] ?? LEVEL_INCLUDES['AA']);
372:    if (coveredScs.has(sc) || !targetLevels.has(level)) continue;
437:    processesEvaluate ...
````

## 5. Bash

````bash
sed -n 176,200p src/lib/group-findings.mjs; sed -n 300,380p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
  for (const processResult of processResults) {
    if (!isAuditableView(processResult)) continue;
    const processUrl = normalizeUrl(processResult.startUrl);
    for (const state of processResult.states || []) {
      // E1: skip degraded/errored states — they reflect a broken process step,
      // not a genuine accessibility finding.
      if (!isAuditableView(state)) continue;
      for (const violation of state.violations || []) {
        for (const node of violation.nodes || []) {
          const target = Array.isArray(node.target) ? node.target.join(' | ') : null;
          addRuleFinding({
            sourceType: `process:${processResult.name}:${state.state}`,
            pageUrl: processUrl,
            sampleKey: processUrl,
            rule: violation,
            target,
      ...
````

## 6. Bash

````bash
grep -n "^export" src/lib/browser.mjs src/lib/process-runner.mjs src/lib/wcag-em-summary.mjs src/lib/group-findings.mjs; grep -n "paths\.\|screenshotsDir" src/lib/context.mjs | head
````

Output (truncated):

````text
src/lib/browser.mjs:81:export function resolveTransport(config = {}, env = {}) {
src/lib/browser.mjs:134:export function browserNeedsLocalBinary(config = {}, env = {}) {
src/lib/browser.mjs:154:export async function acquireBrowserSession(
src/lib/browser.mjs:199:export async function openPageView(session, viewport, authContextOptions) {
src/lib/browser.mjs:247:export async function disposeBrowserSession(session, _logger) {
src/lib/group-findings.mjs:55:export function groupFindings(axeResults, processResults, deps) {
src/lib/wcag-em-summary.mjs:54:export const SC_LEVEL_MAP = /** @type {const} */ ({
src/lib/wcag-em-summary.mjs:188:export function toWcagEmSummary(ctx, rawResults) {
src/lib/process-runner.mjs:42:export const DISPATCH_ACTIONS = Object.freeze([
src/lib/process-runner.mjs:100:ex ...
````

## 7. Bash

````bash
grep -rn "setDefaultTimeout\|setDefaultNavigationTimeout" src | head; grep -n "timeoutMs" schemas/config.schema.json | head; python3 -c "
import json;s=json.load(open('schemas/config.schema.json'));print(json.dumps(s['properties']['scan']['properties']['timeoutMs']))"; grep -rn "timeoutMs" configs/*.json | head
````

Output (truncated):

````text
src/commands/discover.mjs:238:      // requestTimeoutSecs. page.setDefaultTimeout below configures the
src/commands/discover.mjs:248:      page.setDefaultTimeout(config.crawl.requestTimeoutSecs * 1000);
259:        "timeoutMs": {
713:        "timeoutMs": {
{"type": "integer", "minimum": 1000, "maximum": 600000}
configs/example-site-best-practice.json:46:    "timeoutMs": 60000,
configs/example-site-with-auth.json:46:    "timeoutMs": 60000,
configs/example-site-with-processes.json:23:    "timeoutMs": 60000,
configs/example-site-with-processes.json:33:          "timeoutMs": 15000
configs/example-site.json:46:    "timeoutMs": 60000,
configs/legacy-events.json:62:    "timeoutMs": 60000,
````

## 8. Bash

````bash
sed -n 1,80p src/lib/viewports.mjs | grep -n -i "default\|reflow\|320\|desktop" | head -20; sed -n 185,215p bin/wcag-em.mjs; ls configs
````

Output (truncated):

````text
9: * agree on the "defaults ∨ legacy-singleton ∨ user-array" precedence. Future
10: * changes to viewport defaults (e.g. a future version's opt-in tablet / mobile)
17: *   3. `DEFAULT_VIEWPORTS` — desktop + reflow baseline (WCAG 2.1 SC 1.4.10).
20: * @see https://www.w3.org/TR/WCAG21/#reflow
32:// ANCHOR: DEFAULT_VIEWPORTS — desktop + reflow baseline (WCAG 2.1 SC 1.4.10).
36:export const DEFAULT_VIEWPORTS = Object.freeze([
37:  Object.freeze({ id: 'desktop', width: 1280, height: 800 }),
38:  Object.freeze({ id: 'reflow', width: 320, height: 800 }),
47: * rather than loading from disk so they remain valid across DEFAULTS evolution.
61:  //    reachable only from the DEFAULTS-side sentinel (config.mjs ships
62:  //    `scan.viewports: []`) and falls through to DEFAULT_VIEWPORTS.
77:  // 3. D ...
````

## 9. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A04 && cd $SCRATCH/wf2/verify-A04 && ln -sf $REPO/node_modules node_modules && ls -la
````

Output (truncated):

````text
total 0
drwxr-xr-x@  3 $USER  wheel   96 Sep 30 19:49 .
drwxr-xr-x@ 11 $USER  wheel  352 Sep 30 19:49 ..
lrwxr-xr-x@  1 $USER  wheel  113 Sep 30 19:49 node_modules -> $REPO/node_modules
````

## 10. Bash

````bash
sed -n 186,200p src/lib/wcag-em-summary.mjs; grep -n "export function isAuditableView\|export function viewStatus" -A25 src/lib/scan-results.mjs | head -50
````

Output (truncated):

````text
 * }}
 */
export function toWcagEmSummary(ctx, rawResults) {
  const wcagEmConfig = ctx?.config?.wcagEm ?? {};
  const axeResults = Array.isArray(rawResults?.axeResults) ? rawResults.axeResults : [];
  const processResults = Array.isArray(rawResults?.processResults) ? rawResults.processResults : [];
  const sampleMetadata =
    rawResults?.sampleMetadata && typeof rawResults.sampleMetadata === 'object'
      ? rawResults.sampleMetadata
      : {};

  /** @type {string[]} */
  const scanWarnings = [];

  // ANCHOR: SCBucket — per-SC aggregation.
51:export function viewStatus(entry) {
52-  // A thrown navigation/scan failure is recorded as a string `error` on the
53-  // result (scan.mjs failure-path push); that is an execution fault, distinct
54-  // from a could-not-audit page.
55-  if (ty ...
````

## 11. Write `$SCRATCH/wf2/verify-A04/probe.mjs`

````text
// Verification probe for packet A04 (PROC-01/03/06/07/12/13). Read-only w.r.t. repo.
import http from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import fs from 'node:fs/promises';
const REPO = '$REPO';
const { runProcessSteps } = await import(`file://${REPO}/src/lib/process-runner.mjs`);
const { runOneProcess } = await import(`file://${REPO}/src/commands/scan-processes.mjs`);
const { acquireBrowserSession, disposeBrowserSession } = await import(`file://${REPO}/src/lib/browser.mjs`);
const { toWcagEmSummary } = await import(`file://${REPO}/src/lib/wcag-em-summary.mjs`);
const AxeBuilder = (await import(`file://${REPO}/node_modules/@axe-core/playwright/dist/index.mjs`)).default;

const OUT = path.dirname(new URL(import.meta.url).pathname);
const shots = path.join(OUT, 'shots');
await fs.mkdir(shots, { recursive: true });

const counters = { contactPosts: 0, searchGets: 0, newsletterPosts: 0, ajaxPosts: 0 };
const page = (title, body, lang = 'en') =>
  `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head><title>${title}</title></head><body>${body}</body></html>`;
const CHALLENGE = (title) =>
  `<!doctype html><html><head><title>${title}</title></head><body><div>Checking. <img src="/x.png"></div></body></html>`;

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const send = (status, html, headers = {}) => {
    res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers });
    res.end(html);
  };
  const rayHdr = u.searchParams.get('ray') === '1' ? { 'cf-ray': '8abc-LHR' } : {};
  const ctitle = u.searchParams.get('ctitle') ?? 'Just a moment...';
  switch (u.pathname) {
    case '/home':
      return send(200, page('Home', `<main><h1>Home</h1><a id="ev" href="/events/?ray=${u.searchParams.get('ray') ?? '0'}&ctitle=${encodeURIComponent(ctitle)}">Events</a></main>`), rayHdr);
    case '/events/':
      return send(403, CHALLENGE(ctitle), { 'cf-mitigated': 'challenge', ...rayHdr });
    case '/gate':
      // challenge on goto, but contains link to real page (reverse direction)
      return send(403, CHALLENGE('Just a moment...').replace('Checking.', 'Checking. <a id="real" href="/realpage">go</a>'), { 'cf-mitigated': 'challenge' });
    case '/realpage':
      return send(200, page('Real', `<main><h1>Real</h1><img src="/y.png"></main>`));
    case '/widget':
      return send(200, page('Widget', `<main><h1>Widget</h1><p>ok text</p><div class="third-party"><img src="/tp.png"></div><p style="color:#bbb;background:#fff">low contrast</p></main><div>outside landmark</div>`));
    case '/contact':
      return send(200, page('Contact', `<header><form role="search" action="/search" method="get"><label>Search <input name="q"></label><button type="submit">Go</button></form></header><main><h1>Contact</h1><form method="post" action="/contact-post" novalidate><label>Name <input name="name"></label><button id="send" type="submit">Send</button></form></main>`));
    case '/search':
      counters.searchGets++;
      return send(200, page('Search results', `<main><h1>Results</h1><img src="/r.png"></main>`));
    case '/contact-post':
      counters.contactPosts++;
      return send(200, page('Contact', `<main><h1>Contact</h1><p style="color:#c8c8c8">Name is required</p></main>`));
    case '/contact-async': {
      const delay = Number(u.searchParams.get('delay') ?? 0);
      return send(200, page('Contact async', `<main><h1>Contact</h1><form id="f" novalidate><label>Name <input name="name"></label><button id="send" type="submit">Send</button></form><div id="msg"></div></main><script>document.getElementById('f').addEventListener('submit',e=>{e.preventDefault();setTimeout(()=>{document.getElementById('msg').innerHTML='<p style="color:#c8c8c8">Name is required</p>';},${delay});});</script>`));
    }
    case '/contact-ajax':
      // realistic AJAX: fetch round-trip to server (server delay configurable)
      return send(200, page('Contact ajax', `<main><h1>Contact</h1><form id="f" novalidate><label>Name <input name="name"></label><button id="send" type="submit">Send</button></form><div id="msg"></div></main><script>document.getElementById('f').addEventListener('submit',async e=>{e.preventDefault();const r=await fetch('/ajax-validate?d=${u.searchParams.get('d') ?? 60}',{method:'POST'});document.getElementById('msg').innerHTML=await r.text();});</script>`));
    case '/ajax-validate':
      counters.ajaxPosts++;
      await new Promise((r) => setTimeout(r, Number(u.searchParams.get('d') ?? 60)));
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end('<p style="color:#c8c8c8">Name is required</p>');
    case '/late':
      return send(200, page('Late', `<main><h1>Late</h1><div id="status">waiting</div></main><script>setTimeout(()=>{const b=document.createElement('button');b.id='late-btn';b.textContent='Late';b.onclick=()=>{document.getElementById('status').textContent='CLICKED at '+Date.now();const i=document.createElement('img');i.src='/z.png';document.querySelector('main').appendChild(i);};document.querySelector('main').appendChild(b);},3000);</script>`));
    case '/newsletter':
      return send(200, page('News', `<main><h1>News</h1><form method="post" action="/newsletter-post"><label>Email <input name="email" id="email"></label><button type="submit">Join</button></form></main>`));
    case '/newsletter-post':
      counters.newsletterPosts++;
      return send(200, page('News', `<main><h1>Thanks</h1></main>`));
    default:
      res.writeHead(404); return res.end('nf');
  }
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const BASE = `http://127.0.0.1:${server.address().port}`;
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const baseConfig = (extra = {}) => ({
  rootUrl: `${BASE}/`,
  scan: { waitUntil: 'domcontentloaded', timeoutMs: 30000, fullPageScreenshots: false, axe: { include: [], exclude: [], withRules: [], withTags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], runOnly: null }, ...extra },
  reporting: {},
});
const paths = { screenshotsDir: shots };
const vp = { id: 'desktop', width: 1280, height: 800 };
const out = {};
const summarizeState = (s) => ({ state: s.state, pageOutcome: s.pageOutcome ?? 'ok(no field)', degraded: s.degraded ?? false, violations: (s.violations ?? []).map((v) => v.id), error: s.error ? s.error.split('\n')[0] : undefined });

const session = await acquireBrowserSession({ scan: {} }, logger);
try {
  const browser = session.browser;
  async function run(steps, config, processDef = { name: 'p', startUrl: steps[0]?.url }) {
    const ctxB = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const pg = await ctxB.newPage();
    try {
      const states = await runProcessSteps(processDef, steps, { page: pg, config, logger, paths, processDef, viewport: vp });
      return { states: states.map(summarizeState), finalUrl: pg.url(), title: await pg.title(), statusText: await pg.locator('#status').textContent().catch(() => null), raw: states };
    } finally { await ctxB.close(); }
  }

  // ---------- PROC-01 ----------
  const p01 = {};
  for (const [label, q] of [['noCfRay', 'ray=0'], ['cfRayOnAll(CF-proxied)', 'ray=1'], ['cfRay+nonMatchingTitle', `ray=1&ctitle=${encodeURIComponent('Un instant…')}`], ['noCfRay+nonMatchingTitle', `ray=0&ctitle=${encodeURIComponent('Security check')}`]]) {
    const click = await run([{ action: 'goto', url: `${BASE}/home?${q}` }, { action: 'click', selector: '#ev' }, { action: 'waitFor', timeoutMs: 500 }, { action: 'axe', state: 'after-click' }], baseConfig());
    const direct = await run([{ action: 'goto', url: `${BASE}/events/?${q}` }, { action: 'axe', state: 'direct' }], baseConfig());
    p01[label] = { viaClick: { ...click.states.at(-1), finalUrl: click.finalUrl, title: click.title }, viaDirectGoto: direct.states.at(-1) };
  }
  const rev = await run([{ action: 'goto', url: `${BASE}/gate` }, { action: 'click', selector: '#real' }, { action: 'waitFor', timeoutMs: 500 }, { action: 'axe', state: 'after-click' }], baseConfig());
  p01.reverse_challengeThenRealPage = { ...rev.states.at(-1), finalUrl: rev.finalUrl, title: rev.title };
  out['PROC-01'] = p01;

  // ---------- PROC-03 ----------
  const cfg03 = baseConfig({ axe: { include: [], exclude: ['.third-party'], withRules: [], withTags: ['wcag2a'], runOnly: null } });
  const r03 = await run([{ action: 'goto', url: `${BASE}/widget` }, { action: 'axe', state: 'widget-state' }], cfg03, { name: 'widget', startUrl: `${BASE}/widget` });
  // Page-scan-equivalent builder (scan.mjs chain: exclude + withTags)
  const ctxS = await browser.newContext(); const ps = await ctxS.newPage(); await ps.goto(`${BASE}/widget`);
  const scanRes = await new AxeBuilder({ page: ps }).exclude('.third-party').withTags(['wcag2a']).analyze();
  await ctxS.close();
  const proc03 = [{ name: 'widget', startUrl: `${BASE}/widget`, viewport: 'desktop', states: r03.raw }];
  const sum = toWcagEmSummary({ config: { wcagEm: { conformanceTarget: 'A' }, processes: [{ name: 'widget' }] } }, { axeResults: [], processResults: proc03 });
  const pick = (sc) => sum.criteriaOutcomes?.find((c) => c.sc === sc) ?? (sum.criteria ?? []).find?.((c) => c.sc === sc);
  out['PROC-03'] = {
    processStateViolations: r03.states.at(-1).violations,
    scanChainViolations: scanRes.violations.map((v) => v.id),
    summaryKeys: Object.keys(sum),
    sc_1_1_1: pick('1.1.1')?.outcome, sc_1_4_3: pick('1.4.3')?.outcome,
  };

  // ---------- PROC-06 ----------
  const before06 = { ...counters };
  const r06 = await runOneProcess(session, { name: 'contact-blank', startUrl: `${BASE}/contact`, pattern: 'blank-submit' }, { config: baseConfig(), logger, paths }, vp, {});
  out['PROC-06'] = { states: r06.states.map(summarizeState), searchGetsDelta: counters.searchGets - before06.searchGets, contactPostsDelta: counters.contactPosts - before06.contactPosts };
  // control: explicit selectors.submit
  const before06b = { ...counters };
  const r06b = await runOneProcess(session, { name: 'contact-blank2', startUrl: `${BASE}/contact`, pattern: 'blank-submit', selectors: { submit: '#send' } }, { config: baseConfig(), logger, paths }, vp, {});
  out['PROC-06'].control_selectorsSubmit = { states: r06b.states.map(summarizeState), contactPostsDelta: counters.contactPosts - before06b.contactPosts };

  // ---------- PROC-07 ----------
  const p07 = {};
  for (const d of [0, 100, 300, 1000]) {
    const r = await runOneProcess(session, { name: `async-${d}`, startUrl: `${BASE}/contact-async?delay=${d}`, pattern: 'blank-submit', selectors: { submit: '#send' } }, { config: baseConfig(), logger, paths }, vp, {});
    p07[`clientDelay${d}ms`] = r.states.at(-1).violations?.map((v) => v.id);
  }
  for (const d of [20, 60, 200]) {
    const r = await runOneProcess(session, { name: `ajax-${d}`, startUrl: `${BASE}/contact-ajax?d=${d}`, pattern: 'blank-submit', selectors: { submit: '#send' } }, { config: baseConfig(), logger, paths }, vp, {});
    p07[`ajaxServer${d}ms`] = r.states.at(-1).violations?.map((v) => v.id);
  }
  // server round-trip (full-page POST) with the corrected selector
  p07.fullPagePost = out['PROC-06'].control_selectorsSubmit.states.at(-1).violations;
  // async-300 summary verdict for 1.4.3
  const r07 = await runOneProcess(session, { name: 'async-300', startUrl: `${BASE}/contact-async?delay=300`, pattern: 'blank-submit', selectors: { submit: '#send' } }, { config: baseConfig(), logger, paths }, vp, {});
  const s07 = toWcagEmSummary({ config: { wcagEm: {}, processes: [{ name: 'async-300' }] } }, { axeResults: [], processResults: [r07] });
  p07.async300_sc_1_4_3 = s07.criteriaOutcomes?.find((c) => c.sc === '1.4.3')?.outcome;
  out['PROC-07'] = p07;

  // ---------- PROC-12 ----------
  const r12 = await run([{ action: 'goto', url: `${BASE}/late` }, { action: 'click', selector: '#late-btn' }, { action: 'waitFor', timeoutMs: 2500 }, { action: 'axe', state: 'after' }], baseConfig({ timeoutMs: 1500 }));
  out['PROC-12'] = { states: r12.states, statusAfter: r12.statusText };
  // Default budget (60000 > Playwright's 30000 default action timeout): which wins?
  // (skip long run: reason by source; Playwright default action timeout 30s < 60s race)

  // ---------- PROC-13 ----------
  const before13 = { ...counters };
  const vps = [{ id: 'desktop', width: 1280, height: 800 }, { id: 'reflow', width: 320, height: 800 }];
  for (const v of vps) await runOneProcess(session, { name: 'newsletter', startUrl: `${BASE}/newsletter`, pattern: 'partial-submit', fields: [{ selector: '#email', value: 'probe@example.test' }] }, { config: baseConfig(), logger, paths }, v, {});
  out['PROC-13'] = { newsletterPostsFor2Viewports: counters.newsletterPosts - before13.newsletterPosts };
} finally {
  await disposeBrowserSession(session, logger);
  server.close();
}
console.log(JSON.stringify(out, null, 1));

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A04/probe.mjs (file state is current in your context — no need to Read it back)
````

## 12. Bash

````bash
ls $REPO/node_modules/@axe-core/playwright/dist/; grep -n '"exports"' -A12 $REPO/node_modules/@axe-core/playwright/package.json | head -15
````

Output (truncated):

````text
index.d.mts
index.d.ts
index.js
index.mjs
32:  "exports": {
33-    ".": {
34-      "types": "./dist/index.d.ts",
35-      "import": "./dist/index.mjs",
36-      "require": "./dist/index.js"
37-    }
38-  },
39-  "publishConfig": {
40-    "access": "public"
41-  },
42-  "scripts": {
43-    "prebuild": "rimraf dist",
44-    "build": "tsup src/index.ts --dts --format esm,cjs",
````

## 13. Bash

````bash
cd $SCRATCH/wf2/verify-A04 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && CRAWLEE_STORAGE_DIR=$PWD/crawlee-storage node probe.mjs > probe-out.json 2> probe-err.txt; echo exit=$?; cat probe-out.json; tail -20 probe-err.txt
````

Output (truncated):

````text
Command did not complete within its 300s timeout and was moved to the background (ID: b5l31df21). Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 14. Bash

````bash
cd $SCRATCH/wf2/verify-A04 && until [ -s probe-out.json ] || ! pgrep -f "verify-A04/probe.mjs\|node probe.mjs" >/dev/null; do sleep 2; done; echo done; wc -c probe-out.json probe-err.txt
````

Output (truncated):

````text
Command running in background with ID: bvzpjghx0. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 15. Bash

````bash
cd $SCRATCH/wf2/verify-A04 && cat $TMP cat probe-out.json; tail -5 probe-err.txt; pgrep -fl "chrom.*headless" | wc -l
````

Output (truncated):

````text
exit=0
{
 "PROC-01": {
  "noCfRay": {
   "viaClick": {
    "state": "after-click",
    "pageOutcome": "ok(no field)",
    "degraded": false,
    "violations": [
     "html-has-lang",
     "image-alt",
     "landmark-one-main",
     "page-has-heading-one",
     "region"
    ],
    "finalUrl": "http://127.0.0.1:56093/events/?ray=0&ctitle=Just%20a%20moment...",
    "title": "Just a moment..."
   },
   "viaDirectGoto": {
    "state": "direct",
    "pageOutcome": "challenge",
    "degraded": false,
    "violations": []
   }
  },
  "cfRayOnAll(CF-proxied)": {
   "viaClick": {
    "state": "after-click",
    "pageOutcome": "challenge",
    "degraded": false,
    "violations": [],
    "finalUrl": "http://127.0.0.1:56093/events/?ray=1&ctitle=Just%20a%20moment...",
    "title": "Just a moment..."
   ...
````

## 16. Bash

````bash
cd $SCRATCH/wf2/verify-A04 && cat > probe12.mjs <<'EOF'
import http from 'node:http';
import { once } from 'node:events';
const REPO = '$REPO';
const { runProcessSteps } = await import(`file://${REPO}/src/lib/process-runner.mjs`);
const { chromium } = await import(`file://${REPO}/node_modules/playwright/index.mjs`);
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(`<!doctype html><html lang="en"><head><title>Late</title></head><body><main><h1>Late</h1><div id="status">waiting</div></main><script>setTimeout(()=>{const b=document.createElement('button');b.id='late-btn';b.textContent='Late';b.onclick=()=>{document.getElementById('status').textContent='CLICKED';const i=document.createElement('img');i.src='/z.png';document.querySelector('main').appendChild(i);};document.querySelector('main').appendChild(b);},2000);</script></body></html>`);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
const BASE = `http://127.0.0.1:${server.address().port}`;
const logger = { info() {}, warn() {}, error() {}, debug() {} };
const browser = await chromium.launch();
try {
  const out = {};
  for (const budget of [1500, 30000]) {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    const config = { rootUrl: BASE + '/', scan: { waitUntil: 'domcontentloaded', timeoutMs: budget }, reporting: {} };
    const t0 = Date.now();
    const steps = budget === 1500
      ? [{ action: 'goto', url: `${BASE}/late` }, { action: 'click', selector: '#late-btn-typo, #late-btn' }, { action: 'waitFor', timeoutMs: 1000 }, { action: 'axe', state: 'after' }]
      : [{ action: 'goto', url: `${BASE}/late` }, { action: 'click', selector: '#late-btn' }, { action: 'axe', state: 'after' }];
    const states = await runProcessSteps({ name: 'p', startUrl: BASE }, steps, { page, config, logger, paths: { screenshotsDir: '.' }, processDef: { name: 'p', startUrl: BASE }, viewport: { id: 'd' } });
    out[`budget${budget}`] = { ms: Date.now() - t0, states: states.map((s) => ({ state: s.state, degraded: !!s.degraded, violations: (s.violations ?? []).map((v) => v.id), err: s.error?.split('\n')[0] })), status: await page.evaluate(() => document.getElementById('status').textContent) };
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
} finally { await browser.close(); server.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe12.mjs
````

Output (truncated):

````text
{
 "budget1500": {
  "ms": 2808,
  "states": [
   {
    "state": "step-timeout",
    "degraded": false,
    "violations": [],
    "err": "step \"click\" exceeded stepTimeoutMs=1500"
   },
   {
    "state": "after",
    "degraded": true,
    "violations": [
     "image-alt"
    ]
   }
  ],
  "status": "CLICKED"
 },
 "budget30000": {
  "ms": 2610,
  "states": [
   {
    "state": "after",
    "degraded": false,
    "violations": [
     "image-alt"
    ]
   }
  ],
  "status": "CLICKED"
 }
}
````
