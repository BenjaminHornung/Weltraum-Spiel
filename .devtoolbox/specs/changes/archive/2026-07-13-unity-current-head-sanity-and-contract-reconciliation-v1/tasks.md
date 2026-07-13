# Tasks: Current HEAD Sanity and Contract Reconciliation v1

## Phase 1: Sanity Evidence

- [x] Read mandatory repository, package, contract and spec context.
- [x] Validate current HEAD with solution build/test.
- [x] Validate Unity MCP checkout, console state and focused EditMode tests.
- [x] Record package/tooling baseline for Cinemachine, ProBuilder, VFX Graph,
  Roslyn DLLs and AI Navigation.

## Phase 2: Metadata Reconciliation

- [x] Reconcile Autopilot V2 Phase 1 contract tasks using only existing runtime
  and test evidence.
- [x] Keep Autopilot planner/executor tasks open.
- [x] Document the immutable sealed class DTO decision in the Autopilot V2
  implementation plan.
- [x] Confirm Status Authority AutopilotTelemetry mapping remains open because
  the clean-core source contract does not exist yet.

## Phase 3: Guardrails

- [x] Create `tests/test-protocol.md` with HEAD, validation, package and scope
  evidence.
- [x] Verify no `Assets/Scripts/Prototype` changes.
- [x] Verify no `.unity`, `.prefab`, `.mat` changes.
- [x] Verify no unintended `ProjectSettings` changes remain.
