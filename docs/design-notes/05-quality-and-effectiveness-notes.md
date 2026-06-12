# Quality and Effectiveness Notes

> **Design-time record (April 2026).** These notes captured the v2 design
> framework while the toolkit was being built and are kept for history;
> details may no longer match the shipped behaviour. For current usage see
> the [guides](../guides/) and [README](../../README.md); for current
> decisions see the [ADRs](../adr/).

## Where the quality gains come from

### Discovery quality

More metadata gives you better sampling decisions and better process detection.

### Sampling quality

The hybrid model avoids the worst of both extremes:

- fully manual sampling that is hard to repeat
- fully automatic sampling that hides evaluator judgement

### Scan quality

Keeping the baseline scan broad while separating best-practice findings reduces the chance of over-stating automated output.

### Reporting quality

Grouping by rule and likely component makes recurring issues easier to understand and fix.

## Where effectiveness gains come from

- config-driven reuse from site to site
- sitemap support when available
- random-sample comparison flags
- one retry for flaky pages
- output files that are easier to hand into a real audit workflow

## What still limits effectiveness

- process scripts still need tuning per site
- authenticated flows are not solved generically
- selector-based component hints are useful but not perfect
- manual testing remains essential
