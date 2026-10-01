# Probe record: verify:B03

Role: packet verifier. Findings: E2E-01, OPS-10, STRESS-03, STRESS-06, STRESS-01, STRESS-02, STRESS-05, E2E-03, E2E-05, E2E-07

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
cd $REPO; sed -n 300,380p src/commands/scan.mjs; echo ----; sed -n 255,275p src/lib/process-runner.mjs; echo ---; sed -n 40,60p src/commands/scan-processes.mjs; rg -n caret src test | head; rg -ni shadow src | head; grep -n '"version"' node_modules/playwright/package.json node_modules/playwright-core/package.json
````

Output (truncated):

````text
      typeof rawQuality === 'number' && rawQuality >= 1 && rawQuality <= 100 ? rawQuality : 80;
    if (screenshotFormat === 'png' && typeof rawQuality === 'number' && !pngQualityWarnFired) {
      logger.warn(
        { screenshotFormat, screenshotQuality: rawQuality },
        'reporting.screenshotQuality has no effect when screenshotFormat is png; ignoring',
      );
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
     ...
````

## 2. Bash

````bash
D=$SCRATCH/wf2/verify-B03; mkdir -p $D; R=$REPO; ln -sfn $R/node_modules $D/node_modules; cat > $D/p.mjs <<'EOF'
import http from 'node:http';
import { chromium } from 'playwright';
import { AxeBuilder } from '@axe-core/playwright';
const pages = {
 '/form': '<!doctype html><html lang=en><title>f</title><main><label>A <input id=a></label></main>',
 '/closed': `<!doctype html><html lang=en><title>c</title><main><x-w></x-w><script>customElements.define('x-w',class extends HTMLElement{constructor(){super();const r=this.attachShadow({mode:'closed'});r.innerHTML='<img src=data:, ><button></button><input>'}})</script></main>`,
 '/open': `<!doctype html><html lang=en><title>c</title><main><x-w></x-w><script>customElements.define('x-w',class extends HTMLElement{constructor(){super();const r=this.attachShadow({mode:'open'});r.innerHTML='<img src=data:, ><button></button><input>'}})</script></main>`,
};
const s = http.createServer((q,r)=>{r.setHeader('content-type','text/html');r.end(pages[q.url]??'')}).listen(0,'127.0.0.1');
await new Promise(r=>s.on('listening',r)); const base=`http://127.0.0.1:${s.address().port}`;
const b = await chromium.launch(); const p = await b.newPage();
const ais = r => ({pass: r.passes.some(x=>x.id==='avoid-inline-spacing'), inap: r.inapplicable.some(x=>x.id==='avoid-inline-spacing')});
for (const mode of ['none','default','initial']) {
  await p.goto(base+'/form');
  if (mode==='default') await p.screenshot({path:'/dev/null',fullPage:true});
  if (mode==='initial') await p.screenshot({path:'/dev/null',fullPage:true,caret:'initial'});
  const st = await p.evaluate(()=>document.querySelectorAll('[style]').length);
  console.log('form', mode, 'styled', st, ais(await new AxeBuilder({page:p}).analyze()));
}
for (const u of ['/closed','/open']) { await p.goto(base+u); const r=await new AxeBuilder({page:p}).analyze(); console.log(u,'viol',r.violations.map(v=>v.id)); }
await b.close(); s.close();
EOF
cd $D && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && timeout 120 node p.mjs
````

Output (truncated):

````text
Exit code 127
(eval):24: command not found: timeout
````

## 3. Bash

````bash
D=$SCRATCH/wf2/verify-B03; cd $D && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs
````

Output (truncated):

````text
Exit code 1
file://$REPO/node_modules/@axe-core/playwright/dist/index.mjs:218
      throw new Error(
            ^

Error: Please use browser.newContext()
 Please check out https://github.com/dequelabs/axe-core-npm/blob/develop/packages/playwright/error-handling.md
    at AxeBuilder.analyze (file://$REPO/node_modules/@axe-core/playwright/dist/index.mjs:218:13)
    at async file://$SCRATCH/wf2/verify-B03/p.mjs:18:47

Node.js v22.14.0
````

## 4. Bash

````bash
D=$SCRATCH/wf2/verify-B03; cd $D && sed -i '' 's/const p = await b.newPage();/const p = await (await b.newContext()).newPage();/' p.mjs && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs; pgrep -f "$D" || true
````

Output (truncated):

````text
form none styled 0 { pass: false, inap: true }
$REPO/node_modules/playwright-core/lib/client/elementHandle.js:271
    throw new Error(`path: unsupported mime type "${mimeType}"`);
          ^

Error: path: unsupported mime type "null"
    at determineScreenshotType ($REPO/node_modules/playwright-core/lib/client/elementHandle.js:271:11)
    at Page.screenshot ($REPO/node_modules/playwright-core/lib/client/page.js:466:68)
    at file://$SCRATCH/wf2/verify-B03/p.mjs:15:33

Node.js v22.14.0
````

## 5. Bash

````bash
D=$SCRATCH/wf2/verify-B03; cd $D && sed -i '' "s#path:'/dev/null'#path:'$D/s.png'#g" p.mjs && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs; pkill -f "$D/p.mjs" ; true
````

Output (truncated):

````text
form none styled 0 { pass: false, inap: true }
form default styled 1 { pass: true, inap: false }
form initial styled 0 { pass: false, inap: true }
/closed viol [ 'page-has-heading-one' ]
/open viol [ 'button-name', 'image-alt', 'label', 'page-has-heading-one' ]
````

## 6. Bash

````bash
cd $REPO; cat node_modules/@crawlee/browser-pool/proxy-server.js | head -30; grep -n "listen(this.port" node_modules/proxy-chain/dist/server.js; grep -n "this.host" node_modules/proxy-chain/dist/server.js | head -5; grep -n '"version"' node_modules/crawlee/package.json node_modules/proxy-chain/package.json; sed -n 85,105p bin/wcag-em.mjs; grep -rn "process.exit" bin src | head; grep -rln "crawlee" src
````

Output (truncated):

````text
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLocalProxyAddress = getLocalProxyAddress;
const proxy_chain_1 = require("proxy-chain");
const server = new proxy_chain_1.Server({
    port: 0,
});
server.server.unref();
const listenPromise = server.listen();
listenPromise.catch(() => { });
// https://github.com/microsoft/playwright/blob/2e4722d460b5142267e0e506ca7ea9a259556b5f/packages/playwright-core/src/server/browserContext.ts#L423-L427
async function getLocalProxyAddress() {
    await listenPromise;
    return `http://127.0.0.1:${server.port}`;
}
568:            this.server.listen(this.port, this.host);
155:        this.host = options.host;
568:            this.server.listen(this.port, this.host);
node_modules/proxy-chain/package.json:3:    "versio ...
````

## 7. Bash

````bash
cd $REPO; grep -n "import" bin/wcag-em.mjs | head -30; grep -n "^import" src/commands/audit.mjs 2>/dev/null | head
````

Output (truncated):

````text
22:// SECTION: Engine guard — before ANY other import
27://   import machinery touches any ES2023 feature.
39:import { Command } from 'commander';
40:import { fileURLToPath } from 'node:url';
41:import path from 'node:path';
42:import fs from 'node:fs/promises';
43:import { buildContext } from '../src/lib/context.mjs';
44:import { createLogger } from '../src/lib/logger.mjs';
47:const __dirname = path.dirname(fileURLToPath(import.meta.url));
69: * @param {import('commander').Command} cmd
71: * @returns {Promise<import('../src/lib/context.mjs').RunContext>}
89: * @param {(cmd: import('commander').Command) => Promise<void | number>} fn
129:      const { run } = await import('../src/commands/discover.mjs');
140:      const { run } = await import('../src/commands/sample.mjs');
156:      const { ...
````

## 8. Bash

````bash
D=$SCRATCH/wf2/verify-B03; cd $D && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "import('crawlee').then(async()=>{await new Promise(r=>setTimeout(r,1500));const {execSync}=require('child_process');console.log(execSync('lsof -nP -a -iTCP -sTCP:LISTEN -p '+process.pid+' || true').toString());process.exit(0)})"
````

Output (truncated):

````text
COMMAND   PID         USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
node    79260 $USER   17u  IPv6 0x850f6a8667e37e0b      0t0  TCP *:57085 (LISTEN)
````

## 9. Bash

````bash
cd $REPO; sed -n 320,335p node_modules/@crawlee/browser/internals/browser-crawler.js; grep -n "waitUntil\|gotoOptions" src/commands/discover.mjs src/commands/scan.mjs src/lib/*.mjs | head; sed -n 225,255p src/commands/discover.mjs; grep -n "goto(" src/commands/scan.mjs
````

Output (truncated):

````text
                finalRequestUrl: crawlingContext.request.loadedUrl,
                enqueueLinks: contextEnqueueLinks,
            });
        };
    }
    async _handleNavigation(crawlingContext) {
        const gotoOptions = { timeout: this.navigationTimeoutMillis };
        const preNavigationHooksCookies = this._getCookieHeaderFromRequest(crawlingContext.request);
        crawlingContext.request.state = basic_1.RequestState.BEFORE_NAV;
        await this._executeHooks(this.preNavigationHooks, crawlingContext, gotoOptions);
        (0, timeout_1.tryCancel)();
        const postNavigationHooksCookies = this._getCookieHeaderFromRequest(crawlingContext.request);
        await this._applyCookies(crawlingContext, preNavigationHooksCookies, postNavigationHooksCookies);
        try {
          ...
````

## 10. Bash

````bash
D=$SCRATCH/wf2/verify-B03; cd $D && cat > h.mjs <<'EOF'
import http from 'node:http';
import { chromium } from 'playwright';
const held=[];
const s=http.createServer((q,r)=>{ if(q.url==='/never'){held.push(r);return;} r.setHeader('content-type','text/html'); r.end('<!doctype html><html lang=en><title>h</title><h1>hi</h1><img src=/never alt=x>');}).listen(0,'127.0.0.1');
await new Promise(r=>s.on('listening',r)); const base=`http://127.0.0.1:${s.address().port}`;
const b=await chromium.launch(); const p=await (await b.newContext()).newPage();
await p.goto(base+'/',{waitUntil:'domcontentloaded'});
let t=Date.now();
try{ await p.screenshot({path:D+'/h.png',fullPage:true,timeout:8000}); console.log('shot ok',Date.now()-t);}catch(e){console.log('shot fail',Date.now()-t,e.message.split('\n').slice(0,3).join(' | '));}
t=Date.now();
try{ await p.goto(base+'/',{timeout:5000}); console.log('default goto ok');}catch(e){console.log('default goto fail',Date.now()-t,e.message.split('\n')[0]);}
await b.close(); held.forEach(r=>r.destroy()); s.close(); process.exit(0);
EOF
sed -i '' "s#D+'/h.png'#'$D/h.png'#" h.mjs; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node h.mjs
````

Output (truncated):

````text
shot fail 8007 page.screenshot: Timeout 8000ms exceeded. | Call log: |   - taking page screenshot
default goto fail 5002 page.goto: Timeout 5000ms exceeded.
````

## 11. Bash

````bash
cd $REPO; grep -n -A3 '"fullPageScreenshots"' schemas/*.json src/**/*.json 2>/dev/null | head; grep -rn "fullPageScreenshots" docs README.md CHANGELOG.md | head; grep -n "avoid-inline-spacing\|1.4.12" src/lib/*.mjs src/data/* 2>/dev/null | head -5; sed -n 500,520p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
schemas/config.schema.json:269:        "fullPageScreenshots": {
schemas/config.schema.json-270-          "type": "boolean"
schemas/config.schema.json-271-        },
schemas/config.schema.json-272-        "beforeScan": {
docs/guides/config-guide.md:120:| `fullPageScreenshots` | `true`                            | Full-page PNG per page x viewport; embedded in the HTML report and carried into the report-builder draft.                                                                                                                                                                                                                                |
src/lib/wcag-em-summary.mjs:83:  '1.4.12': 'AA',
src/data/wcag-sc-names.json:34:  "1.4.12": "Text Spacing",
 * `failed` overrides everything else.
 *
 * @p ...
````

## 12. Bash

````bash
cd $REPO; grep -n "viewport" src/lib/group-findings.mjs src/lib/wcag-em-summary.mjs src/reporters/*.mjs | head -30; sed -n 105,115p src/lib/group-findings.mjs; sed -n 250,262p src/lib/wcag-em-summary.mjs; grep -n "viewport" TODO.md CHANGELOG.md | head
````

Output (truncated):

````text
src/reporters/report-builder-starter.mjs:504:        'sampling, axe-core scans per page and viewport, interactive process scans, and ' +
src/reporters/junit.mjs:131:  // which (url x viewport) pairs the audit could not cover.
src/reporters/junit.mjs:140:      const caseName = `${page.url} [${failure.viewport ?? 'viewport'}]`;
src/reporters/html.mjs:164:      ? html`<tr><th>Page views scanned (pages x viewports)</th><td>${summary.pageViewsScanned}</td></tr>\n`
src/reporters/html.mjs:217:    out += html`<li><strong>Not scanned</strong> (all viewports failed): <code>${p.url}</code> — ${p.failures?.[0]?.error ?? 'unknown error'}</li>\n`;
src/reporters/html.mjs:220:    const vps = (p.failures ?? []).map((/** @type {any} */ f) => f.viewport).join(', ');
src/reporters/html.mjs:227:    out += html ...
````

## 13. Bash

````bash
cd $REPO; sed -n 50,95p src/reporters/junit.mjs; grep -n -i "junit" docs/guides/integrations.md docs/adr/0008* | head -15; grep -n -i "best.practice\|bestPractice" src/reporters/junit.mjs src/reporters/report-builder-starter.mjs | head
````

Output (truncated):

````text
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);

  /** @type {string[]} */
  const cases = [];
  let testsCount = 0;
  let failuresCount = 0;

  for (const f of findings) {
    const ruleId = String(f.id ?? '');
    const pages = Array.isArray(f.pages) ? f.pages : [];
    const firstTarget = Array.isArray(f.targets) && f.targets.length ? String(f.targets[0]) : '';
    const exampleHtml =
      Array.isArray(f.examples) && f.examples[0]?.html ? String(f.examples[0].html) : '';
    // Treat findings as failures unless they declare otherwise. Grouped
    // findings are violation-only by construction; future versions may extend.
    const outcome = typeof f.outcome === 'string' ? f.outcome : 'failed';
    if (outcome === 'inapplicable') continue;
     ...
````

## 14. Bash

````bash
cd $REPO; grep -rn -A4 "failOnFindings" src/lib/config.mjs | head -15; sed -n 205,225p docs/adr/0008-pluggable-reporters.md; grep -n "REPA-17\|VERD-01\|SCAN-09\|DISC-08" $SCRATCH/review/round1-index.txt; grep -n -i "shadow\|proxy\|caret\|exit\b\|hang\|fullPage" $SCRATCH/review/round1-index.txt | head
````

Output (truncated):

````text
src/lib/config.mjs:54:// the default axe tag profile, `reporting.failOnFindings`, and deleted the legacy
src/lib/config.mjs-55-// `scan.viewport` singleton so DEFAULT_VIEWPORTS becomes reachable via
src/lib/config.mjs-56-// `resolveViewports`. Authenticated scans added `auth`, `wcagEm`. The reporter
src/lib/config.mjs-57-// pipeline added `reporting.reporters`.
src/lib/config.mjs-58-const DEFAULTS = {
--
src/lib/config.mjs:139:    failOnFindings: {
src/lib/config.mjs-140-      impacts: ['critical', 'serious'],
src/lib/config.mjs-141-      classifications: [],
src/lib/config.mjs-142-      threshold: 1,
src/lib/config.mjs-143-    },
The control-char regex is built programmatically via
`buildAttrPattern()` using `\u00XX` escapes — keeps source
files readable in editors / diffs (no literal con ...
````
