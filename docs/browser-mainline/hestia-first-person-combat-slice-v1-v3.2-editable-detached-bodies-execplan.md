# ExecPlan: Hestia V3.2 editable detached Structural bodies

## Status and approval boundary

This is a decision-ready plan only. It is not approved by V3.1 and authorizes
no product or contract implementation by itself.

V3.1 deliberately rejects every Beam hit on a `Falling` or `Resting` body as
`DetachedBodyImmutable`. The user now requires both lifecycle states to keep a
pose-correct hitbox and remain locally voxel-editable/destructible. That change
is source-breaking for public Surface Play contracts and changes current body
authority. Explicit user approval of this complete V3.2 delta is required
before Phase 1 mutation. Approval includes the named Structural Core
Fork/Genesis API, the exact `contracts/index.ts` migration and the read-only
Presentation frame receipt used by the browser performance gate; no additional
public type or changed old-field meaning is implicit.

The active Core fixes for click latency, Terrain contact and false Terrain
rejection remain independent and may proceed under the approved recovery plan.

The read-only plan review of SHA-256
`16EE20B57C398A1EE52604A92379CC2326F995280B02A7DDEAABC6AD1A463B7F`
returned `NOT READY`. This revision resolves its seven blocking findings. It
must receive a fresh independent review and explicit approval of its new hash;
the prior hash and V3.1 approval authorize none of the V3.2 work below.

## Goal

After V3.2 is approved and implemented, a real Pulse Cutter Beam can hit the
nearest occupied voxel of an Attached tree or a `Falling`/`Resting` detached
tree body. An accepted body hit applies exactly one body-local Structural edit,
recomputes connected components, mass, center of mass, inertia, collider and
mesh, and atomically replaces the target body with zero or more deterministic
result bodies. Every surviving result receives a correct world pose and
velocity derived from the parent rigid velocity field. A `Resting` body wakes
after an applied edit. All results remain authoritative for Beam, player and
Terrain contact and remain editable until route cleanup.

The user-visible result must be prompt and physical: repeated cuts change the
actual voxel/collider state, split pieces fall independently, and no cut
creates ghost cells, duplicate bodies, stale hitboxes, Terrain fall-through,
partial capacity publication or Presentation-authored gameplay truth.

## Context

Repository/worktree:

- active worktree:
  `C:/IFI_SourceCode/Temp/WeltraumSpiel/.worktrees/Weltraum-Browser-IFIWELTRAUM-000-browser-hestia-first-person-combat-integration-v1`;
- branch: `feature/browser-hestia-first-person-combat-integration-v1`;
- base/contract commit: `fd379d7c160698214ab1471c4f240cbb82ef8620`;
- existing DevToolbox execution:
  `c757ca664e5a4060b90a5ca665380bb6`;
- change:
  `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1`.

Current V3.1 owners and constraints:

- Combat Core owns accepted fire, damage packets and Combat events.
- Structural Core owns voxel commands, revisions, hashes, connectivity and
  mass properties.
- the Surface Tree Runtime owns pure preflight, whole-batch reservation,
  current Attached authority, historical detached sources and atomic adoption;
- the bounded Surface Rigid Body Core owns pose, velocity, contact, wake/rest
  and physics failure;
- collision, Three.js, CSS and HUD consume immutable snapshots only;
- `window.TestBridge` is absent and remains forbidden;
- detached debris is session-local and is removed only on route cleanup;
- caps remain `8` dynamic bodies, at most `64` collider boxes **per Dynamic
  Body**, `256` contacts per scratch tick and `1..4` motion substeps. V3.2 adds
  no global collider-box pool and does not let one body borrow another body's
  unused per-body allowance.

Relevant implementation files:

- `apps/weltraum-browser/src/surface-play/contracts/index.ts`
- `apps/weltraum-browser/src/surface-play/combat/surfaceCombatContracts.ts`
- `apps/weltraum-browser/src/surface-play/combat/surfaceCombatRuntime.ts`
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeAuthority.ts`
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeRuntime.ts`
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeCollision.ts`
- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBody.ts`
- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBodyWorld.ts`
- `apps/weltraum-browser/src/surface-play/environment/hestiaStructuralTreePresentation.ts`
- `apps/weltraum-browser/src/voxel/structural/{commands,connectivity,fork,massProperties,model,types,validation,canonical,transfer,index}.ts`

Current contract facts that V3.2 must migrate deliberately:

- `DetachedBodyImmutable` is a public fire and Structural-transition rejection
  code and is currently the only legal result of a Dynamic Body Beam hit.
- `SurfaceStructuralBodySourceSnapshot` is immutable historical provenance and
  has an exact one-to-one binding to one `SurfaceDynamicBodySnapshot`.
- `SurfaceDynamicBodySnapshot.sourceObjectRevision/sourceContentHash` bind that
  immutable historical source.
- `SurfaceStructuralPresentationSnapshot` contains current Attached objects,
  historical `bodySources`, `dynamicBodies`, one Attached-object
  `latestTransition`, and an optional physics failure.
- the current body archive contains the historical source object/component/
  Fragment, mass properties, initial candidate and BodyLocal mesh; it has no
  current editable body authority.

Failed evidence that must remain in the final matrix:

- the user cannot cut a fallen body;
- one replay selected a fallen body and returned `DetachedBodyImmutable`;
- another replay exposed a pose/contact failure ending in
  `MotionBudgetExceeded`;
- Tree cuts have not yet met the real `100 ms` acknowledgement / `250 ms`
  authoritative-visible p95 gate.

## Non-goals

- No infinite Energy or debug Creative damage path.
- No edit command authored by Three.js, DOM, HUD or animation.
- No general-purpose physics engine or unbounded debris simulation.
- No persistence of live debris across reload/re-entry in this slice.
- No networking, rollback netcode or multi-player authority.
- No fracture particles that masquerade as authoritative voxels.
- No silent weakening of current body/collider/contact budgets.
- No change to Terrain edit semantics, Attached-tree root support or Combat
  damage ownership except the named Dynamic Body hit path.
- V3.2 does not implement or satisfy Terrain-undercut support invalidation. It
  may consume revision-bound Terrain colliders for `Falling`/`Resting` contact,
  but Terrain edits do not invoke Attached-tree support analysis and do not
  wake or detach a body in this slice. No V3.2 screenshot or playtest may claim
  Terrain-undercut behavior. Terrain edit -> support/contact invalidation ->
  Attached-tree release or Resting-body wake -> deterministic fall is V3.3 and
  requires its own approved contract, implementation and acceptance matrix.
- No commit, push, PR, merge, task closure or final Plannotator review under
  this plan until the parent recovery gates allow them.

## Architecture decision

### 1. Keep immutable origin provenance; add exact current body state

`bodySources` keep their V3.1 meaning. Each is the immutable historical
Fragment transferred out of the Attached tree. Its IDs, source revision/hash,
initial collider revision, full archived source object/component/Fragment and
BodyLocal artifact are never rewritten after detachment.

Add one renderer-independent current state per live Dynamic Body:

```text
SurfaceStructuralBodyStateSnapshot
  bodyId
  originBodyId
  originSourceFragmentId
  originObjectId
  lineageParentBodyId                 string | null
  lineageParentBodyStateRevision      number | null
  bodyObjectId
  genesisReceiptHash
  bodyStateRevision
  objectRevision
  editRevision
  contentHash
  currentComponentId
  colliderRevision
  meshArtifactId
  occupiedCellCount
