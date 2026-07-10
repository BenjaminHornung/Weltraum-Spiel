# Browser Multi-Obstacle 2500 m Execution Fix v1

## Problem

The deterministic `multi-rock-field-2500m` locked route preserves its plan hash and obstacle clearance but diverges near the terminal handoff with `OffLockedRoute`. The equivalent 1000 m multi-rock route passes.

## Outcome

Identify the trace-proven root cause and implement a general executor/navigation correction so the 2500 m route arrives physically while strict off-route detection, terminal capture, route locking, no-silent-replan behavior, obstacle clearance, and plan-hash stability remain intact.

## Scope

- Deterministic reproduction and focused segment-handoff trace evidence.
- Browser flight/navigation core, scenario harness/course classification, focused unit and Playwright coverage, and evidence artifacts.
- Classification changes only after all required positive and negative gates pass.

## Non-goals

- UI, layout, rendering, CSS, screenshots, runtime command surfaces, Unity Assets, or dependency/lockfile changes.
- Course-specific constants, target-specific branches, global divergence loosening, physics shortcuts, replanning, obstacle/course reduction, terminal-gate loosening, or max-tick-only fixes.
