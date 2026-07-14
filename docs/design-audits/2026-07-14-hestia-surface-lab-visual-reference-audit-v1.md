# Hestia Surface Lab Visual Reference Audit v1

**Date:** 2026-07-14
**Checkpoint:** 1 — source and visual-reference audit
**Scope:** visual guidance for the parallel Surface Lab only; no runtime, gameplay, voxel, renderer, performance, or UI authority.

## Evidence legend and source handling

- **Direct Visual Evidence:** an observation from a successfully materialized PNG reviewed at its native image content.
- **Documented Concept Rule:** a rule stated by the current repository documents.
- **Inference:** a bounded interpretation combining evidence and concept rules.
- **Provisional:** a preview hypothesis that has no measured runtime or performance proof.
- **Rejected:** visually or conceptually unsuitable for the current Hestia target.
- **Deferred:** intentionally outside the first local proving slice.

The ten available sources below have a valid PNG signature, are materialized rather than LFS pointer text, and are 1672x941. Their worktree state is therefore **LFS/materialization: materialized PNG, pointer absent; visually reviewed: yes**. This is source evidence, not runtime evidence. The requested 41 path is absent. The same-number `41-aktiver-ressourcenabbau-cutter.png` is unrelated and is not substituted.

## Per-source audit

### 15 — landing pad / outpost exterior

**Exact path:** `docs/UI-Screenshots/15-planetenbasis-landeplatz-aussenansicht.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of a nighttime barren landing-pad/outpost exterior and restrained corner HUD.

| Field | Audit |
| --- | --- |
| Terrain forms | Traversable rocky foreground; angular boulders; distant jagged mountains. |
| Verticality | Low foreground with a modest distant mountain horizon. |
| Water/coast | None visible. **Inference:** not evidence for a dry Hestia default. |
| Rock form | Angular, faceted, low-poly-readable boulders and ground. |
| Vegetation form/density | None visible. |
| Palette | Blue-gray/navy with cyan and orange light accents. |
| Lighting | Nighttime, cool ambient light with localized cyan/orange practical lights. |
| Fog/atmosphere | Dark open air; no strong fog claim. |
| Depth | Foreground traversal, midground structures/lights, distant ridge silhouette. |
| Scale cues | Pad/outpost framing and mountain distance; no reliable planet-scale measure. |
| UI/HUD density | Restrained corner HUD. |
| Contradictions | **Rejected:** barren, dry, and outpost-centric as a Hestia biome default. **Deferred:** structures and ships. |
| Suitable use | Low-poly rock vocabulary, readable foreground-to-ridge depth, restrained night accent language. |
| Unsuitable/deferred | **Rejected:** dry-only world read. **Deferred:** outpost, pad, ship, and authored settlement content. |

### 17 — planet overview / landing zones

**Exact path:** `docs/UI-Screenshots/17-planet-hesta-uebersicht-landezonen.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of whole-planet Hestia, landing-zone, and biome-overview UI.

| Field | Audit |
| --- | --- |
| Terrain forms | Planet-scale coastlines and dark land masses; no local mesh evidence. |
| Verticality | Not observable at local scale. |
| Water/coast | Oceans and coastlines are prominent. |
| Rock form | Not observable. |
| Vegetation form/density | Dark-green land distribution only; not local vegetation evidence. |
| Palette | Dark green land, blue water, white clouds/storm, dark space, UI accents. |
| Lighting | Planetary overview lighting; not a local surface-lighting proof. |
| Fog/atmosphere | White clouds/global storm; not local fog evidence. |
| Depth | Orbital/planetary depth and moons. |
| Scale cues | Whole planet and moons. |
| UI/HUD density | Very dense UI. |
| Contradictions | **Deferred:** planet-scale elements, moons, global storm, landing-zone system, and dense map UI. |
| Suitable use | Macro palette and broad wet archipelago/biome distribution only. |
| Unsuitable/deferred | **Rejected as local proof:** terrain, water shader, fog, traversal, HUD composition, or runtime scale. |

