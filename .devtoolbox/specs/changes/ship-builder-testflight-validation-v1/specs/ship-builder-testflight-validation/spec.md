# Spec: Ship Builder Test-Flight Validation

## Summary

This spec defines future Ship Builder test-flight validation and acceptance
requirements. It is planning/spec-only and does not create runtime code, tests,
scenes, UI, assets, prefabs, Blender files, FBX files, or runtime systems.

## Scope

In scope:

- Future test-flight path before activating a custom ship.
- Temporary ship rules.
- Acceptance categories and metrics for movement, RCS, weapons, camera, fuel,
  VFX, socket origins, and generated ship safety.
- Negative ship handling and debug-only override behavior.
- Art-independent acceptance criteria.

Out of scope:

- Runtime implementation.
- Unity tests, dotnet builds, scenes, assets, prefabs, `.unity`, `.prefab`,
  `.asset`, `.blend`, or `.fbx` files.
- Autopilot/harness changes.
- Existing ship builder runtime code changes.

## Requirements

### R1: Test-flight path before activation

The builder shall provide a future test-flight path before activating a custom
ship. The path shall run after builder data validation and before the player can
set a generated custom ship as the active ship.

### R2: Temporary test-flight ships

Test flight shall use temporary ships unless the player explicitly saves and
accepts the design. Fuel burn, damage, weapon fire, target hits, or cargo changes
inside test flight shall not automatically mutate the saved blueprint or active
variant in the MVP.

### R3: Builder validation gate

Negative ships shall be blocked before normal test flight when hard builder
validation errors exist. This includes missing cockpit/control core, missing main
thruster, no required RCS, no required fuel, disconnected required module, hard
overlap, invalid turret muzzle, invalid RCS nozzle direction, non-finite stats,
or negative critical values.

Debug mode may explicitly launch negative ships for diagnostics, but the result
shall be marked debug-only and shall not allow activation.

### R4: Known start conditions

Test flight shall start from known conditions: deterministic spawn position,
zero velocity, known fuel load, known cargo load, known control mode, known RCS
state, known SAS state, and known weapon/target state for combat scenarios.

### R5: BuilderTestFlightRange concept

The future test scene or spawned range shall be an isolated
`BuilderTestFlightRange`. It shall provide a simple target dummy, simple marker
or obstacle, deterministic reset, and enough space for movement checks.

The range shall not depend on full autopilot, planet terrain, economy, final art,
multiplayer, or a mission framework.

### R6: Functional binding validation

Test flight shall validate functional bindings, including:

- main thruster VFX from nozzle socket
- RCS particles from RCS sockets
- turret pivot from socket
- muzzle flash from muzzle socket
- weapon projectile from muzzle socket
- camera bounds ignoring VFX/helper markers
- no root fallback markers
- no missing socket warnings
- no unbound functional parts

### R7: Physics and movement response

Test flight shall validate physics response, including:

- main thrust produces forward acceleration
- reverse or stop behavior exists through RCS or later main-brake logic
- yaw responds
- pitch responds
- roll responds
- RCS translation responds by axis
- generated ship has valid mass/inertia
- no NaN or infinite physics state appears
- no major uncontrollable drift appears during short neutral-input windows

### R8: Fuel validation

Test flight shall validate fuel behavior when fuel consumption is configured.
Fuel shall decrease under main thrust or RCS use where applicable, shall not
become negative, and shall not permit phantom thrust after fuel exhaustion.

### R9: Weapon and turret validation

For combat-capable ships, test flight shall validate that weapons fire from
muzzle sockets, projectiles do not spawn at root, turret tracking works for a
simple target inside declared arc, turrets stay within declared arcs, recoil is
bounded, and weapons do not fire through self within declared blocked arcs.

### R10: Camera validation

Test flight shall validate that the camera keeps the generated ship in view. The
camera shall prefer the documented camera anchor/COM/bounds behavior and shall
not let VFX/helper markers inflate ship framing.

### R11: Role-based acceptance scenarios

The builder shall define future acceptance scenarios for:

- minimal valid ship
- combat-capable ship
- cargo ship
- RCS maneuver ship
- bad ship negative tests
- visual/VFX binding checks

Scenario checks shall be role-aware. A minimal ship shall not require weapon or
cargo acceptance. A combat ship shall require combat acceptance. A cargo ship
shall require cargo loaded/empty behavior acceptance.

### R12: Cargo acceptance

Cargo ship scenarios shall validate that cargo modules are connected, cargo mass
changes total mass, full cargo lowers acceleration relative to empty cargo, cargo
stats remain finite, and cargo modules do not float or hard-overlap.

### R13: Manual evidence

Future manual evidence shall include:

- screenshot of builder valid state
- screenshot of test flight
- screenshot of VFX firing
- screenshot of turret tracking
- short CSV or markdown summary later

### R14: Result states

Test-flight acceptance shall report pass, warning, fail, or debug-only result.
Activation shall require no hard failure and no debug-only result. Warnings may
allow activation when they are visible to the player and accepted by the chosen
game mode.

### R15: Art independence

Test-flight acceptance shall not depend on final art quality. Primitive visuals,
metadata fixtures, or existing generated blueprint visuals shall be enough to
prove functional bindings, physics response, fuel, weapons, camera, VFX origins,
and safety.

## Acceptance scenarios

### Scenario: minimal valid ship can test fly

Given a ship has one cockpit, one hull/frame, one main thruster, enough fuel, and
basic RCS, when the player starts test flight, then the temporary ship spawns,
accelerates forward under main thrust, rotates, consumes fuel, remains finite,
keeps camera framing, and can return to builder.

### Scenario: combat ship uses socket origins

Given a combat-capable ship has a valid turret, muzzle, muzzle flash, and target
inside declared arc, when the weapon fires in test flight, then projectile and
VFX origins come from socket data, the turret remains within arc, and no root
fallback is used.

### Scenario: cargo mass affects handling

Given a cargo ship can be tested empty and full, when both test flights run, then
the full configuration has higher mass and lower acceleration while remaining
finite and controllable.

### Scenario: RCS maneuver ship proves axes

Given a ship declares RCS translation in all axes, when RCS checks run, then each
axis produces measurable response and SAS remains compatible with manual control.

### Scenario: bad ship is blocked

Given a ship has a missing cockpit, missing main thruster, no RCS, invalid muzzle,
disconnected required module, hard overlap, unstable COM/thrust offset, or no
fuel, when the player tries normal test flight, then blocking errors prevent
launch unless debug-only override is used.

### Scenario: final art not required

Given a generated ship uses primitive visuals and metadata sockets, when
test-flight acceptance runs, then functional checks can pass without final
Blender art.
