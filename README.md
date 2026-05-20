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
| `H` / `N` | RCS translate forward / backward |
| `I` / `K` | RCS translate down / up |
| `J` / `L` | RCS translate left / right |
| `T` | Toggle SAS angular stabilization through the RCS allocator |
| `Tab` / `B` | Select next / previous navigation waypoint |
| `G` | Toggle waypoint autopilot for the selected target |
| Hold `F` | Temporarily invert effective SAS state |
| `Caps Lock` | Toggle precision controls for reduced attitude and RCS strength |
| `V` | Cycle the prepared follow-camera mode |
| Backquote | Reset camera framing |
| `Backspace` | Debug-only refill fuel |
| `M` | Reserved; no action in this prototype |

Mouse movement is reserved for the camera. Hold right mouse button to orbit/look around the ship; mouse input does not feed ship attitude.

German keyboard note: full throttle accepts both `Y` and `Z` so the control works reliably when those keys are swapped by the active layout.

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
- `PrototypeMinimapOverlay` is a simple top-down XZ radar centered on the ship. It draws heading, velocity, range rings, origin, targets, beacons, gates, station, and visual obstacles with 250 m / 500 m / 1000 m / 2500 m zoom levels and optional labels.
- The HUD shows a center forward marker, velocity prograde/retrograde markers, and a target marker when `PrototypeTargetDummy` exists. SAS and debug force markers remain available when relevant, but the default marker set stays short.
- When debug vectors or RCS Test diagnostics are enabled, the HUD can also show desired, actual, and residual RCS force markers so allocator limitations are visible without reading the full debug overlay.
- The mode label reserves `WORLD`, `VELOCITY`, `TARGET`, `DOCKING`, and `ORBIT/GRAVITY`, but the visible HUD only prints the active short label such as `Mode: TARGET`.
- `PrototypeFlightDebugConsole` is a development console for testing. Refuel, reset, damage, spawn target, test pulses, variant selection, debug vector toggles, UI presets, and debug assist controls are debug-only actions, not player-facing gameplay controls.
- `PrototypeWaypointAutopilot` is a prototype navigation assist. It reports selected target, distance, closing speed, lateral speed, stopping distance, fuel estimate, autopilot state, ETA, and arrival status in the debug overlay.

## Prototype Test Environment

- `PrototypeBootstrap` can generate a `PrototypeEnvironment` root each time the prototype is rebuilt. Rebuild clears the previous generated root first so the test range does not duplicate.
- The environment is generated only from Unity primitives, LineRenderer rings/axes, simple materials, lights, and TextMesh labels. No external asset pack is required.
- The generated test range includes an origin beacon, color-coded X/Y/Z axes, 100 m / 250 m / 500 m / 1000 m range rings, multiple target dummies, navigation beacons, approach gates, a station/hangar placeholder, and a non-damaging visual asteroid field.
- Targets use the existing `PrototypeTargetDummy` hit-feedback component. Beacons, gates, station, and obstacles are orientation landmarks for manual flight, RCS translation, minimap testing, and future waypoint/autopilot work.

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
- Main-thruster gimbal support keeps a 20 degree hard limit, while the default response scalar uses a softer 0.35 keyboard command. The visible gimbal cube and the physics force vector use the same effective command.
- Each RCS block has five installed nozzle transforms, excluding the side that faces into the ship wall. RCS translation, attitude, and SAS use actual nozzle positions/directions rather than hardcoded slots.
- Generated module proxies now carry simple damage state. Damaged RCS blocks scale their effective thrust through the existing RCS allocator, so physical authority falls with module integrity.
- SAS has `KillRotation` and `HoldAttitude` modes. It creates a ship-local PD torque request from angular velocity and optional target attitude, then sends that request through the same RCS nozzle allocator as manual attitude.
- SAS exposes proportional and derivative gains on `RcsThrusterController`. Manual pitch, yaw, or roll input masks SAS on that same axis while released axes continue to stabilize.
- Flight assist is an explicit request layer with `Simulation`, `AssistedFlight`, and `DebugAssist` modes. Simulation mode sends no assist force or torque, assisted requests must go through the RCS allocator and `ShipPhysicsCore`, and debug-only requests are labeled so they cannot masquerade as physical flight.
- Waypoint navigation creates three visible primitive targets at runtime. `Tab` and `B` cycle them, and `G` toggles a conservative autopilot that accelerates and brakes through the existing main-thruster/fuel path while using RCS pulses for attitude and lateral correction when available.
- The waypoint autopilot estimates stopping distance from current closing speed and conservative deceleration. It accounts for initial velocity and lateral velocity, and it may refuse a route with `FuelInsufficient` instead of pretending the ship can arrive.
- `DockingPort` is a prototype docking data component. It reports world port frame data, relative state, eligibility diagnostics, bounded soft-capture `FlightAssistRequest` values, and a hard-lock placeholder that only requests lock after distance, angle, and velocity checks pass.
- Built-in debug variants are available through the flight debug console: Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, and No-RCS. These variants are generated test rigs for physics behavior, not a final ship editor.
- Generated primitive modules use a role-based prototype palette so hull, cockpit, fuel tanks, engines, RCS blocks, guns, cargo/utility, target markers, and orientation markers are easier to tell apart during tests.
- Active RCS nozzles show green debug VFX. The main thruster keeps its separate orange particle effect.
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
- Manual throttle or attitude input aborts waypoint autopilot and returns control to the pilot.
- Docking hard lock is currently a documented placeholder rather than an active joint. It is gated by docking constraints so later joint work can reuse the same diagnostics.
- RCS allocation is a prototype bounded allocator, not a final optimizer, but it is transform-based and uses real lever arms around COM.
- Deferred physics-core slices include additional SAS/autopilot modes, docking, deeper damage effects, and trajectory prediction.
- Full armor balance, part detachment, visual destruction, and combat economy are out of scope.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