### 19 — local map / outpost yard

**Exact path:** `docs/UI-Screenshots/19-lokale-karte-siedlung-outpost.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of a first-person barren outpost yard with a large local-map overlay.

| Field | Audit |
| --- | --- |
| Terrain forms | Rocky flat yard; sharp distant mountains. |
| Verticality | Low traversable yard, strong distant vertical skyline. |
| Water/coast | None visible. |
| Rock form | Angular rocky ground. |
| Vegetation form/density | None visible. |
| Palette | Blue-gray night with cyan/orange markers. |
| Lighting | Cool nighttime environment and marker lighting. |
| Fog/atmosphere | Limited atmospheric read beneath the overlay. |
| Depth | Yard-to-mountain depth remains readable despite map overlay. |
| Scale cues | Local-map framing and mountain distance; no reliable metric. |
| UI/HUD density | Dense, dominant local-map overlay. |
| Contradictions | **Rejected:** barren/outpost default for Hestia. **Deferred:** settlement and map product UI. |
| Suitable use | Rock/traversal silhouette and cyan/orange accent restraint. |
| Unsuitable/deferred | **Rejected:** dense map overlay in the Surface Lab viewport. **Deferred:** settlement, outpost, and authored map content. |

### 23 — forest resource scan

**Exact path:** `docs/UI-Screenshots/23-biom-wald-ressourcen-scan.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of on-foot forest resource scanning.

| Field | Audit |
| --- | --- |
| Terrain forms | Low traversable wet rocky path/shoreline; cliffs and spires behind. |
| Verticality | Low playable foreground with stronger background cliffs/spires. |
| Water/coast | Shallow turquoise lagoon/shoreline. |
| Rock form | Wet angular stones. |
| Vegetation form/density | Dense broad-leaf vegetation, tall sparse-canopy trees, reeds; high visible density and occlusion. **Inference:** literal replication could increase traversal and collision complexity. |
| Palette | Cool daylight, turquoise water, dark/cool greens, cyan resource node. |
| Lighting | Cool daylight with light haze. |
| Fog/atmosphere | Light haze only; not a seam-hiding technique. |
| Depth | Path, shallow water, vegetation clusters, and rear cliffs create readable layers. |
| Scale cues | First-person path and node; no reliable world scale. |
| UI/HUD density | Heavy mission/scanner HUD. |
| Contradictions | **Rejected:** mission/player/scanner clutter and literal dense jungle. **Deferred:** giant spires and lagoon spectacle. |
| Suitable use | Wet shore, shallow depression, cyan node, controlled cluster language. |
| Unsuitable/deferred | **Rejected:** dense jungle as a default and mission UI. **Deferred:** giant spires, full lagoon, player and scanner systems. |

### 30 — Hestia biome atlas

**Exact path:** `docs/UI-Screenshots/30-hestia-biom-atlas-regionen.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of six Hestia biome motifs in an atlas.

| Field | Audit |
| --- | --- |
| Terrain forms | Isolated motifs: forest islands/waterfalls, reef megacity, foggy plateau, storm coast, airborne-fauna route, saline spiked islands. |
| Verticality | Motif-dependent; plateau and spikes are high, not a local proving target. |
| Water/coast | Reef, coast, waterfall, and island motifs. |
| Rock form | Abstracted atlas forms; faceted ridges/spikes are useful only as vocabulary. |
| Vegetation form/density | Dark forest/isolated biological motifs; not a density measurement. |
| Palette | Teal, dark green, gray-blue, orange accents. |
| Lighting | Varies by panel; no single local-light proof. |
| Fog/atmosphere | Foggy plateau and storm motifs only. |
| Depth | Panel composition, not traversal depth. |
| Scale cues | Biome taxonomy and spectacle; no metric local scale. |
| UI/HUD density | Six-panel atlas presentation. |
| Contradictions | **Deferred:** cities, giant fauna, storms, full biome transitions, and atlas UI. |
| Suitable use | Palette and isolated motif vocabulary. |
| Unsuitable/deferred | **Rejected as implementation target:** whole atlas, city, fauna, storm, and transition composition. |

### 36 — archipelago landscape

**Exact path:** `docs/UI-Screenshots/36-hestia-archipel-landschaft-konzept.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of Hestia archipelago landscape composition.

