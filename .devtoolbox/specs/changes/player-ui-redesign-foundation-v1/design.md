# Design: Player UI Redesign Foundation v1

## Source Draft

The original package draft is superseded by this complete change tree. Its
durable UX source is `docs/ux/player-ui-redesign-foundation-v1.md`.

## UI Direction

The player UI should expose the current mode, the next useful action and concise
navigation/autopilot status without depending on debug-only panels. Debug UI can
remain available for development, but player tasks should not require it.

## Boundaries

- Player UI consumes ViewModels/Commands, not planner internals.
- Debug UI may expose diagnostics, but must remain separable.
- Screenshot evidence is required for visible UI implementation slices.
- This foundation does not change autopilot behavior.

## This Setup Slice

Only documentation and DevToolbox planning artifacts are created here. Future UI
runtime work needs its own implementation slice, screenshots and test evidence.
