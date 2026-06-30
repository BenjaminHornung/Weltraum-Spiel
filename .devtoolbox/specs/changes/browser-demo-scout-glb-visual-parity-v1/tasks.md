# Tasks: Browser Demo Scout GLB Visual Parity v1

## Task 1 — Implement the visual adapter and load-state machine
**Objective**: Add the GLB-backed visual path, preserve the procedural fallback, and expose deterministic loading states.

**Exact files / search targets**
- `apps/weltraum-browser/src/render/three/shipVisual.ts`
- `apps/weltraum-browser/src/render/three/debugScene.ts`
- `apps/weltraum-browser/src/main.ts`
- Search for existing visual-source, fallback, marker, and anchor handling in those files before editing.

**Acceptance criteria**
- GLB load success produces a stable `glbReady` source state.
- GLB load failure produces a stable `fallback` or `error` state and still renders the ship.
- Axis/scale correction stays render-only.
- Flight truth, pathing, and planner state remain unchanged.

**Implementation guidance**
- Keep the adapter boundary in `shipVisual.ts`.
- Preserve procedural fallback and do not introduce silent replan logic.
- Make state transitions deterministic and monotonic.

**Required skills / MCPs**
- `verification-before-completion`
- `playwright`
- Use repository-local search/read tools first; do not rely on DevToolbox workspace discovery here because the repo is known to reject it.

**Verification scenarios**
- Launch the debug scene and wait for the explicit visual-source state.
- Confirm the HUD line matches the active source.
- Confirm the fallback path still renders the ship when the GLB is unavailable.

**Report-back format**
- Changed files.
- Visual source states added.
- Verification evidence collected.
- Remaining risk / follow-up if any.

**Stopping rule**
- Stop once the adapter path works, fallback remains intact, and the state machine is deterministic.

## Task 2 — Wire markers, ChaseLocked anchor, HUD line, and TestBridge evidence
**Objective**: Surface marker resolution, axis/scale metadata, and evidence fields consistently across HUD and automation.

**Exact files / search targets**
- `apps/weltraum-browser/src/render/three/shipVisual.ts`
- `apps/weltraum-browser/src/render/three/statusHud.ts`
- `apps/weltraum-browser/src/render/three/debugScene.ts`
- `tests/e2e/debug-scene.spec.ts`
- `tests/unit/statusHud.test.ts`

**Acceptance criteria**
- Markers resolve from GLB first and manifest fallback second.
- ChaseLocked anchor is stable and reported.
- HUD shows the active visual-source line.
- TestBridge exposes visual-source, marker-ready, axis/scale, and fallback metadata.

**Implementation guidance**
- Prefer stable logical marker names over geometry guesses.
- Keep HUD presentation concise; it should summarize, not duplicate debug internals.
- Preserve renderer-not-truth and existing invariants.

**Required skills / MCPs**
- `playwright`
- `verification-before-completion`
- `subagent-driven-development` if the implementation is split across files

**Verification scenarios**
- Unit assertions for HUD rendering of the source line.
- E2E wait on visual-source + marker-ready metadata before screenshot capture.

**Report-back format**
- Files changed.
- Marker fallback behavior.
- HUD/TestBridge fields added.
- Any remaining mismatch between visual and evidence surfaces.

**Stopping rule**
- Stop once marker binding and evidence metadata are stable and testable.

## Task 3 — Verify parity and preserve invariants
**Objective**: Prove the GLB and fallback paths behave deterministically and do not regress existing simulation invariants.

**Exact files / search targets**
- `tests/e2e/debug-scene.spec.ts`
- `tests/unit/simulation.test.ts`
- `tests/unit/statusHud.test.ts`
- Search for planHash, snap/drift, no-silent-replan, and renderer-not-truth assertions before changing any test.

**Acceptance criteria**
- Tests wait on explicit state instead of sleeps.
- GLB-backed and fallback paths both pass the documented assertions.
- Existing invariants remain intact.

**Implementation guidance**
- Tighten assertions only where the new visual-source metadata requires it.
- Do not weaken or bypass gating.

**Required skills / MCPs**
- `playwright`
- `verification-before-completion`
- `subagent-driven-development`

**Verification scenarios**
- Run the targeted unit suites.
- Run the debug-scene E2E path and capture evidence.
- Confirm console output is clean for the new wait strategy.

**Report-back format**
- Commands/scenarios run.
- Pass/fail per suite.
- Evidence artifact locations.
- Unverified items, if any.

**Stopping rule**
- Stop once parity is demonstrated and the invariants remain unchanged.
