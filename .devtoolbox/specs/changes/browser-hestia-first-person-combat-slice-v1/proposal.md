# Proposal

## Change
`browser-hestia-first-person-combat-slice-v1`

## Problem
The first integrated `/?surfacePlay=1` slice passed its technical unit, build and
E2E gates but failed the user's manual play test on 2026-07-27. The current
route presents a tiny, steep, sea-level-capped terrain fixture with real water
patches and a globally dark fog, deterministically slides a grounded idle
player downhill, presents non-authoritative Three.js trees that neither block
movement nor beam hits, provides no structural tree destruction/fall physics,
uses a debug-like overlapping HUD, and allows only ten accepted shots without
energy recovery.

The old green checks prove internal consistency, not visual or play quality.
The rejected screenshots are failed evidence and cannot close any task.

During V3 implementation, independent review found a second-order defect:
after the first tree body detaches, its cells remain in the current Structural
object. A later stump hit can re-revision those historic cells, derive a second
body and lose immutable mesh/collider provenance. A presentation-only lineage
filter cannot repair that authority error.

## Goal
Recover the existing bounded Hestia Surface Play route into a manually
acceptable combat/terrain/vegetation slice while preserving authority
boundaries. The revised slice must provide:

- a deterministic dry Hestia land anchor selected from the finite
  `x,z=-64..64 m` / `16 m` lattice by distance, global `z`, then global `x`,
  plus a connected `SurfaceTraversalDomain` and bounded
  `64 x 32 x 64 m @ 0.50 m` footprint whose Runtime-owned shore boundary
  prevents any player/camera water intersection;
- world-owned water/shore/vegetation facts, readable Hestia lighting/materials,
  and one Surface light-rig owner;
- stable zero-input locomotion on walkable slopes without blanket
  velocity-zero behavior;
- authoritative voxel Umbrella Trees that block the player and Pulse Cutter,
  accept local damage through Combat Core plus Structural Authority, detach
  when root support is lost, and fall/rest through deterministic fixed-tick
  physics;
- a finite `240 J` Pulse Cutter budget with deterministic delayed recovery and
  a still-visible typed `EnergyInsufficient` path;
- a restrained player HUD with clear Energy/Heat hierarchy, center-safe target
  presentation, bounded feedback lifetime and player-safe next-action copy;
- fresh unit, integration, E2E, screenshot, runtime-authority and manual-play
  evidence for the defects that escaped the old gates.

## In Scope For This Change
- After explicit user approval, apply the exact reviewed renderer-independent
  `Structural` hit/event, public body/capacity fire-rejection codes, two
  deliberate required-readiness constructor migrations, Structural transition,
  dynamic-body, presentation-port and typed physics-failure contract delta.
- Replace the two-brick origin fixture with a deterministic admitted Hestia
  land footprint while retaining bounded-region identity.
- Correct water/world ownership, spawn admission, lighting, material and
  vegetation presentation.
- Correct the grounded support/rest model.
- Selectively port the historical Hestia structural vegetation foundation from
  `897711024458062e3965c26cec05bd34c61d50db` onto current Adaptive/Structural
  APIs; never merge that branch wholesale.
- Add revision-bound Structural collision, the approved quantized local edit,
  atomic whole-batch body reservation, public no-shot-cost/no-damage rejection
  for capacity and detached-body hits, and the fully specified bounded Surface
  Body algorithm.
- After separate explicit V3.1 approval, add one canonical Structural-Core
  detached-Fragment transfer plus required nullable `authorityTransfer` and
  required historical `bodySources`; do not add a new Combat code or mutate the
  Dynamic Body shape.
- Revise finite Energy recovery and player HUD behavior.
- Extend automated and manual acceptance evidence around every rejected state,
  including uphill/downhill shore replay and preservation of the existing
  unobstructed Terrain CAS/revision/hash/collision/remesh flow.

## Approved Task 22 scope revision — Unified Adaptive Brick Authority

