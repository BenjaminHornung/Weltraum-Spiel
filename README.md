# Working Spaceflight Prototype

This Unity prototype is a generated-primitives-only playable slice for testing zero-gravity ship movement, fuel use, speed feedback, projectiles, transform-driven RCS, and placeholder VFX.

## Setup

- Open the project in Unity 6000.4.7f1 or newer in the Unity 6 line.
- Load `Assets/Scenes/PrototypeBootstrapHost.unity`, or press Play from an empty/nearly empty scene. `PrototypeBootstrap` creates the prototype objects at runtime when needed.
- No external asset pack is required. The ship, orientation markers, engine effect, and projectiles are generated from Unity primitives and built-in components.

## Controls

| Key | Action |
| --- | --- |
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
- SAS has `KillRotation` and `HoldAttitude` modes. It creates a ship-local PD torque request from angular velocity and optional target attitude, then sends that request through the same RCS nozzle allocator as manual attitude.
- SAS exposes proportional and derivative gains on `RcsThrusterController`. Manual pitch, yaw, or roll input masks SAS on that same axis while released axes continue to stabilize.
- Active RCS nozzles show green debug VFX. The main thruster keeps its separate orange particle effect.
- The no-hardcoded-position rule is intentional: moving/removing an `RCS_Nozzle_*` transform changes solver output, and missing nozzles create no phantom force.
- The RCS toggle gates RCS force application and VFX.
- Ship-level force application now routes through a thin `ShipPhysicsCore`. Main thrusters and RCS still own their current behavior, but final Rigidbody force calls and net force/torque diagnostics have a central path.
- The debug overlay reports fuel mass, main/RCS fuel request, actual fuel used, fuel fraction, and RCS allocator throttle totals. The physics model is documented in [docs/physics-flight-model.md](docs/physics-flight-model.md).
- Projectile velocity is the ship Rigidbody velocity plus muzzle forward velocity.
- Projectile firing applies optional recoil impulse opposite the muzzle direction using configured projectile mass and projectile speed.
- Projectiles ignore the firing ship's colliders and sweep their previous-to-current physics travel with sphere/raycast checks for fast target hits.
- Projectile hit reports expose collider, Rigidbody, hit point, normal, incoming velocity, and sweep/collision source for future damage systems.
- Projectile lifetime defaults to 3 seconds.

## Optional Asset Policy

Optional CC0 assets, such as local low-poly ships or Kenney packs, may be considered later for polish only. They must not become required for this prototype, and any import should stay small and reversible.

## Known Limits

- This is not the final ship editor or gameplay architecture.
- The camera mode cycle is intentionally minimal and only switches between prepared follow offsets/orbit baselines.
- SAS is a local PD torque controller routed through RCS, not a full flight computer or hidden angular damping layer.
- RCS allocation is a prototype bounded allocator, not a final optimizer, but it is transform-based and uses real lever arms around COM.
- Deferred physics-core slices include additional SAS/autopilot modes, docking, damage, and trajectory prediction.
- Full projectile damage and combat balance are out of scope.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
