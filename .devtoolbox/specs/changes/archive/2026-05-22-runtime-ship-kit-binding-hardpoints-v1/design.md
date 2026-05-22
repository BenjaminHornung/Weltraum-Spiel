# Design: Runtime ShipKit Hardpoint Binding v1

## Reuse

This change extends `PrototypeShipSocket`, `PrototypeImportedShipBinder`, and `PrototypeFunctionalShipBinder` instead of creating a parallel part contract. Imported `CONN_*`, `HARDPOINT`, weapon-base, and connector sockets remain inferred by the existing socket utility.

## Binding Layer

`PrototypeShipHardpointBinder` scans a configurable root, optionally infers missing socket components, filters hardpoint sockets, deduplicates them by stable id/type/direction/position, and ensures one `PrototypeShipHardpoint` record per bound hardpoint. Repeated `BindNow` calls update existing records and report zero newly created bindings.

## Generated Fallback

Generated primitive ships keep their existing generated gameplay parts. After mass descriptors are configured, the hardpoint binder creates a `GeneratedConnectorRig` under the ship root with unit-scale connector sockets derived from generated module descriptor bounds. This keeps generated fallback support available and allows future builder systems to see generated connector candidates through the same hardpoint API as imported assets.

## Diagnostics

Bind reports expose found, bound, created, duplicate, skipped, first-hardpoint, and warning counts. `PrototypeImportedShipBinder` forwards hardpoint report data so imported demo ships can be tested without hierarchy-specific paths.

## Risks

- Imported assets may contain legacy and canonical aliases for the same physical connector; dedupe prevents duplicate hardpoint records.
- Generated connector sockets are builder metadata only and must not alter thrust, RCS, weapon, mass, or fallback behavior.
