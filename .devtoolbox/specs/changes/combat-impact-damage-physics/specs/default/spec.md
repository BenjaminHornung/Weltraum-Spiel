# Capability: Impact Damage Physics

## Requirements

### Requirement: Impact event

Hits SHALL create an impact event containing enough physical context for damage and impulse handling.

#### Scenario: Projectile hit

- GIVEN a projectile hits a ship module proxy
- WHEN the hit is processed
- THEN the event records hit point, normal, relative velocity, impulse estimate, and affected module

### Requirement: Physical degradation

Damage SHALL be able to reduce physical capability of affected modules.

#### Scenario: RCS block damaged

- GIVEN an RCS block is damaged
- WHEN the allocator builds available nozzles
- THEN damaged nozzles provide reduced or zero thrust according to damage state

### Requirement: Diagnostics

Damage state SHALL be inspectable in debug output.

#### Scenario: Damaged engine

- GIVEN an engine has reduced thrust
- WHEN debug diagnostics are visible
- THEN the effective thrust multiplier or degraded state is shown
