# Capability: Hestia First-Person Combat Slice V1 — Manual-Recovery Revision

## Requirement: Approval gate
The system SHALL NOT implement the newly discovered V3.1 detached-ownership
Structural-Core or public-contract delta until its revised ExecPlan addendum is
explicitly approved.

### Scenario: Planning state
- GIVEN the 2026-07-27 manual play rejection
- THEN all DevToolbox tasks remain open
- AND rejected screenshots are failed evidence
- AND no commit, push, final review or publication occurs.

## Requirement: Bounded dry Hestia region
The system SHALL select one deterministic Hestia land anchor and materialize a
bounded `64 x 32 x 64 m @ 0.50 m` resident footprint with stable identity.

### Scenario: Deterministic anchor selection
- GIVEN candidate centers at `x,z=-64..64 m` in `16 m` steps around the
  configured `SurfaceLocalFrame` origin
- WHEN candidates are evaluated
- THEN they sort by squared horizontal distance, global `z`, then global `x`
- AND the first fully valid candidate wins with its `64 m` footprint centered
  on that lattice point and spawn probed at the exact center grid cell
- AND with frame-origin Y `O_y` and ground Y `G_y`, the band minimum is
  exactly `B_y = O_y + 32 m * floor((G_y - O_y - 8 m) / 32 m)`
- AND `[B_y,B_y+32 m)` is valid only when
  `B_y+32 m >= G_y+1.62 m+4 m`, otherwise the candidate is invalid
- AND no random retry or implementation-selected tie-break is allowed.

### Scenario: Traversal-domain admission
- GIVEN equal validated identity and seed
- WHEN a `0.50 m` canonical ground grid is evaluated inside the `8 m`
  resident-boundary inset
- THEN dry-walkable cells require ground at least `1.0 m` above water, slope
  at most `50 degrees`, neighbor step at most `0.40 m` and full capsule
  clearance
- AND eight-neighbor flood fill in `(z,x)` order selects the spawn component
- AND its ground AABB is at least `32 x 32 m`
- AND spawn slope is at most `12 degrees` and spawn is at least `12 m`
  geodesic distance from that component's perimeter
- AND the dry surface, capsule and supported edit depth fit vertical coverage.

### Scenario: Runtime dry boundary
- GIVEN the admitted `SurfaceTraversalDomain`
- WHEN the player walks uphill, downhill or toward its perimeter
- THEN a Runtime-owned half-open `ShoreBoundary` blocks the capsule before
  capsule or eye enters a non-dry/water cell
- AND water remains scenery rather than a collision plane or medium state
- AND recorded ground, capsule, eye and water Y values satisfy the dry rule.

### Scenario: No valid anchor
- GIVEN no candidate satisfies every admission rule
- WHEN Surface Play starts
- THEN startup fails closed with a typed player-safe failure
- AND no snap, underwater fallback or presentation-authored ground is used.

## Requirement: World-owned water and population facts
Water, shore, traversal-domain and vegetation placement SHALL be immutable
World/Runtime facts. Presentation SHALL render only those facts and SHALL NOT
resample Hestia fields to create gameplay-relevant placement.

### Scenario: Dry player route
- GIVEN the admitted spawn and connected traversal domain
- THEN water remains visible only as spatially readable scenery
- AND the player/camera cannot cross the authoritative dry boundary
- AND no underwater medium or swimming behavior is claimed.

### Scenario: Rejected uphill/downhill replay
- GIVEN the fixed route and view sequence reproducing the rejected water edge
- WHEN the same uphill and downhill traversal is replayed
- THEN every pose remains in the admitted dry component
- AND no full-screen water treatment, camera/water intersection or hidden
  resident edge occurs.

## Requirement: Readable Hestia presentation
Surface Play SHALL use one Surface light-rig owner and provide readable
terrain, water and vegetation separation across foreground, middle ground and
background without visible resident boundaries in accepted views.

