# Hestia Surface Lab V1 — Visual Target Audit

**Date:** 2026-07-14
**Status:** Binding pre-code visual contract for the `surfaceLab=1` proving ground.
**Scope:** Documentation only. The five source PNGs below are read-only design references, not runtime assets or runtime evidence.

## Sources inspected

All five requested concept sources exist at their exact repository paths. They are referenced by filename deliberately; the fifth source is the actual repository filename `40-surface-expedition-ressourcenspur-scanner.png`.

1. [`docs/UI-Screenshots/23-biom-wald-ressourcen-scan.png`](../UI-Screenshots/23-biom-wald-ressourcen-scan.png)
2. [`docs/UI-Screenshots/30-hestia-biom-atlas-regionen.png`](../UI-Screenshots/30-hestia-biom-atlas-regionen.png)
3. [`docs/UI-Screenshots/36-hestia-archipel-landschaft-konzept.png`](../UI-Screenshots/36-hestia-archipel-landschaft-konzept.png)
4. [`docs/UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png`](../UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png)
5. [`docs/UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png`](../UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png)

The sources were checked as binary PNGs: each begins with the PNG signature `89 50 4E 47 0D 0A 1A 0A`, has a readable IHDR, and is not a Git LFS pointer. The measured source dimensions are recorded in the verification section below. No image was modified, embedded, copied, or made part of the runtime.

| Source | Verified dimensions | Signature/LFS result |
| --- | --- | --- |
| `23-biom-wald-ressourcen-scan.png` | `1672x941` | PNG signature; not an LFS pointer |
| `30-hestia-biom-atlas-regionen.png` | `1672x941` | PNG signature; not an LFS pointer |
| `36-hestia-archipel-landschaft-konzept.png` | `1672x941` | PNG signature; not an LFS pointer |
| `38-hestia-nebelwald-outpost-konzept.png` | `1672x941` | PNG signature; not an LFS pointer |
| `40-surface-expedition-ressourcenspur-scanner.png` | `1672x941` | PNG signature; not an LFS pointer |

## Binding visual contract

The following statements are mandatory acceptance criteria for the later Surface Lab implementation and its screenshots. They describe observable results, not implementation technique.

### Terrain silhouette and readability

- The default view must read immediately as a continuous Hestia surface: broad grounded forms, distinct shoreline/wetland breaks, and a few readable rises or ridges rather than noise, a flat plane, or isolated cubes.
- At the screenshot camera distance, the primary landform silhouette must remain legible against fog and sky; at least one foreground, middle-ground, and background elevation band must be distinguishable.
- Shoreline and water/wetness boundaries must be visible without relying on HUD labels. Water is presentation-only and must not imply an unimplemented simulation.
- No large hole, seam, checkerboard, missing chunk, or visibly detached vegetation cluster may distract from the main silhouette in any evidence frame.

### Faceted low-poly and microvoxel treatment

- Terrain must visibly use faceted low-poly shading: planar face changes and material facets remain readable, with no requirement for a smooth photorealistic surface.
- Microvoxel detail must support the macro silhouette rather than replace it: small breakup appears on slopes, rocks, wet ground, and shore transitions, while the horizon remains calm enough to read.
- Flat/faceted lighting must expose form without turning every voxel/sample boundary into a regular grid. The target is a coherent meshed landform, not cube-per-voxel terrain.
- Material transitions must be grouped and intentional (rock, wet soil, moss/biological cover, and shallow-water boundary); avoid random one-cell color speckle.

### Palette, lighting, and atmosphere

- The dominant atmosphere is the dark green/petrol Hestia nebelforest direction from image 38, with the cooler archipelago/shoreline and water guidance from image 36.
- The palette may include the broader biome variation suggested by image 30 and the wet rock/soil cues of image 23, but it must remain a restrained family: deep blue-green shadows, muted green/teal land, subdued cyan water accents, and limited warm/amber emphasis.
- Fog must establish depth and visibility falloff without hiding the playable/readable foreground. Lighting must separate land, wetness, and vegetation silhouettes; it must not flatten the scene or produce an overexposed neon landscape.
- Atmosphere is render-only presentation. It must not become a gameplay claim about weather, oxygen, visibility mechanics, or simulated water.

