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
- [ ] Create execution for ShipPhysicsCore implementation slice
- [ ] Inspect existing force application paths through Unity MCP
- [ ] Confirm current main-thrust and RCS verification baselines

## Implementation
- [ ] Add ShipPhysicsCore.cs
- [ ] Add minimal ShipWrench or equivalent data structure
- [ ] Configure ShipPhysicsCore from PrototypeBootstrap
- [ ] Route MainThrusterModule force application through ShipPhysicsCore
- [ ] Route RcsThrusterController allocated nozzle forces through ShipPhysicsCore
- [ ] Preserve RCS per-nozzle throttle budget and diagnostics
- [ ] Add core net force/torque diagnostics to PlayerShipController or overlay path
- [ ] Avoid changing projectile, camera, keybind, fuel, gravity, damage, or docking behavior

## Documentation
- [ ] Update README or docs with the central physics-core direction
- [ ] Document deferred architecture slices: module mass/COM/inertia, fuel mass flow, SAS PD, recoil, gravity, docking, damage, trajectory prediction

## Verification
- [ ] Validate changed Unity scripts with Unity MCP
- [ ] Confirm Unity console has no C# compile errors
- [ ] Verify throttle-only main thrust has near-zero unintended torque
- [ ] Verify RCS translation parity remains within tolerance
- [ ] Verify pure RCS translation has near-zero unintended torque
- [ ] Verify pure RCS pitch/yaw/roll have near-zero linear drift and nonzero torque
- [ ] Verify combined RCS translation + attitude has no nozzle oversubscription
- [ ] Verify bootstrap, camera, gun, and overlay still work
- [ ] Add test evidence under this spec
- [ ] Commit implementation with spec title and changelog
