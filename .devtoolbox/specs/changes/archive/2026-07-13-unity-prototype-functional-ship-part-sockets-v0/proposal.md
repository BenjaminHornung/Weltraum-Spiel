# Proposal: Prototype Functional Ship Part Sockets v0

## Motivation
The Blender low-poly ship kit now imports visually and can show preview VFX, but the imported parts do not yet carry a runtime-safe functional contract. Main engine effects, RCS plumes, gun muzzle spawns, and future ship-builder hardpoints must come from part-defined sockets instead of hand-placed scene offsets or root fallbacks.

## Outcome
Imported demo ships and individual parts expose canonical sockets that Unity runtime code can discover and bind automatically. Demo Scout and Demo Cargo can be converted into prototype runtime ships with main thruster nozzles, optional gimbal pivots, RCS nozzles, gun muzzles, VFX bindings, and builder hardpoints coming from the imported hierarchy and manifest metadata.

## Scope
- Add a canonical `PrototypeShipSocket` component and detection helpers.
- Add an imported ship binder that normalizes imported Blender names and configures existing prototype components.
- Extend runtime VFX binding beyond preview-only usage.
- Improve gun muzzle resolution so imported `*_MUZZLE` transforms are used before fallbacks.
- Add gimbal pivot binding for imported main engines.
- Update Blender/manifest/export assets only as needed to provide canonical socket transforms.
- Add editor tests and test evidence.

## Non-Goals
- No final Ship Builder UI or inventory system.
- No turret AI or target tracking.
- No rewrite of flight physics, RCS allocation, or player controls.
- No hardcoded per-ship effect coordinate tables.
- No external asset packs.

## Compatibility
Existing procedural `PrototypeBootstrap` ships and existing component behavior must keep working. New imported-socket behavior is additive and should prefer explicit `PrototypeShipSocket` metadata, then canonical names, then legacy names, and only then existing fallback behavior.