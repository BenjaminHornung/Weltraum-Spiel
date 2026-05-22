# power-heat-thermal-architecture

## Why

Power and heat can turn module choices into meaningful gameplay: sustained fire, RCS use, engine burns, and damaged cooling should all have consequences later.

## What

Define a lightweight module power/heat architecture with power draw, heat generation, heat capacity, cooling/radiator values, temperature limits, and efficiency/degradation hooks.

## Out of Scope

- No full electrical grid simulation.
- No UI-heavy resource management.
- No final radiator art or animations.
- No economy/crafting systems.
- No mandatory implementation in the current flight prototype.

## Success Criteria

- Modules can declare power draw and heat generation.
- Heat accumulates and dissipates with simple deterministic formulas.
- Overheat can reduce module efficiency or disable behavior later.
- Debug output can show temperature and thermal state.
- The model stays optional and does not affect current prototype unless enabled.
