# Test Findings: Performance Stability Hotpath Cleanup v1

## Summary

- Full EditMode is green: 228/228.
- Full PlayMode is green: 7/7.
- PlayMode performance smoke is green and produced profiler counters plus a rendered PNG screenshot.
- `dotnet build` and `dotnet test --no-build` are green; build retains existing Unity reference/version warnings.
- OpenSpec validation is green in a temporary OpenSpec-compatible mirror.

## Key Performance Findings

- Camera mode changes no longer force renderer hierarchy rescans. Evidence: 10 camera mode cycles during the smoke, while visual bounds refreshes only moved `5 -> 11`, matching the six visual switches.
- Disengaged autopilot no longer runs navigation planning every FixedUpdate. Evidence: manual replan count `1`, final count `1` across the 34.49s smoke.
- RCS nozzle refreshes are dirty-event bounded, not frame bounded. Evidence: `9 -> 23` refreshes across 105539 batchmode frames and six visual switches.
- RCS allocator source guards pass and cover the no-`ToArray` / reusable throttle-buffer path.
- PlayMode obstacle/autopilot tests now exercise correctly oriented test RCS nozzles, matching the runtime allocator contract that nozzle forward is force direction.

## Evidence Files

- `tests/logs/editmode-full-results.xml`
- `tests/logs/playmode-full-results.xml`
- `tests/logs/playmode-performance-smoke-results.xml`
- `tests/performance/playmode-performance-smoke.md`
- `tests/screenshots/playmode-performance-final.png`
