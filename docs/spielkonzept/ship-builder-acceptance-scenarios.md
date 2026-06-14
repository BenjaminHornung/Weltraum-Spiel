# Ship Builder Acceptance Scenarios

Status: planning/spec-only, 2026-06-14.

This document defines future acceptance scenario categories for Ship Builder
test-flight validation. It is planning-only and does not add tests or runtime
systems.

## 1. Scenario matrix

The future acceptance matrix should cover:

| Category | Purpose | Expected result |
| --- | --- | --- |
| Minimal valid ship | Prove a tiny ship can fly without combat/cargo extras. | Pass |
| Combat-capable ship | Prove weapon sockets, turret arcs, tracking, and recoil. | Pass or warning |
| Cargo ship | Prove cargo mass changes stats and handling. | Pass or warning |
| RCS maneuver ship | Prove translation, rotation, and SAS compatibility. | Pass |
| Bad ship negative tests | Prove invalid designs are blocked before normal test flight. | Blocked or DebugOnly |
| Visual/VFX binding checks | Prove functional origins are socket-based with no root fallback. | Pass |

Each scenario should be runnable with primitive or metadata-backed parts before
final Blender art exists.

## 2. Minimal valid ship

Purpose: prove the smallest valid custom ship can become flyable.

Required build:

- one cockpit/control core
- one hull/frame
- one main thruster
- enough fuel for a short test
- basic RCS
- no weapon required

Builder data acceptance:

- no hard validation errors
- cockpit, hull, main thrust, fuel, and RCS are connected or accepted by the MVP
  structural rule
- mass and fuel are finite and positive
- COM and thrust axis can be computed

Test-flight acceptance:

- ship spawns at the test range
- main thrust produces forward acceleration
- yaw, pitch, and roll respond
- RCS can produce at least basic attitude control
- fuel decreases under thrust when fuel consumption is enabled
- no NaN or infinite physics state appears
- camera keeps the ship in view
- return to builder keeps the draft intact

Activation:

- can be saved and set active when the checklist passes
- warnings such as no weapon or no docking connector do not block MVP activation

## 3. Combat-capable ship

Purpose: prove weapon and turret bindings are usable and safe.

Required build:

- valid minimal ship systems
- valid turret or fixed weapon
- muzzle marker
- muzzle flash marker when VFX is configured
- declared turret arc or fixed-fire direction
- simple target dummy in range

Builder data acceptance:

- weapon component references a valid muzzle
- moving turret references turret base, yaw pivot, and pitch pivot
- fixed weapon declares fixed arc or direction
- weapon does not claim arcs it cannot validate

Test-flight acceptance:

- turret tracks a target inside declared arc
- weapon fires from muzzle marker
- projectile does not spawn at ship root
- muzzle flash appears at the muzzle flash marker or muzzle fallback only when
  explicitly allowed by metadata
- turret stays within yaw and pitch arc limits
- weapon does not fire through self within declared blocked arcs
- recoil does not make the ship immediately uncontrollable
- camera still frames the ship during firing

Warnings:

- blocked arc outside intended target direction
- high recoil relative to mass
- no ammo/power integration if that system is not active yet

Failures:

- missing muzzle
- root projectile spawn
- unbounded turret rotation
- self-fire through declared blocked hull or cargo volume

## 4. Cargo ship

Purpose: prove cargo modules affect stats and handling without breaking flight.

Required build:

- valid minimal ship systems
- cargo module or rack
- cargo load profile: empty and full

Builder data acceptance:

- cargo module is not floating or disconnected
- cargo capacity mass and volume are finite and non-negative
- cargo module contributes capacity through metadata
- exposed cargo/fuel warnings are visible when metadata marks exposure

Test-flight acceptance:

- empty cargo ship spawns and flies
- full cargo ship has higher total mass
- full cargo ship shows lower acceleration than empty version
- COM changes are finite and visible in stats/evidence
- no invalid cargo module floats away or creates disconnected physics
- camera bounds ignore cargo VFX/helper markers

Warnings:

- high mass/low acceleration
- weak braking authority
- exposed cargo
- cargo blocking turret arcs

Failures:

- negative cargo capacity
- non-finite loaded mass
- cargo part disconnected when required
- hard overlap with cargo body

## 5. RCS maneuver ship

Purpose: prove fine control, translation, angular control, and SAS compatibility.

Required build:

- valid minimal ship systems
- RCS coverage intended for translation in all axes
- enough fuel for RCS if RCS consumes fuel

