# Hestia Hydrology Terrain Generator V2

## Status and boundary

Hestia Hydrology V2 is a pure, deterministic, recursively frozen regional
dataset under
`apps/weltraum-browser/src/world-generation/hestia/hydrology/**`. Consumers
must import its `index.ts` directly. V2 has no integration with `main.ts`, the
parent Hestia barrel, presets outside hydrology, workers, renderer, UI, or the
runtime.

The public contracts are `HestiaHydrologyDatasetId`,
`HydrologyDatasetRevision`, `WaterBodyId`, `RiverSegmentId`,
`HydrologyGlobalCoordinate`, `HydrologyCellCoordinate`,
`HydrologyGridDefinition`, `HydrologyParameters`, `TerrainHeightSampler`,
`HydrologyInput`, `HydrologySample`, `HydrologyCell`, `WaterBody`,
`RiverSegment`, `HydrologyTerrainAdjustment`, `HydrologyMemoryBudgetEstimate`,
and `HydrologySnapshot`. `generateHestiaHydrology` (also exported as
`generateHestiaHydrologyDataset` and `createHestiaHydrologySnapshot`) is the
constructor. `sampleHydrologyTerrainAdjustment` and
`createHydrologyTerrainAdjustmentSampler` are the query API.

## Global identity and fixed grid

| Field | V2 value |
| --- | ---: |
| Cells | `128 x 128` |
| Samples | `129 x 129` |
| Spacing | `2 m` |
| Extent | `256 x 256 m` |
| Global coordinate quantum | `0.125 m` |
| Origin alignment | `16` quanta (`2 m`) |

The origin is an aligned integer coordinate in global quanta. Sample `(x,z)`
is `origin + (16*x,16*z)` in quanta. Global Z ascending and then global X
ascending is the canonical order. A row-major index is published only as a
stable index into that fixed order; local array identity is not a world
identity. Unsafe, unaligned, non-finite, or dimension-changing inputs fail
closed.

## Versioned preset

The generator and dataset revision is `hestia.hydrology.generator.v2`.

| Parameter | V2 value |
| --- | ---: |
| `gridSpacingMeters` | `2` |
| `seaLevelMeters` | `0` |
| `minimumLakeDepthMeters` | `0.15` |
| `riverSourceAccumulationCells` | `48` |
| `minimumRiverDepthMeters` | `0.20` |
| `maximumRiverDepthMeters` | `2.50` |
| `minimumRiverHalfWidthMeters` | `0.50` |
| `maximumRiverHalfWidthMeters` | `4.00` |
| `channelBankSlope` | `0.65` |
| `moistureFalloffMeters` | `18` |
| `comparisonEpsilonMeters` | `1e-9` |
| `spillElevationQuantizationPerMeter` | `1,000,000` |
| `carveDepthLog2Coefficient` | `0.35` |
| `halfWidthSqrtCoefficient` | `0.60` |
| `riverWaterSurfaceDepthFraction` | `0.50` |
| `accumulationContributionPerCell` | `1` |

The formula policy revisions are `linear-distance-plus-depression-v1`,
`log2-sqrt-v1`, `priority-flood-parent-v1`, and `linear-slope-v1` for moisture,
channel geometry, flat routing, and bank blending respectively. V2 accepts the
exported preset values exactly (independent of caller property order); finite
but substituted coefficients or policy versions fail before terrain sampling.
The input/global sea level is validated separately for finiteness and equality
with the versioned preset.

## Algorithms and deterministic tie orders

1. The terrain sampler receives each global X/Z metre coordinate exactly once
   in canonical order and must return a finite height.
2. Ocean classification starts only at boundary samples at or below sea level
   and uses deterministic 8-neighbour connectivity. An isolated below-sea
   depression is not ocean.
3. Priority flood orders by filled elevation, global Z, global X, and stable
   linear index. It publishes filled elevation, spill elevation, depression
   depth, and basin identity.
4. D8 uses exactly `N, NE, E, SE, S, SW, W, NW`. The strongest negative slope
   wins; equal slopes use the earlier direction. Flat interiors use the
   priority-flood parent. The resulting graph must be acyclic.
5. Accumulation starts at one per cell. Ready cells are ordered by filled
   elevation descending, global Z, and global X.
6. A qualifying depression becomes a horizontal lake at spill elevation. Lake
   water is published only where terrain is strictly lower than the level by
   the named epsilon. Ocean remains boundary-connected.
7. River segments start at accumulation `>= 48` and follow D8 to a lake, ocean,
   dataset boundary, or a strictly larger confluence. Every confluence chain
   must ultimately resolve to lake, ocean, or dataset boundary. Water surfaces
   are downstream non-increasing.

For accumulation `A` and threshold `T`, channel geometry is:

```text
carveDepth = clamp(0.20 + 0.35 * log2(A / T + 1), 0.20, 2.50)
halfWidth  = clamp(0.50 + 0.60 * sqrt(A / T),     0.50, 4.00)
```

