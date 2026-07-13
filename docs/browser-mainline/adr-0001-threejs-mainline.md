# ADR-0001: Browser / Three.js Mainline

Date: 2026-06-29

## Status

Accepted for the mainline transition. The current v1 transition includes the browser app, tests, copied evidence and final reports; Unity remains legacy/reference.

## Decision

Weltraum's new product mainline is a browser-native TypeScript / Three.js path. Unity remains in the repository as a legacy/reference implementation and evidence source, not as the architecture to copy.

This is not a 1:1 Unity rewrite. The browser mainline ports feature intent, data contracts, acceptance behavior and evidence posture. It must not port MonoBehaviour lifecycles, scene hierarchy assumptions, Unity Rigidbody behavior, IMGUI/debug-only UI, or fallback behavior as product architecture.

## Context

Source evidence:

- `docs/legacy-unity/source-evidence/current-core-inventory.md`
- `docs/legacy-unity/source-evidence/unity-to-threejs-port-map.json`
- `docs/legacy-unity/source-evidence/threejs-spike-decision-report.md`
- `docs/legacy-unity/source-evidence/threejs-spike-test-summary.md`
- `docs/legacy-unity/current-prototype-state-2026-06-15.md`
- `docs/legacy-unity/architecture/prototype-legacy-boundary-audit-2026-06-15.md`
- `docs/architecture/autopilot-v2-design.md`
- `docs/legacy-unity/architecture/autopilot-v2-test-harness.md`
- `docs/legacy-unity/architecture/clean-core-runtime-architecture.md`

The Three.js spike proved a deterministic browser seam for fixed-step simulation, route planning, locked-plan execution, telemetry snapshots, browser screenshots and Playwright evidence. The previous spike recommendation was conservative (`Three.js parallel`) because much of the gameplay surface is still Unity-bound. The owner decision for this transition is to move the product mainline to the browser while preserving Unity as reference/evidence and keeping expansion incremental.

## Consequences

- Browser core owns future product behavior for flight, navigation, telemetry, proving-ground evidence and low-poly open-world runtime.
- Three.js renders snapshots. Gameplay truth must live in deterministic core/simulation state, not scene objects.
- UI renders ViewModels/snapshots and sends commands. It must not compute hidden route truth, fuel validity, authority status or planner internals.
- Autopilot keeps the V2 rule: planner produces an immutable route plan, executor consumes that locked plan, and invalidation becomes a visible `replanRequired`/reason signal. No silent executor-side replan.
- Unity source and specs may be mined for behavior, vocabulary, edge cases, bug traps and evidence structures.
- Unity-specific implementation structures are non-goals unless a future spec explicitly says otherwise.

## Non-Goals

- Historical M0 baseline only: app/source/test/spec copy was deferred before v1. The current v1 transition includes browser app source, copied source evidence, tests and reports.
- No deletion or cleanup of Unity sources.
- No Ship Builder runtime implementation.
- No Surface-FPS runtime implementation.
- No economy, missions, factions, drones or production asset migration.

## Acceptance Link

This ADR is supported by the feature-intent cards, architecture, roadmap, bug-trap list and evidence strategy in `docs/browser-mainline/`.
