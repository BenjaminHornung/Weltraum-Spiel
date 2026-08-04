# ExecPlan: Hestia Surface Play Manual-Recovery V3

Status: V3.1 approved; implementation in progress  
Date: 2026-07-28  
Execution owner: `orchestrator`

## User-prioritized execution order — 2026-07-29

This order supersedes the numeric phase order for orchestration while retaining
all existing open requirements:

1. Complete the three already-running Core slices only: Resting-body Player
   collision/escape, hit-derived physical Tree release and incremental
   Structural Connectivity. Finish their review, automated gates and real
   browser checkpoint.
2. Build the `F1`-toggleable, read-only performance/debug overlay.
3. Use the complete `docs/Konzeptart/Hestia` screenshot set as the binding
   input to a revised Biome/World/Game-design plan, then implement the approved
   generator, presentation and necessary Core changes.
4. Re-run the existing bug inventory against that new baseline and continue
   only the defects that still reproduce.
5. Defer the SimCity-style World editor until last; permit only conflict-free
   preparatory work when an agent lane would otherwise be idle.

Each stage retains Unit, E2E, real-Chrome playtest/screenshot and explicit user
manual-verification gates. No additional legacy Core bugfix is started while
the new World/Core baseline is pending.

## Goal

Recover the rejected `/?surfacePlay=1` Hestia first-person combat slice into a
bounded, deterministic and manually acceptable player experience.

At the end:

- the player starts inside a connected, Runtime-admitted dry Hestia traversal
  domain with no visible region edge or player/camera water intersection;
- zero-input locomotion rests on walkable slopes;
- Umbrella Trees are authoritative voxel structures that block the player and
  Pulse Cutter, accept local damage, detach on support loss, fall through real
  deterministic fixed-tick physics and remain collidable at rest;
- Terrain destruction, Drone combat and typed failure behavior remain
  authoritative;
- the finite Energy profile supports the complete manual test sequence and
  deterministic recovery without becoming an infinite-energy cheat;
- the player HUD is center-safe, separates Energy from Heat and gives
  player-safe reason/next-action feedback;
- fresh runtime, test, screenshot and manual evidence all agree.

This plan includes the approved public Surface Play contract expansion. The
user explicitly approved V3.1 on 2026-07-28; implementation remains subject to
the evidence and manual-play gates below.

### V3.1 replan trigger — post-detach multi-revision ownership

The approved V3 implementation exposed one additional contract defect before
browser acceptance: after the first detached body is published, a later edit of
the remaining stump still carries the transferred cells in the current
Structural object. Because Component IDs bind object revision and content hash,
that edit gives the already detached crown a new Component ID, can admit a
duplicate body, keeps historical cells editable and cannot cold-resolve the old
body mesh from the current classification.

This is a defect inside the approved destroyable-tree behavior, but its correct
repair adds one Structural-Core command and two required public fields. Those
additions are not authorized by the earlier V3 approval. Until the user
approves the exact V3.1 package below:

- no transfer command, contract field or post-detach adoption code is added;
- the current initial-detachment implementation remains testable but cannot be
  accepted as complete;
- independent World, UI, Energy, test-harness and browser-evidence work may
  continue without weakening this stop.

### V3.1 architecture decision proposed for approval

Keep the same Tree object ID and make ownership transfer explicit:

1. Damage preview produces Structural source authority
   `r -> r+1`, `e -> e+1`.
2. If the result contains detached Components, derive their canonical
   Structural Fragments, mass, complete colliders, BodyLocal meshes and body
   candidates from that immutable source.
3. A separately schema-versioned and pure Structural-Core command
   `TransferDetachedComponents` removes exactly all currently detached
   Fragments and produces the current Attached authority
   `r+1 -> r+2`, `e+1 -> e+2`.
4. The Runtime archives immutable body-source records from `r+1`; current
   authority, current Components and static collision contain Attached cells
   only.
5. A later stump hit edits current `r+2 -> r+3` and cannot reselect or re-admit
   transferred cells. Historic Body, Component, Fragment, collider and mesh
   identity remains unchanged.

The transfer is not a Surface-private shortcut. The closed four-variant
`StructuralDestructionCommand` union stays unchanged. Structural Core adds a
separate:

- `STRUCTURAL_TRANSFER_COMMAND_SCHEMA_VERSION`;
- `StructuralTransferDetachedComponentsCommand`;
- canonical validator, serializer and hash;
- pure `applyStructuralDetachedComponentTransfer(object, command)`.

The command binds command/target identity, expected/resulting object revision,
the complete expected Adaptive source, actor, source, exactly one sequence or
tick, canonical sorted unique `sourceFragmentIds` capped at `8`, and existing
Structural budgets. It must select exactly all current detached Fragments, keep
all brick coverage/material/frame/source/anchor/joint definitions, remove only
their occupied sparse cells, and finish with no detached current Component.
The existing `StructuralCommandEvidence` V1 remains unchanged and records the
reproducibly hashed transfer with equal selected/changed/transferred cell
counts, changed bricks, consecutive object/edit revisions and unchanged
Adaptive journal digest.

Public Surface contract V3.1 adds exactly:

- required `authorityTransfer` to every Structural transition. It is `null`
  for Rejected, NoChange, Anchored and Empty. Detached requires a nested record
  containing transfer command ID, previous/resulting object and edit revisions,
  previous/resulting content hashes, transferred cell count, canonical changed
  brick IDs capped at `4096`, and canonical source Fragment IDs capped at `8`.
  The existing top-level Applied transition remains the Damage step; the
  nested transfer must chain exactly from its result. Presentation binds the
  current object to the nested result when present.
- required `bodySources` on Structural presentation, canonical by Component ID
  and capped at `8`. Each fact contains exactly `componentId`,
  `sourceFragmentId`, `bodyId`, `objectId`, `sourceObjectRevision`,
  `sourceContentHash`, `colliderRevision` and `meshArtifactId`.
  Current `components` contains anchored Components only. Every Dynamic Body
  binds exactly one historical body source through its existing IDs,
  revision/hash and collider revision; no Dynamic Body contract change is
  needed.

Privately, each body-source record retains the deep-frozen source object,
Component, Fragment, mass, collider facts and already-derived BodyLocal mesh.
The resolver checks current anchored Components and then this archive; a warm
cache is never required. Body sources and Bodies share the existing cap of
eight and are removed together only on route cleanup.

If transfer empties the current tree, the same object ID and empty brick
coverage remain published, current classification/mass/collision are empty,
and historical body sources/Bodies remain valid. `supportResult: Detached`
binds the nested transfer plus body sources; `supportResult: Empty` means the
Damage step itself became empty and therefore has no transfer.

The complete preflight order is:

```text
Damage candidate
-> detached Components + Fragments
-> mass + complete colliders + BodyLocal meshes + body sources
-> transfer candidate
-> whole body/collider batch reservation
-> Combat rejection with no adoption/cost/effect
   OR FireAccepted + Combat events
-> atomically publish current transfer result, static collision, body sources,
   bodies and one composite Surface transition
-> body physics starts next tick
```

Transfer/archive/hash/mass/mesh refusal maps to the existing
`StructuralAuthorityRefused`; body/collider capacity keeps the already approved
codes. No new Combat event or rejection variant is added.

## Context

### Repository and worktree

