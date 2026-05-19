# Test Protocol: combat-impact-damage-physics

Date: 2026-05-19

## Unity MCP script validation

Validated changed scripts with Unity MCP `validate_script(level=standard)`:

- `Assets/Scripts/Prototype/PrototypeImpactEventData.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeModuleDamageState.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/RcsThrusterBlock.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/ShipPhysicsCore.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/Projectile.cs`: 0 errors, 1 analyzer warning about string concatenation
- `Assets/Scripts/Prototype/ModuleMassDescriptor.cs`: 0 errors, 0 warnings
- `Assets/Scripts/Prototype/PrototypeDebugOverlay.cs`: 0 errors, 2 analyzer warnings about Rigidbody/FixedUpdate and string concatenation

Result: PASS. No Unity MCP validation errors.

## Runtime probes

### Hit event data

Unity MCP `execute_code` projectile hit probe:

```text
reported=True
hasHit=True
hasImpact=True
module=RCS_Top
speed=100.000
impulse=100.000
damageApplied=2.000
integrity=0.980
impulseApplied=True
coreImpactCount=1
coreImpulse=100.000
coreTorqueImpulse=68.143
```

Result: PASS. Projectile hit data populates impact event, module hit, damage, and impulse diagnostics.

### Damaged RCS authority

Unity MCP `execute_code` RCS authority probe after script refresh/domain reload:

```text
damagedRcsBlocks=4
blockMultiplier=0.100
blockThrust=650.000
nominalForce=8999.897
damagedForce=1950.000
forceRatio=0.217
nominalTorque=5842.458
damagedTorque=1234.190
torqueRatio=0.211
```

Result: PASS. Damaged RCS module state reduces effective physical force and torque authority.

### Damage diagnostics

Unity MCP `execute_code` diagnostics probe:

```text
state=damaged
module=RCS_Top
totalModules=9
damagedModules=1
worstModule=RCS_Top
worstIntegrity=25.000
worstCapability=0.250
blockMultiplier=0.250
blockThrust=1625.000
```

Result: PASS. Diagnostics expose degraded state and RCS capability.

## Automated tests

Unity MCP EditMode test run:

```text
job_id=8d302b22aed14347bc31efc240d1c4bb
mode=EditMode
total=30
passed=30
failed=0
skipped=0
durationSeconds=1.0430744
resultState=Passed
```

Result: PASS.

## dotnet verification

Command:

```powershell
dotnet build 'Weltraum Spiel.sln'
```

Result: PASS, exit code 0. Existing warnings remain: MSB3277 Unity reference conflicts and CS0649 serialized/default-value warnings.

Command:

```powershell
dotnet test 'Weltraum Spiel.sln'
```

Result: PASS, exit code 0. Restore completed; no test assemblies reported additional dotnet test output.
