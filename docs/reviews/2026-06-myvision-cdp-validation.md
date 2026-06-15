# Live validation — MyVision CDP dogfood + finding accuracy (E8)

Status: **complete, evidence-grounded.** Authored 2026-06-15 from the
`output/myvision-test-cdp/` run (2026-06-14, CDP transport) and a same-day
Claude-in-Chrome verification against the live **rendered** site. Purpose: prove
the E8 CDP path produces real audits of WAF-gated pages, validate every finding
for accuracy, and isolate where the toolkit's automated layer stops — its
"floors". Companion to [ADR-0020](../adr/0020-pluggable-browser-transport.md)
(the transport) and [ADR-0021](../adr/0021-waf-challenge-access-strategy.md) (the
access strategy this run motivated).

> **Method note.** Three facets — _accuracy_ (are the findings true?), _misses_
> (what can axe not see?), _scope_ (what was in range?). Accuracy was checked
> against the raw `results/axe-results.json`, then cross-checked on the live
> rendered DOM via Claude-in-Chrome (a different method — hand-rolled contrast
> math, not axe). Disk figures and live figures agree except where noted.

---

## 0. Run facts

|                       |                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Output                | `output/myvision-test-cdp/` (config `configs/myvision-test.json`)                                                               |
| Transport             | CDP attach to a human-cleared Chrome (E8 / ADR-0020)                                                                            |
| Inventory → sample    | 34 discovered → 33 sampled → **66 page-views** (2 viewports: desktop + reflow)                                                  |
| Processes             | 4 process runs (non-submitting)                                                                                                 |
| Outcome               | **33/33 pages audited, 0 challenged** — incl. the 4 force-included `/event*` pages, `/shop`, `/product/*`, `/support-us/donate` |
| Findings              | 13 grouped (6 real-fail rules, 6 best-practice, 1 minor) + 7 needs-review                                                       |
| Discoverable universe | sitemaps `page` 110 + `post` 230 + `tribe_events` 996 = **1,336 URLs**                                                          |

The CDP bridge worked end-to-end: pages that return `403 cf-mitigated: challenge`
to `curl` were audited normally over the cleared session. **Why** it worked is
the subject of §4 and ADR-0021 — it rode a _trusted_ session, it did not defeat
the challenge.

---

## 1. Accuracy — no false positives

Every grouped finding is a true WCAG fail or a genuine best-practice flag.
Verified against raw axe nodes and (where live-visible) recomputed in the browser.

**Real WCAG failures (keep as fail):**

| Rule                          | Reach   | Verification                                                                                                                                                                       |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `color-contrast`              | 4 pages | ✅ Independently recomputed live: `£9.50` sale price `#958e09` on white = **3.41:1**; also footer "Facebook" `#191e23`/`#272f5f` = **1.33:1**, cookie "SAVE & ACCEPT" = **3.13:1** |
| `link-name`                   | 7 pages | ✅ ~**30 distinct** un-named links (60 occurrences ÷ 2 viewports) — strongest finding by volume                                                                                    |
| `scrollable-region-focusable` | 4 pages | ✅ `.innertitle{overflow:auto}` keyboard-inaccessible; fires in **one viewport** per page                                                                                          |
| `link-in-text-block`          | 2 pages | ✅ Real but **borderline** (~2.99 vs 3.0); event recurring-info widgets                                                                                                            |
| `target-size`                 | 2 pages | ✅ Real, minor (a file-download block)                                                                                                                                             |
| `aria-hidden-focus`           | 1 page  | ✅ Real but a **3rd-party vendor widget** (`#SR7_…`), not MyVision's own code                                                                                                      |

**Best-practice / advisory (re-frame away from "fail"):** `heading-order` (7),
`landmark-main-is-top-level` (2), `landmark-no-duplicate-main` (2),
`landmark-unique` (5), `page-has-heading-one` (1), `empty-heading` (1).

**Needs-review (axe punted — a floor in itself):** `aria-valid-attr-value`
(critical, 33 pages), `duplicate-id-aria` (1), `color-contrast` _incomplete_
(33 pages — background undeterminable), `form-field-multiple-labels` (1),
`aria-allowed-role` (1, the reCAPTCHA iframe).

**Two counting corrections:**

- `region` reads "702 occurrences" in raw aggregation; the true figure is **33
  pages / 664 node-occurrences**. Report **pages affected**, never raw
  occurrences — the ×2-viewport multiplier inflates every count. (Overlaps the
  open `occurrenceCount` item in `TODO.md`.)
- Demote the six best-practice rules from fail-framing to **advisory**.

---

## 2. What it missed — false negatives (axe blind spots)

axe decides ~30–40% of WCAG SC; the rest is silent-by-design. Mapped to this
site, with concrete live evidence:

- **1.1.1 alt _quality_.** The homepage hero `group-by-seav2.jpg` (1000×540) has
  `alt=""` — axe accepts empty alt as "intentionally decorative" and says nothing;
  whether a hero is truly decorative is a human call. Separately,
  `ground-and-events.jpg` has **no alt but a `title`** — which is _why_ axe stays
  silent (title supplies an accessible name), yet title-only naming is itself weak.
  For a sight-loss charity this is the highest-stakes blind spot.
