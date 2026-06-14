# Working Spaceflight Prototype

This Unity prototype now boots the imported Blender Demo Scout as the default functional ship for testing zero-gravity movement, fuel use, speed feedback, projectiles, transform-driven RCS, visible turret tracking, and socket-bound VFX. Generated primitives remain available only as an explicit fallback/debug build mode.

## Setup

- Open the project in Unity 6000.4.7f1 or newer in the Unity 6 line.
- Load `Assets/Scenes/PrototypeBootstrapHost.unity`, or press Play from an empty/nearly empty scene. `PrototypeBootstrap` creates the prototype objects at runtime when needed.
- No external asset pack is required. The default ship comes from the local Blender-authored PrototypeShipKit export at `Assets/Art/PrototypeShipKit/DemoShips/demo_scout_mk1.fbx`; the test environment, debug markers, and fallback ship still use Unity primitives and built-in components.

## Controls

| Key | Action |
| --- | --- |
| `F1` | Toggle player HUD help in Basic (player-facing) |
| `F2` | Prototype/dev control: toggle flight diagnostics / debug overlay |
| `F3` | Prototype/dev control: toggle flight debug console |
| `F4` | Prototype/dev control: toggle HUD/Navball |
| `F5` | Prototype/dev control: toggle minimap/radar |
| `F6` | Prototype/dev control: cycle functional imported scout / generated fallback / imported cargo modes |
| `W` / `S` | Pitch down / up |
| `A` / `D` | Yaw left / right |
| `Q` / `E` | Roll left / right |
| `Left Shift` / `Left Control` | Increase / decrease persistent main-thruster throttle |
| `X` / `Y/Z` | Cut throttle / full throttle |
| `Space` | Fire the current main gun; if the Weapon Computer has a selected target, the turret tracks and fires at that target when aligned |
| `R` | Toggle RCS on/off |
| `Caps Lock` | Cycle control mode: Cruise -> Precision -> Translation -> Cruise |
| `H` / `N` | Normal: legacy RCS forward/back; Precision/Translation: RCS up/down |
| `I` / `K` | RCS translate down / up |
| `J` / `L` | RCS translate left / right |
| `T` | Toggle SAS angular stabilization through the RCS allocator |
| `Tab` / `B` | Select next / previous navigation waypoint |
| `G` | Toggle waypoint autopilot for the selected target |
| Hold `F` | Temporarily invert effective SAS state |
| `V` | Cycle camera mode: `ChaseLocked -> OrbitInspect -> Side -> FreeInspect -> ChaseLocked` |
| Mouse wheel | Zoom camera in all camera modes |
| Right Mouse Button | Orbit/look around in any camera mode |
| Backquote / Backslash / Quote / `3` | Reset camera framing |
| `Backspace` | Debug-only refill fuel |
| `M` | Reserved; no action in this prototype |

Mouse movement is reserved for the camera. Hold right mouse button to orbit/look around the ship. In `FreeInspect`, right mouse plus `WASD` and `Q`/`E` moves the inspection target. Mouse scroll zooms in all modes.
`ChaseLocked` keeps a limited look offset window and recenters toward its anchor when RMB is released. `OrbitInspect` is ship/visual-bounds centered and does not auto-recenter.

German keyboard note: full throttle accepts both `Y` and `Z` so the control works reliably when those keys are swapped by the active layout.

Control mode is explicit and cycles with `Caps Lock` (Cruise -> Precision -> Translation -> Cruise) or the HUD mode button. Cruise allows main-thruster throttle (including Shift/Ctrl), and the waypoint autopilot uses the main-thruster burn/brake path. Precision mode forces main thruster and gimbal off and uses RCS for attitude control (W/S pitch, A/D yaw, Q/E roll). Translation mode also forces main/gimbal off and uses RCS translation with W/S forward/back, A/D left/right, H/N up/down, and Q/E roll. Left Alt is not used as the primary mode switch.
If a mode change does not appear in the HUD, check the HUD mode chip/help first before concluding input mode-switching logic is broken.

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

## Player HUD And Debug UI

