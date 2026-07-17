# Design: Blender Hestia Asset Authoring Exporter V1

## Change

`tools-blender-hestia-asset-authoring-exporter-v1`

## Boundary and module structure

The approved tool is split into a pure core and one Blender boundary:

- `schema.py`: schema ID, required property names, enum values, and schema-level
  constants.
- `model.py`: stdlib-only typed data structures for normalized assets, parts,
  markers, joints, meshes/primitives, materials, transforms, diagnostics, and
  export options.
- `validation.py`: deterministic, side-effect-free validation of normalized core
  data.
- `canonical.py`: deterministic serialization and SHA-256 helpers.
- `report.py`: deterministic report payload and sidecar assembly.
- `blender_adapter.py`: the only scene-reading layer; it may import `bpy`,
  evaluate meshes, and map Blender data into core models.
- `export_hestia_glb.py`: the Blender CLI entrypoint; it may import `bpy`, parse
  the approved arguments, invoke the adapter/core, and call Blender's glTF GLB
  exporter with extras.
- `__init__.py` and `tests`: package surface and pure-core tests.

The pure modules and their tests SHALL import without Blender installed. No module
other than the adapter and entrypoint may import `bpy`; a static boundary check
SHALL enforce this.

## Schema and mapping contract

The schema ID is exactly `hestia.asset-authoring.v1`. The canonical document has
the exact top-level fields `schema`, `asset`, `parts`, `joints`, `markers`, and
`materials`. Canonical fields use camelCase. Blender custom properties are an
adapter-only input vocabulary: the adapter reads the exact snake_case
`hestia.*` names below, maps each value once to its canonical destination, and
never accepts canonical camelCase names as Blender inputs.

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

Asset source properties are exactly `schema_version`, `asset_id`,
`asset_revision`, and `representation_mode`; the revision is required and has
no default. Parts require the part fields represented above, including a
positive `declared_minimum_thickness_m`; shell representations additionally
require positive shell thickness and a structural material. Joints and markers
use their role-specific fields and exact references. Material inventory uses
`hestia.render_material_id`. Values are not trimmed or normalized, and unknown,
camelCase, role-inappropriate, missing, or malformed properties fail closed.

The representation enum is exactly: `Solid`, `Shell`, `LayeredShell`,
`StructuralAssembly`, `ModularPart`, `Decorative`, `Hybrid`. The thin-feature
enum is exactly: `Reject`, `PreserveAsBeam`, `PreserveAsRod`,
`PreserveAsShell`, `DecorativeOnly`.

Every public ID uses exactly `^[a-z0-9][a-z0-9._:-]{0,127}$`, is case-sensitive,
is never trimmed, and is unique within its category. References resolve exactly
once and parent cycles are invalid. Linear authoring and export quantities are
meters. Transforms must use finite exportable values; scale is dimensionless,
and no implicit unit conversion may change canonical values. The adapter records
the evaluated mesh/primitive and material inventory used for validation and
export.

## Deterministic workflow

1. The entrypoint parses the exact approved CLI options and chooses the complete
   scene or the named selected collection (`--collection Export`).
2. The adapter evaluates the selected objects, inventories meshes/primitives and
   materials, normalizes Hestia properties, and converts them to pure-core models.
3. The core validates IDs, properties, units, transforms, geometry, materials,
   representation rules, and thin-feature policy in stable diagnostic order.
4. If errors exist, the command exits non-zero, does not create or replace the
   requested GLB, and may atomically write a diagnostic sidecar with null GLB
   digests.
5. If validation succeeds, the exporter attaches canonical nested Hestia extras,
   uses `kind` only as transport-only node metadata, and Blender's glTF GLB
   exporter writes the selected evaluated content.
6. The exporter writes a same-directory temporary GLB, postprocesses it, hashes
   the exact delivered bytes, builds the canonical report payload, computes
   `report_sha256` over the canonical UTF-8 bytes of that payload only, and
   replaces the GLB and sidecar with rollback protection.

The adapter SHALL support both reading the complete scene and reading an
explicitly selected collection. The exported inventory is evaluated, not merely
the unevaluated object declarations. The Blender glTF exporter is the only GLB
writer in scope. Source snake_case properties are temporarily removed during
transport and restored, including after an export exception; canonical nested
extras are attached only for transport. A node's `kind` is one of `part`,
`joint`, or `marker`, is transport-only, and is excluded from canonical semantics
and material extras.

