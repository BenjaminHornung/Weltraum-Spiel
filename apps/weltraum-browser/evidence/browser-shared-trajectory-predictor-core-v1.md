# Browser Shared Trajectory Predictor Core v1 Evidence

Status: **PASS**

## Browser boundary

- Normal route: `/`
- TestBridge own property / present in window: `false` / `false`
- Dynamic Vite import: `/src/trajectory/index.ts`
- Node / browser: `v22.23.1` / `chromium` (real browser: `true`)
- Universe tick rate: `120 Hz`
- Console / page / request / HTTP errors: `0/0/0/0`

## Hestia near-circular GravityCoast

- Status / frame: `Completed` / `frame:body-inertial.planet.hestia`
- Tick range: `0 -> 678136`
- Segment / policy: `GravityCoast` / `VelocityVerlet`
- Integration steps / samples: `5846/99`
- Orbital radius / initial speed: `8682000 m` / `9653.045873327917 m/s`
- Circular closure within tolerance / distance: `true` / `13.461120594412153 m`
- Finite output: `true`

## Hestia ConstantInertialAcceleration and ImpulseDeltaV

- Status / tick range: `Completed` / `0 -> 1200`
- Segment order: `ConstantInertialAcceleration` -> `ImpulseDeltaV`
- Acceleration policy / steps: `RungeKutta4` / `100`
- Requested acceleration: `{"x":0,"y":0.1,"z":0} m/s^2`
- Zero-acceleration / accelerated final position: `{"x":8681463.371780764,"y":99997.93968571124,"z":0} m` / `{"x":8681463.371781822,"y":100002.93963421155,"z":0} m`
- Observed acceleration position effect: `{"x":0.0000010579824447631836,"y":4.9999485003063455,"z":0} m`
- Zero-acceleration / accelerated final velocity: `{"x":-107.32429550371599,"y":9999.381909937707,"z":0} m/s` / `{"x":-107.32429496979192,"y":10000.381889339566,"z":0} m/s`
- Observed acceleration velocity effect: `{"x":5.339240658486233e-7,"y":0.9999794018585817,"z":0} m/s`
- Impulse tick / delta-v: `1200` / `{"x":0,"y":10,"z":0} m/s`
- Impulse pre / post velocity: `{"x":-107.32429496979192,"y":10000.381889339566,"z":0} m/s` / `{"x":-107.32429496979192,"y":10010.381889339566,"z":0} m/s`
- Observed impulse velocity delta: `{"x":0,"y":10,"z":0} m/s`
- Impulse preserves position / mass: `true` / `true`
- Impulse sample reasons: `ImpulsePostState`, `Final`
- Finite / recursively frozen output: `true` / `true`

## Swept spherical hazard

- Status / frame: `Completed` / `frame:body-inertial.planet.hestia`
- Segment / policy: `GravityCoast` / `SemiImplicitEuler`
- Swept tick range: `0 -> 120`
- Hazard / entry / exit fractions: `hazard:hestia.browser-swept` / `0.25` / `0.75`
- Minimum center distance / clearance: `0 m` / `-1 m`
- Started inside / tangent / finite: `false` / `false` / `true`

## Determinism and approximation

- Source model: `InertialLinearPointMass` at tick `0`
- Repeated prediction: `trajectory:hestia.acceleration-impulse.v1`
- Canonical signature: `fnv1a32:d19caf90`
- Signature / complete canonical result identical: `true` / `true`

## Scope

- Normal-route Chromium execution without TestBridge and a dynamic Vite import of the public trajectory barrel.
- Renderer-independent Hestia BodyInertial predictions for near-circular GravityCoast, ConstantInertialAcceleration, exact ImpulseDeltaV and one swept spherical hazard.
- Finite immutable results, explicit integrator policies, 120-tick timing, hazard facts and canonical repeat equality.

## Non-goals

- No FlightController, navigation, autopilot, map, renderer, HUD, runtime loop, timewarp or background-simulation integration.
- No SOI transition, patched conics, N-body gravity, atmosphere, fuel use, variable mass, body-fixed thrust or gameplay safety decision.
- No screenshot because this pure core slice intentionally has no visible representation.

## Focused verification

- Command: `npm run test:e2e -- tests/e2e/trajectory-predictor-core.spec.ts`
- Expected: one focused Playwright test passes in real Chromium and writes deterministic timestamp-free JSON and Markdown evidence
- Observed: **PASS**
- Screenshot: not captured: renderer-independent core with no visible representation