| Field | Audit |
| --- | --- |
| Terrain forms | Island chains, reef/lagoon, extremely tall volcanic/spire mountains, faceted rocks/clouds/terrain. |
| Verticality | Very high; strongly exceeds first 4x4 proving-ground needs. |
| Water/coast | Broad turquoise shallow reef/lagoon contrasted with deep teal water. |
| Rock form | Faceted ridges and rocks with painterly detail. |
| Vegetation form/density | Dense broadleaf/umbrella flora with warm orange accents. |
| Palette | Turquoise/deep teal water, dark greens, warm orange accents, warm sky. |
| Lighting | Warm early sun from the left; strong atmospheric depth. |
| Fog/atmosphere | Atmospheric aerial depth, not required local fog. |
| Depth | Strong foreground-to-island-to-mountain layering. |
| Scale cues | Archipelago and small craft imply huge scale; not a local metric. |
| UI/HUD density | Minimal; small fighter/spaceplane-like craft at lower left. |
| Contradictions | **Rejected:** Earth-tropical/photoreal risk, dense jungle, giant mountains, craft, and planet-scale vista. **Deferred:** full archipelago and deep water horizon. |
| Suitable use | Shoreline, shallow/deep water contrast, faceted ridge/rock, and depth layering. |
| Unsuitable/deferred | **Rejected:** photoreal/painterly finish and fighter-coded craft. **Deferred:** island chain, giant mountains, dense jungle, craft. |

### 37 — Tharos barren valley

**Exact path:** `docs/UI-Screenshots/37-tharos-wuestenlandschaft-surface-guidance.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of Tharos surface traversal and low-poly terrain form.

| Field | Audit |
| --- | --- |
| Terrain forms | Broad traversable floor, faceted mesas/ridges/boulders, pale winding channels. |
| Verticality | Readable ridge/mesa verticality without dense enclosure. |
| Water/coast | Channels ambiguously read as snow, salt, or wetness; not Hestia water evidence. |
| Rock form | Strong faceted low-poly form. |
| Vegetation form/density | None visible. |
| Palette | Red-brown and pale; not Hestia palette. |
| Lighting | Overcast directional light. |
| Fog/atmosphere | Ambiguous distant atmospheric plume (smoke/dust/cloud plume); not a Hestia fog target. **Inference:** its nature is unresolved. |
| Depth | Floor, ridges, beacon/outpost, and ambiguous distant atmospheric plume. |
| Scale cues | Traversable valley and small beacon/craft. |
| UI/HUD density | None or minimal surface guidance. |
| Contradictions | **Rejected for Hestia color/biome:** dry red-brown valley. **Deferred/Inference:** structures, craft, and the ambiguous atmospheric plume. |
| Suitable use | Low-poly faceted terrain, traversal floor, and readable ridge forms only. |
| Unsuitable/deferred | **Rejected:** palette and barren biome. **Deferred/Inference:** ambiguous atmospheric plume, beacon/outpost, and grounded/crashed craft. |

### 38 — fog high plateau

**Exact path:** `docs/UI-Screenshots/38-hestia-nebelwald-outpost-konzept.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of Hestia fog, wet rock, landmark flora, and layered depth.