| Role | Path / ref | Rule |
| --- | --- | --- |
| Protected root checkout | `C:\IFI_SourceCode\Temp\WeltraumSpiel`, branch `spike/threejs-core-port-v1` | Read-only. Do not switch, reset, clean or edit. |
| Integration worktree | `C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-hestia-first-person-combat-integration-v1` | Sole implementation, evidence and review root. Preserve all existing dirty/untracked work. |
| Integration branch | `feature/browser-hestia-first-person-combat-integration-v1` | No commit or push before the new manual gate and final human review. |
| Contract/base | `fd379d7c160698214ab1471c4f240cbb82ef8620` | Contract provenance boundary. |
| Current integration HEAD | `20c837d2e2f062fe5d63acf953dfb0f8a6e3cd6b` | Five worker merges already integrated. |

Live-resolved worker commits, in integrated order:

1. `bd870639b1bc9e41bfca6ff81fa43c8c3144db9a`
2. `1d7d0d7caab387cefa20f6396ef7ab2c93eb0767`
3. `4f4d2d8b46c71a5c7c99b1fd572a205aa02f46f0`
4. `521dc12cfffeeb3581cfa00e62c19783727572f2`
5. `58b22d34f4d846938dd32a0a17d23ca976be88e3`

### DevToolbox

Reuse exactly:

- change:
  `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1`;
- execution: `c757ca664e5a4060b90a5ca665380bb6`.

Do not create a second change or execution. No task is closed before fresh
evidence and completion preflight. The revised artifacts are:

- `proposal.md`;
- `design.md`;
- `specs/default/spec.md`;
- `tasks.md`;
- `tests/manual-play-rejection-analysis-2026-07-27.md`.

### Failed manual evidence

The manual test on 2026-07-27 rejected:

- darkness and wrong Hestia presentation;
- a tiny steep terrain island plus visible water boundary/underwater look;
- idle downhill sliding;
- non-colliding, non-voxel trees and beam pass-through;
- absence of local tree destruction, support failure and real fall physics;
- overlapping debug-like HUD;
- insufficient finite Energy testability.

The two supplied screenshots remain failed evidence. Earlier green unit, build
and E2E results remain useful regression baselines but do not prove visual or
play acceptance.

### Evidence-backed causes

See the complete matrix:
`tests/manual-play-rejection-analysis-2026-07-27.md`.

The binding summary is:

- a real water mesh and global dark fog are rendered;
- the current two-brick fixture spans only one narrow horizontal strip and its
  resident vertical band ends at local sea level;
- spawn admission accepts a steep shoreline-adjacent origin fixture and does
  not validate a dry clearing, edge reserve or water separation;
- grounded locomotion reapplies gravity every tick and collision removes only
  the into-normal component, leaving a deterministic downhill tangent;
- visible trees exist only as Three.js cylinder/sphere instances;
- collision and ray authority know Terrain and one Drone, never Trees;
- the Structural Core already supplies CAS edits, anchors, connectivity,
  deterministic components and mass/COM/inertia, but no runtime physics;
- `54 J` is Heat, not Energy; real Energy is `120 J`, costs `12 J` per accepted
  shot and never recovers, allowing ten shots;
- the HUD uses equal-weight panels and permanent absolute center lines, so
  target, action and rejection overlap and Energy/Heat hierarchy is unclear.

### Required references

- `.agent/PLANS.md`
- `docs/design-audits/2026-07-14-hestia-surface-lab-visual-target.md`
- protected-root `docs/Konzeptart/Hestia` (`23` PNG files, `18` unique
  contents; user-provided binding direction for the later visual-parity pass)
- `docs/spielkonzept/hestia-procedural-voxel-world.md`
- `docs/architecture/surface-local-frame-architecture.md`
- `docs/architecture/procedural-voxel-planet-runtime.md`
- `docs/architecture/world-runtime-render-backend-boundary.md`
- `docs/architecture/voxel-destruction-mass-rotation-orbit.md`
- `docs/browser-mainline/structural-microvoxel-destruction-core-v1.md`
- `docs/browser-mainline/spatial-physics-spine-v1.md`
- `docs/browser-mainline/combat-weapon-damage-core-v1.md`
- `docs/ux/player-ui-redesign-foundation-v1.md`
- `docs/ux/player-hud-map-builder-surface-flow.md`
- `docs/ux/player-facing-status-authority-v1.md`
- `docs/ux/debug-vs-player-ui-policy.md`

## Non-goals

- No global Hestia shell or planet streaming.
- No orbit/space-to-surface transition.
- No swimming, underwater gameplay or camera-medium postprocessing.
- No authoritative vegetation beyond Umbrella Trees in this recovery.
- No external/WASM physics dependency.
- No persistence of fallen debris across reloads.
- No secondary voxel fracture of already Falling/Resting tree bodies in V1;
- The user has requested editable Falling/Resting tree bodies as a V3.2
  follow-up. That request does not silently remove the approved V3.1
  `DetachedBodyImmutable` rule; an exact contract/authority delta and explicit
  approval are required first.
- No economy, cargo, ammo, multiplayer or generalized encounter framework.
- No Surface Lab behavior change.
- No TestBridge, player refill cheat or presentation-authored gameplay truth.
- No Creative/City-Builder runtime, authored-world persistence contract or
  biome/building placement tool is authorized by this recovery plan. A
  planning-only authoring decision package may proceed in parallel, but its
  implementation requires separate explicit user approval.
- No opportunistic refactor outside the listed owners.
- No commit, push, PR, `main` merge, task closure, archive, deploy or release
  during planning or before the later gates allow it.

## Parallel follow-up: authoring tool decision package

The user wants future game design to be assembled through an editor instead of
encoding every placement in product code. This is a valid follow-up direction,
but it has a new data/runtime contract and therefore stays outside the approved
V3.1 implementation until reviewed.

Two read-only/planning lanes may run without blocking Core recovery:

1. **Creative/City Builder architecture:** reuse inventory, separate authoring
   surface, command history, selection/transforms, grid/socket snapping,
   palettes/layers, validation, deterministic save/load and a versioned
   authored-world overlay consumed immutably by Runtime.
2. **Biome/Building Kit workflow:** stable modular asset IDs, footprints,
   sockets, variants, roads/parcels/districts, biome paint/exclusion layers,
   hero-site locks, budgets and a small Coast/Lush proof fixture.

Semi-procedural or agent-generated roads, parcels, repetition and vegetation
are editor previews. Only an explicit human accept operation may write them to
the versioned overlay, including seed/tool-version/provenance metadata. Normal
Surface Play exposes none of these commands. Three.js meshes and editor UI
state remain projections.

The decision package must distinguish:

- editor-only commands and validation from Runtime World commands;
- authored overlays from procedural base generation and persistent player
  edits;
- kit metadata from render assets and authoritative collision/destruction
  descriptors;
- MVP authoring needs from later collaborative, multi-biome and city-scale
  tooling;
- public contract changes, migrations, performance budgets, tests and manual
  authoring acceptance.

## Proposed V3.2 follow-up: editable detached voxel bodies

The user requires a fallen tree to retain a pose-correct hitbox and remain
locally destructible in both `Falling` and `Resting`. V3.1 deliberately makes
detached bodies immutable and rejects Beam hits as `DetachedBodyImmutable`.
Therefore this is a real feature/contract expansion, not a defect fix that may
be folded silently into the current implementation.

The V3.2 decision package must pin:

1. whether every detached body owns a mutable body-local Structural authority
   or a new renderer-independent equivalent;
