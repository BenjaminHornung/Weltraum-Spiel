# Design

## Change
`browser-hestia-first-person-combat-slice-v1`

## Revision status

Manual acceptance failed on 2026-07-27. V3 authorized the current recovery
implementation, but a newly proven post-detach multi-revision defect requires
an exact V3.1 addendum before its Structural-Core/public-contract repair.

Evidence: `tests/manual-play-rejection-analysis-2026-07-27.md`.

### V3.1 approval boundary — detached ownership transfer

After first detachment, the current implementation retains detached cells in
the current Structural object. A later stump edit therefore re-revisions the
historic crown, changes its Component ID, may publish a duplicate body and
cannot cold-resolve the original mesh from current classification.

The proposed correction keeps one Tree object ID but separates ownership:

- Damage produces source authority `r+1/e+1`.
- A separately schema-versioned, canonical Structural-Core
  `TransferDetachedComponents` command selects exactly all detached
  `sourceFragmentIds`, archives their immutable source facts and removes their
  cells into current authority `r+2/e+2`.
- Current Components/collision contain Attached cells only. Historic Body,
  Component, Fragment, collider and mesh facts live in Runtime-owned body
  sources and remain byte-stable across later stump edits.
- Existing Structural Evidence V1 remains; the transfer command receives its
  own validator, serializer/hash, pure apply function and persistence tests.
- Public Structural transitions gain required nullable `authorityTransfer`;
  Structural presentation gains required `bodySources` (cap `8`, canonical by
  Component ID). Dynamic Body shape and Combat rejection/event unions do not
  change.

This exact V3.1 delta remains implementation-blocked until explicit approval.

## Binding architecture decisions

### 1. Bounded admitted Hestia land footprint

Surface Play remains one bounded `SurfaceRegion`; it does not become a global
planet or streaming claim. Replace the two-brick origin fixture with the
proposed `64 x 32 x 64 m @ 0.50 m` Hestia footprint: a `4 x 1 x 4`
resident-brick grid positioned by an explicit `SurfaceLocalFrame` land anchor.

Candidate centers are the finite Hestia lattice offsets `x,z = -64..64 m` in
`16 m` steps around the configured SurfaceLocalFrame origin. Candidates sort by
squared horizontal distance, then global `z`, then global `x`; the first fully
valid candidate wins. Its `64 m` footprint is centered on that lattice point.
The spawn probe is the exact center grid cell. Let `O_y` be the configured
SurfaceLocalFrame origin Y and `G_y` the candidate ground Y. The vertical
brick-band minimum is exactly
`B_y = O_y + 32 m * floor((G_y - O_y - 8 m) / 32 m)`; the band is
`[B_y, B_y + 32 m)`. The candidate is valid only if
`B_y + 32 m >= G_y + 1.62 m + 4 m`. This chooses the highest aligned band
with the required `8 m` terrain reserve; if its upper reserve fails, no lower
band can qualify and the candidate is invalid. There is no random retry or
implementation-selected tie-break.

Admission is defined over a deterministic `0.50 m` ground grid inside the
`8 m` resident-boundary inset. A grid cell is dry-walkable only when the
authoritative ground sample exists, its normal is no steeper than the existing
`50 degrees` locomotion limit, the step to a neighbor is at most the existing
`0.40 m` step height, the full player capsule is clear, and ground Y is at
least `1.0 m` above the published water surface. Eight-neighbor flood fill in
canonical `(z,x)` order selects the connected component containing spawn.

The admitted component must have an axis-aligned ground footprint of at least
`32 x 32 m`; spawn itself must be at most `12 degrees`, have full capsule
clearance, remain at least `8 m` from every resident boundary and at least
`12 m` geodesic distance from the dry-component perimeter. The resident
vertical band must contain dry surface, capsule clearance and supported
terrain-edit depth instead of ending at sea level.

The immutable Runtime world snapshot publishes that component as
`SurfaceTraversalDomain`. Collision derives a `ShoreBoundary` from its
half-open perimeter and blocks capsule motion before the capsule or eye can
enter non-dry/water cells. This is a world-owned traversal boundary, not a
water plane collider, swimming system or camera-medium state. Water can remain
visible outside the domain.