### Hero landmark composition

- Each evidence frame must have one dominant natural hero read (for example an archipelago ridge, shoreline rise, or forested landform) placed off the exact screen center enough to preserve a clear inspection view.
- The hero landmark must occupy a meaningful middle-ground area and be supported by quieter foreground and background context. Do not fill the entire frame with a wall or a tiny distant island.
- No ship, outpost, megacity, mission prop, weapon, creature, or scanner device may be used as the hero landmark. The proving ground is terrain-first.

### Path and resource-trace treatment

Resource tracing is **optional/inspirational for V1**, not a required feature. The approved spec requires terrain, water, fog, vegetation, wireframe and chunk-boundary presentation, but does not require a resource-trace implementation. If a later approved implementation shows a path/trace, these binding treatment rules apply:

- It must be a sparse, world-aligned presentation cue following terrain contours or a readable route; it must not look like a floating UI line, road mesh, or fabricated gameplay progression.
- It uses a restrained cyan/teal accent, remains surface-attached, terminates clearly, and never dominates the hero landform.
- It is informational/proving-ground presentation only. It must not imply missions, mining authority, discovered deposits, scanner truth, or a completed resource loop.
- The default screenshot must remain readable with the trace disabled; terrain itself is the acceptance target.

### Camera and framing

- Task 5.1 evidence uses a desktop browser viewport of exactly **1920x1080**. The browser canvas is full-screen within that viewport, with no concept image used as a background or overlay. No mobile behavior is claimed by this audit.
- Every matrix row must state the exact visible seed string, the approved preset `hestia.nebelwald-archipelago.preview.v1`, the voxel size, and the camera fixture. The approved documents define the preset plus explicit UniverseTime/surface anchor, but do not yet provide a literal seed or numeric camera pose; Task 5.1 must use the implementation's approved default fixture, record its literal seed and numeric reset pose in the evidence, and must not silently invent a different fixture.
- The reproducible camera fixture is: load the route, invoke **Reset**, capture the resulting numeric camera position/target/orientation, take the default frame without orbit input, and reuse that recorded reset pose for comparison rows. Any orbit row must record exact input deltas and final pose. Camera and floating-origin movement must not change canonical hashes.
- The reset camera must show a stable three-quarter inspection view with visible foreground-to-horizon depth, the hero landmark in the middle ground, and no clipped terrain edge caused by an accidental near-plane or extreme zoom.
- Camera controls may orbit/fly, but camera position and framing must not alter generated terrain, hashes, chunk identity, or other canonical data.
- The central landscape must remain unobstructed: persistent HUD content is edge-bound and must not cover the hero landmark or any optional trace.

### HUD and player/debug separation

- The visible mode must explicitly show the labels **SURFACE LAB**, **TECHNICAL PROVING GROUND**, and **NOT GAMEPLAY** (or an explicitly approved equivalent), plus visible `surfaceLab=1` evidence or an equally direct visible mode indicator. A URL/query value hidden outside the screenshot is insufficient evidence.
- The player-facing presentation must visibly state the active **mode**, current **state**, **risk/warning**, and **next action**. It remains restrained and edge-bound: seed/preset, resolution/extent and chunk readiness may be shown. Diagnostics remain clearly labeled as debug/telemetry rather than masquerading as player gameplay.
- Player HUD and debug UI must be visually and semantically separate. Debug values may be compact, but they must not occupy the center viewport or invent Ready/Arrival/Combat/World-state claims.
- UI density must be lower than a management dashboard: one primary action per context, concise labels, stable alignment, and no panel stack over the terrain.
- The approved read-only telemetry surface must expose seed, preset, voxel size, region extent, requested/ready/failed chunks, queue/running, stale rejects, cache hits/misses, vertices, triangles, mesh bytes, generation/meshing/upload timings, frame time, and brick/mesh hashes through visible HUD text, read-only data attributes, and the Task 5.1 evidence record. These values are measurements, not gameplay authority.

### Vegetation density and distribution

