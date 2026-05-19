# Design: Fix RCS Authority and VFX Regression

## Current Failure Signals

The user reports that active ship movement is slower with SAS enabled than with SAS disabled. That suggests SAS counter-command or settle logic is reducing active manual input authority instead of only stabilizing released axes.

The user also reports that RCS particles are gone after the exhaust-direction fix. This likely means the exhaust object is positioned/oriented correctly in math probes but hidden by geometry, disabled state, tiny scale, particle orientation, or an activation mismatch in the actual scene.

## Intended Control Model

SAS is an active stabilizer, not a control limiter. When the player is actively commanding pitch, yaw, roll, or translation, those manual commands should keep full RCS authority. SAS may stabilize axes without manual input, and it may brake residual angular velocity after input release. SAS must not fight the player's current input on the same axis.

## RCS Thrust Model

The generated ship has four RCS blocks. Each block should carry an inspector-adjustable thrust value. Every nozzle on that block uses the block thrust when selected. This keeps the prototype simple while preparing for later RCS block variants with different thrust values.

The current nozzle direction convention stays:

- Nozzle forward = force direction applied to the ship.
- Visual exhaust = opposite nozzle forward.

## VFX Strategy

RCS VFX must be visible for selected nozzles in the prototype scene. If the recent opposite-exhaust placement hides the cube/cone inside the RCS block, move the placeholder exhaust farther out or shape it so it remains visible while still pointing opposite force direction. Keep selected nozzle records as the activation source of truth.

## Investigation Focus

Before editing, check:

- Whether SAS command is still mixed into manually commanded axes.
- Whether SAS settle logic zeroes or reduces angular velocity while manual input is held.
- Whether RCS VFX is active but hidden/inside geometry after moving to local back.
- Whether the current force value is global per controller/nozzle and how to introduce block-level values with minimal code.

## Implementation Strategy

Prefer small changes in existing prototype scripts:

- `RcsThrusterController` for SAS/manual blending and per-block/nozzle thrust lookup.
- `PrototypeBootstrap` for generated RCS block thrust setup and visible VFX placement.
- `PrototypeDebugOverlay` only if useful to show RCS thrust/block values or active VFX state.
- `docs/physics-flight-model.md` for the updated RCS thrust and SAS interaction rule.

Avoid a full part system or large architecture.

## Verification Strategy

Use Unity MCP for script edits, compile checks, console checks, and deterministic probes. Compare manual attitude/translation authority with SAS on vs off. Confirm residual damping still works after input release. Confirm selected nozzles have visible active VFX and VFX exhaust remains opposite force direction.

## Risks

- Preventing SAS from fighting manual axes must not disable residual damping after the input is released.
- Per-block thrust should not create hardcoded assumptions that prevent later variants.
- Moving VFX outward can make visuals less physically precise, but visibility matters more for this placeholder debug prototype.
