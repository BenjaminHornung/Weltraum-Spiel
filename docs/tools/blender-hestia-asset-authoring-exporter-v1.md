# Blender Hestia Asset-Authoring Exporter V1

This document is the handoff for the current Blender-side authoring script. It
covers authoring extraction, validation, and GLB/report transport only. Blender
is not runtime authority, and this exporter does not voxelize geometry.

## Scope and authority

- The semantic contract and canonical JSON shape are defined by
  `docs/tools/hestia-asset-authoring-contract-v1.md` and
  `schemas/hestia-asset-authoring-v1.schema.json`.
- The Blender boundary is
  `tools/blender/hestia_asset_authoring/blender_adapter.py`.
- The supported command-line entrypoint is
  `tools/blender/hestia_asset_authoring/export_hestia_glb.py`.
- V1 has no aliases or migrations. Unknown `hestia.*` properties and canonical
  camelCase properties used as Blender inputs fail closed.
- The exporter produces a GLB and a deterministic authoring-report sidecar.
  Downstream compilation, manifest authority, and voxelization are outside
  this handoff.

## Installation and use

Run the entrypoint with Blender's background interpreter. Arguments for the
script begin after Blender's `--` separator:

```powershell
blender --background --python tools/blender/hestia_asset_authoring/export_hestia_glb.py -- `
  --output build/hestia/structural-assembly.glb `
  --collection StructuralAssembly `
  --unapplied-scale warning
