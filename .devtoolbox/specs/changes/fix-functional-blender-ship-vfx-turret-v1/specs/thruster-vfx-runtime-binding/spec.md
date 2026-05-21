# Capability: Thruster VFX Runtime Binding

## Requirement
Main thruster and RCS VFX SHALL originate from imported Blender functional nozzle markers in the default runtime mode. Root fallback nozzles and generated RCS positions SHALL NOT be used in `ImportedDemoScoutFunctionalDefault`.

## Scenarios
- Given default imported mode and a valid `THRUST_NOZZLE_MAIN*`, when main throttle is greater than zero, then `EngineVfxController.Nozzle` references the imported main nozzle and visible particle/light/ring output is emitted at that nozzle.
- Given default imported mode and missing imported main nozzle, when the ship is built or throttle is applied, then no root `EngineNozzle` fallback is created and the runtime reports missing main nozzle state.
- Given imported RCS nozzles exist, when an RCS translation or rotation pulse is applied, then at least one RCS VFX object becomes active at an imported `RCS_NOZZLE_*` marker within tolerance.
- Given RCS VFX children are named `VFX`, `PreviewRcsThrusterVfx`, or `RcsThrusterVfx`, when runtime RCS VFX is resolved, then all supported names are recognized or normalized to the runtime VFX child contract.
- Given default imported mode, when RCS nozzles are refreshed, then old generated `RCS_Top`, `RCS_Left`, `RCS_Right`, or `RCS_Bottom` transforms are not selected as active runtime VFX origins.
- Given a main or RCS nozzle marker direction is used, then `nozzle.forward` is treated as force direction and plume/VFX renders opposite that direction; documentation and tests reflect this contract.
