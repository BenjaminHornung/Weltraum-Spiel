# Design: Data-Oriented Runtime Architecture v1

## Baseline Hotpath Analysis

The first migration step is to document current hot-path behavior, not re-architect it blindly.

### Current hotpath categories

- Projectile fire + impact evaluation.
- Target registry lookups used for hit filtering and status checks.
- RCS/control/visual feedback reads that are currently pulled repeatedly from mutable component graphs.
- Camera-facing state updates that can run without full scene scans.

### Anti-patterns to remove before parallel execution

- Repeated scene/object discovery in hot loops.
- Mixed ownership data and temporary containers allocated per frame.
- Runtime writes performed directly inside simulation logic that is intended for worker threads.
- Implicit threading assumptions in gameplay scripts without explicit apply boundaries.

## Core Design

### 1) Snapshot-first runtime

Introduce explicit snapshot layers that represent per-frame read sets consumed by runtime workers.

- `RuntimeDataSnapshot` captures stable scalar fields for each participating entity per frame.
- `RuntimeDataPatch` captures only changed fields needed by downstream systems.
- Snapshot IDs include versioning to prevent stale read/write races.

Rules:

- Snapshots are immutable for the duration of a frame step.
- Snapshot construction stays on the main thread and writes only plain structs/arrays.
- Runtime workers receive `NativeArray`-style contiguous views in later phases.

### 2) Main-thread boundary contract

The following operations must stay on main thread:

- UnityEngine object/Transform reads that are not explicitly copied into snapshot fields.
- Component enable/disable and GameObject hierarchy writes.
- Any API not guaranteed Burst-safe or job-safe.
- Camera update calls and render-adjacent side effects.

The following operations may move to job threads when readiness criteria are satisfied:

- Transform-delta integration into numeric simulation models.
- Projectile/collision prefilter loops and broad numeric evaluation.
- Target scoring/filter passes over blittable arrays.
- Dirty-flag propagation and compact event emission.

### 3) Data model strategy

#### runtime-data-snapshots

- Define contiguous arrays indexed by runtime participant IDs.
- Store only blittable fields required by hot-path math.
- Include optional `Version` token to invalidate/refresh stale data.

#### projectile-simulation-data-model

- Separate request, active record, and impact result structs.
- Keep owner/target references as stable IDs, not direct `Component` references in worker inputs.
- Use fixed-capacity capacities and explicit overflow counters in initial phase.

#### target-registry-data-model

- Create a normalized registry keyed by stable target IDs.
- Store:
  - `RootId`
  - `TransformId`
  - `LayerMask/TeamTags` bit fields
  - `ColliderProfile`
  - `TargetState` and revision stamp

#### camera-rcs-cache-dirty-flags

- Maintain dirty flags for fields that feed camera and RCS calculations.
- Only recompute caches for dirty partitions when changed inputs arrive.
- Ensure cache reads are version-checked and fall back to last-applied snapshot.

### 4) Phased Job/Burst migration (incremental only)

- **Phase 0: safe refactors (no jobs)**  
  Introduce snapshot boundaries, immutable frames, and dirty-flag contracts while keeping execution on main thread.

- **Phase 1: read-only parallel prep**  
  Convert pure functions that use only blittable snapshot data into burst-compatible jobs.

- **Phase 2: bounded parallel workers**  
  Move selected hot loops (projectile stepping, target filtering) into scheduled jobs with explicit completion and merge points.

- **Phase 3: end-to-end apply phase**  
  Introduce batched main-thread apply passes for required Unity API writes and deterministic event commit.

### 5) Acceptance envelope

- Hot paths should be auditable via spec-driven behavior checks.
- No unbounded temporary allocations in the documented hot path.
- Clear separation between simulation state mutations and apply-side effects.
- Forward migration can be gated by this criteria set:
  - snapshots are in use,
  - data models are blittable,
  - task boundaries are explicitly mapped,
  - dirty flags prevent redundant recomputation,
  - at least one end-to-end worker path is represented in specs.

## Risks and constraints

- Over-aggressive parallelization can add synchronization overhead that masks gains.
- Snapshot freshness and stale handles must be treated as correctness-sensitive.
- Some Unity APIs cannot be jobified and still require main-thread batching.
- The architecture should prioritize correctness and migration safety over speculative optimization.
