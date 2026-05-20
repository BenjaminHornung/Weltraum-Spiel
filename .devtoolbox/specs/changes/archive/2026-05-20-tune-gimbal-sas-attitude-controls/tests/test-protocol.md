# Test Protocol: tune-gimbal-sas-attitude-controls

## 2026-05-18

- Unity MCP script validation:
  - `MainThrusterModule.cs`: 0 errors, 0 warnings.
  - `PlayerShipController.cs`: 0 errors, 1 pre-existing/performance warning from validator.
  - `PrototypeDebugOverlay.cs`: 0 errors, 0 warnings.
- Unity MCP fresh Play Mode console check after clear/re-enter play: 0 error entries.
- Unity MCP play probe:
  - Default diagonal full keyboard attitude gimbal angle: `6.996 deg`.
  - Previous full-cone equivalent: `19.897 deg`.
  - Gimbal response scalar: `0.35`; hard limit: `20.0 deg`.
  - Straight throttle-only main thrust torque: `0.000000`; angular velocity after step: `0.000000`.
  - SAS pitch/W-S release-equivalent angular velocity: `1.2000 -> 0.6276 rad/s`.
  - SAS yaw/A-D release-equivalent angular velocity: `1.2000 -> 0.1136 rad/s`.
  - SAS roll/Q-E release-equivalent angular velocity: `1.2000 -> 0.1055 rad/s`.
  - SAS disabled inertia: `1.2000 -> 1.2000 rad/s`.
  - RCS translation force: `27000.000`, active nozzles: `3`.
  - Gun/projectile: fired `True`, projectile count `0 -> 1`.
- `specs_validate` for `tune-gimbal-sas-attitude-controls`: passed, 24 task items parsed, 0 warnings.
