using UnityEngine;

public class ShipStats : MonoBehaviour
{
    [Header("Module Masses (kg)")]
    [SerializeField] private float cockpitMass = 800f;
    [SerializeField] private float hullMass = 1000f;
    [SerializeField] private float fuelTankDryMass = 400f;
    [SerializeField] private float engineMass = 700f;
    [SerializeField] private float gunMass = 250f;
    [SerializeField] private float rcsBlockMass = 80f;

    [Header("Fuel (kg)")]
    [SerializeField] private float maxFuelKg = 300f;
    [SerializeField] private float currentFuelKg = 300f;
    [SerializeField] private float fullThrottleFuelKgPerSecond = 0.6f;

    [Header("Thrust")]
    [SerializeField] private float thrustForce = 45000f;
    [SerializeField] private float reverseThrustMultiplier = 0.35f;

    [Header("Projectiles")]
    [SerializeField] private WeaponProjectileMode projectileMode = WeaponProjectileMode.Hitscan;
    [SerializeField] private float projectileSpeed = 1500f;
    [Range(0.1f, 20f)]
    [SerializeField] private float projectileFireRate = 4f;
    [SerializeField] private float projectileLifetime = 3f;
    [SerializeField] private float projectileDiameter = 0.24f;
    [SerializeField] private float projectileRadius = 0.12f;
    [SerializeField] private float projectileMass = 0.12f;
    [SerializeField] private int tracerEveryNthShot = PrototypeGunSettings.DefaultTracerEveryNthShot;
    [SerializeField] private float projectileSpreadDegrees;
    [SerializeField] private bool projectileRecoilEnabled = true;
    [Range(0f, 1f)]
    [SerializeField] private float hitChance = 1f;
    [SerializeField] private float engagementRangeMeters = 4500f;
    [SerializeField] private float yawLimitLeftDegrees = -35f;
    [SerializeField] private float yawLimitRightDegrees = 35f;
    [SerializeField] private float pitchMinDegrees = -10f;
    [SerializeField] private float pitchMaxDegrees = 35f;
    [SerializeField] private float turretSlewDegreesPerSecond = 90f;
    [SerializeField] private bool autoFireEnabled;
    [SerializeField] private bool leadTargetEnabled;

    [Header("Camera")]
    [Range(10f, 25f)]
    [SerializeField] private float followDistance = 18f;
    [Range(3f, 10f)]
    [SerializeField] private float followHeight = 6f;

    private ShipMassProperties lastMassProperties;
    private bool hasMassProperties;

    public float CockpitMass => Mathf.Max(0f, cockpitMass);
    public float HullMass => Mathf.Max(0f, hullMass);
    public float FuelTankDryMass => Mathf.Max(0f, fuelTankDryMass);
    public float EngineMass => Mathf.Max(0f, engineMass);
    public float GunMass => Mathf.Max(0f, gunMass);
    public float RcsBlockMass => Mathf.Max(0f, rcsBlockMass);

