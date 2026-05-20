# Design: Prototype RCS Force Allocator

## Review Input Accepted

The external review is correct that the current RCS code applies commands independently. The recent COM counter-force fixes make pure translation and pure attitude stable, but they do not solve the deeper issue that multiple commands can fire the same nozzle more than once or create axis strength differences based on nozzle count.

## Prototype Allocator Model

The allocator should live inside `RcsThrusterController` for this phase. It should reuse the existing transform-driven nozzle model:

- nozzle forward is force direction,
- nozzle position relative to `Rigidbody.worldCenterOfMass` determines torque contribution,
- each nozzle has a max thrust from `RcsThrusterBlock.Thrust` or the controller fallback force,
- each nozzle receives exactly one throttle value per physics step.

For each nozzle, calculate:

```text
force_i = nozzleForward_i * maxThrust_i
torque_i = cross(nozzlePosition_i - COM, force_i)
```

The allocator should build desired world-space targets:

```text
desiredForce = localTranslationCommand transformed to world * TranslationForce
desiredTorque = localAttitudeCommand transformed to world * derivedTorqueAuthority
```

`derivedTorqueAuthority` may be computed from existing `attitudeForce` and a representative lever arm so this spec does not add a new final tuning model.

## Allocation Strategy

Keep this implementation intentionally simple and dependency-free. A bounded greedy or iterative least-squares-like approach is acceptable as long as it satisfies the prototype acceptance criteria:

1. Build candidates for active nozzles.
2. Score each available nozzle by how much its wrench contribution reduces weighted force/torque residual.
3. Assign throttle in `[0, remainingBudget]`.
4. Iterate a small fixed number of times.
5. Apply one `AddForceAtPosition` call per selected nozzle.

Weights should favor:

- torque cancellation for pure translation,
- force cancellation for pure attitude/SAS,
- reasonable response for combined commands.

## Diagnostics and VFX

Existing debug values should remain usable:

- active nozzle count,
- active nozzle IDs,
- last translation command,
- last attitude/SAS command,
- total applied RCS force,
- total estimated torque.

If the allocator introduces new internals, expose only minimal additional read-only diagnostic properties needed by the debug overlay or test probes.

## Non-goals

This allocator is not the final modular flight-computer solver. It does not need a perfect quadratic optimizer, per-axis UI tuning, automatic RCS placement warnings, or exact future combat-grade balancing.

## Risks

- Greedy allocation can fail in asymmetric nozzle layouts; tests should focus on the generated prototype ship and basic moved/removed-nozzle resilience.
- Existing attitude feel may change because `attitudeForce` becomes a target-derived authority rather than simply every matching nozzle firing.
- Debug labels that call force values `move N` or `attitude N` may remain approximate until a later diagnostics polish spec.
