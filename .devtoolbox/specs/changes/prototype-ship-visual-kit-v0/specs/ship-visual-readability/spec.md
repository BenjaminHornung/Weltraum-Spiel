# ship-visual-readability Specification

## ADDED Requirements

### Requirement: Ship silhouette is readable in flight

The prototype ship MUST read as a ship made from distinct modules rather than one bright block during normal flight and PlayMode inspection.

#### Scenario: Default ship is viewed in the prototype test environment

- **WHEN** the default prototype ship is spawned and viewed from gameplay camera distance
- **THEN** the hull is a darker neutral gray and not pure white
- **AND** the cockpit, fuel tank, main thruster, RCS pods, gun, and cargo or utility areas are visually distinguishable
- **AND** the front and rear of the ship are recognizable without relying on debug overlays

### Requirement: Gameplay roles have distinct visual language

Each major prototype ship role MUST have a distinct low-poly visual treatment.

#### Scenario: Module roles are inspected visually

- **WHEN** the ship is inspected from front, side, and rear angles
- **THEN** the cockpit is visible near the front and includes a canopy surface
- **AND** fuel tanks use green color coding with a tank-like form or green striping
- **AND** main thrusters include an engine bell or nozzle using orange or blue engine coloring
- **AND** RCS pods are small pods with visible nozzle markers using cyan or green accents
- **AND** guns include a barrel and muzzle using yellow or red accents
- **AND** cargo or utility modules use their own tone or form

### Requirement: Optional debug labels do not replace visual readability

Optional labels MAY identify roles such as `COCKPIT`, `FUEL`, `MAIN`, `RCS`, and `GUN`, but the ship MUST remain readable without relying on labels.

#### Scenario: Debug labels are disabled

- **WHEN** optional role labels are absent or disabled
- **THEN** the ship still communicates the listed gameplay roles through geometry, color, and material contrast