### Scenario: Default spawn frame
- GIVEN the canonical spawn view
- THEN no region edge, void, cyan hard cut, clipped underside or opaque
  vegetation wall is visible
- AND Hestia identity remains recognizable without labels
- AND renderer state supplies no world truth.

## Requirement: Supported locomotion rest
Grounded locomotion SHALL distinguish unsupported, supported-moving and
supported-resting behavior without a blanket velocity-zero shortcut.

### Scenario: Capture and hysteresis
- GIVEN a walkable contact at slope at most `50 degrees`, zero input, no jump
  and support-tangent speed at most `0.20 m/s`
- WHEN the contact is new or remains eligible for two moving ticks
- THEN locomotion enters `SupportedResting` before gravity displacement
- AND support reaction cancels gravity without snapping position
- BUT speed at least `0.25 m/s`, input or an external impulse releases to
  `SupportedMoving`
- AND the `0.20..0.25 m/s` hysteresis band preserves the current support state.

### Scenario: Idle on a walkable slope
- GIVEN a captured rest state
- WHEN 600 fixed ticks advance
- THEN position drift is at most `1e-6 m`
- AND final speed is at most `1e-6 m/s`
- AND the player remains grounded.

### Scenario: Motion remains physical
- GIVEN movement input, jump, a slope above `50 degrees`, lost contact or an
  external/support-tangent speed at least `0.25 m/s`
- THEN tangential movement, airborne gravity or controlled sliding remains
  observable
- AND velocity is not globally zeroed.

## Requirement: Authoritative voxel Umbrella Trees
Umbrella Trees SHALL be stable Structural voxel objects with occupancy, root
anchors, revisioned edits and immutable presentation snapshots. Other V1
vegetation SHALL be explicitly non-solid decoration.

### Scenario: Static collision and beam hit
- GIVEN a current Structural revision
- WHEN the player capsule or Pulse Cutter reaches an occupied tree cell
- THEN revision-bound Structural collision blocks the player
- AND Combat Core resolves the nearest Drone/Structural/Terrain hit
- AND Three.js geometry is not queried as authority.

### Scenario: Exact local Structural edit
- GIVEN an accepted Beam hit on an Attached Umbrella Tree
- WHEN the occupied hit point is half-even quantized to the `0.125 m` grid
- THEN exactly one global-quantum `SubtractSphere` command with
  `radiusQuantum = 3` (`0.375 m`) targets only the hit cell's destructible
  Structural material ID
- AND command/source/object revisions derive from the fire and ray snapshot
- AND stale/duplicate/refused edits publish no object, collider or visual
  success.

### Scenario: Canonical support loss
- GIVEN the historical phase-2 fixture rooted at quantum `(8,0,8)`
- WHEN canonical clockwise occupied-surface hits are applied at the trunk band
  nearest `45%` authored height
- THEN the first accepted hit changes only local cells and stays anchored
- AND a crown/branch component detaches no later than accepted hit six
- AND repeated runs yield equal cells, revisions, component IDs and mass facts.

## Requirement: Post-detach ownership transfer
After support loss, current Structural authority SHALL contain only still
editable current cells. Historic body geometry SHALL remain immutable and
separately source-bound.

### Scenario: Canonical two-revision detachment
- GIVEN Damage produces detached source authority `r+1/e+1`
- THEN a separately schema-versioned, validated and hashed Structural-Core
  transfer command SHALL select exactly every detached `sourceFragmentId`
- AND it SHALL remove exactly those sparse cells while retaining brick
  coverage, materials, frame, Adaptive source, anchors and joints
- AND current authority SHALL become `r+2/e+2` with no detached current
  Component
- AND existing Evidence V1 SHALL record a reproducible transfer command hash,
  equal selected/changed/transferred cell counts and unchanged Adaptive journal
  digest.

### Scenario: Historic body source and later stump edit
- GIVEN hit 3 produced one body source and one Dynamic Body from source `r+1`
- WHEN hit 4 edits the remaining current stump
- THEN current revision/hash SHALL advance once
- AND historic Body, Component, Fragment, source revision/hash, collider and
  cold-resolved mesh identities SHALL remain byte-equal
