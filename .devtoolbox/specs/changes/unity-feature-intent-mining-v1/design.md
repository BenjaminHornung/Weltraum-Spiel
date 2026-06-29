# Design: Unity Feature Intent Mining v1


## Process

For each feature area, read source files and specs. Produce a Feature Intent Card. Do not implement during mining unless the task explicitly calls for a minimal acceptance test scaffold.

## Required feature cards

- Flight/Control
- Navigation/Autopilot
- Route/Waypoint/Targeting
- HUD/Telemetry
- Proving-Ground/Evidence
- Open-World/World Scale
- Ship Builder deferred
- Surface-FPS deferred


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
