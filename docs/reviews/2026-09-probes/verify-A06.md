# Probe record: verify:A06

Role: packet verifier. Findings: DISC-01, DISC-02, DISC-03, DISC-04, DISC-05, DISC-06

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" DISC-01,DISC-02,DISC-03,DISC-04,DISC-05,DISC-06; grep -n "DISC-0[1-6]" $SCRATCH/review/round1-experiments.json | head
````

Output (truncated):

````text
[
 {
  "dimension": "DISC",
  "id": "DISC-01",
  "title": "allowed-hosts scope mode does nothing for link discovery: Crawlee's same-hostname filter silently drops the allowed hosts",
  "category": "correctness",
  "severity": "high",
  "status": "new",
  "claim": "With scope.mode 'allowed-hosts', discover passes the strategy 'same-hostname' to enqueueLinks. In Crawlee 3.17, transformRequestFunction runs before the strategy glob filter. So urlAllowedByScope accepts a link to an allowed host, and the strategy filter (`http{s,}://<root origin>/**`) then drops it. Links to allowed hosts are never crawled, and they are not counted in outOfScopeLinkCount or any other counter. Only sitemap seeds and structuredManual URLs can reach an allowed host. design-notes/01 names allowed-hosts as the one wa ...
````

## 2. Bash

````bash
node -e "console.log(require('./node_modules/@crawlee/core/package.json').version)"; grep -rn "\"enum\"" -A4 schemas/*.json 2>/dev/null | grep -i -A3 "same-hostname" | head; ls schemas 2>/dev/null; sed -n 120,240p node_modules/@crawlee/core/enqueue_links/enqueue_links.js
````

Output (truncated):

````text
3.17.0
schemas/config.schema.json:29:          "enum": ["same-hostname", "same-origin", "allowed-hosts"],
schemas/config.schema.json-30-          "description": "Crawl scope discipline. `same-hostname` (default) is safest for public sites."
schemas/config.schema.json-31-        },
schemas/config.schema.json-32-        "allowedHosts": {
schemas/config.schema.json-33-          "type": "array",
config.schema.json
portal-canonical-scan.schema.json
report-builder-draft.schema.json
            if (typeof excl === 'string' || 'glob' in excl) {
                urlExcludePatternObjects.push(...(0, shared_1.constructGlobObjectsFromGlobs)([excl]));
            }
            else if (excl instanceof RegExp || 'regexp' in excl) {
                urlExcludePatternObjects.push(...(0, shared_1.constructRe ...
````

## 3. Bash

````bash
cd $SCRATCH && ls; ls review | head -50; python3 -c "
import json;d=json.load(open('review/round1-experiments.json'));print(type(d), len(d))
items = d if isinstance(d,list) else list(d.values())
for e in items:
  s=json.dumps(e)
  if 'DISC' in s[:400] or 'discover' in s[:300]: print(s[:300]); print()
" | head -40
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
<class 'list'> 145
{"dimension": "SAMP", "what": "Determinism under reordering: same page set, reversed inventory order, same seed", "command": "node probes/p1-determinism.mjs (harness.mjs builds inventory/clusters exactly as discover.mjs:323-341, then runs sample.run with a fake ctx)", "result": "The random sample ch

{"dimension": "SAMP", "what": "Population of the random tier on a live local fixture (404/500/soft-404/401/403/redirects/utm/pdf)", "command": "node cli/site.mjs pop2 discover,sample,scan,summarize (CLI with --out-dir and CRAWLEE_STORAGE_DIR in scratch; servers on port 0)", "result": "The inventory 

{"dimension": "SAMP", "what": "Redirected structuredM ...
````

## 4. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A06 && ls $SCRATCH/wf2/
````

Output (truncated):

````text
e2e
ops
stress
test
verify-A01
verify-A02
verify-A03
verify-A04
verify-A05
verify-A06
````

## 5. Write `$SCRATCH/wf2/verify-A06/probe.mjs`

````text
// verify-A06: one localhost fixture (3 servers) exercising DISC-01..06.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCR = path.dirname(new URL(import.meta.url).pathname);
const REPO =
  '$REPO';
const CLI = `${REPO}/bin/wcag-em.mjs`;
const log = []; // {srv, host, path}

const html = (title, body = '') =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
const links = (arr) => arr.map((h) => `<a href="${h}">${h}</a>`).join(' ');

let PA, PB, PC;
function handlerA(req, res) {
  const u = new URL(req.url, 'http://x');
  log.push({ srv: 'A', host: req.headers.host, path: u.pathname });
  const p = u.pathname;
  const send = (code, type, body, extra = {}) => {
    res.writeHead(code, { 'content-type': type, ...extra });
    res.end(body);
  };
  const redir = (code, loc) => send(code, 'text/plain', '', { location: loc });
  // --- scope (DISC-01) ---
  if (p === '/scope/')
    return send(200, 'text/html', html('Scope root', links(['/scope/local', `http://127.0.0.1:${PA}/scope/shop`, `http://127.0.0.1:${PB}/shop2`])));
  if (p === '/scope/local' || p === '/scope/shop') return send(200, 'text/html', html(`Page ${p}`));
  // --- redirect + status (DISC-02, DISC-03) ---
  if (p === '/site/')
    return send(200, 'text/html', html('Site root', links(['/site/ok', '/site/go-admin', '/site/go-offsite', '/site/missing', '/site/err500', '/site/data.json', '/site/feed.xml', '/site/feed/'])));
  if (p === '/site/ok') return send(200, 'text/html', html('OK page'));
  if (p === '/site/go-admin') return redir(302, '/site/admin/secret');
  if (p === '/site/admin/secret') return send(200, 'text/html', html('Admin secret'));
  if (p === '/site/go-offsite') return redir(302, `http://[::1]:${PB}/offsite-link`);
  if (p === '/site/missing') return send(404, 'text/html', html('Not found'));
  if (p === '/site/err500') return send(500, 'text/html', html('Server error'));
  if (p === '/site/data.json') return send(200, 'application/json', '{"a":1}');
  if (p === '/site/feed.xml' || p === '/site/feed/')
    return send(200, 'application/rss+xml', '<?xml version="1.0"?><rss version="2.0"><channel><title>t</title></channel></rss>');
  if (p === '/site/moved') return redir(301, `http://[::1]:${PB}/elsewhere`);
  if (p === '/sitemap.xml')
    return send(200, 'application/xml', `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>http://localhost:${PA}/site/moved</loc></url></urlset>`);
  // --- maxPages accounting (DISC-04) ---
  if (p === '/mp/')
    return send(200, 'text/html', html('MP root', links([1, 2, 3, 4, 5, 6].map((i) => `/mp/r${i}`).concat([1, 2, 3, 4].map((i) => `/mp/p${i}`)))));
  if (/^\/mp\/r\d$/.test(p)) return redir(302, '/mp/target');
  if (p === '/mp/target' || /^\/mp\/p\d$/.test(p)) return send(200, 'text/html', html(`MP ${p}`));
  // --- slow site for concurrent storage (DISC-05) ---
  if (p === '/slow/')
    return send(200, 'text/html', html('Slow root', links(Array.from({ length: 12 }, (_, i) => `/slow/p${i}`))));
  if (p.startsWith('/slow/p')) return send(200, 'text/html', html(`Slow ${p}`));
  return send(404, 'text/html', html('Not found'));
}
function handlerB(req, res) {
  const u = new URL(req.url, 'http://x');
  log.push({ srv: 'B', host: req.headers.host, path: u.pathname });
  if (u.pathname === '/root-redirect') {
    res.writeHead(301, { location: `http://localhost:${PA}/site/` });
    return res.end();
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html(`Third-party ${u.pathname}`, links(['/tp-a', '/tp-b'])));
}
const CRED = 'Basic ' + Buffer.from('probe-user:probe-fixture-pass').toString('base64');
function handlerC(req, res) {
  const u = new URL(req.url, 'http://x');
  const ok = req.headers.authorization === CRED;
  log.push({ srv: 'C', host: req.headers.host, path: u.pathname, auth: ok });
  if (!ok) {
    res.writeHead(401, { 'www-authenticate': 'Basic realm="staging"', 'content-type': 'text/html' });
    return res.end(html('Unauthorized'));
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(html(`Staging ${u.pathname}`, u.pathname === '/' ? links(['/a', '/b']) : ''));
}
const listen = (h) =>
  new Promise((r) => {
    const s = http.createServer(h);
    s.listen(0, () => r(s));
  });

function baseCfg(name, rootUrl, over = {}) {
  const cfg = {
    name,
    rootUrl,
    scope: { mode: 'same-hostname', allowedHosts: [] },
    crawl: {
      maxPages: 50,
      maxConcurrency: 2,
      requestTimeoutSecs: 30,
      requestDelayMs: 0,
      excludeUrlPatterns: [],
      sitemapSeeding: { enabled: false, urls: [], commonPaths: ['/sitemap.xml'], maxUrls: 50 },
    },
    sample: { structuredManual: [rootUrl] },
  };
  for (const [k, v] of Object.entries(over)) cfg[k] = typeof v === 'object' && !Array.isArray(v) ? { ...cfg[k], ...v } : v;
  return cfg;
}

function runCli(label, cfg, { storage, extraEnv = {} } = {}) {
  return new Promise(async (resolve) => {
    const dir = path.join(SCR, 'runs', label);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    const cfgPath = path.join(dir, 'config.json');
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2));
    const t0 = Date.now();
    const cp = spawn(process.execPath, [CLI, 'discover', '--config', cfgPath, '--out-dir', path.join(dir, 'out')], {
      cwd: dir,
      env: { ...process.env, CRAWLEE_STORAGE_DIR: storage ?? path.join(dir, 'crawlee-storage'), ...extraEnv },
    });
    let err = '';
    cp.stdout.on('data', (d) => (err += d));
    cp.stderr.on('data', (d) => (err += d));
    cp.on('close', async (code) => {
      const read = async (f) => JSON.parse(await fs.readFile(path.join(dir, 'out', 'inventory', f), 'utf8').catch(() => 'null'));
      const inv = await read('inventory.json');
      const meta = await read('inventory-metadata.json');
      resolve({
        label,
        code,
        ms: Date.now() - t0,
        inventory: inv?.map((i) => `${i.url} | src=${i.sourceUrl} | title=${i.title}`),
        meta: meta && {
          seedCount: meta.seedCount,
          discoveredCount: meta.discoveredCount,
          outOfScopeLinkCount: meta.outOfScopeLinkCount,
          excludedByPatternCount: meta.excludedByPatternCount,
          failedRequestCount: meta.failedRequestCount,
          failureReasons: meta.failureReasons,
          maxPagesConfigured: meta.maxPagesConfigured,
          reachedMaxPages: meta.reachedMaxPages,
        },
        errTail: err
          .split('\n')
          .filter((l) => /ENOENT|Error|error|blocked|401|retries|WARN|warn/i.test(l))
          .slice(-6)
          .map((l) => l.slice(0, 260)),
      });
    });
  });
}

const [A, B, C] = [await listen(handlerA), await listen(handlerB), await listen(handlerC)];
PA = A.address().port;
PB = B.address().port;
PC = C.address().port;
const out = { ports: { PA, PB, PC } };
const reqs = (filter) => log.filter(filter).map((l) => `${l.srv} ${l.host}${l.path}${l.auth === undefined ? '' : ' auth=' + l.auth}`);
const which = process.argv[2] ?? 'all';
try {
  if (which === 'all' || which === 'scope') {
    log.length = 0;
    const r = await runCli('scope', baseCfg('scope', `http://localhost:${PA}/scope/`, { scope: { mode: 'allowed-hosts', allowedHosts: ['127.0.0.1'] } }));
    r.serverRequests = reqs(() => true);
    out.scope = r;
  }
  if (which === 'all' || which === 'redirect') {
    log.length = 0;
    const r = await runCli(
      'redirect',
      baseCfg('redirect', `http://localhost:${PA}/site/`, {
        crawl: { excludeUrlPatterns: ['/admin/'], sitemapSeeding: { enabled: true, urls: [], commonPaths: ['/sitemap.xml'], maxUrls: 50 } },
      }),
    );
    r.serverRequests = reqs(() => true);
    out.redirect = r;
  }
  if (which === 'all' || which === 'rootredir') {
    log.length = 0;
    const r = await runCli('rootredir', baseCfg('rootredir', `http://127.0.0.1:${PB}/root-redirect`));
    r.serverRequests = reqs(() => true);
    out.rootredir = r;
  }
  if (which === 'all' || which === 'maxpages') {
    log.length = 0;
    const r = await runCli('maxpages', baseCfg('maxpages', `http://localhost:${PA}/mp/`, { crawl: { maxPages: 6, maxConcurrency: 1 } }));
    r.serverRequests = reqs(() => true);
    out.maxpages = r;
  }
  if (which === 'all' || which === 'basicauth') {
    log.length = 0;
    const r = await runCli('basicauth', { ...baseCfg('basicauth', `http://localhost:${PC}/`), auth: { httpCredentials: { username: 'probe-user', password: 'probe-fixture-pass' }, extraHttpHeaders: { 'x-probe-bypass': '1' } } });
    r.serverRequests = reqs(() => true);
    out.basicauth = r;
  }
  if (which === 'all' || which === 'storage') {
    log.length = 0;
    const shared = path.join(SCR, 'runs', 'shared-storage');
    await fs.rm(shared, { recursive: true, force: true });
    const slow = (n) => baseCfg(n, `http://localhost:${PA}/slow/`, { crawl: { maxConcurrency: 1, requestDelayMs: 400 } });
    const p1 = runCli('storage-first', slow('storage-first'), { storage: shared });
    await new Promise((r) => setTimeout(r, 4000));
    const p2 = runCli('storage-second', slow('storage-second'), { storage: shared });
    out.storage = await Promise.all([p1, p2]);
    out.storage.forEach((s) => (s.inventoryCount = s.inventory?.length ?? null));
    out.storage.forEach((s) => delete s.inventory);
  }
} finally {
  A.close();
  B.close();
  C.close();
  A.closeAllConnections?.();
  B.closeAllConnections?.();
  C.closeAllConnections?.();
}
await fs.writeFile(path.join(SCR, `result-${which}.json`), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A06/probe.mjs (file state is current in your context — no need to Read it back)
````

## 6. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-A06 && timeout 300 node probe.mjs scope 2>&1 | tail -60
````

Output (truncated):

````text
(eval):1: command not found: timeout
````

## 7. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-A06 && node probe.mjs scope 2>&1 | tail -60
````

Output (truncated):

````text
{
 "ports": {
  "PA": 56248,
  "PB": 56249,
  "PC": 56250
 },
 "scope": {
  "label": "scope",
  "code": 0,
  "ms": 2644,
  "inventory": [
   "http://localhost:56248/scope | src=http://localhost:56248/scope | title=Not found"
  ],
  "meta": {
   "seedCount": 1,
   "discoveredCount": 1,
   "outOfScopeLinkCount": 0,
   "excludedByPatternCount": 0,
   "failedRequestCount": 0,
   "failureReasons": {},
   "maxPagesConfigured": 50,
   "reachedMaxPages": false
  },
  "errTail": [],
  "serverRequests": [
   "A localhost:56248/scope"
  ]
 }
}
````

## 8. Bash

````bash
cd $SCRATCH/wf2/verify-A06 && python3 - <<'EOF'
import re
s=open('probe.mjs').read()
s=s.replace("  const p = u.pathname;\n","  const p = u.pathname.length > 1 ? u.pathname.replace(/\\/$/, '') + (u.pathname.endsWith('/') ? '/' : '') : u.pathname;\n",1)
# simpler: match both forms by normalising route keys
s=s.replace("const p = u.pathname.length > 1 ? u.pathname.replace(/\\/$/, '') + (u.pathname.endsWith('/') ? '/' : '') : u.pathname;","const p = ['/scope','/site','/mp','/slow','/site/feed'].includes(u.pathname) ? u.pathname + '/' : u.pathname;")
open('probe.mjs','w').write(s)
EOF
grep -n "const p =" probe.mjs
````

Output (truncated):

````text
21:  const p = ['/scope','/site','/mp','/slow','/site/feed'].includes(u.pathname) ? u.pathname + '/' : u.pathname;
````

## 9. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-A06 && node probe.mjs all > all.log 2>&1; cat result-all.json
````

Output (truncated):

````text
{
 "ports": {
  "PA": 56257,
  "PB": 56258,
  "PC": 56259
 },
 "scope": {
  "label": "scope",
  "code": 0,
  "ms": 2803,
  "inventory": [
   "http://localhost:56257/scope | src=http://localhost:56257/scope | title=Scope root",
   "http://localhost:56257/scope/local | src=http://localhost:56257/scope/local | title=Page /scope/local"
  ],
  "meta": {
   "seedCount": 1,
   "discoveredCount": 2,
   "outOfScopeLinkCount": 0,
   "excludedByPatternCount": 0,
   "failedRequestCount": 0,
   "failureReasons": {},
   "maxPagesConfigured": 50,
   "reachedMaxPages": false
  },
  "errTail": [],
  "serverRequests": [
   "A localhost:56257/scope",
   "A localhost:56257/scope/local"
  ]
 },
 "redirect": {
  "label": "redirect",
  "code": 0,
  "ms": 2730,
  "inventory": [
   "http://[::1]:56258/elsewhere |  ...
````

## 10. Bash

````bash
grep -n "minRandomPages\|randomPercentOfStructured\|smallSiteSupplementaryScanThreshold" schemas/config.schema.json | head -5; grep -n "case 'audit'\|audit" bin/wcag-em.mjs | head -10
````

Output (truncated):

````text
196:        "randomPercentOfStructured": {
201:        "minRandomPages": {
209:        "smallSiteSupplementaryScanThreshold": {
9: *   discover | sample | scan | scan-processes | summarize | audit
191:  .command('audit')
````

## 11. Write `$SCRATCH/wf2/verify-A06/probe2.mjs`

````text
// verify-A06 probe2: (a) DISC-03 downstream: non-HTML inventory -> audit verdicts;
// (b) DISC-05: two concurrent discovers of DIFFERENT sites sharing one Crawlee storage dir.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const SCR = path.dirname(new URL(import.meta.url).pathname);
const REPO =
  '$REPO';
const CLI = `${REPO}/bin/wcag-em.mjs`;
const html = (title, body = '') =>
  `<!doctype html><html lang="en"><head><title>${title}</title></head><body><main><h1>${title}</h1>${body}</main></body></html>`;
const links = (arr) => arr.map((h) => `<a href="${h}">${h}</a>`).join(' ');
const hits = [];
function handler(req, res) {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname.replace(/\/$/, '') || '/';
  hits.push(`${req.headers.host}${p}`);
  const send = (c, t, b) => (res.writeHead(c, { 'content-type': t }), res.end(b));
  if (p === '/nh') return send(200, 'text/html', html('NH root', links(['/nh/ok', '/nh/data.json', '/nh/feed.xml'])));
  if (p === '/nh/ok') return send(200, 'text/html', html('NH ok'));
  if (p === '/nh/data.json') return send(200, 'application/json', '{"events":[{"id":1,"name":"x"}]}');
  if (p === '/nh/feed.xml')
    return send(200, 'application/rss+xml', '<?xml version="1.0"?><rss version="2.0"><channel><title>News</title><item><title>a</title></item></channel></rss>');
  if (p === '/slow') return send(200, 'text/html', html('Slow root', links(Array.from({ length: 12 }, (_, i) => `/slow/p${i}`))));
  if (p.startsWith('/slow/p')) return send(200, 'text/html', html(`Slow ${p}`));
  if (p === '/fast') return send(200, 'text/html', html('Fast root', links(Array.from({ length: 6 }, (_, i) => `/fast/f${i}`))));
  if (p.startsWith('/fast/f')) return send(200, 'text/html', html(`Fast ${p}`));
  return send(404, 'text/html', html('Not found'));
}
const srv = await new Promise((r) => {
  const s = http.createServer(handler);
  s.listen(0, () => r(s));
});
const P = srv.address().port;

function run(label, cmd, cfg, storage) {
  return new Promise(async (resolve) => {
    const dir = path.join(SCR, 'runs2', label);
    await fs.rm(dir, { recursive: true, force: true });
    await fs.mkdir(dir, { recursive: true });
    const cfgPath = path.join(dir, 'config.json');
    await fs.writeFile(cfgPath, JSON.stringify(cfg, null, 2));
    const cp = spawn(process.execPath, [CLI, cmd, '--config', cfgPath, '--out-dir', path.join(dir, 'out')], {
      cwd: dir,
      env: { ...process.env, CRAWLEE_STORAGE_DIR: storage ?? path.join(dir, 'crawlee-storage') },
    });
    let log = '';
    cp.stdout.on('data', (d) => (log += d));
    cp.stderr.on('data', (d) => (log += d));
    cp.on('close', async (code) => {
      await fs.writeFile(path.join(dir, 'log.txt'), log);
      const inv = JSON.parse(await fs.readFile(path.join(dir, 'out/inventory/inventory.json'), 'utf8').catch(() => 'null'));
      resolve({ label, code, dir, inventory: inv?.map((i) => i.url.replace(`http://localhost:${P}`, '')), errs: log.split('\n').filter((l) => /ENOENT|already been handled|Error:/.test(l)).slice(0, 4).map((l) => l.slice(0, 220)) });
    });
  });
}
const cfg = (name, root, over = {}) => ({
  name,
  rootUrl: root,
  scope: { mode: 'same-hostname', allowedHosts: [] },
  crawl: { maxPages: 50, maxConcurrency: 1, requestTimeoutSecs: 30, requestDelayMs: 0, excludeUrlPatterns: [], sitemapSeeding: { enabled: false, urls: [], commonPaths: [], maxUrls: 10 }, ...(over.crawl ?? {}) },
  sample: { structuredManual: [root], autoSuggest: { enabled: false }, randomPercentOfStructured: 1, minRandomPages: 10, randomSeed: 1, smallSiteSupplementaryScanThreshold: 0 },
  scan: { viewports: [{ id: 'desktop', width: 1280, height: 800 }], waitUntil: 'domcontentloaded', timeoutMs: 30000, retries: 0, fullPageScreenshots: false },
});
const out = { P };
try {
  const which = process.argv[2] ?? 'all';
  if (which === 'all' || which === 'nonhtml') {
    const r = await run('nonhtml', 'audit', cfg('nonhtml', `http://localhost:${P}/nh`));
    const sample = JSON.parse(await fs.readFile(path.join(r.dir, 'out/sample.json'), 'utf8').catch(() => 'null'));
    const reportsDir = path.join(r.dir, 'out/reports');
    const files = await fs.readdir(reportsDir).catch(() => []);
    const wf = files.find((f) => f === 'wcag-em-summary.json');
    const sf = files.find((f) => f === 'summary.json');
    const w = wf && JSON.parse(await fs.readFile(path.join(reportsDir, wf), 'utf8'));
    const s = sf && JSON.parse(await fs.readFile(path.join(reportsDir, sf), 'utf8'));
    const crit = (id) => {
      const list = w?.criteriaOutcomes ?? w?.criteria ?? w?.results ?? [];
      const arr = Array.isArray(list) ? list : Object.entries(list).map(([k, v]) => ({ id: k, ...v }));
      const c = arr.find((x) => (x.id ?? x.sc ?? x.criterion ?? x.successCriterion) === id);
      return c ? JSON.stringify(c).slice(0, 500) : null;
    };
    out.nonhtml = {
      code: r.code,
      inventory: r.inventory,
      sample: sample && JSON.stringify(sample).replaceAll(`http://localhost:${P}`, '').slice(0, 600),
      reports: files,
      findings: s?.findings?.map((f) => `${f.ruleId ?? f.id} ${f.impact} pages=${JSON.stringify((f.pages ?? []).map((p) => (typeof p === 'string' ? p : p.url)).map((u) => u?.replace(`http://localhost:${P}`, '')))}`),
      wKeys: w && Object.keys(w),
      sc242: crit('2.4.2'),
      sc311: crit('3.1.1'),
    };
  }
  if (which === 'all' || which === 'storage') {
    const shared = path.join(SCR, 'runs2', 'shared-storage');
    await fs.rm(shared, { recursive: true, force: true });
    const p1 = run('st-slow', 'discover', cfg('st-slow', `http://localhost:${P}/slow`, { crawl: { requestDelayMs: 500 } }), shared);
    await new Promise((r) => setTimeout(r, 4000));
    const p2 = run('st-fast', 'discover', cfg('st-fast', `http://localhost:${P}/fast`, { crawl: { requestDelayMs: 200 } }), shared);
    out.storage = (await Promise.all([p1, p2])).map((x) => ({ ...x, dir: undefined }));
  }
} finally {
  srv.close();
  srv.closeAllConnections?.();
}
await fs.writeFile(path.join(SCR, 'result2.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));

````

Output (truncated):

````text
File created successfully at: $SCRATCH/wf2/verify-A06/probe2.mjs (file state is current in your context — no need to Read it back)
````

## 12. Bash

````bash
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && cd $SCRATCH/wf2/verify-A06 && node probe2.mjs all > all2.log 2>&1; cat result2.json || tail -30 all2.log
````

Output (truncated):

````text
{
 "P": 56407,
 "nonhtml": {
  "code": 2,
  "inventory": [
   "/nh",
   "/nh/data.json",
   "/nh/feed.xml",
   "/nh/ok"
  ],
  "sample": "[\"/nh\",\"/nh/ok\",\"/nh/feed.xml\",\"/nh/data.json\"]",
  "reports": [
   "grouped-by-component.json",
   "grouped-by-rule.json",
   "manual-backlog.md",
   "random-vs-structured-comparison.json",
   "summary.json",
   "summary.md",
   "wcag-em-summary.json"
  ],
  "findings": [
   "document-title serious pages=[\"/nh/data.json\",\"/nh/feed.xml\"]",
   "html-has-lang serious pages=[\"/nh/data.json\",\"/nh/feed.xml\"]"
  ],
  "wKeys": [
   "tool",
   "automatedCoverage",
   "criteriaOutcomes",
   "evaluationDate",
   "processesEvaluated",
   "scanWarnings",
   "wcagVersion",
   "conformanceTarget",
   "atBaseline",
   "technologiesReliedUpon",
   "sampl ...
````

## 13. Bash

````bash
cd $SCRATCH/wf2/verify-A06 && find runs/redirect/crawlee-storage -maxdepth 3 | head; ls runs/redirect; grep -o '"cookieJar"' -r runs/redirect/crawlee-storage | head -2; comm -3 <(python3 -c "import json;print('\n'.join(sorted(i['url'] for i in json.load(open('runs/storage-first/out/inventory/inventory.json')))))") <(python3 -c "import json;print('\n'.join(sorted(i['url'] for i in json.load(open('runs/storage-second/out/inventory/inventory.json')))))"); pgrep -fl "wcag-em.mjs|chrome-headless|probe.mjs" | head
````

Output (truncated):

````text
runs/redirect/crawlee-storage
runs/redirect/crawlee-storage/request_queues
runs/redirect/crawlee-storage/key_value_stores
runs/redirect/crawlee-storage/request_queues/default
runs/redirect/crawlee-storage/key_value_stores/default
runs/redirect/crawlee-storage/request_queues/default/Om7VyCqAK5DxDGp.json
runs/redirect/crawlee-storage/request_queues/default/Yg7WOrbGNwNvDx5.json
runs/redirect/crawlee-storage/request_queues/default/iK2Qnk6CYjqQohr.json
runs/redirect/crawlee-storage/request_queues/default/0r1KcCSIstl5p7s.json
runs/redirect/crawlee-storage/request_queues/default/m9A074cdeLyemrA.json
config.json
crawlee-storage
out
runs/redirect/crawlee-storage/key_value_stores/default/SDK_SESSION_POOL_STATE.json:"cookieJar"
runs/redirect/crawlee-storage/key_value_stores/default/SDK_SESSION_POOL_S ...
````

## 14. Bash

````bash
grep -i "allow-list\|allowed-hosts\|storage\|status\|redirect\|maxPages\|auth" $SCRATCH/review/round1-index.txt | cut -c1-200 | head -30
````

Output (truncated):

````text
VERD-04 | medium | new | correctness | 4.1.1 Parsing (obsolete and removed in WCAG 2.2) is emitted as notTested in every default 2.2 run, and the client draft tells the author to evaluate it by hand |
VERD-09 | medium | new | correctness | automatedCoverage mixes page and page-view units: a redirect-duplicate or a single failed viewport makes coverage 'partial', and the 'see Scan health' pointer ca
VERD-19 | low | tracked-open | correctness | SC examples and pagesExamined in wcag-em-summary are keyed on the pre-redirect source URL while findings use finalUrl | src/lib/wcag-em-summary.mjs:311, sr
SAMP-01 | medium | new | correctness | The random tier can re-draw the post-redirect target of a structured URL. It is then folded as a redirect duplicate and coverage reads PARTIAL | src/commands/ ...
````
