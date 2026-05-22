# docking-physics-system

## Why

Docking and modular construction will matter later if ships, stations, or modules can connect. Docking should be physically understandable instead of a pure teleport attach.

## What

Define a future docking system with docking ports, alignment checks, relative velocity checks, soft capture, and hard lock behavior.

## Out of Scope

- No station builder.
- No ship editor.
- No networked docking.
- No UI-heavy docking computer.
- No final constraint solver.

## Success Criteria

- Docking ports expose position, forward direction, capture radius, and max angle error.
- Docking checks relative position, velocity, and orientation.
- Soft capture can request forces/torques instead of teleporting.
- Hard lock can use a joint or documented constraint.
- Debug diagnostics explain why docking is allowed or rejected.