2. ray conversion from world space into the current body pose, Combat event and
   Damage ownership, edit quantization and stale pose/revision rejection;
3. deterministic split semantics after a body-local edit, including child
   world poses, mass/COM/inertia and momentum/velocity transfer;
4. atomic reservation of all replacement bodies/colliders before Energy,
   Damage or authority mutation, plus whole-operation failure semantics;
5. the replacement or narrowing of public `DetachedBodyImmutable`, body-source
   history/current-state snapshots, persistence/tamper and migrations;
6. tiny-fragment/rest/despawn policy, hard budgets and responsive repeated-cut
   performance; and
7. unit, hash/roundtrip, physics, collision, E2E and manual screenshot/timing
   evidence for both Falling and Resting edits.

Until that package is reviewed and approved, V3.1 remains the implementation
contract. Presentation animation or a mesh-only hitbox is not an acceptable
substitute.

## Architecture decision

### Decision package proposed for approval

Approval of this V3 plan accepts all of the following proposed V1 values and
known source impacts:

1. **Region/domain:** candidate centers are the finite `x,z=-64..64 m` lattice
   in `16 m` steps around the configured frame origin, ordered by squared
   horizontal distance, global `z`, then global `x`; the first fully valid
   candidate wins, with the `64 x 32 x 64 m @ 0.50 m` (`4 x 1 x 4`) footprint
   centered there and spawn at the exact center grid cell. With frame-origin
   Y `O_y` and ground Y `G_y`, band minimum is exactly
   `B_y=O_y+32 m*floor((G_y-O_y-8 m)/32 m)`; `[B_y,B_y+32 m)` is valid only
   if `B_y+32 m>=G_y+1.62 m+4 m`. The `0.50 m` dry component then requires
   ground `>=1.0 m` above water, slope `<=50 degrees`, step `<=0.40 m`, full
   capsule clearance, AABB `>=32 x 32 m`; spawn requires slope `<=12 degrees`,
   `8 m` resident-edge and `12 m` geodesic perimeter reserves. No random retry.
2. **Water:** Runtime publishes the half-open dry component and
   `ShoreBoundary`; capsule motion stops before player/eye enters non-dry
   water cells. Water stays visible scenery, not a medium or swimming system.
3. **Lighting:** Surface environment is sole Surface Play light-rig owner.
4. **Locomotion:** `Unsupported`, `SupportedMoving`, `SupportedResting` with
   `0.20 m/s` capture, `0.25 m/s` release, two-tick capture hysteresis and
   `1e-6` 600-tick drift gates; no blanket velocity zero.
5. **Trees:** selectively port authoritative Structural Umbrella Trees from
   `897711024458062e3965c26cec05bd34c61d50db`; no whole-branch merge.
6. **Structural damage:** one accepted Attached-tree hit becomes half-even
   `0.125 m` global-quantum `SubtractSphere`, `radiusQuantum=3` (`0.375 m`),
   filtered to the hit cell's destructible material. The pinned phase-2 tree
   stays anchored after hit one and detaches by hit six.
7. **Physics:** the exact bounded algorithm below, atomic whole-batch body
   admission and typed atomic tick failure. Falling/Resting bodies block
   Terrain/body/player/Beam; player contact is kinematic. Capacity rejects use
   public `BodyCapacityExceeded|ColliderBudgetExceeded`; a Beam hit on a
   detached body uses public `DetachedBodyImmutable`; each rejects before
   firing with no attempted-shot debit/heat or damage/edit and no Terrain
   fallback; earlier deterministic recovery/cooling remains.
8. **Energy:** `240 J` maximum, `12 J` per accepted shot, fixed-tick `12 J/s`
   recovery after `3.0 s`; Heat remains `18/54 J`, cooling `12 J/s`; typed
   `EnergyInsufficient` remains.
9. **HUD:** Combat-derived readiness, Energy/Heat separation, center-safe
   reticle/target, bounded transient and warning/next-action zones. Capacity
   copy is `Too many fallen pieces would be active. Aim for a smaller cut or
   re-enter Surface Play to clear debris.`; the other pinned copies are listed
   in the design/spec.
10. **Public contract:** apply only the exact `Structural` union/event,
    readiness, transition, dynamic-body, Structural-presentation port and
    typed physics-failure delta below. Existing variants keep meaning, but
    exhaustive TypeScript switches must add the known new variants.
11. **Terrain preservation:** unobstructed Terrain hit remains exactly one
    Combat event and one CAS edit whose revision/hash/collision/remesh agree.

### Physics guardrails and fixed V1 algorithm

- `60 Hz` outer tick; semi-implicit Euler for linear state;
- double-precision unit quaternion advanced by axis-angle delta per substep,
  normalized once and sign-canonicalized (`w`, then lexicographic tie-break);
- occupancy greedily merged in `(z,y,x)` order, expansion `x/y/z`, into at
  most `64` body-local boxes; pose produces world OBBs and broadphase AABBs;
- exhaustive stable body/body and body/Terrain ordering by body ID, collider
  index and Terrain cell; 15-axis OBB SAT, one deepest contact per pair;
- `1..4` substeps keep predicted translation `<= 0.0625 m` and rotation
  `<= 2 degrees`; requiring more fails with `MotionBudgetExceeded`;
- exactly `8` sequential-impulse iterations per substep, restitution `0`,
  friction `0.65`, Baumgarte `0.20`, slop `0.005 m`, no warm start;
- at most `8` Falling plus Resting bodies and `256` contact pairs per outer
  tick; Resting requires linear/angular speed `<= 0.05` for `120` ticks;
- Resting counts until explicit route cleanup; no timed despawn.

Structural mutation is pure-previewed. All detached components, mass facts and
complete colliders are derived and reserved as one batch before Combat cost,
damage, Structural adoption or body publication. The ninth body, any body over
64 boxes or partial multi-component fit rejects before firing with public
`BodyCapacityExceeded` or `ColliderBudgetExceeded`; Combat emits only
`FireRejected`, Runtime publishes that rejected latest Structural transition,
and the attempted shot adds no `12 J` Energy debit, `18 J` Heat, damage, edit,
collider or body state. Earlier deterministic recovery/cooling remains. No
collider is clipped and no bodyless fragment is published.

A Beam whose nearest candidate is Falling/Resting rejects before firing with
public `DetachedBodyImmutable`: Combat emits only `FireRejected`, Runtime
publishes that rejected latest Structural transition, the attempted shot adds
no `12 J` Energy debit, `18 J` Heat, damage or edit, prior recovery/cooling
remains, and the hit never falls through to Terrain.

Each physics tick solves in scratch state. Contact/motion/non-finite overflow
publishes no partial state, retains the previous immutable snapshot and enters
typed fatal `ContactBudgetExceeded`, `MotionBudgetExceeded` or
`NonFiniteState`, disabling further Surface input. Presentation cannot repair
or mask the state.

### Authoritative tick order

```text
player support/movement
-> weapon cooldown/heat/energy recovery
-> nearest authoritative ray hit
-> for an Attached Structural hit: pure Damage candidate
-> if Detached: derive fragments/mass/colliders/meshes/body sources and pure transfer candidate
-> reserve the complete Physics body/collider batch
-> reject preflight: FireRejected, release reservation, no attempted-shot debit/heat or damage/edit
   OR succeed: FireAccepted + HitEvent/DamagePacket
-> adopt exactly one Terrain transition or the atomic Structural Damage+Transfer pair
-> atomically swap current Structural/static collision and publish body sources/reserved bodies
-> next-tick rigid-body physics
-> immutable presentation/HUD snapshot
```

