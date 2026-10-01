# Probe record: verify:A17

Role: packet verifier. Findings: REPB-05, REPB-06, REPB-07, REPB-08, REPB-09, REPB-14, REPB-15, REPB-16, REPB-17, REPB-18, REPB-20, CAP-18

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" REPB-05,REPB-06,REPB-07,REPB-08,REPB-09,REPB-14,REPB-15,REPB-16,REPB-17,REPB-18,REPB-20,CAP-18
````

Output (truncated):

````text
[
 {
  "dimension": "REPB",
  "id": "REPB-05",
  "title": "junit.xml is not well-formed XML when page markup contains U+FFFE/U+FFFF (and the <error> path skips sanitisation)",
  "category": "correctness",
  "severity": "medium",
  "status": "new",
  "claim": "stripControlPattern only removes C0 controls (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F). XML 1.0 also forbids the noncharacters U+FFFE and U+FFFF. HTML parsing keeps these from `&#xFFFF;` references, and axe copies them into node.html. One such element makes the whole junit.xml unparseable. The `<error>` CDATA (scan-failure message) is not passed through the strip at all. The module docs claim this exact threat (a crafted page making strict parsers drop the CI report) is handled.",
  "evidence": [
   {
    "file": "src/reporters/junit.mjs",
   ...
````

## 2. Bash

````bash
cd $REPO; sed -n 1,260p src/reporters/junit.mjs | grep -n "" | sed -n '1,40p;50,80p;125,160p;225,265p'; ls docs/adr | grep -i -E "earl|junit|portal|report"
````

Output (truncated):

````text
1:// @ts-check
2:/**
3: * @file JUnit XML reporter — emits `junit.xml` (internal).
4: * @module reporters/junit
5: *
6: * @description
7: * Hand-rolled XML, zero deps. Pa11y-compatible single-`<testsuite>` shape:
8: * one `<testcase>` per (rule × url × first-target), with `<failure>` for
9: * both `failed` and `incomplete` results so CI fails on cantTell rather
10: * than silently passing.
11: *
12: * Truncation is character-based (`Array.from(s).slice(...).join('')`) so
13: * UTF-8 multi-byte sequences are never split — invalid UTF-8 in CDATA
14: * would break strict XML parsers. `]]>` is defused via the canonical
15: * replacement `]]]]><![CDATA[>` (close + reopen the CDATA section so the
16: * literal substring survives without terminating the wrapping block).
17: *
18: * `inapplicable` ...
````

## 3. Bash

````bash
cd $REPO; sed -n 40,50p src/reporters/junit.mjs; sed -n 80,125p src/reporters/junit.mjs; grep -n "escapeXmlAttr" -A12 src/reporters/junit.mjs | sed -n '/^[0-9]*:function/,+12p'; cat src/reporters/earl-jsonld.mjs | sed -n 1,240p
````

Output (truncated):

````text
/**
 * Emit `junit.xml` to `ctx.paths.reportsDir`.
 *
 * @param {Record<string, any>} summary
 * @param {{ paths: { reportsDir: string }, config?: any }} ctx
 * @returns {Promise<{ path: string, bytes: number }>}
 */
export async function emit(summary, ctx) {
  const includePasses = Boolean(ctx?.config?.reporting?.includePasses);
  const findings = sortFindings(Array.isArray(summary.findings) ? summary.findings : []);
        cases.push(
          `  <testcase classname="${escapeXmlAttr(ruleId)}" name="${escapeXmlAttr(caseName)}"/>`,
        );
      } else {
        failuresCount += 1;
        const body = buildFailureBody({
          help: typeof f.help === 'string' ? f.help : '',
          helpUrl: typeof f.helpUrl === 'string' ? f.helpUrl : '',
          selector: firstTarget,
         ...
````

## 4. Bash

````bash
cd $REPO; cat docs/adr/0009-earl-jsonld-output.md; grep -n -i "junit\|earl" TODO.md CHANGELOG.md | head -40
````

Output (truncated):

````text
# 0009. EARL JSON-LD as the default RDF serialisation

- Status: accepted
- Date: 2026-04-30
- Deciders: Jamie Sargent
- Consulted: ADR-0001 (project conventions; zero-dep stance + symbol-
  first citation rule), ADR-0007 (WCAG-EM Step 5 summary shape — the
  `criteriaOutcomes` array is the source of `earl:passed` Assertions
  when `includePasses` is on), ADR-0008 (pluggable reporter runtime —
  this ADR specifies the `earl-jsonld` reporter module's contract)

## Context and Problem Statement

`schemas/config.schema.json` lists `earl-jsonld` as a `reporters`
enum value. The W3C [EARL 1.0
Schema](https://www.w3.org/TR/EARL10-Schema/) is the canonical
machine-readable test-result vocabulary in the accessibility
ecosystem — Alfa, axe-reports, the W3C ACT-rules CG validator, VPAT
generators —  ...
````

## 5. Bash

````bash
cd $REPO; sed -n 108,122p docs/guides/integrations.md; grep -rn "pagesUnauditable" src | head -20; grep -n -i "unauditable\|could-not-audit\|challenge" CHANGELOG.md TODO.md | head -20
````

Output (truncated):

````text
## 3. CI — failing builds on findings

The pieces: `reporting.failOnFindings` controls the exit code (`2` when
finding GROUPS — unique rules — at the configured impacts reach the
threshold), and `reports/junit.xml` gives the CI system per-finding test
cases: violations as `<failure>`, needs-review items as
`<failure type="incomplete">` (ambiguity fails CI on purpose — triage it),
and execution failures as `<error type="scan-failure">` test cases so a page
that never scanned reads as an error, not a pass.

Minimal GitHub Actions job:

```yaml
a11y-audit:
  runs-on: ubuntu-latest
src/commands/summarize.mjs:198:  const pagesUnauditable = [...unauditableByUrl.entries()]
src/commands/summarize.mjs:244:    pagesUnauditable
src/commands/summarize.mjs:271:    pagesUnauditable,
src/commands/summari ...
````

## 6. Bash

````bash
D=$SCRATCH/wf2/verify-A17; mkdir -p $D/out; cat > $D/p.mjs <<'EOF'
const R='file://$REPO/src/reporters/';
const j=await import(R+'junit.mjs'); const e=await import(R+'earl-jsonld.mjs');
const out=process.argv[2];
const summary={site:'s',findings:[{id:'image-alt',impact:'critical',help:'h',helpUrl:'u',pages:['http://x/a','http://x/b'],targets:['#only-on-a','img.only-on-b'],examples:[{target:'#only-on-a',html:'<img id="only-on-a" data-x="A￿B￾">',pageUrl:'http://x/a'}]}],
 incompleteFindings:[],executionHealth:{pagesFailed:[{url:'http://x/f',failures:[{viewport:'d',error:'boom￿'}]}],pagesUnauditable:[{url:'http://x/c',views:[{outcome:'challenge'}]}]}};
const ctx={paths:{reportsDir:out},config:{reporting:{includePasses:false}}};
await j.emit(summary,ctx); await e.emit(summary,ctx);
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node $D/p.mjs $D/out && cat $D/out/junit.xml; xmllint --noout $D/out/junit.xml; echo xmllint=$?; python3 -c "
import json;d=json.load(open('$D/out/earl.jsonld'));print([(a['earl:subject'],a['earl:result'].get('earl:pointer')) for a in d['@graph']])"
````

Output (truncated):

````text
<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="WCAG-EM Audit" tests="3" failures="2" errors="1" time="0">
  <testcase classname="image-alt" name="http://x/a##only-on-a">
    <failure type="critical"><![CDATA[h
u
Selector: #only-on-a
HTML: <img id="only-on-a" data-x="A￿B￾">]]></failure>
  </testcase>
  <testcase classname="image-alt" name="http://x/b##only-on-a">
    <failure type="critical"><![CDATA[h
u
Selector: #only-on-a
HTML: <img id="only-on-a" data-x="A￿B￾">]]></failure>
  </testcase>
  <testcase classname="scan" name="http://x/f [d]">
    <error type="scan-failure"><![CDATA[boom￿]]></error>
  </testcase>
</testsuite>
$SCRATCH/wf2/verify-A17/out/junit.xml:7: parser error : Char 0xFFFF out of allowed range
HTML: <img id="only-on-a" data-x="A￿B￾">]]></failure>
                 ...
````

## 7. Bash

````bash
cd $REPO; sed -n 255,345p src/reporters/portal-export.mjs; sed -n 405,420p src/reporters/portal-export.mjs; sed -n 505,520p src/reporters/portal-export.mjs; grep -n "maxIncompleteExamplesPerRule" -r src schemas docs | head
````

Output (truncated):

````text
    );
  };
  /** @type {(id: any, url: string, ex: any) => void} */
  const addIncompleteExample = (id, url, ex) => {
    push(
      incompletes,
      id,
      url,
      typeof ex?.target === 'string' ? ex.target : null,
      ex?.html,
      ex?.failureSummary,
    );
  };
  /** @type {(entry: any, url: string) => void} */
  const ingest = (entry, url) => {
    for (const v of Array.isArray(entry?.violations) ? entry.violations : []) {
      for (const node of Array.isArray(v?.nodes) ? v.nodes : []) addViolationNode(v?.id, url, node);
    }
    for (const inc of Array.isArray(entry?.incompleteDetail) ? entry.incompleteDetail : []) {
      for (const ex of Array.isArray(inc?.examples) ? inc.examples : [])
        addIncompleteExample(inc?.id, url, ex);
    }
  };
  const logger = /**  ...
````

## 8. Bash

````bash
cd $REPO; grep -n -i "occurrenceCount" CHANGELOG.md TODO.md docs -r | head; grep -n -i "generatedAt\|timestamp" TODO.md | head; grep -n -i "fingerprint\|sourceFingerprint\|stable id\|retest" TODO.md docs/guides/integrations.md | head -20
````

Output (truncated):

````text
TODO.md:51:      Overlaps the open `occurrenceCount` P1 item below.
TODO.md:139:- [ ] **`occurrenceCount` semantics.** Reconcile (or rename) the distinct-element
TODO.md:199:      `occurrenceCount` divergence above.
docs/guides/integrations.md:57:  `occurrenceCount` from the instance list if they disagree.
CHANGELOG.md:157:  and `occurrenceCount === instances.length` (the portal reconciles to the
CHANGELOG.md:231:- **instances** (`portal-export rawFindings[].occurrenceCount`) — distinct
CHANGELOG.md:244:- `occurrenceCount` semantics — reconcile/rename the distinct-element count
docs/reviews/2026-06-toolkit-review.md:113:| `occurrences` (per-node) vs portal `occurrenceCount` (deduped instances) — board P1 already owns; note: single-viewport runs mask it (AU counts agreed), multi-viewport ru ...
````

## 9. Bash

````bash
cd $REPO; sed -n 125,145p TODO.md; sed -n 196,215p TODO.md; sed -n 225,240p CHANGELOG.md; sed -n 50,60p docs/guides/integrations.md
````

Output (truncated):

````text
      `axe-results.json` yields an exit-0 "clean" report (probe P3). Distinguish + warn loudly; temp+rename writes. -> Sprint 1 T3.
- [ ] **Portal contract source-of-truth.** Replace the empirically-derived
      `schemas/portal-canonical-scan.schema.json` with the portal's published
      schema; add a `contractVersion` to the payload, negotiated at upload, so
      drift is caught at the boundary instead of via a failed upload.
      _Review-confirmed with sharper threat model: the portal ingests with zero
      warnings and silently rewrites (`scoreSource`), derives (`fingerprint`,
      `priorityScore`, `manualReviewIssues`) and truncates (2000-char evidence)
      — the risk is silent shadowing, not rejection. Authoritative source:
      portal `backend/src/scans/ingestion/scan-ingest ...
````

## 10. Bash

````bash
cd $REPO; grep -n "generatedAt" src/commands/summarize.mjs | head -5; grep -n "evaluationDate" src/lib/wcag-em-summary.mjs | head -3; P=$PORTAL/backend/src; sed -n 1,40p $P/scans/ingestion/utils/fingerprint.ts; grep -rn "scanFingerprint" $P --include=*.ts | grep -v spec | head -10
````

Output (truncated):

````text
609:    generatedAt: new Date().toISOString(),
22: *     evaluationDate: ISO-8601 string,
177: *   evaluationDate: string,
436:    evaluationDate: new Date().toISOString(),
import { createHash } from 'crypto';
import { CanonicalFinding } from '../scan-ingestion.types';

export function buildFindingFingerprint(input: {
  url: string;
  ruleId: string;
  selector: string | null;
  wcag: string[];
  message: string;
}): string {
  const normalizedUrl = normalizeUrlHost(input.url);
  const normalizedSelector = (input.selector || 'none').trim().toLowerCase();
  const normalizedWcag = [...input.wcag].sort((a, b) => a.localeCompare(b)).join(',');
  const normalizedMessage = input.message.trim().toLowerCase();

  const seed = `${normalizedUrl}|${input.ruleId.toLowerCase()}|${normalizedSelector}|${ ...
````

## 11. Bash

````bash
cd $REPO; sed -n 180,198p src/reporters/report-builder-starter.mjs; sed -n 300,330p src/reporters/report-builder-starter.mjs; sed -n 505,520p src/reporters/report-builder-starter.mjs; grep -n "generatedFrom\|travels with" src/reporters/report-builder-starter.mjs; grep -n "screenshot" src/commands/scan.mjs | head -5
````

Output (truncated):

````text
    path.join(resultsDir, 'axe-results.json'),
    [],
    /** @type {any} */ (ctx?.logger),
  );
  for (const entry of Array.isArray(axeResults) ? axeResults : []) {
    const url = typeof entry?.url === 'string' ? normalizeUrl(entry.url) : null;
    // E1: isAuditableView subsumes the prior `error` check and also excludes
    // challenge/empty page-views, so a could-not-audit URL never enters pagesTested.
    if (!url || !isAuditableView(entry)) continue;
    scanned.add(url);
    if (typeof entry?.screenshot === 'string' && !screenshotsByUrl.has(url)) {
      const outDir = ctx?.paths?.outDir;
      const rel =
        typeof outDir === 'string' ? path.relative(outDir, entry.screenshot) : entry.screenshot;
      screenshotsByUrl.set(url, rel);
    }
  }
  return { screenshotsByUrl, sca ...
````

## 12. Bash

````bash
cd $REPO; sed -n 560,572p src/reporters/report-builder-starter.mjs; grep -rn "sourceFolder" $RB --include=*.ts --include=*.js --include=*.json --include=*.md -l 2>/dev/null | grep -v node_modules | head -5; grep -rn "sourceFolder" $RB/src 2>/dev/null | head -5
````

Output (truncated):

````text
      'Evaluate the not-tested success criteria listed in the appendices.',
      'Replace placeholder client/meta fields and author the executive summary.',
    ],
    ...(appendices.length > 0 ? { appendices } : {}),
    draftMeta: {
      generatedAt: issueDate,
      generatedFrom:
        typeof ctx?.paths?.outDir === 'string' ? ctx.paths.outDir : 'toolkit output directory',
      instructions:
        'Machine-generated starter draft. Every finding carries draftStatus/needsManualReview; ' +
        'nothing here is client-ready until a human confirms it.',
    },
  };
(eval):1: no matches found: --include=*.ts
$RB/src/schemas/report.schema.js:210:    sourceFolder: NonEmptyString,
$RB/src/schemas/report.schema.js:433:        sourceFolder: NonEmptyString.optional(),
$RB/src/engine/buil ...
````

## 13. Bash

````bash
find $PORTAL $RB $VAULT -name "06-retest*" -not -path "*/node_modules/*" 2>/dev/null | head; cd $REPO; grep -rn -i "retest\|regression\|baseline" TODO.md | head
````

Output (truncated):

````text
$RB/docs/MyWebAccess-docs/Methodology/06-retest.md
$RB/docs/MyWebAccess-docs/Methodology/docx/06-retest.docx
TODO.md:216:- [ ] Baseline/regression mode — diff successive audits to surface new and
````

## 14. Bash

````bash
grep -n -i "finding id\|ID\b\|identifier" $RB/docs/MyWebAccess-docs/Methodology/06-retest.md | head -15; sed -n 214,220p $REPO/TODO.md
````

Output (truncated):

````text
33:1. Request from the client a list of finding IDs they have addressed
88:| **Finding-by-finding results** | Table: Finding ID, Original severity, Status, Notes |
108:- Red/Amber/Green status remains a communication aid only, not a conformance claim (see the four-way distinction in 00-index).
      cards, report-builder drafts) is the single biggest product unlock.
      Review C6.
- [ ] Baseline/regression mode — diff successive audits to surface new and
      resolved findings between runs.
- [ ] Plugin API — public extension surface for custom reporters and crawl
      strategies (ADR-0012 scopes the internal-only v1.0 boundary).
- [ ] Authenticated SPA crawler — `auth.setupScript` runtime execution, pending
````

## 15. Bash

````bash
cd $REPO; sed -n 60,100p src/lib/axe-artifact.mjs
````

Output (truncated):

````text
    help: typeof r.help === 'string' ? r.help : '',
    helpUrl: typeof r.helpUrl === 'string' ? r.helpUrl : '',
    firstTarget:
      Array.isArray(r.nodes) && r.nodes[0]?.target?.[0] ? String(r.nodes[0].target[0]) : null,
  }));
}

/**
 * Default per-rule cap on retained incomplete examples. ADR-0016 accepted
 * unbounded condensed examples on the grounds that incompletes are few; the
 * 2026-06 review's live run hit 32 occurrences on a single rule, so the
 * artefact is now bounded here at the source (config knob
 * `reporting.maxIncompleteExamplesPerRule`). `nodesCount` keeps the TRUE
 * total, so downstream occurrence counting is unaffected by the cap.
 */
export const DEFAULT_MAX_INCOMPLETE_EXAMPLES = 25;

/**
 * Like `liftRuleSummaries` but ALSO retains a condensed
 * `{ target, ht ...
````
