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
| `X` / `Y` | Cut throttle / full throttle |
| `Space` | Fire the current main gun |
| `R` | Toggle RCS on/off |
| `H` / `N` | RCS translate forward / backward |
| `I` / `K` | RCS translate down / up |
| `J` / `L` | RCS translate left / right |
| `T` | Toggle SAS angular stabilization |
| Hold `F` | Temporarily invert effective SAS state |
| `Caps Lock` | Toggle precision controls for reduced attitude and RCS strength |
| `V` | Cycle the prepared follow-camera mode |
| Backquote | Reset camera framing |
| `Backspace` | Debug-only refill fuel |
| `M` | Reserved; no action in this prototype |

Mouse movement is reserved for the camera. Hold right mouse button to orbit/look around the ship; mouse input does not feed ship attitude.

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

- Fuel is stored as kilograms.
- Full main thrust consumes `0.6 kg/s`.
- Main thrust stops when fuel reaches zero.
- Main thrusters fire continuously according to the current throttle percentage while fuel is available.
- The generated ship is a larger elongated module craft with a visible cube-like main gimbal module and four side-centered RCS blocks.
- Main-thruster straight thrust is applied through center of mass; only gimbal steering force is applied at the offset nozzle and contributes intentional torque telemetry.
- Main-thruster gimbal support keeps a 20 degree hard limit, while the default response scalar uses a softer 0.35 keyboard command. The visible gimbal cube and the physics force vector use the same effective command.
- Each RCS block has five installed nozzle transforms, excluding the side that faces into the ship wall. RCS translation, attitude, and SAS use actual nozzle positions/directions rather than hardcoded slots.
- Active RCS nozzles show green debug VFX. The main thruster keeps its separate orange particle effect.
- The no-hardcoded-position rule is intentional: moving/removing an `RCS_Nozzle_*` transform changes solver output, and missing nozzles create no phantom force.
- The RCS toggle gates RCS force application and VFX.
- The physics model is documented in [docs/physics-flight-model.md](docs/physics-flight-model.md).
- Projectile velocity is the ship Rigidbody velocity plus muzzle forward velocity.
- Projectile lifetime defaults to 3 seconds.

## Optional Asset Policy

Optional CC0 assets, such as local low-poly ships or Kenney packs, may be considered later for polish only. They must not become required for this prototype, and any import should stay small and reversible.

## Known Limits

- This is not the final ship editor or gameplay architecture.
- The camera mode cycle is intentionally minimal and only switches between prepared follow offsets/orbit baselines.
- SAS is a simple RCS angular counter-command, not a full flight computer.
- RCS nozzle selection is prototype-simple, but it is transform-based and uses real lever arms around COM.
- Projectile damage and reliable high-speed collision are out of scope.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
