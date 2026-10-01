# Probe record: verify:A08

Role: packet verifier. Findings: SCAN-02, SCAN-03, SCAN-04, SCAN-09, SCAN-20, REPB-02

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" SCAN-02,SCAN-03,SCAN-04,SCAN-09,SCAN-20,REPB-02
````

Output (truncated):

````text
[
 {
  "dimension": "SCAN",
  "id": "SCAN-02",
  "title": "No per-page-view watchdog: scan.timeoutMs bounds only page.goto, so a busy page hangs the whole run indefinitely",
  "category": "robustness",
  "severity": "high",
  "status": "new",
  "claim": "scan.timeoutMs is only passed to page.goto. Everything that runs after navigation has no deadline: page.title(), page.evaluate(readBodyText), page.screenshot (Playwright's default 30s), and AxeBuilder.analyze(). A page whose main thread stays busy after DOMContentLoaded stalls the scan forever. No later URL or viewport is reached, and nothing is written.",
  "rootCause": "The per-attempt try/catch only catches errors that are thrown; nothing races runForPage against a deadline or tears down the context after one.",
  "evidence": [
   {
    ...
````

## 2. Bash

````bash
sed -n 470,560p src/commands/scan.mjs; echo ----; sed -n 100,220p bin/wcag-em.mjs
````

Output (truncated):

````text
  await run(ctx);
}
----
        err instanceof Error &&
        (err.name === 'PreflightError' || err.name === 'ConfigValidationError')
      ) {
        // Already formatted for humans.
        process.stderr.write(err.message + '\n');
      } else {
        logger.error(
          {
            err:
              err instanceof Error
                ? { name: err.name, message: err.message, stack: err.stack }
                : err,
          },
          'command failed',
        );
      }
      process.exitCode = 1;
    }
  };
}

// SECTION: Subcommands

