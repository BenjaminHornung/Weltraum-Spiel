# Capability: Browser Acceleration-Based Autopilot Transit

## Propulsion and occupant requirements
- The system MUST expose a serializable, versioned propulsion capability snapshot containing main thrust, effective braking thrust, structural, sustained thermal, peak linear, angular acceleration, and angular velocity limits; optional cruise, fuel, heat, and namespaced extension metadata are permitted.
- The system MUST provide deterministic generic fixtures for normal crewed scout, high-thrust crewed ship, underpowered crewed cargo ship, and high-g crewless drone without selecting concrete engine technology.
- Usable acceleration MUST be derived from current mass, available thrust, structural, thermal, peak, policy, and applicable occupant limits. A single global acceleration constant and non-finite drone limit MUST NOT be final authority.
- Human defaults MUST target 1.0 g, identify 0.8 g as the comfort floor, and cap sustained/peak acceleration at 1.5 g unless explicitly configured lower. Crewless drone acceleration MUST ignore biological limits but remain finite and physically bounded.

## Policy requirements
- The system MUST support `CrewComfort`, `CrewSprint`, `Economy`, `DroneSprint`, and `Custom`.
- Existing `Safe`, `Balanced`, and `Fast` identifiers MUST remain deterministic aliases for approximately 0.8 g CrewComfort, approximately 1.0 g CrewComfort, and human-capped CrewSprint respectively.
- Every locked policy MUST carry target acceleration or fraction, maximum acceleration, maximum jerk, optional peak speed, coast allowance/fraction, minimum-time request, braking reserve, turn behavior, and gravity-floor behavior.
- Economy MUST produce lower peak velocity and lower total delta-v or modeled fuel than CrewSprint, with longer travel and meaningful coast where appropriate. It MUST NOT claim a low-throttle efficiency bonus.

## Locked planning requirements
- Every executable route MUST contain a stable versioned motion profile and per-segment motion constraints, and these MUST participate in `planHash`.
- Selecting or changing a policy MUST require a newly planned route/hash. Runtime mass/fuel changes MAY change physically available acceleration but MUST NOT mutate the locked profile/hash.
- The executor MUST NOT replace, mutate, or silently replan the route.
- Waypoint velocity constraints MUST be deterministic and account for turn angle, control authority, clearance, and next-segment braking. Sharp corners MUST be slower than direct segments, and obstacle clearance MUST not regress.

## Execution requirements
- Runtime phases MUST use `AlignForBurn`, `Accelerate`, `Coast`, `Flip`, `Brake`, `TerminalCapture`, and `Holding`.
- Minimum-time CrewSprint/DroneSprint MUST accelerate at usable maximum, avoid low legacy cruise caps, flip physically before reverse burn, and brake from a dynamic stopping-distance calculation using projected velocity, terminal/waypoint velocity, distance, braking ability, flip reserve, and margin.
- Main thrust MUST apply only along actual ship-forward under the existing +X axis convention. Requested burn direction MUST drive RCS/SAS alignment, and full throttle MUST be blocked while badly misaligned. Position, velocity, and orientation MUST never snap.
- Direct rest-to-rest routes without a real cap SHOULD approximate half-distance acceleration and half-distance braking, but the switch MUST NOT be hardcoded to the midpoint.
- Terminal Capture and Holding MUST continue through `FlightController` with the existing distance and speed gates. Station keeping MUST remain controller-integrated.

## Telemetry and evidence requirements
- Core telemetry MUST include alignment, requested/actual thrust direction, flip state/angle, proper acceleration, peak/average powered g, time below comfort and above maximum, phase durations, coast fraction, gravity coverage, fuel/delta-v, occupant mode, and physical limits.
- Human execution MUST never exceed the configured maximum; underpowered craft MUST report comfort shortfall without synthetic acceleration. Flip, coast, terminal capture, and holding MUST not fake crew gravity.
- Same fixed-step input MUST produce identical hashes, phase timeline, and metrics.
- TestBridge MUST remain absent by default and available only with `?testBridge=1`.

## Safety scenarios
- Divergence, low fuel, no authority, and insufficient braking MUST remain explicit fail-closed outcomes with the locked hash retained and no silent replacement.
- No target/waypoint snap or velocity-zero shortcut is permitted.
- Multi-obstacle routes MUST remain clear and arrive when classified Pass.
- Existing terminal speed/distance gates and completed-plan hash behavior MUST remain unchanged.

## Acceptance scenarios
1. Legacy IDs resolve deterministically.
2. Human CrewSprint stays at or below 1.5 g; CrewComfort reaches approximately 1.0 g when supported.
3. Underpowered human craft reports time below 0.8 g; a drone may exceed 1.5 g but not physical limits.
4. Direct 500/1000/2500 m CrewSprint executes align/accelerate/flip/brake with negligible coast and 2500 m is substantially faster than 123 s.
5. CrewComfort is slower than CrewSprint but materially faster than the legacy capped profile.
6. Economy is slower than CrewSprint with lower peak speed and lower delta-v/modeled fuel.
7. Terminal, hash, no-replan, no-snap, no-zero, physical-flip, obstacle, ExpectedFail, station-keeping, and determinism regressions all pass.