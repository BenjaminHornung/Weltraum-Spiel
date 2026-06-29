# Browser UI Input HUD Foundation v1

## Summary

Create first browser-native HUD/Input/Telemetry foundation using snapshots and commands, not direct simulation mutation from UI widgets.

## Motivation

The project is moving from a Unity prototype/reference implementation toward a browser-first Three.js/TypeScript mainline. Unity sources are read as feature intent and historical evidence, not as implementation templates.

## Scope

See `design.md`, `tasks.md`, and the capability spec under `specs/`.

## Non-goals

- No Unity Editor startup.
- No Unity installation requirement.
- No 1:1 MonoBehaviour port.
- No deletion of Unity legacy sources in this change.
