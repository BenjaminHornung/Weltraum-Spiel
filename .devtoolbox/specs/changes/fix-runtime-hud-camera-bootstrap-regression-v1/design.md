# Design

## Diagnosis

The screenshot shows that the HUD renderer itself is alive, but the visible snapshot lacks core ship references. `Fuel n/a`, `Assist n/a`, and `Weapon n/a` are produced when the HUD snapshot has no bound `ShipStats`, `PrototypeMomentumAssist`, or `PrototypeWeaponComputer`. The current `Editor.log` still reports a visible imported ship and enabled imported renderers, so the fix should focus on binding and camera framing first.

## Approach

1. Treat bootstrap as the source of truth for the active ship and camera. When `SetupMainCamera` binds the runtime UI, it should not allow stale HUD renderers on the active camera to keep presenting old null references.
2. Make the player HUD renderer resilient. If its serialized or runtime ship root is missing, destroyed, or incomplete, it should resolve the active runtime ship from existing prototype components and rebuild its snapshot dependencies.
3. Select the default waypoint target for display after `EnsureDefaultWaypoints()` has populated targets. This is a planner/preview selection only and must not engage the autopilot.
4. Constrain camera flip assist to real autopilot flip/brake phases. Idle, cruise, and zero-speed states should use the normal target orientation instead of velocity-derived chase references.

## Reuse

The patch reuses the existing bootstrap binding path, HUD snapshot builder, waypoint manager target selection, and `SimpleFollowCamera` chase reference logic. No new UI framework or parallel runtime object registry is introduced.

## Evidence Strategy

Unity MCP is preferred for runtime hierarchy inspection and screenshots. If the Unity MCP tool surface is unavailable, local `Editor.log`, Unity batchmode tests, and .NET build output are acceptable fallback evidence, with the MCP outage recorded in `tests/test-protocol.md`.
