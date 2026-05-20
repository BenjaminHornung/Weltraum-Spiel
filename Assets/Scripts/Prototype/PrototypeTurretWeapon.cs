using System;
using UnityEngine;

[RequireComponent(typeof(PrototypeTurretMount))]
public class PrototypeTurretWeapon : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private PrototypeTurretMount mount;
    [SerializeField] private bool recoilEnabled = true;
    [SerializeField] private float missDispersionDegrees = 6f;

    private Quaternion yawPivotBaseLocalRotation;
    private Quaternion pitchPivotBaseLocalRotation;
    private bool hasBasePivotRotations;
    private float nextFireTime;
    private bool hasForcedRoll;
    private float forcedRoll;
    private System.Random deterministicRandom = new System.Random(1337);

    public Func<float> RollSource { get; set; }
    public PrototypeTurretFireStatus LastFireStatus { get; private set; }
    public Vector3 LastProjectileVelocityWorld { get; private set; }
    public Vector3 LastRecoilImpulseWorld { get; private set; }
    public Vector3 LastRecoilPositionWorld { get; private set; }
    public bool LastRecoilApplied { get; private set; }
    public bool LastShotWasIntendedHit { get; private set; }
    public float LastAppliedYawDegrees { get; private set; }
    public float LastAppliedPitchDegrees { get; private set; }
    public Transform Muzzle => mount != null ? mount.Muzzle : null;
    public PrototypeTurretMount Mount => mount;

    private void Awake()
    {
        ResolveReferences();
        CaptureBasePivotRotations();
    }

    public void Configure(ShipStats stats, Rigidbody body, ShipPhysicsCore core, PrototypeTurretMount turretMount)
    {
        shipStats = stats != null ? stats : shipStats;
        shipRigidbody = body != null ? body : shipRigidbody;
        physicsCore = core != null ? core : physicsCore;
        mount = turretMount != null ? turretMount : mount;
        ResolveReferences();
        CaptureBasePivotRotations();
    }

    public void SetForcedRoll(float roll)
    {
        forcedRoll = Mathf.Clamp01(roll);
        hasForcedRoll = true;
    }

    public void ClearForcedRoll()
    {
        hasForcedRoll = false;
    }

    public void SetRandomSeed(int seed)
    {
        deterministicRandom = new System.Random(seed);
        hasForcedRoll = false;
    }

    public bool TryFire()
    {
        return TryFireInternal(Vector3.zero, false);
    }

    public bool TryFireAt(Transform target)
    {
        if (target == null)
        {
            return TryFire();
        }

        return TryFireAt(target.position);
    }

    public bool TryFireAt(Vector3 targetWorldPosition)
    {
        return TryFireInternal(targetWorldPosition, true);
    }

    public PrototypeTurretFireStatus EvaluateFireStatus()
    {
        return EvaluateFireStatusInternal(Vector3.zero, false, true);
    }

    public PrototypeTurretFireStatus EvaluateFireStatus(Vector3 targetWorldPosition)
    {
        return EvaluateFireStatusInternal(targetWorldPosition, true, true);
    }

    public PrototypeTurretArcSafetyResult ValidateArcSafety()
    {
        ResolveReferences();
        if (mount == null || shipStats == null)
        {
            return PrototypeTurretArcSafetyResult.MissingData();
        }

        return mount.ValidateArcSafety(shipStats.YawLimitLeftDegrees, shipStats.YawLimitRightDegrees, shipStats.PitchMinDegrees, shipStats.PitchMaxDegrees);
    }

    [ContextMenu("Validate Arc Safety")]
    public void ValidateArcSafetyFromEditor()
    {
        ValidateArcSafety();
    }

    private bool TryFireInternal(Vector3 targetWorldPosition, bool hasTarget)
    {
        PrototypeTurretFireStatus status = EvaluateFireStatusInternal(targetWorldPosition, hasTarget, true);
        if (!status.canFire)
        {
            LastFireStatus = status;
            return false;
        }

        SpawnProjectile(targetWorldPosition, hasTarget);
        nextFireTime = Time.time + (1f / shipStats.ProjectileFireRate);
        status.intendedHit = LastShotWasIntendedHit;
        LastFireStatus = status;
        return true;
    }

    private PrototypeTurretFireStatus EvaluateFireStatusInternal(Vector3 targetWorldPosition, bool hasTarget, bool applyAim)
    {
        ResolveReferences();
        if (mount == null || mount.Muzzle == null)
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(PrototypeTurretFireBlockReason.NoMuzzle, "no muzzle", hasSelectedTarget: hasTarget);
            return LastFireStatus;
        }

        if (shipStats == null || shipRigidbody == null || physicsCore == null || mount.YawPivot == null || mount.PitchPivot == null)
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(PrototypeTurretFireBlockReason.NoAuthority, "no authority", hasSelectedTarget: hasTarget);
            return LastFireStatus;
        }

        Vector3 aimDirectionWorld = GetRequestedAimDirection(targetWorldPosition, hasTarget);
        float distance = hasTarget ? Vector3.Distance(mount.Muzzle.position, targetWorldPosition) : 0f;
        if (hasTarget && distance > shipStats.EngagementRangeMeters)
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(PrototypeTurretFireBlockReason.OutOfRange, "out of range", distanceMeters: distance, hasSelectedTarget: true);
            return LastFireStatus;
        }

        GetYawPitchInMountSpace(aimDirectionWorld, out float requestedYaw, out float requestedPitch);
        float appliedYaw = Mathf.Clamp(requestedYaw, shipStats.YawLimitLeftDegrees, shipStats.YawLimitRightDegrees);
        float appliedPitch = Mathf.Clamp(requestedPitch, shipStats.PitchMinDegrees, shipStats.PitchMaxDegrees);
        if (applyAim)
        {
            ApplyAim(appliedYaw, appliedPitch);
        }

        bool outsideArc = !Approximately(requestedYaw, appliedYaw) || !Approximately(requestedPitch, appliedPitch);
        if (outsideArc)
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(
                PrototypeTurretFireBlockReason.OutOfArc,
                "out of arc",
                requestedYaw,
                requestedPitch,
                appliedYaw,
                appliedPitch,
                distanceMeters: distance,
                hasSelectedTarget: hasTarget);
            return LastFireStatus;
        }

        float cooldownRemaining = nextFireTime - Time.time;
        if (cooldownRemaining > 0f)
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(
                PrototypeTurretFireBlockReason.Cooldown,
                "cooldown",
                requestedYaw,
                requestedPitch,
                appliedYaw,
                appliedPitch,
                cooldownRemaining,
                distance,
                hasTarget);
            return LastFireStatus;
        }

        LastFireStatus = PrototypeTurretFireStatus.Ready(requestedYaw, requestedPitch, appliedYaw, appliedPitch, distance, hasTarget);
        return LastFireStatus;
    }

    private void SpawnProjectile(Vector3 targetWorldPosition, bool hasTarget)
    {
        Transform muzzle = mount.Muzzle;
        Vector3 shotDirection = GetShotDirection(targetWorldPosition, hasTarget);
        Quaternion shotRotation = Quaternion.LookRotation(shotDirection, mount.MountRoot.up);

        var projectileObject = GameObject.CreatePrimitive(PrimitiveType.Sphere);
        projectileObject.name = "PrototypeProjectile";
        projectileObject.transform.position = muzzle.position;
        projectileObject.transform.rotation = shotRotation;
        projectileObject.transform.localScale = Vector3.one * shipStats.ProjectileDiameter;

        var rigidbody = projectileObject.GetComponent<Rigidbody>();
        if (rigidbody == null)
        {
            rigidbody = projectileObject.AddComponent<Rigidbody>();
        }

        rigidbody.useGravity = false;
        rigidbody.mass = shipStats.ProjectileMass;
        rigidbody.collisionDetectionMode = CollisionDetectionMode.ContinuousDynamic;
        rigidbody.interpolation = RigidbodyInterpolation.Interpolate;

        var projectile = projectileObject.AddComponent<Projectile>();
        LastProjectileVelocityWorld = shipRigidbody.linearVelocity + (shotDirection * shipStats.ProjectileSpeed);
        projectile.Initialize(
            LastProjectileVelocityWorld,
            shipStats.ProjectileLifetime,
            shipStats.ProjectileMass,
            shipStats.ProjectileDiameter,
            shipRigidbody.GetComponentsInChildren<Collider>());

        ApplyRecoilImpulse();
    }

    private Vector3 GetShotDirection(Vector3 targetWorldPosition, bool hasTarget)
    {
        Vector3 directDirection = GetRequestedAimDirection(targetWorldPosition, hasTarget);
        float hitChance = shipStats != null ? shipStats.HitChance : 1f;
        float roll = GetRoll();
        LastShotWasIntendedHit = hitChance >= 1f || (hitChance > 0f && roll <= hitChance);
        if (LastShotWasIntendedHit)
        {
            return directDirection;
        }

        return ApplyDeterministicMissDispersion(directDirection, roll);
    }

    private Vector3 ApplyDeterministicMissDispersion(Vector3 directDirection, float roll)
    {
        Vector3 axis = Vector3.Cross(directDirection, mount.MountRoot.up);
        if (axis.sqrMagnitude < 0.0001f)
        {
            axis = Vector3.Cross(directDirection, mount.MountRoot.right);
        }

        axis.Normalize();
        float sign = roll >= 0.5f ? 1f : -1f;
        float angle = Mathf.Max(0.25f, missDispersionDegrees) * sign;
        return (Quaternion.AngleAxis(angle, axis) * directDirection).normalized;
    }

    private bool ApplyRecoilImpulse()
    {
        LastRecoilApplied = false;
        LastRecoilImpulseWorld = Vector3.zero;
        LastRecoilPositionWorld = mount != null && mount.Muzzle != null ? mount.Muzzle.position : transform.position;

        if (!recoilEnabled || shipStats == null || !shipStats.ProjectileRecoilEnabled || physicsCore == null || mount == null || mount.Muzzle == null)
        {
            return false;
        }

        Vector3 projectileMomentum = mount.Muzzle.forward * (shipStats.ProjectileMass * shipStats.ProjectileSpeed);
        Vector3 recoilImpulse = -projectileMomentum;
        if (!physicsCore.ApplyForceAtPosition(recoilImpulse, LastRecoilPositionWorld, ForceMode.Impulse))
        {
            return false;
        }

        LastRecoilImpulseWorld = recoilImpulse;
        LastRecoilApplied = true;
        return true;
    }

    private void ResolveReferences()
    {
        if (shipStats == null)
        {
            shipStats = GetComponentInParent<ShipStats>();
        }

        if (shipRigidbody == null)
        {
            shipRigidbody = GetComponentInParent<Rigidbody>();
        }

        if (physicsCore == null)
        {
            physicsCore = GetComponentInParent<ShipPhysicsCore>();
        }

        if (mount == null)
        {
            mount = GetComponent<PrototypeTurretMount>();
        }

        if (mount != null)
        {
            mount.ResolveMissingReferences();
        }
    }

    private void CaptureBasePivotRotations()
    {
        if (mount == null || mount.YawPivot == null || mount.PitchPivot == null || hasBasePivotRotations)
        {
            return;
        }

        yawPivotBaseLocalRotation = mount.YawPivot.localRotation;
        pitchPivotBaseLocalRotation = mount.PitchPivot.localRotation;
        hasBasePivotRotations = true;
    }

    private Vector3 GetRequestedAimDirection(Vector3 targetWorldPosition, bool hasTarget)
    {
        if (hasTarget)
        {
            Vector3 toTarget = targetWorldPosition - mount.Muzzle.position;
            if (toTarget.sqrMagnitude > 0.0001f)
            {
                return toTarget.normalized;
            }
        }

        return mount.Muzzle.forward.normalized;
    }

    private void GetYawPitchInMountSpace(Vector3 worldDirection, out float yawDegrees, out float pitchDegrees)
    {
        Vector3 localDirection = mount.MountRoot.InverseTransformDirection(worldDirection.normalized);
        float planarMagnitude = new Vector2(localDirection.x, localDirection.z).magnitude;
        yawDegrees = Mathf.Atan2(localDirection.x, localDirection.z) * Mathf.Rad2Deg;
        pitchDegrees = Mathf.Atan2(localDirection.y, planarMagnitude) * Mathf.Rad2Deg;
    }

    private void ApplyAim(float yawDegrees, float pitchDegrees)
    {
        CaptureBasePivotRotations();
        if (!hasBasePivotRotations || mount == null || mount.YawPivot == null || mount.PitchPivot == null)
        {
            return;
        }

        LastAppliedYawDegrees = Mathf.Clamp(yawDegrees, shipStats.YawLimitLeftDegrees, shipStats.YawLimitRightDegrees);
        LastAppliedPitchDegrees = Mathf.Clamp(pitchDegrees, shipStats.PitchMinDegrees, shipStats.PitchMaxDegrees);
        mount.YawPivot.localRotation = yawPivotBaseLocalRotation * Quaternion.Euler(0f, LastAppliedYawDegrees, 0f);
        mount.PitchPivot.localRotation = pitchPivotBaseLocalRotation * Quaternion.Euler(-LastAppliedPitchDegrees, 0f, 0f);
    }

    private float GetRoll()
    {
        if (hasForcedRoll)
        {
            return forcedRoll;
        }

        if (RollSource != null)
        {
            return Mathf.Clamp01(RollSource());
        }

        return Mathf.Clamp01((float)deterministicRandom.NextDouble());
    }

    private static bool Approximately(float first, float second)
    {
        return Mathf.Abs(first - second) <= 0.01f;
    }
}