## Terrain-adjustment sampler

`sampleHydrologyTerrainAdjustment(snapshot, globalX, globalZ)` accepts only a
frozen V2 snapshot and a query inside its fixed global extent. It bilinearly
interpolates retained terrain samples and returns finite `channelDepth`,
`channelDistance`, `bankBlend`, `adjustedTerrainHeight`, and moisture in
`[0,1]`, plus optional `waterSurfaceHeight` and `waterBodyId`.

Water is returned only for a containing published lake/ocean cell below its
level or inside a river half-width where the water surface is above the incised
terrain. At exact east/south maximum sample coordinates, water identity and
level come from that boundary `HydrologySample`; the adjacent interior cell is
not allowed to invent or suppress boundary water. Interpolation indices are
clamped before lookup, including zero-weight edge terms. The sampler retains no
caller terrain function and creates no dynamic liquid state.

## Determinism, canonical bytes, hash, and freeze

Generation clones caller-owned values and recursively freezes every published
object and array. Mutable typed-array aliases, cycles, unsupported values, and
non-finite values are rejected. Canonical JSON uses a fixed field order and
canonical collection order, then packs UTF-8 two bytes per immutable string
code unit. `contentHash` is FNV-1a 32 over the resulting packed immutable string
code units—not raw JSON text, process memory, or an engine object graph.
Identical input must produce identical canonical strings, IDs, collections,
and hashes.

The browser fixture generates the same canonical representation twice and
records both hashes and equality flags. Its JSON and Markdown evidence contain
no timestamp, random identifier, absolute path, host value, or screenshot.

## 8 MiB retained-representation budget

The deterministic `hydrology-retained-representation-v1` estimator counts each
shared frozen object once, fixed-width number/boolean/reference slots, each
distinct graph string once, container overhead, prototype references, and the
packed canonical string at two retained bytes per code unit. It is a stable,
fail-closed representation estimate rather than a process-specific heap sample.

The fixed estimator assumptions are 16 bytes per counted container, 4 bytes per
reference slot, 8 bytes per number, 1 byte per boolean, 16 bytes per distinct
string header, and 2 bytes per UTF-16 code unit. It estimates the retained
frozen graph plus packed canonical representation only. It excludes temporary
solver working storage, allocator behavior, engine object headers, garbage
collection, and every notion of V8/browser peak heap telemetry. The browser
evidence records current component values, total, 8,388,608-byte cap, and
margin; a high-river/high-lake unit fixture also exercises the cap.

## Normal-route browser proof and evidence

`apps/weltraum-browser/tests/e2e/hestia-hydrology-generator-v2.spec.ts` loads
ordinary `/` with an empty query, proves `window.TestBridge` absent before and
after import, and dynamically imports
`/src/world-generation/hestia/hydrology/index.ts` with `/* @vite-ignore */`.
No test-only bridge or runtime hook is used.

The fixture derives local shape only by subtracting a non-zero aligned global
origin from the global coordinates supplied to its sampler. It contains one
qualifying isolated lake, one boundary-connected ocean, and enough converging
drainage for rivers. Listeners are installed before `page.goto`; the proof
publishes and asserts four browser-health arrays, all required to be empty:

- `consoleErrors`
- `pageErrors`
- `requestFailures`
- `httpErrors`

Solver checks remain separate domain diagnostics:

- `flowCycles`
- `invalidRiverTerminals`
- `upstreamWaterLevelRises`
- `floatingWaterSamples`

The proof also checks lake/ocean counts, non-empty river segments and points,
records every confluence-chain path and resolved terminal, water-body
membership, lake/ocean terrain rules, channel ownership, hash/byte equality,
and the 8 MiB estimate. External typecheck, unit, path, and API scan outcomes are
explicitly marked as not run by this browser fixture until a later verifier
records independent command evidence.

Deterministic artifacts:

- `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2-summary.json`
- `apps/weltraum-browser/evidence/browser-hestia-hydrology-generator-v2-summary.md`

No screenshot is expected because this direct-import proof changes no visual,
DOM, renderer, or UI contract.

## Verification

Run from `apps/weltraum-browser` without installing or updating dependencies:

```text
npx tsc -p tsconfig.json
npx vitest run tests/unit/hestiaHydrology*.test.ts
npm run test:e2e -- tests/e2e/hestia-hydrology-generator-v2.spec.ts
```

The E2E file is intentionally invoked explicitly; package-script group
assignment is outside this slice. At repository root also run:

```text
git diff --check
```

## V2 limits

V2 is regional and static only. It does not provide dynamic liquid simulation,
globally complete planetary hydrology, cross-region continuity, erosion over
time, runtime/gameplay integration, renderer integration, UI, worker wiring,
or parent-barrel integration. Those remain separate contracts and must not be
inferred from this dataset or its browser proof.
