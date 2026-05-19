# Tasks: prototype-ship-physics-core

## Spec
- [x] Create spec change folder
- [x] Add proposal.md
- [x] Add design.md
- [x] Add behavioral spec requirements
- [x] Add tasks.md
- [x] Validate spec with DevToolbox
- [x] Commit spec with spec title and changelog

## Discovery
- [x] Create execution for ShipPhysicsCore implementation slice
- [x] Inspect existing force application paths through Unity MCP
- [x] Confirm current main-thrust and RCS verification baselines

## Implementation
- [x] Add ShipPhysicsCore.cs
- [x] Add minimal ShipWrench or equivalent data structure
- [x] Configure ShipPhysicsCore from PrototypeBootstrap
- [x] Route MainThrusterModule force application through ShipPhysicsCore
- [x] Route RcsThrusterController allocated nozzle forces through ShipPhysicsCore
- [x] Preserve RCS per-nozzle throttle budget and diagnostics
- [x] Add core net force/torque diagnostics to PlayerShipController or overlay path
- [x] Avoid changing projectile, camera, keybind, fuel, gravity, damage, or docking behavior

## Documentation
- [x] Update README or docs with the central physics-core direction
- [x] Document deferred architecture slices: module mass/COM/inertia, fuel mass flow, SAS PD, recoil, gravity, docking, damage, trajectory prediction

## Verification
- [x] Validate changed Unity scripts with Unity MCP
- [x] Confirm Unity console has no C# compile errors
- [x] Verify throttle-only main thrust has near-zero unintended torque
- [x] Verify RCS translation parity remains within tolerance
- [x] Verify pure RCS translation has near-zero unintended torque
- [x] Verify pure RCS pitch/yaw/roll have near-zero linear drift and nonzero torque
- [x] Verify combined RCS translation + attitude has no nozzle oversubscription
- [x] Verify bootstrap, camera, gun, and overlay still work
- [x] Add test evidence under this spec
- [x] Commit implementation with spec title and changelog
