# Design: V2 Coast/Lush Presentation

## Change

`browser-hestia-voxel-v2-coast-lush-visual-parity-v1`

## Architecture boundary

`MacroWorldDescriptor` is pure, immutable, seed/version/coordinate-derived
description data. It may provide terrain height, water/channel facts, slope,
moisture, biome and deterministic anchors, but it never stores mutable cells,
edit sequence, collision state or render objects. `VoxelAuthority` remains the
sole Near truth and continues to own all edits, DDA, collision, revisions and
dirty bounds.

### Three presentation scales

1. **Near**: existing 0.25m authority/chunks, edited and collision-backed. Its
   generator samples the descriptor and uses the descriptor's material facts.
2. **Mid**: a bounded 0.5–1m render-only proxy around the Near footprint and
   approach space. It uses the same descriptor and overlaps Near terrain with a
   small hidden-under offset; it is never queried by gameplay.
3. **Far**: a 2–4m circular/radial proxy out to roughly 500m, including island
   chains, mountain silhouettes and ocean horizon. Fog/haze hides the finite
   proxy limit; no rectangular plane edge is exposed.

The proxy geometry is disposable and rebuilt only as a presentation product.
Near edits invalidate only affected render regions and support-checked
render-only flora; they do not mutate or replan Mid/Far truth.

## Rendering ownership

- `voxelV2WorldPresentation.ts` owns descriptor-driven Mid/Far geometry and
  horizon-scale water/sky/cloud resources where separation reduces renderer
  complexity.
- `voxelV2Vegetation.ts` owns deterministic render-only instances and disposal.
- `voxelV2CameraPresets.ts` owns fixed beauty/player poses and targets.
- `voxelV2Renderer.ts` remains the integration/disposal boundary and projects
  neutral mesh products only.
- Near terrain is grouped into bounded region geometries with one shared
  palette-aware terrain material. A local edit replaces only the affected region
  geometry; material ownership is renderer-wide, not per chunk.

## Material and lighting path

Near mesh products retain material ID and AO attributes. A shared Three material
uses vertex attributes for deterministic tint/wetness and shader-side
roughness/emissive classes derived from the stable palette. No package change or
external texture is required. Mid/Far and vegetation use the same palette
families, with bounded instanced/batched resources and shadows limited to the
near field.

The environment adds a Three-owned sky dome/background, low-poly cloud batches,
warm key plus cool fill, controlled fog/haze, and a static circular water pass
with shoreline/depth facts, Fresnel and a small deterministic animated normal
term. None of these resources can answer authority/collision/edit queries.

## Composition and content

The descriptor combines authored feature masks, deterministic warped fields,
ridge/valley fields and drainage masks. It must produce irregular island chains,
wide land passages, a connected river/lagoon system, varied cliffs/terraces and
dry clearings. Tree placement is clustered rather than grid-like and uses at
least umbrella, buttress-root, coast/savanna and mangrove archetypes. Small
flora is support-checked and grouped into reeds, succulents, spires, flowers,
moos/grass and vines.

## Safety and compatibility

- Three imports remain confined to `src/voxel-v2/render-three/**`.
- Worker protocol changes are avoided unless descriptor reconstruction cannot
  remain deterministic and cheaper than transport.
- `main.ts`, authority, collision and scheduler are not changed unless an
  integration contract proves it necessary.
- Every renderer/environment/vegetation resource has explicit idempotent
  disposal and replacement behavior.

## Risks

- Proxy surfaces can reveal a transition gap or a second visual truth if their
  descriptor sampling differs from Near quantization.
- Region-level Near merging can increase edit-to-visible latency if too large;
  region size is bounded and measured before acceptance.
- Shared materials change disposal ownership and must not leak after repeated
  edit/regenerate/dispose cycles.
- Decorative flora can survive a cut unless support invalidation is wired to the
  authoritative dirty bounds.
- Clouds, water and shader attributes can consume the performance headroom that
  the baseline already lacks; density is accepted only after telemetry.
- The owner may still reject visual parity even when technical checks pass.

## Implementation sequence

1. Reference audit, baseline production capture and 0–5 gap matrix.
2. Pure descriptor/types and deterministic tests.
3. Near generator/material classification and tree archetypes.
4. Mid/Far proxy geometry, water, sky, clouds and camera presets.
5. Region batching/shared terrain shader and render-only vegetation lifecycle.
6. Single renderer/runtime integration, cut invalidation and fixed screenshot
   series/side-by-side boards.
7. Fresh full verification, focused technical review and owner visual gate.
