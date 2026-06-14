# Proposal: Autopilot Proving Ground Harness v1

## Problem

The waypoint autopilot has focused regression coverage, but live navigation still lacks objective gameplay-quality proof. Current tests often accept loose arrival near a target and do not consistently expose overshoot, wandering, terminal reacquire, or brake/flip/re-acceleration failures.

## Outcome

Create a deterministic PlayMode proving-ground harness that runs a fixed scenario matrix, records per-step navigation metrics, writes CSV/JSON/markdown evidence, and fails when precise point-arrival quality is unacceptable.

## Scope

- Programmatic PlayMode proving-ground harness for waypoint-autopilot scenarios.
- Per-scenario CSV traces and suite-level JSON/markdown reports.
- Strict v1 pass/fail thresholds for point arrival, final speed, angular speed, safety replans, terminal state, and post-brake re-acceleration.
- Read-only autopilot diagnostics needed to measure terminal/brake ownership.

## Non-Goals

- Autopilot behavior fixes.
- Threshold relaxation to make current behavior pass.
- Manual Game View observation or scene-only validation.
- New player-facing UI.

## Evidence

Evidence is stored under `.devtoolbox/specs/changes/autopilot-proving-ground-harness-v1/tests/`.
