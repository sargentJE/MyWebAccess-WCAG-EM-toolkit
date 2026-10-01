# Probe record: crit:SEC-01

Role: critical second opinion. Findings: SEC-01

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SEC-01; grep -n "SEC-01" $SCRATCH/review/round1-experiments.json | head
````

Output (truncated):

````text
[
 {
  "dimension": "SEC",
  "id": "SEC-01",
  "title": "A dead or expired auth session is reported as a complete, fully passing audit of the protected pages",
  "category": "correctness",
  "severity": "critical",
  "status": "new",
  "trackedRef": "T-O is related but narrower: it covers setupScript/scripted login, not whether static auth actually took effect",
  "claim": "When an authenticated audit's session is not live at scan time, every protected URL redirects to the login page. The toolkit then scans the login page in its place, and the reports say the run was complete. This happens when the cookie has expired or been revoked, when storageState was captured on another host, or when the storageState path does not resolve. Nothing checks that auth worked. page-guard has no 'unauthenti ...
````

## 2. Bash

````bash
cd $REPO; cat -n src/lib/auth.mjs | sed -n 1,140p; echo ----; cat -n src/lib/page-guard.mjs
````

Output (truncated):

````text
     1	// @ts-check
     2	/**
     3	 * @file Authenticated-scan context builder.
     4	 * @module lib/auth
     5	 *
     6	 * @description
     7	 * `applyAuth(config)` builds the Playwright `browser.newContext` options
     8	 * needed to restore a user session before scans run. Supports:
     9	 *   - `storageState` (path to JSON file OR inline object — cookies +
    10	 *     localStorage),
    11	 *   - `httpCredentials` ({ username, password } for basic auth),
    12	 *   - `extraHttpHeaders` (custom headers merged into every request).
    13	 *
    14	 * `auth.setupScript` is schema-validated but runtime execution is
    15	 * deferred pending a security review; a one-shot `logger.warn` announces
    16	 * the deferral. Same discipline as `override.actions` in the compile-at-load ...
````

## 3. Bash

````bash
cd $REPO; grep -rn -i "finalUrl\|redirect" src --include=*.mjs | grep -v "^src/lib/discover" | head -80
````

Output (truncated):

````text
(eval):1: no matches found: --include=*.mjs
````

## 4. Bash

````bash
cd $REPO; grep -rn -i "finalUrl\|redirect" src | grep -v "^src/lib/discover" | head -100
````

Output (truncated):

````text
src/lib/sitemap.mjs:108:      const res = await fetch(sitemapUrl, { redirect: 'follow' });
src/lib/scan-results.mjs:19: * nothing — which let could-not-audit pages and redirect duplicates leak into
src/lib/scan-results.mjs:36: * @typedef {'auditable' | 'errored' | 'challenge' | 'empty' | 'redirect-duplicate'} ViewStatus
src/lib/scan-results.mjs:42: * a page-outcome tag, which wins over a redirect-duplicate marker.
src/lib/scan-results.mjs:62:  // A page-view that resolved to an already-scanned final URL (redirect
src/lib/scan-results.mjs:64:  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';
src/lib/scan-results.mjs:81: * The canonical URL identifying a page-view: the post-redirect `finalUrl` when
src/lib/scan-results.mjs:82: * present, else the requested `url`.  ...
````

## 5. Bash

````bash
cd $SCRATCH; python3 -c "
import json
d=json.load(open('review/round1-experiments.json'))
print(type(d), len(d))
items = d if isinstance(d,list) else d.get('experiments',d)
for e in (items if isinstance(items,list) else items.values()):
    s=json.dumps(e)
    if 'expired' in s.lower() or 'SEC-01' in s or 'auth' in s.lower():
        print(s[:3000]); print('---')
"; find . -iname "*expired*" | head
````

Output (truncated):

````text
<class 'list'> 145
{"dimension": "DISC", "what": "Challenge (403 and 200), Basic-auth staging, slash-sensitive server, SPA", "command": "node harness.mjs challenge403|challenge200|basicauth|slashdir|spa 1", "result": "403 challenge \u2192 empty inventory, exit 0; 200 challenge \u2192 'Just a moment...' inventoried as homepage; httpCredentials ignored \u2192 4\u00d7401, empty inventory, exit 0; /guides/ requested as /guides \u2192 404 inventoried; SPA fetched nav never discovered"}
---
{"dimension": "DISC", "what": "Config validation of documented values", "command": "node $SCR/probe-validate.mjs", "result": "scope.mode 'allow-list' INVALID; auth.extraHTTPHeaders INVALID; includeSubdomains and malformed allowedHosts accepted silently"}
---
{"dimension": "SEC", "what": "Two-origin probe: whi ...
````

## 6. Bash

````bash
cd $SCRATCH; cat wf/sec/probe-expired-session.mjs | head -150; ls -R wf/sec/run-expired | head -40
````

Output (truncated):

````text
// Authenticated audit whose session is dead (expired/invalid cookie, or storageState
// path resolved against a different CWD). Protected pages 302 -> /login. What does the
// run report about coverage?
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO = '$REPO';
const SCRATCH = path.dirname(new URL(import.meta.url).pathname);
const RUN = path.join(SCRATCH, 'run-expired');
await fs.rm(RUN, { recursive: true, force: true });
await fs.mkdir(RUN, { recursive: true });
const MODE = process.argv[2] ?? 'invalid-cookie'; // 'invalid-cookie' | 'missing-file'
const page = (t, b) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t ...
````

## 7. Bash

````bash
cd $SCRATCH/wf/sec/run-expired/out; cat reports/summary.md; echo ======; grep -n "login\|account" reports/*.json | cut -c1-300 | head -40
````

Output (truncated):

````text
Exit code 1
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **sec-expired**
Generated: 2026-09-30T11:17:26.496Z

## Method guardrails

- This is the automated layer of the audit workflow.
- It does not make a sitewide WCAG conformance claim on its own.
- Complete processes and manual checks still need separate review.

## Run summary

- Inventory count: 3
- Final selected sample: 3
- Sample pages scanned: 3
- Page views scanned (pages x viewports): 3
- Process runs: 0
- Grouped findings: 0
- Automated coverage: complete (3 selected pages audited)

## Random vs structured sample comparison

- New rule IDs found only in random sample: 0
- New clusters found only in random sample: 0
- Expand structured sample recommended: no

## Grouped findings by  ...
````

## 8. Bash

````bash
cd $SCRATCH/wf/sec/run-expired/out; grep -o "[^\"]*login[^\"]*\|[^\"]*account[^\"]*" reports/*.json results/*.json | sort | uniq -c | head -40; python3 -c "
import json; p=json.load(open('reports/portal-export.json')); print(json.dumps(p,indent=1)[:2500])"
````

Output (truncated):

````text
   1 results/axe-results.json:http://127.0.0.1:58067/account/orders
   1 results/axe-results.json:http://127.0.0.1:58067/account/profile
   1 results/axe-results.json:http://127.0.0.1:58067/account/settings
   1 results/axe-results.json:http://127.0.0.1:58067/login?next=%2Faccount%2Forders
   1 results/axe-results.json:http://127.0.0.1:58067/login?next=%2Faccount%2Fprofile
   1 results/axe-results.json:http://127.0.0.1:58067/login?next=%2Faccount%2Fsettings
{
 "scanMetadata": {
  "url": "http://127.0.0.1:58067/",
  "timestamp": "2026-09-30T11:17:26.496Z",
  "tool": "wcag-em-a11y-toolkit 1.1.0",
  "toolVersion": "1.1.0",
  "scanOptions": {
   "axeVersion": "4.11.2",
   "pagesScanned": 3,
   "sampleSize": 3,
   "inventorySize": 3,
   "pageViewsScanned": 3,
   "executionHealth": {
    "sample ...
````

## 9. Bash

````bash
cd $REPO; grep -rln "storageState" --exclude-dir=node_modules --exclude-dir=.git . | head -30; echo ---; grep -rn "\"auth\"" configs 2>/dev/null | head; ls configs
````

Output (truncated):

````text
CHANGELOG.md
test/unit/auth.test.mjs
test/unit/browser-session.test.mjs
test/unit/config-defaults.test.mjs
test/unit/browser-transport.test.mjs
test/e2e/authenticated-scan.test.mjs
docs/adr/0004-pino-structured-logging.md
docs/adr/0017-page-outcome-could-not-audit.md
docs/adr/0020-pluggable-browser-transport.md
docs/adr/0011-v1-release-boundary.md
docs/plans/2026-06-web-bot-auth-registration.md
docs/reviews/2026-06-epics-E1-E7.md
docs/guides/config-guide.md
docs/guides/user-manual.md
schemas/config.schema.json
configs/example-site-with-auth.json
src/types/config.d.ts
src/lib/browser.mjs
src/lib/logger.mjs
src/lib/auth.mjs
src/commands/scan-processes.mjs
src/commands/scan.mjs
---
configs/example-site-with-auth.json:70:  "auth": {
example-site-best-practice.json
example-site-with-auth.json
e ...
````

## 10. Bash

````bash
cd $REPO; grep -n -i -B2 -A12 "storageState\|auth" docs/guides/user-manual.md | sed -n 1,200p
````

Output (truncated):

````text
2-
3-Running the toolkit and understanding what comes out. For writing the config
4:itself, see the [config authoring guide](./config-guide.md); for what to do
5-with the portal and report-builder exports, see the
6-[integrations guide](./integrations.md).
7-
8-## 1. From install to first audit
9-
10-```bash
11-npm install wcag-em-a11y-toolkit
12-npx playwright install chromium
13-```
14-
15-Prerequisites: Node.js >= 22.11.0 (`node -v` to check; the CLI refuses older
16-runtimes with an explicit message) and the Chromium download above (the
--
143-| `Playwright browsers directory missing (<path>); run: npx playwright install`                   | Browser download was skipped. Run the printed command (`... install chromium` suffices).                                                           ...
````

## 11. Bash

````bash
cd $REPO; grep -n -i "auth" docs/guides/config-guide.md | head -40
````

Output (truncated):

````text
1:# Config authoring guide
122:| `challenge`           | detection on; wait off            | Bot/WAF challenge handling (E1). `waitForAutoSolveMs` (0–60000, default `0`) bounds the wait for a managed challenge to auto-clear before a page is recorded as unauditable; `hosts` adds extra hosts to the title+status heuristic (the `cf-mitigated` check is host-independent). Use `auth.extraHTTPHeaders` for a WAF bypass header. |
131:| `cdpEndpoint` | none           | Chrome DevTools Protocol endpoint (e.g. `http://127.0.0.1:9222`). When set, the scanner attaches over CDP to an already-running, human-cleared browser and reuses its default context — riding that session (e.g. a Cloudflare `cf_clearance`) — instead of launching its own. The `WCAG_EM_CDP_ENDPOINT` env var overrides this. AUTHORIZED audi ...
````

## 12. Bash

````bash
cd $REPO; sed -n 175,195p docs/guides/config-guide.md; sed -n 296,360p docs/guides/config-guide.md
````

Output (truncated):

````text
`["critical", "serious"]`), `classifications` (classification buckets that
count, default `[]`), `threshold` (finding GROUPS — unique rules, not
occurrences — at or above which the run exits `2`; default `1`; `0` disables).

### `auth` — authenticated scans

Absent by default (no auth). See section 5 for the walkthrough.

| Field              | Notes                                                                                                                                                                                  |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `storageState`     | Path to a Playwright storage-state JS ...
````

## 13. Bash

````bash
cd $REPO; grep -n -i "storageState\|login\|auth" docs/adr/0017-page-outcome-could-not-audit.md docs/adr/0011-v1-release-boundary.md docs/reviews/2026-06-epics-E1-E7.md | head -30; echo ---; sed -n 1,60p test/e2e/authenticated-scan.test.mjs
````

Output (truncated):

````text
docs/adr/0011-v1-release-boundary.md:29:| **Configuration**     | Ajv-validated `schemas/config.schema.json` with `validRegex` keyword, default tag profile, multi-viewport, per-URL overrides, auth, beforeScan actions, processes, document-link filtering. |
docs/adr/0011-v1-release-boundary.md:30:| **Scanning**          | Multi-viewport axe runs (ADR-0006), authenticated scans (`storageState`, `httpCredentials`, `extraHTTPHeaders`), per-URL axe overrides with first-match-wins semantics.                     |
docs/adr/0011-v1-release-boundary.md:42:| **Authenticated SPA crawler**       | `auth.setupScript` runtime execution is deferred pending a security review (Layer 3b follow-up). The schema validates the field; the runtime emits a `warnSchemaAcceptedRuntimeIgnored` via `src/lib/auth.mjs`.  ...
````

## 14. Bash

````bash
cd $REPO; cat test/fixtures/site.json.template; ls src/reporters; grep -n "fullPageScreenshots\|screenshot" src/lib/config-defaults.mjs 2>/dev/null | head; ls src/lib | head -60
````

Output (truncated):

````text
{
  "name": "e2e-fixture-site",
  "rootUrl": "__BASE_URL__/",
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
      "commonPaths": ["/sitemap.xml"],
      "maxUrls": 50
    }
  },
  "discovery": {
    "captureH1": true,
    "captureCanonical": true,
    "captureForms": true,
    "captureLandmarks": true,
    "captureSearchInputs": true
  },
  "sample": {
    "structuredManual": ["__BASE_URL__/index.html", "__BASE_URL__/about.html"],
    "autoSuggest": {
      "enabled": true,
      "perCluster": 1,
      "preferTypes": ["homepage", "form-or-contact", "policy", "cont ...
````

## 15. Bash

````bash
cd $REPO; grep -n "'[a-z-]*'" src/reporters/index.mjs | head -30; ls src/commands; grep -n "stages\|STAGES\|runStage\|import" src/commands/audit.mjs | head -30
````

Output (truncated):

````text
discover.mjs
sample.mjs
scan-processes.mjs
scan.mjs
summarize.mjs
ugrep: warning: src/commands/audit.mjs: No such file or directory
````

## 16. Bash

````bash
cd $REPO; sed -n 1,80p src/reporters/index.mjs | grep -n -i "json\|markdown\|html\|earl\|junit\|portal\|builder" | head -30; grep -n "audit" bin/wcag-em.mjs | head
````

Output (truncated):

````text
12: * `package.json` separately drops the `./reporters/*` export entry as part
27:import * as jsonReporter from './json.mjs';
28:import * as markdownReporter from './markdown.mjs';
29:import * as htmlReporter from './html.mjs';
30:import * as earlJsonldReporter from './earl-jsonld.mjs';
31:import * as junitReporter from './junit.mjs';
32:import * as portalExportReporter from './portal-export.mjs';
33:import * as reportBuilderStarterReporter from './report-builder-starter.mjs';
66: * Registered reporters: json, markdown, html, earl-jsonld, junit,
67: * portal-export, report-builder-starter.
72:  [jsonReporter.name, /** @type {ReporterModule} */ (jsonReporter)],
73:  [markdownReporter.name, /** @type {ReporterModule} */ (markdownReporter)],
74:  [htmlReporter.name, /** @type {ReporterModule} ...
````

## 17. Bash

````bash
cd $REPO; sed -n 185,230p bin/wcag-em.mjs; grep -n "reporters" src/lib/config.mjs schemas/config.schema.json | head
````

Output (truncated):

````text
      // configured `reporting.failOnFindings` policy (Pa11y-compatible).
      if (result && typeof result.exitCode === 'number') return result.exitCode;
    }),
  );

program
  .command('audit')
  .description('Run the full pipeline: discover -> sample -> scan -> scan-processes -> summarize.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
      const stages = ['discover', 'sample', 'scan', 'scan-processes', 'summarize'];
      let exitCode = 0;
      for (const stage of stages) {
        ctx.logger.info({ stage }, 'stage start');
        const { run } = await import(`../src/commands/${stage}.mjs`);
        const result = await run(ctx);
        ctx.logger.info({ stage }, 'stage done');
        if (result && typeof ...
````

## 18. Bash

````bash
mkdir -p $SCRATCH/wf2/crit-SEC-01; cat > $SCRATCH/wf2/crit-SEC-01/probe.mjs <<'EOF'
// Independent reproduction of SEC-01: dead auth session under full `audit` pipeline.
// argv[2] = dead | live | dead-dirtylogin
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const REPO = '$REPO';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const MODE = process.argv[2] ?? 'dead';
const RUN = path.join(HERE, 'run-' + MODE);
await fs.rm(RUN, { recursive: true, force: true });
await fs.mkdir(RUN, { recursive: true });
const html = (t, b) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t}</title></head><body><header><nav><a href="/">Home</a> <a href="/about">About</a> <a href="/login">Log in</a></nav></header><main><h1>${t}</h1>${b}</main><footer><p>f</p></footer></body></html>`;
const dirtyLogin = MODE === 'dead-dirtylogin';
const srv = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const authed = (req.headers.cookie ?? '').includes('session=VALID');
  if (u.pathname.startsWith('/account')) {
    if (!authed) { res.writeHead(302, { location: '/login?next=' + encodeURIComponent(u.pathname) }); return res.end(); }
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html('Account ' + u.pathname, '<p>private data</p><img src="/x.png"><button></button>'));
  }
  if (u.pathname === '/login') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html('Log in', dirtyLogin ? '<form><input type="email"><button>Sign in</button></form>' : '<form><label>Email <input type="email"></label><button>Sign in</button></form>'));
  }
  if (u.pathname === '/' || u.pathname === '/about') {
    res.writeHead(200, { 'content-type': 'text/html' });
    return res.end(html(u.pathname === '/' ? 'Home' : 'About', '<p>public</p><a href="/account/orders">Orders</a>'));
  }
  if (u.pathname === '/x.png') { res.writeHead(200, { 'content-type': 'image/png' }); return res.end(); }
  res.writeHead(404, { 'content-type': 'text/html' }); res.end(html('Not found', '<p>404</p>'));
});
srv.listen(0, '127.0.0.1');
await once(srv, 'listening');
const B = `http://127.0.0.1:${srv.address().port}`;
const cookieVal = MODE === 'live' ? 'VALID' : 'EXPIRED';
const cfg = {
  name: 'sec01-' + MODE, rootUrl: `${B}/`, scope: { mode: 'same-origin', allowedHosts: [] },
  crawl: { maxPages: 10, maxConcurrency: 1, requestTimeoutSecs: 30, requestDelayMs: 0, excludeUrlPatterns: [], sitemapSeeding: { enabled: false, urls: [], commonPaths: [], maxUrls: 10 } },
  sample: { structuredManual: [`${B}/`, `${B}/account/orders`, `${B}/account/profile`, `${B}/account/settings`], autoSuggest: { enabled: false, perCluster: 1, preferTypes: ['homepage'] }, randomPercentOfStructured: 0, minRandomPages: 0, randomSeed: 1, smallSiteSupplementaryScanThreshold: 0 },
  scan: { viewports: [{ id: 'desktop', width: 1280, height: 800 }], waitUntil: 'domcontentloaded', timeoutMs: 20000, retries: 0, fullPageScreenshots: true },
  processes: [],
  reporting: { reporters: ['json', 'markdown', 'html', 'earl-jsonld', 'junit', 'portal-export', 'report-builder-starter'], failOnFindings: { impacts: ['critical', 'serious'], classifications: [], threshold: 1 } },
  auth: { storageState: { cookies: [{ name: 'session', value: cookieVal, domain: '127.0.0.1', path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] } },
};
const cfgPath = path.join(RUN, 'config.json');
await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 1));
const OUT = path.join(RUN, 'out');
const r = await new Promise((resolve) => {
  const c = spawn(process.execPath, [path.join(REPO, 'bin/wcag-em.mjs'), 'audit', '--config', cfgPath, '--out-dir', OUT], { cwd: RUN, env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(RUN, 'crawlee-storage') } });
  let err = '', out = '';
  c.stderr.on('data', (d) => (err += d)); c.stdout.on('data', (d) => (out += d));
  c.on('close', (code) => resolve({ code, err, out }));
});
await fs.writeFile(path.join(RUN, 'stderr.log'), r.err);
await fs.writeFile(path.join(RUN, 'stdout.log'), r.out);
const warns = (r.err + r.out).split('\n').filter((l) => /"level":(40|50)/.test(l)).map((l) => { try { return JSON.parse(l).msg; } catch { return l; } });
console.log(`== MODE ${MODE} audit exit ${r.code}; warn/error lines:`, warns);
srv.close();
EOF
cd $SCRATCH/wf2/crit-SEC-01 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && for m in dead live dead-dirtylogin; do node probe.mjs $m; done
````

Output (truncated):

````text
== MODE dead audit exit 0; warn/error lines: [ 'structured sample contains URLs not found in inventory' ]
== MODE live audit exit 2; warn/error lines: [ 'structured sample contains URLs not found in inventory' ]
== MODE dead-dirtylogin audit exit 2; warn/error lines: [ 'structured sample contains URLs not found in inventory' ]
````

## 19. Bash

````bash
cd $SCRATCH/wf2/crit-SEC-01; for m in dead live dead-dirtylogin; do echo "######## $m"; ls run-$m/out run-$m/out/reports; python3 - <<EOF
import json
ax=json.load(open('run-$m/out/results/axe-results.json'))
for e in ax: print(' ', e['url'].split('/',3)[3], '->', (e.get('finalUrl') or '').split('/',3)[3], '|', e.get('title'), '| viol', len(e.get('violations',[])), '| dup', e.get('redirectedToAlreadyScanned'), '| outcome', e.get('pageOutcome'), '| status', e.get('status'))
inv=json.load(open('run-$m/out/inventory/inventory.json'))
print('  inventory:', [ (i['url'].split('/',3)[3], i.get('pageType')) for i in inv])
EOF
grep -n -i "coverage\|scanned\|audited\|excluded\|login\|not found in inventory\|missing" run-$m/out/reports/summary.md | head -20; done
````

Output (truncated):

````text
######## dead
run-dead/out:
inventory
reports
results
sample.json
screenshots

run-dead/out/reports:
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
   ->  | Home | viol 0 | dup None | outcome None | status None
  account/orders -> login?next=%2Faccount%2Forders | Log in | viol 0 | dup None | outcome None | status None
  account/profile -> login?next=%2Faccount%2Fprofile | Log in | viol 0 | dup None | outcome None | status None
  account/settings -> login?next=%2Faccount%2Fsettings | Log in | viol 0 | dup None | outcome None | status None
  inventory: [('', 'homepage'), ('about', 'content'), ('login', 'content'),  ...
````

## 20. Bash

````bash
cd $SCRATCH/wf2/crit-SEC-01/run-dead/out/reports; sed -n 1,80p summary.md; echo; echo "#### login mentions per file:"; grep -c -i "login" *; echo "#### account mentions per file:"; grep -c "account" *
````

Output (truncated):

````text
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **sec01-dead**
Generated: 2026-09-30T19:07:13.012Z

## Method guardrails

- This is the automated layer of the audit workflow.
- It does not make a sitewide WCAG conformance claim on its own.
- Complete processes and manual checks still need separate review.

## Run summary

- Inventory count: 4
- Final selected sample: 4
- Sample pages scanned: 4
- Page views scanned (pages x viewports): 4
- Process runs: 0
- Grouped findings: 0
- Automated coverage: complete (4/4 selected pages audited)

## Scan health

- Force-included sample URL not in crawl inventory: http://127.0.0.1:56897/account/orders
- Force-included sample URL not in crawl inventory: http://127.0.0.1:56897/account/profile
- Force-included ...
````

## 21. Bash

````bash
cd $SCRATCH/wf2/crit-SEC-01; echo "#### dirtylogin login mentions:"; grep -c -i "login" run-dead-dirtylogin/out/reports/*; sed -n '/Grouped findings by rule/,$p' run-dead-dirtylogin/out/reports/summary.md | head -40; echo "#### live summary scan health:"; sed -n '/Run summary/,/Random vs/p' run-live/out/reports/summary.md
````

Output (truncated):

````text
#### dirtylogin login mentions:
run-dead-dirtylogin/out/reports/earl.jsonld:4
run-dead-dirtylogin/out/reports/junit.xml:3
run-dead-dirtylogin/out/reports/grouped-by-rule.json:7
run-dead-dirtylogin/out/reports/grouped-by-component.json:3
run-dead-dirtylogin/out/reports/manual-backlog.md:0
run-dead-dirtylogin/out/reports/random-vs-structured-comparison.json:0
run-dead-dirtylogin/out/reports/portal-export.json:1
run-dead-dirtylogin/out/reports/summary.md:1
run-dead-dirtylogin/out/reports/summary.html:2
run-dead-dirtylogin/out/reports/report-builder-draft.json:16
run-dead-dirtylogin/out/reports/wcag-em-summary.json:0
run-dead-dirtylogin/out/reports/summary.json:8
## Grouped findings by rule

### label
- Impact: critical
- Classification: primary-automated-finding
- Pages affected: 3
- Page typ ...
````

## 22. Bash

````bash
cd $SCRATCH/wf2/crit-SEC-01/run-dead/out; ls screenshots; python3 - <<'EOF'
import json
p=json.load(open('reports/portal-export.json'))
print('PORTAL summary', json.dumps(p['summary']))
print('PORTAL execHealth', json.dumps(p['scanMetadata']['scanOptions'].get('executionHealth')))
print('PORTAL keys', list(p.keys()), [k for k in p if 'page' in k.lower()])
s=json.dumps(p)
import re
print('portal account ctx:', [s[m.start()-120:m.end()+60] for m in re.finditer('account',s)][:3])
rb=json.load(open('reports/report-builder-draft.json'))
print('RB keys', list(rb.keys()))
srb=json.dumps(rb)
print('rb account ctx:', [srb[m.start()-200:m.end()+80] for m in re.finditer('account/orders',srb)][:2])
for k in ('conformance','summary','executiveSummary','overallConformance','scope'):
    if k in rb: print('RB',k, json.dumps(rb[k])[:800])
w=json.load(open('reports/wcag-em-summary.json'))
print('WEM keys', list(w.keys()))
for k in w:
    v=json.dumps(w[k])
    if any(x in k.lower() for x in ('coverage','health','sample','result','conform','summary')): print('WEM',k, v[:600])
EOF
````

Output (truncated):

````text
127.0.0.1_56897___desktop.png
127.0.0.1_56897_account_orders__desktop.png
127.0.0.1_56897_account_profile__desktop.png
127.0.0.1_56897_account_settings__desktop.png
PORTAL summary {"totalIssues": 0, "reportedTotal": 0, "manualReviewIssues": 0, "averageScore": 100, "scoreBasis": {"passed": 10, "failed": 0, "cantTell": 0, "inapplicable": 11, "notTested": 36}, "scoreSource": "wcag-em-criterion-outcomes"}
PORTAL execHealth {"sampleListedCount": 4, "pagesInSample": 4, "pagesFullyScanned": 4, "pagesDegraded": [], "pagesFailed": [], "pagesUnauditable": [], "challengePages": 0, "structuredMissingFromInventory": [{"url": "http://127.0.0.1:56897/account/orders", "reason": "not-in-inventory"}, {"url": "http://127.0.0.1:56897/account/profile", "reason": "not-in-inventory"}, {"url": "http://127.0.0.1:5 ...
````

## 23. Bash

````bash
cd $SCRATCH/wf2/crit-SEC-01; python3 - <<'EOF'
import json
for m in ('dead','live'):
    w=json.load(open(f'run-{m}/out/reports/wcag-em-summary.json'))
    co=w['criteriaOutcomes']
    items = co if isinstance(co,list) else list(co.values())
    sel={}
    for c in items:
        sc=c.get('sc') or c.get('id') or c.get('criterion')
        if str(sc) in ('1.1.1','4.1.2','1.3.1','2.4.2','3.3.2'): sel[sc]=c.get('outcome') or c.get('result')
    print(m, sel)
EOF
head -c 1500 run-dead/out/reports/junit.xml; echo; grep -o 'testsuite [^>]*' run-dead/out/reports/junit.xml | head
````

Output (truncated):

````text
dead {'1.1.1': 'inapplicable', '1.3.1': 'passed', '2.4.2': 'passed', '3.3.2': 'passed', '4.1.2': 'passed'}
live {'1.1.1': 'failed', '1.3.1': 'passed', '2.4.2': 'passed', '3.3.2': 'inapplicable', '4.1.2': 'failed'}
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="WCAG-EM Audit" tests="0" failures="0" time="0">
</testsuite>

testsuite name="WCAG-EM Audit" tests="0" failures="0" time="0"
````

## 24. Bash

````bash
cd $REPO; echo "## auth refs in summarize/reporters/wcag-em-summary:"; grep -n -i "auth" src/commands/summarize.mjs src/reporters/*.mjs src/lib/wcag-em-summary.mjs | grep -v -i "author" | head; echo "## applyAuth callers:"; grep -rn "applyAuth\|auth\.warnings\|warnings" src/commands/scan.mjs src/commands/discover.mjs src/lib/browser.mjs | head -20; echo "## ADR-0005 scope:"; sed -n 1,60p docs/adr/0005-fail-fast-on-config.md | grep -v "^$" | head -45
````

Output (truncated):

````text
## auth refs in summarize/reporters/wcag-em-summary:
src/commands/summarize.mjs:26:import { warnLegacyAliasResolved } from '../lib/auth.mjs';
## applyAuth callers:
src/commands/scan.mjs:13: * `applyAuth()` for storageState + httpCredentials.
src/commands/scan.mjs:32:import { applyAuth } from '../lib/auth.mjs';
src/commands/scan.mjs:195:  // one-shot call at run-entry; warnings emitted immediately, not per URL.
src/commands/scan.mjs:196:  const { contextOptions: authContextOptions, warnings: authWarnings } = applyAuth(config);
src/commands/scan.mjs:200:  // page-view's context lifecycle. Launch today; warnings (e.g. transport
src/commands/scan.mjs:201:  // selection) are surfaced once here, mirroring the applyAuth warnings above.
src/commands/scan.mjs:203:  for (const w of session.warnings) ...
````

## 25. Bash

````bash
cd $REPO; grep -n -i "waitFor\b\|waitForSelector\|\"waitFor\"" schemas/config.schema.json src/commands/scan.mjs | head; grep -rn -i "session\|login" docs/guides/config-guide.md docs/guides/user-manual.md | grep -v -i "codegen\|storage" | head
````

Output (truncated):

````text
schemas/config.schema.json:693:          "enum": ["goto", "click", "fill", "press", "waitFor", "screenshot", "axe"]
docs/guides/config-guide.md:131:| `cdpEndpoint` | none           | Chrome DevTools Protocol endpoint (e.g. `http://127.0.0.1:9222`). When set, the scanner attaches over CDP to an already-running, human-cleared browser and reuses its default context — riding that session (e.g. a Cloudflare `cf_clearance`) — instead of launching its own. The `WCAG_EM_CDP_ENDPOINT` env var overrides this. AUTHORIZED audits only. Under it, `auth.*` is also ignored. |
docs/guides/config-guide.md:135:Under `cdpEndpoint` the external browser owns the session, so `auth.*`,
docs/guides/config-guide.md:143:session. (`discover` / `audit` keep the local-Chromium preflight check;
docs/guides/config-guide. ...
````
