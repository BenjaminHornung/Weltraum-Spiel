# Design: RCS Attitude Linear Drift Fix

## Problem Model

The ship currently has separate RCS commands for translation and attitude. Translation was fixed to apply force through the Rigidbody center of mass, but attitude still uses selected off-center nozzles. Pitch/yaw nozzle selections can create the intended torque and also a non-zero net force. That net force becomes unwanted ship drift from rest.

Q/E roll is the control-path reference because the user reports it does not show the same bug.

## Chosen Prototype Fix

For this prototype, attitude commands should be torque-authoritative and translation-neutral. The implementation may either:

- balance selected attitude nozzle forces by applying a COM correction force that cancels their net linear force, or
- aggregate the selected attitude effect into an explicit torque application while preserving nozzle/VFX diagnostics.

The preferred minimal change is to keep selected attitude nozzles and their VFX/debug IDs, preserve the existing torque estimate, and neutralize any net attitude linear force at the Rigidbody center of mass. This keeps the current prototype visuals and avoids introducing a full allocation solver.

## Preserved Behavior

- RCS translation remains COM-neutral via the existing translation fix.
- Attitude commands still rotate the ship.
- SAS still uses RCS attitude authority to brake angular velocity.
- Q/E roll remains functional.
- Debug overlay diagnostics remain meaningful: attitude torque should be visible, while pure attitude should not show meaningful translation drift.

## Verification Strategy

Use Unity MCP only for Unity script inspection, mutation, compile checks, and runtime probes. Deterministic probes should reset a Rigidbody to rest, apply one command for one physics step, and measure local linear velocity, angular velocity, net translation force, torque estimate, active nozzle count, and VFX activation.

## Technical Risks

- A COM correction force is a prototype simplification and not a final RCS allocator.
- The selected nozzle set may still not be physically optimal; the goal is player-correct behavior for the current prototype.
- If diagnostics currently conflate total force with applied translation force, labels may need a small clarification.
