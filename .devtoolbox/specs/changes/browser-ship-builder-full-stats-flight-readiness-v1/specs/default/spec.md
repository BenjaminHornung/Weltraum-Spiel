# Capability: Browser Ship Builder Full Stats and Flight Readiness V1

## Requirement: Explicit stat contracts

Every requested mass, propulsion, RCS, cargo, weapon, geometry, braking, power, and
heat field SHALL use a typed availability/value/unit envelope and SHALL never expose
nonfinite JSON.

### Scenario: Deterministic fixture reports

Scout, Cargo, and Weapon reports SHALL contain pinned finite/available or explicit
unavailable fields, stable signatures, and unchanged dry mass.

### Scenario: Unknown values

Missing metadata, fuel, or thrust SHALL return the matching unavailable state with
`null`; computed semantic absence such as zero weapons or a missing RCS axis MAY be
an available zero.

## Requirement: Preview mass and COM

Fuel fill SHALL default to 1.0; cargo SHALL default to zero. Fuel and cargo SHALL
increase loaded mass without changing dry mass. Fuel SHALL use tank origins and cargo
mass SHALL be distributed by enabled storage mass capacity.

### Scenario: Preview shifts COM

Off-center fuel or cargo SHALL shift loaded COM according to weighted mass.

### Scenario: Preview exceeds capacity

Requested mass/volume SHALL remain unclamped, SHALL produce ordered over-capacity
diagnostics, and SHALL block TestFlight and Active readiness.

## Requirement: Main propulsion performance

Only enabled components with positive finite thrust and valid transformed nozzle
metadata SHALL count. Acceleration SHALL equal thrust divided by the selected mass.

### Scenario: Increased loaded mass

Adding fuel or cargo SHALL lower acceleration for unchanged thrust.

### Scenario: Missing thrust

Missing usable main thrust SHALL make dependent stats unavailable and SHALL block
TestFlight readiness.

## Requirement: Propellant performance

Fuel-dependent delta-v and burn time SHALL require explicit compatible propulsion
metadata, positive mass flow, compatible planned fuel, and positive masses.

### Scenario: Complete fuel metadata

A single compatible synthetic fuel mode SHALL produce finite delta-v and burn time
using the documented rocket equation.

### Scenario: Missing or fuel-free metadata

Missing mass flow/fuel SHALL produce unavailable results; explicit fuel-free mode
SHALL be unsupported for delta-v without producing infinity.

## Requirement: RCS authority

RCS SHALL derive signed translation from transformed nozzle directions and torque
from lever arms relative to loaded COM; declared axes alone SHALL not prove authority.

### Scenario: Asymmetric layout

Unequal positive/negative nozzle arrangements SHALL preserve their unequal force
values and SHALL emit asymmetry only when a policy threshold is enabled.

### Scenario: Invalid direction

Missing, zero, or invalid direction metadata SHALL fail closed at the catalog/stat
boundary and SHALL never use a root or zero-vector fallback.

## Requirement: Cargo and weapon capability

Cargo mass/volume capacities SHALL aggregate independently. Weapon counts SHALL use
enabled Builder components only and SHALL classify fixed, turret, usable, missing
muzzle, and blocked/invalid values without importing Combat Core.

### Scenario: Validated weapon snapshot

The Weapon fixture SHALL produce pinned counts; missing referenced sockets remain
schema errors and therefore `missingMuzzleCount` is zero for valid snapshots.

## Requirement: Handling diagnostics

The implementation SHALL provide all requested diagnostic codes in the fixed phase,
code, path, and canonical-detail order with deduplicated stable fix codes.

### Scenario: Offset and weak braking

Offset above 0.35 m and braking below 0.25 SHALL emit warnings and SHALL block only
Active readiness.

### Scenario: Missing axes

Missing signed translation or pitch/yaw/roll authority SHALL emit warnings; base
TestFlight readiness SHALL still pass when any translation and any torque exist.

### Scenario: Power and heat placeholders

Reservations SHALL populate required/heat-generated placeholders only. Missing
generation/cooling SHALL stay unavailable and SHALL not block V1 readiness.

## Requirement: Three readiness levels

Readiness SHALL return immutable signed `DraftValid`, `TestFlightReady`, and
`ActiveShipReady` assessments with ordered errors, warnings, and suggested fixes.

### Scenario: Incomplete draft

A schema-valid incomplete blueprint SHALL remain DraftValid.

### Scenario: Test flight blockers

Missing core systems, fuel basis, usable RCS, functional sockets, finite required
stats, cargo capacity, or a hard overlap SHALL make TestFlightReady false.

### Scenario: Static active eligibility

ActiveShipReady SHALL inherit TestFlight and additionally require exactly one valid
camera anchor, adequate braking, and acceptable thrust offset; it SHALL not claim
runtime handoff or completed test flight.

## Requirement: Hard overlap

Gameplay AABBs SHALL block only when positive intersection volume is strictly greater
than 75% of the smaller part volume.

### Scenario: Threshold boundary

Touching and exactly 75% SHALL not block; the Cargo fixture docking/engine pair SHALL
be detected above the default threshold.

## Requirement: Determinism and isolation

Evaluators SHALL copy inputs, deeply freeze outputs, sort semantic collections,
canonicalize signed payloads, and remain free of Three.js, renderer, Combat, runtime,
flight, resource, and test-harness dependencies.

### Scenario: Insertion order and mutation

Reversed catalog/blueprint insertion order SHALL not change reports/signatures;
caller inputs SHALL remain byte-equivalent and mutable after evaluation.

### Scenario: Browser module graph

Normal `/` SHALL expose no `window.TestBridge`; the real Vite browser SHALL import
the ship-builder barrel, evaluate all fixtures, and record zero console/network errors.
The normal route SHALL declare an empty data-URL favicon so Chrome does not request
an absent `/favicon.ico`; the E2E SHALL not filter or intercept this failure.
