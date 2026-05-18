# working-spaceflight-prototype

## Why

StarshipForgePrototype needs a small playable prototype before committing to the larger long-term architecture. The goal is to validate the basic feel and technical feasibility of zero-gravity ship flight, fuel consumption, speed feedback, projectile weapons, and simple placeholder effects in Unity.

This change deliberately proves only the first playable slice. It should help decide whether the core loop of flying, spending fuel, reading speed, and firing visible shots feels promising enough for later specs.

## What

Build a minimal Unity/URP prototype with a placeholder modular ship made from generated primitives. The ship can fly in zero gravity, consume fuel while thrusting, display speed and fuel debug values, and fire visible non-instant projectiles.

Included features:

- A prototype can start from an empty or nearly empty Unity scene.
- A bootstrap creates the player ship, camera, light, orientation markers, debug overlay, and placeholder visuals when needed.
- The ship is visibly composed of Cockpit, Hull, FuelTank, Engine, and Gun placeholder modules.
- Rigidbody-based space flight with gravity disabled.
- Mouse and keyboard controls for thrust, rotation, roll, firing, refuel, and velocity reset.
- Controller support is attempted through the Unity Input System when available, or documented as a follow-up limitation.
- Fuel decreases while main thrust is active and prevents main thrust when empty.
- Speed is shown in meters per second and kilometers per hour.
- A gun fires visible projectiles with finite lifetime.
- Projectile velocity is calculated as `shipVelocity + shipForward * projectileSpeed`.
- Engine and projectile placeholder VFX are visible using URP-compatible standard Unity features.
- README explains setup, controls, and known limitations.

## Out of Scope

- Open world
- Multiplayer
- Real ship editor
- Inventory
- Crafting
- Planets
- Cities
- Persistence
- Savegames
- Final 3D assets
- Final architecture for the complete game
- Complex shaders
- Online services
- Damage systems or required hit detection
- Asset Store import workflow
- Blender workflow

## Asset Policy

The core prototype must run using generated Unity primitives and must not require external asset packs. Local downloaded CC0 assets under `E:\Unity\Assets`, such as Majadroid low-poly spaceships or Kenney packs, may be referenced or used only as optional polish in a later implementation task if Unity MCP is available and the import remains small and reversible.

## Success Criteria

Functional acceptance criteria:

- Press Play in a prototype scene or an empty scene with the bootstrap present.
- The ship appears and the camera follows it.
- The ship visibly contains Cockpit, Hull, FuelTank, Engine, and Gun placeholder modules.
- Gravity is disabled on the ship Rigidbody.
- Mouse and keyboard controls work.
- Controller support either works or is explicitly documented as not completed in this slice.
- Main thrust accelerates the ship forward.
- Fuel decreases proportionally while thrusting.
- Main thrust is blocked when fuel reaches zero.
- Speed and fuel values are visible.
- Mass, thrust, and acceleration are visible in the debug overlay.
- The gun fires visible, non-instant projectiles.
- Projectiles add current ship velocity to muzzle velocity.
- Projectiles are destroyed after their lifetime.
- Engine VFX is visible.
- Projectile trail or glow is visible.
- README documents setup, controls, and known limitations.

Non-functional acceptance criteria:

- Code is intentionally simple but organized.
- No overengineering or final game architecture is introduced.
- Prototype values are Inspector-tunable where practical.
- No external asset packs are required.
- No UnityEngine-free core library is forced in this phase.
- The prototype stays quick to test.

## Stop Point

After this spec change is created and validated, report the spec result before implementation. Unity-specific operations must use Unity MCP. If Unity MCP is unavailable, implementation must pause rather than using shell or direct file mutation as a substitute for Unity Editor operations.