- Vegetation is deterministic reconstructable presentation, not world authority. It must be grouped in readable biological patches on suitable slopes, wet ground, shore margins, or sheltered valleys, with open rock/soil breaks between groups.
- The default reset view must show enough vegetation to establish the nebelforest direction, but must retain visible ground, shoreline, and faceted silhouettes. A continuous opaque vegetation wall, uniform carpet, or barren all-rock region fails the review.
- Exact species, instance count, and individual placement are inspirational/non-binding. Review the distribution by checking visible ground openings, separated clusters, and an unobscured hero landmark rather than enforcing a species or pixel count.
- The vegetation toggle must make the presentation difference inspectable without changing canonical terrain hashes. Fog and vegetation states must be recorded whenever a matrix row changes either state.

## Explicit anti-targets

The following are rejected even if a concept source appears to suggest them:

- No glass/gradient dashboard, oversized translucent dashboard chrome, or decorative panel stack.
- No Unicode-icon soup, unlabeled glyph controls, or icon-only critical actions.
- No excessive floating cards or centered modal chrome covering the landscape.
- No fake terrain images, concept-image planes, screenshots, baked backdrop meshes, or other substitutions for generated terrain.
- No scene-only product logic. Scene/bootstrap wiring may compose the lab, but generation, lifecycle, telemetry, and authority remain in their defined runtime/domain owners.
- No ships, scanner hardware, missions, outposts, megacities, weapons, creatures, mining loop, cargo loop, fake player/avatar/astronaut, first-person arms, held tools/weapons, cockpit presentation, or implied surface gameplay authority in this visual proving ground.
- No claim that concept art is runtime evidence. Concept sources guide visual direction only; later Playwright screenshots must come from the live `surfaceLab=1` runtime.

## Mandatory versus inspirational detail

**Mandatory:** the Hestia dark green/petrol atmosphere; readable faceted terrain silhouette; restrained wetness/water distinction; grouped but non-opaque vegetation; desktop framing; visible `SURFACE LAB`, `TECHNICAL PROVING GROUND`, `NOT GAMEPLAY`, mode/state/risk/next-action evidence; complete approved telemetry; center-safe composition; accessibility checks; and player/debug separation. Resource tracing is not mandatory. These requirements are testable and must not be weakened because a single reference image is difficult to reproduce.

**Inspirational/non-binding:** exact seed literal until the approved implementation fixture is published, exact tree species/count, exact rock count, exact fog shape, exact landmark geometry, exact pixel colors, optional trace route, exact labels beyond the required approved equivalents, and any individual composition from images 23, 30, 36, 38, or 40. The implementation must synthesize the shared direction and deterministic runtime contracts, not overfit or display any one concept. Image 38 is the primary atmosphere cue; image 36 is the primary landform/shoreline cue; images 23 and 40 inform wet/optional-trace accents; image 30 informs restrained biome breadth. Ships, scanner, missions, outposts, megacities, avatars, tools, and cockpit views remain excluded despite their presence or implication in source concepts.

## Task 5.1 screenshot and evidence matrix

Task 5.1 must capture all rows at **1920x1080** from the live desktop browser route `/?surfaceLab=1`, with the visible mode labels and `surfaceLab=1` evidence. Each screenshot must be paired with the live evidence record for the same runtime state; source concept images are never substituted. The exact seed, reset pose, preset, resolution, fog state, vegetation state, and expected values must be recorded before capture.

