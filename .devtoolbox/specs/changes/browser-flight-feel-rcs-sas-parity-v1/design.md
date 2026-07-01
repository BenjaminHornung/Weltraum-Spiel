# Design: browser-flight-feel-rcs-sas-parity-v1

## Technical direction

Build the flight-feel parity in the browser controller and telemetry seams that already exist. The design must stay browser-native: it should use the current mode enum, input state, controller step request, ship state, and executor protections rather than importing Unity's rigidbody or nozzle architecture.

## Current seams to extend

- `apps/weltraum-browser/src/runtime/input.ts`: mode, RCS/SAS, throttle, rotation, translation, and camera input state already exist.
- `apps/weltraum-browser/src/flight/flightController.ts`: current mode gating and actuator telemetry already exist.
- `apps/weltraum-browser/src/flight/executor.ts`: manual/idle preservation and autopilot Cruise behavior already exist.
- `apps/weltraum-browser/src/core/types.ts`: state/telemetry is the bridge to future HUD and regression coverage.

## Mode model

- Cruise is the main-throttle mode.
- Precision is not a synonym for Cruise; it should become the fine-attitude, RCS-emphasized control profile.
- Translation is the linear-translation-emphasized profile.
- Mode changes must update authority and feel without changing executor safety behavior.

Tradeoff: the browser does not need to reproduce Unity's exact input stack. It does need a clear authority profile and predictable player feedback.

## Throttle model

- Treat throttle as a persistent applied state, not only a command value.
- Preserve the current manual/idle request contract; do not reintroduce snap-to-zero when input is absent.
- Introduce spool/ramp behavior and expose commanded vs applied throttle in telemetry.
- Keep the implementation independent from Unity's fuel/thermal internals unless a later slice explicitly needs them.

Tradeoff: a simpler browser throttle curve is acceptable if it reads consistently and avoids abrupt control discontinuities.

## RCS and SAS model

- RCS must separate translation authority from rotation authority.
- Translation mode should strongly prefer linear movement through RCS while keeping rotation available only where intended by the control contract.
- SAS should become a browser-native stabilization contract with explicit effectiveness state. The existing damping path is a valid v1 base, while Unity-style hold-attitude behavior should remain optional/deferred unless explicitly selected.
- If stabilization is ineffective because authority is missing, that state should be readable to the player.

Tradeoff: the browser should not replicate Unity nozzle allocation one-for-one. It should surface enough information to explain active/inactive behavior and preserve manual feel.

## Visualization staging

- Stage visualization in layers: first telemetry and HUD labels, then simple browser markers/debug primitives, then any richer ship-relative effect if needed.
- Keep visualization independent from GLB socket names and child-object discovery.
- Do not block the control-feel work on imported asset availability.

Tradeoff: diagnostic markers are preferred over a premature asset-specific VFX port because they decouple feel work from art integration.

## Telemetry

The browser ship state should continue to expose:

- control mode
- RCS and SAS enablement/effectiveness
- commanded and applied throttle feel
- translation and rotation intent
- actuator activity flags
- last applied acceleration and angular acceleration

This is enough to drive HUD labels and automated regression checks without copying Unity's full allocator model.

## Verification design

- Unit-style checks should cover mode gating, throttle ramping, RCS translation/rotation separation, and SAS effectiveness.
- Browser evidence should cover manual flight feel, mode transitions, camera changes that do not alter authority, and the no-snap/no-idle-zero contract.
- HUD evidence should show readable status labels rather than raw state only.

## Risks

- Overfitting to Unity could recreate brittle internals that the browser does not need, especially hold-attitude SAS and physical nozzle allocation.
- Under-specifying Precision could leave it indistinguishable from Cruise.
- A throttle feel change could accidentally break the executor's idle/manual preservation.
- Visualization work could be coupled to GLB assets too early if the markers are not staged independently.
