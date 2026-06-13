# Design

## UI Routing

Basic is the player view. F7 should not open `PrototypeWeaponComputerPanel` there; the player HUD owns the Basic combat computer popup. The legacy IMGUI panel remains reachable in non-Basic prototype presets.

## Player Popups

The navigation planner and combat computer are generated inside `PrototypePlayerHudRenderer` using the existing uGUI/TMP helpers and existing gameplay APIs. They are modal player surfaces: when open, the fixed context/radar/system panels are hidden to prevent overlap at 4:3 and small viewports.

## Assist Main Thrust

Manual main thrust remains locked out in Precision/Translation, but external assist requests from `PrototypeMomentumAssist` or `PrototypeWaypointAutopilot` may request main throttle. This keeps the control-mode meaning while letting assist systems flip and brake with the main engine when they own the maneuver.

## RCS VFX

Nozzle forward remains the physical force direction. Exhaust visuals must be placed behind the nozzle and face opposite nozzle forward. Both generated runtime VFX and imported ship VFX binding paths must enforce this.
