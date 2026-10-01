# Probe record: find:STRESS

Role: round-2 finder. Findings: STRESS-01, STRESS-02, STRESS-03, STRESS-04, STRESS-05, STRESS-06, STRESS-07, STRESS-08

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
R=$SCRATCH/review; wc -l $R/round1-index.txt; cut -c1-230 $R/round1-index.txt
````

Output (truncated):

````text
<persisted-output>
Output too large (40.3KB). Full output saved to: $CLAUDE_STATE

Preview (first 2KB):
     184 $SCRATCH/review/round1-index.txt
VERD-01 | high | new | correctness | SC-level 'passed' and 'inapplicable' are taken directly from single axe rule results, with no model of what axe can establish per SC. This gives false passes and false 'not present' verdicts on
VERD-02 | medium | new | docs-drift | Docs and the report-builder draft say only notTested SCs need manual evaluation, which effectively signs off automated passed/inapplicable verdicts | docs/guides/user-manual.md:71, docs/guides
VERD-03 | high | new | correctness | wcagVersion only labels the report; the SC set and the axe tag profile ignore it (a WCAG 2.0 or 2.1 audit gets 2.1/2.2 criteria) | src/lib/wcag-em-summary. ...
````

## 2. Bash

````bash
R=$SCRATCH/review; python3 -c "
import json
d=json.load(open('$R/round1-experiments.json'))
print(type(d), len(d))
items = d if isinstance(d,list) else [x for v in d.values() for x in (v if isinstance(v,list) else [v])]
for e in items:
  if isinstance(e,dict):
    print('-', (e.get('dimension') or e.get('dim') or ''), '|', (e.get('what') or '')[:150], '=>', (e.get('result') or '')[:120].replace('\n',' '))
"
````

Output (truncated):

