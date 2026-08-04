# Browser Voxel Representation Ladder V2

## Status and boundary

This document records the implemented pure-core/browser contract foundation
under `apps/weltraum-browser/src/voxel/representation/**`. It adds a
descriptor-driven ladder for derived products above the existing Adaptive
Microvoxel Authority. It is not a claim that the Browser product has a voxel
renderer, planet runtime, or live representation streaming.

The Adaptive Microvoxel Authority remains the only authority for voxel content,
edits, provenance, and coverage. This V2 foundation does not change its levels,
sizes, reasons, canonical hash, provenance, journal, Structural authority, or
existing accepted limits.

## Adaptive authority remains unchanged

The existing Adaptive V1 contract remains canonical:

- base quantum is `0.125 m`;
- levels remain exactly `L0` through `L4`;
- the level cell sizes remain `2 m`, `1 m`, `0.5 m`, `0.25 m`, and `0.125 m`;
- its complete reason union remains `Inspection`, `PlayerProximity`,
  `CollisionRequired`, `ToolInteraction`, `Explosion`, `ProjectileImpact`,
  `MeteorImpact`, and `StructuralFracture`;
- Adaptive keys, canonical JSON, `fnv1a64-v1`, materialization hashes,
  provenance, immutable Base Field, and the ordered immutable edit journal
  remain the authority contracts;
- Structural connectivity, mass, collision, persistence, and gameplay outcomes
  remain outside this derived representation layer.

Representation band ranks are not Adaptive levels. The ladder reuses the public
Adaptive canonical hashing and validation/freeze utilities; it introduces no
second voxel key, serializer, hash, journal, provenance, or world authority.

## Descriptor-driven derived bands

`RepresentationLadderDescriptor` is a strict schema-V2 value containing between
one and `REPRESENTATION_MAX_BANDS` (`32`) derived product bands. Rank zero is the
finest band; ranks are unique and contiguous; geometric error is positive and
strictly increasing with rank. Each band declares:

- stable `bandId`, product kind, algorithm version, and product version;
- positive finite coverage bounds;
- required source bindings (`AdaptiveAuthority`, `StructuralAuthority`, and/or
  `EditJournal`);
- readiness requirements and allowed domains;
- an optional visual Adaptive level, which is a render-policy cap and not a new
  authority level;
- bounded estimated bytes, work units, and upload units.

The contract accepts a count-driven `1..32` band descriptor. The focused unit
proof uses at least 12 bands only to prove that the ladder is not a fixed
six-level or five-level union; 12 is not a fixed production band count.

The declared product path can describe local voxel/render proxies,
damage-aware object proxies, SurfaceRegion and SurfaceTile proxies, Celestial
proxies, Structural meshes, and an Adaptive microvoxel product. `Culled` is a
selection outcome only and is never a product or authority source. These kinds
describe derived contract roles; they do not instantiate the corresponding
runtime systems.

Descriptor validation rejects unknown or accessor fields, sparse/inherited
data, duplicate IDs or ranks, rank gaps, non-monotone errors, malformed
bindings, non-finite values, and over-cap collections before publication. Valid
values are defensive copies and recursively frozen. Descriptor and decision
hashes use the existing Adaptive canonical hash.

## Proxy identity and source binding

Proxy content identity contains only stable source/product bindings and the
derived product algorithm:

- an object proxy binds `objectId`, object revision, Structural content hash,
  damage digest, band, proxy algorithm version, and computed proxy content
  hash;
- a surface proxy binds body and surface-frame IDs, a `Region` or `Tile`
  location, generator version, source revision, edit revision, source content
  hash, band, proxy algorithm version, and computed proxy content hash.

Camera position, distance, viewport, FOV, quality, queue, worker, cache,
timing, and other transient selection metadata are excluded from both proxy
identities. Current-source checks recompute the proxy content hash and reject
tampering, stale revisions, and mismatched source or damage hashes. An old
intact object proxy therefore cannot become current after Structural damage or
a revision change; a stale, incomplete, cancelled, invalid, or otherwise
non-current product is not ready or settled coverage.

## Screen-space selection

The pure screen-space error calculation is:

```text
focalLengthPixels = viewportHeightPixels / (2 * tan(verticalFovRadians / 2))
distanceToBounds = max(minimumDistanceMeters,
  distance(cameraPosition, boundsCenter) - boundsRadiusMeters)
projectedErrorPixels = geometricErrorMeters * focalLengthPixels /
  distanceToBounds
```

