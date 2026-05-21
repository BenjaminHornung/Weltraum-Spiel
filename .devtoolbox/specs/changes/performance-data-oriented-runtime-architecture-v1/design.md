# Design: Data-Oriented Runtime Architecture v1

## Baseline hotpath targets

The following systems are the performance-critical baseline and must be represented in the new data flow:

- SimpleFollowCamera visual bounds and diagnostic reads.
- RcsThrusterController nozzle refresh/allocation behavior.
- Projectile simulation and hit evaluation.
- Weapon target discovery and target registry reads.
- Autopilot path and obstacle logic.
- Minimap and sensor data generation.
- Debug UI diagnostics and status lines.

## Layered architecture

### 1) Unity Scene Layer
- Owns all `GameObject` and `Component` state.
- Responsible for scene object writes, render updates, hierarchy operations, and transform side effects.
- Owns non-serializable references and event hooks.

### 2) Runtime Data Layer
- Stores frame-consistent runtime structs:
  - `ProjectileData`
  - `TargetData`
  - `ShipRuntimeState`
  - `RcsNozzleData`
  - `TrajectoryCandidateData`
  - `SensorContactData`
  - `CameraVisualBoundsData`
- Uses stable IDs, version stamps, and dirty masks.
- Provides immutable read slices for Simulation Systems during a frame step.

### 3) Simulation Systems
- Pure, deterministic numeric systems over blittable arrays.
- Burst-compatible candidates for:
  - projectile movement / candidate filtering
  - target scoring
  - trajectory and obstacle scoring
  - sensor and minimap filtering
  - optional RCS allocator math
- Emits compact `RuntimeDataPatch` style events.

### 4) Apply Layer
- Main-thread patch application and event commit.
- Applies results to Unity scene graph, physics side effects, and UI.
- Enforces patch order and deterministic side effects.
- Converts patches into `Transform`, `Component`, and diagnostic updates.

## Main-thread vs job/Burst boundaries

### Must stay on main thread
- `Transform`, `GameObject`, `Renderer`, `Rigidbody` access.
- `GetComponent`, `GetComponentsInChildren`, `Instantiate`, `Destroy`.
- Unity Physics API calls and any non-thread-safe object query/write.
- Scene hierarchy mutation and direct object lifecycle work.

### Can move to jobs/Burst
- All data-first computations in listed hot paths.
- `SimpleFollowCamera` bounds math and camera filter calculations over blittable data.
- `RcsThrusterController` nozzle scoring/math when using local numeric data.
- Projectile movement and hit scan prefilter passes.
- Weapon target scoring and threat ranking.
- Autopilot trajectory candidate scoring.
- Sensor/minimap threshold and aggregation math.

### Snapshot + apply rule
- Main thread builds snapshots and validates dirty masks.
- Jobs consume snapshots only.
- Main thread applies patches after completion.

### Unity API restrictions in jobs
Jobs/Burst code must not call:

- `Transform`
- `GameObject`
- `Renderer`
- `Rigidbody`
- `GetComponent`
- `GetComponentsInChildren`
- `Instantiate`
- `Destroy`
- normal `UnityEngine.Physics` methods

Only plain data math is allowed in jobs.

## Data models

- `ProjectileData`
  - `ProjectileId`
  - `OwnerShipId`
  - `Position`
  - `Velocity`
  - `Speed`
  - `RangeRemaining`
  - `LifeTime`
  - `TargetId`
  - `LayerMask`
  - `HitState`
  - `Version`
- `TargetData`
  - `TargetId`
  - `Position`
  - `Velocity`
  - `Radius`
  - `Team`
  - `Priority`
  - `SensorFlags`
  - `ActiveVersion`
- `ShipRuntimeState`
  - `ShipId`
  - `Position`
  - `Forward`
  - `LinearVelocity`
  - `AngularVelocity`
  - `Energy`
  - `Health`
  - `Shield`
  - `Destination`
  - `AutopilotState`
  - `Version`
- `RcsNozzleData`
  - `ShipId`
  - `NozzleIndex`
  - `LocalDirection`
  - `MaxForce`
  - `Heat`
  - `Efficiency`
  - `CurrentDemand`
  - `DirtyMask`
  - `Version`
- `TrajectoryCandidateData`
  - `ShipId`
  - `CandidateIndex`
  - `TargetPoint`
  - `VelocityBias`
  - `DistanceScore`
  - `ObstaclePenalty`
  - `FuelPenalty`
  - `SafetyScore`
  - `Version`
- `SensorContactData`
  - `SensorId`
  - `TargetId`
  - `ContactPosition`
  - `Distance`
  - `SignalStrength`
  - `Flags`
  - `Version`
- `CameraVisualBoundsData`
  - `CameraId`
  - `Origin`
  - `LeftRight`
  - `TopBottom`
  - `Near`
  - `Far`
  - `DirtyFrame`

## Phased migration plan

- Phase 1 - cache and dirty flags
  - Add dirty tracking for hotpath entry points.
  - Build snapshots only when source fields change.
  - Remove steady-state hierarchy scans in simulation loops.
- Phase 2 - projectile movement / hitscan candidates
  - Move movement integration and hit-candidate prefilter into job-ready paths.
  - Keep authoritative impact checks in apply layer.
- Phase 3 - target scoring
  - Move target ranking and filtering to jobs over `TargetData`.
  - Keep deterministic winner selection and tie handling deterministic.
- Phase 4 - autopilot trajectory candidates
  - Generate candidate trajectories in parallel data systems.
  - Apply only one chosen trajectory per frame in scene layer.
- Phase 5 - sensor/minimap filtering
  - Use numeric contact filtering and culling for minimap/sensor outputs.
  - Apply final contact set changes to UI and scene markers on main thread.
- Phase 6 - optional RCS allocator math
  - Move allocator math and nozzle force budgeting to data path.
  - Keep nozzle enablement and force application in main thread.

## Performance budget and anti-regressions

- No steady-state hierarchy scans in hotpath loops.
- No `Instantiate` / `Destroy` in projectile, target, camera, or RCS hotpath.
- No per-frame allocations in projectile, target, camera, or RCS runtime paths.
- Jobs are restricted to data math.
- Snapshot/pool sizing avoids per-frame list growth.
- Main-thread apply handles all Unity object interactions.

## Reference documents checked locally

- `E:\Unity\Documentation\en\Manual\job-system-overview.html`
- `E:\Unity\Documentation\en\Manual\job-system-thread-safe-types.html`
- `E:\Unity\Documentation\en\Manual\job-system-native-container.html`
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`
- `E:\Unity\Documentation\en\ScriptReference\Component.GetComponentsInChildren.html`

## Risks and constraints

- Snapshot drift and stale handles are correctness risks and must be guarded by version checks.
- Over-partitioning can increase scheduling overhead and reduce performance.
- Gameplay behavior parity is required before widening job use.
- Unity object APIs in jobs are a hard boundary and are not allowed.
