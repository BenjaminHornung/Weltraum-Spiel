# Change: Blender Hestia Asset Authoring Exporter V1

## Change
`tools-blender-hestia-asset-authoring-exporter-v1`

## Problem

Hestia-authored assets need one inspectable, deterministic authoring contract before
they can be consumed by later compilation or runtime work. A Blender scene is not
itself a runtime authority: without a versioned property schema, fail-closed
validation, canonical reports, and reproducible GLB output, authoring mistakes can
become ambiguous asset or world data.

## Goal

Provide the approved V1 Blender Hestia Asset Authoring Exporter as a pure-Python
standard-library core plus a narrow `bpy` adapter and entrypoint. It SHALL read an
entire scene or an explicitly selected collection, accept only the exact
snake_case `hestia.*` Blender input properties, map them once to the committed
camelCase canonical contract, emit a deterministic GLB with glTF extras, and
write a deterministic `<asset>.hestia-authoring-report.json` sidecar. Errors
SHALL block GLB publication and failed handoff replacement SHALL restore prior
artifacts.

The public ID contract is exactly `^[a-z0-9][a-z0-9._:-]{0,127}$`: IDs are
case-sensitive, never trimmed or normalized, and unique within their category.
The canonical report is exactly `{payload,digests}`. `report_sha256` is the
SHA-256 of the canonical UTF-8 bytes of `payload` only; the GLB digest is copied
into `payload.glbSha256` before that hash is computed. A node `kind` value is
transport-only metadata and is not canonical semantics or material data.

## Scope

- Define the Hestia asset-authoring schema, model, canonical serialization,
  validation diagnostics, report, and deterministic hash workflow.
- Preserve the exact committed adapter mapping from Blender snake_case properties
  to canonical camelCase fields, including asset, part, joint, marker, shell,
  thin-feature, and material mappings.
- Implement the approved module structure: `schema.py`, `model.py`,
  `validation.py`, `canonical.py`, `report.py`, `blender_adapter.py`,
  `export_hestia_glb.py`, `__init__.py`, and tests.
- Keep the core Python-stdlib-only and keep `bpy` imports confined to the Blender
  adapter and exporter entrypoint.
- Support the exact CLI contract:
  `blender --background file.blend --python export_hestia_glb.py -- --collection Export --output asset.glb`.
- Add implementation documentation for the schema, authoring workflow, CLI,
  validation/report output, deterministic hashing, and verification evidence.

## Exclusive scope and hard boundaries

- This slice is an authoring/export tool contract only; it does not implement the
  product runtime, terrain, world generation, compilation, streaming, or gameplay.
- Blender is an authoring input and export adapter, never runtime authority.
- V1 SHALL NOT voxelize, generate, edit, or persist voxel data.
- No changes to browser runtime code, runtime schemas, world/voxel authority,
  production assets, scenes, package or lock files, database/data, or unrelated
  documentation are in scope for this artifact slice.
- The exporter SHALL not silently repair invalid authoring data, invent missing
  required properties, or publish a GLB when validation has errors.
- Unknown, canonical camelCase, role-inappropriate, missing, or malformed
  `hestia.*` inputs SHALL fail closed.
- The exporter SHALL build a temporary GLB and report first, replace both
  handoff artifacts through same-directory temporary files, and restore both
  previous byte sequences if either replacement fails.
- No timestamps, locale-dependent formatting, random values, Blender file times,
  absolute machine paths, or unordered input iteration may affect canonical output,
  reports, or hashes.

## Deliverables

- A decision-complete specification of the schema, validation rules, canonical
  report, exact property mappings, adapter boundary, transport-only node kind,
  CLI, tests, atomic rollback behavior, docs, and verification evidence.
- Implementation-ready tasks that produce the pure core, Blender adapter/exporter,
  focused tests, golden reports, documentation, and verification records in later
  slices.

## Success

The four change artifacts are coherent and ready for `specs_validate`; the future
implementation can prove deterministic valid output, fail-closed invalid output,
the exact one-way adapter mapping and `bpy` import boundary, transport-only node
metadata, report hashing over payload bytes only, atomic rollback, and the
explicit no-voxelization/non-runtime-authority boundaries without adding product
or architecture decisions.
authority boundaries without adding product or architecture decisions.