```

`originBodyId`, `originSourceFragmentId` and `originObjectId` always identify
the V3.1 `bodySource`; they never identify an intermediate split parent.
`lineageParentBodyId` and `lineageParentBodyStateRevision` are both `null` for
the initially detached body. They are set only on a newly created child and
then remain immutable for that child. A primary result retaining the parent
`bodyId` retains its existing lineage fields. There is deliberately no
polymorphic `parentObjectId` field.

The Runtime-internal archive owns the validated current `StructuralObject`, its
exactly one current unanchored `StructuralComponent`, Fork/Genesis receipt,
current mass properties, BodyLocal colliders and BodyLocal mesh. The public
snapshot exposes only frozen identities, revisions, counts and hashes.

Every `bodyState` binds exactly one `dynamicBody`. Several current states may
share one origin source after a split. Factory cardinality becomes:

```text
bodySource 1 -> 0..N bodyStates by originBodyId/originSourceFragmentId/originObjectId
bodyState  1 -> 1 dynamicBody by bodyId plus all current-state bindings
```

Zero current states are legal only after the last result from that origin was
atomically destroyed. Origin sources remain published until route cleanup.
`bodySources`, `bodyStates` and `dynamicBodies` remain independently dense and
capped at `8`; states and bodies are canonical by `bodyId`.

### 2. Add a constructible Structural Fork/Genesis operation

Add a generic pure Structural Core operation in new
`apps/weltraum-browser/src/voxel/structural/fork.ts`:

```text
forkStructuralObjectComponent(sourceObject, sourceComponent, targetObjectId,
                              forkId)
  -> { object, component, receipt }
```

The operation is exported through `voxel/structural/index.ts` and owns these
rules; Surface Tree Runtime must not reconstruct an object by object spread:

1. require a frozen, valid source object and a current unanchored Component
   whose object ID/revision/hash exactly bind that source;
2. project exactly the Component's canonical occupied cells and retain, from
   the source object, every brick key intersected by a radius-3
   global-quantum sphere centered on any retained occupied cell. Retained
   coverage bricks with no projected Component cell are frozen empty bricks;
   every occupied Structural cell address remains unchanged;
3. reject if the source object lacks that complete coverage envelope. Never
   fabricate a brick key or resident proof. The target content hash binds both
   occupied state and empty coverage; retain `frame`, Adaptive `source` and
   material table unchanged;
4. publish `anchors: []`; retain only joints whose two endpoint cells are both
   inside the projected occupied-cell set; reject duplicate/missing cells;
5. reconstruct the target through Structural Core with the supplied new
   `targetObjectId`, `objectRevision=0`, `editRevision=0` and
   `commandEvidence=[]`; old command evidence is never copied to a new object;
6. derive classification again and require exactly one non-empty unanchored
   Component with byte-equal canonical cell membership;
7. leave `sourceObject` and `sourceComponent` byte- and reference-stable.

The empty evidence chain is valid because every forked object starts at `0/0`.
The Adaptive source binding is retained as provenance, but Adaptive ingest is
not replayed and no resident proof is fabricated.

The returned frozen `StructuralForkGenesisReceipt` is separate from
`StructuralObject.commandEvidence` and contains exactly:

```text
schemaVersion = structural-fork-genesis-receipt-v1
forkId
sourceObjectId
sourceObjectRevision
sourceEditRevision
sourceContentHash
sourceComponentId
sourceComponentContentHash
targetObjectId
targetObjectRevision = 0
targetEditRevision = 0
targetContentHash
targetCurrentComponentId
occupiedCellCount
occupiedCellDigest
retainedJointIds
receiptHash
```

`occupiedCellDigest` hashes canonical Structural cell address plus voxel state;
`receiptHash` uses a named `hashStructuralForkGenesisReceipt` canonical
projection in `canonical.ts`. Validation in `validation.ts` checks exact keys,
versions, hashes, sorted unique joint IDs, the exact retained source coverage
keys and every source/target binding. Repeated cuts centered on surviving cells
at brick faces, edges and corners must not fail with `MissingBrickCoverage`.
`types.ts` owns the receipt type/version and `index.ts` exports only the public
pure constructor, receipt type/version and hash function. This Structural Core
API addition is part of the approval delta.

Initial migration of a V3.1 body source uses:

```text
bodyId                 = origin bodySource.bodyId
bodyObjectId           = surface-tree-body-object:<bodyId>:0
bodyStateRevision      = 0
objectRevision/editRevision = 0/0
colliderRevision       = bodySource.colliderRevision
lineage parent fields  = null/null
```

The current component, mass, collider and mesh are freshly derived from the
fork result. The immutable origin archive is retained unchanged.

### 3. Apply Damage, then classify without root transfer

A body edit is one Structural `SubtractSphere` Damage command against the
current `bodyObjectId`, expected object revision/hash and hit material.
Structural Core remains the only owner of voxel changes, revisions, hashes and
command evidence.

After an `Applied` Damage preview, derive connectivity over all remaining
occupied cells. Forked body objects contain no anchors, so every non-empty
partition is a Dynamic Body result; none is transferred back to Attached-tree
authority. Empty occupancy removes the target. A Structural `NoChange` is not
an accepted shot: it is treated as `StructuralAuthorityRefused` during
preflight, the preview is discarded and no cost or authority state is adopted.

A one-partition result keeps the Damage result object and its append-only
command evidence. A multi-partition result treats that Damage result as a
transient, validated partition source and Fork/Genesis-projects **every**
partition, including the primary, into an independent one-component object.
The transient multi-component object is never published as current authority.

### 4. Pin non-circular lineage, IDs and revisions

For an applied edit of parent state `P`, first compute:

```text
nextParentBodyStateRevision = P.bodyStateRevision + 1
partitionComponents = connectivity(DamageResultObject)
partitionComponentId = Component ID on that Damage result before any fork
```

Order partitions by descending mass and then code-unit ascending
`partitionComponentId`. IDs are then assigned in this order:

1. the first partition is primary and retains `P.bodyId`;
2. each additional child gets
   `surface-tree-body-child:<hash>`, where `<hash>` is the full canonical hash
   of `{ schemaVersion: surface-tree-body-lineage-v1, parentBodyId,
   nextParentBodyStateRevision, partitionComponentId }`;
3. reject the whole preview as `StructuralAuthorityRefused` if any derived ID
   duplicates an existing non-target body or another result; hashes are never
   described as mathematically collision-free;
4. only after Body IDs exist, assign target object IDs and run Fork/Genesis;
5. derive `currentComponentId` from each final independent object. It is not
   reused as `partitionComponentId` and is not an input to its own Body ID.

Exact revision rules are:

| Outcome | Body ID | bodyStateRevision | bodyObjectId | object/edit revision | colliderRevision |
| --- | --- | ---: | --- | --- | ---: |
| Initial V3.1 migration | origin ID | `0` | `surface-tree-body-object:<bodyId>:0` | `0/0` | origin source collider revision |
| Applied single | retain parent | `P+1` | retain parent object ID | Damage result revisions | parent collider revision `+1` |
| Applied split primary | retain parent | `P+1` | `surface-tree-body-object:<parentBodyId>:<P+1>` | Fork Genesis `0/0` | parent collider revision `+1` |
| Applied split child | derived child | `0` | `surface-tree-body-object:<childBodyId>:0` | Fork Genesis `0/0` | `0` |
| Applied empty | no result | n/a | n/a | n/a | n/a |

Every safe-integer increment is checked before preview publication. The primary
retains its prior body-lineage fields; each child records the immediate parent
Body ID and `nextParentBodyStateRevision`. Result artifacts are derived first,
then output arrays are sorted by final `bodyId`. The applied body transition
records both pre-fork `partitionComponentId` and final `currentComponentId`, so
lineage and current authority cannot be confused.

### 5. Resolve the exact occupied Body cell, not a quantized box face

The rigid-body ray still selects the nearest revision-bound Body and collider.
Let `q = MICROVOXEL_BASE_QUANTUM_METERS` and let `c_pMeters` be the parent
component center of mass in canonical Surface metres. For the selected
candidate, transform the complete ray into that metre-valued frame:

```text
surfaceRayOriginMeters = c_pMeters
                       + inverse(bodyOrientation)
                         * (worldRayOriginMeters - bodyPositionMeters)
