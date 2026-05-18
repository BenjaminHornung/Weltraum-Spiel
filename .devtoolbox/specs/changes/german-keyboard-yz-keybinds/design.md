# Design: German Keyboard Y/Z Keybinds

## Scope

This change only adjusts the prototype's full-throttle key handling and documentation. The flight model, throttle ramping, SAS, RCS, camera, and weapon behavior remain unchanged.

## Input Strategy

The prototype uses direct Unity Input System polling. For full throttle, the controller should accept either `Keyboard.current.yKey` or `Keyboard.current.zKey` in the same frame. This keeps the existing `Y` behavior while making the control reliable on German keyboards where the expected key may be reported as `Z`.

The cut-throttle key remains `X`. Increase/decrease throttle remain `Left Shift` and `Left Control`.

## Documentation Strategy

Document the full-throttle key as `Y/Z` and add a short note that both keys are accepted for German keyboard layout compatibility. Do not introduce a general keybinding table rewrite beyond the necessary key name update.

## Risks

- Unity Input System key reporting can vary between physical and layout-aware keyboard modes. Supporting both keys avoids relying on one interpretation.
- Adding `Z` as an alias slightly expands the reserved control surface. This is acceptable for the prototype because `Z` is not currently assigned to another gameplay action.
- A future keybinding/remapping system should replace this alias approach, but that is outside this slice.
