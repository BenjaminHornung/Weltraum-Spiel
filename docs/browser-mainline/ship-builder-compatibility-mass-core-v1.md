# Ship Builder Compatibility & Mass Core v1

## Scope

This browser-mainline slice adds pure Ship Builder connection compatibility, structural validation, and dry-mass analysis on top of the existing catalog/blueprint V1 foundation. It does not add a Builder route, UI, renderer integration, flight runtime binding, TestBridge surface, or package dependency.

The public source remains `apps/weltraum-browser/src/ship-builder/`. The new entry points are:

- `createShipBuilderValidationPolicy(input)`
- `evaluatePartConnectionCompatibility(connection, blueprint, catalog, policy)`
- `validateShipBlueprintStructure(source, catalog, policy)`
- `evaluateShipBlueprintMassProperties(source, catalog)`

The serialized catalog and blueprint schemas are unchanged. `STARTER_CATALOG_SIGNATURE` remains `5aaa27fd`; the starter layout hashes remain Scout `fc4597b6`, Cargo `8613314e`, and Weapon `b38b31ec`.

## Schema and domain boundary

Unknown blueprint input is validated by the existing catalog-aware `createShipBlueprint` builder before a structure or mass report is created. Duplicate IDs, unknown instances, definitions or sockets, unsupported versions, invalid rotations, and other `ShipBuilderDataError` conditions remain schema exceptions. They are not converted into gameplay diagnostics.

Domain diagnostics are JSON-safe records with code, severity, phase, JSON path, sorted IDs/endpoints, and optional machine-readable details. They contain no authoritative player-facing copy. Their fixed code precedence is:

1. `NoEnabledInstances`
2. `ConnectionEndpointDisabled`
3. `IdenticalConnectionEndpoints`
4. `SelfConnectionNotAllowed`
5. `SocketTypeIncompatible`
6. `ConnectionTypeIncompatible`
7. `SocketCapacityIncompatible`
8. `SocketCategoryIncompatible`
9. `SocketComponentKindIncompatible`
10. `SocketMountSideIncompatible`
11. `SocketDirectionInvalid`
12. `SocketDirectionsIncompatible`
13. `ExclusiveSocketOccupiedMultipleTimes`
14. `RequiredSocketUnused`
15. `DisconnectedInstances`
16. `NonFiniteDryMassAggregate`
17. `ZeroDryMass`
18. `NonFiniteCenterOfMass`
19. `InvalidGridBounds`

Errors produce `Invalid`; Warning without Error produces `ValidWithWarnings`; otherwise the report is `Valid`. Info does not change status.

## Explicit immutable policy

Policies are plain JSON data with a stable ID/version, endpoint occupancy rules, symmetric connection rules, required-socket rules, and a canonical signature. Construction sorts every rule/list/pair, rejects ambiguous duplicates and missing endpoint occupancy references, and deeply freezes the result. Functions, mutable registries, Maps, and Sets are not published.

A connection rule explicitly controls:

- the symmetric socket-type pair;
- allowed connection types;
- allowed capacity-class and yaw-transformed mount-side pairs;
- `Finite`, `NonZero`, or normalized `Opposed` directions;
- same-instance permission;
- structural-graph contribution.

Missing socket-pair rules fail closed. An identical part/socket endpoint is always invalid. Different sockets on the same instance need explicit `allowSameInstance`. Empty category/component compatibility lists are unrestricted; nonempty lists are checked bilaterally against the peer definition. `compatibilityAliases` and `PartDefinition.allowedMountSides` are not connection authority.

The starter policy allows only `Structural` connections between `structural` sockets with `standard/standard` capacity, nonzero directions, and the required back/front, back/bottom, back/top, back/left, back/right, left/right, and top/bottom mount pairs. Structural endpoints are explicitly `Shared`, preserving the Weapon fixture's repeated `weapon-frame/structural-top` use. The pinned starter policy signature is `2553a9d1`.

## Structural report

Only enabled instances are graph nodes. Disabled connections are ignored. An enabled connection touching a disabled instance reports `ConnectionEndpointDisabled`, does not occupy endpoints, and does not create an edge. Structural edges come only from fully compatible connections whose rule sets `contributesToStructure`.

