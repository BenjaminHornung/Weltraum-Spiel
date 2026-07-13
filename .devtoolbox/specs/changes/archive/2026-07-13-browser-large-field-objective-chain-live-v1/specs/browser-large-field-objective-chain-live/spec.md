# Browser Large-Field Objective Chain Live

## Requirements

- The browser runtime shall expose a deterministic objective chain for:
  - Reach Range 500m
  - Reach Range 1000m
  - Reach Range 2500m
- Each objective shall have a player-facing status from locked, available, route-ready, enroute, complete, or blocked.
- Reach Range 500m shall start available.
- Reach Range 1000m shall become available after Reach Range 500m completes from executor Arrival/Holding truth.
- Reach Range 2500m shall remain visible as a future locked objective until earlier prerequisites complete.
- Selecting a locked objective shall not change the active objective, selected target, or route preview.
- Selecting another objective while a route is locked shall not hide completion of the route being flown.
- The HUD shall show the current objective, status, next action, target, distance, hint, and visible objective choices.
- The live browser E2E shall use the normal `/` runtime, player HUD buttons, and no TestBridge route or API calls.
