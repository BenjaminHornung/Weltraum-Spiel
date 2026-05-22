# Design: Module Mass, COM, and Inertia

## Model

Each physical ship module should expose dry mass, optional fuel mass, local position, and an approximate box size. The prototype can keep this data on lightweight MonoBehaviours or generated module descriptors.

## Center Of Mass

Calculate local COM as:

```text
centerOfMass = sum(moduleMass * moduleLocalPosition) / totalMass
```

The Rigidbody `centerOfMass` should be updated from this local value. Existing collider-based COM must not be the source of truth once this spec is implemented.

## Inertia Approximation

For box-like modules, use the standard cuboid approximation:

```text
Ixx = 1/12 * m * (h^2 + d^2)
Iyy = 1/12 * m * (w^2 + d^2)
Izz = 1/12 * m * (w^2 + h^2)
```

Then apply a parallel-axis contribution from module offset relative to COM. Keep the implementation simple and inspectable.

## Integration

`ShipStats` or a new mass-model component should publish mass properties to `ShipPhysicsCore` and the Rigidbody. `PrototypeBootstrap` should create module descriptors for generated placeholder parts.

## Risks

Incorrect local/world conversion can make thrusters appear wrong. Verification must compare calculated COM against known symmetric and asymmetric test ships.
