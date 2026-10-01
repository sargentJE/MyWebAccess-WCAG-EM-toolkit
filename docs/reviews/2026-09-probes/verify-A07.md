# Probe record: verify:A07

Role: packet verifier. Findings: PROC-08, SEC-02, SEC-06, SEC-08, SEC-12, SEC-22

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" PROC-08,SEC-02,SEC-06,SEC-08,SEC-12,SEC-22
````

Output (truncated):

````text
[
 {
  "dimension": "PROC",
  "id": "PROC-08",
  "title": "A failed `fill` leaks its value (e.g. a password) into summary.md, summary.html, summary.json, portal-export.json and the report-builder draft",
  "category": "security",
  "severity": "high",
  "status": "new",
  "claim": "Step errors are stored verbatim. When a fill's locator resolves but the action fails (for example the id sits on a wrapper div of a custom widget), Playwright's call log includes `fill(\"<value>\")`. That text flows through processStepFailures into every report and export, and into the CLI log, without redaction.",
  "evidence": [
   {
    "file": "src/lib/process-runner.mjs",
    "line": 164,
    "excerpt": "const message = err instanceof Error ? err.message : String(err);"
   },
   {
    "file": "src/lib/proce ...
````

## 2. Bash

````bash
R=$REPO; cd $R; sed -n 1,140p src/lib/auth.mjs; echo ----; sed -n 1,90p src/lib/logger.mjs
````

Output (truncated):

````text
// @ts-check
/**
 * @file Authenticated-scan context builder.
 * @module lib/auth
 *
 * @description
 * `applyAuth(config)` builds the Playwright `browser.newContext` options
 * needed to restore a user session before scans run. Supports:
 *   - `storageState` (path to JSON file OR inline object — cookies +
 *     localStorage),
 *   - `httpCredentials` ({ username, password } for basic auth),
 *   - `extraHttpHeaders` (custom headers merged into every request).
 *
 * `auth.setupScript` is schema-validated but runtime execution is
 * deferred pending a security review; a one-shot `logger.warn` announces
 * the deferral. Same discipline as `override.actions` in the compile-at-load step.
 *
 * Synchronous by design — called once per scan run, not per URL, so
 * `fs.statSync` + `spawnSync` ar ...
````

## 3. Bash

````bash
R=$REPO; cd $R; sed -n 130,200p src/lib/process-runner.mjs; echo ----; grep -rn "processStepFailures\|stepFailures" src | head -40
````

Output (truncated):

````text
  // E1: once a step errors, every subsequent recorded state ran against a page
  // whose intended setup did not complete — tag it `degraded` so reporters can
  // flag findings of uncertain provenance (the failed step itself surfaces via
  // executionHealth.processStepFailures).
  let priorStepErrored = false;
  for (const step of steps) {
    const result = await runStep(step, ctx);
    if (result) {
      if (priorStepErrored) result.degraded = true;
      states.push(result);
      if (result.state === 'error' || result.state === 'step-timeout') priorStepErrored = true;
    }
  }
  return states;
}

/**
 * Run a single step. Returns the state entry to append (or `null` when the
 * action produces no state — e.g. bare navigation).
 *
 * @param {any} step
 * @param {StepContext} ctx
 * ...
````

## 4. Bash

````bash
ls $SCRATCH/review/ | head -50; python3 -c "
import json
d=json.load(open('$SCRATCH/review/round1-experiments.json'))
print(type(d), len(d))
for e in (d if isinstance(d,list) else d.values()):
  s=json.dumps(e)
  if any(k in s for k in ['fill-leak','two-origin','basic-cross','probe-cors','userinfo','redact','pack']): print(s[:600]); print()
"
````

Output (truncated):

````text
round1-coverage.json
round1-experiments.json
round1-findings.json
round1-index.txt
round1-strengths.json
<class 'list'> 145
{"dimension": "VERD", "what": "Engine version actually injected compared with the stamped version", "command": "node -e (reading axe-core and @axe-core/playwright package.json)", "result": "axe-core 4.11.3 is injected (dependency ~4.11.3); TOOL_IDENTITY.axeCore reads the wrapper's 4.11.2"}

{"dimension": "PROC", "what": "Failed fill value leakage", "command": "node probe-fill-leak.mjs", "result": "The secret 'PROBE-S3cret-Value-42' appeared in process-results.json, summary.json, summary.md, summary.html, portal-export.json, report-builder-draft.json and the CLI logs."}

{"dimension": "SEC", "what": "Two-origin probe: which requests carry extraHttpHeaders, httpCredenti ...
````

## 5. Bash

````bash
R=$REPO; cd $R; grep -rn -i "extraHttpHeaders\|httpCredentials\|third-part\|origin" docs/adr/0021* docs/adr/0001* docs/adr/0020* docs/guides/config-guide.md TODO.md CHANGELOG.md 2>/dev/null | grep -i -v "^.*originally" | head -60
````

Output (truncated):

````text
docs/adr/0021-waf-challenge-access-strategy.md:71:2. **Domain-side allowlist (IP or secret header via `auth.extraHTTPHeaders`).**
docs/adr/0021-waf-challenge-access-strategy.md:116:   header via `auth.extraHTTPHeaders`. Make "allow the auditor" a normal step of
docs/adr/0021-waf-challenge-access-strategy.md:142:  a real-user User-Agent and rendering path, so the origin cannot serve a
docs/adr/0001-project-conventions.md:192:This respects the audit-method reasoning the original author encoded in each
docs/adr/0020-pluggable-browser-transport.md:24:- a WAF bypass header supplied through E1's `auth.extraHTTPHeaders`, or
docs/adr/0020-pluggable-browser-transport.md:142:  delivered through E1's `auth.extraHTTPHeaders` — are the supported long-term
docs/guides/config-guide.md:54:| `mode`         ...
````

## 6. Bash

````bash
R=$REPO; cd $R; ls schemas 2>/dev/null || ls; grep -rln "httpCredentials" --include=*.json . | grep -v node_modules | head
````

Output (truncated):

````text
config.schema.json
portal-canonical-scan.schema.json
report-builder-draft.schema.json
(eval):1: no matches found: --include=*.json
````

## 7. Bash

````bash
R=$REPO; cd $R; python3 -c "
import json
s=json.load(open('schemas/config.schema.json'))
print(json.dumps(s['properties']['auth'],indent=1)[:3000])
print(json.dumps(s['properties'].get('rootUrl'),indent=1))
"
````

Output (truncated):

````text
{
 "type": "object",
 "additionalProperties": false,
 "properties": {
  "storageState": {
   "oneOf": [
    {
     "type": "string",
     "minLength": 1
    },
    {
     "type": "object"
    }
   ]
  },
  "httpCredentials": {
   "type": "object",
   "additionalProperties": false,
   "required": [
    "username",
    "password"
   ],
   "properties": {
    "username": {
     "type": "string"
    },
    "password": {
     "type": "string"
    }
   }
  },
  "setupScript": {
   "type": "string",
   "minLength": 1
  },
  "ttlMinutes": {
   "type": "integer",
   "minimum": 1
  },
  "extraHttpHeaders": {
   "type": "object",
   "additionalProperties": {
    "type": "string"
   }
  }
 }
}
{
 "type": "string",
 "format": "uri",
 "pattern": "^https?://",
 "description": "Absolute URL of the site ro ...
````

## 8. Bash

````bash
R=$REPO; cd $R; cat test/fixtures/site.json.template; grep -n "export\|newContext\|authContextOptions" src/lib/browser.mjs | head -40
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

## 9. Bash

````bash
R=$REPO; cd $R; grep -rn "applyAuth\|openPageView" src | grep -v "^src/lib/auth.mjs\|^src/lib/browser.mjs"; echo ---; grep -n "case 'fill'\|fill(" src/lib/process-runner.mjs; python3 -c "
import json
s=json.load(open('schemas/config.schema.json'))
p=s['properties']['processes']
print(json.dumps(p,indent=1)[:2500])
"
````

Output (truncated):

````text
src/lib/config.mjs:165:  // required". `applyAuth` in auth.mjs handles the no-auth case by
src/commands/scan-processes.mjs:27:import { applyAuth } from '../lib/auth.mjs';
src/commands/scan-processes.mjs:29:import { acquireBrowserSession, openPageView, disposeBrowserSession } from '../lib/browser.mjs';
src/commands/scan-processes.mjs:84: * its page-view through the browser seam (`openPageView`) inside the try/catch
src/commands/scan-processes.mjs:101: *   - Playwright newContext options from `applyAuth(config)`; storageState,
src/commands/scan-processes.mjs:103: *     `applyAuth` call fires once per scan rather than per-process. Empty
src/commands/scan-processes.mjs:126:    view = await openPageView(session, viewport, contextOptions);
src/commands/scan-processes.mjs:161:    // undefined whe ...
````

## 10. Bash

````bash
R=$REPO; cd $R; sed -n 200,275p src/lib/process-runner.mjs; python3 -c "
import json
s=json.load(open('schemas/config.schema.json'))
print(json.dumps(s['\$defs']['action'],indent=1)[:1500])
"; sed -n 210,240p src/commands/summarize.mjs
````

Output (truncated):

````text
  };
}

/**
 * Route a step to its Playwright action. Returns the state entry to append
 * (or `null` when no state needs recording for this action).
 *
 * @param {any} step
 * @param {StepContext} ctx
 * @returns {Promise<StepResult | null>}
 */
async function dispatch(step, ctx) {
  const { page, config, paths, processDef, viewport } = ctx;
  switch (step.action) {
    case 'goto':
      // E1: retain the navigation Response so a later `axe` step can classify
      // the landed page. Overwritten on every goto (latest-navigation wins).
      ctx.lastResponse = await page.goto(step.url, {
        waitUntil: config.scan.waitUntil,
        timeout: config.scan.timeoutMs,
      });
      return null;

    case 'click':
      await page.locator(step.selector).first().click();
      return nul ...
````

## 11. Bash

````bash
R=$REPO; cd $R; grep -rn "executionHealth\|\.error\b" src/reporters/*.mjs | head -30; ls src/reporters
````

Output (truncated):

````text
src/reporters/html.mjs:188:  const health = summary.executionHealth;
src/reporters/html.mjs:217:    out += html`<li><strong>Not scanned</strong> (all viewports failed): <code>${p.url}</code> — ${p.failures?.[0]?.error ?? 'unknown error'}</li>\n`;
src/reporters/html.mjs:224:    out += html`<li>Process "${p.name}" failed at <code>${p.startUrl}</code>: ${p.error}</li>\n`;
src/reporters/html.mjs:236:    out += html`<li>Process "${p.name}" step "${p.state}" failed at <code>${p.startUrl}</code>: ${p.error ?? 'unknown error'}</li>\n`;
src/reporters/junit.mjs:133:  const health = summary.executionHealth;
src/reporters/junit.mjs:143:          `    <error type="scan-failure"><![CDATA[${defuseCdata(String(failure.error ?? 'scan failed'))}]]></error>\n` +
src/reporters/markdown.mjs:62: * @param {Recor ...
````

## 12. Bash

````bash
R=$REPO; cd $R; grep -n -i "error\|health\|step\|failure" src/reporters/portal-export.mjs src/reporters/report-builder-starter.mjs | head -40
````

Output (truncated):

````text
src/reporters/report-builder-starter.mjs:9: * without the consumer-side evidence/draft two-step (which the 2026-06
src/reporters/report-builder-starter.mjs:186:    // E1: isAuditableView subsumes the prior `error` check and also excludes
src/reporters/report-builder-starter.mjs:228:    ...(ex?.failureSummary ? [`Axe: ${ex.failureSummary}`] : []),
src/reporters/report-builder-starter.mjs:278:    const ajv = new Ajv2020({ allErrors: true, strict: false });
src/reporters/report-builder-starter.mjs:557:    nextSteps: [
src/reporters/report-builder-starter.mjs:579:      const issues = (validate.errors ?? [])
src/reporters/report-builder-starter.mjs:582:      if (validateMode === 'error') {
src/reporters/report-builder-starter.mjs:583:        throw new Error(`report-builder-starter: draft fails  ...
````

## 13. Bash

````bash
R=$REPO; cd $R; sed -n 290,330p src/commands/summarize.mjs; grep -n "limitations\|scanLimitations\|caveats" src/reporters/portal-export.mjs src/reporters/report-builder-starter.mjs | head
````

Output (truncated):

````text
      `page failed to scan on all viewports: ${p.url} (${p.failures[0]?.error ?? 'unknown error'})`,
    );
  }
  for (const p of pagesDegraded) {
    warnings.push(
      `page failed on viewport(s) ${p.failures.map((f) => f.viewport).join(', ')}: ${p.url}`,
    );
  }
  for (const p of processFailures) {
    warnings.push(`process "${p.name}" failed at ${p.startUrl}: ${p.error}`);
  }
  for (const p of preScanFailures) {
    warnings.push(
      `pre-scan action "${p.action}" ${p.state} on ${p.url} [${p.viewport}] — axe scanned the page without the intended setup`,
    );
  }
  for (const p of pagesUnauditable) {
    const outcomes = [...new Set(p.views.map((v) => v.outcome))].join(', ');
    warnings.push(
      `could not audit (${outcomes}): ${p.url} — excluded from findings and SC ve ...
````

## 14. Bash

````bash
R=$REPO; cd $R; grep -n "warnings" src/reporters/portal-export.mjs src/reporters/report-builder-starter.mjs src/reporters/earl-jsonld.mjs src/reporters/junit.mjs | head
````

Output (truncated):

````text
src/reporters/report-builder-starter.mjs:449:      title: 'Scan warnings',
````

## 15. Bash

````bash
R=$REPO; cd $R; sed -n 435,460p src/reporters/report-builder-starter.mjs; grep -n "summary\.\|warning\|note" src/reporters/portal-export.mjs | head -30
````

Output (truncated):

````text
    appendices.push({
      title: 'Automated coverage limits',
      content:
        `${untestedScs.length} success criteria at or below the conformance target were not ` +
        `touched by any automated rule and remain to be evaluated manually: ` +
        untestedScs
          .map((/** @type {any} */ c) => `${c.sc} ${scNames[String(c.sc)] ?? ''}`.trim())
          .join('; ') +
        '.',
    });
  }
  const scanWarnings = Array.isArray(summary.scanWarnings) ? summary.scanWarnings : [];
  if (scanWarnings.length > 0) {
    appendices.push({
      title: 'Scan warnings',
      content: scanWarnings.join(' | '),
    });
  }

  const draft = {
    schemaVersion: '1.0',
    reportType: 'technical-audit',
    meta: {
      title: `Accessibility audit draft — ${site}`,
      subtitle:  ...
````

## 16. Bash

````bash
R=$REPO; cd $R; grep -n "log-level\|logLevel\|command(\|createLogger" bin/wcag-em.mjs src/cli*.mjs src/commands/audit.mjs 2>/dev/null | head -30; ls src src/commands
````

Output (truncated):

````text
(eval):1: no matches found: src/cli*.mjs
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
````

## 17. Bash

````bash
R=$REPO; cd $R; grep -n "log-level\|logLevel\|\.command(\|createLogger\|audit" bin/wcag-em.mjs src/index.mjs | head -30
````

Output (truncated):

````text
src/index.mjs:7: * Re-exports the public surface so embedders can run audits in-process:
src/index.mjs:19:export { createLogger, getLogger } from './lib/logger.mjs';
src/index.mjs:26: * Run the full audit pipeline in a single call. For embedders who don't
bin/wcag-em.mjs:9: *   discover | sample | scan | scan-processes | summarize | audit
bin/wcag-em.mjs:44:import { createLogger } from '../src/lib/logger.mjs';
bin/wcag-em.mjs:59:  .option('-l, --log-level <level>', 'pino log level (trace|debug|info|warn|error|fatal)', 'info')
bin/wcag-em.mjs:60:  .option('--quiet', 'alias for --log-level=warn')
bin/wcag-em.mjs:61:  .option('--verbose', 'alias for --log-level=debug');
bin/wcag-em.mjs:75:  const logLevel = opts.verbose ? 'debug' : opts.quiet ? 'warn' : opts.logLevel;
bin/wcag-em.mjs:79:    l ...
````

## 18. Bash

````bash
R=$REPO; cd $R; sed -n 66,95p bin/wcag-em.mjs; grep -rn "WCAG_EM_LOG_LEVEL" --exclude-dir=node_modules . | grep -v "^./.git" | head
````

Output (truncated):

````text
 * Build a RunContext from global options and a per-subcommand Playwright
 * requirement flag.
 *
 * @param {import('commander').Command} cmd
 * @param {{ requirePlaywright?: boolean, browserTransportAware?: boolean }} [subOpts]
 * @returns {Promise<import('../src/lib/context.mjs').RunContext>}
 */
async function buildCtxFromProgram(cmd, subOpts = {}) {
  const opts = cmd.optsWithGlobals();
  const logLevel = opts.verbose ? 'debug' : opts.quiet ? 'warn' : opts.logLevel;
  return buildContext({
    configPath: opts.config,
    outDir: opts.outDir,
    logLevel,
    requirePlaywright: subOpts.requirePlaywright,
    browserTransportAware: subOpts.browserTransportAware,
  });
}

/**
 * Wrap a command handler so errors exit 1 with a clean message instead of a
 * raw stack trace.
 *
 * @param {( ...
````

## 19. Bash

````bash
R=$REPO; cd $R; grep -n "createLogger\|logLevel" src/lib/context.mjs; grep -rn "WCAG_EM_LOG\|log-level" README.md docs | head; sed -n 20,60p docs/adr/0004-pino-structured-logging.md
````

Output (truncated):

````text
25:import { createLogger } from './logger.mjs';
150: * @property {import('./logger.mjs').LogLevel} [logLevel] - Override for `--log-level`.
231:  const logger = createLogger({ level: options.logLevel });
README.md:62:`--log-level <level>`, `--quiet`, and `--verbose` flags.
docs/adr/0003-commander-cli.md:27:- `-l, --log-level <level>` — pino level (`trace|debug|info|warn|error|fatal`).
docs/adr/0003-commander-cli.md:28:- `--quiet` — alias for `--log-level=warn`.
docs/adr/0003-commander-cli.md:29:- `--verbose` — alias for `--log-level=debug`.
docs/adr/0001-project-conventions.md:51:- Global flags: `--config`, `--out-dir`, `--log-level`, `--verbose`, `--quiet`.
docs/guides/user-manual.md:41:`--log-level <trace|debug|info|warn|error|fatal>`, `--quiet` (= warn),
NDJSON when piped. One shared fa ...
````

## 20. Bash

````bash
S=$SCRATCH/wf2/verify-A07; mkdir -p $S; ls $S; R=$REPO; sed -n 1,40p $R/test/fixtures/server.mjs | head -40; grep -n "fileSafeFromUrl" -A12 $R/src/lib/urls.mjs | head -30; sed -n 36,80p $R/src/lib/urls.mjs
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

## 21. Bash

````bash
R=$REPO; cd $R; sed -n 186,222p bin/wcag-em.mjs; ls $R/node_modules/.bin | grep -i playwright
````

Output (truncated):

````text
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
        if (result && typeof result.exitCode === 'number' && result.exitCode > exitCode) {
          e ...
````

## 22. Write `$SCRATCH/wf2/verify-A07/probe.mjs`

````text
// Verify-A07 probe: two origins (A=127.0.0.1 audited, B=localhost third party).
// Run 1: auth.extraHttpHeaders + httpCredentials + process with a failing fill.
// Run 2: rootUrl with userinfo, no auth.
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const S = path.dirname(new URL(import.meta.url).pathname);
const R = '$REPO';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

const bLog = [];
const B = createServer((req, res) => {
  bLog.push({
    m: req.method,
    u: req.url,
    waf: req.headers['x-waf-bypass'] ?? null,
    authz: req.headers.authorization
      ? Buffer.from(req.headers.authorization.replace(/^Basic /, ''), 'base64').toString()
      : null,
    acrh: req.headers['access-control-request-headers'] ?? null,
  });
  const u = req.url.split('?')[0];
  if (u === '/pixel.png') return res.writeHead(200, { 'content-type': 'image/png' }).end(PNG);
  if (u === '/tp.js') return res.writeHead(200, { 'content-type': 'application/javascript' }).end('/*tp*/');
  if (u === '/api') {
    if (req.method === 'OPTIONS') return res.writeHead(405).end();
    return res
      .writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' })
      .end(JSON.stringify({ img: 'http://localhost:' + B.address().port + '/pixel.png' }));
  }
  if (u === '/basic-frame' || u === '/landing') {
    if (!req.headers.authorization)
      return res.writeHead(401, { 'www-authenticate': 'Basic realm="b"' }).end('no');
    return res
      .writeHead(200, { 'content-type': 'text/html' })
      .end('<!doctype html><html lang="en"><title>B</title><h1>B page</h1></html>');
  }
  res.writeHead(404).end();
});

let bPort;
const page = (title, body) =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
const A = createServer((req, res) => {
  const u = req.url.split('?')[0];
  const html = (s) => res.writeHead(200, { 'content-type': 'text/html' }).end(s);
  if (u === '/' || u === '/index.html')
    return html(
      page(
        'Home',
        `<a href="/login.html">Login</a> <a href="/about.html">About</a> <a href="/go-out">Out</a>
         <img src="http://localhost:${bPort}/pixel.png" alt="p">
         <iframe src="http://localhost:${bPort}/basic-frame" title="frame"></iframe>
         <script src="http://localhost:${bPort}/tp.js"></script>
         <div id="w">pending</div>
         <script>fetch('http://localhost:${bPort}/api').then(r=>r.json()).then(j=>{document.getElementById('w').innerHTML='<img alt="widget" src="'+j.img+'">'}).catch(e=>{document.getElementById('w').textContent='WIDGET FAILED: '+e.message})</script>`,
      ),
    );
  if (u === '/login.html')
    return html(
      page(
        'Login',
        `<form><div id="password"><label>Password <input type="password" name="pw"></label></div><button>Sign in</button></form>`,
      ),
    );
  if (u === '/about.html') return html(page('About', '<p>About us</p>'));
  if (u === '/go-out')
    return res.writeHead(302, { location: `http://localhost:${bPort}/landing` }).end();
  res.writeHead(404).end();
});

function runCli(args, env, logFile) {
  return new Promise((resolve) => {
    const cp = spawn(process.execPath, [path.join(R, 'bin/wcag-em.mjs'), ...args], {
      cwd: S,
      env: { ...process.env, ...env },
    });
    const out = fs.createWriteStream(logFile);
    cp.stdout.pipe(out, { end: false });
    cp.stderr.pipe(out, { end: false });
    cp.on('close', (code) => {
      out.end();
      resolve(code);
    });
  });
}

function grepDir(dir, needle) {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.name === 'crawlee-storage') continue;
      if (e.name.includes(needle)) hits.push('NAME:' + path.relative(dir, p));
      if (e.isDirectory()) walk(p);
      else if (fs.readFileSync(p).includes(needle)) hits.push(path.relative(dir, p));
    }
  };
  walk(dir);
  return hits;
}