program
  .command('discover')
  .description('Build the inventory of URLs from the site root + sitemap.')
  .action(
    asHandler(async (cmd) => {
      const ctx = await buildCtxFromProgram(cmd, { requirePlaywright: true });
       ...
````

## 3. Bash

````bash
cd $SCRATCH/review && python3 -c "
import json
d=json.load(open('round1-experiments.json'))
print(type(d), len(d))
if isinstance(d,dict): print(list(d.keys())[:20])
else: print(json.dumps(d[0],indent=1)[:1500])
"; ls ..; ls ../wf2 2>/dev/null
````

Output (truncated):

````text
<class 'list'> 145
{
 "dimension": "VERD",
 "what": "Probed axe.getRules() for SC tags, experimental/deprecated rules, best-practice+SC overlap, and ACT IDs compared with act-rule-map.json",
 "command": "node scratchpad/wf/verd/axe-rules.mjs",
 "result": "axe 4.11.3, 104 rules; 0 best-practice rules carry SC tags; default withTags touch 24 SCs, including 2.1.3 (AAA) via scrollable-region-focusable; wcag411 only on the deprecated duplicate-id rules; 28 ACT-map diffs, including wrong IDs for aria-valid-attr-value, label, audio-caption, th-has-data-cells and identical-links-same-purpose"
}
gate
review
wf
wf2
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

## 4. Bash

````bash
cd $SCRATCH && python3 -c "
import json
d=json.load(open('review/round1-experiments.json'))
for e in d:
  if e['dimension'] in ('SCAN','REPB'): print('-',e['dimension'],'|',e['command'][:120],'|',e['result'][:300])
"; ls wf/scan 2>/dev/null | head -50
````

Output (truncated):

````text
- SCAN | node SCRATCH/tags.cjs | 104 rules; 69 match the default tags; wcag22a has 0 rules; 5 experimental WCAG-tagged rules and 30 best-practice rules are excluded, including frame-tested.
- SCAN | node SCRATCH/probe/p1.mjs | /spa (with beforeScan waitFor), /image-only, /iframe-only, /form-only and /shadow were 'empty'. /404page and /500page audited as ok with no status recorded. /json and /text got document-title and html-has-lang violations. /xframe found violations in the cross-origin iframe. /collide/a/b and /collide
- SCAN | node SCRATCH/probe/p2.mjs | withRules alone: 62 rules ran (ignored). withRules with withTags []: 1 rule. Override withRules: ignored. Override runOnly with values [] made that page error. withTags ['wcag2.1aa']: 0 rules on every page, exit 0. runOnly with an unkn ...
````

## 5. Bash

````bash
cd $SCRATCH/wf/scan && ls probe | head -40; cat probe/p4.mjs | head -80
````

Output (truncated):

````text
harness.mjs
p1.mjs
p10.mjs
p11.mjs
p11b.mjs
p12.mjs
p13.mjs
p14.mjs
p15.mjs
p16.mjs
p17.mjs
p18.mjs
p19.mjs
p2.mjs
p20.mjs
p3.mjs
p4.mjs
p5.mjs
p6.mjs
p7.mjs
p8.mjs
p8b.mjs
p9.mjs
// Probe 4: a page whose main thread becomes busy after DOMContentLoaded.
import { startServer, html, page, runCli, makeRun } from './harness.mjs';
import fs from 'node:fs/promises';
const s = await startServer({
  '/busy': (q, r) => html(r, page('Busy', '<main><h1>Busy</h1><p>text</p></main><script>document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{const end=Date.now()+Number(new URLSearchParams(location.search).get("ms")||1e9);while(Date.now()<end){}},30))</script>')),
  '/next': (q, r) => html(r, page('Next', '<main><h1>Next</h1><p>text</p></main>')),
});
const busyUrl = s.baseUrl + '/busy' + (pr ...
````

## 6. Bash

````bash
sed -n 40,78p src/lib/scan-results.mjs; sed -n 395,436p src/lib/wcag-em-summary.mjs
````

Output (truncated):

````text
 * Classify a result entry (a page-view in `axe-results.json`, a process state,
 * or a synthetic test fixture). Order matters: a hard execution error wins over
 * a page-outcome tag, which wins over a redirect-duplicate marker.
 *
 * Legacy / pre-feature entries carry none of these fields; the `?? 'ok'`
 * fallback keeps them — and every existing test fixture — fully `auditable`,
 * so introducing the field set is behaviour-neutral for prior artefacts.
 *
 * @param {any} entry - One scan/process result object (or process state).
 * @returns {ViewStatus}
 */
export function viewStatus(entry) {
  // A thrown navigation/scan failure is recorded as a string `error` on the
  // result (scan.mjs failure-path push); that is an execution fault, distinct
  // from a could-not-audit page.
  if (typ ...
````

## 7. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A08 && cd $SCRATCH/wf2/verify-A08 && cat > harness.mjs <<'EOF'
import http from 'node:http';
import { once } from 'node:events';
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
export const REPO = '$REPO';
export const HERE = path.dirname(new URL(import.meta.url).pathname);
export const doc = (title, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title></head><body>${body}</body></html>`;
export async function startServer(routes, fallback) {
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const h = routes[u.pathname] ?? fallback;
    if (h) return h(req, res, u);
    res.writeHead(404, { 'content-type': 'text/html' }); res.end(doc('404', '<main><h1>Not found</h1><p>nope</p></main>'));
  });
  srv.listen(0, '127.0.0.1'); await once(srv, 'listening');
  const base = `http://127.0.0.1:${srv.address().port}`;
  return { base, stop: () => new Promise((r) => { srv.closeAllConnections?.(); srv.close(() => r()); }) };
}
export function send(res, html, status = 200, headers = {}) { res.writeHead(status, { 'content-type': 'text/html; charset=utf-8', ...headers }); res.end(html); }
export async function makeRun(label, base, urls, over = {}) {
  const tpl = JSON.parse((await fs.readFile(REPO + '/test/fixtures/site.json.template', 'utf8')).replaceAll('__BASE_URL__', base));
  tpl.sample.structuredManual = urls;
  tpl.sample.autoSuggest.enabled = false;
  tpl.sample.randomPercentOfStructured = 0; tpl.sample.minRandomPages = 0;
  tpl.crawl.maxPages = 5; tpl.crawl.sitemapSeeding.enabled = false;
  for (const [k, v] of Object.entries(over)) tpl[k] = { ...(tpl[k] ?? {}), ...v };
  const dir = path.join(HERE, 'runs', label);
  await fs.rm(dir, { recursive: true, force: true });
  await fs.mkdir(dir + '/out', { recursive: true });
  const cfg = dir + '/site.json';
  await fs.writeFile(cfg, JSON.stringify(tpl, null, 2));
  return { dir, cfg, out: dir + '/out' };
}
function descendants(pid) {
  let out = [];
  try { const kids = execSync(`pgrep -P ${pid}`).toString().trim().split('\n').filter(Boolean).map(Number); for (const k of kids) out.push(k, ...descendants(k)); } catch {}
  return out;
}
export function runCli(args, { timeoutMs = 60000, cwd, onLine } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const child = spawn(process.execPath, [REPO + '/bin/wcag-em.mjs', ...args], { cwd: cwd ?? HERE, env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(HERE, 'crawlee-storage') }, detached: true });
    let stdout = '', stderr = '', timedOut = false;
    let buf = '';
    child.stdout.on('data', (d) => { stdout += d; buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); onLine?.(l, child); } });
    child.stderr.on('data', (d) => (stderr += d));
    const timer = setTimeout(() => { timedOut = true; const d = descendants(child.pid); for (const p of [...d, child.pid]) { try { process.kill(p, 'SIGKILL'); } catch {} } }, timeoutMs);
    child.on('exit', (code, signal) => { clearTimeout(timer); const leftover = descendants(child.pid); for (const p of leftover) { try { process.kill(p, 'SIGKILL'); } catch {} } resolve({ code, signal, timedOut, ms: Date.now() - t0, stdout, stderr, leftover }); });
  });
}
export { descendants };
export const msgs = (s) => s.split('\n').filter(Boolean).map((l) => { try { const j = JSON.parse(l); return `${j.msg}${j.url ? ' ' + j.url.replace(/http:\/\/127\.0\.0\.1:\d+/, '') : ''}${j.attempt ? ' a' + j.attempt : ''}${j.err ? ' ERR ' + String(j.err.message ?? j.err).slice(0, 140) : ''}`; } catch { return l.slice(0, 200); } });
export async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }
EOF
echo ok
````

