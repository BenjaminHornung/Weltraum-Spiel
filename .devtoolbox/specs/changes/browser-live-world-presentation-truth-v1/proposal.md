# Proposal: browser-live-world-presentation-truth-v1

## Change
`browser-live-world-presentation-truth-v1`

## Context
`TelemetrySnapshot.navigationMap` is now the canonical browser spatial truth, while the live world presentation still projects several world objects from renderer-owned defaults and does not yet enforce map-route parity for every visible route.

## Goal
Align the specification set to the approved implementation so the world presentation layer uses:
- `TelemetrySnapshot.navigationMap` as the only spatial source,
- raw telemetry only for velocity, executor lifecycle, preview admission, and arrival metadata,
- deterministic world-presentation IDs and hashes,
- exact map-backed target, route, obstacle, entity, residency, and LOD projections,
- strict truth/decorative separation,
- a non-authoritative renderer contract, and
- explicit evidence gates for normal runtime and query-gated tooling.

## In-Scope Artifact Set
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/proposal.md`
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/design.md`
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/specs/default/spec.md`
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/tasks.md`
- `.devtoolbox/specs/changes/browser-live-world-presentation-truth-v1/tests/test-protocol.md`
- `docs/browser-mainline/live-world-presentation-truth-v1.md`

## Approved Implementation Scope
- New: `apps/weltraum-browser/src/world/worldPresentation.ts`
- New: `apps/weltraum-browser/src/render/three/worldPresentationRenderer.ts`
- Existing: `apps/weltraum-browser/src/render/three/debugScene.ts`
- New: `apps/weltraum-browser/tests/unit/worldPresentation.test.ts`
- New: `apps/weltraum-browser/tests/unit/worldPresentationRenderer.test.ts`
- New: `apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts`
- Evidence: `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1*`, `apps/weltraum-browser/evidence/live-world-*.png`

## Hard Constraints
- Scope must remain in this change folder, listed source files, and this mainline docs file.
- Forbidden paths: `apps/weltraum-browser/src/ui/**`, `apps/weltraum-browser/src/runtime/**`, `apps/weltraum-browser/src/main.ts`, `src/world/planner/*`, `src/runtime/*`, `src/flight/planner/*`, `Assets/**`, package files and lockfiles.
- No planner-map modules, planner/controls styles/scripts, runtime fallback sources, or map ownership files.
- Normal `/` must stay TestBridge-free.
- Renderer output is presentation-only and must not write back to gameplay truth.
- Abort instead of widening scope if normal `/` has no navigation map snapshot or a map target/hash/geometry contradiction is detected.
