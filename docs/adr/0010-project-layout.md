# 0010. Project layout

- Status: accepted
- Date: 2026-05-14
- Deciders: Jamie Sargent

## Context and Problem Statement

The toolkit's directory structure grew organically through the
v0.3 migration. Early design documents lived in `box/` (a
decision-framework directory from the original prototyping phase).
As the project approaches v1.0 the directory layout needs to be
documented and the design-framework material relocated to a
conventional home.

## Decision

The v1.0 directory structure is:

| Path                 | Purpose                                                            |
| -------------------- | ------------------------------------------------------------------ |
| `bin/`               | CLI entry point (`wcag-em.mjs`)                                    |
| `src/commands/`      | Pipeline stages: discover, sample, scan, scan-processes, summarize |
| `src/lib/`           | Shared utilities (config, auth, logging, URLs, viewports, etc.)    |
| `src/reporters/`     | Reporter modules: json, markdown, html, earl-jsonld, junit         |
| `src/data/`          | Static data files (ACT rule map, WCAG SC metadata)                 |
| `src/types/`         | Generated TypeScript declaration files (auto-generated from JSDoc) |
| `schemas/`           | JSON Schema for config validation                                  |
| `configs/`           | Example site configurations                                        |
| `docs/adr/`          | Architecture decision records (this directory)                     |
| `docs/design-notes/` | Original v0.3 design framework (migrated from `box/`)              |
| `test/unit/`         | Unit test suite (Node test runner)                                 |
| `test/e2e/`          | End-to-end test suite (Playwright-backed)                          |
| `test/fixtures/`     | Test fixtures (static HTML site, mock servers)                     |

The `box/` directory is moved to `docs/design-notes/` via
`git mv` to preserve history. The original design-framework
documents are retained as historical context for the project's
architectural choices.

## Consequences

- New contributors can orient themselves from this table and the
  README folder guide.
- The `docs/` tree has a clear two-tier structure: `adr/` for
  decisions, `design-notes/` for background material.
- `box/` no longer exists at the repo root; any stale references
  (README, comments) must be updated.
