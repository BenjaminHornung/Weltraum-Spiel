# combat-impact-damage-physics

## Why

Damage should change how a ship behaves, not only lower a health number. If RCS, engines, fuel tanks, and structure can be damaged, combat feeds back into physics and ship design.

## What

Define an impact and module-damage model based on hit point, relative velocity, impulse, module hit, and degraded physical capability.

## Out of Scope

- No full combat balance.
- No armor economy.
- No part detachment yet unless explicitly scoped later.
- No visual destruction pipeline.
- No multiplayer synchronization.

## Success Criteria

- Impacts can produce impulse and damage events.
- Hits can be associated with a module or nearest module proxy.
- Damaged thrusters can lose max thrust or fail.
- Damaged tanks can leak or lose fuel capacity in later slices.
- Damage effects are visible in diagnostics and remain deterministic enough to test.