Output (truncated):

````text
ok
````

## 8. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && cat > p-lifecycle.mjs <<'EOF'
import fs from 'node:fs/promises';
import { startServer, send, doc, makeRun, runCli, msgs, exists, descendants } from './harness.mjs';
const which = process.argv[2];
const s = await startServer({
  '/busy': (q, r, u) => send(r, doc('Busy', `<main><h1>Busy</h1><p>text</p></main><script>document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{const end=Date.now()+${'${'}0}+Number(new URLSearchParams(location.search).get("ms")||1e12);while(Date.now()<end){}},30))</script>`)),
}, (q, r, u) => send(r, doc('Page ' + u.pathname, `<main><h1>Page ${u.pathname}</h1><p>content text</p><img src="x.png"></main>`)));
const writeSample = (run, urls) => fs.writeFile(run.out + '/sample.json', JSON.stringify(urls));
const report = async (label, run, res) => {
  console.log(`== ${label}: exit=${res.code} signal=${res.signal} timedOut=${res.timedOut} ms=${res.ms} leftoverChildren=${res.leftover.length}`);
  console.log(msgs(res.stdout + '\n' + res.stderr).filter((l) => !/viewport (start|done)|scan viewports/.test(l)).slice(-12).join('\n'));
  const p = run.out + '/results/axe-results.json';
  if (await exists(p)) { const a = JSON.parse(await fs.readFile(p, 'utf8')); console.log('axe-results.json:', a.map((e) => `${e.url.replace(s.base, '')} err=${e.error ? e.error.slice(0, 90) : '-'} v=${e.violations.length} p=${e.passes} i=${e.incomplete} na=${e.inapplicable}`).join(' | ')); }
  else console.log('axe-results.json NOT written');
};
try {
  if (which === 'busy') {
    const run = await makeRun('busy', s.base, [s.base + '/'], { scan: { timeoutMs: 5000, retries: 0 } });
    await writeSample(run, [s.base + '/busy', s.base + '/next']);
    await report('busy-infinite (timeoutMs 5000, cap 45s)', run, await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 45000 }));
  }
  if (which === 'busy-bounded') {
    const run = await makeRun('busyb', s.base, [s.base + '/'], { scan: { timeoutMs: 5000, retries: 0 } });
    await writeSample(run, [s.base + '/busy?ms=20000', s.base + '/next']);
    await report('busy-bounded 20s (timeoutMs 5000)', run, await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 90000 }));
  }
  if (which === 'kill') {
    const run = await makeRun('kill', s.base, [s.base + '/'], { scan: { timeoutMs: 10000, retries: 0 } });
    await writeSample(run, Array.from({ length: 20 }, (_, i) => `${s.base}/p${i}`));
    let scanned = 0, killed = false;
    const res = await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 90000, onLine: (l, child) => {
      if (l.includes('"scanned"')) scanned++;
      if (scanned >= 5 && !killed) { killed = true; const d = descendants(child.pid); console.log('killing browser pids (children of CLI):', d.length); for (const p of d) { try { process.kill(p, 'SIGKILL'); } catch {} } }
    } });
    await report(`kill-browser after ${scanned} scanned`, run, res);
  }
  if (which === 'corrupt-state') {
    const run = await makeRun('corrupt', s.base, [s.base + '/'], { scan: { timeoutMs: 10000, retries: 0 } });
    await fs.writeFile(run.dir + '/state.json', '{ not json');
    const cfg = JSON.parse(await fs.readFile(run.cfg, 'utf8')); cfg.auth = { storageState: run.dir + '/state.json' }; await fs.writeFile(run.cfg, JSON.stringify(cfg));
    await writeSample(run, [s.base + '/a', s.base + '/b']);
    await report('corrupt storageState (cap 30s)', run, await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 30000 }));
  }
  if (which === 'longurl') {
    const run = await makeRun('longurl', s.base, [s.base + '/'], { scan: { timeoutMs: 10000, retries: 1 } });
    await writeSample(run, [s.base + '/long?q=' + 'x'.repeat(260), s.base + '/short']);
    await report('long url screenshot', run, await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 60000 }));
    const run2 = await makeRun('longurl-noshot', s.base, [s.base + '/'], { scan: { timeoutMs: 10000, retries: 0, fullPageScreenshots: false } });
    await writeSample(run2, [s.base + '/long?q=' + 'x'.repeat(260)]);
    await report('long url, screenshots off', run2, await runCli(['scan', '--config', run2.cfg, '--out-dir', run2.out], { timeoutMs: 60000 }));
  }
} finally { await s.stop(); }
EOF
grep -n 'end=Date' p-lifecycle.mjs | head -2
````

