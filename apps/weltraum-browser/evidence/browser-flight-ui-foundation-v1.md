# Browser Flight UI Foundation v1 Evidence

- Captured player HUD at 1280x720, 1440x900, 1024x768, narrow 760x640, and ultrawide 1920x800.
- Verified edge-panel layout with `.hud-center-safe-area` and bounding-box overlap checks.
- Verified selected target/navigation, autopilot executing state, fuel warning chips, concise ship visual line, and absence of raw fuel reason codes in player HUD.
- Verified 1024x768 and 760x640 keep Mode, Autopilot, Ship Visual, Ship Status, Navigation/Target, and Warnings player-visible without covering the center safe area.
- Verified blocked/critical warning state disables the primary route button instead of dispatching EngageAutopilot.
- Used `/?testBridge=1` only for controlled setup/evidence; default `/` was checked to keep TestBridge hidden.
- Note: post-arrival Hold/Ready evidence uses current executor lifecycle telemetry and player-facing HUD labels; no autopilot lifecycle logic was changed.