# architecture-module-mass-com-inertia

## Why

A modular spaceship game only becomes interesting when module placement affects flight. The current prototype has a total mass value, but module positions do not yet drive Rigidbody center of mass or rotational inertia.

This change makes mass distribution a first-class prototype behavior so heavy tanks, engines, hull pieces, and future damaged modules can visibly change ship handling.

## What

Introduce a module mass model that can calculate:

- total ship mass,
- dry mass plus fuel mass per module,
- local center of mass from module positions,
- approximate inertia tensor from simple box-like module shapes,
- debug diagnostics for COM and inertia.

## Out of Scope

- No ship editor UI.
- No final asset pipeline.
- No damage detachment yet.
- No full rigid-body decomposition.
- No complex mesh-based inertia calculation.

## Success Criteria

- Module masses and local positions contribute to total mass.
- Rigidbody center of mass is set from module mass distribution.
- Basic inertia approximation makes larger/wider ships rotate more slowly than compact ships.
- Fuel mass can participate once the fuel mass-flow spec is implemented.
- Debug overlay/docs show how COM and inertia are calculated.