| Field | Audit |
| --- | --- |
| Terrain forms | Highly vertical stepped mesas, cliffs, and spires with waterfalls. |
| Verticality | Extreme; must be greatly reduced for the first 4x4. |
| Water/coast | Waterfalls/wet surfaces; no coast proof. |
| Rock form | Dark wet stepped rock and cliffs. |
| Vegetation form/density | Dark mossy tops, umbrella trees, small cyan-glowing fungi; dense valley framing. |
| Palette | Dark moss/green, gray-blue rock, cyan bioluminescence. |
| Lighting | Cool overcast backlight. |
| Fog/atmosphere | Dense valley fog with layered depth. **Rule:** fog must never hide seams or holes. |
| Depth | Strong fog-layered valley depth. |
| Scale cues | Giant plateau and foreground player/craft; not a local metric. |
| UI/HUD density | No outpost visible despite filename; craft/player foreground. |
| Contradictions | **Rejected/deferred:** giant plateau, fighter/spaceplane-coded craft, player, and fog-heavy vertical spectacle. |
| Suitable use | Fog color/depth, wet dark rock, landmark flora, restrained bioluminescence. |
| Unsuitable/deferred | **Rejected:** using fog or vegetation to conceal seams/holes. **Deferred:** giant plateau, waterfalls, craft/player, and full fog valley. |

### 39 — ship exit / surface transition