If no anchor/component satisfies every rule, startup fails closed with a typed
player-safe failure. It must not snap to an unvalidated fallback. These
numeric bounds are proposed V1 approval values, not pre-existing product truth.

### 2. Water, atmosphere, vegetation and lighting ownership

Hestia field sampling may be reused, but water/shore/vegetation placement is
world truth and moves to a Runtime-owned immutable world snapshot.
Presentation consumes that snapshot and owns only geometry/material lifetime.
V1 keeps water visible as non-traversed archipelago scenery; swimming, an
underwater medium state and camera-medium postprocessing remain out of scope.

The Surface environment becomes the single light-rig owner. The generic
backend Basic light rig is disabled for Surface Play. Palette and fog must
match the documented Hestia direction while preserving readable foreground,
middle ground, background, terrain/water separation and vegetation silhouettes.

### 3. Locomotion support and rest

Locomotion adds internal `Unsupported`, `SupportedMoving` and
`SupportedResting` states. The proposed transition contract is:

| From | Condition | To / effect |
| --- | --- | --- |
| Any | no current walkable contact, contact revision rejected, jump edge, or slope `> 50 degrees` | `Unsupported`; full gravity |
| `Unsupported` | walkable contact plus movement input, or support-tangent speed `> 0.20 m/s` | `SupportedMoving`; remove only into-support gravity and preserve tangential motion |
| `Unsupported` | walkable contact, zero input, no jump, and support-tangent speed `<= 0.20 m/s` | `SupportedResting`; capture before gravity displacement |
| `SupportedMoving` | two consecutive walkable ticks, zero input/no jump and support-tangent speed `<= 0.20 m/s` | `SupportedResting` |
| `SupportedResting` | input or support-tangent/external speed `>= 0.25 m/s` | `SupportedMoving` |
| `SupportedResting` | contact lost/non-walkable or jump edge | `Unsupported` |

The `0.20/0.25 m/s` hysteresis is proposed for approval. Capture exceeds the
largest one-tick gravity tangent on a walkable Hestia slope while remaining
below deliberate locomotion. In `SupportedResting`, support reaction cancels
gravity and only the already-qualified residual support-relative velocity is
set to exact rest; position is not snapped. Input, airborne motion, slopes
above `50 degrees` and impulses at or above release remain physical.

Starting from a captured rest state, 600 fixed ticks must drift no more than
`1e-6 m` and end with speed no more than `1e-6 m/s`. The hysteresis band keeps
the current supported state. This is not a blanket velocity-zero rule.

### 4. Authoritative Umbrella Trees

Umbrella Trees become the first authoritative vegetation type. Selectively
port the tree graph/compilation foundation from `897711024458062e3965c26cec05bd34c61d50db`
onto current Adaptive/Structural APIs; do not merge the historical branch.
Stable tree/segment identity, Structural occupancy, root anchors, CAS edits,
six-axis connectivity, detached component identity and mass/COM/inertia are
world/Structural facts. Mist Sprouts and Caps remain non-solid decoration.

Static tree collision and ray queries bind to Structural object revision.
Combat Core resolves the nearest deterministic Drone/Structural/Terrain hit
and remains the only damage/event owner. The accepted V1 Structural impact is
exactly one `SubtractSphere` command: center is the beam hit quantized by the
existing symmetric-half-even `0.125 m` rule, `radiusQuantum = 3`
(`0.375 m`), space is `global-quantum`, and the material filter contains only
the destructible Structural material ID of the occupied hit cell. Command ID,
expected object/source revision and actor/source derive from the accepted fire
event; stale, duplicate, missing-material and budget failures publish no edit.

The canonical regression fixture reuses the historical phase-2 Umbrella Tree
at root quantum `(8,0,8)`. A deterministic clockwise sequence of ray hits at
the trunk band nearest `45%` authored trunk height is derived from occupied
surface cells. The first accepted hit must be local and remain anchored; the
sequence must produce a detached crown/branch component no later than the
sixth accepted hit. Equal fixture/input sequences must yield equal changed
cells, revisions, component IDs and mass properties. `0.375 m` and the
six-hit bound are proposed approval values.

### 5. Bounded deterministic Surface rigid-body physics

Add an in-repository Surface Rigid Body Core; no package dependency is added.
A component detached at tick N is published as a reserved body whose physics
begins at tick N+1. Lifecycle is `Attached -> Falling -> Resting`.

