# Proposal: Browser Spatial Physics Spine V1

## Goal

Create a deterministic, renderer-independent TypeScript spatial and physics core for explicit universe time, hierarchical reference frames, celestial body frames, geographic surface tangent frames, frame-correct kinematics, gravity queries, fixed-step probes, and physics-space handoffs.

The implementation starts from current `origin/main` `9f63c1cecda5a14563d4b6be3452b89d07055092`. This differs from the task's expected `8bb98b1b084ce86fb262a4fee554a573d43b94f5`; the intervening commits only affect `.github/**` and do not change consumed browser contracts.

## Scope

- Wrap the existing 120 Hz Persistence universe-time API with an explicit runtime clock.
- Add immutable canonical frame definitions and time-dependent states.
- Support `SystemInertial`, `BodyInertial`, `BodyFixed`, `SurfaceLocal`, `LocalPhysics`, and `RenderRelative` frame kinds.
- Transform position, direction, orientation, linear velocity, and angular velocity through rotating frames.
- Derive body frames from existing Celestial definitions/runtime states.
- Define spherical geographic surface anchors and deterministic tangent frames.
- Adapt existing Celestial gravity queries without duplicating gravity formulae.
- Integrate a translational probe with explicit fixed steps.
- Perform checked, explicit physics-space handoffs that preserve absolute kinematics.
- Prove behavior with unit tests, a real Vite/Playwright browser test, canonical evidence, and documentation.

## Success criteria

All public values are finite, immutable, canonically signed, free of Three.js/DOM types, and deterministic for identical explicit inputs. Roundtrips and handoffs meet documented tolerances, rotating-frame velocity includes `omega x radius`, and the geographic EUS basis obeys all three right-handed cross-product identities at ordinary locations and both poles.

## Non-goals

No planet renderer, terrain, voxels, ellipsoid/geoid, atmosphere, collision, thrust, active ship or player integration, actor/camera alignment, flight/navigation/autopilot changes, game-loop clock wiring, floating-origin authority changes, visual-scale physics, automatic gravity-source switching, landing zones, or surface tile addressing.