```

`--output` is required. `--collection` is optional; without it, the current
scene collection tree is used. `--unapplied-scale` accepts `ignore`, `warning`,
or `error`, and defaults to `warning`. The output directory must already exist
and be writable.

When run directly, the entrypoint makes its package parent importable. No
add-on installation, registration step, Blender UI, operator, panel, or menu
is part of V1. The package may also be placed on a Blender-accessible Python
path for direct module use; the CLI remains the supported export entrypoint.

## Canonical document shape

The extracted document is one closed canonical object:

```json
{
  "schema": "hestia.asset-authoring.v1",
  "asset": {
    "assetId": "asset-01",
    "assetRevision": 1,
    "representation": "StructuralAssembly",
    "metersPerUnit": 1,
    "coordinateFrame": {
      "upAxis": "+Y",
      "forwardAxis": "+Z",
      "handedness": "RIGHT"
    }
  },
  "parts": [],
  "joints": [],
  "markers": [],
  "materials": []
}
```

Canonical fields use the exact contract nesting:

- `parts[]` uses `representation`, `thinFeature.policy`,
  `thinFeature.declaredMinimumThicknessMeters`, and, when present,
  `shell.thicknessMeters` plus `shell.layers[].structuralMaterialId` and
  `shell.layers[].thicknessMeters`.
- `joints[]` uses `jointId`, `parentPartId`, `childPartId`, `jointType`,
  `breakPolicy`, optional `breakForceNewtons`, and optional
  `breakTorqueNewtonMeters`.
- `markers[]` uses `markerId`, `markerType`, optional `partId`, and
  conditional `interfaceId`.
- `materials[]` uses `renderMaterialId`, optional `structuralMaterialId`,
  optional `paletteIndex`, and optional `tags`.

Object and marker transforms are not canonical semantic fields. They remain
GLB node transforms for the downstream compiler to normalize.

## Exact one-way Blender property mapping

The adapter reads only the following exact snake_case `hestia.*` properties and
maps them once to the indicated canonical field. The right-hand names are not
accepted as Blender inputs, and values are not trimmed or normalized.

| Blender input | Role | Canonical destination |
| --- | --- | --- |
| `hestia.schema_version` | asset source | `schema` |
| `hestia.asset_id` | asset source | `asset.assetId` |
| `hestia.asset_revision` | asset source | `asset.assetRevision` |
| `hestia.representation_mode` | asset source / part | `asset.representation` / `parts[].representation` |
| `hestia.part_id` | part / marker | `parts[].partId` / `markers[].partId` |
| `hestia.parent_part_id` | part / joint | `parts[].parentPartId` / `joints[].parentPartId` |
| `hestia.render_material_id` | part / material | `parts[].defaultRenderMaterialId` / `materials[].renderMaterialId` |
| `hestia.structural_material_id` | part / material / shell layer | `parts[].structuralMaterialId` / `materials[].structuralMaterialId` / `parts[].shell.layers[].structuralMaterialId` |
| `hestia.destructible` | part | `parts[].destructible` |
| `hestia.collision_policy` | part | `parts[].collisionPolicy` |
| `hestia.navigation_policy` | part | `parts[].navigationPolicy` |
| `hestia.thin_feature_policy` | part | `parts[].thinFeature.policy` |
| `hestia.declared_minimum_thickness_m` | part | `parts[].thinFeature.declaredMinimumThicknessMeters` |
| `hestia.shell_thickness_m` | part | `parts[].shell.thicknessMeters` and the generated shell layer's `thicknessMeters` |
| `hestia.joint_id` | joint | `joints[].jointId` |
| `hestia.child_part_id` | joint | `joints[].childPartId` |
| `hestia.joint_type` | joint | `joints[].jointType` |
| `hestia.break_policy` | joint | `joints[].breakPolicy` |
| `hestia.break_force_n` | joint | `joints[].breakForceNewtons` |
| `hestia.break_torque_nm` | joint | `joints[].breakTorqueNewtonMeters` |
| `hestia.marker_id` | marker | `markers[].markerId` |
| `hestia.marker_type` | marker | `markers[].markerType` |
| `hestia.cut_interface_id` | `CutInterface` marker | `markers[].interfaceId` |
| `hestia.palette_index` | material | `materials[].paletteIndex` |

`hestia.schema_version` is required on the asset source and must be exactly
`hestia.asset-authoring.v1`. `hestia.asset_revision` is required, safe, and a
nonnegative 32-bit integer; it has no default. The asset source has exactly the
four asset-role properties shown above. The adapter supplies the contract
constants `metersPerUnit: 1` and coordinate frame `+Y` up, `+Z` forward,
right-handed; they are not alternate Blender properties.

Role requirements are:

- A part requires `part_id`, `representation_mode`, `render_material_id`,
  `destructible`, `collision_policy`, `navigation_policy`,
  `thin_feature_policy`, and positive
  `declared_minimum_thickness_m`. Parent and structural-material properties
  are optional.
- A `Shell` or `LayeredShell` part requires positive
  `shell_thickness_m` and `structural_material_id`. The adapter emits one
  shell layer from those values; the canonical shell always contains at least
  one layer. A supplied shell thickness is not silently defaulted.
- A joint requires `joint_id`, `parent_part_id`, `child_part_id`, `joint_type`,
  and `break_policy`. Break force and torque are optional, but a `Threshold`
  joint requires at least one positive value.
- A marker requires `marker_id` and `marker_type`. `part_id` is optional.
  `CutInterface` requires `cut_interface_id`; that property is rejected for
  every other marker type.
- A semantic material requires `render_material_id`. Structural material and
  palette index are optional. `palette_index` is carried as `paletteIndex` and
  is not discarded.

IDs must match `^[a-z0-9][a-z0-9._:-]{0,127}$`, are case-sensitive, and are
never trimmed or normalized. IDs are unique per category; parent, joint,
marker, and material references must resolve exactly once, and part-parent
cycles fail validation. `material_id`, `mesh_id`, and `primitive_id` are
  adapter inventory identifiers/lookups, not additional public `hestia.*`
  properties. Material inventory lookup uses the exact
  `hestia.render_material_id` property and maps it to canonical
  `renderMaterialId`.

Object role detection is fail-closed. Role-shaped properties require the
corresponding explicit role ID (`hestia.part_id`, `hestia.joint_id`, or
`hestia.marker_id`); a missing role ID is rejected. An object that resolves to
more than one active role is rejected as a multi-role object. Hestia properties
that do not identify a part, joint, or marker are rejected.
`hestia.parent_part_id` is shared across valid part and joint roles, but the
exporter fails closed when it is present without a complete role ID and the
required properties for that role.

## Validation and fail-closed behavior

The CLI extracts the asset, validates the canonical document and evaluated
geometry inventory, and prints diagnostics in stable sort order. Any
error-severity diagnostic stops before Blender GLB export. Warnings do not
stop export. Common errors include unknown or camelCase properties, a missing
  required property, a role-inappropriate property, a missing role ID,
  multiple roles on one object, invalid or duplicate IDs, unresolved
  references, a parent cycle, invalid enum values, non-finite or mirrored
  transforms, missing material assignments, missing inventory materials, a
  declared default material that is not assigned to an evaluated primitive,
  invalid geometry inventory, a missing shell layer, a non-positive thickness,
  or a non-success Blender GLB result.

Material declarations are checked against evaluated assignments. Mesh and
primitive material IDs must resolve to the evaluated material inventory, and
meshes and primitives must have material assignments. When a part has assigned
primitive materials, its declared `defaultRenderMaterialId` must be assigned to
at least one of those primitives. Geometryless structural parts do not receive
that assignment mismatch solely because they have no evaluated primitives.

The authored minimum thickness is a declaration for downstream decisions; the
downstream compiler measures actual geometry. Likewise, Blender transforms,
custom properties, and this report are handoff inputs, not runtime authority.

## GLB transport

The adapter uses a fixed GLB profile:

- `export_format: "GLB"`;
- selection export when a collection/object set is selected, otherwise the
  scene collection tree;
- `export_extras: true`, with `export_custom_properties: true` when the
  installed Blender exporter exposes that option.

Before the Blender export operator runs, source `hestia.*` properties on the
exported object/data/material blocks are temporarily removed so authoring
snake_case inputs do not leak into transport. The original properties and
selection/active-object state are restored in `finally` paths, including after
an export exception.

The CLI transport step is intended to attach canonical nested extras before
export:

- the asset source receives the asset projection used for the top-level asset
  extras;
- part, joint, and marker objects receive their corresponding canonical
  object fields under `hestia`, plus the transport-only `kind` value
  (`"part"`, `"joint"`, or `"marker"`);
- semantic materials receive canonical material fields under `hestia` when
  their exact `hestia.render_material_id` lookup resolves.

The adapter's `kind` argument (`part`, `joint`, or `marker`) is an internal
role/allow-list selector that also adds the transport-only `kind` field to node
extras. `kind` is never part of canonical semantics or material extras.

After Blender writes the temporary GLB, the CLI parses the GLB JSON chunk and
postprocesses the top-level `asset.extras.hestia`. It installs the exact asset
projection:

```json
{
  "schema": "hestia.asset-authoring.v1",
  "assetId": "asset-01",
  "assetRevision": 1,
  "representation": "StructuralAssembly",
  "metersPerUnit": 1,
  "coordinateFrame": {
    "upAxis": "+Y",
    "forwardAxis": "+Z",
    "handedness": "RIGHT"
  }
}
```

Optional asset fields are included when present. The top-level payload does
not contain the full `asset` object, `parts`, `joints`, `markers`, or
`materials` arrays. Duplicate canonical Hestia payloads found in scene extras
are removed during this postprocessing; unrelated GLB extras and non-JSON
chunks are retained.

## Atomic output and report digests

For `structural-assembly.glb`, the sidecar path is:

```text
structural-assembly.hestia-authoring-report.json
```

The CLI first creates a same-directory temporary `.tmp.glb`. Blender exports to
that path; the CLI then parses and postprocesses the temporary GLB JSON chunk,
preserving unrelated GLB extras and non-JSON chunks. It hashes the exact
postprocessed bytes and builds the report before touching the requested GLB or
sidecar. The temporary GLB is cleaned up in a `finally` path. The sidecar is
written as compact UTF-8 canonical JSON with lexical object keys,
deterministic ID/inventory ordering, LF line endings, and an atomic
same-directory temporary-file replace.

The report has exactly two top-level objects, `payload` and `digests`. The
payload contains the full canonical document under `semantics`, stable
diagnostics, evaluated geometry inventory, validation options, `schemaId`, the
delivered GLB digest as `glbSha256`, and only the requested output basename as
`outputBasename`. No machine-specific output path is included. The digests
object contains `glb_sha256` and `report_sha256`; `glb_sha256` is the lowercase
SHA-256 of the exact delivered GLB bytes, not Blender source properties or an
inferred geometry digest.

`report_sha256` is the lowercase SHA-256 of the canonical UTF-8 JSON bytes of
`payload` only. Neither `digests.report_sha256` nor `digests.glb_sha256` is in
that preimage. Canonicalization excludes timestamps, machine paths, locale,
random values, negative zero, and Blender iteration order.

The CLI does not delete the requested output before validation or export. A
validation-error report may be atomically written with `payload.glbSha256` and
`digests.glb_sha256` set to `null`; the existing GLB is untouched, while an
existing sidecar is replaced by that validation report. Export, postprocessing,
or report-building failures occur against the temporary GLB, which is cleaned
up before returning, so the prior GLB and sidecar remain in place. Final
handoff replacement writes each artifact through a same-directory temporary
file; if either replacement fails, the CLI attempts to restore both prior byte
sequences (or remove an artifact that did not previously exist). A restoration
failure is reported as an export failure and never as a successful handoff. A
successful run replaces the handoff artifacts only after the final GLB bytes
and report have been built.

## StructuralAssembly authoring workflow

1. Create an asset source in a scene or named `StructuralAssembly` collection.
   Set `hestia.schema_version`, `hestia.asset_id`,
   `hestia.asset_revision`, and `hestia.representation_mode` explicitly.
2. Author each part with all required part properties. For `Shell` or
   `LayeredShell`, set positive `hestia.shell_thickness_m` and
   `hestia.structural_material_id`.
3. Author joints and markers as separate objects with their required IDs and
   references. Keep joint and marker nodes separate from part geometry.
4. Assign material inventory IDs and optional palette metadata on the Blender
   material blocks, then run the CLI against the named collection or scene.
5. Confirm the command exits successfully, the GLB and sidecar exist beside
   the requested output, and `digests.glb_sha256` matches the delivered GLB
   bytes.
6. Hand the GLB and sidecar to the downstream compiler. Do not use Blender,
   its custom properties, or the sidecar as runtime authority.

## Verification boundary and residual risk

Host-side tests for the report and CLI behavior pass. A real Blender background
smoke run is **NOT RUN** because Blender is unavailable in this environment.
That smoke is a separate environment-bound check of the `bpy` boundary,
custom-property transport, GLB creation, and report creation; it is not a
voxelization, compiler, or runtime test. The unavailable Blender executable is
the remaining verification limitation, not a source-level blocker recorded
against the exporter contract.

The exporter remains authoring-only. It does not calculate the downstream
manifest, measure voxel occupancy, voxelize, or replace runtime geometry or
semantic authority.
