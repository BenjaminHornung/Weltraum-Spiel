# Test Protocol: fix-rcs-authority-and-vfx-regression

Date: 2026-05-19

## Unity MCP validation

- `validate_script Assets/Scripts/Prototype/RcsThrusterController.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/PrototypeBootstrap.cs`: PASS, 0 warnings, 0 errors.
- `validate_script Assets/Scripts/Prototype/RcsThrusterBlock.cs`: PASS, 0 warnings, 0 errors.
- Unity refresh/compile state: ready for tools, not compiling.
- Console after final play-mode probe: 0 errors, 0 warnings.

## Deterministic runtime probe

Probe setup:

- Entered play mode through Unity MCP.
- Rebuilt `PrototypeShip` through `PrototypeBootstrap.BuildPrototype()`.
- Forced all four `RcsThrusterBlock` thrust values to `1234` for block-thrust proof.
- Ran direct `RcsThrusterController.ApplyControls(...)` probes with deterministic rigidbody state.

Results:

```text
blocksWithRcsThrusterBlock=4/4 minInitialThrust=6500
manualYawSasOff=2249.085 manualYawSasOn=2249.085 ratio=1 sasOnManual=(0.00, 0.00, 0.00)
releasedYawSasCommandY=-0.864 releasedYawTorque=-1943.209 dampedYawAfter240=0.08205
translationXOff=3702 translationXOn=3702 ratio=1 activeOffOn=3/3
blockThrustProbe expected=3702 actual=3702 error=0.000244
vfx active=3 visibleOutsideBlock=3 minDotVfxForwardOppositeNozzle=1
```

Additional released-axis damping probe:

```text
released yaw damping after900=0 minAbs=0 sas=(0.00, 0.00, 0.00)
```

Coverage:

- Manual yaw authority with SAS off/on and yaw rate `+0.5`: comparable, ratio `1`.
- Manual yaw SAS mask: active yaw input produced `sasOnManual.y = 0`.
- Released yaw with SAS on: counter-command applied, then damped to `0`.
- Translation `+X` with SAS off/on: comparable, ratio `1`.
- Four generated RCS blocks expose `RcsThrusterBlock` with default thrust `6500`.
- Selected nozzles use parent block thrust: `3 * 1234 = 3702`, actual `3702`.
- Selected VFX active and visible outside block bounds: `3/3`.
- Exhaust direction opposite force direction: min dot `1`.
