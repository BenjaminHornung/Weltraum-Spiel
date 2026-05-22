using System;
using UnityEngine;

[RequireComponent(typeof(PrototypeTurretMount))]
public class PrototypeTurretWeapon : MonoBehaviour
{
    [SerializeField] private ShipStats shipStats;
    [SerializeField] private Rigidbody shipRigidbody;
    [SerializeField] private ShipPhysicsCore physicsCore;
    [SerializeField] private PrototypeTurretMount mount;
    [SerializeField] private WeaponRecoilStabilizer recoilStabilizer;
    [SerializeField] private bool recoilEnabled = true;
    [SerializeField] private WeaponRecoilMode recoilMode = WeaponRecoilMode.CenterOfMassSafe;
    [SerializeField] private float maxPhysicalRecoilLeverArm = 10f;
    [SerializeField] private float maxRecoilAngularImpulse = 250f;
    [SerializeField] private float missDispersionDegrees = 6f;
    [SerializeField] private float alignmentToleranceDegrees = 1.5f;
    [SerializeField] private float muzzleFlashSeconds = 0.08f;

    private Quaternion yawPivotBaseLocalRotation;
    private Quaternion pitchPivotBaseLocalRotation;
    private bool hasBasePivotRotations;
    private float nextFireTime;
    private bool hasForcedRoll;
    private float forcedRoll;
    private System.Random deterministicRandom = new System.Random(1337);
    private GameObject activeMuzzleFlashVisual;

