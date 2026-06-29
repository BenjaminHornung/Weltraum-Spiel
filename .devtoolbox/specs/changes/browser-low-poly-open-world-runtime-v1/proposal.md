# Browser Low-Poly Open World Runtime v1

## Summary

Plan the browser-native large-map runtime around floating origin, local frames, chunk registry, LOD, instancing and simulation bubbles.

## Motivation

The project is moving from a Unity prototype/reference implementation toward a browser-first Three.js/TypeScript mainline. Unity sources are read as feature intent and historical evidence, not as implementation templates.

## Scope

See `design.md`, `tasks.md`, and the capability spec under `specs/`.

## Non-goals

- No Unity Editor startup.
- No Unity installation requirement.
- No 1:1 MonoBehaviour port.
- No deletion of Unity legacy sources in this change.
