# 0000. Record architecture decisions

- Status: accepted
- Date: 2026-04-18
- Deciders: Jamie Sargent

## Context and Problem Statement

Architectural decisions for this toolkit (engine pin, validation strategy, reporter
contract, WCAG-EM alignment choices, etc.) were previously scattered across the `box/`
directory as loose narrative notes. As the project matures toward v1.0 and beyond, we
need a traceable, numbered, single-format record so every decision has exactly one home
and every reviewer can answer "why does it look like this?" with a hyperlink.

## Decision

Adopt **MADR 4.0** (Markdown Any Decision Records, September 2024 release) for all
architecture decisions.

- Records live under `docs/adr/`.
- Files are named `NNNN-kebab-case-title.md` starting at `0000`.
- Each record uses the MADR 4.0 template with sections:
  _Context and Problem Statement_ → _Decision Drivers_ → _Considered Options_ →
  _Decision Outcome_ → _Consequences_ → _Pros and Cons of the Options_ (optional) →
  _More Information_ (optional).
- Status is one of: `proposed`, `accepted`, `deprecated`, `superseded by NNNN`.
- The existing `box/` narrative notes are promoted into numbered ADRs during Layer 5
  of the v0.3 → v1.0 promotion plan; `box/` is then removed.

## Consequences

- Every architectural decision has a canonical location and a stable identifier.
- New contributors can read `docs/adr/` in order to understand the project's reasoning.
- PRs that make architectural changes are expected to either (a) reference an existing
  ADR, or (b) add a new ADR in the same commit.
- We do not adopt tooling (adr-tools, log4brains, etc.) for v1.0 — plain Markdown is
  enough. A future decision may revisit this.

## More Information

- MADR: <https://adr.github.io/madr/>
- Nygard's original ADR essay: <https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions>