V1 algorithm and proposed guardrails:

- outer tick `60 Hz`; semi-implicit Euler for linear velocity/position;
- angular pose is a double-precision unit quaternion advanced by an axis-angle
  delta from angular velocity each substep, normalized once, with canonical
  sign (`w > 0`, then lexicographic tie-break when `w == 0`);
- occupied cells are greedily merged in canonical `(z,y,x)` order with axis
  expansion `x`, then `y`, then `z` into at most `64` body-local axis-aligned
  boxes; pose transforms them to world OBBs, while their world AABBs are only
  broadphase bounds;
- stable exhaustive body/body and body/terrain broadphase order uses body ID,
  collider index and Terrain cell key; narrowphase is 15-axis OBB SAT against
  body OBBs and authoritative Terrain cell AABBs, with one deepest contact per
  collider pair and deterministic axis tie-break;
- each outer tick uses `1..4` deterministic substeps so predicted travel is at
  most `0.0625 m` and angular travel at most `2 degrees` per substep; needing
  more than four is `MotionBudgetExceeded`, not clamping;
- exactly `8` sequential-impulse iterations per substep, contact order fixed
  as above, restitution `0`, Coulomb friction `0.65`, Baumgarte factor `0.20`,
  penetration slop `0.005 m`, and no warm start;
- at most `8` dynamic Umbrella-Tree bodies total (Falling plus Resting), at
  most `64` colliders per body at body admission, and at most `256` generated
  contacts per outer simulation tick at the solver/step stage;
- Resting after linear and angular speed are each `<= 0.05` for `120`
  consecutive outer ticks; an impulse producing either speed above the
  threshold wakes the body;
- Falling/Resting bodies collide with Terrain and each other, block player
  capsule and beam queries, and remain collision-authoritative. Player contact
  is kinematic in V1. A Beam candidate on such a body rejects before firing
  with public `DetachedBodyImmutable`: it adds no attempted-shot `12 J` Energy
  debit or `18 J` Heat and publishes no damage/edit; Combat emits only
  `FireRejected`, Surface Runtime publishes a rejected latest Structural
  transition, and the hit never falls through to Terrain. Deterministic
  recovery/cooling already applied earlier in that tick remains;
- no timed despawn; Resting bodies count toward the eight-body limit until
  explicit route cleanup.

Capacity is transactional. Structural application is pure and first produces
an unpublished candidate. The coordinator derives all detached components,
mass facts and complete colliders, then reserves capacity for the whole batch.
Only after reservation may Combat publish the accepted damage event,
Structural Authority adopt the candidate revision and Physics publish bodies.
Adaptive continuation/refinement or an existing representation-ladder policy
must run before final body/collider refusal where that policy permits. If the
ninth dynamic body would be needed, a body still exceeds `64` colliders at body
admission after permitted continuation/refinement, or only part of a
multi-component batch fits, the fire command rejects with public
`BodyCapacityExceeded` or `ColliderBudgetExceeded`; it adds no attempted-shot
`12 J` Energy debit or `18 J` Heat and publishes no damage/edit. Combat emits
only `FireRejected`, Surface Runtime publishes the rejected latest Structural
transition, no collider is clipped and no bodyless detached component is
published. Any final refusal is typed and whole-result atomic. The `256`
contact budget belongs to the outer-tick solver/step stage, not material
admission. Deterministic recovery/cooling already applied earlier in that tick
remains.

Contact/motion overflow can arise only during a later tick. The tick is solved
in scratch state. `ContactBudgetExceeded`, `MotionBudgetExceeded` or
`NonFiniteState` publishes no partial tick, retains the last valid immutable
snapshot and enters a typed fatal Surface Physics state that disables further
input. It never drops contacts or corrects Presentation. All numeric values in
this section are explicit V1 approval choices.

### 6. Finite Energy test profile and readiness

Pulse Cutter values become:

- maximum Energy `240 J`;
- cost `12 J` per accepted shot;
- unchanged Heat `18 J` per shot, maximum `54 J`, cooling `12 J/s`;
- recovery begins `3.0 s` after the last accepted shot;
- Energy recovery is fixed-tick `12 J/s`, capped at `240 J`;
- route construction/re-entry starts full; no player-facing refill cheat;
- below `12 J`, Combat Core still returns typed `EnergyInsufficient`.