surfaceRayDirection = inverse(bodyOrientation) * worldRayDirection
```

For an integer global Structural cell `g`, its half-open Surface-metre AABB is
`[q*g, q*(g+1))`. The bound greedy collider stores completely occupied integer
cell bounds `[minimumCell, maximumCellExclusive)`, but slab and exact-cell entry
math uses `q*minimumCell` and `q*maximumCellExclusive`. A metre-valued ray
coordinate is never compared directly with an integer cell coordinate. Resolve
the entry cell from those converted bounds, not by rounding the world hit point:

- intersect the Surface ray with the selected collider box and reject a stale
  distance/pose/collider binding;
- on a boundary, choose the inside cell in ray direction: positive direction
  chooses the boundary index, negative direction chooses index minus one;
- for a zero direction component exactly on an internal boundary, consider
  both in-bounds adjacent occupied cells and choose the smallest canonical
  Structural cell address;
- at equal face/edge/corner entry parameters, choose the smallest canonical
  occupied address among the tied inside candidates;
- for start-inside, use the containing half-open cell; on an exact internal
  boundary use the same zero-direction tie rule;
- map the chosen integer Surface coordinate to its exact Structural address,
  require it is occupied in the current component and belongs to the selected
  collider, then read its current material.

The Structural command is exactly a `SubtractSphere` with
`space="global-quantum"`,
`centerQuantum=globalQuantumForStructuralCell(chosenAddress)` and
`radiusQuantum=SURFACE_TREE_HIT_RADIUS_QUANTUM`, which remains exactly `3`.
The geometric world hit point and normal remain Combat/Presentation facts. The
symmetric half-even quantizer continues to own Terrain and existing
Attached-hit numeric projection, but it must not select a Dynamic Body
authority cell. A failed exact-cell validation is `StaleRevision` or
`StructuralAuthorityRefused`; it never falls through to Terrain.

The Physics-owned `SurfaceRigidBodyRayHit` contains exactly `bodyId`,
`colliderIndex`, `colliderRevision`, `poseSimulationTick`, `pointMeters`,
`normal` and `distanceMeters`. It contains no Structural Component or current
authority claim. Immediately after ray selection, Surface Tree Body Authority
resolves `bodyId` and constructs `DetachedBodyHit` with `bodyStateRevision`,
`stateObjectId`, `stateObjectRevision`, `stateEditRevision`,
`stateContentHash`, `stateComponentId` and `stateGenesisReceiptHash`. Before
preview and again before adoption, collider revision, pose tick and every
current Structural binding must still match. Immutable origin fields are never
accepted as current authority.

### 6. Preserve the parent rigid velocity field and material points

Let the target pose and velocities bound at command tick `N` be `p`, `R`, `v`,
`w`; let current parent and result centers of mass in canonical Surface space
be `c_p` and `c_i`. The archive, not Presentation, supplies both COM values.
For every surviving result:

```text
r_i       = R * (c_i - c_p)
position  = p + r_i
rotation  = R
linear    = v + w cross r_i
angular   = w
```

Mass and inertia are recomputed from surviving voxels. Removed voxels take
prior momentum with them; no cutter impulse is invented. Every applied result
is `Falling`, `restingTicks=0`, and
`activationSimulationTick=N+1`. A Resting target therefore wakes, while a
mid-fall parent and its results cannot integrate in the same tick. Unchanged
Bodies retain object identity, pose, contact and rest state.

Continuity belongs to retained material points, not to the result COM. For
every retained canonical material point `xMeters` in Surface metres, tests
require within the existing numeric tolerance:

```text
beforePosition = p   + R * (xMeters - c_p)
afterPosition  = p_i + R * (xMeters - c_i)

beforeVelocity = v   + w cross (R * (xMeters - c_p))
afterVelocity  = v_i + w cross (R * (xMeters - c_i))
```

`beforePosition == afterPosition` and `beforeVelocity == afterVelocity`.
Orientation and angular velocity stay equal. COM position and COM linear
velocity are allowed and required to change whenever `c_i != c_p`; no test may
require COM pose or COM velocity equality across an edit.

### 7. Use a cheap Combat precheck, then whole replacement reservation

Add an internal pure Combat-owned precheck before raycast or Structural work.
Its frozen ready token binds command/player/frame/tick, weapon ID,
`shotSequence`, Energy, Heat and cooldown. It emits no event and mutates
nothing. Binding, cooldown, overheat or Energy failure immediately goes through
the existing typed blocked-fire publication and never runs Body preview.

The fixed-tick order is:

```text
input latch
-> pure Combat binding/readiness precheck
-> on precheck rejection: one typed FireRejected diagnostic and stop
-> revision-bound nearest ray result
-> exact Dynamic Body occupied-cell resolution when selected
-> pure Damage/connectivity/Fork/mass/collider/mesh preview
-> reserve prospective replacement after removing the target
-> revalidate the ready token against the unchanged Combat state
-> Combat FireAccepted + Structural Hit/Damage events + one shot cost
-> one atomic body-state/physics/collision/presentation adoption
-> new results become physics-active at N+1
```

A final prepared-fire execution consumes the ready token only if every bound
Combat fact is unchanged; otherwise it publishes the corresponding typed
rejection and discards the preview. Combat remains the sole owner of cost,
Heat, cooldown and accepted events.

Prospective capacity is exactly:

```text
prospectiveBodyCount = currentBodies - 1 + resultBodies
require prospectiveBodyCount <= 8
require every result.colliders.length <= 64
```

There is no global `boxCount` formula. The removed target does not create a box
pool for another body. Any result above `64` boxes rejects the complete
replacement as `ColliderBudgetExceeded`; body count above `8` rejects it as
`BodyCapacityExceeded`. Unchanged bodies are neither rebuilt nor recounted as
new admissions. Duplicate IDs, invalid Structural output or artifact failure
map to authority rejection. No clipping or partial publication is legal.

### 8. Exact public behavior and contract delta

Approval authorizes exactly these source-impacting changes:

1. remove `DetachedBodyImmutable` from `SurfaceFireRejectionCode`, rejected
   Attached Structural transition unions and every exhaustive UI/Combat map;
2. retain internal ray candidate kind `DetachedBodyHit`, but accept it through
   the prepared Structural path; public accepted fire remains
   `hit: "Structural"` and gains no `DynamicBody` variant;
3. add the Structural Core Fork/Genesis constructor, type/version, validator
   and canonical hash described above;
4. add required `bodyStates` to
   `SurfaceStructuralPresentationSnapshotInput` and output, with exactly the
   fields in section 1;
5. add these current-state bindings to `SurfaceDynamicBodySnapshot`:
   `bodyStateRevision`, `stateObjectId`, `stateObjectRevision`,
   `stateEditRevision`, `stateContentHash`, `stateComponentId` and
   `stateGenesisReceiptHash`;
6. keep existing Dynamic Body `componentId`, `objectId`,
   `sourceObjectRevision` and `sourceContentHash` as immutable **origin**
   provenance. Existing `colliderRevision` remains the current collider
   revision. `bodySource.colliderRevision` remains the initial origin collider
   revision and is no longer required to equal an edited Dynamic Body;
7. add required nullable `latestBodyTransition`, separate from Attached
   `latestTransition`;
8. add a frozen `SurfaceStructuralBodyEditTransitionSnapshot` union described
   below; no `NoChange` applied variant exists;
9. add a read-only `SurfacePlayPresentedFrameReceipt` and
   `readActiveSurfacePlayFrameReceipt()` export outside `contracts/index.ts`.
   It is written only after Presentation completes a render. The exact public
   diagnostic shape is:

   ```text
   SurfacePlayPresentedFrameReceipt contains exactly:
     frameSequence: safe non-negative integer
     presentedAtMilliseconds: finite non-negative number
     simulationTick: safe non-negative integer
     bodyBindings: dense readonly SurfacePlayPresentedBodyBinding[]

   SurfacePlayPresentedBodyBinding contains exactly:
     bodyId
     bodyStateRevision
     colliderRevision
     meshArtifactId
   ```

   `bodyBindings` is capped at `8`, sorted code-unit ascending by `bodyId`,
   unique, canonical-cloned and deeply frozen. An empty array is legal. The
   accessor has the exact signature
   `readActiveSurfacePlayFrameReceipt(): Readonly<SurfacePlayPresentedFrameReceipt> | null`;
   it returns `null` before the first completed render and after route cleanup.
   The receipt is
   diagnostic projection evidence, is never read by gameplay, exposes no
   mutator and is cleared on route cleanup;
10. add no new public accepted-hit or Combat-event kind.

Applied body transition contains exactly:

```text
status = Applied
fireCommandId
structuralCommandId
targetBodyId
targetBodyStateRevision
targetBodyObjectId
targetObjectRevision
targetEditRevision
targetContentHash
targetCurrentComponentId
targetColliderRevision
targetLifecycle
targetPoseSimulationTick
resultKind = Single | Split | Empty
changedCellCount
results[]:
  bodyId
  partitionComponentId
  bodyStateRevision
  stateObjectId
  stateObjectRevision
  stateEditRevision
  stateContentHash
  stateComponentId
  stateGenesisReceiptHash
  colliderRevision
  meshArtifactId
  occupiedCellCount
