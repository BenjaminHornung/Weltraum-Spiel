# Design: Current HEAD Sanity and Contract Reconciliation v1

## Approach

This change is an evidence and metadata reconciliation slice. It does not add or
modify runtime behavior. The only allowed modifications are DevToolbox artifacts,
test protocols and small documentation corrections that align plans with the
already-implemented current HEAD.

## DTO Shape Decision

The Autopilot V2 implementation currently uses immutable sealed classes with
get-only properties for most contract DTOs. This differs from earlier planning
notes that proposed `readonly struct` for several DTOs.

The accepted decision is to keep the implemented immutable sealed classes:

- they are immutable after construction;
- collection-backed contracts defensively copy to read-only collections;
- validation can reject null object-graph members explicitly;
- Unity serialization and editor tooling are less fragile with reference DTOs
  than with broad nested value-type graphs;
- current tests cover construction, validation, defensive copy behavior and
  equality semantics.

Small math/value primitives can still use `readonly struct` when value semantics
are the contract, as `SpatialVector3` already does.

## Package Baseline

The sanity pass records the package/tooling baseline rather than changing it:

- Cinemachine: `com.unity.cinemachine` 3.1.7.
- ProBuilder: `com.unity.probuilder` 6.1.2.
- VFX Graph: `com.unity.visualeffectgraph` 17.4.0.
- AI Navigation: `com.unity.ai.navigation` 2.0.13.
- Roslyn DLLs: `Assets/Plugins/Roslyn/Microsoft.CodeAnalysis*.dll`,
  `System.Collections.Immutable.dll`, `System.Reflection.Metadata.dll`.

## Risk Controls

- Unity Editor package/tooling checks can create local settings side effects;
  final git checks must prove no unwanted ProjectSettings changes remain.
- Task reconciliation must be evidence-based: planner/executor tasks stay open.
- Status Authority AutopilotTelemetry mapping must stay open until the source
  clean-core telemetry contract exists.