One charge therefore permits 20 accepted shots: three Drone, six Structural
Tree and eight Terrain hits plus three reserve. The 21st shot without recovery
must reject; after the delay plus one second, exactly one shot recovers.

Combat, not the HUD, publishes typed readiness and recovery state. This avoids
a HUD `READY` state when Energy is positive but below one-shot cost.

### 7. Player HUD hierarchy

Keep the center safe for reticle and one target context. Persistent suit and
weapon values stay at the edges. One bounded transient action zone and one
warning/next-action zone replace the three overlapping center lines. Typed
Core reasons map to player-safe copy; raw enum names and raw exception messages
do not reach the player. Energy and Heat are visually and semantically
separate. Debug telemetry remains absent from Surface Play. Required player
copy is: body capacity -> `Too many fallen pieces would be active. Aim for a
smaller cut or re-enter Surface Play to clear debris.`; collider complexity ->
`This cut is too complex to simulate.`; detached-body hit -> `Fallen trees
cannot be cut in this test slice.`; stale/authority refusal -> `The tree state
changed. Aim again.` Raw
codes remain available only in authoritative snapshots/tests.

### 8. Tick and authority order

The authoritative order is:

```text
player support/movement
-> weapon cooldown/heat/energy recovery
-> nearest authoritative ray hit
-> for an Attached Structural hit only: pure candidate edit/support/mass/collider derivation
-> whole-batch Physics capacity reservation
-> preflight rejection: Combat FireRejected, release reservation, no attempted-shot cost/heat or damage/edit
   OR preflight success: Combat FireAccepted + HitEvent/DamagePacket
-> adopt exactly one Terrain or precomputed Structural CAS transition
-> atomically swap Structural/static collision and publish reserved bodies
-> next-tick rigid-body physics
-> immutable presentation/HUD snapshot
```

Terrain and Drone candidates bypass Structural/body preflight. Any Combat
cooldown/Heat/Energy rejection after a successful reservation releases the
reservation and publishes no Structural effect. No stage infers authority from
Three.js, CSS, screenshots or `TestBridge`.

### 9. Existing Terrain edit preservation

Adding Structural and dynamic-body hit candidates must not change the
unobstructed Terrain path. One accepted unobstructed Terrain hit still
publishes one `TerrainHit` event and exactly one quantized Terrain
`SubtractSphere` CAS transition; revision/hash, collision, remesh plan and
presentation must consume the same resulting revision. Stale, duplicate or
rejected edits remain no-effect. A crater screenshot alone is not proof.

## Public contract revision requiring approval

`apps/weltraum-browser/src/surface-play/contracts/index.ts` remains unchanged
until explicit user approval. Approval authorizes this exact renderer-neutral
delta:

| Existing contract | Approved delta | Semantics / affected exhaustive consumers |
| --- | --- | --- |
| `SurfaceFireResult[Input].Accepted.hit` = `None|Target|Terrain` | add exactly `Structural` | Old variants keep meaning; exhaustive Combat/Runtime/HUD/presentation/tests add the branch. |
| `SURFACE_FIRE_REJECTION_CODES` | add `BodyCapacityExceeded`, `ColliderBudgetExceeded`, `DetachedBodyImmutable` | All reject before firing: no attempted-shot Energy debit/Heat addition or damage/edit; earlier tick recovery/cooling remains; only `FireRejected`; HUD uses pinned copy. Existing codes remain. |
| `SurfaceCombatEventSummary[Input].kind` | add `StructuralHit`, `StructuralDamaged`, `StructuralDetached` | Strictly increasing sequence and existing 256-event cap remain. |
| `SurfaceCombatSnapshot[Input]` | add required `readiness: SurfaceWeaponReadiness[Input]` | Deliberate source-breaking constructor migration; kinds `Ready`, `Cooldown`, `Overheated`, `EnergyInsufficient`. Existing Energy/Heat field meanings stay. |
| `SurfacePlayHudSnapshotInput` | add required same `weaponReadiness` | Deliberate source-breaking constructor migration; existing action/block fields stay but cannot derive readiness. |
| `SurfaceImpactPresentationSnapshot[Input].kind` = `Target|Terrain` | add exactly `Structural` | Existing Target/Terrain projection unchanged. |
| none | add `SurfaceStructuralTransitionSnapshot[Input]` plus factory | Exact discriminated fields/caps below; rejection includes `BodyCapacityExceeded`, `ColliderBudgetExceeded`, `DetachedBodyImmutable`, `StructuralAuthorityRefused`. |
| none | add `SurfaceDynamicBodySnapshot[Input]` plus factory | Stable body/component/object IDs; source object revision/content hash; lifecycle `Falling|Resting`; position, canonical unit quaternion, linear/angular velocity, collider revision, simulation tick. |
| none | add `SurfaceStructuralPresentationSnapshot[Input]` plus factory and `SurfaceStructuralPresentationPort` | Surface frame/region, sorted objects/components/bodies, `latestTransition`, nullable `physicsFailure`, revisions/hashes/artifact IDs; extend `SurfacePlayPresentationPorts`. Runtime owns publication. |
| none | add `SurfacePhysicsFailureSnapshot[Input]` plus factory | Code `ContactBudgetExceeded|MotionBudgetExceeded|NonFiniteState`, failing tick and sorted body IDs; exposed only as the nullable field above. |

