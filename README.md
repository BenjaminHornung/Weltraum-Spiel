# Working Spaceflight Prototype

This Unity prototype is a generated-primitives-only playable slice for testing zero-gravity ship movement, fuel use, speed feedback, projectiles, transform-driven RCS, and placeholder VFX.

## Setup

- Open the project in Unity 6000.4.7f1 or newer in the Unity 6 line.
- Load `Assets/Scenes/PrototypeBootstrapHost.unity`, or press Play from an empty/nearly empty scene. `PrototypeBootstrap` creates the prototype objects at runtime when needed.
- No external asset pack is required. The ship, test environment, orientation markers, engine effect, and projectiles are generated from Unity primitives and built-in components.

## Controls

| Key | Action |
| --- | --- |
| `F1` | Toggle compact keybind help |
| `F2` | Toggle flight diagnostics / debug overlay |
| `F3` | Toggle flight debug console |
| `F4` | Toggle HUD/Navball |
| `F5` | Toggle minimap/radar |
| `W` / `S` | Pitch down / up |
| `A` / `D` | Yaw left / right |
| `Q` / `E` | Roll left / right |
| `Left Shift` / `Left Control` | Increase / decrease persistent main-thruster throttle |
| `X` / `Y/Z` | Cut throttle / full throttle |
| `Space` | Fire the current main gun |
| `R` | Toggle RCS on/off |
| `Caps Lock` | Cycle control mode: Cruise -> Precision -> Translation -> Cruise |
| `H` / `N` | Normal: legacy RCS forward/back; Precision/Translation: RCS up/down |
| `I` / `K` | RCS translate down / up |
| `J` / `L` | RCS translate left / right |
| `T` | Toggle SAS angular stabilization through the RCS allocator |
| `Tab` / `B` | Select next / previous navigation waypoint |
| `G` | Toggle waypoint autopilot for the selected target |
| Hold `F` | Temporarily invert effective SAS state |
| `V` | Cycle the prepared follow-camera mode |
| Backquote | Reset camera framing |
| `Backspace` | Debug-only refill fuel |
| `M` | Reserved; no action in this prototype |

Mouse movement is reserved for the camera. Hold right mouse button to orbit/look around the ship; mouse input does not feed ship attitude.

German keyboard note: full throttle accepts both `Y` and `Z` so the control works reliably when those keys are swapped by the active layout.

Control mode is explicit and cycles with `Caps Lock` or the HUD mode button. Cruise Mode is the long-distance mode: W/S pitch, A/D yaw, Q/E roll, Shift/Ctrl adjust persistent main throttle, and the waypoint autopilot uses the main-thruster burn/brake path. Precision Mode forces main thruster and gimbal off, forces RCS available, and keeps W/S pitch, A/D yaw, and Q/E roll for exact attitude control. Translation Mode also forces main/gimbal off and maps W/S to forward/back, A/D to left/right, H/N to up/down, while Q/E remains roll. Left Alt is not used as the primary mode switch.

## Controller Status

Controller input is attempted through the Unity Input System when a gamepad is connected:

- Right trigger: increase persistent main-thruster throttle
- Left trigger: decrease persistent main-thruster throttle
- Left stick: best-effort RCS left/right and up/down translation
- Right stick: yaw and pitch
- Shoulder buttons: roll
- South button: fire
- West button: toggle RCS
- North button: toggle SAS

This mapping has compile/play coverage only in this slice. Hardware feel and per-controller layout still need manual verification.
Camera reset is bound to Backquote. Unity Input System key controls are physical-location based, so this prototype does not treat plain `3` as `#`; non-US hash-key support needs a verified layout-specific binding before it is documented as a control.

## Prototype HUD And Debug UI