**Exact path:** `docs/UI-Screenshots/39-schiff-verlassen-surface-uebergang.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of airlock/ship-exit UI and a cylindrical surface-rated pod/lander.

| Field | Audit |
| --- | --- |
| Terrain forms | Rocky lush terrain around a cylindrical transfer pod/lander. |
| Verticality | Local terrain only; no reliable ridge scale. |
| Water/coast | None clear. |
| Rock form | Rocky, partially obscured by UI and flora. |
| Vegetation form/density | Green/red alien flora; moderate framing density. |
| Palette | Dark navy/black chrome, cyan lines, green ready, amber warning. |
| Lighting | UI-driven dark chrome; local light not a reliable terrain target. |
| Fog/atmosphere | Huge celestial body and dark presentation; no local fog proof. |
| Depth | Open central view with side panels; pod/terrain relationship readable. |
| Scale cues | Pod/lander and huge celestial body. |
| UI/HUD density | Large side panels; central view remains open. |
| Contradictions | **Rejected:** mission/action UI, fake progression/player state, and routine main-ship landing implication. |
| Suitable use | Surface-rated pod/lander distinction and restrained chrome/accent language. |
| Unsuitable/deferred | **Rejected/deferred:** mission UI, player/progression claims, celestial spectacle, and universal main-ship landing. |

### 40 — surface expedition resource trail

**Exact path:** `docs/UI-Screenshots/40-surface-expedition-ressourcenspur-scanner.png`
**LFS/materialization:** materialized PNG, pointer absent; 1672x941. **Visually reviewed:** yes.
**Primary function:** Direct Visual Evidence of first-person coastal jungle traversal with a lander and scanner/mission presentation.

| Field | Audit |
| --- | --- |
| Terrain forms | Traversal path, shallow sea/shore, low-poly cliffs and trees, cylindrical lander. |
| Verticality | Low path with cliff/tree framing; celestial backdrop exaggerates scale. |
| Water/coast | Shallow sea and shoreline. |
| Rock form | Low-poly cliff and ground forms. |
| Vegetation form/density | Dense varied green/red/purple flora; high visible density and occlusion. **Inference:** literal replication could increase traversal and collision complexity. |
| Palette | Dark/cool greens with red/purple flora and cyan UI accents. |
| Lighting | Surface daylight; exact light direction not authoritative. |
| Fog/atmosphere | Huge planet/moon backdrop; no local fog proof. |
| Depth | Path, shore, flora, lander, and celestial layers. |
| Scale cues | Lander and huge celestial body; planet-scale spectacle is deferred. |
| UI/HUD density | Very dense mission/scanner/map/tool panels. |
| Contradictions | **Rejected:** mission/fake-player/scanner clutter, dense jungle as a default, and celestial spectacle. |
| Suitable use | Path, shoreline, controlled flora categories, lander distinction, and UI accent language without panel clutter. |
| Unsuitable/deferred | **Rejected:** dense HUD and jungle as a default. **Deferred:** lander scene, celestial backdrop, mission/scanner loop. |

### 41 — requested bioluminescent cave system

**Exact path:** `docs/UI-Screenshots/41-hestia-biolumineszente-hoehlensysteme.png`
**LFS/materialization:** absent. **Visually reviewed:** no.
**Primary function:** Requested source, unavailable for evidence.

| Field | Audit |
| --- | --- |
| Terrain forms | Not observable. |
| Verticality | Not observable. |
| Water/coast | Not observable. |
| Rock form | Not observable. |
| Vegetation form/density | Not observable. |
| Palette | Not observable. |
| Lighting | Not observable. |
| Fog/atmosphere | Not observable. |
| Depth | Not observable. |
| Scale cues | Not observable. |
| UI/HUD density | Not observable. |
| Contradictions | **Rejected as evidence:** no image exists. The unrelated `docs/UI-Screenshots/41-aktiver-ressourcenabbau-cutter.png` is not a substitute. |
| Suitable use | None until the exact source is supplied and materialized. |
| Unsuitable/deferred | **Deferred:** caves, underground streaming, and bioluminescent cave composition. **Provisional:** any cave-derived preset value. |

## Primary comparison matrix

The five primary sources are compared for Surface Lab usefulness, not visual quality. `Direct Visual Evidence` describes the source; the priority is an `Inference` for the small proving region.

| Source | Terrain silhouette | Water | Fog | Vegetation density | Scale | Dominant/accent hue | Lighting | Traversal readability | Low-poly suitability | Surface-Lab priority |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 23 | Low path, wet stones, rear cliffs/spires | Shallow turquoise shore/lagoon | Light haze | Dense broadleaf/reeds; reduce strongly | First-person/local | Cool green/turquoise + cyan node | Cool daylight | High in foreground | Medium-high for forms; low if literal jungle | **High:** shore, node, cluster cue |
| 30 | Atlas motifs, not one silhouette | Coast/reef/waterfall motifs | Plateau/storm motifs | Isolated dark forest motifs | Biome/atlas scale | Teal/dark green/gray-blue + orange | Panel-varied | Not applicable | Medium for isolated motifs | **Medium:** palette and motif guardrails |
| 36 | Island chains and giant spire mountains | Shallow turquoise vs deep teal | Atmospheric depth | Dense broadleaf/umbrella | Planet/archipelago | Teal/turquoise/green + orange | Warm early left sun | Low for a 4x4; spectacle-led | Medium for faceted forms; high photoreal risk | **Medium:** water contrast, ridge/depth |
| 38 | Stepped mesas/cliffs/spires | Waterfalls/wet rock | Dense layered valley fog | Moss, umbrellas, cyan fungi | Giant plateau | Dark moss/gray-blue + cyan | Cool overcast backlight | Low until verticality is reduced | High for rock/landmark forms | **High with strict reduction:** wet rock, fog depth, fungi |
| 40 | Path, shore, low cliffs/trees | Shallow sea/shore | No reliable local fog | Dense varied flora; reduce strongly | Path plus celestial spectacle | Cool green + red/purple/cyan | Daylight | High path read, low with HUD | Medium-high for controlled scatter | **High:** path/shore/controlled flora; reject HUD |

## Twelve conflict questions — explicit decisions in order

These are visual/design conflicts, not runtime behavior claims. Each answer is intentionally bounded and non-masking.

1. **Is Hestia barren or wet/biologically active?** — **Documented Concept Rule:** wet, dark-vegetation archipelago. Barren 15/19/37 is **Rejected** as the default; rock and night accents remain usable.
2. **Should the first region be a full archipelago or a local proving ground?** — **Documented Concept Rule / Deferred:** local proving ground. Full archipelago is **Deferred**.
3. **Should the first region use giant plateaus, spires, or waterfalls?** — **Rejected/Deferred:** use one low ridge and a restrained landmark; giant vertical structures and waterfalls are deferred.
4. **Should shallow water read as a simulated fluid voxel system?** — **Documented Concept Rule / Rejected:** water is a fixed presentation plane; no fluid voxels, simulation, physics, or gameplay authority is implied.
5. **Should dense jungle be copied from 23/36/40?** — **Rejected:** no. Use sparse controlled presentation clusters so the path, terrain, and seams remain inspectable.
6. **Should vegetation or fog hide missing geometry, seams, or holes?** — **Rejected, absolute:** never. Fog and vegetation must not hide seams or holes; defect inspection remains visible.
7. **Should fog be removed because only some references show it?** — **Inference:** retain restrained fog/depth as a readable atmospheric cue, but reduce 38's dense valley fog and keep geometry exposed.
8. **Should the 37 Tharos red-brown palette become a Hestia fallback?** — **Rejected:** no. Reuse only its faceted terrain/traversal form language.
9. **Should bioluminescence become neon fantasy?** — **Rejected:** no. Use restrained cyan landmark fungi/node accents, not emissive world-wide coverage.
10. **Should 39/40 imply that every main ship lands on Hestia?** — **Documented Concept Rule / Rejected:** no. Show a surface-rated pod/lander distinction; universal main-ship landing is not implied.
11. **Should the Surface Lab reproduce the dense mission/scanner/map HUD?** — **Rejected/Deferred:** no. Preserve only restrained chrome/accent language; mission, player, scanner, and map systems are deferred.
12. **Can image 41 or the same-number cutter image settle cave/bioluminescence decisions?** — **Rejected:** no. 41 is absent and the cutter is unrelated. Cave-derived conclusions remain **Provisional/Deferred**.

## 4x4 feasibility and actionable handoff

**Inference / Provisional:** A small 4x4 proving region is feasible if it demonstrates a readable surface slice rather than a biome panorama. The minimum visual composition is:

- one shallow shore or wet depression;
- one low faceted ridge with a readable traversable foreground;
- sparse vegetation clusters with controlled categories and at most one restrained landmark cluster/node;
- exposed seams, holes, and chunk boundaries for inspection;
- restrained depth fog only after geometry is visibly valid.

Full archipelago, high plateau, giant spires, waterfalls, city/settlement/outpost, mission/scanner flow, player/craft staging, caves, and planet-scale celestial spectacle are **Deferred**. The parallel Surface Lab agent may use this audit to choose qualitative targets and failure checks, but final numeric preset values belong to Checkpoint 2 and are deliberately not defined here.

## Concept guidance versus authority and proof

**Documented Concept Rule:** Hestia is a wet, dark-vegetation archipelago world (`docs/spielkonzept/startsystem.md`); warmer soft light and dark green/blue-green/violet/near-black vegetation are the intended direction. The procedural voxel document names a 0.25 m quality target and 0.50 m fallback, but this audit does not prove either target. The roadmap keeps a small local proving region first and defers planet-wide biomes, caves, streaming, cities, and outposts. `docs/concept-art/ship-image-audit.md` requires a surface-rated pod/lander distinction rather than universal main-ship landing.

**Documented Concept Rule:** `SurfaceLocalFrame` owns surface coordinates/state contracts; renderer and mesh presentation are not authority. The exact architecture documents remain the source for those ownership boundaries. Concept images are design input, never runtime evidence, gameplay truth, voxel authority, collision proof, navigation proof, persistence proof, or performance proof.

**Inference / Provisional:** This audit supports a visual proving target only. No image establishes an FPS budget, memory budget, chunk throughput, meshing quality, collision behavior, or streaming correctness. Those require runtime evidence and performance measurements in the Surface Lab implementation, not visual-reference extrapolation.

## Evidence gaps and stopping boundary

- Exact requested image 41 is absent; no cave conclusion is visually reviewed.
- No source image proves a numeric palette, fog distance, water depth, chunk size, 0.25 m quality, 0.50 m fallback, or performance budget.
- 17, 30, 36, and 38 contain planet/atlas/hero-scale cues that are useful for direction but not local runtime scale evidence.
- This audit intentionally does not create final preset values, JSON, agent handoff, runtime changes, images, or test artifacts.
