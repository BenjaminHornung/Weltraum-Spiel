# Test Protocol: fix-rcs-spool-status-velocitychange

## Scope

Implemented the narrow consistency fixes for RCS spool-down, residual-aware allocator status, and `ForceMode.VelocityChange` impulse diagnostics.

## Unity MCP Script Validation

- `refresh_unity` with script compile requested: completed successfully
- `read_console` with C# error filtering: 0 compiler errors

## Unity EditMode Tests

Full EditMode job `73162e934aed49e189f16fc8a922748c`:

- Total: 41
- Passed: 41
- Failed: 0

## Covered Checks

- RCS spool-down applies residual physical nozzle force until stored throttle settles.
- Idle RCS with no stored throttle applies no force and reports `idle`.
- Underpowered RCS requests report `limited-residual` instead of a misleading `ok`.
- `ForceMode.VelocityChange` contributes mass-scaled impulse diagnostics and no continuous force diagnostics.
- No-RCS/no-authority RCS requests preserve the existing `no nozzles` and `no authority` status contract.

## Dotnet Verification

- `dotnet build "Weltraum Spiel.sln"`: passed with existing Unity/MSB3277 and serialized-field warnings.
- `dotnet test "Weltraum Spiel.sln" --no-build`: passed.
- DevToolbox `verify_run`: spec validation passed, but the default bare `dotnet build`, `dotnet test`, and `dotnet format` steps failed with the known MSB1011/multiple-project-file root issue. The explicit solution-scoped commands above are the applicable verification for this Unity project.

## Console Notes

`read_console` with C# error filtering showed no compiler errors after the final script refresh. An earlier Unity TestRunner start saw a temporary cleanup artifact while unrelated dirty test changes were still present; those unrelated changes were stashed/restored to HEAD before the final 41/41 EditMode run.
