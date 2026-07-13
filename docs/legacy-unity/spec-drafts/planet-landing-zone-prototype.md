# Draft Spec: planet-landing-zone-prototype

Status: draft only. Promote only after waypoint navigation, docking approach assist, and basic ship-to-ground transition are stable.

## Purpose

Prototype the smallest useful planet/landing-zone slice without building a full planet system. The goal is to test approach, landing-area scale, lighting, and transition into a ground/outpost area.

## In Scope

- One simple planet or moon visual as a large primitive or low-poly sphere.
- One marked landing zone or pad.
- Navigation target for approach to the landing zone.
- Simple final approach/arrival logic reused from docking assist where possible.
- Optional gravity disabled or extremely simplified in the first landing-zone version.
- Visual city/outpost lights as emissive placeholder dots or simple primitives near the landing zone.
- Clear transition point into ground/outpost prototype.

## Out of Scope

- No procedural planet terrain.
- No full spherical world navigation.
- No atmosphere.
- No real city simulation.
- No large open-world streaming.
- No orbital mechanics unless gravity research is explicitly promoted first.
- No seamless full planet landing requirement.

## Acceptance Criteria

- A visible planet/moon body exists in the prototype scene.
- A landing-zone marker can be selected as a nav target.
- Autopilot or approach assist can guide the ship near the landing zone target.
- Landing-zone lights are visible from a useful distance.
- Player can transition to a small ground/outpost area at the landing zone.
- The implementation documents whether gravity is disabled, simplified, or inherited from a gravity research spec.

## Risks

Planets can expand into terrain, atmosphere, city, and streaming work. Keep this spec focused on a single visible landing-zone test and reuse existing navigation systems.
