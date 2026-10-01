# Probe record: verify:A-X1

Role: packet verifier (catch-all packet). Findings: CAP-11

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" CAP-11
````

Output (truncated):

````text
[
 {
  "dimension": "CAP",
  "id": "CAP-11",
  "title": "Docs say documentLinkPatterns: [] crawls PDFs 'as page-equivalents'; in reality every PDF fails with 'Download is starting' after 3 retries and never enters the inventory",
  "category": "docs-drift",
  "severity": "medium",
  "status": "new",
  "claim": "Four places tell operators that emptying documentLinkPatterns makes PDFs crawl or scan as pages: the config guide's production advice ('For document-heavy audits where PDFs are deliverables under review ... so they crawl as page-equivalents'), the crawl field table, the README key-fields table, and discover's runtime warning. Headless Chromium turns a PDF navigation into a download: Crawlee's page.goto throws 'Download is starting', retries 3 times and records a navigation failure.  ...
````

## 2. Bash

````bash
cd $REPO; sed -n 60,70p docs/guides/config-guide.md; echo ---; sed -n 405,416p docs/guides/config-guide.md; echo ---; sed -n 72,76p README.md; echo ---; sed -n 185,205p src/commands/discover.mjs; echo ---; grep -rn "Download is starting\|page-equivalent\|pdf" src/crawl* src/commands/discover.mjs src/lib 2>/dev/null | grep -iv "^.*test" | head -30; grep -n "PDF\|documentLink" CHANGELOG.md TODO.md docs/adr/*.md | head -20
````

Output (truncated):

````text
| ----------------------- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `maxPages`              | `80`                          | Crawl ceiling. When hit, `inventory-metadata.json` records `reachedMaxPages: true` and summarize emits a truncation scan warning.       |
| `maxConcurrency`        | `5`                           | Parallel page loads. Drop to `2` for slow sites or heavy SPA hydration.                                                                 |
| `requestTimeoutSecs`    | `90`                          | Whole-request budget per crawled page (Crawlee handler).                                                                                |
| `navig ...
````

## 3. Bash

````bash
cd $SCRATCH; python3 -c "
import json;d=json.load(open('review/round1-experiments.json'));s=json.dumps(d);import re
i=s.find('Download is starting');print(s[max(0,i-1500):i+800])"; find . -path '*run4-pdf*' -maxdepth 4 | head; sed -n 290,312p $REPO/CHANGELOG.md
````

Output (truncated):

````text
/news_2024 share one PNG, which shows the underscore page but is attached as evidence for /news/2024's button-name finding. A 300-char query gave ENAMETOOLONG and the page was marked failed."}, {"dimension": "SEC", "what": "Process screenshot step-name traversal", "command": "node scratch/wf/sec/probe-stepname.mjs (runStep with a real Playwright page)", "result": "name '../../escaped/../../ESCAPED' wrote out/ESCAPED__desktop.png outside screenshots/, and 'Step 2 / after submit' created nested directories."}, {"dimension": "SEC", "what": "Pino redaction coverage", "command": "node scratch/wf/sec/probe-redact.mjs", "result": "auth.extraHttpHeaders, nested config.auth.httpCredentials.password, headers.authorization, contextOptions.* and URL userinfo were emitted verbatim. Top-level auth.* and ...
````

## 4. Bash

````bash
cd $SCRATCH/wf/cap/runs/run4-pdf; ls; cat *.json 2>/dev/null | head -c 400; find . -name inventory.json -o -name inventory-metadata.json -o -name '*.log' | head; for f in $(find . -name inventory.json); do python3 -c "import json;d=json.load(open('$f'));print([p.get('url') for p in (d if isinstance(d,list) else d.get('pages',[]))])"; done; grep -rho "Download is starting" . | sort | uniq -c
````

Output (truncated):

````text
cli.log
config.json
crawlee-storage
out
{
  "name": "cap-probe-site",
  "rootUrl": "http://127.0.0.1:63223/",
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
      "commonPaths": [
        "/sitemap.xml"
      ],./cli.log
./out/inventory/inventory-metadata.json
./out/inventory/inventory.json
['http://127.0.0.1:63223/', 'http://127.0.0.1:63223/about.html', 'http://127.0.0.1:63223/contact.html']
  19 Download is starting
````

## 5. Bash

````bash
cd $SCRATCH/wf/cap; grep -n documentLinkPatterns runs/run4-pdf/config.json; grep -rn "application/pdf" --include=*.mjs . | head -3; grep -n "failedRequest\|navigation" runs/run4-pdf/out/inventory/inventory-metadata.json | head
````

Output (truncated):

````text
22:    "documentLinkPatterns": []
(eval):1: no matches found: --include=*.mjs
14:  "failedRequestCount": 2,
16:    "navigation": 2
````
