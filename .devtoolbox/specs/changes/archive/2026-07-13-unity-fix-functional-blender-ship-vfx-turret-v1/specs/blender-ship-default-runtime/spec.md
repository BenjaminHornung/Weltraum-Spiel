# Capability: Blender Ship Default Runtime

## Requirement
The standard Play Mode bootstrap SHALL use the Blender Demo Scout as the functional `PrototypeShip` by default. The generated primitive ship SHALL remain available only through an explicit fallback/debug build mode.

## Scenarios
- Given an empty scene or `PrototypeBootstrapHost.unity`, when `PrototypeBootstrap.BuildPrototype()` runs with default settings, then the selected build mode is `ImportedDemoScoutFunctionalDefault` and the `PrototypeShip` root contains the imported scout as the functional source for sockets, VFX, weapons, and turret pivots.
- Given the imported scout asset is missing or fails to load, when fallback is not explicitly allowed, then the runtime reports a missing imported asset/socket status and does not silently create generated functional nozzles or muzzle origins.
- Given `GeneratedPrimitiveFallback` is explicitly selected, when the prototype is built, then the existing generated primitive ship behavior can be used for debug/fallback without pretending to be the imported default.
- Given F6 visual switching remains available, when the player switches between generated and imported modes, then the visible ship and functional nozzles/muzzle/turret binding remain the same authority or the mode clearly enters generated fallback.
