# Tasks: docking-physics-system

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Implementation
- [x] Inspect existing physics core and flight-assist paths through Unity MCP
- [ ] Define DockingPort data/component
- [ ] Add relative state calculation
- [ ] Add eligibility checks and diagnostics
- [ ] Add optional soft-capture force/torque request
- [ ] Add simple hard-lock prototype using a joint or documented placeholder
- [ ] Update README and physics docs

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Verify angle, distance, and velocity rejection cases
- [ ] Verify soft capture requests are bounded
- [ ] Verify hard lock only occurs when constraints pass
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
