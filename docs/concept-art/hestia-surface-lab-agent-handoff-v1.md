# Hestia Surface Lab Agent Handoff v1

**Preset:** `hestia.nebelwald-archipelago.preview.v1`
**Status:** `design-guidance`
**Runtime authority:** `false`

Use this as a compact visual brief. Every numeric value is an **Initial Preview
Target** and **Not Yet Performance-Proven**. Do not import `docs/**` at runtime;
do not infer gameplay, collision, navigation, persistence, voxel, renderer, or
performance authority.

## Top 10 Visual Priorities

1. Read humid, dark, biologically active Hestia immediately.
2. Keep the 4x4 local region traversable and inspectable.
3. Use 60% to 70% foreground ground share, with one clear route.
4. Build one 1.5 to 3.0 unit low faceted ridge.
5. Show one shallow shore/wet depression with 12% to 20% frame coverage.
6. Use exactly five material families and the 13-color palette below.
7. Use exactly three sparse presentation-scatter vegetation tiers.
8. Keep fog at 12 to 36 units with 0.18 normalized density; never mask defects.
9. Use cool dark light with 25-degree upper-left key, 0.75 key, 0.35 ambient.
10. Compose 1920x1080 with an open central 70% and restrained Surface-Lab chrome.

## Top 10 Visual Failure Modes

1. Barren Tharos/outpost default replaces wet Hestia.
2. Giant plateau, spire, waterfall, or planet-scale vista overwhelms the lab.
3. The inspection route is blocked or not visible.
4. Dense jungle or Tier 2 scatter occludes ground and seams.
5. Fog hides holes, seams, chunk boundaries, or missing geometry.
6. Water reads as simulated fluid or an authoritative ocean.
7. Cyan/amber accents become neon world coverage.
8. Materials collapse into one flat shader or photoreal/painterly detail.
9. HUD implies mission, player, scanner, map, economy, or navigation authority.
10. Caves, cities, outposts, characters, hotspots, or universal ship landing are implied.

## Palette and families

Use exactly these 13 colors. Each Hex and `maximumDominance` value is
**Provisional; Not Yet Performance-Proven**; `maximumDominance` is only a
composition guard. Provenance and status are qualitative source evidence and
remain separate from numeric target proof.

| ID | Hex (Provisional; Not Yet Performance-Proven) | Purpose | Maximum dominance (Provisional; Not Yet Performance-Proven) | Provenance | Status |
| --- | --- | --- | --- | --- | --- |
| night-sky | #101A2B | open background and deepest cool field | 35% | 15, 19, 38 Direct Visual Evidence | Direct Visual Evidence |
| deep-teal-water | #124C59 | fixed presentation plane | 18% | 17, 36 Direct Visual Evidence | Direct Visual Evidence |
| lagoon-teal | #2A9A9A | shallow wet contrast | 10% | 23, 36 Direct Visual Evidence | Direct Visual Evidence |
| moss-green | #274B3B | vegetation and moss mass | 24% | 23, 30, 38 Direct Visual Evidence | Direct Visual Evidence |
| forest-green | #3E6A45 | controlled vegetation variation | 12% | 23, 40 Direct Visual Evidence | Direct Visual Evidence |
| blue-grey-rock | #526779 | readable faceted rock planes | 22% | 15, 19, 38 Direct Visual Evidence | Direct Visual Evidence |
| wet-slate | #354B59 | shadowed wet rock and crevice | 16% | 23, 38 Direct Visual Evidence | Direct Visual Evidence |
| shore-silt | #8A9A93 | pale shoreline separation | 8% | 37 form-only inference; image 37's rejected red-brown palette is not adopted; exact silt color remains provisional | Provisional |
| warm-amber | #D38A4A | sparse warm biological/light accent | 4% | 30, 36 Direct Visual Evidence | Direct Visual Evidence |
| fungus-cyan | #63D6D0 | one restrained landmark/node accent | 3% | 23, 38 Direct Visual Evidence | Direct Visual Evidence |
| violet-shadow | #443B62 | cool vegetation shadow variation | 5% | 30, 40 Direct Visual Evidence | Direct Visual Evidence |
| mist-blue | #7893A5 | depth-fog tint | 9% | 38 Direct Visual Evidence | Direct Visual Evidence |
| near-black | #081018 | deepest crevice and chrome contrast | 12% | 15, 39 Direct Visual Evidence | Direct Visual Evidence |

Material families are dark wet faceted rock, mossy dark soil, pale wet shoreline
sediment, muted deep-teal presentation water, and near-black damp crevice.
They are presentation only and do not define physics, collision, meshing, or
voxel data.

## Terrain, fog, water, vegetation, and camera targets

- **Terrain:** 4x4 region; 60% to 70% ground read; one 1.5 to 3.0 unit ridge;
  one wet depression; 2 to 4 visible inspection boundaries.
- **Vegetation:** Tier 1 low scatter 3 to 6 clumps; Tier 2 framing 2 to 4
  clusters; Tier 3 restrained cyan landmark 0 to 1 cluster, each per 4x4
  region. Scatter is reconstructible presentation only.
- **Fog:** start 12, end 36 preview units, density 0.18 normalized. Reveal
  defects; never conceal them.
- **Water:** one fixed presentation plane, 12% to 20% frame share, 0.15 to 0.35
  unit depth cue. It is non-authoritative and not fluid simulation.
- **Lighting:** 25-degree upper-left key; key 0.75, ambient 0.35, cyan accent
  0.60 normalized preview values.
- **Cameras:** C1 ground (1.7 height, -6 pitch, 8 distance); C2 ridge (2.4,
  -10, 14); C3 shore (1.3, -4, 6); C4 landmark (1.8, -8, 5); C5 seam audit
  (2.0, -12, 10). Units are preview units/degrees.

## Screenshot acceptance

Capture at 1920x1080. Pass only when the full preset's positive categories are
visible: a wet/dark palette and lighting read; a clear route with inspectable
terrain, a low faceted ridge, and shallow water; five distinguishable materials; three controlled
vegetation tiers; exposed seams; restrained fog; a reference camera with an
open center; and restrained HUD chrome. Fog or scatter masking, spectacle-first
terrain, an ocean read, dense mission or scanner chrome, or any authority
implication is Fail. The full 12-row matrix is in the
[full preset](hestia-surface-lab-visual-preset-v1.md).

## Deferred items

Cities, outposts, missions, characters, economy, authored hotspots, caves,
underground streaming, giant plateaus, waterfalls, full archipelago vistas,
planet-scale celestial spectacle, and universal main-ship landing are deferred.
Image 41 is missing; cave guidance is provisional and has no direct visual
evidence.
