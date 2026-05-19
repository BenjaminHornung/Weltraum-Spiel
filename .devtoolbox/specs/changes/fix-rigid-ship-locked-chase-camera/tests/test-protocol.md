# Test Protocol: fix-rigid-ship-locked-chase-camera

Date: 2026-05-19

## Unity MCP Validation

- Active Unity instance: `Weltraum Spiel@49c909b3e97ba6e8`
- Unity version: `6000.4.7f1`
- Validated scripts:
  - `Assets/Scripts/Prototype/SimpleFollowCamera.cs`: `validate_script` standard, 0 errors
  - `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: `validate_script` standard, 0 errors
- Refresh/compile: `refresh_unity` with script compile requested, editor returned to ready state
- Console after compile/probe: `read_console` for errors/warnings returned 0 entries

Main-agent revalidation after reset-key cleanup:

- `Assets/Scripts/Prototype/SimpleFollowCamera.cs`: `validate_script` standard, 0 errors, 1 non-blocking advisory
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: `validate_script` standard, 0 errors, 2 non-blocking advisories
- Unity console after final clear/read: 0 error/warning entries

## Deterministic Anchor Probe

Temporary editor objects were created through Unity MCP `execute_code`, then destroyed without saving scene changes.

Result:

```text
mode=ChaseLocked, posErrorA=0.000000, rotErrorA=0.000000, posErrorB=0.000000, rotErrorB=0.000000, diagnosticAnchor=0.000000
```

Main-agent follow-up probe after the reset-key cleanup:

```text
ok=True; posErrorA=0.000000; rotErrorA=0.000000; posErrorLook=0.000000; posErrorB=0.000000; rotErrorB=0.000000; anchorError=0.000000; reset=ChaseLocked/0.000/0.000
```

The follow-up probe verifies that changing local look yaw/pitch does not move the Mode 0 anchor, that a large target movement is corrected in one `LateUpdate`, and that reset returns to `ChaseLocked` with zero look offsets.

## Reset Key Compatibility

`WasResetPressed` now checks `backquoteKey`, `backslashKey`, `quoteKey`, and `digit3Key` so the debug reset remains usable across common US/German keyboard mappings for backquote/#-style input.

## Rigidbody Interpolation Check

`PrototypeShip` was not present in the current editor scene, so the runtime bootstrap interpolation check could not be executed from the loaded scene.

Source check through Unity MCP confirmed the interpolation assignment remains in both bootstrap and controller paths:

- `Assets/Scripts/Prototype/PrototypeBootstrap.cs`: `shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;`
- `Assets/Scripts/Prototype/PlayerShipController.cs`: `shipRigidbody.interpolation = RigidbodyInterpolation.Interpolate;`