Terrain and Drone candidates bypass Structural/body preflight. A Combat
cooldown/Heat/Energy rejection after reservation releases it and publishes no
Structural effect.

### Exact contract delta

`contracts/index.ts` stays unchanged until approval. Then apply:

| Existing | Exact approved delta | Compatibility / validation |
| --- | --- | --- |
| `SurfaceFireResult[Input].Accepted.hit` | add exactly `Structural` | Old variants keep meaning; update exhaustive Combat/Runtime/HUD/presentation/tests. |
| `SURFACE_FIRE_REJECTION_CODES` | add `BodyCapacityExceeded`, `ColliderBudgetExceeded`, `DetachedBodyImmutable` | Reject before firing; no attempted-shot debit/heat or damage/edit; earlier tick recovery/cooling remains; only `FireRejected`; pinned copy. Existing codes remain. |
| `SurfaceCombatEventSummary[Input].kind` | add `StructuralHit`, `StructuralDamaged`, `StructuralDetached` | Sequence ordering and existing 256 cap remain. |
| `SurfaceCombatSnapshot[Input]` | required `readiness: SurfaceWeaponReadiness[Input]` | Deliberate source-breaking constructor migration; `Ready|Cooldown|Overheated|EnergyInsufficient`; old Energy/Heat meanings stay. |
| `SurfacePlayHudSnapshotInput` | required same `weaponReadiness` | Deliberate source-breaking constructor migration; action/block fields stay but cannot derive readiness. |
| `SurfaceImpactPresentationSnapshot[Input].kind` | add exactly `Structural` | Target/Terrain semantics unchanged. |
| none | `SurfaceStructuralTransitionSnapshot[Input]` + factory | Exact discriminated fields/caps below; rejection includes the three public codes plus `StructuralAuthorityRefused`. |
| none | `SurfaceDynamicBodySnapshot[Input]` + factory | body/component/object IDs, source revision/hash, Falling/Resting, pose quaternion, linear/angular velocity, collider revision, tick. |
| none | `SurfaceStructuralPresentationSnapshot[Input]`, factory, `SurfaceStructuralPresentationPort` | Runtime-owned sorted object/component/body facts, `latestTransition`, nullable `physicsFailure`, revisions/hashes/artifact IDs; extend `SurfacePlayPresentationPorts`. |
| none | `SurfacePhysicsFailureSnapshot[Input]` + factory | `ContactBudgetExceeded|MotionBudgetExceeded|NonFiniteState`, tick, sorted body IDs; exposed only through nullable presentation field. |
| current Structural transition | add required nullable `authorityTransfer` | `null` except Detached; Detached chains the Structural-Core transfer from the top-level Damage result and current presentation binds the nested final revision/hash. |
| current Structural presentation | add required `bodySources` | Historical Component/Fragment/body source facts are separate from current anchored-only Components; cap `8`; Dynamic Body shape is unchanged. |

Exact union shapes and caps:

- `SurfaceWeaponReadiness[Input]`: `Ready { nextShotReadyInSeconds: 0 }`,
  `Cooldown|Overheated { nextShotReadyInSeconds }`, or
  `EnergyInsufficient { currentEnergyJoules, requiredEnergyJoules,
  recoveryDelayRemainingSeconds, recoveryRateJoulesPerSecond,
  nextShotReadyInSeconds }`. Existing fire rejection `InsufficientEnergy` is
  not renamed; it maps to readiness `EnergyInsufficient`.
- Structural transition `Applied|NoChange` carries fire/Structural command IDs,
  object ID, previous/resulting object+edit revisions and hashes, changed-cell
  count, canonical changed-brick IDs capped at `4096`, support result, detached
  component IDs capped at `8`, and tick. `Rejected` carries fire ID, nullable
  Structural command ID, object ID, current revisions/hash, rejection code and
  tick, with no changed/detached fields.
- Structural presentation caps sorted objects/components at `128` each and
  bodies at `8`; it includes `latestTransition` and `physicsFailure`, which is
  `null` while healthy. Physics-failure body IDs are sorted/unique, cap `8`.

Factories require plain data, clone/deep-freeze, reject non-finite numbers and
duplicate/unsorted IDs, enforce these caps and bind component/body facts to
source revision plus content hash. Canonical ordering is code-unit stable ID.
`Structural`, not `Vegetation`, is the hit discriminant because Structural owns
collision/edit/support; species is metadata. No Three.js, DOM, browser global,
Worker or TestBridge types are allowed.

Old field/variant meanings remain. Approval explicitly accepts the two
required-field constructor migrations plus every listed union/exhaustive-switch
source impact; this plan makes no general TypeScript source-backward-compatibility
claim.

## Implementation phases

### Phase 0 — Approval and fresh preflight

Files:

- this ExecPlan;
- the DevToolbox artifacts listed above.

Actions:

1. Wait for explicit user approval or requested amendments.
2. After approval, freshly read `git status`, the complete base/working diff,
   the contract file and the approved plan.
3. Run `workspace_prepare_for_agent`, `specs_get_status`, `tasks_load` and
   `specs_validate`.
4. Add one note to execution `c757...bb6` recording approval and the exact
   chosen decision package.

Verification:

- exactly one linked execution;
- every task still open;
- protected checkout unchanged;
- no product or contract mutation before approval.

Safe stop: any ambiguous amendment pauses implementation and revises this plan.

### Phase 1 — Failing regressions and exact contract expansion

Files:

- `apps/weltraum-browser/src/surface-play/contracts/index.ts`
- `apps/weltraum-browser/tests/unit/surfacePlayContracts.test.ts`
- new focused contract tests under `apps/weltraum-browser/tests/unit/`

Actions:

1. Pin failing tests for every exact table row above, including the two
   required-constructor migrations, all public rejection codes/caps and every
   exhaustive consumer while preserving old field/variant meanings.
2. Add only the named types, factories, variants and Structural port.
3. Preserve frame/revision/hash validation, canonical ordering, defensive
   copying, frozen plain data and caps.

Verification:

- focused contract tests and invalid-input/freeze/source-binding cases;
- TypeScript/build plus contract diff allowlist;
- import/global scans and reviewer confirmation of no authority leak.

Safe stop: any additional type, changed old meaning or unlisted exhaustive
consumer returns to plan approval.

### Phase 2 — Dry footprint, connected domain and World-owned placement

Files:

- `apps/weltraum-browser/src/surface-play/surfacePlayConfig.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayBootstrap.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayCollision.ts`
- new `apps/weltraum-browser/src/surface-play/world/hestiaSurfaceWorld.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaSurfacePresentation.ts`
- related focused unit tests

Actions:

1. Enumerate the finite `x,z=-64..64 m` / `16 m` lattice; order by squared
   distance, global `z`, global `x`; for each candidate use the exact center
   spawn probe, compute `B_y=O_y+32*floor((G_y-O_y-8)/32)` and reject unless
   its half-open 32 m band also clears the eye by `4 m`.
2. Admit the first fully valid candidate only, center the `4 x 1 x 4` footprint
   there, and apply dry/slope/step/capsule/size/spawn/edge rules exactly.
3. Publish Terrain/water/shore/population plus the half-open
   `SurfaceTraversalDomain`/`ShoreBoundary` from Runtime.
