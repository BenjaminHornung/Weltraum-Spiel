# Hestia Surface Lab Visual Preset v1

**Preset ID:** `hestia.nebelwald-archipelago.preview.v1`
**Status:** `design-guidance`
**Runtime authority:** `false`
**Scope:** visual direction for a parallel Surface Lab preview only.

This preset is a design handoff, not runtime truth. It does not define gameplay,
collision, navigation, persistence, voxel authority, renderer architecture,
streaming, or performance budgets. The source boundary is recorded in the
[visual reference audit](../design-audits/2026-07-14-hestia-surface-lab-visual-reference-audit-v1.md).

## Normative vocabulary and authority boundary

- **MUST** means the preview must visibly satisfy the guidance.
- **SHOULD** means the preview should satisfy it unless a later review records a
  deliberate visual reason not to.
- **MAY** means an optional presentation choice within this preset.
- **MUST NOT** means a prohibited implication or visual shortcut.
- **DEFERRED** means outside this first proving slice; it is not a hidden
  requirement.
- Every number below is an **Initial Preview Target** and **Not Yet
  Performance-Proven**. It is not a runtime, frame-time, memory, gameplay,
  collision, navigation, persistence, or voxel authority.

## Core visual contract

The first region **MUST** read as a humid, dark, biologically active Hestia
surface: a traversable foreground, one shallow shore or wet depression, one low
faceted ridge, and sparse controlled presentation scatter. The first 4x4 region
is for traversal and inspection, not spectacle. Seams, holes, and chunk
boundaries **MUST** remain visible enough to inspect.

Vegetation **MUST** be reconstructible presentation scatter, never voxel or
gameplay authority. Water **MUST** be a fixed, non-authoritative presentation
plane; no fluid voxels, flow, physics, or gameplay meaning is implied. Fog
**MUST** reveal rather than hide defects. The preview **MUST NOT** suggest that
the renderer, this document, or the screenshot proves runtime or performance
behavior.

Cities, outposts, missions, characters, economy, authored hotspots, caves,
underground streaming, giant plateaus, waterfalls, full archipelago vistas,
planet-scale celestial spectacle, and universal main-ship landing are
**DEFERRED**. A surface-rated pod/lander distinction **MAY** be represented as
visual language, but it does not authorize a landing system.

## Initial Preview Targets

All rows in this section carry the same evidence status: **Initial Preview
Target; Not Yet Performance-Proven**.

### Terrain and materials

| Target | Initial Preview Target; Not Yet Performance-Proven | Guidance |
| --- | --- | --- |
| Proving footprint | 4x4 local region | **MUST** stay traversable and inspectable rather than panoramic. |
| Traversable foreground | 60% to 70% of frame ground read | **MUST** provide an unobstructed inspection path. |
| Ridge height | 1.5 to 3.0 preview units | **SHOULD** be a single low faceted ridge, not a plateau or spire. |
| Wet depression | 1 shallow depression | **MUST** connect visually to the shore/presentation plane. |
| Seam inspection | 2 to 4 visible inspection boundaries | **MUST** remain exposed; vegetation and fog cannot mask them. |
| Material families | 5 | Exactly the families listed below. |

The five material families are: **dark wet faceted rock**, **mossy dark
soil**, **pale wet shoreline sediment**, **muted deep-teal presentation water**,
and **near-black damp crevice**. These families are presentation only; they do
**not** define physics, collision, meshing, or voxel data.

### Palette

Exactly 13 entries are approved for this preview. `maximumDominance` is a
provisional composition guard, not a measured rendering or performance limit.
Every exact Hex and maximum-dominance target below is **Provisional; Not Yet
Performance-Proven**. Provenance and status describe source evidence
qualitatively and separately from those numeric targets.