````text
<class 'list'> 145
- VERD | Probed axe.getRules() for SC tags, experimental/deprecated rules, best-practice+SC overlap, and ACT IDs compared with act-rule-map.json => axe 4.11.3, 104 rules; 0 best-practice rules carry SC tags; default withTags touch 24 SCs, including 2.1.3 (AAA) via scr
- VERD | Full CLI audit against my own localhost fixture with known axe-undetectable defects (lang=fr on English text, alt=filename, 'click here' links, no met => Exit 0. wcag-em-summary: 1.1.1/2.4.2/2.4.4/3.1.1/3.3.2/1.4.12 passed; 1.4.4/1.3.5/2.2.1/2.2.2 inapplicable; 2.1.3 AAA fa
- VERD | Effect of wcagVersion and conformanceTarget on the SC set => 2.0/AA emits 18 non-2.0 SCs (e.g. 2.5.8 passed, 1.4.12 passed); 2.1/AA emits the 6 WCAG 2.2-only SCs; target A emits 7 A
- VERD | ACT map loading from an inst ...
````

## 3. Bash

````bash
R=$SCRATCH/review; grep -inE 'scale|memory|rss|sigint|signal|stale|corrupt|truncat|dialog|alert|shadow|iframe|charset|encoding|attachment|infinite|concurren|sequential|orphan|mixed|contamina|leftover|previous run|out-dir|outdir|screenshot|size|RangeError|stringify|O\(n|quadratic|huge|large|hang|timeout' $R/round1-index.txt | cut -c1-260
````

Output (truncated):

````text
16:VERD-16 | low | new | docs-drift | The synthesized samplingMethodNotes (client-facing) misstates the method: says '% pool' and 'auto-suggested', and leaves out process expansion | src/lib/wcag-em-summary.mjs:490, src/commands/sample.mjs:82
18:VERD-18 | low | new | contract | processes[].stepTimeoutMs is documented and schema-valid but ignored; every step uses scan.timeoutMs (observed while probing VERD-06; outside this dimension) | src/lib/process-runner.mjs:155, docs/guides/config-guide.md:228
23:SAMP-04 | medium | new | correctness | A negative randomSeed passes the schema but corrupts the Fisher–Yates shuffle, so the random sample silently shrinks while metadata overstates it | src/lib/sample-utils.mjs:36, schemas/config.schema.json:205, src/com
24:SAMP-05 | medium | new | methodolog ...
````

## 4. Bash

````bash
W=$REPO; cd $W; ls src src/commands src/lib src/reporters bin; wc -l src/commands/*.mjs src/lib/fs-utils.mjs src/lib/artifacts*.mjs 2>/dev/null; cat test/fixtures/site.json.template
````

Output (truncated):

````text
bin:
wcag-em.mjs

src:
commands
data
index.mjs
lib
reporters
types

src/commands:
discover.mjs
sample.mjs
scan-processes.mjs
scan.mjs
summarize.mjs

src/lib:
args.mjs
auth.mjs
axe-artifact.mjs
axe-utils.mjs
browser-engine.mjs
browser.mjs
config.mjs
context.mjs
engine-check.mjs
fs-utils.mjs
group-findings.mjs
logger.mjs
manual-backlog.mjs
page-guard.mjs
preflight.mjs
process-runner.mjs
sample-utils.mjs
scan-results.mjs
sitemap.mjs
urls.mjs
validate-config.mjs
version.mjs
viewports.mjs
wcag-em-summary.mjs

src/reporters:
_sort.mjs
_template.mjs
earl-jsonld.mjs
html.mjs
index.mjs
json.mjs
junit.mjs
markdown.mjs
portal-export.mjs
report-builder-starter.mjs
(eval):1: no matches found: src/lib/artifacts*.mjs
{
  "name": "e2e-fixture-site",
  "rootUrl": "__BASE_URL__/",
  "scope": {
    "mode": " ...
````

## 5. Bash

````bash
W=$REPO; cd $W; wc -l src/commands/*.mjs src/lib/fs-utils.mjs src/lib/scan-results.mjs src/lib/context.mjs bin/wcag-em.mjs; cat src/lib/fs-utils.mjs | head -120
````

Output (truncated):

````text
     413 src/commands/discover.mjs
     165 src/commands/sample.mjs
     217 src/commands/scan-processes.mjs
     471 src/commands/scan.mjs
     715 src/commands/summarize.mjs
     119 src/lib/fs-utils.mjs
      96 src/lib/scan-results.mjs
     330 src/lib/context.mjs
     231 bin/wcag-em.mjs
    2757 total
// @ts-check
/**
 * @file Thin filesystem helpers used across every pipeline stage.
 * @module lib/fs-utils
 *
 * @description
 * Four small async helpers that hide `node:fs/promises` boilerplate:
 * `ensureDir` (recursive mkdir), `writeJson` (pretty-printed + trailing newline),
 * `writeText` (UTF-8 write), `readJsonMaybe` (read-or-fallback).
 *
 * Every pipeline stage writes artefacts via these helpers so output formatting
 * stays consistent (2-space indent, trailing newline) for sta ...
````

## 6. Bash

````bash
W=$REPO; cd $W; grep -n "readJsonMaybe\|readFile\|JSON.parse" src/commands/*.mjs src/lib/*.mjs src/reporters/*.mjs | grep -v "^\s*\*"
````

Output (truncated):

````text
src/commands/sample.mjs:42:  const inventory = JSON.parse(
src/commands/sample.mjs:43:    await fs.readFile(path.join(paths.inventoryDir, 'inventory.json'), 'utf8'),
src/commands/sample.mjs:46:  const pageClusters = JSON.parse(
src/commands/sample.mjs:47:    await fs.readFile(path.join(paths.inventoryDir, 'page-clusters.json'), 'utf8'),
src/commands/scan.mjs:176:  const sampleUrls = JSON.parse(await fs.readFile(paths.sampleJsonPath, 'utf8'));
src/commands/summarize.mjs:21:import { readJsonMaybe, writeJson, writeText } from '../lib/fs-utils.mjs';
src/commands/summarize.mjs:360:      readJsonMaybe(
src/commands/summarize.mjs:365:      readJsonMaybe(
src/commands/summarize.mjs:370:      readJsonMaybe(
src/commands/summarize.mjs:375:      readJsonMaybe(
src/commands/summarize.mjs:380:      rea ...
````

## 7. Bash

````bash
W=$REPO; cd $W; sed -n 330,470p src/commands/summarize.mjs
````

Output (truncated):

````text
  return { executionHealth, warnings };
}

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ exitCode: number, summary: any }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;

  // ANCHOR: MarkdownReportDeprecated — DEFAULTS no longer inject
  // `reporting.markdownReport`, so the only way this field is truthy post-
  // merge is if the user explicitly set it in their config. Fire once per
  // run; the field is silently ignored either way (it never gated anything
  // at runtime).
  if (config.reporting?.markdownReport !== undefined) {
    warnLegacyAliasResolved(logger, {
      oldField: 'reporting.markdownReport',
      newField: 'reporting.reporters',
      guidance:
   ...
````

## 8. Bash

````bash
W=$REPO; cd $W; grep -n "SIGINT\|SIGTERM\|process.on\|dialog\|beforeunload\|process.exit\|exitCode" bin/wcag-em.mjs src/commands/*.mjs src/lib/*.mjs | head -40; echo ---; grep -n "waitUntil\|screenshot\|for (const\|browser.close\|newContext\|newPage\|writeJson" src/commands/scan.mjs | head -60
````

Output (truncated):

````text
bin/wcag-em.mjs:23:// NOTE: process.exit is intentional here — we must abort before any
bin/wcag-em.mjs:34:  // eslint-disable-next-line n/no-process-exit
bin/wcag-em.mjs:35:  process.exit(1);
bin/wcag-em.mjs:95:      const exitCode = await fn(cmd);
bin/wcag-em.mjs:96:      if (typeof exitCode === 'number') process.exitCode = exitCode;
bin/wcag-em.mjs:116:      process.exitCode = 1;
bin/wcag-em.mjs:186:      if (result && typeof result.exitCode === 'number') return result.exitCode;
bin/wcag-em.mjs:197:      let exitCode = 0;
bin/wcag-em.mjs:203:        if (result && typeof result.exitCode === 'number' && result.exitCode > exitCode) {
bin/wcag-em.mjs:204:          exitCode = result.exitCode;
bin/wcag-em.mjs:207:      return exitCode;
bin/wcag-em.mjs:211:// SECTION: Lifecycle — SIGINT / unha ...
````

## 9. Bash

````bash
W=$REPO; cd $W; sed -n 160,232p src/commands/scan.mjs; echo ----; sed -n 395,471p src/commands/scan.mjs; echo ---; sed -n 205,231p bin/wcag-em.mjs
````

Output (truncated):

````text
    title,
    bodyText,
    url: page.url(),
    challengeHosts,
  });
}

// SECTION: Public API

/**
 * @param {import('../lib/context.mjs').RunContext} ctx
 * @returns {Promise<{ pagesScanned: number, pagesFailed: number }>}
 */
export async function run(ctx) {
  await ensurePreflight(ctx);
  const { config, logger, paths } = ctx;
  const sampleUrls = JSON.parse(await fs.readFile(paths.sampleJsonPath, 'utf8'));

  // ANCHOR: PreScanActionsReady — beforeScan.actions[] and override.actions[]
  // are executed per-URL (URL-matching via compiled action.regex).
  // The companion `reporting.reporters` warn in summarize.mjs was retired
  // when the reporter pipeline shipped; only `auth.setupScript`
  // still uses warnSchemaAcceptedRuntimeIgnored today.

  const viewports = resolveViewports( ...
````

## 10. Bash

````bash
W=$REPO; cd $W; sed -n 1,60p test/fixtures/server.mjs | head -80; grep -n "viewports\|reflow" src/lib/viewports.mjs | head; grep -n "\"default\"" schemas/config.schema.json | head -50
````

Output (truncated):

````text
// @ts-check
/**
 * @file HTTP fixture server for e2e + integration tests.
 * @module test/fixtures/server
 *
 * @description
 * Generalises the `createServer`/`listen(0)`/`once(server,'listening')`
 * pattern that `test/unit/sitemap.test.mjs` has used since the config validation overhaul into a
 * reusable harness for reporter smoke tests, reporter XSS tests, the
 * discover-timeout behavioural test, and the authenticated-scan
 * integration test.
 *
 * Each call to `startFixtureServer` returns a distinct instance with no
 * shared state; ephemeral `listen(0)` ports mean parallel `node --test`
 * runs never collide. The caller is responsible for `await stop()`.
 *
 * @see docs/adr/0008-pluggable-reporters.md (reporter pipeline test-infrastructure notes)
 */

// SECTION: Imports
import { c ...
````

## 11. Bash

````bash
W=$REPO; cd $W; grep -n "waitUntil\|gotoOptions\|navigationTimeout\|requestHandlerTimeout\|maxConcurrency\|preNavigationHooks\|postNavigationHooks\|failedRequestHandler\|dialog\|launchContext\|headless" src/commands/discover.mjs | head -30; grep -n "waitUntil\|timeoutMs\|retries\|maxPages\|maxConcurrency\|fullPageScreenshots" src/lib/config.mjs | head
````

Output (truncated):

````text
42: * Build a Crawlee-compatible `preNavigationHooks` entry that sleeps for
110: * @param {unknown} error - The error Crawlee passed to failedRequestHandler.
229:    maxConcurrency: config.crawl.maxConcurrency,
230:    requestHandlerTimeoutSecs: config.crawl.requestTimeoutSecs,
231:    navigationTimeoutSecs: config.crawl.navigationTimeoutSecs,
234:    preNavigationHooks: [buildRequestDelayHook(config.crawl.requestDelayMs)],
237:      // NOTE: Crawlee's requestHandlerTimeoutSecs caps the whole handler at
312:    failedRequestHandler({ request, error }) {
64:    maxPages: 80,
65:    maxConcurrency: 5,
106:    waitUntil: 'domcontentloaded',
107:    timeoutMs: 60000,
108:    retries: 1,
109:    fullPageScreenshots: true,
````

## 12. Bash

````bash
W=$REPO; cd $W; sed -n 200,330p src/commands/discover.mjs; sed -n 55,80p src/lib/config.mjs
````

Output (truncated):

````text
  }
  const seeds = [normalizeUrl(config.rootUrl)];

  // ANCHOR: SitemapSeeding — optional uplift when the site advertises a sitemap.
  // Filters early-exit per check (mirrors the per-filter return-false pattern in
  // transformRequestFunction below) so the extension-skip counter only fires for
  // URLs that would otherwise have been seeded — out-of-scope and pattern-excluded
  // URLs are silently dropped (matches existing sitemap-loop behaviour, which
  // tracks neither in telemetry).
  const sitemapResult = await getSitemapSeeds(
    config.rootUrl,
    config.crawl.sitemapSeeding,
    config.scope,
  );
  for (const url of sitemapResult.seeds) {
    if (!urlAllowedByScope(url, config.rootUrl, config.scope)) continue;
    const seedDocType = documentTypeOf(url);
    if (seedDocType ...
````

## 13. Bash

````bash
W=$REPO; cd $W/node_modules; grep -n "gotoOptions\|waitUntil" @crawlee/playwright/internals/playwright-crawler.js @crawlee/browser/internals/browser-crawler.js @crawlee/playwright/internals/utils/playwright-utils.js 2>/dev/null | head -20; grep -n "maxRequestRetries\s*[:=]" @crawlee/basic/internals/basic-crawler.js | head -5; cat @crawlee/playwright/package.json | grep '"version"'
````

Output (truncated):

````text
@crawlee/playwright/internals/playwright-crawler.js:122:    async _navigationHandler(crawlingContext, gotoOptions) {
@crawlee/playwright/internals/playwright-crawler.js:123:        return (0, playwright_utils_1.gotoExtended)(crawlingContext.page, crawlingContext.request, gotoOptions);
@crawlee/browser/internals/browser-crawler.js:326:        const gotoOptions = { timeout: this.navigationTimeoutMillis };
@crawlee/browser/internals/browser-crawler.js:329:        await this._executeHooks(this.preNavigationHooks, crawlingContext, gotoOptions);
@crawlee/browser/internals/browser-crawler.js:334:            crawlingContext.response = (await this._navigationHandler(crawlingContext, gotoOptions)) ?? undefined;
@crawlee/browser/internals/browser-crawler.js:344:        await this._executeHooks(this.p ...
````

## 14. Bash

````bash
W=$REPO; cd $W; sed -n 38,70p src/commands/discover.mjs; grep -rn "waitUntil" docs/guides/config-guide.md | head -5; grep -rn "navigationTimeoutSecs" docs/guides/*.md schemas/config.schema.json | head -5
````

Output (truncated):

````text
// SECTION: Pure helpers (exported for testability)

/**
 * Build a Crawlee-compatible `preNavigationHooks` entry that sleeps for
 * `requestDelayMs` before each navigation. Extracted as a pure async
 * function so tests exercise the timing contract without spinning up
 * Crawlee + Playwright.
 *
 * Treats any non-positive, NaN, or missing value as 0 (no delay) — this
 * matches the DEFAULTS and keeps bad configs inert rather than crashing.
 *
 * @param {number | undefined} requestDelayMs
 * @returns {() => Promise<void>}
 */
export function buildRequestDelayHook(requestDelayMs) {
  const ms = Number(requestDelayMs);
  return async () => {
    if (Number.isFinite(ms) && ms > 0) {
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  };
}

/**
 * Capture per-page discovery  ...
````

## 15. Bash

````bash
R=$SCRATCH/review; grep -o "[^.]*\(load event\|waitUntil\|'load'\|gotoOptions\|dialog\|alert(\|closed shadow\|mode: 'closed'\|charset\|SIGINT\|SIGTERM\|stale\|previous run\|run id\|runId\)[^.]*\." $R/round1-findings.json | sort -u | head -40
````

Output (truncated):

````text
  "claim": "Discovery only enqueues `a[href]` present when Crawlee's goto resolves (Playwright's default 'load').
  "claim": "The default waitUntil is domcontentloaded, which does not wait for iframes, and axe runs with no settle step.
  "impact": "The safety gate built to stop an invalid upload leaves a stale but valid-looking file for the operator to upload, and CI can't tell 'findings' from 'findings and the export failed'.
  "recommendation": "Default to waitUntil 'load' plus a bounded DOM-quiet settle before axe.
  "verification": "p13: the config guide's exact recipe (waitUntil 'networkidle' plus beforeScan waitFor '[data-hydrated]') on a page that hydrates 1.
  "verification": "probe-stale-response.
 A stale exported env var from an earlier engagement would go unnoticed.
 ADR-0005 s ...
````

## 16. Bash

````bash
W=$REPO; cd $W; grep -n -i "envelope\|strict loader\|reports-dir\|reports dir\|stale\|runId\|run id\|concurren\|parallel\|sigint\|scale\|memory" TODO.md | head -30
````

Output (truncated):

````text
75:- [x] Re-point the stale roadmap reference in auto-memory (done 2026-06-10
95:      (uninitialized memory disclosure, GHSA-58qx-3vcg-4xpx); `npm audit fix`
121:      `--out-dir` — concurrent/sequential runs from one shell cross-contaminate
204:- [ ] Artifact envelope (Sprint 2): runId + timestamps + engine versions +
205:      config hash on every stage output; strict loader; reports-dir clean
````

## 17. Bash

````bash
W=$REPO; cd $W; sed -n 112,128p TODO.md; sed -n 198,215p TODO.md
````

Output (truncated):

````text
      `min(1)`, and `notTested` absent from the consumer outcome enum. Add the
      commissioned `report-builder-starter` reporter emitting DraftReportSchema
      directly (site-derived ID prefix, synthesized sampling notes, screenshots
      as evidence), with a versioned vendored contract. Review C4. -> Sprint 1 T6.
- [x] **`waitFor` ignores its selector.** process-runner.mjs:213-215 sleeps
      `timeoutMs ?? 500` and never polls `step.selector`; README's SPA guidance
      documents polling that does not exist. Review C5 (probe-confirmed).
      -> Sprint 1 T1.
- [x] **`sample.json` resolves against CWD** (context.mjs:232), ignoring
      `--out-dir` — concurrent/sequential runs from one shell cross-contaminate
      (demonstrated during the review). Move under outDir. -> Sprint 1 T4 ...
````

## 18. Bash

````bash
S=$SCRATCH/wf2/stress; mkdir -p $S; ls $S; ps -A -o pid,rss,command | grep -ci "chrom" ; uptime
````

Output (truncated):

````text
71
19:33  up 1 day,  1:28, 1 user, load averages: 14.75 18.53 31.90
````

## 19. Write `$SCRATCH/wf2/stress/server.mjs`

````text
// Stress fixture: ~410-page site on port A + cross-origin port B.
// Writes ports.json next to itself; logs request counts to requests.log on SIGTERM.
import { createServer } from 'node:http';
import { once } from 'node:events';
import fs from 'node:fs';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const hits = new Map();
const hung = [];
let A = '';
let B = '';

const layout = (title, body, { lang = 'en', head = '' } = {}) =>
  `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><title>${title}</title>${head}</head>` +
  `<body><header><nav><a href="/">Home</a> <a href="/news/">News</a> <a href="/services/">Services</a> <a href="/events/">Events</a> <a href="/big/">Big</a> <a href="/bad/">Bad</a> <a href="/hostile/">Hostile</a></nav></header>` +
  `<main><h1>${title}</h1>${body}</main><footer><p>Footer text</p></footer></body></html>`;

const send = (res, html, type = 'text/html; charset=utf-8', extra = {}) => {
  res.writeHead(200, { 'content-type': type, ...extra });
  res.end(html);
};

const links = (prefix, from, to) =>
  '<ul>' +
  Array.from({ length: to - from + 1 }, (_, i) => `<li><a href="${prefix}${from + i}">${prefix}${from + i}</a></li>`).join('') +
  '</ul>';

function bigDom(n) {
  // ~20k elements: 4000 rows x 5 cells; every 10th row has low-contrast text
  let rows = '';
  for (let r = 0; r < 4000; r++) {
    const style = r % 10 === 0 ? ' style="color:#bbb;background:#fff"' : '';
    rows += `<tr><td${style}>r${r}c1</td><td>r${r}c2</td><td>r${r}c3</td><td>r${r}c4</td></tr>`;
  }
  return `<table><caption>Big table ${n}</caption><tbody>${rows}</tbody></table>`;
}

function badPage(n) {
  let s = '<p style="color:#aaa;background:#fff">Low contrast paragraph</p>';
  for (let i = 0; i < 40; i++) s += `<img src="/img/${n}-${i}.png">`;
  for (let i = 0; i < 20; i++) s += `<input type="text" name="f${i}">`;
  for (let i = 0; i < 20; i++) s += `<a href="/bad/${n}#x${i}"></a>`;
  for (let i = 0; i < 10; i++) s += `<button></button>`;
  return s;
}

const hostileIndex = [
  'hang-img', 'hang-font', 'hang-defer', 'alert', 'confirm', 'beforeunload', 'infinite',
  'closed-shadow', 'open-shadow', 'xorigin', 'download', 'latin1', 'sjis', 'nocharset-latin1',
];

function routeA(req, res) {
  const u = new URL(req.url, A);
  const p = u.pathname;
  hits.set(p, (hits.get(p) ?? 0) + 1);

  if (p === '/never' || p === '/never-font.woff2' || p === '/never.js') {
    hung.push(res); // never respond
    return;
  }
  if (p.startsWith('/img/')) {
    res.writeHead(200, { 'content-type': 'image/gif' });
    return res.end(Buffer.from('R0lGODlhAQABAAAAACw=', 'base64'));
  }
  if (p === '/sitemap.xml' || p === '/sitemap_index.xml') {
    res.writeHead(404);
    return res.end();
  }
  if (p === '/') {
    return send(res, layout('Home', '<p>Welcome to the stress site.</p><a href="/forms/contact">Contact</a>'));
  }
  if (p === '/news/') return send(res, layout('News', links('/news/page/', 1, 10)));
  let m;
  if ((m = p.match(/^\/news\/page\/(\d+)$/))) {
    const k = Number(m[1]);
    return send(res, layout(`News page ${k}`, links('/news/post-', (k - 1) * 20 + 1, k * 20)));
  }
  if ((m = p.match(/^\/news\/post-(\d+)$/))) {
    return send(res, layout(`Post ${m[1]}`, `<p>Article body ${m[1]}.</p><img src="/img/p${m[1]}.png" alt="Photo">`));
  }
  if (p === '/services/') return send(res, layout('Services', links('/services/svc-', 1, 100)));
  if ((m = p.match(/^\/services\/svc-(\d+)$/))) {
    return send(res, layout(`Service ${m[1]}`, `<p>Service body.</p><form><label>Email <input type="email"></label><button>Go</button></form>`));
  }
  if (p === '/events/') return send(res, layout('Events', links('/events/ev-', 1, 60)));
  if ((m = p.match(/^\/events\/ev-(\d+)$/))) {
    return send(res, layout(`Event ${m[1]}`, `<p>Event body.</p><p style="color:#999">Faint date</p>`));
  }
  if (p === '/big/') return send(res, layout('Big', links('/big/', 1, 5)));
  if ((m = p.match(/^\/big\/(\d+)$/))) return send(res, layout(`Big ${m[1]}`, bigDom(m[1])));
  if (p === '/bad/') return send(res, layout('Bad', links('/bad/', 1, 20)));
  if ((m = p.match(/^\/bad\/(\d+)$/))) return send(res, layout(`Bad ${m[1]}`, badPage(m[1])));
  if (p === '/forms/contact') {
    return send(res, layout('Contact', '<form method="post"><input name="q"><button>Send</button></form>'));
  }
  if (p === '/hostile/') {
    return send(res, layout('Hostile', '<ul>' + hostileIndex.map((h) => `<li><a href="/hostile/${h}">${h}</a></li>`).join('') + '</ul>'));
  }
  switch (p) {
    case '/hostile/hang-img':
      return send(res, layout('Hang img', '<p>Tracking pixel never finishes.</p><img src="/never" alt="">'));
    case '/hostile/hang-font':
      return send(
        res,
        layout('Hang font', '<p class="f">Web font never finishes.</p><img src="/img/x.png">', {
          head: '<style>@font-face{font-family:Hang;src:url(/never-font.woff2) format("woff2")} .f{font-family:Hang,sans-serif}</style>',
        }),
      );
    case '/hostile/hang-defer':
      return send(res, layout('Hang defer', '<p>Deferred script never finishes.</p>', { head: '<script defer src="/never.js"></script>' }));
    case '/hostile/alert':
      return send(res, layout('Alert', '<p>Alert on load.</p><img src="/img/a.png">', { head: '<script>alert("hello from alert")</script>' }));
    case '/hostile/confirm':
      return send(
        res,
        layout('Confirm', '<p id="c">Confirm on load.</p>', {
          head: '<script>window.addEventListener("DOMContentLoaded",()=>{ if(!confirm("Stay?")) { document.getElementById("c").insertAdjacentHTML("afterend","<img src=/img/declined.png>"); } })</script>',
        }),
      );
    case '/hostile/beforeunload':
      return send(
        res,
        layout('Beforeunload', '<p>Beforeunload handler.</p><img src="/img/b.png">', {
          head: '<script>window.addEventListener("beforeunload",(e)=>{e.preventDefault();e.returnValue="leave?";return "leave?";})</script>',
        }),
      );
    case '/hostile/infinite':
      return send(
        res,
        layout(
          'Infinite',
          '<div id="feed"></div><div id="sentinel">loading</div><script>let n=0;const feed=document.getElementById("feed");function more(){for(let i=0;i<20;i++){n++;const d=document.createElement("div");d.style.height="200px";d.innerHTML="<p>Item "+n+"</p><img src=/img/inf"+n+".png>";feed.appendChild(d);} window.__items=n;}more();new IntersectionObserver((es)=>{if(es.some(e=>e.isIntersecting))more();}).observe(document.getElementById("sentinel"));</script>',
        ),
      );
    case '/hostile/closed-shadow':
      return send(
        res,
        layout(
          'Closed shadow',
          '<p>Widget below is a closed shadow root.</p><x-widget></x-widget><script>customElements.define("x-widget",class extends HTMLElement{constructor(){super();const r=this.attachShadow({mode:"closed"});r.innerHTML="<img src=/img/cs.png><button></button><input type=text><p style=\\"color:#ccc\\">faint</p>";}})</script>',
        ),
      );
    case '/hostile/open-shadow':
      return send(
        res,
        layout(
          'Open shadow',
          '<p>Widget below is an open shadow root.</p><x-open></x-open><script>customElements.define("x-open",class extends HTMLElement{constructor(){super();const r=this.attachShadow({mode:"open"});r.innerHTML="<img src=/img/os.png><button></button><input type=text><p style=\\"color:#ccc\\">faint</p>";}})</script>',
        ),
      );
    case '/hostile/xorigin':
      return send(res, layout('Xorigin', `<p>Cross-origin frame.</p><iframe title="embed" src="${B}/embed"></iframe>`));
    case '/hostile/download':
      return send(res, layout('Download link', '<p><a href="/hostile/export">Export</a></p>'));
    case '/hostile/export':
      return send(res, layout('Export', '<p>This is an attachment</p><img src="/img/e.png">'), 'text/html; charset=utf-8', {
        'content-disposition': 'attachment; filename="export.html"',
      });
    case '/hostile/latin1': {
      const html = layout('Café crème – £ pricing', '<p>Résumé naïve ’quote’</p><img src="/img/l.png">').replace('<meta charset="utf-8">', '');
      res.writeHead(200, { 'content-type': 'text/html; charset=windows-1252' });
      // encode as windows-1252 (latin1 + a couple of cp1252 specials)
      const buf = Buffer.from(
        [...html].map((ch) => {
          const c = ch.codePointAt(0);
          if (c === 0x2013) return 0x96;
          if (c === 0x2019) return 0x92;
          return c < 256 ? c : 0x3f;
        }),
      );
      return res.end(buf);
    }
    case '/hostile/nocharset-latin1': {
      const html = layout('Naïve café no charset', '<p>éèê</p><img src="/img/n.png">').replace('<meta charset="utf-8">', '');
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(Buffer.from(html, 'latin1'));
    }
    case '/hostile/sjis': {
      // "日本語" in Shift_JIS = 93 FA 96 7B 8C EA
      const pre = Buffer.from('<!doctype html><html lang="ja"><head><meta charset="shift_jis"><title>', 'ascii');
      const jp = Buffer.from([0x93, 0xfa, 0x96, 0x7b, 0x8c, 0xea]);
      const post = Buffer.from('</title></head><body><main><h1>SJIS</h1><p>text</p><img src="/img/j.png"></main></body></html>', 'ascii');
      res.writeHead(200, { 'content-type': 'text/html; charset=shift_jis' });
      return res.end(Buffer.concat([pre, jp, post]));
    }
  }
  res.writeHead(404, { 'content-type': 'text/html' });
  res.end(layout('Not found', '<p>404</p>'));
}

function routeB(req, res) {
  const u = new URL(req.url, B);
  hits.set('B:' + u.pathname, (hits.get('B:' + u.pathname) ?? 0) + 1);
  if (u.pathname === '/embed') {
    return send(res, '<!doctype html><html><head><title>embed</title></head><body><img src="/x.png"><button></button><p style="color:#ddd">faint</p></body></html>');
  }
  res.writeHead(404);
  res.end();
}

const sa = createServer(routeA);
const sb = createServer(routeB);
sa.listen(0, '127.0.0.1');
sb.listen(0, '127.0.0.1');
await Promise.all([once(sa, 'listening'), once(sb, 'listening')]);
A = `http://127.0.0.1:${sa.address().port}`;
B = `http://127.0.0.1:${sb.address().port}`;
fs.writeFileSync(path.join(HERE, 'ports.json'), JSON.stringify({ A, B, pid: process.pid }));
console.log(JSON.stringify({ A, B }));
const dump = () => {
  fs.writeFileSync(path.join(HERE, 'requests.json'), JSON.stringify(Object.fromEntries([...hits].sort()), null, 1));
};
setInterval(dump, 2000).unref();
process.on('SIGTERM', () => {
  dump();
  for (const r of hung) r.destroy();
  sa.close();
  sb.close();
  process.exit(0);
});

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/stress/server.mjs (file state is current in your context — no need to Read it back)
````

## 20. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S && (nohup node server.mjs > server.out 2>&1 &) ; sleep 1; cat $S/ports.json; A=$(python3 -c "import json;print(json.load(open('$S/ports.json'))['A'])"); curl -s -o /dev/null -w "%{http_code} %{size_download}\n" $A/big/1; curl -s -D - -o /dev/null $A/hostile/export | head -4; curl -s $A/hostile/latin1 | head -c 200 | xxd | head -5
````

Output (truncated):

````text
{"A":"http://127.0.0.1:54786","B":"http://127.0.0.1:54787","pid":14520}200 302006
HTTP/1.1 200 OK
content-type: text/html; charset=utf-8
content-disposition: attachment; filename="export.html"
Date: Wed, 30 Sep 2026 18:34:36 GMT
00000000: 3c21 646f 6374 7970 6520 6874 6d6c 3e3c  <!doctype html><
00000010: 6874 6d6c 206c 616e 673d 2265 6e22 3e3c  html lang="en"><
00000020: 6865 6164 3e3c 7469 746c 653e 4361 66e9  head><title>Caf.
00000030: 2063 72e8 6d65 2096 20a3 2070 7269 6369   cr.me . . prici
00000040: 6e67 3c2f 7469 746c 653e 3c2f 6865 6164  ng</title></head
````

## 21. Bash

````bash
W=$REPO; cd $W; grep -n "^\s*'\?[a-z-]*'\?:\|register\|name:" src/reporters/index.mjs | head -20; grep -n "\"reporters\"" -A 12 schemas/config.schema.json | grep enum -A 10 | head -12
````

Output (truncated):

````text
9: * is — so third-party callers cannot register custom reporters at runtime.
117:      results.push({ name: n, path: out.path, bytes: out.bytes });
120:        name: n,
121:        error: err instanceof Error ? err : new Error(String(err)),
129: * Read-only view of the registered reporter names. Exported only so tests
532-            "enum": [
533-              "json",
534-              "markdown",
535-              "html",
536-              "earl-jsonld",
537-              "junit",
538-              "portal-export",
539-              "report-builder-starter"
540-            ]
541-          },
````

## 22. Bash

````bash
S=$SCRATCH/wf2/stress; cat > $S/mkcfg.py <<'EOF'
import json,sys
S=sys.argv[1]; out=sys.argv[2]
p=json.load(open(S+'/ports.json')); A=p['A']
hostile=['hang-img','hang-font','hang-defer','alert','confirm','beforeunload','infinite','closed-shadow','open-shadow','xorigin','export','latin1','sjis','nocharset-latin1']
sm=[A+'/',A+'/forms/contact',A+'/big/1',A+'/big/2',A+'/bad/1',A+'/bad/2',A+'/bad/3',A+'/news/post-1',A+'/services/svc-1',A+'/events/ev-1']+[A+'/hostile/'+h for h in hostile]
cfg={
 "name":"stress-site","rootUrl":A+"/",
 "scope":{"mode":"same-origin","allowedHosts":[]},
 "crawl":{"maxPages":450,"maxConcurrency":5,"requestTimeoutSecs":30,"navigationTimeoutSecs":15,"requestDelayMs":0,
   "excludeUrlPatterns":[],"sitemapSeeding":{"enabled":True,"urls":[],"commonPaths":["/sitemap.xml"],"maxUrls":50}},
 "discovery":{"captureH1":True,"captureCanonical":True,"captureForms":True,"captureLandmarks":True,"captureSearchInputs":True},
 "sample":{"structuredManual":sm,"autoSuggest":{"enabled":True,"perCluster":1,"preferTypes":["homepage","form-or-contact","policy","content"]},
   "randomPercentOfStructured":0.1,"minRandomPages":1,"randomSeed":42,"smallSiteSupplementaryScanThreshold":0},
 "scan":{"waitUntil":"domcontentloaded","timeoutMs":30000,"retries":1,"fullPageScreenshots":True,
   "axe":{"include":[],"exclude":[],"withRules":[],"withTags":["wcag2a","wcag2aa","wcag21a","wcag21aa","wcag22aa"],"runOnly":None}},
 "processes":[],
 "reporting":{"groupBestPracticeSeparately":True,"reporters":["json","markdown","html","earl-jsonld","junit","portal-export","report-builder-starter"],
   "failOnFindings":{"impacts":["critical","serious"],"classifications":[],"threshold":1}}
}
json.dump(cfg,open(out,'w'),indent=1)
print(len(sm),'structuredManual')
EOF
python3 $S/mkcfg.py $S $S/cfg-scale.json
cat > $S/runstage.mjs <<'EOF'
// usage: node runstage.mjs <label> <outdir> <cfg> <stage> [killAfterMs] [signal]
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
const [label, outDir, cfg, stage, killAfterMs, sig] = process.argv.slice(2);
const W = '$REPO';
const env = { ...process.env, CRAWLEE_STORAGE_DIR: outDir + '/crawlee-storage' };
const t0 = Date.now();
const child = spawn('/usr/bin/time', ['-l', process.execPath, W + '/bin/wcag-em.mjs', stage, '--config', cfg, '--out-dir', outDir], { env, cwd: outDir, stdio: ['ignore', 'pipe', 'pipe'] });
const outF = fs.createWriteStream(`${outDir}/${label}.stdout`); const errF = fs.createWriteStream(`${outDir}/${label}.stderr`);
child.stdout.pipe(outF); child.stderr.pipe(errF);
let peakTree = 0, peakChrome = 0, nodePid = null;
function tree() {
  const rows = execFileSync('ps', ['-A', '-o', 'pid=,ppid=,rss=,comm='], { encoding: 'utf8' }).trim().split('\n').map((l) => l.trim().split(/\s+/));
  const kids = new Map();
  for (const [pid, ppid] of rows) { if (!kids.has(ppid)) kids.set(ppid, []); kids.get(ppid).push(pid); }
  const info = new Map(rows.map(([pid, , rss, ...c]) => [pid, { rss: Number(rss), comm: c.join(' ') }]));
  const all = []; const st = [String(child.pid)];
  while (st.length) { const p = st.pop(); all.push(p); for (const k of kids.get(p) ?? []) st.push(k); }
  return all.map((p) => ({ pid: p, ...info.get(p) }));
}
const iv = setInterval(() => {
  try { const t = tree(); const rss = t.reduce((a, x) => a + (x.rss || 0), 0); peakTree = Math.max(peakTree, rss);
    peakChrome = Math.max(peakChrome, t.filter((x) => /chrom/i.test(x.comm || '')).length);
    nodePid ??= t.find((x) => /node/.test(x.comm || ''))?.pid; } catch {}
}, 500);
if (killAfterMs) setTimeout(() => {
  const t = tree(); const n = t.find((x) => /node/.test(x.comm || ''));
  fs.writeFileSync(`${outDir}/${label}.prekill-tree.json`, JSON.stringify(t, null, 1));
  process.kill(Number(n.pid), sig || 'SIGINT');
}, Number(killAfterMs));
child.on('exit', (code, signal) => {
  clearInterval(iv);
  setTimeout(() => {
    const err = fs.readFileSync(`${outDir}/${label}.stderr`, 'utf8');
    const maxrss = (err.match(/(\d+)\s+maximum resident set size/) || [])[1];
    const res = { label, stage, code, signal, wallSec: (Date.now() - t0) / 1000, peakTreeRssMB: Math.round(peakTree / 1024), peakChromeProcs: peakChrome, timeMaxRssMB: maxrss ? Math.round(Number(maxrss) / 1048576) : null, nodePid };
    fs.appendFileSync(`${outDir}/stages.jsonl`, JSON.stringify(res) + '\n');
    console.log(JSON.stringify(res));
  }, 300);
});
EOF
echo ok
````

Output (truncated):

````text
24 structuredManual
ok
````

## 23. Bash

````bash
S=$SCRATCH/wf2/stress; mkdir -p $S/run1; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run1 && node $S/runstage.mjs discover $S/run1 $S/cfg-scale.json discover 2>&1 | tail -3
````

Output (truncated):

````text
{"label":"discover","stage":"discover","code":0,"signal":null,"wallSec":3.392,"peakTreeRssMB":548,"peakChromeProcs":5,"timeMaxRssMB":212,"nodePid":"17643"}
````

## 24. Bash

````bash
S=$SCRATCH/wf2/stress; ls -la $S/run1 $S/run1/* | head -40; tail -c 3000 $S/run1/discover.stderr
````

Output (truncated):

````text
-rw-r--r--@ 1 $USER  wheel  1166 Sep 30 19:35 $SCRATCH/wf2/stress/run1/discover.stderr
-rw-r--r--@ 1 $USER  wheel   674 Sep 30 19:35 $SCRATCH/wf2/stress/run1/discover.stdout
-rw-r--r--@ 1 $USER  wheel   156 Sep 30 19:35 $SCRATCH/wf2/stress/run1/stages.jsonl

$SCRATCH/wf2/stress/run1:
total 24
drwxr-xr-x@ 10 $USER  wheel   320 Sep 30 19:35 .
drwxr-xr-x@ 10 $USER  wheel   320 Sep 30 19:35 ..
drwxr-xr-x@  4 $USER  wheel   128 Sep 30 19:35 crawlee-storage
-rw-r--r--@  1 $USER  wheel  1166 Sep 30 19:35 discover.stderr
-rw-r--r--@  1 $USER  wheel   674 Sep 30 19:35 discover.stdout
drwxr-xr-x@  8 $USER  wheel   256 Sep 30 19:35 inventory
drwxr-xr-x@  2 $USER  wheel    64 Sep 30 19:35 reports
drwxr-xr-x@  2 $USER  wheel    64 Sep 30 19:35 results
drwxr-xr-x@  2 $USER  wheel    64 Sep 30 19:35 scre ...
````

## 25. Bash

````bash
S=$SCRATCH/wf2/stress; cat $S/run1/inventory/urls.txt $S/run1/inventory/inventory-metadata.json; cat $S/requests.json | head -30; cat $S/run1/discover.stdout | head -5
````

Output (truncated):

````text
http://127.0.0.1:54786/
http://127.0.0.1:54786/bad
http://127.0.0.1:54786/big
http://127.0.0.1:54786/events
http://127.0.0.1:54786/forms/contact
http://127.0.0.1:54786/hostile
http://127.0.0.1:54786/news
http://127.0.0.1:54786/services
{
  "tool": {
    "name": "wcag-em-a11y-toolkit",
    "version": "1.1.0",
    "axeCore": "4.11.2"
  },
  "site": "stress-site",
  "rootUrl": "http://127.0.0.1:54786/",
  "seedCount": 1,
  "discoveredCount": 8,
  "outOfScopeLinkCount": 0,
  "excludedByPatternCount": 0,
  "excludedByExtensionCount": 0,
  "failedRequestCount": 0,
  "failureReasons": {},
  "sitemaps": {
    "perSitemap": [],
    "reachedSitemapCap": false,
    "neverReached": [],
    "docsFetched": 0
  },
  "maxPagesConfigured": 450,
  "reachedMaxPages": false,
  "generatedAt": "2026-09-30T18:35 ...
````

## 26. Bash

````bash
S=$SCRATCH/wf2/stress; cd $S; kill $(python3 -c "import json;print(json.load(open('ports.json'))['pid'])"); sed -i '' "s#  const p = u.pathname;#  const p = u.pathname.length > 1 ? u.pathname.replace(/\\\\/\$/, '') : u.pathname;#; s#p === '/news/'#p === '/news'#; s#p === '/services/'#p === '/services'#; s#p === '/events/'#p === '/events'#; s#p === '/big/'#p === '/big'#; s#p === '/bad/'#p === '/bad'#; s#p === '/hostile/'#p === '/hostile'#" server.mjs; grep -n "const p = \|p === '/news'\|p === '/hostile'" server.mjs; rm -rf run1 requests.json; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && (nohup node server.mjs > server.out 2>&1 &); sleep 1; cat ports.json; A=$(python3 -c "import json;print(json.load(open('ports.json'))['A'])"); curl -s $A/news | grep -o '<a href="/news/page/[0-9]*"' | wc -l
````

Output (truncated):

````text
55:  const p = u.pathname.length > 1 ? u.pathname.replace(/\/$/, '') : u.pathname;
73:  if (p === '/news') return send(res, layout('News', links('/news/page/', 1, 10)));
97:  if (p === '/hostile') {
{"A":"http://127.0.0.1:54896","B":"http://127.0.0.1:54897","pid":20484}      10
````

## 27. Bash

````bash
S=$SCRATCH/wf2/stress; python3 $S/mkcfg.py $S $S/cfg-scale.json; mkdir -p $S/run1; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run1 && node $S/runstage.mjs discover $S/run1 $S/cfg-scale.json discover 2>&1 | tail -2; cat $S/run1/inventory/inventory-metadata.json | python3 -c "import json,sys;d=json.load(sys.stdin);print({k:d[k] for k in ['discoveredCount','failedRequestCount','failureReasons','reachedMaxPages']})"; grep -o '"retryHistogram":[^,]*,[^}]*' $S/run1/discover.stdout | tail -1; grep -i "warn\|fail" $S/run1/discover.stderr | cut -c1-300 | head
````

Output (truncated):

````text
Command did not complete within its 600s timeout and was moved to the background (ID: b2w59omm4). Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 28. Bash

````bash
S=$SCRATCH/wf2/stress; python3 -c "
import json;d=json.load(open('$S/requests.json'));print(len(d), sum(d.values())); print({k:v for k,v in d.items() if v>1 or 'never' in k or 'hostile' in k})"; tail -5 $S/run1/discover.stdout | cut -c1-400; uptime
````

Output (truncated):

````text
1453 1478
{'/hostile': 1, '/hostile/alert': 1, '/hostile/beforeunload': 1, '/hostile/closed-shadow': 1, '/hostile/confirm': 1, '/hostile/download': 1, '/hostile/export': 4, '/hostile/hang-defer': 4, '/hostile/hang-font': 4, '/hostile/hang-img': 4, '/hostile/infinite': 1, '/hostile/latin1': 1, '/hostile/nocharset-latin1': 1, '/hostile/open-shadow': 1, '/hostile/sjis': 1, '/hostile/xorigin': 1, '/img/x.png': 4, '/never': 4, '/never-font.woff2': 4, '/never.js': 4, '/news': 2}
[32mINFO[39m [33m PlaywrightCrawler:AutoscaledPool:[39m state[90m {"currentConcurrency":3,"desiredConcurrency":5,"systemStatus":{"isSystemIdle":true,"memInfo":{"isOverloaded":false,"limitRatio":0.2,"actualRatio":0},"eventLoopInfo":{"isOverloaded":false,"limitRatio":0.6,"actualRatio":0},"cpuInfo":{"isOverloaded":fals ...
````

## 29. Bash

````bash
S=$SCRATCH/wf2/stress; ls -la $S/run1/inventory/ 2>&1 | head; tail -c 600 $S/run1/discover.stderr; ps -A -o pid,ppid,etime,rss,command | grep -E "wcag-em.mjs|runstage" | grep -v grep | cut -c1-200; cat $S/run1/stages.jsonl 2>/dev/null
````

Output (truncated):

````text
Exit code 1
total 416
drwxr-xr-x@ 8 $USER  wheel     256 Sep 30 19:37 .
drwxr-xr-x@ 9 $USER  wheel     288 Sep 30 19:36 ..
-rw-r--r--@ 1 $USER  wheel     162 Sep 30 19:37 document-inventory.json
-rw-r--r--@ 1 $USER  wheel     619 Sep 30 19:37 inventory-metadata.json
-rw-r--r--@ 1 $USER  wheel  166481 Sep 30 19:37 inventory.json
-rw-r--r--@ 1 $USER  wheel    2532 Sep 30 19:37 page-clusters.json
-rw-r--r--@ 1 $USER  wheel   15051 Sep 30 19:37 process-candidates.json
-rw-r--r--@ 1 $USER  wheel   15107 Sep 30 19:37 urls.txt
:33.381Z","pid":21359,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","url":"http://127.0.0.1:54896/hostile/hang-defer","reason":"timeout","msg":"crawl request failed"}
{"level":30,"time":"2026-09-30T18:37:33.439Z","pid":21359,"tool": ...
````

## 30. Bash

````bash
lsof -nP -i :54921 2>/dev/null | head; W=$REPO; grep -rln "proxy-chain\|createServer\|new Server(" $W/node_modules/@crawlee/browser-pool/*.js $W/node_modules/@crawlee/browser-pool/*/*.js $W/node_modules/@crawlee/playwright/internals/*.js 2>/dev/null | head; grep -n "anonymizeProxy\|proxy-chain\|ProxyServer\|createProxyServerForContainers\|listen(" $W/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js | head
````

Output (truncated):

````text
COMMAND   PID         USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    21359 $USER   17u  IPv6 0xa405ffe5a758bb04      0t0  TCP *:54921 (LISTEN)
$REPO/node_modules/@crawlee/browser-pool/anonymize-proxy.js
$REPO/node_modules/@crawlee/browser-pool/container-proxy-server.js
$REPO/node_modules/@crawlee/browser-pool/proxy-server.js
$REPO/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js
$REPO/node_modules/@crawlee/playwright/internals/playwright-launcher.js
22:            .listen(() => {
40:        Object.defineProperty(this, "_containerProxyServer", {
60:        const [anonymizedProxyUrl, close] = await (0, anonymize_proxy_1.anonymizeProxySugar)(proxyUrl, undefined, undefined, {
134:                    this._containerProxyServer = await (0, container_proxy_server ...
````

## 31. Bash

````bash
W=$REPO; sed -n 1,40p $W/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js; sed -n 55,100p $W/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js
````

Output (truncated):

````text
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlaywrightPlugin = void 0;
const tslib_1 = require("tslib");
const node_fs_1 = tslib_1.__importDefault(require("node:fs"));
const node_net_1 = tslib_1.__importDefault(require("node:net"));
const node_os_1 = tslib_1.__importDefault(require("node:os"));
const node_path_1 = tslib_1.__importDefault(require("node:path"));
const browser_plugin_1 = require("../abstract-classes/browser-plugin");
const anonymize_proxy_1 = require("../anonymize-proxy");
const container_proxy_server_1 = require("../container-proxy-server");
const logger_1 = require("../logger");
const proxy_server_1 = require("../proxy-server");
const load_firefox_addon_1 = require("./load-firefox-addon");
const playwright_browser_1 = require("./play ...
````

## 32. Bash

````bash
W=$REPO; grep -n "proxy_server_1\|ProxyServer" $W/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js | head; head -60 $W/node_modules/@crawlee/browser-pool/proxy-server.js
````

Output (truncated):

````text
11:const container_proxy_server_1 = require("../container-proxy-server");
13:const proxy_server_1 = require("../proxy-server");
40:        Object.defineProperty(this, "_containerProxyServer", {
53:            server: await (0, proxy_server_1.getLocalProxyAddress)(),
134:                    this._containerProxyServer = await (0, container_proxy_server_1.createProxyServerForContainers)();
136:                    await page.goto(`data:text/plain,proxy#{"port":${this._containerProxyServer.port}}`);
140:                        await this._containerProxyServer.close(true);
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalProxyAddress = getLocalProxyAddress;
const proxy_chain_1 = require("proxy-chain");
const server = new proxy_chain_1.Server({
    port ...
````

## 33. Bash

````bash
W=$REPO; sed -n 44,58p $W/node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js
````

Output (truncated):

````text
            value: void 0
        });
    }
    async _launch(launchContext) {
        const { launchOptions, useIncognitoPages, proxyUrl } = launchContext;
        let { userDataDir } = launchContext;
        let browser;
        // Required for the `proxy` context option to work.
        launchOptions.proxy = {
            server: await (0, proxy_server_1.getLocalProxyAddress)(),
            ...launchOptions.proxy,
        };
        // WebKit does not support --no-sandbox
        if (this.library.name() === 'webkit') {
            launchOptions.args = launchOptions.args?.filter((arg) => arg !== '--no-sandbox');
````

## 34. Bash

````bash
kill -TERM 21359; sleep 2; S=$SCRATCH/wf2/stress; cat $S/run1/stages.jsonl; python3 - <<EOF
import json
inv=json.load(open('$S/run1/inventory/inventory.json'))
print(len(inv))
urls={i['url'].split(':54896')[1]:i for i in inv}
for k in ['/hostile/hang-img','/hostile/hang-font','/hostile/hang-defer','/hostile/export','/hostile/latin1','/hostile/sjis','/hostile/nocharset-latin1','/hostile/alert','/hostile/confirm','/hostile/infinite','/hostile/beforeunload']:
  i=urls.get(k); print(k, None if not i else (i['title'], i['h1']))
EOF
ls -la $S/run1/crawlee-storage/*/*/ | head; du -sh $S/run1/crawlee-storage $S/run1/inventory
````

Output (truncated):

````text
{"label":"discover","stage":"discover","code":143,"signal":null,"wallSec":677.262,"peakTreeRssMB":1468,"peakChromeProcs":17,"timeMaxRssMB":252,"nodePid":"21359"}
414
/hostile/hang-img None
/hostile/hang-font None
/hostile/hang-defer None
/hostile/export None
/hostile/latin1 ('Café crème – £ pricing', 'Café crème – £ pricing')
/hostile/sjis ('日本語', 'SJIS')
/hostile/nocharset-latin1 ('Naďve café no charset', 'Naďve café no charset')
/hostile/alert ('Alert', 'Alert')
/hostile/confirm ('Confirm', 'Confirm')
/hostile/infinite ('Infinite', 'Infinite')
/hostile/beforeunload ('Beforeunload', 'Beforeunload')
$SCRATCH/wf2/stress/run1/crawlee-storage/key_value_stores/default/:
total 512
drwxr-xr-x@ 4 $USER  wheel     128 Sep 30 19:37 .
drwxr-xr-x@ 3 $USER  wheel      96 Sep 30 19:37 ..
-rw-r--r--@ 1  ...
````

## 35. Bash

````bash
S=$SCRATCH/wf2/stress; mkdir -p $S/hang; cat > $S/hang/sse-server.mjs <<'EOF'
import { createServer } from 'node:http'; import { once } from 'node:events'; import fs from 'node:fs';
const withLive = process.argv[2] === 'live';
const page = (t, b) => `<!doctype html><html lang="en"><head><title>${t}</title></head><body><main><h1>${t}</h1>${b}</main></body></html>`;
const streams = new Set();
const s = createServer((req, res) => {
  const p = new URL(req.url, 'http://x').pathname;
  if (p === '/stream') { res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' }); streams.add(res);
    const iv = setInterval(() => res.write(': ping\n\n'), 2000); req.on('close', () => { clearInterval(iv); streams.delete(res); fs.appendFileSync(process.argv[3], `stream closed ${new Date().toISOString()}\n`); }); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
  if (p === '/') return res.end(page('Home', '<a href="/about">About</a>' + (withLive ? ' <a href="/live">Live</a>' : '')));
  if (p === '/about') return res.end(page('About', '<p>about</p>'));
  if (p === '/live') return res.end(page('Live', '<p id=o>live ticker</p><script>new EventSource("/stream").onmessage=()=>{}</script>'));
  res.end(page('Other', '<p>x</p>'));
});
s.listen(0, '127.0.0.1'); await once(s, 'listening');
console.log(`http://127.0.0.1:${s.address().port}`);
setInterval(() => fs.appendFileSync(process.argv[3], `open streams ${streams.size} ${new Date().toISOString()}\n`), 10000);
EOF
cat > $S/hang/probe.sh <<'EOF'
#!/bin/zsh
# usage: probe.sh <label> <live|control> <stage>
S=$SCRATCH/wf2/stress/hang
W=$REPO
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1
L=$1; D=$S/$L; rm -rf $D; mkdir -p $D; cd $D
node $S/sse-server.mjs $2 $D/server.log > $D/url.txt & SP=$!
sleep 1; U=$(cat $D/url.txt)
sed "s#__BASE_URL__#$U#g" $W/test/fixtures/site.json.template | python3 -c "
import json,sys; c=json.load(sys.stdin); c['sample']['structuredManual']=['$U/','$U/live' if '$2'=='live' else '$U/about']; c['scan']['viewports']=[{'id':'desktop','width':1280,'height':800}]; c['reporting']['reporters']=['json','markdown']; json.dump(c,open('$D/cfg.json','w'))"
T0=$(date +%s)
CRAWLEE_STORAGE_DIR=$D/crawlee-storage node $W/bin/wcag-em.mjs $3 --config $D/cfg.json --out-dir $D > $D/out.log 2>&1 & CP=$!
# wait up to 150s for exit
for i in $(seq 1 150); do if ! kill -0 $CP 2>/dev/null; then break; fi; sleep 1; done
T1=$(date +%s)
if kill -0 $CP 2>/dev/null; then
  DONE=$(grep -o '"msg":"[a-z ]*done"' $D/out.log | tail -1)
  echo "$L: STILL RUNNING after $((T1-T0))s; last done-msg=$DONE; node sockets to site: $(lsof -nP -p $CP -a -i 2>/dev/null | grep -c ESTABLISHED); chrome children: $(pgrep -P $CP | wc -l | tr -d ' ')"
  kill -TERM $CP; sleep 1; kill -9 $CP 2>/dev/null
else
  wait $CP; echo "$L: exited code=$? after $((T1-T0))s"
fi
kill $SP 2>/dev/null
tail -3 $D/server.log
EOF
chmod +x $S/hang/probe.sh; echo ok
````

Output (truncated):

````text
ok
````

## 36. Bash

````bash
S=$SCRATCH/wf2/stress/hang; $S/probe.sh disc-control control discover & $S/probe.sh disc-live live discover & wait
````

Output (truncated):

````text
disc-control: exited code=0 after 3s
tail: $SCRATCH/wf2/stress/hang/disc-control/server.log: No such file or directory
disc-live: exited code=0 after 4s
stream closed 2026-09-30T18:47:53.722Z
````

## 37. Bash

````bash
S=$SCRATCH/wf2/stress/hang; cd $S; python3 - <<'EOF'
p='sse-server.mjs'; s=open(p).read()
s=s.replace("const withLive = process.argv[2] === 'live';","const withLive = process.argv[2] === 'live'; const mode = process.argv[2]; const DELAY = Number(process.env.HANG_MS || 0);")
s=s.replace("  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });\n  if (p === '/') return res.end(page('Home', '<a href=\"/about\">About</a>' + (withLive ? ' <a href=\"/live\">Live</a>' : '')));",
"  if (p === '/pixel') { fs.appendFileSync(process.argv[3], `pixel requested ${new Date().toISOString()}\\n`); if (DELAY) setTimeout(() => { res.writeHead(200,{'content-type':'image/gif'}); res.end(); fs.appendFileSync(process.argv[3], `pixel answered ${new Date().toISOString()}\\n`); }, DELAY); return; }\n  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });\n  if (p === '/') return res.end(page('Home', '<a href=\"/about\">About</a>' + (withLive ? ' <a href=\"/live\">Live</a>' : '') + (mode === 'hang' ? '<img alt=\"\" src=\"/pixel\">' : '')));")
open(p,'w').write(s)
EOF
grep -c "pixel" sse-server.mjs; ./probe.sh disc-hang hang discover
````

Output (truncated):

````text
2
disc-hang: STILL RUNNING after 152s; last done-msg=; node sockets to site: 4; chrome children: 1
open streams 0 2026-09-30T18:50:18.088Z
open streams 0 2026-09-30T18:50:28.089Z
open streams 0 2026-09-30T18:50:38.091Z
````

## 38. Bash

````bash
S=$SCRATCH/wf2/stress/hang; cd $S; grep -o '"msg":"[^"]*"' disc-hang/out.log | sort | uniq -c; sed -i '' "s#c\['reporting'\]\['reporters'\]=\['json','markdown'\];#c['reporting']['reporters']=['json','markdown']; c['crawl']['navigationTimeoutSecs']=int(__import__('os').environ.get('NAV','60'));#" probe.sh; grep -c navigationTimeoutSecs probe.sh; NAV=8 ./probe.sh disc-hang8 hang discover; grep -o '"msg":"[^"]*"' disc-hang8/out.log | sort | uniq -c; cat disc-hang8/inventory/urls.txt
````

Output (truncated):

````text
1
disc-hang8: STILL RUNNING after 153s; last done-msg="msg":"discover done"; node sockets to site: 4; chrome children: 0
open streams 0 2026-09-30T18:53:01.927Z
open streams 0 2026-09-30T18:53:11.933Z
open streams 0 2026-09-30T18:53:21.933Z
   1 "msg":"crawl request failed"
   1 "msg":"discover done"
````

## 39. Bash

````bash
S=$SCRATCH/wf2/stress/hang; cd $S; NAV=8 ./probe.sh audit-hang8 hang audit > $S/audit-hang8.result 2>&1; cat $S/audit-hang8.result
````

Output (truncated):

````text
Command running in background with ID: bxoifz3b3. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 40. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run1 && node $S/runstage.mjs sample $S/run1 $S/cfg-scale.json sample | tail -1; wc -l $S/run1/inventory/*.txt; ls $S/run1/inventory; python3 -c "
import json; d=json.load(open('$S/run1/inventory/sample-metadata.json')); print({k:(v if not isinstance(v,(list,dict)) else len(v)) for k,v in d.items()})"
````

Output (truncated):

````text
{"label":"sample","stage":"sample","code":0,"signal":null,"wallSec":0.522,"peakTreeRssMB":0,"peakChromeProcs":0,"timeMaxRssMB":79,"nodePid":null}
     393 $SCRATCH/wf2/stress/run1/inventory/random-pool.txt
       3 $SCRATCH/wf2/stress/run1/inventory/random-sample.txt
      25 $SCRATCH/wf2/stress/run1/inventory/structured-sample.txt
     414 $SCRATCH/wf2/stress/run1/inventory/urls.txt
     835 total
document-inventory.json
inventory-metadata.json
inventory.json
page-clusters.json
process-candidates.json
random-pool.txt
random-sample.txt
sample-metadata.json
structured-sample-suggested.json
structured-sample.txt
urls.txt
{'tool': 3, 'site': 'stress-site', 'rootUrl': 'http://127.0.0.1:54896/', 'inventoryCount': 414, 'structuredCount': 25, 'randomPoolCount': 393, 'randomCount': 3, 'finalSample ...
````

## 41. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run1 && node $S/runstage.mjs scan $S/run1 $S/cfg-scale.json scan
````

Output (truncated):

````text
Command running in background with ID: bbagagrcp. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 42. Bash

````bash
W=$REPO; cd $W; sed -n 232,300p src/commands/scan.mjs; sed -n 320,395p src/commands/scan.mjs
````

Output (truncated):

````text
    // E1: classify the landed page BEFORE spending axe + a screenshot on it. A
    // challenge/empty page is recorded as a pageOutcome with empty violations —
    // it is NOT thrown: Cloudflare returns HTTP 200 so goto resolves, and
    // throwing would burn a scan retry and mis-bucket the page as failed
    // (§5.7). Header/status are primary; title/body corroborate.
    let outcome = await classifyLandedPage(page, response, challengeHosts);
    if (outcome.outcome === 'challenge' && challengeWaitMs > 0) {
      // §0a: a managed challenge often auto-clears in a real browser. Wait, then
      // re-check from page state (the auto-solve navigation is client-side, so
      // the original response headers are stale).
      await page.waitForTimeout(challengeWaitMs).catch(() => {});
    ...
````

## 43. Bash

````bash
W=$REPO; cd $W; sed -n 170,208p bin/wcag-em.mjs; grep -n "outDir\|out-dir\|sampleJsonPath\|resultsDir\|screenshotsDir\|reportsDir" src/lib/context.mjs | head -30
````

Output (truncated):

````text
      });
      const { run } = await import('../src/commands/scan-processes.mjs');
      await run(ctx);
    }),
  );

program
  .command('summarize')
  .description('Group findings, compare samples, emit reports.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: false });
      const { run } = await import('../src/commands/summarize.mjs');
      const result = await run(ctx);
      // Exit code comes from summarize's `computeExitCode` against the
      // configured `reporting.failOnFindings` policy (Pa11y-compatible).
      if (result && typeof result.exitCode === 'number') return result.exitCode;
    }),
  );

program
  .command('audit')
  .description('Run the full pipeline: discover -> sample -> scan -> scan-processes -> ...
````

## 44. Bash

````bash
W=$REPO; cd $W; grep -n "processes.length\|length === 0\|return\b\|writeJson" src/commands/scan-processes.mjs | head -20; grep -n -i "out-dir\|output/" docs/guides/user-manual.md README.md | head -20
````

Output (truncated):

````text
24:import { writeJson } from '../lib/fs-utils.mjs';
41:  if (Array.isArray(processDef.steps) && processDef.steps.length > 0) return processDef.steps;
44:    return [
65:    return [
77:  return [];
115:    if (steps.length === 0) {
116:      return {
137:    return {
150:    return {
208:  await writeJson(path.join(paths.resultsDir, 'process-results.json'), processResults);
210:  return { processesRun: processResults.length };
README.md:61:All commands accept `--config <path>`, `--out-dir <path>`,
docs/guides/user-manual.md:25:npx wcag-em audit --config my-site.json --out-dir output/my-site
docs/guides/user-manual.md:30:re-run `sample` + `scan` + `summarize` against the same out-dir):
docs/guides/user-manual.md:40:Global flags on every command: `--config <path>`, `--out-dir <path>`,
docs/g ...
````

## 45. Bash

````bash
W=$REPO; cd $W; sed -n 150,158p docs/guides/user-manual.md; sed -n 195,210p src/commands/scan-processes.mjs; sed -n 26,34p docs/guides/user-manual.md
````

Output (truncated):

````text
| `... is inside the working tree and NOT gitignored. Risk of committing session data ...`        | Add the storage-state path to `.gitignore` before anything else.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `portal-export: payload fails the vendored contract ...`                                        | See the integrations gu ...
````

## 46. Bash

````bash
S=$SCRATCH/wf2/stress; grep -o '"msg":"scan[a-z ]*"\|"msg":"viewport [a-z]*"' $S/run1/scan.stderr | sort | uniq -c; grep '"level":[45]0' $S/run1/scan.stderr | python3 -c "
import sys,json
for l in sys.stdin:
  try: d=json.loads(l)
  except: continue
  print(d['time'][11:19], d.get('msg'), d.get('url','')[-25:], d.get('viewport'), (d.get('err') or '')[:140].replace('\n',' '))"; cat $S/hang/audit-hang8.result 2>/dev/null
````

Output (truncated):

````text
   1 "msg":"scan viewports"
   2 "msg":"scanned"
   3 "msg":"scanning"
   1 "msg":"viewport start"
````

## 47. Bash

````bash
S=$SCRATCH/wf2/stress; python3 -c "
import sys,json
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  print(d['time'][11:19], d.get('msg'), d.get('url','')[-25:], d.get('viewport'), d.get('violations',''))"; date -u +%H:%M:%S; uptime
````

Output (truncated):

````text
18:53:57 scan viewports  None 
18:53:58 viewport start  desktop 
18:53:58 scanning http://127.0.0.1:54896/ desktop 
18:53:58 scanned http://127.0.0.1:54896/ desktop 0
18:53:58 scanning 0.0.1:54896/forms/contact desktop 
18:53:58 scanned 0.0.1:54896/forms/contact desktop 1
18:53:59 scanning p://127.0.0.1:54896/big/1 desktop 
18:54:34
19:54  up 1 day,  1:49, 1 user, load averages: 14.33 9.65 14.57
````

## 48. Bash

````bash
sleep 45; S=$SCRATCH/wf2/stress; cat $S/hang/audit-hang8.result; grep -o '"msg":"[^"]*"' $S/hang/audit-hang8/out.log | uniq -c | tail -12; python3 -c "
import json
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  print(d['time'][11:19], d.get('msg'), d.get('url','')[-25:], d.get('viewport'), d.get('violations',''), (d.get('err') or '')[:100])" | tail -5; ls -la $S/run1/screenshots | head
````

Output (truncated):

````text
<tool_use_error>Blocked: sleep 45 followed by: S=$SCRATCH/wf2/stress cat $S/hang/audit-hang8.result grep -o '"msg":"[^"]*"' $S/hang/audit-hang8/out.log uniq -c tail -12 python3 -c "
import json
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  print(d['time'][11:19], d.get('msg'), d.get('url','')[-25:], d.get('viewport'), d.get('violations',''), (d.get('err') or '')[:100])" tail -5 ls -la $S/run1/screenshots head. To wait for a condition, use Monitor with an until-loop (e.g. `until <check>; do sleep 2; done`). To wait for a command you started, use run_in_background: true. Do not chain shorter sleeps to work around this block.</tool_use_error>
````

## 49. Bash

````bash
S=$SCRATCH/wf2/stress; cat $S/hang/audit-hang8.result; grep -o '"msg":"[^"]*"' $S/hang/audit-hang8/out.log | uniq -c | tail -12; python3 -c "
import json
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  print(d['time'][11:19], d.get('msg'), d.get('url','')[-25:], d.get('viewport'), d.get('violations',''), (d.get('err') or '')[:100])" | tail -5; ls -la $S/run1/screenshots | head
````

Output (truncated):

````text
   1 "msg":"crawl request failed"
   1 "msg":"discover done"
   1 "msg":"stage done"
   1 "msg":"stage start"
   1 "msg":"structured sample contains URLs not found in inventory"
   1 "msg":"sample built"
   1 "msg":"small site — full-site supplementary automated scan recommended"
   1 "msg":"stage done"
   1 "msg":"stage start"
   1 "msg":"scan viewports"
   1 "msg":"viewport start"
   1 "msg":"scanning"
18:53:58 scanning 0.0.1:54896/forms/contact desktop  
18:53:58 scanned 0.0.1:54896/forms/contact desktop 1 
18:53:59 scanning p://127.0.0.1:54896/big/1 desktop  
18:54:43 scanned p://127.0.0.1:54896/big/1 desktop 1 
18:54:43 scanning p://127.0.0.1:54896/big/2 desktop  
total 39080
drwxr-xr-x@  6 $USER  wheel      192 Sep 30 19:54 .
drwxr-xr-x@ 15 $USER  wheel      480 Sep 30 19:53 ..
-rw-r ...
````

## 50. Bash

````bash
W=$REPO; cd $W; grep -n "\.find(\|\.includes(\|\.indexOf(\|\.filter(\|\.some(" src/commands/sample.mjs src/lib/sample-utils.mjs src/lib/group-findings.mjs src/lib/wcag-em-summary.mjs src/commands/summarize.mjs src/commands/discover.mjs | head -50
````

Output (truncated):

````text
src/commands/sample.mjs:62:      const matchingClusters = pageClusters.filter((cluster) => cluster.pageType === type);
src/commands/sample.mjs:71:  const structuredMissingFromInventory = structured.filter((url) => !allUrls.includes(url));
src/commands/sample.mjs:81:  const randomPool = allUrls.filter((url) => !structured.includes(url));
src/commands/sample.mjs:94:    if (startUrl && structured.includes(startUrl)) processExpansion.push(startUrl);
src/commands/sample.mjs:111:    suggested: suggested.filter((url) => !manual.includes(url)),
src/lib/wcag-em-summary.mjs:264:      const isBestPractice = Array.isArray(p.tags) && p.tags.includes('best-practice');
src/lib/wcag-em-summary.mjs:438:      ? ctx.config.processes.map((p) => (typeof p?.name === 'string' ? p.name : '')).filter(Boolean)
src/ ...
````

## 51. Bash

````bash
S=$SCRATCH/wf2/stress; until grep -q '"stage":"scan"' $S/run1/stages.jsonl 2>/dev/null; do sleep 5; done; tail -1 $S/run1/stages.jsonl
````

Output (truncated):

````text
Command running in background with ID: bln21tgr5. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
````

## 52. Bash

````bash
S=$SCRATCH/wf2/stress; cat $S/hang/audit-hang8.result; grep -o '"msg":"[^"]*"' $S/hang/audit-hang8/out.log | tail -6; ls -la $S/hang/audit-hang8/reports/ 2>/dev/null
````

Output (truncated):

````text
"msg":"viewport done"
"msg":"scan-processes done"
"msg":"stage done"
"msg":"stage start"
"msg":"summarize done"
"msg":"stage done"
total 96
drwxr-xr-x@  9 $USER  wheel    288 Sep 30 19:54 .
drwxr-xr-x@ 12 $USER  wheel    384 Sep 30 19:54 ..
-rw-r--r--@  1 $USER  wheel      3 Sep 30 19:54 grouped-by-component.json
-rw-r--r--@  1 $USER  wheel      3 Sep 30 19:54 grouped-by-rule.json
-rw-r--r--@  1 $USER  wheel   1154 Sep 30 19:54 manual-backlog.md
-rw-r--r--@  1 $USER  wheel    235 Sep 30 19:54 random-vs-structured-comparison.json
-rw-r--r--@  1 $USER  wheel  15009 Sep 30 19:54 summary.json
-rw-r--r--@  1 $USER  wheel   1197 Sep 30 19:54 summary.md
-rw-r--r--@  1 $USER  wheel  11900 Sep 30 19:54 wcag-em-summary.json
````

## 53. Bash

````bash
S=$SCRATCH/wf2/stress; until [ -s $S/hang/audit-hang8.result ]; do sleep 3; done; cat $S/hang/audit-hang8.result; grep -h '"time"' $S/hang/audit-hang8/out.log | python3 -c "
import sys,json
L=[json.loads(l) for l in sys.stdin if l.startswith('{')]
print('first',L[0]['time'],'summarize-done',[x['time'] for x in L if x.get('msg')=='summarize done'])"; cat $S/hang/audit-hang8/reports/summary.md | head -30; cat $S/hang/audit-hang8/inventory/inventory-metadata.json | grep -E "discoveredCount|failedRequestCount|reachedMaxPages"
````

Output (truncated):

````text
audit-hang8: STILL RUNNING after 152s; last done-msg="msg":"stage done"; node sockets to site: 4; chrome children: 0
open streams 0 2026-09-30T18:55:57.806Z
open streams 0 2026-09-30T18:56:07.807Z
open streams 0 2026-09-30T18:56:17.810Z
first 2026-09-30T18:53:48.940Z summarize-done ['2026-09-30T18:54:54.020Z']
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **e2e-fixture-site**
Generated: 2026-09-30T18:54:54.011Z

## Method guardrails

- This is the automated layer of the audit workflow.
- It does not make a sitewide WCAG conformance claim on its own.
- Complete processes and manual checks still need separate review.

## Run summary

- Inventory count: 0
- Final selected sample: 2
- Sample pages scanned: 1
- Page views scanned (pages x viewports) ...
````

## 54. Bash

````bash
ps -A -o pid,etime,command | grep -E "wcag-em.mjs|sse-server" | grep -v grep | cut -c1-160; ipconfig getifaddr en0 2>/dev/null || ifconfig | grep "inet " | grep -v 127.0.0.1 | head -2
````

Output (truncated):

````text
 3910       02:54 /usr/bin/time -l ~/.nvm/versions/node/v22.14.0/bin/node $REPO_MAIN/.claude/work
 3911       02:54 ~/.nvm/versions/node/v22.14.0/bin/node $REPO_MAIN/.claude/worktrees/toolkit-rev
19269       00:00 ~/.nvm/versions/node/v22.14.0/bin/node $REPO_MAIN/.claude/worktrees/toolkit-rev
$LAN_IP
````

## 55. Bash

````bash
ps -A -o pid,ppid,etime,command | grep -E "wcag-em.mjs" | grep -v grep | grep -o "^ *[0-9]* *[0-9]* *[0-9:]* .*\(scan\|discover\|audit\|summarize\|sample\) --config [^ ]*" | sed 's#$TMP ]*scratchpad/##' | cut -c1-200; date -u +%T
````

Output (truncated):

````text
 3910  3909       02:59 /usr/bin/time -l ~/.nvm/versions/node/v22.14.0/bin/node $REPO/b
 3911  3910       02:59 ~/.nvm/versions/node/v22.14.0/bin/node $REPO/bin/wcag-em.mjs sc
19269 19249       00:05 ~/.nvm/versions/node/v22.14.0/bin/node $REPO/bin/wcag-em.mjs sc
18:56:56
````

## 56. Bash

````bash
S=$SCRATCH/wf2/stress/hang; W=$REPO; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1; D=$S/openproxy; rm -rf $D; mkdir -p $D; cd $D
node $S/sse-server.mjs control $D/server.log > $D/url.txt & SP=$!
# a loopback-only service standing in for an auditor-local dev service
node -e "require('http').createServer((q,r)=>r.end('LOCAL-ONLY-SECRET\n')).listen(0,'127.0.0.1',function(){console.log(this.address().port)})" > $D/local.txt & LP=$!
sleep 1; U=$(cat url.txt); LPORT=$(cat local.txt)
sed "s#__BASE_URL__#$U#g" $W/test/fixtures/site.json.template > cfg.json
python3 -c "import json;c=json.load(open('cfg.json'));c['crawl']['requestDelayMs']=4000;json.dump(c,open('cfg.json','w'))"
CRAWLEE_STORAGE_DIR=$D/cs node $W/bin/wcag-em.mjs discover --config cfg.json --out-dir $D > out.log 2>&1 & CP=$!
for i in $(seq 1 40); do PORT=$(lsof -nP -a -p $CP -iTCP -sTCP:LISTEN 2>/dev/null | awk 'NR>1{print $9}' | head -1); [ -n "$PORT" ] && break; sleep 0.5; done
echo "listen: $PORT"; P=${PORT##*:}
echo "via LAN IP proxy -> loopback-only service:"; curl -s -m 5 -x http://$LAN_IP:$P http://127.0.0.1:$LPORT/ ; echo "curl exit $?"
wait $CP; echo "discover exit $?"; kill $SP $LP
````

Output (truncated):

````text
listen: *:56608
via LAN IP proxy -> loopback-only service:
LOCAL-ONLY-SECRET
curl exit 0
discover exit 0
````

## 57. Bash

````bash
R=$SCRATCH/review; grep -il "proxy-chain\|getLocalProxyAddress\|open proxy\|all interfaces" $R/*.json $R/*.txt; W=$REPO; grep -n '"version"' $W/node_modules/proxy-chain/package.json; grep -n "listen(" $W/node_modules/proxy-chain/dist/server.js | head -5; grep -n "this.host\|options.host" $W/node_modules/proxy-chain/dist/server.js | head -5
````

Output (truncated):

````text
3:    "version": "2.7.1",
547:    async listen(callback) {
549:            // Unfortunately server.listen() is not a normal function that fails on error,
568:            this.server.listen(this.port, this.host);
155:        this.host = options.host;
568:            this.server.listen(this.port, this.host);
````

## 58. Bash

````bash
S=$SCRATCH/wf2/stress; python3 -c "
import json
prev=None
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  if d.get('msg') in ('scanned','scan attempt failed','scan failed after retries','viewport start'):
    print(d['time'][11:19], d.get('msg'), d.get('url','')[26:], d.get('viewport'), d.get('violations',''), (d.get('err') or '')[:90].replace('\n',' '))" | tail -30; date -u +%T
````

Output (truncated):

````text
18:53:58 viewport start  desktop  
18:53:58 scanned  desktop 0 
18:53:58 scanned ms/contact desktop 1 
18:54:43 scanned /1 desktop 1 
18:55:26 scanned /2 desktop 1 
18:55:26 scanned /1 desktop 6 
18:55:27 scanned /2 desktop 6 
18:55:27 scanned /3 desktop 6 
18:55:27 scanned s/post-1 desktop 0 
18:55:28 scanned vices/svc-1 desktop 0 
18:55:28 scanned nts/ev-1 desktop 1 
18:55:58 scan attempt failed tile/hang-img desktop  page.screenshot: Timeout 30000ms exceeded. Call log:   - taking page screenshot   - waitin
18:56:28 scan attempt failed tile/hang-img desktop  page.screenshot: Timeout 30000ms exceeded. Call log:   - taking page screenshot   - waitin
18:56:28 scan failed after retries tile/hang-img desktop  
18:56:58 scan attempt failed tile/hang-font desktop  page.screenshot: Timeout 30000 ...
````

## 59. Bash

````bash
S=$SCRATCH/wf2/stress; cat > $S/integrity.sh <<'EOF'
#!/bin/zsh
# usage: integrity.sh <srcRunDir> <cfg>
S=$SCRATCH/wf2/stress
W=$REPO
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1
SRC=$1; CFG=$2
mk() { rm -rf $S/int/$1; mkdir -p $S/int/$1; rsync -a --exclude screenshots --exclude crawlee-storage --exclude '*.std*' --exclude stages.jsonl $SRC/ $S/int/$1/; rm -rf $S/int/$1/reports/*; }
run() { # label stage cfg
  cd $S/int/$1; CRAWLEE_STORAGE_DIR=$S/int/$1/cs node $W/bin/wcag-em.mjs $2 --config $3 --out-dir $S/int/$1 > $S/int/$1/$2.log 2>&1; local ec=$?
  local warns=$(grep -c '"level":40' $S/int/$1/$2.log); local errs=$(grep -c '"level":50' $S/int/$1/$2.log)
  echo "== $1 [$2] exit=$ec warn=$warns error=$errs"
  grep -h '"level":[45]0' $S/int/$1/$2.log | python3 -c "
import sys,json
for l in sys.stdin:
  try: d=json.loads(l); print('   ', d.get('msg')[:110], '|', (d.get('err') or d.get('file') or '')[-60:])
  except: pass" | sort | uniq -c | head -5
  grep -v '^{' $S/int/$1/$2.log | head -3 | cut -c1-200
  [ -f reports/summary.md ] && grep -E "Inventory count|Final selected sample|Sample pages scanned|Grouped findings|Automated coverage|^Site:" reports/summary.md | sed 's/^/    md: /'
  [ -f reports/portal-export.json ] && python3 -c "import json;d=json.load(open('reports/portal-export.json'));print('    portal: pages',len(d.get('pages',d.get('results',[]))) if isinstance(d,dict) else '?', 'keys',list(d)[:8])"
  [ -f reports/junit.xml ] && grep -o '<testsuites[^>]*>' reports/junit.xml | head -1 | sed 's/^/    junit: /'
  cd $S
}
mkdir -p $S/int
mk A-truncated-axe; F=$S/int/A-truncated-axe/results/axe-results.json; head -c $(( $(stat -f%z $F) / 2 )) $F > $F.x && mv $F.x $F; run A-truncated-axe summarize $CFG
mk B-missing-axe; rm $S/int/B-missing-axe/results/axe-results.json; run B-missing-axe summarize $CFG
mk C-truncated-inventory; F=$S/int/C-truncated-inventory/inventory/inventory.json; head -c 1000 $F > $F.x && mv $F.x $F; run C-truncated-inventory summarize $CFG; run C-truncated-inventory sample $CFG
mk D-truncated-samplejson; F=$S/int/D-truncated-samplejson/sample.json; head -c 40 $F > $F.x && mv $F.x $F; run D-truncated-samplejson scan $CFG
mk E-missing-inventory-dir; rm -rf $S/int/E-missing-inventory-dir/inventory; run E-missing-inventory-dir summarize $CFG; run E-missing-inventory-dir sample $CFG
EOF
chmod +x $S/integrity.sh; echo ok
````

Output (truncated):

````text
ok
````

## 60. Bash

````bash
S=$SCRATCH/wf2/stress; until grep -q '"stage":"scan"' $S/run1/stages.jsonl 2>/dev/null; do sleep 5; done; tail -1 $S/run1/stages.jsonl; python3 -c "
import json
for l in open('$S/run1/scan.stderr'):
  try: d=json.loads(l)
  except: continue
  if d.get('msg') in ('scanned','scan failed after retries','viewport start','scan done'):
    print(d['time'][11:19], d.get('msg'), d.get('url','')[26:], d.get('viewport'), d.get('violations',''), d.get('pagesScanned',''), d.get('pagesFailed',''))" | tail -40
````

Output (truncated):

````text
{"label":"scan","stage":"scan","code":0,"signal":null,"wallSec":549.587,"peakTreeRssMB":2329,"peakChromeProcs":5,"timeMaxRssMB":1453,"nodePid":"3911"}
18:58:31 scanned tile/open-shadow desktop 5  
18:58:31 scanned tile/xorigin desktop 3  
18:58:31 scan failed after retries tile/export desktop   
18:58:32 scanned tile/latin1 desktop 1  
18:58:32 scanned tile/sjis desktop 1  
18:58:32 scanned tile/nocharset-latin1 desktop 1  
18:58:33 scanned  desktop 1  
18:58:33 scanned s/post-118 desktop 0  
18:58:33 scanned s/post-179 desktop 0  
18:58:34 scanned s/post-20 desktop 0  
18:58:34 viewport start  reflow   
18:58:34 scanned  reflow 0  
18:58:34 scanned ms/contact reflow 1  
18:59:18 scanned /1 reflow 1  
18:59:59 scanned /2 reflow 1  
18:59:59 scanned /1 reflow 6  
19:00:00 scanned /2 reflow  ...
````

## 61. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run1 && node $S/runstage.mjs summarize $S/run1 $S/cfg-scale.json summarize | tail -1; cd $S/run1; ls -la results reports | awk '{print $5, $9}'; du -sh screenshots; ls screenshots | wc -l; ls -laS screenshots | head -6 | awk '{print $5,$9}'; grep -c '"level":40' summarize.stderr; grep -E "Automated coverage|Grouped findings|Sample pages scanned|Page views" reports/summary.md
````

Output (truncated):

````text
{"label":"summarize","stage":"summarize","code":2,"signal":null,"wallSec":0.671,"peakTreeRssMB":0,"peakChromeProcs":0,"timeMaxRssMB":126,"nodePid":null}
 
 
448 .
544 ..
26161 earl.jsonld
339513 grouped-by-component.json
50613 grouped-by-rule.json
15216 junit.xml
3579 manual-backlog.md
653506 portal-export.json
235 random-vs-structured-comparison.json
45358 report-builder-draft.json
14083 summary.html
75275 summary.json
3855 summary.md
15631 wcag-em-summary.json
 
 
 
96 .
544 ..
5844838 axe-results.json
 27M	screenshots
      48
 
9983933 127.0.0.1_54896_big_2__desktop.png
9983583 127.0.0.1_54896_big_1__desktop.png
3563970 127.0.0.1_54896_big_2__reflow.png
3563594 127.0.0.1_54896_big_1__reflow.png
66696 127.0.0.1_54896_hostile_infinite__desktop.png
0
- Sample pages scanned: 24
- Page view ...
````

## 62. Bash

````bash
S=$SCRATCH/wf2/stress; python3 - <<EOF
import json
r=json.load(open('$S/run1/results/axe-results.json'))
import collections
sizes=collections.Counter()
for x in r:
  u=x['url'].split(':54896')[1]
  sizes[u]+=len(json.dumps(x))
  if '/hostile/' in u and x['viewport']=='desktop':
    v=[(vv['id'], len(vv['nodes']), [n['target'] for n in vv['nodes']][:2]) for vv in x.get('violations',[])]
    print(u, x.get('pageOutcome'), 'passes',x.get('passes'),'inc',x.get('incomplete'), 'viol',v, (x.get('error') or '')[:60])
print('bytes per page (top):', sizes.most_common(4))
EOF
python3 -c "
from PIL import Image" 2>/dev/null; file $S/run1/screenshots/127.0.0.1_54896_hostile_infinite__desktop.png $S/run1/screenshots/127.0.0.1_54896_big_1__desktop.png
````

Output (truncated):

````text
/hostile/hang-img None passes None inc None viol [] page.screenshot: Timeout 30000ms exceeded.
Call log:
  - tak
/hostile/hang-font None passes None inc None viol [] page.screenshot: Timeout 30000ms exceeded.
Call log:
  - tak
/hostile/hang-defer None passes None inc None viol [] page.goto: Timeout 30000ms exceeded.
Call log:
  - navigatin
/hostile/alert None passes 9 inc 0 viol [('image-alt', 1, [['img']])] 
/hostile/confirm None passes 9 inc 0 viol [('image-alt', 1, [['img']])] 
/hostile/beforeunload None passes 9 inc 0 viol [('image-alt', 1, [['img']])] 
/hostile/infinite None passes 10 inc 0 viol [('image-alt', 20, [['img[src$="inf1.png"]'], ['img[src$="inf2.png"]']])] 
/hostile/closed-shadow None passes 8 inc 0 viol [] 
/hostile/open-shadow None passes 11 inc 0 viol [('button-name', 1 ...
````

## 63. Bash

````bash
W=$REPO; sed -n 306,322p $W/src/commands/scan.mjs; grep -n "setDefaultTimeout\|setDefaultNavigationTimeout" $W/src/commands/scan.mjs $W/src/lib/browser*.mjs
````

Output (truncated):

````text
      pngQualityWarnFired = true;
    }
    const screenshotPath = buildScreenshotPath(
      paths.screenshotsDir,
      url,
      viewport,
      screenshotFormat,
    );
    if (config.scan.fullPageScreenshots !== false) {
      await page.screenshot({
        path: screenshotPath,
        fullPage: true,
        type: screenshotFormat,
        ...(screenshotFormat === 'jpeg' ? { quality: screenshotQuality } : {}),
      });
    }
````

## 64. Bash

````bash
S=$SCRATCH/wf2/stress; W=$REPO; A=$(python3 -c "import json;print(json.load(open('$S/ports.json'))['A'])"); cat > $S/bigtime.mjs <<EOF
import { chromium } from '$W/node_modules/playwright/index.mjs';
import AxeBuilderMod from '$W/node_modules/@axe-core/playwright/dist/index.mjs';
const AxeBuilder = AxeBuilderMod.default ?? AxeBuilderMod;
const b = await chromium.launch();
try {
  for (const [w, shot] of [[1280, true], [1280, false], [320, true]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: 800 } }); const p = await ctx.newPage();
    let t = Date.now(); await p.goto('$A/big/1', { waitUntil: 'domcontentloaded' }); const tg = Date.now() - t;
    t = Date.now(); if (shot) await p.screenshot({ path: '$S/big-probe.png', fullPage: true }); const ts = Date.now() - t;
    t = Date.now(); const r = await new AxeBuilder({ page: p }).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze(); const ta = Date.now() - t;
    const n = await p.evaluate(() => document.querySelectorAll('*').length);
    console.log(JSON.stringify({ width: w, screenshot: shot, elements: n, gotoMs: tg, screenshotMs: ts, axeMs: ta, contrastNodes: r.violations.find(v => v.id === 'color-contrast')?.nodes.length }));
    await ctx.close();
  }
} finally { await b.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $S/bigtime.mjs; uptime
````

Output (truncated):

````text
{"width":1280,"screenshot":true,"elements":20021,"gotoMs":122,"screenshotMs":2995,"axeMs":36531,"contrastNodes":400}
{"width":1280,"screenshot":false,"elements":20021,"gotoMs":92,"screenshotMs":0,"axeMs":37473,"contrastNodes":400}
{"width":320,"screenshot":true,"elements":20021,"gotoMs":90,"screenshotMs":791,"axeMs":37302,"contrastNodes":400}
20:05  up 1 day, 2 hrs, 1 user, load averages: 6.21 7.95 11.42
````

## 65. Bash

````bash
S=$SCRATCH/wf2/stress; $S/integrity.sh $S/run1 $S/cfg-scale.json 2>&1
````

Output (truncated):

````text
== A-truncated-axe [summarize] exit=0 warn=4 error=0
   4     artefact present but unreadable; using fallback — pipeline state may be corrupt | ed string in JSON at position 2922406 (line 77812 column 16)
    md: Site: **stress-site**
    md: - Inventory count: 414
    md: - Final selected sample: 28
    md: - Sample pages scanned: 0
    md: - Grouped findings: 0
    md: - Automated coverage: none — PARTIAL (0/28 selected pages audited)
    md: ## Grouped findings by rule
    portal: pages 0 keys ['scanMetadata', 'summary', 'rawFindings']
== B-missing-axe [summarize] exit=0 warn=0 error=0
    md: Site: **stress-site**
    md: - Inventory count: 414
    md: - Final selected sample: 28
    md: - Sample pages scanned: 0
    md: - Grouped findings: 0
    md: - Automated coverage: none — PARTIA ...
````

## 66. Bash

````bash
R=$SCRATCH/review; python3 - <<EOF
import json,re
d=json.load(open('$R/round1-findings.json'))
items=d if isinstance(d,list) else d.get('findings',d)
for f in items:
  t=json.dumps(f)
  if re.search(r'exit[- ]?(code )?0|failOnFindings|computeExitCode|coverage.{0,20}none|zero pages|0/\d+ selected', t, re.I):
    print(f['id'], f['severity'], f['status'], '|', f['title'][:150])
EOF
````

Output (truncated):

````text
SAMP-13 low new | No Step-3 integrity guards: an empty structured sample, a disabled random tier and an empty final sample pass silently, and the small-site flag fires 
DISC-02 high new | Post-redirect URL is never re-checked against scope or exclusions: off-site pages get inventoried, excludeUrlPatterns can be bypassed, and a root redi
DISC-06 high tracked-open | discover ignores the entire auth block (httpCredentials, storageState, extraHttpHeaders), not just setupScript: a documented Basic-auth staging setup 
DISC-07 medium new | discover does not detect challenges and never flags an empty or degenerate inventory
DISC-15 medium new | Links added by JavaScript after page load, onclick/role=link 'links', <area>, iframes and hash routes are never discovered, and there is no crawl-side
SEC- ...
````

## 67. Bash

````bash
W=$REPO; cd $W; grep -n "finalSampleCount\|Final selected sample" src/commands/summarize.mjs src/reporters/markdown.mjs src/lib/*.mjs | head
````

Output (truncated):

````text
src/commands/summarize.mjs:263:    sampleListedCount: sampleMetadata?.finalSampleCount ?? null,
src/commands/summarize.mjs:611:    finalSampleCount: sampleMetadata.finalSampleCount ?? axeResults.length,
src/reporters/markdown.mjs:171:    `- Final selected sample: ${summary.finalSampleCount}`,
src/lib/wcag-em-summary.mjs:417:    typeof sampleMetadata?.finalSampleCount === 'number' ? sampleMetadata.finalSampleCount : null;
````

## 68. Bash

````bash
W=$REPO; cd $W; sed -n 600,625p src/commands/summarize.mjs; S=$SCRATCH/wf2/stress; python3 -c "
import json
for lab in ['E-missing-inventory-dir']:
  s=json.load(open('$S/int/'+lab+'/reports/summary.json'))
  print({k:s.get(k) for k in ['inventoryCount','finalSampleCount','samplePagesScanned','pageViewsScanned','structuredSampleCount','randomSampleCount']})
  w=json.load(open('$S/int/'+lab+'/reports/wcag-em-summary.json'))
  print(json.dumps(w.get('automatedCoverage') or w.get('sample'))[:600])
  p=json.load(open('$S/int/'+lab+'/reports/portal-export.json')); print(json.dumps(p['summary'])[:400])
"
````

Output (truncated):

````text
    axeResults,
    processResults,
    sampleMetadata,
    inventoryMetadata,
  });

  const summary = {
    tool: TOOL_IDENTITY,
    site: config.name,
    generatedAt: new Date().toISOString(),
    inventoryCount: sampleMetadata.inventoryCount ?? inventory.length,
    finalSampleCount: sampleMetadata.finalSampleCount ?? axeResults.length,
    samplePagesScanned: executionHealth.pagesFullyScanned + executionHealth.pagesDegraded.length,
    pageViewsScanned: executionHealth.pageViewsScanned,
    processRuns: processResults.length,
    groupedFindingCount: groupedFindings.length,
    groupedComponentCount: groupedComponents.length,
    comparison,
    findings: groupedFindings,
    incompleteFindings,
    executionHealth,
    // Surface infra-failure incompletes AND execution failures in t ...
````

## 69. Bash

````bash
S=$SCRATCH/wf2/stress; for f in C-truncated-inventory/sample.log D-truncated-samplejson/scan.log E-missing-inventory-dir/sample.log; do echo "== $f"; grep '"level":50' $S/int/$f | python3 -c "
import sys,json
for l in sys.stdin: d=json.loads(l); print(d.get('msg'), '|', json.dumps({k:v for k,v in d.items() if k not in ('time','pid','tool','toolVersion','axeCore','name','level','msg')})[:300])"; done
````

Output (truncated):

````text
== C-truncated-inventory/sample.log
command failed | {"err": {"type": "Object", "message": "Unterminated string in JSON at position 1000 (line 41 column 13)", "stack": "SyntaxError: Unterminated string in JSON at position 1000 (line 41 column 13)\n    at JSON.parse (<anonymous>)\n    at run (file://~/wcag-em-a11y-toolkit-v2-recommend
== D-truncated-samplejson/scan.log
command failed | {"err": {"type": "Object", "message": "Unterminated string in JSON at position 40 (line 3 column 10)", "stack": "SyntaxError: Unterminated string in JSON at position 40 (line 3 column 10)\n    at JSON.parse (<anonymous>)\n    at run (file://$REPO_MAIN/.cl
== E-missing-inventory-dir/sample.log
command failed | {"err": {"type": "Object", "message": "ENOENT: no such file or directory, open '$SCRATCH/wf2/stress/i ...
````

## 70. Bash

````bash
S=$SCRATCH/wf2/stress; rm -rf $S/run2; mkdir -p $S/run2; rsync -a --exclude crawlee-storage --exclude '*.std*' --exclude stages.jsonl --exclude '*.json.tmp*' $S/run1/ $S/run2/; python3 - <<EOF
import json
c=json.load(open('$S/cfg-scale.json')); A=c['rootUrl'].rstrip('/')
c['sample']['structuredManual']=[A+'/',A+'/big/1',A+'/big/2',A+'/news/post-5',A+'/services/svc-9',A+'/events/ev-3']
c['sample']['autoSuggest']['enabled']=False
c['sample']['randomSeed']=7
json.dump(c,open('$S/cfg-resample.json','w'),indent=1)
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run2 && node $S/runstage.mjs sample $S/run2 $S/cfg-resample.json sample | tail -1; cat $S/run2/sample.json | python3 -c "import json,sys;print(len(json.load(sys.stdin)))"; ls -la --time-style=+%T $S/run2/results/ 2>/dev/null || ls -laT $S/run2/results/
````

Output (truncated):

````text
{"label":"sample","stage":"sample","code":0,"signal":null,"wallSec":0.451,"peakTreeRssMB":0,"peakChromeProcs":0,"timeMaxRssMB":82,"nodePid":null}
7
total 11416
drwxr-xr-x@  3 $USER  wheel       96 Sep 30 20:03:06 2026 .
drwxr-xr-x@ 10 $USER  wheel      320 Sep 30 20:07:22 2026 ..
-rw-r--r--@  1 $USER  wheel  5844838 Sep 30 20:03:06 2026 axe-results.json
````

## 71. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run2 && node $S/runstage.mjs scan-sigint $S/run2 $S/cfg-resample.json scan 25000 SIGINT | tail -1; sleep 3; python3 - <<EOF
import json,subprocess
t=json.load(open('$S/run2/scan-sigint.prekill-tree.json'))
alive=subprocess.run(['ps','-A','-o','pid=,ppid=,comm='],capture_output=True,text=True).stdout.split('\n')
alivemap={l.split()[0]:l for l in alive if l.strip()}
print('prekill tree:',len(t),'procs; chrome:',sum(1 for x in t if 'hrom' in (x.get('comm') or '')))
surv=[alivemap[x['pid']] for x in t if x['pid'] in alivemap]
print('survivors after SIGINT:',len(surv)); [print('  ',s[:150]) for s in surv[:8]]
EOF
tail -c 400 $S/run2/scan-sigint.stderr | head -5; ls -laT $S/run2/results/; ls $S/run2/results | cat; ls -t $S/run2/screenshots | head -3
````

Output (truncated):

````text
{"label":"scan-sigint","stage":"scan","code":130,"signal":null,"wallSec":25.366,"peakTreeRssMB":1884,"peakChromeProcs":4,"timeMaxRssMB":555,"nodePid":"63900"}
prekill tree: 6 procs; chrome: 4
survivors after SIGINT: 0
put operations
                   0  block output operations
                1349  messages sent
                2515  messages received
                   1  signals received
total 11416
drwxr-xr-x@  3 $USER  wheel       96 Sep 30 20:03:06 2026 .
drwxr-xr-x@ 13 $USER  wheel      416 Sep 30 20:07:55 2026 ..
-rw-r--r--@  1 $USER  wheel  5844838 Sep 30 20:03:06 2026 axe-results.json
axe-results.json
127.0.0.1_54896_big_1__desktop.png
127.0.0.1_54896___desktop.png
127.0.0.1_54896_news_post-118__reflow.png
````

## 72. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run2 && node $S/runstage.mjs summarize-after-sigint $S/run2 $S/cfg-resample.json summarize | tail -1; grep -c '"level":[45]0' $S/run2/summarize-after-sigint.stderr; grep -E "Generated|Final selected|Sample pages scanned|Page views|Grouped findings|Automated coverage" $S/run2/reports/summary.md; python3 - <<EOF
import json
s=json.load(open('$S/run2/reports/summary.json'))
sample=set(json.load(open('$S/run2/sample.json')))
pages=set()
for f in s['findings']:
  for p in f.get('pages',[]): pages.add(p)
print('finding pages not in current sample:', len(pages-sample), sorted(p.split(':54896')[1] for p in pages-sample)[:8])
w=json.load(open('$S/run2/reports/wcag-em-summary.json')); print('automatedCoverage', json.dumps(w.get('automatedCoverage'))[:300])
d=json.load(open('$S/run2/reports/report-builder-draft.json')); print('draft keys', list(d)[:10])
EOF
````

Output (truncated):

````text
{"label":"summarize-after-sigint","stage":"summarize","code":2,"signal":null,"wallSec":0.638,"peakTreeRssMB":0,"peakChromeProcs":0,"timeMaxRssMB":130,"nodePid":null}
0
Generated: 2026-09-30T19:08:10.394Z
- Final selected sample: 7
- Sample pages scanned: 24
- Page views scanned (pages x viewports): 48
- Grouped findings: 6
- Automated coverage: partial — PARTIAL (24/7 selected pages audited; 4 excluded — see Scan health)
## Grouped findings by rule
finding pages not in current sample: 15 ['/bad', '/bad/1', '/bad/2', '/bad/3', '/events/ev-1', '/forms/contact', '/hostile/alert', '/hostile/beforeunload']
automatedCoverage {"status": "partial", "adequate": false, "pagesSelected": 7, "pagesAudited": 24, "pagesExcluded": 4, "scopeExclusions": [{"outcome": "errored", "count": 4, "examples": ["htt ...
````

## 73. Bash

````bash
S=$SCRATCH/wf2/stress; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $S/run2 && node $S/runstage.mjs scan-sigkill $S/run2 $S/cfg-resample.json scan 15000 SIGKILL | tail -1; for w in 1 5; do sleep $w; python3 - <<EOF
import json,subprocess
t=json.load(open('$S/run2/scan-sigkill.prekill-tree.json'))
alive={l.split()[0]:l for l in subprocess.run(['ps','-A','-o','pid=,ppid=,etime=,comm='],capture_output=True,text=True).stdout.split('\n') if l.strip()}
surv=[alive[x['pid']] for x in t if x['pid'] in alive]
print('after +${w}s: prekill chrome', sum(1 for x in t if 'hrom' in (x.get('comm') or '')), 'survivors', len(surv)); [print('  ',s[:140]) for s in surv[:6]]
EOF
done
````

Output (truncated):

````text
{"label":"scan-sigkill","stage":"scan","code":1,"signal":null,"wallSec":15.401,"peakTreeRssMB":1895,"peakChromeProcs":4,"timeMaxRssMB":175,"nodePid":"66518"}
after +1s: prekill chrome 4 survivors 0
after +5s: prekill chrome 4 survivors 0
````

## 74. Bash

````bash
S=$SCRATCH/wf2/stress; cat $S/run1/inventory/document-inventory.json; grep -E '"failedRequestCount"|"failureReasons"' -A3 $S/run1/inventory/inventory-metadata.json | head -8; grep -n -i "crawl\|discover\|failed request\|inventory" $S/run1/reports/summary.md | head; grep -c "hang-img" $S/run1/reports/summary.md $S/run1/reports/manual-backlog.md
````

Output (truncated):

````text
{
  "tool": {
    "name": "wcag-em-a11y-toolkit",
    "version": "1.1.0",
    "axeCore": "4.11.2"
  },
  "site": "stress-site",
  "count": 0,
  "documents": []
}
  "failedRequestCount": 4,
  "failureReasons": {
    "navigation": 1,
    "timeout": 3
  },
16:- Inventory count: 414
44:- Force-included sample URL not in crawl inventory: http://127.0.0.1:54896/hostile/hang-img
45:- Force-included sample URL not in crawl inventory: http://127.0.0.1:54896/hostile/hang-font
46:- Force-included sample URL not in crawl inventory: http://127.0.0.1:54896/hostile/hang-defer
47:- Force-included sample URL not in crawl inventory: http://127.0.0.1:54896/hostile/export
$SCRATCH/wf2/stress/run1/reports/summary.md:2
$SCRATCH/wf2/stress/run1/reports/manual-backlog.md:0
````

## 75. Bash

````bash
W=$REPO; cd $W; grep -rn "failedRequestCount\|failureReasons" src/ --include=*.mjs | grep -v "^src/commands/discover.mjs" | head; R=$SCRATCH/review; grep -o '"id": "DISC-0[47]"[^}]*"claim": "[^"]*' $R/round1-findings.json | cut -c1-600
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.mjs
````

## 76. Bash

````bash
W=$REPO; cd $W; grep -rn "failedRequestCount\|failureReasons" src | grep -v "^src/commands/discover.mjs" | head; R=$SCRATCH/review; python3 -c "
import json
d=json.load(open('$R/round1-findings.json')); items=d if isinstance(d,list) else d.get('findings',d)
for f in items:
  if f['id'] in ('DISC-04','DISC-07','SCAN-09','SCAN-20','SCAN-21','SCAN-03'):
    print(f['id'], '|', f['claim'][:500]); print('   rec:', f['recommendation'][:250])
"
````

Output (truncated):

````text
DISC-04 | Crawlee stops at maxRequestsPerCrawl measured as requestsFinished + requestsFailed. That count includes failures, requests skipped after an off-strategy redirect, and requests whose final URL duplicates an existing entry. discover.mjs sets reachedMaxPages = inventory.length >= maxPages, which is false whenever any budgeted request produced no new inventory entry. Summarize's only crawl-truncation warning, and the Scan-health line in the md/html reports, depend on this flag.
   rec: Take the flag from Crawlee: after run(), compare crawler.stats.state.requestsFinished + requestsFailed against maxPages. Alternatively, set it from an onSkippedRequest handler that sees reason 'limit'/'enqueueLimit'. Record handledRequests, skippedBy
DISC-07 | page-guard (classifyPageOutcome) is used b ...
````

## 77. Bash

````bash
R=$SCRATCH/review; python3 -c "
import json,re
d=json.load(open('$R/round1-findings.json')); items=d if isinstance(d,list) else d.get('findings',d)
for f in items:
  t=json.dumps(f)
  for m in re.finditer(r'.{0,200}failedRequestCount.{0,200}', t): print(f['id'], '|', m.group(0)); break
"
````

Output (truncated):

````text
SAMP-02 | , /challenge (403 + cf-mitigated) and /members (401). inventory.json contained /boom (title 'Internal Server Error'), /missing ('404 Not Found') and /soft-404. /challenge and /members were counted in failedRequestCount instead. random-pool.txt listed all three error pages. With seed 42, random-sample.txt = [/news/post-3, /boom], so half the random tier was an HTTP 500 page. axe-results.json recorded /boom with no p
DISC-06 | ls to those credentials. The server saw 4 unauthenticated GET / attempts. Stderr showed 'Request blocked - received 401 status code' repeated, then 'reached maximum retries'. The inventory was empty, failedRequestCount 1 (http-error), exit 0. `grep -rn applyAuth src` lists only scan.mjs and scan-processes.mjs.", "impact": "Pre-launch staging audits, which the ...
````

## 78. Bash

````bash
S=$SCRATCH/wf2/stress/hang; cd $S; HANG_MS=60000 NAV=8 ./probe.sh disc-finite60 hang discover > $S/disc-finite60.result 2>&1; cat $S/disc-finite60.result; grep -h '"msg":"discover done"' $S/disc-finite60/out.log | grep -o '"time":"[^"]*"'; cat $S/disc-finite60/server.log | grep pixel
````

Output (truncated):

````text
Command running in background with ID: bzqa7qqx9. Output is being written to: $TMP If it exits while you are still working you will be notified, but it is terminated when you give your final response and no notification can follow that — so do not end your turn to wait for it; if you need its result, wait for it before giving your final response. To check interim output, use Read on that file path.
Session cwd remains $REPO; directory changes made by the backgrounded command do not apply to subsequent commands.
````

## 79. Bash

````bash
S=$SCRATCH/wf2/stress; W=$REPO; grep -rn -i "shadow" $W/src | grep -v "^\s*//" | head -8; A=$(python3 -c "import json;print(json.load(open('$S/ports.json'))['A'])"); cat > $S/shadowcdp.mjs <<EOF
import { chromium } from '$W/node_modules/playwright/index.mjs';
const b = await chromium.launch();
try {
  const p = await b.newPage();
  for (const path of ['/hostile/closed-shadow', '/hostile/open-shadow']) {
    await p.goto('$A' + path, { waitUntil: 'load' });
    const pageSees = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.shadowRoot).length);
    const cdp = await p.context().newCDPSession(p);
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const types = []; const walk = (n) => { for (const s of n.shadowRoots ?? []) { types.push(s.shadowRootType); walk(s); } for (const c of n.children ?? []) walk(c); if (n.contentDocument) walk(n.contentDocument); };
    walk(root);
    console.log(JSON.stringify({ path, pageJsSeesShadowRoots: pageSees, cdpShadowRootTypes: types }));
    await cdp.detach();
  }
} finally { await b.close(); }
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $S/shadowcdp.mjs
````

Output (truncated):

````text
$REPO/src/reporters/json.mjs:16: * would shadow it; the spread happens BEFORE `findings` is overridden.
{"path":"/hostile/closed-shadow","pageJsSeesShadowRoots":0,"cdpShadowRootTypes":["closed","user-agent","user-agent"]}
{"path":"/hostile/open-shadow","pageJsSeesShadowRoots":1,"cdpShadowRootTypes":["open","user-agent","user-agent"]}
````

## 80. Bash

````bash
W=$REPO; cd $W; grep -n "" node_modules/@crawlee/browser-pool/proxy-server.js | sed -n 4,14p; sed -n 92,97p bin/wcag-em.mjs; grep -n "" src/commands/discover.mjs | sed -n 246,248p; grep -n "" node_modules/@crawlee/browser/internals/browser-crawler.js | sed -n 326,326p; grep -n "" src/commands/scan.mjs | sed -n 176p; grep -n "" src/commands/scan.mjs | sed -n 453,456p; grep -n "" docs/guides/user-manual.md | sed -n 28,30p; grep -n "" TODO.md | sed -n 122,124p; git -C $W log --oneline -1
````

Output (truncated):

````text
4:const proxy_chain_1 = require("proxy-chain");
5:const server = new proxy_chain_1.Server({
6:    port: 0,
7:});
8:server.server.unref();
9:const listenPromise = server.listen();
10:listenPromise.catch(() => { });
11:// https://github.com/microsoft/playwright/blob/2e4722d460b5142267e0e506ca7ea9a259556b5f/packages/playwright-core/src/server/browserContext.ts#L423-L427
12:async function getLocalProxyAddress() {
13:    await listenPromise;
14:    return `http://127.0.0.1:${server.port}`;
function asHandler(fn) {
  return async function handler(/** @type {unknown} */ _arg, /** @type {any} */ cmd) {
    try {
      const exitCode = await fn(cmd);
      if (typeof exitCode === 'number') process.exitCode = exitCode;
    } catch (err) {
246:      // auto-wait to the handler budget and re-cause the ...
````

## 81. Bash

````bash
W=$REPO; cd $W; sed -n 249p src/commands/discover.mjs; grep -rln "SIGINT\|SIGTERM" test | head; grep -rln "attachShadow\|closed" test | head -5; grep -rn "exitCode\|process.exit\|hang" test/e2e/*.mjs | head -5; ls test/e2e
````

Output (truncated):

````text
      await page.waitForLoadState('domcontentloaded');
test/e2e/reporters-smoke.test.mjs
test/e2e/scan-cdp.test.mjs
test/e2e/scan-health.test.mjs
test/e2e/scan-challenge.test.mjs
test/e2e/discover-timeout.test.mjs
test/e2e/scan-redirect.test.mjs
test/unit/reporters-junit.test.mjs
test/unit/page-outcome-contract.test.mjs
test/unit/validate-config.test.mjs
test/unit/browser-session.test.mjs
test/fixtures/bad-regex.json
test/e2e/scan-cdp.test.mjs:123:  assert.notEqual(result.status, null, `audit did not crash/hang\nstderr:\n${result.stderr}`);
test/e2e/reporters-smoke.test.mjs:30: * localhost-fixture hang; the hang was inadvertently fixed by D2 (commit
authenticated-scan.test.mjs
discover-timeout.test.mjs
reporters-html-axe.test.mjs
reporters-smoke.test.mjs
scan-cdp.test.mjs
scan-challenge.te ...
````

## 82. Bash

````bash
W=$REPO; cd $W; grep -n "SIGINT\|SIGTERM\|SIGKILL" test/e2e/*.mjs | head -8; sed -n 25,40p test/e2e/reporters-smoke.test.mjs; grep -n "slow\|never\|timeout" test/e2e/discover-timeout.test.mjs | head -10
````

Output (truncated):

````text
test/e2e/discover-timeout.test.mjs:51:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
test/e2e/reporters-smoke.test.mjs:80:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
test/e2e/scan-cdp.test.mjs:85:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
test/e2e/scan-redirect.test.mjs:54:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
test/e2e/scan-challenge.test.mjs:59:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
test/e2e/scan-health.test.mjs:63:      killer = setTimeout(() => child.kill('SIGTERM'), opts.timeoutMs);
 * spawn lets Node's event loop drain pipes in real-time. Production users
 * running `wcag-em` from a shell don't hit this; only test harnesses that
 * invoke ...
````

## 83. Bash

````bash
W=$REPO; cd $W; wc -l docs/adr/0013-crawlee-localhost-investigation.md; grep -n -i "proxy\|hang\|exit\|socket\|event loop\|root cause\|D2\|waitUntil\|load" docs/adr/0013-crawlee-localhost-investigation.md | head -30
````

Output (truncated):

````text
     177 docs/adr/0013-crawlee-localhost-investigation.md
1:# 0013. Crawlee localhost-fixture hang investigation and resolution
8:  the hang during reporter pipeline development), ADR-0012 (extensibility-internal stance; relevant
10:  commit `df16649` is now load-bearing as the regression backstop)
15:tests were authored and immediately deferred behind a Crawlee-related hang:
24:fixture loaded in `<250 ms`. The two tests shipped as `test.skip` placeholders
30:verbatim crawled all 5 fixture pages in 991 ms — proving the hang lived
46:e2e test files claimed the D2 fix (`fix(discover): replace locator-based
49:so re-running them passed trivially without exercising the actual hang.
53:**The localhost-fixture hang was inadvertently fixed by D2 (commit `468f5c1`),
79:hang lives in `discover.run` ...
````

## 84. Bash

````bash
S=$SCRATCH/wf2/stress/hang; until [ -s $S/disc-finite60.result ]; do sleep 3; done; sleep 1; cat $S/disc-finite60.result; ls -laT $S/disc-finite60/inventory/inventory-metadata.json | awk '{print $8}'
````

Output (truncated):

````text
disc-finite60: exited code=0 after 87s
pixel answered 2026-09-30T19:12:07.822Z
open streams 0 2026-09-30T19:12:08.933Z
pixel answered 2026-09-30T19:12:15.902Z
20:11:23
````

## 85. Bash

````bash
S=$SCRATCH/wf2/stress; kill -TERM $(python3 -c "import json;print(json.load(open('$S/ports.json'))['pid'])") 2>/dev/null; sleep 1; ps -A -o pid,etime,command | grep -E "wf2/stress|sse-server|server.mjs|runstage" | grep -v grep | cut -c1-150; echo "---remaining"; git -C $REPO status --short | head; ls $REPO | grep -E "^storage$|^output$"
````

Output (truncated):

````text
13886    07:49:40 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
13887    07:49:40 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
14096    07:49:37 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
22637    06:13:54 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
22649    06:13:54 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
51923    09:38:25 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
51980    09:38:25 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
64046       56:38 /Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node ./server.mjs
64104       56:38 /Applications/ChatGPT.app/Cont ...
````

## 86. Bash

````bash
W=$REPO; kill -0 20484 2>&1 | head -1; ls -laT $W/output | head; find $W/output -newer $W/package.json -maxdepth 3 | head -5; ps -o pid,command -p 90439,78933 | cut -c1-250
````

Output (truncated):

````text
(eval):kill:1: kill 20484 failed: no such process
total 0
drwxr-xr-x@  6 $USER  staff   192 Sep 30 19:32:52 2026 .
drwxr-xr-x@ 32 $USER  staff  1024 Sep 30 11:50:32 2026 ..
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50:06 2026 inventory
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50:06 2026 reports
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50:06 2026 results
drwxr-xr-x@  3 $USER  staff    96 Sep 30 11:50:06 2026 screenshots
$REPO/output
  PID COMMAND
78933 node rich-server.mjs $SCRATCH/wf/empa/rich-ports.json
90439 node hostile-server.mjs $SCRATCH/wf/empb/ports.json
````

## 87. Bash

````bash
W=$REPO; cd $W; grep -rn "from 'crawlee'\|from '@crawlee\|import('crawlee')" src bin | head; grep -n "\"crawlee\"\|proxy-chain" package.json
````

Output (truncated):

````text
src/commands/discover.mjs:24:import { PlaywrightCrawler } from 'crawlee';
72:    "crawlee": "^3.16.0",
````

## 88. Bash

````bash
W=$REPO; cd $W; sed -n 123,126p TODO.md; sed -n 370,374p src/commands/summarize.mjs; sed -n 350,353p src/commands/scan.mjs; sed -n 153,155p docs/guides/user-manual.md; grep -n "" node_modules/@crawlee/browser-pool/playwright/playwright-plugin.js | sed -n 51,55p
````

Output (truncated):

````text
- [x] **Corrupt-artifact hardening.** `readJsonMaybe` treats `SyntaxError` like
      ENOENT (fs-utils.mjs:69-75) and `writeJson` is non-atomic — a corrupt
      `axe-results.json` yields an exit-0 "clean" report (probe P3). Distinguish + warn loudly; temp+rename writes. -> Sprint 1 T3.
- [ ] **Portal contract source-of-truth.** Replace the empirically-derived
      readJsonMaybe(
        path.join(paths.resultsDir, 'axe-results.json'),
        /** @type {any[]} */ ([]),
        logger,
      ),
    });

    let builder = new AxeBuilder({ page });

Two habits prevent most confusion: give every run its own `--out-dir` (stages
read whatever artifacts they find there — mixing runs in one directory mixes
their data), and read Scan health before reading findings.
51:        // Required for the  ...
````
