# ExecPlan: Hestia Unified Adaptive Brick Authority V1

Status: open; Phase 2 proof retained, gate reopened pending Phase 1 baseline; future capability, first slice isolated and production-unwired
Execution: `c757ca664e5a4060b90a5ca665380bb6`
Change: `browser-hestia-first-person-combat-slice-v1`
Worktree: `feature/browser-hestia-first-person-combat-integration-v1`

## Goal

Prove, in ordered and resumable slices, one immutable revisioned Surface-Voxel
Authority for Hestia terrain, Umbrella Trees and vegetation. The snapshot owns
occupancy/density, material, ordered edits/provenance, authority identity,
revision and content hash. Support, fracture/components, LOD, render,
collision, beam queries, mass and physics are deterministic products of that
same revision/hash. The first implementation slice remains isolated and does
not switch the live Coast route.

The proof must preserve existing Adaptive L0-L4 bytes, use the existing worker
queue/gate and 16 MiB batch patterns, and establish measured browser
responsiveness before compatibility cutover.

## Context and source of truth

The binding contract is:

- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/specs/unified-surface-voxel-authority/spec.md`
- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/proposal.md`
- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/design.md`
- `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md`, Task 22

The capability starts only after Task 19 PrepareSeed has fresh Node22 and
installed-Chrome liveness evidence, and after Coast/Lush identity, vertical
band, R09-R13 scope/host-cap corrections produce a manually visible blocky
world. Existing V1 Terrain/Structural behavior is the compatibility baseline.

## Non-goals

- No product implementation in this handoff document and no live-route switch
  before shadow parity and explicit acceptance.
- No global dense 0.125 m leaf volume, full SVO rewrite or planet-scale
  streaming.
- No mandatory WebGPU, OffscreenCanvas, SAB/COOP/COEP or worker-owned
  authority.
- No persistence, new species, city/editor, swimming, economy, multiplayer or
  Coast scope expansion.
- No Presentation-authored placement, support, collision, physics, hidden
  teleport, floating-block correction or velocity-zero correction.
- No new normalizer or parallel terrain-only/tree-only authority model.

## Architecture and contract lock

### Authority versus derived products

The Main Thread owns the canonical authority initially. It accepts commands,
performs revision/CAS checks and publishes exactly one immutable snapshot per
adopted edit. The snapshot binds source identity,
`protocol/schemaVersion`, `derivationAlgorithmVersion`, `materialTableVersion`,
canonical adaptive bricks/cells, finite density, material, ordered
edits/provenance, object/edit revisions and content hash. Commands and complete
derived results carry and are validated against the same three versions before
Main adoption. Tree graphs and Coast generators are authoring
inputs/provenance only after compilation; they cannot independently answer
support, material, collision or physics queries.

Derived products are revision/hash-bound and fail closed when stale:

- support frontier, roots, six-neighbor components and complete fragments;
- mesh and static collision;
- beam queries;
- mass, center of mass and inertia;
- dynamic-body sources and physics representations;
- render batches and LOD products.

Screenshots and Three.js objects are evidence/projection only, never gameplay
truth.

### Adaptive resolution policy

Reuse the existing `16^3` Adaptive hierarchy without changing byte-valid keys or
hashes: `L4=.125 m`, `L3=.25 m`, `L2=.5 m`, `L1=1 m`, `L0=2 m`.

- Ground uses `L2/L3`.
- Trunk, rock and fracture use `L4`.
- Distant products use `L1/L0` and never answer gameplay queries.
- Local `L5=.0625 m` is optional and experimental only: it may be evaluated
  after L0-L4 parity as a measured same-camera A/B for fine vegetation. It is
  not a production level and cannot invalidate an L0-L4 result.

Only uniform `2x2x2` children with equal occupancy, material and structural
class may coalesce. No edit or fracture boundary may be crossed. Neighboring
levels differ by at most one. The coarse side owns the deterministic, blocky
2:1 transition strip sampled from the authority; neither side derives it from
the render mesh.

### Async delta and adoption boundary

Transfer the seed once. Thereafter workers receive typed-array dirty-brick
deltas, not full authority state. Every command/message/result binds authority
ID, predecessor and result revision/hash, worker epoch, cancellation identity
and the protocol/schema, derivation-algorithm and material-table versions.
Workers derive only private products. Main validates the bounded commitments and
atomically adopts one complete result or retains the prior snapshot unchanged.

Reuse the existing `StableWorkerJobQueue` in `src/workers/queue.ts`, worker
lifecycle/cancellation/transfer/release ownership in `src/workers/workerPool.ts`,
typed-array bundle descriptors in `src/workers/protocol.ts`, and result/stale
gates in `src/workers/resultGate.ts`. Queue admission uses
the existing typed decisions `RejectedQueueFull` and `RejectedDuplicateJob`; do
not replace them with a generic rejection. Backpressure is bounded and observable: retain at most
`64 MiB` of result pages, record enqueue/rejection/cancellation/release
telemetry, and prove no starvation, silent worker restart or stale mutation of
a newer revision. An oversized logical delta may continue across 16 MiB pages,
but Main adopts only after the complete logical result is present and validated;
individual pages never become authority. Measure actual dirty-brick bytes; the
current materialized planner estimate is `128 KiB`, so a `64 KiB` claim is
invalid unless new evidence proves otherwise.

### Physics tiers

Use the existing exact `32 m` interaction tier and sleeping/exact `96 m` policy.
Both derive from the same authority revision/hash, including dirty updates and
stale refusal. Adaptive collision representation may reduce derived
Physics/Collision detail, but it cannot change authority support, material,
edit, component, mass or hash truth.

## Exact reuse map

Use these existing owners and patterns before considering any new file or
abstraction:

| Concern | Existing modules/files and search targets |
| --- | --- |
| Adaptive keys, bytes, canonical data and validation | `apps/weltraum-browser/src/voxel/adaptive/{types,coordinates,canonical,validation,immutability}.ts`; search `L0`, `L4`, `brick`, `contentHash` |
| Adaptive planning/materialization/residency | `apps/weltraum-browser/src/voxel/adaptive/{planner,materialization,residency,edits}.ts`; search `128`, `16 MiB`, `dirty`, `journal` |
| Structural authority, CAS, connectivity and hash | `apps/weltraum-browser/src/voxel/structural/{types,model,canonical,commands,validation,connectivity,connectivityDiagnostics,persistence,massProperties,transfer,evidenceArchive}.ts`; search `revision`, `CAS`, `component`, `fragment`, `contentHash` |
| Existing representation ladder | `apps/weltraum-browser/src/voxel/representation/{types,descriptor,selection,policy,interaction,proxy,fallback,validation}.ts`; search `representation`, `coarse`, `interaction`, `fallback` |
| Main worker queue/gates | `apps/weltraum-browser/src/workers/{messages,protocol,queue,resultGate,cancellation,workerPool,workerHandle,streamingWorker}.ts`; search `epoch`, `cancel`, `stale`, `gate`, `queue` |
| Existing Structural preparation seam | `apps/weltraum-browser/src/surface-play/workers/preparedStructuralFire{Protocol,Codec,Wire,Worker,WorkerClient,Scheduler,PageStore}.ts`; search `PrepareSeed`, `ReadyToAdopt`, `RUNNING`, `backpressure` |
| Existing Terrain authority and revision-bound edit path | `apps/weltraum-browser/src/surface-play/voxel-edit/{authority,canonical,collision,remeshPlan,types}.ts`; search `SubtractSphere`, `expectedRevision`, `remesh` |
| Physics and exact/sleeping products | `apps/weltraum-browser/src/surface-play/physics/{surfaceRigidBody,surfaceRigidBodyWorld,surfaceRigidBodyRegistry,surfaceRigidBodySpatialIndex,surfaceRigidBodyResidencyIndex,surfaceRigidBodyIslandScheduler}.ts`; search `32`, `96`, `revision`, `sleep`, `stale` |
| Coast/world and tree shadow owners | `apps/weltraum-browser/src/surface-play/{world,environment}/**/*.ts`, `apps/weltraum-browser/src/world-generation/hestia/*.ts`; search `identity`, `vertical`, `Coast`, `Tree`, `shadow` |
| Three.js projection | `apps/weltraum-browser/src/render/three/{threeRenderBackend,graphicsSettingsAdapter}.ts` and `src/surface-play/environment/hestiaSurfacePresentation.ts`; search `BufferGeometry`, `batch`, `artifact`, `revision` |

Existing focused proof targets to extend rather than duplicate include
`tests/unit/adaptiveMicrovoxelContracts.test.ts`,
`adaptiveMicrovoxelMaterialization.test.ts`, `adaptiveMicrovoxelPlanner.test.ts`,
`structuralMicrovoxelContracts.test.ts`,
`structuralMicrovoxelMassProperties.test.ts`,
`structuralMicrovoxelDetachedTransfer.test.ts`,
`preparedStructuralFireCodec.test.ts`,
`preparedStructuralFireWireCodec.test.ts`,
`preparedStructuralFireScheduler.test.ts`,
`preparedStructuralFireWorkerProtocolGate.test.ts`,
`surfaceRigidBody*.test.ts`,
`hestiaSurfaceWorld*.test.ts`, and
`hestiaStructuralTreePresentation.test.ts`.

Browser proof reuses `tests/e2e/adaptive-microvoxel-authority.spec.ts`,
`hestia-first-person-combat-slice.spec.ts`,
`structural-microvoxel-destruction.spec.ts`,
`spatial-physics-spine.spec.ts`,
`voxel-representation-ladder-v2.spec.ts`,
`ui-concept-parity-v2.spec.ts`, and
`tests/e2e/support/surfacePlayDriver.ts`. Search existing evidence naming for
`R09`, `R10`, `R11`, `R12` and `R13` before adding an artifact.

## Ordered implementation phases and fresh gates

Every phase is sequential. A phase is not complete from a worker report alone:
run its focused tests, deterministic replay and required browser/evidence gate,
record the result, then re-check the dirty-worktree guard before the next phase.

### Phase 1 — Baseline and contract lock

**Targets/search:** the four source artifacts above; Adaptive `L0-L4` key/hash
code; `PrepareSeed`/`client.run`; Coast identity/vertical-band and R09-R13
host-cap paths; existing evidence manifests.

**Tests/evidence:** run focused Adaptive, Structural and prepared-worker unit
tests; run the existing authority and representation E2E tests in installed
Chrome. Record baseline authority/hash parity, worker-start-before-packaging,
dirty payload estimate, frame/Long-Task data, Coast facts and viewport matrix.

**Gate:** the contract sources are unchanged from the handoff record, Task 19
live liveness is green, and the Coast/Lush prerequisite is approved. Otherwise
stop with a blocker and do not create an isolated implementation slice.

### Phase 2 — Isolated mixed-resolution authority fixture

**Exact owned targets:**

- Sources: `apps/weltraum-browser/src/voxel/adaptive/types.ts`,
  `apps/weltraum-browser/src/voxel/adaptive/canonical.ts`,
  `apps/weltraum-browser/src/voxel/adaptive/validation.ts`,
  `apps/weltraum-browser/src/voxel/adaptive/materialization.ts`,
  `apps/weltraum-browser/src/voxel/structural/model.ts`,
  `apps/weltraum-browser/src/voxel/structural/canonical.ts` and
  `apps/weltraum-browser/src/voxel/structural/persistence.ts`.
- Tests: `apps/weltraum-browser/tests/unit/adaptiveMicrovoxelContracts.test.ts`,
  `apps/weltraum-browser/tests/unit/adaptiveMicrovoxelMaterialization.test.ts`
  and
  `apps/weltraum-browser/tests/unit/structuralMicrovoxelContracts.test.ts`.

No other production or test path is owned by Phase 2. Search existing Hestia
density/material and tree-graph inputs only to bind provenance; do not add a
parallel owner.

**Proof:** compile one deterministic mixed fixture into one immutable authority:
ground `L2/L3`, trunk/fracture `L4`, vegetation coverage at every `L0-L4`
level, material/provenance ordering, authority ID, revision and content hash.
The canonical snapshot owns gameplay truth; render, collision, support, mass
and physics are derived products. Main owns the snapshot, command acceptance,
CAS and adoption; any worker owns only private derivation. Bind and validate
equal `protocol/schemaVersion`, `derivationAlgorithmVersion` and
`materialTableVersion` on the snapshot, command and result. Repeat equal inputs
byte-identically and prove production-unwired status with import/caller searches
showing no live Coast/Surface Play route reaches the fixture.

Run Phase 2 from this exact cwd with Node 22:
`C:\IFI_SourceCode\Temp\WeltraumSpiel\.worktrees\Weltraum-Browser-IFIWELTRAUM-000-browser-hestia-first-person-combat-integration-v1\apps\weltraum-browser`

```powershell
node --version
node .\node_modules\vitest\vitest.mjs run tests/unit/adaptiveMicrovoxelContracts.test.ts tests/unit/adaptiveMicrovoxelMaterialization.test.ts tests/unit/structuralMicrovoxelContracts.test.ts
node .\node_modules\typescript\bin\tsc -p tsconfig.json --noEmit
node .\node_modules\vite\bin\vite.js build
Set-Location '..\..'
git diff --check -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
git diff --name-only -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
git status --short --untracked-files=all -- .devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md
```

Record exit codes and all Phase 2 evidence under
`.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/evidence/task-22/phase-2`.

**Gate:** no second authority, no global fine grid, no render/physics fact
outside the snapshot, no public contract mutation, and no live-route import or
caller. Phase 2 is decision-complete; Phase 3 and later remain open until
their own gates pass. Phase 3 is unblocked by the approved named material-rule
record `Hestia Unified Surface Material Rules V1`, which is present and
hash-bound. Failure stops here.

### Phase 3 — Edit, hash, support, fracture and coalescing

**Exact production targets:**

- `apps/weltraum-browser/src/voxel/adaptive/types.ts`,
  `apps/weltraum-browser/src/voxel/adaptive/canonical.ts`,
  `apps/weltraum-browser/src/voxel/adaptive/edits.ts` and
  `apps/weltraum-browser/src/voxel/adaptive/planner.ts`;
- `apps/weltraum-browser/src/voxel/structural/types.ts`,
  `apps/weltraum-browser/src/voxel/structural/canonical.ts`,
  `apps/weltraum-browser/src/voxel/structural/commands.ts`,
  `apps/weltraum-browser/src/voxel/structural/validation.ts`,
  `apps/weltraum-browser/src/voxel/structural/connectivity.ts`,
  `apps/weltraum-browser/src/voxel/structural/massProperties.ts` and
  `apps/weltraum-browser/src/voxel/structural/transfer.ts`.

Search these owners for `half-even`, `CAS`, `support`, `fragment`, `2x2x2`,
`transition strip`, `materialTableVersion` and `materialTableContentHash`.

**Exact test targets:** extend, rather than duplicate,
`apps/weltraum-browser/tests/unit/adaptiveMicrovoxelContracts.test.ts`,
`apps/weltraum-browser/tests/unit/adaptiveMicrovoxelMaterialization.test.ts`,
`apps/weltraum-browser/tests/unit/adaptiveMicrovoxelPlanner.test.ts`,
`apps/weltraum-browser/tests/unit/structuralMicrovoxelContracts.test.ts`,
`apps/weltraum-browser/tests/unit/structuralMicrovoxelCommands.test.ts`,
`apps/weltraum-browser/tests/unit/structuralMicrovoxelConnectivity.test.ts`,
`apps/weltraum-browser/tests/unit/structuralMicrovoxelMassProperties.test.ts`,
`apps/weltraum-browser/tests/unit/structuralMicrovoxelDetachedTransfer.test.ts`
and `apps/weltraum-browser/tests/unit/hestiaStructuralTreePresentation.test.ts`.

**Tests/evidence:** extend the Structural contract, mass, detached-transfer and
Hestia tree tests. Cover supported, undercut, disconnected and overloaded
fixtures; equal edits; stale/duplicate refusal; complete body-source identity;
legal parent coalescing; illegal boundary coalescing; neighbor LOD delta; and
coarse-owned strip bytes. Add half-open coarse-face ownership tests and
lexicographic edge/corner ownership tests at exact seam boundaries and adjacent
cells. Repeat the complete output and hash it. The material tests must assert
the exact raw mappings: Voxel byte `0` `SolidRock` -> `Rock`; Structural
uint16 `0` `Air`; Structural uint16 `1/2/3` are the existing
`Root`/`Wood`/`Canopy` raw IDs and are never equated with Voxel IDs. Derive one immutable table with
`materialTableVersion: hestia.unified-surface-material-rules.v1` and its
canonical `materialTableContentHash`, bind both into snapshot, command and
result commitments, and use the existing canonical owner/`hashAdaptiveCanonical`
hasher. Bridge the
current adaptive table version through that owner, then rerun
`adaptiveMicrovoxelContracts.test.ts`,
`adaptiveMicrovoxelMaterialization.test.ts` and
`structuralMicrovoxelContracts.test.ts` to prove Phase 2 parity before
adoption. The phase is unblocked by the approved record
`docs/browser-mainline/hestia-unified-surface-material-rules-v1.md` with
SHA-256 `900AC600C769C7B0A4312BBD00642230124E842C3C999077141DAB344A531C33`.
Its exact V1 table is the record's `## Approved V1 table`; the gate requires
only density, support-contact capacity, maximum span, explicit anchors,
overload and fracture policy. Cohesion, strength and stress remain deferred;
implementation and evidence remain required, and no material-rule values are
decided by this ExecPlan.

The staged budgets are 8 dynamic bodies total, 64 colliders per body at
admission and 256 contacts per outer simulation tick at the solver stage.
Adaptive continuation/refinement is attempted before final typed whole-result
refusal where existing policy allows; no partial result is published. For each
local cantilever run, effective span is the minimum approved span among all
participating occupied/supporting material groups, and capacity comes from the
supporting-side frontier.

**Gate:** one atomic result or typed refusal only. No partial cells, clipped
collider, floating presentation, hidden teleport, lost edit/fracture boundary
or nondeterministic component/body identity.

### Phase 4 — Dirty-brick worker delta

**Targets/search:** the smallest future production-unwired Adaptive contract
target is `apps/weltraum-browser/src/voxel/adaptive/dirtyDeltaProtocol.ts`; it
owns only the delta schema, typed-array descriptor, and revision/hash/version
validation, reusing Adaptive canonical owners. Do not claim that file exists or
implement it in Phase 4. Reuse the existing generic worker owners
`src/workers/queue.ts`, `src/workers/workerPool.ts`, `src/workers/protocol.ts`,
and `src/workers/resultGate.ts`; search `authorityId`, `predecessorRevision`,
`resultRevision`, `epoch`, `cancel`, `stale`, `backpressure`, `PrepareSeed`.
`src/surface-play/workers/preparedStructuralFire*` remains compatibility/shadow
evidence only until delta parity; the Phase 4 first proof must avoid touching
those untracked files and remain production-unwired.

**Tests/evidence:** for the first proof, extend existing worker/adaptive tests
without touching PreparedFire files. A dedicated
`tests/unit/adaptiveDirtyDeltaProtocol.test.ts` is allowed only if Phase 4
later needs a separate host; otherwise extend the existing worker/adaptive
tests. Reuse `StableWorkerJobQueue` admission and prove its
`RejectedQueueFull`/`RejectedDuplicateJob` decisions, preserving the existing
workerPool lifecycle/cancellation/transfer/release semantics and resultGate
stale/cancel rejection semantics. Prove seed-once/full-state absence,
typed-array dirty deltas, revision/hash commitments, worker restart, bounded
queue and atomic Main adoption. Use 16 MiB pages and a 64 MiB retained cap; an
oversized logical delta may continue/page but adopts only as one complete
validated result. Capture a fresh real-Chrome trace that worker start precedes
packaging.

**Gate:** acknowledgement `<100 ms`, no Main long task `>100 ms`, measured
dirty payload within the existing `16 MiB` batch, and no stale/cancelled result
changes any authority or derived product. Do not proceed on backpressure or
packaging regression.

### Phase 5 — Surface-Lab LOD, seam and optional L5 A/B

**Targets/search:** `src/voxel/representation`, Adaptive materialization and
`src/render/three/threeRenderBackend.ts`; Surface Lab route/tests; search
`BufferGeometry`, batching, `L2`, `L3`, `L4`, `transition strip`, `L5`.

**Tests/evidence:** run the focused representation/materialization tests and
`adaptive-microvoxel-authority.spec.ts` in Surface Lab. Capture same-camera
render A/B evidence for ground L2/L3 and trunk/fracture L4, including a visible
blocky 2:1 seam. Only if those gates are green, measure optional L5 fine
vegetation against L4 for visual gain, memory, worker and collider cost.

**Gate:** render artifacts bind the authority revision/hash but do not answer
gameplay queries. L5 is rejected unless same-camera visual parity improves while
remaining within the `16 MiB` page, `64 MiB` retained-result, `64`-collider,
no Long Task `>100 ms` and `p95 <=250 ms` publication ceilings. Improving
memory, worker or collider cost alone is insufficient; L0-L4 compatibility
remains mandatory.

### Phase 6 — Active physics products

**Targets/search:** `src/surface-play/physics`, voxel representation interaction
and Hestia rigid-body terrain; search `32 m`, `96 m`, `sleep`, `revision`,
`physicsFailure`, `stale`.

**Tests/evidence:** run the focused rigid-body registry/world/spatial/residency/
island tests and `spatial-physics-spine.spec.ts`. Prove exact 32 m interaction,
sleeping/exact 96 m behavior, dirty update adoption, stale refusal, active
contact, intermediate Falling frames and Resting for supported/undercut/
disconnected/overload fixtures.

**Gate:** physics uses the authority revision/hash, remains finite and
deterministic, and never repairs a mismatch in Presentation. No tunneling,
clipping, body duplication, partial tick publication or permanent budget dead
end may pass.

### Phase 7 — Coast/tree shadow migration

**Targets/search:** `src/surface-play/world`, Hestia environment/tree
presentation, Coast generators/adapters and existing `surfacePlayRuntime`;
search `identity`, `verticalBand`, `authorityHash`, `shadow`, `adapter`.

**Tests/evidence:** keep the current Coast route and adapters live. Run Hestia
world/presentation/tree tests and `hestia-first-person-combat-slice.spec.ts`.
Compare old and authority products for identity, vertical band, revision/hash,
LOD, render, collision and physics. Capture fresh R09-R13 scope/host-cap and
visual evidence without changing live ownership.

**Gate:** shadow parity is complete, route behavior is unchanged outside the
approved local authority proof, and all responsiveness metrics remain green.
No cutover follows a screenshot-only or unit-only result.

### Phase 8 — Compatibility cutover and removal

**Targets/search:** `src/surface-play/workers/preparedStructuralFire*`,
`src/surface-play/runtime`/`surfacePlayRuntime.ts`, voxel-edit authority and
their focused tests; search `PreparedFire`, `full-state`, `delta`, `cutover`,
`rollback`.

**Tests/evidence:** after Phase 7 only, adopt the delta path with the prior
snapshot retained as rollback evidence. Run all prepared-worker, authority,
Surface Play integration and representation tests plus the relevant Chrome
route. Remove the old PreparedFire full-state path last, after delta adoption
and parity are recorded.

**Gate:** L0-L4 keys/hashes remain byte-valid; no same-world silent V1/V2
switch, stale mutation, unapproved public contract, or partial publication is
possible. If cutover fails, retain the prior snapshot/path and stop.

### Phase 9 — R09-R13 final parity and closeout evidence

**Targets/search:** existing `ui-concept-parity*.spec.ts`,
`hestia-first-person-combat-slice.spec.ts`, screenshot/evidence conventions,
and all phase manifests; search `R09` through `R13`.

**Tests/evidence:** run the fixed installed-Chrome viewport matrix and repeated
Terrain/Tree cuts, capture screenshots plus authority/revision/hash, LOD,
physics, worker, payload, latency and Long-Task records. Run focused tests,
full browser build/test gates required by the repository after the doc-only
handoff is later implemented, and bind every record to HEAD, source hashes,
algorithm/material versions, command hash, worker epoch, route and viewport.

**Gate:** final visual parity, authority/hash parity, deterministic replay and
all quantitative gates are fresh. User-visible evidence is paired with runtime
truth; screenshots alone cannot close authority, support, physics or async
claims.

## Quantitative gates

All measurements use installed Chrome on the actual target route and retain raw
timing evidence:

- action acknowledgement: `<100 ms`;
- authoritative publication: `p95 <=250 ms`;
- Main validation plus adoption: `p95 <=4 ms`, hard maximum `<=8 ms`;
- no Main-thread Long Task `>100 ms`;
- worker transfer uses the existing `16 MiB` batch/queue/gate ceiling;
- actual dirty-brick bytes are measured per payload; `128 KiB` is the current
  planner estimate and `64 KiB` must not be asserted without evidence;
- optional L5 must improve same-camera visual parity within measured memory,
  worker and collider budgets or it is not admitted.

## Compatibility and cutover rules

The current Coast route/adapters remain authoritative for live behavior until
shadow parity covers identity, vertical band, authority hash, LOD, render,
collision and physics. The first authority fixture is production-unwired.
Cutover is one explicit adoption after parity, with a rollback-safe prior
snapshot. The old PreparedFire full-state path is removed last. Existing V1
behavior remains usable until the delta path is proven; no silent same-world
mode switch is allowed.

## Dirty-worktree guard

Before writing, before each phase, and before final evidence, record:

1. branch, `HEAD` and `git status --short --branch`;
2. SHA-256 for this ExecPlan, `tasks.md`, `proposal.md`, `design.md` and the
   unified `spec.md`;
3. a focused diff/status inventory for those five artifacts.

Reviewed baseline before this doc patch:

| artifact | SHA-256 | status |
| --- | --- | --- |
| `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/tasks.md` | `84AE96D1BEF598B7EAD89008771496C694F3F56D3F77A1B63B9B39F07A29A805` | ` M` |
| `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/proposal.md` | `5A0CDF6280B6D1E7A90594E1C423984C69A0AD8695EDF8DC999068263C98C5AB` | ` M` |
| `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/design.md` | `C2106E459759F35D0CA6995C266A432B1AE4FD07B5CA6BE173B345D8F7E9A766` | ` M` |
| `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/specs/unified-surface-voxel-authority/spec.md` | `D9D2844EABC34172B2E432A5E46F1365E999659079937F2FF997B3E3F6F8B656` | `??` |
| `docs/browser-mainline/hestia-unified-adaptive-brick-authority-v1-execplan.md` | `8548F94F8C5C46753C2BA785C4FB6096B9D3D75DCCF0DE87C1AD0971237E1C94` | `??` |

An untracked (`??`) artifact is not exempt: its recorded hash is the guard.
Preserve all foreign changes. If any source artifact changes, if either
permitted target changes outside its owned Task 22/ExecPlan section, or if a
new conflict appears, stop and report the exact path/hash/status instead of
reconciling, staging, resetting or cleaning it.

## Progress, evidence and decision log

Each phase records: date, HEAD, five artifact hashes, exact commands, exit
codes, focused test names, route/viewport, authority/revision/hash, worker
epoch, payload bytes, timing metrics, evidence paths, decision and next
unblocked phase. A phase remains `[ ]` until its fresh gate passes.

### Progress log

- [ ] Phase 1 — baseline/spec gate.
- [ ] Phase 2 — isolated mixed-resolution authority.
- [ ] Phase 3 — deterministic edit/support/fracture/coalescing.
- [ ] Phase 4 — dirty-brick worker delta.
- [ ] Phase 5 — Surface-Lab LOD/seam and optional L5 A/B.
- [ ] Phase 6 — active 32/96 m physics.
- [ ] Phase 7 — Coast/tree shadow parity.
- [ ] Phase 8 — compatibility cutover and PreparedFire removal.
- [ ] Phase 9 — R09-R13 final parity.

### Decision log

- 2026-08-02 — Handoff plan follows the approved Unified Adaptive Brick
  Authority contract; no implementation or live-route cutover is authorized by
  this document.
- 2026-08-03 — Phase 2 proof was implemented and independently verified, but
  sequential completion remains gated/not complete because Phase 1 Task 19
  liveness and the Coast/R09-R13 prerequisite are not green. Evidence is
  retained under `.devtoolbox/specs/changes/browser-hestia-first-person-combat-slice-v1/evidence/task-22/phase-2`.
- Pending — record any approved material-table values, L5 A/B decision,
  compatibility deviation or contract clarification here before proceeding.

## Stop rules and safe resume

Stop immediately on source/hash drift, a new dirty-worktree conflict, missing
prerequisite approval, second authority, global fine-grid rewrite, lost edit or
fracture boundary, nondeterministic replay, non-finite state, stale mutation,
partial publication, unbounded backpressure, Main Long Task above 100 ms,
failed quantitative gate, Coast parity regression, unapproved public-contract
change or a request to add out-of-scope streaming/GPU infrastructure.

Resume only from the last phase whose evidence and hashes are recorded green.
Re-run that phase's guard and fresh gate; never infer completion from an old
worker report, screenshot, HMR state or changed source hash.

## Definition of Done

- All nine Task 22 subtasks and phases have fresh evidence and remain open until
  the repository's required completion/manual gates authorize closure.
- One authority snapshot is proven for terrain/tree/vegetation with deterministic
  edit, support, fracture, component, hash and provenance behavior.
- L0-L4 compatibility, legal coalescing, one-level seams and measured optional
  L5 policy are proven.
- Dirty typed-array deltas, version/epoch/cancel/stale gates, bounded
  backpressure and atomic adoption are proven within the 16 MiB batch.
- 32 m and 96 m physics products bind the same revision/hash and remain active,
  deterministic and fail-closed.
- Coast/tree shadow parity, cutover/removal and R09-R13 visual/performance
  parity are explicitly evidenced.
- No full SVO, WebGPU, SAB or planet-scale streaming was introduced, and no
  implementation code, package, service, browser run or DevToolbox API call is
  implied by this documentation handoff.
