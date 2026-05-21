# Performance Runtime Architecture (v1)

## Current hotpaths

- SimpleFollowCamera visual bounds
  - Per-frame conversion from viewport bounds to world space for UI and culling.
  - Current source of allocations from repeated mesh/bounds helpers when camera state changes.
- RcsThrusterController nozzle refresh/allocation
  - Frequent allocation or list rebuild around nozzle selection, force mapping, and debug reads.
- Projectile simulation
  - Movement and hit candidates are evaluated per projectile each frame with tight math loops and shared lookups.
- Weapon target discovery
  - Target registries are searched repeatedly, often by hierarchy/object graph traversal and component lookups.
- Autopilot path and obstacle logic
  - Candidate path checks and obstacle filtering still rely on main-thread Unity physics queries, but Navigation Computer v2 keeps obstacle registration cached and moves candidate scoring/prediction into plain data helpers.
- Minimap and sensor data
  - Broad scan of world objects/containers to produce contact and icon updates for minimap and sensors.
- Debug UI diagnostics
  - Runtime reads and formatting are interwoven with simulation state, increasing per-frame CPU pressure.

## Layered architecture

The system is split into four layers with clear hand-off points.

- Unity Scene Layer
  - Owns all `GameObject`/`Component` state and user-visible scene behavior.
  - Converts scene state into plain runtime records during build or when dirty flags change.
  - Owns all non-blittable side effects (Transform writes, particle/spawn/despawn, renderer state).
- Runtime Data Layer
  - Holds blittable snapshots of mutable simulation inputs:
    - `ProjectileData`, `TargetData`, `ShipRuntimeState`, `RcsNozzleData`, `TrajectoryCandidateData`, `SensorContactData`, `CameraVisualBoundsData`.
  - Uses stable IDs, version stamps, and dirty flags.
  - No Unity object references in job inputs.
- Simulation Systems
  - Pure numeric computation over contiguous data arrays.
  - Uses jobs/Burst where safe.
  - Produces deterministic delta patches and candidate lists only.
- Apply Layer
  - Main-thread patch application to Unity APIs.
  - Applies movement results, damage impacts, target highlighting, RCS visual state, UI counters, and debug text.

## Main thread vs job candidates

- Must remain on main thread
  - Any `Transform`, `GameObject`, `Renderer`, `Rigidbody`, `Collider`, physics query, `Instantiate`, `Destroy`, `GetComponent`, `GetComponentsInChildren` calls.
  - Scene hierarchy mutation, enabling/disabling components, and all API calls not explicitly burst-safe.
  - Any read/write against non-thread-safe object graph state.
- Can move to jobs/Burst after data snapshot pass
  - Projectile movement integration, hit-scan prefilter scoring, and candidate filtering.
  - Target scoring and ranking math.
  - Path candidate cost evaluation, trajectory segment scoring, and colliderless obstacle distance math for autopilot.
  - Minimap/sensor filtering math and thresholding using primitive/struct data.
  - RCS allocator math where using local numeric arrays (phase 6 optional).

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
- Normal `UnityEngine.Physics` methods

Only plain data math is allowed in jobs.
The main thread is responsible for building input snapshots and applying outputs.

## Data models

- `ProjectileData`
  - `int ProjectileId`
  - `int OwnerShipId`
  - `float3 Position`
  - `float3 Velocity`
  - `float Speed`
  - `float RangeRemaining`
  - `float LifeTime`
  - `int TargetId`
  - `int LayerMask`
  - `int HitState` (enum as int)
  - `uint Version`
- `TargetData`
  - `int TargetId`
  - `float3 Position`
  - `float3 Velocity`
  - `float Radius`
  - `int Team`
  - `int Priority`
  - `int SensorFlags`
  - `uint ActiveVersion`
- `ShipRuntimeState`
  - `int ShipId`
  - `float3 Position`
  - `float3 Forward`
  - `float3 LinearVelocity`
  - `float3 AngularVelocity`
  - `float Energy`
  - `float Health`
  - `float Shield`
  - `float3 Destination`
  - `int AutopilotState`
  - `uint Version`