| ID | Hex (Provisional; Not Yet Performance-Proven) | Purpose | Maximum dominance (Provisional; Not Yet Performance-Proven) | Provenance | Status |
| --- | --- | --- | --- | --- | --- |
| `night-sky` | `#101A2B` | open background and deepest cool field | 35% | 15, 19, 38 Direct Visual Evidence | Direct Visual Evidence |
| `deep-teal-water` | `#124C59` | fixed presentation plane | 18% | 17, 36 Direct Visual Evidence | Direct Visual Evidence |
| `lagoon-teal` | `#2A9A9A` | shallow wet contrast | 10% | 23, 36 Direct Visual Evidence | Direct Visual Evidence |
| `moss-green` | `#274B3B` | vegetation and moss mass | 24% | 23, 30, 38 Direct Visual Evidence | Direct Visual Evidence |
| `forest-green` | `#3E6A45` | controlled vegetation variation | 12% | 23, 40 Direct Visual Evidence | Direct Visual Evidence |
| `blue-grey-rock` | `#526779` | readable faceted rock planes | 22% | 15, 19, 38 Direct Visual Evidence | Direct Visual Evidence |
| `wet-slate` | `#354B59` | shadowed wet rock and crevice | 16% | 23, 38 Direct Visual Evidence | Direct Visual Evidence |
| `shore-silt` | `#8A9A93` | pale shoreline separation | 8% | 37 form-only inference; image 37's rejected red-brown palette is not adopted; exact silt color provisional | Provisional |
| `warm-amber` | `#D38A4A` | sparse warm biological/light accent | 4% | 30, 36 Direct Visual Evidence | Direct Visual Evidence |
| `fungus-cyan` | `#63D6D0` | one restrained landmark/node accent | 3% | 23, 38 Direct Visual Evidence | Direct Visual Evidence |
| `violet-shadow` | `#443B62` | cool vegetation shadow variation | 5% | 30, 40 Direct Visual Evidence | Direct Visual Evidence |
| `mist-blue` | `#7893A5` | depth-fog tint | 9% | 38 Direct Visual Evidence | Direct Visual Evidence |
| `near-black` | `#081018` | deepest crevice and chrome contrast | 12% | 15, 39 Direct Visual Evidence | Direct Visual Evidence |

### Vegetation

Exactly three presentation categories/tiers are used:

1. **Tier 1 — low ground scatter:** moss pads, reeds, and small broad leaves;
   **Initial Preview Target; Not Yet Performance-Proven:** 3 to 6 visible
   clumps per 4x4 region.
2. **Tier 2 — controlled framing cluster:** sparse umbrella/broadleaf silhouettes
   placed beside, not across, the inspection path; **Initial Preview Target; Not
   Yet Performance-Proven:** 2 to 4 clusters per 4x4 region.
3. **Tier 3 — restrained landmark:** one cyan fungus/node cluster for orientation;
   **Initial Preview Target; Not Yet Performance-Proven:** 0 to 1 cluster per
   4x4 region.

Vegetation **MUST** leave the ground, seams, holes, and path inspectable. Dense
jungle, occluding walls, neon coverage, and vegetation-driven collision claims
are **MUST NOT** guidance.

### Fog, water, and lighting

| Target | Initial Preview Target; Not Yet Performance-Proven | Guidance |
| --- | --- | --- |
| Fog start | 12 preview units | **SHOULD** begin after the inspectable foreground. |
| Fog end | 36 preview units | **SHOULD** preserve the ridge silhouette. |
| Fog density | 0.18 normalized preview value | **MUST** reveal geometry defects and seams. |
| Water plane | 1 fixed plane | **MUST** be non-authoritative presentation only. |
| Water coverage | 12% to 20% of frame | **SHOULD** read as a shallow shore, not an ocean. |
| Water depth cue | 0.15 to 0.35 preview units | **MAY** use color/edge contrast; it is not fluid depth authority. |
| Key light direction | 25 degrees from upper-left | **SHOULD** provide soft warm separation over cool ambient light. |
| Key light intensity | 0.75 normalized preview value | **MUST** keep dark rock planes readable. |
| Ambient intensity | 0.35 normalized preview value | **SHOULD** retain near-black crevice contrast. |
| Cyan accent intensity | 0.60 normalized preview value | **MAY** emphasize one landmark only; no neon world wash. |

