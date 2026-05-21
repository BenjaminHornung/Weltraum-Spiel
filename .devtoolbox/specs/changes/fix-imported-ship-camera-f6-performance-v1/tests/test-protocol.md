# Test Protocol

## Scope

Regression target: imported Blender ship visual switching with F6, camera framing, RCS nozzle discovery, and visual-only versus functional imported socket behavior.

## Planned Verification

- Unity EditMode: focused camera tests in `PrototypeSimpleFollowCameraValidationTests`.
- Unity EditMode: focused visual switcher tests in `PrototypeShipVisualSwitcherValidationTests`.
- Unity EditMode: focused RCS/socket tests in `PrototypeFunctionalShipSocketValidationTests` and/or `PrototypePhysicsValidationTests`.
- Existing camera/RCS/imported socket tests where practical.
- Optional PlayMode/manual evidence with `PrototypeBootstrapHost` and repeated F6 switching if Unity Editor is available.

## Evidence Log

- 2026-05-21: Unity MCP custom tools checked; no project custom tools registered.
- 2026-05-21: Unity MCP editor/project resources returned `no_unity_session`, so initial implementation proceeds with repo tests/build and records the Unity Editor limitation until a session is available.
- 2026-05-21: Local Unity 6.4 docs checked for `Component.GetComponentsInChildren`, `Renderer.bounds`, and `Rigidbody.worldCenterOfMass`.
- 2026-05-21: `specs_validate` passed for `fix-imported-ship-camera-f6-performance-v1`.
- 2026-05-21: `dotnet build "Weltraum Spiel.sln"` initially failed inside sandbox because the .NET SDK could not read `C:\Users\benni\AppData\Local\Microsoft SDKs`; rerun with approved escalation succeeded. Remaining output is existing Unity/MSB3277 and serialized-field warnings, with 0 errors.
- 2026-05-21: `dotnet test "Weltraum Spiel.sln" --no-build` exited 0; the Unity test assemblies do not emit detailed NUnit results through this runner.
- 2026-05-21: Unity MCP still reports `no_unity_session` and `instance_count: 0`, so focused Unity EditMode execution could not be started from MCP in this pass.