- `RcsNozzleData`
  - `int ShipId`
  - `int NozzleIndex`
  - `float3 LocalDirection`
  - `float MaxForce`
  - `float Heat`
  - `float Efficiency`
  - `float CurrentDemand`
  - `int DirtyMask`
  - `uint Version`
- `TrajectoryCandidateData`
  - `int ShipId`
  - `int CandidateIndex`
  - `float3 TargetPoint`
  - `float3 VelocityBias`
  - `float DistanceScore`
  - `float ObstaclePenalty`
  - `float FuelPenalty`
  - `float SafetyScore`
  - `float BrakeFeasibility`
  - `float RcsAuthorityMargin`
  - `uint Version`

## Navigation Computer v2 runtime notes

`PrototypeObstacleDetector` keeps Unity physics queries on the main thread. The v2 detector adds a start-overlap pass with `Physics.OverlapSphereNonAlloc`, then uses `SphereCastNonAlloc` and a registry-backed colliderless fallback. The registry avoids per-frame `FindObjectsByType<PrototypeNavigationObstacle>` scans; tests can clear or refresh it deterministically.

`PrototypeTrajectoryPlanner` is still managed C# rather than Burst, but its candidate inputs and outputs are plain structs and arrays: candidates, burn plan, predicted path, segment diagnostics, and score records. That keeps the current prototype readable while preserving a migration path where candidate scoring and prediction can move behind a snapshot/job boundary later. The autopilot itself consumes only the selected plan and sends physical `FlightAssistRequest` values; it does not write Rigidbody state directly.
- `SensorContactData`
  - `int SensorId`
  - `int TargetId`
  - `float3 ContactPosition`
  - `float Distance`
  - `float SignalStrength`
  - `int Flags`
  - `uint Version`
- `CameraVisualBoundsData`
  - `int CameraId`
  - `float3 Origin`
  - `float2 LeftRight`
  - `float2 TopBottom`
  - `float Near`
  - `float Far`
  - `uint DirtyFrame`

## Phased migration

- Phase 1 - cache and dirty flags
  - Add dirty tracking at scene->snapshot boundaries.
  - Build/refresh snapshots only when input fields change.
  - Remove repeated hierarchy scans in steady state.
- Phase 2 - projectile movement and hitscan candidates
  - Move movement integration and candidate prefilter math into burst-ready jobs.
  - Keep final hit validation and effects in main-thread apply layer.
- Phase 3 - target scoring
  - Move target ranking/filter passes to jobs over `TargetData` and `ShipRuntimeState`.
  - Ensure deterministic ties and stable ordering in patches.
- Phase 4 - autopilot trajectory candidates
  - Generate trajectory candidates in jobs from snapshot inputs.
  - Main thread only applies selected course correction and state transition.
- Phase 5 - sensor/minimap filtering
  - Convert minimap and sensor source data to `SensorContactData`.
  - Apply thresholding, cull, and aggregation in data systems; apply final icons/text only in scene layer.
- Phase 6 - optional RCS allocator math
  - Move nozzle demand allocation and clamp math to jobs if model remains blittable.
  - Keep nozzle component activation and exact force application in apply layer.

## Performance budget

- No steady-state scene hierarchy scans in hot path execution loops.
- No `Instantiate` or `Destroy` during projectile, target, camera, or RCS hot loops.
- No per-frame allocations in projectile/target/camera/RCS simulation pipelines.
- Jobs must perform data math only; all Unity-engine object side effects stay in apply layer.
- Snapshot/patching must be fixed-size or pooled where possible, with no per-frame growth.

## Local Unity docs verified

- `E:\Unity\Documentation\en\Manual\job-system-overview.html`
- `E:\Unity\Documentation\en\Manual\job-system-thread-safe-types.html`
- `E:\Unity\Documentation\en\Manual\job-system-native-container.html`
- `E:\Unity\Documentation\en\ScriptReference\Rigidbody.AddForce.html`
- `E:\Unity\Documentation\en\ScriptReference\Component.GetComponentsInChildren.html`