Output (truncated):

````text
5:  '/busy': (q, r, u) => send(r, doc('Busy', `<main><h1>Busy</h1><p>text</p></main><script>document.addEventListener("DOMContentLoaded",()=>setTimeout(()=>{const end=Date.now()+${'${'}0}+Number(new URLSearchParams(location.search).get("ms")||1e12);while(Date.now()<end){}},30))</script>`)),
````

## 9. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && python3 - <<'EOF'
p='p-lifecycle.mjs'; s=open(p).read(); s=s.replace("Date.now()+${'${'}0}+Number","Date.now()+Number"); open(p,'w').write(s)
EOF
grep -c "Date.now()+Number" p-lifecycle.mjs; source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p-lifecycle.mjs busy 2>&1 | tail -20
````

Output (truncated):

````text
1
== busy-infinite (timeoutMs 5000, cap 45s): exit=null signal=SIGKILL timedOut=true ms=45384 leftoverChildren=0
scanning /busy a1
axe-results.json NOT written
````

## 10. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && for w in busy-bounded kill corrupt-state longurl; do node p-lifecycle.mjs $w 2>&1 | tail -16; done
````

Output (truncated):

````text
== busy-bounded 20s (timeoutMs 5000): exit=0 signal=null timedOut=false ms=21528 leftoverChildren=0
scanning /busy?ms=20000 a1
scanned /busy?ms=20000
scanning /next a1
scanned /next
scan done
axe-results.json: /busy?ms=20000 err=- v=0 p=5 i=0 na=56 | /next err=- v=1 p=6 i=0 na=54
== kill-browser after 0 scanned: exit=0 signal=null timedOut=false ms=7199 leftoverChildren=0
scanned /p14
scanning /p15 a1
scanned /p15
scanning /p16 a1
scanned /p16
scanning /p17 a1
scanned /p17
scanning /p18 a1
scanned /p18
scanning /p19 a1
scanned /p19
scan done
axe-results.json: /p0 err=- v=1 p=6 i=0 na=54 | /p1 err=- v=1 p=6 i=0 na=54 | /p2 err=- v=1 p=6 i=0 na=54 | /p3 err=- v=1 p=6 i=0 na=54 | /p4 err=- v=1 p=6 i=0 na=54 | /p5 err=- v=1 p=6 i=0 na=54 | /p6 err=- v=1 p=6 i=0 na=54 | /p7 err=- v=1 p=6 i=0 na ...
````

