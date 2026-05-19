# Test Protocol: fix-anchored-chase-camera-lookaround

## Scope

- Script changed through Unity MCP only: `Assets/Scripts/Prototype/SimpleFollowCamera.cs`.
- Test evidence file created outside `Assets` under this spec's `tests/` folder.

## Unity MCP Validation

- Checked `mcpforunity://custom-tools` and active Unity instance.
- Unity editor was in Play Mode / transition in `Assets/Scenes/PrototypeBootstrapHost.unity`; stopped Play Mode with Unity MCP `manage_editor(action="stop")` before editing.
- Read `SimpleFollowCamera` through Unity MCP `manage_script`.
- Applied structured Unity MCP edits to:
  - anchored lookaround serialized limits/scale
  - `GetDesiredPosition`
  - `GetLookTarget`
- Ran Unity MCP `validate_script` at `standard` level: 0 errors, 0 warnings.
- Ran Unity MCP `refresh_unity` for scripts with compile requested and waited for readiness.
- Checked Unity MCP editor state after compile: ready for tools, not compiling, not in Play Mode.
- Checked Unity MCP console for errors: 0 error entries.

## Deterministic Logic Check

Formula under test for mode 0 anchor:

```text
target.position - target.forward * followDistance + target.up * followHeight
```

Sample input:

- `target.position = (10, 20, 30)`
- `target.forward = (0, 0, 1)`
- `target.up = (0, 1, 0)`
- `followDistance = 16`
- `followHeight = 6`
- look offsets compared for anchor: `(yaw=0, pitch=0)` and non-zero lookaround input
- exaggerated lookaround input checked for target offset clamp: `(yaw=45, pitch=30)`
- anchored lookaround tuning: yaw limit `18`, pitch limit `12`, target offset scale `0.08`

Result:

```text
anchor0=10,26,14
anchorWithLook=10,26,14
anchorInvariant=True
clampedYaw=18
clampedPitch=12
lookTarget=11.44,20.96,31.5
lookOffsetMagnitude=1.731
maxLookOffsetMagnitude=1.731
```

Conclusion: the mode 0 position anchor is independent of mouse-look offsets. Mode 0 lookaround now clamps yaw/pitch and moves the look target only a small distance around the ship, keeping the target close enough for the ship to remain visible and near center in chase view.
