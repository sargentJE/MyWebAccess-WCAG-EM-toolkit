# Probe record: verify:A12

Role: packet verifier. Findings: DISC-08, DISC-10, DISC-11, DISC-12, DISC-13, DISC-21, DISC-24, DISC-25, SEC-13, SEC-21, SAMP-13

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" DISC-08,DISC-10,DISC-11,DISC-12,DISC-13,DISC-21,DISC-24,DISC-25,SEC-13,SEC-21,SAMP-13
````

Output (truncated):

````text
[
 {
  "dimension": "SAMP",
  "id": "SAMP-13",
  "title": "No Step-3 integrity guards: an empty structured sample, a disabled random tier and an empty final sample pass silently, and the small-site flag fires on capped crawls and is surfaced nowhere",
  "category": "robustness",
  "severity": "low",
  "status": "new",
  "claim": "sample.run warns only about structured URLs missing from the inventory. It exits 0 with no warning when the structured sample is empty (for example autoSuggest off or no preferTypes match: the sample becomes 2 random pages), when the random tier is disabled (randomPercentOfStructured 0 and minRandomPages 0, although WCAG-EM 3.b requires one), or when the whole sample is empty. fullSiteSupplementaryRecommended compares inventoryCount with the threshold but ignores  ...
````

## 2. Bash

````bash
cd $REPO; cat -n src/lib/sitemap.mjs | sed -n 80,200p; echo ----; sed -n 130,150p src/commands/discover.mjs; sed -n 190,340p src/commands/discover.mjs | cat -n
````

Output (truncated):

````text
    80	  // (anti-amplification: a malicious index could otherwise fan out to thousands
    81	  // of fetches). Fetches are sequential — see DeterminismNote below.
    82	  const queue = [
    83	    ...new Set([
    84	      ...(sitemapSeeding.urls || []),
    85	      ...(sitemapSeeding.commonPaths || []).map((p) => new URL(p, rootUrl).toString()),
    86	    ]),
    87	  ];
    88	  /** @type {Set<string>} */
    89	  const seenDocs = new Set();
    90	  /** @type {Array<{ url: string, locs: string[] }>} */
    91	  const leaves = [];
    92	  /** @type {string[]} */
    93	  const neverReached = [];
    94	  let sitemapDocsFetched = 0;
    95	
    96	  while (queue.length > 0) {
    97	    const sitemapUrl = /** @type {string} */ (queue.shift());
    98	    if (seenDocs.has(sitemapUrl ...
````

## 3. Bash

````bash
cd $REPO; sed -n 340,420p src/commands/discover.mjs; echo ----; sed -n 190,210p src/lib/context.mjs; grep -n "documentLinkPatterns\|pdf" src/lib/config.mjs | head; echo ---; grep -rn "failedRequest\|failureReasons\|reachedSitemapCap\|neverReached\|fullSiteSupplementary" src --include=*.mjs | grep -v "commands/discover.mjs"; echo ---; sed -n 225,245p src/commands/summarize.mjs; grep -n "crawleeVersion\|\"crawlee\"" package.json; node -e "console.log(require('$REPO_MAIN/node_modules/crawlee/package.json').version)" 2>/dev/null; ls node_modules 2>/dev/null | head -2
````

Output (truncated):

````text
    }))
    .sort((a, b) => b.count - a.count || a.clusterKey.localeCompare(b.clusterKey));

  const processCandidates = inventory
    .filter((item) => item.processTypes.length > 0)
    .map((item) => ({
      url: item.url,
      processTypes: item.processTypes,
      pageType: item.pageType,
      formCount: item.formCount,
    }));

  // SECTION: Persist artefacts
  await writeJson(path.join(paths.inventoryDir, 'inventory.json'), inventory);
  await writeText(
    path.join(paths.inventoryDir, 'urls.txt'),
    inventory.map((item) => item.url).join('\n') + '\n',
  );
  await writeJson(path.join(paths.inventoryDir, 'page-clusters.json'), pageClusters);
  await writeJson(path.join(paths.inventoryDir, 'process-candidates.json'), processCandidates);
  // E5: document inventory — accessibil ...
````

## 4. Bash

````bash
cd $REPO; grep -rn "failedRequest\|failureReasons\|reachedSitemapCap\|neverReached\|fullSiteSupplementary" src test docs/adr docs/guides TODO.md CHANGELOG.md | grep -v "src/commands/discover.mjs\|src/lib/sitemap.mjs" | head -30; echo ---; sed -n 125,145p docs/reviews/2026-06-epics-E1-E7.md; echo; ls docs/adr | head -40
````

Output (truncated):

````text
src/commands/sample.mjs:100:  const fullSiteSupplementaryRecommended =
src/commands/sample.mjs:134:    fullSiteSupplementaryRecommended,
src/commands/sample.mjs:147:  if (fullSiteSupplementaryRecommended) {
test/unit/sitemap.test.mjs:164:  const { seeds, reachedSitemapCap } = await getSitemapSeeds(
test/unit/sitemap.test.mjs:178:  assert.equal(reachedSitemapCap, true, 'the events leaf was clipped by maxUrls');
test/unit/sitemap.test.mjs:222:test('anti-amplification: maxSitemapDocs bounds fetches; unfetched children are neverReached', async () => {
test/unit/sitemap.test.mjs:223:  const { seeds, neverReached, sitemapDocsFetched } = await getSitemapSeeds(
test/unit/sitemap.test.mjs:231:  assert.equal(neverReached.length, 2, 'both child sitemaps recorded as never-reached');
docs/adr/0018-fair ...
````

## 5. Bash

````bash
cd $REPO; sed -n 15,40p CHANGELOG.md; echo ---ADR18; sed -n 20,70p docs/adr/0018-fair-deterministic-sitemap-seeding.md; echo ---; grep -rn "deprecated" node_modules/@crawlee/basic/internals/basic-crawler.js | grep -i error | head; grep -n "failedRequestHandler" node_modules/@crawlee/basic/internals/basic-crawler.js | head
````

Output (truncated):

````text
  verdicts at **every** consumer (summarize, the WCAG-EM inversion, and the
  portal-export / report-builder / html reporters), not just `summary.json`.
  _Breaking for diff-based consumers:_ such pages drop out of findings and stop
  incrementing `pageViewsScanned` / `samplePagesScanned`. To avoid trading false
  findings for false **passes**, `wcag-em-summary.json` gains an
  `automatedCoverage` block (`status` + `pagesSelected`/`pagesAudited` +
  `scopeExclusions`); `executionHealth` gains
  `pagesUnauditable`/`challengePages`/`processStepFailures`; and
  `inventory-metadata.json` gains `failedRequestCount`/`failureReasons`. New
  config `scan.challenge.{waitForAutoSolveMs,hosts}`; the WAF bypass header /
  `cf_clearance` reuse the existing `auth.extraHTTPHeaders` / `auth.storageState`. ...
````

## 6. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A12 && cd $_ && cat > probe.mjs <<'EOF'
import http from 'node:http';
import zlib from 'node:zlib';
const R='$REPO';
const { getSitemapSeeds } = await import(`file://${R}/src/lib/sitemap.mjs`);
const { urlSkippedByExtension } = await import(`file://${R}/src/lib/urls.mjs`).catch(()=>({}));
const hits=[];
const B = http.createServer((q,s)=>{hits.push('B'+q.url+' ua='+q.headers['user-agent']);s.end('<urlset><url><loc>http://x/</loc></url></urlset>');});
await new Promise(r=>B.listen(0,'127.0.0.1',r)); const bp=B.address().port;
let base;
const docs = {
 '/ent.xml': ()=>`<urlset><url><loc>${base}/search?a=1&amp;b=2</loc></url><url><loc>${base}/caf&#233;</loc></url></urlset>`,
 '/cdata.xml': ()=>`<urlset><url><loc><![CDATA[${base}/cd]]></loc></url></urlset>`,
 '/ns.xml': ()=>`<sm:urlset xmlns:sm="http://www.sitemaps.org/schemas/sitemap/0.9"><sm:url><sm:loc>${base}/ns</sm:loc></sm:url></sm:urlset>`,
 '/idx.xml': ()=>`<sitemapindex><sitemap><loc>http://localhost:${bp}/b.xml</loc></sitemap></sitemapindex>`,
 '/d1.xml': ()=>`<urlset><url><loc>${base}/about</loc></url><url><loc>${base}/x</loc></url></urlset>`,
 '/d2.xml': ()=>`<urlset><url><loc>${base}/about</loc></url></urlset>`,
};
const A = http.createServer((q,s)=>{hits.push('A'+q.url); if(q.url==='/gz.xml.gz'){s.end(zlib.gzipSync(`<urlset><url><loc>${base}/gz</loc></url></urlset>`));return;} if(q.url==='/hang.xml'){return;} const f=docs[q.url]; if(!f){s.statusCode=404;return s.end();} s.end(f());});
await new Promise(r=>A.listen(0,'127.0.0.1',r)); base=`http://127.0.0.1:${A.address().port}`;
const scope={mode:'same-origin'};
for (const d of ['/ent.xml','/cdata.xml','/ns.xml','/gz.xml.gz']) {
  const r = await getSitemapSeeds(base+'/', {enabled:true,urls:[base+d],commonPaths:[],maxUrls:50}, scope);
  console.log(d, JSON.stringify(r.seeds));
}
const r2 = await getSitemapSeeds(base+'/', {enabled:true,urls:[base+'/idx.xml'],commonPaths:[],maxUrls:50}, scope);
console.log('idx', JSON.stringify(r2));
const r3 = await getSitemapSeeds(base+'/', {enabled:true,urls:[base+'/d1.xml',base+'/d2.xml'],commonPaths:[],maxUrls:50}, scope);
console.log('dup', JSON.stringify(r3));
const r4 = await getSitemapSeeds(base+'/', {enabled:true,urls:[base+'/missing.xml'],commonPaths:[],maxUrls:50}, scope);
console.log('404', JSON.stringify(r4));
const t0=Date.now();
const p = getSitemapSeeds(base+'/', {enabled:true,urls:[base+'/hang.xml'],commonPaths:[],maxUrls:50}, scope).then(()=> 'done');
const res = await Promise.race([p, new Promise(r=>setTimeout(()=>r('still-pending'),20000))]);
console.log('hang after', (Date.now()-t0)/1000, res);
console.log(hits.join('\n'));
// case sensitivity
const pats=[new RegExp('\\.(pdf|docx?|xlsx?|pptx?|odt|ods|odp|rtf)$')];
if (urlSkippedByExtension) console.log('upper skipped?', urlSkippedByExtension('http://h/a/Report.PDF',pats), 'lower', urlSkippedByExtension('http://h/a/r.pdf',pats));
A.closeAllConnections(); A.close(); B.close(); process.exit(0);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node probe.mjs
````

Output (truncated):

````text
/ent.xml ["http://127.0.0.1:56755/caf&","http://127.0.0.1:56755/search?a=1&amp%3Bb=2"]
/cdata.xml []
/ns.xml []
/gz.xml.gz []
idx {"seeds":[],"perSitemap":[{"url":"http://localhost:56754/b.xml","found":0,"contributed":0,"clipped":0}],"reachedSitemapCap":false,"neverReached":[],"sitemapDocsFetched":2}
dup {"seeds":["http://127.0.0.1:56755/about","http://127.0.0.1:56755/x"],"perSitemap":[{"url":"http://127.0.0.1:56755/d1.xml","found":2,"contributed":2,"clipped":0},{"url":"http://127.0.0.1:56755/d2.xml","found":1,"contributed":0,"clipped":1}],"reachedSitemapCap":true,"neverReached":[],"sitemapDocsFetched":2}
404 {"seeds":[],"perSitemap":[],"reachedSitemapCap":false,"neverReached":[],"sitemapDocsFetched":0}
hang after 20.003 still-pending
A/ent.xml
A/cdata.xml
A/ns.xml
A/gz.xml.gz
A/idx.xml
B/ ...
````

## 7. Bash

````bash
cd $REPO; grep -rn "robots" src | head -5; echo ---; sed -n 55,85p src/lib/config.mjs; echo ---; grep -rni "determinis\|reproducib" docs/guides docs/adr TODO.md CHANGELOG.md README.md | grep -vi "sitemap\|ADR-0018\|0018" | head -15; echo ---; grep -rln "guessPageType\|guessProcessTypes\|clusterKeyFor" test; ls test/e2e test/unit | grep -i "discover\|sitemap\|crawl"
````

Output (truncated):

````text
---
// `scan.viewport` singleton so DEFAULT_VIEWPORTS becomes reachable via
// `resolveViewports`. Authenticated scans added `auth`, `wcagEm`. The reporter
// pipeline added `reporting.reporters`.
const DEFAULTS = {
  scope: {
    mode: 'same-hostname',
    allowedHosts: [],
  },
  crawl: {
    maxPages: 80,
    maxConcurrency: 5,
    requestTimeoutSecs: 90,
    navigationTimeoutSecs: 60,
    // Crawl throttle in ms; wired into the Crawlee crawler's
    // `preNavigationHooks` in `src/commands/discover.mjs`. 0 = no delay.
    requestDelayMs: 0,
    sitemapSeeding: {
      enabled: true,
      urls: [],
      commonPaths: ['/sitemap.xml', '/sitemap_index.xml'],
      maxUrls: 500,
      maxSitemapDocs: 50,
    },
    excludeUrlPatterns: [],
    documentLinkPatterns: DEFAULT_DOCUMENT_LINK_PA ...
````

## 8. Bash

````bash
cd $REPO; ls test/e2e; for f in test/unit/discover-failed-request.test.mjs test/unit/discover-document-inventory.test.mjs test/unit/discover-evaluate.test.mjs; do echo "== $f"; grep -n "^test(\|^  test(\|test('" $f | head; grep -n "PlaywrightCrawler\|run(\|startServer\|createServer" $f | head -3; done 2>/dev/null; ls test/unit | grep -i discover; echo; sed -n 95,155p src/commands/sample.mjs
````

Output (truncated):

````text
authenticated-scan.test.mjs
discover-timeout.test.mjs
reporters-html-axe.test.mjs
reporters-smoke.test.mjs
scan-cdp.test.mjs
scan-challenge.test.mjs
scan-health.test.mjs
scan-redirect.test.mjs
== test/unit/discover-failed-request.test.mjs
16:test('classifyCrawlFailure: navigation timeouts bucket as timeout', () => {
23:test('classifyCrawlFailure: DNS/connection errors bucket as network', () => {
28:test('classifyCrawlFailure: 4xx/5xx statuses bucket as http-error', () => {
33:test('classifyCrawlFailure: goto/navigation failures without a status bucket as navigation', () => {
40:test('classifyCrawlFailure: anything else buckets as other', () => {
45:test('classifyCrawlFailure: falls back to request.errorMessages when error is absent', () => {
== test/unit/discover-document-inventory.test.mj ...
````

## 9. Bash

````bash
cd $REPO; grep -rn -A4 "minRandomPages\|randomPercentOfStructured\|smallSiteSupplementary" schemas/*.json 2>/dev/null | grep -n "minimum\|default\|minRandom\|randomPercent\|smallSite" | head; grep -n "maxPages\|smallSite" configs/example-site-with-processes.json; grep -rn "smallSite\|supplementary" docs/guides | head -5
````

Output (truncated):

````text
1:schemas/config.schema.json:196:        "randomPercentOfStructured": {
3:schemas/config.schema.json-198-          "minimum": 0,
6:schemas/config.schema.json:201:        "minRandomPages": {
8:schemas/config.schema.json-203-          "minimum": 0
12:schemas/config.schema.json:209:        "smallSiteSupplementaryScanThreshold": {
14:schemas/config.schema.json-211-          "minimum": 0
6:    "maxPages": 30,
docs/guides/config-guide.md:105:| `smallSiteSupplementaryScanThreshold` | `50`    | Inventories at/below this size log a "scan everything as a supplementary pass" recommendation.                                               |
````