- AND no transferred cell SHALL exist in current collision or be selectable
  by the later command
- AND no second body SHALL be admitted.

### Scenario: Exact Surface contract binding
- THEN every Structural transition SHALL contain required
  `authorityTransfer`, null except for Detached
- AND Detached SHALL chain the nested transfer exactly from the top-level
  Damage result to the current published object
- AND Structural presentation SHALL contain required canonical `bodySources`
  capped at `8`, while current `components` are anchored-only
- AND every Dynamic Body SHALL bind exactly one body source using existing IDs,
  source revision/hash and collider revision.

### Scenario: Empty current object with historic body
- WHEN transfer removes every remaining detached cell
- THEN the same current object ID and empty brick coverage SHALL remain
- AND current classification, mass and static collision SHALL be empty
- AND historic body sources and Dynamic Bodies SHALL remain valid until route
  cleanup.

## Requirement: Deterministic falling and resting trees
A detached Structural component SHALL enter a bounded fixed-tick rigid-body
lifecycle owned outside Presentation.

### Scenario: Transactional body admission
- GIVEN a pure unpublished Structural candidate
- WHEN all detached components and complete body-local compound boxes are
  derived
- THEN the whole batch is reserved before Combat cost/damage, Structural
  publication or body publication
- AND Falling plus Resting bodies count toward the maximum of `8`
- AND every body contains at most `64` complete boxes
- AND partial reservation, collider clipping and bodyless detached components
  are forbidden
- BUT an over-capacity fire rejects before firing with public
  `BodyCapacityExceeded` or `ColliderBudgetExceeded`
- AND Combat emits only `FireRejected`, Runtime publishes that rejected latest
  Structural transition, and the attempted shot adds no `12 J` Energy debit,
  `18 J` Heat, damage, edit, collider or body-state change
- AND deterministic recovery/cooling already applied earlier in the tick remains.

### Scenario: V1 fixed-tick algorithm
- GIVEN an admitted detached component at tick N
- THEN physics begins at N+1 with `60 Hz` semi-implicit Euler and canonical
  quaternion axis-angle integration
- AND body-local boxes become world OBBs; stable broadphase plus 15-axis SAT
  resolves Terrain/body contacts
- AND `1..4` substeps limit translation to `0.0625 m` and rotation to
  `2 degrees` per substep
- AND each substep uses exactly `8` stable sequential-impulse iterations,
  restitution `0`, friction `0.65`, Baumgarte `0.20` and slop `0.005 m`
- AND at most `256` contact pairs are generated per outer tick.

### Scenario: Atomic physics failure
- GIVEN motion/contact/non-finite work exceeds an approved bound
- WHEN the scratch tick cannot complete
- THEN no partial body state is published
- AND the last valid snapshot remains
- AND typed fatal `MotionBudgetExceeded`, `ContactBudgetExceeded` or
  `NonFiniteState` disables further Surface input.

### Scenario: Collision and rest lifecycle
- GIVEN a Falling or Resting body
- THEN it collides with Terrain and other bodies and blocks player/Beam queries
- AND Resting requires linear/angular speed each at most `0.05` for `120` ticks
- AND no timer removes it; route cleanup is the only removal.

### Scenario: Beam hit on a detached body
- GIVEN the nearest Beam candidate is a Falling or Resting tree body
- WHEN the player fires
- THEN the command rejects before firing with public `DetachedBodyImmutable`
- AND Combat emits only `FireRejected` while Runtime publishes that rejected
  latest Structural transition
- AND the attempted shot adds no `12 J` Energy debit, `18 J` Heat, damage or
  edit; deterministic recovery/cooling already applied earlier in the tick
  remains
- AND the hit never falls through to Terrain.

## Requirement: Finite testable Pulse Cutter energy
The Pulse Cutter SHALL start at `240 J`, spend `12 J` per accepted shot and
recover `12 J/s` after `3.0 s` without an accepted shot, capped at `240 J`.
Heat remains `18 J` per accepted shot, maximum `54 J`, cooling `12 J/s`.

