# Capability: flight-control-regression-evidence

## Requirement
The repository SHALL retain a validated evidence bundle proving imported-ship PlayMode flight controls remained stable across translation, attitude, SAS, main thrust, camera binding, visual switching, and stale assist clearing.

## Scenarios
- Translation inputs generate bounded physical velocity in the intended directions without unwanted torque.
- Attitude inputs generate torque without unwanted linear drift.
- SAS can hold or preserve physical drift according to its active state.
- Main thrust accelerates forward without unexpected spin.
- F6 visual switching preserves core flight components and camera binding.

## Constraints
- This capability records evidence only.
- It does not modify gameplay code.
