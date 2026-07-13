# Browser Demo Scout Nozzle VFX Binding v2

## Motivation

The current browser mainline loads the Demo Scout GLB and binds four coarse RCS
hardpoints, but its puffs are still selected by index and actuator flags. The
authored asset contains twenty stable `RCS_Nozzle_*` nodes. VFX should project
those authored locations while continuing to consume owner actuator telemetry,
never presentation pose or input state as flight truth.

The superseded branch `feature/browser-demo-scout-nozzle-vfx-binding-v1`
identified the node inventory, but its implementation mixed main and RCS
acceleration, inverse-rotated body-local angular telemetry, and forced an
arbitrary minimum puff count. This change reimplements only the relevant intent
from current `main`.

## Outcomes

- A validated twenty-nozzle Demo Scout registry with deterministic per-nozzle
  manifest fallback and binding diagnostics.
- Separate applied main and RCS-translation acceleration vectors in owner
  actuator telemetry without changing integration or physics.
- Direction- and torque-compatible RCS puff selection from owner telemetry.
- Exactly six aggregate position-only markers for procedural fallback, kept
  separate from all directional nozzle compatibility claims.
- TestBridge-visible nozzle positions, directions, sources, diagnostics, and
  visibility for browser evidence.

## Scope

- Browser flight telemetry, simulation cloning/serialization, Three.js ship VFX,
  focused unit tests, and gated browser evidence.
- The existing Demo Scout GLB and procedural visual fallback.

## Non-goals

- No per-nozzle force allocator or exact allocation claim.
- No flight tuning, physics changes, planner/executor changes, or render-smoothing
  authority changes.
- No GLB mutation, dependency/lockfile change, archived Unity-source change, or broad neutral-art
  pipeline work.
- No reuse of stale screenshots or evidence from the superseded branch.
