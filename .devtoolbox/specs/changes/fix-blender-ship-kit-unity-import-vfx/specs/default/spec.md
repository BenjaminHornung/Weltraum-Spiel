# default Specification

## ADDED Requirements

### Requirement: Ship kit import fix remains bounded

The change MUST repair the Blender/Unity asset pipeline for the prototype ship kit without changing gameplay flight behavior.

#### Scenario: Change scope is reviewed

- **WHEN** implementation is complete
- **THEN** mesh exports, material assets, VFX preview assets, preview scene, and verification artifacts may be changed
- **AND** `PlayerShipController`, `PrototypeWaypointAutopilot`, flight physics, and RCS allocator behavior are unchanged
- **AND** imported ship-kit models remain builder-compatible through stable part and nozzle names