### Scenario: Exhaustion and recovery
- GIVEN a full charge and no recovery interval
- WHEN 20 shots are accepted
- THEN the 21st shot returns typed `EnergyInsufficient`
- AND after the delay plus one second exactly one further shot is affordable
- AND no damage or edit is fabricated for a rejected shot.

### Scenario: Test envelope
- GIVEN one full charge
- THEN it supports at least 3 Drone hits, 6 Structural Tree hits and 8 Terrain
  hits plus 3 reserve shots.

## Requirement: Combat-derived readiness and player HUD
Combat SHALL publish typed readiness/recovery. The HUD SHALL project that state
with clear Energy/Heat separation, player-safe reason/next-action copy and no
debug telemetry or raw exception text.

### Scenario: Center-safe status
- GIVEN target, accepted-action and blocked-action states
- THEN the center-safe zone contains only reticle and one target context
- AND transient action and warning zones do not overlap each other, the target
  or the viewport boundary
- AND transient messages expire by an explicit deterministic lifetime.

### Scenario: Readiness parity
- GIVEN Energy is positive but below `12 J`
- THEN Combat and HUD both report the typed blocked state
- AND the UI cannot display `READY` or make `54 J` Heat appear to be Energy.

### Scenario: Pinned player-safe rejection copy
- GIVEN `BodyCapacityExceeded`, `ColliderBudgetExceeded`,
  `DetachedBodyImmutable` or a stale Structural refusal
- THEN the HUD shows respectively `Too many fallen pieces would be active. Aim
  for a smaller cut or re-enter Surface Play to clear debris.`, `This cut is
  too complex to simulate.`, `Fallen trees cannot be cut in this test slice.`
  or `The tree state changed. Aim again.`
- AND raw rejection codes remain only in authoritative snapshots and tests.

## Requirement: Exact public contract delta
After approval, the renderer-independent contract SHALL add only the reviewed
Structural/readiness variants and snapshots; before approval it SHALL remain
byte-for-byte unchanged from the contract base.

### Scenario: Approved source-impacting variants and migrations
- THEN accepted fire and impact kinds add exactly `Structural`
- AND `SURFACE_FIRE_REJECTION_CODES` adds exactly `BodyCapacityExceeded`,
  `ColliderBudgetExceeded` and `DetachedBodyImmutable`
- AND Combat event kinds add `StructuralHit`, `StructuralDamaged` and
  `StructuralDetached`
- AND Combat snapshot and HUD input add required typed readiness with
  `Ready|Cooldown|Overheated|EnergyInsufficient` as deliberate source-breaking
  constructor migrations
- AND existing fire rejection `InsufficientEnergy` is not renamed and maps to
  readiness `EnergyInsufficient`
- AND old field/variant meanings remain unchanged while every listed exhaustive
  TypeScript consumer is migrated.

### Scenario: Approved exact transition and presentation shapes
- THEN `Applied|NoChange` Structural transitions carry fire/command/object IDs,
  previous/resulting object and edit revisions/hashes, changed-cell count,
  canonical changed-brick IDs capped at `4096`, support result, detached
  component IDs capped at `8`, and tick
- AND `Rejected` carries fire ID, nullable Structural command ID, object ID,
  current revisions/hash, public rejection code and tick, with no changed or
  detached fields
- AND Structural presentation caps sorted objects/components at `128` each and
  dynamic bodies at `8`, includes `latestTransition` and nullable
  `physicsFailure`, and is published by Runtime
- AND physics-failure body IDs are sorted/unique and capped at `8`; healthy
  snapshots carry `physicsFailure: null`.

### Scenario: Approved immutable contract boundary
- THEN factory-validated immutable Structural transition, dynamic-body,
  Structural presentation and physics-failure snapshots bind IDs to source
  revision/content hash