4. Make collision, rendering and residency consume identical identity/revision.
5. Fail closed if no component qualifies.

Verification:

- equal identity selects equal anchor, flood-fill component and boundary;
- component `>=32 x 32 m`, spawn/perimeter/edge values and vertical coverage;
- perimeter probes plus fixed uphill/downhill route cannot intersect water;
- boundary collision stops the capsule before non-dry cells;
- collision/render/residency bounds and recorded ground/capsule/eye/water agree;
- no ray/capsule silently crosses a resident edge.

### Phase 3 — Hestia presentation and single light owner

Files:

- `apps/weltraum-browser/src/surface-play/environment/hestiaSurfaceEnvironment.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaSurfacePresentation.ts`
- `apps/weltraum-browser/src/render/three/backend/threeRenderBackend.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayBootstrap.ts`
- `apps/weltraum-browser/tests/unit/surfacePlayEnvironment.test.ts`

Actions:

1. Disable the generic Basic rig for Surface Play.
2. Render only snapshot-provided water/population facts.
3. Adjust materials, fog and population density to the documented Hestia
   direction while preserving foreground/background and ground openings.
4. Keep render lifecycle content-addressed and revision-bound.

Verification:

- one light rig;
- no presentation field sampling for world placement;
- no exact rejected-dark-palette test masquerades as visual acceptance;
- fixed spawn clearing and depth bands pass screenshot review.

### Phase 4 — Supported locomotion rest

Files:

- `apps/weltraum-browser/src/surface-play/player/locomotion.ts`
- `apps/weltraum-browser/src/surface-play/collision/capsuleResolver.ts`
- focused locomotion/capsule tests

Actions:

1. Add internal support states and exact transition table.
2. Capture at `<=0.20 m/s`, release at `>=0.25 m/s`, require two eligible
   moving ticks, and preserve state in the hysteresis band.
3. Cancel gravity only in qualified support rest; preserve input, jump,
   above-50-degree slide and external impulses.

Verification:

- 600 ticks flat, mid-slope and just below threshold stay within
  `1e-6 m` and `1e-6 m/s`; just above `50 degrees` slides;
- exact capture/release boundary cases and hysteresis;
- input, jump, contact loss and external-impulse regressions;
- no position snap or blanket-zero path.

### Phase 5 — Structural Umbrella Tree authority

Files:

- new `apps/weltraum-browser/src/surface-play/vegetation/hestiaUmbrellaTree.ts`
- new `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeAuthority.ts`
- current Adaptive/Structural integration modules under
  `apps/weltraum-browser/src/`
- focused tree graph/compilation/authority tests

Actions:

1. Selectively port the mature historical tree graph and currentize its API
   calls.
2. Compile stable Umbrella Trees to current Structural occupancy/materials.
3. Publish root anchors, revision, components and immutable snapshots.
4. Keep non-Umbrella vegetation explicitly decorative/non-solid.

Verification:

- equal identity produces equal tree/segment/object IDs and occupancy;
- spawn capsule intersects no Structural tree;
- root anchors/connectivity/mass properties match Structural Core;
- no historical branch is merged wholesale.

### Phase 6 — Tree collision, exact local damage and Terrain preservation

Files:

- new `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeCollision.ts`
- Surface Combat/Runtime integration files
- focused collision/Combat/Structural/Terrain integration tests

Actions:

1. Add revision-bound capsule/ray Structural collision and nearest
   Drone/Structural/Terrain ordering.
2. Map an Attached Structural hit to the exact approved half-even
   `SubtractSphere` command and hit-material filter.
3. Pure-preview Structural outcome; derive components/mass/complete boxes and
   reserve the whole body batch before any Combat cost/damage/edit effect.
4. On capacity refusal publish only `FireRejected` plus the rejected latest
   transition; otherwise commit Combat event, Structural revision/collider
   swap and reserved bodies atomically in the documented order.
5. Preserve the unobstructed Terrain event/CAS path exactly.

Verification:

- player/Beam stop at the nearest occupied tree cell;
- phase-2 fixture first hit is local/anchored and detaches by hit six;
- stale/duplicate/refused paths and public `BodyCapacityExceeded`/
  `ColliderBudgetExceeded` add no attempted-shot debit/heat, emit only
  `FireRejected`, publish the rejected latest transition and no
  damage/edit/body/collider; prior tick recovery/cooling remains;
- a nearest Falling/Resting hit yields public `DetachedBodyImmutable`, the same
  attempted-shot/no-authority-effect semantics and no Terrain fallback;
- multi-component reservation is all-or-none; no clipped/bodyless fragment;
- unobstructed Terrain hit yields exactly one event and one CAS edit with
  matching revision/hash/collision/remesh/presentation;
- no ghost collider across Structural/body revision swaps.

### Phase 6A — Post-detach ownership transfer (V3.1 approval required)

Files:

- new `apps/weltraum-browser/src/voxel/structural/transfer.ts`
- `apps/weltraum-browser/src/voxel/structural/{types,validation,canonical,index,persistence}.ts`
- `apps/weltraum-browser/src/surface-play/contracts/index.ts`
- `apps/weltraum-browser/src/surface-play/vegetation/{surfaceTreeAuthority,surfaceTreeRuntime,surfaceTreeCollision}.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaStructuralTreePresentation.ts`
- new and affected focused Structural/Surface tests

Actions after explicit V3.1 approval only:

1. Add the separately versioned, canonical Structural transfer command and
   pure apply path without broadening the existing Destruction union or
   Evidence V1 schema.
2. Produce one immutable Damage+Transfer preflight candidate, complete body
   sources/artifacts and the whole Physics reservation before Combat cost.
3. Atomically adopt only the final current authority plus current-only static
   collision, historical body sources and Bodies.
4. Add required nullable `authorityTransfer` and required `bodySources` with
   the exact bindings/caps above; keep Dynamic Body shape unchanged.
5. Resolve/render current anchored Components and historic moving body sources
   without depending on a warm cache.

Verification:

- hit 1/2 anchored; hit 3 yields Damage `r+1`, Transfer `r+2`, exactly one
  source/body and an exact lossless cell partition;
- hit 4 edits only the stump; Body/Component/Fragment/source revision+hash,
  collider and cold-resolved mesh remain byte-identical and no second body is
  admitted;
- transferred cells exist in neither current authority nor static collision
  and cannot be selected by later commands;
- empty current object plus live historic body is factory-valid;
- command/evidence persistence roundtrip, tampering, caps and budget rejection
  are deterministic and atomic;
- Dynamic Body ray still rejects as `DetachedBodyImmutable` with no cost,
  edit or Terrain fallback.

Safe stop: any weakened historic binding, partial transfer, Evidence rewrite,
or current ghost cell stops implementation and returns to planning.

### Phase 7 — Exact bounded Surface rigid-body core

Files:

