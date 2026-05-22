# Tasks: trajectory-preview-burn-planner

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect shared physics formulas and gravity/fuel availability through Unity MCP
- [x] Define lightweight prediction state
- [x] Add bounded fixed-step predictor
- [x] Add debug trajectory output or gizmo placeholder
- [x] Add burn plan data shape
- [x] Compare prediction against short real simulation
- [x] Document included/excluded forces

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify bounded prediction returns finite states
- [x] Verify gravity-only prediction matches short simulation tolerance
- [x] Verify burn plan estimates direction/duration/throttle/fuel
- [x] Add test evidence under this spec
- [x] Commit implementation with spec title and changelog
