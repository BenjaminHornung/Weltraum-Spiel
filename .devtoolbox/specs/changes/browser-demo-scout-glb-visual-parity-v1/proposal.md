# Browser Demo Scout GLB Visual Parity v1

## Motivation
The browser demo already has a verified GLB asset for the scout ship, but the current visual path still needs an explicit spec package so implementation can add GLB parity without rediscovering product intent. The goal is to make the ship render from the GLB when available, preserve the existing procedural fallback, and keep flight truth isolated from visual correction.

## Outcomes
- Deterministic GLB loading with explicit `Loading`, `GLBLoaded`, `GLBFailedFallback`, and `ProceduralFallback` states.
- Visual parity metadata for axes, scale, markers, and VFX anchor binding.
- HUD and TestBridge evidence that expose the active visual source.
- No change to flight truth, planner behavior, or existing fallback safety.

## Scope
- Browser demo rendering only.
- Ship visual adapter, marker binding, and visual-source reporting.
- Test/evidence hooks required to prove the visual source and fallback state.

## Boundaries
- No Unity changes.
- No edits to `Assets/**`.
- No MonoBehaviour port.
- No silent replan, snap, or drift changes.
- No weakening of TestBridge gating, planHash stability, or renderer-not-truth invariants.

## Non-goals
- No gameplay balance changes.
- No new ship behavior outside rendering and evidence metadata.
- No asset conversion or asset replacement.
- No broad refactors beyond the minimum needed to support this visual parity path.
