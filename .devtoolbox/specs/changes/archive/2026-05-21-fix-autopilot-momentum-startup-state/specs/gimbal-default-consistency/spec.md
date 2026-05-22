# Capability: Gimbal Default Consistency

## Requirements

- Runtime main-thruster defaults and `PrototypeMainThrusterSettings.Default` must agree on the calmer gimbal tuning.
- Default gimbal limit must be 10 degrees.
- Default gimbal response scalar must be 0.14.
- Default gimbal slew rate must be 30 degrees per second.
- Built-in prototype variants must not overwrite these values with old aggressive defaults when they apply default settings.
- README and debug expectations must describe the actual configured defaults.

## Acceptance

- Applying `PrototypeMainThrusterSettings.Default` to a main thruster yields 10 degrees, 0.14 response scalar, and 30 deg/s slew.
- Built-in default/no-config bootstrap path does not restore 20 degrees, 0.35 response, or instant gimbal behavior.
- A test covers default settings and runtime module alignment.