## 11. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && python3 - <<'EOF'
p='harness.mjs'; s=open(p).read()
s=s.replace("child.stderr.on('data', (d) => (stderr += d));","let ebuf='';child.stderr.on('data', (d) => { stderr += d; ebuf += d; let i; while ((i = ebuf.indexOf('\\n')) >= 0) { const l = ebuf.slice(0, i); ebuf = ebuf.slice(i + 1); onLine?.(l, child); } });")
open(p,'w').write(s)
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p-lifecycle.mjs kill 2>&1 | tail -12
````

Output (truncated):

````text
scanned /p2
scanning /p3 a1
scanned /p3
scanning /p4 a1
scanned /p4
scanning /p5 a1
scan attempt failed /p5 a1 ERR page.goto: Target page, context or browser has been closed
Call log:
  - navigating to "http://127.0.0.1:56632/p5", waiting until "domconten
scan failed after retries /p5
command failed ERR browser.newContext: Target page, context or browser has been closed
axe-results.json NOT written
````

## 12. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p-lifecycle.mjs kill 2>&1 | grep "=="; ls runs/kill/out/results/ 2>&1
````

Output (truncated):

````text
== kill-browser after 5 scanned: exit=1 signal=null timedOut=false ms=2278 leftoverChildren=0
````

## 13. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && cat > p-pipeline.mjs <<'EOF'
import fs from 'node:fs/promises';
import { startServer, send, doc, makeRun, runCli, msgs, exists } from './harness.mjs';
const which = process.argv[2];
const challenge = which === 'challenge';
const s = await startServer({}, (q, r, u) => challenge
  ? send(r, '<!doctype html><html><head><title>Just a moment...</title></head><body><p>Checking your browser</p></body></html>', 403, { 'cf-mitigated': 'challenge', 'server': 'cloudflare' })
  : send(r, doc('Page ' + u.pathname, `<main><h1>Page ${u.pathname}</h1><p>content text here</p><img src="x.png"><a href="/a">A</a> <a href="/b">B</a></main>`)));