| Evidence frame | Required reproducible state and expected values | Visual/reviewer checks |
| --- | --- | --- |
| `default` | Approved default seed fixture (literal recorded), preset `hestia.nebelwald-archipelago.preview.v1`, `0.50 m`, extent **64x32x64m @ 0.50m**; reset camera pose, fog on, vegetation on; requested/ready **16/16**, failed **0**, queue/running **0**. | Reset pose and numeric viewport framing recorded. Check terrain occupies foreground/middle/background bands, hero landmark is not center-blocked, ground openings and vegetation groups remain visible, fog retains depth, waterline is readable, HUD text/contrast is legible, and the four required mode/state/risk/next-action labels are visible. |
| `wireframe` | Same literal seed, preset, extent, reset pose and fog/vegetation state as `default`; wireframe and chunk boundaries on; expected canonical hashes unchanged from `default`, requested/ready **16/16**, failed **0**, queue/running **0**. | Wireframe is explicitly debug-labeled, bounded, and not the dominant default-grid presentation. Check chunk boundaries do not obscure the hero, terrain remains identifiable, and player HUD remains separate from telemetry. |
| `quarter-meter` | Same literal seed, preset, reset pose, fog on, vegetation on; `0.25 m`, extent **32x16x32m @ 0.25m**; requested/ready **16/16**, failed **0**, queue/running **0**; expected canonical hashes differ from `0.50 m`. | Check coherent microvoxel/faceted detail, no holes or fake detail, visible ground openings, honest extent text, readable mode labels, and no optional trace claim unless it is actually enabled and recorded. |
| `regenerate-same-seed` | Default fixture, same preset/resolution/reset pose and presentation states; explicit regenerate bypasses cache; expected brick and mesh hash sets are identical to `default`, with cache bypass/hit/miss and stale counters recorded. | Check no visual drift, no stale result visible, and no authority claim beyond read-only telemetry. |
| `changed-seed` | Explicit changed seed recorded alongside the default seed; same preset/resolution/reset pose and presentation states; expected valid brick and mesh hash sets differ from `default`, with **16/16**, failed **0**, queue/running **0** after settling. | Check changed terrain remains Hestia-directed, non-empty, readable, and free of holes; do not demand identical landmark placement. |

For every row, the evidence must record: viewport size, route/query, literal seed, preset, explicit UniverseTime/surface-anchor fixture identity, resolution/extent, reset camera position/target/orientation (plus any orbit delta), fog and vegetation state, chunk requested/ready/failed counts, settled queue/running counts, stale rejection, cache hit/miss, vertices, triangles, mesh bytes, generation/meshing/upload timings, frame time including the approved 300-frame settled sample, brick/mesh hashes, and warnings. The same values must be available through the visible HUD, read-only data attributes, and the JSON/Markdown evidence surface required by Task 5.1.

The reviewer uses this bounded checklist for each frame: (1) route and viewport exact; (2) camera reset/pose exact; (3) hero landmark lies in a documented middle-ground screen band and is not covered by HUD; (4) visible terrain occupies at least one foreground, middle-ground, and background band; (5) no chunk hole, black/empty frame, hard water/terrain cut, or opaque vegetation wall; (6) terrain/water/vegetation contrast remains readable without labels; (7) HUD controls and values are readable and edge-bound; (8) mode/state/risk/next-action and required labels are visible; (9) debug telemetry is labeled and does not claim gameplay; (10) no concept image, player/avatar, tool, weapon, ship, outpost, mission, or cockpit appears. Exact band boundaries and artistic landmark placement remain non-binding provided these objective conditions pass.

## Accessibility and responsive evidence

- Task 5.1 must verify keyboard focus order through all controls, visible focus indication, and accessible labels/names for every control; mouse-only operation is insufficient evidence.
- Text and state colors must remain readable against the scene and panels at the 1920x1080 capture. Do not rely on color alone for warnings, state, cache, stale, or risk; use text or an equivalent accessible label.
- Where camera, fog, vegetation, or other motion exists, the evidence must verify the approved reduced-motion behavior. Reduced motion may reduce/disable decorative motion, but must preserve terrain readability, controls, state, and telemetry.
- Task 5.1's required **1920x1080** capture is the canonical comparison frame for the default, wireframe, quarter-meter, same-seed regeneration, and changed-seed evidence states above; it does not waive the applicable repository-wide desktop screenshot matrix in [`docs/ux/player-ui-redesign-foundation-v1.md`](../ux/player-ui-redesign-foundation-v1.md). Where that matrix applies, the same reviewed desktop states must also be checked at **16:9, 16:10, 4:3, and ultrawide** aspect ratios. No unsupported mobile or responsive-runtime claim is made.

## Reference and evidence boundary

This audit is the pre-code visual target for the approved change. It does not authorize product implementation by itself, does not define a terrain data contract, and does not replace unit/E2E acceptance criteria. Concept PNGs remain immutable design inputs; only fresh runtime screenshots and measured runtime records can prove the later visual claims.