simulationTick
```

Rejected body transition contains exactly:

```text
status = Rejected
fireCommandId
structuralCommandId                  string | null
attemptedTargetBodyId
attemptedTargetBodyStateRevision
attemptedTargetBodyObjectId
attemptedTargetObjectRevision
attemptedTargetEditRevision
attemptedTargetContentHash
attemptedTargetCurrentComponentId
attemptedTargetColliderRevision
attemptedTargetLifecycle
attemptedTargetPoseSimulationTick
code = BodyCapacityExceeded | ColliderBudgetExceeded | StaleRevision |
       StructuralAuthorityRefused
simulationTick
```

It has no `resultKind`, `results` or `changedCellCount`. The attempted-target
fields are immutable attempted-snapshot facts and must not be required to equal
current `bodyStates` or `dynamicBodies`; that would make a truthful
`StaleRevision` transition unconstructible. The factory validates exact keys,
types, canonical values, command identity and allowed code/null combinations.
`structuralCommandId` is null only when no valid Structural command was built;
only `StaleRevision` and `StructuralAuthorityRefused` may carry null, while
capacity and collider rejection require a non-null ID. Runtime adoption tests,
not the rejected-transition factory, prove that current body authority,
physics, collision and artifacts stayed unchanged.

The matching public Fire rejection maps `StructuralAuthorityRefused` to the
existing `AuthorityRefused`; the other shared codes retain their names.
Readiness or frame rejection before a Dynamic Body is selected does not replace
`latestBodyTransition`.

Factories require dense arrays, exact keys, canonical order, safe revisions,
canonical quaternion/vector values and deep-frozen defensive copies. They
validate:

- origin fields against exactly one `bodySource`;
- existing Dynamic source fields against that same origin source;
- every current state field against exactly one Dynamic Body;
- state object/component/genesis/collider/artifact bindings exactly;
- zero current states only when no Dynamic Body references the origin;
- applied transition results exactly equal the resulting `bodyStates` subset;
- rejected attempted-target fields for shape/canonical validity only, never as
  a claim that they are the resulting current state.

### 9. Pin result, event, cost and diagnostic behavior

| Path | Public fire result and Surface summary events | Energy/Heat/cooldown | Body transition and authority |
| --- | --- | --- | --- |
| Binding/readiness rejection | typed rejected result; exactly one `FireRejected` | unchanged | `latestBodyTransition` unchanged; no preview |
| Stale/capacity/collider/authority/NoChange body rejection | typed rejected result; exactly one `FireRejected` | unchanged | publish one rejected body transition only; body authority/physics/collision/artifacts unchanged |
| Applied Single | accepted `hit:"Structural"`; `FireAccepted`, `StructuralHit`, `StructuralDamaged` in that order | one normal Pulse Cutter cost/Heat/cooldown | atomically replace target with one result |
| Applied Split | accepted `hit:"Structural"`; same three events in the same order | one normal cost | atomically replace target with all canonical results |
| Applied Empty | accepted `hit:"Structural"`; same three events in the same order | one normal cost | atomically remove target and retain origin source |

A Dynamic Body was already detached, so body edits do not emit
`StructuralDetached`; Split/Empty facts live in the body transition. Existing
Drone, Terrain, Miss and Attached-tree event behavior remains unchanged.

Rejection atomicity deliberately permits only diagnostic publication:

- Combat `latestFireResult`, one `FireRejected` summary and its sequence advance;
- Runtime `latestRejection`/HUD copy;
- for a selected Body preflight rejection only, `latestBodyTransition`.

Weapon state, Energy, Heat, cooldown, shot sequence, current body authorities,
physics world, contacts, collision, meshes and accepted Presentation bindings
remain byte/reference-identical to their pre-fire values. Tests compare those
fields separately rather than claiming the complete Combat or Presentation
snapshot is unchanged.

### 10. Reproducible responsiveness and visible-frame measurement

All p95 calculations use at least `20` measured samples **per matrix case** and
nearest-rank `sorted[ceil(0.95*n)-1]`. One warm-up sample per warm case is
excluded. A cold sample is the first Body interaction after a fresh route
entry; collect cold samples from `20` independent entries. Record machine,
Chrome version, viewport, seed and build hash with the evidence.

Timestamp definitions use the browser `performance.timeOrigin` clock:

- `inputAt`: capturing trusted `pointerdown` event timestamp from real
  Playwright mouse input;
- `ackAt`: first animation-frame poll where read-only active snapshot has the
  matching command ID in `latestFireResult`; HUD paint alone does not count;
- `authorityAt`: first poll with matching applied body transition and exact
  current Body bindings;
- `diagnosticAt`: first poll with the matching typed rejected fire result and,
  for a selected-Body rejection, its matching rejected body transition;
- `visibleAt`: `presentedAtMilliseconds` of the first read-only Presentation
  frame receipt whose Body/state/collider/mesh bindings equal `authorityAt`.

Compute `ackAt-inputAt` for every sample and `visibleAt-inputAt` only for
applied samples. Rejected samples record `diagnosticAt`; readiness/binding
rejections retain the previous `latestBodyTransition`, while selected-Body
rejections require the matching rejected transition. Required cases are cold
Falling Single, warm Falling Single, warm Falling Split, warm Resting repeat,
Applied Empty, Energy/Cooldown rejection, stale/authority rejection and
capacity/collider rejection. Every case requires p95 acknowledgement `<=100
ms`; applied cases additionally require p95 visible `<=250 ms`. Collect
`PerformanceObserver` long-task entries from input through `visibleAt` or
`diagnosticAt`: no sample may contain a task `>100 ms`, and no stall `>=1000
ms` is tolerated. Screenshots prove appearance but never substitute for
timestamps or receipts.

### 11. Runtime failure and cleanup

An edit never clears an unrelated physics failure. A session with a typed
physics failure stays fail-closed and must be re-entered. Page hide, route
disposal or partial bootstrap failure disposes every current body authority,
Fork receipt, origin source, collider, mesh, frame receipt and Dynamic Body.
No owner, listener or diagnostic receipt survives re-entry.

## Implementation phases

### Phase 0 - Approval and RED public matrix

Files:

- this plan;
- parent DevToolbox proposal/design/spec/tasks only after approval;
- `apps/weltraum-browser/tests/unit/surfacePlayContracts.test.ts`;
- new `apps/weltraum-browser/tests/unit/surfaceDynamicBodyEditContracts.test.ts`.

Actions:

1. Obtain explicit user approval for this entire plan and its recorded SHA-256,
   including sections 1-11, the identity/revision table, exact public
   allowlist, rejected-transition schema, event/cost matrix, V3.2/V3.3
   boundary and performance gates.
2. Record the approved plan path/hash on existing execution
   `c757ca664e5a4060b90a5ca665380bb6`; create no second execution.
3. Update the existing spec/tasks to the approved delta, without closing a task.
4. Add RED constructor/exhaustiveness tests for every new/removed field, Fork
   API, lineage/revision rule, per-body cap, transition and frame receipt.

Safe stop: any new public variant, different event row, changed old-field
meaning, global collider pool or persistence requirement returns to plan review.

### Phase 1 - Structural Fork/Genesis Core

Files:

- new `apps/weltraum-browser/src/voxel/structural/fork.ts`;
- `apps/weltraum-browser/src/voxel/structural/types.ts`;
- `apps/weltraum-browser/src/voxel/structural/canonical.ts`;
- `apps/weltraum-browser/src/voxel/structural/validation.ts`;
- `apps/weltraum-browser/src/voxel/structural/index.ts`;
- new `apps/weltraum-browser/tests/unit/structuralMicrovoxelForkGenesis.test.ts`.

Actions:

1. Implement the exact pure Fork/Genesis constructor and receipt.
2. Project cells/joints, retain the complete radius-3 source coverage envelope
   including frozen empty bricks, remove anchors, reset object/edit revision to
   `0/0` and retain immutable frame/source/material bindings.
3. Reconstruct and reclassify inside Structural Core; reject every mismatched
   source, duplicate cell, anchored result, multi-component result or bad hash.

Verification:

- source object/component remain byte- and reference-identical;
- receipt hash and target object are byte-equal across repeated construction;
- negative/global cell addresses and internal joints survive exactly;
- repeated face/edge/corner edits retain required empty coverage and never
  reject a valid surviving-cell cut as `MissingBrickCoverage`;
- old command evidence is not copied and new evidence is empty;
- tampered source/component/receipt/target bindings fail closed.

### Phase 2 - Current Body authority and exact cell hit

Files:

- new `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeBodyAuthority.ts`;
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeRuntime.ts`;
- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBody.ts`;
- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBodyWorld.ts` only
  for exact revision/collider hit facts already owned by Rigid Body Core;
