# imported-visual-movement-jitter

## Requirements

- The imported visual root must remain a stable child of `PrototypeShip` during normal movement.
- `ImportedShipVisual` and the active imported visual instance must not be reparented, rescaled, or repositioned during steady translation.
- Functional socket rig rebuilds must not happen during steady movement.
- Evidence must compare ship world delta, imported visual root world delta, imported visual local transform, and functional socket rig transform.

## Expected Behavior

For ImportedDemoScout translation, the imported visual root local position, local rotation, and local scale remain constant. Its world delta matches the ship delta within a small tolerance. Bounds and nozzle refresh counters do not continuously increment during steady movement.