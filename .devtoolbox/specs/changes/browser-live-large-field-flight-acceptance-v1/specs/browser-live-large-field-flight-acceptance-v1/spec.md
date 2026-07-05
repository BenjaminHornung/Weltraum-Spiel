# Browser Live Large Field Flight Acceptance v1 Spec

## Requirements

### Normal Runtime Only

The acceptance test shall load `/` and shall not load `/?testBridge=1`.

### Player HUD Interaction

The acceptance test shall select `range-500m`, `range-1000m`, and `range-2500m` through visible target buttons in the player HUD.

### Preview Evidence

The acceptance test shall verify selected-target text, route preview text, target distance formatting, and radar auto-range buckets from visible HUD elements.

### Live Flight Evidence

The acceptance test shall select `range-500m`, click the visible engage button, wait for the normal browser runtime to advance, and prove that player-facing distance decreases by a meaningful amount.

### Guardrails

The acceptance test shall verify TestBridge remains absent, debug HUD remains hidden, Demo Scout GLB is the active visual source, and no warning/replan/error HUD leakage appears during the accepted flight.
