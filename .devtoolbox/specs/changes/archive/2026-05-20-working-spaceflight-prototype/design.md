# Design: Working Spaceflight Prototype

## Engine and Rendering

Use Unity 6000.4.7f1 with the Universal Render Pipeline already present in the project. URP is selected because the project targets a low-poly placeholder style and needs only standard rendering features such as simple materials, trails, particles, emissive colors, lights, and basic post-processing compatibility.

HDRP is intentionally avoided because it adds rendering complexity, heavier setup, and production-art assumptions that are not needed for this prototype.

All Unity Editor, scene, asset, import, compile, and play-mode operations must be performed through Unity MCP. Shell commands may be used only for non-Unity repo inspection and DevToolbox spec files. If Unity MCP is unavailable, implementation pauses and the blocker is documented.

## Placeholder and Asset Strategy

The first playable prototype must be generated from Unity primitives so it has no external asset dependency and stays easy to reset. The placeholder modules should communicate the intended modular ship fantasy without introducing a real ship editor.

Local downloaded CC0 assets under `E:\Unity\Assets` may be used only as optional polish after the primitive version works. Known useful candidates are Majadroid low-poly spaceships and Kenney space/blaster/weapon packs, but they must not become required for the acceptance criteria in this change.

## Scene Model

The prototype should run from a nearly empty scene using a bootstrap component. The bootstrap creates or verifies:

- Player ship root object
- Rigidbody with gravity disabled
- Placeholder ship modules
- Camera with follow behavior
- Directional light
- Simple orientation markers or reference objects
- Debug overlay

The bootstrap should avoid serialized scene dependencies where practical. This keeps the prototype startable from a blank scene and prevents early scene-authoring churn.

## Ship Model

The ship is not editable in this phase. It is assembled by code from placeholder modules:

- Cockpit
- Hull
- FuelTank
- Engine
- Gun

Each module contributes to the intended mass model. The implementation may store masses in `ShipStats` and set the Rigidbody mass to the total dry mass plus current fuel. Initial values:

| Value | Default |
| --- | ---: |
| Cockpit mass | 800 kg |
| Hull mass | 1000 kg |
| FuelTank dry mass | 400 kg |
| Engine mass | 700 kg |
| Gun mass | 250 kg |
| Initial fuel | 300 kg |
| Max fuel | 300 kg |
| Thrust | 45000 N |
| Fuel consumption | 0.6 kg/s at full throttle |
| Projectile speed | 1500 m/s relative to ship |
| Fire rate | 4 shots per second |
| Projectile lifetime | 3 seconds |
| Camera distance | 10 to 15 m |
| Camera height | 3 to 5 m |

## PlayerShip Components

The minimal runtime component layout should be:

- `ShipStats` owns tunable physical and gameplay values plus current fuel.
- `PlayerShipController` reads input, applies Rigidbody thrust and rotation, and exposes current throttle/acceleration state.
- `GunModule` handles fire timing and projectile spawn velocity.
- `EngineVfxController` visualizes current thrust.
- `PrototypeDebugOverlay` renders speed, fuel, mass, thrust, and acceleration.
- `SimpleFollowCamera` follows the ship with stable offset.

This is intentionally a prototype component set, not a final domain architecture.

## Flight Model

Use a Rigidbody with `useGravity = false`. Forward thrust is applied using the ship transform's forward direction and `ForceMode.Force` or an equivalent physics-safe mode. The ship should drift when thrust is not applied.

Rotation may be simplified for playability. Mouse X/Y controls yaw/pitch, Q/E controls roll, and optional brake/stabilize may damp velocity when implemented. The model should favor understandable feel over realism.

## Fuel Model

Fuel is consumed only while main thrust is active. Consumption is linear with throttle. When fuel is zero, main thrust must not apply force. Refuel input can reset current fuel to max fuel for rapid testing.

The Rigidbody mass should include current fuel when practical so the debug mass value is meaningful. If updating mass every frame creates instability, document the chosen simplification in README.

## Projectile Model

Projectiles are visible objects with finite lifetime and are not instant-hit weapons. The gun computes initial projectile velocity with:

```text
projectileVelocity = shipVelocity + shipForward * projectileSpeed
```

Projectile collision and damage are optional and not required. High projectile speed may make collision unreliable, which is acceptable in this prototype because hit detection is out of scope.

## VFX Model

Engine and projectile effects use URP-compatible Unity standard features:

- Engine: ParticleSystem, small emissive primitive, optional point light, or a flickering cone/cube.
- Projectile: small mesh, emissive material, TrailRenderer, and optional light.
- Explosion: optional minimal particle burst or light flash only; no damage system.

## Input Strategy

Keyboard and mouse are required. Use direct Unity Input System polling with null checks around `Keyboard.current`, `Mouse.current`, and `Gamepad.current`.

Required keyboard/mouse mapping:

- W or Left Shift: main thrust
- S: optional reverse/brake thrust
- Mouse X/Y: yaw and pitch
- Q/E: roll
- Left mouse button or Space: fire
- R: refill fuel
- T: reset velocity
- X: optional stabilize/brake

Controller mapping is attempted if a gamepad is available:

- Right Trigger: main thrust
- Left Trigger: brake or stabilize
- Stick: rotation
- Button: fire

If controller behavior cannot be verified through Unity MCP, document it as a known limitation and leave a follow-up task.

## Debug Overlay

The debug overlay should be intentionally simple and always available during the prototype. It must show:

- Fuel current and max
- Speed in m/s
- Speed in km/h
- Rigidbody mass
- Current thrust
- Approximate acceleration

IMGUI is acceptable for this prototype because the overlay is temporary debug UI and avoids unnecessary UI architecture.

## Technical Risks

- Unity MCP may not be available in the current agent session; implementation must pause instead of bypassing the MCP rule.
- High projectile speed can make collisions unreliable; collision is not part of acceptance.
- Controller mapping depends on connected hardware and Input System project settings.
- Unity scene generation is safest through a bootstrap rather than serialized scene edits.
- Imported external assets can create noisy metadata; keep them optional and out of the core acceptance path.
- Existing dirty Unity settings in the working tree must be preserved and not normalized accidentally.