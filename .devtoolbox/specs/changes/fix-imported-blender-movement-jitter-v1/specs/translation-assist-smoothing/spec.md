# translation-assist-smoothing

## Requirements

- Translation auto-stop must never apply while manual translation input is held.
- Translation auto-stop must expose diagnostics for active state, force, manual input held, and release grace.
- If auto-stop is needed after input release, it starts after a short grace and fades in smoothly.
- RCS StablePrototype pure translation must remain COM-force-only and must not introduce torque.

## Expected Behavior

Held Translation W/A/S/D/H/N produces stable force direction with frame-to-frame dot above the tolerance. Velocity direction does not flip during held input. External assist sources do not override manual translation.