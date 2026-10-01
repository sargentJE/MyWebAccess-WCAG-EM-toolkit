# Probe record: verify:A05

Role: packet verifier. Findings: SEC-01, SCAN-01, SCAN-06, SCAN-07, SCAN-08, SCAN-13

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SEC-01,SCAN-01,SCAN-06,SCAN-07,SCAN-08,SCAN-13
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
cd $SCRATCH && ls; ls review | head; ls wf2 2>/dev/null; python3 -c "
import json
d=json.load(open('review/round1-experiments.json'))
print(type(d), len(d))
import sys
items = d if isinstance(d,list) else list(d.values())
for e in items:
    s=json.dumps(e)
    if any(k in s for k in ['SEC-01','SCAN-01','SCAN-06','SCAN-07','SCAN-08','SCAN-13','expired-session']):
        print(s[:600]); print('---')
"
````

Output (truncated):

````text
gate
review
wf
wf2
round1-coverage.json
round1-experiments.json
round1-findings.json
round1-index.txt
round1-strengths.json
e2e
ops
stress
test
verify-A01
verify-A02
verify-A03
<class 'list'> 145
{"dimension": "SEC", "what": "Dead auth session", "command": "node scratch/wf/sec/probe-expired-session.mjs invalid-cookie | missing-file; probe-expired-plain.mjs", "result": "All protected pages audited as /login with 0 violations. summary.md says 'Automated coverage: complete (3 selected pages audited)', and portal averageScore is 100 with failed 0. invalid-cookie mode produced no warnings; missing-file mode produced one scan-stage stderr warn; the plain /login variant was reported 'partial' but still scored 100."}
---
````

## 3. Bash

