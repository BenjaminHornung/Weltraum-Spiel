# browser-playable-ship-flight-v1 Proposal

## Motivation

The browser mainline currently proves route selection, route preview, autopilot telemetry, HUD evidence, and low-poly world descriptors, but it is not yet a playable replacement for the Unity prototype. The visible ship is still a marker, the camera is static, manual flight controls are missing, thruster/RCS effects are absent, and normal autopilot execution still uses point-state shortcuts such as snap-to-target and idle velocity zeroing.

## Outcome

Create a browser-native playable flight foundation where the player can see and control a real ship-shaped object in Three.js, fly it with keyboard/mouse controls, follow it with a ChaseLocked camera, see main-thruster/RCS effects driven by actuator telemetry, and engage autopilot through the same flight/actuator layer used by manual controls.

## Scope

- Browser app only under `apps/weltraum-browser`, direct spec/evidence files, and browser-mainline docs.
- Browser-native flight state v2 with orientation, angular velocity, control mode, throttle, RCS/SAS state, commands, and actuator telemetry.
- Ship visual descriptor/render implementation using an existing safe browser asset if practical, otherwise a procedural low-poly ship.
- Manual keyboard/mouse controls and camera modes needed for a playable vertical slice.
- Autopilot integration that drives the same actuation layer and proves arrival without normal-runtime position snapping.
- HUD, tests, screenshots, and evidence for the playable slice.

## Non-goals

- Do not start or install Unity.
- Do not edit or delete `unity-legacy-final-2026-07:Assets/**`.
- Do not port MonoBehaviours 1:1.
- Do not implement full orbital mechanics, terrain/surface runtime, ship builder, economy, missions, drones, cargo, weapons gameplay, production radar/minimap, or save/load.
- Do not remove existing browser guarantees: route preview, selected target, stable locked `planHash`, TestBridge query gate, no silent replan, owner-snapshot HUD.

## Evidence

Final evidence must include fresh unit/build/E2E results and screenshots:

- `apps/weltraum-browser/evidence/manual-flight-chasecam.png`
- `apps/weltraum-browser/evidence/autopilot-thruster-burn.png`
- `apps/weltraum-browser/evidence/rcs-translation.png`
- `apps/weltraum-browser/evidence/autopilot-arrival.png`
- `apps/weltraum-browser/evidence/browser-playable-ship-flight-v1.md`