## Validation contract

Validation SHALL report, in deterministic category/code/order, at least:

- duplicate Asset, Part, Marker, Joint, and Material IDs;
- IDs outside `^[a-z0-9][a-z0-9._:-]{0,127}$`;
- non-meter or inconsistent unit declarations;
- non-finite or otherwise non-exportable transform values;
- unexplained negative transform determinants;
- unapplied scale as a warning by default and as an error when the validation
  option requires applied scale;
- missing or inconsistent mesh/primitive/material inventory;
- non-manifold and open-geometry diagnostics;
- degenerate faces;
- missing material assignment;
- `Solid` representations that do not provide a closed volume;
- `Shell` representations without a positive finite `hestia.shell_thickness_m`;
- critical thin features without an explicit valid
  `hestia.thin_feature_policy`;
- unknown, camelCase, role-inappropriate, missing, or malformed properties,
  fail-closed;
- unresolved references, duplicate references where exactly one is required,
  and part-parent cycles.

Negative determinants are blocking unless the source contains an explicit
authoring explanation accepted by the validator; the diagnostic must identify the
affected object and determinant. No validator rule may silently reinterpret a
negative determinant as a mirrored but valid asset.

## Canonical report and hash semantics

Canonical serialization is UTF-8 JSON with sorted object keys, stable sorted
arrays, no insignificant whitespace, and deterministic finite-number formatting.
IDs, object paths, meshes, primitives, materials, transforms, normalized
properties, diagnostics, options, and output basenames are sorted and represented
without absolute paths. Locale, random values, timestamps, Blender file times,
and input collection/object iteration order are excluded.

The sidecar has exactly a `payload` member and a `digests` member. `payload`
contains the complete canonical report data, including the final output basename
and `glbSha256`; `digests` contains exactly `glb_sha256` and `report_sha256`.
`report_sha256` is SHA-256 over the canonical UTF-8 bytes of `payload` only. The
emitted sidecar is:

```json
{
  "payload": { "...": "canonical report data" },
  "digests": {
   "glb_sha256": "...",
   "report_sha256": "..."
  }
}
```

The `glb_sha256` in `digests` is computed from the exact emitted GLB bytes and is
also copied into `payload` as `glbSha256` before `report_sha256` is computed. The
digest member is excluded from the report preimage, so neither digest is
self-referential. The same inputs, evaluated inventory, exporter options, and
Blender exporter version shall produce the same canonical report and hashes; a
Blender exporter change is reported as input/tool evidence rather than hidden in
a timestamp.

## Tests, docs, and evidence

Pure-core tests cover a valid `StructuralAssembly`, duplicate IDs, the exact ID
regex, `Solid` plus open geometry, `Shell` without thickness, a thin feature
without a policy, negative determinant, stable report across input order,
same-input same-hashes, absence of timestamp/locale/random dependence, and
unknown or camelCase property failure. Adapter/CLI tests cover the exact mapping
table, transport-only node kind, temporary property restoration, GLB/report
atomic replacement and rollback, and fail-closed validation. A Blender smoke test
is optional when Blender is available and must not make pure-core verification
depend on Blender.

Documentation SHALL explain the schema/property and enum contract, authoring
workflow, exact CLI, validation/report diagnostics, deterministic hash semantics,
the `bpy` boundary, and the fact that Blender is not runtime authority. It SHALL
state explicitly that V1 performs no voxelization and does not create runtime
world/voxel data.

## Risks

- Blender's evaluated geometry and glTF exporter can vary by Blender version;
  smoke evidence must record the tool version without putting it into a timestamped
  or otherwise nondeterministic report field.
- Geometry diagnostics may be expensive on large scenes; the adapter must keep
  evaluation and inventory explicit rather than hiding failures behind partial
  exports.
- Blender custom-property typing and missing values can be ambiguous; normalization
  must fail closed and preserve the offending object/property in diagnostics.
- A GLB written before report generation can become stale if report writing fails;
  implementation must build both artifacts from a temporary GLB, replace them
  with same-directory temporary files, restore both prior byte sequences on any
  replacement failure, and never claim a complete export without both artifacts.
