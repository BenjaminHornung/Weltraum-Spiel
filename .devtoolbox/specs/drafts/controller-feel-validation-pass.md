# Draft Spec: controller-feel-validation-pass

Status: draft only. Promote to `.devtoolbox/specs/changes/controller-feel-validation-pass/` before implementation.

## Purpose

The prototype has controller mappings, but hardware feel still needs manual validation. Spaceflight with persistent throttle, RCS, SAS, camera orbit, and weapon firing must feel understandable on a real gamepad before more systems depend on those controls.

## In Scope

- Physically test gamepad controls on at least one connected controller.
- Tune dead zones, sensitivity, and response curves for attitude and RCS input.
- Verify trigger behavior for persistent throttle increase/decrease.
- Verify fire, RCS toggle, SAS toggle, precision mode, and camera controls.
- Add in-prototype debug readout for active gamepad input values if needed.
- Update README with verified controller mapping and known limitations.

## Out of Scope

- No full input rebinding UI.
- No settings menu.
- No per-controller database.
- No accessibility pass.
- No Steam Input integration.

## Acceptance Criteria

- Controller input is manually verified in Play mode.
- Stick dead zones prevent drift while still allowing fine control.
- Right/left triggers adjust throttle predictably.
- Player can fly, rotate, fire, toggle RCS, and toggle SAS on controller without keyboard.
- Mouse/keyboard controls remain unchanged.
- README clearly distinguishes verified mappings from known limitations.

## Risks

- Unity Input System controller labels may differ between Xbox, PlayStation, and generic controllers.
- This should not block gameplay development forever; if controller hardware is not available, document the blocker and keep the spec unimplemented.
