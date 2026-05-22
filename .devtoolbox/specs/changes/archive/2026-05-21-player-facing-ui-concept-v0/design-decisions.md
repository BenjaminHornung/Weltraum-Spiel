# Player-facing UI concept v0 design decisions

Date: 2026-05-21

Source concept: `docs/player-facing-ui-concept-v0.md`

## Implement now

The current frontend scope is a runtime player HUD, not a final menu suite. The implemented layer uses uGUI for flight HUD, center markers, compact radar, context panel, ship systems, warning strip, and F1 help. Existing IMGUI windows remain the developer/prototype layer.

## Data sources

- Flight mode, throttle, RCS, SAS, and mode hints come from `PlayerShipController` and `PrototypeInputBindingCatalog`.
- Navigation target, distance, ETA, closing/lateral speed, phases, warning chips, predicted route, and avoidance cue come from `PrototypeWaypointAutopilot`.
- Combat target, health, range, fire block reason, AutoFire, and priority come from `PrototypeWeaponComputer` and `PrototypeTurretFireStatus`.
- Docking distance, angle, relative/closing speed, lateral offset, soft-capture request, and hard-lock placeholder wording come from `DockingPort`.
- Ship damage summary comes from `PrototypeModuleDamageState` and `RcsThrusterBlock`.
- Help text comes from `PrototypeInputBindingCatalog`; debug-only lines are filtered unless dev help is explicitly enabled.

## Visual rules

- Use flat runtime HUD panels and existing prototype colors.
- Keep the center free of large text blocks.
- Use one context panel at a time: docking first, then combat, then navigation.
- Use compact bars only for functional status: fuel, throttle, combat integrity, docking distance/alignment/speed.
- Keep generated HUD panels as one canvas instance, with responsive panel positions and width-based scaling on constrained aspect ratios so runtime windows do not stack or overlap.
- Do not add decorative gradients, glow shells, glass effects, fake charts, or dashboard-style metric cards.

## Deferred

- Ship Builder / Loadout UI.
- Mission / Rewards UI.
- Settings, remapping, and controller glyphs.
- Cargo inventory.
- Ammo, heat, power, or energy UI until those systems exist as player-facing gameplay.
- A completed `Docked` state or station services until hard lock creates and confirms a real connection.
- Full UI Toolkit menu stack; UI Toolkit remains a future fit for menus, builder, settings, and mission screens.

## Guardrails

The player HUD must not call `PrototypeFlightDebugConsole` or depend on debug-only controls. Debug internals such as candidate scores, raw requested force/torque, RCS allocator residuals, SAS PID values, hit chance tuning, projectile tuning, yaw/pitch internals, and recoil vectors stay in developer UI only.