- new `apps/weltraum-browser/tests/unit/surfaceTreeBodyAuthority.test.ts`.

Actions:

1. Migrate every new V3.1 body source once into the exact initial state/Genesis
   values from section 2; do not rewrite existing origin archive fields.
2. Extend the Physics-owned ray result with exactly collider revision and pose
   tick, then bind Body hit to the current Body-state/object/genesis facts and
   collider index before resolving the exact occupied cell using section 5.
3. Build one revision/hash/material-bound Damage preview.
4. Classify Empty/Single/Split, compute the pre-fork partition IDs and derive
   all current objects, receipts, mass, inertia, colliders and meshes purely.
5. Treat NoChange, stale material/address, ID collision and artifact failure as
   typed rejection before Combat acceptance.

Verification:

- all six outside faces, rotated body, negative coordinates, edge/corner tie,
  collider seam, zero-direction boundary and start-inside select the specified
  exact occupied cell;
- stale collider revision, pose tick or current-state binding rejects before
  preview and never falls through to Attached Tree or Terrain;
- equal state/ray/command yields a byte-equal preview;
- hit-material filtering changes at least the selected occupied cell and no
  other material;
- initial, Single, Split and Empty revision tables match section 4;
- partition/current Component IDs are distinct where the object ID changes;
- origin archive stays byte/reference-stable through repeated edits.

### Phase 3 - Atomic Rigid Body replacement

Files:

- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBody.ts`;
- `apps/weltraum-browser/src/surface-play/physics/surfaceRigidBodyWorld.ts`;
- `apps/weltraum-browser/tests/unit/surfaceRigidBody.test.ts`;
- `apps/weltraum-browser/tests/unit/surfaceRigidBodyWorld.test.ts`.

Actions:

1. Add a pure prospective replacement operation bound to target Body ID,
   collider revision and pose tick.
2. Compute each result pose/velocity from the pinned COM rigid-field formulas.
3. Validate `current - target + results <= 8` and each result independently at
   `<=64` collider boxes; do not sum boxes globally.
4. Atomically remove target and publish all results at `N+1`, or return the
   original world object unchanged.

Verification:

- every retained Single material point has continuous world position and
  velocity even when its result COM position/linear velocity changes;
- exact mid-fall Split positions and velocities match formula within existing
  numeric tolerances and retain material-point continuity;
- Resting edit wakes results at `N+1` and can settle again;
- one result with `64` boxes passes and `65` rejects even when other Bodies use
  few boxes; eight Bodies pass and a prospective ninth rejects;
- target removal is counted for Body capacity, never as pooled collider budget;
- failure keeps world, bodies, contacts and unrelated Body references identical.

### Phase 4 - Combat precheck, prepared fire and Runtime adoption

Files:

- `apps/weltraum-browser/src/surface-play/combat/surfaceCombatContracts.ts`;
- `apps/weltraum-browser/src/surface-play/combat/surfaceCombatRuntime.ts`;
- `apps/weltraum-browser/src/surface-play/surfacePlayRuntime.ts`;
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeRuntime.ts`;
- `apps/weltraum-browser/tests/unit/surfaceCombatRuntime.test.ts`;
- `apps/weltraum-browser/tests/unit/surfacePlayRuntimeIntegration.test.ts`.

Actions:

1. Implement the pure ready-token precheck before raycast/Structural preview.
2. Carry exact Body state/object/collider/pose bindings through
   `DetachedBodyHit`; a stale selected Body rejects and never falls to Terrain.
3. Revalidate token after full reservation and emit exactly the section 9 event
   row; accepted Dynamic Body hits publish public `hit:"Structural"`.
