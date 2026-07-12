# Capability: Browser Ship Builder Compatibility and Mass Core

## Requirement: Schema errors remain separate

The public aggregate validators SHALL validate unknown blueprint input through the existing catalog-aware blueprint builder before domain evaluation. Malformed schemas, duplicate IDs, unknown instances, unknown part definitions, unknown sockets, catalog mismatch, and unsupported versions SHALL throw `ShipBuilderDataError` and SHALL NOT be converted into gameplay diagnostics.

### Scenario: Unknown connection endpoint

A blueprint connection referencing an absent instance fails with `UnknownInstance` before a structure report is returned.

### Scenario: Duplicate connection ID

Duplicate connection IDs fail with `DuplicateId` in canonical connection order.

## Requirement: Immutable explicit policy

The module SHALL expose a policy builder whose result is deeply frozen, JSON-safe, canonically ordered, signed, and contains no functions, Map, or Set. All socket-type, connection-type, capacity, mount-side, direction, self-link, occupancy, structure-edge, and policy-required-socket behavior SHALL be explicit. Missing rules SHALL fail closed.

### Scenario: Custom socket type without rule

A connection containing a custom socket type for which the policy has no pair rule is incompatible and reports `SocketTypeIncompatible`.

## Requirement: Deterministic connection compatibility

Enabled connections SHALL verify enabled endpoints, nonidentical endpoints, self-link permission, socket/connection types, capacity pair, bilateral category/component restrictions, yaw-transformed mount sides, and configured direction behavior in the documented order.

No compatibility SHALL be inferred from mesh geometry, visual proximity, aliases, categories alone, or missing direction fallback.

### Scenario: Exclusive socket reused

When an endpoint declared Exclusive is referenced by two enabled connections, one `ExclusiveSocketOccupiedMultipleTimes` diagnostic lists the canonical endpoint and both sorted connection IDs.

### Scenario: Shared starter structural socket

The Weapon fixture's `weapon-frame/structural-top` may be referenced twice under the explicit starter Shared rule without an occupancy error.

### Scenario: Opposed yaw directions

For a policy using `Opposed`, local directions are transformed by each instance yaw before the normalized dot-product check.

## Requirement: Structured validation report

The validator SHALL return `status`, ordered `diagnostics`, `connectedComponents`, `rootComponent`, `disconnectedInstanceIds`, `occupiedSocketEndpoints`, `unusedRequiredSocketEndpoints`, provenance, summary, and signature.

Nodes SHALL be enabled instances. Edges SHALL be compatible connections explicitly marked as structural by policy. Root selection SHALL prefer the first enabled ControlCore ID, then Structural ID, then any enabled ID. Disabled connections SHALL not occupy endpoints or form edges. Enabled connections to disabled instances SHALL report an error.

### Scenario: Disconnected graph

Two enabled structural components with no compatible edge produce two ordered components; the component containing the selected root is `rootComponent`, and every other enabled ID is reported as disconnected.

### Scenario: Required socket severity

Metadata-required sockets are Errors. Policy-required sockets preserve their configured Error, Warning, or Info severity. Unused sockets without metadata/policy requirement produce no diagnostic.

## Requirement: Dry mass and center of mass

The evaluator SHALL include only enabled instances and only definition `dryMassKilograms`. It SHALL return ordered per-instance contributions, exact aggregate dry mass where finite, and center of mass in grid and meter space.

Fuel, cargo, ammo, crew, resources, component-added mass, and active flight state SHALL not contribute.

### Scenario: Zero dry mass

A nonempty all-zero-mass blueprint returns `dryMassKg = 0`, null COM, computable bounds, and `ZeroDryMass`.

### Scenario: Invalid definition mass

Negative or nonfinite definition mass remains a catalog schema failure. Aggregate overflow returns null rather than nonfinite output and reports `NonFiniteDryMassAggregate`.

## Requirement: Yaw-aware grid bounds

Bounds SHALL use definition `gridFootprint` around the instance center. Yaw 90/270 SHALL swap X and Z footprint. Grid bounds SHALL expose minimum, maximum, and size, and the meter projection SHALL multiply by `gridMeters`.

### Scenario: Rotation preserves mass

Changing a part from yaw 0 to yaw 90 changes asymmetric X/Z bounds but not dry mass or COM at the unchanged instance center.

## Requirement: Determinism and immutability

Equivalent insertion orders and canonical blueprint roundtrips SHALL produce identical policy, validation, and mass signatures. All returned records and nested arrays SHALL be frozen and JSON-safe.

## Requirement: Starter fixture acceptance

Under `STARTER_SHIP_BUILDER_VALIDATION_POLICY`:

- Scout, Cargo, and Weapon each have one connected component, no disconnected IDs, and no unused required sockets.
- Dry masses are 1450 kg, 2540 kg, and 2560 kg.
- Grid COM values are Scout `(0,-3/145,63/145)`, Cargo `(-105/254,0,30/127)`, Weapon `(3/128,17/64,39/256)`.
- Grid bounds are Scout `(-2,-3,-5)..(2,2.5,4.5)`, Cargo `(-5,-2.5,-8)..(2.5,2.5,6)`, Weapon `(-5,-2.5,-6)..(5,3.5,5.5)`.
- Occupied endpoint counts are 8, 10, and 11.

## Requirement: Normal-route browser evidence

Playwright SHALL load normal `/`, verify `window.TestBridge` is absent, dynamically import `/src/ship-builder/index.ts`, validate the starter policy and all three fixtures, and write deterministic task-specific JSON/Markdown evidence without screenshots or runtime integration.
