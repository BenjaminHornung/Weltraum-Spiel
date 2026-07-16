# Design: Browser Hestia Hydrology Terrain Generator V2

## Contract boundary

V2 is a parallel, pure, static regional dataset. It does not replace V1 and it
does not integrate a barrel, central runtime, renderer, DOM, camera, dynamic
liquid system, decorative water plate, or globally complete planet hydrology.
The implementation boundary is
`apps/weltraum-browser/src/world-generation/hestia/hydrology/**`; tests use
direct module imports.

The following central paths are forbidden for this slice:

- `apps/weltraum-browser/src/main.ts` and other central application wiring;
- existing V1 hydrology/terrain authorities and renderer/worker authorities;
- `apps/weltraum-browser/src/voxel/adaptive/**`;
- package, lockfile, configuration, and unrelated runtime files.

Only the approved hydrology implementation path, `hestiaHydrology*.test.ts`
unit paths, the single named E2E spec, the evidence prefix, this protocol, and
`docs/browser-mainline/hestia-hydrology-terrain-generator-v2.md` may change
during implementation.

## Global identity and fixed grid

`HydrologyGridDefinition` is immutable and has:

| Field | V2 value |
| --- | ---: |
| cells X/Z | `128 x 128` |
| samples X/Z | `129 x 129` |
| spacing | `2.0 m` |
| extent X/Z | `256 x 256 m` |
| global quantum | `0.125 m` |
| origin alignment | `16` quanta (`2.0 m`) |

The origin is an integer global quantum coordinate. A sample at local `(x, z)`
has global quantum coordinates `origin + (16*x, 16*z)` and metres derived from
that global coordinate. A cell uses the corresponding global cell coordinate.
The local array index is never an identity. Canonical sample order is global Z
ascending, then global X ascending; the stable linear index is the resulting
row-major index. All coordinate arithmetic is checked for safe integer range,
finite conversion, alignment, and exact fixed dimensions before generation.

## Contract data and preset

The public contracts are `HestiaHydrologyDatasetId`, `HydrologyGridDefinition`,
`HydrologyCellCoordinate`, `HydrologyGlobalCoordinate`,
`HydrologyDatasetRevision`, `WaterBodyId`, `RiverSegmentId`,
`HydrologyParameters`, `HydrologyInput`, `HydrologySnapshot`, `HydrologyCell`,
`WaterBody`, `RiverSegment`, and `HydrologySample`.

`HydrologyInput` contains `rootSeed`, `bodyId`, `surfaceFrameId`, `datasetId`,
the aligned global origin, `seaLevelMeters`, versioned `HydrologyParameters`,
and a pure `TerrainHeightSampler(globalX, globalZ)`. The sampler must return a
finite height for every requested global coordinate or generation fails closed.

The versioned preset publishes every tuning value; no hidden constants are
permitted:

```text
gridSpacingMeters             = 2.0
seaLevelMeters                = 0
minimumLakeDepthMeters        = 0.15
riverSourceAccumulationCells  = 48
minimumRiverDepthMeters       = 0.20
maximumRiverDepthMeters       = 2.50
minimumRiverHalfWidthMeters   = 0.50
maximumRiverHalfWidthMeters   = 4.00
channelBankSlope              = 0.65
moistureFalloffMeters         = 18
```

## Sampling and ocean classification

1. Sample all `129 x 129` global sample coordinates exactly once in canonical
   order. Store the finite terrain height and preserve its global coordinate.
2. Seed ocean classification from boundary samples whose terrain height is at
   or below sea level. Flood with deterministic 8-neighbor sample connectivity
   over samples at or below sea level. Only boundary-connected components are
   ocean. An isolated below-sea depression is not ocean.

No ocean or water state may be inferred from local array position, caller order,
or a renderer projection.

## Deterministic priority flood

Run a priority flood from the dataset boundary using a priority key of:

1. `filledElevation`;
2. global Z;
3. global X; and
4. stable linear index.

The queue has no random or insertion-order tie break. The result records
`filledElevation`, `depressionDepth`, `spillElevation`, and basin ownership for
each cell/sample as applicable. Basin/component traversal and all published
collections use canonical global Z/X ordering. The fill is the sole source for
depression and spill values; no later pass may silently revise them.

## D8 drainage and accumulation

The canonical D8 direction order is exactly:
`N, NE, E, SE, S, SW, W, NW`.

For each cell, choose the strongest negative slope of `filledElevation`; equal
slopes choose the earlier direction in that order. A boundary outlet may leave
the dataset. The direction graph must contain no internal cycle. If validation
cannot establish a valid outlet or acyclic graph, generation fails closed.

