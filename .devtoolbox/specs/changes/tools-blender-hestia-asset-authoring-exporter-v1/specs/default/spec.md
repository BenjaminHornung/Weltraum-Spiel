# Capability: Blender Hestia Asset Authoring Exporter V1

## Requirement: versioned authoring contract

The exporter SHALL implement the schema ID `hestia.asset-authoring.v1` and the
canonical top-level fields `schema`, `asset`, `parts`, `joints`, `markers`, and
`materials`. Blender custom properties are adapter-only inputs. The adapter SHALL
read only the exact snake_case `hestia.*` names in this mapping and SHALL map
each value once to the indicated camelCase canonical destination:

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

Canonical camelCase names SHALL NOT be accepted as Blender inputs. Values SHALL
not be trimmed or normalized. Asset source properties are exactly
`schema_version`, `asset_id`, `asset_revision`, and `representation_mode`; the
revision is required and has no default. Parts require their role fields,
including a positive declared minimum thickness; shell representations require
positive shell thickness and a structural material. Joints, markers, and
materials SHALL use their role-specific mappings and exact references.

`hestia.representation_mode` SHALL accept only `Solid`, `Shell`, `LayeredShell`,
`StructuralAssembly`, `ModularPart`, `Decorative`, or `Hybrid`.
`hestia.thin_feature_policy` SHALL accept only `Reject`, `PreserveAsBeam`,
`PreserveAsRod`, `PreserveAsShell`, or `DecorativeOnly`.

All public IDs SHALL match exactly `^[a-z0-9][a-z0-9._:-]{0,127}$`, are
case-sensitive, SHALL never be trimmed or normalized, and SHALL be unique per
category. Parent, joint, marker, and material references SHALL resolve exactly
once; part-parent cycles SHALL fail. Linear values SHALL be meters.

## Requirement: pure core and Blender boundary

The pure core SHALL use Python standard-library modules only. Direct `bpy`
imports SHALL occur only in `blender_adapter.py`; `export_hestia_glb.py` SHALL
be a CLI that imports the adapter only. Pure-core imports and tests SHALL run
without Blender. The adapter SHALL read either the
complete scene or a named selected collection and SHALL inventory evaluated
meshes/primitives/materials before constructing core models. It SHALL pass only
pure-core models across the boundary.

### Scenario: pure-core import without Blender

- **Given** a Python environment without Blender's `bpy` module
- **When** the pure schema, model, canonical, report, validation, and test modules
  are imported or run
- **Then** they SHALL complete without attempting a `bpy` import
- **And** a static boundary check SHALL find no `bpy` import outside the adapter
  and CLI entrypoint.

## Requirement: deterministic validation

Validation SHALL be deterministic and fail closed. It SHALL detect duplicate
Asset/Part/Marker/Joint/Material IDs, IDs not matching
`^[a-z0-9][a-z0-9._:-]{0,127}$`, non-meter units, non-finite or non-exportable
transforms, unexplained negative determinants, unapplied scale (warning by
default and error when selected by option), mesh/primitive/material inventory
problems, non-manifold or open geometry, degenerate faces, missing material
assignment, non-closed `Solid` volume, missing or non-positive `Shell`
thickness, critical thin features without explicit policy, unresolved references,
parent cycles, and unknown, canonical camelCase, role-inappropriate, missing, or
malformed properties.

### Scenario: valid StructuralAssembly

- **Given** a normalized `StructuralAssembly` with unique valid IDs, finite meter
  transforms, complete required properties, assigned materials, and valid closed
  geometry
- **When** the pure validator runs
- **Then** it SHALL return no error diagnostics
- **And** the report SHALL be eligible for GLB export.

### Scenario: duplicate IDs and invalid IDs

- **Given** two objects share an Asset, Part, Marker, or Joint ID
- **And** another required ID violates the stable ASCII syntax
- **When** validation runs
- **Then** it SHALL return deterministic blocking diagnostics identifying the kind,
  value, and affected objects
- **And** it SHALL not silently rename either object.

### Scenario: Solid requires closed volume

- **Given** a `Solid` representation whose evaluated mesh is open or non-manifold
- **When** validation runs
- **Then** it SHALL return a blocking closed-volume diagnostic
- **And** the asset SHALL not be exportable.

### Scenario: Shell requires thickness

- **Given** a `Shell` representation with missing, non-finite, or non-positive
  `hestia.shell_thickness_m`
- **When** validation runs
- **Then** it SHALL return a blocking shell-thickness diagnostic.

### Scenario: critical thin feature requires policy

- **Given** a critical thin feature without an explicit valid
  `hestia.thin_feature_policy`
- **When** validation runs
- **Then** it SHALL return a blocking thin-feature-policy diagnostic
- **And** it SHALL not infer a preservation mode from geometry or object names.

### Scenario: transform and scale diagnostics

- **Given** an object with a non-finite transform or unexplained negative
  determinant