Root selection is deterministic: first enabled `ControlCore` instance ID, otherwise first `Structural` instance ID, otherwise first enabled ID. Component IDs and member IDs are lexically ordered. IDs outside the root component are reported as disconnected.

Endpoint identity for Exclusive checks and Required-Socket satisfaction is always the part-instance/socket pair. The public `occupiedSocketEndpoints` evidence also carries `connectionRole` so opposite authoring roles remain explicit while repeated uses within the same role coalesce their sorted connection IDs. This yields the planned starter counts: Scout 8, Cargo 10, Weapon 11. Exclusive diagnostics still aggregate all roles by endpoint identity.

A socket is required when its `requiredForComponentIds` matches a component on the enabled definition. Policy rules can add Error-, Warning-, or Info-level requirements through explicit selectors. Category names alone never make a socket required.

The report carries catalog/layout/policy provenance, status, ordered diagnostics, connected components, root component, disconnected IDs, occupied endpoints, unused required endpoints, summary counts, and a signature over the full payload excluding only the signature field.

## Dry mass, COM, and bounds

Only enabled instances contribute, and each contribution uses only `PartDefinition.dryMassKilograms`. Armor component mass, fuel, cargo, ammo, crew, resources, and runtime state are excluded.

A part origin is its mass center. COM is returned in grid coordinates and meters, with meter values equal to grid values times `gridMeters`. Bounds use `gridFootprint` around the part origin. Yaw 90/270 swaps X/Z footprint; yaw 0/180 preserves it. Odd footprints naturally produce half-grid boundaries.

A nonempty zero-mass blueprint keeps computable bounds, returns `dryMassKg: 0`, null COM, and `ZeroDryMass`. An empty blueprint returns null COM/bounds and `NoEnabledInstances`. Summation, weighted-COM, meter-projection, or bounds overflow never publishes NaN/Infinity: affected values become null with stable Error diagnostics.

## Starter acceptance

| Fixture | Root | Dry mass | COM grid | Bounds grid min…max | Occupied endpoints | Structure signature | Mass signature |
| --- | --- | ---: | --- | --- | ---: | --- | --- |
| Scout | `scout-cockpit` | 1450 kg | `(0, -3/145, 63/145)` | `(-2,-3,-5)…(2,2.5,4.5)` | 8 | `c58b05a0` | `b15a294e` |
| Cargo | `cargo-cockpit` | 2540 kg | `(-105/254, 0, 30/127)` | `(-5,-2.5,-8)…(2.5,2.5,6)` | 10 | `d87d4ed6` | `db671981` |
| Weapon | `weapon-cockpit` | 2560 kg | `(3/128, 17/64, 39/256)` | `(-5,-2.5,-6)…(5,3.5,5.5)` | 11 | `91b446d4` | `d2f9b77a` |

All three are `Valid`, contain one connected component, and report no disconnected instances or unused required sockets under the starter policy.

## Browser evidence

`apps/weltraum-browser/tests/e2e/ship-builder-compatibility-mass-core.spec.ts` loads normal `/`, confirms `window.TestBridge` is absent, dynamically imports `/src/ship-builder/index.ts`, and evaluates the complete structure/mass reports for all starter fixtures. It pins policy, layout, structure, and mass signatures and writes deterministic evidence without timestamps or screenshots:

- `apps/weltraum-browser/evidence/browser-ship-builder-compatibility-mass-core-v1-summary.json`
- `apps/weltraum-browser/evidence/browser-ship-builder-compatibility-mass-core-v1.md`

## Explicit non-goals

- Builder palette, placement/edit/mirror/save UI or any visual contract.
- Runtime/test-flight/active-ship handoff, renderer binding, or flight readiness.
- Mesh/collider proximity, overlap, thrust, authority, fuel, cargo, ammo, crew, weapon, or full gameplay-stat validation.
- Compatibility inferred from art aliases or category names.
- Economy, recipes, unlocks, final costs/balance, production art import, or remaining catalog variants.
