# Capability Spec: Browser Navigation Autopilot v2 v1


## Requirements

### NAV-001
Planner SHALL produce a deterministic RoutePlan with stable planHash.

### NAV-002
Executor SHALL consume a locked RoutePlan and SHALL NOT replace it.

### NAV-003
Route invalidation SHALL be explicit telemetry.

### NAV-004
TargetDescriptor SHALL distinguish at least waypoint/point target now and leave room for landing/docking/cargo/orbit targets later.

### NAV-005
Planner SHALL reject unsafe or impossible requests with structured reasons.

