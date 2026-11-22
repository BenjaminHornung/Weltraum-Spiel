# R05 pre-step query publication

This isolated native experiment uses the exported R03 Rust inputs referenced by the shipped R05 profile. The candidate keeps the existing WASM ABI. Product builds keep using their pinned R05 artifact.

The shipped Rust binding constructs a fresh `DefaultBroadPhase` on each explicit publication and inserts every enabled collider. The implementation is in `handoff/hestia-other-pc-2026-10-13/ProducerSource/PHY-01/phy-01-rapier-followup/revisions/positive-margin-safe-compile-closure-r03/candidate/source/bindings/typescript/src/geometry/broad_phase.rs`, lines 33 to 42. Ordinary and event-emitting physics steps discard the transient tree in `bindings/typescript/src/pipeline/physics_pipeline.rs`. World serialization retains the solver tree, and a restored owner starts with no transient query tree. The compiled R05 binding exports one publication method. Its input is the whole collider set.

The candidate copies the spatial tree from the solver on the first explicit query publication after a step or restore. It then reads Rapier's pending removed and modified handles without consuming them. Removed arena slots are processed first. Each still-live handle resolves its current generation and enabled state, so a newly inserted collider can reuse a removed slot. Subsequent publications in the same tick reuse the transient query tree. The original solver tree, contact pairs and outside ownership of the physics world are preserved.

The first tree copy still scales with scene size. Repeated publications before the next solver step can revisit earlier changes. The qualification covers both a cut with a prior solver step and a cut immediately after the fixture's last publication. Raw solver query AABBs can include swept motion bounds. AABB overlap queries are conservative. Ray and capsule checks validate the actual shape.

## Reproduce

Use a Rust toolchain with the `wasm32-unknown-unknown` standard library and `wasm-bindgen 0.2.129`. Use the same compiler for both builds. From `apps/weltraum-browser`, prepare the normal R05 wrapper with `npm run prebuild`. Set `candidate_dir` to a fresh directory outside the repository.

```sh
candidate_dir=/tmp/hestia-native-query
python tests/performance/native-query/build.py "$candidate_dir" control
python tests/performance/native-query/build.py "$candidate_dir" candidate
for variant in control candidate; do
  export HESTIA_QUERY_API="$candidate_dir/$variant/api"
  export HESTIA_QUERY_WASM_SHA256="$(node -p "require('$candidate_dir/$variant/build.json').wasmSha256")"
  for HESTIA_QUERY_PRESTEP in 0 1; do
    export HESTIA_QUERY_PRESTEP
    export HESTIA_NATIVE_OCCUPANCY_OUT="$candidate_dir/$variant/occupancy-$HESTIA_QUERY_PRESTEP.json"
    HESTIA_NATIVE_OCCUPANCY_SAMPLES=21 npm test -- --config tests/performance/native-query/vitest.config.mts
  done
done
```

The build script records the source-tree, raw-WASM and bound-WASM digests. The tests hash the embedded bytes actually imported by the API. The lifecycle oracle covers removal and same-slot reuse, moving attached shapes, explicit collider disabling and enabling, repeated pre-step publication, snapshot restore and the following real solver contact. Occupancy timings exclude browser transport and frame scheduling.
