# Proposal: Current HEAD Sanity and Contract Reconciliation v1

## Problem

Recent runtime, package and tooling commits changed the project baseline before
the next gameplay implementation slice. The repository needs a small sanity pass
to verify the current HEAD, reconcile stale DevToolbox contract metadata, and
record package/tooling evidence without changing gameplay code or scenes.

## Goal

- Validate the current HEAD with solution build/test and Unity-focused evidence.
- Document the package/tooling state for Cinemachine, ProBuilder, VFX Graph,
  Roslyn DLLs and AI Navigation.
- Reconcile Autopilot V2 Phase 1 contract task checkboxes only where existing
  runtime contracts and tests provide evidence.
- Document the DTO shape decision: immutable sealed class contracts are accepted;
  no broad readonly-struct code conversion is required.
- Confirm Status Authority telemetry mapping remains intentionally open until a
  clean-core AutopilotTelemetry source contract exists.

## Scope

- Documentation, DevToolbox tasks, specs and test protocols only.
- No gameplay implementation.
- No planner/executor algorithms.
- No Prototype, scene, prefab, material, asset or intentional ProjectSettings
  changes.