const urls = [s.base + '/', s.base + '/a', s.base + '/b'];
const REP = { reporters: ['json', 'markdown', 'junit', 'portal-export', 'report-builder-starter'] };
const variants = {
  control: {},
  tagtypo: { scan: { axe: { include: [], exclude: [], withRules: [], withTags: ['wcag2.1aa'], runOnly: null } } },
  runonly: { scan: { axe: { include: [], exclude: [], withRules: [], withTags: [], runOnly: { type: 'rule', values: ['imgae-alt'] } } } },
  challenge: {},
};
const v = variants[which];
const over = { reporting: REP };
const run = await makeRun('pipe-' + which, s.base, urls, over);
if (v.scan) { const c = JSON.parse(await fs.readFile(run.cfg, 'utf8')); c.scan.axe = v.scan.axe; await fs.writeFile(run.cfg, JSON.stringify(c, null, 2)); }
try {
  const res = await runCli(['audit', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 180000 });
  console.log(`== ${which}: audit exit=${res.code} timedOut=${res.timedOut} ms=${res.ms}`);
  console.log(msgs(res.stderr + res.stdout).filter((l) => /fail|warn|error|stage done|scan done|tag|rule/i.test(l)).slice(-10).join('\n'));
  const R = run.out + '/results/axe-results.json';
  if (await exists(R)) console.log('views:', JSON.parse(await fs.readFile(R, 'utf8')).map((e) => `${e.url.replace(s.base, '')} out=${e.pageOutcome ?? 'ok'} err=${e.error ? e.error.slice(0, 70) : '-'} v=${e.violations.length} p=${e.passes} i=${e.incomplete} na=${e.inapplicable}`).join(' | '));
  const md = await fs.readFile(run.out + '/reports/summary.md', 'utf8').catch(() => '');
  console.log('summary.md lines:', md.split('\n').filter((l) => /coverage|Grouped findings|audited|Scan health|failed|challenge/i.test(l)).slice(0, 8).join(' // '));
  const w = JSON.parse(await fs.readFile(run.out + '/reports/wcag-em-summary.json', 'utf8').catch(() => 'null'));
  if (w) { const c = {}; for (const o of w.criteriaOutcomes ?? []) c[o.outcome] = (c[o.outcome] ?? 0) + 1; console.log('automatedCoverage:', JSON.stringify(w.automatedCoverage), 'outcomes:', JSON.stringify(c)); }
  const sj = JSON.parse(await fs.readFile(run.out + '/reports/summary.json', 'utf8').catch(() => 'null'));
  if (sj) console.log('summary.json: samplePagesScanned', sj.samplePagesScanned, 'scanWarnings', JSON.stringify(sj.scanWarnings ?? []).slice(0, 300), 'health', JSON.stringify(sj.executionHealth ?? {}).slice(0, 200));
  const pe = JSON.parse(await fs.readFile(run.out + '/reports/portal-export.json', 'utf8').catch(() => 'null'));
  if (pe) console.log('portal-export summary:', JSON.stringify(pe.summary), 'status' in pe ? 'status=' + pe.status : '(no top-level status)', 'rawFindings', pe.rawFindings.length);
  const ju = await fs.readFile(run.out + '/reports/junit.xml', 'utf8').catch(() => '');
  console.log('junit testsuite:', (ju.match(/<testsuite[^>]*>/) ?? [''])[0]);
  const dr = JSON.parse(await fs.readFile(run.out + '/reports/report-builder-draft.json', 'utf8').catch(() => 'null'));
  if (dr) console.log('draft appendices:', JSON.stringify((dr.appendices ?? dr.report?.appendices ?? []).map((a) => a.title + ': ' + a.content.slice(0, 110))));
  if (which === 'runonly' || which === 'challenge') {
    const r2 = await runCli(['scan', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 120000 });
    const r3 = await runCli(['summarize', '--config', run.cfg, '--out-dir', run.out], { timeoutMs: 120000 });
    console.log(`standalone scan exit=${r2.code}  summarize exit=${r3.code}`);
  }
} finally { await s.stop(); }
EOF
ls $REPO/src/reporters/
````

Output (truncated):

````text
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
````

## 14. Bash

