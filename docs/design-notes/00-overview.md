# V2 Recommended Overview

> **Design-time record (April 2026).** These notes captured the v2 design
> framework while the toolkit was being built and are kept for history;
> details may no longer match the shipped behaviour. For current usage see
> the [guides](../guides/) and [README](../../README.md); for current
> decisions see the [ADRs](../adr/).

This package is the recommended V2 build.

It is opinionated in the places where the V1 and V2 decision points were clear enough to lock down, and intentionally conservative where over-automation would weaken audit quality.

## The recommended shape

- config-driven scope definition
- bounded discovery from the root URL
- hybrid sample building (manual + auto-suggest + random sample)
- separate page scans and process/state scans
- grouped reporting by rule and by likely component
- explicit comparison between random and structured samples
- explicit manual testing backlog
