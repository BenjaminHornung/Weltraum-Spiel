# Ship Blueprint Builder v0

## Summary

Introduce a prototype-scale, data-driven modular ship blueprint layer that can validate and spawn playable generated ships from reusable part definitions and module instances. The layer should preserve the current imported Demo Scout default and generated fallback support while making generated sample ships derive layout, mass, fuel, main thrust, RCS, and weapon behavior from blueprint data.

## Why

The prototype already has generated layouts and debug variants, but ship shape and gameplay values are split across layout entries, variant settings, component defaults, and bootstrap helper code. A first blueprint model gives future builder work a single data contract without introducing inventory, economy, save/load, or final editor UI.

## Goals

- Define module definitions and module instances for prototype-only ship blueprints.
- Convert blueprints into the existing generated layout, variant, mass, fuel, thrust, RCS, and gun settings.
- Validate required categories, duplicate instance ids, missing definitions, non-finite transforms, and basic actuator requirements before flight.
- Provide at least two playable sample blueprints with different mass, COM, fuel, thruster, RCS, and weapon behavior.
- Keep the implementation deterministic and covered by EditMode tests, docs, DevToolbox verification, and Unity validation evidence.

## Non-Goals

- No visual ship editor, drag/drop placement UI, inventory, economy, save/load, multiplayer, final art, or interior/begehbare ship logic.
- No hard replacement of imported Blender functional binding or generated fallback support.
- No rewrite of the existing flight physics, RCS allocator, weapon computer, or player controller.
