# Design: Space PvE Arena Loop v0

## Reuse Strategy

This slice should stitch together existing prototype systems rather than introduce a broad mission framework. The arena loop owns objective state and target lifecycle. Combat, damage, targeting, flight, reset, and HUD rendering should stay in their existing systems.

Reusable seams to prefer:

- Existing target marker, target registry, target dummy, damage state, projectile simulation, and weapon computer behavior for combat completion.
- Existing `PrototypeBootstrap` scene setup so the loop appears in the playable prototype without requiring hand-authored scene hierarchy paths.
- Existing `PrototypePlayerHudSnapshotBuilder` / renderer style for a player-facing status snapshot that tests can validate without relying on GUI draw timing.
- Existing headless scenario, combat driver, and HUD validation tests for deterministic coverage.

## Runtime Shape

Add a small `PrototypePveArenaLoop` MonoBehaviour responsible for:

- deterministic target registration/spawn or restoration;
- objective counters and state transitions;
- reset/replay of the loop in Play mode;
- a reward stub snapshot when complete.

Targets should be simple objective actors, backed by existing target marker/damage components where possible. If a small wrapper is needed, it should only expose alive/destroyed state and reset behavior.

Add a compact arena status snapshot that can be read by HUD code and tests. The status should include objective name, active/completed flag, destroyed/total/remaining counts, and reward stub text. The HUD should render this as ordinary player-facing status, not as a debug tuning panel.

## Scope Controls

- Keep enemy behavior stationary or minimal for v0.
- Do not add persistent rewards or economy data.
- Do not add a generalized mission graph.
- Do not depend on a hardcoded demo ship hierarchy path.
- Do not alter weapon aiming constraints or turret center fallback rules.

## Validation Plan

- EditMode tests for objective start/reset, target destruction-driven progress, completion, reward stub, and HUD snapshot output.
- Focused script validation for new/changed prototype scripts.
- Focused Unity EditMode test run through MCP where available.
- `dotnet build` and filtered `dotnet test` for deterministic test execution.
- DevToolbox `specs_validate`, `verify_fresh`, task completion preflight, and archive.
