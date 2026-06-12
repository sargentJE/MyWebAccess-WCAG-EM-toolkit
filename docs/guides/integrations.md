# Integrations guide

What to do with the two downstream exports — the MyAccess Portal envelope and
the report-builder starter draft — plus running the toolkit in CI. Producing
these files is covered in the [config guide](./config-guide.md) (enable the
reporters); interpreting the rest of a run's output is the
[user manual](./user-manual.md).

## 1. MyAccess Portal — uploading `portal-export.json`

Enable the `portal-export` reporter and the summarize stage writes
`reports/portal-export.json` in the portal's canonical-scan envelope
(`scanMetadata` / `summary` / `rawFindings`). Upload it at the portal's
scan-upload screen (drag-drop or "Paste JSON instead").

What the envelope carries:

- Compliance-affecting violations drive `totalIssues`, the severity
  `distribution`, and the dashboard score; best-practice and axe needs-review
  rows arrive as manual-review cards (`countsTowardCompliance: false`) that
  never move the score.
- `averageScore` ships WITH its adjudication context: `scoreBasis` counts how
  many criteria were `passed` / `failed` / `cantTell` / `inapplicable` /
  `notTested`. A score of 50 over 12 adjudicated criteria and 36 not-tested
  ones is a very different fact from 50 over all of them — the basis says
  which you have.
- Per-element `instances[]` carry HTML evidence and axe's `failureSummary`
  diagnosis, pre-trimmed to the portal's 2000-character ingestion limit so
  uploads stay truncation-warning-free.

### Pre-upload checklist

1. **Scan health is clean** (user manual, section 5) — the portal's
   `pagesScanned` figure comes from the run; do not upload coverage you know
   is degraded without recording why.
2. **No contract warning in the run log.** With the default
   `reporting.validateExports: "warn"`, a payload that violates the vendored
   portal contract still WRITES but logs
   `portal-export: payload fails the vendored contract ...` — fix before
   uploading (most commonly: a critical/serious finding lacking HTML evidence
   because summarize was re-run against stale scan results; re-run `scan`).
   Set `validateExports: "error"` to make the reporter refuse to emit an
   invalid file at all.
3. **Evidence present for critical/serious rows** — a separate loud warning
   (`... lack HTML evidence; the portal will flag these ...`) fires when
   top-severity findings carry no `evidence.html`; the portal will accept the
   upload but flag those cards.

### What the portal changes on ingestion

The portal normalises rather than rejects. Knowing what it rewrites avoids
surprises when the dashboard does not byte-match your file:

- It derives its own per-finding `fingerprint` (dedup identity is
  portal-controlled) and a numeric `priorityScore`.
- It rewrites `scoreSource` into its own vocabulary and recomputes
  `occurrenceCount` from the instance list if they disagree.
- It truncates any evidence string beyond 2000 characters (the toolkit
  pre-trims, so this should never fire).
- Remediation text is added by the admin in the portal's enrichment UI — the
  toolkit ships the `remediation` slot empty today (a per-rule remediation
  library is on the roadmap).

## 2. Report builder — using `report-builder-draft.json`

Enable the `report-builder-starter` reporter to get a
myweb-report-builder `DraftReportSchema` document generated straight from the
run: the starting point for authoring the client report.

What is in the draft:

- **Findings `<PREFIX>-001 ...`** — the prefix derives from your config
  `name` (`legacy-events` -> `LE`, `au-demo-uw` -> `ADU`). Confirmed
  violations AND axe needs-review items both become draft findings; every one
  carries `draftStatus: "generated"`, `needsManualReview: true`, and review
  notes stating its provenance. Needs-review drafts are clearly marked as NOT
  confirmed violations and are deliberately excluded from the draft's
  recommendations — nothing auto-recommends acting on an unconfirmed item.
- **Criteria outcomes** filtered to the consumer's enum
  (`passed` / `failed` / `cantTell` / `inapplicable`), with each outcome
  linked to the draft findings that reference its criterion.
- **Appendices** carrying what the consumer enum cannot: the not-tested
  criteria list (your manual-coverage record) and any scan warnings.
- **Manual checks** seeded from the run's manual backlog (all
  `outcome: "Not tested"`), journeys seeded from your configured processes,
  per-page screenshots attached as typed evidence, and placeholder meta
  (`client`, executive summary) the author replaces.

### The authoring workflow

1. Load the draft into the report builder.
2. Work each finding: confirm it manually, rewrite `userImpact` /
   `technicalIssue` / `recommendation` in client language, then set
   `draftStatus` to `reviewed` — or `discarded` for needs-review items that
   do not hold.
3. Work the manual checks and journeys; record outcomes.
4. Replace the placeholder meta and write the executive summary.
5. Validate: the builder's `validate:report` checks the AUTHORED schema —
   drafts intentionally fail it until the draft-only fields are resolved
   (there is no draft validation mode in the builder today).

The toolkit-side contract is vendored at
[`schemas/report-builder-draft.schema.json`](../../schemas/report-builder-draft.schema.json)
(generated from the builder's own Zod schema; regeneration command in its
`_meta`) and enforced at write time by the same `reporting.validateExports`
gate as the portal export.

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
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v5
      with: { node-version: 22 }
    - run: npm ci
    - run: npx playwright install chromium
    - run: npx wcag-em audit --config configs/ci-smoke.json --out-dir output/ci
    - uses: actions/upload-artifact@v6
      if: always()
      with: { name: a11y-reports, path: output/ci/reports }
```

The audit step fails the job via exit code `2` when the threshold trips
(tune `failOnFindings.impacts` / `threshold` per the config guide — for a
site with a known backlog, score against critical-only or raise the
threshold so CI reports rather than blocks). Publish `junit.xml` to your CI's
test-report UI if it supports JUnit ingestion, and always upload the reports
directory as an artifact — `summary.html` is the file a teammate will
actually open.
