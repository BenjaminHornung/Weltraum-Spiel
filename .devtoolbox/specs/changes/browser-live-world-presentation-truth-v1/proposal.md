# Proposal: browser-live-world-presentation-truth-v1

## Change
`browser-live-world-presentation-truth-v1`

## Context
Current runtime owns the telemetry truth source, while the normal scene currently hides target/route/obstacle visibility unless debug surfaces are used, and decorative objects are mixed with truth projections.

## Goal
Align the specification set to the approved implementation so the world presentation layer uses:
- a pure telemetry snapshot adapter,
- deterministic world-presentation IDs and hashes,
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
- Optional existing: `apps/weltraum-browser/src/world/provingGroundWorld.ts` (for frame descriptor reuse/export)
- New: `apps/weltraum-browser/tests/unit/worldPresentation.test.ts`
- New: `apps/weltraum-browser/tests/unit/worldPresentationRenderer.test.ts`
- New: `apps/weltraum-browser/tests/e2e/live-world-presentation-truth.spec.ts`
- Evidence: `apps/weltraum-browser/evidence/browser-live-world-presentation-truth-v1*`, `apps/weltraum-browser/evidence/live-world-*.png`

## Hard Constraints
- Scope must remain in this change folder, listed source files, and this mainline docs file.
- Forbidden paths: `apps/weltraum-browser/src/ui/**`, `apps/weltraum-browser/src/runtime/**`, `apps/weltraum-browser/src/main.ts`, `src/world/planner/*`, `src/runtime/*`, `src/flight/planner/*`, `Assets/**`, package files and lockfiles.
- No planner-map modules, planner/controls styles/scripts, or map-only ownership files.
- Normal `/` must stay TestBridge-free.
- Renderer output is presentation-only and must not write back to gameplay truth.