Projected bounds radius uses the same focal length and distance-to-bounds
denominator. Inputs are validated finite semantic values; invalid FOV, bounds,
radius, distance, viewport, or error values fail closed.

Selection canonicalizes candidates by band ID and rank rather than trusting
insertion order. Only `Ready` candidates with `sourceCurrent: true`, a Render
domain, an allowed visual Adaptive level, and costs inside the selected policy
are visual candidates. The deterministic choice is the **coarsest ready band
within the refine-error boundary**; if none is within that boundary, the
deterministic finest-ready fallback is used. Rank and canonical band ID are the
tie-breakers. Culling has separate distance and projected-bounds thresholds.

An explicit prior band is the only hysteresis input. A current coarse band is
held until its projected error crosses the refine boundary; a transition to a
coarser band is held until the target is below the lower collapse boundary.
Refine, collapse, hold, fallback, and culling reasons are stable, and the
decision hash covers canonical inputs and outcomes. Quality and render choice
are not used to derive simulation or authority state.

## Render, simulation, and readiness separation

An accepted decision publishes separate:

- `renderSelection` (`Band` or `Culled`);
- `simulationRequirements`;
- `requiredAuthorityRequests`;
- `fallbackDecision`;
- `readiness`;
- `evictionEligibility`;
- deterministic decision reasons and `decisionHash`.

Graphics quality filters visual products and visual budgets only. The same
authority and Structural inputs therefore retain the same interaction and
simulation requirements under Low and Ultra even when their render choices
differ. Selection validates and preserves supported soft Adaptive requests;
only hard interaction reasons are rebuilt through the L4 requirement factory.
A rejected selection is typed and whole-result empty; no partial selection,
authority edit, or settled coverage is published.

## Interaction pins and no coarse edits

The six hard Adaptive interaction reasons remain unchanged:
`CollisionRequired`, `ToolInteraction`, `Explosion`, `ProjectileImpact`,
`MeteorImpact`, and `StructuralFracture`. Each creates an Adaptive request for
hard `L4` coverage, independently of visual quality or selected render band.

Representation lifecycle pins are a separate union:
`ActiveRigidBody`, `UnsettledFragment`, `StructuralSolvePending`, and
`PhysicsHandoffPending`. They do not extend or replace the Adaptive reason
union and do not make fine visual detail authoritative.

A proxy interaction can resolve only from explicit Adaptive quantum
coordinates, current `L4` coverage, and an available authority-work budget.
Missing coordinates return `NOT_READY`; missing coverage returns `NOT_READY`;
an exceeded authority budget returns `Blocked`. None of these outcomes contains
coarse edit coordinates or performs a coarse edit. The representation layer
never derives edit geometry from render resolution.

## Structural retention and eviction

Derived products are not evictable while Structural state is `Dirty` or
`Solving`, or while an active lifecycle pin exists. Explicit `Settled` state with
no blocking pin may release fine derived products. Sleeping by itself does not
override a pending handoff pin. Adaptive authority, the complete edit journal,
and Structural source bindings remain retained in every case; only derived
products are eligible for release.

## Atomic parent fallback

Fallback groups are bounded and revision-bound. Each group declares the exact
canonical child IDs required for complete replacement and carries explicit
parent presence, readiness, and revision evidence. A complete `Ready` parent at
the group revision remains the sole settled coverage for zero, partial, stale,
invalid, cancelled, incomplete, or mixed-revision children. Parent and partial
children are never published as mixed settled coverage. Selection receives the
raw fallback group and derives the published decision through the atomic
resolver; direct caller-built child-coverage decisions are not accepted. Only
all required children that are current, ready, and at the exact group revision
replace the parent in one atomic decision. If neither full children nor a
complete current parent exists, resolution fails closed with typed
`InvalidFallback` and publishes no settled coverage. The contract proves the
required 64-child transition, while the helper remains count-driven within the
finite child cap.

## Budgets and fail-closed admission

Finite limits bound bands, selection candidates, active pins, source bindings,
readiness requirements, domains, fallback groups and children, estimated bytes,
work units, and upload units. The published hard limits include 32 bands, 256
selection candidates, 64 active pins, 16 source/readiness entries per band,
256 fallback groups, 4,096 fallback children, `1,099,511,627,776` estimated
bytes, and `1,000,000,000` work or upload units. These are safety and work
limits, not benchmark-certified product-distance budgets.

