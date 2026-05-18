# Tasks: working-spaceflight-prototype

## Spec

- [x] Create DevToolbox spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add specs/spaceflight-prototype/spec.md
- [x] Add tasks.md
- [x] Validate spec change with specs_validate
- [x] Report validated spec before implementation

## Unity MCP Gate

- [x] Check current Codex tool list for Unity MCP availability
- [x] Confirm Unity MCP is available before Unity project mutation
- [x] Use Unity MCP for script creation under Assets, scene operations, asset import, compile checks, and play-mode checks
- [x] If Unity MCP is unavailable, document the blocker and pause implementation

## Unity Prototype

- [x] Create or verify Unity URP project structure through Unity MCP
- [x] Add PrototypeBootstrap.cs
- [x] Add ShipStats.cs
- [x] Add PlayerShipController.cs
- [x] Add SimpleFollowCamera.cs
- [x] Add GunModule.cs
- [x] Add Projectile.cs
- [x] Add EngineVfxController.cs
- [x] Add PrototypeDebugOverlay.cs

## Gameplay

- [x] Generate placeholder ship modules
- [x] Add Rigidbody-based zero gravity flight
- [x] Add fuel consumption
- [x] Disable main thrust when fuel is empty
- [x] Add speed calculation
- [x] Add gun firing
- [x] Add projectile velocity as ship velocity plus muzzle velocity
- [x] Add projectile lifetime cleanup
- [x] Add projectile trail or glow
- [x] Add engine placeholder VFX

## Input

- [x] Add mouse and keyboard controls
- [x] Attempt controller controls through Unity Input System
- [x] Document controller limitations if needed

## Documentation

- [x] Add README setup instructions
- [x] Add controls list
- [x] Add known limitations
- [x] Document optional CC0 asset policy
- [x] Add next-step suggestions

## Verification

- [x] Confirm project compiles through Unity MCP
- [x] Confirm prototype scene can start
- [x] Confirm ship moves
- [x] Confirm fuel decreases while thrusting
- [x] Confirm empty fuel blocks main thrust
- [x] Confirm gun fires visible projectiles
- [x] Confirm projectile lifetime cleanup
- [x] Confirm debug overlay updates
- [x] Confirm engine and projectile VFX are visible
- [x] Confirm README matches implemented controls and limitations
