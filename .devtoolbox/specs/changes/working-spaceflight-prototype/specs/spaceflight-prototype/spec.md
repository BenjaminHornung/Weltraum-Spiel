# Spaceflight Prototype Specification

## ADDED Requirements

### Requirement: Prototype starts from an empty or nearly empty scene

The prototype SHALL be startable from an empty or nearly empty Unity scene by adding or running a bootstrap component.

#### Scenario: Bootstrap creates missing runtime objects

- GIVEN the scene does not already contain the prototype ship, camera, light, or debug overlay
- WHEN the prototype bootstrap runs
- THEN it creates the player ship, camera, light, orientation references, engine VFX, gun, and debug overlay needed to play the prototype

#### Scenario: Bootstrap avoids external asset dependencies

- GIVEN no downloaded asset packs have been imported into the Unity project
- WHEN the prototype bootstrap runs
- THEN the playable prototype still starts using generated Unity primitives

### Requirement: Player ship is visibly modular

The prototype SHALL show a placeholder ship assembled from distinct visible modules named or arranged as Cockpit, Hull, FuelTank, Engine, and Gun.

#### Scenario: Ship modules are visible in play mode

- GIVEN the prototype has started
- WHEN the player views the ship
- THEN the ship contains visibly distinct Cockpit, Hull, FuelTank, Engine, and Gun placeholder modules

#### Scenario: Placeholder modules remain the core acceptance path

- GIVEN optional CC0 assets are available outside the project under `E:\Unity\Assets`
- WHEN the prototype is implemented
- THEN those assets may be used only as optional polish and are not required for the modular placeholder ship acceptance criteria

### Requirement: Ship uses Rigidbody-based zero-gravity flight

The ship SHALL use a Rigidbody-based flight model with gravity disabled.

#### Scenario: Gravity is disabled

- GIVEN the player ship exists
- WHEN its Rigidbody is initialized
- THEN `useGravity` is false

#### Scenario: Main thrust accelerates forward

- GIVEN the ship has fuel
- WHEN the player applies main thrust
- THEN force is applied in the ship forward direction and the ship accelerates forward

#### Scenario: Ship drifts without thrust

- GIVEN the ship has velocity
- WHEN the player releases main thrust
- THEN the ship continues drifting instead of stopping immediately

### Requirement: Fuel gates main thrust

The prototype SHALL consume fuel linearly while main thrust is active and SHALL prevent main thrust when fuel is empty.

#### Scenario: Fuel decreases while thrusting

- GIVEN the ship has fuel
- WHEN the player applies full main thrust for one second
- THEN current fuel decreases by approximately the configured full-throttle consumption rate

#### Scenario: Empty fuel prevents thrust

- GIVEN current fuel is zero
- WHEN the player applies main thrust
- THEN no main forward thrust is applied

#### Scenario: Refuel supports rapid testing

- GIVEN current fuel is below max fuel
- WHEN the player presses the refuel input
- THEN current fuel is restored to max fuel

### Requirement: Speed and debug values are visible

The prototype SHALL display runtime debug values for fuel, speed, mass, thrust, and acceleration.

#### Scenario: Speed is shown in two units

- GIVEN the ship has a Rigidbody
- WHEN the debug overlay renders
- THEN speed is shown in meters per second and kilometers per hour

#### Scenario: Flight stats are shown

- GIVEN the prototype is running
- WHEN the debug overlay renders
- THEN it shows fuel, Rigidbody mass, current thrust, and approximate acceleration

### Requirement: Keyboard and mouse controls are playable

The prototype SHALL support mouse and keyboard controls for the first playable slice.

#### Scenario: Main keyboard and mouse controls are available

- GIVEN keyboard and mouse devices are available through the Unity Input System
- WHEN the player uses W or Left Shift, mouse movement, Q/E, left mouse button or Space, R, and T
- THEN the ship can thrust, rotate, roll, fire, refuel, and reset velocity

#### Scenario: Input polling handles missing devices

- GIVEN a keyboard, mouse, or gamepad device is not available
- WHEN input is read
- THEN the prototype handles the missing device with null checks instead of throwing runtime exceptions

### Requirement: Controller support is attempted or documented

The prototype SHALL attempt controller support through the Unity Input System when a gamepad is available, or explicitly document remaining controller limitations.

#### Scenario: Gamepad is available

- GIVEN `Gamepad.current` is available
- WHEN the player uses right trigger, left trigger, stick, and a fire button
- THEN the prototype maps them to thrust, brake or stabilize, rotation, and fire where practical

#### Scenario: Gamepad behavior cannot be verified

- GIVEN no Unity MCP or no gamepad verification path is available
- WHEN the implementation is completed
- THEN README and tasks document controller support as unverified or follow-up work

### Requirement: Gun fires visible projectiles

The prototype SHALL fire visible non-instant projectiles with finite lifetime.

#### Scenario: Fire input spawns a projectile

- GIVEN the gun fire cooldown allows another shot
- WHEN the player presses fire
- THEN a visible projectile object is spawned from the gun muzzle

#### Scenario: Projectile velocity includes ship velocity

- GIVEN the ship has current Rigidbody velocity
- WHEN the gun fires a projectile
- THEN projectile velocity is calculated as `shipVelocity + shipForward * projectileSpeed`

#### Scenario: Projectile lifetime destroys projectile

- GIVEN a projectile has existed for its configured lifetime
- WHEN the lifetime expires
- THEN the projectile object is destroyed

### Requirement: Placeholder VFX are visible

The prototype SHALL include simple visible URP-compatible placeholder VFX for engine thrust and projectiles.

#### Scenario: Engine VFX responds to thrust

- GIVEN the player applies main thrust
- WHEN engine VFX updates
- THEN a visible particle, emissive primitive, light, or equivalent placeholder effect appears or intensifies near the engine

#### Scenario: Projectile VFX makes shots readable

- GIVEN a projectile is spawned
- WHEN it travels through the scene
- THEN it has a visible mesh plus trail, glow, light, or equivalent placeholder effect

### Requirement: README documents prototype use

The project README SHALL document how to run the prototype, controls, known limitations, and optional asset policy.

#### Scenario: README explains setup and controls

- GIVEN implementation is complete
- WHEN a developer opens README.md
- THEN it explains Unity version, URP expectation, how to start the prototype, keyboard/mouse controls, controller status, and known limitations

### Requirement: Prototype stays intentionally small

The change SHALL avoid overengineering and SHALL not introduce final game architecture or out-of-scope systems.

#### Scenario: Out-of-scope systems are not implemented

- GIVEN this change is implemented
- WHEN the changed files are reviewed
- THEN there is no open world, multiplayer, ship editor, inventory, crafting, planets, cities, persistence, savegame, online service, complex shader, or final domain architecture

#### Scenario: Inspector-tunable values remain simple

- GIVEN the prototype scripts are attached to runtime objects
- WHEN a developer inspects them in Unity
- THEN core values such as masses, fuel, thrust, fire rate, projectile speed, projectile lifetime, and camera offset are configurable where practical

### Requirement: Unity operations use Unity MCP

All Unity Editor, asset, scene, script creation under `Assets`, compile, and play-mode operations SHALL use Unity MCP for this change.

#### Scenario: Unity MCP is unavailable

- GIVEN Unity MCP is not exposed in the agent session
- WHEN implementation would require Unity project or scene mutation
- THEN implementation pauses and reports the blocker rather than substituting shell Unity commands or direct file edits for Unity operations
