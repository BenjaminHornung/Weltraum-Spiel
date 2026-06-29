# Capability Spec: Browser Proving Ground Matrix v1


## Requirements

### PG-001
The browser app SHALL run scenario tests without Unity.

### PG-002
Every scenario SHALL report final status, final distance, final speed, fuel used, initial/final plan hash and invalidation reasons.

### PG-003
Divergence SHALL set `replanRequired` without replacing the locked plan.

### PG-004
No-authority and insufficient-fuel SHALL fail explicitly rather than silently completing.