- The default Basic view is the gameplay-facing uGUI `PrototypePlayerHudRenderer`: flight status, fuel/throttle/RCS/SAS, warning and assist chips, context panel, player radar, Kill Momentum, and F1 player help.
- `F1` toggles only the player HUD help in Basic. The legacy `PrototypeKeybindOverlay` keeps F1 only in prototype/debug presets; player help omits debug controls such as F6 ship visuals, debug console actions, reset/refuel, and DES/ACT/RES telemetry.
- `F2`, `F3`, `F4`, `F5`, and `F6` remain prototype/developer controls (not final player-facing UI) for flight diagnostics, debug console, legacy HUD/Navball, legacy minimap, and ship visuals without relying on German-keyboard-sensitive punctuation keys.
- Debug Console presets are available for Basic, Flight Test, RCS Test, and Full Diagnostics. Presets only change UI visibility/collapsed state and debug marker visibility; they do not change flight physics or control bindings.
- `PrototypeFlightHud`, `PrototypeDebugOverlay`, `PrototypeFlightDebugConsole`, `PrototypeKeybindOverlay`, and `PrototypeMinimapOverlay` are still bound for diagnostics after generated ship spawns, but the old IMGUI HUD/Navball and minimap are not the default player view.
- Player radar is rendered once inside the uGUI `RadarPanel`. The previous IMGUI radar/minimap path remains a prototype diagnostic surface only when explicitly enabled through debug presets.
- The player HUD shows a center forward marker, velocity prograde/retrograde markers, and a target marker when `PrototypeTargetDummy` exists. SAS and debug force markers remain available in developer layers, but the default marker set stays short.
- The mode label reserves `WORLD`, `VELOCITY`, `TARGET`, `DOCKING`, and `ORBIT/GRAVITY`, but the visible HUD only prints the active short label such as `Mode: TARGET`.
- `PrototypeFlightDebugConsole` is a development console for testing. Refuel, reset, damage, spawn target, test pulses, variant selection, debug vector toggles, UI presets, control calibration, gimbal mode tuning, navigation/autopilot controls, and debug assist controls are debug-only actions, not final player-facing gameplay UI.
- If mode switching is not obvious in play, use the HUD mode chip/help as the first source of truth for active mode.
- `PrototypeWaypointAutopilot` is backed by Navigation Computer v2. It reports selected target, distance, relative speed, v2 phase, active burn segment, obstacle status, avoidance/reacquire state, planned ETA/stopping distance, requested acceleration, requested RCS force, requested main throttle, fuel estimate, candidate choice, and arrival/hold status.
- The player HUD context panel includes compact Navigation Computer status for target, distance, relative speed, phase, active segment, autopilot state, obstacle/avoidance state, ETA, and main/RCS request summary. Warning chips surface `NO TARGET`, `NO AUTHORITY`, `FUEL INSUFFICIENT`, `OBSTACLE`, `AVOIDANCE`, `LIMITED RCS`, and `HOLDING` without duplicating assist labels.
- The debug console has structured Navigation Computer sections for plan summary, candidate scores, current segment, obstacle detection, actuator requests, fuel/burn estimate, and test scenario controls. Test-scenario spawning stays in debug UI only.
- `PrototypeMinimapOverlay` marks navigation obstacles, draws the direct line as blocked/clear, draws predicted route segments, shows the current avoidance waypoint, visualizes obstacle clearance circles, and exposes a toggle for the bounded trajectory preview layer.
- `PrototypeMomentumAssist` exposes a physical Kill Momentum action. The player HUD button activates Idle/Complete/Aborted assist states, aborts while assist is active, and disables itself for NoAuthority or FuelInsufficient. The assist commands existing main/RCS/SAS paths; it is not a debug velocity reset.
- The Weapon Computer can select registered targets, choose priority, and toggle Auto Fire. Auto Fire continuously slews the visible Blender turret toward the active target and fires only when the turret is in arc, in range, off cooldown, and aligned within the prototype tolerance. Status labels include no target, aligning, in arc, out of arc, cooldown, no muzzle, and no authority.

## Navigation Computer And Camera Anchor

