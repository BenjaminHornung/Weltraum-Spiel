# Tasks: Hestia Voxel Runtime V2 Coast/Lush Visual Parity V1

Tasks close only after fresh cited evidence and DevToolbox completion preflight.
One execution owns this complete change, including retries, review and final
verification. The historical runtime V2 change is read-only baseline evidence.

## Phase 0 — Baseline and visual audit

- [x] 0.1 Verify and decode the four committed current baseline images and all
  supplied reference candidates; classify exactly six target-role images and
  record exact source filenames/dimensions/hashes.
- [x] 0.2 Build baseline commit `b9ba0e14...` in production preview, reproduce
  the four current captures, and record frame p50/p95/p99, app/main-thread
  timing, Long Tasks, draw calls, visible chunks, vertices/triangles,
  generation/meshing and cut-to-visible latency.
- [x] 0.3 Complete `tests/visual-gap-matrix.md` with strict 0–5 current scores,
  target mapping and current→target evidence before visual implementation.

## Phase 1 — Pure macro descriptor and Near content

- [x] 1.1 Implement the immutable deterministic macro descriptor and pure sample
  contract; add same-seed/changed-seed and Near/Mid/Far coastline agreement tests.
- [x] 1.2 Replace regular generator masks with irregular islands, massif,
  valleys, channels, variable cliffs/terraces, strata and material facts while
  preserving authority footprint, spawn, palette IDs and all existing authority
  tests.
- [ ] 1.3 Implement four connected tree archetypes, biome-cluster placement,
  roots/branches and grouped support-checked Near flora; add deterministic
  archetype/clearing/connectedness tests.

## Phase 2 — Mid/Far and environment projection

- [ ] 2.1 Implement bounded Mid/Far proxy geometry from the same descriptor with
  overlap/occlusion rules, radial horizon coverage and no rectangular edge.
- [ ] 2.2 Implement static circular/channel water with shore/depth/Fresnel cues,
  Three-owned sky/horizon, batched low-poly clouds, fog/haze and documented
  lighting/shadow/AO budgets.
- [ ] 2.3 Add four deterministic beauty camera presets and a fixed screenshot
  capture protocol; no debug UI in Beauty captures.

## Phase 3 — Materials, batching and vegetation lifecycle

- [ ] 3.1 Replace per-chunk terrain material ownership with bounded region
  geometry replacement and shared palette-aware material attributes for tint,
  AO, roughness, emissive and wetness.
- [ ] 3.2 Add render-only Mid/Far trees and small flora using bounded instanced or
  merged products; support checks and dirty-bound invalidation must be explicit.
- [ ] 3.3 Add renderer/environment/vegetation disposal and replacement tests;
  measure draw-call reduction before accepting added visual density.

## Phase 4 — Integration and iterative visual evidence

- [ ] 4.1 Integrate descriptor/proxies/environment/vegetation/cameras through the
  existing renderer/runtime port without changing authority truth or route gate.
- [ ] 4.2 Produce `iteration-00-baseline` through `iteration-04-final-candidate`
  with the same four cameras, 1920×1080 settings, side-by-side boards and
  per-iteration score/regression notes.
- [ ] 4.3 Preserve and verify first-person cutter, authority collision,
  revision-bound local remesh and render-only support invalidation.

## Phase 5 — Verification, review and owner gate

- [ ] 5.1 Run focused V2 units, full unit/build, core/live/UI E2E, focused V2 E2E
  twice without retry, production preview, 100-cut stress, image decode/hash,
  forbidden-import, package-lock/Assets and disposal checks.
- [ ] 5.2 Compare baseline/final telemetry against the stated render budget and
  record original 16.8ms baseline honestly; do not waive failed targets.
- [ ] 5.3 Complete independent technical review of second truth, transitions,
  batching/materials, water, vegetation invalidation, determinism and disposal.
- [ ] 5.4 Complete final screenshot rubric and stop at
  `AWAITING_OWNER_VISUAL_APPROVAL` until the repository owner responds.
- [ ] 5.5 Publish only after the gate: normal PR only for functional PASS plus
  owner approval; otherwise clearly marked draft/NO-GO visual candidate.
