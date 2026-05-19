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
- [ ] Add bounded fixed-step predictor
- [ ] Add debug trajectory output or gizmo placeholder
- [ ] Add burn plan data shape
- [ ] Compare prediction against short real simulation
- [ ] Document included/excluded forces

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify bounded prediction returns finite states
- [ ] Verify gravity-only prediction matches short simulation tolerance
- [ ] Verify burn plan estimates direction/duration/throttle/fuel
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