- `PrototypeNavigationObstacle` marks autopilot-blocking hazards with radius, clearance, display name, and gizmos. Radius falls back to collider or renderer bounds when no explicit radius is set, and active obstacles register for deterministic detector fallback.
- `PrototypeObstacleDetector` uses start-overlap checks plus SphereCast for collider-backed obstacles, detects trigger obstacles, filters non-blocking hazards, chooses the nearest blocking obstacle, and keeps a geometric line/sphere fallback for `PrototypeNavigationObstacle` components without colliders. It ignores the ship's own colliders and reports hit point, normal, distance, clearance, obstacle label, and avoidance direction.
- `PrototypeTrajectoryPlanner` scores candidate directions (`direct`, `left`, `right`, `up`, `down`, and diagonal variants) for collision clearance, delta-v, heading change, lateral damping, fuel, brake feasibility, and RCS authority. The selected direct profile can use analytic DirectFastTransfer (`ProgradeBurn -> FlipToRetrograde -> RetrogradeBurn -> Hold`) when lateral correction is feasible with available RCS authority; otherwise legacy `Align/Burn/Coast/RetrogradeBurn/FinalApproach/Hold` fallback remains.
- `plannedSwitchDistanceMeters` is carried on each trajectory segment for diagnostics and traceability and is not currently used as a hard switching control gate.
- `PrototypeWaypointAutopilot` now treats the executable `PrototypeFlightPlan` as the normal autopilot authority. The player planner, minimap preview, and executor all read the same predicted samples and maneuver segments. Strict execution is enabled by default: if the plan is invalid, geometrically inconsistent, expired, or diverges from the real Rigidbody state, the autopilot marks a visible replan reason and computes a new plan from the current state instead of silently falling back to a legacy live burn.
- The Navigation Planner body shows a compact step schedule from the current flight plan: each row includes `T+start-end`, the maneuver label, actuator mode (`MAIN`, `RCS`, `COAST`, `HOLD`, or combined), expected delta-v, and expected fuel. It also shows plan id/revision, active segment/sample, tracking error, cross-track error, velocity error, desired acceleration, RCS request, and replan status so the displayed route can be compared with the running executor.
- `PrototypeTrajectoryPreviewNavMap` is a small player-facing preview source over the existing predictor, gravity, burn-plan, autopilot route, HUD, and minimap paths. It clamps step count and point count, filters non-finite points, reports disabled/unavailable/empty/valid/truncated status, and draws a distinct preview route without becoming an orbital map.
- The autopilot tracks v2 navigation phases: Direct, AvoidancePlanning, Avoiding, ReacquireDirectPath, Brake, FinalApproach, and Hold. A stable avoidance waypoint prevents left/right oscillation until clearance and line of sight allow reacquire.
- RCS trajectory requests are force-based and mass-scaled. Lateral correction uses `desiredAcceleration * rb.mass`, then clamps to available RCS translation authority instead of using a fixed normalized force.
- Arrival uses distance plus full relative speed and lateral speed limits. It no longer requires `closingSpeed >= 0`, so a ship that is slightly drifting away inside the arrival envelope can still enter hold if relative velocity is low enough.
- Hold dampens small residual velocity with RCS for a confirmation window before completion.
- `PrototypeCameraAnchor` separates semantic camera focus from visual bounds. The focus prefers the highest-priority anchor, then Rigidbody center of mass, then visual bounds, then target position. Visual bounds still control fit distance and safe zoom.
- `SimpleFollowCamera` caches visual bounds and only refreshes the renderer list when the target is bound, reframed, visually switched, or explicitly dirtied. `ChaseLocked` stays on the anchor/COM/target flight focus, while visual bounds affect distance and safe zoom.
- Camera bounds exclude VFX, muzzle flash, weapon clearance/arc markers, debug labels/rings/markers, and objects tagged with `PrototypeIgnoreCameraBounds` so helper visuals do not inflate framing.
- `SimpleFollowCamera` exposes focus source, focus point, visual-bounds center/radius, visual center offset from COM, bounds refresh count, effective distance, zoom, target name, and bounds availability. Reframing changes distance but does not move focus away from the anchor/COM.
- `PrototypeBootstrap` ensures a camera anchor on the prototype ship, keeps exactly one active main camera, rebinds HUD/debug/minimap/follow camera after rebuilds, and snaps/reframes the follow camera to the active ship.
- `PrototypeShipVisualSwitcher_Manager` may live at the origin as a non-rendered/non-physical manager only. Imported ship instances remain under `PrototypeShip/ImportedShipVisual`; switching to an imported mode re-runs the functional binder so visible nozzles, muzzle, and turret pivots match gameplay.
- The default `PrototypeShipBuildMode` is `ImportedDemoScoutFunctionalDefault`. `PrototypeFunctionalShipBinder` loads the Blender scout, infers socket components, binds main thrusters, RCS nozzles, engine VFX, gun muzzle, muzzle flash marker, turret pivots, and Weapon Computer ownership on the `PrototypeShip` root. `GeneratedPrimitiveFallback` remains available for missing-asset/debug cases.
- `PrototypeShipHardpointBinder` now turns imported `CONN_*`/hardpoint sockets and generated fallback connector sockets into idempotent runtime `PrototypeShipHardpoint` records. The binder reports found, bound, created, duplicate, and warning counts so builder-facing hardpoints are visible without hardcoded demo hierarchy paths.