Exact union shapes and caps:

- `SurfaceWeaponReadiness[Input]` is `Ready { nextShotReadyInSeconds: 0 }`,
  `Cooldown|Overheated { nextShotReadyInSeconds }`, or
  `EnergyInsufficient { currentEnergyJoules, requiredEnergyJoules,
  recoveryDelayRemainingSeconds, recoveryRateJoulesPerSecond,
  nextShotReadyInSeconds }`. The existing fire-rejection enum value
  `InsufficientEnergy` is not renamed; it maps to readiness kind
  `EnergyInsufficient`.
- `SurfaceStructuralTransitionSnapshot[Input]` is a discriminated union.
  `Applied|NoChange` carries fire/Structural command IDs, object ID, previous/
  resulting object+edit revisions and content hashes, changed cell count,
  canonically sorted changed brick IDs (cap `4096`), support result and sorted
  detached component IDs (cap `8`). `Rejected` carries fire command ID,
  nullable Structural command ID, object ID, current revisions/hash, rejection
  code and tick; it has no changed/detached fields.
- `SurfaceStructuralPresentationSnapshot[Input]` caps sorted Umbrella objects
  and components at `128` each and dynamic bodies at `8`. Object facts carry
  tree instance/species, object/edit revision, content hash, sorted component
  IDs and mesh-artifact identity. Component facts carry object/source
  revision+hash, anchored flag, nullable body ID and mesh-artifact identity.
- `SurfacePhysicsFailureSnapshot[Input].bodyIds` is sorted/unique and capped at
  `8`; healthy Surface snapshots carry `physicsFailure: null`.

All new factories require plain data, recursively freeze cloned values, reject
non-finite numbers and duplicate/unsorted IDs, cap arrays, and bind component/
body facts to source object revision plus content hash. Arrays sort by
canonical code-unit stable ID. Old field/variant meanings remain, but approval
explicitly accepts the two required-field constructor migrations and all
enumerated union/exhaustive-switch source impacts; no general
backward-compatibility claim is made for TypeScript source.

`Structural`, not `Vegetation`, is the public hit discriminant because collision,
revision, edits and support are owned by Structural Authority; species remains
metadata in the Structural presentation snapshot. No Three.js, DOM, browser
global, Worker or TestBridge type may enter the contract.

## Reuse decisions

- Reuse Hestia fields and the documented Surface Lab visual footprint, not its
  technical Lab HUD.
- Reuse current revision-bound Terrain materialization/remesh publication.
- Reuse Combat Core proxy ordering, damage packets and semantic events.
- Reuse Structural CAS, anchors, connectivity, component IDs and mass
  properties.
- Reuse `statusHud` severity/next-action mapping and the existing edge/bottom
  center-safe UI structure.
- Do not add a speculative normalizer, a second damage core, an external
  physics dependency or a presentation-side world model.

## Verification architecture

Each behavior receives a failing regression before its fix. Runtime claims are
paired with fixed-tick/revision/lifecycle evidence; screenshots never prove
physics or authority by themselves. Visible acceptance uses canonical
`1920x1080`, `1440x900`, `1024x768`, `1920x800` plus failed replay viewports
`2000x993` and `1712x1011`.

