# Hestia Asset Authoring Contract V1

## Ownership

Agent F owns `schemas/hestia-asset-authoring-v1.schema.json` and this contract. Agent G consumes them read-only and owns the compiled manifest schema.

## Canonical document

```json
{"schema":"hestia.asset-authoring.v1","asset":{},"parts":[],"joints":[],"markers":[],"materials":[]}
```

No migration or aliasing exists in V1. Unknown schema values fail closed.

## GLB transport

- `asset.extras.hestia`: `schema` plus all canonical asset fields
- part node: `node.extras.hestia` with `kind: "part"`
- joint node: `kind: "joint"`
- marker node: `kind: "marker"`
- `material.extras.hestia`: canonical material fields

`kind` is transport-only and removed from canonical semantics.

## IDs and references

IDs match `^[a-z0-9][a-z0-9._:-]{0,127}$`, are case-sensitive and are never trimmed or normalized. IDs are unique per category. Parent, joint, marker and material references resolve exactly once. Part-parent cycles are errors.

## Asset

Required: `assetId`, safe nonnegative `assetRevision`, `representation`, `metersPerUnit=1`, and the exact right-handed `+Y` up / `+Z` forward frame.

## Parts

Every part declares `partId`, `representation`, `destructible`, `collisionPolicy`, `navigationPolicy`, and `thinFeature`. Shell and LayeredShell require a shell object. Decorative parts are non-destructible.

## Thin features

Every part declares a policy and positive minimum thickness. The compiler measures actual thickness; authored metadata is not proof.

## Joints and markers

Joints and markers are separate GLB nodes. Threshold joints require positive break force or torque. CutInterface markers require `interfaceId`. Node transforms carry marker/joint placement and are normalized by the compiler.

## Materials

Semantic materials declare `renderMaterialId`, optional `structuralMaterialId`, optional palette index and tags. Physical density/strength comes from a versioned registry, never from arbitrary GLB values.

## Canonicalization

UTF-8 compact JSON, object keys lexically ordered, parts/joints/markers/materials sorted by their stable IDs, tags sorted, finite numbers only, negative zero normalized, no timestamps, machine paths, locale, random values or Blender iteration order. Hash with lowercase SHA-256.

## Manifest

Agent G emits `hestia.asset-manifest.v1` with source inventory, normalized semantics, thin-feature decisions, sparse 16³ bricks at 0.125 or 0.25 m, deterministic diagnostics and geometry/semantics/voxelization/manifest-tree hashes.
