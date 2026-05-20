# Capability: Combat Flight Diagnostics

## ADDED Requirements

### Requirement: Recoil diagnostics are visible

The prototype diagnostics SHALL expose weapon recoil and stabilization values through the existing debug UI sampling path.

#### Scenario: Last recoil values are displayed

- GIVEN a weapon has fired
- WHEN the debug overlay or console is visible
- THEN it can display last weapon recoil impulse
- AND estimated recoil angular impulse.

#### Scenario: Stabilization values are displayed

- GIVEN weapon stabilization is active or recently limited
- WHEN diagnostics are sampled
- THEN they can display weapon stabilization torque request, authority status, actual RCS torque, and residual RCS torque.

### Requirement: Authority limits are honest

Diagnostics SHALL distinguish requested stabilization from actual actuator output.

#### Scenario: No RCS authority

- GIVEN weapon stabilization has a pending recoil request
- AND RCS is disabled or unavailable
- WHEN the controller updates
- THEN stabilization diagnostics report the authority limitation
- AND actual RCS torque remains zero.

#### Scenario: Residual torque remains visible

- GIVEN the allocator cannot satisfy the requested stabilization torque
- WHEN allocation completes
- THEN residual RCS torque remains non-zero and visible in diagnostics.