````bash
grep -n "portal-export.json\|'portal" src/reporters/portal-export.mjs | head -3; cd $SCRATCH/wf2/verify-A08 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p-pipeline.mjs control 2>&1 | tail -14
````

Output (truncated):

````text
stage done
stage start
stage done
stage start
stage done
[32mINFO[39m [33m PlaywrightCrawler:[39m Final request statistics:[90m {"requestsFinished":3,"requestsFailed":0,"retryHistogram":[3],"requestAvgFailedDurationMillis":null,"requestAvgFinishedDurat
[32mINFO[39m [33m PlaywrightCrawler:[39m Finished! Total 3 requests: 3 succeeded, 0 failed.[90m {"terminal":true}[39m
views: / out=ok err=- v=1 p=8 i=0 na=52 | /a out=ok err=- v=1 p=8 i=0 na=52 | /b out=ok err=- v=1 p=8 i=0 na=52
summary.md lines: - Grouped findings: 1 // - Automated coverage: complete (3/3 selected pages audited) // ## Grouped findings by rule
automatedCoverage: {"status":"complete","adequate":true,"pagesSelected":3,"pagesAudited":3,"pagesExcluded":0,"scopeExclusions":[]} outcomes: {"failed":1,"notTested":37,"ina ...
````

## 15. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && for w in control tagtypo runonly challenge; do node p-pipeline.mjs $w 2>&1 | grep -vE "PlaywrightCrawler|^stage (start|done)$|^\[" ; echo; done
````

Output (truncated):

````text
== control: audit exit=2 timedOut=false ms=3096
scan done
views: / out=ok err=- v=1 p=8 i=0 na=52 | /a out=ok err=- v=1 p=8 i=0 na=52 | /b out=ok err=- v=1 p=8 i=0 na=52
summary.md lines: - Grouped findings: 1 // - Automated coverage: complete (3/3 selected pages audited) // ## Grouped findings by rule
automatedCoverage: {"status":"complete","adequate":true,"pagesSelected":3,"pagesAudited":3,"pagesExcluded":0,"scopeExclusions":[]} outcomes: {"failed":1,"notTested":37,"inapplicable":12,"passed":7}
summary.json: samplePagesScanned 3 scanWarnings [] health {"sampleListedCount":3,"pagesInSample":3,"pagesFullyScanned":3,"pagesDegraded":[],"pagesFailed":[],"pagesUnauditable":[],"challengePages":0,"structuredMissingFromInventory":[],"pageViewsScanned":3,"pa
portal-export summary: {"totalIssues":1 ...
````

## 16. Bash

````bash
cd $SCRATCH/wf2/verify-A08/runs/pipe-tagtypo/out/reports && head -40 summary.md; grep -c "" summary.md; grep -il "not tested\|notTested" * 
````

Output (truncated):

````text
**Tool:** wcag-em-a11y-toolkit 1.1.0 (axe-core 4.11.2)

# Accessibility scan summary

Site: **e2e-fixture-site**
Generated: 2026-09-30T18:59:02.091Z

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
- Automated coverage: complete (3/3 selected pages audited)

## Random vs structured sample comparison

- New rule IDs found only in random sample: 0
- New clusters found only in random sample: 0
- Expand structured sample recommended: no

## Grouped findings by rule
 ...
````

## 17. Bash

````bash
cd $SCRATCH/wf2/verify-A08 && source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node -e "
const axe=require('$REPO/node_modules/axe-core');
const r=axe.getRules(); const tags=new Set(r.flatMap(x=>x.tags));
console.log(axe.version, r.length, 'wcag22a:',tags.has('wcag22a'),'wcag22aa:',tags.has('wcag22aa'),'WCAG2AA:',tags.has('WCAG2AA'),'wcag2.1aa:',tags.has('wcag2.1aa'));
" 2>&1 | tail -3
````

Output (truncated):

````text
4.11.3 104 wcag22a: false wcag22aa: true WCAG2AA: false wcag2.1aa: false
````
