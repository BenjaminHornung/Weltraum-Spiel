# Tasks: Blender Hestia Asset Authoring Exporter V1

## 1. Specification and boundary

- [x] 1.1 Validate `proposal.md`, `design.md`, and `specs/default/spec.md` against
  the approved `hestia.asset-authoring.v1` requirements, including the exact
  mapping table, without adding product or runtime decisions.
- [x] 1.2 Record the exclusive tool scope and prohibited paths: no browser/runtime
  code, runtime/world/voxel authority, voxelization, production asset mutation,
  scenes, package/lock files, database/test-data writes, or unrelated docs.
- [x] 1.3 Confirm the implementation location contains only the approved module
  names `schema.py`, `model.py`, `validation.py`, `canonical.py`, `report.py`,
  `blender_adapter.py`, `export_hestia_glb.py`, `__init__.py`, and tests, plus the
  explicitly approved documentation/evidence outputs.
- [x] 1.4 Confirm the public ID contract is exactly
  `^[a-z0-9][a-z0-9._:-]{0,127}$`, with no trimming or normalization, and that
  adapter input is one-way snake_case `hestia.*` to canonical camelCase.

## 2. Pure core contract

- [x] 2.1 Add the schema ID, exact Blender input vocabulary and committed
  snake_case-to-camelCase mapping destinations, exact ID regex, representation
  enum, and thin-feature enum in `schema.py`/the adapter boundary.
- [x] 2.2 Add stdlib-only normalized models for assets, parts, markers, joints,
  evaluated inventory, transforms, diagnostics, validation options, reports, and
  export results in `model.py`.
- [x] 2.3 Add deterministic fail-closed normalization and validation for units,
  finite exportable transforms, negative determinants, scale policy, inventory,
  topology, materials, solid closure, shell thickness, critical thin features,
  references/cycles, and unknown/camelCase/role-inappropriate/missing/malformed
  properties in `validation.py`.
- [x] 2.4 Ensure every pure-core import and test works without Blender and that no
  pure module imports `bpy`.

## 3. Canonical report and hashing

- [x] 3.1 Implement stable UTF-8 JSON canonicalization with sorted keys/arrays,
  deterministic finite-number formatting, meter values, and no timestamps,
  locale, random values, Blender file times, absolute paths, or input-order
  dependence in `canonical.py`.
- [x] 3.2 Implement deterministic validation/inventory report construction in
  `report.py`, including stable diagnostic codes/order and normalized Hestia
  properties.
- [x] 3.3 Implement the documented report shape exactly as `{payload,digests}`:
  hash the exact delivered GLB bytes, include that digest as `payload.glbSha256`,
  hash only the canonical UTF-8 bytes of `payload` for `report_sha256`, then emit
  `digests.glb_sha256` and `digests.report_sha256`.
- [x] 3.4 Add golden reports and tests proving input-order stability, same-input
  same-hash behavior, and absence of timestamp/locale/random dependence.

## 4. Blender adapter and export CLI

- [x] 4.1 Implement `blender_adapter.py` as the only scene-reading boundary that
  may import `bpy`; support the complete scene and `--collection` selection.
- [x] 4.2 Inventory evaluated meshes/primitives/materials, preserve stable object
  identity for diagnostics, normalize the exact committed Hestia mapping, reject
  canonical camelCase input, and pass only pure-core models across the boundary.
- [x] 4.3 Implement `export_hestia_glb.py` as the CLI entrypoint that imports only
  `blender_adapter.py`; direct `bpy` imports are exclusive to
  `blender_adapter.py`; support exactly
  `blender --background file.blend --python export_hestia_glb.py -- --collection Export --output asset.glb`.
- [x] 4.4 Invoke Blender's glTF GLB exporter with canonical Hestia extras; keep
  node `kind` transport-only and out of canonical semantics/material extras;
  write the sidecar and enforce no GLB creation/replacement on validation errors.
- [x] 4.5 Build both artifacts from a same-directory temporary GLB/report,
  replace each through a same-directory temporary file, clean all temporary
  artifacts, and restore both prior byte sequences if either replacement fails.
- [x] 4.6 Add the static `bpy` import-boundary check and an optional Blender smoke
  test that is skipped, not failed, when Blender is unavailable.

## 5. Core tests and documentation

- [x] 5.1 Add pure-core tests for valid StructuralAssembly, duplicate IDs, invalid
  IDs, Solid plus open geometry, Shell without thickness, thin feature without
  policy, negative determinant, unknown/camelCase property failure, the exact
  mapping table, transport-only node kind, and all canonical determinism cases.
- [x] 5.2 Add docs for the schema/property and enum contract, authoring workflow,
  exact CLI, validation/report diagnostics, deterministic hash semantics, stdlib/
  `bpy` boundary, Blender non-authority, and explicit no-voxelization boundary.
- [x] 5.3 Save implementation evidence as deterministic JSON/Markdown or golden
  report artifacts in the approved change evidence location; do not add runtime
  screenshots or claim runtime/world behavior.

## 6. Verification and completion

- [x] 6.1 Run `python -m unittest discover` for the pure-core suite.
- [x] 6.2 Run `python -m compileall` over the approved Python tool/test scope.
- [x] 6.3 Run the static `bpy` boundary check, golden-report comparison, report
  payload-only hash check, atomic rollback check, and the optional Blender smoke
  test when Blender is available.
- [x] 6.4 Inspect `git diff --check` and a limited `git diff` proving only the
  approved implementation/docs/evidence scope changed; run scope and secret
  scans without exposing secret values.
- [x] 6.5 Obtain the required independent Reviewer and Reviewer-GLM findings,
  address only confirmed in-scope issues, and rerun affected verification.
- [x] 6.6 Run DevToolbox completion preflight and record all verification results;
  do not close tasks without fresh evidence. This artifact-writing slice does not
  create an execution, mutate test data, commit, or push.
