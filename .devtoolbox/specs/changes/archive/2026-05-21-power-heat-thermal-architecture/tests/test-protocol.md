# Test Protocol: power-heat-thermal-architecture

Date: 2026-05-19

## Scope

Implemented optional prototype thermal/power architecture:

- `PrototypeThermalModule` declares per-module thermal data and current state.
- `MainThrusterModule` advances optional heat/power simulation while firing or idle.
- The generated main-thruster module has an optional overheat hook that can disable thrust when simulation is enabled.
- `PrototypeDebugOverlay` displays main-thruster temperature, heat, cooling, power draw, and hook efficiency.
- `docs/physics-flight-model.md` documents the deterministic model and overlay diagnostics.

Existing reuse: no final module descriptor hierarchy was present for heat/power. The implementation reuses the prototype's existing lightweight MonoBehaviour, `ApplyConfig`/bootstrap, overlay, and `PhysicsValidationProbe` patterns rather than adding a parallel framework.

## Unity MCP Inspection

- Active Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`, Unity `6000.4.7f1`.
- Active scene: `Assets/Scenes/PrototypeBootstrapHost.unity`.
- Scene hierarchy before play contains bootstrap/camera/light; `PrototypeBootstrap` generates ship module primitives at runtime.
- Existing module pattern is root module MonoBehaviours plus generated child module GameObjects, not a final descriptor hierarchy.

## Script Validation

Unity MCP `validate_script`, standard level:

- `Assets/Scripts/Prototype/PrototypeThermalModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/MainThrusterModule.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PhysicsValidationProbe.cs`: 0 errors, 0 warnings.
- `Assets/Tests/Editor/PrototypePhysicsValidationTests.cs`: 0 errors, 0 warnings.
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 existing validator advisories about Rigidbody access and GUI string allocation.

## Deterministic Thermal Probe

Unity MCP `execute_code` result:

```text
heat 20.000->21.000 thrust=45000.0 power=24.0 overheat=False;
cool 80.000->70.000 thrust=0.0 power=0.0;
overheat final=30.000 disabled=True thrust=0.0 power=0.0
```

This verifies:

- Heat rises while the main thruster is active.
- Heat cools while the main thruster is idle.
- The optional overheat hook activates at threshold and disables thrust on the next step.
- Power draw diagnostics report active draw and return to zero while idle/disabled.

## Unity Tests

Unity MCP `run_tests(mode=EditMode, test_names=PrototypePhysicsValidationTests)`:

```text
14 total, 14 passed, 0 failed, 0 skipped
durationSeconds=0.5546998
```

Thermal-specific passed tests:

- `ThermalModuleHeatsWhileMainThrusterIsActive`
- `ThermalModuleCoolsWhileMainThrusterIsIdle`
- `ThermalOverheatHookDisablesMainThrusterAtThreshold`

Two existing tests were updated to match concurrently present prototype changes in the workspace:

- Recoil probe now expects the implemented `GunModule.ApplyRecoilImpulse` path.
- RCS yaw residual force tolerance uses the existing `RcsResidualForceTolerance` because module mass/COM descriptors shift the control pivot enough to leave a tiny residual force while preserving torque behavior.

## dotnet

Required root commands:

- `dotnet build`: failed with MSB1011 because the Unity root contains `Weltraum Spiel.sln`, `Assembly-CSharp.csproj`, and `Assembly-CSharp-Editor.csproj`.
- `dotnet test`: failed with MSB1011 for the same root ambiguity.

Concrete solution commands:

- `dotnet build "Weltraum Spiel.sln"`: passed. Warnings: existing `MSB3277` assembly version conflicts for `System.Net.Http` and `System.IO.Compression` via Unity/MCP references.
- `dotnet test "Weltraum Spiel.sln"`: passed with exit code 0; no tests were executed by dotnet for the Unity test assembly.
