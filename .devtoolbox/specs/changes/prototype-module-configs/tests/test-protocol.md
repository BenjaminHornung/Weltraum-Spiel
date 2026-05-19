# prototype-module-configs Test Protocol

Date: 2026-05-19
Workspace: `E:\Unity\Weltraum Spiel\Weltraum Spiel`
Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`
Unity version: `6000.4.7f1`

## Scope

- Reviewed the dirty prototype-only Asset changes produced before this pass.
- No Asset edits were made during this pass.
- README already documented practical `PrototypeShipConfig` usage, including the Create menu path, default-unassigned behavior, tunable value groups, and the explicit non-goals for editor/inventory/save architecture.

## Unity MCP validation

`refresh_unity`:

- `mode`: `if_dirty`
- `scope`: `scripts`
- `compile`: `request`
- Result: refresh not needed, compile requested, Unity returned to ready state with no compilation or domain reload pending.

`validate_script` results:

- `Assets/Scripts/Prototype/PrototypeShipConfig.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/ShipStats.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/RcsThrusterBlock.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/RcsThrusterController.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/GunModule.cs`: 0 errors, 0 warnings

Unity console check:

- `read_console` for errors/warnings after validation and play-mode smoke: 0 entries.

## Deterministic config probe

Unity MCP `execute_code` was run with `compiler=codedom`.

The probe created temporary additive scenes, built a default ship with `PrototypeBootstrap`, built a second ship with a temporary in-memory `PrototypeShipConfig`, asserted values, then closed the temporary scenes.

Default bootstrap assertions:

- PASS default fuel max remains 300
- PASS default current fuel remains 300
- PASS default fuel consumption remains 0.6
- PASS default main thrust remains 45000
- PASS default main throttle scale remains 1
- PASS default gimbal support remains enabled
- PASS default gimbal limit remains 20
- PASS default gimbal response remains 0.35
- PASS default RCS translation force remains 9000
- PASS default RCS attitude force remains 6500
- PASS default RCS SAS authority remains 1.8
- PASS default RCS min selection dot remains 0.25
- PASS default RCS block thrust remains 6500
- PASS default projectile speed remains 1500
- PASS default projectile fire rate remains 4
- PASS default projectile lifetime remains 3
- PASS default projectile scale remains 0.24
- PASS default bootstrap creates no-gravity Rigidbody
- PASS default bootstrap creates playable controller

Configured ship assertions:

- PASS config changes fuel max to 123
- PASS config changes current fuel to 45
- PASS config changes fuel consumption to 0.9
- PASS config changes main thrust to 22222
- PASS config changes main throttle scale to 0.5
- PASS config changes gimbal support to false
- PASS config changes gimbal limit to 10
- PASS config changes gimbal response to 0.2
- PASS config changes RCS translation force to 4444
- PASS config changes RCS attitude force to 5555
- PASS config changes RCS SAS authority to 0.7
- PASS config changes RCS min selection dot to 0.4
- PASS config changes RCS block thrust to 3333
- PASS config changes projectile speed to 777
- PASS config changes projectile fire rate to 8
- PASS config changes projectile lifetime to 9
- PASS config changes projectile scale to 0.31
- PASS config changes camera follow distance to 20
- PASS config changes camera follow height to 7

Architecture guard:

- PASS no ship editor/inventory/save architecture types introduced
- Forbidden architecture matches: none

## Play-mode smoke

Unity MCP entered play mode from `Assets/Scenes/PrototypeBootstrapHost.unity`, then ran `execute_code` against the runtime-created default ship.

- PASS ShipStats present
- PASS runtime Rigidbody has gravity disabled
- PASS MainThrusterModule present
- PASS RCS has 20 installed nozzles
- PASS main thruster applies default thrust
- PASS fuel decreased during thrust

Unity MCP exited play mode afterward.

## specs_validate

`specs_validate` for `prototype-module-configs`:

- PASS DevToolbox spec validation passed.
- Parsed task items: 17.
- Warnings: none.