The user-approved Task 22 revision makes one revisioned authority the canonical
truth for terrain, trees and vegetation. Its immutable snapshot binds
occupancy/density, material, ordered edits and provenance, authority identity,
revision and content hash. The canonical set is cells/material/edits/provenance/
ID/revision/hash; support roots/evidence, fracture/components, mass and physics
are deterministic derived products of that same revision/hash. Tree graphs and
Coast generators remain authoring inputs only.

This is an adaptive-brick contract, not a global dense leaf volume. Existing
`16^3` Adaptive bricks and byte-valid `L0`-`L4` keys/hashes remain unchanged:
`L4=.125 m`, `L3=.25 m`, `L2=.5 m`, `L1=1 m`, `L0=2 m`. Ground normally uses
`L2/L3`, rock/fracture/trunk `L4`, and distant products `L1/L0`. Optional local
`L5=.0625 m` is only a measured same-camera A/B gate for fine vegetation, never
an assumed production level. Only uniform `2x2x2` children with no edit,
fracture or structural-class boundary may coalesce; equality also covers
density/occupancy, material, edit boundary/result, source/provenance and the
required structural class. Parent cells/bricks remain derived. Neighboring LOD
differs by at most one; brick bounds are half-open, the coarse face owns the
deterministic blocky 2:1 transition strip, the fine face is suppressed, and
lexicographic edge/corner tie-breaking is required. Far products never become
gameplay truth. The optional L5 A/B must improve the same-camera view within the
`16 MiB` page and `64 MiB` retained-memory limits, with at most 64 colliders per
body, action acknowledgement under 100 ms, publication p95 at most 250 ms and
no Main long task over 100 ms; no cost improvement is required.

The Main Thread captures and owns the immutable snapshot and command initially.
Workers receive the seed once and then typed-array dirty-brick deltas carrying
authority/predecessor/result revision and hash, protocol/schema versions,
authority-derivation-algorithm and material-table versions, epoch and
cancellation/stale-result commitments. A worker derives only a private
candidate; only Main validation followed by one atomic adoption creates the
next authority, and any commitment mismatch is rejected before adoption. The
proof reuses the existing `16 MiB` batch, queue and gate patterns, measures
actual dirty-brick payload (the current materialized planner estimate is
`128 KiB`, so no `64 KiB` claim is allowed), and does not introduce
SAB/COOP/COEP, OffscreenCanvas, WebGPU or worker-owned authority. Initial
projection is Three.js WebGL BufferGeometry/batching; exact physics uses the
existing `32 m` tier with sleeping/exact `96 m` policy and the same revision.

The former Task 22 exclusion of streaming/LOD is explicitly superseded only by
this local hierarchical LOD and dirty-brick streaming needed by the authority.
Planet-scale streaming, a full SVO rewrite and mandatory WebGPU remain out of
scope. The old exclusion of non-tree vegetation is pre-Task22 history. Phase 2
must include a deterministic L0-L4 fixture containing ground, trunk,
vegetation and fracture; L5 is optional and A/B-only. Coast adapters stay in
place until shadow parity; the old PreparedFire full-state path is removed
last. The complete proof order, gates and resumable handoff are in
`docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md`.

## Out of Scope
- Global planet streaming, orbit-to-surface transition, swimming or underwater
  player-medium gameplay.
- External/WASM physics-engine adoption or new runtime package dependencies.
- Authoritative vegetation beyond Umbrella Trees; Mist Sprouts/Caps remain
  non-solid decoration for this slice.
- Persistence of fallen debris across reloads, economy/cargo/ammo systems,
  multiplayer, generalized encounter AI or final game-wide balance.
- Surface Lab behavior changes, TestBridge, debug cheats or presentation-owned
  gameplay truth.
- Commit, push, PR, main merge, task closure or final Plannotator review before
  the new manual play gate succeeds.

## Success
The revised spec and ExecPlan are approved before contract/product mutation.
After implementation, fresh tests and runtime evidence must prove the
authoritative flows, the screenshot matrix must satisfy the Hestia/UI
acceptance rules, and the user must explicitly accept a new manual play
session. Only then may technical review, DevToolbox completion preflight, final
human diff review, commit and non-force push proceed.

Root-cause evidence:
`tests/manual-play-rejection-analysis-2026-07-27.md`.
