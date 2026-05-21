# Fix Imported Ship Camera F6 Performance v1

## Motivation

Switching the prototype ship to `ImportedDemoScout` or `ImportedDemoCargo` with F6 regresses both responsiveness and camera framing. The generated primitive ship stays light, but the imported Blender FBX visuals expose a large runtime hierarchy with hundreds of objects, meshes, and connector/nozzle/muzzle empties. Current camera and RCS paths repeatedly scan that hierarchy after the visual switch.

## User Outcome

Imported ship visuals remain usable in play mode. After the first lazy load of a visual prefab, F6 cycling should be responsive, ChaseLocked camera framing should stay anchored to the ship/COM, and steady-state camera/RCS updates should not rescan the imported visual hierarchy.

## Scope

- Cache camera visual bounds and invalidate them only when the target or visual changes.
- Keep ChaseLocked focus anchored to the ship, rigidbody COM, or an explicit camera anchor instead of raw visual bounds center.
- Filter non-ship renderers from camera bounds.
- Pool imported F6 visual instances instead of repeated destroy/instantiate work.
- Cache RCS nozzle discovery and separate visual-only imported mode from explicit functional imported sockets.
- Add focused EditMode tests and update prototype documentation/evidence.

## Non-Goals

- Redesign imported FBX authoring or Blender export structure.
- Replace the flight controller, force allocator, or ship socket naming contract.
- Require imported functional sockets as the default F6 behavior.
- Eliminate the first-load cost of loading an imported prefab; the target is steady-state and repeated-switch performance.