The former green suite remains necessary but is not sufficient. A new explicit
manual acceptance from the user is mandatory before closeout.

## Risks and stop conditions

- Stop if the admitted footprint cannot contain dry ground and edit depth
  without introducing global streaming.
- Stop if Structural collision cannot swap revisions atomically.
- Stop if the bounded physics budgets cause tunneling, nondeterminism or
  presentation-authored correction.
- Stop if a requested behavior requires Surface Lab/TestBridge or changes
  another runtime mode.
- Stop before task closure, final review, commit or push until the user accepts
  the new manual play session.


## Future unified Surface-Voxel Authority and Terrain/Tree fracture

This addendum is the single future owner for shared terrain/tree destruction
truth. It does not silently alter the current V1 Structural contracts.

### Chosen model

Procedural terrain sampling and authored Umbrella-Tree graphs remain source
layers. Both compile into one immutable, revisioned Surface-Voxel Authority.
After compilation the Tree graph is provenance/authoring evidence only, not a
second collision, support, material or physics truth. Terrain and tree edits
share the existing symmetric half-even 0.125 m global-quantum command boundary,
revision/CAS rules and support/connectivity derivation.

The authority canonical set is exactly cells/material/edits/provenance/ID/
revision/hash. Support roots/evidence, fracture/components, mass and physics
are deterministic derived products bound to that revision/hash; parent
cells/bricks are derived, not additional authority. Mesh, static collision,
beam queries, mass/COM/inertia and rigid-body bodies are projections of that
revision/hash and fail closed when stale. Adaptive per-brick or local
representation is allowed; a global 0.125 m rewrite is forbidden.

### Hestia Unified Surface Material Rules V1 — decision record

The approved common terrain/tree authority material policy is the separate
decision record [`docs/browser-mainline/hestia-unified-surface-material-rules-v1.md`](../../../../docs/browser-mainline/hestia-unified-surface-material-rules-v1.md),
approved 2026-08-03. Its record SHA-256 is
`900AC600C769C7B0A4312BBD00642230124E842C3C999077141DAB344A531C33` and its
`materialTableVersion` is `hestia.unified-surface-material-rules.v1`. That
record is the sole owner of the approved density, support-contact capacity,
span, anchor, overload and fracture values. This is a documentation contract;
it adds no runtime implementation.

Phase 3 and later are unblocked by that exact path and SHA. Phase 3 remains
open pending implementation and evidence. Its gate requires only the approved
density, support-contact capacity, maximum span, explicit anchors, overload and
fracture policy; continuous cohesion, strength and stress mechanics are
deferred. Any material-rule change requires a new version and fresh user
approval.

### Support, fracture and async boundary

After an accepted edit, only the affected neighborhood and deterministic
support frontier are recomputed in canonical (z,y,x) order. Six-neighbor
components remain attached only when connected to a support root with enough
material support capacity. For every local cantilever run, effective span is
the minimum approved span among all occupied/supporting material groups
participating in that run; capacity uses supporting-side frontier contacts.
Undercut, disconnected or overloaded components become complete hash-bound
fragments and body sources in the same atomic result; no floating presentation
block, hidden teleport, clipped collider or blanket velocity correction is
allowed. Material classes own the approved finite
density, support-contact capacity, maximum span, anchor eligibility, overload
and fracture values. Continuous cohesion, strength and stress mechanics are
explicitly deferred; they are not V1 or Phase 3 requirements.

Main captures and owns the immutable authority snapshot and quantized command,
transfers the seed once, and thereafter sends typed-array dirty-brick deltas.
Each seed, delta and result binds protocol/schema versions, authority ID,
predecessor/result revision and content hash, authority-derivation-algorithm
version, material-table version/hash, planning epoch and cancellation identity.
The worker derives support/fracture and projections only into a private
candidate; it never owns the authority. Main rejects any mismatch before
adoption, validates the bounded result commitments and atomically adopts one
complete snapshot to create the next authority, or keeps the prior snapshot
unchanged. The first proof measures the existing `16 MiB` transfer batch,
queues and gates; it does not assume SAB/COOP/COEP, OffscreenCanvas or WebGPU.

