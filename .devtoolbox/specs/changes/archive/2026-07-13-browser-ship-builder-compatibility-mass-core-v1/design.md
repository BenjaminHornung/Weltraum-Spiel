# Design: Browser Ship Builder Compatibility & Mass Core v1

## Existing contracts reused

Reuse `ShipBuilderDataError` and existing catalog/blueprint builders for schema and reference rejection, `deepFreeze` for immutable output, `canonicalJsonHash` for signatures, and the existing canonical ordering of catalog definitions, instances, and connections. Do not create another hash, JSON canonicalizer, ID grammar, or mutable registry.

Schema errors remain exceptions. Domain reports are produced only after `createShipBlueprint(source, { catalog })` succeeds.

## Module boundaries

- `diagnostics.ts`: severity/status/code vocabulary, fixed code precedence, diagnostic normalization, and status calculation.
- `compatibility.ts`: policy input/snapshot construction, yaw transforms, endpoint lookup, bilateral restrictions, and per-connection evaluation.
- `blueprintValidation.ts`: occupancy, required sockets, structural graph/components/root, summary, report, and signature.
- `massProperties.ts`: enabled dry-mass contributions, COM, yaw-aware footprint bounds, fail-closed numeric handling, and signature.
- `index.ts`: public exports only.

## Diagnostic contract

Diagnostics contain code, severity, phase, JSON-pointer path, sorted instance IDs, sorted connection IDs, sorted endpoint records, and optional JSON-safe details. They contain no authoritative player-facing message.

Fixed precedence:

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

Statuses are `Invalid`, `ValidWithWarnings`, and `Valid`. Errors dominate warnings; Info does not change status.

## Validation policy

`createShipBuilderValidationPolicy(input)` accepts plain JSON-safe data and returns a canonical deeply frozen snapshot containing `policyId`, positive version, ordered endpoint rules, ordered symmetric connection rules, ordered required-socket rules, and a signature.

Endpoint rules map socket type to `Exclusive` or `Shared`. Connection rules contain:

- canonical unordered socket-type pair;
- allowed connection types;
- allowed unordered capacity-class pairs;
- allowed unordered mount-side pairs;
- direction mode `Finite`, `NonZero`, or `Opposed`;
- `allowSameInstance`;
- `contributesToStructure`.

No matching connection rule means `SocketTypeIncompatible`; there is no custom-type fallback. Exact same endpoints are always invalid. Same-instance/different-socket connections require explicit permission.

The starter policy contains one structural rule:

- socket pair `structural/structural`;
- connection type `Structural`;
- endpoint occupancy `Shared`;
- capacity pair `standard/standard`;
- direction mode `NonZero`;
- same-instance forbidden;
- contributes to structure;
- allowed mount pairs: back/front, back/bottom, back/top, back/left, back/right, left/right, top/bottom.

Horizontal mount sides and direction vectors are transformed by instance yaw before comparison. `any` is a wildcard; `internal` only matches `internal` or `any`. `Opposed` normalizes only already nonzero vectors and requires dot product <= -0.999999. No zero/origin/default-axis fallback is allowed.

For each endpoint, a nonempty `compatibleCategoryIds` must include the peer definition category and a nonempty `compatibleComponentKinds` must intersect peer component kinds. Empty lists are unrestricted. `compatibilityAliases` and `PartDefinition.allowedMountSides` are not connection authority in this slice.

## Compatibility and graph

`evaluatePartConnectionCompatibility(connection, blueprint, catalog, policy)` returns a frozen result with status, ordered diagnostics, and whether the connection is a valid structural edge.

Disabled connections are ignored by the aggregate validator. An enabled connection touching a disabled instance is invalid and not an edge. Occupancy counts enabled connections with enabled endpoints even when another compatibility rule fails. Exclusive endpoints with more than one connection receive one diagnostic containing sorted connection IDs.

Graph nodes are enabled instances. Edges are fully compatible connections whose rule contributes to structure. Root selection is the lexically first enabled ControlCore instance, otherwise the first Structural instance, otherwise the first enabled instance. Each component and the component list are lexically ordered. IDs outside the root component are disconnected.

Sockets whose `requiredForComponentIds` matches a component on the enabled definition are Error-level requirements. Policy-required endpoints may use Error, Warning, or Info. Categories never imply required sockets.

The report includes status, catalog signature, layout hash, policy signature, diagnostics, connected components, root component, disconnected IDs, occupied endpoints, unused required endpoints, summary counts, and a signature over the full canonical payload excluding the signature field.

## Mass, COM, and bounds

Only enabled instances contribute. Dry mass uses only `PartDefinition.dryMassKilograms`; component/fuel/cargo/resource values are ignored.

The module origin is its center. An instance contribution records IDs, dry mass, and center in grid and meter space. COM is the mass-weighted part-origin position. Meter values equal grid values multiplied by `blueprint.gridMeters`.

Bounds use `gridFootprint`, centered on `localGridPosition`. Yaw 90/270 swaps X/Z footprint; yaw 0/180 preserves it. Union bounds expose minimum, maximum, and size in grid and meter space; half-grid endpoints are valid.

Zero total dry mass keeps dry mass at zero and any computable bounds, returns null COM, and reports `ZeroDryMass`. No enabled instances return null COM/bounds and `NoEnabledInstances`. Overflow/nonfinite aggregates return null rather than NaN/Infinity with the corresponding diagnostic.

## Canonical ordering and immutability

Policies, diagnostics, endpoints, components, contributions, and report arrays are canonically sorted before hashing. Every public result and nested array/object is deeply frozen. Map/Set instances and functions are never exposed or hashed.

## Parallel-work protection

The dedicated feature worktree owns only the approved allowlist. Changes to serialized schemas, starter data/fixtures/signatures, package/lockfiles, UI/runtime/flight/navigation/render/TestBridge/Assets paths, or overlapping parallel Ship Builder work are stop conditions.
