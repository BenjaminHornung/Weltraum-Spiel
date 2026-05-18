# Capability: Tuned Gimbal and SAS Attitude Controls

## Requirements

### Requirement: Softer Main Gimbal Response

The prototype SHALL keep the main thruster gimbal hard limit at 20 degrees by default, but SHALL use a softer effective control response for normal attitude input.

#### Scenario: Diagonal attitude input stays capped

- **Given** pitch and yaw attitude input are both active
- **When** the main thruster gimbal command is calculated
- **Then** the resulting visual and physics gimbal angle SHALL remain at or below the configured 20 degree range
- **And** the effective angle SHOULD be lower than the hard limit unless the response scalar is configured to full strength

#### Scenario: Straight thrust remains stable

- **Given** no attitude input is active
- **When** main throttle produces thrust
- **Then** the main thrust SHALL still be applied through the Rigidbody center of mass
- **And** no uncommanded torque SHALL be produced by straight thrust

### Requirement: SAS Counters Keyboard Attitude Rotation

The prototype SHALL apply SAS stabilization to angular velocity created by W/S/A/D/Q/E attitude controls when SAS is effectively enabled.

#### Scenario: SAS enabled after W/S/A/D input

- **Given** the ship has angular velocity from keyboard pitch or yaw input
- **And** SAS is enabled
- **When** the attitude key is released
- **Then** SAS SHALL command counter torque through the existing RCS/nozzle model where practical
- **And** angular velocity magnitude SHALL decrease over the stabilization probe

#### Scenario: SAS disabled preserves vacuum inertia

- **Given** the ship has angular velocity from keyboard attitude input
- **And** SAS is disabled
- **When** the attitude key is released
- **Then** the ship SHALL continue rotating without passive damping

### Requirement: Existing Prototype Behavior Remains Functional

The change SHALL preserve RCS translation, gun/projectile firing, fuel/throttle behavior, mouse camera-only behavior, and debug overlay readability.