### Camera and screenshot composition

The screenshot canvas is **1920x1080 Initial Preview Target; Not Yet
Performance-Proven**. The central 70% width **SHOULD** remain open for terrain
inspection; the lower-right chrome **MUST** remain restrained. No camera shot
may imply planet scale.

Exactly five reference camera shots are defined:

| Shot | Initial Preview Target; Not Yet Performance-Proven | Purpose |
| --- | --- | --- |
| `C1-ground-traverse` | height 1.7 units; pitch -6 degrees; distance 8 units | primary readable path and shore view |
| `C2-ridge-context` | height 2.4 units; pitch -10 degrees; distance 14 units | foreground-to-low-ridge depth |
| `C3-shore-inspection` | height 1.3 units; pitch -4 degrees; distance 6 units | fixed water plane and wet edge |
| `C4-landmark-detail` | height 1.8 units; pitch -8 degrees; distance 5 units | restrained cyan Tier 3 landmark |
| `C5-seam-audit` | height 2.0 units; pitch -12 degrees; distance 10 units | exposed seams, holes, and boundaries |

### Surface-Lab HUD/chrome contract

The chrome **MUST** be presentation-only and visibly separate from player,
mission, scanner, map, or debug authority. It **SHOULD** contain only:

- a small `SURFACE LAB / PREVIEW` label;
- `Hestia — Nebelwald Archipelago` as a visual target name;
- a compact `C1`–`C5` shot indicator;
- a small `DESIGN GUIDANCE · NOT RUNTIME AUTHORITY` disclaimer;
- restrained cyan, amber, and near-black accents from the palette.

It **MUST NOT** show health, fuel, mission objectives, inventory, economy,
navigation authority, collision state, persistence state, performance claims,
or a fake scanner/map loop. **MAY** include a neutral framing guide for review.

## Screenshot acceptance matrix

Each row is observable in a 1920x1080 capture and is a design check, not runtime
proof. Exactly 12 rows are required.

| # | Observable check | Pass | Warning | Fail |
| ---: | --- | --- | --- | --- |
| 1 | Hestia wet/dark read | wet dark green/teal surface is immediate | read is mixed or weak | barren dry or generic Earth read dominates |
| 2 | Traversable foreground | clear inspectable route is visible | route is narrow but usable | path is blocked or absent |
| 3 | Low ridge | one readable faceted ridge anchors depth | ridge is too flat/tall | plateau/spire spectacle dominates |
| 4 | Shore/wet depression | shallow wet edge is legible | edge is subtle | water is absent or ocean-scale |
| 5 | Material separation | five families remain distinguishable | two families merge | materials read as one flat shader |
| 6 | Vegetation Tier 1 | low scatter frames without occlusion | occasional path overlap | dense wall or hidden ground |
| 7 | Vegetation Tier 2/3 | clusters and at most one landmark are controlled | landmark competes with ridge | jungle/neon coverage dominates |
| 8 | Seam inspection | seams/holes remain visible | one boundary is hard to inspect | fog or scatter hides defects |
| 9 | Fog depth | restrained layers reveal ridge and ground | depth is weak or heavy | fog conceals geometry |
| 10 | Lighting/palette | cool dark base with sparse warm/cyan accents | accents are frequent | neon, red-brown, or blown highlights dominate |
| 11 | Camera composition | foreground, shore, ridge, and open center fit | one layer is cramped | planet-scale vista or obstructive framing |
| 12 | HUD/chrome | restrained preview label and disclaimer only | extra neutral guide appears | mission/player/scanner/map authority is implied |

## Deferred and provisional boundary

The exact image 41 is missing and supplies no visual evidence; cave-derived
values are therefore **Provisional** and caves remain **DEFERRED**. All numeric
values in this document are provisional preview targets. Runtime agents must
manually translate them into their own reviewed implementation contract; the
application must not import `docs/**` at runtime.
