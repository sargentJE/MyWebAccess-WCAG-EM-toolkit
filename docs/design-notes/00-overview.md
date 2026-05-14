# V2 Recommended Overview

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
