# Design: Fix RCS VFX Direction Mapping

## Current Failure Signal

The user reports that RCS particle animations sometimes appear in directions that do not match the active input. This can be a pure VFX transform issue, or it can reveal that the selected nozzle/force vector does not match the intended command.

## Intended Model

Each RCS nozzle has a physical force direction and a visual exhaust direction. The visual exhaust should represent the reaction exhaust, while the force applied to the ship is the opposite physical effect depending on the existing controller convention. The important invariant for this prototype is that the same selected nozzle entry drives both force/torque and VFX activation.

## Investigation Focus

Before editing, verify:

- How `PrototypeBootstrap` creates RCS blocks, nozzle transforms, and particle children.
- Whether the nozzle transform forward/up axis represents force direction, exhaust direction, or a display-only direction.
- How `RcsThrusterController` selects nozzles for translation, attitude, and SAS.
- Whether VFX activation is tied to the same selected nozzle records that apply force.
- Whether local/world transform conversion flips any direction unexpectedly.

## Implementation Strategy

Prefer the smallest fix that restores one source of truth: a selected nozzle should carry its force direction, torque contribution, and VFX object together. If the issue is purely visual, rotate or parent VFX so particles emit along the intended exhaust direction. If the issue is selection math, fix the vector convention and update the physics documentation.

Do not introduce polished art or a new particle system architecture. Keep the debug-friendly colored placeholder style.

## Verification Strategy

Use Unity MCP for all Unity script edits and verification. Probe translation, attitude, and SAS commands with deterministic in-memory or play-mode checks that report selected nozzle names, force directions, and active VFX objects. Where possible, capture screenshots or use scene hierarchy checks to confirm particle children correspond to selected nozzles.

## Risks

- The naming of directions can be ambiguous: nozzle forward may mean exhaust direction or force direction. Document the chosen convention.
- Torque-correct nozzles can look unintuitive without a clear exhaust/force distinction. The fix should make the visual match the physical selected nozzle, not necessarily a simplified user expectation.
- Correcting vector conventions can affect gameplay forces, so verification must include both VFX and physics outputs.
