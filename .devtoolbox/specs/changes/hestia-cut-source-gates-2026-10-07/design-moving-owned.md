# Gate B: exact owned subset decision before implementation

Final implementation supersedes the preliminary ownership assumption below. See REVIEW.md and REPORT.md: only private ownedGraphs, populated after completed full owned normalization, are reused. Public issuedObjects membership alone is insufficient.

The candidate remains inside the existing Physics Worker. Reference and direct-v1 stay selectable. The new session option changes Moving subset creation only; Terrain retains direct-v1 so its costs are not mixed into B.

## Removed work
For each child and the removed-material Source: remove general structuralReconstructionSteps, source-binding/material-table validation and copying, brick/state reconstruction, sorting of already canonical selected bricks, recursive deepFreeze, and the generic full-graph content projection. Keep actual subset selection/membership, command/evidence handling, connectivity, physical mass/inertia/collider derivation, full canonical content/evidence hash bytes, Native/render admission, and all public persistence validation.

## Actual proof and ownership
Private ownedGraphs in structural/model.ts is populated only after completed reserve-based normalization into first-party literal containers or completed internal subset construction. General issuedObjects remains a public-validation witness and is not that capability. Exact general Sources are normalized once with identical content/evidence hashes before reuse. Core copies selectors through a fixed own numeric length and scans private ancestor cells with numeric indices, verifies material and occupancy, and reuses only genuine immutable state/metadata. New brick and array containers are created and frozen internally; no caller-supplied brick or state can be reused directly. Cancellation before completion issues no final owned graph. Shared readonly records require immutable aliases, not exclusive reachability.

## Preserved identities
Use precisely the old direct-v1 objectId, frame, Adaptive source binding, full materials and all voxel State fields (including partId, semanticKey, damageKey). New fragments retain revision 0 and empty anchors/joints/evidence. Hash the identical full canonical content projection with the existing bounded UTF-8/FNV cursor, and the identical empty evidence array. Assert byte-equal encodeStructuralObject against the unchanged old reconstruction for the same inputs; compare numeric mass/inertia/colliders and actual Save/ColdLoad. Do not claim equality with the older reference AddBox binding, which already intentionally differs from direct-v1. No persistence schema or public encoder change.

## Finite decision
One bounded Moving candidate, ten balanced built comparison pairs against direct-v1, plus real Native/Render/consecutive Cut/Save/ColdLoad and fault checks. Keep only a repeatable complete-flow gain with preserved behavior and resources. A promising B triggers C; a failed/unsupported B does not authorize claiming original latency/14-population/42/1400 acceptance.