The existing raw IDs remain distinct: Structural `1/2/3` are Root/Wood/Canopy,
Structural `0` is Air, and Voxel byte `0` is SolidRock. The mapping is explicit
and never an ID equality. Phase 3 must derive one immutable material table and
bind its exact mapping, `materialTableVersion` and canonical
`materialTableContentHash` into snapshot, command and result commitments by
reusing existing `hashAdaptiveCanonical` and its canonical owner. Phase 3 must
extend the existing adaptive/structural contract tests for these commitments
and rerun Phase 2 parity after bridging the current adaptive table version
through the owning type/canonical boundary; Phase 2 hashes cannot change until
those parity tests pass. No new hasher or value normalizer is permitted.

### Phase boundary

This capability starts only after Task 19 PrepareSeed focused tests and live
Chrome liveness are green, and after Coast/Lush identity, vertical-band,
R09-R13 visual scope and host-cap corrections produce a manually visible
blocky world. It is the contract for Later Task 22+; it does not delay Coast
delivery and does not authorize persistence, planet-scale streaming, a full SVO
rewrite or mandatory WebGPU. Local hierarchical LOD and dirty-brick streaming
are included because the shared authority requires them. Stop on any second
authority, unapproved contract mutation, global fine-grid rewrite,
Presentation truth or Main long task.

### Approved adaptive-brick revision

The authority is one revisioned snapshot for terrain, trees and vegetation. Its
canonical fields are cells, material, ordered edits, provenance, authority
ID, revision and content hash. Support roots/evidence, fracture/components,
mass, LOD, render, collision and physics are deterministic products bound to
that revision and hash. Tree graphs and Coast generators are authoring inputs
only. There is no global dense leaf volume.

The existing `16^3` Adaptive hierarchy remains byte-compatible and unchanged:
`L4=.125 m`, `L3=.25 m`, `L2=.5 m`, `L1=1 m`, `L0=2 m`. Typical selection is
ground `L2/L3`, rock/fracture/trunk `L4`, and distant products `L1/L0`. A local
`L5=.0625 m` may be tested only as a measured same-camera A/B for fine
vegetation; it is not a production contract. Coalescing is legal only for
uniform `2x2x2` children whose density/occupancy, material, edit boundary and
result, source/provenance and required structural class all match and which
cross no edit or fracture boundary. Parent cells/bricks remain derived.
Neighbor levels differ by at most one. Brick bounds are half-open; the coarse
face owns the deterministic blocky 2:1 transition strip, the fine face is
suppressed, and edge/corner ownership uses a lexicographic tie-break. Far
products never answer gameplay queries.

Initial projections use Three.js WebGL `BufferGeometry`/batching. Exact physics
uses the existing `32 m` interaction tier and sleeping/exact `96 m` policy, both
from the same authority revision. Reuse the existing worker `16 MiB` batch,
queue and gate patterns. Measure payload per dirty brick instead of claiming
`64 KiB`; the current materialized planner estimate is `128 KiB` per brick.
Workers receive the seed once, then typed-array dirty-brick deltas with
protocol/schema versions, predecessor/result revision+hash,
authority-derivation-algorithm and material-table versions, epoch,
cancellation and stale rejection; publication is atomic. Do not add speculative
SAB/COOP/COEP, OffscreenCanvas, WebGPU or worker-owned authority.

The proof is sequential: baseline/spec, isolated mixed-material authority,
deterministic edit/hash/support/fracture and parent coalescing, dirty-brick
transfer, Surface-Lab render/seam proof, physics, Coast/tree shadow migration,
cutover/removal, then R09-R13 parity. The old non-tree vegetation exclusion is
pre-Task22 history. The Phase 2 fixture is deterministic and contains L0-L4
ground, trunk, vegetation and fracture; L5 remains optional same-camera A/B.
Coast routes and current adapters remain until shadow parity; the old
PreparedFire full-state path is removed last. The first implementation slice is
isolated and production-unwired. Coalescing, half-open seam ownership and
edge/corner tie-breaks require deterministic byte-for-byte tests. The optional
L5 A/B must improve the same-camera view within a 16 MiB page and 64 MiB
retained-memory budget, at most 64 colliders per body, action acknowledgement
under 100 ms, publication p95 at most 250 ms and no Main long task over 100 ms;
no cost improvement is required.
