# Tasks

- [x] Add a deterministic route-aligned obstacle course to `PrototypeTestEnvironment` and expose it through the bootstrap-built map.
- [x] Add editor and PlayMode regressions that verify the live map obstacles are registered, the autopilot selects avoidance before launch, and the ship still reaches the target without collision or brake/accelerate regression.
- [x] Capture Unity MCP scene and Game View evidence and record it under the change tests folder.
- [x] Run Unity/C# verification (`validate_script`, targeted tests, `dotnet build "Weltraum Spiel.sln" --no-restore`, and `verify_run`) and record the results.
- [x] Commit and push the checkpoint.