    public Func<float> RollSource { get; set; }
    public PrototypeTurretFireStatus LastFireStatus { get; private set; }
    public Vector3 LastProjectileVelocityWorld { get; private set; }
    public Vector3 LastMuzzleWorldPosition { get; private set; }
    public float LastMuzzleLeverArm { get; private set; }
    public Vector3 LastRecoilImpulseWorld { get; private set; }
    public Vector3 LastRecoilPositionWorld { get; private set; }
    public Vector3 LastRecoilAngularImpulseWorld { get; private set; }
    public bool LastRecoilApplied { get; private set; }
    public WeaponRecoilMode RecoilMode => recoilMode;
    public PrototypeProjectileFireResult LastFireResult { get; private set; }
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
        return EvaluateFireStatusInternal(Vector3.zero, false, false);
    }

    public PrototypeTurretFireStatus EvaluateFireStatus(Vector3 targetWorldPosition)
    {
        return EvaluateFireStatus(targetWorldPosition, false);
    }

    public PrototypeTurretFireStatus EvaluateFireStatus(Vector3 targetWorldPosition, bool applyAim)
    {
        return EvaluateFireStatusInternal(targetWorldPosition, true, applyAim);
    }

    public PrototypeTurretFireStatus TickAimAtTarget(Transform target, float deltaTime)
    {
        return target != null ? TickAimAtTarget(target.position, deltaTime) : EvaluateFireStatus();
    }

    public PrototypeTurretFireStatus TickAimAtTarget(Vector3 targetWorldPosition, float deltaTime)
    {
        PrototypeTurretFireStatus status = EvaluateFireStatusInternal(targetWorldPosition, true, false);
        if (CanAimWithStatus(status))
        {
            ApplyAimTowards(status.appliedYawDegrees, status.appliedPitchDegrees, deltaTime);
            status = EvaluateFireStatusInternal(targetWorldPosition, true, false);
        }

        return status;
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
        if (hasTarget)
        {
            TickAimAtTarget(targetWorldPosition, Mathf.Max(Time.deltaTime, Time.fixedDeltaTime));
        }

        PrototypeTurretFireStatus status = EvaluateFireStatusInternal(targetWorldPosition, hasTarget, false);
        if (!status.canFire)
        {
            LastFireStatus = status;
            return false;
        }

        FireRuntimeProjectile(targetWorldPosition, hasTarget);
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
            if (applyAim)
            {
                ApplyAim(appliedYaw, appliedPitch);
            }

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

        if (hasTarget && !IsAligned(appliedYaw, appliedPitch))
        {
            LastFireStatus = PrototypeTurretFireStatus.Blocked(
                PrototypeTurretFireBlockReason.Aligning,
                "aligning",
                requestedYaw,
                requestedPitch,
                appliedYaw,
                appliedPitch,
                distanceMeters: distance,
                hasSelectedTarget: true);
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

    private void FireRuntimeProjectile(Vector3 targetWorldPosition, bool hasTarget)
    {
        Transform muzzle = mount.Muzzle;
        Vector3 shotDirection = GetShotDirection(targetWorldPosition, hasTarget);
        PrototypeProjectileFireRequest request = PrototypeProjectileFireRequest.FromWeapon(
            shipStats.ProjectileMode,
            shipRigidbody != null ? shipRigidbody.transform : transform,
            muzzle,
            shotDirection,
            shipRigidbody != null ? shipRigidbody.linearVelocity : Vector3.zero,
            shipStats.ProjectileSpeed,
            shipStats.ProjectileRadius,
            shipStats.ProjectileMass,
            shipStats.ProjectileLifetime,
            Mathf.Max(shipStats.EngagementRangeMeters, shipStats.ProjectileSpeed * shipStats.ProjectileLifetime),
            shipStats.TracerEveryNthShot);

        LastFireResult = PrototypeProjectileSimulation.GetOrCreateDefault().Fire(request);
        LastProjectileVelocityWorld = LastFireResult.projectileVelocityWorld;
        PulseMuzzleFlash();

        ApplyRecoilImpulse(shotDirection);
    }

    private Vector3 GetShotDirection(Vector3 targetWorldPosition, bool hasTarget)
    {
        Vector3 directDirection = GetRequestedAimDirection(targetWorldPosition, hasTarget);
        float hitChance = shipStats != null ? shipStats.HitChance : 1f;
        float roll = GetRoll();
        LastShotWasIntendedHit = hitChance >= 1f || (hitChance > 0f && roll <= hitChance);
        if (LastShotWasIntendedHit)
        {
            return ApplySpread(directDirection);
        }

        return ApplySpread(ApplyDeterministicMissDispersion(directDirection, roll));
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

    private bool ApplyRecoilImpulse(Vector3 projectileDirectionWorld)
    {
        LastRecoilApplied = false;
        LastRecoilImpulseWorld = Vector3.zero;
        LastRecoilAngularImpulseWorld = Vector3.zero;
        LastMuzzleWorldPosition = mount != null && mount.Muzzle != null ? mount.Muzzle.position : transform.position;
        LastRecoilPositionWorld = LastMuzzleWorldPosition;
        Vector3 centerOfMass = shipRigidbody != null ? shipRigidbody.worldCenterOfMass : transform.position;
        LastMuzzleLeverArm = Vector3.Distance(LastMuzzleWorldPosition, centerOfMass);

        if (!recoilEnabled || shipStats == null || !shipStats.ProjectileRecoilEnabled || physicsCore == null || mount == null || mount.Muzzle == null)
        {
            return false;
        }

        Vector3 recoilDirection = projectileDirectionWorld.sqrMagnitude > 0.0001f
            ? projectileDirectionWorld.normalized
            : mount.Muzzle.forward;
        Vector3 projectileMomentum = recoilDirection * (shipStats.ProjectileMass * shipStats.ProjectileSpeed);
        Vector3 recoilImpulse = -projectileMomentum;
        bool applied = ApplyRecoilByMode(recoilImpulse, centerOfMass);
        if (!applied)
        {
            return false;
        }

        LastRecoilImpulseWorld = recoilImpulse;
        LastRecoilApplied = true;
        if (recoilStabilizer != null)
        {
            recoilStabilizer.RecordRecoilImpulse(recoilImpulse, LastRecoilPositionWorld);
        }

        return true;
    }

    private bool ApplyRecoilByMode(Vector3 recoilImpulse, Vector3 centerOfMass)
    {
        if (recoilMode == WeaponRecoilMode.Disabled)
        {
            return false;
        }

        if (recoilMode == WeaponRecoilMode.CenterOfMassSafe || LastMuzzleLeverArm > Mathf.Max(0.01f, maxPhysicalRecoilLeverArm))
        {
            LastRecoilPositionWorld = centerOfMass;
            LastRecoilAngularImpulseWorld = Vector3.zero;
            return physicsCore.ApplyForceAtCenterOfMass(recoilImpulse, ForceMode.Impulse);
        }

        Vector3 angularImpulse = Vector3.Cross(LastRecoilPositionWorld - centerOfMass, recoilImpulse);
        float maxAngularImpulse = Mathf.Max(0f, maxRecoilAngularImpulse);
        if (angularImpulse.magnitude <= maxAngularImpulse)
        {
            LastRecoilAngularImpulseWorld = angularImpulse;
            return physicsCore.ApplyForceAtPosition(recoilImpulse, LastRecoilPositionWorld, ForceMode.Impulse);
        }

        LastRecoilAngularImpulseWorld = Vector3.ClampMagnitude(angularImpulse, maxAngularImpulse);
        bool linearApplied = physicsCore.ApplyForceAtCenterOfMass(recoilImpulse, ForceMode.Impulse);
        bool angularApplied = LastRecoilAngularImpulseWorld.sqrMagnitude <= 0.0001f
            || physicsCore.ApplyTorque(LastRecoilAngularImpulseWorld, ForceMode.Impulse);
        LastRecoilPositionWorld = centerOfMass;
        return linearApplied || angularApplied;
    }

    public void SetRecoilMode(WeaponRecoilMode mode)
    {
        recoilMode = mode;
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

        if (recoilStabilizer == null)
        {
            recoilStabilizer = GetComponentInParent<WeaponRecoilStabilizer>();
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

    private void ApplyAimTowards(float yawDegrees, float pitchDegrees, float deltaTime)
    {
        CaptureBasePivotRotations();
        if (!hasBasePivotRotations || shipStats == null)
        {
            return;
        }

        float maxStep = shipStats.TurretSlewDegreesPerSecond * Mathf.Max(0f, deltaTime);
        if (maxStep <= 0f)
        {
            return;
        }

        float targetYaw = Mathf.Clamp(yawDegrees, shipStats.YawLimitLeftDegrees, shipStats.YawLimitRightDegrees);
        float targetPitch = Mathf.Clamp(pitchDegrees, shipStats.PitchMinDegrees, shipStats.PitchMaxDegrees);
        float nextYaw = Mathf.MoveTowardsAngle(LastAppliedYawDegrees, targetYaw, maxStep);
        float nextPitch = Mathf.MoveTowards(LastAppliedPitchDegrees, targetPitch, maxStep);
        ApplyAim(nextYaw, nextPitch);
    }

    private bool IsAligned(float targetYawDegrees, float targetPitchDegrees)
    {
        float tolerance = Mathf.Max(0.1f, alignmentToleranceDegrees);
        return Mathf.Abs(Mathf.DeltaAngle(LastAppliedYawDegrees, targetYawDegrees)) <= tolerance
            && Mathf.Abs(LastAppliedPitchDegrees - targetPitchDegrees) <= tolerance;
    }

    private static bool CanAimWithStatus(PrototypeTurretFireStatus status)
    {
        return status.blockReason == PrototypeTurretFireBlockReason.None
            || status.blockReason == PrototypeTurretFireBlockReason.Aligning
            || status.blockReason == PrototypeTurretFireBlockReason.Cooldown
            || status.blockReason == PrototypeTurretFireBlockReason.OutOfArc;
    }

    private void PulseMuzzleFlash()
    {
        Transform flashMarker = mount != null ? mount.MuzzleFlashMarker : null;
        Transform host = flashMarker != null ? flashMarker : mount != null ? mount.Muzzle : null;
        if (host == null)
        {
            return;
        }

        Transform visual = flashMarker != null ? flashMarker.Find(PrototypeShipKitWeaponBinder.MuzzleFlashVfxChildName) : null;
        activeMuzzleFlashVisual = visual != null ? visual.gameObject : host.gameObject;
        activeMuzzleFlashVisual.SetActive(true);

        ParticleSystem[] particleSystems = activeMuzzleFlashVisual.GetComponentsInChildren<ParticleSystem>(true);
        for (int i = 0; i < particleSystems.Length; i++)
        {
            particleSystems[i].Play();
        }

        CancelInvoke(nameof(DisableMuzzleFlashVisual));
        Invoke(nameof(DisableMuzzleFlashVisual), Mathf.Max(0.01f, muzzleFlashSeconds));
    }

    private void DisableMuzzleFlashVisual()
    {
        if (activeMuzzleFlashVisual != null)
        {
            activeMuzzleFlashVisual.SetActive(false);
        }
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

    private Vector3 ApplySpread(Vector3 direction)
    {
        Vector3 normalized = direction.sqrMagnitude > 0.0001f ? direction.normalized : Vector3.forward;
        float spread = shipStats != null ? shipStats.ProjectileSpreadDegrees : 0f;
        if (spread <= 0.0001f)
        {
            return normalized;
        }

        Vector2 offset = new Vector2((GetRoll() - 0.5f) * 2f, (GetRoll() - 0.5f) * 2f) * spread;
        Vector3 axisA = Vector3.Cross(normalized, mount != null && mount.MountRoot != null ? mount.MountRoot.up : Vector3.up);
        if (axisA.sqrMagnitude < 0.0001f)
        {
            axisA = Vector3.Cross(normalized, Vector3.right);
        }

        axisA.Normalize();
        Vector3 axisB = Vector3.Cross(normalized, axisA).normalized;
        Quaternion rotation = Quaternion.AngleAxis(offset.x, axisA) * Quaternion.AngleAxis(offset.y, axisB);
        return (rotation * normalized).normalized;
    }
}