- new `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBody.ts`
- new `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBodyWorld.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- focused deterministic physics tests

Actions:

1. Implement the approved integrator, quaternion, local-box derivation,
   OBB broad/narrow phase, substep rule and impulse solver exactly.
2. Start reserved bodies at N+1 and compose Terrain/body/player/Beam collision.
3. Solve each tick in scratch state and atomically publish or typed-fail.
4. Publish immutable Falling/Resting/failure snapshots; cleanup only by route.
5. Reject a Beam candidate on Falling/Resting before firing as public
   `DetachedBodyImmutable`, with only `FireRejected`, a rejected latest
   transition, no attempted-shot debit/heat or damage/edit and no Terrain
   fallback; prior recovery/cooling remains.

Verification:

- byte-equal ordered snapshots for equal inputs;
- off-center contact rotates; Terrain/body contacts do not tunnel;
- exact 4-substep boundary and >4 atomic failure;
- 8th body admits, 9th rejects; 64 boxes admit, 65 reject; multi-detachment
  batch all-or-none; 256 contacts admit, 257 fails without partial tick;
- player and Beam collision agree with Falling/Resting snapshot;
- detached-body Beam rejection code/copy, event cardinality, no-cost/no-edit and
  no-Terrain-fallback semantics;
- deterministic wake/rest tick and route cleanup;
- Three.js interpolation authors no transition.

### Phase 8 — Energy and readiness

Files:

- `apps/weltraum-browser/src/surface-play/combat/surfacePulseCutter.ts`
- `apps/weltraum-browser/src/surface-play/combat/surfaceCombatRuntime.ts`
- `apps/weltraum-browser/src/combat/fireControl.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- focused Combat/Energy tests

Actions:

1. Apply the approved finite Energy profile.
2. Integrate recovery through fixed-tick Combat state.
3. Publish typed readiness/recovery from Combat.
4. Preserve atomic accepted-shot cost; rejection adds no shot debit/heat or
   damage/edit while normal tick recovery/cooling remains.

Verification:

- 20 accepts, 21st `EnergyInsufficient`;
- three-second delay plus one second recovers exactly one shot;
- cap, cooldown, Heat, reload/re-entry and rejection ordering pass;
- one charge satisfies the 3 Drone/6 Tree/8 Terrain plus 3 reserve envelope.

### Phase 9 — Player HUD and failure presentation

Files:

- `apps/weltraum-browser/src/surface-play/ui/surfacePlayHud.ts`
- `apps/weltraum-browser/src/surface-play/ui/surfacePlayUi.ts`
- `apps/weltraum-browser/src/surface-play/ui/surfacePlayUiStyles.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayFailurePresenter.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- focused HUD/UI tests

Actions:

1. Project Combat readiness rather than deriving it in the HUD.
2. Keep reticle plus one target context in the center-safe zone.
3. Consolidate persistent edge state and add bounded transient action and
   warning/next-action zones with deterministic lifetime.
4. Separate Energy/Heat and map body capacity to `Too many fallen pieces would
   be active. Aim for a smaller cut or re-enter Surface Play to clear debris.`;
   map collider-complexity, detached-body and stale refusal to the other exact
   approved player-safe copy.
5. Preserve ARIA meters/live regions, keyboard focus and reduced motion.

Verification:

- no target/action/warning/CTA overlap or viewport overflow;
- positive-but-insufficient Energy never displays Ready;
- no raw enum, exception or local path reaches player copy;
- 200% text zoom, focus order, contrast and reduced motion pass in browser.

### Phase 10 — Integration, E2E and screenshot evidence

Files:

- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayBootstrap.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayPresentation.ts`
- `apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts`
- evidence under
  `apps/weltraum-browser/evidence/playwright-output/hestia-first-person-combat-slice-v1/`
- evidence Markdown/JSON under `apps/weltraum-browser/evidence/`

Actions:

1. Integrate owners in the approved pure-preview/reserve/reject-or-accept/CAS/
   collision-and-body-publish/next-tick-physics order.
2. Preserve query precedence, input isolation, Surface Lab and TestBridge
   absence.
3. Add real-route E2E for every escaped defect.
4. Capture and inspect every screenshot before accepting it.
5. Pair visible frames with seed/anchor/bounds, camera/water/ground, tick,
   revision, hit, support, body lifecycle and cleanup data.
6. Drive real pointer-lock input and prove camera-local `A = left` and
   `D = right` at multiple yaw angles without `window.TestBridge`.
7. Time one accepted Terrain cut, one accepted Tree cut and one genuinely
   unsafe rejection from click receipt through published result. No action may
   block the browser main thread for seconds; rejection must remain typed,
   prompt and mutation-free.
8. Review the sky/horizon and deterministic tree-height/silhouette population
   in every required viewport, including explicit malformed-tree checks.
9. Exercise every bounded-domain edge for at least ten seconds. Keep the player
   inside with an authoritative visually unobtrusive boundary and prove the
   edge path performs no generation/remesh/rebuild storm and retains stable
   fixed-tick and browser-frame timing.
10. Walk into representative current-tree and detached-body colliders before
    and after a real authority revision, then repeat across one deliberate HMR.
    A revision mismatch may fail closed only until the matching collision
    snapshot is adopted; movement and simulation must resume automatically and
    may never remain permanently paused.
11. Record browser-frame and fixed-tick timestamps for every accepted Tree cut
    and the detach/fall/rest interval. Each cut must stay responsive, multiple
    intermediate Falling poses must reach distinct animation frames, and a
    later valid stump cut must remain possible without reload.
12. Reproduce the Terrain crater through real pointer-lock aim, click and
    movement. Passing requires the live HUD/support state to reach `GROUNDED`
    on the edited floor before a normal jump and exit; a synthetic test setup
    cannot override contradictory live `AIRBORNE` evidence.

Required frames:

- spawn default;
- water-uphill replay before/after;
- idle slope before/after ten seconds;
- vegetation clearing/path;
- target operational and accepted hit;
- Terrain edit;
- Energy low, blocked and recovered;
- Tree pre-hit, local hit, detach, fall and rest;
- pointer idle/focus/released;
- typed fatal startup failure;
- basic/debug separation.

Required viewports:

- `1920x1080`;
- `1440x900`;
- `1024x768`;
- `1920x800`;
- failed replay `2000x993`;
- failed replay `1712x1011`.

Visual acceptance:

- no dry-land underwater look or camera/water intersection;
- no region edge, void, hard cyan cut, clipped underside or opaque tree wall;
- visible foreground, middle ground and background;
- no zero-input drift;
- Tree collision/hit/edit/fall/rest visibly agrees with authority evidence;
- Energy and Heat cannot be confused;
- center-safe UI has no overlap or overflow;
- normal text contrast is at least `4.5:1`, essential large/non-text markers at
  least `3:1`;
- no warning relies on color alone.
- camera-local lateral controls are not mirrored;
- clicks remain responsive and valid targets do not collapse into the generic
  unsafe-cut path;
- the sky is recognizably Hestia rather than a flat green/cyan field;
- tree height classes and silhouettes are plausible, connected and stable for
  the recorded seed.
- the intentionally bounded test world has no traversable cliff/void exit and
  no lag, stutter or runaway work when the player pushes against its boundary.
- tree/body contact does not publish a spurious surface-state change, and a
  genuine revision swap cannot permanently freeze movement or simulation.
- a safe accepted Terrain crater atomically replaces collision with the same
  authority revision; the player can walk or fall into it, remain responsive,
  ground on the edited surface and leave by valid movement/jump rules without
  slow sinking or sticky depenetration.
- after all Core correctness and performance gates pass, the final visual pass
  demonstrably aligns with the user-provided UI-concept screenshot and the
  readable physical voxel/destruction qualities cited from `Teardown`, using
  original assets and Hestia-owned world facts.

### Phase 11 — Fresh gates and user-owned manual play

From `apps/weltraum-browser`:

