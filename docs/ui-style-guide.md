# UI Style Guide

## Goal

This pass aligns the current product UI around one visual language before Stage 6.

The scope is limited to:

- homepage
- `/analyze`
- single-account results
- cluster workflow inputs
- suggestion review
- narrative and structured result blocks

It does not change backend contracts, rules, providers, or workflow semantics.

## Style Principles

The current UI follows these reference-derived principles:

- deep dark background, near-black rather than neutral gray
- centered narrow-column layout, even on desktop
- large-radius stacked cards instead of wide dashboard panels
- orange / amber as the main accent
- secondary information in muted gray, not colorful dashboards
- narrative-first reading entry, but facts stay visible

## Visual Rules

### Color

- page background: near-black with a subtle warm gradient
- primary surface: deep gray-black card
- muted surface: slightly lifted card for nested blocks
- accent: orange / amber
- warning / reject accent: restrained red-orange
- borders: soft translucent light borders
- text:
  - primary: warm off-white
  - secondary: medium warm gray
  - muted: deeper gray

### Cards

- use large rounded cards for all main sections
- keep borders soft and low-contrast
- use restrained shadow only to separate layers
- narrative hero cards can use a slightly warmer accent tint
- warnings / caveats can be warmer and more visible, but should not look like alarm banners

### Controls

- primary button: orange filled
- secondary button: dark filled with soft border
- dangerous button: restrained red-orange
- inputs and selects: dark surfaces, soft border, visible focus ring
- pills: small rounded chips, mostly neutral, accent only for emphasis

### Layout

- keep the page in a centered narrow shell
- use vertical stacking as the default rhythm
- allow small grids only for:
  - metrics
  - compact account coverage / status summaries
- avoid wide admin-style tables

## Result Information Architecture

The result page should keep this order:

1. Hero summary
2. Caveats and warnings
3. Stable traits / community traits / overlap-divergence
4. Evidence
5. Structured metrics
6. Community breakdowns / account coverage

### Priority

- narrative is the reading entry point
- structured facts remain visible and authoritative
- evidence and warnings must stay explicit
- narrative never replaces evidence, metrics, or warnings

## Single-Account vs Multi-Account

### Single-account

- keep the page compact
- show hero, caveats, evidence, metrics, and minimal breakdowns
- hide cluster-only sections when they are empty or meaningless

### Multi-account

- keep the same top-level reading order
- make cluster insights and account coverage more prominent
- separate:
  - stable traits
  - community-specific traits
  - overlap/divergence
  - community breakdowns

## Why Warnings, Caveats, and Evidence Stay Visible

- `warnings` communicate degraded or partial-result conditions
- `caveats` prevent narrative from sounding more certain than the data allows
- `evidence` remains the explainability anchor

They must not be hidden for the sake of a cleaner page.

## Out of Scope

This pass explicitly does not do:

- large-scale redesign
- chart systems
- advanced interaction patterns
- design system platformization
- new feature development
- backend contract changes

## Next QA Focus

Manual QA after this pass should verify:

- dark theme consistency across home and analyze pages
- single-account and cluster layouts both remain readable
- warnings / caveats remain visible
- narrative fallback remains readable when `narrative` is absent
- cluster-only sections hide cleanly when no cluster data exists
