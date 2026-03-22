# Architecture

This repository is scaffolded as a modular monolith for Vercel deployment.

## Core rules

- `app/api/**` is the delivery layer.
- `src/contexts/**` holds bounded contexts.
- `source-acquisition` owns all external platform access.
- `portrait-analysis` only consumes canonical snapshots and activities.
- warnings and partial results are treated as first-class outputs.

## Current status

- Next.js App Router baseline is in place.
- Connector contracts and registry are implemented.
- V2EX, 过早客, and 微博 OAuth connectors are scaffolded as placeholders.
- The analyze route already runs through validation, orchestration, normalization, analysis, and presentation.