Accumulate upstream cells topologically. Every cell starts with contribution
`1`. Process cells in `filledElevation` descending order, then global Z, then
global X, independent of array or caller order. Published accumulation is the
result of that canonical topological pass.

## Water bodies and rivers

### Lakes and ocean

A connected depression with `depressionDepth >= minimumLakeDepthMeters` is a
lake. Its water level is the basin component spill elevation and is perfectly
horizontal. A cell receives lake water only when its terrain height is strictly
below `waterLevel - epsilon`; dry slopes are not filled by projection. The
comparison epsilon is part of the versioned numeric validation policy and is
not an unlisted hydrology tuning constant.

`WaterBodyId` is stable from `datasetId`, the minimum global cell coordinate of
the component, quantized spill elevation, and generator version. The canonical
serialization for these parts is fixed before hashing and is independent of
discovery order. Ocean is boundary-connected below-sea water and cannot be
reclassified as an isolated depression.

### Rivers

Cells with accumulation at least `riverSourceAccumulationCells` begin river
segments. A segment follows canonical D8 flow until it reaches ocean, a lake,
the dataset boundary, or a confluence with a larger segment. The first global
source cell defines the `RiverSegmentId`. Segment records and cells are sorted
by their global coordinates/IDs, never by object insertion order.

River water surface height is downstream monotonic non-increasing. A river that
cannot terminate at lake, ocean, or boundary, or that would rise downstream,
fails validation rather than being repaired silently.

## Channel and moisture sampler

`sampleHydrologyTerrainAdjustment(globalX, globalZ)` is pure and returns finite
`channelDepth`, `channelDistance`, `bankBlend`, `adjustedTerrainHeight`,
optional `waterSurfaceHeight`, optional `waterBodyId`, and `moisture`.

For accumulation `A` and threshold `T`:

```text
carveDepth = clamp(
  minimumRiverDepthMeters + 0.35 * log2(A / T + 1),
  minimumRiverDepthMeters,
  maximumRiverDepthMeters
)
halfWidth = clamp(
  minimumRiverHalfWidthMeters + 0.60 * sqrt(A / T),
  minimumRiverHalfWidthMeters,
  maximumRiverHalfWidthMeters
)
```

`channelBankSlope = 0.65` controls the finite bank blend. Channels incise the
sampled terrain and never overlay unchanged ground. Moisture is a finite,
deterministic value in `[0, 1]` derived from distance to ocean, lake, or river
and basin/depression depth, with `moistureFalloffMeters = 18`; it is not a
simulation state.

## Snapshot, freeze, bytes, and hashes

The constructor validates input, clones caller-owned values, and recursively
freezes every nested snapshot object and collection. Cycles, non-finite
numbers, unsafe coordinates, mutable typed-array aliases, and unsupported
values fail closed. The implementation follows the repository's existing
canonical clone/deep-freeze and FNV-1a hashing semantics without modifying the
central utility.

Canonical snapshot bytes contain version, dataset identity, grid/origin,
parameters, canonical cells, water bodies, river segments, and sample outputs in
global Z/X order. Optional values have one canonical representation; IDs and
numeric fields are serialized in fixed field order. The hash is calculated only
from these bytes. Repeated generation, changed caller order, and object reuse
must not affect bytes or hashes. A changed root seed or terrain input must
change the snapshot hash.

## Memory budget and deterministic estimator

The V2 contract cap is **8 MiB for the deterministic retained-representation
estimate of one generated snapshot**. The estimator counts the frozen public
snapshot graph under fixed value/reference/container constants and the packed
canonical string at two bytes per code unit. Shared objects and graph strings
are counted once. Generation fails closed when this estimate exceeds the cap,
and the audit repeats generation to prove deterministic accounting.

This estimator deliberately is not V8/browser engine heap telemetry. It does
not claim a process peak, temporary solver working-array usage, allocator or
engine object-header behavior, or garbage-collection effects. The cap bounds
the documented representation model for the fixed `129 x 129` samples and
`128 x 128` cells; it is not a license for unbounded dynamic allocation.

## Fail-closed validation and risks

Reject invalid dimensions, misaligned origins, unsafe global coordinates,
non-finite terrain or derived values, invalid parameter ranges, broken D8
outlets, cycles, non-monotonic river surfaces, floating water, mutable output,
hash mismatches, and memory-budget violations. Do not clamp or repair invalid
caller input silently.

Primary risks are floating-point tie drift, local-coordinate identity leaks,
representation growth from rich frozen objects, and accidental coupling to browser or
renderer state. Canonical ordering, fixed quantum coordinates, explicit
parameters, direct-module tests, recursive-freeze/hash audits, and the bounded
fixture address those risks.
