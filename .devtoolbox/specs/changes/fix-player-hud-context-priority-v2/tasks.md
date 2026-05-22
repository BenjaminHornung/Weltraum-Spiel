# Tasks

## Phase 1: Spec and Preflight
- [x] Create the DevToolbox change with context-priority requirements.
- [x] Inspect current HUD/bootstrap behavior and capture the relevant code paths before editing.

## Phase 2: HUD Context Fix
- [x] Prevent bootstrap-created docking targets from forcing the player HUD into docking context by default.
- [x] Gate docking snapshot visibility to selected/routed docking relevance instead of source+target existence.
- [x] Reorder the context panel priority to Critical > Combat > Docking > Navigation > Objective > Nominal.
- [x] Move arena objective/progress out of ship systems and into a separate objective panel.

## Phase 3: Layout and Regression Tests
- [x] Add/adjust editor tests for docking gating, context priority, objective separation, and no HUD window overlap.
- [x] Verify generated player HUD recreation remains stable after the objective panel is added.

## Phase 4: Verification and Evidence
- [x] Run focused dotnet/Unity validation for the modified scripts and HUD tests.
- [x] Capture fresh Unity screenshot evidence for the player HUD context/layout.
- [x] Document verification under this change's `tests/` folder.
- [ ] Commit and push relevant changes without staging unrelated dirty workspace files.