```powershell
npm run test
npm run build
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
npm run test:e2e -- tests/e2e/hestia-first-person-combat-slice.spec.ts
npm run test:e2e:core
npm run test:e2e:live
npm run test:e2e:ui
npm run test:e2e
```

From the worktree root:

```powershell
git diff --check
git diff --exit-code fd379d7c160698214ab1471c4f240cbb82ef8620 -- "apps/weltraum-browser/src/surface-play/contracts/index.ts"
rg -n "^(import|export).*from.*(three|/ui|/hud|worker|testBridge)" "apps/weltraum-browser/src/surface-play/contracts"
rg -n "\b(window|document|navigator|HTMLElement|Worker|TestBridge)\b" "apps/weltraum-browser/src/surface-play/contracts"
git status --short
```

The contract diff command is expected to fail after the approved expansion; at
that point replace it with an explicit reviewed contract-diff allowlist against
the approved types above. The two `rg` scans must still return no matches.

The worktree has no `.sln`; .NET build/test remains `NOT APPLICABLE`.

After every automated gate and technical review is green:

1. Verify port `5173` is free.
2. Start exactly one managed strict-port Vite process.
3. Open installed Chrome at `/?surfacePlay=1`.
4. Stop automation and hand control to the user.
5. Ask for explicit accepted/rejected disposition.
6. Keep every task, commit, push and final-review gate blocked until the user
   explicitly accepts.
7. Stop only the managed server and document cleanup afterward.

### Phase 12 — Review and closeout after manual acceptance

1. Run one findings-first reviewer over the complete final diff.
2. Fix confirmed findings only and rerun affected plus complete gates.
3. Run DevToolbox verification and per-task completion preflight.
4. Toggle only evidence-backed tasks.
5. Invoke `plannotator-review` from the exact integration worktree.
6. If the human requests changes, invalidate approval, apply only the feedback,
   rerun affected gates and reopen review.
7. After exact final-diff approval only, create the intended commit.
8. Fetch and verify remote state, then perform the previously requested
   non-force upstream push.

Do not create a PR, merge `main`, archive the spec, deploy or release.

## Tests and evidence

Automated proof must include:

- contract/factory immutability and invalid-input rejection;
- deterministic land-anchor/footprint/dry-component/shore-boundary/residency/
  collision agreement and fixed uphill/downhill water replay;
- world-to-presentation ownership for water/population;
- exact locomotion support/rest transitions and drift tolerances;
- Structural tree identity, collision, nearest hit, exact local edit, atomic
  capacity reservation, support/component mass and Terrain-flow preservation;
- deterministic body/contact/fall/rest snapshots and cleanup;
- finite Energy exhaustion/recovery and readiness parity;
- HUD copy/lifetime/bounding boxes/accessibility;
- route/query/input/Surface Lab/TestBridge regressions;
- complete unit/build/E2E inventories and hygiene scans.

Runtime evidence must record exact seed, anchor, frame/region IDs, resident
bounds, spawn/camera/water/ground values, simulation ticks, Terrain/Structural
revisions, Combat events, component/body lifecycle and cleanup.

Screenshots prove only visible state. Collision, physics, determinism and
authority require paired runtime evidence.

## Risks

| Risk | Mitigation |
| --- | --- |
| Fixed footprint/domain still exposes edge or water | Require canonical connected dry component, Runtime ShoreBoundary, fixed route/perimeter replay and six-viewport review; stop rather than claim streaming. |
| Bounded edge causes repeated out-of-domain generation/collision work | Use one Runtime-owned boundary collider, cache immutable domain facts, and assert stable tick/frame timing plus zero generation/remesh churn while pushing each edge. |
| Collision revision mismatch becomes a permanent movement pause | Adopt authority and its matching collision snapshot atomically, distinguish genuine HMR replacement in evidence, and require automatic next-valid-tick recovery without weakening fail-closed revision checks. |
| Water/vegetation remains presentation truth | Static import/ownership tests and immutable Runtime snapshot boundary. |
| Rest fix suppresses legitimate motion | Separate support states and explicit input/jump/steep-slope/impulse regressions. |
| Historical vegetation API drift | Selective port with current tests; never whole-branch merge. |
| Tree edit and collider revisions diverge | Atomic revision swap and stale-rejection tests before presentation. |
| Custom bounded physics tunnels, drifts or overflows | Exact algorithm, atomic batch reservation/scratch ticks, boundary tests and typed stop; never clip contacts/colliders. |
| Energy recovery hides rejection path | 21st-shot rejection plus exact delayed one-shot recovery is mandatory. |
| HUD again passes DOM-only tests | Pixel/bounding-box and multi-aspect screenshot gates. |
| Old green suite is mistaken for acceptance | Manual rejection remains recorded; new user acceptance is an independent final gate. |
| Dirty worktree content is lost | No reset/clean/checkout; read status/diff before every mutation phase. |

## Rollback / safe stop

- Do not use reset, clean, checkout or destructive cleanup.
- Keep every phase reviewable as a small scoped diff.
- A failed phase stops further mutation; preserve evidence and add an execution
  note.
- Revert an unaccepted phase only through an explicit targeted inverse patch
  after user direction; never discard the dirty worktree.
- Contract or public behavior discovered outside the approved additions pauses
  work and revises this plan.
- Any unexplained browser/runtime failure blocks screenshots and manual play.
- Any manual rejection returns to diagnosis; it never becomes a closeout
  waiver.

## Progress log

- 2026-07-27: original automated gates were green.
- 2026-07-27: user rejected the manual play session.
- 2026-07-27: server PID `50820` was later absent and port `5173` had no
  listener; no replacement server was started during planning.
- 2026-07-27: static root-cause, architecture and visual/UX analyses were
  consolidated into the DevToolbox change.
- 2026-07-27: independent plan review returned NOT READY on dry traversal,
  exact contract delta, atomic capacity, physics algorithm, numeric Structural/
  locomotion parameters and Terrain preservation; V3 closes those findings.
- 2026-07-27: second review found contract-compatibility wording, public
  capacity/detached-body rejection semantics and land-anchor selection still
  ambiguous; V3 now pins exact source impacts, codes, candidate ordering and
  vertical selection.
- 2026-07-27: third review caught recovery/cooling timing versus rejection
  wording and an over-specific capacity action; V3 now distinguishes normal
  tick recovery/cooling from attempted-shot cost/heat and uses general capacity
  copy.
- 2026-07-28: initial tree detachment tests passed, but independent review
  proved that a later stump edit can re-revision transferred cells, admit a
  duplicate body and lose historic mesh/collider provenance.
- 2026-07-28: V3.1 was corrected after review to use a real Structural-Core
  Fragment transfer, a nested transfer revision and historical body sources.
- 2026-07-28: user explicitly approved V3.1; the approval was recorded on the
  existing DevToolbox execution and implementation started without closing
  tasks or creating a commit.
- 2026-07-28: real Chrome dry-route evidence passed 600 fixed ticks with
  measured drift and speed both within `1e-6`; the full browser matrix remains
  open.
- 2026-07-28: live user play added four unresolved failed-evidence items:
  mirrored `A`/`D`, 10–30 second left-click stalls ending in a generic unsafe
  cut, the still-flat green/blue sky, and implausible/malformed tree heights.
  They were persisted as additive P0 acceptance blockers without interrupting
  the active V3.1 runtime implementation.
