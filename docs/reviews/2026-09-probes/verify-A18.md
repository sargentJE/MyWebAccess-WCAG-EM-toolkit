# Probe record: verify:A18

Role: packet verifier. Findings: CAP-07, CAP-08, CAP-10, CAP-12, CAP-13, CAP-14, CAP-15, CAP-16, CAP-20, SCAN-12, PROC-14

Verbatim file-creating and probe-running tool calls from the 2026-09-30 review agent, in order. Paths and personal details are sanitised (`$REPO`, `$SCRATCH`, `$PORTAL`, `$RB`, `$USER`, `$LAN_IP`, local client config names omitted) and outputs are truncated to 800 characters. These records are the source for converting each reproduction into a committed regression fixture.

## 1. Bash

````bash
python3 -c "import json,sys; ids=set(sys.argv[1].split(',')); print(json.dumps([f for f in json.load(open('$SCRATCH/review/round1-findings.json')) if f['id'] in ids], indent=1))" CAP-07,CAP-08,CAP-10,CAP-12,CAP-13,CAP-14,CAP-15,CAP-16,CAP-20,SCAN-12,PROC-14
````

Output (truncated):

````text
[
 {
  "dimension": "PROC",
  "id": "PROC-14",
  "title": "The step DSL cannot express common process interactions: select, hover, file upload, iframes, focus, assertions, navigation waits",
  "category": "capability-gap",
  "severity": "medium",
  "status": "new",
  "claim": "The seven actions cover text inputs and buttons only. There is no selectOption, check, hover, focus, setInputFiles, frame targeting, waitForURL/waitForLoadState, expect/assert or dialog handling, and no evaluate escape hatch. `press` acts on whatever element has focus.",
  "evidence": [
   {
    "file": "src/lib/process-runner.mjs",
    "line": 42,
    "excerpt": "export const DISPATCH_ACTIONS = Object.freeze([\n  'goto',\n  'click',\n  'fill',\n  'press',\n  'waitFor',\n  'screenshot',\n  'axe',\n]);"
   },
   {
    ...
````

## 2. Bash

````bash
cd $REPO
echo ==actions; sed -n 38,52p src/lib/process-runner.mjs; grep -n "case '" src/lib/process-runner.mjs | head -20
echo ==ctx; sed -n 205,235p src/lib/browser.mjs
echo ==emul; grep -rniE "reducedMotion|colorScheme|emulateMedia|timezoneId|locale|hasTouch|isMobile" src schemas | head
echo ==reflow; grep -rniE "scrollWidth|text-spacing|letter-spacing|word-spacing|overflow" src --include=*.mjs | grep -v reporters | head
echo ==kbd; grep -rniE "activeElement|focus-visible|Tab['\"]|MutationObserver|keyboard trap|hover\(" src schemas | head
echo ==dedupe; grep -rniE "template|fingerprint|sitewide|templateLikely" src --include=*.mjs | head
echo ==pdf; grep -rniE "pdf-lib|pdfjs|veraPDF|PDF/UA|StructTreeRoot|content-type" src | head
echo ==stmt; grep -rniE "accessibility statement|PSBAR|statement" src schemas | head
echo ==std; grep -rniE "VPAT|ACR\b|Section 508|301 549|en301549" src schemas docs README.md TODO.md CHANGELOG.md | head -20
echo ==rt; grep -rniE "report tool|reportTool|WCAG-EM Report" src docs README.md TODO.md CHANGELOG.md | head
echo ==engine; grep -rniE "equal-access|accessibility-checker|siteimprove|alfa|htmlcs|qualweb|lighthouse|pa11y" src package.json | head
echo ==csv; grep -rniE "csv|sarif" src schemas docs TODO.md CHANGELOG.md | head
````

Output (truncated):

````text
Exit code 1
(eval):2: =actions not found
````

## 3. Bash

````bash
cd $REPO
grep -niE "remediation library|manual-result|VPAT|plugin|SPA|keyboard|interaction|reflow|pdf|document|statement|emulat|motion|template|dedupe|engine|csv|sarif|301|report tool|hover|select|iframe|DSL|step" TODO.md | head -60
echo ===ADR11; sed -n 40,90p docs/adr/0011-v1-release-boundary.md
````

Output (truncated):

````text
Exit code 1
24:      scanning (ADR-0019), override visibility + document inventory,
28:      `patchright` engine + `WCAG_EM_CDP_ENDPOINT` (ADR-0020), for AUTHORIZED
36:Carry-forward spawned by the above:
61:      an actual CI step — ci.yml's header claimed a check that never existed
116:- [x] **`waitFor` ignores its selector.** process-runner.mjs:213-215 sleeps
117:      `timeoutMs ?? 500` and never polls `step.selector`; README's SPA guidance
118:      documents polling that does not exist. Review C5 (probe-confirmed).
145:      Partial progress: the CHANGELOG counts glossary now DOCUMENTS the four
156:- [ ] **Per-rule remediation library.** Seed remediation templates (summary +
157:      steps, optional code) keyed by axe `ruleId`, so `portal-export` cards
204:- [ ] Artifact envelope (Sp ...
````

## 4. Bash

````bash
cd $REPO
echo "--actions"; sed -n 38,52p src/lib/process-runner.mjs; grep -n "case '" src/lib/process-runner.mjs | head -20
echo "--ctx"; sed -n 205,235p src/lib/browser.mjs
echo "--emul"; grep -rniE "reducedMotion|colorScheme|emulateMedia|timezoneId|locale|hasTouch|isMobile" src schemas | head
echo "--reflow"; grep -rniE "scrollWidth|text-spacing|letter-spacing|word-spacing|overflow" src --include=*.mjs | grep -v reporters | head
echo "--kbd"; grep -rniE "activeElement|focus-visible|Tab['\"]|MutationObserver|keyboard trap|hover\(" src schemas | head
echo "--dedupe"; grep -rniE "template|fingerprint|sitewide|templateLikely" src --include=*.mjs | head
echo "--pdf"; grep -rniE "pdf-lib|pdfjs|veraPDF|PDF/UA|StructTreeRoot|content-type" src | head
echo "--stmt"; grep -rniE "accessibility statement|PSBAR|statement" src schemas | head
echo "--std"; grep -rniE "VPAT|ACR\b|Section 508|301 549|en301549" src schemas docs README.md TODO.md CHANGELOG.md | head -20
echo "--rt"; grep -rniE "report tool|reportTool|WCAG-EM Report" src docs README.md TODO.md CHANGELOG.md | head
echo "--engine"; grep -rniE "equal-access|accessibility-checker|siteimprove|alfa|htmlcs|qualweb|lighthouse|pa11y" src package.json | head
echo "--csv"; grep -rniE "csv|sarif" src schemas docs TODO.md CHANGELOG.md | head
echo "--ADR11"; sed -n 40,90p docs/adr/0011-v1-release-boundary.md
echo "--TODO"; sed -n 150,230p TODO.md
````

Output (truncated):

````text
--actions
// The schema's `$defs.action.properties.action.enum` in
// `schemas/config.schema.json` MUST equal this set. The invariant is locked
// by `test/unit/process-runner-invariant.test.mjs`. Aliases are not permitted.
// LINK: docs/adr/0005-fail-fast-on-config.md
export const DISPATCH_ACTIONS = Object.freeze([
  'goto',
  'click',
  'fill',
  'press',
  'waitFor',
  'screenshot',
  'axe',
]);

// SECTION: Public API
214:    case 'goto':
223:    case 'click':
227:    case 'fill':
234:    case 'press':
238:    case 'waitFor':
261:    case 'screenshot': {
273:    case 'axe': {
--ctx
    // reused across page-views, so set it on the page instead.
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    return {
      page,
      release: async () => {
      ...
````

## 5. Bash

````bash
cd $REPO
echo "--reflow"; grep -rniE "scrollWidth|text-spacing|letter-spacing|word-spacing|clientWidth" src | grep -v "src/reporters" | head
echo "--dedupe"; grep -rniE "fingerprint|sitewide|templateLikely|template-level" src | head
echo "--hint"; sed -n 150,185p src/lib/urls.mjs
echo "--ADR11 table"; sed -n 20,40p docs/adr/0011-v1-release-boundary.md
echo "--docs mention of interaction/reflow"; grep -rniE "reflow|1\.4\.10|keyboard|hover|reduced.?motion|dark mode" docs/guides README.md | head -20
echo "--note01"; sed -n 150,175p docs/design-notes/01-decision-points-and-recommendations.md
echo "--doc inventory docs"; grep -rniE "document inventory|document-inventory" docs/guides docs/adr README.md | head -8
````

Output (truncated):

````text
--reflow
--dedupe
src/reporters/html.mjs:152:    `It does not make a sitewide WCAG conformance claim on its own. ` +
src/reporters/markdown.mjs:165:    '- It does not make a sitewide WCAG conformance claim on its own.',
src/reporters/report-builder-starter.mjs:70:  'sitewide WCAG conformance claim on its own; manual testing with keyboard, assistive ' +
--hint
  if (/contact|support/i.test(url) || formCount > 0) types.push('form');
  if (/search|results/i.test(url) || searchInputCount > 0) types.push('search');
  if (/checkout|basket|cart|book|register|apply/i.test(url)) types.push('critical-process');
  return [...new Set(types)];
}

/**
 * Best-effort "component hint" from a CSS selector — used to group axe
 * findings by likely design-system component. Crude by design; see ADR-0012.
 *
  ...
````

## 6. Bash

````bash
cd $REPO
sed -n 336,352p docs/guides/config-guide.md
echo "--adr12"; grep -niE "component|crude|hint" docs/adr/0012*.md | head
echo "--group"; sed -n 110,150p src/lib/group-findings.mjs
echo "--manual 1.4.10"; grep -rn "1.4.10\|reflow" src/lib/manual-backlog.mjs | head
echo "--ADR6"; grep -niE "reflow|overflow|layout|1\.4\.10" docs/adr/0006*.md | head
echo "--round1 exp"; python3 -c "
import json;d=json.load(open('$SCRATCH/review/round1-experiments.json'));print(type(d), len(d))
items = d if isinstance(d,list) else list(d.values())
for e in items:
  s=json.dumps(e)
  if any(k in s for k in ['p11','run3','feasibility','select-and-iframe','hover-menu']): print(s[:600]); print()
" | head -60
````

Output (truncated):

````text
`ttlMinutes` compares the file's age at scan time and warns when the session
is likely expired ("... exceeds ttlMinutes=60. Session may be stale.") — set
it to your app's real session lifetime. Re-run the codegen capture to refresh.

## 6. Choosing viewports

The default pair is deliberate: `desktop` (1280x800) plus `reflow` (320x800 —
the WCAG 1.4.10 Reflow breakpoint, where content must work without
two-dimensional scrolling). Keep both for conformance work; add tablet or
brand-specific breakpoints as extra entries when the site behaves differently
there. Each viewport multiplies scan time and produces its own page-view
results and screenshots; reports count PAGES (a page is scanned if at least
one viewport succeeded) with page-views broken out separately.

## 7. Worked profiles

### Qui ...
````

## 7. Bash

````bash
cd $REPO
grep -n "beforeScan" -A3 schemas/config.schema.json | head -30; grep -rn "settle\|waitForTimeout\|networkidle" src/commands/scan.mjs src/lib/browser.mjs | head; sed -n 225,260p src/lib/process-runner.mjs; grep -n "newContext\|openPageView" src/commands/scan-processes.mjs src/lib/process-runner.mjs | head
````

Output (truncated):

````text
272:        "beforeScan": {
273-          "type": "object",
274-          "description": "Pre-scan hooks for cookie-consent dismissal, modal close, hydration waits.",
275-          "additionalProperties": false,
src/commands/scan.mjs:243:      await page.waitForTimeout(challengeWaitMs).catch(() => {});
      return null;

    case 'fill':
      await page
        .locator(step.selector)
        .first()
        .fill(step.value ?? '');
      return null;

    case 'press':
      await page.keyboard.press(step.key);
      return null;

    case 'waitFor':
      // NOTE: selector-aware since the 2026-06 review (finding C5): with a
      // selector, poll the DOM for it — the hydration-marker behaviour the
      // README's SPA guidance documents; without one, fall back to the fixed
      //  ...
````

## 8. Bash

````bash
cd $REPO
sed -n 272,300p schemas/config.schema.json | tr -s ' ' | head -40
````

Output (truncated):

````text
 "beforeScan": {
 "type": "object",
 "description": "Pre-scan hooks for cookie-consent dismissal, modal close, hydration waits.",
 "additionalProperties": false,
 "properties": {
 "actions": {
 "type": "array",
 "items": {
 "$ref": "#/$defs/action"
 }
 }
 }
 },
 "challenge": {
 "type": "object",
 "description": "Bot/WAF challenge handling (E1). Detection is header/status-primary (Cloudflare cf-mitigated is authoritative); this configures the bounded wait-for-auto-solve and the host allowlist for the weaker title+status heuristic. For a WAF bypass use auth.extraHTTPHeaders; for a cf_clearance cookie use auth.storageState.",
 "additionalProperties": false,
 "properties": {
 "waitForAutoSolveMs": {
 "type": "integer",
 "minimum": 0,
 "maximum": 60000,
 "description": "Max ms to wait for a man ...
````

## 9. Bash

````bash
cd $REPO
sed -n 480,510p src/reporters/report-builder-starter.mjs; grep -rn "atBaseline\|exclusions\|assistiveTechnologies\|devices\|browsers" src/reporters/report-builder-starter.mjs | head; grep -niE "E5|document" CHANGELOG.md | head -8; grep -rn "assistiveTechnologies\|exclusions" $RB/src 2>/dev/null | grep -v test | head -5
````

Output (truncated):

````text
        { label: 'Pages scanned', value: String(summary.samplePagesScanned ?? 0) },
        { label: 'Process runs', value: String(summary.processRuns ?? 0) },
      ],
      actionPriorities: backlogItems.slice(0, 5).map((item) => item.label),
      guardrail: GUARDRAIL_TEXT,
    },
    scope: {
      websiteOrProduct: site,
      pagesTested: scannedUrls,
      journeysTested: (Array.isArray(config.processes) ? config.processes : [])
        .map((/** @type {any} */ p) => (typeof p?.name === 'string' ? p.name : ''))
        .filter(Boolean),
      standard: `WCAG ${wcagEm.wcagVersion ?? '2.2'} Level ${wcagEm.conformanceTarget ?? 'AA'}`,
      samplingMethod:
        typeof wcagEm.samplingMethodNotes === 'string' && wcagEm.samplingMethodNotes
          ? wcagEm.samplingMethodNotes
        ...
````

## 10. Bash

````bash
cd $REPO
sed -n 75,135p src/reporters/earl-jsonld.mjs
````

Output (truncated):

````text
    const ruleId = String(f.id ?? '');
    const pointer = Array.isArray(f.targets) && f.targets.length ? String(f.targets[0]) : '';
    // Treat axe `failed` (the only impact-bearing finding state in
    // summary.findings[]) as the outcome unless the finding row carries
    // a different state. For the current shape, every grouped
    // finding represents a violation -> earl:failed.
    const outcomeKey = typeof f.outcome === 'string' ? f.outcome : 'failed';
    for (const url of pages) {
      graph.push(
        buildAssertion({
          subject: String(url),
          test: ruleId,
          outcomeKey,
          info: buildInfo(f),
          pointer,
          evaluator,
        }),
      );
    }
  }

  // Per-rule Assertions for incomplete results — earl:cantTell.
  const incFi ...
````

## 11. Bash

````bash
cd $REPO
grep -rliE "second engine|multi-engine|single engine|axe-only|only engine|false.positive" docs/adr docs/design-notes README.md | head; grep -rniE "why axe|axe-core (is|as) the" docs/adr docs/design-notes | head -5
````

Output (truncated):

````text
(Bash completed with no output)
````
