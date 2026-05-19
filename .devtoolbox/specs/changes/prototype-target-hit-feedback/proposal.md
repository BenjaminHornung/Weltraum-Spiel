# prototype-target-hit-feedback

## Why

The prototype can fire visible projectiles, but there is no target feedback yet. We need a minimal way to confirm that shooting while flying feels usable before designing larger combat systems.

## What

Add simple target dummies and hit feedback for projectile testing. This is a prototype-only combat slice, not a full damage model.

## Included

- Bootstrap-created or easily placed target dummies.
- Projectile collision or trigger hit detection against dummies.
- Visible hit feedback such as a short flash, color change, or small particle burst.
- Optional simple dummy health for repeated hit testing.
- Debug/test evidence.

## Out of Scope

- Enemy AI.
- PvP or networking.
- Ship damage systems.
- Weapon inventory or weapon selection.
- Explosions beyond minimal feedback.
- Scoring, missions, or progression.

## Success Criteria

- A projectile can visibly hit a target dummy.
- Hit feedback is obvious enough during flight.
- Projectile lifetime cleanup still works.
- The change remains simple and prototype-only.
