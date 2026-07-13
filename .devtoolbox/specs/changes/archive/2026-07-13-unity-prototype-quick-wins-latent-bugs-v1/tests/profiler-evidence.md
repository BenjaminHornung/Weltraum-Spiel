# Profiler Evidence

Date: 2026-06-13

Scope: Items 5 and 6 (`PrototypePlayerHud` radar target scans and sampled HUD text refresh).

## What Changed

- Item 5 (`f75df42`) removes the steady per-frame `FindObjectsByType<PrototypeNavigationTarget>` radar scan from the normal HUD path and routes radar targets through `PrototypeWaypointManager` when available. The scene-scan fallback is now cached behind a 1 Hz `PrototypeUiSampleGate`.
- Item 6 (`53c2fa8`) gates the heavy HUD snapshot/text path to 10 Hz, keeps marker/radar/indicator positions on a lightweight per-frame path, and avoids redundant TMP assignment via `SetTextIfChanged`.

## Live After Capture

Captured via Unity MCP `manage_profiler` against `Assets/Scenes/PrototypeBootstrapHost.unity` in Play Mode for 60 seconds after the quick-win commits.

| Metric | Value |
| --- | ---: |
| CPU frame time, final sample | 10.2101 ms |
| CPU main thread frame time, final sample | 8.5784 ms |
| CPU render thread frame time, final sample | 0.3527 ms |
| GPU frame time, final sample | 0.05364 ms |
| GC allocated in final sampled frame | 380,569 bytes |
| GC allocation count in final sampled frame | 2,572 |
| Scene object count | 3,626 |
| Game object count | 769 |

Profiler command summary:

```text
manage_profiler profiler_start log_file=.../tests/profiler-after-playerhud-60s.raw
manage_editor play
wait 60 seconds
manage_profiler get_frame_timing
manage_profiler get_counters category=Memory counters=GC Allocated In Frame,GC Allocation In Frame Count,GC.Alloc,Total Used Memory,Scene Object Count,Game Object Count
manage_profiler profiler_stop
manage_editor stop
```

## Before/After Caveat

No pre-change raw profile existed before the Item 5/6 commits landed, and temporarily replaying the full pre-change HUD in this shared dirty Unity workspace would have mixed in unrelated navigation/autopilot WIP. The before side is therefore documented from code-path evidence instead of a raw profiler capture: before Item 5/6, `Update()` reached full snapshot/text rebuild every frame and the radar fallback path could scan scene objects every frame. After Item 5/6, those paths are bounded to 10 Hz and 1 Hz respectively while dynamic marker positions still refresh every frame.

The raw Unity profiler capture produced during this run was 5.36 GB, so it was not retained as a commit artifact. This markdown keeps the reproducible command trail and the sampled counters; rerun the command sequence above if a full raw capture is needed for local inspection.
