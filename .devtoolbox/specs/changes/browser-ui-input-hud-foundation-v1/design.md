# Design: Browser UI Input HUD Foundation v1


## Scope

This is not final UI polish. It creates the basic UI architecture: HUD readout, input mode ownership, route status, warning chips and test-visible telemetry.


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
