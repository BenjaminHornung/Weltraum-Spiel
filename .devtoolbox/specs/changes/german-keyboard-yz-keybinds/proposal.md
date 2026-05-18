# german-keyboard-yz-keybinds

## Why

The prototype currently documents and implements `Y` as the full-throttle key. On German keyboard layouts, `Y` and `Z` can be swapped depending on whether Unity reports physical or layout-aware key positions. This makes a critical flight control feel unreliable for the user testing the prototype.

## What

Make the full-throttle control tolerant of the German Y/Z swap by accepting both `Y` and `Z` for full throttle. Update the README, overlay/help text if present, and spec documentation so this behavior is explicit.

## Out of Scope

- No full keybinding/remapping UI
- No input profile persistence
- No localization system
- No changes to throttle physics
- No changes to SAS, RCS, gun, or camera behavior
- No Input Actions asset rewrite

## Success Criteria

- `Y` still sets throttle to 100%.
- `Z` also sets throttle to 100% for German keyboard compatibility.
- `X` still cuts throttle to 0%.
- Documentation lists the full-throttle key as `Y/Z` with a German keyboard note.
- The Unity scripts compile with 0 script errors.
- The DevToolbox spec validates successfully.
