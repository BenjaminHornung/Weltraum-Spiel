# validation-physics-test-suite

## Why

Physics is becoming the core of the game. Manual playtesting is not enough to protect force, torque, fuel, COM, and prediction behavior from regressions.

## What

Define a repeatable physics test suite for deterministic math and Unity-MCP verification probes. The suite should cover main thrust, gimbal torque, RCS allocation, fuel, COM/inertia, projectiles, timestep stability, and future gravity/prediction slices.

## Out of Scope

- No full CI pipeline requirement yet.
- No replacing manual playtests.
- No final test framework decision if Unity constraints require iteration.
- No implementation of every future feature.

## Success Criteria

- Key physics formulas have focused tests or deterministic probes.
- Tests compare expected net force/torque/fuel/momentum values.
- Timestep stability has at least one regression check.
- Evidence is stored under the active spec change tests folder.
- Unity MCP remains the verification path for Unity operations.
