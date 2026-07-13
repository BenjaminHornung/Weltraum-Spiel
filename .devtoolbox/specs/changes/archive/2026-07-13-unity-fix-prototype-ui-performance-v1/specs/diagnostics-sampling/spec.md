# Diagnostics Sampling

## Requirements

### Requirement: Diagnostics are sampled instead of rebuilt every repaint

Prototype diagnostic UI SHALL separate state collection from IMGUI drawing so that expensive diagnostics are sampled at a bounded cadence.

#### Scenario: Fast HUD diagnostics

- WHEN the HUD is visible and expanded
- THEN fast flight values SHALL update at most once per frame
- AND repaint-only calls SHALL reuse the cached HUD view model for the same frame

#### Scenario: Heavy debug diagnostics

- WHEN advanced diagnostics are open
- THEN heavy diagnostic snapshots SHALL be refreshed no more frequently than every 0.1 to 0.25 seconds
- AND draw code SHALL reuse the most recent snapshot between samples

#### Scenario: Hidden advanced diagnostics

- WHEN advanced diagnostics are closed
- THEN propulsion, RCS, SAS, physics, environment, navigation, and damage details SHALL NOT be collected just to draw the compact overlay

### Requirement: Section-specific heavy scans only run for visible sections

Expensive hierarchy scans SHALL only run when their section is visible/open.

#### Scenario: Damage diagnostics

- WHEN the Damage section is closed or the diagnostics window is collapsed
- THEN `PrototypeModuleDamageState` hierarchy scans SHALL NOT run

#### Scenario: Damage section open

- WHEN the Damage section is open inside advanced diagnostics
- THEN damage diagnostics SHALL be sampled at the heavy diagnostics cadence
- AND displayed values SHALL be based on the cached damage snapshot

### Requirement: Weapon computer target rendering is passive

Rendering the Weapon Computer target list SHALL NOT trigger target discovery.

#### Scenario: Target list draw

- WHEN the Weapon Computer panel draws its target list
- THEN it SHALL display `AvailableTargets` from the existing weapon computer state
- AND target discovery SHALL only happen through existing refresh/update behavior or explicit Refresh Targets actions