4. Apply one cost/Heat/cooldown and atomically adopt Body authority, Rigid Body
   world, collision/artifacts and applied body transition.
5. Preserve established typed rejection diagnostics while keeping every
   gameplay/weapon/authority field listed in section 9 unchanged.

Verification:

- Energy/Cooldown/Heat rejection performs zero Body preview calls;
- collinear Drone/Attached/Dynamic/Terrain selection keeps nearest-owner and
  existing tie rank;
- Fire/Hit/Damage summary sequence is exactly three accepted events for
  Single/Split/Empty and never emits `StructuralDetached`;
- every rejected path emits exactly one `FireRejected`, no accepted event and
  no cost;
- rejected body transition changes only the allowed diagnostic fields;
- Falling and Resting results remain repeatedly editable without reload.

### Phase 5 - Public contract, collision and Presentation migration

Files:

- `apps/weltraum-browser/src/surface-play/contracts/index.ts`;
- `apps/weltraum-browser/src/surface-play/vegetation/surfaceTreeCollision.ts`;
- `apps/weltraum-browser/src/surface-play/environment/hestiaStructuralTreePresentation.ts`;
- `apps/weltraum-browser/src/surface-play/surfacePlayPresentation.ts`;
- `apps/weltraum-browser/src/surface-play/surfacePlayBootstrap.ts`;
- `apps/weltraum-browser/src/surface-play/index.ts`;
- related contract/collision/presentation tests.

Actions:

1. Implement only the exact section 8 allowlist and remove every
   `DetachedBodyImmutable` exhaustive branch.
2. Replace source-to-body bijection with exact source/state/body validation;
   keep immutable origin fields and current fields semantically distinct.
3. Resolve current BodyLocal mesh/collider artifacts from `bodyStates`; rebuild
   only target/results and retain unrelated artifact identity.
4. Render current mesh under authoritative Dynamic Body pose, then publish the
   read-only matching frame receipt after the render call returns.

Verification:

- constructor roundtrip, exact keys, caps, canonical order, deep freeze and
  defensive-copy tests;
- no origin/current/transition/result mismatch can construct;
- before/after voxel, collider and mesh occupancy agree exactly;
- Split children are independently rendered/selectable and unrelated Bodies
  retain reference-identical artifacts and byte-identical poses;
- frame receipt cannot mutate or feed gameplay and clears on disposal;
- no Three.js/DOM import enters Structural, Combat or Surface contract Core.

### Phase 6 - HUD and reproducible performance harness

Files:

- `apps/weltraum-browser/src/surface-play/ui/surfacePlayHud.ts`;
- `apps/weltraum-browser/src/surface-play/ui/surfacePlayUiStyles.ts` only if
  required for non-overlap;
- `apps/weltraum-browser/tests/e2e/hestia-first-person-combat-slice.spec.ts`;
- new `apps/weltraum-browser/tests/e2e/helpers/surface-play-body-timing.ts`.

Actions:

1. Remove immutable-body copy; map actual readiness, stale, capacity, collider
   and authority codes to distinct actionable messages.
2. Collect trusted pointer, active-snapshot, frame-receipt and Long Task timing
   without adding `window.TestBridge` or a gameplay mutator.
3. Run the exact `n>=20` cold/warm/result/rejection matrix from section 10 and
   calculate nearest-rank p95.
4. Keep target/action/warning zones non-overlapping and preserve Combat-derived
   Energy/Heat/readiness copy.

Verification:

- no raw enum/path or obsolete immutable warning reaches HUD;
- every timing record contains command/result/body bindings and monotonic
  `inputAt <= ackAt <= authorityAt <= visibleAt` for applied samples;
- rejected samples contain monotonic `inputAt <= ackAt <= diagnosticAt`, no
  `authorityAt`/`visibleAt`, and readiness rejection retains the prior
  `latestBodyTransition`;
- p95/Long Task assertions fail the test, not only the evidence report;
- `typeof window.TestBridge === "undefined"` throughout.

### Phase 7 - Real installed-Chrome play matrix

Use installed Chrome through Playwright/DevTools and real keyboard/mouse input.
The existing read-only module snapshot/frame receipt is evidence, not control.
Playwright controls the player through normal `W/A/S/D`, jump, pointer-lock and
mouse buttons; add no runtime teleport, damage or infinite-Energy command.

Required scenarios:

1. detach one Attached tree and capture immutable origin/current genesis facts;
2. cut it during a visibly Falling intermediate frame;
3. verify Single/Split results preserve retained-material-point position and
   velocity continuity while their COM poses follow section 6, then contact
   Terrain;
4. wait for one result to Rest and cut it again;
5. walk into and around each current collider;
6. destroy one result completely and verify origin-only provenance;
7. exercise Energy/Cooldown rejection without preview stall;
8. exercise deterministic capacity/collider rejection through the browser-side
   bounded Core fixture plus its real HUD projection, without claiming that
   fixture as manual-world evidence;
9. reload/re-enter and prove all session-local authorities/receipts clear;
10. capture screenshots, trace and JSON for before, hit, Split, Falling,
    contact, Resting, repeated cut, Empty and rejection.

The real-route evidence records origin/current IDs, partition/current Component
IDs, object/body/collider revisions, ticks, poses, velocities, contact/rest,
Energy/Heat, event sequence and performance timestamps. DOM copy or a final
screenshot alone is insufficient.

### Phase 8 - Fresh gates and independent review

From `apps/weltraum-browser`, use the currently verified cached Node
`v22.23.1` binary and installed Chrome. Stop if the binary does not report the
pinned version; do not silently use global Node `v26`:

