# Find* Audit

Date: 2026-06-13

Scope: Item 9 from `prototype-quick-wins-latent-bugs-v1`.

| Site | Frequency / path | Result | Action |
| --- | --- | --- | --- |
| `PrototypePlayerHud.ResolveReferences` -> `FindAnyObjectByType<PrototypePveArenaLoop>()` | Production frame path via `Update()` -> `RefreshNow()` -> `ResolveReferences()` when no arena loop is bound | Confirmed repeated fallback scan | Fixed with a 1 Hz renderer-local fallback gate. |
| `PrototypePlayerHud.AddEnvironmentRadarBlips` -> `FindAnyObjectByType<PrototypeTestEnvironment>()` | Production snapshot/radar build path | Confirmed repeated fallback scan | Fixed with a 1 Hz builder-local fallback gate and cached reference. |
| `PrototypePlayerHud.ResolveFallbackTarget` -> `FindAnyObjectByType<PrototypeTargetDummy>()` | Production snapshot fallback when no weapon target is active | Confirmed repeated fallback scan | Fixed with a 1 Hz builder-local fallback gate and cached reference. |
| `PrototypePlayerHud.ResolveRuntimeShipRoot` -> `GameObject.Find("PrototypeShip")` / `FindObjectsByType<PlayerShipController>()` | Production frame path while runtime binding is incomplete | Confirmed repeated fallback scan | Fixed with a 1 Hz renderer-local fallback gate. |
| `PrototypeFlightHud.ResolveTrackedTarget` | Debug IMGUI `OnGUI()` path | Debug-only legacy overlay | No change. |
| `PrototypeMinimapOverlay.ResolveReferences` | Debug IMGUI `OnGUI()` path | Debug-only legacy overlay | No change. |
| `PrototypeWeaponTarget.DiscoverInto` debug fallback scans | Registry-version and debug-interval gated | Not a steady production frame scan | No change. |
| `PrototypeDockingApproachAssist.ResolveTargetPort` | FixedUpdate fallback only after cached/candidate checks fail | Setup/fallback, not confirmed steady-state hotspot | Document only. |
| `PrototypeBootstrap` scene lookups | Bootstrap/setup/validation paths | One-time or setup-only | No change. |

The HUD fallback fixes use interval gates instead of one-shot attempted flags because these objects can appear after scene bootstrap or late binding. A missed lookup can therefore recover within about one second without restoring unbounded per-frame scans.
