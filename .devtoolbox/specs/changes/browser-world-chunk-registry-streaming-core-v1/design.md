# Design

## Architecture
Add three renderer-free world modules:
- `chunkRegistry.ts`: chunk contracts, validation, immutable registry, spatial queries, canonical registry signature.
- `worldStreaming.ts`: policy validation, AABB-distance band selection, hysteresis, independent simulation/render budgets, transition diffing, canonical snapshot serialization/signature.
- `worldStreamingScenario.ts`: deterministic plain-object evidence scenario; no Three.js or live runtime dependencies.

Reuse `WorldCoordinate`/frame projection contracts, `SimulationUpdateMode` and `SimulationBubbleDescriptor`, plus `stableStringify` and `fnv1aHash`. Do not modify those contracts unless compilation proves a narrow additive compatibility change is required and the path is not forbidden.

## Registry Decisions
- Cubic centered grid: center = coordinate * chunkSize, half extents = chunkSize / 2.
- Metadata stores canonical ID, coordinate, absolute bounds, sorted unique entity IDs/render batch keys, revision, and optional importance/category.
- Registration validation order is duplicate ID, occupied coordinate, canonical ID, then coordinate/bounds/metadata validation so duplicate and conflict errors remain separately observable.
- All reads return defensive deep-frozen data. Listings sort numeric x/y/z, then code-unit ID.
- Radius uses inclusive sphere/AABB intersection; bounds uses inclusive AABB/AABB intersection.

## Streaming Decisions
- Distance is the minimum Euclidean distance from absolute observer position to chunk AABB.
- Each assignment records requested simulation/render bands after hysteresis and final bands after budgets.
- Requested bands use the prior requested band for hysteresis. Budgets are recalculated without stickiness each snapshot.
- Candidate allocation order is distance then ID. Full overflow enters the Snapshot pool. Entity cost is the chunk's deduplicated entity-ID count; an oversized candidate is skipped while later smaller candidates may still fit.
- Visible budgeting is independent and only changes final render LOD to Culled.
- Serialized arrays use stable ID ordering; budget rejections use fixed reason ordering then ID.
- Transition order is chunk ID followed by: ChunkActivated, ChunkPromotedToFull, ChunkDemotedToSnapshot, ChunkBecameDormant, ChunkEnteredRenderRange, ChunkChangedLod, ChunkLeftRenderRange.
- Incompatible previous registry/policy signatures throw an explicit error; callers establish a new baseline by omitting previousSnapshot.
- Streaming signature covers current absolute state, registry/policy signatures, requested/final assignments, and budget outcomes, but not transition history or the signature field itself. Full serialization includes ordered transitions.

## Scenario and Evidence
Use a 256 m cubic grid, deterministic chunks and entity IDs, observer positions x=0, 240, and 520, and deliberately bounded Full/Snapshot/visible/entity budgets. Run the same absolute state through two floating-origin frames and record unchanged absolute positions, velocity, residency, budgets, and signature alongside changed projections and `rendererOwnsWorldTruth: false`.

Expose only `runWorldStreamingScenario()` through the already query-gated `browserBridge.ts`. The E2E test writes:
- `evidence/browser-world-chunk-registry-streaming-v1.md`
- `evidence/browser-world-chunk-registry-streaming-v1-summary.json`

Existing regression specs may regenerate unrelated UI evidence; those generated changes must not be staged or committed.

## Risks and Safe Stops
- Floating-point thresholds: use finite validation, inclusive intersections, canonical sorted output, and explicit hysteresis.
- Hash misuse: signatures prove deterministic equality, not cryptographic identity.
- Budget/transition coupling: hysteresis uses requested bands while transitions compare final bands.
- Any need to modify forbidden UI/render/runtime-HUD, Assets, package, or lock files is a blocker, not permission to expand scope.