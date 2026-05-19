# Test Protocol: validation-physics-test-suite

Date: 2026-05-19
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`
Change execution: `ae2bf23d055a411faf7c057a80884528`

## Existing Probe And Evidence Conventions

- Existing physics evidence is stored under `.devtoolbox/specs/changes/<change>/tests/test-protocol.md`.
- Existing Unity verification uses Unity MCP script validation, console checks, and deterministic `execute_code` probes.
- Existing probes build either the generated `PrototypeShip` through `PrototypeBootstrap.BuildPrototype()` or temporary generated rigs, then report force, torque, active nozzle count, max nozzle throttle, and pass/fail summaries.
- Existing tolerances are documented next to measured outputs instead of hidden in a separate config file.

## Relevant Current Physics Paths

- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: shared force and torque accounting.
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: main thrust and gimbal steering force application.
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: transform-driven RCS allocator and nozzle diagnostics.
- `Assets/Scripts/Prototype/ShipStats.cs`: mass, thrust, fuel, and projectile tuning values.
- `Assets/Scripts/Prototype/GunModule.cs` and `Assets/Scripts/Prototype/Projectile.cs`: current projectile spawn and velocity behavior; no recoil impulse path exists yet.
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: generated prototype ship setup used by prior deterministic probes.