- `PrototypeFlightHud`, `PrototypeDebugOverlay`, `PrototypeFlightDebugConsole`, `PrototypeKeybindOverlay`, and `PrototypeMinimapOverlay` are bound to the main camera after every generated ship spawn. They remain temporary IMGUI prototype UI, not final HUD art.
- `F1` toggles a draggable keybind helper. `F2`, `F3`, `F4`, and `F5` toggle flight diagnostics, debug console, HUD/Navball, and minimap without relying on German-keyboard-sensitive punctuation keys.
- The default startup view is the compact Flight Test preset: small flight diagnostics, HUD/Navball, and minimap, with the debug console hidden until needed.
- Debug Console presets are available for Basic, Flight Test, RCS Test, and Full Diagnostics. Presets only change UI visibility/collapsed state and debug marker visibility; they do not change flight physics or control bindings.
- `PrototypeMinimapOverlay` is a simple top-down XZ radar centered on the ship. It draws heading, velocity, range rings, origin, targets, beacons, gates, station, and visual obstacles with 250 m / 500 m / 1000 m / 2500 m zoom levels, filter toggles, optional opacity, and labels off by default. When labels are enabled, they stay limited to origin/station plus a few nearest relevant points.
- The HUD shows a center forward marker, velocity prograde/retrograde markers, and a target marker when `PrototypeTargetDummy` exists. SAS and debug force markers remain available when relevant, but the default marker set stays short.
- The HUD/Navball includes small quick actions for previous/next target, autopilot, Kill Momentum, Control Mode, and SAS. A compact hint line shows `G Autopilot | Tab/B Target | Caps Mode`, the selected target, autopilot state, and active control mode.
- When debug vectors or RCS Test diagnostics are enabled, the HUD can also show desired, actual, and residual RCS force markers so allocator limitations are visible without reading the full debug overlay.
- The mode label reserves `WORLD`, `VELOCITY`, `TARGET`, `DOCKING`, and `ORBIT/GRAVITY`, but the visible HUD only prints the active short label such as `Mode: TARGET`.
- `PrototypeFlightDebugConsole` is a development console for testing. Refuel, reset, damage, spawn target, test pulses, variant selection, debug vector toggles, UI presets, control calibration, gimbal mode tuning, navigation/autopilot controls, and debug assist controls are debug-only actions, not final player-facing gameplay UI.
- `PrototypeWaypointAutopilot` is a prototype navigation assist. It reports selected target, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status in the debug overlay.
- `PrototypeMomentumAssist` exposes a physical Kill Momentum action. It commands existing main/RCS/SAS assist paths and reports Idle, AlignForBrake, MainBrake, RcsDamp, Complete, Aborted, FuelInsufficient, and NoAuthority; it is not a debug velocity reset.

## Prototype Test Environment

- `PrototypeBootstrap` can generate a `PrototypeEnvironment` root each time the prototype is rebuilt. Rebuild clears the previous generated root first so the test range does not duplicate.
- The environment is generated only from Unity primitives, LineRenderer rings/axes, simple materials, lights, and TextMesh labels. No external asset pack is required. Its default display mode favors a Training-style readable view instead of full debug clutter.
- The generated test range includes an origin beacon, color-coded X/Y/Z axes, 100 m / 250 m / 500 m / 1000 m range rings, multiple target dummies, navigation beacons, approach gates, a station/hangar placeholder, and a non-damaging visual asteroid field.
- Targets use the existing `PrototypeTargetDummy` hit-feedback component. Beacons, gates, station, and obstacles are orientation landmarks for manual flight, RCS translation, minimap testing, and future waypoint/autopilot work. Large gate/range labels stay reduced or hidden unless fuller diagnostics are requested.

## Prototype Values

