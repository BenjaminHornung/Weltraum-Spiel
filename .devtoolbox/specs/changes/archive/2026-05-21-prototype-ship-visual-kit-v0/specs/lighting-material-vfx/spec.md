# lighting-material-vfx Specification

## ADDED Requirements

### Requirement: Materials support dark-environment readability

The ship materials and lighting response MUST keep the ship readable in the dark prototype environment without making the hull flat white or fully emissive.

#### Scenario: Ship is viewed in the dark test environment

- **WHEN** the ship is rendered in PlayMode
- **THEN** hull surfaces use a darker neutral non-emissive material
- **AND** cockpit canopy surfaces are darker and slightly glossy
- **AND** role accents remain visible under the scene lighting
- **AND** materials are compatible with the project's Unity render pipeline and standard runtime material creation

### Requirement: Engine and RCS VFX are intentionally emissive

Main engine and RCS effects MUST use targeted emissive or bright materials that are visually separate from hull materials.

#### Scenario: Main thrust and RCS are active

- **WHEN** main thrust VFX is visible
- **THEN** it follows the `MainThrusterNozzle` location and reads as engine output
- **AND** it is not easily confused with debug vectors
- **WHEN** RCS nozzles are active
- **THEN** only active nozzles show RCS VFX
- **AND** RCS VFX is brighter or larger than the previous unreadable baseline while remaining localized to the nozzle

### Requirement: Debug vectors are off by default

Debug vector visuals MUST remain disabled by default for normal visual readability checks.

#### Scenario: Prototype scene starts normally

- **WHEN** the scene starts without explicitly enabling debug visualization
- **THEN** debug vectors do not obscure or replace engine/RCS VFX readability
