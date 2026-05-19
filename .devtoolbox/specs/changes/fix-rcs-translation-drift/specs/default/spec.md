# Capability: RCS Translation Without Drift

## Requirements

### Requirement: Pure RCS translation must not create unintended rotation

When the ship starts with zero angular velocity and receives an RCS translation command with zero attitude command, the system must apply linear acceleration without leaving meaningful angular velocity.

Scenarios:
- Local +X and -X translation from rest leave angular velocity near zero.
- Local +Y and -Y translation from rest leave angular velocity near zero.
- Local +Z and -Z translation from rest leave angular velocity near zero.
- The behavior is the same whether SAS is enabled or disabled.

### Requirement: RCS translation remains visible

When a pure RCS translation command is active, the prototype must still activate the selected RCS nozzles/VFX used to represent that movement.

### Requirement: RCS attitude still produces torque

When an attitude command is active, RCS must still apply off-center forces or equivalent torque so pitch/yaw/roll control continues to work.

### Requirement: Diagnostics reflect neutralized translation torque

Debug values must not imply that translation-only force has applied rotational torque when the physical force path is neutralized. Translation force, selected nozzle count, and active nozzle IDs should remain visible.

## Constraints

- Keep this as a prototype bugfix, not a full RCS allocator.
- Do not change keybinds or camera behavior.
- Do not add new assets or external packages.
- Use Unity MCP for Unity script changes and verification.
