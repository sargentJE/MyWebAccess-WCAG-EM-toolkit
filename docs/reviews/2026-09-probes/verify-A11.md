# Probe record: verify:A11

Role: packet verifier. Findings: DISC-07, DISC-09, DISC-15, DISC-16, DISC-17, DISC-18, DISC-19, DISC-20, DISC-26, SAMP-01, SAMP-02

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
cd $TMP && python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" DISC-07,DISC-09,DISC-15,DISC-16,DISC-17,DISC-18,DISC-19,DISC-20,DISC-26,SAMP-01,SAMP-02
````

Output (truncated):

````text
[
 {
  "dimension": "SAMP",
  "id": "SAMP-01",
  "title": "The random tier can re-draw the post-redirect target of a structured URL. It is then folded as a redirect duplicate and coverage reads PARTIAL",
  "category": "correctness",
  "severity": "medium",
  "status": "new",
  "claim": "The inventory is keyed on post-redirect final URLs. The random pool excludes structured URLs by literal string only. A structuredManual URL that redirects (for example /contact-us 301 to /get-in-touch) therefore leaves its target in the pool, and the random tier can draw the same page again. The same happens when auto-suggest picks the target as a cluster representative. Scan (ADR-0019) folds the second view as redirectedToAlreadyScanned. As a result the random tier silently loses a page, and automatedCover ...
````

## 2. Bash

````bash
grep -rn "\.canonical\|\.h1\b\|landmarkCount" src | grep -v "commands/discover.mjs"; grep -rn "canonical\|landmarkCount\|\.h1" src/lib/clusters*.mjs src/lib/page-type*.mjs 2>/dev/null; ls src/lib | head -50; grep -n "coverageStatus\|redirect-duplicate\|see Scan health" src/lib/wcag-em-summary.mjs | head
````

Output (truncated):

````text
Exit code 1
(eval):1: no matches found: src/lib/clusters*.mjs
````

## 3. Bash

````bash
grep -rn "canonical" src | grep -v "commands/discover.mjs" | head -5; grep -rn "landmarkCount\|item\.h1\|page\.h1" src | grep -v discover.mjs | head; grep -n "coverageStatus\|redirect-duplicate\|Scan health" src/lib/wcag-em-summary.mjs src/reporters/markdown.mjs 2>/dev/null | head -20; grep -rn "export function guessPageType" src
````

Output (truncated):

````text
src/lib/axe-artifact.mjs:31: * Join an axe node's `target` selector array into the canonical pipe-joined
src/reporters/_sort.mjs:40: * Sort findings by the canonical reporter contract. Returns a new array.
src/reporters/json.mjs:11: * the `ruleId asc` tiebreaker the canonical contract requires).
src/lib/urls.mjs:8: *  - `normalizeUrl` — canonical form (hash strip, default ports drop, tracking
src/lib/urls.mjs:29: * Return a canonicalised URL string.
src/lib/wcag-em-summary.mjs:419:  let coverageStatus;
src/lib/wcag-em-summary.mjs:420:  if (pagesAudited === 0) coverageStatus = 'none';
src/lib/wcag-em-summary.mjs:422:    coverageStatus = 'partial';
src/lib/wcag-em-summary.mjs:423:  else coverageStatus = 'complete';
src/lib/wcag-em-summary.mjs:425:    status: coverageStatus,
src/lib/wcag-em-s ...
````

## 4. Bash

````bash
sed -n 385,430p src/lib/wcag-em-summary.mjs; sed -n 54,100p src/reporters/markdown.mjs; grep -n "redirect\|soft-404\|404\|status" TODO.md CHANGELOG.md | head -30
````

Output (truncated):

````text
  // would otherwise let a criterion read `passed` purely because the page that
  // would have failed it was skipped. Record what the automated layer actually
  // covered so a clean result is never mistaken for complete coverage. A per-SC
  // denominator is deliberately NOT synthesized: an excluded page's axe never
  // ran, so which criteria it would have touched is unknown — the honest
  // statement is run-level ("N of M selected pages audited; the rest assessed
  // for no criterion").
  /** @type {Set<string>} */
  const auditedUrls = new Set();
  /** @type {Map<string, Set<string>>} */
  const excludedByOutcome = new Map();
  for (const page of axeResults) {
    const url = String(page?.url ?? '');
    if (isAuditableView(page)) {
      auditedUrls.add(url);
    } else {
      con ...
````

## 5. Bash

````bash
mkdir -p $SCRATCH/wf2/verify-A11 && cd $_ && cat > p.mjs <<'EOF'
import { normalizeUrl, urlAllowedByScope } from 'file://$REPO/src/lib/urls.mjs';
for (const u of ['https://ex.com/guides/','https://ex.com/p?flag','https://ex.com/p?x=b/c','https://ex.com/p?a=%20','https://ex.com/#/about','https://ex.com/s?sessionid=a&utm_x=1'])
  console.log(u,'->',normalizeUrl(u));
for (const h of ['CDN.example.com','https://cdn.example.com','cdn.example.com:8443','*.example.com','cdn.example.com'])
  console.log(h, urlAllowedByScope('https://cdn.example.com/x','https://www.example.com/',{mode:'allowed-hosts',allowedHosts:[h]}));
console.log('idn', urlAllowedByScope('https://bücher.example/x','https://www.example.com/',{mode:'allowed-hosts',allowedHosts:['bücher.example']}));
EOF
source ~/.nvm/nvm.sh >/dev/null 2>&1 && nvm use 22 >/dev/null 2>&1 && node p.mjs
````

Output (truncated):

````text
https://ex.com/guides/ -> https://ex.com/guides
https://ex.com/p?flag -> https://ex.com/p?flag=
https://ex.com/p?x=b/c -> https://ex.com/p?x=b%2Fc
https://ex.com/p?a=%20 -> https://ex.com/p?a=+
https://ex.com/#/about -> https://ex.com/
https://ex.com/s?sessionid=a&utm_x=1 -> https://ex.com/s?sessionid=a
CDN.example.com false
https://cdn.example.com false
cdn.example.com:8443 false
*.example.com false
cdn.example.com true
idn false
````
