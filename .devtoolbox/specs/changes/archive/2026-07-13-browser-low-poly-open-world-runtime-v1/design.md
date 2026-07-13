# Design: Browser Low-Poly Open World Runtime v1


## Scope

This is an architecture and first smoke-test change, not a full open-world implementation.

## Core concepts

```text
WorldCoordinate
LocalFrame
FloatingOriginService
ChunkId
ChunkMetadata
SimulationBubble
RenderInstanceBatch
LodBand
```


## Cross-cutting rules

- Browser code must be runnable with Node/Vitest/Playwright gates.
- Gameplay truth must not live in Three.js scene objects.
- Core logic must be deterministic where tests depend on it.
- Legacy Unity behavior must be converted into feature intent before implementation.
- Known Unity bugs and documentation drift must be captured as bug traps.