- `PrototypeBootstrap` can optionally reference a `PrototypeShipConfig` ScriptableObject for prototype tuning. Leave it unassigned to keep the built-in default ship values.
- Create a config from `Assets > Create > Prototype > Ship Config` to tune fuel, dry masses, main thruster force/mode/gimbal response, RCS thrust/selection values, projectile speed/fire rate/lifetime/scale/mass/recoil, and camera distance/height.
- This config is only a prototype tuning container. It does not add a ship editor, inventory, save/load, or final module architecture.
- Fuel is stored as kilograms and contributes to the generated fuel-tank module mass.
- Full main thrust consumes `0.6 kg/s`, scales with throttle, and the final partial-fuel step applies only the covered thrust fraction.
- A configured fuel rate of zero means fuel-free thrust; fuel-consuming thrusters stop only when they request fuel and no fuel is available.
- RCS consumes fuel from the final bounded nozzle allocator output, so combined translation/attitude commands charge each nozzle once after allocation.
- The generated ship is a larger elongated module craft with a visible cube-like main gimbal module and four side-centered RCS blocks.
- Main-thruster mode defaults to `ComSafeSteeringOnly`: straight thrust is applied through center of mass, and only gimbal steering force is applied at the offset nozzle for intentional torque telemetry.
- `FullyPhysicalNozzleForce` can be selected for experiments; it applies the full gimballed main-engine force at the nozzle position and can create torque from nozzle/COM offsets.
- Main-thruster gimbal support now defaults to a calmer 10 degree hard limit, 0.14 response scalar, and 30 degrees-per-second slew. `GimbalAssistMode` defaults to `AutopilotOnly`, while Off, Low, Manual, and ExperimentalFull remain available from debug tuning.
- Control Mode is the gameplay-facing flight model switch. Caps Lock cycles Cruise, Precision, and Translation. Precision and Translation force RCS available, force main thruster/gimbal commands to zero, ignore Shift/Ctrl throttle input, and keep main throttle at zero until the pilot or autopilot explicitly commands Cruise thrust again.
- Each RCS block has five installed nozzle transforms, excluding the side that faces into the ship wall. RCS translation, attitude, and SAS use actual nozzle positions/directions rather than hardcoded slots.
- Generated module proxies now carry simple damage state. Damaged RCS blocks scale their effective thrust through the existing RCS allocator, so physical authority falls with module integrity.
- SAS has `KillRotation` and `HoldAttitude` modes. It creates a ship-local PD torque request from angular velocity and optional target attitude, then sends that request through the same RCS nozzle allocator as manual attitude.
- SAS exposes proportional and derivative gains on `RcsThrusterController`. Manual pitch, yaw, or roll input masks SAS on that same axis while released axes continue to stabilize.
- Flight assist is an explicit request layer with `Simulation`, `AssistedFlight`, and `DebugAssist` modes. Simulation mode sends no assist force or torque, assisted requests must go through the RCS allocator and `ShipPhysicsCore`, and debug-only requests are labeled so they cannot masquerade as physical flight. Momentum Assist adds a `MomentumAssist` request source for Kill Momentum so braking stays visible and physical.
- Waypoint navigation creates three visible primitive targets at runtime. `Tab` and `B` cycle them, and `G` toggles a conservative autopilot that accelerates and brakes through the existing main-thruster/fuel path while using RCS pulses for attitude and lateral correction when available.
- The waypoint autopilot estimates stopping distance from current closing speed and conservative deceleration. It accounts for initial velocity and lateral velocity, and it may refuse a route with `FuelInsufficient` instead of pretending the ship can arrive.
- `DockingPort` is a prototype docking data component. It reports world port frame data, relative state, eligibility diagnostics, bounded soft-capture `FlightAssistRequest` values, and a hard-lock placeholder that only requests lock after distance, angle, and velocity checks pass.
- Built-in debug variants are available through the flight debug console: Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, and No-RCS. These variants are generated test rigs for physics behavior, not a final ship editor.
- Generated primitive modules use a higher-contrast role palette so hull, cockpit, fuel tanks, engines, RCS blocks, guns, cargo/utility, target markers, and orientation markers are easier to tell apart during tests. Cockpit, fuel, main engine, RCS, gun, and cargo roles are intentionally distinct primitives, not final art assets.
- Active RCS nozzles show stronger cyan/green debug VFX only while their nozzles are active. The main thruster keeps a separate orange/blue effect with a visible nozzle ring.
- The no-hardcoded-position rule is intentional: moving/removing an `RCS_Nozzle_*` transform changes solver output, and missing nozzles create no phantom force.
- The RCS toggle gates RCS force application and VFX.
- Ship-level force application now routes through a thin `ShipPhysicsCore`. Main thrusters and RCS still own their current behavior, but final Rigidbody force calls and net force/torque diagnostics have a central path.
- The debug overlay reports fuel mass, main/RCS fuel request, actual fuel used, fuel fraction, and RCS allocator throttle totals. The physics model is documented in [docs/physics-flight-model.md](docs/physics-flight-model.md).
- Projectile velocity is the ship Rigidbody velocity plus muzzle forward velocity.
- Projectile firing applies optional recoil impulse opposite the muzzle direction using configured projectile mass and projectile speed.
- Projectiles ignore the firing ship's colliders and sweep their previous-to-current physics travel with sphere/raycast checks for fast target hits.
- Projectile hits populate impact event data with hit point, normal, relative velocity, impulse estimate, and module hit. Module damage and optional target impact impulse route through the same prototype physics diagnostics.
- Projectile lifetime defaults to 3 seconds.

## Optional Asset Policy

Optional CC0 assets, such as local low-poly ships or Kenney packs, may be considered later for polish only. They must not become required for this prototype, and any import should stay small and reversible.

## Known Limits

- This is not the final ship editor or gameplay architecture.
- The camera mode cycle is intentionally minimal and only switches between prepared follow offsets/orbit baselines.
- SAS is a local PD torque controller routed through RCS, not a full flight computer or hidden angular damping layer.
- Flight assist does not use hidden Rigidbody damping. Physical assist requests are allocator-limited; debug-only helpers are diagnostics/testing aids only.
- Waypoint autopilot v0 is a local prototype assist, not an orbital navigator, map UI, docking planner, slingshot planner, or obstacle-avoidance system. It does not use hidden teleporting or direct Rigidbody velocity writes during runtime navigation.
- Manual throttle, attitude, or RCS input aborts waypoint autopilot and active momentum assist where that assist is not deliberately in a hold/status state, returning control to the pilot.
- Docking hard lock is currently a documented placeholder rather than an active joint. It is gated by docking constraints so later joint work can reuse the same diagnostics.
- RCS allocation is a prototype bounded allocator, not a final optimizer, but it is transform-based and uses real lever arms around COM.
- Deferred physics-core slices include additional SAS/autopilot modes, docking, deeper damage effects, and trajectory prediction.
- Full armor balance, part detachment, visual destruction, and combat economy are out of scope.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