await Promise.all([
  (B.listen(0, '::'), once(B, 'listening')),
  (A.listen(0, '127.0.0.1'), once(A, 'listening')),
]);
bPort = B.address().port;
const aPort = A.address().port;
const base = `http://127.0.0.1:${aPort}`;
const tmpl = JSON.parse(fs.readFileSync(path.join(R, 'test/fixtures/site.json.template'), 'utf8'));

try {
  // ---------- Run 1 ----------
  const out1 = path.join(S, 'run1');
  fs.rmSync(out1, { recursive: true, force: true });
  fs.mkdirSync(out1, { recursive: true });
  const cfg1 = structuredClone(tmpl);
  cfg1.rootUrl = base + '/';
  cfg1.sample.structuredManual = [base + '/', base + '/login.html', base + '/go-out'];
  cfg1.crawl.sitemapSeeding.enabled = false;
  cfg1.scan.timeoutMs = 10000;
  cfg1.scan.waitUntil = 'load';
  cfg1.auth = {
    httpCredentials: { username: 'auditor', password: 'PWSECRET-456' },
    extraHttpHeaders: { 'X-WAF-Bypass': 'WAFSECRET-123' },
  };
  cfg1.processes = [
    {
      name: 'sign-in',
      startUrl: base + '/login.html',
      steps: [
        { action: 'goto', url: base + '/login.html' },
        { action: 'fill', selector: '#password', value: 'FILLSECRET-777' },
        { action: 'axe', name: 'after-fill' },
      ],
    },
  ];
  fs.writeFileSync(path.join(out1, 'cfg.json'), JSON.stringify(cfg1, null, 2));
  const code1 = await runCli(
    ['audit', '--config', path.join(out1, 'cfg.json'), '--out-dir', out1],
    { CRAWLEE_STORAGE_DIR: path.join(out1, 'crawlee-storage') },
    path.join(S, 'run1.log'),
  );
  console.log('RUN1 exit', code1);
  console.log('B log (run1):');
  for (const r of bLog) console.log(' ', JSON.stringify(r));
  fs.copyFileSync(path.join(S, 'run1.log'), path.join(out1, 'cli.log'));
  console.log('FILLSECRET hits:', grepDir(out1, 'FILLSECRET-777'));
  console.log('PWSECRET hits:', grepDir(out1, 'PWSECRET-456').filter((h) => !h.endsWith('cfg.json')));
  console.log('WAFSECRET hits:', grepDir(out1, 'WAFSECRET-123').filter((h) => !h.endsWith('cfg.json')));
  bLog.length = 0;

  // ---------- Run 2 ----------
  const out2 = path.join(S, 'run2');
  fs.rmSync(out2, { recursive: true, force: true });
  fs.mkdirSync(out2, { recursive: true });
  const ubase = `http://auditor:UIPASS789@127.0.0.1:${aPort}`;
  const cfg2 = structuredClone(tmpl);
  cfg2.rootUrl = ubase + '/';
  cfg2.sample.structuredManual = [ubase + '/about.html'];
  cfg2.crawl.sitemapSeeding.enabled = false;
  cfg2.scan.timeoutMs = 10000;
  fs.writeFileSync(path.join(out2, 'cfg.json'), JSON.stringify(cfg2, null, 2));
  const code2 = await runCli(
    ['audit', '--config', path.join(out2, 'cfg.json'), '--out-dir', out2],
    { CRAWLEE_STORAGE_DIR: path.join(out2, 'crawlee-storage') },
    path.join(S, 'run2.log'),
  );
  console.log('RUN2 exit', code2);
  fs.copyFileSync(path.join(S, 'run2.log'), path.join(out2, 'cli.log'));
  console.log('UIPASS hits:', grepDir(out2, 'UIPASS789').filter((h) => !h.endsWith('cfg.json')));
} finally {
  A.close();
  B.close();
  A.closeAllConnections?.();
  B.closeAllConnections?.();
}

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A07/probe.mjs (file state is current in your context — no need to Read it back)
````

