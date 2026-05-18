# Working Spaceflight Prototype

This Unity prototype is a generated-primitives-only playable slice for testing zero-gravity ship movement, fuel use, speed feedback, projectiles, and placeholder VFX.

## Setup

- Open the project in Unity 6000.4.7f1 or newer in the Unity 6 line.
- Load `Assets/Scenes/PrototypeBootstrapHost.unity`, or press Play from an empty/nearly empty scene. `PrototypeBootstrap` creates the prototype objects at runtime when needed.
- No external asset pack is required. The ship, orientation markers, engine effect, and projectiles are generated from Unity primitives and built-in components.

## Controls

- `W` or `Left Shift`: increase persistent main-thruster throttle toward 100%
- `S`: decrease persistent main-thruster throttle toward 0%; it is not reverse thrust and does not activate turnaround assist
- Mouse movement: yaw and pitch through RCS attitude control
- `A` / `D`: request left/right turning through installed RCS and, above 0% throttle, gimballed main thrust
- `Page Up` / `Page Down`: keyboard pitch fallback
- `Q` / `E`: roll
- Arrow keys or `I` / `J` / `K` / `L`: RCS translation up, left, down, and right
- Left mouse button or `Space`: fire
- `R`: refill fuel
- `T`: reset linear and angular velocity
- `X`: stabilize/brake

## Controller Status

Controller input is attempted through the Unity Input System when a gamepad is connected:

- Right trigger: increase persistent main-thruster throttle
- Left stick down: decrease persistent main-thruster throttle
- Left stick: best-effort RCS translation
- Right stick: yaw and pitch
- Shoulder buttons: roll
- South button: fire
- West button: refill fuel
- North button: reset velocity
- Left trigger or east button: stabilize/brake

This mapping has compile/play coverage only in this slice. Hardware feel and per-controller layout still need manual verification.

## Prototype Values

- Fuel is stored as kilograms.
- Full main thrust consumes `0.6 kg/s`.
- Main thrust stops when fuel reaches zero.
- Main thrusters fire continuously according to the current throttle percentage while fuel is available.
- Main-thruster gimbal support, gimbal limits, current gimbal command, applied force, and estimated torque are exposed on `MainThrusterModule`.
- RCS thrusters provide four-way local translation plus pitch, yaw, and roll authority using prototype force-at-position placement; they do not provide forward/back translation in this slice.
- The generated ship computes a prototype RCS control pivot from installed RCS thruster positions. This is a KSP-inspired approximation, not a full mass-tree or orbital simulation.
- Projectile velocity is the ship Rigidbody velocity plus muzzle forward velocity.
- Projectile lifetime defaults to 3 seconds.

## Optional Asset Policy

Optional CC0 assets, such as local low-poly ships or Kenney packs, may be considered later for polish only. They must not become required for this prototype, and any import should stay small and reversible.

## Known Limits

- This is not the final ship editor or gameplay architecture.
- Projectile damage and reliable high-speed collision are out of scope.
- IMGUI is used for the debug overlay because it is temporary prototype UI.
- Controller input has not been manually verified on physical hardware.
