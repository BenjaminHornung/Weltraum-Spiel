# Prototype Ship Material and VFX Intent

This document distills the useful visual intent from Unity-only material,
prefab and VFX-library YAML before those files leave the browser mainline. It
does not define a Unity-compatible material pipeline.

## Readability palette

Approximate linear/source colors from the prototype:

| Role | RGBA intent |
| --- | --- |
| Hull dark | `(0.19, 0.21, 0.22, 1)` |
| Hull panel | `(0.52, 0.56, 0.56, 1)` |
| Cockpit glass | `(0.04, 0.16, 0.34, 1)` |
| Engine metal | `(0.08, 0.085, 0.09, 1)` |
| Engine emission | base `(1, 0.36, 0.06, 1)`, emissive multiplier about `2.2` |
| RCS | cyan `(0, 0.72, 0.88, 1)` |
| Fuel | green `(0.05, 0.58, 0.28, 1)` |
| Cargo | violet `(0.42, 0.16, 0.64, 1)` |
| Connector | lime `(0.62, 0.92, 0.18, 1)` |
| Weapon | yellow-red `(0.9, 0.22, 0.08, 1)` |

Red/green/blue debug-axis colors were authoring aids only and are not product
materials.

## Thruster effects

- Main-engine effects use a warm orange, partially transparent base with a
  brighter orange emission. The source light color was approximately
  `(1, 0.45, 0.16, 1)`.
- RCS effects use a compact, partially transparent cyan emission.
- Main-engine and RCS emitters were looping effects whose visibility/intensity
  followed actuator telemetry. Future browser effects must continue to consume
  authoritative actuator snapshots rather than infer thrust from animation.
- Marker direction and nozzle binding come from the neutral ship manifest; an
  absent marker must fail visibly and must not emit from ship root/world zero.
- Presentation may pool/interpolate particles, but effect lifetime cannot keep
  gameplay thrust active or create authority.

## Acceptance ideas

- Main-engine and RCS colors remain visually distinct against dark space and
  the hull palette.
- Every active effect resolves a manifest marker and reports missing markers.
- Effect intensity tracks requested/applied actuator telemetry as specified by
  the browser visual adapter.
- Procedural fallback and Demo Scout GLB use the same semantic marker roles.

## Legacy sources

- `Assets/Art/PrototypeShipKit/Materials/*.mat`
- `Assets/Art/PrototypeShipKit/VFX/Materials/*.mat`
- `Assets/Art/PrototypeShipKit/VFX/Prefabs/*.prefab`
- `Assets/Art/PrototypeShipKit/VFX/PrototypeShipVfxLibrary.asset`