## Prototype Test Environment

- `PrototypeBootstrap` can generate a `PrototypeEnvironment` root each time the prototype is rebuilt. Rebuild clears the previous generated root first so the test range does not duplicate.
- The environment is generated only from Unity primitives, LineRenderer rings/axes, simple materials, lights, and TextMesh labels. No external asset pack is required. Its default display mode favors a Training-style readable view instead of full debug clutter.
- The generated test range includes an origin beacon, color-coded X/Y/Z axes, 100 m / 250 m / 500 m / 1000 m range rings, multiple target dummies, navigation beacons, approach gates, a station/hangar placeholder, and a non-damaging asteroid field that can also be detected as Navigation Computer obstacles.
- Targets use the existing `PrototypeTargetDummy` hit-feedback component. Beacons, gates, station, and obstacles are orientation landmarks for manual flight, RCS translation, minimap testing, and future waypoint/autopilot work. Large gate/range labels stay reduced or hidden unless fuller diagnostics are requested.

## Prototype Values

- `PrototypeBootstrap` can optionally reference a `PrototypeShipConfig` ScriptableObject for prototype tuning. Leave it unassigned to keep the built-in default ship values.
- Create a config from `Assets > Create > Prototype > Ship Config` to tune fuel, dry masses, main thruster force/mode/gimbal response, RCS thrust/selection values, projectile speed/fire rate/lifetime/scale/mass/recoil, and camera distance/height.
- This config is only a prototype tuning container. It does not add a ship editor, inventory, save/load, or final module architecture.
- `PrototypeShipBlueprint` is the first prototype-only data model for generated modular ships. It defines reusable module definitions plus positioned module instances, validates the required cockpit/fuel/main/RCS/gun categories, and converts valid blueprints into the existing `PrototypeShipVariant` and `PrototypeShipLayout` runtime path.
- Built-in blueprint samples are available as generated variants: Scout Blueprint and Hauler Blueprint. They are data-driven test ships rather than final player inventory; switching the bootstrap to `GeneratedPrimitiveFallback` lets the samples spawn with mass, COM, fuel, thrust, RCS, and weapon values derived from their installed parts.
- Fuel is stored as kilograms and contributes to the generated fuel-tank module mass.
- Full main thrust consumes `0.6 kg/s`, scales with throttle, and the final partial-fuel step applies only the covered thrust fraction.
- A configured fuel rate of zero means fuel-free thrust; fuel-consuming thrusters stop only when they request fuel and no fuel is available.
- RCS consumes fuel from the final bounded nozzle allocator output, so combined translation/attitude commands charge each nozzle once after allocation.
- The default ship is the Blender Demo Scout with functional sockets. The generated ship is a fallback elongated module craft with a visible cube-like main gimbal module and four side-centered RCS blocks.
- Main-thruster mode defaults to `ComSafeSteeringOnly`: straight thrust is applied through center of mass, and only gimbal steering force is applied at the offset nozzle for intentional torque telemetry.
- `FullyPhysicalNozzleForce` can be selected for experiments; it applies the full gimballed main-engine force at the nozzle position and can create torque from nozzle/COM offsets.
- Main-thruster gimbal support now defaults to a calmer 10 degree hard limit, 0.14 response scalar, and 30 degrees-per-second slew. `GimbalAssistMode` defaults to `AutopilotOnly`, while Off, Low, Manual, and ExperimentalFull remain available from debug tuning.
- Control Mode is the gameplay-facing flight model switch. Cruise allows main-thruster control and throttle input. Precision and Translation force RCS available, force main thruster/gimbal commands to zero, and use RCS attitude (Precision) or RCS translation (Translation). They ignore Shift/Ctrl throttle input and keep main throttle at zero until the pilot or autopilot explicitly commands Cruise thrust again.
- Each RCS block has five installed nozzle transforms, excluding the side that faces into the ship wall. RCS translation, attitude, and SAS use actual nozzle positions/directions rather than hardcoded slots.
- Generated module proxies now carry simple damage state. Damaged RCS blocks scale their effective thrust through the existing RCS allocator, so physical authority falls with module integrity.
- SAS has `KillRotation` and `HoldAttitude` modes. It creates a ship-local PD torque request from angular velocity and optional target attitude, then sends that request through the same RCS nozzle allocator as manual attitude.
- SAS exposes proportional and derivative gains on `RcsThrusterController`. Manual pitch, yaw, or roll input masks SAS on that same axis while released axes continue to stabilize.
- Flight assist is an explicit request layer with `Simulation`, `AssistedFlight`, and `DebugAssist` modes. Simulation mode sends no assist force or torque, assisted requests must go through the RCS allocator and `ShipPhysicsCore`, and debug-only requests are labeled so they cannot masquerade as physical flight. Momentum Assist adds a `MomentumAssist` request source for Kill Momentum so braking stays visible and physical.
- Waypoint navigation creates three visible primitive targets at runtime. `Tab` and `B` cycle them, and `G` toggles a conservative autopilot that normalizes to Cruise mode, sends a `WaypointAutopilot` assist request, and combines main-throttle intent with RCS attitude/lateral correction when available.
- The waypoint autopilot estimates stopping distance from current closing speed and conservative deceleration. It now evaluates candidate trajectories around detected obstacles, accounts for initial/lateral velocity, and may refuse or limit a route with `FuelInsufficient`, `NoAuthority`, `LimitedRcsAuthority`, `HoldNoAuthority`, or `LimitedHoldAuthority` instead of pretending the ship can arrive.
- Arrival requires distance, full relative speed, lateral speed, and a hold confirmation window. Near the target it transitions through Direct/Avoidance/Reacquire/Brake/FinalApproach/Hold diagnostics for transparent behavior, and completion requires a valid relative-speed/lateral-speed envelope.
- Final approach prefers low main throttle and RCS-based lateral correction when available. When RCS is unavailable or too weak, coarse main-burn/brake remains possible, precision completion is withheld, and diagnostics report the authority limit.
- `DockingPort` is a prototype docking data component. It reports world port frame data, relative state, eligibility diagnostics, bounded soft-capture `FlightAssistRequest` values, and a hard-lock placeholder that only requests lock after distance, angle, and velocity checks pass.
- `PrototypeDockingApproachAssist` binds a source `DockingPort` and selectable target ports without relying on demo hierarchy paths. The bootstrap creates a simple component-backed approach target when no external port exists, the player HUD reports target/distance/closing speed/lateral offset/alignment/readiness, and eligible soft-capture requests are routed through `PlayerShipController.SetExternalFlightAssistRequest` as bounded physical Docking assist. Hard lock remains a placeholder and is not shown as completed docking.
- Built-in debug variants are available through the flight debug console: Baseline Balanced, Dual Main Thruster, Off-Center Main Thruster, One-Sided RCS, Heavy Cargo, No-RCS, Scout Blueprint, and Hauler Blueprint. These variants are generated test rigs for physics behavior, not a final ship editor.
- Generated primitive modules use a higher-contrast role palette so hull, cockpit, fuel tanks, engines, RCS blocks, guns, cargo/utility, target markers, and orientation markers are easier to tell apart during tests. Cockpit, fuel, main engine, RCS, gun, and cargo roles are intentionally distinct primitives, not final art assets.
- Generated modules now build through `PrototypeShipPartVisualFactory` via lightweight metadata (`partId`, `category`, `massRole`, `visualArchetype`) and reusable part archetypes (`CockpitWedge`, `HullCore`, `FuelTankPod`, `MainEngineBell`, `RcsPod`, `GunMount`, `CargoBox`, `UtilityBlock`, etc.), so connector/hardpoint placeholders can be migrated into a builder-ready pipeline later.
- Active imported RCS nozzles show VFX only at `RCS_NOZZLE_*` sockets. `RcsThrusterController` recognizes `VFX`, `PreviewRcsThrusterVfx`, and `RcsThrusterVfx` children. The main thruster VFX is configured on imported `THRUST_NOZZLE_MAIN*`; the normal imported path does not create a root `EngineNozzle` fallback.
- The no-hardcoded-position rule is intentional: moving/removing an `RCS_Nozzle_*` transform changes solver output, and missing nozzles create no phantom force.
- The RCS toggle gates RCS force application and VFX.
- Ship-level force application now routes through a thin `ShipPhysicsCore`. Main thrusters and RCS still own their current behavior, but final Rigidbody force calls and net force/torque diagnostics have a central path.
- The debug overlay reports fuel mass, main/RCS fuel request, actual fuel used, fuel fraction, and RCS allocator throttle totals. The physics model is documented in [docs/physics-flight-model.md](docs/physics-flight-model.md).
- Projectile velocity is the ship Rigidbody velocity plus the real weapon muzzle forward velocity. In the imported default path, `WEAPON_MUZZLE_PRIMARY` and `WEAPON_MUZZLE_FLASH_PRIMARY` are required; no root `Muzzle` fallback is created.
- Projectile firing applies optional recoil impulse opposite the muzzle direction using configured projectile mass and projectile speed. Muzzle flash and tracer origins come from the imported turret muzzle/flash markers.
- Projectiles ignore the firing ship's colliders and sweep their previous-to-current physics travel with sphere/raycast checks for fast target hits.
- Projectile hits populate impact event data with hit point, normal, relative velocity, impulse estimate, and module hit. Module damage and optional target impact impulse route through the same prototype physics diagnostics.
- Projectile lifetime defaults to 3 seconds.
- `PrototypePveArenaLoop` adds a bounded v0 PvE loop at startup. It creates at least three deterministic arena targets using the existing target marker, target dummy, registry, and `PrototypeModuleDamageState` damage path, tracks completion from destroyed target health, exposes progress/reward-stub status to the player HUD, and can be reset/replayed through `PrototypeBootstrap.ResetPveArena()`.