Builder data acceptance:

- RCS nozzle directions are finite and non-zero
- RCS axis coverage stats are available
- missing axes are warnings unless the scenario requires full coverage

Test-flight acceptance:

- translation responds on +X and -X
- translation responds on +Y and -Y
- translation responds on +Z and -Z when configured
- yaw responds
- pitch responds
- roll responds
- SAS can stabilize released axes without fighting active manual input
- no major uncontrollable drift appears during neutral-input windows
- RCS particles originate from RCS sockets
- fuel decreases when RCS fuel use is enabled

Warnings:

- weak authority on one axis
- high fuel use
- asymmetry or mirror mismatch

Failures:

- RCS nozzle root fallback
- no response on a required axis
- non-finite angular velocity or physics state
- SAS creates hidden damping outside the documented RCS path

## 6. Bad ship negative tests

Purpose: prove invalid ships are blocked before normal test flight and cannot
become active.

Negative cases:

| Case | Expected normal behavior |
| --- | --- |
| Missing cockpit | Block test flight with missing cockpit/control core error. |
| Missing main thruster | Block test flight with missing main thrust error. |
| No RCS | Block MVP flight-ready acceptance or show hard error if RCS is required. |
| Invalid turret muzzle | Block combat-capable acceptance and weapon activation. |
| Disconnected module | Block if required module is disconnected. |
| Hard overlap | Block test flight. |
| Unstable COM/thrust offset | Warn or fail acceptance if the ship becomes uncontrollable in test. |
| No fuel | Block fuel-consuming designs or mark fuel-free only if metadata allows it. |

Debug override:

- may launch negative ships for diagnostics
- must mark result as `DebugOnly`
- must not allow activation
- should record expected failure reason

## 7. Visual and VFX binding checks

Purpose: prove functional presentation is bound to declared sockets and helper
markers do not corrupt gameplay bounds.

Checks:

- main thruster VFX from nozzle socket
- RCS particles from RCS sockets
- turret pivot from socket
- muzzle flash from muzzle socket
- camera bounds ignore VFX/helper markers
- no root fallback markers
- no missing socket warnings
- no unbound functional parts

Acceptance:

- VFX origins are close to their owning sockets
- projectiles originate at muzzles
- turret mesh or proxy rotates around declared pivots
- VFX/helper markers do not enlarge camera bounds or ship physics bounds
- missing final art does not fail the scenario when primitive/socket metadata is
  sufficient

Failures:

- root `Muzzle` or root projectile fallback
- root `EngineNozzle` fallback in a normal imported/generated path
- RCS particles emitted from root
- functional part present but unbound
- helper marker included in camera bounds as if it were ship body

## 8. Automated metrics

Future automated reports should capture:

- main thrust produces forward acceleration
- reverse/stop via RCS or later main-brake logic
- yaw/pitch/roll respond
- RCS translation responds by axis
- fuel decreases
- no NaN physics
- weapon fires from muzzle
- projectile does not spawn at root
- turret stays within arc
- camera keeps ship in view
- generated ship has valid mass/inertia
- no missing socket warnings
- no unbound functional parts

Suggested summary columns:

```text
scenario, blueprintId, result, massKg, fuelStartKg, fuelEndKg,
mainAccelMps2, rcsX, rcsY, rcsZ, yaw, pitch, roll,
weaponOriginOk, turretArcOk, cameraOk, warnings, failureReason
```

## 9. Manual evidence

Future manual evidence should include:

- screenshot of builder valid state
- screenshot of test flight
- screenshot of VFX firing
- screenshot of turret tracking
- short CSV or markdown summary

Manual evidence is especially useful for:

- visual clarity
- camera framing
- VFX placement
- turret tracking readability
- cargo silhouette and handling feel

## 10. Non-dependencies

Acceptance scenarios should not require:

- full autopilot dependency
- planet dependency
- economy dependency
- final art dependency
- multiplayer
- final mission framework

The test-flight range can include simple markers and target dummies, but it should
not depend on exact waypoint arrival or orbital/navigation acceptance.

## 11. Promotion to active ship

A ship may be set as active when:

- required data validation passes
- applicable test-flight scenario passes
- warnings are visible and accepted by the player
- the ship has been saved as a named variant
- no debug-only launch state is attached to the acceptance result

Combat, cargo, docking, and advanced RCS scenarios can be optional based on the
variant's intended role. A minimal utility ship should not need combat acceptance,
and a combat ship should not need full cargo acceptance unless it carries cargo.