```powershell
$node22 = "C:\IFI_SourceCode\Utils\npm-tmp\opencode\node22-cache\_npx\52027bd8fc0022aa\node_modules\node\bin\node.exe"
$vitest = ".\node_modules\vitest\vitest.mjs"
$tsc = ".\node_modules\typescript\bin\tsc"
$vite = ".\node_modules\vite\bin\vite.js"
$playwright = ".\node_modules\@playwright\test\cli.js"
if ((& $node22 --version) -ne "v22.23.1") { throw "Pinned Node 22.23.1 is unavailable." }

& $node22 $vitest run tests/unit/structuralMicrovoxelForkGenesis.test.ts tests/unit/surfaceDynamicBodyEditContracts.test.ts tests/unit/surfaceTreeBodyAuthority.test.ts tests/unit/surfaceRigidBody.test.ts tests/unit/surfaceRigidBodyWorld.test.ts tests/unit/surfaceCombatRuntime.test.ts tests/unit/surfacePlayRuntimeIntegration.test.ts tests/unit/hestiaStructuralTreePresentation.test.ts --maxWorkers=1
if ($LASTEXITCODE -ne 0) { throw "Focused V3.2 unit gate failed." }
& $node22 $tsc -p .\tsconfig.json --noEmit
if ($LASTEXITCODE -ne 0) { throw "V3.2 TypeScript gate failed." }
& $node22 $vite build
if ($LASTEXITCODE -ne 0) { throw "V3.2 production Vite build failed." }
& $node22 $vitest run --maxWorkers=1
if ($LASTEXITCODE -ne 0) { throw "Full V3.2 unit gate failed." }

$runtimeLogDirectory = Join-Path (Get-Location).Path "evidence\runtime-logs"
New-Item -ItemType Directory -Force -Path $runtimeLogDirectory | Out-Null
$runStamp = [DateTime]::UtcNow.ToString("yyyyMMdd-HHmmss")
$viteStdout = Join-Path $runtimeLogDirectory "hestia-v3-2-vite-$runStamp.stdout.log"
$viteStderr = Join-Path $runtimeLogDirectory "hestia-v3-2-vite-$runStamp.stderr.log"
$viteStartedHere = $false

# WELTRAUM_MANAGED_VITE_PID may be set only to the exact PID already recorded
# in this execution's evidence/notes. A merely matching-looking listener is not
# sufficient authority to reuse it.
$listener = @(Get-NetTCPConnection -LocalAddress "127.0.0.1" -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue)
if ($listener.Count -gt 1) { throw "Multiple listeners own 127.0.0.1:5173." }
if ($listener.Count -eq 1) {
  if ([string]::IsNullOrWhiteSpace($env:WELTRAUM_MANAGED_VITE_PID)) {
    throw "Port 5173 is occupied but no documented managed Vite PID was supplied."
  }
  $documentedManagedVitePid = [Convert]::ToInt32($env:WELTRAUM_MANAGED_VITE_PID)
  if ($listener[0].OwningProcess -ne $documentedManagedVitePid) {
    throw "Port 5173 is not owned by the documented managed Vite PID."
  }
  $viteCommand = Get-CimInstance Win32_Process -Filter "ProcessId = $documentedManagedVitePid"
  if ($null -eq $viteCommand
      -or [IO.Path]::GetFullPath($viteCommand.ExecutablePath) -ne [IO.Path]::GetFullPath($node22)
      -or $viteCommand.CommandLine -notmatch "vite(.js)?"
      -or $viteCommand.CommandLine -notmatch "--strictPort") {
    throw "Documented PID is not the pinned Node-22 strict-port Vite process."
  }
  $viteProcess = Get-Process -Id $documentedManagedVitePid -ErrorAction Stop
} else {
  $viteProcess = Start-Process `
    -FilePath $node22 `
    -ArgumentList @(
      $vite, "--host", "127.0.0.1", "--port", "5173", "--strictPort"
    ) `
    -WorkingDirectory (Get-Location).Path `
    -RedirectStandardOutput $viteStdout `
    -RedirectStandardError $viteStderr `
    -WindowStyle Hidden `
    -PassThru
  $viteStartedHere = $true
}