Over-cap input is rejected before expensive copy/sort/hash work. A selection
whose required visual budget cannot be admitted returns one typed,
side-effect-empty rejection with no partial result. Interaction work beyond its
explicit authority budget is `Blocked`, with no edit. The contract does not
silently clip, substitute, or publish an incomplete result.

## Graphics Settings V2 and visual policy

Graphics Settings V2 keeps the complete V1 settings payload and adds a strict
`voxel` group:

```text
voxel.detail: Low | Medium | High | Ultra
voxel.detailDistanceMeters: positive finite distance
voxel.streamingBudget: Low | Medium | High | Ultra
```

Valid V1 storage migrates explicitly by preserving every V1 field. Concrete
quality presets gain their matching V2 voxel values: Low (`Low`, `750 m`,
`Low`), Medium (`Medium`, `2,000 m`, `Medium`), High (`High`, `4,000 m`,
`High`), and Ultra (`Ultra`, `8,000 m`, `Ultra`). A derived Custom preset gains
the deterministic defaults (`High`, `4,000 m`, `High`). Missing, corrupt,
invalid, and future-version storage uses the existing fail-closed load result
and is not silently overwritten. V2 values are defensively copied and frozen.

The pure adapter exposes this provisional visual-only policy:

| Detail | Maximum visual Adaptive level | Detail distance | Max bytes | Max work/upload |
| --- | ---: | ---: | ---: | ---: |
| Low | L2 | 750 m | 64,000,000 | 100,000 |
| Medium | L3 | 2,000 m | 128,000,000 | 250,000 |
| High | L3 | 4,000 m | 256,000,000 | 500,000 |
| Ultra | L4 | 8,000 m | 512,000,000 | 1,000,000 |

These values are versioned provisional policy values, not benchmark or final
product calibration. `voxel.detailDistanceMeters` is separate from
`display.renderDistance`: the latter remains camera far-plane/culling state and
is not a voxel authority or streaming distance. Beyond the policy detail
distance, selection limits visual Adaptive detail to the Low/L2 cap while
leaving simulation and Authority requirements unchanged.

The pure policy port has no production representation consumer. Voxel controls
remain hidden and no voxel capability is claimed as `SupportedLive`; persistence
of settings and construction of a pure policy do not constitute live runtime
support.

## Evidence surface

The implemented unit contract is covered by these deterministic test paths:

- `apps/weltraum-browser/tests/unit/voxelRepresentationDescriptor.test.ts`
- `apps/weltraum-browser/tests/unit/voxelRepresentationSelection.test.ts`
- `apps/weltraum-browser/tests/unit/voxelRepresentationProxy.test.ts`
- `apps/weltraum-browser/tests/unit/voxelRepresentationFallback.test.ts`
- `apps/weltraum-browser/tests/unit/voxelQualityPolicy.test.ts`

The normal-route browser proof is
`apps/weltraum-browser/tests/e2e/voxel-representation-ladder-v2.spec.ts`.
Its deterministic evidence pair is
`apps/weltraum-browser/evidence/browser-voxel-representation-ladder-v2.md` and
`apps/weltraum-browser/evidence/browser-voxel-representation-ladder-v2-summary.json`.
The proof uses the normal `/` route, keeps `window.TestBridge` absent, records
empty console/page/request/HTTP error lists, and emits timestamp-free,
byte-deterministic evidence. It is a pure-contract browser proof and makes no
visual or runtime-integration claim.

## Explicit non-integration boundary

This implementation is pure-core/browser contract code only. It does not
provide or claim:

- a renderer, Three.js representation consumer, GPU product, worker, cache, or
  streaming runtime;
- a `SurfaceRegion`, `SurfaceTile`, or Celestial runtime;
- a procedural planet shell, planet-to-surface runtime, or runtime terrain LOD;
- proxy mesh generation, collision/physics handoff, or building-collapse
  runtime;
- gameplay, flight/navigation, save/persistence storage, economy, or
  multiplayer integration.

The existing Hestia Surface Lab remains its separate query-gated technical
proving ground and is not made a consumer of this ladder. The procedural planet
runtime remains docs-only. Any future runtime or handoff integration requires
its own approved contract and change.