    public float DryMass => Mathf.Max(0.1f, CockpitMass + HullMass + FuelTankDryMass + EngineMass + GunMass + (RcsBlockMass * 4f));
    public float MaxFuelKg => Mathf.Max(0.01f, maxFuelKg);
    public float CurrentFuelKg => Mathf.Clamp(currentFuelKg, 0f, MaxFuelKg);
    public float CurrentMass => hasMassProperties && lastMassProperties.HasDescriptors ? lastMassProperties.TotalMassKg : DryMass + CurrentFuelKg;
    public ShipMassProperties LastMassProperties => hasMassProperties ? lastMassProperties : ShipMassProperties.Fallback(DryMass + CurrentFuelKg);
    public float Thrust => Mathf.Max(0f, thrustForce);
    public float ReverseThrustMultiplier => Mathf.Clamp01(reverseThrustMultiplier);
    public float FuelConsumptionKgPerSecond => Mathf.Max(0f, fullThrottleFuelKgPerSecond);
    public WeaponProjectileMode ProjectileMode => projectileMode;
    public float ProjectileSpeed => Mathf.Max(0f, projectileSpeed);
    public float ProjectileFireRate => Mathf.Max(PrototypeGunSettings.MinimumProjectileFireRate, projectileFireRate);
    public float ProjectileLifetime => Mathf.Max(PrototypeGunSettings.MinimumProjectileLifetime, projectileLifetime);
    public float ProjectileMaxLifetime => ProjectileLifetime;
    public float ProjectileDiameter => Mathf.Max(PrototypeGunSettings.MinimumProjectileDiameter, projectileDiameter);
    public float ProjectileRadius => ProjectileDiameter * 0.5f;
    public float ProjectileMass => Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, projectileMass);
    public int TracerEveryNthShot => Mathf.Max(0, tracerEveryNthShot);
    public float ProjectileSpreadDegrees => Mathf.Clamp(projectileSpreadDegrees, 0f, 45f);
    public bool ProjectileRecoilEnabled => projectileRecoilEnabled;
    public float HitChance => Mathf.Clamp01(hitChance);
    public float EngagementRangeMeters => Mathf.Max(PrototypeGunSettings.MinimumEngagementRangeMeters, engagementRangeMeters);
    public float YawLimitLeftDegrees => GetNormalizedMinimumAngle(yawLimitLeftDegrees, yawLimitRightDegrees);
    public float YawLimitRightDegrees => GetNormalizedMaximumAngle(yawLimitLeftDegrees, yawLimitRightDegrees);
    public float PitchMinDegrees => GetNormalizedMinimumAngle(pitchMinDegrees, pitchMaxDegrees);
    public float PitchMaxDegrees => GetNormalizedMaximumAngle(pitchMinDegrees, pitchMaxDegrees);
    public float TurretSlewDegreesPerSecond => Mathf.Max(PrototypeGunSettings.MinimumTurretSlewDegreesPerSecond, turretSlewDegreesPerSecond);
    public bool AutoFireEnabled => autoFireEnabled;
    public bool LeadTargetEnabled => leadTargetEnabled;
    public float FollowDistance => Mathf.Clamp(followDistance, 10f, 25f);
    public float FollowHeight => Mathf.Clamp(followHeight, 3f, 10f);

    public float LastThrottle { get; private set; }
    public float LastAppliedThrust { get; private set; }
    public float LastAcceleration { get; private set; }
    public float LastFuelRequestedKg { get; private set; }
    public float LastFuelConsumedKg { get; private set; }
    public float LastAppliedFuelFraction { get; private set; } = 1f;

    public bool HasFuel => CurrentFuelKg > 0f;

    private void OnEnable()
    {
        PrototypeWeaponTargetRegistry.Register(transform);
    }

    private void OnDisable()
    {
        PrototypeWeaponTargetRegistry.Unregister(transform);
    }

    public void ResetFuelFlowTelemetry()
    {
        LastFuelRequestedKg = 0f;
        LastFuelConsumedKg = 0f;
        LastAppliedFuelFraction = 1f;
    }

    public float ConsumeFuelForThrust(float normalizedThrottle, float deltaTime)
    {
        float appliedFuelFraction;
        return ConsumeFuelForThrust(normalizedThrottle, deltaTime, out appliedFuelFraction);
    }

    public float ConsumeFuelForThrust(float normalizedThrottle, float deltaTime, out float appliedFuelFraction)
    {
        float fuelUse = FuelConsumptionKgPerSecond * Mathf.Max(0f, normalizedThrottle) * Mathf.Max(0f, deltaTime);
        LastFuelRequestedKg = fuelUse;
        if (fuelUse <= 0f)
        {
            appliedFuelFraction = 1f;
            LastFuelConsumedKg = 0f;
            LastAppliedFuelFraction = appliedFuelFraction;
            return 0f;
        }

        float previousFuel = CurrentFuelKg;
        if (previousFuel <= 0f)
        {
            appliedFuelFraction = 0f;
            LastFuelConsumedKg = 0f;
            LastAppliedFuelFraction = appliedFuelFraction;
            return 0f;
        }

        appliedFuelFraction = Mathf.Clamp01(previousFuel / fuelUse);
        float consumedFuel = Mathf.Min(previousFuel, fuelUse);
        currentFuelKg = previousFuel - consumedFuel;
        LastFuelConsumedKg = consumedFuel;
        LastAppliedFuelFraction = appliedFuelFraction;
        return consumedFuel;
    }

    public void RecordFlightTelemetry(float throttle, float appliedThrust, float acceleration)
    {
        LastThrottle = Mathf.Clamp01(throttle);
        LastAppliedThrust = Mathf.Max(0f, appliedThrust);
        LastAcceleration = acceleration;
    }

    public void RefillFuelFull()
    {
        currentFuelKg = MaxFuelKg;
    }

    public ShipMassProperties RecalculateMassProperties()
    {
        ModuleMassDescriptor[] descriptors = GetComponentsInChildren<ModuleMassDescriptor>(false);
        lastMassProperties = ShipMassProperties.Calculate(transform, descriptors, CurrentFuelKg, DryMass + CurrentFuelKg);
        hasMassProperties = true;
        return lastMassProperties;
    }

    public ShipMassProperties ApplyMassProperties(Rigidbody body)
    {
        ShipMassProperties properties = RecalculateMassProperties();
        if (body == null)
        {
            return properties;
        }

        body.mass = properties.TotalMassKg;

        if (properties.HasDescriptors)
        {
            body.automaticCenterOfMass = false;
            body.centerOfMass = properties.LocalCenterOfMass;
            body.automaticInertiaTensor = false;
            body.inertiaTensorRotation = Quaternion.identity;
            body.inertiaTensor = properties.InertiaTensor;
        }

        return properties;
    }

    private void OnValidate()
    {
        cockpitMass = Mathf.Max(0f, cockpitMass);
        hullMass = Mathf.Max(0f, hullMass);
        fuelTankDryMass = Mathf.Max(0f, fuelTankDryMass);
        engineMass = Mathf.Max(0f, engineMass);
        gunMass = Mathf.Max(0f, gunMass);
        rcsBlockMass = Mathf.Max(0f, rcsBlockMass);
        maxFuelKg = Mathf.Max(0.01f, maxFuelKg);
        currentFuelKg = Mathf.Clamp(currentFuelKg, 0f, maxFuelKg);
        fullThrottleFuelKgPerSecond = Mathf.Max(0f, fullThrottleFuelKgPerSecond);
        thrustForce = Mathf.Max(0f, thrustForce);
        if (projectileMode != WeaponProjectileMode.Hitscan
            && projectileMode != WeaponProjectileMode.SimulatedProjectile
            && projectileMode != WeaponProjectileMode.GuidedProjectile)
        {
            projectileMode = WeaponProjectileMode.Hitscan;
        }

        projectileSpeed = Mathf.Max(0f, projectileSpeed);
        projectileFireRate = Mathf.Max(PrototypeGunSettings.MinimumProjectileFireRate, projectileFireRate);
        projectileLifetime = Mathf.Max(PrototypeGunSettings.MinimumProjectileLifetime, projectileLifetime);
        if (projectileDiameter <= 0f && projectileRadius > 0f)
        {
            projectileDiameter = projectileRadius * 2f;
        }

        projectileDiameter = Mathf.Max(PrototypeGunSettings.MinimumProjectileDiameter, projectileDiameter);
        projectileRadius = ProjectileRadius;
        projectileMass = Mathf.Max(PrototypeGunSettings.MinimumProjectileMass, projectileMass);
        tracerEveryNthShot = Mathf.Max(0, tracerEveryNthShot);
        projectileSpreadDegrees = Mathf.Clamp(projectileSpreadDegrees, 0f, 45f);
        hitChance = Mathf.Clamp01(hitChance);
        engagementRangeMeters = Mathf.Max(PrototypeGunSettings.MinimumEngagementRangeMeters, engagementRangeMeters);
        turretSlewDegreesPerSecond = Mathf.Max(PrototypeGunSettings.MinimumTurretSlewDegreesPerSecond, turretSlewDegreesPerSecond);
        NormalizeAngles(ref yawLimitLeftDegrees, ref yawLimitRightDegrees);
        NormalizeAngles(ref pitchMinDegrees, ref pitchMaxDegrees);
    }


    public void ApplyConfig(PrototypeShipConfig config)
    {
        PrototypeShipMassSettings massSettings = config != null ? config.Masses : PrototypeShipMassSettings.Default;
        PrototypeShipFuelSettings fuelSettings = config != null ? config.Fuel : PrototypeShipFuelSettings.Default;
        PrototypeMainThrusterSettings thrusterSettings = config != null ? config.MainThruster : PrototypeMainThrusterSettings.Default;
        PrototypeGunSettings gunSettings = config != null ? config.Gun : PrototypeGunSettings.Default;
        PrototypeCameraSettings cameraSettings = config != null ? config.Camera : PrototypeCameraSettings.Default;
        ApplySettings(massSettings, fuelSettings, thrusterSettings, gunSettings, cameraSettings);
    }

    public void ApplyVariant(PrototypeShipVariant variant)
    {
        if (variant == null)
        {
            ApplyConfig(null);
            return;
        }

        ApplySettings(variant.Masses, variant.Fuel, variant.MainThruster, variant.Gun, variant.Camera);
    }

    public void ApplySettings(
        PrototypeShipMassSettings massSettings,
        PrototypeShipFuelSettings fuelSettings,
        PrototypeMainThrusterSettings thrusterSettings,
        PrototypeGunSettings gunSettings,
        PrototypeCameraSettings cameraSettings)
    {
        massSettings.Clamp();
        cockpitMass = massSettings.cockpitMass;
        hullMass = massSettings.hullMass;
        fuelTankDryMass = massSettings.fuelTankDryMass;
        engineMass = massSettings.engineMass;
        gunMass = massSettings.gunMass;
        rcsBlockMass = massSettings.rcsBlockMass;

        fuelSettings.Clamp();
        maxFuelKg = fuelSettings.maxFuelKg;
        currentFuelKg = fuelSettings.currentFuelKg;
        fullThrottleFuelKgPerSecond = fuelSettings.fullThrottleFuelKgPerSecond;

        thrusterSettings.Clamp();
        thrustForce = thrusterSettings.thrustForce;
        reverseThrustMultiplier = thrusterSettings.reverseThrustMultiplier;

        gunSettings.Clamp();
        projectileMode = gunSettings.projectileMode;
        projectileSpeed = gunSettings.projectileSpeed;
        projectileFireRate = gunSettings.projectileFireRate;
        projectileLifetime = gunSettings.projectileLifetime;
        projectileDiameter = gunSettings.projectileDiameter;
        projectileRadius = gunSettings.projectileRadius;
        projectileMass = gunSettings.projectileMass;
        tracerEveryNthShot = gunSettings.tracerEveryNthShot;
        projectileSpreadDegrees = gunSettings.projectileSpreadDegrees;
        projectileRecoilEnabled = gunSettings.recoilEnabled;
        hitChance = gunSettings.hitChance;
        engagementRangeMeters = gunSettings.engagementRangeMeters;
        yawLimitLeftDegrees = gunSettings.yawLimitLeftDegrees;
        yawLimitRightDegrees = gunSettings.yawLimitRightDegrees;
        pitchMinDegrees = gunSettings.pitchMinDegrees;
        pitchMaxDegrees = gunSettings.pitchMaxDegrees;
        turretSlewDegreesPerSecond = gunSettings.turretSlewDegreesPerSecond;
        autoFireEnabled = gunSettings.autoFireEnabled;
        leadTargetEnabled = gunSettings.leadTargetEnabled;

        cameraSettings.Clamp();
        followDistance = cameraSettings.followDistance;
        followHeight = cameraSettings.followHeight;
    }

    private static float GetNormalizedMinimumAngle(float first, float second)
    {
        first = Mathf.Clamp(first, -180f, 180f);
        second = Mathf.Clamp(second, -180f, 180f);
        return Mathf.Min(first, second);
    }

    private static float GetNormalizedMaximumAngle(float first, float second)
    {
        first = Mathf.Clamp(first, -180f, 180f);
        second = Mathf.Clamp(second, -180f, 180f);
        return Mathf.Max(first, second);
    }

    private static void NormalizeAngles(ref float minimum, ref float maximum)
    {
        float normalizedMinimum = GetNormalizedMinimumAngle(minimum, maximum);
        float normalizedMaximum = GetNormalizedMaximumAngle(minimum, maximum);
        minimum = normalizedMinimum;
        maximum = normalizedMaximum;
    }
}