- **When** validation runs
- **Then** it SHALL return a blocking transform diagnostic
- **Given** an otherwise exportable object with unapplied scale
- **When** validation runs with default options
- **Then** it SHALL return the configured warning
- **When** validation runs with the applied-scale-required option
- **Then** it SHALL return a blocking error instead.

### Scenario: unknown required property fails closed

- **Given** a required Hestia property is missing, malformed, or has an unknown
  value/type
- **When** normalization or validation runs
- **Then** it SHALL return a blocking schema diagnostic
- **And** it SHALL not drop, default, or reinterpret the property.

## Requirement: canonical reports and reproducibility

The canonical workflow SHALL sort unordered inputs and keys, use stable compact
UTF-8 JSON and finite-number formatting, and exclude timestamps, locale, random
values, Blender file times, absolute paths, and input iteration order. The report
SHALL contain deterministic validation/inventory data and SHALL be stable when
equivalent input objects are supplied in a different order.

The sidecar SHALL have exactly two top-level members, `payload` and `digests`.
`payload` SHALL contain the canonical report data, including `glbSha256` and only
the requested output basename. `digests` SHALL contain exactly `glb_sha256` and
`report_sha256`. `glb_sha256` SHALL be the lowercase SHA-256 of the exact
delivered GLB bytes and SHALL be copied into `payload.glbSha256`. The
`report_sha256` preimage SHALL be only the canonical UTF-8 JSON bytes of
`payload`; neither member of `digests` SHALL be included in that preimage.

### Scenario: stable report across input order

- **Given** equivalent normalized objects supplied in two different input orders
- **When** canonical report generation runs
- **Then** the report bytes and report hash SHALL be identical.

### Scenario: same inputs produce same hashes

- **Given** the same normalized input, evaluated inventory, output basename, and
  exporter options
- **When** canonical report and digest generation runs twice
- **Then** the GLB/report digest values SHALL be identical
- **And** no timestamp, locale, random, or Blender file-time field SHALL appear.

### Scenario: report hash uses payload only

- **Given** a canonical report payload and its emitted `digests` object
- **When** `report_sha256` is computed
- **Then** it SHALL hash only the canonical UTF-8 bytes of `payload`
- **And** changing either digest member SHALL not change that preimage.

## Requirement: export behavior and CLI

The CLI SHALL support exactly:

```text
blender --background file.blend --python export_hestia_glb.py -- --collection Export --output asset.glb
```

The exporter SHALL read the scene or selected collection, inventory evaluated
content, normalize properties, validate, and invoke Blender's glTF GLB exporter
with canonical Hestia extras. A node `kind` value SHALL be transport-only and
limited to `part`, `joint`, or `marker`; it SHALL not be part of canonical
semantics or material extras. Source snake_case properties SHALL be temporarily
removed for transport and restored in all exit paths. The exporter SHALL write
`<asset>.hestia-authoring-report.json` beside the output and SHALL not create or
replace a GLB when validation has errors.

### Scenario: valid collection export

- **Given** a valid Blender file and an `Export` collection satisfying the V1
  contract
- **When** the exact CLI is run
- **Then** Blender SHALL export a GLB containing normalized Hestia extras
- **And** the sidecar report SHALL be written with the GLB SHA-256 and the
  non-self-referential canonical report SHA-256.

### Scenario: validation errors block GLB

- **Given** a selected collection with any blocking validation diagnostic
- **When** the exporter CLI runs
- **Then** it SHALL exit non-zero
- **And** it SHALL not create or replace the requested GLB
- **And** its report SHALL identify the deterministic diagnostics.

### Scenario: atomic rollback on handoff failure

- **Given** existing GLB and sidecar artifacts and a valid export
- **When** export, postprocessing, report construction, or either final artifact
  replacement fails
- **Then** temporary artifacts SHALL be cleaned up
- **And** the prior GLB and sidecar byte sequences SHALL be restored
- **And** the command SHALL fail closed without claiming a successful handoff.

## Requirement: documentation and authority boundaries

The implementation documentation SHALL explain the schema and enum values, the
authoring workflow, exact CLI, validation/report diagnostics, deterministic hash
semantics, the stdlib/`bpy` boundary, and verification evidence. It SHALL state
that Blender is not runtime authority and that V1 performs no voxelization and
does not create runtime world or voxel data.

## Requirement: verification evidence

The implementation SHALL provide pure-core tests for a valid StructuralAssembly,
duplicate IDs, invalid IDs, Solid plus open geometry, Shell without thickness,
thin feature without policy, negative determinant, stable report across input
order, same-input same-hash behavior, no timestamp/locale/random dependence, and
unknown required property failure. Blender smoke verification is optional when
Blender is available.

The evidence protocol SHALL record results for `unittest discover`, `compileall`,
the static `bpy` boundary check, golden reports, limited diff inspection, scope
and secret scan, independent Reviewer and Reviewer-GLM review, and completion
preflight. This artifact-writing slice itself SHALL not create executions, mutate
test data, implement product/tool code, commit, or push.
