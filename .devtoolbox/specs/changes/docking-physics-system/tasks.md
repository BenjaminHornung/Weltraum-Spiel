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
- [x] Define DockingPort data/component
- [x] Add relative state calculation
- [x] Add eligibility checks and diagnostics
- [x] Add optional soft-capture force/torque request
- [x] Add simple hard-lock prototype using a joint or documented placeholder
- [x] Update README and physics docs

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Verify angle, distance, and velocity rejection cases
- [x] Verify soft capture requests are bounded
- [x] Verify hard lock only occurs when constraints pass
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
