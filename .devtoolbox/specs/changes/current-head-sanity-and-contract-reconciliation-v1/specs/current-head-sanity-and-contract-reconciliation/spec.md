# Capability: Current HEAD Sanity and Contract Reconciliation

## Requirements

- The current HEAD SHALL be validated with the repository-authoritative solution
  build/test commands or blockers SHALL be documented.
- Unity MCP validation SHALL only be treated as valid if the active Unity
  instance is bound to this checkout.
- Package/tooling status SHALL identify Cinemachine, ProBuilder, VFX Graph,
  Roslyn DLLs and AI Navigation.
- Autopilot V2 Phase 1 contract tasks SHALL only be checked off when runtime
  contract types and tests already exist.
- Planner and executor implementation tasks SHALL remain open in this slice.
- The DTO class-vs-struct decision SHALL be documented without changing code when
  the current immutable implementation is valid and tested.
- Status Authority AutopilotTelemetry mapping SHALL remain open until a
  clean-core AutopilotTelemetry source contract exists.
- The final working tree SHALL have no Prototype, scene, prefab, material or
  unintended ProjectSettings changes from this sanity slice.

## Scenarios

- When the solution build and tests pass, the evidence protocol records the
  command result, warning scope and HEAD commit.
- When Unity MCP is available and points to this checkout, the evidence protocol
  records refresh/console and focused EditMode results.
- When Unity or package tooling creates side effects, the final guardrail checks
  record whether those side effects were removed or remain as blockers.
