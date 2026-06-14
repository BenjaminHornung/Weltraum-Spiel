# Proposal

## Change
`prototype-ship-builder-modular-parts-art-pipeline-v1`

## Goal
- Create a planning-only contract and documentation package for modular ship-builder art parts.
- Define a concrete v0 catalog with 8 categories and 3-4 variants each.
- Define Blender MCP generation, naming, marker, and validation conventions.
- Define the import/binder and catalog metadata workflow for later implementation.

## Motivation
- Current ship-builder part work is fragmented across partial notes and informal conventions.
- Existing socket types (`Hardpoint`, `MainThrusterNozzle`, `MainThrusterGimbalPivot`, `RcsNozzle`, `WeaponMuzzle`, `TurretYawPivot`, `TurretPitchPivot`, `VisualOnly`) and direction enums are known, but the asset pipeline contract is not fully formalized.
- The previous ad hoc style causes importer ambiguity and marker fallback behavior.

## Outcomes for this change
- A complete planning document at `docs/spielkonzept/ship-builder-modular-parts.md` with explicit v0 catalog entries.
- Blender authoring standard in `docs/art/blender-modular-ship-parts-guidelines.md`.
- Blender MCP generation and validation prompts in `docs/art/blender-mcp-part-generation-prompts.md`.
- A planner-ready DevToolbox package for the exact change path:
  - `proposal.md` filled with intent and non-goals
  - `design.md` with full pipeline and risks
  - `tasks.md` with phase plan and implementation gates
  - `specs/ship-builder-modular-parts/spec.md` with executable testable requirements

## Scope
- Documentation and planning only.
- No runtime code, scenes, prefabs, import scripts, or tests in this change.
- No Unity, FBX, Blender, or `.asset` binary generation in this change.
- No changes to `Assets/**` content.

## Non-goals (explicitly blocked to future implementation)
- No new mesh, prefab, material, animation, or scene file creation.
- No runtime balancing math or gameplay tuning code in this change.
- No Unity binder import execution and no test execution.
- No `Assets/Art` or runtime package updates.

## Blockers and risks captured for later slices
- Runtime binder schema gaps for `THRUST_NOZZLE_MAIN*` aliases may require one compatibility slice.
- Existing VFX naming in content may need temporary mapping if artists keep legacy naming.
- Import and gameplay validation tooling may need additional strictness to enforce marker-required failure states.