## Optional Asset Policy

Optional CC0 assets, such as local low-poly ships or Kenney packs, may be considered later for polish only. They must not become required for this prototype, and any import should stay small and reversible.

## Known Limits

- This is not the final ship editor or gameplay architecture.
- Camera framing targets `PrototypeCameraAnchor` or Rigidbody COM for semantic focus. Visible active child `Renderer` bounds are used for distance/fit safety, not for shifting the semantic focus when an anchor/COM exists.
- `V` cycles camera framing modes `ChaseLocked -> OrbitInspect -> Side -> FreeInspect -> ChaseLocked`, and camera distance can be adjusted continuously via scroll or debug controls.
- SAS is a local PD torque controller routed through RCS, not a full flight computer or hidden angular damping layer.
- Flight assist does not use hidden Rigidbody damping. Physical assist requests are allocator-limited; debug-only helpers are diagnostics/testing aids only.
- The Navigation Computer and trajectory preview are still local-space prototype guidance, not an orbital navigator, full map UI, docking planner, slingshot planner, patched-conic/SOI planner, or full maneuver-node planner. They do not use hidden teleporting or direct Rigidbody velocity writes during runtime navigation, and validation uses deterministic prototype rigs rather than final ship AI.
- Manual throttle, attitude, or RCS input aborts waypoint autopilot and active momentum assist where that assist is not deliberately in a hold/status state, returning control to the pilot.
- Docking hard lock is currently a documented placeholder rather than an active joint. It is gated by docking constraints so later joint work can reuse the same diagnostics.
- RCS allocation is a prototype bounded allocator, not a final optimizer, but it is transform-based and uses real lever arms around COM.
- Deferred physics-core slices include additional SAS/autopilot modes, docking, deeper damage effects, and higher-fidelity trajectory planning beyond the current bounded preview.
- Full armor balance, part detachment, visual destruction, and combat economy are out of scope.
- The PvE arena loop is intentionally a small prototype objective controller, not a mission framework, multiplayer mode, persistent economy, or advanced enemy AI layer.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
