# Ship Builder Test-Flight Validation

Status: planning/spec-only, 2026-06-14.

This document defines a future Ship Builder test-flight validation path. The goal
is to prove that generated ships are playable, functional, and safe before they
can become the player's active ship. This planning slice does not implement code,
tests, scenes, assets, prefabs, Blender files, or runtime systems.

## 1. Purpose

The builder already needs data validation before test flight. Test-flight
validation is the next proof layer: it confirms that a valid blueprint can become
a temporary flyable ship whose controls, physics, camera, VFX bindings, weapon
bindings, and stability behave well enough for player use.

Test flight is not a final certification lab. It is a compact, repeatable loop:
build, validate data, launch temporary ship, prove basic behavior, return, revise,
save, then activate.

## 2. Core principles

- Data validation happens before test flight.
- Test flight uses a temporary ship instance until the player saves and accepts
  the design.
- Negative ships are blocked before test flight unless explicitly launched by a
  debug override.
- Test-flight acceptance does not depend on final art quality.
- Functional sockets and marker origins are checked as gameplay data, not as
  decorative mesh details.
- The test range has no dependency on full autopilot, planets, economy,
  multiplayer, or final Blender assets.

## 3. Future flow

The future test-flight loop should be:

1. Player builds a ship in builder edit mode.
2. Builder validates data, sockets, required systems, overlaps, and stats.
3. Player clicks `Test Flight`.
4. If hard validation errors exist, test flight is blocked and the first error is
   shown near the action.
5. If validation is valid or warning-only, a temporary test-flight ship is built.
6. An isolated `BuilderTestFlightRange` loads or spawns.
7. The ship starts with known fuel and known cargo load.
8. Checklist validation begins for movement, rotation, RCS, main thrust, weapons,
   camera, VFX marker origins, and stability.
9. Player can fly manually and return to builder at any time.
10. Passing ships can be saved as named variants and set as active.

The test-flight path should reuse the same blueprint-to-variant-to-spawn path
used by normal generated ships, not a separate hidden ship format.

## 4. Temporary ship rules

Test flight uses temporary ship instances:

- The draft is not automatically saved.
- The temporary ship is not automatically set as active.
- Test-flight damage, fuel burn, cargo changes, and target hits do not mutate the
  saved variant in the MVP.
- Returning to builder restores the draft layout and validation state.
- A temporary ship can be discarded safely.

Saving and activation are deliberate player actions after test flight.

## 5. Known start conditions

Every test flight should start from explicit known conditions:

| Field | MVP rule |
| --- | --- |
| Spawn position | Center of `BuilderTestFlightRange` or hangar launch lane. |
| Velocity | Zero linear and angular velocity. |
| Fuel | Full planned test fuel unless the scenario tests low fuel. |
| Cargo | Empty for minimal/combat/RCS cases; full or selected load for cargo cases. |
| Control mode | Cruise for main-thrust check, then Precision/Translation for RCS checks. |
| RCS | Enabled for RCS and SAS checks. |
| SAS | Off for raw response checks; on for SAS compatibility checks. |
| Weapons | Armed only in weapon scenarios. |
| Target | Simple target dummy present for combat scenarios. |

## 6. Test scene concept

The future test scene is an isolated `BuilderTestFlightRange`.

It should include:

- simple origin marker
- simple axes/range markers
- simple target dummy
- simple obstacle or orientation marker
- enough open space for acceleration and braking checks
- stable lighting and camera visibility
- deterministic reset point

It should not require:

- full autopilot
- planet terrain
- economy services
- faction state
- multiplayer
- final Blender art
- final mission framework

The existing prototype environment already proves that primitive ranges, labels,
target dummies, and markers can support focused test evidence. The future builder
range should stay smaller and more deterministic than the general sandbox.

## 7. Automated checklist concept

Automated test-flight validation should produce a checklist with clear pass,
warning, fail, or not-applicable results.