- 2026-07-28: live user play additionally proved severe lag/stutter at the
  bounded playfield edge. Infinite generation remains out of scope; the user
  explicitly accepts a visually unobtrusive boundary provided movement and
  frame/tick performance remain stable there.
- 2026-07-28: walking into the large tree produced `Movement paused because
  the surface state changed` followed by a permanent freeze. Stable-build tree
  contact and deliberate-HMR revision recovery are now separate mandatory
  liveness regressions.
- 2026-07-28: the user reported that an accepted Terrain cut can create a
  visible crater whose collision/grounding response becomes slow and spongy:
  the player sinks gradually and cannot normally enter, jump out of or walk out
  of the hole. This is a separate P0 post-edit locomotion/collision blocker and
  requires a real-input crater traversal regression after matching authority
  and collision adoption; it does not interrupt the active Tree slice.
- 2026-07-28: after the Shore-mask partial fix, the live user replay still
  remained slow and `AIRBORNE` inside the crater. The direct-state locomotion
  test is therefore only partial evidence; real capsule/support acquisition is
  a separate unresolved P0 blocker.
- 2026-07-28: a fresh installed-Chrome replay against the corrected source
  accepted six normal overlapping Pointer-Lock Terrain cuts (`rev 0 -> 6`),
  preserved the original `6397`-cell Dry mask while Traversal revalidated to
  `6376`, and traversed to the deepest cut at about `4.68 m/s` with no slow
  sample. One short `AIRBORNE/Unsupported` descent reacquired grounded support,
  then rest, jump and landing passed without browser/runtime errors. This
  proves the Boundary correction on a fresh route but does not replace the
  requested user reload/retest or capture an as-yet different crater topology.
- 2026-07-28: live Tree cutting reached detach and a final fallen pose, but
  every cut froze the browser for roughly five seconds, intermediate fall
  frames were skipped, and another cut was not possible in the testslice.
  Structural correctness is not accepted until per-phase latency, visible
  Falling frames and repeatable stump cutting pass in the real browser.
- 2026-07-28: user added deferred visual-direction feedback: the current scene
  and UI still do not resemble the provided UI-concept screenshot or the cited
  `Teardown`-like readable physical voxel style. This is persisted behind all
  Core correctness and performance blockers, not allowed to interrupt them.
- 2026-07-28: the protected-root `docs/Konzeptart/Hestia` intake was
  inventoried read-only as `23` PNG files / `18` unique contents and made the
  binding reference set for the later visual-parity pass. Depicted additional
  biomes remain future roadmap scope; the city is explicitly deferred for
  later hand authoring by the user and agents, not procedural generation in
  this recovery slice.
- 2026-07-28: the user requested a future Creative/City-Builder authoring tool,
  predefined modular buildings, biome tooling and human-guided
  semi-procedural layout so game-design content need not be encoded entirely
  in product code. Two planning-only workstreams were queued behind the active
  Core-P0 agents; no editor/runtime contract or implementation is approved by
  V3.1.
- 2026-07-28: the user additionally requested a visible loading indicator at
  application startup. It is persisted as deferred player-facing UX behind the
  active Core blockers: bootstrap/readiness owns real monotonic phase labels,
  unknown work is indeterminate rather than fake-percent complete, and ready
  or typed failure must always replace and clean up the loader.
- 2026-07-29: the user added a background rendering-architecture research lane
  based on Shade WebGPU and the linked Three.js discussions about Shade and
  temporal upscaling. Shade is explicitly an ideas-only reference and is not a
  purchase candidate. The lane also evaluates Rapier, cannon-es, maintained
  candidates discovered through awesome-threejs and the supplied library
  catalogue, ambientCG's licensed PBR workflow, and Inigo Quilez's distance-
  function techniques. The research must separate reusable ideas from
  proprietary implementation, compare them with the existing render-backend,
  voxel-streaming, worker, Physics and Voxel-Authority boundaries, and produce
  measured experiment gates. It does not interrupt the active
  Structural/Physics P0 work and does not authorize an engine migration,
  package or asset adoption, or use of GPU/SDF truth as Structural Authority,
  hashing or Physics truth.
- 2026-07-29: live failed evidence with SHA-256
  `EF7FBC06F04EDF17C479460178957358652F1E07923503542488645E64111498`
  shows a valid cut rejected as `Too many fallen pieces would be active`.
  The user explicitly superseded the fixed eight-body gameplay cap: the world
  must retain logically unbounded fallen pieces without cap-based cut
  rejection. Finite resources may bound only per-batch work, active contact
  islands and Physics representation detail. Resting/far pieces must remain
  exact, targetable and editable in Voxel Authority while sleeping/static or
  adaptive Physics tiers prevent unbounded per-tick work. No silent despawn,
  merge or testslice reset is authorized as the fix.
- 2026-07-28: new failed browser evidence shows the Dry-boundary unsafe Terrain
  rejection occurring frequently. The screenshot is preserved as failed
  evidence and the reproduction must distinguish a wrong interior rejection
  from a legitimate safety refusal without weakening the Dry/traversal gate.
- 2026-07-28: the user requires fallen trees to retain hitboxes and remain
  voxel-editable/destructible. This directly supersedes approved V3.1
  `DetachedBodyImmutable`, so a V3.2 body-local authority/split/momentum/
  collision/capacity contract decision was opened; no silent implementation is
  authorized. The self-contained decision package is
  `docs/browser-mainline/hestia-first-person-combat-slice-v1-v3.2-editable-detached-bodies-execplan.md`;
  it preserves immutable origin provenance, adds separate current body state,
  pins body-local hit mapping, deterministic split IDs, rigid-field pose/
  velocity transfer, whole-replacement capacity and the exact source-breaking
  contract migration that still requires explicit approval.
- 2026-07-28: the next live Tree replay still took several seconds before an
  authoritative voxel change became visible and then stopped Surface physics.
  The captured Runtime state identifies `MotionBudgetExceeded` at tick `21156`
  for the body detached at tick `20622`; its center had reached
  `y=0.3437032617 m` with vertical velocity `-14.3623448797 m/s` while the
  admitted player surface remained around `y=11.72 m`. The pointer-release
  overlay is therefore downstream failed evidence. Tree click-to-visible
  latency and missed Terrain contact are separate open P0 regressions; neither
  may be closed by isolated hot-path benchmarks or by increasing the motion
  budget.
- [x] Original V3 recovery decision package approved for current implementation.
- [x] User approved the exact V3.1 post-detach delta.
- [ ] Phases 1-10 implemented with per-phase evidence.
- [ ] Phase 11 fresh gates and manual play accepted.
- [ ] Phase 12 review, DevToolbox preflight, final human review, commit and
  non-force push completed.

## Definition of Done

Done requires all of the following:

- every approved behavior is implemented inside the integration worktree;
- public contract changes are exactly the approved renderer-independent
  additions and deliberate source-impacting migrations; old field/variant
  meanings remain unchanged;
- all authority boundaries and fixed-tick order are proven;
- all focused and full unit/build/E2E/hygiene checks pass freshly;
- all required screenshots pass the visual and layout matrix;
- runtime evidence proves collision, Structural edits, support, fall/rest and
  Energy behavior;
- the user explicitly accepts the new real-route manual play session;
- no unresolved technical review finding remains;
- DevToolbox task state matches fresh evidence and completion preflight;
- final Plannotator approval covers the exact final diff;
- only then is the intended commit created and non-force pushed;
- the managed browser server is cleaned up and the protected root checkout
  remains unchanged.