$deadline = [DateTime]::UtcNow.AddSeconds(20)
$viteReady = $false
do {
  if ($viteProcess.HasExited) { throw "Managed Node-22 Vite exited." }
  try {
    $viteReady =
      (Invoke-WebRequest -UseBasicParsing `
        -Uri "http://127.0.0.1:5173/" -TimeoutSec 1).StatusCode -eq 200
  } catch {
    $viteReady = $false
  }
  if (-not $viteReady) { Start-Sleep -Milliseconds 200 }
} while (-not $viteReady -and [DateTime]::UtcNow -lt $deadline)

if (-not $viteReady) { throw "Managed Node-22 Vite did not become ready." }
$env:WELTRAUM_MANAGED_VITE_PID = [string]$viteProcess.Id
$env:WELTRAUM_PLAYWRIGHT_EXECUTABLE_PATH = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$env:WELTRAUM_PLAYWRIGHT_REUSE_EXISTING_SERVER = "1"

$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "hestia-v3-2-focused"
& $node22 $playwright test .\tests\e2e\hestia-first-person-combat-slice.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Focused installed-Chrome gate failed." }

$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "hestia-v3-2-live"
& $node22 $playwright test .\tests\e2e\browser-navigation-map-world-truth.spec.ts .\tests\e2e\hestia-microvoxel-surface-lab.spec.ts .\tests\e2e\large-field-navigation-objective.spec.ts .\tests\e2e\large-field-objective-chain-live.spec.ts .\tests\e2e\live-world-presentation-truth.spec.ts .\tests\e2e\normal-runtime-functional-planner.spec.ts .\tests\e2e\playable-large-field-live-flight.spec.ts .\tests\e2e\playable-large-proving-ground.spec.ts .\tests\e2e\world-chunk-streaming.spec.ts .\tests\e2e\hestia-first-person-combat-slice.spec.ts --workers=1
if ($LASTEXITCODE -ne 0) { throw "Live installed-Chrome inventory failed." }

$env:WELTRAUM_PLAYWRIGHT_ARTIFACT_GROUP = "hestia-v3-2-full"
& $node22 $playwright test --workers=1
if ($LASTEXITCODE -ne 0) { throw "Full installed-Chrome inventory failed." }
```

Every `n>=20` performance case sets an explicit bounded test timeout of
`180000 ms`; the route readiness and individual input/result waits keep their
narrower assertions. Focused, Live and Full evidence never share an artifact
group, and every native process exit code is checked.

The readiness-checked managed Vite process stays alive throughout all
Playwright gates. It must not be stopped before or between them. Afterward,
document its exact PID, command and log paths and either keep that same process
available for the user's live playtest or stop only `$viteProcess.Id` after
reconfirming that it still owns `127.0.0.1:5173`. Never stop an unrelated
listener and never start a blind second server.

From the exact worktree root:

```powershell
git diff --check
rg -n "DetachedBodyImmutable|64 total body collider|currentBoxes - targetBoxes" docs/browser-mainline/hestia-first-person-combat-slice-v1-v3.2-editable-detached-bodies-execplan.md apps/weltraum-browser/src/surface-play
rg -n "^(import|export).*from.*(three|/ui|/hud|worker|testBridge)" apps/weltraum-browser/src/surface-play/contracts
rg -n "\b(window|document|navigator|HTMLElement|Worker|TestBridge)\b" apps/weltraum-browser/src/surface-play/contracts
```

The first targeted `rg` may find only V3.1 historical/removal assertions, never
an active V3.2 branch or obsolete plan rule. Review the exact approved
`contracts/index.ts` allowlist, run secret/global/import scans, request an
independent technical review, and keep all DevToolbox tasks open until the
parent manual gate allows completion preflight. The worktree has no `.sln`, so
.NET build/test is `NOT APPLICABLE`.

## Tests and evidence

The minimum regression matrix is:

| Area | Required proof |
| --- | --- |
| Origin provenance | V3.1 source IDs, object/component/Fragment, revisions, hashes, initial collider revision and artifact remain byte/reference-stable across all edits. |
| Fork Genesis | Exact cell/state projection, no anchors, internal joints only, `0/0` revisions, empty command evidence, one unanchored component and validated receipt/hash. |
| Body-local ray | All faces, rotation, negative coordinates, seams, edge/corner ties, zero-direction boundary and start-inside select the pinned occupied cell/material. |
| Initial migration | Origin Body gets state revision `0`, object `0/0`, initial collider revision and null lineage without rewriting source. |
| Single | Parent Body/Object IDs remain, Body/collider revision advances once, Damage evidence remains append-only and every retained material point preserves world position/velocity continuity while the COM may change. |
| Split | Pre-fork partitions are complete/disjoint; primary retains Body ID, all result objects are independent Genesis objects, children use deterministic non-circular IDs. |
| Empty | Last cell removal atomically removes state/body/collider/mesh while keeping origin provenance. |
| NoChange | Discarded as authority rejection before cost; exactly one FireRejected diagnostic and no current authority delta. |
| Momentum | Result COM pose and linear/angular velocity match the pinned rigid-field formulas. |
| Rest/wake | Resting edit wakes at `N+1`; unchanged Bodies remain resting; results can rest and be edited again. |
| Capacity | `current-target+results <=8`; every result independently permits `64` boxes and rejects `65`; no global box pool. |
| Accepted Combat | Dynamic hit maps to public Structural; exact FireAccepted/StructuralHit/StructuralDamaged ordering; one normal cost; no StructuralDetached. |
| Rejected Combat | Exactly one FireRejected and typed result; only allowed diagnostic snapshots change; Weapon/Energy/Heat/cooldown/shot/body/physics/collision/artifacts stay unchanged. |
| Collision | Player, Beam and Terrain contact bind the same current state/collider revision; no ghost, tunnel or fall-through. |
| Presentation | BodyLocal mesh matches occupied cells, follows authoritative pose, and frame receipt matches the rendered immutable bindings only. |
| Performance | At least 20 samples per named case; nearest-rank p95 ack `<=100 ms`, applied visible `<=250 ms`, no Long Task `>100 ms`, no stall `>=1000 ms`. |
| Cleanup | Route/reload clears authorities, receipts, artifacts/listeners and starts with normal full Energy. |

Write evidence only beneath the existing change using these exact outputs:

```text
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/v3.2-editable-bodies-focused-unit.txt
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/v3.2-editable-bodies-full-unit-build.txt
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/v3.2-editable-bodies-contract-allowlist.txt
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/v3.2-editable-bodies-browser-performance.json
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/v3.2-editable-bodies-browser-playtest.md
.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tests/screenshots/v3.2-*.png
```

The performance JSON stores raw samples, sorted samples, nearest-rank index,
p50/p95/max, Long Tasks, command/body/state/artifact bindings, environment and
build hash. The playtest report links screenshots and trace paths and labels
each scenario PASS/FAIL. Existing failed user screenshots remain Failed
Evidence and are never relabeled as acceptance proof.

## Risks

| Risk | Mitigation |
| --- | --- |
| Historical source is silently rewritten | Separate immutable origin archive from current state; reference/byte-stability tests. |
| New object cannot satisfy Structural evidence semantics | Named Fork/Genesis API resets to `0/0`, keeps receipt outside command evidence and revalidates the result. |
| Split creates circular or unstable identity | Pre-fork partition ID derives Body ID; Body ID derives object ID; final current Component ID is derived last and all mappings are recorded. |
| Primary publishes a multi-component object | On Split, Fork every partition including primary; never publish transient Damage result. |
| Split duplicates or loses cells | Exact pre/post canonical cell/state digest and disjoint-complete partition assertion. |
| Ray chooses the outside cell on a positive face | Direction-aware half-open occupied-cell selection; command center comes from exact address, not rounded face. |
| A result discontinuously moves retained material when COM changes | Pinned rigid-field formulas plus numeric retained-material-point position/velocity continuity regression. |
| Same-tick double integration | Results activate at `N+1` after atomic replacement. |
| Collider cap silently becomes global | Per-result `<=64` assertions and simultaneous multi-Body boundary test. |
| Rejection test falsely demands whole snapshot identity | Explicit diagnostic allowlist; gameplay/authority fields are compared separately. |
| Readiness rejection still performs expensive work | Pure Combat precheck before raycast/Structural preview; zero-preview call-count tests. |
| Presentation receipt becomes gameplay authority | Write after render, expose read-only projection, ban all gameplay imports/reads, clear on cleanup. |
| Current edit reintroduces stalls | Raw `n>=20` browser samples, enforced p95 and Long Task thresholds, rebuild changed target/results only. |
| Dynamic cut hides nearer/valid Terrain behavior | Deterministic nearest candidate and stale-body no-fallback tests. |
| Physics failure is masked | Existing typed failure remains fail-closed; edit cannot clear it. |
| Contract migration breaks consumers | RED exact-key/exhaustive compile matrix and reviewed allowlist before implementation. |

## Rollback / safe stop

- No reset, clean, checkout, broad deletion, commit, push, PR, merge, task
  closure or final Plannotator review under this plan.
- Each phase is a narrow reviewable diff with its own RED/GREEN evidence.
- V3.1 `DetachedBodyImmutable` remains active until the exact V3.2 plan is
  approved and the contract migration is complete; there is no half-enabled
  compatibility branch.
- Any new public variant, old-field reinterpretation beyond section 8, global
  collider pool, persistence requirement or different result/event/cost row
  stops mutation and requires a reviewed plan revision.
- Any partial publication, cell loss/duplication, invalid receipt,
  retained-material-point discontinuity,
  Energy debit on rejection, Terrain fallback, ID collision, task `>100 ms` or
  failed p95 gate blocks the next phase.
- If a phase must be reverted, apply only an explicit targeted inverse patch
  after user direction; never discard the dirty worktree or unrelated changes.
- If the pinned Node 22 or installed Chrome is unavailable, record `BLOCKED`;
  do not substitute another runtime silently.

## Progress log

- [x] User requirement and failed evidence persisted.
- [x] Current V3.1 ownership/contract mismatch mapped.
- [ ] Fresh independent read-only review confirms all prior findings are
  resolved. This revision incorporates per-body cap, non-circular identity,
  metre/cell-safe exact ray selection, explicit current hit bindings,
  Fork/Genesis empty coverage, attempted-target rejection diagnostics,
  material-point continuity, event/cost behavior, Combat precheck,
  V3.2/V3.3 separation and pinned single-worker evidence commands, but none is
  marked resolved until the revised hash is reviewed.
- [ ] Explicit user approval and approved plan hash recorded on the existing
  execution.
- [ ] Phase 0 RED public matrix.
- [ ] Phase 1 Structural Fork/Genesis Core.
- [ ] Phase 2 current Body authority and exact hit.
- [ ] Phase 3 atomic Rigid Body replacement.
- [ ] Phase 4 Combat precheck/prepared fire/Runtime adoption.
- [ ] Phase 5 public contract/Presentation migration.
- [ ] Phase 6 HUD and performance harness.
- [ ] Phase 7 real installed-Chrome play matrix.
- [ ] Phase 8 full gates and independent review.

## Definition of Done

V3.2 is done only when all of the following are true:

- the user explicitly approved this exact Structural API, public contract,
  behavior, event/cost, diagnostic and performance delta;
- Falling and Resting Bodies accept repeated pose-correct local authoritative
  cuts through normal Combat/Structural flow;
- Fork receipts validate and immutable origin provenance never changes;
- Single/Split/Empty preserve exact cell ownership and the pinned identity and
  revision table; NoChange rejects without cost;
- pose, velocity field, mass, inertia, colliders and meshes are deterministic
  and revision-bound;
- capacity is at most eight Bodies and at most 64 boxes per Body, with no global
  pooling or partial replacement;
- rejections publish only their exact typed diagnostics and do not change
  Weapon, Energy, Heat, cooldown, shot sequence, authority, physics, collision
  or artifacts;
- no retained material point jumps, no result duplicates, ghosts, tunnels,
  falls through Terrain, loses editability after Resting, or clears a physics
  failure;
- installed Chrome passes every real-input scenario with raw `n>=20` timing,
  p95, Long Task, frame receipt, trace, JSON and screenshot evidence;
- all focused/full unit, TypeScript, build, E2E and hygiene gates pass freshly
  on pinned Node `v22.23.1` and the reviewed contract allowlist;
- independent technical review has no unresolved finding;
- the parent recovery manual playtest is explicitly accepted;
- only then may the parent workflow proceed to DevToolbox completion preflight,
  final Plannotator review and a separately authorized commit/non-force push.