- AND `SurfacePlayPresentationPorts` adds the Runtime-owned Structural port
- AND no Three.js, DOM, Worker, browser global or TestBridge type appears.

No general TypeScript source-backward-compatibility claim applies to the two
required-field migrations or enumerated union additions.

## Requirement: Existing Terrain edit preservation
The Structural hit path SHALL NOT change unobstructed Terrain edit semantics.

### Scenario: One authoritative Terrain transition
- GIVEN an unobstructed accepted Terrain hit
- THEN Combat publishes exactly one `TerrainHit` event
- AND Terrain Authority publishes exactly one quantized `SubtractSphere` CAS
  transition
- AND resulting revision/hash, collision, remesh and presentation agree
- AND stale/duplicate/rejected paths remain no-effect
- AND a visible crater without paired authority evidence cannot pass.

### Scenario: Adopted crater remains physically traversable
- GIVEN a safe accepted Terrain edit creates a crater inside the admitted dry
  traversal domain
- WHEN Terrain Authority and the matching revision-bound collision snapshot are
  atomically adopted
- THEN the player capsule can enter genuinely empty crater cells through normal
  movement or gravity and grounds on the edited surface
- AND input, step, slope, jump and airborne transitions remain fixed-tick
  responsive while entering and leaving the crater
- AND stale solid cells, slow sinking, sticky damping, repeated depenetration or
  a permanent locomotion rejection cannot occur.
- AND the real pointer-lock route MUST acquire stable grounded support on the
  edited crater floor before this scenario passes; a direct-state unit setup
  that remains contradicted by live `AIRBORNE` evidence is insufficient.

### Scenario: Structural cuts remain responsive and repeatable
- GIVEN the player cuts an Attached Structural Tree until a body detaches
- WHEN hit preflight, damage, transfer, collision/mesh publication and bounded
  rigid-body physics execute
- THEN no accepted cut blocks the browser main thread for seconds
- AND multiple intermediate `Falling` poses are presented on distinct browser
  frames before `Resting`
- AND a later valid hit on the remaining current Attached stump remains
  possible without reload while a hit on the detached body stays typed
  `DetachedBodyImmutable`.

## Requirement: Existing authority and route boundaries
Exactly one `surfacePlay=1` SHALL continue to select Surface Play with priority
over simultaneous Surface Lab/TestBridge flags. Surface Lab remains unchanged
and `window.TestBridge` remains absent.

### Scenario: Authoritative order
- GIVEN a Surface fire action
- THEN Player and Combat recovery update before the authoritative nearest hit
- AND an Attached Structural hit is pure-previewed through edit, support, mass
  and complete collider derivation before whole-batch Physics reservation
- AND a failed preflight emits only `FireRejected`, releases any reservation,
  adds no attempted-shot Energy debit/Heat or damage/edit/collider/body state,
  while earlier deterministic recovery/cooling remains
- AND only a successful preflight publishes `FireAccepted` plus Combat
  events, adopts exactly one Terrain or precomputed Structural CAS transition,
  atomically swaps collision/bodies, then starts body physics on the next tick
- AND Renderer/CSS/HUD remain immutable projections.

## Requirement: Regression and visual acceptance
The revised slice SHALL pair unit/integration/runtime evidence with a player
screenshot matrix and a fresh manual play test.

### Scenario: Screenshot matrix
- GIVEN canonical viewports `1920x1080`, `1440x900`, `1024x768`, `1920x800`
  and failed replay viewports `2000x993`, `1712x1011`
- WHEN spawn, water replay, idle slope, vegetation, target, terrain edit,
  energy low/blocked, tree hit/fall/rest, pointer-lock and failure states are
  captured
- THEN no required UI regions overlap or overflow
- AND visual claims agree with the paired runtime state.

### Scenario: Manual gate
- GIVEN every fresh automated and technical review gate passes
- WHEN the user plays the real route without TestBridge
- THEN only an explicit user acceptance permits task completion, final human
  review, commit and non-force push.
- AND a defect report returns the change to diagnosis without inferring success.
