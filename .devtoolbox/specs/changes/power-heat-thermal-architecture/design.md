# Design: Power and Heat Architecture

## Thermal Model

Use a simple first-pass model:

```text
temperature += heatGenerated / heatCapacity * deltaTime
temperature -= coolingRate * deltaTime
```

Values should be inspector-tunable and stable enough for tests.

## Power Model

Start with declared power draw and available power budget diagnostics. A real power network is deferred.

## Gameplay Hooks

Temperature can later affect engine thrust, weapon fire rate, RCS reliability, or shutdown states.

## Risks

Thermal systems can become bookkeeping-heavy. The first slice should focus on data shape, diagnostics, and one optional overheat effect.
