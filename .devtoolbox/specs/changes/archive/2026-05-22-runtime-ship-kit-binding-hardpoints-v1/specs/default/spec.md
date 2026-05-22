# Capability: Runtime ShipKit Hardpoint Binding

## Requirements

- Imported ShipKit hardpoint sockets are discoverable through `PrototypeShipSocket` metadata and bound to explicit runtime `PrototypeShipHardpoint` records.
- Generated primitive fallback ships expose builder hardpoint sockets through the same runtime binding layer.
- Binding is idempotent: a second bind updates existing records and does not create duplicate hardpoint components or connector sockets.
- Bind reports include found, bound, created, duplicate, skipped, and warning counts.
- The implementation must not hardcode demo scout/cargo hierarchy paths or remove generated fallback support.

## Scenarios

- Binding an imported demo scout reports and binds at least one builder hardpoint, then a second bind creates zero new hardpoint records.
- Building the generated primitive fallback creates generated connector sockets, binds them, keeps generated RCS/main-thruster fallback behavior active, and remains idempotent.
- Runtime docs describe the hardpoint binding/reporting contract and its relationship to generated fallback support.