## 23. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S && ln -sfn $REPO/node_modules node_modules; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && timeout 400 node probe.mjs 2>&1 | tail -60
````

Output (truncated):

````text
(eval):1: command not found: timeout
````

## 24. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs 2>&1 | tail -60
````

Output (truncated):

````text
RUN1 exit 0
B log (run1):
  {"m":"GET","u":"/pixel.png","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/tp.js","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/basic-frame","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/api","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/landing","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/landing","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/landing","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/landing","waf":null,"authz":null,"acrh":null}
  {"m":"GET","u":"/tp.js","waf":"WAFSECRET-123","authz":null,"acrh":null}
  {"m":"GET","u":"/pixel.png","waf":"WAFSECRET-123","authz":null,"acrh":null}
  {"m":"GET","u":"/basic-frame","waf":"WAFSECRET-123","authz":null,"acrh":null}
  {"m":"GET","u":"/bas ...
````

## 25. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S/run1; ls reports results; grep -n "FILLSECRET" reports/summary.md | head; python3 -c "
import json
d=json.load(open('results/process-results.json'))
print(json.dumps(d,indent=1)[:2500])
"
````

Output (truncated):

````text
reports:
grouped-by-component.json
grouped-by-rule.json
manual-backlog.md
random-vs-structured-comparison.json
summary.json
summary.md
wcag-em-summary.json

results:
axe-results.json
process-results.json
30:    - fill("FILLSECRET-777")
[
 {
  "name": "sign-in",
  "startUrl": "http://127.0.0.1:56326/login.html",
  "pattern": null,
  "viewport": "desktop",
  "states": [
   {
    "state": "error",
    "name": "fill",
    "error": "locator.fill: Error: Element is not an <input>, <textarea>, <select> or [contenteditable] and does not have a role allowing [aria-readonly]\nCall log:\n  - waiting for locator('#password').first()\n    - locator resolved to <div id=\"password\">\u2026</div>\n    - fill(\"FILLSECRET-777\")\n  - attempting fill action\n    - waiting for element to be visible, enabled  ...
````

## 26. Bash

````bash
R=$REPO; cd $R; python3 -c "
import json
s=json.load(open('schemas/config.schema.json'))
print(json.dumps(s['properties']['reporting']['properties'].get('reporters'),indent=1))
"; grep -n "DEFAULT_REPORTERS\|defaultReporters\|'markdown', 'json'\|reporters ??" src/commands/summarize.mjs src/reporters/index.mjs | head
````

Output (truncated):

````text
{
 "type": "array",
 "items": {
  "enum": [
   "json",
   "markdown",
   "html",
   "earl-jsonld",
   "junit",
   "portal-export",
   "report-builder-starter"
  ]
 },
 "uniqueItems": true
}
````

## 27. Bash

````bash
S=$SCRATCH/wf2/verify-A07; R=$REPO; cd $S; for r in run1 run2; do python3 -c "
import json,sys
p=sys.argv[1]+'/cfg.json'; c=json.load(open(p)); c['reporting']['reporters']=['json','markdown','html','earl-jsonld','junit','portal-export','report-builder-starter']; json.dump(c,open(sys.argv[1]+'/cfg-all.json','w'),indent=1)" $r; done; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && for r in run1 run2; do CRAWLEE_STORAGE_DIR=$S/$r/crawlee-storage node $R/bin/wcag-em.mjs summarize --config $S/$r/cfg-all.json --out-dir $S/$r > $S/$r-sum.log 2>&1; echo "$r exit $?"; done; ls run1/reports; echo "== FILL"; grep -rl FILLSECRET-777 run1 --exclude=cfg*.json; echo "== UIPASS"; grep -rl UIPASS789 run2/reports
````

Output (truncated):

````text
run1 exit 0
run2 exit 0
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
== FILL
(eval):3: no matches found: --exclude=cfg*.json
````

## 28. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S; echo "== FILL"; grep -rl 'FILLSECRET-777' run1 | grep -v cfg; grep -c FILLSECRET run1-sum.log; echo "== UIPASS"; grep -rl UIPASS789 run2/reports; echo; grep -o '.\{80\}FILLSECRET-777.\{20\}' run1/reports/portal-export.json run1/reports/report-builder-draft.json run1/reports/summary.html | head -5
````

Output (truncated):

````text
== FILL
run1/reports/report-builder-draft.json
run1/reports/portal-export.json
run1/reports/summary.html
run1/cli.log
run1/results/process-results.json
run1/reports/summary.json
run1/reports/summary.md
0
== UIPASS
run2/reports/summary.json
run2/reports/report-builder-draft.json
run2/reports/portal-export.json
run2/reports/summary.md
run2/reports/summary.html

run1/reports/portal-export.json:).first()\n    - locator resolved to <div id=\"password\">…</div>\n    - fill(\"FILLSECRET-777\")\n  - attempting 
run1/reports/report-builder-draft.json:).first()\n    - locator resolved to <div id=\"password\">…</div>\n    - fill(\"FILLSECRET-777\")\n  - attempting
````

## 29. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S; python3 - <<'EOF'
import json
def walk(o,p=''):
    if isinstance(o,dict):
        for k,v in o.items(): yield from walk(v,p+'.'+k)
    elif isinstance(o,list):
        for i,v in enumerate(o): yield from walk(v,p+f'[{i}]')
    elif isinstance(o,str) and ('FILLSECRET' in o or 'UIPASS789' in o): yield p
for f in ['run1/reports/portal-export.json','run1/reports/report-builder-draft.json','run2/reports/portal-export.json','run2/reports/report-builder-draft.json']:
    print(f, list(walk(json.load(open(f))))[:8])
EOF
grep -n "raw\|summary" $REPO/src/reporters/portal-export.mjs | head -20
````

Output (truncated):

````text
run1/reports/portal-export.json ['.scanMetadata.scanOptions.executionHealth.processStepFailures[0].error']
run1/reports/report-builder-draft.json ['.appendices[1].content']
run2/reports/portal-export.json ['.scanMetadata.url', '.scanMetadata.scanOptions.executionHealth.structuredMissingFromInventory[0].url']
run2/reports/report-builder-draft.json ['.meta.websiteUrl', '.scope.pagesTested[0]', '.scope.pagesTested[1]', '.appendices[1].content']
````

## 30. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S/run2; cat inventory/urls.txt; python3 -c "
import json
d=json.load(open('reports/portal-export.json'))
print(d['scanMetadata']['url']); print(d['scanMetadata']['scanOptions']['executionHealth']['structuredMissingFromInventory'])
"; head -c 600 sample.json; echo; grep -c '"url"' results/axe-results.json
````

Output (truncated):

````text
http://auditor:UIPASS789@127.0.0.1:56326/
http://auditor:UIPASS789@127.0.0.1:56326/
[{'url': 'http://auditor:UIPASS789@127.0.0.1:56326/about.html', 'reason': 'not-in-inventory'}]
[
  "http://auditor:UIPASS789@127.0.0.1:56326/about.html",
  "http://auditor:UIPASS789@127.0.0.1:56326/"
]

2
````

## 31. Bash

````bash
R=$REPO; cd $R; grep -rn "setDefaultTimeout\|setDefaultNavigationTimeout\|class StepTimeoutError" -A4 src | head -20; grep -rn "processStepFailures\|scanOptions" src/reporters/portal-export.mjs | head
````

Output (truncated):

````text
src/lib/process-runner.mjs:100:export class StepTimeoutError extends Error {
src/lib/process-runner.mjs-101-  /**
src/lib/process-runner.mjs-102-   * Build a timeout error for a named step.
src/lib/process-runner.mjs-103-   *
src/lib/process-runner.mjs-104-   * @param {string} action - The step action that timed out (e.g. `'click'`).
src/commands/discover.mjs:238:      // requestTimeoutSecs. page.setDefaultTimeout below configures the
src/commands/discover.mjs-239-      // per-method default that bounds waitForLoadState (slow-network
src/commands/discover.mjs-240-      // safety) and any future interactive locator work; per-element
src/commands/discover.mjs-241-      // metadata capture has been moved to a single page.evaluate (no
src/commands/discover.mjs-242-      // auto-wait — see capt ...
````

## 32. Bash

````bash
R=$REPO; cd $R; grep -rn "reporters" src/commands/summarize.mjs src/lib/config.mjs | head -12; grep -rn "\"reporters\"" configs/example-*.json | head
````

Output (truncated):

````text
src/commands/summarize.mjs:15: * @see docs/adr/0008-pluggable-reporters.md
src/commands/summarize.mjs:31:import { runReporters } from '../reporters/index.mjs';
src/commands/summarize.mjs:351:      newField: 'reporting.reporters',
src/commands/summarize.mjs:353:        "Omit the field to keep the default ['json','markdown'] set; or set reporters: ['json'] to disable markdown.",
src/commands/summarize.mjs:439:  // SECTION: Incomplete grouping (needs-review items for reporters)
src/commands/summarize.mjs:632:  // `reporting.reporters` config (per ADR-0008's reporter-vs-side-artefact
src/commands/summarize.mjs:634:  const resolvedReporters = Array.isArray(config.reporting?.reporters)
src/commands/summarize.mjs:635:    ? config.reporting.reporters
src/commands/summarize.mjs:687:  // block into  ...
````

## 33. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S; grep -v '^\s*$' run2.log | cut -c1-260 | head -30
````

Output (truncated):

````text
{"level":30,"time":"2026-09-30T18:54:12.946Z","pid":6163,"tool":"wcag-em-a11y-toolkit","toolVersion":"1.1.0","axeCore":"4.11.2","name":"wcag-em","stage":"discover","msg":"stage start"}
[32mINFO[39m [33m PlaywrightCrawler:[39m Starting the crawler.
[32mINFO[39m [33m PlaywrightCrawler:[39m All requests from the queue have been processed, the crawler will shut down.
[32mINFO[39m [33m PlaywrightCrawler:[39m Final request statistics:[90m {"requestsFinished":1,"requestsFailed":0,"retryHistogram":[1],"requestAvgFailedDurationMillis":null,"requestAvgFinishedDurationMillis":435,"requestsFinishedPerMinute":78,"requestsFaile
[32mINFO[39m [33m PlaywrightCrawler:[39m Finished! Total 1 requests: 1 succeeded, 0 failed.[90m {"terminal":true}[39m
{"level":30,"time":"2026-09-30T18:54:14.4 ...
````

## 34. Bash

````bash
R=$REPO; cd $R; grep -n "export function urlAllowedByScope" -A25 src/lib/urls.mjs | head -35; grep -n "enqueueLinks\|transformRequestFunction\|urlAllowedByScope" src/commands/discover.mjs | head
````

Output (truncated):

````text
188:export function urlAllowedByScope(targetUrl, rootUrl, scope) {
189-  const target = new URL(targetUrl);
190-  const root = new URL(rootUrl);
191-
192-  if (scope.mode === 'same-origin') return target.origin === root.origin;
193-  if (scope.mode === 'same-hostname') return target.hostname === root.hostname;
194-  if (scope.mode === 'allowed-hosts') {
195-    const allowedHosts = new Set([root.hostname, ...(scope.allowedHosts || [])]);
196-    return allowedHosts.has(target.hostname);
197-  }
198-  return false;
199-}
200-
201-/**
202- * Match a URL against user-supplied exclude patterns.
203- *
204- * Patterns are compiled once at config-load (see the `CompileRuntimeFields`
205- * block in `src/lib/context.mjs`) and threaded through as a `RegExp[]` so
206- * this hot path never touches  ...
````

## 35. Bash

````bash
R=$REPO; cd $R; sed -n 280,305p src/commands/discover.mjs
````

Output (truncated):

````text
          processTypes,
        });
        logger.debug({ url: currentUrl, pageType }, 'page discovered');
      }

      await enqueueLinks({
        selector: 'a[href]',
        strategy: config.scope.mode === 'same-origin' ? 'same-origin' : 'same-hostname',
        transformRequestFunction(req) {
          const normalized = normalizeUrl(req.url);
          if (!urlAllowedByScope(normalized, config.rootUrl, config.scope)) {
            excludedOutOfScope.add(normalized);
            return false;
          }
          // E5: inventory in-scope document links for manual review, regardless
          // of whether documentLinkPatterns skips them below.
          const docType = documentTypeOf(normalized);
          if (docType) documentLinks.set(normalized, docType);
          if (urlExcl ...
````

## 36. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cat > $S/redact.mjs <<'EOF'
import { createLogger } from 'file://$REPO/src/lib/logger.mjs';
const log = createLogger({ level: 'info', prettyOverride: false });
log.info({ auth: { httpCredentials: { password: 'L1' }, storageState: 'L2', extraHttpHeaders: { 'X-WAF-Bypass': 'L3' } } }, 't1-top-level-auth');
log.info({ config: { auth: { httpCredentials: { username: 'u', password: 'L4' } } } }, 't2-nested');
log.info({ headers: { authorization: 'Basic L5', cookie: 'c=L6' } }, 't3-headers');
log.info({ creds: { password: 'L7', key: 'L8' } }, 't4-one-level');
log.info({ authorization: 'L9', Authorization: 'L10' }, 't5-top');
log.info({ AUTHORIZATION: 'L11' }, 't6-case');
EOF
cd $S; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node redact.mjs 2>&1 | sed -E 's/"time":"[^"]*",//; s/"pid":[0-9]+,"tool":"[^"]*","toolVersion":"[^"]*","axeCore":"[^"]*",//'; R=$REPO; grep -rln "redact" $R/test | head; grep -rn "logger\.\(info\|warn\|error\|debug\)({[^}]*\(auth\|config\|contextOptions\|headers\)" $R/src | head
````

Output (truncated):

````text
{"level":30,"name":"wcag-em","auth":{"extraHttpHeaders":{"X-WAF-Bypass":"L3"}},"msg":"t1-top-level-auth"}
{"level":30,"name":"wcag-em","config":{"auth":{"httpCredentials":{"username":"u","password":"L4"}}},"msg":"t2-nested"}
{"level":30,"name":"wcag-em","headers":{"authorization":"Basic L5","cookie":"c=L6"},"msg":"t3-headers"}
{"level":30,"name":"wcag-em","creds":{"key":"L8"},"msg":"t4-one-level"}
{"level":30,"name":"wcag-em","msg":"t5-top"}
{"level":30,"name":"wcag-em","AUTHORIZATION":"L11","msg":"t6-case"}
````

## 37. Bash

````bash
R=$REPO; cd $R; grep -rnE "logger\??\.(info|warn|error|debug|trace|fatal)\(\s*\{[^}]*\b(config|auth|contextOptions|authContextOptions|headers|extraHTTPHeaders|httpCredentials|storageState)\b" src bin | head; grep -rn "extraHttpHeaders\|extraHTTPHeaders" src | grep -v "^src/lib/auth.mjs" | head
````

Output (truncated):

````text
src/types/config.d.ts:131:     * Bot/WAF challenge handling (E1). Detection is header/status-primary (Cloudflare cf-mitigated is authoritative); this configures the bounded wait-for-auto-solve and the host allowlist for the weaker title+status heuristic. For a WAF bypass use auth.extraHTTPHeaders; for a cf_clearance cookie use auth.storageState.
src/types/config.d.ts:247:    extraHttpHeaders?: {
src/lib/config.mjs:113:    // (opt-in) — the robust path is a WAF bypass header via auth.extraHTTPHeaders.
src/commands/scan.mjs:194:  // config.auth (storageState, httpCredentials, extraHTTPHeaders). Synchronous
src/commands/scan-processes.mjs:102: *     httpCredentials, extraHTTPHeaders. Hoisted in `run()` so the sync
````

## 38. Bash

````bash
R=$REPO; cd $R; python3 -c "
import json; p=json.load(open('package.json')); print(p.get('files')); print('private', p.get('private')); print({k:v for k,v in p.get('scripts',{}).items() if 'pub' in k or 'pack' in k}); print(p.get('publishConfig'))"; ls .npmignore 2>&1; grep -n "configs" .gitignore; ls configs; echo ---main; ls $REPO_MAIN/configs/ 2>&1; grep -rn "npm pack\|npm publish\|files\[\]\|prepublish" docs/adr/0015* RELEASING.md docs/guides/*.md 2>/dev/null | head
````

Output (truncated):

````text
['bin/', 'src/', 'schemas/', 'configs/', 'README.md', 'LICENSE', 'CHANGELOG.md']
private None
{}
None
ls: .npmignore: No such file or directory
27:# Local-only, per-engagement audit configs. The committed configs are the
28:# example-*.json templates + legacy-events.json; anything else under configs/ is a
30:configs/*.json
31:!configs/example-*.json
32:!configs/legacy-events.json
example-site-best-practice.json
example-site-with-auth.json
example-site-with-cdp.json
example-site-with-processes.json
example-site.json
legacy-events.json
---main
[local, gitignored per-engagement config omitted]
example-site-best-practice.json
example-site-with-auth.json
example-site-with-cdp.json
example-site-with-processes.json
example-site.json
[local, gitignored per-engagement config omitted]
legacy-events. ...
````

## 39. Bash

````bash
R=$REPO; cd $R; sed -n 50,90p docs/adr/0015-publish-and-deprecation-policy.md; grep -rn "publish" .github/workflows/*.yml | head
````

Output (truncated):

````text
   validation error at load time — a clear, actionable failure
   rather than silent data loss.

**Duration:** one minor version. A field deprecated in 1.1.0 is
removed no earlier than 1.2.0. Patch releases do not remove
deprecated fields.

**Existing example:** `reporting.markdownReport` was deprecated in
Layer 4 (replaced by `reporting.reporters: ['markdown']`). The
runtime emits `warnLegacyAliasResolved` when the old field is
present. It will be removed in the first post-v1.0 minor release.

### Publish flow

```
npm version <major|minor|patch>   # bumps package.json + package-lock.json + git tag
npm run format:check && npm run lint && npm run typecheck && npm test
npm pack --dry-run                # verify tarball contents against files[] whitelist
npm publish --dry-run             # s ...
````

## 40. Bash

````bash
S=$SCRATCH/wf2/verify-A07; R=$REPO; rm -rf $S/pack && mkdir -p $S/pack && cd $R && git ls-files -z | xargs -0 -I{} rsync -R {} $S/pack/ 2>/dev/null; cd $S/pack && ls && echo '{"name":"client-x","auth":{"httpCredentials":{"username":"u","password":"DUMMY"}}}' > configs/<local-config>.json && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm --version && npm pack --dry-run --ignore-scripts --json 2>/dev/null | python3 -c "import json,sys; d=json.load(sys.stdin); print([f['path'] for f in d[0]['files'] if f['path'].startswith('configs/')])"
````

Output (truncated):

````text
Exit code 1
CHANGELOG.md
CONTRIBUTING.md
LICENSE
README.md
TODO.md
bin
configs
docs
eslint.config.mjs
jsconfig.json
output
package-lock.json
package.json
schemas
scripts
spikes
src
test
10.9.2
Traceback (most recent call last):
  File "<string>", line 1, in <module>
    import json,sys; d=json.load(sys.stdin); print([f['path'] for f in d[0]['files'] if f['path'].startswith('configs/')])
                       ~~~~~~~~~^^^^^^^^^^^
  File "/opt/homebrew/Cellar/python@3.14/3.14.7/Frameworks/Python.framework/Versions/3.14/lib/python3.14/json/__init__.py", line 298, in load
    return loads(fp.read(),
        cls=cls, object_hook=object_hook,
        parse_float=parse_float, parse_int=parse_int,
        parse_constant=parse_constant, object_pairs_hook=object_pairs_hook, **kw)
  File "/opt/homeb ...
````

## 41. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S/pack && ls -a | head -5; ls configs; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && npm pack --dry-run --ignore-scripts --json > ../pack.json 2> ../pack.err; echo exit $?; tail -5 ../pack.err; head -c 300 ../pack.json
````

Output (truncated):

````text
.
..
.editorconfig
.git-blame-ignore-revs
.github
[local, gitignored per-engagement config omitted]
example-site-best-practice.json
example-site-with-auth.json
example-site-with-cdp.json
example-site-with-processes.json
example-site.json
legacy-events.json
exit 0

> wcag-em-a11y-toolkit@1.1.0 prepare
> husky || true

.git can't be found[
  {
    "id": "wcag-em-a11y-toolkit@1.1.0",
    "name": "wcag-em-a11y-toolkit",
    "version": "1.1.0",
    "size": 144097,
    "unpackedSize": 490520,
    "shasum": "307e228770773f8165e01a8557942ef4a915bd66",
    "integrity": "sha512-yKf0TLZ8fAX3N7MIt2rU3MPzVcdmcm4wPD8+nJBDAUKC
````

## 42. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cd $S; python3 -c "
import json; s=open('pack.json').read(); d=json.loads(s[s.index('['):]); print([f['path'] for f in d[0]['files'] if f['path'].startswith('configs/')]); print(len(d[0]['files']))"; ls $S/pack/.gitignore
````

Output (truncated):

````text
['configs/<local-config>.json', 'configs/example-site-best-practice.json', 'configs/example-site-with-auth.json', 'configs/example-site-with-cdp.json', 'configs/example-site-with-processes.json', 'configs/example-site.json', 'configs/legacy-events.json']
63
$SCRATCH/wf2/verify-A07/pack/.gitignore
````

## 43. Bash

````bash
R=$REPO; cd $R; grep -rn -i "mask\|redact" src schemas docs/guides README.md | grep -v "^src/lib/logger.mjs" | head; echo ---; grep -n "screenshot\|\.html\b\|snippet\|failureSummary" src/reporters/portal-export.mjs src/reporters/report-builder-starter.mjs | head -20; echo ---; grep -rn -i "PII\|personal data\|privacy\|GDPR" docs README.md TODO.md | head
````

Output (truncated):

````text
src/lib/browser.mjs:240: *   must not terminate it. Guarded so a disconnect hiccup can't mask a scan
src/commands/scan-processes.mjs:91: * is warned, never allowed to mask the result, and is skipped when acquisition
src/commands/scan-processes.mjs:160:    // failure is warned, never allowed to mask the process result. `view` is
---
src/reporters/report-builder-starter.mjs:16: * (finding-ID uniqueness; evidence needs content|path|observed; screenshots
src/reporters/report-builder-starter.mjs:164: * Read per-page screenshot paths + successfully-scanned page URLs from
src/reporters/report-builder-starter.mjs:165: * `axe-results.json` (one read serves both; mirrors html.mjs's screenshot
src/reporters/report-builder-starter.mjs:169: * @returns {Promise<{ screenshotsByUrl: Map<string, string>, s ...
````

## 44. Bash

````bash
R=$REPO; cd $R; grep -n "html\|target" src/reporters/portal-export.mjs | head -12; sed -n 175,195p docs/adr/0001-project-conventions.md; grep -n "fullPageScreenshots" -B2 -A2 docs/guides/config-guide.md | head
````

Output (truncated):

````text
- Dependabot / Renovate can be enabled with a weekly schedule; we do not auto-merge.
- Playwright and `@axe-core/playwright` are runtime dependencies (users of
  `wcag-em audit` need them), not devDependencies.

### Privacy and portability

- **No telemetry.** The tool does not phone home.
- **Offline-capable** after the first `npx playwright install`; running the tool
  against local fixtures requires no network.
- **English-only** CLI output in v1.0. Localisation is deferred to a future
  release (ADR-0011).

### Reuse over rewrite

Every existing utility in the v0.3 `scripts/lib/` (and now `src/lib/`) tree is
preserved — moved, renamed, or extended, but not rewritten from scratch. New
utilities are only introduced where the v1.0 research identified a concrete gap.
This respects the audi ...
````

## 45. Bash

````bash
R=$REPO; cd $R; grep -n "examples\|nodes\|snippet\|element\|selector" src/reporters/portal-export.mjs | head -12; grep -n "timeoutMs" src/lib/config.mjs schemas/config.schema.json | head -5; S=$SCRATCH/wf2/verify-A07; python3 -c "
import json
d=json.load(open('$S/run2/reports/portal-export.json'))
print(list(d.keys())); 
f=(d.get('findings') or d.get('issues') or [])
print(json.dumps(f[:1],indent=1)[:800] if f else 'no findings')"
````

Output (truncated):

````text
schemas/config.schema.json:259:        "timeoutMs": {
schemas/config.schema.json:713:        "timeoutMs": {
src/lib/config.mjs:107:    timeoutMs: 60000,
['scanMetadata', 'summary', 'rawFindings']
no findings
````

## 46. Bash

````bash
R=$REPO; cd $R; grep -n "rawFindings" -A30 src/reporters/portal-export.mjs | grep -n "html\|failureSummary\|target\|node" | head
````

Output (truncated):

````text
(Bash completed with no output)
````

## 47. Bash

````bash
R=$REPO; cd $R; grep -n "rawFindings\|push({\|return {" src/reporters/portal-export.mjs | head; wc -l src/reporters/portal-export.mjs
````

Output (truncated):

````text
     571 src/reporters/portal-export.mjs
````

## 48. Bash

````bash
R=$REPO; cd $R; grep -c "" src/reporters/portal-export.mjs; grep -n "import\|Findings" src/reporters/portal-export.mjs | head -20
````

Output (truncated):

````text
(Bash completed with no output)
````

## 49. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cat > $S/filltimeout.mjs <<'EOF'
import { chromium } from 'playwright';
import { runStep } from 'file://$REPO/src/lib/process-runner.mjs';
const browser = await chromium.launch();
const logger = { warn() {}, error() {}, info() {}, debug() {} };
const html = `<input id="dis" disabled aria-label="a"><input id="ro" readonly aria-label="b"><input id="hid" style="display:none" aria-label="c">`;
const cases = [['disabled', '#dis'], ['readonly', '#ro'], ['hidden', '#hid'], ['missing', '#nope']];
try {
  const res = await Promise.all(cases.map(async ([label, sel]) => {
    const ctx = await browser.newContext(); const page = await ctx.newPage();
    await page.setContent(html);
    const t0 = Date.now();
    const r = await runStep({ action: 'fill', selector: sel, value: 'SECRET-' + label }, { page, config: { scan: { timeoutMs: 60000 } }, logger });
    return { label, ms: Date.now() - t0, state: r.state, leaks: String(r.error).includes('SECRET-' + label), head: String(r.error).split('\n')[0] };
  }));
  console.log(JSON.stringify(res, null, 1));
} finally { await browser.close(); }
EOF
cd $S && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node filltimeout.mjs
````

Output (truncated):

````text
[
 {
  "label": "disabled",
  "ms": 30014,
  "state": "error",
  "leaks": true,
  "head": "locator.fill: Timeout 30000ms exceeded."
 },
 {
  "label": "readonly",
  "ms": 30006,
  "state": "error",
  "leaks": true,
  "head": "locator.fill: Timeout 30000ms exceeded."
 },
 {
  "label": "hidden",
  "ms": 30017,
  "state": "error",
  "leaks": true,
  "head": "locator.fill: Timeout 30000ms exceeded."
 },
 {
  "label": "missing",
  "ms": 30015,
  "state": "error",
  "leaks": false,
  "head": "locator.fill: Timeout 30000ms exceeded."
 }
]
````

## 50. Bash

````bash
S=$SCRATCH/wf2/verify-A07; cat $S/run1/inventory/urls.txt; python3 -c "
import json; d=json.load(open('$S/run2/inventory/inventory-metadata.json')); print({k:v for k,v in d.items() if 'xclu' in k or 'scope' in k.lower() or 'count' in k.lower()})"; ps aux | grep -i "chrom\|headless_shell" | grep -v grep | grep -c "$S" 
````

Output (truncated):

````text
http://127.0.0.1:56326/
http://127.0.0.1:56326/about.html
http://127.0.0.1:56326/login.html
{'seedCount': 1, 'discoveredCount': 1, 'outOfScopeLinkCount': 0, 'excludedByPatternCount': 0, 'excludedByExtensionCount': 0, 'failedRequestCount': 0}
0
````

## 51. Bash

````bash
grep -i "extraHTTPHeaders\|casing\|SEC-03\|userinfo\|redact\|secret\|mask" $SCRATCH/review/round1-index.txt | cut -c1-220
````

Output (truncated):

````text
DISC-06 | high | tracked-open | capability-gap | discover ignores the entire auth block (httpCredentials, storageState, extraHttpHeaders), not just setupScript: a documented Basic-auth staging setup produces an empty inv
DISC-26 | low | new | docs-drift | Docs and schema descriptions name `auth.extraHTTPHeaders`, which the schema rejects; the property is `extraHttpHeaders` | docs/guides/config-guide.md:122, schemas/config.schema.json:637
SEC-03 | high | new | capability-gap | discover and sitemap seeding ignore all configured auth, so gated sites cannot be explored or sampled | src/commands/discover.mjs:227, src/lib/sitemap.mjs:108, docs/guides/config-gu
SEC-08 | medium | new | security | npm pack/publish would ship gitignored per-engagement client configs (which may hold auth secrets) | p ...
````

## 52. Bash

````bash
cd $REPO; grep -n "Restrain sending http credentials" node_modules/playwright-core/types/types.d.ts | head -3; grep -n "\"version\"" node_modules/playwright-core/package.json; grep -n -i "sent to any servers\|send.*credentials.*any" node_modules/playwright-core/types/types.d.ts | head -3
````

Output (truncated):

````text
10071:       * Restrain sending http credentials on specific origin (scheme://host:port).
15368:       * Restrain sending http credentials on specific origin (scheme://host:port).
17342:       * Restrain sending http credentials on specific origin (scheme://host:port).
3:  "version": "1.59.1",
10063:     * origin is specified, the username and password are sent to any servers upon unauthorized responses.
15360:     * origin is specified, the username and password are sent to any servers upon unauthorized responses.
17334:     * origin is specified, the username and password are sent to any servers upon unauthorized responses.
````

## 53. Bash

````bash
S=$SCRATCH/wf2/verify-A07; ls $S/run2/reports; grep -c "127.0.0.1" $S/run2/reports/earl.jsonld $S/run2/reports/junit.xml; grep -o "http://[^\"<]*" $S/run2/reports/earl.jsonld | sort -u | head -5; grep -rn "username\|password\|userinfo" $REPO/src/lib/urls.mjs $REPO/src/lib/config.mjs | head
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
$SCRATCH/wf2/verify-A07/run2/reports/earl.jsonld:0
$SCRATCH/wf2/verify-A07/run2/reports/junit.xml:0
http://purl.org/dc/terms/
http://usefulinc.com/ns/doap#
http://www.w3.org/TR/WCAG-EM/#
http://www.w3.org/ns/earl#
http://xmlns.com/foaf/0.1/
````