````bash
grep -n -i "finalUrl\|redirect\|auth\b\|config.auth\|httpStatus\|status()" src/commands/summarize.mjs src/lib/wcag-em-summary.mjs src/lib/scan-results.mjs src/reporters/*.mjs | head -40; echo ---; grep -n -A12 '"storageState"' src/schemas/*.json 2>/dev/null | head -30; ls src/schemas 2>/dev/null || find src -name "*.schema.json" | head
````

Output (truncated):

````text
src/lib/scan-results.mjs:19: * nothing — which let could-not-audit pages and redirect duplicates leak into
src/lib/scan-results.mjs:36: * @typedef {'auditable' | 'errored' | 'challenge' | 'empty' | 'redirect-duplicate'} ViewStatus
src/lib/scan-results.mjs:42: * a page-outcome tag, which wins over a redirect-duplicate marker.
src/lib/scan-results.mjs:62:  // A page-view that resolved to an already-scanned final URL (redirect
src/lib/scan-results.mjs:64:  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';
src/lib/scan-results.mjs:81: * The canonical URL identifying a page-view: the post-redirect `finalUrl` when
src/lib/scan-results.mjs:82: * present, else the requested `url`. Normalised so redirect source + target
src/lib/scan-results.mjs:90:  const raw = entry?.fin ...
````

## 4. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A05 && cd $REPO && sed -n 60,70p src/lib/scan-results.mjs; grep -n "sampleJsonPath\|structured-sample" src/commands/sample.mjs | head -5; sed -n 400,471p src/commands/scan.mjs
````

Output (truncated):

````text
  if (outcome === 'error') return 'errored';

  // A page-view that resolved to an already-scanned final URL (redirect
  // dedupe): real, but its findings belong to the canonical view, not here.
  if (entry?.redirectedToAlreadyScanned === true) return 'redirect-duplicate';

  return 'auditable';
}

/**
 * The single predicate every raw-artefact consumer must use to decide whether
105:    path.join(paths.inventoryDir, 'structured-sample.txt'),
108:  await writeJson(path.join(paths.inventoryDir, 'structured-sample-suggested.json'), {
119:  await writeJson(paths.sampleJsonPath, finalSample);
  // try/catch is preserved so one bad page can't kill the scan for
  // subsequent URLs or subsequent viewports.
  for (const vp of viewports) {
    logger.info({ viewport: vp.id }, 'viewport start');
  ...
````

## 5. Write `$SCRATCH/wf2/verify-A05/probe.mjs`

````text
// Consolidated A05 probe: one CLI audit over a local fixture exercising
// SEC-01 (expired session -> login), SCAN-01 (404/429/json/off-origin IdP),
// SCAN-06 (SPA hydration + beforeScan waitFor), SCAN-07 (shadow/img-only),
// SCAN-08 (banner screenshot ordering), SCAN-13 (cf-ray + title).
import { createServer } from 'node:http';
import { once } from 'node:events';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO =
  '$REPO';
const OUT = path.join(HERE, 'out');
const mode = process.argv[2] ?? 'expired'; // expired | valid

const page = (title, body, { lang = 'en', head = '' } = {}) =>
  `<!doctype html><html${lang ? ` lang="${lang}"` : ''}><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;

let idpBase = '';
const idp = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/login') {
    res.writeHead(200, { 'content-type': 'text/html' });
    res.end(
      page(
        'Sign in - IdP',
        '<main><h1>Sign in</h1><p>Use your organisation account.</p><form><label for=e>Email</label><input id=e type=email><button type=submit>Continue</button></form></main>',
      ),
    );
    return;
  }
  res.writeHead(404);
  res.end('nf');
});
idp.listen(0, '127.0.0.1');
await once(idp, 'listening');
idpBase = `http://127.0.0.1:${idp.address().port}`;

let base = '';
const site = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;
  const cookie = req.headers.cookie ?? '';
  const html = (code, body, extra = {}) => {
    res.writeHead(code, { 'content-type': 'text/html; charset=utf-8', ...extra });
    res.end(body);
  };
  if (p === '/' || p === '/index.html')
    return html(200, page('Home', '<main><h1>Home</h1><p>Welcome to the charity.</p></main>'));
  if (p.startsWith('/account/')) {
    if (!cookie.includes('session=VALID')) {
      res.writeHead(302, { location: `/login?next=${encodeURIComponent(p)}` });
      return res.end();
    }
    return html(
      200,
      page(
        'My account',
        '<main><h1>Account</h1><p>Your orders.</p><img src="/pic.png"><button></button></main>',
      ),
    );
  }
  if (p === '/login')
    return html(
      200,
      page(
        'Log in',
        '<main><h1>Log in</h1><p>Please sign in to continue.</p><form><label for=u>User</label><input id=u><button type=submit>Log in</button></form></main>',
      ),
    );
  if (p === '/gone')
    return html(404, page('404 Not Found', '<h1>Not Found</h1><p>The page is gone.</p>', { lang: '' }));
  if (p === '/busy')
    return html(
      429,
      page('429 Too Many Requests', '<center><h1>429 Too Many Requests</h1></center><hr><center>nginx</center>', {
        lang: '',
      }),
    );
  if (p === '/data.json') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ok: true, items: [1, 2, 3] }));
  }
  if (p === '/sso') {
    res.writeHead(302, { location: `${idpBase}/login?return=${encodeURIComponent(base + p)}` });
    return res.end();
  }
  if (p === '/shadow')
    return html(
      200,
      page(
        'Shadow app',
        `<my-app></my-app><script>customElements.define('my-app',class extends HTMLElement{constructor(){super();this.attachShadow({mode:'open'}).innerHTML='<main><h1>App</h1><p>Shadow content here.</p><img src="/pic.png"></main>';}});</script>`,
      ),
    );
  if (p === '/imgonly') return html(200, page('Gallery', '<img src="/pic.png">'));
  if (p === '/spa')
    return html(
      200,
      page(
        'SPA',
        `<div id="app"></div><script>setTimeout(()=>{document.getElementById('app').innerHTML='<main><h1>Hydrated</h1><p>Content</p><img src="/pic.png"></main>';document.body.setAttribute('data-hydrated','1');},1200);</script>`,
      ),
    );
  if (p === '/banner')
    return html(
      200,
      page(
        'Banner page',
        `<main><h1>Banner page</h1><p>Body text.</p></main><div id="cb" style="position:fixed;inset:0;background:rgb(255,0,0);z-index:9"><button id="accept" onclick="document.getElementById('cb').remove()">Accept</button></div>`,
      ),
    );
  if (p === '/cfpost')
    return html(
      200,
      page(
        'Just a moment with our trustees',
        '<main><h1>Just a moment with our trustees</h1><p>A long real article.</p><img src="/pic.png"></main>',
      ),
      { 'cf-ray': '8c1d0000abcd-LHR', server: 'cloudflare' },
    );
  if (p === '/pic.png') {
    res.writeHead(200, { 'content-type': 'image/png' });
    return res.end(
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ),
    );
  }
  res.writeHead(404, { 'content-type': 'text/plain' });
  res.end('nf');
});
site.listen(0, '127.0.0.1');
await once(site, 'listening');
base = `http://127.0.0.1:${site.address().port}`;

const paths = [
  '/',
  '/account/one',
  '/account/two',
  '/gone',
  '/busy',
  '/data.json',
  '/sso',
  '/shadow',
  '/imgonly',
  '/spa',
  '/banner',
  '/cfpost',
];
const cfg = JSON.parse(
  (await fs.readFile(path.join(REPO, 'test/fixtures/site.json.template'), 'utf8')).replaceAll(
    '__BASE_URL__',
    base,
  ),
);
cfg.crawl.maxPages = 3;
cfg.crawl.sitemapSeeding.enabled = false;
cfg.sample.structuredManual = paths.map((p) => base + p);
cfg.sample.autoSuggest.enabled = false;
cfg.sample.minRandomPages = 0;
cfg.sample.randomPercentOfStructured = 0;
cfg.scan.waitUntil = 'networkidle';
cfg.scan.beforeScan = {
  actions: [
    { action: 'click', selector: '#accept', urlPattern: '/banner$' },
    { action: 'waitFor', selector: '[data-hydrated]', urlPattern: '/spa$' },
  ],
};
cfg.auth = {
  storageState: {
    cookies: [
      {
        name: 'session',
        value: mode === 'valid' ? 'VALID' : 'EXPIRED',
        domain: '127.0.0.1',
        path: '/',
        expires: -1,
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ],
    origins: [],
  },
};
const outDir = path.join(OUT, mode);
await fs.rm(outDir, { recursive: true, force: true });
await fs.mkdir(outDir, { recursive: true });
const cfgPath = path.join(outDir, 'cfg.json');
await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2));

const child = spawn(
  process.execPath,
  [path.join(REPO, 'bin/wcag-em.mjs'), 'audit', '--config', cfgPath, '--out-dir', outDir],
  {
    cwd: HERE,
    env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(HERE, 'crawlee-storage') },
    stdio: ['ignore', 'pipe', 'pipe'],
  },
);
let stdout = '';
let stderr = '';
child.stdout.on('data', (d) => (stdout += d));
child.stderr.on('data', (d) => (stderr += d));
const [code] = await once(child, 'exit');
await fs.writeFile(path.join(outDir, 'stdout.log'), stdout);
await fs.writeFile(path.join(outDir, 'stderr.log'), stderr);
site.close();
idp.close();
console.log(JSON.stringify({ mode, code, base, idpBase, outDir }));

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A05/probe.mjs (file state is current in your context — no need to Read it back)
````

## 6. Bash

````bash
cd $SCRATCH/wf2/verify-A05 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs expired; ls out/expired
````

Output (truncated):

````text
{"mode":"expired","code":2,"base":"http://127.0.0.1:56063","idpBase":"http://127.0.0.1:56062","outDir":"$SCRATCH/wf2/verify-A05/out/expired"}
cfg.json
inventory
reports
results
sample.json
screenshots
stderr.log
stdout.log
````

## 7. Bash

````bash
cd $SCRATCH/wf2/verify-A05/out/expired && python3 -c "
import json
r=json.load(open('results/axe-results.json'))
for e in r:
    print(e['url'].split(':',2)[2][5:] if True else '', '|', e.get('finalUrl','').replace('http://127.0.0.1',''), '|', e.get('title'), '|', e.get('pageOutcome'), '|', e.get('degradedReason'), '|', sorted(v['id'] for v in e['violations']), '|', e.get('screenshot') and e['screenshot'].split('/')[-1], '|', [ (s.get('action'), s.get('state')) for s in e.get('_preScanStates',[])], '|', [k for k in e if k in ('status','httpStatus','contentType')])
"; ls ../../out/expired/reports; grep -n -i "coverage\|scan health\|warning" reports/summary.md | head -20
````

Output (truncated):

````text
/ | :56063/ | Home | None | None | [] | 127.0.0.1_56063___desktop.png | [] | []
/account/one | :56063/login?next=%2Faccount%2Fone | Log in | None | None | [] | 127.0.0.1_56063_account_one__desktop.png | [] | []
/account/two | :56063/login?next=%2Faccount%2Ftwo | Log in | None | None | [] | 127.0.0.1_56063_account_two__desktop.png | [] | []
/gone | :56063/gone | 404 Not Found | None | None | ['html-has-lang'] | 127.0.0.1_56063_gone__desktop.png | [] | []
/busy | :56063/busy | 429 Too Many Requests | None | None | ['html-has-lang'] | 127.0.0.1_56063_busy__desktop.png | [] | []
/data.json | :56063/data.json |  | None | None | ['document-title', 'html-has-lang'] | 127.0.0.1_56063_data.json__desktop.png | [] | []
/sso | :56062/login?return=http%3A%2F%2F127.0.0.1%3A56063%2Fsso | Sign in - IdP |  ...
````

## 8. Bash

````bash
grep -n "function runProcessSteps" -A60 src/lib/process-runner.mjs | grep -n "push\|state\|return" | head -20; cd $SCRATCH/wf2/verify-A05/out/expired && grep -i "banner\|before-scan\|pre-scan\|warn" stderr.log stdout.log | head -10
````

Output (truncated):

````text
3:129-  const states = [];
4:130-  // E1: once a step errors, every subsequent recorded state ran against a page
13:139-      states.push(result);
14:140-      if (result.state === 'error' || result.state === 'step-timeout') priorStepErrored = true;
17:143-  return states;
21:147- * Run a single step. Returns the state entry to append (or `null` when the
22:148- * action produces no state — e.g. bare navigation).
26:152- * @returns {Promise<StepResult | null>}
32:158-    return await Promise.race([dispatch(step, ctx), timeout.promise]);
36:162-      return { state: 'step-timeout', name: err.action, error: err.message };
40:166-    return { state: 'error', name: step.action, error: message };
50:176- * returning the promise together with a `cancel()` that clears the handle.
59:185- * @retur ...
````

## 9. Bash

````bash
cd $SCRATCH/wf2/verify-A05/out/expired && python3 - <<'EOF'
import zlib,struct
def px(fn, fx=0.5, fy=0.5):
    d=open(fn,'rb').read()
    i=8; idat=b''; 
    while i<len(d):
        n=struct.unpack('>I',d[i:i+4])[0]; t=d[i+4:i+8]; c=d[i+8:i+8+n]
        if t==b'IHDR': w,h,bd,ct=struct.unpack('>IIBB',c[:10])
        if t==b'IDAT': idat+=c
        i+=12+n
    raw=zlib.decompress(idat); bpp={2:3,6:4}[ct]; stride=w*bpp
    prev=bytearray(stride); rows=[]; p=0
    for y in range(h):
        f=raw[p]; line=bytearray(raw[p+1:p+1+stride]); p+=1+stride
        for x in range(stride):
            a=line[x-bpp] if x>=bpp else 0; b=prev[x]; c=prev[x-bpp] if x>=bpp else 0
            if f==1: line[x]=(line[x]+a)&255
            elif f==2: line[x]=(line[x]+b)&255
            elif f==3: line[x]=(line[x]+(a+b)//2)&255
            elif f==4:
                pa=abs(b-c); pb=abs(a-c); pc=abs(a+b-2*c)
                pr=a if pa<=pb and pa<=pc else (b if pb<=pc else c)
                line[x]=(line[x]+pr)&255
        rows.append(line); prev=line
    x=int(w*fx); y=int(h*fy)
    return (w,h), tuple(rows[y][x*bpp:x*bpp+bpp])
for f in ['screenshots/127.0.0.1_56063_banner__desktop.png','screenshots/127.0.0.1_56063___desktop.png']:
    import glob
    print(f, px(f))
EOF
ls screenshots
````

Output (truncated):

````text
screenshots/127.0.0.1_56063_banner__desktop.png ((1280, 800), (255, 0, 0))
screenshots/127.0.0.1_56063___desktop.png ((1280, 800), (255, 255, 255))
127.0.0.1_56063___desktop.png
127.0.0.1_56063_account_one__desktop.png
127.0.0.1_56063_account_two__desktop.png
127.0.0.1_56063_banner__desktop.png
127.0.0.1_56063_busy__desktop.png
127.0.0.1_56063_data.json__desktop.png
127.0.0.1_56063_gone__desktop.png
127.0.0.1_56063_sso__desktop.png
````

## 10. Bash

````bash
cd $SCRATCH/wf2/verify-A05/out/expired && sed -n 1,60p reports/summary.md; python3 -c "
import json; s=json.load(open('reports/summary.json')); print(json.dumps(s.get('executionHealth'),indent=0)[:1500]); print(s.get('scanWarnings'))"
````

Output (truncated):

````text
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **e2e-fixture-site**
Generated: 2026-09-30T18:49:51.169Z

## Method guardrails

- This is the automated layer of the audit workflow.
- It does not make a sitewide WCAG conformance claim on its own.
- Complete processes and manual checks still need separate review.

## Run summary

- Inventory count: 1
- Final selected sample: 12
- Sample pages scanned: 8
- Page views scanned (pages x viewports): 8
- Process runs: 0
- Grouped findings: 2
- Automated coverage: partial — PARTIAL (8/12 selected pages audited; 4 excluded — see Scan health)

## Scan health

- Could not audit (challenge) — review by hand: http://127.0.0.1:56063/cfpost
- Could not audit (empty) — review by hand: http://127.0.0.1:56063/imgon ...
````

## 11. Bash

````bash
cd $SCRATCH/wf2/verify-A05 && sed -n 529,545p $REPO/schemas/config.schema.json && python3 - <<'EOF'
p='probe.mjs'
s=open(p).read()
s=s.replace("const mode = process.argv[2] ?? 'expired'; // expired | valid","const mode = process.argv[2] ?? 'expired'; // expired | valid | expired-min | valid-min\nconst MIN = mode.endsWith('-min');")
s=s.replace("value: mode === 'valid' ? 'VALID' : 'EXPIRED'","value: mode.startsWith('valid') ? 'VALID' : 'EXPIRED'")
s=s.replace("cfg.sample.structuredManual = paths.map((p) => base + p);","cfg.sample.structuredManual = (MIN ? ['/', '/account/one', '/account/two'] : paths).map((p) => base + p);\ncfg.reporting.reporters = ['json', 'markdown', 'portal-export'];")
open(p,'w').write(s)
EOF
grep -n "MIN\|reporters\|VALID" probe.mjs
````

Output (truncated):

````text
        "reporters": {
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
        },
        "includePasses": {
          "type": "boolean"
16:const MIN = mode.endsWith('-min');
53:    if (!cookie.includes('session=VALID')) {
162:cfg.sample.structuredManual = (MIN ? ['/', '/account/one', '/account/two'] : paths).map((p) => base + p);
163:cfg.reporting.reporters = ['json', 'markdown', 'portal-export'];
179:        value: mode.startsWith('valid') ? 'VALID' : 'EXPIRED',
````

## 12. Bash

````bash
cd $SCRATCH/wf2/verify-A05 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs expired-min && node probe.mjs valid-min && for m in expired-min valid-min; do echo "== $m"; python3 -c "
import json,sys
d='out/$m/'
r=json.load(open(d+'results/axe-results.json'))
for e in r: print(' ', e['url'][-13:], '->', e.get('finalUrl','')[-30:], e.get('title'), sorted(v['id'] for v in e['violations']))
s=json.load(open(d+'reports/summary.json'))
print('  scanWarnings:', s.get('scanWarnings'))
w=json.load(open(d+'reports/wcag-em-summary.json')); print('  automatedCoverage:', w.get('automatedCoverage'))
import glob
pe=glob.glob(d+'reports/portal-export*.json')
if pe:
  p=json.load(open(pe[0])); 
  def find(o,k):
    if isinstance(o,dict):
      for kk,v in o.items():
        if kk==k: yield v
        yield from find(v,k)
    elif isinstance(o,list):
      for v in o: yield from find(v,k)
  print('  averageScore:', list(find(p,'averageScore')), 'scoreBasis:', list(find(p,'scoreBasis'))[:1], 'rawFindings:', len(list(find(p,'rawFindings'))[0]) if list(find(p,'rawFindings')) else None)
"; grep -n "Automated coverage" out/$m/reports/summary.md; grep -c '"level":40' out/$m/stderr.log; done
````

Output (truncated):

````text
{"mode":"expired-min","code":0,"base":"http://127.0.0.1:56115","idpBase":"http://127.0.0.1:56114","outDir":"$SCRATCH/wf2/verify-A05/out/expired-min"}
{"mode":"valid-min","code":2,"base":"http://127.0.0.1:56127","idpBase":"http://127.0.0.1:56126","outDir":"$SCRATCH/wf2/verify-A05/out/valid-min"}
== expired-min
  .0.0.1:56115/ -> http://127.0.0.1:56115/ Home []
  5/account/one -> 15/login?next=%2Faccount%2Fone Log in []
  5/account/two -> 15/login?next=%2Faccount%2Ftwo Log in []
  scanWarnings: ['force-included sample URL is not in the crawl inventory: http://127.0.0.1:56115/account/one — verify it is reachable / in scope', 'force-included sample URL is not in the crawl inventory: http://127.0.0.1:56115/account/two — verify it is reachable / in scope']
  automatedCoverage: {'status': 'comple ...
````

## 13. Bash

````bash
grep -n -i "waf\|classifier\|confidence\|page-guard\|pageOutcome\|screenshot" TODO.md | head -20; grep -rn -i "auth\b\|storageState\|authenticated" src/reporters/*.mjs src/lib/wcag-em-summary.mjs | head -5; grep -n "requestDelayMs\|throttle\|Retry-After" src/commands/scan.mjs | head
````

Output (truncated):

````text
29:      audits of WAF/Cloudflare-gated pages. Default behaviour byte-identical.
38:- [ ] **Durable WAF access (E8 follow-up).** CDP-attach is a per-session bridge
42:      [ADR-0021](docs/adr/0021-waf-challenge-access-strategy.md) (proposed).
114:      directly (site-derived ID prefix, synthesized sampling notes, screenshots
200:- [x] Carry toolkit screenshots into the report-builder chain as typed
201:      `screenshot` evidence (path + alt) — currently lost. -> Sprint 1 T6.
````

## 14. Bash

````bash
grep -ln "screenshot" src/reporters/*.mjs; grep -n -i "screenshot" docs/guides/user-manual.md docs/guides/config-guide.md | head -8; cd $SCRATCH/wf2/verify-A05 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "
import('file://$REPO/src/lib/page-guard.mjs').then(({classifyPageOutcome:c})=>{
const H='www.example.org'; const a=[H];
const cases={
 akamai403:{status:403,headers:{server:'AkamaiGHost'},title:'Access Denied',bodyText:'You don\'t have permission to access this resource. Reference #18.abc'},
 cf1020:{status:403,headers:{'cf-ray':'x-LHR',server:'cloudflare'},title:'Access denied | www.example.org used Cloudflare to restrict access',bodyText:'Error 1020 Access denied'},
 cfBlockOld:{status:403,headers:{'cf-ray':'x-LHR',server:'cloudflare'},title:'Attention Required! | Cloudflare',bodyText:'Sorry, you have been blocked'},
 article200cfray:{status:200,headers:{'cf-ray':'x-LHR'},title:'Please wait for our new service',bodyText:'Real article'},
 login401:{status:401,headers:{},title:'Sign in',bodyText:'Please sign in'},
};
for (const [k,v] of Object.entries(cases)) console.log(k, JSON.stringify(c({...v,url:'https://'+H+'/x',challengeHosts:a})));
})"
````

Output (truncated):

````text
src/reporters/report-builder-starter.mjs
src/reporters/html.mjs
docs/guides/user-manual.md:54:  screenshots/  full-page captures (per page x viewport, per process state)
docs/guides/user-manual.md:70:   by rule with evidence and screenshots, needs-review section.
docs/guides/user-manual.md:104:| `screenshots/*.png`                                                         | `<url>__<viewport>.png` per page-view; `<url>__<process>__<state>__<viewport>.png` per process step.                      |
docs/guides/config-guide.md:120:| `fullPageScreenshots` | `true`                            | Full-page PNG per page x viewport; embedded in the HTML report and carried into the report-builder draft.                                                                                                       ...
````

## 15. Bash

````bash
pgrep -fl "verify-A05" | head; pgrep -fl "wcag-em.mjs audit" | grep -c verify-A05 || true
````

Output (truncated):

````text
0
````
