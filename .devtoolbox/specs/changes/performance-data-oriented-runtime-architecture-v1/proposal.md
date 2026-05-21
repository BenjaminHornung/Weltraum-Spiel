# Proposal: Data-Oriented Runtime Architecture v1

## Why

Recent profiling of combat/flight loops shows multiple hot paths still operate through object-centric state reads, ad-hoc temporary collections, and per-call `GetComponent`/object discovery patterns. As fire rates, target counts, and simultaneous ship activity increase, these patterns amplify CPU spikes and make a later Job/Burst migration brittle.

This change starts an explicit runtime architecture pass so high-frequency simulation remains deterministic, cache-friendly, and ready for incremental parallelization without changing gameplay behavior.

## Outcome

The runtime should become split into:

- A stable **main-thread orchestration boundary** for Unity API calls and mutable object ownership.
- A family of **data snapshots** that provide contiguous, deterministic input views for performance-critical work.
- Explicit **main-thread vs job-thread rules** so each operation moves only when it is Burst/job-safe.
- A clear **phased migration strategy**: safe refactors first, then staged Job System/Burst adoption.

## Scope

- Add and document data-oriented snapshot models for runtime-critical loops.
- Add explicit data-model specs for projectile simulation records and target registry entries.
- Introduce snapshot-driven dirty-flag contracts for camera and RCS cache application boundaries.
- Define job-ready guardrails for safety and refactor order.
- Define acceptance criteria for hotpath correctness, bounded allocations, and migration readiness.
- Add safe first runtime hooks and project documentation that make the next Job/Burst migration step reviewable without changing gameplay behavior.

## Non-Goals

- Full Burst implementation in this pass.
- Gameplay redesign or balancing changes.
- Network protocol changes.
- Unity pipeline/renderer refactors unrelated to runtime scheduling.
- DOTS/ECS conversion.
- Running Unity APIs from worker threads.

## Success Criteria

- The hot path is documented end-to-end as snapshot-driven and mostly allocation-free.
- Main-thread side effects are isolated behind explicit apply boundaries.
- Data models are named, versioned, and use deterministic ownership semantics.
- Phased migration criteria are clear enough to gate future implementation tasks.
- Specs are present for:
  - runtime snapshots,
  - projectile simulation data model,
  - target registry data model,
  - camera and RCS dirty-flag caches,
  - job-system readiness,
  - main-thread vs job-thread boundaries.