- **2.4.4 link purpose.** "(See all)", "« All Events", "Go Back" — non-descriptive
  link text is **not an axe rule**. (The toolkit's `link-in-text-block` caught
  "(See all)" only for _contrast_, not for the vague text.)
- **1.4.10 reflow / 1.4.4 resize / true 400% zoom** — only a narrow structural
  viewport is rendered; real browser zoom-to-400% is untested. _The_ SC class for
  low-vision users, barely covered.
- **2.1.1 / 2.4.3 / 2.4.7 keyboard, focus order, focus visible** — the mega-menu
  and accordions are never operated (single rendered state), so unverified.
- **3.3.1/3.3.2/3.3.3 form errors & instructions** — forms are not submitted.
- **1.2.x media captions/transcripts**, **1.3.2 reading order**, **3.1.2 language
  of parts**, **2.5.3 label-in-name** — all outside axe.
- **The needs-review pile** (`aria-valid-attr-value` on 33 pages, `color-contrast`
  incomplete on 33) is axe flagging uncertainty it cannot resolve — surfaced
  honestly, but not decided.

---

## 3. Scope — structural floors

| Dimension     | Reality                                                           | Floor                                                                                                     |
| ------------- | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Sample size   | 33 audited / **1,336 sitemap URLs**                               | ~2.5% — correct for WCAG-EM _sampling_, but rare templates outside the sample go unseen                   |
| Events        | 4 audited; **~992 `/event*` unaudited**                           | Template likely well-represented by 4; recurring/sold-out states unseen                                   |
| Documents     | **9 PDF/DOCX/DOC inventoried, 0 audited**                         | Hard wall — accessibility statement, annual report, safeguarding policies are binary docs axe cannot open |
| Render states | 1 state × 2 viewports per page                                    | No menu-open / accordion-expanded / modal / mid-error states                                              |
| Discovery     | 16 `http-error` during crawl (crawl runs _locally_, not over CDP) | Some pages never entered inventory                                                                        |
| Auth          | none                                                              | Logged-in areas invisible                                                                                 |

---

## 4. Live Chrome verification — what only the browser revealed

Run against the live rendered DOM (Claude-in-Chrome), independent of axe:

- **Contrast confirmed by a different method.** A hand-rolled WCAG contrast
  calculator on the rendered shop page reproduced `#958e09 = 3.41:1` exactly, and
  found 35 sub-threshold text nodes. (The product _detail_ page showed **0** — the
  olive sale price only renders in the shop _listing_; the "0" was correct, not a
  gap, which is the value of live checking.)
- **`page-has-heading-one` confirmed** — homepage `h1` count = **0**.
- **The E8 premise is real.** An `/event*` page **loaded fully in an everyday
  Chrome with no challenge** — the same URL `curl` gets `403` on. A trusted
  browser + IP is not challenged; the toolkit rode that, it did not defeat
  Cloudflare. This directly motivates [ADR-0021](../adr/0021-waf-challenge-access-strategy.md)
  (become _trusted_ by registration, don't bypass).
- **A state-dependent issue the single-state scan can miss.** A fresh load showed
  the cookie banner (`cliSettingsPopup`) as `aria-hidden="true"` _containing
  focusable controls_ — a different `aria-hidden-focus` instance than the toolkit's
  `#SR7`, plus the banner's own 3.13:1 button. These exist only while the banner
  shows — concrete proof of the "one rendered state" floor.
- **A prevented over-claim.** The visible "Continue reading" link did **not** match
  a vague-text check, indicating sr-only context text — so it is **not** asserted
  as a 2.4.4 fail. Live checking stopped a false negative-of-the-negative.

---

## 5. Bottom line — where the floors are

1. **The toolkit does not over-report.** Zero false positives; correct
   best-practice-vs-fail classification; honest disclosure of what it could not
   reach (force-include warnings, document inventory, the needs-review pile). That
   honesty is its strongest property and validates [ADR-0017](../adr/0017-page-outcome-could-not-audit.md).
2. **The floor is coverage, not correctness.** The risk is a clean automated layer
   being _read as_ "the site is accessible" when only ~40% of criteria are
   machine-decidable and the hardest 60% is explicitly deferred to manual review.
3. **The irony for MyVision specifically:** the SCs that matter most to a sight-loss
   audience — alt-text quality, screen-reader flow, keyboard operability, zoom/
   reflow to 400% — sit almost entirely in axe's blind spots. The automated layer
   is accurate within its lane, but its lane is the least user-critical slice for
   this audience.

## 6. Recommended follow-ups

- **Reporter framing:** demote the six best-practice rules to advisory; report
  **pages + distinct-node counts, never raw occurrences** (overlaps the open
  `occurrenceCount` P1 item in `TODO.md`); keep `manual-backlog.md` prominent so a
  clean automated layer is never mistaken for a conformance claim.
- **Access strategy:** pursue [ADR-0021](../adr/0021-waf-challenge-access-strategy.md)
  (Web Bot Auth registration as the durable path; interactive CDP as the bridge;
  no auto-bypass).
- **Coverage honesty:** the document-inventory (9 unaudited PDFs/Office docs) and
  the single-rendered-state limit are the two floors most worth stating explicitly
  in client-facing scope notes.
