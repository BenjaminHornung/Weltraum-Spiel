# prototype-camera-anchor-framing-v1

## Why
The follow camera currently uses renderer bounds center as the primary focus. That is visually convenient but semantically unstable when imported visuals are asymmetric or temporarily detached from the gameplay ship. Camera zoom and framing should target the ship's real center while still using visual bounds for fit distance.

## What
- Add `PrototypeCameraAnchor` as the semantic ship focus point.
- Update `SimpleFollowCamera` to choose focus from anchor, Rigidbody center of mass, visual bounds center, then target position.
- Keep visual bounds for distance and fit calculations only when an anchor or center of mass is available.
- Ensure bootstrap adds a camera anchor to the prototype ship and rebinds/reframes the active main camera.
- Clarify visual switcher manager behavior and keep imported visuals parented under the active prototype ship.
- Extend debug diagnostics and tests for focus source, bounds, zoom, bootstrap, and visual switching.

## Out of Scope
- Cinemachine migration.
- New camera modes beyond the existing prototype modes.
- Rebuilding imported ship assets.

## Success Criteria
- Zoom and focus use `PrototypeCameraAnchor` or Rigidbody center of mass before renderer bounds.
- Visual bounds affect fit distance but do not move semantic focus when anchor/COM exists.
- F6 visual switching keeps camera target bound to `PrototypeShip`.
- Imported visuals are children of the ship and move with it.
- The persistent visual switcher manager is clearly named and has no renderer, collider, or Rigidbody.
- Bootstrap leaves exactly one active Main Camera and binds it to the current prototype ship.
- Camera diagnostics report target, focus source, focus point, visual bounds center/radius, effective distance, and zoom.
- Automated tests and evidence under `tests/` demonstrate the behavior.

