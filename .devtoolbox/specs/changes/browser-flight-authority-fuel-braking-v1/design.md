# Design: Browser Flight Authority Fuel Braking v1


## Motivation

The first spike represented RCS and thrust as scalar capability. That was correct for proving the seam, but the mainline needs better authority and braking semantics before more gameplay features are built.

## Design inputs

Use Unity flight-control files to understand terms and diagnostics, but create new data contracts.


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
