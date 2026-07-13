# Change: Browser Graphics Settings Foundation V1

## Goal

Provide a browser-native graphics settings foundation with a versioned schema, deterministic quality presets, truthful capability reporting, LocalStorage persistence, a player-facing dialog, live renderer application, restart-required anti-aliasing, normal-runtime Playwright coverage, and screenshot evidence.

## Scope

- Add the settings domain under `apps/weltraum-browser/src/settings/**`.
- Add a narrow Three.js adapter and player-facing graphics settings dialog.
- Integrate only through the allowlisted browser entry, renderer, HTML, and CSS files.
- Add focused unit tests, normal `/` Playwright coverage, runtime screenshots, and evidence summaries.

## Hard boundaries

- Settings SHALL change presentation and player preferences only.
- Simulation ticks, position, velocity, fuel, route/plan hashes, navigation truth, streaming residency, detection, and canonical entities SHALL remain unchanged.
- Render distance SHALL only change camera/render projection.
- FPS limiting SHALL skip GPU presentation only and SHALL NOT throttle `runtime.advance` or fixed-step simulation.
- Normal settings and screenshot tests SHALL NOT load `?testBridge=1`.
- `Assets/**`, package/lockfiles, gameplay domains, and test-harness code are out of scope.

## Deliverables

- Versioned schema, presets, validation, capabilities, storage, store/controller, and immutable snapshots.
- Live renderer adapter with honest applied/restart/browser-managed/unsupported reporting.
- Accessible Graphics dialog with Apply, Cancel, Reset Defaults, and Back.
- Five focused unit suites, normal-runtime Playwright flow, three 1920x1080 screenshots, JSON/Markdown evidence, and a browser architecture note.

## Success

All focused and full verification commands pass, evidence is generated from the real runtime, the allowlist audit is clean, and DevToolbox tasks are closed only after evidence and completion preflight.
