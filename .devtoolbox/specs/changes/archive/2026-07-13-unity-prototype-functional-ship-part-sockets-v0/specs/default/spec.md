# Capability: Functional Imported Ship Kit

This umbrella spec tracks the full prototype-functional-ship-part-sockets-v0 change. The detailed behavioral requirements live in the focused specs:

- `functional-ship-part-sockets`
- `imported-ship-runtime-binder`
- `thruster-vfx-runtime-binding`
- `weapon-muzzle-binding`
- `main-thruster-gimbal-binding`
- `blender-export-socket-contract`

## Acceptance
- Imported Blender ship kit parts provide functional sockets for runtime systems.
- Existing generated prototype ships remain compatible.
- Runtime effects, projectile spawning, and gimbal support use part-defined sockets instead of manual root fallbacks.