### Movement and physics

Checks:

- main thrust produces forward acceleration
- acceleration direction roughly matches ship forward
- yaw responds
- pitch responds
- roll responds
- RCS translation responds by axis
- reverse or stop behavior exists through RCS or later main-brake logic
- no major uncontrollable drift appears during short neutral-input windows
- no NaN or infinite physics values appear
- generated ship has valid mass and inertia

### Fuel

Checks:

- main thrust consumes fuel when configured to consume fuel
- RCS consumes fuel when configured to consume fuel
- fuel never becomes negative
- fuel-empty state disables or limits fuel-consuming thrust rather than creating
  phantom thrust

### Weapons

Checks:

- weapon fires from muzzle marker
- projectile does not spawn at root
- muzzle flash comes from muzzle flash marker
- turret tracks target when target is inside declared arc
- turret stays inside yaw/pitch arc
- weapon does not fire through self within declared blocked arcs
- recoil is bounded enough that the ship remains controllable

### Camera

Checks:

- camera keeps the ship in view
- camera focus uses camera anchor, COM, or bounds in the documented priority
- VFX/helper markers do not inflate camera bounds
- zoom/framing remains useful for small and cargo-sized builds

### VFX and binding

Checks:

- main thruster VFX originates from main nozzle socket
- RCS particles originate from RCS sockets
- turret pivot comes from turret socket data
- muzzle flash originates from muzzle socket data
- no root fallback markers are used
- no missing socket warnings remain for functional parts
- no unbound functional parts remain

## 8. Acceptance result levels

Test-flight acceptance should distinguish:

| Result | Meaning |
| --- | --- |
| `Pass` | Required checks passed; ship can be saved and activated. |
| `Warning` | Ship is usable but has handling, camera, cargo, or combat caveats. |
| `Fail` | Ship cannot be activated until fixed. |
| `DebugOnly` | Ship was launched despite errors through debug override; cannot activate. |

Passing the automated checklist does not need to mean perfect handling. It means
the ship responds, stays finite, has valid bindings, and can support normal
player control.

## 9. Negative ship handling

Negative ships should be blocked before normal test flight:

- missing cockpit
- missing main thruster
- no RCS
- no fuel when fuel is required
- disconnected required module
- hard overlap
- invalid turret muzzle
- invalid RCS nozzle direction
- non-finite or negative critical stats

Debug mode may explicitly launch negative ships for diagnostics. Debug launches
must be labeled `DebugOnly`, must not allow activation, and should capture the
expected failure reason.

## 10. Manual evidence

Future manual evidence should include:

- screenshot of builder valid state
- screenshot of test flight
- screenshot of VFX firing
- screenshot of turret tracking
- short CSV or markdown summary

Recommended summary fields:

- blueprint ID
- scenario name
- validation result
- mass and fuel at spawn
- main acceleration measured
- RCS response by axis
- fuel delta
- weapon/muzzle result
- camera result
- warnings
- failure reason if any

Evidence should live under the relevant DevToolbox change's `tests/` folder when
implementation work begins.

## 11. Activation gate

A generated ship can become the player's active ship when:

- builder data validation has no hard errors
- test-flight acceptance has no hard failures
- functional bindings are complete
- core movement and rotation checks pass
- camera remains usable
- fuel and mass are finite
- any warning state is visible to the player
- the player saves and explicitly sets the variant active

Activation should not require combat, cargo, docking, economy, autopilot, or final
art unless the selected game mode explicitly demands those systems.

## 12. Relationship to existing evidence

The current prototype builder evidence shows focused builder EditMode and
PlayMode coverage plus screenshots. This future package should build on that
evidence by expanding acceptance from "builder flow works" into "custom generated
ship is safe and functional enough to become active."

The autopilot proving-ground harness remains separate. Ship-builder test flight
may include manual movement, RCS, camera, and target-dummy checks without relying
on exact point arrival or autopilot acceptance.
