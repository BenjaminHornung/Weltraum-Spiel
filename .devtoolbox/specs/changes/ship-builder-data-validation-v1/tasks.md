# Tasks: Ship Builder Data Validation v1

This change is planning/spec-only. These tasks describe future implementation
slices that should consume the design package.

## Phase 1 - Data contracts

- [ ] Define runtime/catalog data structures for `PartDefinition`,
  `PartInstance`, `SocketDefinition`, and blueprint serialization.
- [ ] Separate reusable definition data from placed instance data.
- [ ] Add stable instance IDs for all placed parts.
- [ ] Keep visual asset and collider references optional for pure data tests.

## Phase 2 - Functional components

- [ ] Model cockpit/control core, hull/frame, main thruster, RCS cluster, fuel
  tank, cargo/storage, turret/weapon, utility/sensor, docking connector, armor
  plate, and future power/heat component data.
- [ ] Validate functional component requirements without relying on final art.
- [ ] Keep resource costs referencing stable resource IDs.

## Phase 3 - Socket and connection validation

- [ ] Require local position, local orientation, type, compatibility, and
  direction for every functional socket.
- [ ] Validate structural connection between required modules.
- [ ] Validate socket occupancy, compatibility, capacity, and arc metadata.
- [ ] Reject RCS nozzles, thruster nozzles, and muzzles that lack usable direction.

## Phase 4 - Validation rules

- [ ] Implement hard errors for missing control core, disconnected required
  modules, hard overlap, missing main thrust, missing fuel/power, invalid socket
  occupancy, turret missing muzzle, RCS nozzle without direction, non-finite
  stats, and negative mass/capacity.
- [ ] Implement warnings for missing RCS axes, thrust offset, weak braking, low
  fuel/delta-v, blocked turret arcs, exposed cargo/fuel, high mass/low
  acceleration, missing docking connector, missing camera anchor, and mirror
  mismatch.
- [ ] Return errors and warnings separately with stable codes and player-facing
  messages.

## Phase 5 - Stat formulas

- [ ] Implement deterministic formulas for dry mass, fuel mass, cargo capacity,
  total mass, thrust, acceleration, RCS force, RCS torque, delta-v, burn time,
  turn authority, COM, thrust axis, COM/thrust offset, DPS, recoil, and
  heat/power placeholders.
- [ ] Make unavailable stats explicit when required inputs are missing.
- [ ] Validate non-finite and negative formula inputs.

## Phase 6 - Serialization

- [ ] Persist blueprint ID, display name, version, referenced part definition IDs,
  part instances, optional validation/stat caches, future timestamps, and future
  active variant flag.
- [ ] Invalidate caches when source data or formula versions change.
- [ ] Verify serialization roundtrip does not change stable instance IDs.

## Phase 7 - Later EditMode tests

- [ ] Add pure data tests for valid minimal ship, missing cockpit, disconnected
  module, overlap, invalid socket, turret missing muzzle, RCS direction coverage,
  COM/thrust offset warning, stat formulas, serialization roundtrip, and mirror
  placement.
- [ ] Ensure tests pass with metadata fixtures or primitive visuals before final
  Blender art exists.
